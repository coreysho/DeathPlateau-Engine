// A LITTLE MAP OF WHAT BLOCKS. Prints a rectangle of tiles as '.' walkable and '#' blocked, with
// the loc on each tile listed underneath. For reading the shape of a pit, a doorway or a fence.
//
//   npx tsx tools/sim/tilemap.ts <level> <x0> <x1> <z0> <z1>
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

// CAN YOU STAND HERE? Asking canTravel to step OFF a tile is the wrong question - it tests the
// destination's flags, so a solid tile next to open ground answers yes and every pit, tree and
// wall read as walkable. Ask whether a neighbour can step ONTO it instead.
const standable = (x: number, z: number) =>
    canTravel(level, x, z + 1, 0, -1, 1, 0, CollisionType.NORMAL) ||
    canTravel(level, x, z - 1, 0, 1, 1, 0, CollisionType.NORMAL) ||
    canTravel(level, x + 1, z, -1, 0, 1, 0, CollisionType.NORMAL) ||
    canTravel(level, x - 1, z, 1, 0, 1, 0, CollisionType.NORMAL);
const open = (x: number, z: number) => standable(x, z);

console.log(`L${level}  x ${x0}..${x1}  z ${z0}..${z1}   '.' you can stand on, '#' you cannot`);
for (let z = z1; z >= z0; z--) {
    let row = String(z).padStart(5) + ' ';
    for (let x = x0; x <= x1; x++) row += open(x, z) ? '.' : '#';
    console.log(row);
}
let foot = '      ';
for (let x = x0; x <= x1; x++) foot += String(x % 10);
console.log(foot + '   (x: ' + x0 + '..' + x1 + ')');

for (const zone of ((World.gameMap as any).zonemap.zones as Map<number, any>).values()) {
    for (const loc of zone.getAllLocsUnsafe()) {
        if (loc.level !== level) continue;
        if (loc.x < x0 || loc.x > x1 || loc.z < z0 || loc.z > z1) continue;
        const t = LocType.get(loc.type);
        const ops = (t.op ?? []).filter(Boolean).join('/');
        console.log(`  ${loc.x},${loc.z} s${loc.shape}a${loc.angle}  ${t.debugname ?? 'loc_' + loc.type}${ops ? '  [' + ops + ']' : ''}`);
    }
}

// A booted world keeps timers alive, so a probe that just falls off the end never exits and looks
// like a hang. Say so explicitly.
process.exit(0);
