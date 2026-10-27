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
// Five of the ten cannot be failed: the centremost rock of each chain, plus BOTH ENDS, which are
// not rocks at all - the south beach and the north shore, where the examine is "Safety!".
const SAFE = new Set(['horror_jumping_spot1', 'horror_jumping_spot3', 'horror_jumping_spot7', 'horror_jumping_spot8', 'horror_jumping_spot10']);
const SHORES: [string, number, number, string, string][] = [
    ['horror_jumping_spot1', 2522, 3595, 'Beach', 'Safety!'],
    ['horror_jumping_spot10', 2514, 3619, 'Rocky shore', 'It looks barren']
];

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
    // RESTART THE WHOLE CHAIN ON A SLIP, do not retry the rock. A slip sweeps the player back to
    // the beach, and from there the next rock up the chain is further than the four-tile guard
    // allows - so a loop that retries one rock from wherever it finds the player can never
    // recover. Even at Agility 99 the roll is 201 of 256, so slips are expected: this takes the
    // first clean run of the four and asserts that one happened.
    let reached: string[] = [];
    for (let attempt = 0; attempt < 25 && reached.length < CHAIN1.length; attempt++) {
        const p: any = player('basaltok' + attempt, SHORE[0], SHORE[1], 0);
        H.maxOut(p);
        p.setLevel(PlayerStat.AGILITY, 99);
        H.tick(2);
        const got: string[] = [];
        for (const [name, x, z] of CHAIN1) {
            H.opLoc(p, x, z, name, 1);
            for (let t = 0; t < 20; t++) H.tick(1);
            if (p.x !== x || p.z !== z) break; // slipped; this run is over
            got.push(name);
        }
        if (got.length > reached.length) reached = got;
        H.despawn(p);
    }
    check(
        '  the whole first chain can be crossed in one run',
        reached.map(n => n.replace('horror_jumping_spot', 'rock ')),
        CHAIN1.map(c => c[0].replace('horror_jumping_spot', 'rock '))
    );
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
        // rock 2 and not rock 1: rock 1 is the beach, which is a safe landing and never slips.
        // From the beach tile it is four tiles away, which is exactly what the guard allows.
        H.opLoc(p, 2522, 3597, 'horror_jumping_spot2', 1);
        for (let t = 0; t < 25; t++) H.tick(1);
        const said = A.mesSince(p, m);
        if (said.some(s => /slip on the wet rock/.test(s))) {
            slipped++;
            if (p.x === 2522 && p.z === 3597) onRockAfterSlip++;
            if (p.levels[PlayerStat.HITPOINTS] >= hp0) unhurt++;
            if (!said.some(s => /sweeps you back to the shore/.test(s))) onRockAfterSlip++;
        } else if (p.x === 2522 && p.z === 3597) {
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

console.log('\nAND THE TWO ENDS ARE NOT ROCKS, WHICH IS WHAT THE CLICK BOX COMPLAINT WAS');
{
    // Both ends sit on ground a player WALKS on - the sand you arrive at and the island itself -
    // and both carried "Jump-across Basalt rock", so a rock's option was on top of a tile you
    // wanted to walk onto. Old School has them as a Beach and a Rocky shore, Jump-to, with their
    // own examines. They are the landing you jump TO off the last rock.
    for (const [name, x, z, label, examine] of SHORES) {
        const t = LocType.get(LocType.getId(name));
        check(`  ${x},${z} is "${label}", not a basalt rock`, [t.name, t.desc, t.op?.[0]], [label, examine, 'Jump-to']);
        // ...and it is ground: reachable on foot, unlike every rock between them.
        const nb = [
            [1, 0],
            [-1, 0],
            [0, 1],
            [0, -1]
        ].filter(([dx, dz]) => A.walkable(0, x + dx, z + dz)).length;
        check('    with walkable ground around it', nb >= 2, true);
    }
    // the eight between them are still rocks, and still say so
    for (const [name] of [...CHAIN1, ...CHAIN2].filter(r => !SHORES.some(s2 => s2[0] === r[0]))) {
        const t = LocType.get(LocType.getId(name));
        check(`  ${name.replace('horror_jumping_spot', 'rock ')} is still a Basalt rock`, [t.name, t.op?.[0]], ['Basalt rock', 'Jump-across']);
    }
    // ...and landing on one of the ends says you are off the causeway rather than on another rock
    const p: any = player('basaltshore', 2522, 3593, 0);
    H.maxOut(p);
    p.setLevel(PlayerStat.AGILITY, 1);
    H.tick(2);
    const m = A.mark();
    H.opLoc(p, 2522, 3595, 'horror_jumping_spot1', 1);
    for (let t = 0; t < 20; t++) H.tick(1);
    check(
        '  jumping to the beach says solid ground',
        A.mesSince(p, m).some(s => s.includes('solid ground')),
        true
    );
    check('    and lands there', [p.x, p.z], [2522, 3595]);
    H.despawn(p);
}

console.log('\nAND THE CLICK AREA IS ONE TILE, WHICH IS THE ONE THE CACHE SHIPS');
{
    // The other half of the report was "too big of click box for rocks". Measured, not argued:
    //
    //   - all ten locs carry ONE model, horror_jumping_spot1_8. `_8` is the suffix for shape 10,
    //     centrepiece_straight, which is the shape rev 474 and Old School both give loc 4551-4558.
    //   - that model is 41 bytes: four vertices, two triangles, x and z at -64 and +64, every y 0.
    //     A flat 128x128 square lying on the ground - one tile, no height. It is byte-identical to
    //     474's model 4556, which Old School also still uses for these.
    //   - the rock you can SEE is not the loc at all. It is the map's own terrain; the loc is an
    //     invisible marker laid over it, which is why the model is a black flat square.
    //   - the client picks locs triangle by triangle (Model.method385). The bounds-only shortcut
    //     next to it is behind field1227, and that is set in NpcType, ObjType, ClientNpc and
    //     ClientPlayer only - never for a loc. So the clickable area IS those two triangles.
    //
    // Two triangles covering one tile is therefore the real game's click area, not a fault in the
    // import, and there is nothing in the cache to replace it with. What content could still do is
    // shrink it - resizex/resizez below 128 scale the quad and the click area with it - but that
    // would be a deliberate difference from Old School rather than a fix, so it is not done here.
    // These checks hold the pieces that decision rests on.
    const first = LocType.getId('horror_jumping_spot1');
    for (const [name] of [...CHAIN1, ...CHAIN2]) {
        const t: any = LocType.get(LocType.getId(name));
        const firstT: any = LocType.get(first);
        // shapes stays null when every model is shape 10 - that is the loc config's "1 model, no
        // shape" opcode, and LocType.ts reads a null shapes as 10 in exactly the same place.
        check(`  ${name.replace('horror_jumping_spot', 'rock ').padEnd(8)} is one model on shape 10`, [t.models?.length, t.shapes === null ? 10 : t.shapes?.[0]], [1, 10]);
        check('    the same model as the beach, so there is one click area and not ten', t.models?.[0], firstT.models?.[0]);
        check('    one tile, unscaled, unmoved', [t.width, t.length, t.resizex, t.resizey, t.resizez, t.offsetx, t.offsety, t.offsetz], [1, 1, 128, 128, 128, 0, 0, 0]);
    }
}

console.log(`\n${R.ok} ok, ${R.bad} FAIL`);
process.exit(R.bad ? 1 : 0);
