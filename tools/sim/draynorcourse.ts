// The Draynor Village Rooftop Course, walked end to end on the real engine.
//
// The roofs are OSRS's own, grafted onto Draynor's two squares at level 3 only. Every landing tile
// in draynor_course.constant was read off that graft rather than guessed, and this is what says so:
// each obstacle must put the player exactly where the constant claims, that tile must be somewhere
// they can stand, and a full lap must pay the 120 experience the wiki quotes.
//
// AND EVERY TILE OF THE WAY THERE HAS TO BE ROOF. The first version only looked at where a player
// ENDED UP, so it passed a course on which both tightropes walked a tile to the side of the rope,
// over level-3 tiles that carry no floor at all - the player crossed at street height through the
// air and the lap still paid 120. The path check below reads the roof straight out of the .jm2 and
// fails on any step that is not on it.
//
//   npx tsx tools/sim/draynorcourse.ts
import { readFileSync } from 'fs';

import * as H from './harness.ts';
import * as A from './a1lib.ts';
import { check, R, player } from './a1lib.ts';
import VarPlayerType from '#/cache/config/VarPlayerType.js';
import { CollisionFlag } from '#/engine/routefinder/index.js';
import { isFlagged } from '#/engine/GameMap.js';

await H.boot();

// ---------------------------------------------------------------- the roof, read off the map
// A level-3 tile is drawn only if it carries an overlay or an underlay; the graft gives the course
// deck overlay 175 (roofdeck_greyslate) and the rope and wall spans overlay 161, which is the
// hidden one Old School uses to mark them. Both are floor you are meant to be on. Anything else at
// level 3 is a tile the client never draws, and standing on it is the bug this is here to catch.
const ROOF = new Set<string>();
for (const [reg, mx, mz] of [['48_51', 48, 51], ['48_50', 48, 50]] as [string, number, number][]) {
    const lines = readFileSync(`../content/maps/m${reg}.jm2`, 'utf8').split(/\r?\n/);
    for (const line of lines) {
        if (line === '==== LOC ====') break;
        const m = /^3 (\d+) (\d+): (.*)$/.exec(line);
        if (!m) continue;
        if (!/(^| )o\d+/.test(m[3])) continue;             // no overlay -> not drawn
        ROOF.add(`${mx * 64 + Number(m[1])},${mz * 64 + Number(m[2])}`);
    }
}
console.log(`THE ROOF IS ${ROOF.size} TILES`);
check('  the map was read at all', ROOF.size > 100, true);

// ---------------------------------------------------------------- the crossings, off the constants
// Read start and finish out of draynor_course.constant rather than copying them here, so this
// cannot pass against numbers the game no longer uses. Coordinates are level_mx_mz_lx_lz.
const K: Record<string, [number, number, number]> = {};
for (const line of readFileSync('../content/scripts/skill_agility/configs/draynor_course.constant', 'utf8').split(/\r?\n/)) {
    const m = /^\^(\w+)\s*=\s*(\d+)_(\d+)_(\d+)_(\d+)_(\d+)/.exec(line);
    if (m) K[m[1]] = [Number(m[3]) * 64 + Number(m[5]), Number(m[4]) * 64 + Number(m[6]), Number(m[2])];
}

// ~agility_walk spends its diagonal FIRST and moves one tile a tick. This is that, so the whole
// path a crossing takes can be checked and not only the tile it finishes on.
function walk(from: [number, number, number], to: [number, number, number]): string[] {
    const out = [`${from[0]},${from[1]}`];
    let [x, z] = from;
    while (x !== to[0] || z !== to[1]) {
        x += Math.sign(to[0] - x);
        z += Math.sign(to[1] - z);
        out.push(`${x},${z}`);
    }
    return out;
}

console.log('\nEVERY STEP OF EVERY CROSSING IS ON THE ROOF');
const CROSSINGS: [string, string[]][] = [
    ['tightrope 1', ['draynor_rope1_start', 'draynor_land_rope1']],
    ['tightrope 2', ['draynor_rope2_start', 'draynor_land_rope2']],
    ['narrow wall', ['draynor_narrow_start', 'draynor_narrow_corner', 'draynor_land_narrow']],
    ['gap', ['draynor_gap_start', 'draynor_land_gap']],
];
for (const [name, legs] of CROSSINGS) {
    const path: string[] = [];
    for (let i = 0; i + 1 < legs.length; i++) {
        if (!K[legs[i]] || !K[legs[i + 1]]) { console.log(`  ${name}: ${legs[i]} or ${legs[i + 1]} is not in the constant file`); continue; }
        path.push(...walk(K[legs[i]], K[legs[i + 1]]));
    }
    const bad = path.filter(t => !ROOF.has(t));
    check(`  ${name.padEnd(12)} ${path.length} tiles, all floor`, bad.length ? bad.join(' ') : 'yes', 'yes');
}

type Step = {
    loc: string; x: number; z: number; level: number;
    land: [number, number, number]; xp: number; name: string;
    walked?: boolean;    // crossed on foot, so every tile between must be roof
};
const COURSE: Step[] = [
    { name: 'rough wall',  loc: 'osrsloc_11404', x: 3103, z: 3279, level: 0, land: [3102, 3279, 3], xp: 50 },
    { name: 'tightrope 1', loc: 'osrsloc_11405', x: 3098, z: 3277, level: 3, land: [3089, 3277, 3], xp: 80, walked: true },
    { name: 'tightrope 2', loc: 'osrsloc_11406', x: 3092, z: 3276, level: 3, land: [3092, 3266, 3], xp: 70, walked: true },
    { name: 'narrow wall', loc: 'osrsloc_11430', x: 3089, z: 3264, level: 3, land: [3088, 3261, 3], xp: 70, walked: true },
    { name: 'wall',        loc: 'osrsloc_11630', x: 3088, z: 3256, level: 3, land: [3088, 3255, 3], xp: 100 },
    { name: 'gap',         loc: 'osrsloc_11631', x: 3095, z: 3255, level: 3, land: [3096, 3256, 3], xp: 40, walked: true },
    { name: 'crate',       loc: 'osrsloc_11632', x: 3102, z: 3261, level: 3, land: [3103, 3261, 0], xp: 790 },
];

console.log('\nEVERY LANDING IS SOMEWHERE YOU CAN STAND');
for (const s of COURSE) {
    const [lx, lz, ll] = s.land;
    check(`  ${s.name.padEnd(12)} lands on ${lx},${lz} level ${ll}`,
        isFlagged(ll, lx, lz, CollisionFlag.WALK_BLOCKED), false);
}

console.log('\nAND THE OBSTACLE IS THERE TO CLICK');
for (const s of COURSE) {
    const found = A.locsNamed(s.loc, s.x - 1, s.z - 1, s.x + 1, s.z + 1, [s.level]);
    check(`  ${s.name.padEnd(12)} ${s.loc} at ${s.x},${s.z}`, found.length > 0, true);
}

console.log('\nA FULL LAP');
const p: any = player('roof', 3103, 3280);
H.setVar(p, 'tutorial', 1000);
const agil = () => p.stats[16];                       // agility
const prog = () => p.getVar(VarPlayerType.getByName('draynor_course_progress')!.id);
const before = agil();
let ok = true;
let offRoof: string[] = [];
let prev: [number, number, number] = [3103, 3278, 0];   // the street, south of the rough wall
for (const s of COURSE) {
    // STAND BESIDE THE OBSTACLE, not on the tile it will throw you to - the first run of this put
    // the player on the LANDING before each click, so every obstacle after the first was clicked
    // from the far side of a roof and never fired. Only the rough wall paid out, which is exactly
    // what 5 experience for a 120 experience lap looks like.
    p.teleport(prev[0], prev[1], prev[2]);
    H.tick(1);
    A.op(p, s.x, s.z, s.loc, 1);
    // Sample WHERE THE PLAYER IS every tick of the crossing, not just at the end. A crossing is one
    // teleport per tick, so this is the whole path.
    const seen: string[] = [];
    for (let i = 0; i < 16; i++) {
        H.tick(1);
        if (p.level === 3) seen.push(`${p.x},${p.z}`);
    }
    if (s.walked) {
        for (const t of seen) {
            if (!ROOF.has(t) && !offRoof.includes(`${s.name}: ${t}`)) offRoof.push(`${s.name}: ${t}`);
        }
    }
    const at = [p.x, p.z, p.level].join(',');
    const want = s.land.join(',');
    if (at !== want) { console.log(`  ${s.name}: ended at ${at}, expected ${want}`); ok = false; }
    prev = [p.x, p.z, p.level];
}
check('  every obstacle put the player where the constant says', ok, true);
if (offRoof.length) console.log('  stepped on nothing: ' + offRoof.join('; '));
check('  and no crossing stepped off the roof', offRoof.length, 0);
// 1200 TENTHS, WHICH IS 120 EXPERIENCE. stat_advance takes xp * 10 and these constants
// were written as whole points, so a lap paid 12 - a tenth of the wiki's rate.
check('  the lap paid 120 experience (1200 tenths)', agil() - before, 1200);
check('  and the progress counter reset for the next lap', prog(), 0);

// ---------------------------------------------------------------- the wiki's numbers
// 5, 8, 7, 7, 10, 4, 79. The crate's 79 IS the lap bonus; there is no separate award, which is why
// the seven have to add to 120 exactly.
console.log('\nTHE EXPERIENCE IS THE WIKI\'S');
check('  the seven obstacles add to a lap', COURSE.reduce((a, s) => a + s.xp, 0), 1200);

console.log(`\n${R.ok} ok, ${R.bad} FAIL`);
process.exit(R.bad ? 1 : 0);
