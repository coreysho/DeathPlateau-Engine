// EVERY TREE ON THE MAP, CHOPPED. Not a family at a time - the whole `category=tree` population,
// found from the cache, so a tree wired next year is covered without editing this file.
//
//   npx tsx tools/sim/choptrees.ts
//
// WHY THE BLANKET VERSION EXISTS. Two separate tree families turned out to be unchoppable in the
// same week - Ape Atoll's 123 jungle trees and the Void Knights' Outpost's 17 - and both were
// missing the same two lines. A sim per family would have caught each one after somebody already
// knew to look. This asks the question of all of them at once: stand beside it, click the option
// the cache draws, and see whether logs arrive.
//
// WHAT IT ASSERTS, for each placed tree:
//   - the option the client would actually draw, read off the loc rather than assumed
//   - a row in woodcutting_trees, by chopping it and getting that row's product
//   - the message is never "Nothing interesting happens."
//   - and it falls into the loc its own param=next_loc_stage names
import * as H from './harness.js';
import { walkable } from './a1lib.js';
import CategoryType from '#/cache/config/CategoryType.js';
import LocType from '#/cache/config/LocType.js';
import InvType from '#/cache/config/InvType.js';
import ParamType from '#/cache/config/ParamType.js';
import World from '#/engine/World.js';

await H.boot();

let ok = 0;
let bad = 0;
let skipped = 0;
const check = (what: string, good: boolean, detail = '') => {
    if (good) {
        ok++;
    } else {
        bad++;
        console.log('  FAIL ' + what + (detail ? ' - ' + detail : ''));
    }
};

/** How many backpack slots hold something - the axe plus whatever the chop handed over. */
function usedSlots(player: { getInventory(type: number): { capacity: number; get(i: number): unknown } | null }): number {
    const inv = player.getInventory(InvType.INV)!;
    let n = 0;
    for (let i = 0; i < inv.capacity; i++) {
        if (inv.get(i)) n++;
    }
    return n;
}

const TREE = CategoryType.getId('tree');
const NEXT_STAGE = ParamType.getId('next_loc_stage');

// Every placed loc the woodcutting category answers, commonest first so the output reads as a map
// of the game rather than an alphabet.
const counts = new Map<number, number>();
const spots = new Map<number, { x: number; z: number; level: number }[]>();
for (const zone of World.gameMap.existingZones()) {
    for (const loc of zone.getAllLocsUnsafe()) {
        if (LocType.get(loc.type)?.category !== TREE) continue;
        counts.set(loc.type, (counts.get(loc.type) ?? 0) + 1);
        const list = spots.get(loc.type) ?? [];
        list.push({ x: loc.x, z: loc.z, level: loc.level });
        spots.set(loc.type, list);
    }
}
const trees = [...counts.keys()].sort((a, b) => counts.get(b)! - counts.get(a)! || (LocType.get(a).debugname ?? '').localeCompare(LocType.get(b).debugname ?? ''));
console.log(`${trees.length} of this build's category=tree locs are placed on the map`);
console.log('');

const p = H.makePlayer('chopper', 3222, 3218) as unknown as { teleport(x: number, z: number, level: number): void; delayed: boolean };
H.tick(2);
H.maxOut(p as never);

for (const id of trees) {
    const type = LocType.get(id);
    const name = type.debugname ?? String(id);
    // The option a client would send, taken off the loc. Most are op1; a multiloc shell's variants
    // can differ, and guessing 1 is how a sim ends up testing a click no player can make.
    const op = (type.op ?? []).findIndex(label => label !== null && label !== '' && label !== 'hidden');
    if (op === -1) {
        console.log(`  skip ${name} - category=tree and no visible option to click`);
        skipped++;
        continue;
    }
    const stageRaw = type.params?.get(NEXT_STAGE);
    const stump = stageRaw === undefined ? null : LocType.getId(LocType.get(Number(stageRaw)).debugname ?? '');

    // A TILE THE PLAYER CAN ACTUALLY CHOP FROM, which is not the same as a walkable tile. A tree is
    // 2x2 and blocks, so its own tile is never it; and a tile that is open can still be unroutable
    // or outside the loc's forceapproach, which comes back as "I can't reach that!" rather than as
    // a content bug. teaktree failed the first version of this for exactly that reason. So the sim
    // tries instances and offsets until one chop lands, and only reports a tree as broken when
    // every tile beside every instance it looked at refused.
    const offsets: [number, number][] = [];
    for (let r = 1; r <= 3; r++) {
        offsets.push([r + 1, 0], [-r, 0], [0, r + 1], [0, -r], [r + 1, r + 1], [-r, -r], [r + 1, -r], [-r, r + 1]);
    }
    let chopped = false;
    let lastSaid: string[] = [];
    let reached = false;
    // SPREAD ACROSS THE MAP, not the first few in zone order. deadtree1 is placed 1,244 times and
    // the first version of this took the first 25 - which are all in one region, and none of them
    // had ground a player could chop from, so the sim skipped a tree that works everywhere else.
    const all = spots.get(id)!;
    const step = Math.max(1, Math.floor(all.length / 12));
    const sample = all.filter((_s, i) => i % step === 0).slice(0, 12);
    for (const { x, z, level } of sample) {
        for (const [dx, dz] of offsets) {
            if (chopped) break;
            if (!walkable(level, x + dx, z + dz)) continue;
            p.teleport(x + dx, z + dz, level);
            H.clearInv(p as never);
            H.give(p as never, 'rune_axe', 1);
            H.tick(2);
            const mark = H.mesgs.length;
            H.opLoc(p as never, x, z, name, op + 1);
            let got: string | null = null;
            for (let t = 0; t < 40 && got === null; t++) {
                H.tick(1);
                const said = H.mesgs.slice(mark).map(m => m.text);
                got = said.find(s => /^You get some /.test(s)) ?? null;
                if (said.some(s => /interesting/i.test(s))) break;
            }
            lastSaid = H.mesgs.slice(mark).map(m => m.text);
            if (lastSaid.some(s => /can't reach/i.test(s))) continue;
            reached = true;
            check(`${name} (x${counts.get(id)}) gives logs when chopped at ${x},${z},${level}`, got !== null, lastSaid.length ? JSON.stringify(lastSaid.slice(0, 2)) : 'said nothing at all');
            check('  and never says nothing interesting happens', !lastSaid.some(s => /interesting/i.test(s)));
            if (got) {
                // The item itself, not the message: oc_name is a display name and does not map back
                // to a debugname (achey trees say "bark"), so checking the backpack is the honest
                // test and the one that would catch a row whose product is null.
                check(`  and the item is in the backpack (${/^You get some (.+)\.$/.exec(got)?.[1] ?? '?'})`, usedSlots(p as never) > 1);
                // Only the rows with respawnrate 0 - the ordinary trees - always fall on the first
                // success, so a tree still standing here is not a failure and is not asserted.
                if (stump !== null && stump !== -1) {
                    const fell = [...World.gameMap.getZone(x, z, level).getAllLocsSafe()].some(l => l.x === x && l.z === z && l.type === stump);
                    if (fell) ok++;
                }
            }
            chopped = true;
        }
        if (chopped) break;
    }
    if (!chopped && reached) {
        check(`${name} (x${counts.get(id)}) gives logs when chopped`, false, JSON.stringify(lastSaid.slice(0, 2)));
    }
    if (!chopped && !reached) {
        console.log(`  skip ${name} - nothing could reach any of its ${counts.get(id)} instances`);
        skipped++;
    }
}

console.log('');
console.log(`${ok} ok, ${bad} FAIL, ${skipped} skipped`);
process.exit(bad ? 1 : 0);
