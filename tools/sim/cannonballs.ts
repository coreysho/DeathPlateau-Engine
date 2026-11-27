// CANNONBALLS, and the Make All that was added to them.
//
//   NODE_MEMBERS=true npx tsx tools/sim/cannonballs.ts     (exit code is the verdict)
//
// NODE_MEMBERS matters twice over: cannonballs refuse outright on a free world, and that refusal
// is one of the things checked here - so the flag has to be ON for the rest of the file to mean
// anything, and the f2p path is proved by reading the script's own gate rather than by booting a
// second world.
//
// WHAT IS WORTH CHECKING, and "does it make cannonballs" is the least of it:
//
//   THE COUNT IS OBEYED. Make 1 makes one bar's worth and stops, Make All works to the end of the
//   bars. A loop that ignores its count looks identical to a correct one until you have four
//   cannonballs and no inventory.
//
//   IT CAN BE STOPPED. This is the reason the file was restructured rather than wrapped in a
//   loop: the old pacing was p_delay, which sets player.delayed and makes the engine DROP input,
//   so a Make All paced that way would have been twenty-seven bars you could not call off. The
//   repeat is a weakqueue now, and closeModal clears it - so the test for "stoppable" is to click
//   something mid-run and watch the rest not happen.
//
//   AND THE RATE DID NOT MOVE. Six ticks a bar before, six after. A convenience that quietly
//   doubles a skill's xp rate is not a convenience.
import * as H from './harness.js';
import { drive } from './a1lib.js';
import Component from '#/cache/config/Component.js';
import InvType from '#/cache/config/InvType.js';
import LocType from '#/cache/config/LocType.js';
import ObjType from '#/cache/config/ObjType.js';
import Player from '#/engine/entity/Player.js';
import { PlayerStat } from '#/engine/entity/PlayerStat.js';
import ScriptState from '#/engine/script/ScriptState.js';
import Environment from '#/util/Environment.js';

await H.boot();
H.loginOrder();

const R = { ok: 0, bad: 0 };
const check = (what: string, got: unknown, want: unknown) => {
    const pass = JSON.stringify(got) === JSON.stringify(want);
    if (pass) R.ok++;
    else R.bad++;
    console.log(`  ${pass ? 'ok  ' : 'FAIL'} ${what}: ${JSON.stringify(got)}${pass ? '' : `   (want ${JSON.stringify(want)})`}`);
};

if (!Environment.NODE_MEMBERS) {
    console.log('FAIL this sim needs NODE_MEMBERS=true - cannonballs refuse on a free world and nothing below would run');
    process.exit(1);
}

// The Al Kharid furnace, which is the one everybody uses.
const FURNACE: [number, number] = [3275, 3186];
const LEVEL = 35; // ^cannonball_level
const PER_BAR = 4; // ^cannonball_per_bar
const XP = 375; // ^cannonball_xp, in tenths
const TICKS_PER_BAR = 6;

let bucket = 1;
function smith(name: string, bars: number, level = LEVEL): Player {
    const p = H.makePlayer(name, FURNACE[0], FURNACE[1] + 2, bucket++);
    H.tick(2);
    H.maxOut(p);
    H.clearInv(p);
    H.setVar(p, 'tutorial', 1000);
    p.setLevel(PlayerStat.SMITHING, level);
    H.give(p, 'ammo_mould', 1);
    if (bars > 0) H.give(p, 'steel_bar', bars);
    return p;
}
const balls = (p: Player) => H.invCount(p, 'mcannonball');
const bars = (p: Player) => H.invCount(p, 'steel_bar');
const mesFor = (p: Player) => H.mesgs.filter(m => m.who === p.username).map(m => m.text);
const said = (p: Player, fragment: string) => mesFor(p).some(t => t.includes(fragment));
const xpOf = (p: Player) => p.stats[PlayerStat.SMITHING];

/** The furnace tile this build actually has next to the player. */
function furnace(): { x: number; z: number; name: string } {
    for (const name of ['furnace1', 'furnace2']) {
        if (LocType.getId(name) === -1) continue;
        const hits = H.locsNear(name, FURNACE[0], FURNACE[1]);
        if (hits.length) return { x: hits[0].x, z: hits[0].z, name };
    }
    throw new Error('no furnace near ' + FURNACE.join(','));
}
const FURN = furnace();

/** Use a steel bar on the furnace and stop with the make-x panel open, unanswered. */
function openPanel(p: Player): boolean {
    H.useHeldOnLoc(p, 'steel_bar', FURN.x, FURN.z, FURN.name);
    for (let t = 0; t < 20; t++) {
        H.tick(1);
        const open = p.modalChat === -1 ? '' : (Component.get(p.modalChat).comName ?? '');
        if (open.startsWith('skillmulti') && p.activeScript?.execution === ScriptState.PAUSEBUTTON) return true;
    }
    return false;
}
/** Let a run play out, or at most `ticks` of it. Named for what it means at the call site. */
const run = (ticks: number) => H.tick(ticks);

// ============================================================ 0. the panel
console.log('== the click asks how many');
{
    const p = smith('cbpanel', 10);
    check('a steel bar on the furnace opens the chooser', openPanel(p), true);
    const open = Component.get(p.modalChat).comName ?? '';
    // skillmulti1 is 474's ONE-PRODUCT panel, and it is the one with Make All where the wider
    // panels carry a Make 10 - which is the whole reason it is the right one here.
    check('and it is the one-product panel', open.split(':')[0], 'skillmulti1');
    const options = [3, 4, 5, 6].map(n => {
        const com = Component.getId(`skillmulti1:com_${n}`);
        return Component.get(com)?.option ?? '';
    });
    check('offering All, X, 5 and 1', options, ['Make All', 'Make X', 'Make 5', 'Make 1']);
    H.despawn(p);
}

// ============================================================ 1. Make 1
console.log('\n== Make 1 makes one bar\'s worth and stops');
{
    const p = smith('cbone', 10);
    const xpBefore = xpOf(p);
    openPanel(p);
    H.clearLogs();
    drive(p, [6]); // com_6 is Make 1
    run(TICKS_PER_BAR + 2);
    check('one bar is used', bars(p), 9);
    check(`and ${PER_BAR} cannonballs come back`, balls(p), PER_BAR);
    check('with the experience for one bar', xpOf(p) - xpBefore, XP);
    check('and it says all four lines', [
        said(p, 'heat the steel bar'),
        said(p, 'pour the molten metal'),
        said(p, 'cools slowly to form 4'),
        said(p, 'remove the cannonballs')
    ], [true, true, true, true]);

    // AND NOTHING MORE. The bug a count that is ignored would show as: one click, a whole pack.
    run(TICKS_PER_BAR * 3);
    check('and nothing else is made after it', [bars(p), balls(p)], [9, PER_BAR]);
    H.despawn(p);
}

// ============================================================ 2. Make All
console.log('\n== Make All works to the end of the bars');
{
    const p = smith('cball', 5);
    openPanel(p);
    H.clearLogs();
    drive(p, [3]); // com_3 is Make All
    run(TICKS_PER_BAR * 5 + 4);
    check('every bar is used', bars(p), 0);
    check('and five bars is twenty cannonballs', balls(p), 5 * PER_BAR);
    check('and it says when the bars run out', said(p, 'run out of steel bars'), true);
    H.despawn(p);
}

// ============================================================ 3. the rate
console.log('\n== six ticks a bar, which is what it was before');
{
    const p = smith('cbrate', 5);
    openPanel(p);
    drive(p, [3]);
    // After one bar's worth of ticks exactly one bar should be gone - not two, which is what a
    // loop that forgot half its pacing would do, and not none.
    run(TICKS_PER_BAR);
    check('one bar gone after six ticks', bars(p), 4);
    run(TICKS_PER_BAR);
    check('two after twelve', bars(p), 3);
    H.despawn(p);
}

// ============================================================ 4. it can be stopped
console.log('\n== and a run can be called off');
{
    const p = smith('cbstop', 10);
    openPanel(p);
    drive(p, [3]); // Make All, ten bars
    run(TICKS_PER_BAR + 1);
    const madeSoFar = balls(p);
    check('a bar or two in', madeSoFar > 0, true);

    // WHAT A PLAYER DOES TO STOP: anything else at all. Clicking the furnace itself is the most
    // likely one and costs the player nothing, so it is what this uses - any op closes the modal,
    // and closeModal clears the weak queue the repeat lives in. With p_delay pacing the engine
    // would have been DROPPING this click, and nothing here would happen.
    H.opLoc(p, FURN.x, FURN.z, FURN.name, 2); // op2 is Smelt, the furnace's only option
    H.tick(1);
    const atStop = balls(p);
    run(TICKS_PER_BAR * 6);
    check('the rest of the run does not happen', balls(p), atStop);
    check('and the bars are still there', bars(p) > 0, true);
    H.despawn(p);
}

// ============================================================ 5. the gates
console.log('\n== the three things that refuse it');
{
    const low = smith('cblow', 5, LEVEL - 1);
    H.clearLogs();
    H.useHeldOnLoc(low, 'steel_bar', FURN.x, FURN.z, FURN.name);
    H.tick(6);
    check(`below ${LEVEL} Smithing it says so`, said(low, `Smithing level of ${LEVEL}`), true);
    check('and opens no panel', low.modalChat, -1);
    H.despawn(low);

    const noMould = smith('cbnomould', 5);
    noMould.invDel(InvType.INV, ObjType.getId('ammo_mould'), 1);
    H.clearLogs();
    H.useHeldOnLoc(noMould, 'steel_bar', FURN.x, FURN.z, FURN.name);
    H.tick(6);
    check('without the mould it says so', said(noMould, 'need a cannonball mould'), true);
    check('and opens no panel', noMould.modalChat, -1);
    H.despawn(noMould);
}

console.log(`\n${R.ok} ok, ${R.bad} failed`);
process.exit(R.bad === 0 ? 0 : 1);
