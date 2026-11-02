// MARKS OF GRACE: the published rate, the three-minute gate and the twenty-levels-over penalty.
//
// The nine rooftop courses used to roll a flat 1/4 at lap completion, the same on every course
// and the same whatever your level. Old School's "Spawning mechanics" gives three rules instead:
//
//   2/3 on Canifis and Ardougne, 2/5 on Rellekka, 2/6 everywhere else
//   rolled only "upon completing a lap after the timer has expired" - three minutes from the last
//     mark that SPAWNED, not from the last lap
//   and a fifth of the rate once the UNBOOSTED level is 20 or more over the course requirement,
//     except on Canifis, where a Jagex coding error leaves the penalty off
//
// Measured rather than asserted from the source: ~agility_mark_roll is called directly, many
// times, with the cooldown cleared between rolls where the rate is what is being measured, and
// left alone where the gate is. A rate is checked as a band, because 4000 rolls of a 1/3 do not
// land on 1333.
//
//   npx tsx tools/sim/marksofgrace.ts
import { readFileSync } from 'fs';

import * as H from './harness.ts';
import * as A from './a1lib.ts';
import { COURSES } from './courses.ts';
import { check, R, player } from './a1lib.ts';
import VarPlayerType from '#/cache/config/VarPlayerType.js';
import { getExpByLevel } from '#/engine/entity/Player.js';

await H.boot();

const AGILITY = 16;

// ---------------------------------------------------------------- the constants as written
const K: Record<string, number> = {};
for (const name of [...COURSES.map(c => `${c.key}_course`), 'marks']) {
    let text = '';
    try {
        text = readFileSync(`../content/scripts/skill_agility/configs/${name}.constant`, 'utf8');
    } catch {
        continue;
    }
    for (const line of text.split(/\r?\n/)) {
        const m = /^\^(\w+)\s*=\s*(-?\d+)\s*(?:\/\/.*)?$/.exec(line);
        if (m) K[m[1]] = Number(m[2]);
    }
}

const COOLDOWN = VarPlayerType.getByName('mark_grace_cooldown')!.id;

function setAgility(p: any, level: number) {
    p.stats[AGILITY] = level <= 1 ? 0 : getExpByLevel(level);
    p.baseLevels[AGILITY] = level;
    p.levels[AGILITY] = level;
}

/** Roll n times, clearing the cooldown each time, and say how many marks came out. */
function rate(p: any, course: string, req: number, penalty: boolean, n: number): number {
    const num = K[`${course}_mark_num`];
    const den = K[`${course}_mark_den`];
    let got = 0;
    for (let i = 0; i < n; i++) {
        p.setVar(COOLDOWN, 0);
        H.clearInv(p);
        const before = H.invCount(p, 'mark_of_grace');
        A.runProcProtected(p, '[proc,agility_mark_roll]', [num, den, req, penalty ? 1 : 0]);
        if (H.invCount(p, 'mark_of_grace') > before) got++;
    }
    return got;
}

const band = (got: number, n: number, want: number, slack = 0.05) => `${got}/${n} (${(got / n).toFixed(3)}, wanted ~${want.toFixed(3)})` + (Math.abs(got / n - want) <= slack ? '' : '  <- OUTSIDE ' + slack);

const N = 4000;
const p: any = player('marks', 3221, 3416, 0);
H.setVar(p, 'tutorial', 1000);

console.log('\n================ THE PUBLISHED RATE, at the course requirement');
for (const c of COURSES) {
    const req = K[`${c.key}_level`] ?? 1;
    const num = K[`${c.key}_mark_num`];
    const den = K[`${c.key}_mark_den`];
    check(`  ${c.key.padEnd(13)} is written down`, num && den ? 'yes' : 'MISSING', 'yes');
    if (!num || !den) continue;
    setAgility(p, req);
    const got = rate(p, c.key, req, c.key !== 'canifis', N);
    const want = num / den;
    check(`  ${c.key.padEnd(13)} ${num}/${den}  ${band(got, N, want)}`, Math.abs(got / N - want) <= 0.05, true);
}

console.log('\n================ AND A FIFTH OF IT, 20 LEVELS OVER');
//
// EXCEPT WHERE 20 OVER IS PAST 99. Rellekka needs 100 to be nerfed and Ardougne needs 110, so
// neither ever is - which is Mod Ash's "unless you get to level 110, Ardougne isn't nerfed", and
// half the reason the top courses stay worth running. Canifis is exempt for a different reason: a
// coding error. This test asserted a penalty on all three and was wrong about all three.
for (const c of COURSES) {
    const req = K[`${c.key}_level`] ?? 1;
    const num = K[`${c.key}_mark_num`];
    const den = K[`${c.key}_mark_den`];
    if (!num || !den) continue;
    const exempt = c.key === 'canifis';
    const unreachable = req + K.mark_grace_over > 99;
    // AT the threshold, because the wiki says "20 levels or MORE over", not more than 20
    const at = Math.min(99, req + K.mark_grace_over);
    setAgility(p, at);
    const got = rate(p, c.key, req, !exempt, N);
    const full = exempt || unreachable;
    const want = full ? num / den : num / (den * K.mark_grace_penalty);
    const why = exempt ? '  - exempt, the Canifis coding error' : unreachable ? `  - full rate: the penalty needs ${req + K.mark_grace_over}, which is past 99` : '';
    check(`  ${c.key.padEnd(13)} at ${String(at).padStart(2)} (${req} + 20)  ${band(got, N, want)}${why}`, Math.abs(got / N - want) <= 0.05, true);
}

console.log('\n================ ONE LEVEL SHORT OF THE THRESHOLD IS STILL FULL RATE');
{
    const req = K.falador_level;
    setAgility(p, req + 19);
    const got = rate(p, 'falador', req, true, N);
    const want = K.falador_mark_num / K.falador_mark_den;
    check(`  falador at ${req + 19} (${req} + 19)  ${band(got, N, want)}`, Math.abs(got / N - want) <= 0.05, true);
}

console.log('\n================ THE BOOST DOES NOT COUNT, ONLY THE BASE LEVEL');
{
    const req = K.falador_level;
    setAgility(p, req);
    p.levels[AGILITY] = req + 25; // boosted well over the threshold, base still at the requirement
    const got = rate(p, 'falador', req, true, N);
    const want = K.falador_mark_num / K.falador_mark_den;
    check(`  falador boosted to ${req + 25}, base ${req}  ${band(got, N, want)}`, Math.abs(got / N - want) <= 0.05, true);
    setAgility(p, req);
}

console.log('\n================ THE THREE-MINUTE GATE');
{
    setAgility(p, K.canifis_level);
    const num = K.canifis_mark_num;
    const den = K.canifis_mark_den;
    const roll = () => {
        H.clearInv(p);
        const before = H.invCount(p, 'mark_of_grace');
        A.runProcProtected(p, '[proc,agility_mark_roll]', [num, den, K.canifis_level, 0]);
        return H.invCount(p, 'mark_of_grace') > before;
    };

    // roll until one lands, which sets the cooldown
    p.setVar(COOLDOWN, 0);
    let spawned = false;
    for (let i = 0; i < 200 && !spawned; i++) spawned = roll();
    check('  a mark spawns at all', spawned, true);
    const deadline = p.getVar(COOLDOWN);
    check(`  and it set the timer ${K.mark_grace_wait} ticks out (3 minutes)`, deadline > 0, true);

    // and now nothing lands until it expires, however many laps are run
    let during = 0;
    for (let i = 0; i < 400; i++) if (roll()) during++;
    check(`  400 more laps inside the timer give nothing (${during})`, during, 0);

    // step past the deadline and it pays again
    p.setVar(COOLDOWN, 1);
    let after = 0;
    for (let i = 0; i < 200 && after === 0; i++) if (roll()) after++;
    check('  and once it expires a mark can spawn again', after > 0, true);
}

console.log('\n================ A DEADLINE FROM BEFORE A RESTART DOES NOT LOCK IT OUT');
{
    // map_clock restarts at 0 with the world, so a saved deadline can sit far in the future
    setAgility(p, K.canifis_level);
    p.setVar(COOLDOWN, 9_000_000);
    let got = 0;
    for (let i = 0; i < 200 && got === 0; i++) {
        H.clearInv(p);
        const before = H.invCount(p, 'mark_of_grace');
        A.runProcProtected(p, '[proc,agility_mark_roll]', [K.canifis_mark_num, K.canifis_mark_den, K.canifis_level, 0]);
        if (H.invCount(p, 'mark_of_grace') > before) got++;
    }
    check('  a stale deadline is ignored rather than switching marks off for ever', got > 0, true);
}

console.log('\n================ A FULL PACK DOES NOT BUY ANOTHER ROLL');
{
    setAgility(p, K.canifis_level);
    p.setVar(COOLDOWN, 0);
    H.fillInv(p);
    let spawned = false;
    for (let i = 0; i < 200 && !spawned; i++) {
        const was = p.getVar(COOLDOWN);
        A.runProcProtected(p, '[proc,agility_mark_roll]', [K.canifis_mark_num, K.canifis_mark_den, K.canifis_level, 0]);
        if (p.getVar(COOLDOWN) !== was) spawned = true;
    }
    check('  the timer is set by the SPAWN, not by the pickup', spawned, true);
    H.clearInv(p);
}

H.despawn(p);
console.log(`\n${R.ok} ok, ${R.bad} FAIL`);
process.exit(R.bad ? 1 : 0);
