// THE GOD WARS BATTLEFIELD'S THREE DEAD CLICKS.
//
//   npx tsx tools/sim/gwdsurface.ts
//
// Reported from a1lib's own deadLocOps sweep of the surface: two "Rocky handholds" and an "Old
// fire pit", all three carrying an option with nothing behind it. Two of them are one thing - Old
// School's 60 Agility shortcut down the cliff into level 32 Wilderness, one way - and the third
// is a Fire of Unseasonal Warmth, which wants a 2018 quest, a mine and three salts this build does
// not have, so it answers with the true half of the game's own refusal instead.
//
// What a sim can prove here and a reader cannot: that the tile the climb lands on is WALKABLE and
// joined to the Wilderness rather than a hole in the map, and that the sweep that found the dead
// clicks now finds none.
import * as H from './harness.js';
import * as A from './a1lib.js';
import { check, R, player } from './a1lib.js';
import { PlayerStat } from '#/engine/entity/PlayerStat.js';

await H.boot();
H.loginOrder();

// The two handholds and the pit, where gwd_surface.loc puts them.
const HANDHOLD_A = [2928, 3758] as const;
const HANDHOLD_B = [2928, 3759] as const;
const PIT = [2906, 3735] as const;
// The battlefield tile you stand on to reach them, and where the climb comes out.
const STAND = [2929, 3758] as const;
const LANDING = [2948, 3768] as const;

console.log('ALL THREE LOCS ARE STILL WHERE THEY WERE PLACED');
{
    check('  Rocky handholds at 2928,3758', A.locsNamed('osrsloc_26400', 2920, 3750, 2940, 3765), [[...HANDHOLD_A, 0]]);
    check('  Rocky handholds at 2928,3759', A.locsNamed('osrsloc_26402', 2920, 3750, 2940, 3765), [[...HANDHOLD_B, 0]]);
    check('  Old fire pit at 2906,3735', A.locsNamed('osrsloc_33317', 2895, 3725, 2915, 3745), [[...PIT, 0]]);
}

console.log('\nTHE LANDING TILE IS REAL GROUND, AND IT IS IN THE WILDERNESS');
{
    check('  2948,3768 is walkable', A.walkable(0, LANDING[0], LANDING[1]), true);
    // ...and joined to the Wilderness rather than a one-tile pocket. The cemetery is east of it.
    check('  and on foot from the Forgotten Cemetery', A.connected(0, 2960, 3755, LANDING[0], LANDING[1]), true);
    // ...and NOT joined to the battlefield, which is the whole reason the shortcut exists.
    check('  with no walk back onto the battlefield', A.connected(0, LANDING[0], LANDING[1], STAND[0], STAND[1]), false);
    // Wilderness level is (z - 3520) / 8 + 1, and the shortcut is documented at 32.
    check('  at wilderness level 32', Math.floor((LANDING[1] - 3520) / 8) + 1, 32);
}

/** Stand on the battlefield beside the handholds and click Climb. */
function climb(name: string, agility: number, loc: string, at: readonly [number, number]) {
    const p: any = player(name, STAND[0], STAND[1]);
    p.setLevel(PlayerStat.AGILITY, agility);
    const m = A.mark();
    A.op(p, at[0], at[1], loc, 1);
    H.tick(8);
    return { p, said: A.mesSince(p, m), at: [p.x, p.z, p.level] };
}

console.log('\n60 AGILITY CLIMBS DOWN, AND LESS DOES NOT');
{
    const ok = climb('gs60', 60, 'osrsloc_26400', HANDHOLD_A);
    check('  60 Agility comes out in the Wilderness', ok.at, [LANDING[0], LANDING[1], 0]);
    check(
        '    and it says the cold lets go',
        ok.said.some(s => s.includes('cold lets go')),
        true
    );
    H.despawn(ok.p);

    const no = climb('gs59', 59, 'osrsloc_26400', HANDHOLD_A);
    check('  59 is refused, and stays on the battlefield', [no.at, no.said.some(s => s.includes('Agility level of 60'))], [[STAND[0], STAND[1], 0], true]);
    H.despawn(no.p);
}

console.log('\nTHE SECOND HANDHOLD IS WALLED IN, AND THAT IS THE GRAFT AND NOT THE SCRIPT');
{
    // Old School strings this shortcut along the cliff out of six locs and the cache has two. The
    // northern one is the second step: it sits one tile INTO the cliff at 2928,3759, where every
    // orthogonal neighbour is blocked - its own tile and the southern one block themselves, and
    // 3760 north of it is bare rock - because the ledge you would walk along to reach it never
    // came across with the ground. So the engine answers it with "I can't reach that!" from every
    // side, which is a true answer rather than a silent one. It carries the same trigger as the
    // first, so nothing is a dead click and the day a ledge appears it already works.
    for (const [sx, sz] of [
        [2929, 3758],
        [2927, 3758]
    ] as [number, number][]) {
        const p: any = player(`gs_walled_${sx}`, sx, sz);
        p.setLevel(PlayerStat.AGILITY, 60);
        const m = A.mark();
        A.op(p, HANDHOLD_B[0], HANDHOLD_B[1], 'osrsloc_26402', 1);
        H.tick(15);
        check(`  from ${sx},${sz} it cannot be reached`, [[p.x, p.z], A.mesSince(p, m)], [[sx, sz], ["I can't reach that!"]]);
        H.despawn(p);
    }
    check(
        '  because nothing orthogonally beside it is walkable',
        [
            [2927, 3759],
            [2929, 3759],
            [2928, 3758],
            [2928, 3760]
        ].map(([x, z]) => A.walkable(0, x, z)),
        [false, false, false, false]
    );
}

console.log('\nAND THE CLIMB IS GATED ON THE BASE LEVEL, WHICH IS WHAT THE CHILL MAKES NECESSARY');
{
    // A player who walks up here on exactly 60 is drained below it within a minute. Against the
    // current level that would shut them out of their own way off the battlefield.
    const p: any = player('gs_drained', STAND[0], STAND[1]);
    p.setLevel(PlayerStat.AGILITY, 60);
    p.levels[PlayerStat.AGILITY] = 55;
    const m = A.mark();
    A.op(p, HANDHOLD_A[0], HANDHOLD_A[1], 'osrsloc_26400', 1);
    H.tick(8);
    check('  drained to 55 still climbs', [p.x, p.z], [LANDING[0], LANDING[1]]);
    check(
        '    without a refusal',
        A.mesSince(p, m).some(s => s.includes('Agility level of')),
        false
    );
    H.despawn(p);
}

console.log('\nTHE OLD FIRE PIT SAYS WHAT IT CAN, WHICH IS NOT NOTHING');
{
    const p: any = player('gs_pit', PIT[0] + 1, PIT[1]);
    const m = A.mark();
    const said = A.op(p, PIT[0], PIT[1], 'osrsloc_33317', 1).concat(A.mesSince(p, m));
    check(
        '  it answers Build',
        said.some(s => s.includes('what would burn very well here')),
        true
    );
    check(
        '  and not with nothing happening',
        said.some(s => s.includes('Nothing interesting happens')),
        false
    );
    H.despawn(p);
}

console.log('\nAND THE SWEEP THAT FOUND THEM FINDS NOTHING NOW');
{
    // deadLocOps walks every loc option in the box and reports the ones no trigger answers. The
    // battlefield is 2880..2943 x 3712..3775 - the grafted square, plus the Trollheim shoulder it
    // joins at. Anything left in here is a dead click on the surface.
    const dead = [...A.deadLocOps(2880, 3712, 2943, 3775, [0]).keys()];
    check('  no option on the battlefield is unanswered', dead, []);
}

console.log(`\n${R.ok} ok, ${R.bad} FAIL`);
process.exit(R.bad ? 1 : 0);
