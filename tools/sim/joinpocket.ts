// WHAT WOULD JOIN THESE TWO PLACES? Flood from each of two tiles, then print every pair of
// adjacent tiles where one pocket touches the other, with the locs standing on them. That is the
// list of things a player has to open, climb or squeeze past - which is the question a questrun
// "NO WALKABLE ROUTE from A to B" actually raises.
//
//   npx tsx tools/sim/joinpocket.ts <level> <ax>,<az> <bx>,<bz> [cap]
import * as H from './harness.js';
import World from '#/engine/World.js';
import LocType from '#/cache/config/LocType.js';
import { canTravel } from '#/engine/GameMap.js';
import { CollisionType } from '#/engine/routefinder/index.js';

await H.boot();

const level = Number(process.argv[2] ?? 0);
const [ax, az] = (process.argv[3] ?? '0,0').split(',').map(Number);
const [bx, bz] = (process.argv[4] ?? '0,0').split(',').map(Number);
const cap = Number(process.argv[5] ?? 4000);

const flood = (x: number, z: number) => {
    const seen = new Set([`${x},${z}`]);
    const q: [number, number][] = [[x, z]];
    while (q.length && seen.size < cap) {
        const [cx, cz] = q.pop()!;
        for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            const k = `${cx + dx},${cz + dz}`;
            if (!seen.has(k) && canTravel(level, cx, cz, dx, dz, 1, 0, CollisionType.NORMAL)) {
                seen.add(k);
                q.push([cx + dx, cz + dz]);
            }
        }
    }
    return seen;
};

const A = flood(ax, az);
const B = flood(bx, bz);
console.log(`from ${ax},${az}: ${A.size} tiles${A.size >= cap ? ' (capped)' : ''}`);
console.log(`from ${bx},${bz}: ${B.size} tiles${B.size >= cap ? ' (capped)' : ''}`);
if (A.has(`${bx},${bz}`)) {
    console.log('they are the same pocket - there is a route and something else is wrong');
    process.exit(0);
}

const locsAt = (x: number, z: number) => {
    const out: string[] = [];
    for (const lc of World.gameMap.getZone(x, z, level).getAllLocsSafe()) {
        if (lc.x !== x || lc.z !== z) continue;
        const t = LocType.get(lc.type);
        out.push(`${t.debugname ?? 'loc_' + t.id}${(t.op ?? []).filter(Boolean).length ? ' [' + (t.op ?? []).filter(Boolean).join('/') + ']' : ''} s${lc.shape}a${lc.angle}`);
    }
    return out;
};

const seen = new Set<string>();
let n = 0;
for (const key of A) {
    const [x, z] = key.split(',').map(Number);
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        if (!B.has(`${x + dx},${z + dz}`)) continue;
        n++;
        // WHICH TILE IS THE LOC ON. Printing the two tiles' locs in one list cost a run on Dwarf
        // Cannon: the camp gate came back as loc_1557 on a line starting 2567,3458 and it is
        // loc_1558 that stands there.
        const here = locsAt(x, z).map(l => `${x},${z}: ${l}`).concat(locsAt(x + dx, z + dz).map(l => `${x + dx},${z + dz}: ${l}`));
        const line = `  ${x},${z} -> ${x + dx},${z + dz}   ${here.join('  |  ') || '(no locs on either tile)'}`;
        if (!seen.has(line)) {
            seen.add(line);
            console.log(line);
        }
    }
}
console.log(n ? `${n} places where the two pockets touch` : 'the two pockets never touch - whatever joins them is a ladder, a stair or a teleport');
process.exit(0);
