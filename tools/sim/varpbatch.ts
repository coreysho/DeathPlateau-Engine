// The one packet a login's varps now go in, and that it says the same thing the 299 did.
//
// A login sent 536 packets, 371 of them varps - one per varp whose type is transmit, whatever its
// value, which is a figure set by the content and not by the player. The 377 client parses five
// packets per loop iteration (GameShell.run, paced at 20ms), so that was about 2.2 seconds of it
// catching up before it was level with the world. See tools/sim/loginspike.ts.
//
// This checks the replacement carries EVERYTHING the loop did, splits small from large the way the
// client's two readers expect, and lays its bytes out the way Client.java reads them - because a
// batch that is merely shorter and subtly wrong is worse than the 299 packets were.
//
// Usage: NODE_PRODUCTION=true npx tsx tools/sim/varpbatch.ts
import fs from 'fs';

import * as H from './harness.js';
import World from '#/engine/World.js';
import { NetworkPlayer } from '#/engine/entity/NetworkPlayer.js';
import Packet from '#/io/Packet.js';
import VarPlayerType from '#/cache/config/VarPlayerType.js';
import ServerGameProt from '#/network/game/server/ServerGameProt.js';
import ServerGameProtRepository from '#/network/game/server/ServerGameProtRepository.js';
import VarpBatch from '#/network/game/server/model/VarpBatch.js';
import VarpSmall from '#/network/game/server/model/VarpSmall.js';
import ClientSocket from '#/server/ClientSocket.js';
import { toBase37 } from '#/util/JString.js';

const CLIENT = process.env.CLIENT_DIR ?? '../DeathPlateau-Client';

await H.boot();

const R = { ok: 0, bad: 0 };
const check = (what: string, got: unknown, want: unknown) => {
    const pass = JSON.stringify(got) === JSON.stringify(want);
    if (pass) R.ok++;
    else R.bad++;
    console.log(`  ${pass ? 'ok  ' : 'FAIL'} ${what}: ${JSON.stringify(got)}${pass ? '' : `   (want ${JSON.stringify(want)})`}`);
};

class Sink extends ClientSocket {
    send(_src: Uint8Array): void {}
    read(): boolean {
        return false;
    }
    get bufferedBytes(): number {
        return 0;
    }
    close(): void {}
    terminate(): void {}
}

// ---- watch what the player is actually sent, by message
const sent: { name: string; message: unknown }[] = [];
// THE BATCH IS A SNAPSHOT, so what it should contain is the varps as they were WHEN IT WAS BUILT -
// not as they are after the tick. The LOGIN trigger script runs straight after and changed 7 of
// them, which is correct behaviour and read as seven wrong values the first time this was written.
let varsAtBatch: number[] = [];
const proto = NetworkPlayer.prototype as unknown as { writeInner: (m: object) => void };
const real = proto.writeInner;
proto.writeInner = function (message: object) {
    sent.push({ name: message.constructor.name, message });
    if (message.constructor.name === 'VarpBatch') {
        varsAtBatch = [...(this as unknown as { vars: number[] }).vars];
    }
    return real.call(this, message);
};

// a transmitted varp too big for a byte, so the large half of the batch is exercised rather than
// just asserted to be empty
let bigVarp = -1;
for (let id = 0; id < 10000; id++) {
    const type = VarPlayerType.get(id);
    if (type && type.transmit) {
        bigVarp = id;
        break;
    }
}

const socket = new Sink();
socket.remoteAddress = '127.0.0.1';
const p = new NetworkPlayer('varpbatch1', toBase37('varpbatch1'), 4321n, socket);
p.teleport(3222, 3222, 0);
p.vars[bigVarp] = 30000;
World.newPlayers.add(p);
World.cycle(); // the login tick

const batches = sent.filter(s => s.name === 'VarpBatch');
check('a login sends exactly one varp batch', batches.length, 1);

const batch = batches[0].message as VarpBatch;
const inBatch = new Map<number, number>();
for (const [varp, value] of [...batch.small, ...batch.large]) {
    inBatch.set(varp, value);
}
check('no varp is in it twice', inBatch.size, batch.small.length + batch.large.length);

// the batch must be exactly the set the loop sent: every transmit varp, at its current value
const want = new Map<number, number>();
for (let varp = 0; varp < varsAtBatch.length; varp++) {
    if (VarPlayerType.get(varp).transmit) {
        want.set(varp, varsAtBatch[varp]);
    }
}
const missing = [...want.keys()].filter(v => !inBatch.has(v));
const extra = [...inBatch.keys()].filter(v => !want.has(v));
check('it carries every transmitted varp', missing.length, 0);
check('...and nothing that is not one', extra.length, 0);
check('...at the values the player holds', [...want.keys()].filter(v => inBatch.get(v) !== want.get(v)).length, 0);

// the split is what the client's two readers can actually represent: g1b is a signed byte
const smallOutOfRange = batch.small.filter(([, v]) => v < -128 || v > 127);
check('every small entry fits the signed byte the client reads', smallOutOfRange.length, 0);
check('a varp too big for a byte is in the large half', batch.large.some(([v]) => v === bigVarp), true);
check('...and not in the small half as well', batch.small.some(([v]) => v === bigVarp), false);

// ---- THE BYTES. Read back exactly as Client.java reads them: g2 count, then g2 id and g1b value,
// then the same for the large half with g4. A layout that disagrees desyncs the whole stream.
const encoder = ServerGameProtRepository.getEncoder(batch);
const buf = new Packet(new Uint8Array(65535));
encoder!.encode(buf, batch);
const size = buf.pos;
buf.pos = 0;
const readSmall = buf.g2();
const seen = new Map<number, number>();
for (let i = 0; i < readSmall; i++) {
    const varp = buf.g2();
    const value = buf.g1b(); // signed, as the client's g1b is
    seen.set(varp, value);
}
const readLarge = buf.g2();
for (let i = 0; i < readLarge; i++) {
    const varp = buf.g2();
    seen.set(varp, buf.g4());
}
check('the counts on the wire are the counts in the batch', [readSmall, readLarge], [batch.small.length, batch.large.length]);
check('every byte is accounted for - no trailing slack, no overrun', buf.pos, size);
check('and the values survive the round trip, signs included', [...want.keys()].filter(v => seen.get(v) !== want.get(v)).length, 0);

// ---- the client has to have a length for it, or the stream desyncs at the first login
const table = /SERVERPROT_LENGTH = new int\[\] \{([^}]*)\}/.exec(fs.readFileSync(`${CLIENT}/src/main/java/jagex2/io/Protocol.java`, 'utf8'));
const lengths = table![1].split(',').map(v => parseInt(v.trim(), 10));
check('the client reads this opcode as variable-short, as the server writes it', lengths[ServerGameProt.VARP_BATCH.id], -2);
check('...and the server agrees that is what it is', ServerGameProt.VARP_BATCH.length, -2);

// ---- and the per-varp path is untouched: a change after login is still its own packet, because
// there is nothing to batch it with and deferring it would reorder it against the interface packets
sent.length = 0;
p.setVar(bigVarp, 7);
check('a varp changed after login still goes on its own', sent.filter(s => s.name === 'VarpSmall').length, 1);
check('...and does not drag a whole batch with it', sent.filter(s => s.name === 'VarpBatch').length, 0);
void VarpSmall;

proto.writeInner = real;
console.log(`  (the batch carried ${batch.small.length} small and ${batch.large.length} large in ${size} bytes, in place of ${inBatch.size} packets)`);
console.log(`\n${R.ok} ok, ${R.bad} failed`);
process.exit(R.bad > 0 ? 1 : 0);
