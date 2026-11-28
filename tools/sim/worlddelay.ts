// WHEN A world_delay FIRES, MEASURED (DeathPlateau-Bugs#119).
//
// A script that suspends with world_delay(n) goes onto the world queue, and the queue is walked once
// per tick at the START of the cycle (processWorld), before npcs and players. Two cases are timed here
// with a hand-built script, so the number is the engine's and not a content script's:
//
//   A  queued by a player or npc script: those run AFTER processWorld in the same tick, so from the
//      queue's point of view it was added between two passes.
//   B  queued by a world script that is itself being run by processWorld (it re-suspends).
//
// WHAT IT SHOULD BE. world_delay(n) should resume n+1 passes after the one it was queued in - that is
// "delay + 1" in World.enqueueScript, and what PlagueCityRS 349 stores as a fixed executionTick. The
// two cases must agree: a script cannot take longer to wake because of WHO queued it.
//
//   npx tsx tools/sim/worlddelay.ts
import * as H from './harness.js';
import World from '#/engine/World.js';
import ScriptFile from '#/engine/script/ScriptFile.js';
import ScriptState from '#/engine/script/ScriptState.js';
import ScriptRunner from '#/engine/script/ScriptRunner.js';
import { ScriptOpcode } from '#/engine/script/ScriptOpcode.js';

await H.boot();
let ok = 0;
let fail = 0;
function check(name: string, got: unknown, want: unknown) {
    const good = JSON.stringify(got) === JSON.stringify(want);
    if (good) ok++;
    else fail++;
    console.log(`  ${good ? 'ok  ' : 'FAIL'} ${name}: ${JSON.stringify(got)}${good ? '' : '   (want ' + JSON.stringify(want) + ')'}`);
}

/** world_delay(first), then world_delay(second), then done. */
function script(first: number, second: number): ScriptState {
    const f = new ScriptFile(1999999);
    f.opcodes = [ScriptOpcode.PUSH_CONSTANT_INT, ScriptOpcode.WORLD_DELAY, ScriptOpcode.PUSH_CONSTANT_INT, ScriptOpcode.WORLD_DELAY, ScriptOpcode.RETURN];
    f.intOperands = [first, 0, second, 0, 0];
    f.info.scriptName = 'worlddelay_probe';
    return new ScriptState(f, []);
}

/** Queue it the way Player.executeScript does when a script suspends with world_delay, then count
 *  the cycles to each of its two resumes. */
function measure(n: number): { wake: number; again: number } {
    const s = script(n, n);
    const state = ScriptRunner.execute(s);
    if (state !== ScriptState.WORLD_SUSPENDED) throw new Error('probe did not suspend: ' + state);
    World.enqueueScript(s, s.popInt());
    let cycles = 0;
    let wake = -1;
    let again = -1;
    for (let guard = 0; guard < 400 && again < 0; guard++) {
        H.tick(1);
        cycles++;
        // pc: -1 before it runs; after the first resume it runs on to the second WORLD_DELAY (pc 3);
        // after the second resume it finishes.
        if (wake < 0 && s.pc >= 3) wake = cycles;
        else if (wake >= 0 && s.execution !== ScriptState.WORLD_SUSPENDED) again = cycles - wake;
    }
    return { wake, again };
}

console.log('WHEN world_delay(n) WAKES, IN CYCLES AFTER IT WAS QUEUED');
for (const n of [0, 1, 2, 5]) {
    const r = measure(n);
    check(`A  queued by a player/npc script, world_delay(${n}) wakes after n+1`, r.wake, n + 1);
    check(`B  and when it re-suspends from the queue itself, world_delay(${n}) wakes after n+1`, r.again, n + 1);
}

console.log(`\n${ok} ok, ${fail} FAIL`);
process.exit(fail ? 1 : 0);
