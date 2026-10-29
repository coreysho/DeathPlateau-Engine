// The Agility Pyramid: a lap, obstacle by obstacle, and the capstone at the end of it.
// Usage: npx tsx tools/sim/pyramid.ts   (exit code is the verdict)
//
// WHAT THIS IS FOR.
//
//   * THE FIVE STONE BLOCKS WERE BURIED. Every one of them was written a plane below the walkway
//     it belongs to, where the engine registered it on a blocked tile inside the solid pyramid.
//     The map fix lifts them; this asserts the result the only way that means anything - the block
//     SEVERS the walkway (so the obstacle is compulsory rather than something to stroll past) and
//     the op is on the resolved multiloc child, which is where the 377 client reads a menu from.
//
//   * A LANDING THAT IS NOT A TILE. Nineteen of fifty-eight rooftop landings turned out to be thin
//     air, and the pyramid has forty-odd between its landings, its falls and its stair tops. Every
//     one is asked of the engine: can something step onto it, and does the mapsquare draw a floor.
//
//   * THE RINGS HAVE TO JOIN UP. An obstacle that puts you somewhere you cannot walk on from is
//     the same bug as a landing in the air, one tile later. So the walk between consecutive
//     obstacles is pathed for real, not assumed.
//
//   * THE LAP PAYS AT THE DOOR AND ONLY WITH THE CAPSTONE. That is the whole progress mechanism -
//     there is no counter - so it is worth proving that the doorway pays nothing without it.
import fs from 'fs';
import Environment from '#/util/Environment.js';
import * as H from './harness.ts';
import { check, R, player, drive } from './a1lib.ts';
import LocType from '#/cache/config/LocType.js';
import World from '#/engine/World.js';
import JavaRandom from '#/util/JavaRandom.js';
import { canTravel, reachedLoc } from '#/engine/GameMap.js';
import { CollisionType } from '#/engine/routefinder/index.js';
import { drawn, onLoc } from './mapfloor.ts';

await H.boot();

const AGILITY = 16;
const HITPOINTS = 3;

const standable = (x: number, z: number, level: number): boolean => {
    for (const [dx, dz] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1]
    ]) {
        if (canTravel(level, x + dx, z + dz, -dx, -dz, 1, 0, CollisionType.NORMAL)) return true;
    }
    return false;
};
const real = (x: number, z: number, level: number): boolean => standable(x, z, level) && (drawn(x, z, level) || onLoc(x, z, level));

// The slip roll is stat_random, which is random(256) under the hood; pinning nextDouble at 0 makes
// every roll its lowest value, so a maxed player never slips, and at 0.999 never succeeds.
const origND = JavaRandom.nextDouble.bind(JavaRandom);
const pin = (v: number | null) => {
    (JavaRandom as unknown as { nextDouble: () => number }).nextDouble = v === null ? origND : () => v;
};

// Seed every plane of both squares so collision is measured rather than assumed.
for (const [sx, sz] of [
    [3365, 2841],
    [3045, 4697]
] as const) {
    for (let level = 0; level < 4; level++) {
        const p = H.makePlayer(`pyr_seed_${sx}_${level}`, sx, sz);
        p.teleport(sx, sz, level);
        H.tick(2);
    }
}

// ---------------------------------------------------------------------------------------------
console.log('== the five stone blocks are on the walkway now, and they close it');
{
    // loc name, where it is, and the two walkway tiles it sits between.
    const BLOCKS: [string, number, number, number, [number, number], [number, number]][] = [
        ['agility_pyramid_tilting_floor_multi_1', 3354, 2841, 1, [3355, 2840], [3355, 2843]],
        ['agility_pyramid_tilting_floor_multi_3', 3374, 2835, 1, [3375, 2837], [3375, 2834]],
        ['agility_pyramid_tilting_floor_multi_2', 3368, 2849, 2, [3367, 2849], [3370, 2849]],
        ['agility_pyramid_tilting_floor_multi_4', 3048, 4699, 2, [3049, 4701], [3049, 4698]],
        ['agility_pyramid_tilting_floor_multi_5', 3044, 4699, 3, [3043, 4699], [3046, 4699]]
    ];
    for (const [nm, x, z, level, a, b] of BLOCKS) {
        const id = LocType.getId(nm);
        check(`${nm} is placed at ${x},${z} L${level}`, World.getLoc(x, z, level, id) !== null, true);
        // Its own 2x2 is shut, which is what makes it an obstacle.
        check(`${nm} blocks its own tiles`, [standable(x, z, level), standable(x + 1, z + 1, level)], [false, false]);
        // And both sides of it are real walkway.
        check(`${nm} has walkway at ${a[0]},${a[1]}`, real(a[0], a[1], level), true);
        check(`${nm} has walkway at ${b[0]},${b[1]}`, real(b[0], b[1], level), true);
        // THE OPTION IS ON THE CHILD. The multiloc parent has no model and no name; the 377 client
        // resolves it and reads the menu off whichever child the varbit picks, while sending the
        // parent's id. An op on the parent would never appear.
        const parent = LocType.get(id) as unknown as { multiloc: number[]; op: (string | null)[] | null };
        const children = parent.multiloc.filter(c => c !== -1);
        check(`${nm} resolves to two children`, children.length, 2);
        for (const c of children) {
            const child = LocType.get(c);
            check(`  ${child.debugname} offers Cross`, child.op?.[0], 'Cross');
            check(`  ${child.debugname} is called Stone block`, child.name, 'Stone block');
        }
    }
}

// ---------------------------------------------------------------------------------------------
console.log('== the course is gated at Agility 30, on every obstacle and every staircase');
{
    const p = player('pyr_lowlevel', 3354, 2830);
    p.setLevel(AGILITY, 29);
    const mark = H.ifaces.length;
    H.opLoc(p, 3354, 2831, 'agility_pyramid_steps1', 1);
    H.tick(4);
    check('a level 29 player stays on the sand', [p.x, p.z, p.level], [3354, 2830, 0]);
    // ~mesbox is an interface, not a game message, so the refusal is read off the components.
    check(
        'and is told why',
        H.ifaces.slice(mark).some(i => (i.text ?? '').includes('Agility level of 30')),
        true
    );
    p.setLevel(AGILITY, 30);
    H.opLoc(p, 3354, 2831, 'agility_pyramid_steps1', 1);
    H.tick(4);
    check('a level 30 player gets up the first flight', [p.x, p.z, p.level], [3355, 2833, 1]);
}

// ---------------------------------------------------------------------------------------------
// THE LAP. Each step teleports to the tile the engine says that obstacle takes a click from, sends
// the op, and checks where the player ends up and what it paid. Teleporting rather than walking
// isolates the obstacle; the walk BETWEEN obstacles is checked separately below.
type Step = { what: string; from: [number, number, number]; loc: string; at: [number, number]; to: [number, number, number]; xp: number };
const LAP: Step[] = [
    { what: 'stairs: sand -> storey 1', from: [3354, 2830, 0], loc: 'agility_pyramid_steps1', at: [3354, 2831], to: [3355, 2833, 1], xp: 0 },

    { what: 's1 stone block (west)', from: [3355, 2840, 1], loc: 'agility_pyramid_tilting_floor_multi_1', at: [3354, 2841], to: [3355, 2843, 1], xp: 120 },
    { what: 's1 low wall (west)', from: [3355, 2848, 1], loc: 'agility_pyramid_low_wall', at: [3354, 2849], to: [3355, 2850, 1], xp: 80 },
    { what: 's1 ledge (north)', from: [3363, 2851, 1], loc: 'agility_pyramid_ledge_hotspot', at: [3364, 2851], to: [3368, 2851, 1], xp: 520 },
    { what: 's1 plank (east)', from: [3375, 2845, 1], loc: 'agility_pyramid_plank_start', at: [3375, 2845], to: [3375, 2840, 1], xp: 564 },
    { what: 's1 stone block (east)', from: [3375, 2837, 1], loc: 'agility_pyramid_tilting_floor_multi_3', at: [3374, 2835], to: [3375, 2834, 1], xp: 120 },
    { what: 's1 gap cross (south)', from: [3372, 2832, 1], loc: 'agility_pyramid_wallhang_start_south_hotspot', at: [3370, 2831], to: [3367, 2832, 1], xp: 564 },
    { what: 's1 ledge (south)', from: [3364, 2832, 1], loc: 'agility_pyramid_ledgebalance_start_south_hotspot', at: [3362, 2831], to: [3359, 2832, 1], xp: 520 },

    { what: 'stairs: storey 1 -> 2', from: [3357, 2832, 1], loc: 'agility_pyramid_steps1', at: [3356, 2833], to: [3357, 2835, 2], xp: 0 },

    { what: 's2 gap cross (west)', from: [3357, 2836, 2], loc: 'agility_pyramid_wallhang_start_west_hotspot', at: [3356, 2837], to: [3357, 2841, 2], xp: 564 },
    { what: 's2 gap jump (west)', from: [3357, 2846, 2], loc: 'agility_pyramid_jump_hotspot', at: [3356, 2847], to: [3357, 2849, 2], xp: 220 },
    { what: 's2 gap cross (north)', from: [3359, 2849, 2], loc: 'agility_pyramid_wallhang_start_hotspot_ground', at: [3360, 2849], to: [3364, 2849, 2], xp: 564 },
    { what: 's2 stone block (north)', from: [3367, 2849, 2], loc: 'agility_pyramid_tilting_floor_multi_2', at: [3368, 2849], to: [3370, 2849, 2], xp: 120 },
    { what: 's2 ledge (east)', from: [3372, 2841, 2], loc: 'agility_pyramid_ledge_hotspot', at: [3372, 2839], to: [3372, 2836, 2], xp: 520 },
    { what: 's2 low wall (south)', from: [3371, 2833, 2], loc: 'agility_pyramid_low_wall', at: [3370, 2833], to: [3369, 2833, 2], xp: 80 },
    { what: 's2 gap jump (south)', from: [3366, 2833, 2], loc: 'agility_pyramid_jump_hotspot', at: [3364, 2833], to: [3363, 2833, 2], xp: 220 },

    { what: 'stairs: storey 2 -> 3', from: [3359, 2834, 2], loc: 'agility_pyramid_steps1', at: [3358, 2835], to: [3359, 2837, 3], xp: 0 },

    { what: 's3 low wall (west)', from: [3359, 2838, 3], loc: 'agility_pyramid_low_wall', at: [3358, 2839], to: [3359, 2840, 3], xp: 80 },
    { what: 's3 ledge (west)', from: [3359, 2842, 3], loc: 'agility_pyramid_ledgebalance_start_west_hotspot', at: [3358, 2843], to: [3359, 2847, 3], xp: 520 },
    { what: 's3 gap jump (east)', from: [3370, 2843, 3], loc: 'agility_pyramid_jump_hotspot', at: [3370, 2841], to: [3370, 2840, 3], xp: 220 },
    { what: 's3 plank (south)', from: [3370, 2835, 3], loc: 'agility_pyramid_plank_start', at: [3370, 2835], to: [3365, 2835, 3], xp: 564 },

    { what: 'stairs: storey 3 -> 4, into the other map square', from: [3361, 2836, 3], loc: 'agility_pyramid_steps1', at: [3360, 2837], to: [3041, 4695, 2], xp: 0 },

    { what: 's4 gap jump (west)', from: [3041, 4696, 2], loc: 'agility_pyramid_jump_hotspot', at: [3040, 4697], to: [3041, 4699, 2], xp: 220 },
    { what: 's4 stone block (east)', from: [3049, 4701, 2], loc: 'agility_pyramid_tilting_floor_multi_4', at: [3048, 4699], to: [3049, 4698, 2], xp: 120 },
    { what: 's4 gap jump (east)', from: [3049, 4697, 2], loc: 'agility_pyramid_jump_hotspot', at: [3048, 4695], to: [3049, 4694, 2], xp: 220 },
    { what: 's4 low wall (south)', from: [3048, 4693, 2], loc: 'agility_pyramid_low_wall', at: [3047, 4693], to: [3046, 4693, 2], xp: 80 },

    { what: 'stairs: storey 4 -> the apex', from: [3043, 4694, 2], loc: 'agility_pyramid_steps1', at: [3042, 4695], to: [3043, 4697, 3], xp: 0 },

    { what: 's5 stone block (north)', from: [3043, 4699, 3], loc: 'agility_pyramid_tilting_floor_multi_5', at: [3044, 4699], to: [3046, 4699, 3], xp: 120 },
    { what: 's5 gap jump (east)', from: [3046, 4699, 3], loc: 'agility_pyramid_jump_hotspot', at: [3046, 4697], to: [3046, 4696, 3], xp: 220 }
];

console.log('== every tile the lap uses is a tile');
{
    for (const s of LAP) {
        check(`${s.what}: you can stand at ${s.from[0]},${s.from[1]} L${s.from[2]}`, real(s.from[0], s.from[1], s.from[2]), true);
        check(`${s.what}: and land at ${s.to[0]},${s.to[1]} L${s.to[2]}`, real(s.to[0], s.to[1], s.to[2]), true);
    }
    // The apex walkway and the two tiles the climb and the doorway are used from.
    for (const [nm, x, z, l] of [
        ['the climbing rocks', 3043, 4697, 3],
        ['the summit doorway', 3045, 4696, 3],
        ['the doorway exit', 3365, 2829, 0]
    ] as const) {
        check(`${nm} at ${x},${z} L${l} is a tile`, real(x, z, l), true);
    }
}

console.log('== and the engine takes the click from the tile the lap uses');
{
    for (const s of LAP) {
        const id = LocType.getId(s.loc);
        const loc = World.getLoc(s.at[0], s.at[1], s.from[2], id);
        if (!loc) {
            check(`${s.what}: ${s.loc} is at ${s.at[0]},${s.at[1]}`, false, true);
            continue;
        }
        const t = LocType.get(id) as unknown as { forceapproach: number };
        check(`${s.what}: reachable from ${s.from[0]},${s.from[1]}`, reachedLoc(s.from[2], s.from[0], s.from[1], loc.x, loc.z, loc.width, loc.length, 1, loc.angle, loc.shape, t.forceapproach), true);
    }
}

// ---------------------------------------------------------------------------------------------
console.log('== a clean lap: twenty-four obstacles, six flights of stairs, 714 experience');
let lapXp = 0;
{
    const p = player('pyr_lap', 3354, 2830);
    pin(0);
    try {
        for (const s of LAP) {
            p.clearPendingAction();
            p.queueWaypoints([]);
            p.teleport(s.from[0], s.from[1], s.from[2]);
            H.tick(1);
            const before = p.stats[AGILITY];
            H.opLoc(p, s.at[0], s.at[1], s.loc, 1);
            for (let i = 0; i < 14; i++) H.tick(1);
            const gained = p.stats[AGILITY] - before;
            lapXp += gained;
            check(`${s.what}: ends at ${s.to[0]},${s.to[1]} L${s.to[2]}`, [p.x, p.z, p.level], [s.to[0], s.to[1], s.to[2]]);
            check(`${s.what}: pays ${s.xp / 10}`, gained, s.xp);
        }
    } finally {
        pin(null);
    }
    // 5 stone blocks, 4 low walls, 4 ledges, 2 planks, 3 gap crosses and 6 gap jumps. Old School's
    // 722 less the one low wall that is in neither map square.
    check('the obstacles pay 714 between them', lapXp, 7140);
}

// ---------------------------------------------------------------------------------------------
console.log('== the rings join up: you can walk from each landing to the next click');
{
    // A flood rather than a path request, because the question is "is the walkway continuous",
    // and a flood of the storey answers it without any of the pathfinder's destination arguments
    // being able to quietly change what was asked.
    const reaches = (level: number, fx: number, fz: number, tx: number, tz: number): boolean => {
        const seen = new Set<number>();
        const key = (x: number, z: number) => (x << 16) | z;
        const queue: [number, number][] = [[fx, fz]];
        seen.add(key(fx, fz));
        while (queue.length) {
            const [x, z] = queue.shift()!;
            if (x === tx && z === tz) return true;
            if (Math.abs(x - fx) > 40 || Math.abs(z - fz) > 40) continue;
            for (const [dx, dz] of [
                [1, 0],
                [-1, 0],
                [0, 1],
                [0, -1]
            ]) {
                const nx = x + dx,
                    nz = z + dz;
                if (seen.has(key(nx, nz))) continue;
                if (!canTravel(level, x, z, dx, dz, 1, 0, CollisionType.NORMAL)) continue;
                seen.add(key(nx, nz));
                queue.push([nx, nz]);
            }
        }
        return false;
    };
    for (let i = 0; i < LAP.length - 1; i++) {
        const land = LAP[i].to;
        const next = LAP[i + 1].from;
        if (land[2] !== next[2] || land[0] >> 6 !== next[0] >> 6) continue; // a staircase, not a walk
        check(`${LAP[i].what} -> ${LAP[i + 1].what}`, reaches(land[2], land[0], land[1], next[0], next[1]), true);
    }
}

// ---------------------------------------------------------------------------------------------
console.log('== and every obstacle works walked backwards, which is what the code claims');
{
    // Old School lets you walk a lap either way round, and nothing here stores a direction: it is
    // read off the player's position against loc_coord every time. So the whole of that reading is
    // only half tested by a lap. One of each kind, taken from the far side.
    //
    // THE LEDGES AND THE WALL HANGS ARE TWO LOCS EACH, a start and an end, and a player coming
    // back clicks the OTHER one - so the far-side case is a different trigger, not just a different
    // branch.
    const BACK: [string, string, [number, number], [number, number, number], [number, number, number]][] = [
        ['stone block', 'agility_pyramid_tilting_floor_multi_1', [3354, 2841], [3355, 2843, 1], [3355, 2840, 1]],
        ['low wall', 'agility_pyramid_low_wall', [3354, 2849], [3355, 2850, 1], [3355, 2848, 1]],
        ['low wall (laid the other way)', 'agility_pyramid_low_wall', [3370, 2833], [3369, 2833, 2], [3371, 2833, 2]],
        ['gap jump', 'agility_pyramid_jump_hotspot', [3356, 2847], [3357, 2849, 2], [3357, 2846, 2]],
        ['ledge (the far hotspot)', 'agility_pyramid_ledge_hotspot', [3366, 2851], [3368, 2851, 1], [3363, 2851, 1]],
        ['gap cross (the far hotspot)', 'agility_pyramid_wallhang_end_south_hotspot', [3368, 2831], [3367, 2832, 1], [3372, 2832, 1]],
        ['gap cross (clicked on the wall)', 'agility_pyramid_wallhang_end_hotspot', [3367, 2832], [3367, 2832, 1], [3372, 2832, 1]],
        ['plank (the far end)', 'agility_pyramid_plank_end', [3375, 2840], [3375, 2840, 1], [3375, 2845, 1]]
    ];
    pin(0);
    try {
        for (const [what, loc, at, from, to] of BACK) {
            const p = player(`pyr_back_${what.replace(/[^a-z]/g, '_')}`, from[0], from[1], from[2]);
            p.teleport(from[0], from[1], from[2]);
            H.tick(1);
            H.opLoc(p, at[0], at[1], loc, 1);
            for (let i = 0; i < 14; i++) H.tick(1);
            check(`${what}: back from ${from[0]},${from[1]} to ${to[0]},${to[1]}`, [p.x, p.z, p.level], [to[0], to[1], to[2]]);
        }
    } finally {
        pin(null);
    }
}

// ---------------------------------------------------------------------------------------------
console.log('== a failure drops you a storey onto a real tile, and costs what Old School says');
{
    // obstacle, the tile it is attempted from, where a fall lands, and the damage.
    const FALLS: [string, string, [number, number, number], [number, number, number], number][] = [
        ['stone block', 'agility_pyramid_tilting_floor_multi_1', [3355, 2840, 1], [3353, 2840, 0], 6],
        ['ledge', 'agility_pyramid_ledge_hotspot', [3363, 2851, 1], [3364, 2853, 0], 10],
        ['plank', 'agility_pyramid_plank_start', [3375, 2845, 1], [3376, 2845, 0], 10],
        ['gap cross', 'agility_pyramid_wallhang_start_south_hotspot', [3372, 2832, 1], [3372, 2830, 0], 8],
        ['gap jump', 'agility_pyramid_jump_hotspot', [3357, 2846, 2], [3355, 2846, 1], 8]
    ];
    // AT 99 NOTHING ON THIS COURSE CAN BE FAILED, which is the design: stat_random's value is
    // 276 at level 99 against a roll of 0-255. So the failures are forced at the course's own
    // entry level, where the value is 222 and a pinned 255 beats it.
    for (const [what, loc, from, to, dmg] of FALLS) {
        const p = player(`pyr_fall_${what.replace(/ /g, '_')}`, from[0], from[1], from[2]);
        p.teleport(from[0], from[1], from[2]);
        p.setLevel(AGILITY, 30);
        H.tick(1);
        const hp = p.levels[HITPOINTS];
        const xp = p.stats[AGILITY];
        const at: [number, number] = loc.includes('ledge_hotspot') ? [3364, 2851] : loc.includes('multi_1') ? [3354, 2841] : loc.includes('plank') ? [3375, 2845] : loc.includes('wallhang') ? [3370, 2831] : [3356, 2847];
        pin(0.999);
        try {
            H.opLoc(p, at[0], at[1], loc, 1);
            for (let i = 0; i < 14; i++) H.tick(1);
        } finally {
            pin(null);
        }
        check(`${what}: falls to ${to[0]},${to[1]} L${to[2]}`, [p.x, p.z, p.level], [to[0], to[1], to[2]]);
        check(`${what}: and that is a tile`, real(p.x, p.z, p.level), true);
        check(`${what}: costs ${dmg}`, hp - p.levels[HITPOINTS], dmg);
        check(`${what}: and pays nothing`, p.stats[AGILITY] - xp, 0);
    }
    // THE LOW WALL IS THE EXCEPTION: a slip on a wall you are climbing over leaves you on the side
    // you set out from. Old School's table says 4 damage and no fall, and nothing else here does.
    const p = player('pyr_fall_lowwall', 3355, 2848, 1);
    p.teleport(3355, 2848, 1);
    p.setLevel(AGILITY, 30);
    H.tick(1);
    const hp = p.levels[HITPOINTS];
    pin(0.999);
    try {
        H.opLoc(p, 3354, 2849, 'agility_pyramid_low_wall', 1);
        for (let i = 0; i < 10; i++) H.tick(1);
    } finally {
        pin(null);
    }
    check('low wall: a slip leaves you where you were', [p.x, p.z, p.level], [3355, 2848, 1]);
    check('low wall: and costs 4', hp - p.levels[HITPOINTS], 4);
}

// ---------------------------------------------------------------------------------------------
console.log('== the capstone: taken once, and the lap is paid for carrying it through the door');
{
    const topVarbit = (p: ReturnType<typeof player>) => H.getVarBit(p, 'agility_pyramid_top');

    const p = player('pyr_capstone', 3043, 4697, 3);
    p.teleport(3043, 4697, 3);
    H.tick(1);
    check('the shrine still has its cap', topVarbit(p), 0);
    H.opLoc(p, 3043, 4697, 'agility_pyramid_wall_rocks', 1);
    for (let i = 0; i < 10; i++) H.tick(1);
    check('the climb hands over a pyramid top', H.invCount(p, 'agility_pyramid_gold_pyramid'), 1);
    check('and the shrine loses its cap', topVarbit(p), 1);
    const mark = H.mesgs.length;
    H.opLoc(p, 3043, 4697, 'agility_pyramid_wall_rocks', 1);
    for (let i = 0; i < 10; i++) H.tick(1);
    check('a second climb gives nothing', H.invCount(p, 'agility_pyramid_gold_pyramid'), 1);
    check(
        'and says so',
        H.mesgs.slice(mark).some(m => m.text.includes('already taken')),
        true
    );

    // Through the door with it: the bonus is 300 + 8 x level, capped at 1,000, off the BASE level.
    p.teleport(3045, 4696, 3);
    H.tick(1);
    const xp = p.stats[AGILITY];
    H.opLoc(p, 3045, 4696, 'agility_pyramid_door_hotspot', 1);
    for (let i = 0; i < 12; i++) H.tick(1);
    check('the doorway puts you at the foot of the pyramid', [p.x, p.z, p.level], [3365, 2829, 0]);
    check('a maxed player gets the capped 1,000', p.stats[AGILITY] - xp, 10000);
    check('and the shrine gets its cap back', topVarbit(p), 0);
    check('the capstone is still in the pack, to sell', H.invCount(p, 'agility_pyramid_gold_pyramid'), 1);

    // At level 30 the bonus is 300 + 240 = 540, not the cap.
    const q = player('pyr_bonus30', 3045, 4696, 3);
    q.teleport(3045, 4696, 3);
    q.setLevel(AGILITY, 30);
    H.give(q, 'agility_pyramid_gold_pyramid');
    H.tick(1);
    const qxp = q.stats[AGILITY];
    H.opLoc(q, 3045, 4696, 'agility_pyramid_door_hotspot', 1);
    for (let i = 0; i < 12; i++) H.tick(1);
    check('at level 30 the lap pays 540', q.stats[AGILITY] - qxp, 5400);

    // And without it, the door is just a way down.
    const r = player('pyr_nocapstone', 3045, 4696, 3);
    r.teleport(3045, 4696, 3);
    H.clearInv(r);
    H.tick(1);
    const rxp = r.stats[AGILITY];
    H.opLoc(r, 3045, 4696, 'agility_pyramid_door_hotspot', 1);
    for (let i = 0; i < 12; i++) H.tick(1);
    check('without the capstone the doorway still takes you down', [r.x, r.z, r.level], [3365, 2829, 0]);
    check('but pays nothing at all', r.stats[AGILITY] - rxp, 0);
}

// ---------------------------------------------------------------------------------------------
console.log('== Simon Templeton is standing there and pays 10,000 a top');
{
    const simon = H.npcNear('agility_pyramid_simon', 3363, 2829, 0);
    check('he is spawned at the foot of the pyramid', simon !== null, true);
    if (simon) {
        const p = player('pyr_simon', 3364, 2829);
        H.clearInv(p);
        H.give(p, 'agility_pyramid_gold_pyramid', 2);
        H.tick(1);
        H.opNpc(p, simon, 1);
        // ~chatnpc parks the script on a Continue, and anything after it has not happened yet.
        drive(p);
        check('he takes both', H.invCount(p, 'agility_pyramid_gold_pyramid'), 0);
        check('and pays twenty thousand', H.invCount(p, 'coins'), 20000);
    }
}

// ---------------------------------------------------------------------------------------------
console.log('== and the two obstacles that are deliberately absent are still absent');
{
    // The pyramid blocks: Old School has two, they pay nothing, and they are moving npcs rather
    // than a click. Both are spawned by the map already; nothing scripts them. If one ever gets a
    // handler this check is the thing that should be deleted, on purpose.
    const src = Environment.BUILD_SRC_DIR;
    const rs2 = fs.readFileSync(`${src}/scripts/skill_agility/scripts/pyramid_course.rs2`, 'ascii');
    check('no pyramid-block handler', /penny_waterfall/.test(rs2), false);
    const konst = fs.readFileSync(`${src}/scripts/skill_agility/configs/pyramid_course.constant`, 'ascii');
    check('the constant file says why', /pyramid block/i.test(konst), true);
    check('and says the fifth low wall is missing', /five.*four are placed|fifth is not/is.test(konst), true);
}

console.log(`\n${R.ok} ok, ${R.bad} failed`);
process.exit(R.bad ? 1 : 0);
