// The God Wars obstacles, as reported from play and fixed here.
//
// Three faults, none of which any existing sim could see:
//
//   THE ICE WOLVES were all in a pocket west of the route. The engine's own flood from the boulder
//   reaches 628 tiles of snowfield, x2897..2931, and every one of the 22 wolves stood outside it at
//   x2886..2899. Nought of 22 reachable, which is why the walk in had no wolves on it.
//
//   THE SARADOMIN ROPES let anyone straight down. Their varps were type=boolean, and a boolean varp
//   reads -1 on a player who has never set it rather than false, so `if ($tied = false)` was never
//   true and the tie-a-rope block never ran. gwd_rope_tied, a plain int beside them, reads 0 and had
//   always worked - which is why the hole asked for a rope and the rocks did not.
//
//   THE BANDOS DOOR only ever carried you west. It is a solid loc and nothing opens it, so once the
//   gong let you in there was no way back to the main chamber.
//
//   npx tsx tools/sim/gwdobstacles.ts
import * as H from './harness.ts';
import * as A from './a1lib.ts';
import { check, R } from './a1lib.ts';
await H.boot();

console.log('\nTHE WOLVES ARE ON THE WALK IN');
{
    const spots: [number, number][] = [[2899,3722],[2907,3723],[2905,3727],[2903,3731],[2911,3732],
      [2923,3735],[2908,3736],[2912,3738],[2920,3739],[2928,3740],[2905,3744],[2920,3744],
      [2928,3744],[2905,3748],[2925,3748],[2917,3749],[2905,3752],[2922,3752],[2917,3753],
      [2905,3756],[2922,3756],[2918,3757]];
    const reach = spots.filter(([x, z]) => A.connected(0, 2898, 3719, x, z, 80)).length;
    check('  every wolf can be reached from the boulder', reach, spots.length);
}

console.log('\nTHE SARADOMIN ROPES ASK FOR A ROPE');
for (const [nm, lx, lz, lv] of [['upper', 2913, 5300, 2], ['lower', 2920, 5274, 1]] as [string,number,number,number][]) {
    const bare: any = A.player(`bare_${nm}`, lx, lz + 1, lv);
    bare.baseLevels[16] = 99; bare.levels[16] = 99;
    H.setVar(bare, 'tutorial', 1000);
    H.tick(1);
    let from = H.mesgs.length;
    A.op(bare, lx, lz, `gwd_rock_tierope_${nm}`, 1);
    H.tick(6);
    check(`  ${nm}: no rope, turned away`, A.saw(A.mesSince(bare, from), 'would need a rope'), true);
    check(`  ${nm}: and did not move`, [bare.x, bare.z, bare.level], [lx, lz + 1, lv]);
    H.despawn(bare);

    const kit: any = A.player(`kit_${nm}`, lx, lz + 1, lv);
    kit.baseLevels[16] = 99; kit.levels[16] = 99;
    H.setVar(kit, 'tutorial', 1000);
    H.give(kit, 'rope', 1);
    H.tick(1);
    from = H.mesgs.length;
    A.op(kit, lx, lz, `gwd_rock_tierope_${nm}`, 1);
    H.tick(6);
    const said = A.mesSince(kit, from);
    check(`  ${nm}: with a rope, ties it`, A.saw(said, 'tie your rope'), true);
    check(`  ${nm}: and the rope is spent`, H.invCount(kit, 'rope'), 0);
    check(`  ${nm}: and goes down`, kit.level, lv - 1);
    H.despawn(kit);

    // AND IT STAYS TIED. A separate player with the varp already set, because the one above is a
    // floor down by now and opLoc looks for the rock on the level the player is standing on.
    const again: any = A.player(`again_${nm}`, lx, lz + 1, lv);
    again.baseLevels[16] = 99; again.levels[16] = 99;
    H.setVar(again, 'tutorial', 1000);
    H.setVar(again, nm === 'upper' ? 'gwd_rope_upper' : 'gwd_rope_lower', 1);
    H.tick(1);
    const from2 = H.mesgs.length;
    A.op(again, lx, lz, `gwd_rock_tierope_${nm}`, 1);
    H.tick(6);
    check(`  ${nm}: stays tied, no second rope`, A.saw(A.mesSince(again, from2), 'would need a rope'), false);
    check(`  ${nm}: and still goes down`, again.level, lv - 1);
    H.despawn(again);
}

console.log('\nTHE BANDOS DOOR WORKS BOTH WAYS');
for (const [label, sx, sz, want] of [['in from the corridor', 2852, 5333, 2850],
                                     ['back out to the chamber', 2850, 5333, 2852]] as [string,number,number,number][]) {
    const p: any = A.player('door' + sx, sx, sz, 2);
    p.baseLevels[2] = 99; p.levels[2] = 99;
    H.setVar(p, 'tutorial', 1000);
    H.give(p, 'hammer', 1);
    H.tick(1);
    A.op(p, 2851, 5333, 'gwd_door_bang', 1);
    H.tick(6);
    check(`  ${label}`, p.x, want);
    H.despawn(p);
}

// AND THE WAY BACK. Both Saradomin ropes were one-way - you climbed down and that was that, which
// left the level 1 cavern and the encampment below it as places you could only leave by teleport.
// The Armadyl grapple fired you at the same pillar whichever side you stood on, so coming back you
// played the animation and did not move.

console.log('BOTH SARADOMIN ROPES GO BACK UP');
for (const [nm, lv, lx, lz, sx, sz, wantLv] of [
    ['upper', 1, 2914, 5300, 2915, 5300, 2],
    ['lower', 0, 2920, 5274, 2919, 5274, 1],
] as [string, number, number, number, number, number, number][]) {
    const p: any = A.player(`up_${nm}`, sx, sz, lv);
    H.setVar(p, 'tutorial', 1000);
    H.tick(1);
    A.op(p, lx, lz, 'osrsloc_26369', 1);
    H.tick(8);
    check(`  ${nm} rope climbs back to level ${wantLv}`, p.level, wantLv);
    H.despawn(p);
}

console.log('\nTHE ARMADYL GRAPPLE GOES BOTH WAYS');
for (const [label, sx, sz, want] of [
    ['out to the pillar', 2871, 5279, 5269],
    ['back again',        2871, 5269, 5279],
] as [string, number, number, number][]) {
    const p: any = A.player('grap' + sz, sx, sz, 2);
    p.baseLevels[4] = 99; p.levels[4] = 99;
    H.setVar(p, 'tutorial', 1000);
    H.give(p, 'mith_grapple', 1);
    H.equip(p, { rhand: 'crossbow' });
    H.tick(1);
    A.op(p, 2871, 5270, 'gwd_pillar_grapple', 1);
    H.tick(8);
    check(`  ${label}`, p.z, want);
    H.despawn(p);
}
console.log(`\n${R.ok} ok, ${R.bad} FAIL`);
process.exit(0);
