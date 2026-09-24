import World from '#/engine/World.js';
import { canTravel } from '#/engine/GameMap.js';
import { CollisionType } from '#/engine/routefinder/index.js';
await World.start(false, false);
const [sx, sz, x0, x1, z0, z1] = process.argv.slice(2).map(Number);
const seen = new Set<number>();
const q: [number, number][] = [[sx, sz]];
seen.add(sx * 100000 + sz);
while (q.length) {
    const [x, z] = q.pop()!;
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, nz = z + dz;
        if (nx < x0 || nx > x1 || nz < z0 || nz > z1) continue;
        const k = nx * 100000 + nz;
        if (seen.has(k)) continue;
        if (!canTravel(0, x, z, dx, dz, 1, 0, CollisionType.NORMAL)) continue;
        seen.add(k);
        q.push([nx, nz]);
    }
}
let minx = 1e9, maxx = 0, minz = 1e9, maxz = 0;
for (const k of seen) { const x = Math.floor(k / 100000), z = k % 100000; minx = Math.min(minx, x); maxx = Math.max(maxx, x); minz = Math.min(minz, z); maxz = Math.max(maxz, z); }
console.log(`reached ${seen.size} tiles, bbox x ${minx}-${maxx} z ${minz}-${maxz}`);
for (let z = z1; z >= z0; z -= 2) {
    let row = String(z).padStart(5) + ' ';
    for (let x = x0; x <= x1; x += 2) row += seen.has(x * 100000 + z) ? 'o' : ' ';
    console.log(row);
}
process.exit(0);
