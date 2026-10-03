// The Draynor Village Rooftop Course, walked end to end on the real engine.
//
// The roofs are OSRS's own, grafted onto Draynor's two squares at level 3 only. Every landing tile
// in draynor_course.constant was read off that graft rather than guessed, and this is what says so:
// each obstacle must put the player exactly where the constant claims, that tile must be somewhere
// they can stand, and a full lap must pay the 120 experience the wiki quotes.
//
//   npx tsx tools/sim/draynorcourse.ts
import * as H from './harness.ts';
import * as A from './a1lib.ts';
import { check, R, player } from './a1lib.ts';
import VarPlayerType from '#/cache/config/VarPlayerType.js';
import { CollisionFlag } from '#/engine/routefinder/index.js';
import { isFlagged } from '#/engine/GameMap.js';

await H.boot();

type Step = { loc: string; x: number; z: number; level: number; land: [number, number, number]; xp: number; name: string };
const COURSE: Step[] = [
    { name: 'rough wall',  loc: 'osrsloc_11404', x: 3103, z: 3279, level: 0, land: [3102, 3279, 3], xp: 5 },
    { name: 'tightrope 1', loc: 'osrsloc_11405', x: 3098, z: 3277, level: 3, land: [3091, 3276, 3], xp: 8 },
    { name: 'tightrope 2', loc: 'osrsloc_11406', x: 3092, z: 3276, level: 3, land: [3093, 3266, 3], xp: 7 },
    { name: 'narrow wall', loc: 'osrsloc_11430', x: 3089, z: 3264, level: 3, land: [3088, 3261, 3], xp: 7 },
    { name: 'wall',        loc: 'osrsloc_11630', x: 3088, z: 3256, level: 3, land: [3088, 3255, 3], xp: 10 },
    { name: 'gap',         loc: 'osrsloc_11631', x: 3095, z: 3255, level: 3, land: [3096, 3256, 3], xp: 4 },
    { name: 'crate',       loc: 'osrsloc_11632', x: 3102, z: 3261, level: 3, land: [3103, 3261, 0], xp: 79 },
];

console.log('EVERY LANDING IS SOMEWHERE YOU CAN STAND');
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
let prev: [number, number, number] = [3103, 3278, 0];   // the street, south of the rough wall
for (const s of COURSE) {
    // STAND BESIDE THE OBSTACLE, not on the tile it will throw you to - the first run of this put
    // the player on the LANDING before each click, so every obstacle after the first was clicked
    // from the far side of a roof and never fired. Only the rough wall paid out, which is exactly
    // what 5 experience for a 120 experience lap looks like.
    p.teleport(prev[0], prev[1], prev[2]);
    H.tick(1);
    A.op(p, s.x, s.z, s.loc, 1);
    H.tick(3);
    const at = [p.x, p.z, p.level].join(',');
    const want = s.land.join(',');
    if (at !== want) { console.log(`  ${s.name}: ended at ${at}, expected ${want}`); ok = false; }
    prev = [p.x, p.z, p.level];
}
check('  every obstacle put the player where the constant says', ok, true);
check('  the lap paid 120 experience', agil() - before, 120);
check('  and the progress counter reset for the next lap', prog(), 0);

console.log(`\n${R.ok} ok, ${R.bad} FAIL`);
process.exit(R.bad ? 1 : 0);
