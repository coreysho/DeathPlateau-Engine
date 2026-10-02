// God Wars Dungeon, as far as it has been built. Run after any GWD map or spawn change:
//
//   npx tsx tools/sim/gwd.ts
//
// Right now it answers the first questions a freshly imported dungeon has to answer: did the three
// squares load, is there floor to stand on in each boss room, and what is in there that a player can
// click - because the doors are what the killcount stage has to hook onto, and their names are not
// knowable until the import has run.
import * as H from './harness.ts';
import { World, LocType, check, R } from './a1lib.ts';
import { CollisionFlag } from '#/engine/routefinder/index.js';
import { isFlagged } from '#/engine/GameMap.js';

await H.boot();

// The rooms, anchored on THEIR OWN ALTARS - the coordinates the import actually produced, not the
// ones remembered off a wiki page. The first version of this file guessed all three and was wrong
// about every one by 15-20 tiles, which is exactly the kind of thing a map test should not be
// asserting from memory. The dungeon sits on level 2.
//
// m45_82 is not imported yet, so the two rooms that live in it are listed and asserted ABSENT
// rather than left out - an empty square must not look like a passing one.
const ROOMS: [string, number, number, number, string][] = [
    ["Kree'arra (Armadyl)", 2821, 5301, 2, '44_82'],
    ['General Graardor (Bandos)', 2869, 5370, 2, '44_83'],
    ["K'ril Tsutsaroth (Zamorak)", 2937, 5323, 2, '45_83'],
    // m45_82 holds BOTH the rope landing you arrive on (2882,5311) and Zilyana's room. The landing
    // sits in the very corner of the square, so any radius around it spills into the two imported
    // squares next door and reads as walled; Zilyana's room is deep inside it and is the honest
    // anchor for "this square is not here yet".
    ['Commander Zilyana (Saradomin)', 2907, 5265, 2, '45_82'],
];
const HAVE = new Set(['44_82', '44_83', '45_83']);

// A square that never loaded is not solid rock - it is all zeroes, which reads as WALKABLE
// everywhere. So counting open tiles "passes" for a square that is not there at all, which is how
// the first version of this check passed for the two rooms that have not been imported.
//
// What tells the two apart is WALLS. A built room has a mix: floor to stand on and walls around it.
// Empty space has no walls at all, so the blocked count is what is asserted.
function around(x: number, z: number, lvl: number, r = 12) {
    let open = 0, blocked = 0, locs = 0;
    for (let dx = -r; dx <= r; dx++)
        for (let dz = -r; dz <= r; dz++) {
            // isFlagged takes (x, z, level), NOT (level, x, z). The wrong way round it reads a tile
            // nobody asked about and answers "open" everywhere - including inside Lumbridge castle,
            // which is how the first version of this reported a dungeon with no walls in it.
            if (isFlagged(x + dx, z + dz, lvl, CollisionFlag.WALK_BLOCKED)) blocked++; else open++;
            for (const loc of World.gameMap.getZone(x + dx, z + dz, lvl).getAllLocsUnsafe())
                if (loc.x === x + dx && loc.z === z + dz && loc.level === lvl) locs++;
        }
    return { open, blocked, locs };
}

console.log('THE ROOMS');
for (const [name, x, z, lvl, reg] of ROOMS) {
    const a = around(x, z, lvl);
    // A room is a chamber cut out of rock: floor to stand on AND rock around it. Empty space has
    // floor and no rock, which is what the two unimported rooms read as.
    const built = a.blocked > 100 && a.open > 100;
    const line = `${name.padEnd(30)} m${reg} (${a.open} open, ${a.blocked} walled)`;
    if (HAVE.has(reg)) check(`  ${line} is a room`, built, true);
    else check(`  ${line} is still open rock-free space, as expected`, built, false);
}

// What can be clicked in the imported squares: every distinct loc carrying an op, with where it is.
// This is the list the next stage works from.
console.log('\nWHAT A PLAYER CAN CLICK IN THE IMPORTED SQUARES');
const seen = new Map<string, { ops: string[]; n: number; where: string }>();
for (const reg of HAVE) {
    const [mx, mz] = reg.split('_').map(Number);
    for (let lvl = 0; lvl < 4; lvl++)
        for (let x = mx << 6; x < ((mx << 6) + 64); x++)
            for (let z = mz << 6; z < ((mz << 6) + 64); z++) {
                for (const loc of World.gameMap.getZone(x, z, lvl).getAllLocsUnsafe()) {
                    if (loc.x !== x || loc.z !== z || loc.level !== lvl) continue;
                    const t = LocType.get(loc.type);
                    const ops = (t.op ?? []).filter(Boolean) as string[];
                    if (!ops.length) continue;
                    const key = `${t.debugname}`;
                    const e = seen.get(key);
                    if (e) e.n++;
                    else seen.set(key, { ops, n: 1, where: `${lvl}_${x >> 6}_${z >> 6}_${x & 63}_${z & 63}` });
                }
            }
}
for (const [name, e] of [...seen].sort((a, b) => b[1].n - a[1].n))
    console.log(`  ${name.padEnd(26)} [${e.ops.join('/')}]  x${e.n}  first at ${e.where}`);
check('  the dungeon has something to click', seen.size > 0, true);

console.log(`\n${R.ok} ok, ${R.bad} FAIL`);
process.exit(R.bad ? 1 : 0);
