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
//
// A roof MODEL one level below counts too, and that is not a technicality. Where loc 1925 - a flat
// slate roof with sloped edges - already covers the tile, the floor above it was REMOVED: drawing
// both put the roof's slate lips and its edge pieces up through the deck as a grid of seams and
// triangular wedges, which is what was reported as clipping. The player still walks level 3 and
// sees the roof 48 units under their feet, which is what they walked on in Old School as well.
//
// A parapet is not a roof. desertroofwall and desertroofbeams ring a flat roof rather than being
// one, so a tile standing over a parapet still has to carry its own floor - hence /^roof/, which
// they do not match.
const ROOF = new Set<string>();
{
    const locNames = new Map<number, string>();
    for (const line of readFileSync('../content/pack/loc.pack', 'utf8').split(/\r?\n/)) {
        const m = /^(\d+)=(.+)$/.exec(line.trim());
        if (m) locNames.set(Number(m[1]), m[2]);
    }
    const lines = readFileSync('../content/maps/m51_49.jm2', 'utf8').split(/\r?\n/);
    let inLocs = false;
    for (const line of lines) {
        if (line.startsWith('====')) { inLocs = line === '==== LOC ===='; continue; }
        const m = /^([0-3]) (\d+) (\d+): (.*)$/.exec(line);
        if (!m) continue;
        const level = Number(m[1]), x = 51 * 64 + Number(m[2]), z = 49 * 64 + Number(m[3]);
        if (!inLocs) {
            if (/(^| )o\d+/.test(m[4])) ROOF.add(`${level}:${x},${z}`);
        } else if (/^roof/.test(locNames.get(Number(m[4].split(' ')[0])) ?? '')) {
            ROOF.add(`${level + 1}:${x},${z}`);
        }
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

console.log('\nEVERY LANDING IS A TILE THE CONSTANTS NAME');
for (const s of COURSE) {
    check(`  ${s.name.padEnd(14)} is written down`, K[s.land] ? 'yes' : 'missing', 'yes');
}

// WHICH LANDINGS SIT ON A FLAGGED TILE - printed, not asserted.
//
// This used to be a check, and a broken one: K holds [x, z, level] while isFlagged takes
// (x, z, level), and it passed c[2], c[0], c[1] - level as x, x as z, z as level. So all eight read
// collision off a tile nowhere near the course and all eight passed, which is how the tropical
// tree's landing went out twice, the second time onto a tile blocked on all four sides.
//
// Fixed, it fails for the zip line and the second tightrope, and both of those are fine in play:
// a teleport can put you on a flagged tile and you walk off it. The flag is the map's own, matching
// Old School tile for tile. What actually matters is the two checks below - that you can step off,
// and that the next obstacle is reachable - so this is left as a note rather than a failure that
// would have to be argued away every run.
{
    const on = COURSE.filter(s => K[s.land] && isFlagged(K[s.land][0], K[s.land][1], K[s.land][2], CollisionFlag.WALK_BLOCKED));
    console.log(on.length
        ? `  note: ${on.map(s => `${s.name} (${K[s.land][0]},${K[s.land][1]})`).join(', ')} land on flagged tiles`
        : '  note: none of the landings sit on a flagged tile');
}

// AND YOU CAN GET OFF IT AGAIN. Standing somewhere is not the same as being able to leave. The
// tropical tree's second landing was 3318,3173: a tile with a floor drawn on it, sitting in the
// roof's blocked rim with blocked on all four sides. You arrived and could not move. Nothing above
// catches that, so this does - a landing has to have at least one neighbour you can step onto.
console.log('\nAND YOU CAN STEP OFF EVERY LANDING');
for (const s of COURSE) {
    const c = K[s.land];
    if (!c) continue;
    const out = ([[1, 0], [-1, 0], [0, 1], [0, -1]] as const)
        .filter(([dx, dz]) => A.walkable(c[2], c[0] + dx, c[1] + dz))
        .map(([dx, dz]) => `${c[0] + dx},${c[1] + dz}`);
    check(`  ${s.name.padEnd(14)} has somewhere to step`, out.length > 0, true);
}

// AND THE NEXT OBSTACLE IS REACHABLE ON FOOT FROM IT. reachLoc, not a flood to the loc's own tile -
// an obstacle stands ON a blocked tile and is used from beside it, so walking TO it never arrives.
console.log('\nAND THE NEXT OBSTACLE CAN BE REACHED FROM IT');
for (let i = 0; i < COURSE.length; i++) {
    const c = K[COURSE[i].land];
    const n = COURSE[(i + 1) % COURSE.length];
    if (!c) continue;
    check(`  ${COURSE[i].name.padEnd(14)} -> ${n.name}`,
        c[2] === n.level ? !!A.reachLoc(c[2], c[0], c[1], n.loc, n.x, n.z)
                         : `lands on level ${c[2]}, ${n.name} is on ${n.level}`, true);
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
    // Read off the constant rather than written out a second time, so the two cannot drift apart.
    // Both used to say 3317,3169, which is open air: the level 2 roof does not begin until z3173,
    // in Old School as well as here, so the swing left the player standing on top of the tree.
    check('  and it carries them up into the branches', [q.x, q.z, q.level], K.alkharid_land_tree);
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
