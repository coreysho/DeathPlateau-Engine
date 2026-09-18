/**
 * UPDATE_INV_FULL says what it means, and the biggest one the server can send still fits.
 *
 * WHY THIS EXISTS. The encoder used to put every slot of the component on the wire whether or not
 * anything was in it, and one server message is encoded into a single fixed ClientSocket.out
 * buffer whose writes go through DataView - which throws past the end instead of wrapping. So the
 * size of the bank was not a content decision at all: it was capped by a buffer in the network
 * layer, and the cap was invisible until a full bank crashed the writer. Both halves of that are
 * checked here against the real encoder and the real packed configs, not a transcription of them:
 * the trim, and the worst case fitting.
 *
 * It reads the BUILT data, so it has to run after a build, and it needs this repo's node_modules.
 *
 *   npx tsx tools/invfullcheck.ts [data/pack]
 */
import fs from 'fs';

import Component from '#/cache/config/Component.js';
import InvType from '#/cache/config/InvType.js';
import { Inventory } from '#/engine/Inventory.js';
import Packet from '#/io/Packet.js';
import UpdateInvFull from '#/network/game/server/model/UpdateInvFull.js';
import UpdateInvFullEncoder from '#/network/game/server/codec/UpdateInvFullEncoder.js';

const dir = process.argv[2] ?? 'data/pack';

if (!fs.existsSync(`${dir}/client/interface`)) {
    console.log(`no packed interface data at ${dir}/client/interface - build first, or pass the path`);
    process.exit(2);
}

Component.load(dir);
InvType.load(dir);

if (Component.count === 0 || InvType.count === 0) {
    console.log(`${dir} decoded to no components or no invs at all`);
    process.exit(2);
}

let bad = 0;
const check = (ok: boolean, what: string) => {
    console.log((ok ? '  ok   ' : '  FAIL ') + what);
    if (!ok) {
        bad++;
    }
};

// ---- the buffer this all has to fit in, read from the source rather than written down twice
const socketSrc = fs.readFileSync('src/server/ClientSocket.ts', 'utf8');
const allocMatch = /^\s*out = Packet\.alloc\((\d+)\);/m.exec(socketSrc);
if (!allocMatch) {
    console.log('cannot find "out = Packet.alloc(N)" in src/server/ClientSocket.ts');
    process.exit(2);
}
const ALLOC_SIZES: Record<string, number> = { '0': 100, '1': 5000, '2': 30000, '3': 100000, '4': 500000, '5': 2000000 };
const outBytes = ALLOC_SIZES[allocMatch[1]] ?? Number(allocMatch[1]);
// the opcode, the two-byte length of a -2 packet, and then the payload
const HEADER = 3;

// ---- the bank: the one inv big enough for any of this to matter
const bankInv = InvType.getByName('bank');
const bankCom = Component.getByName('bank_main:bank');
if (!bankInv || !bankCom) {
    console.log('no bank inv or no bank_main:bank component in the packed data');
    process.exit(2);
}

const comId = Component.getId('bank_main:bank');
const cells = bankCom.width * bankCom.height;
const TABS = 8;
const padding = TABS * (bankCom.width - 1);

console.log(`bank: ${bankInv.size} slots, grid ${bankCom.width}x${bankCom.height} = ${cells} cells, ` +
    `ClientSocket.out = ${outBytes} bytes`);

check(cells >= bankInv.size + padding,
    `the grid has a cell for every bank slot plus the worst-case tab padding: ` +
    `${cells} >= ${bankInv.size} + ${padding}`);

const enc = new UpdateInvFullEncoder();

/** encode for real and give back the payload length */
const bytes = (inv: Inventory): number => {
    const buf = new Packet(new Uint8Array(outBytes));
    enc.encode(buf, new UpdateInvFull(comId, inv));
    return buf.pos;
};
/** the size field the client will read */
const sizeField = (inv: Inventory): number => {
    const buf = new Packet(new Uint8Array(outBytes));
    enc.encode(buf, new UpdateInvFull(comId, inv));
    return (buf.data[2] << 8) | buf.data[3];
};

const fresh = () => new Inventory(InvType.getId('bank'), bankInv.size);

// ---- the trim
const empty = fresh();
check(sizeField(empty) === 0 && bytes(empty) === 4,
    `an empty bank transmits no slots at all: size ${sizeField(empty)}, ${bytes(empty)} bytes`);

const one = fresh();
one.items[0] = { id: 1, count: 1 };
check(sizeField(one) === 1 && bytes(one) === 4 + 3,
    `one item in slot 0 transmits one slot: size ${sizeField(one)}, ${bytes(one)} bytes`);

const gap = fresh();
gap.items[0] = { id: 1, count: 1 };
gap.items[9] = { id: 2, count: 1 };
check(sizeField(gap) === 10,
    `a gap in the middle is still transmitted - the trim only cuts the tail: size ${sizeField(gap)}`);

const last = fresh();
last.items[bankInv.size - 1] = { id: 1, count: 1 };
check(sizeField(last) === bankInv.size,
    `an item in the last slot transmits the whole inv: size ${sizeField(last)} of ${bankInv.size}`);

// a placeholder is an Item with count 0. If the trim treated it as empty, a bank whose tail is all
// placeholders would come back with them silently gone.
const ph = fresh();
ph.items[100] = { id: 42, count: 0 };
check(sizeField(ph) === 101,
    `a placeholder (count 0) counts as occupied: size ${sizeField(ph)}`);

// ---- the fit
const full = fresh();
for (let i = 0; i < bankInv.size; i++) {
    // the most expensive slot there is: a stack over 255, which costs the 255 marker and a 4-byte count
    full.items[i] = { id: 4151, count: 2_000_000_000 };
}
const worst = bytes(full) + HEADER;
check(worst <= outBytes,
    `the worst case - all ${bankInv.size} slots holding a stack over 255 - fits in the buffer: ` +
    `${worst} <= ${outBytes} bytes`);
check(enc.test(new UpdateInvFull(comId, full)) === bytes(full),
    `test() predicts what encode() writes: ${enc.test(new UpdateInvFull(comId, full))} vs ${bytes(full)}`);

// and the reason the trim earns its keep: the common case is nothing like the worst case
const typical = fresh();
for (let i = 0; i < 200; i++) {
    typical.items[i] = { id: 1000 + i, count: 1 };
}
check(bytes(typical) === 4 + 200 * 3,
    `a 200-item bank costs 200 slots, not ${bankInv.size}: ${bytes(typical)} bytes`);

console.log();
console.log(bad === 0 ? 'ALL PASS' : `${bad} FAILED`);
process.exit(bad === 0 ? 0 : 1);
