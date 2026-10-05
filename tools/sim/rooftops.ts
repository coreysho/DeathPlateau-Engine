// Every rooftop course after Al Kharid, on the real engine, from one table.
//
// Draynor and Al Kharid have sims of their own because each taught something the next one needed.
// What they taught is built in here, so a course added below inherits all of it:
//
//   * a landing has to be somewhere the player can actually STAND - engine collision, not the map
//     file, because a roof is terrain in one town and locs in another (Draynor's is terrain and
//     Varrock's is locs, and an overlay-based check calls Varrock's roofs thin air);
//   * a WALKED crossing is replayed tile by tile with ~agility_walk's diagonal-first rule, because
//     Draynor shipped both tightropes crossing the row NEXT to the rope and a landings-only check
//     passed it;
//   * the experience is in TENTHS of a point - stat_advance takes xp * 10 - which Draynor and Al
//     Kharid both got wrong, paying a tenth of the rate;
//   * and the lap is walked end to end, which is the only thing that catches an obstacle a player
//     cannot reach from the one before it. Al Kharid's tropical tree is exactly that.
//
//   npx tsx tools/sim/rooftops.ts [course]
import { readFileSync } from 'fs';

import * as H from './harness.ts';
import * as A from './a1lib.ts';
import { check, R, player } from './a1lib.ts';
import VarPlayerType from '#/cache/config/VarPlayerType.js';
import { CollisionFlag } from '#/engine/routefinder/index.js';
import { isFlagged } from '#/engine/GameMap.js';

await H.boot();

type Ob = {
    name: string; loc: string; x: number; z: number; level: number;
    land: string;            // the constant naming where it puts you down
    xp: string;              // the constant naming what it pays
    walk?: string;           // the constant naming where the walk starts, for a crossing
};
type Course = {
    key: string; title: string; level: number; lapXp: number;
    start: [number, number, number];     // where a runner begins, on the street
    obstacles: Ob[];
};

const COURSES: Course[] = [
    {
        key: 'varrock', title: 'VARROCK', level: 30, lapXp: 2317,
        start: [3221, 3416, 0],
        obstacles: [
            { name: 'rough wall',   loc: 'osrsloc_14412', x: 3221, z: 3414, level: 0, land: 'varrock_land_wall',        xp: 'varrock_xp_wall' },
            { name: 'clothes line', loc: 'osrsloc_14413', x: 3213, z: 3414, level: 3, land: 'varrock_land_clothesline', xp: 'varrock_xp_clothesline', walk: 'varrock_clothesline_start' },
            { name: 'gap 1',        loc: 'osrsloc_14414', x: 3200, z: 3416, level: 3, land: 'varrock_land_gap1',        xp: 'varrock_xp_gap1' },
            { name: 'gap 2',        loc: 'osrsloc_14834', x: 3209, z: 3397, level: 3, land: 'varrock_land_gap2',        xp: 'varrock_xp_gap2' },
            { name: 'gap 3',        loc: 'osrsloc_14835', x: 3233, z: 3402, level: 3, land: 'varrock_land_gap3',        xp: 'varrock_xp_gap3' },
            { name: 'ledge',        loc: 'osrsloc_14836', x: 3236, z: 3409, level: 3, land: 'varrock_land_ledge',       xp: 'varrock_xp_ledge' },
            { name: 'edge',         loc: 'osrsloc_14841', x: 3236, z: 3416, level: 3, land: 'varrock_land_edge',        xp: 'varrock_xp_edge' },
        ],
    },
    {
        key: 'canifis', title: 'CANIFIS', level: 40, lapXp: 2400,
        start: [3506, 3488, 0],
        obstacles: [
            { name: 'tall tree',  loc: 'osrsloc_14843', x: 3505, z: 3489, level: 0, land: 'canifis_land_tree',  xp: 'canifis_xp_tree' },
            { name: 'gap 1',      loc: 'osrsloc_14844', x: 3505, z: 3498, level: 3, land: 'canifis_land_gap1',  xp: 'canifis_xp_gap1' },
            { name: 'gap 2',      loc: 'osrsloc_14845', x: 3496, z: 3504, level: 3, land: 'canifis_land_gap2',  xp: 'canifis_xp_gap2' },
            { name: 'gap 3',      loc: 'osrsloc_14848', x: 3485, z: 3499, level: 3, land: 'canifis_land_gap3',  xp: 'canifis_xp_gap3' },
            { name: 'gap 4',      loc: 'osrsloc_14846', x: 3478, z: 3491, level: 3, land: 'canifis_land_gap4',  xp: 'canifis_xp_gap4' },
            { name: 'pole-vault', loc: 'osrsloc_14894', x: 3480, z: 3483, level: 3, land: 'canifis_land_vault', xp: 'canifis_xp_vault' },
            { name: 'gap 5',      loc: 'osrsloc_14847', x: 3503, z: 3476, level: 3, land: 'canifis_land_gap5',  xp: 'canifis_xp_gap5' },
            { name: 'gap 6',      loc: 'osrsloc_14897', x: 3510, z: 3483, level: 3, land: 'canifis_land_gap6',  xp: 'canifis_xp_gap6' },
        ],
    },
    {
        key: 'falador', title: 'FALADOR', level: 50, lapXp: 5860,
        start: [3036, 3340, 0],
        obstacles: [
            { name: 'rough wall'    , loc: 'osrsloc_14898', x: 3036, z: 3341, level: 0, land: 'falador_land_wall', xp: 'falador_xp_wall' },
            { name: 'tightrope 1'   , loc: 'osrsloc_14899', x: 3040, z: 3343, level: 3, land: 'falador_land_rope1', xp: 'falador_xp_rope1' },
            { name: 'hand holds'    , loc: 'osrsloc_14901', x: 3050, z: 3350, level: 3, land: 'falador_land_handholds', xp: 'falador_xp_handholds' },
            { name: 'gap 1'         , loc: 'osrsloc_14903', x: 3048, z: 3359, level: 3, land: 'falador_land_gap1', xp: 'falador_xp_gap1' },
            { name: 'gap 2'         , loc: 'osrsloc_14904', x: 3044, z: 3361, level: 3, land: 'falador_land_gap2', xp: 'falador_xp_gap2' },
            { name: 'tightrope 2'   , loc: 'osrsloc_14905', x: 3034, z: 3361, level: 3, land: 'falador_land_rope2', xp: 'falador_xp_rope2' },
            { name: 'tightrope 3'   , loc: 'osrsloc_14911', x: 3026, z: 3353, level: 3, land: 'falador_land_rope3', xp: 'falador_xp_rope3' },
            { name: 'gap 3'         , loc: 'osrsloc_14919', x: 3016, z: 3352, level: 3, land: 'falador_land_gap3', xp: 'falador_xp_gap3' },
            { name: 'ledge 1'       , loc: 'osrsloc_14920', x: 3015, z: 3345, level: 3, land: 'falador_land_ledge1', xp: 'falador_xp_ledge1' },
            { name: 'ledge 2'       , loc: 'osrsloc_14921', x: 3011, z: 3343, level: 3, land: 'falador_land_ledge2', xp: 'falador_xp_ledge2' },
            { name: 'ledge 3'       , loc: 'osrsloc_14922', x: 3012, z: 3334, level: 3, land: 'falador_land_ledge3', xp: 'falador_xp_ledge3' },
            { name: 'ledge 4'       , loc: 'osrsloc_14923', x: 3014, z: 3335, level: 3, land: 'falador_land_ledge4', xp: 'falador_xp_ledge4' },
            { name: 'ledge 5'       , loc: 'osrsloc_14924', x: 3018, z: 3332, level: 3, land: 'falador_land_ledge5', xp: 'falador_xp_ledge5' },
            { name: 'edge'          , loc: 'osrsloc_14925', x: 3025, z: 3332, level: 3, land: 'falador_land_edge', xp: 'falador_xp_edge' },
        ],
    },
    {
        key: 'seers', title: "SEERS' VILLAGE", level: 60, lapXp: 5700,
        start: [2729, 3490, 0],
        obstacles: [
            { name: 'wall',      loc: 'osrsloc_14927', x: 2729, z: 3489, level: 0, land: 'seers_land_wall', xp: 'seers_xp_wall' },
            { name: 'gap 1',     loc: 'osrsloc_14928', x: 2720, z: 3492, level: 3, land: 'seers_land_gap1', xp: 'seers_xp_gap1' },
            { name: 'tightrope', loc: 'osrsloc_14932', x: 2710, z: 3489, level: 2, land: 'seers_land_rope', xp: 'seers_xp_rope' },
            { name: 'gap 2',     loc: 'osrsloc_14929', x: 2710, z: 3476, level: 2, land: 'seers_land_gap2', xp: 'seers_xp_gap2' },
            { name: 'gap 3',     loc: 'osrsloc_14930', x: 2700, z: 3469, level: 3, land: 'seers_land_gap3', xp: 'seers_xp_gap3' },
            { name: 'edge',      loc: 'osrsloc_14931', x: 2703, z: 3461, level: 2, land: 'seers_land_edge', xp: 'seers_xp_edge' },
        ],
    },
    {
        key: 'pollnivneach', title: 'POLLNIVNEACH', level: 70, lapXp: 8900,
        start: [3351, 2961, 0],
        obstacles: [
            { name: 'basket', loc: 'osrsloc_14935', x: 3351, z: 2962, level: 0, land: 'pollnivneach_land_basket', xp: 'pollnivneach_xp_basket' },
            { name: 'market stall', loc: 'osrsloc_14936', x: 3349, z: 2970, level: 1, land: 'pollnivneach_land_stall', xp: 'pollnivneach_xp_stall' },
            { name: 'banner', loc: 'osrsloc_14937', x: 3356, z: 2978, level: 1, land: 'pollnivneach_land_banner', xp: 'pollnivneach_xp_banner' },
            { name: 'gap', loc: 'osrsloc_14938', x: 3363, z: 2976, level: 1, land: 'pollnivneach_land_gap', xp: 'pollnivneach_xp_gap' },
            { name: 'tree 1', loc: 'osrsloc_14939', x: 3367, z: 2977, level: 1, land: 'pollnivneach_land_tree1', xp: 'pollnivneach_xp_tree1' },
            { name: 'rough wall', loc: 'osrsloc_14940', x: 3365, z: 2982, level: 1, land: 'pollnivneach_land_wall', xp: 'pollnivneach_xp_wall' },
            { name: 'monkeybars', loc: 'osrsloc_14941', x: 3358, z: 2985, level: 2, land: 'pollnivneach_land_bars', xp: 'pollnivneach_xp_bars' },
            { name: 'tree 2', loc: 'osrsloc_14944', x: 3359, z: 2996, level: 2, land: 'pollnivneach_land_tree2', xp: 'pollnivneach_xp_tree2' },
            { name: 'drying line', loc: 'osrsloc_14945', x: 3363, z: 3000, level: 2, land: 'pollnivneach_land_line', xp: 'pollnivneach_xp_line' },
        ],
    },
    {
        key: 'rellekka', title: 'RELLEKKA', level: 80, lapXp: 7800,
        start: [2625, 3678, 0],
        obstacles: [
            { name: 'rough wall', loc: 'osrsloc_14946', x: 2625, z: 3677, level: 0, land: 'rellekka_land_wall', xp: 'rellekka_xp_wall' },
            { name: 'gap 1', loc: 'osrsloc_14947', x: 2621, z: 3669, level: 3, land: 'rellekka_land_gap1', xp: 'rellekka_xp_gap1' },
            { name: 'tightrope 1', loc: 'osrsloc_14987', x: 2623, z: 3658, level: 3, land: 'rellekka_land_rope1', xp: 'rellekka_xp_rope1' },
            { name: 'gap 2', loc: 'osrsloc_14990', x: 2629, z: 3656, level: 3, land: 'rellekka_land_gap2', xp: 'rellekka_xp_gap2' },
            { name: 'gap 3', loc: 'osrsloc_14991', x: 2643, z: 3654, level: 3, land: 'rellekka_land_gap3', xp: 'rellekka_xp_gap3' },
            { name: 'tightrope 2', loc: 'osrsloc_14992', x: 2647, z: 3663, level: 3, land: 'rellekka_land_rope2', xp: 'rellekka_xp_rope2' },
            { name: 'pile of fish', loc: 'osrsloc_14994', x: 2654, z: 3676, level: 3, land: 'rellekka_land_fish', xp: 'rellekka_xp_fish' },
        ],
    },
    {
        key: 'ardougne', title: 'ARDOUGNE', level: 90, lapXp: 8890,
        start: [2673, 3297, 0],
        obstacles: [
            { name: 'wooden beams', loc: 'osrsloc_15608', x: 2673, z: 3298, level: 0, land: 'ardougne_land_beams', xp: 'ardougne_xp_beams' },
            { name: 'gap 1', loc: 'osrsloc_15609', x: 2670, z: 3310, level: 3, land: 'ardougne_land_gap1', xp: 'ardougne_xp_gap1' },
            { name: 'plank', loc: 'osrsloc_26635', x: 2661, z: 3318, level: 3, land: 'ardougne_land_plank', xp: 'ardougne_xp_plank' },
            { name: 'gap 2', loc: 'osrsloc_15610', x: 2653, z: 3317, level: 3, land: 'ardougne_land_gap2', xp: 'ardougne_xp_gap2' },
            { name: 'gap 3', loc: 'osrsloc_15611', x: 2653, z: 3308, level: 3, land: 'ardougne_land_gap3', xp: 'ardougne_xp_gap3' },
            { name: 'steep roof', loc: 'osrsloc_28912', x: 2654, z: 3300, level: 3, land: 'ardougne_land_roof', xp: 'ardougne_xp_roof' },
            { name: 'gap 4', loc: 'osrsloc_15612', x: 2656, z: 3296, level: 3, land: 'ardougne_land_gap4', xp: 'ardougne_xp_gap4' },
        ],
    },
];

// ---------------------------------------------------------------- the constant files
const K: Record<string, number> = {};
const C: Record<string, [number, number, number]> = {};
for (const course of COURSES) {
    const text = readFileSync(`../content/scripts/skill_agility/configs/${course.key}_course.constant`, 'utf8');
    for (const line of text.split(/\r?\n/)) {
        let m = /^\^(\w+)\s*=\s*(\d+)_(\d+)_(\d+)_(\d+)_(\d+)/.exec(line);
        if (m) { C[m[1]] = [Number(m[3]) * 64 + Number(m[5]), Number(m[4]) * 64 + Number(m[6]), Number(m[2])]; continue; }
        m = /^\^(\w+)\s*=\s*(-?\d+)\s*(?:\/\/.*)?$/.exec(line);
        if (m) K[m[1]] = Number(m[2]);
    }
}

// ~agility_walk moves one tile a tick and spends its diagonal FIRST.
function walk(from: [number, number, number], to: [number, number, number]) {
    const out: [number, number, number][] = [[from[0], from[1], from[2]]];
    let [x, z] = from;
    while (x !== to[0] || z !== to[1]) {
        x += Math.sign(to[0] - x);
        z += Math.sign(to[1] - z);
        out.push([x, z, to[2]]);
    }
    return out;
}

const only = process.argv[2];
for (const course of COURSES) {
    if (only && only !== course.key) continue;
    console.log(`\n================ ${course.title}  (agility ${course.level}, ${course.lapXp / 10} a lap)`);

    console.log('  every obstacle is in the world');
    for (const o of course.obstacles) {
        const found = A.locsNamed(o.loc, o.x - 1, o.z - 1, o.x + 1, o.z + 1, [o.level]);
        check(`    ${o.name.padEnd(14)} ${o.loc} at ${o.x},${o.z} level ${o.level}`, found.length > 0, true);
    }

    console.log('  every landing is somewhere you can stand');
    for (const o of course.obstacles) {
        const c = C[o.land];
        check(`    ${o.name.padEnd(14)} -> ${c ? c.join(',') : o.land + ' MISSING'}`,
            c ? isFlagged(c[2], c[0], c[1], CollisionFlag.WALK_BLOCKED) : 'missing', false);
    }

    const walked = course.obstacles.filter(o => o.walk);
    if (walked.length) {
        console.log('  and a walked crossing stays on the obstacle');
        for (const o of walked) {
            const path = walk(C[o.walk!], C[o.land]);
            const bad = path.filter(t => isFlagged(t[2], t[0], t[1], CollisionFlag.WALK_BLOCKED)).map(t => `${t[0]},${t[1]}`);
            check(`    ${o.name.padEnd(14)} ${path.length} tiles`, bad.length ? bad.join(' ') : 'all clear', 'all clear');
        }
    }

    console.log("  the experience is the wiki's");
    const sum = course.obstacles.reduce((a, o) => a + (K[o.xp] ?? 0), 0);
    check(`    the obstacles add to ${course.lapXp / 10} (${course.lapXp} tenths)`, sum, course.lapXp);
    check("    and the level gate is the wiki's", K[`${course.key}_level`], course.level);

    console.log('  a full lap');
    const p: any = player(`run_${course.key}`, course.start[0], course.start[1], course.start[2]);
    H.setVar(p, 'tutorial', 1000);
    p.baseLevels[16] = course.level; p.levels[16] = course.level;
    const before = p.stats[16];
    const prog = () => p.getVar(VarPlayerType.getByName(`${course.key}_course_progress`)!.id);
    let ok = true;
    let prev: [number, number, number] = course.start;
    for (const o of course.obstacles) {
        p.teleport(prev[0], prev[1], prev[2]);
        H.tick(1);
        try {
            A.op(p, o.x, o.z, o.loc, 1);
        } catch {
            console.log(`    ${o.name}: the loc is not on the level the player arrived at`);
            ok = false;
            break;
        }
        H.tick(40);   // enough for a long walk across a roof, then the obstacle itself
        const at: [number, number, number] = [p.x, p.z, p.level];
        const want = C[o.land];
        if (!want || at.join(',') !== want.join(',')) {
            console.log(`    ${o.name}: ended at ${at.join(',')}, expected ${want ? want.join(',') : '?'}`);
            ok = false;
            break;
        }
        prev = at;
    }
    check('    every obstacle put the player where the constant says', ok, true);
    if (ok) {
        check(`    the lap paid ${course.lapXp / 10}`, p.stats[16] - before, course.lapXp);
        check('    and the counter reset', prog(), 0);
    }
    H.despawn(p);

    console.log('  and it is shut to anyone under the level');
    const q: any = player(`low_${course.key}`, course.start[0], course.start[1], course.start[2]);
    H.setVar(q, 'tutorial', 1000);
    q.baseLevels[16] = course.level - 1; q.levels[16] = course.level - 1;
    const from = H.ifaces.length;
    const first = course.obstacles[0];
    A.op(q, first.x, first.z, first.loc, 1);
    H.tick(4);
    const said = H.ifaces.slice(from).filter(i => i.who === q.username && i.kind === 'text' && i.text).map(i => i.text!);
    check(`    ${course.level - 1} agility is turned away`, A.saw(said, `Agility level of ${course.level}`), true);
    H.despawn(q);
}

console.log(`\n${R.ok} ok, ${R.bad} FAIL`);
process.exit(R.bad ? 1 : 0);
