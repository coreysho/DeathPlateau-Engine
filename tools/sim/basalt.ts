// THE BASALT CAUSEWAY out to the lighthouse, and what slipping on it is supposed to cost.
//
//   npx tsx tools/sim/basalt.ts
//
// Reported from the game as "too big of click box for rocks and the rock jumping needs looked at".
// The jumping half was real and this is the check for it: ~horror_basalt_jump moved the player onto
// the target rock BEFORE rolling against Agility, so a failed jump printed "you fall into the
// water", took the damage, and left the player standing safely on the rock anyway. The causeway was
// free, with a toll.
//
// The wiki's Lighthouse page is what a failure should do: "It is possible to slip on the rocks,
// which results in the player falling into the water, being swept back to shore, and taking up to
// 10 damage."
import * as H from './harness.js';
import * as A from './a1lib.js';
import { check, R, player } from './a1lib.js';
import { World, LocType } from './a1lib.js';
import { PlayerStat } from '#/engine/entity/PlayerStat.js';

await H.boot();
H.loginOrder();

// The two chains, as the map places them. The gap between rock 4 and rock 5 is not a jump: the
// causeway snakes between them on walkable tiles, which the 4-tile guard is right to refuse.
const CHAIN1: [string, number, number][] = [
    ['horror_jumping_spot1', 2522, 3595],
    ['horror_jumping_spot2', 2522, 3597],
    ['horror_jumping_spot3', 2522, 3600],
    ['horror_jumping_spot4', 2522, 3602]
];
const CHAIN2: [string, number, number][] = [
    ['horror_jumping_spot5', 2518, 3611],
    ['horror_jumping_spot6', 2516, 3611],
    ['horror_jumping_spot7', 2514, 3613],
    ['horror_jumping_spot8', 2514, 3615],
    ['horror_jumping_spot9', 2514, 3617],
    ['horror_jumping_spot10', 2514, 3619]
];
const SHORE: [number, number] = [2523, 3594];
const SAFE = new Set(['horror_jumping_spot3', 'horror_jumping_spot7', 'horror_jumping_spot8']);

console.log('ALL TEN ROCKS ARE WHERE THE MAP PUTS THEM, ON LEVEL 0');
// level 0 and not plane 1: the script's own comment said the causeway was on plane 1 and that
// walking there from plane 0 would never reach it. Every one of them is on plane 0.
for (const [name, x, z] of [...CHAIN1, ...CHAIN2]) {
    const loc = World.getLoc(x, z, 0, LocType.getId(name));
    check(`  ${name.replace('horror_jumping_spot', 'rock ').padEnd(8)} at ${x},${z}`, loc !== null, true);
}

console.log('\nTHE CAUSEWAY CANNOT SIMPLY BE WALKED');
{
    // if it could, the obstacle would be decoration - the rocks are blockwalk=no, so this is worth
    // asserting rather than assuming
    const p: any = player('basaltwalk', SHORE[0], SHORE[1], 0);
    H.maxOut(p);
    H.tick(2);
    H.walkTo(p, 2514, 3619);
    for (let t = 0; t < 60; t++) H.tick(1);
    check('  walking from the beach to the far shore gets nowhere near it', Math.abs(p.z - 3619) > 10, true);
    H.despawn(p);
}

console.log('\nA JUMP THAT SUCCEEDS LANDS ON THE ROCK');
{
    // agility 99 and only the unfailable rocks, so this measures the success path alone
    const p: any = player('basaltok', SHORE[0], SHORE[1], 0);
    H.maxOut(p);
    p.setLevel(PlayerStat.AGILITY, 99);
    H.tick(2);
    for (const [name, x, z] of CHAIN1) {
        for (let tries = 0; tries < 30 && !(p.x === x && p.z === z); tries++) {
            H.opLoc(p, x, z, name, 1);
            for (let t = 0; t < 20; t++) H.tick(1);
            if (p.x === SHORE[0] && p.z === SHORE[1]) continue; // slipped, swept back - try again
        }
        check(`  ${name.replace('horror_jumping_spot', 'rock ')} can be reached`, [p.x, p.z], [x, z]);
    }
    H.despawn(p);
}

console.log('\nAND A JUMP THAT FAILS DOES NOT');
{
    // Agility 1 on a failable rock, over and over: every slip has to end on the beach with the
    // player hurt, and never on the rock. One run of this would prove nothing - the roll is random -
    // so it counts both outcomes and checks the shape of each.
    let slipped = 0,
        landed = 0,
        onRockAfterSlip = 0,
        unhurt = 0;
    for (let i = 0; i < 40; i++) {
        const p: any = player('basaltfail' + i, SHORE[0], SHORE[1], 0);
        H.maxOut(p);
        p.setLevel(PlayerStat.AGILITY, 1);
        H.tick(2);
        const hp0 = p.levels[PlayerStat.HITPOINTS];
        const m = A.mark();
        H.opLoc(p, 2522, 3595, 'horror_jumping_spot1', 1);
        for (let t = 0; t < 25; t++) H.tick(1);
        const said = A.mesSince(p, m);
        if (said.some(s => /slip on the wet rock/.test(s))) {
            slipped++;
            if (p.x === 2522 && p.z === 3595) onRockAfterSlip++;
            if (p.levels[PlayerStat.HITPOINTS] >= hp0) unhurt++;
            if (!said.some(s => /sweeps you back to the shore/.test(s))) onRockAfterSlip++;
        } else if (p.x === 2522 && p.z === 3595) {
            landed++;
        }
        H.despawn(p);
    }
    check('  at Agility 1 it fails sometimes and succeeds sometimes', [slipped > 0, landed > 0], [true, true]);
    check('  and a slip never leaves you on the rock you were aiming at', onRockAfterSlip, 0);
    check('  and always costs hitpoints', unhurt, 0);
    console.log(`    (${slipped} slips and ${landed} landings in 40 attempts at Agility 1)`);
}

console.log('\nTHE UNFAILABLE ROCKS REALLY ARE UNFAILABLE');
{
    // three of the ten are marked $safe in the script; at Agility 1 they must never slip
    for (const name of [...CHAIN1, ...CHAIN2].filter(r => SAFE.has(r[0]))) {
        const [n, x, z] = name;
        let slips = 0;
        for (let i = 0; i < 12; i++) {
            const p: any = player(`basaltsafe${n}_${i}`, x, z - 2, 0);
            H.maxOut(p);
            p.setLevel(PlayerStat.AGILITY, 1);
            p.teleport(x, z - 2, 0);
            H.tick(2);
            const m = A.mark();
            H.opLoc(p, x, z, n, 1);
            for (let t = 0; t < 20; t++) H.tick(1);
            if (A.mesSince(p, m).some(s => /slip on the wet rock/.test(s))) slips++;
            H.despawn(p);
        }
        check(`  ${n.replace('horror_jumping_spot', 'rock ')} never slips, twelve tries at Agility 1`, slips, 0);
    }
}

console.log(`\n${R.ok} ok, ${R.bad} FAIL`);
process.exit(R.bad ? 1 : 0);
