// WHICH TILES CAN CLICK THE APE ATOLL COURSE, all nine locs in ONE boot. opfrom.ts answers this one
// loc at a time and a boot each, which is ten minutes to ask nine questions; this asks them all.
//
// For each loc it prints the placement, its forceapproach and footprint, and then every tile within
// three that the engine will accept the op from - a tile being walkable is not the same as the loc
// being reachable from it, and on a two-span walkway over a cliff that difference is the whole
// design.
//
//   npx tsx tools/sim/apereach.ts
import * as H from './harness.js';
import LocType from '#/cache/config/LocType.js';
import World from '#/engine/World.js';
import { canTravel, reachedLoc } from '#/engine/GameMap.js';
import { CollisionType } from '#/engine/routefinder/index.js';

await H.boot();

const LOCS: [string, number, number, number, string][] = [
    ['loc_12568', 2754, 2742, 0, 'Stepping stone (Jump-to)'],
    ['loc_12570', 2753, 2741, 0, 'Tropical tree (Climb)'],
    ['loc_12573', 2752, 2741, 2, 'Monkeybars, east (Swing Across)'],
    ['loc_12575', 2747, 2741, 2, 'Monkeybars, west (Swing Across)'],
    ['loc_12576', 2746, 2741, 0, 'Skull slope (Climb-up)'],
    ['loc_12578', 2752, 2731, 0, 'Rope (Swing)'],
    ['loc_12618', 2757, 2734, 0, 'Tropical tree (Climb-down)'],
    ['loc_12622', 2758, 2735, 1, 'Vine (Climb-down)'],
    ['loc_12581', 2758, 2729, 0, 'Hole (Enter)']
];

const standable = (x: number, z: number, level: number): boolean => {
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        if (canTravel(level, x + dx, z + dz, -dx, -dz, 1, 0, CollisionType.NORMAL)) return true;
    }
    return false;
};

for (const [nm, x, z, level, what] of LOCS) {
    const id = LocType.getId(nm);
    const t = LocType.get(id) as unknown as { forceapproach: number; blockwalk: number; width: number; length: number };
    const loc = World.getLoc(x, z, level, id);
    console.log(`\n${nm}  ${what}`);
    console.log(`  at ${x},${z} L${level}: ${loc ? 'shape ' + loc.shape + ' angle ' + loc.angle : 'NOT PLACED HERE'}`);
    console.log(`  forceapproach ${t.forceapproach}  blockwalk ${t.blockwalk}  ${t.width}x${t.length}`);
    if (!loc) continue;
    const from: string[] = [];
    for (let dx = -3; dx <= 3; dx++) {
        for (let dz = -3; dz <= 3; dz++) {
            const cx = x + dx, cz = z + dz;
            if (!standable(cx, cz, level)) continue;
            // the engine's own question, asked directly rather than through a walk
            if (reachedLoc(level, cx, cz, loc.x, loc.z, loc.width, loc.length, 1, loc.angle, loc.shape, t.forceapproach)) {
                from.push(`${cx},${cz}`);
            }
        }
    }
    console.log(`  reached from: ${from.length ? from.join('  ') : 'NOWHERE WITHIN THREE TILES ON THIS PLANE'}`);
}

process.exit(0);
