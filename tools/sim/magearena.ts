// THE MAGE ARENA, AND THE TWO LEVERS THAT GET YOU BACK IN.
//
//   npx tsx tools/sim/magearena.ts
//
// Reported as "mage arena - cant re enter the arena". Both eastern levers are on the map, both
// carry op1=Pull, and nothing answered either: magearena_lever_in at 3104,3956 in the web-sealed
// chamber north of the arena wall, and magearena_lever_out at 3105,3952 just inside it. Their own
// examines say what they are for and they were dead clicks.
//
// "There are 2 levers at the Mage Arena. The western lever inside the house behind 2 spiderwebs
// takes players to the Mage Arena bank. The eastern lever behind a spiderweb next to the arena
// wall takes players inside of the Mage Arena." (/w/Mage_Arena)
import * as H from './harness.js';
import * as A from './a1lib.js';
import { check, R, player } from './a1lib.js';
import SeqType from '#/cache/config/SeqType.js';

await H.boot();
H.loginOrder();

const COMPLETE = 6; // ^mage_arena_complete
const IN_LEVER: [number, number] = [3104, 3956];
const OUT_LEVER: [number, number] = [3105, 3952];
const OUTSIDE: [number, number] = [3105, 3956]; // the chamber the in-lever stands in
const INSIDE: [number, number] = [3105, 3951]; // the arena's northern strip

console.log('THE WALL IS REAL, which is why a lever is needed at all');
{
    // Four tiles apart with solid ground between them. If these were ever connected the levers
    // would be scenery and this whole fix would be the wrong one.
    check('  the chamber and the arena are both walkable', [A.walkable(0, ...OUTSIDE), A.walkable(0, ...INSIDE)], [true, true]);
    check('  and you cannot walk from one to the other', A.connected(0, OUTSIDE[0], OUTSIDE[1], INSIDE[0], INSIDE[1], 120), false);
    // ...and the arena proper is on the far side of it, which is the thing being re-entered
    check('  the arena floor is reachable from inside the wall', A.connected(0, INSIDE[0], INSIDE[1], 3105, 3934, 120), true);
}

console.log('\nBOTH LEVERS ANSWER A PULL NOW');
{
    const dead = [...A.deadLocOps(3096, 3944, 3120, 3964, [0]).keys()];
    check('  nothing round the arena entrance is a dead click', dead, []);
}

/** Stand next to a lever, pull it, and report where you ended up and what was said. */
function pull(name: string, from: [number, number], lever: [number, number], locName: string, stage: number) {
    const p: any = player(name, from[0], from[1]);
    H.maxOut(p);
    H.clearInv(p);
    H.setVar(p, 'magearena', stage);
    H.tick(1);
    const m = A.mark();
    const said = A.op(p, lever[0], lever[1], locName, 1);
    H.tick(10);
    const out = { at: [p.x, p.z] as [number, number], said: said.concat(A.mesSince(p, m)) };
    H.despawn(p);
    return out;
}

console.log('\nTHE OUTSIDE LEVER PUTS A FINISHED MAGE INSIDE');
{
    const r = pull('ma_in', OUTSIDE, IN_LEVER, 'magearena_lever_in', COMPLETE);
    check('  pulled from the chamber, you are inside the wall', r.at, INSIDE);
    check(
        '    and the lever was pulled, not just clicked',
        r.said.some(s => s.includes('You pull the lever')),
        true
    );
    // ...and from there the arena floor is a walk away, which is the whole point
    check('  and the arena is a walk from there', A.connected(0, r.at[0], r.at[1], 3105, 3934, 120), true);
}

console.log('\nAND THE INSIDE ONE LETS YOU BACK OUT');
{
    const r = pull('ma_out', INSIDE, OUT_LEVER, 'magearena_lever_out', COMPLETE);
    check('  pulled from inside, you are back in the chamber', r.at, OUTSIDE);
}

console.log("\nWITHOUT KOLODION'S PERMISSION THE WAY IN IS SHUT");
{
    // "Before the player can cast god spells or access the Mage Arena, players must complete the
    // miniquest." Checked at every stage short of complete, because the one that matters is the
    // player who has started it and not finished.
    for (const stage of [0, 1, 5]) {
        const r = pull('ma_shut_' + stage, OUTSIDE, IN_LEVER, 'magearena_lever_in', stage);
        check(`  stage ${stage}: still outside`, r.at, OUTSIDE);
        check(
            '    and told why',
            r.said.some(s => s.includes('permission of Kolodion')),
            true
        );
    }
    // ...and the way OUT is never shut, because nobody should be sealed in
    const outAnyway = pull('ma_out_nostage', INSIDE, OUT_LEVER, 'magearena_lever_out', 0);
    check('  but the way out is open to anybody standing inside', outAnyway.at, OUTSIDE);
}

console.log('\nAND IT IS NOT A TELEPORT, which the arena would not allow anyway');
{
    // The western levers cross the world and cast one; these two move you four tiles through a
    // wall. "As the inside of the Mage Arena is still considered part of the Wilderness, and
    // located at Level 52 Wilderness, teleports will not work inside the arena."
    const p: any = player('ma_anim', OUTSIDE[0], OUTSIDE[1]);
    H.maxOut(p);
    H.setVar(p, 'magearena', COMPLETE);
    H.tick(1);
    H.anims.length = 0;
    A.op(p, IN_LEVER[0], IN_LEVER[1], 'magearena_lever_in', 1);
    H.tick(10);
    const seqs = H.anims.filter(a => a.who === p.username).map(a => a.seq);
    const telecast = SeqType.getId('human_castteleport');
    check('  no teleport animation is played', seqs.includes(telecast), false);
    check('  and the player did move', [p.x, p.z], INSIDE);
    H.despawn(p);
}

console.log(`\n${R.ok} ok, ${R.bad} FAIL`);
process.exit(R.bad ? 1 : 0);
