// WHAT A LOGIN ACTUALLY SENDS, by message class and by bytes.
//
// tools/sim/packetcount.ts established the figure: an idle client is sent 2 messages a tick and a
// login is several hundred, against the ~150 a tick the 377 client can drain (5 per 20ms loop
// iteration, GameShell.run). That makes a login the one place the client measurably falls behind
// the world, so this says WHICH messages it is - a count alone cannot tell you what to do about it.
//
// WHAT IT FOUND, and what was done about it. For a brand new character:
//
//      before   536 packets, 3144 bytes - 371 packets and 1517 bytes of them varps,
//               one packet per transmitted varp whatever its value
//      after    238 packets, 2852 bytes - the 299 the login loop sent are one VARP_BATCH
//
// About 2.2 seconds of the client catching up, down to about 0.95. The 61 small and 11 large varps
// still in the list below are not the loop: they are varps the LOGIN trigger script changes after
// the batch has gone, which are ordinary mid-session changes and belong in packets of their own.
//
// The varp count does not depend on the player: onLogin sends every varp whose type is transmit,
// so it is the same for a new character and a maxed one. Nor could the zeros simply be skipped -
// RESET_CLIENT_VARCACHE copies varCache back into varps rather than zeroing them (Client.java,
// ptype == 113), and the client only frees that array in unload(), so a player who logs out to the
// login screen and back in still holds the last session's values and a varp that is now 0 would
// keep its old one. That is why this is a batch and not a filter.
//
// Usage: NODE_PRODUCTION=true npx tsx tools/sim/loginspike.ts
import * as H from './harness.js';
import World from '#/engine/World.js';
import { NetworkPlayer } from '#/engine/entity/NetworkPlayer.js';
import ClientSocket from '#/server/ClientSocket.js';
import { toBase37 } from '#/util/JString.js';

await H.boot();

class Sink extends ClientSocket {
    sends = 0;
    bytes = 0;
    send(src: Uint8Array): void { this.sends++; this.bytes += src.length; }
    read(): boolean { return false; }
    get bufferedBytes(): number { return 0; }
    close(): void {}
    terminate(): void {}
}

const tally = new Map<string, { n: number; bytes: number }>();
let collecting = false;
const proto = NetworkPlayer.prototype as unknown as { writeInner: (m: { constructor: { name: string } }) => void };
const real = proto.writeInner;
proto.writeInner = function (message) {
    if (collecting) {
        const key = message.constructor.name;
        if (key === 'VarpBatch') {
            const b = message as unknown as { small: number[][]; large: number[][] };
            console.log(`    [VarpBatch carries ${b.small.length} small + ${b.large.length} large]`);
        }
        const sock = (this as unknown as { client: Sink }).client;
        const before = sock.bytes;
        const r = real.call(this, message);
        const e = tally.get(key) ?? { n: 0, bytes: 0 };
        e.n++;
        e.bytes += sock.bytes - before;
        tally.set(key, e);
        return r;
    }
    return real.call(this, message);
};

const socket = new Sink();
socket.remoteAddress = '127.0.0.1';
const p = new NetworkPlayer('spikeprobe', toBase37('spikeprobe'), 1234n, socket);
p.teleport(3222, 3222, 0);
World.newPlayers.add(p);

collecting = true;
World.cycle();            // the login tick
const loginTotal = [...tally.values()].reduce((a, e) => a + e.n, 0);
const loginBreak = [...tally.entries()].sort((a, b) => b[1].n - a[1].n);
tally.clear();

H.tick(5);
tally.clear();
World.cycle();            // a settled tick
const idleBreak = [...tally.entries()].sort((a, b) => b[1].n - a[1].n);
const idleTotal = [...tally.values()].reduce((a, e) => a + e.n, 0);
collecting = false;

console.log(`\nLOGIN TICK: ${loginTotal} messages`);
const loginBytes = loginBreak.reduce((a, [, e]) => a + e.bytes, 0);
for (const [name, e] of loginBreak.slice(0, 14)) {
    console.log(`  ${String(e.n).padStart(4)}  ${String(e.bytes).padStart(6)} B  ${name}`);
}
console.log(`  ---- ${loginBytes} bytes in ${loginTotal} packets`);
console.log(`\nSETTLED TICK: ${idleTotal} messages`);
for (const [name, e] of idleBreak.slice(0, 8)) {
    console.log(`  ${String(e.n).padStart(4)}  ${name}`);
}
process.exit(0);
