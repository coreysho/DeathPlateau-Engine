// WHICH TILES CAN CLICK THIS LOC? The general form of tools/sim/apereach.ts, which was written for
// the Ape Atoll course and then wanted again for the Lady Zay's five jinx marks.
//
// For each placement named on the command line it prints the shape and angle, the forceapproach
// mask and footprint, and every tile within three that the engine will accept an op from. A loc on
// a walkable tile is not the same as a loc you can reach: cargo, chairs and tables block the sides,
// and the answer can be "nowhere at all", which means the thing is scenery rather than a target.
//
// Several placements in ONE boot, which is the point - tools/sim/opfrom.ts asks the same question
// one loc and one boot at a time.
//
//   npx tsx tools/sim/locreach.ts loc474_16891,2223,3813,0 loc474_16891,2223,3811,0
import * as H from './harness.js';
import LocType from '#/cache/config/LocType.js';
import World from '#/engine/World.js';
import { canTravel, reachedLoc } from '#/engine/GameMap.js';
import { CollisionType } from '#/engine/routefinder/index.js';

await H.boot();

const args = process.argv.slice(2);
if (!args.length) {
    console.log('usage: npx tsx tools/sim/locreach.ts <locname>,<x>,<z>[,<level>] ...');
    process.exit(2);
}

const standable = (x: number, z: number, level: number): boolean => {
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        if (canTravel(level, x + dx, z + dz, -dx, -dz, 1, 0, CollisionType.NORMAL)) return true;
    }
    return false;
};

for (const a of args) {
    const [nm, xs, zs, ls] = a.split(',');
    const x = Number(xs), z = Number(zs), level = Number(ls ?? 0);
    const id = LocType.getId(nm);
    if (id === -1) {
        console.log(`\n${nm}: NO SUCH LOC TYPE`);
        continue;
    }
    const t = LocType.get(id) as unknown as { forceapproach: number; blockwalk: number; width: number; length: number; name?: string };
    const loc = World.getLoc(x, z, level, id);
    console.log(`\n${nm}${t.name ? '  "' + t.name + '"' : ''}`);
    console.log(`  at ${x},${z} L${level}: ${loc ? 'shape ' + loc.shape + ' angle ' + loc.angle : 'NOT PLACED HERE'}`);
    console.log(`  forceapproach ${t.forceapproach}  blockwalk ${t.blockwalk}  ${t.width}x${t.length}`);
    if (!loc) continue;
    const from: string[] = [];
    for (let dx = -3; dx <= 3; dx++) {
        for (let dz = -3; dz <= 3; dz++) {
            const cx = x + dx, cz = z + dz;
            if (!standable(cx, cz, level)) continue;
            if (reachedLoc(level, cx, cz, loc.x, loc.z, loc.width, loc.length, 1, loc.angle, loc.shape, t.forceapproach)) {
                from.push(`${cx},${cz}`);
            }
        }
    }
    console.log(`  reached from: ${from.length ? from.join('  ') : 'NOWHERE WITHIN THREE TILES ON THIS PLANE'}`);
}

process.exit(0);
