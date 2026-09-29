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
import ScriptFaults from '#/engine/script/ScriptFaults.js';

const argv = process.argv.slice(2);
const TICKS = parseInt(argv[0] ?? '') || 2000;
const COUNT = parseInt(argv[1] ?? '') || 4;
const SEED = parseInt(argv[2] ?? '') || 20260929;
const AT = (argv[3] ?? '3222,3218,0').split(',').map(n => parseInt(n));

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
        console.log(`  t${World.currentTick}: ${findings.size()} findings, ${ScriptFaults.size()} script faults`);
    }
}
const seconds = ((Date.now() - started) / 1000).toFixed(1);

console.log(`\nWHAT ${COUNT} FUZZERS DID IN ${TICKS} TICKS (${seconds}s wall, seed ${SEED}, from ${AT.join(',')})`);
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

fs.rmSync(faultsFile, { force: true });
fs.rmSync(findingsFile, { force: true });
console.log(`\n${ok} ok, ${bad} FAILED`);
process.exit(bad ? 1 : 0);
