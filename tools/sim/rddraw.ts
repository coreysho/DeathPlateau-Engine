// RECRUITMENT DRIVE'S DRAW: five tests of seven, and what the seven completion bits mean.
//
//   npx tsx tools/sim/rddraw.ts
//
// DeathPlateau-Bugs#72. ~rd_begin_run used to pick the five by SETTING two of the seven
// rd_roomN_complete varbits, to mean "this room was not drawn". The quest coped - completion was
// "no room left" rather than a count, and the journal subtracted the two - but the quest helper
// reads those very varbits as its progress marks, so two of them read "done" from the first moment
// of every run and the panel jumped: six measured runs landed on five different steps, as deep as
// 53 of 56, never on step 1.
//
// The draw now has its own bits (rd_room1..7_drawn on the rd_draw varp) and %rd_progress is a nine-
// rung ladder the helper follows one test at a time. This file is the proof of both properties the
// helper needs:
//
//   A COMPLETION BIT IS SET IF AND ONLY IF THAT TEST WAS PASSED   (option A)
//   %rd_progress NAMES THE TEST BEING SAT, AND AGREES WITH %rd_main EVERYWHERE   (option C)
//
// Why this file and not quest_rd_run.ts: that walk deliberately removes the condition under test.
// It marks all seven as drawn so it can sit all seven in one go, so it would pass either way -
// which is exactly why nobody caught this (#81's pile). Here the real draw runs, unpinned and
// pinned, and nothing overrides it.
import * as H from './harness.js';
import { check, R, player } from './a1lib.js';
import JavaRandom from '#/util/JavaRandom.js';
import VarPlayerType from '#/cache/config/VarPlayerType.js';
import VarBitType from '#/cache/config/VarBitType.js';

await H.boot();

const ROOMS = [1, 2, 3, 4, 5, 6, 7];
// Each room's arrive coord, from quest_rd.constant's ^rd_roomN_arrive. m38_77's base is (2432,4928).
const ARRIVE: Record<number, [number, number]> = {
    1: [2489, 4972],
    2: [2459, 4979],
    3: [2456, 4964],
    4: [2472, 4956],
    5: [2440, 4956],
    6: [2468, 4940],
    7: [2451, 4936]
};

const origND = JavaRandom.nextDouble.bind(JavaRandom);
// random(n) is pushInt(nextDouble() * n), i.e. truncated - so (k + 0.5)/n lands on k with no
// floating-point edge to worry about (k/n * n can come out at k - epsilon and truncate to k - 1).
function pinSkips(a: number, b: number) {
    const vals = [(a - 1 + 0.5) / 7, (b - 1 + 0.5) / 7];
    let i = 0;
    (JavaRandom as unknown as { nextDouble: () => number }).nextDouble = () => vals[Math.min(i++, vals.length - 1)];
}
const unpin = () => {
    (JavaRandom as unknown as { nextDouble: () => number }).nextDouble = origND;
};

// ^rd_progress_room1 is 2, so the rung for room n is n + 1; 0 is not started, 1 is "see Sir Tiffy"
// and 9 is finished. The ladder has to be one rising number because the panel picks the last leg
// whose value you have passed - see quest_rd.constant.
const RUNG = (room: number) => room + 1;
const progress = (p: any) => H.getVarBit(p, 'rd_progress');
// The invariant the two vars are supposed to keep. Asserted after every move below, because a
// ladder that disagrees with the quest's own stage is the bug this replaced, wearing a new hat.
const ladderAgrees = (p: any) => {
    const g = progress(p);
    const main = H.getVarBit(p, 'rd_main');
    if (g === 0) return main === 0;
    if (g === 9) return main === 2;
    return main === 1 && g >= 1 && g <= 8;
};
const drawn = (p: any) => ROOMS.filter(n => H.getVarBit(p, `rd_room${n}_drawn`) === 1);
const done = (p: any) => ROOMS.filter(n => H.getVarBit(p, `rd_room${n}_complete`) === 1);
// Protected, because ~rd_begin_run writes %recruitmentdrive and pop_varp on a perm varp needs it.
const beginRun = (p: any) => H.runProc(p, '[proc,rd_begin_run]', [], undefined, true);
const roomsDone = (p: any) => H.runProc(p, '[proc,rd_rooms_done]')[0];
const pending = (p: any, n: number) => H.runProc(p, '[proc,rd_room_pending]', [n])[0] === 1;

// ------------------------------------------------------------------ the draw, pinned
console.log('THE DRAW, WITH THE DICE PINNED');
const p: any = player('rddraw', 2969, 3383);
pinSkips(1, 4);
beginRun(p);
check('skipping 1 and 4 draws the other five', drawn(p), [2, 3, 5, 6, 7]);
check('and sets NOT ONE completion bit', done(p), []);
check('so the helper reads nought passed, not two', roomsDone(p), 0);
check('the ladder is at Sir Tiffy - the draw does not place you in a room', progress(p), 1);
check('and it agrees with %rd_main', ladderAgrees(p), true);
check('a skipped test is not pending', [pending(p, 1), pending(p, 4)], [false, false]);
check('a drawn test is', [pending(p, 2), pending(p, 7)], [true, true]);

pinSkips(7, 6);
beginRun(p);
check('skipping the last two draws 1-5', drawn(p), [1, 2, 3, 4, 5]);
check('  ...and still no completion bit', done(p), []);
check('the draw bits are rebuilt from scratch, not added to', drawn(p).length, 5);

// ------------------------------------------------------------------ the draw, unpinned
console.log('AND 300 REAL DRAWS');
unpin();
const seenSkipped = new Set<number>();
let worstDone = 0;
let worstRoomsDone = 0;
let everUnequal = true;
for (let i = 0; i < 300; i++) {
    beginRun(p);
    const d = drawn(p);
    if (d.length !== 5) {
        check(`run ${i} drew five`, d.length, 5);
        break;
    }
    for (const n of ROOMS) if (!d.includes(n)) seenSkipped.add(n);
    worstDone = Math.max(worstDone, done(p).length);
    worstRoomsDone = Math.max(worstRoomsDone, roomsDone(p));
    if (d.length !== new Set(d).size) everUnequal = false;
}
check('every one of 300 draws took exactly five', worstDone >= 0 && drawn(p).length, 5);
check('not one of them set a completion bit', worstDone, 0);
check('so ~rd_rooms_done is 0 at the start of all 300', worstRoomsDone, 0);
check('the two left out are always two different tests', everUnequal, true);
check(
    'and all seven can be left out',
    [...seenSkipped].sort((a, b) => a - b),
    ROOMS
);

// ------------------------------------------------------------------ the walk
console.log('THE WALK SKIPS WHAT WAS NOT DRAWN');
// Rooms 1 and 4 out, so the five are 2,3,5,6,7 and the hop out of room 3 must land in room 5.
pinSkips(1, 4);
beginRun(p);
unpin();
// Miss Cheevers' lab is the one room whose own door does not send you on: rd_room6_exitdoor opens
// onto a corridor (rd_room6_lab.rs2) and the portal at the far end of it carries @rd_exit_door(6).
// Walk B below ends on room 5 instead, so the finish is measured through an ordinary door.
const hop = (from: number, expect: number | null) => {
    H.setVarBit(p, `rd_room${from}_complete`, 1);
    const [ax, az] = ARRIVE[from];
    p.teleport(ax, az, 0);
    H.tick(1);
    const name = `rd_room${from}_exitdoor`;
    const doors = H.locsNear(name, ax, az, 0).filter(d => Math.abs(d.x - ax) < 20 && Math.abs(d.z - az) < 20);
    if (doors.length === 0) throw new Error(`no ${name} found near room ${from} at ${ax},${az}`);
    // Stand at the door rather than walk to it. Sir Spishyus' room cannot be crossed on foot at all
    // - the bridge is a jump between two banks - which is why the manifest hops to every door too.
    for (const [dx, dz] of [
        [0, 0],
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1]
    ]) {
        p.teleport(doors[0].x + dx, doors[0].z + dz, 0);
        H.tick(1);
        H.opLoc(p, doors[0].x, doors[0].z, name, 1);
        H.tick(20);
        if (progress(p) - 1 !== from) break;
    }
    const room = progress(p) - 1;
    if (expect === null) return room;
    check(`passing room ${from} sends you to room ${expect}`, room, expect);
    check('  ...and lands you on its arrive tile', [p.x, p.z], ARRIVE[expect]);
    check(`  ...on rung ${RUNG(expect)} of the ladder, agreeing with %rd_main`, [progress(p), ladderAgrees(p)], [RUNG(expect), true]);
    return room;
};
check('the run is pending at room 2, the lowest drawn', pending(p, 2), true);
check('and NOT at room 1, which it never drew', pending(p, 1), false);
hop(2, 3);
check('one test passed', roomsDone(p), 1);
hop(3, 5);
check('room 4 was never drawn, so it was never offered', H.getVarBit(p, 'rd_room4_complete'), 0);
check('two passed, and the door walked straight over room 4', roomsDone(p), 2);
hop(5, 6);
check('three passed', roomsDone(p), 3);

console.log('AND THE FIFTH PASS ENDS THE RUN');
// Skip 6 and 7, so the five are 1-5 and the last door out is an ordinary one.
pinSkips(6, 7);
beginRun(p);
unpin();
check('the five drawn are 1 to 5', drawn(p), [1, 2, 3, 4, 5]);
hop(1, 2);
hop(2, 3);
hop(3, 4);
hop(4, 5);
check('four passed, none skipped', roomsDone(p), 4);
H.setVarBit(p, 'rd_room5_complete', 1);
const [lx, lz] = ARRIVE[5];
p.teleport(lx, lz, 0);
H.tick(1);
const last = H.locsNear('rd_room5_exitdoor', lx, lz, 0).filter(d => Math.abs(d.x - lx) < 20 && Math.abs(d.z - lz) < 20);
H.opLoc(p, last[0].x, last[0].z, 'rd_room5_exitdoor', 1);
H.tick(60);
check('the fifth pass completes the quest', H.getVarBit(p, 'rd_main'), 2);
check('the ladder reaches its last rung, which is what the panel reads as finished', progress(p), 9);
check('  ...and still agrees with %rd_main', ladderAgrees(p), true);
check('and the draw is cleared', drawn(p), []);
check(
    'so the helper has no room to point at once it is over',
    ROOMS.filter(n => pending(p, n)),
    []
);

// ------------------------------------------------------------------ failing
console.log('FAILING THROWS THE DRAW AWAY');
pinSkips(2, 3);
beginRun(p);
unpin();
H.setVarBit(p, 'rd_room1_complete', 1);
check('mid-run: one passed, five drawn', [roomsDone(p), drawn(p).length], [1, 5]);
H.runProc(p, '[proc,rd_fail_room]', ['You moved.'], undefined, true);
check('the drawn bits go with the run', drawn(p), []);
check('and the ladder drops back to Sir Tiffy, not to nothing', progress(p), 1);
check('  ...which is still a started quest', ladderAgrees(p), true);
check('no run is in progress', H.runProc(p, '[proc,rd_run_in_progress]')[0], 0);
check(
    'and nothing is left pending, so the helper has nothing to point at',
    ROOMS.filter(n => pending(p, n)),
    []
);

// ------------------------------------------------------------------ the varp itself
console.log('THE VARP');
const vp = VarPlayerType.getByName('rd_draw');
check('rd_draw exists', vp !== null, true);
check('it is perm, because a run survives a logout and the draw has to too', vp?.scope, VarPlayerType.SCOPE_PERM);
check('and transmitted, because the quest helper reads rd_progress', vp?.transmit, true);
const bit = VarBitType.getByName('rd_progress');
check('rd_progress is a varbit the exporter can emit stageBits for', [bit !== null, bit?.basevar === vp?.id], [true, true]);
check('  ...four bits wide, which holds the nine rungs', [bit?.startbit, bit?.endbit], [7, 10]);
const rdv = VarPlayerType.getByName('recruitmentdrive');
check('recruitmentdrive is perm too - that is why the draw could not be scratch', rdv?.scope, VarPlayerType.SCOPE_PERM);

console.log(`\n${R.ok} ok, ${R.bad} FAIL`);
process.exit(R.bad > 0 ? 1 : 0);
