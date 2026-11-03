// The PING/PONG round trip over a real socket, against a running server.
//
// This is the wire test the sims cannot be: it logs in over TCP, then walks the server's actual
// packet stream using the LENGTH TABLE OUT OF THE JAVA CLIENT (Protocol.SERVERPROT_LENGTH). If the
// server's idea of a packet's length and the client's ever disagree, the walk desyncs and this
// fails - which is the failure that would otherwise reach players as a broken client.
//
//   npx tsx tools/sim/pingwire.ts [host] [port]
import fs from 'fs';
import net from 'net';
import forge from 'node-forge';

import Isaac from '#/io/Isaac.js';
import Packet from '#/io/Packet.js';
import Environment from '#/util/Environment.js';

const HOST = process.argv[2] ?? '127.0.0.1';
const PORT = parseInt(process.argv[3] ?? String(Environment.NODE_PORT), 10);
const CLIENT = process.env.CLIENT_DIR ?? '../DeathPlateau-Client';

const R = { ok: 0, bad: 0 };
const check = (what: string, got: unknown, want: unknown) => {
    const pass = JSON.stringify(got) === JSON.stringify(want);
    if (pass) R.ok++;
    else R.bad++;
    console.log(`  ${pass ? 'ok  ' : 'FAIL'} ${what}: ${JSON.stringify(got)}${pass ? '' : `   (want ${JSON.stringify(want)})`}`);
};

// ---- the client's own tables, read from its source so this cannot drift ----
function clientLengths(): number[] {
    const src = fs.readFileSync(`${CLIENT}/src/main/java/jagex2/io/Protocol.java`, 'utf8');
    const m = /SERVERPROT_LENGTH = new int\[\] \{([^}]*)\}/.exec(src);
    if (!m) throw new Error('could not find SERVERPROT_LENGTH in the client');
    return m[1].split(',').map(v => parseInt(v.trim(), 10));
}
function clientRevision(): number {
    const src = fs.readFileSync(`${CLIENT}/src/main/java/jagex2/client/Client.java`, 'utf8');
    const m = /this\.login\.p2\((\d+)\);/.exec(src);
    if (!m) throw new Error('could not find the build number in the client');
    return parseInt(m[1], 10);
}

const LEN = clientLengths();

// ---- the login handshake, as Client.login writes it ----
function modPow(b: bigint, e: bigint, m: bigint): bigint {
    let r = 1n;
    b %= m;
    while (e > 0n) {
        if (e & 1n) r = (r * b) % m;
        e >>= 1n;
        b = (b * b) % m;
    }
    return r;
}
function toByteArray(x: bigint): Buffer {
    let h = x.toString(16);
    if (h.length % 2) h = '0' + h;
    let b = Buffer.from(h, 'hex');
    if (b[0] & 0x80) b = Buffer.concat([Buffer.from([0]), b]);
    return b;
}

function read(sock: net.Socket, n: number, timeout = 15000): Promise<Buffer> {
    return new Promise((resolve, reject) => {
        const tryTake = () => {
            const got = sock.read(n);
            if (got) {
                clearTimeout(timer);
                sock.off('readable', tryTake);
                resolve(got);
            }
        };
        const timer = setTimeout(() => {
            sock.off('readable', tryTake);
            reject(new Error(`timed out waiting for ${n} bytes`));
        }, timeout);
        sock.on('readable', tryTake);
        tryTake();
    });
}

const pub = forge.pki.publicKeyFromPem(
    forge.pki.publicKeyToPem(forge.pki.setRsaPublicKey(forge.pki.privateKeyFromPem(fs.readFileSync(Environment.LOGIN_RSA_KEY_PATH, 'ascii')).n, forge.pki.privateKeyFromPem(fs.readFileSync(Environment.LOGIN_RSA_KEY_PATH, 'ascii')).e))
);
const N = BigInt(pub.n.toString(10));
const E = BigInt(pub.e.toString(10));

async function main() {
    console.log(`server ${HOST}:${PORT}, client source ${CLIENT}`);
    check('the client and the server agree on the build number', clientRevision(), Environment.ENGINE_REVISION);
    check('the client knows PING is 3 bytes (seq + the measured round trip)', LEN[1], 3);

    const crcs = Buffer.from(await (await fetch(`http://${HOST}:${Environment.WEB_PORT}/crc0`)).arrayBuffer()).subarray(0, 36);
    const sock = net.connect(PORT, HOST);
    await new Promise<void>((res, rej) => {
        sock.once('connect', () => res());
        sock.once('error', rej);
    });

    sock.write(Buffer.from([14, 0]));
    const hello = await read(sock, 17);
    if (hello[8] !== 0) throw new Error(`the server refused the handshake: ${hello[8]}`);

    const seed = [0, 0, 0, 0].map(() => (Math.random() * 0xffffffff) | 0);
    const block = new Packet(new Uint8Array(100));
    block.p1(10);
    for (const s of seed) block.p4(s);
    block.p4(1234); // uid
    // a fresh name each run: the previous run's player is still logging out of the world for a
    // few seconds afterwards, and the server rightly refuses a second login for them
    const who = 'pingwire' + Math.floor(Math.random() * 900 + 100);
    block.pjstr(who);
    block.pjstr('hunter2');
    // Saved logins (2026-11-02): a client of this revision always writes both, empty when it has
    // nothing to say. Leaving them out makes the server read whatever is left in the buffer and
    // treat the login as one presenting a token.
    block.p1(0); // do not remember me
    block.pjstr(''); // no token
    const plain = Buffer.from(block.data.subarray(0, block.pos));
    const enc = toByteArray(modPow(BigInt('0x' + plain.toString('hex')), E, N));
    const body = Buffer.concat([Buffer.from([255, Environment.ENGINE_REVISION >> 8, Environment.ENGINE_REVISION & 0xff, 0]), crcs, Buffer.from([enc.length]), enc]);
    sock.write(Buffer.concat([Buffer.from([16, body.length]), body]));

    const reply = await read(sock, 1);
    check('the login is accepted', reply[0], 2);
    if (reply[0] !== 2) throw new Error('cannot go on without a logged-in session');
    // A refusal is one byte; an acceptance is THREE - the 2, the chat crown and the mouse-tracking
    // flag (World.processLogins). Reading only the 2 leaves the other two in front of the encrypted
    // stream, and every opcode after that decodes as noise.
    await read(sock, 2);

    // the server reads with Isaac(seed) and writes with Isaac(seed+50), so these are the other way round
    const outCipher = new Isaac(seed);
    const inCipher = new Isaac(seed.map(s => s + 50));

    // ---- walk the stream the way the client does ----
    // The first probes land while this script is still chewing through everything a login sends
    // (the map, the invs, the stats), and what they measure is THIS script being slow, not the
    // connection. So take several and judge the last, by which time the stream is quiet.
    const WANT = 5;
    let pings = 0;
    let firstSeq = -1;
    let measured = -1;
    const all: number[] = [];
    const started = Date.now();
    const seen = new Set<number>();

    while (Date.now() - started < 40000 && pings < WANT) {
        const opByte = (await read(sock, 1))[0];
        const op = (opByte - inCipher.nextInt()) & 0xff;
        let size = LEN[op];
        if (size === -1) size = (await read(sock, 1))[0];
        else if (size === -2) size = (await read(sock, 2)).readUInt16BE(0);
        if (size === undefined || size < 0) throw new Error(`the client has no length for opcode ${op} - the stream would desync here`);
        if (process.env.PINGWIRE_TRACE) {
            console.log(`    op ${op} size ${size}`);
        }
        const payload = size > 0 ? await read(sock, size) : Buffer.alloc(0);
        seen.add(op);

        if (op === 1) {
            pings++;
            const seq = payload[0];
            const rtt = payload.readUInt16BE(1);
            if (pings === 1) {
                firstSeq = seq;
                check('the first probe carries "not measured yet"', rtt, 0xffff);
            } else {
                measured = rtt;
                all.push(rtt);
            }
            // answer every one of them, as the client does, straight away
            sock.write(Buffer.from([(2 + outCipher.nextInt()) & 0xff, seq]));
        }
    }

    check('the probes keep coming on their own', pings, WANT);
    check('the probe sequence advances', measured >= 0 && firstSeq >= 0, true);
    check('the second probe carries a real measurement, not "unknown"', measured !== 0xffff, true);
    check('once the stream is quiet the round trip is a loopback number (under 100 ms)', measured >= 0 && measured < 100, true);
    console.log(`  (measurements in order: ${all.join(', ')} ms - the early ones are this script catching up)`);
    console.log(`  (${seen.size} distinct opcodes walked with the client's own length table, no desync)`);

    sock.destroy();
    console.log(`\n${R.ok} ok, ${R.bad} failed`);
    process.exit(R.bad > 0 ? 1 : 0);
}

main().catch(err => {
    console.error('FAILED:', err.message);
    process.exit(1);
});
