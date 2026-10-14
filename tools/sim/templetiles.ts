// Which candidate tiles are in the temple's corridor network - the one region that the cave east of
// the temple opens into - and which are inside a sealed room? The quest's arrival tile has to be in
// the corridors, or the player is walled in the moment the doors lock to a colour.
import * as H from './harness.js';
import { canTravel } from '#/engine/GameMap.js';
import { CollisionType } from '#/engine/routefinder/index.js';

await H.boot();
const KEY = (x: number, z: number) => x * 10000 + z;
function reach(sx: number, sz: number, lvl: number, limit = 60000) {
    const seen = new Set<number>([KEY(sx, sz)]);
    const q: [number, number][] = [[sx, sz]];
    while (q.length && seen.size < limit) {
        const [x, z] = q.shift()!;
        for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
            if (seen.has(KEY(x + dx, z + dz))) continue;
            if (!canTravel(lvl, x, z, dx, dz, 1, 1, CollisionType.NORMAL)) continue;
            seen.add(KEY(x + dx, z + dz));
            q.push([x + dx, z + dz]);
        }
    }
    return seen;
}
const corridors = reach(1925, 4642, 0);   // from the first corpse in the cave
console.log('');
console.log('the cave + corridor region: ' + corridors.size + ' tiles');
const T = (lx: number, lz: number) => [29 * 64 + lx, 72 * 64 + lz] as [number, number];
const cands: [string, [number, number]][] = [
    ['local 59,9   north of the SE room door', T(59, 9)],
    ['local 59,12  the east corridor', T(59, 12)],
    ['local 53,20  pillar 1_12 corner', T(53, 20)],
    ['local 42,12  mid-south corridor', T(42, 12)],
    ['local 31,12  by the west stairs', T(31, 12)],
    ['local 5,5    the SW room (where the content lands you)', T(5, 5)],
    ['local 59,5   the SE room, on the pillar', T(59, 5)],
    ['local 46,30  the east circle stairs', T(46, 30)],
    ['local 31,30  the west circle stairs', T(31, 30)],
    ['local 20,13  the rope down', T(20, 13)],
    ['local 13,31  the final pillar of light', T(13, 31)]
];
for (const [label, [x, z]] of cands) {
    console.log('  ' + (corridors.has(KEY(x, z)) ? 'CORRIDOR  ' : 'elsewhere ') + label + '   (' + x + ',' + z + ')');
}
// and where does the cave cross into the temple square?
const crossings: string[] = [];
for (const k of corridors) {
    const x = Math.floor(k / 10000);
    const z = k % 10000;
    if (x === 1919 && corridors.has(KEY(1920, z))) crossings.push('z=' + z);
}
console.log('  the cave crosses the square boundary at x=1919/1920 on: ' + (crossings.join(' ') || 'nowhere'));
// the corridor tiles closest to the east wall, which is where the cave comes in: the arrival tile
// has to be one of these, and inside the temple rather than in the cave
console.log('');
console.log('the easternmost corridor tile on the temple square, row by row (local coords)');
for (let lz = 20; lz <= 40; lz++) {
    const z = 72 * 64 + lz;
    let best = -1;
    for (let lx = 0; lx <= 63; lx++) {
        if (corridors.has(KEY(29 * 64 + lx, z))) best = lx;
    }
    if (best >= 0) console.log('  z=' + String(lz).padStart(2) + '  easternmost x=' + best);
}
