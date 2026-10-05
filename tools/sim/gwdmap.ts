// WHERE A FOLLOWER CAN STAND in the God Wars main chamber, read off the real collision map.
//
// The spawn list in content/maps/m45_82.jm2 is written from this rather than from the map file's
// own tiles: a jm2 tile can be drawn and still be blocked by a loc standing on it, and a size-2
// npc needs all four of its squares. Guessing from the picture is how you get an aviansie inside
// a pillar.
//
//   npx tsx tools/sim/gwdmap.ts [picture]
import * as H from './harness.ts';
import * as A from './a1lib.ts';
import { canTravel } from '#/engine/GameMap.js';
import { CollisionType } from '#/engine/routefinder/index.js';

await H.boot();

const LEVEL = 2;
const START = [2890, 5287];
// The chamber, as the picture shows it: the one big room the four armies share. Bounded to region
// 45_82 (x 2880-2943, z 5248-5311), which is the square whose jm2 carries the spawns.
const [X1, Z1, X2, Z2] = [2880, 5280, 2912, 5311];

if (process.argv.includes('picture')) {
    console.log(A.ascii(LEVEL, X1 - 2, Z1 - 2, X2 + 2, Z2 + 6, START[0], START[1]));
}

// everything reachable on foot from the middle of the room
const seen = new Set<string>([START.join(',')]);
const q = [START];
while (q.length) {
    const [cx, cz] = q.pop()!;
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = cx + dx, nz = cz + dz, k = nx + ',' + nz;
        if (seen.has(k) || nx < X1 - 4 || nx > X2 + 4 || nz < Z1 - 4 || nz > Z2 + 10) continue;
        if (canTravel(LEVEL, cx, cz, dx, dz, 1, 0, CollisionType.NORMAL)) { seen.add(k); q.push([nx, nz]); }
    }
}

/** Can an npc of this size stand here - every square of its footprint walkable and inside? */
const fits = (x: number, z: number, size: number) => {
    for (let dx = 0; dx < size; dx++) for (let dz = 0; dz < size; dz++) {
        if (!seen.has((x + dx) + ',' + (z + dz))) return false;
        if (x + dx > X2 || z + dz > Z2) return false;
    }
    return true;
};

const one: string[] = [], two: string[] = [];
for (let x = X1; x <= X2; x++) for (let z = Z1; z <= Z2; z++) {
    if (!seen.has(x + ',' + z)) continue;
    if (fits(x, z, 1)) one.push(`${x},${z}`);
    if (fits(x, z, 2)) two.push(`${x},${z}`);
}
console.log('SIZE1 ' + one.join(' '));
console.log('SIZE2 ' + two.join(' '));
