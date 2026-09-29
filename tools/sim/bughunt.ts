// The script fault reporter, against the real engine - run with `npx tsx tools/sim/bughunt.ts`.
//
// WHAT IT REPRODUCES. On 2026-09-28 a live skeleton threw
//
//     script error: .npc_findhero Attempt to access null active_npc
//     file: slayer_task.rs2
//     stack backtrace:
//         1: [proc,check_progress_task] - slayer_task.rs2:189
//         2: [proc,npc_death] - npc_death.rs2:16
//         3: [ai_queue3,skeleton_unagressive] - skeleton.rs2:1
//
// and because a RuneScript error aborts the WHOLE trigger stack, and ~check_progress_task is
// gosub'd on the first line of [proc,npc_death], every monster that died down that path lost its
// drop, its death animation, its kill counts and its npc_del. It was found by reading journalctl by
// hand. That is what ScriptFaults exists to stop, and this is the run that proves it works.
//
// HOW THE STATE IS REACHED - and it is a real path, not a contrivance. The bad branch needs
// `npc_findhero = false` AND `finduid(%npc_aggressive_player) = true` at the same time, which looks
// impossible until you notice POISON:
//
//   - every swing at an npc calls ~npc_retaliate (npc_combat.rs2), which sets
//     %npc_aggressive_player = uid whether the swing hit or missed;
//   - hero points are only credited by npc_heropoints, which the melee/ranged/magic scripts call on
//     DAMAGE - poison damage (npc_poison.rs2, npc_damage(^hitmark_poison, ...)) never does;
//   - so a skeleton finished off by the poison ticking, rather than by the blow, dies with an
//     aggressive player and no hero at all. npc_poison_timer then calls npc_queue(3, 0, 0), which
//     is [ai_queue3,skeleton_unagressive] - frame 3 of the live backtrace, exactly.
//
// The two varns below are set directly rather than by swinging a poisoned weapon, so the run is
// deterministic; they are set to the values ~npc_retaliate and ~npc_poison_start would set. From
// there down it is all real content: the ai_timer, the poison tick, the queue, the death.
//
// WHAT IT CHECKS
//   1. against the CURRENT content (the fix in d2f9bc2a4), the death runs clean: no fault at all,
//      and the skeleton is actually deleted rather than left standing;
//   2. the reporter's own rules: off by default, one signature per distinct fault however often it
//      fires, a full backtrace, a JSONL file on disk, and a clear that empties both.
//
// Point 1 inverts when the fix is reverted, which is the acceptance run: the fault appears, once,
// with the three frames above.
import fs from 'fs';
import os from 'os';
import path from 'path';

import * as H from './harness.ts';
import World from '#/engine/World.js';
import Npc from '#/engine/entity/Npc.js';
import { NpcStat } from '#/engine/entity/NpcStat.js';
import ScriptFaults from '#/engine/script/ScriptFaults.js';

let ok = 0,
    bad = 0;
const check = (what: string, got: unknown, want: unknown) => {
    const pass = JSON.stringify(got) === JSON.stringify(want);
    if (pass) {
        ok++;
    } else {
        bad++;
    }
    console.log(`  ${pass ? 'ok  ' : 'FAIL'} ${what}: ${JSON.stringify(got)}${pass ? '' : `   (want ${JSON.stringify(want)})`}`);
};

// The reporter is off unless a world asks for it, so a sim has to ask. Check that first: a reporter
// that was quietly on by default would be a change to the live world nobody signed off on.
console.log('reporter default');
check('off unless NODE_SCRIPT_FAULTS is set', ScriptFaults.enabled, false);

const faultsFile = path.join(os.tmpdir(), `bughunt_faults_${process.pid}.jsonl`);
ScriptFaults.enableForTesting(faultsFile);

await H.boot();

const player = H.makePlayer('bughunter', 3290, 3490);
H.maxOut(player);
H.tick(2);

/** Poison a skeleton down to nothing and let the poison land the killing blow. */
function poisonToDeath(who: string, x: number, z: number): Npc {
    const npc = H.addNpc(who, x, z);
    H.tick(1);
    // What ~npc_retaliate writes on every swing at it, hit or miss (npc_combat.rs2).
    H.setNpcVar(npc, 'npc_aggressive_player', player.uid);
    // What ~npc_poison_start writes (npc_poison.rs2). The timer is the npc's [ai_timer,_].
    H.setNpcVar(npc, 'npc_poison', 3);
    npc.setTimer(1);
    // One hitpoint left, so the next poison tick is the one that kills it. Nothing has credited a
    // hero: poison damage does not call npc_heropoints, and nothing else has touched this skeleton.
    npc.levels[NpcStat.HITPOINTS] = 1;
    for (let i = 0; i < 12 && npc.levels[NpcStat.HITPOINTS] > 0; i++) {
        H.tick(1);
    }
    H.tick(6); // the death script's own arrivedelay, then the drop
    return npc;
}

console.log('\na skeleton killed by its poison, with an aggressive player and no hero');
const skeleton = poisonToDeath('skeleton_unagressive', 3292, 3490);
check('it died', skeleton.levels[NpcStat.HITPOINTS], 0);

const faults = ScriptFaults.top(10);
for (const f of faults) {
    console.log(`  fault ${f.sig} x${f.count} [${f.kind}${f.npc ? ' ' + f.npc : ''}] ${f.message}`);
    for (let i = 0; i < f.frames.length; i++) {
        console.log(`      ${i + 1}: ${f.frames[i].trigger} - ${f.frames[i].file}:${f.frames[i].line}`);
    }
}
check('no script fault on the death path', faults.length, 0);
// The corpse going away is the OTHER half of the live bug: the abort took npc_del with it, so the
// skeleton stayed standing until the world cleaned it up.
check('the corpse was deleted (npc_del ran)', World.getNpc(skeleton.nid) === undefined || !skeleton.isActive, true);

// --------------------------------------------------------------- the reporter's own rules
//
// A fault that does not depend on any content bug being present, so these checks keep working after
// every fix: ~slayer_taskname reads %slayer_target, a PLAYER varp, and here it is run with an npc
// and nobody else - "Attempt to access null active_player", the same shape of mistake as the live
// one and thrown on demand.
console.log('\nthe reporter itself');
const victim = H.addNpc('skeleton_unagressive', 3294, 3490);
function throwOnce() {
    try {
        H.runNpcProc(victim, '[proc,slayer_taskname]');
    } catch {
        // ScriptRunner swallows script errors; a throw out here would be an engine bug, not content
    }
}

// Counted as a DELTA, not an absolute, so the acceptance run (which reverts the slayer fix and so
// starts this section with one fault already on the table) reads the same as a clean one.
const sigsBefore = new Set(ScriptFaults.top(999).map(f => f.sig));
throwOnce();
const first = ScriptFaults.top(999).find(f => !sigsBefore.has(f.sig));
check('the reporter caught it', first !== undefined, true);
if (first) {
    console.log(`  fault ${first.sig} x${first.count} [${first.kind} ${first.npc}] ${first.message}`);
    for (let i = 0; i < first.frames.length; i++) {
        console.log(`      ${i + 1}: ${first.frames[i].trigger} - ${first.frames[i].file}:${first.frames[i].line}`);
    }
    for (let i = 0; i < 20; i++) {
        throwOnce();
    }
    check('21 occurrences, one new signature', ScriptFaults.size() - sigsBefore.size, 1);
    check('counted, not duplicated', ScriptFaults.get(first.sig)?.count, 21);
    check('it has a backtrace', (ScriptFaults.get(first.sig)?.frames.length ?? 0) >= 1, true);
    check('it knows the npc', ScriptFaults.get(first.sig)?.npc, 'skeleton_unagressive');
}
World.removeNpc(victim, 0);

ScriptFaults.flush();
const onDisk = fs.existsSync(faultsFile) ? fs.readFileSync(faultsFile, 'utf8').trim().split('\n').filter(Boolean) : [];
check('one JSONL line per distinct fault', onDisk.length, ScriptFaults.size());
if (onDisk.length) {
    const parsed = JSON.parse(onDisk[0]);
    check('the line carries sig/count/frames/ticks', [typeof parsed.sig, typeof parsed.count, Array.isArray(parsed.frames), typeof parsed.firstTick, typeof parsed.lastTick], ['string', 'number', true, 'number', 'number']);
}

const cleared = ScriptFaults.clear();
check('clear empties the table', [cleared >= 0, ScriptFaults.size()], [true, 0]);
check('clear empties the file', fs.readFileSync(faultsFile, 'utf8').trim(), '');
fs.rmSync(faultsFile, { force: true });

console.log(`\n${ok} ok, ${bad} FAILED`);
process.exit(bad ? 1 : 0);
