// WHAT THE WEREWOLF AGILITY COURSE LOOKS LIKE TO THE ENGINE, before a line of it is written.
//
// The obstacles are already on m55_154 and the cache names them: Stepping stone (Jump-to), three
// lanes of Hurdle (Jump), three Pipes (Squeeze-through), three Skull slopes (Climb-up), three Zip
// lines (Teeth-grip) and the exit Ladder (Climb-up). What the cache does NOT say is where a lap
// puts the player down, and nineteen rooftop landings were in thin air last time somebody guessed.
//
// So this prints, for every obstacle: where it is placed, its footprint and angle, which sides a
// player can stand on, and the walkable pocket each of those sides belongs to. A landing is then
// chosen from tiles this has actually stood on rather than from a picture of the course.
//
//   npx tsx tools/sim/werewolfland.ts
import * as H from './harness.ts';
import LocType from '#/cache/config/LocType.js';
import { canTravel, isFlagged } from '#/engine/GameMap.js';
import { CollisionFlag, CollisionType } from '#/engine/routefinder/index.js';
import { drawn, onLoc } from './mapfloor.ts';

await H.boot();

const DIRS: [number, number][] = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1]
];

/** Every tile walkable from here on this plane, capped. */
function pocket(level: number, x: number, z: number, cap = 6000) {
    const seen = new Set<string>([x + ',' + z]);
    const q: [number, number][] = [[x, z]];
    while (q.length && seen.size < cap) {
        const [cx, cz] = q.shift()!;
        for (const [dx, dz] of DIRS) {
            const k = cx + dx + ',' + (cz + dz);
            if (seen.has(k) || !canTravel(level, cx, cz, dx, dz, 1, 0, CollisionType.NORMAL)) continue;
            seen.add(k);
            q.push([cx + dx, cz + dz]);
        }
    }
    return seen;
}

const standable = (level: number, x: number, z: number) =>
    DIRS.some(([dx, dz]) => canTravel(level, x - dx, z - dz, dx, dz, 1, 0, CollisionType.NORMAL));

const open = (level: number, x: number, z: number) => !isFlagged(x, z, level, CollisionFlag.WALK_BLOCKED);

// THE OBSTACLES, read off m55_154 by id. Names and ops are the cache's own.
const OBSTACLES: { id: number; label: string; at: [number, number][] }[] = [
    { id: 5138, label: 'stepping stone  Jump-to', at: [[3538, 9875], [3538, 9877], [3540, 9877], [3540, 9879], [3540, 9881]] },
    { id: 5135, label: 'hurdle lane W   Jump', at: [[3537, 9893], [3537, 9896], [3537, 9899]] },
    { id: 5133, label: 'hurdle lane M   Jump', at: [[3539, 9893], [3539, 9896], [3539, 9899]] },
    { id: 5134, label: 'hurdle lane E   Jump', at: [[3542, 9893], [3542, 9896], [3542, 9899]] },
    { id: 5152, label: 'pipe            Squeeze-through', at: [[3538, 9905], [3538, 9908], [3541, 9905], [3541, 9908], [3544, 9905], [3544, 9908]] },
    { id: 5136, label: 'skull slope     Climb-up', at: [[3532, 9909], [3532, 9910], [3532, 9911]] },
    { id: 5140, label: 'zip line W      Teeth-grip', at: [[3527, 9910]] },
    { id: 5139, label: 'zip line M      Teeth-grip', at: [[3528, 9911]] },
    { id: 5141, label: 'zip line E      Teeth-grip', at: [[3529, 9910]] },
    { id: 5130, label: 'ladder (exit)   Climb-up', at: [[3549, 9864]] }
];

// Stand somewhere in the middle of it first, or every zone reads as blocked.
const SEEDS: [number, number][] = [
    [3540, 9870], [3540, 9880], [3540, 9895], [3540, 9906], [3532, 9910], [3528, 9910], [3549, 9864], [3550, 9880]
];
for (const [x, z] of SEEDS) {
    const p = H.makePlayer(`ww_seed_${x}_${z}`, x, z);
    p.teleport(x, z, 0);
    H.tick(2);
}

const pockets = new Map<string, number>();
function pocketSize(x: number, z: number) {
    const k = x + ',' + z;
    if (!pockets.has(k)) pockets.set(k, pocket(0, x, z).size);
    return pockets.get(k)!;
}

console.log('');
for (const o of OBSTACLES) {
    const type = LocType.get(o.id);
    const w = type?.width ?? 1;
    const l = type?.length ?? 1;
    console.log(`${o.label}   loc ${o.id}  ${w}x${l}  (${o.at.length} placed)`);
    for (const [x, z] of o.at) {
        const here = `${x},${z}`;
        const bits: string[] = [];
        bits.push(open(0, x, z) ? 'open' : 'BLOCKED');
        bits.push(drawn(x, z, 0) ? 'floor' : onLoc(x, z, 0) ? 'on a loc' : 'NOTHING DRAWN');
        const sides: string[] = [];
        for (const [dx, dz] of DIRS) {
            const sx = x + dx;
            const sz = z + dz;
            if (open(0, sx, sz) && standable(0, sx, sz)) {
                sides.push(`${sx},${sz}(p${pocketSize(sx, sz)})`);
            }
        }
        console.log(`   ${here.padEnd(12)} ${bits.join(', ').padEnd(22)} stand: ${sides.join(' ') || 'NOWHERE'}`);
    }
}

// AND WHERE THE TRAPDOOR DROPS YOU. The surface trapdoor is loc 5131/5132 at 3543,3462.
console.log('');
console.log('the pocket each end of the course belongs to:');
for (const [label, x, z] of [
    ['below the trapdoor (guess)', 3543, 9862],
    ['by the ladder', 3549, 9865],
    ['start of the stones', 3538, 9874],
    ['after the stones', 3540, 9882],
    ['before the hurdles', 3539, 9891],
    ['after the hurdles', 3539, 9901],
    ['before the pipes', 3541, 9904],
    ['after the pipes', 3541, 9909],
    ['foot of the slope', 3533, 9910],
    ['top of the slope', 3531, 9910]
] as [string, number, number][]) {
    const ok = open(0, x, z) && standable(0, x, z);
    console.log(`   ${label.padEnd(28)} ${x},${z}  ${ok ? 'stand, pocket ' + pocketSize(x, z) : 'CANNOT STAND'}` +
        `  ${drawn(x, z, 0) ? 'floor' : onLoc(x, z, 0) ? 'on a loc' : 'NOTHING DRAWN'}`);
}

process.exit(0);
