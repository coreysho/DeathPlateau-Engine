// WHICH SIDE OF THIS LOC IS ACTUALLY REACHABLE, and what is stopping the others? Prints the four
// neighbours of a loc with the wall flags on each, the rotated forceapproach mask, and the engine's
// own reach test run twice - once with the type's mask and once with no mask at all. The second
// answer says whether dropping forceapproach would fix an unreachable loc or whether a wall would
// still be in the way.
//
//   npx tsx tools/sim/reachsides.ts <locname> <x> <z> [level]
import * as H from './harness.js';
import World from '#/engine/World.js';
import LocType from '#/cache/config/LocType.js';
import { rotateFlags } from '#/engine/routefinder/Rotation.js';
import { CollisionFlag } from '#/engine/routefinder/index.js';
import { isFlagged, reachedLoc } from '#/engine/GameMap.js';

await H.boot();

const nm = process.argv[2];
const x = Number(process.argv[3]);
const z = Number(process.argv[4]);
const level = Number(process.argv[5] ?? 0);
const id = LocType.getId(nm);
const t = LocType.get(id);
const loc = World.getLoc(x, z, level, id);
if (!loc) {
    console.log(`${nm} is not at ${x},${z} L${level}`);
    process.exit(2);
}
const mask = (t as any).forceapproach as number;
console.log(`${nm} id ${id} at ${x},${z} L${level}: shape ${loc.shape} angle ${loc.angle} ${t.width}x${t.length}`);
console.log(`  forceapproach ${mask} (0b${mask.toString(2).padStart(4, '0')}), rotated by angle ${loc.angle} -> ${rotateFlags(loc.angle, mask)} (0b${rotateFlags(loc.angle, mask).toString(2).padStart(4, '0')})`);
console.log('  bits are north=1 east=2 south=4 west=8, and a SET bit blocks that side');

const sides: [string, number, number, number][] = [
    ['west  of it', x - 1, z, CollisionFlag.WALL_EAST],
    ['east  of it', x + 1, z, CollisionFlag.WALL_WEST],
    ['south of it', x, z - 1, CollisionFlag.WALL_NORTH],
    ['north of it', x, z + 1, CollisionFlag.WALL_SOUTH]
];
for (const [label, sx, sz, wall] of sides) {
    const blocked = isFlagged(sx, sz, level, CollisionFlag.WALK_BLOCKED);
    const wallThere = isFlagged(sx, sz, level, wall);
    const withMask = reachedLoc(level, sx, sz, loc.x, loc.z, t.width, t.length, 1, loc.angle, loc.shape, mask);
    const without = reachedLoc(level, sx, sz, loc.x, loc.z, t.width, t.length, 1, loc.angle, loc.shape, 0);
    console.log(
        `  ${label} ${sx},${sz}  tile ${blocked ? 'BLOCKED' : 'clear'}  wall toward the loc ${wallThere ? 'YES' : 'no'}  ` +
            `reach with mask ${withMask ? 'yes' : 'NO'}  reach with no mask ${without ? 'yes' : 'NO'}`
    );
}
process.exit(0);
