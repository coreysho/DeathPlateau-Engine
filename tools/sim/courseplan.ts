// Pick a rooftop course's landings instead of guessing them.
//
// A landing has to satisfy two things at once, and reading a map picture only shows the first:
// the player must be able to STAND there, and they must be able to WALK from there to the next
// obstacle. Varrock's gap 2 looked like roof and was an island; Al Kharid's tropical tree is
// reachable only from a tile no player can get to. Both cost an evening between them.
//
// So each obstacle PUTS YOU DOWN BESIDE THE NEXT ONE: the walkable tile adjacent to obstacle N+1
// that faces obstacle N. That is what Old School does anyway - an obstacle delivers you to the
// start of the one after it - and it cannot produce an island or an unreachable approach, which
// is the whole class of mistake this is here to stop.
//
// The reachable count beside each line is a sanity figure: a landing with two or three tiles
// around it is a ledge, and one with none is a bug.
//
//   npx tsx tools/sim/courseplan.ts <level> <x,z,level of each obstacle in order...>
import * as H from './harness.ts';
import { CollisionFlag } from '#/engine/routefinder/index.js';
import { isFlagged } from '#/engine/GameMap.js';

await H.boot();

const free = (lv: number, x: number, z: number) => !isFlagged(x, z, lv, CollisionFlag.WALK_BLOCKED);

/** Every tile walkable from the tiles around (x,z), within `limit`. */
function component(lv: number, x: number, z: number, limit = 600): Set<string> {
    const seen = new Set<string>();
    const queue: [number, number][] = [];
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const [sx, sz] = [x + dx, z + dz];
        if (free(lv, sx, sz) && !seen.has(`${sx},${sz}`)) { seen.add(`${sx},${sz}`); queue.push([sx, sz]); }
    }
    while (queue.length && seen.size < limit) {
        const [cx, cz] = queue.shift()!;
        for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            const [nx, nz] = [cx + dx, cz + dz];
            const k = `${nx},${nz}`;
            if (seen.has(k) || !free(lv, nx, nz)) continue;
            seen.add(k); queue.push([nx, nz]);
        }
    }
    return seen;
}

const obstacles = process.argv.slice(2).map(a => a.split(',').map(Number) as [number, number, number]);
for (let i = 0; i < obstacles.length; i++) {
    const [ox, oz, olv] = obstacles[i];
    const next = obstacles[i + 1];
    if (!next) { console.log(`${i + 1}. ${ox},${oz} lv${olv} -> (last: the street, pick by hand)`); continue; }
    const [nx, nz, nlv] = next;
    // the four tiles beside the next obstacle, best first: the one facing where you are coming from
    const sides: [number, number][] = [[nx + 1, nz], [nx - 1, nz], [nx, nz + 1], [nx, nz - 1]];
    sides.sort((a, b) => (Math.abs(a[0] - ox) + Math.abs(a[1] - oz)) - (Math.abs(b[0] - ox) + Math.abs(b[1] - oz)));
    const pick = sides.find(([x, z]) => free(nlv, x, z));
    if (!pick) { console.log(`${i + 1}. ${ox},${oz} lv${olv} -> NOTHING FREE beside ${nx},${nz} lv${nlv}`); continue; }
    const span = component(nlv, pick[0], pick[1], 400).size;
    console.log(`${i + 1}. ${ox},${oz} lv${olv} -> land ${pick[0]},${pick[1]} lv${nlv}   (${span} tiles around it)`);
}
process.exit(0);
