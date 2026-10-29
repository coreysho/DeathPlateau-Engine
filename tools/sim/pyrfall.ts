// WHERE DOES A FAILED PYRAMID OBSTACLE PUT YOU? For every obstacle of the Agility Pyramid, the
// nearest tile on the storey below that a player can actually stand on and walk off.
//
// Old School drops you one layer on almost every failure, and "one layer down" is not a coordinate
// the map hands you: the rings are concentric and each is two tiles further out than the one above,
// so the tile under an obstacle is usually inside the solid pyramid. This asks the engine for the
// nearest standable tile instead, and prints it with its distance so an answer that is absurdly
// far away is visible rather than silently baked into a constant.
//
//   npx tsx tools/sim/pyrfall.ts
import * as H from './harness.ts';
import { canTravel } from '#/engine/GameMap.js';
import { CollisionType } from '#/engine/routefinder/index.js';
import { drawn, onLoc } from './mapfloor.ts';

await H.boot();

const standable = (x: number, z: number, level: number): boolean => {
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        if (canTravel(level, x + dx, z + dz, -dx, -dz, 1, 0, CollisionType.NORMAL)) return true;
    }
    return false;
};
const real = (x: number, z: number, level: number): boolean => standable(x, z, level) && (drawn(x, z, level) || onLoc(x, z, level));

// Seed every plane of both squares so the zones are measured rather than assumed.
for (const [sx, sz] of [[3365, 2841], [3045, 4697]] as const) {
    for (let level = 0; level < 4; level++) {
        const p = H.makePlayer(`fall_seed_${sx}_${level}`, sx, sz);
        p.teleport(sx, sz, level);
        H.tick(2);
    }
}

// name, the tile the player sets out from, and the storey the fall lands on.
type Row = { name: string; x: number; z: number; to: number; near?: [number, number] };
const ROWS: Row[] = [
    // Storey 1 - the plane 1 ring of m52_44. A fall goes to the desert outside the base.
    { name: 's1 stone block  (west)', x: 3354, z: 2840, to: 0 },
    { name: 's1 ledge        (north)', x: 3363, z: 2851, to: 0 },
    { name: 's1 plank        (east)', x: 3375, z: 2845, to: 0 },
    { name: 's1 stone block  (east)', x: 3374, z: 2837, to: 0 },
    { name: 's1 gap cross    (south)', x: 3372, z: 2832, to: 0 },
    { name: 's1 ledge        (south)', x: 3364, z: 2832, to: 0 },
    // Storey 2 - the plane 2 ring. A fall goes to the plane 1 ring.
    { name: 's2 gap cross    (west)', x: 3357, z: 2836, to: 1 },
    { name: 's2 gap jump     (west)', x: 3356, z: 2846, to: 1 },
    { name: 's2 gap cross    (north)', x: 3359, z: 2849, to: 1 },
    { name: 's2 stone block  (north)', x: 3367, z: 2849, to: 1 },
    { name: 's2 ledge        (east)', x: 3372, z: 2841, to: 1 },
    { name: 's2 low wall     (south)', x: 3371, z: 2833, to: 1 },
    { name: 's2 gap jump     (south)', x: 3366, z: 2833, to: 1 },
    // Storey 3 - the plane 3 ring. A fall goes to the plane 2 ring.
    { name: 's3 low wall     (west)', x: 3358, z: 2838, to: 2 },
    { name: 's3 ledge        (west)', x: 3359, z: 2842, to: 2 },
    { name: 's3 gap jump     (east)', x: 3370, z: 2843, to: 2 },
    { name: 's3 plank        (south)', x: 3370, z: 2835, to: 2 },
    // Storey 5 - the apex ring of m47_73. A fall goes to the storey 4 ring, same square.
    { name: 's5 stone block  (north)', x: 3043, z: 4699, to: 2 },
    { name: 's5 gap jump     (east)', x: 3046, z: 4699, to: 2 }
];

for (const r of ROWS) {
    let best: [number, number, number] | null = null;
    for (let rad = 1; rad <= 12 && !best; rad++) {
        for (let dx = -rad; dx <= rad; dx++) {
            for (let dz = -rad; dz <= rad; dz++) {
                if (Math.max(Math.abs(dx), Math.abs(dz)) !== rad) continue;
                const cx = r.x + dx, cz = r.z + dz;
                if (!real(cx, cz, r.to)) continue;
                const d = Math.abs(dx) + Math.abs(dz);
                if (!best || d < best[2]) best = [cx, cz, d];
            }
        }
    }
    console.log(`${r.name}  from ${r.x},${r.z} -> L${r.to}: ${best ? `${best[0]},${best[1]}  (${best[2]} tiles)` : 'NOTHING WITHIN TWELVE'}`);
}

// Storey 4 lives in the other map square and its own plane 1 is solid, so a fall from it has to
// land on storey 3 - which is in m52_44. These are picked by hand and checked here.
console.log('\nStorey 4 falls land on storey 3, in the other map square:');
for (const [nm, x, z] of [['s4 gap jump (west)', 3358, 2847], ['s4 stone block (east)', 3371, 2847],
    ['s4 gap jump (east)', 3370, 2840], ['s4 low wall (south)', 3362, 2835]] as const) {
    console.log(`  ${nm}: ${x},${z} L3 standable=${standable(x, z, 3)} drawn=${drawn(x, z, 3)} onLoc=${onLoc(x, z, 3)}`);
}
process.exit(0);
