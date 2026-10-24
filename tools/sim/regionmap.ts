// THE WHOLE AREA AT A GLANCE. Floods every walkable tile in a box, labels each connected region
// with a letter, and prints the box as a map. '#' is solid. Then lists, for every loc in the box
// that carries an op, which region each of its four sides is in - so an obstacle that joins two
// regions is the one whose sides have two different letters.
//
//   npx tsx tools/sim/regionmap.ts <level> <x0> <x1> <z0> <z1> ["loc pattern"]
//
// Written for Isafdar, where the forest is a dozen pockets joined only by obstacles and no single
// probe answered "which one is the way through".
import * as H from './harness.js';
import World from '#/engine/World.js';
import LocType from '#/cache/config/LocType.js';
import { canTravel } from '#/engine/GameMap.js';
import { CollisionType } from '#/engine/routefinder/index.js';

await H.boot();
const level = Number(process.argv[2]);
const x0 = Number(process.argv[3]);
const x1 = Number(process.argv[4]);
const z0 = Number(process.argv[5]);
const z1 = Number(process.argv[6]);
const re = new RegExp(process.argv[7] ?? '.', 'i');

const dirs: [number, number][] = [
    [0, 1],
    [0, -1],
    [1, 0],
    [-1, 0]
];
const key = (x: number, z: number) => x * 100000 + z;
// CAN YOU STAND HERE? Asking canTravel to step OFF a tile is the wrong question - it tests the
// destination's flags, so a solid tile next to open ground answers yes and every pit, tree and
// wall read as walkable. Ask whether a neighbour can step ONTO it instead.
const standable = (x: number, z: number) =>
    canTravel(level, x, z + 1, 0, -1, 1, 0, CollisionType.NORMAL) ||
    canTravel(level, x, z - 1, 0, 1, 1, 0, CollisionType.NORMAL) ||
    canTravel(level, x + 1, z, -1, 0, 1, 0, CollisionType.NORMAL) ||
    canTravel(level, x - 1, z, 1, 0, 1, 0, CollisionType.NORMAL);
const open = (x: number, z: number) => standable(x, z);

// flood every component, biggest first gets 'a'
const region = new Map<number, number>();
const sizes: number[] = [];
for (let x = x0; x <= x1; x++) {
    for (let z = z0; z <= z1; z++) {
        if (region.has(key(x, z)) || !open(x, z)) continue;
        const id = sizes.length;
        let n = 0;
        const q: [number, number][] = [[x, z]];
        region.set(key(x, z), id);
        while (q.length) {
            const [cx, cz] = q.pop()!;
            n++;
            for (const [dx, dz] of dirs) {
                const nx = cx + dx;
                const nz = cz + dz;
                if (nx < x0 || nx > x1 || nz < z0 || nz > z1) continue;
                if (region.has(key(nx, nz))) continue;
                if (!canTravel(level, cx, cz, dx, dz, 1, 0, CollisionType.NORMAL)) continue;
                region.set(key(nx, nz), id);
                q.push([nx, nz]);
            }
        }
        sizes.push(n);
    }
}
const order = sizes.map((n, i) => [n, i]).sort((a, b) => b[0] - a[0]);
const letter = new Map<number, string>();
const ABC = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
order.forEach(([n, i], rank) => letter.set(i, rank < ABC.length ? ABC[rank] : '?'));
console.log(`L${level}  x ${x0}..${x1}  z ${z0}..${z1}   ${sizes.length} regions, clipped to the box`);
for (const [n, i] of order.slice(0, 14)) console.log(`  ${letter.get(i)} = ${n} tiles`);

if (process.env.MAP) {
    for (let z = z1; z >= z0; z--) {
        let row = String(z).padStart(5) + ' ';
        for (let x = x0; x <= x1; x++) {
            const r = region.get(key(x, z));
            row += r === undefined ? '#' : letter.get(r);
        }
        console.log(row);
    }
}

console.log('locs with ops, and the region on each side:');
for (const zone of ((World.gameMap as any).zonemap.zones as Map<number, any>).values()) {
    for (const loc of zone.getAllLocsUnsafe()) {
        if (loc.level !== level) continue;
        if (loc.x < x0 || loc.x > x1 || loc.z < z0 || loc.z > z1) continue;
        const t = LocType.get(loc.type);
        const nm = t.debugname ?? 'loc_' + loc.type;
        if (!re.test(nm)) continue;
        const ops = (t.op ?? []).filter(Boolean).join('/');
        if (!ops) continue;
        const sides = dirs
            .map(([dx, dz]) => {
                const r = region.get(key(loc.x + dx, loc.z + dz));
                return `${loc.x + dx},${loc.z + dz}=${r === undefined ? '#' : 'r' + r + '/' + sizes[r]}`;
            })
            .join(' ');
        console.log(`  ${nm} [${ops}] at ${loc.x},${loc.z}   ${sides}`);
    }
}

// A booted world keeps timers alive, so a probe that just falls off the end never exits and looks
// like a hang. Say so explicitly.
process.exit(0);
