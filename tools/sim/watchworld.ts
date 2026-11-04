// Does the world-watcher actually tell a serving world from a running one?
//
// WHY THIS NEEDS A TEST AT ALL. tools/server/watch-world.py exists because two things that were
// broken reported healthy: `systemctl is-active` through a crash-loop, and a TCP connect on the
// night the game port was open and LoginServer.ts could not be read. The whole claim of the file
// is that asking the LOGIN PATH separates those from a world that is serving. A probe that said
// "ok" to anything with a socket open would make exactly the same mistake in a new place, so the
// case that matters most here is the THIRD one below: a server that accepts the connection and
// then says nothing. A connect test passes it. This has to fail it.
//
// The fake worlds are written from World.onClientData's opcode-14 branch: eight zero bytes, then
// the status, then eight of seed. Seventeen, with the status at offset 8.
//
// Usage: npx tsx tools/sim/watchworld.ts
import { spawn, spawnSync } from 'node:child_process';
import http from 'node:http';
import net from 'node:net';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const R = { ok: 0, bad: 0 };
const check = (what: string, got: unknown, want: unknown) => {
    const pass = JSON.stringify(got) === JSON.stringify(want);
    if (pass) R.ok++;
    else R.bad++;
    console.log(`  ${pass ? 'ok  ' : 'FAIL'} ${what}${pass ? '' : `\n         got  ${JSON.stringify(got)}\n         want ${JSON.stringify(want)}`}`);
};

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'watchworld-'));
const PROBE = 'tools/server/watch-world.py';

/**
 * What the probe said and what it exited with.
 *
 * NOT spawnSync, and this cost an hour. The fake worlds below are servers in THIS process, and
 * spawnSync blocks node's event loop until the child is gone - so the probe's connection sat in
 * the listen backlog, never got accepted, and the first run of this file reported a healthy world
 * as a timeout. The bug was in the test, and a test that cannot tell its own mistake from the
 * tool's is worse than no test.
 */
function probe(env: Record<string, string>): Promise<{ code: number; out: string }> {
    return new Promise(done => {
        const child = spawn('python3', [PROBE], {
            env: { ...process.env, WATCH_TIMEOUT: '1', ...env }
        });
        let out = '';
        child.stdout.on('data', c => (out += c));
        child.stderr.on('data', c => (out += c));
        child.on('close', code => done({ code: code ?? -1, out }));
    });
}

type Mode = 'serving' | 'silent' | 'refusing' | 'truncating';

/** A world in one of the states it can be in, on a port the OS picks so shards cannot collide. */
function world(mode: Mode): Promise<{ port: number; firstBytes: Promise<number[]>; stop: () => void }> {
    return new Promise(resolve => {
        // A DEADLINE, because the first version of this hung instead of failing. Mutate the probe
        // into a plain connect test and it sends nothing - so a promise waiting on its first bytes
        // waits for ever, and the run burns the job's timeout rather than reporting a red check.
        let seen: (v: number[]) => void;
        const firstBytes = new Promise<number[]>(r => {
            seen = r;
            setTimeout(() => r([]), 4000).unref();
        });

        const server = net.createServer(socket => {
            socket.once('data', data => {
                seen([...data]);
                if (mode === 'serving') {
                    socket.write(Buffer.from([0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 2, 3, 4, 5, 6, 7, 8]));
                } else if (mode === 'refusing') {
                    // status 5 at offset 8: an update pending. Answering, and not serving.
                    socket.write(Buffer.from([0, 0, 0, 0, 0, 0, 0, 0, 5, 0, 0, 0, 0, 0, 0, 0, 0]));
                } else if (mode === 'truncating') {
                    socket.end(Buffer.from([0, 0, 0, 0]));
                }
                // 'silent' writes nothing at all: the port is open and the login path is dead
            });
            socket.on('error', () => {});
        });

        server.listen(0, '127.0.0.1', () => {
            const port = (server.address() as net.AddressInfo).port;
            resolve({ port, firstBytes, stop: () => server.close() });
        });
    });
}

/** Somewhere for the alerts to go, so "it told somebody" can be checked rather than assumed. */
function sink(): Promise<{ url: string; got: string[]; stop: () => void }> {
    return new Promise(resolve => {
        const got: string[] = [];
        const server = http.createServer((req, res) => {
            let body = '';
            req.on('data', c => (body += c));
            req.on('end', () => {
                got.push(JSON.parse(body).content);
                res.writeHead(204).end();
            });
        });
        server.listen(0, '127.0.0.1', () => {
            const port = (server.address() as net.AddressInfo).port;
            resolve({ url: `http://127.0.0.1:${port}/hook`, got, stop: () => server.close() });
        });
    });
}

async function main() {
    // SAY SO ONCE, rather than failing eighteen checks in a way that reads like a broken probe.
    // The watcher is python because the relay it runs on has python and nothing else; a box
    // without it cannot run the tool, so it cannot run this either.
    const haveVersion = spawnSync('python3', ['--version'], { encoding: 'utf-8' });
    if (haveVersion.status !== 0) {
        console.log('python3 is not on this machine, and the thing under test is a python script.');
        process.exit(1);
    }

    // ---------------------------------------------------------------- what it asks
    console.log('\nthe question it puts to the world');
    const serving = await world('serving');
    const asked = await probe({ WATCH_PORT: String(serving.port), WATCH_STATE: path.join(dir, 'a.json') });
    check("it sends Client.login's own two bytes and nothing else", await serving.firstBytes, [14, 0]);
    check('a world that answers is healthy', [asked.code, asked.out.includes('handshake accepted')], [0, true]);
    serving.stop();

    // ---------------------------------------------------------------- the three ways to be broken
    console.log('\nand a world that is running without serving');

    // THE ONE A CONNECT TEST PASSES. Prove the connect succeeds first, then that the probe fails:
    // otherwise this only says the port was shut, which is the easy case.
    const silent = await world('silent');
    const connected = await new Promise<boolean>(done => {
        const s = net.createConnection({ host: '127.0.0.1', port: silent.port }, () => {
            s.destroy();
            done(true);
        });
        s.on('error', () => done(false));
    });
    const quiet = await probe({ WATCH_PORT: String(silent.port), WATCH_STATE: path.join(dir, 'b.json') });
    check('a plain TCP connect is happy with a dead login path', connected, true);
    check('...and the probe is not', [quiet.code, /TimeoutError|timed out/.test(quiet.out)], [1, true]);
    silent.stop();

    const refusing = await world('refusing');
    const refused = await probe({ WATCH_PORT: String(refusing.port), WATCH_STATE: path.join(dir, 'c.json') });
    check('answering with a refusal is not serving either', [refused.code, refused.out.includes('refused the handshake with status 5')], [1, true]);
    refusing.stop();

    const truncating = await world('truncating');
    const cut = await probe({ WATCH_PORT: String(truncating.port), WATCH_STATE: path.join(dir, 'd.json') });
    check('a reply that stops half way says how far it got', [cut.code, cut.out.includes('closed the connection after 4 of 17 bytes')], [1, true]);
    truncating.stop();

    const shut = await probe({ WATCH_PORT: '1', WATCH_STATE: path.join(dir, 'e.json') });
    check('nothing listening at all is a failure', shut.code, 1);

    // ---------------------------------------------------------------- and when it opens its mouth
    console.log('\nwhen it says something, and when it keeps quiet');
    const alerts = await sink();
    const state = path.join(dir, 'f.json');
    const dead = { WATCH_PORT: '1', WATCH_STATE: state, WATCH_WEBHOOK: alerts.url, WATCH_NAME: 'the test world' };

    await probe(dead);
    await probe(dead);
    check('two failures is a deploy, and nobody is told', alerts.got.length, 0);

    await probe(dead);
    check('the third is an outage, and somebody is', alerts.got.length, 1);
    check('...and the alert names the world and the address', [alerts.got[0].includes('the test world'), alerts.got[0].includes('is not answering')], [true, true]);

    await probe(dead);
    await probe(dead);
    check('it does not say it again every minute while it stays down', alerts.got.length, 1);

    // back up: the state file is carrying down=true, so this is the recovery
    const back = await world('serving');
    const recovered = await probe({ WATCH_PORT: String(back.port), WATCH_STATE: state, WATCH_WEBHOOK: alerts.url, WATCH_NAME: 'the test world' });
    check('coming back is worth saying too', [alerts.got.length, (alerts.got[1] ?? '').includes('answering again')], [2, true]);
    check('and it exits clean once it is', recovered.code, 0);
    back.stop();

    // a short outage that recovers before the third check tells nobody anything
    fs.writeFileSync(path.join(dir, 'g.json'), JSON.stringify({ fails: 2, down: false, at: 0 }));
    const brief = await world('serving');
    await probe({ WATCH_PORT: String(brief.port), WATCH_STATE: path.join(dir, 'g.json'), WATCH_WEBHOOK: alerts.url });
    check("a world that comes back on the second check is nobody's business", alerts.got.length, 2);
    brief.stop();

    // ---------------------------------------------------------------- it must survive its own tools
    console.log('\nand it keeps working when the things around it do not');
    const noWebhook = await probe({ WATCH_PORT: '1', WATCH_STATE: path.join(dir, 'h.json'), WATCH_FAILS: '1' });
    check('no webhook configured still logs the outage and says so', [noWebhook.code, noWebhook.out.includes('no WATCH_WEBHOOK set')], [1, true]);

    const badHook = await probe({ WATCH_PORT: '1', WATCH_STATE: path.join(dir, 'i.json'), WATCH_FAILS: '1', WATCH_WEBHOOK: 'http://127.0.0.1:1/nope' });
    check('a webhook that is itself down is a warning, not a crash', [badHook.code, badHook.out.includes('could not reach the webhook')], [1, true]);

    const unwritable = await world('serving');
    const noState = await probe({ WATCH_PORT: String(unwritable.port), WATCH_STATE: '/proc/nowhere/state.json' });
    check('a state file it cannot write warns and still reports the world', [noState.code, noState.out.includes('could not write')], [0, true]);
    unwritable.stop();

    const singular = await probe({ WATCH_PORT: '1', WATCH_STATE: path.join(dir, 'j.json'), WATCH_FAILS: '1' });
    check('it counts in english', singular.out.includes('1 check in a row'), true);

    alerts.stop();
    fs.rmSync(dir, { recursive: true, force: true });

    console.log(`\n${R.ok} ok, ${R.bad} failed`);
    process.exit(R.bad > 0 ? 1 : 0);
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
