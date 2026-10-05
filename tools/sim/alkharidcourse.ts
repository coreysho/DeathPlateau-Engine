// The Al Kharid Rooftop Course, walked end to end on the real engine.
//
// Agility 20, eight obstacles, 216 experience a lap, and it does not stay on one floor: the zip
// line drops two levels, the tree swings back up one, the beams return to the top and the gap puts
// you in the street. Three of the eight are swings rather than walks.
//
// WHAT THIS IS FOR. Draynor shipped with both tightropes crossing the row NEXT to the rope, over
// tiles level 3 does not define, and the sim passed because it only looked at where the player
// ENDED UP. So the walked crossings here are replayed tile by tile against the roof read out of
// the .jm2, and a step onto anything that is not floor fails.
//
//   npx tsx tools/sim/alkharidcourse.ts
import { readFileSync } from 'fs';

import * as H from './harness.ts';
import * as A from './a1lib.ts';
import { check, R, player } from './a1lib.ts';
import VarPlayerType from '#/cache/config/VarPlayerType.js';
import { CollisionFlag } from '#/engine/routefinder/index.js';
import { isFlagged } from '#/engine/GameMap.js';

await H.boot();

// ---------------------------------------------------------------- the roof, read off the map
// A tile is floor if it carries an overlay. The course deck is greyroof; the spans under a rope
// are overlay 161, which draws as nothing here but is still floor you are meant to be on.
const ROOF = new Set<string>();
{
    const lines = readFileSync('../content/maps/m51_49.jm2', 'utf8').split(/\r?\n/);
    for (const line of lines) {
        if (line === '==== LOC ====') break;
        const m = /^([0-3]) (\d+) (\d+): (.*)$/.exec(line);
        if (!m || !/(^| )o\d+/.test(m[4])) continue;
        ROOF.add(`${m[1]}:${51 * 64 + Number(m[2])},${49 * 64 + Number(m[3])}`);
    }
}
console.log(`THE COURSE'S FLOORS ARE ${ROOF.size} TILES`);
check('  the map was read at all', ROOF.size > 1000, true);

// ---------------------------------------------------------------- the constants, as written
const K: Record<string, [number, number, number]> = {};
for (const line of readFileSync('../content/scripts/skill_agility/configs/alkharid_course.constant', 'utf8').split(/\r?\n/)) {
    const m = /^\^(\w+)\s*=\s*(\d+)_(\d+)_(\d+)_(\d+)_(\d+)/.exec(line);
    if (m) K[m[1]] = [Number(m[3]) * 64 + Number(m[5]), Number(m[4]) * 64 + Number(m[6]), Number(m[2])];
}

type Step = { name: string; loc: string; x: number; z: number; level: number; land: string; xp: number; walk?: string };
const COURSE: Step[] = [
    { name: 'rough wall',   loc: 'osrsloc_11633', x: 3273, z: 3195, level: 0, land: 'alkharid_land_wall',  xp: 120 },
    { name: 'tightrope 1',  loc: 'osrsloc_14398', x: 3272, z: 3181, level: 3, land: 'alkharid_land_rope1', xp: 360, walk: 'alkharid_rope1_start' },
    { name: 'cable',        loc: 'osrsloc_14402', x: 3269, z: 3166, level: 3, land: 'alkharid_land_cable', xp: 480 },
    { name: 'zip line',     loc: 'osrsloc_14403', x: 3302, z: 3163, level: 3, land: 'alkharid_land_zip',   xp: 480 },
    { name: 'tropical tree',loc: 'osrsloc_14404', x: 3318, z: 3166, level: 1, land: 'alkharid_land_tree',  xp: 120 },
    { name: 'beams',        loc: 'osrsloc_11634', x: 3316, z: 3179, level: 2, land: 'alkharid_land_beams', xp: 60 },
    { name: 'tightrope 2',  loc: 'osrsloc_14409', x: 3313, z: 3186, level: 3, land: 'alkharid_land_rope2', xp: 180, walk: 'alkharid_rope2_start' },
    { name: 'gap',          loc: 'osrsloc_14399', x: 3300, z: 3193, level: 3, land: 'alkharid_land_gap',   xp: 360 },
];

console.log('\nEVERY OBSTACLE IS THERE TO CLICK');
for (const s of COURSE) {
    const found = A.locsNamed(s.loc, s.x - 1, s.z - 1, s.x + 1, s.z + 1, [s.level]);
    check(`  ${s.name.padEnd(14)} ${s.loc} at ${s.x},${s.z} level ${s.level}`, found.length > 0, true);
}

console.log('\nAND EVERY LANDING IS SOMEWHERE YOU CAN STAND');
for (const s of COURSE) {
    const c = K[s.land];
    check(`  ${s.name.padEnd(14)} lands on ${c?.[0]},${c?.[1]} level ${c?.[2]}`,
        c ? isFlagged(c[2], c[0], c[1], CollisionFlag.WALK_BLOCKED) : 'missing', false);
}

console.log('\nTHE WALKED CROSSINGS STAY ON THE ROPE');
// ~agility_walk spends its diagonal FIRST and moves one tile a tick. This is that.
function walk(from: [number, number, number], to: [number, number, number]): string[] {
    const out = [`${from[2]}:${from[0]},${from[1]}`];
    let [x, z] = from;
    while (x !== to[0] || z !== to[1]) {
        x += Math.sign(to[0] - x);
        z += Math.sign(to[1] - z);
        out.push(`${to[2]}:${x},${z}`);
    }
    return out;
}
for (const s of COURSE) {
    if (!s.walk) continue;
    const path = walk(K[s.walk], K[s.land]);
    const bad = path.filter(t => !ROOF.has(t));
    check(`  ${s.name.padEnd(14)} ${path.length} tiles, all floor`, bad.length ? bad.join(' ') : 'yes', 'yes');
}

// ---------------------------------------------------------------- the tropical tree
// THIS USED TO BE PINNED AS UNFIXABLE. The zip line lands the player in a pocket six tiles across
// - 3313 to 3318, z 3160 to 3165, every tile north of 3165 blocked - so 3318,3165 is the only tile
// they can ever stand on, and the engine refused that side with "I can't reach that!". Four things
// had been tried on the TREE: forceapproach=south, length 1, blockwalk=no, and moving the loc a
// tile north. None of them was the problem.
//
// What closed that face was a different loc on the same tile. osrsloc_26587 is a roof edge, and it
// sits at 3318,3166 as a shape-0 wall on the SOUTH face - between the tree and the one tile a
// player can reach. Old School carries it there too, with opcode 27, which this build's importer
// has no equivalent for and dropped, so ours came out solid and theirs is not. blockwalk=no on the
// edge, and the swing fires. The level-1 terrain was compared tile by tile against Old School's
// first and is identical, which is what ruled the map out.
console.log('\nTHE TROPICAL TREE');
{
    const q: any = player('stuck', 3318, 3165, 1);
    q.baseLevels[16] = 20; q.levels[16] = 20;
    H.setVar(q, 'tutorial', 1000);
    H.tick(1);
    const from = H.mesgs.length;
    A.op(q, 3318, 3166, 'osrsloc_14404', 1);
    H.tick(8);
    const said = H.mesgs.slice(from).filter(m => m.who === q.username).map(m => m.text);
    check('  the swing fires from the only tile a player can stand on', A.saw(said, "can't reach"), false);
    check('  and it carries them up into the branches', [q.x, q.z, q.level], [3317, 3169, 2]);
    H.despawn(q);
}

console.log('\nA LAP, AS FAR AS THE TREE');
const p: any = player('kharid', 3273, 3196);
H.setVar(p, 'tutorial', 1000);
p.baseLevels[16] = 20; p.levels[16] = 20;              // agility 20, the course's own requirement
const agil = () => p.stats[16];
const prog = () => p.getVar(VarPlayerType.getByName('alkharid_course_progress')!.id);
const before = agil();
let ok = true;
let prev: [number, number, number] = [3273, 3196, 0];
for (const s of COURSE.slice(0, 4)) {
    p.teleport(prev[0], prev[1], prev[2]);
    H.tick(1);
    A.op(p, s.x, s.z, s.loc, 1);
    H.tick(14);
    const at = [p.x, p.z, p.level].join(',');
    const want = K[s.land].join(',');
    if (at !== want) { console.log(`  ${s.name}: ended at ${at}, expected ${want}`); ok = false; }
    prev = [p.x, p.z, p.level];
}
check('  the first four put the player where the constant says', ok, true);
// tenths of a point: stat_advance takes xp * 10
check('  and paid 12 + 36 + 48 + 48 experience', agil() - before, 1440);
check('  with the lap counter four in', prog(), 4);

console.log('\nAND IT IS SHUT TO ANYONE UNDER 20');
{
    const q: any = player('novice', 3273, 3196);
    H.setVar(q, 'tutorial', 1000);
    q.baseLevels[16] = 19; q.levels[16] = 19;
    const from = H.ifaces.length;
    A.op(q, 3273, 3195, 'osrsloc_11633', 1);
    H.tick(3);
    const said = H.ifaces.slice(from).filter(i => i.who === q.username && i.kind === 'text' && i.text).map(i => i.text!);
    check('  19 agility is told so and goes nowhere', [A.saw(said, 'Agility level of 20'), q.level], [true, 0]);
    H.despawn(q);
}

console.log('\nTHE EXPERIENCE IS THE WIKI\'S');
check('  the eight obstacles add to a lap (216 experience)', COURSE.reduce((a, s) => a + s.xp, 0), 2160);

console.log(`\n${R.ok} ok, ${R.bad} FAIL`);
process.exit(R.bad ? 1 : 0);
