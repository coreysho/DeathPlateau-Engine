// The fuzzing bots against the real engine - `npx tsx tools/sim/fuzz.ts [ticks] [bots] [seed] [x,z,level]`
//
// It boots the world, puts fuzzing bots (src/engine/bot/BotFuzzer.ts) into it and lets them click
// everything in reach for however many ticks you ask for, then prints what the watchers
// (BotFuzzWatch.ts) and the script fault reporter (ScriptFaults.ts) caught, and what the run
// actually covered.
//
// It also checks the safety guard, first and every time, because that is the part that must never
// rot: the fuzzer refuses to run on a production world, and refuses to run around a player who is
// not staff. Both are checked here against the real BotManager.startFuzzers.
//
// A run that finds nothing is a result and is printed as one. What is NOT a result is a run that
// found nothing because the bots never did anything, so the action histogram is printed too - if it
// is all `idle` and `walk`, the finding is about the fuzzer, not the content.
import fs from 'fs';
import os from 'os';
import path from 'path';

import * as H from './harness.ts';
import World from '#/engine/World.js';
import Environment from '#/util/Environment.js';
import BotManager from '#/engine/bot/BotManager.js';
import BotPlayer from '#/engine/bot/BotPlayer.js';
import { DEFAULT_BOT_CONFIG } from '#/engine/bot/BotConfig.js';
import { findings } from '#/engine/bot/BotFuzzWatch.js';
import DeadOps from '#/engine/script/DeadOps.js';
import { fuzzTuning } from '#/engine/bot/BotFuzzer.js';
import ScriptCoverage from '#/engine/script/ScriptCoverage.js';
import ScriptFaults from '#/engine/script/ScriptFaults.js';

const argv = process.argv.slice(2);
const TICKS = parseInt(argv[0] ?? '') || 2000;
const COUNT = parseInt(argv[1] ?? '') || 4;
const SEED = parseInt(argv[2] ?? '') || 20260929;
const AT = (argv[3] ?? '3222,3218,0').split(',').map(n => parseInt(n));
// `noguide` as the fifth argument turns the coverage steering off, so the same seed can be run both
// ways and the difference measured rather than asserted.
fuzzTuning.coverageGuided = argv[4] !== 'noguide';

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

const faultsFile = path.join(os.tmpdir(), `fuzz_faults_${process.pid}.jsonl`);
const findingsFile = path.join(os.tmpdir(), `fuzz_findings_${process.pid}.jsonl`);
ScriptFaults.enableForTesting(faultsFile);
// Coverage is what steers the run (BotFuzzer.preferUncovered) as well as what it is judged by, so
// it goes on before the world boots - the login and startup scripts count too.
ScriptCoverage.enable();
// custom (2026-11-02) - and the dead-op collector. The fuzzer's new watcher feeds it, and the
// engine's own defaultOp feeds it from every other direction, so this run leaves behind the list of
// options nothing answered as well as the list of things that broke.
DeadOps.enableForTesting(path.join(os.tmpdir(), `fuzz_deadops_${process.pid}.jsonl`));

await H.boot();

console.log('THE SAFETY GUARD');
// A fuzzer on a live world is a griefing tool: it drops things, fires quest triggers and pulls every
// monster it can see, under an account nobody is holding. These two refusals are the whole defence.
(Environment as { NODE_BOTS_FUZZ: boolean }).NODE_BOTS_FUZZ = false;
check('off unless NODE_BOTS_FUZZ is set', BotManager.startFuzzers(1, SEED).length > 0, true);
(Environment as { NODE_BOTS_FUZZ: boolean }).NODE_BOTS_FUZZ = true;
(Environment as { NODE_PRODUCTION: boolean }).NODE_PRODUCTION = true;
check('refuses on a production world', BotManager.startFuzzers(1, SEED), 'refusing: NODE_PRODUCTION is true. The fuzzer only runs on a development world.');
(Environment as { NODE_PRODUCTION: boolean }).NODE_PRODUCTION = false;

(Environment as { NODE_BOTS: boolean }).NODE_BOTS = true;
const cfg = structuredClone(DEFAULT_BOT_CONFIG);
cfg.roamers = { low: 0, mid: 0, high: 0, max: 0 };
cfg.pkers = { low: 0, mid: 0, high: 0, max: 0 };
BotManager.start(cfg);

const visitor = H.makePlayer('fuzzvisitor', 3200, 3200);
H.tick(2);
check('refuses around a player who is not staff', BotManager.startFuzzers(1, SEED).includes('is in the world and is not staff'), true);
H.despawn(visitor);
H.tick(2);

console.log('\nTHE RUN');
(Environment as { NODE_BOTS_FUZZ_FILE: string }).NODE_BOTS_FUZZ_FILE = findingsFile;
const why = BotManager.startFuzzers(COUNT, SEED, { x: AT[0], z: AT[1], level: AT[2] ?? 0 });
check('started', why, '');
H.tick(10);
const bots = () => [...World.playerLoop.all()].filter(p => p.isBot) as BotPlayer[];
check(`${COUNT} fuzzers in the world`, bots().length, COUNT);

const started = Date.now();
const actions = new Map<string, number>();
let lastPrint = 0;
for (let t = 0; t < TICKS; t++) {
    H.tick(1);
    for (const bot of bots()) {
        const what = BotManager.stateOf(bot)?.lastAction ?? '';
        const kind = what.split(' ')[0] || 'idle';
        actions.set(kind, (actions.get(kind) ?? 0) + 1);
    }
    if (t - lastPrint >= 500) {
        lastPrint = t;
        console.log(`  t${World.currentTick}: ${findings.size()} findings, ${ScriptFaults.size()} script faults, ${ScriptCoverage.summary().executed} triggers reached`);
    }
}
const seconds = ((Date.now() - started) / 1000).toFixed(1);

console.log(`\nWHAT ${COUNT} FUZZERS DID IN ${TICKS} TICKS (${seconds}s wall, seed ${SEED}, from ${AT.join(',')}, coverage-guided: ${fuzzTuning.coverageGuided})`);
for (const [kind, n] of [...actions.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${String(n).padStart(6)}  ${kind}`);
}

console.log('\nWATCHER FINDINGS');
if (findings.size() === 0) {
    console.log('  none.');
} else {
    for (const f of findings.all()) {
        console.log(`  ${f.sig} [${f.kind}] x${f.count} ${f.detail}`);
        console.log(`     replay: seed ${f.seed}, ${f.bot}, tick ${f.tick}`);
        for (const step of f.trail.slice(-8)) {
            console.log(`       ${step}`);
        }
    }
}

console.log('\nOPTIONS NOTHING ANSWERED');
// WHY THIS SECTION EXISTS. These are what the owner has been reporting by hand as "it says nothing
// interesting happens". Every one of them was being printed to a bot, by the engine, and thrown
// away - BotPlayer keeps a 16-entry message ring and nothing read it. See watchDeadInteraction.
//
// A fuzz run reaches whatever it happened to walk past, which is a fraction of the total. The whole
// list, for the whole game, without a bot: npx tsx tools/sim/opsweep.ts
if (DeadOps.size() === 0) {
    console.log('  none - which for a 15,000-trigger build means the bots did not get far.');
} else {
    const rows = DeadOps.all();
    const noTrigger = rows.filter(r => r.kind === 'notrigger');
    const combo = rows.filter(r => r.kind === 'combo');
    const filler = rows.filter(r => r.kind === 'filler');

    // THE THREE BUCKETS ARE NOT EQUALLY INTERESTING and are printed worst-first so the list reads
    // as a work queue. A labelled option with no script is always wrong. A use-on with no handler
    // usually is not - nothing advertises "cast Water Blast at a banker".
    console.log(`  ${noTrigger.length} LABELLED options with no script behind them - every one of these is a bug`);
    for (const row of noTrigger.slice(0, 30)) {
        console.log(`  x${String(row.count).padStart(4)} [${row.trigger},${row.target}]  first at ${row.where}`);
    }
    if (noTrigger.length > 30) {
        console.log(`  ... and ${noTrigger.length - 30} more`);
    }

    console.log(`\n  ${combo.length} use-on / cast-on subjects with no handler at all - read these the other way round:`);
    console.log('  no [opheldu,x] means x cannot be used on anything in the game; most of the rest is just');
    console.log('  a spell meeting an npc that was never meant to answer it.');
    for (const row of combo.slice(0, 12)) {
        console.log(`  x${String(row.count).padStart(4)} [${row.trigger},${row.target}]`);
    }
    if (combo.length > 12) {
        console.log(`  ... and ${combo.length - 12} more`);
    }

    console.log(`\n  ${filler.length} where a trigger DID run and still had nothing to say - a missing branch or recipe:`);
    for (const row of filler.slice(0, 12)) {
        console.log(`  x${String(row.count).padStart(4)} ${row.target}`);
    }
    if (filler.length > 12) {
        console.log(`  ... and ${filler.length - 12} more`);
    }
    // Left on disk on purpose, unlike the findings and faults files below: this one is a work
    // queue somebody reads afterwards, not a pass/fail.
    console.log(`  full list: ${DeadOps.flush()}`);
}

console.log('\nSCRIPT FAULTS');
if (ScriptFaults.size() === 0) {
    console.log('  none.');
} else {
    for (const f of ScriptFaults.top(30)) {
        console.log(`  ${f.sig} x${f.count} [${f.kind}${f.npc ? ' ' + f.npc : ''}] ${f.message}`);
        for (let i = 0; i < f.frames.length; i++) {
            console.log(`      ${i + 1}: ${f.frames[i].trigger} - ${f.frames[i].file}:${f.frames[i].line}`);
        }
    }
}

console.log('\nTRIGGER COVERAGE');
const cov = ScriptCoverage.summary();
console.log(`  ${cov.executed}/${cov.total} of this build's triggers have run in this process (${((cov.executed / Math.max(1, cov.total)) * 100).toFixed(1)}%)`);
console.log(`  ${cov.total - cov.executed} have never run - nothing in the world, no sim and no player has reached them`);
console.log(`  full list: ${ScriptCoverage.write(path.join(os.tmpdir(), `fuzz_coverage_${process.pid}.txt`))}`);

fs.rmSync(faultsFile, { force: true });
fs.rmSync(findingsFile, { force: true });
console.log(`\n${ok} ok, ${bad} FAILED`);
process.exit(bad ? 1 : 0);
