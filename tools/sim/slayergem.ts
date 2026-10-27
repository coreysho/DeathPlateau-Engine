// The enchanted gem's second option: the task count, without the conversation.
// Usage: npx tsx tools/sim/slayergem.ts   (exit code is the verdict)
//
// WHAT THIS IS FOR. op2 on an obj with no wearpos is the trap this build has already been
// bitten by once: [opheld2,_] in player/scripts/equip.rs2 is a global, so an op2 that does not
// say Wear runs the equip code unless something more specific claims the trigger - and the
// player is then shown ~equip's own debug line instead of whatever the option promised. That
// failure looks exactly like a working click from the outside, which is why it is asserted here
// rather than trusted: the LAST section is the one that would catch it.
import * as H from './harness.ts';
import { check, R, player, mark, mesSince } from './a1lib.ts';
import ObjType from '#/cache/config/ObjType.js';

await H.boot();

const SLAYER_RAT = 3;                                   // ^slayer_rat, configs/slayer.constant

// ---------------------------------------------------------------------------------------------
console.log('== the gem carries the option');
{
    const o = ObjType.get(ObjType.getId('slayer_gem'));
    check('iop1 is still Activate', o.iop[0], 'Activate');
    check('iop2 is Check', o.iop[1], 'Check');
    check('and there is nowhere to wear it', o.wearpos, -1);
}

// ---------------------------------------------------------------------------------------------
console.log('== with a task, it reads the count back');
{
    const p = player('gem_task', 3222, 3222);
    H.clearInv(p);
    H.give(p, 'slayer_gem');
    H.setVar(p, 'slayer_target', SLAYER_RAT);
    H.setVar(p, 'slayer_count', 27);
    H.setVar(p, 'slayer_points', 40);
    H.setVar(p, 'slayer_streak', 5);
    const from = mark();
    H.opheld(p, 'slayer_gem', 2);
    H.tick(1);
    const said = mesSince(p, from);
    console.log('   ', JSON.stringify(said));
    check('names the task', said.some(m => m.includes('rats')), true);
    check('and the count', said.some(m => m.includes('27 more to go')), true);
    check('and the points and streak', said.some(m => m.includes('40 Slayer points') && m.includes('streak of 5')), true);
    check('the gem is not consumed', H.invCount(p, 'slayer_gem'), 1);
}

// ---------------------------------------------------------------------------------------------
console.log('== with no task, it says so instead of reading a blank one');
{
    const p = player('gem_notask', 3222, 3222);
    H.clearInv(p);
    H.give(p, 'slayer_gem');
    H.setVar(p, 'slayer_count', 0);
    const from = mark();
    H.opheld(p, 'slayer_gem', 2);
    H.tick(1);
    const said = mesSince(p, from);
    console.log('   ', JSON.stringify(said));
    check('one line, and it is the right one', said, ['You need something new to hunt.']);
}

// ---------------------------------------------------------------------------------------------
console.log('== and the equip global never sees the click');
{
    // ~equip's refusal is a [DEBUG] line. If this trigger were missing, that is what Check would
    // print - and the two sections above would still pass if they only counted messages.
    const p = player('gem_notglobal', 3222, 3222);
    H.clearInv(p);
    H.give(p, 'slayer_gem');
    H.setVar(p, 'slayer_target', SLAYER_RAT);
    H.setVar(p, 'slayer_count', 1);
    const from = mark();
    H.opheld(p, 'slayer_gem', 2);
    H.tick(1);
    check('no wearpos debug line', mesSince(p, from).some(m => m.includes('wearpos')), false);
}

console.log(`\n${R.ok} ok, ${R.bad} failed`);
process.exit(R.bad ? 1 : 0);
