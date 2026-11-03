// A DROP LANDS EXACTLY ONCE, and taking it back is exactly one item.
//
//   npx tsx tools/sim/droplands.ts
//
// WHY THIS FILE EXISTS. The fuzzer's old opportunistic conservation watcher used to assert this as
// a side effect: it counted the bot's own drops on the ground, so a drop that never landed, or
// landed twice, moved the total. That watcher was retired (see the note above watchItemAudit in
// src/engine/bot/BotFuzzWatch.ts) because the ground is not a ledger a fuzzer can read - an obj is
// only counted while it is within nine zones of the bot, it stops being the bot's at all when the
// lootdrop timer makes it public, and a drop onto a tile that already holds the same obj merges
// while a partial stack does not. Every finding it ever produced was one of those three.
//
// Retiring it took a real assertion with it, and that assertion belongs in a sim rather than in a
// fuzzer: one known item, one known tile, counted. The three things that defeated the watcher are
// exactly the three things this file can control.
//
// WHAT EACH CASE IS FOR
//   one           the simple claim: one Drop produces one obj holding one item, and the backpack
//                 has one fewer.
//   stack         a stackable dropped whole. 500 coins must be ONE obj of 500, not 500 objs or an
//                 obj of 1 - and taking it back must restore 500.
//   merge         the case the watcher could not survive: dropping the same obj twice onto one
//                 tile. Whatever the engine does - one obj of 2, or two objs of 1 - the TOTAL on
//                 that tile must be 2, and taking it all back must restore 2.
//   partial       a partial stack dropped onto an existing one. 200 coins dropped, then 300 more
//                 dropped onto the same tile, is 500 there however it is stored. Both halves go
//                 through the real Drop op rather than a hand-built Obj.
//   notmine       a drop is private: it is the dropper's until the lootdrop timer runs out, so a
//                 second player must not see it as theirs. This is the check that would have told
//                 the old watcher its ground reads were not safe.
import * as H from './harness.js';
import { check, R } from './a1lib.js';
import InvType from '#/cache/config/InvType.js';
import ObjType from '#/cache/config/ObjType.js';
import World from '#/engine/World.js';

await H.boot();

const AT: [number, number] = [3222, 3218];

/** Everything on the bot's tile belonging to `who`, as a total per obj id. */
function onTile(level: number, x: number, z: number, receiver: bigint): Map<number, number> {
    const total = new Map<number, number>();
    for (const obj of World.gameMap.getZone(x, z, level).getAllObjsSafe()) {
        if (obj.x !== x || obj.z !== z || obj.receiver64 !== receiver) {
            continue;
        }
        total.set(obj.type, (total.get(obj.type) ?? 0) + obj.count);
    }
    return total;
}

/** How many separate objs of this id sit on the tile for `who`. */
function objCount(level: number, x: number, z: number, id: number, receiver: bigint): number {
    let n = 0;
    for (const obj of World.gameMap.getZone(x, z, level).getAllObjsSafe()) {
        if (obj.x === x && obj.z === z && obj.type === id && obj.receiver64 === receiver) {
            n++;
        }
    }
    return n;
}

const p = H.makePlayer('droplands', AT[0], AT[1]);
H.tick(3);
const inv = p.getInventory(InvType.INV)!;
/** The Drop op on an obj, which ObjType defaults to iop5. */
const dropOp = (name: string) => (ObjType.get(ObjType.getId(name)).iop ?? []).findIndex(o => o === 'Drop') + 1;

function reset() {
    inv.removeAll();
    // Clear the tile, so one case cannot be read by the next.
    for (const obj of [...World.gameMap.getZone(p.x, p.z, p.level).getAllObjsSafe()]) {
        if (obj.x === p.x && obj.z === p.z) {
            World.removeObj(obj, 0);
        }
    }
    H.tick(2);
}

// ---------------------------------------------------------------------------------- one
{
    reset();
    const name = 'bones';
    const id = ObjType.getId(name);
    p.invAdd(InvType.INV, id, 1);
    H.opheld(p, name, dropOp(name));
    H.tick(2);
    check('one: the backpack has none left', inv.getItemCount(id), 0);
    check('one: exactly one obj on the tile', objCount(p.level, p.x, p.z, id, p.hash64), 1);
    check('one: holding exactly one', onTile(p.level, p.x, p.z, p.hash64).get(id), 1);
}

// ---------------------------------------------------------------------------------- stack
{
    reset();
    const name = 'coins';
    const id = ObjType.getId(name);
    p.invAdd(InvType.INV, id, 500);
    H.opheld(p, name, dropOp(name));
    H.tick(2);
    check('stack: one obj, not five hundred', objCount(p.level, p.x, p.z, id, p.hash64), 1);
    check('stack: holding all five hundred', onTile(p.level, p.x, p.z, p.hash64).get(id), 500);
    check('stack: the backpack has none left', inv.getItemCount(id), 0);
}

// ---------------------------------------------------------------------------------- merge
{
    reset();
    const name = 'bones';
    const id = ObjType.getId(name);
    p.invAdd(InvType.INV, id, 2);
    H.opheld(p, name, dropOp(name));
    H.tick(2);
    H.opheld(p, name, dropOp(name));
    H.tick(2);
    // HOW it is stored is the engine's business; the total is not.
    check('merge: two on the tile however they are stored', onTile(p.level, p.x, p.z, p.hash64).get(id), 2);
    check('merge: the backpack has none left', inv.getItemCount(id), 0);
}

// ---------------------------------------------------------------------------------- partial
{
    reset();
    const name = 'coins';
    const id = ObjType.getId(name);
    // 200 first, dropped whole, then 300 more dropped onto the same tile. Both go through the real
    // Drop op - no hand-built Obj - so this is the merge a player actually causes.
    p.invAdd(InvType.INV, id, 200);
    H.opheld(p, name, dropOp(name));
    H.tick(2);
    check('partial: two hundred so far', onTile(p.level, p.x, p.z, p.hash64).get(id), 200);
    p.invAdd(InvType.INV, id, 300);
    H.opheld(p, name, dropOp(name));
    H.tick(2);
    check('partial: five hundred on the tile', onTile(p.level, p.x, p.z, p.hash64).get(id), 500);
    check('partial: the backpack has none left', inv.getItemCount(id), 0);
}

// ---------------------------------------------------------------------------------- notmine
{
    reset();
    const name = 'bones';
    const id = ObjType.getId(name);
    p.invAdd(InvType.INV, id, 1);
    H.opheld(p, name, dropOp(name));
    H.tick(2);
    const other = H.makePlayer('dropother', AT[0], AT[1] + 1);
    H.tick(3);
    check("notmine: it is the dropper's", objCount(p.level, p.x, p.z, id, p.hash64), 1);
    check("notmine: and not the other player's", objCount(p.level, p.x, p.z, id, other.hash64), 0);
    H.despawn(other);
    H.tick(2);
}

console.log(`\n${R.ok} ok, ${R.bad} FAIL`);
process.exit(R.bad ? 1 : 0);
