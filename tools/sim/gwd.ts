// God Wars Dungeon, as far as it has been built. Run after any GWD map or spawn change:
//
//   npx tsx tools/sim/gwd.ts
//
// The dungeon comes from TWO caches and that is the thing most worth testing. Three of its four map
// squares are rev 474 (October 2007, the dungeon as it was built); m45_82 - the one holding the rope
// you arrive on and Commander Zilyana's room - has no XTEA key in any published set, so its locs
// cannot be read from 474 and it comes from the OSRS cache instead. Two sources meeting inside one
// dungeon is a seam, and a seam you cannot walk through is a dungeon nobody can finish.
import * as H from './harness.ts';
import { World, LocType, check, R } from './a1lib.ts';
import { CollisionFlag, CollisionType } from '#/engine/routefinder/index.js';
import { isFlagged, canTravel } from '#/engine/GameMap.js';

await H.boot();

// Every anchor below was READ OUT OF THE BUILT MAP, not remembered. Three earlier versions of this
// file guessed the room coordinates off a wiki page and were wrong about every one of them - by
// 15-20 tiles, and about which level the dungeon sits on.
const ROOMS: [string, number, number, number, string][] = [
    ["Kree'arra (Armadyl)", 2821, 5301, 2, '44_82 (474)'],
    ['General Graardor (Bandos)', 2869, 5370, 2, '44_83 (474)'],
    ["K'ril Tsutsaroth (Zamorak)", 2937, 5323, 2, '45_83 (474)'],
    ['Commander Zilyana (Saradomin)', 2885, 5267, 0, '45_82 (OSRS)'],
];

// The four faction doors, and the rope you arrive on.
const LANDING: [number, number, number] = [2881, 5311, 2];
const DOORS: [string, number, number, number][] = [
    ['Armadyl', 2839, 5295, 2],
    ['Bandos', 2863, 5354, 2],
    ['Zamorak', 2925, 5332, 2],
    ['Saradomin', 2908, 5265, 0],
];

// isFlagged is (x, z, level, masks) - NOT (level, x, z, masks). The wrong way round it reads a tile
// nobody asked about and answers "open" everywhere, which reported this dungeon as having no walls
// in it. A control run said the same of Lumbridge castle, which is what gave it away.
function around(x: number, z: number, lvl: number, r = 12) {
    let open = 0, blocked = 0;
    for (let dx = -r; dx <= r; dx++)
        for (let dz = -r; dz <= r; dz++)
            isFlagged(x + dx, z + dz, lvl, CollisionFlag.WALK_BLOCKED) ? blocked++ : open++;
    return { open, blocked };
}

console.log('THE ROOMS');
for (const [name, x, z, lvl, src] of ROOMS) {
    const a = around(x, z, lvl);
    // A room is a chamber cut out of rock: floor to stand on AND rock around it. Space that never
    // loaded reads as floor everywhere and no rock at all, so the walled count is what separates
    // "built" from "not there" - counting open tiles alone passes for a square that is missing.
    check(`  ${name.padEnd(30)} ${src.padEnd(14)} (${a.open} open, ${a.blocked} walled)`,
        a.blocked > 100 && a.open > 100, true);
}

// ---------------------------------------------------------------- the seam
// The rope landing is in the OSRS square. The Armadyl and Bandos doors are in 474 squares. If you
// can walk from the one to the others then the two caches' halves of the dungeon actually join up.
// A rope and a door BLOCK the tile they stand on - you stand beside them, not in them - so both
// ends of each walk are the nearest tile you could actually be standing on.
function nearestOpen(x: number, z: number, lvl: number, r = 4): [number, number] | null {
    for (let d = 0; d <= r; d++)
        for (let dx = -d; dx <= d; dx++)
            for (let dz = -d; dz <= d; dz++) {
                if (Math.max(Math.abs(dx), Math.abs(dz)) !== d) continue;
                if (!isFlagged(x + dx, z + dz, lvl, CollisionFlag.WALK_BLOCKED)) return [x + dx, z + dz];
            }
    return null;
}
// You walk UP TO a faction door, never through it - the room behind it is sealed, which is the
// whole thing killcount exists to open. So the question is whether any tile beside the door can be
// reached, not whether the room can.
function canReachDoor(fx: number, fz: number, lvl: number, x: number, z: number) {
    for (let dx = -1; dx <= 1; dx++)
        for (let dz = -1; dz <= 1; dz++) {
            if (isFlagged(x + dx, z + dz, lvl, CollisionFlag.WALK_BLOCKED)) continue;
            if (connected(lvl, fx, fz, x + dx, z + dz, 220)) return true;
        }
    return false;
}

// THE SEAM, asked directly. Walking from the rope to a boss door is the wrong question - the route
// runs through doors that block until you open them, so a flat flood says "no" for reasons that
// have nothing to do with the map being sound. What matters is whether the OSRS square and the 474
// squares JOIN: how many tiles you can step across each cache boundary, in each direction.
console.log('\nTHE SEAM BETWEEN THE TWO CACHES');
const [lx, lz, llvl] = LANDING;
check(`  there is standable floor beside the rope at (${lx},${lz})`, nearestOpen(lx, lz, llvl) !== null, true);
for (const lvl of [0, 1, 2, 3]) {
    let we = 0, ew = 0, ns = 0, sn = 0;
    for (let z = 5248; z < 5376; z++) {
        if (canTravel(lvl, 2879, z, 1, 0, 1, 0, CollisionType.NORMAL)) we++;
        if (canTravel(lvl, 2880, z, -1, 0, 1, 0, CollisionType.NORMAL)) ew++;
    }
    for (let x = 2816; x < 2944; x++) {
        if (canTravel(lvl, x, 5311, 0, 1, 1, 0, CollisionType.NORMAL)) ns++;
        if (canTravel(lvl, x, 5312, 0, -1, 1, 0, CollisionType.NORMAL)) sn++;
    }
    console.log(`  level ${lvl}: x=2880 ${we} west-east / ${ew} east-west;  z=5312 ${ns} south-north / ${sn} north-south`);
    // Level 2 is the floor the rope lands on and the one three of the four boss doors sit on. If
    // that seam is shut the dungeon is in two halves and nobody reaches Armadyl or Bandos.
    if (lvl === 2) check('  the dungeon floor crosses both cache boundaries', we > 10 && ew > 10 && ns > 10 && sn > 10, true);
}

// ---------------------------------------------------------------- what is clickable
// Everything in the dungeon a player can click, which is the list the killcount and door stages
// work from. The 474 half is named; the OSRS half is still osrsloc_<id> and wants naming.
console.log('\nWHAT A PLAYER CAN CLICK');
const seen = new Map<string, { ops: string[]; name: string; n: number; where: string }>();
for (const reg of ['44_82', '44_83', '45_82', '45_83']) {
    const [mx, mz] = reg.split('_').map(Number);
    for (let lvl = 0; lvl < 4; lvl++)
        for (let x = mx << 6; x < (mx << 6) + 64; x++)
            for (let z = mz << 6; z < (mz << 6) + 64; z++)
                for (const loc of World.gameMap.getZone(x, z, lvl).getAllLocsUnsafe()) {
                    if (loc.x !== x || loc.z !== z || loc.level !== lvl) continue;
                    const t = LocType.get(loc.type);
                    const ops = (t.op ?? []).filter(Boolean) as string[];
                    if (!ops.length) continue;
                    const e = seen.get(t.debugname);
                    if (e) e.n++;
                    else seen.set(t.debugname, { ops, name: t.name ?? '', n: 1, where: `${lvl}_${mx}_${mz}_${x & 63}_${z & 63}` });
                }
}
for (const [dbg, e] of [...seen].sort((a, b) => a[0].localeCompare(b[0])))
    console.log(`  ${dbg.padEnd(22)} "${e.name}" [${e.ops.join('/')}] x${e.n} first at ${e.where}`);
check('  all four faction altars are in', [...seen].filter(([, e]) => e.ops.includes('Pray-at') || e.ops.includes('Pray')).length, 4);
check('  all four faction doors are in', [...seen].filter(([, e]) => e.name === 'Big door' && e.ops.includes('Open')).length, 4);

console.log(`\n${R.ok} ok, ${R.bad} FAIL`);
process.exit(R.bad ? 1 : 0);
