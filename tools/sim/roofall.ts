// FAILING A ROOFTOP OBSTACLE, on the real engine, with the roll pinned both ways.
//
// Eleven obstacles across eight courses can be failed, and until now none of them could: three
// courses rolled ^*_mark_chance - the MARK OF GRACE constant - and took a few hitpoints where the
// player stood, after the crossing had already paid out, and the other five had nothing at all.
// Old School drops you: "failing the obstacle will drop the player below, requiring them to start
// the course over".
//
// stat_random's roll is floor(nextDouble() * 256) and success is `value > roll`, so one pinned
// nextDouble decides every attempt in this file:
//
//   0.00 -> roll 0   -> every attempt SUCCEEDS, which is how the lap is replayed up to the
//                       obstacle under test without an earlier failable one throwing it off
//   0.99 -> roll 253 -> every attempt at the entry level FAILS, because the value there is 225
//
// and the same pin fixes the damage, since that is `hit_low + random(hit_span)`.
//
// Six questions per obstacle, and the last two are the ones that make the published stop level
// mean something rather than being a comment:
//
//   it ended on the fall tile the constant names
//   that tile is not thin air
//   it cost hitpoints, inside the published range
//   it paid NO experience ("XP on failure: 0 xp")
//   the lap counter went back to nothing
//   and one level below the stop level it still fails, while AT the stop level the same pinned
//   roll gets across - which is the whole claim of the two numbers in the constant file
//
//   npx tsx tools/sim/roofall.ts [course]
import { readFileSync } from 'fs';

import * as H from './harness.ts';
import * as A from './a1lib.ts';
import { COURSES } from './courses.ts';
import { thinAir } from './mapfloor.ts';
import { check, R, player } from './a1lib.ts';
import JavaRandom from '#/util/JavaRandom.js';
import VarPlayerType from '#/cache/config/VarPlayerType.js';
import { getExpByLevel } from '#/engine/entity/Player.js';

await H.boot();

// ---------------------------------------------------------------- the constant files
const K: Record<string, number> = {};
const C: Record<string, [number, number, number]> = {};
for (const course of COURSES) {
    const text = readFileSync(`../content/scripts/skill_agility/configs/${course.key}_course.constant`, 'utf8');
    for (const line of text.split(/\r?\n/)) {
        let m = /^\^(\w+)\s*=\s*(\d+)_(\d+)_(\d+)_(\d+)_(\d+)/.exec(line);
        if (m) {
            C[m[1]] = [Number(m[3]) * 64 + Number(m[5]), Number(m[4]) * 64 + Number(m[6]), Number(m[2])];
            continue;
        }
        m = /^\^(\w+)\s*=\s*(-?\d+)\s*(?:\/\/.*)?$/.exec(line);
        if (m) K[m[1]] = Number(m[2]);
    }
}

const AGILITY = 16;
const HITPOINTS = 3;

const origND = JavaRandom.nextDouble.bind(JavaRandom);
const pin = (v: number | null) => {
    (JavaRandom as unknown as { nextDouble: () => number }).nextDouble = v === null ? origND : () => v;
};

/**
 * THE HIGHEST ROLL THERE IS. floor(0.999 * 256) is 255, and success is `value > roll`, so this
 * fails every attempt whose value is 255 or less and succeeds only where the value has reached
 * 256 - which is exactly the question "is this level still failable".
 *
 * 0.99 is NOT enough and cost an hour: it rolls 253, so at one level below the stop level, where
 * the value is 255, the attempt sails through and the course looks like it stops failing early.
 */
const ALWAYS_FAIL = 0.999;
const ALWAYS_PASS = 0;

/**
 * SET A LEVEL BY SETTING THE EXPERIENCE. Writing levels[] alone does not hold: the first
 * ~agility_xp recomputes the level from the experience total, so a player put at 40 the lazy way
 * is back to level 1 the moment an obstacle pays out, and every roll after that is a different
 * curve. stats[] is in TENTHS, which is what getExpByLevel already returns.
 */
function setAgility(p: any, level: number) {
    p.stats[AGILITY] = level <= 1 ? 0 : getExpByLevel(level);
    p.baseLevels[AGILITY] = level;
    p.levels[AGILITY] = level;
}

/** What stat_random works out at this level, which is the pass chance out of 256. */
const curve = (low: number, high: number, level: number) =>
    Math.floor((low * (99 - level)) / 98) + Math.floor((high * (level - 1)) / 98) + 1;

/**
 * Put the player at the obstacle, by replaying the lap to it with every roll pinned to succeed.
 * Returns false when the replay did not get there, which is a finding in itself.
 */
function approach(p: any, course: (typeof COURSES)[number], upto: number): boolean {
    pin(ALWAYS_PASS);
    let prev: [number, number, number] = course.start;
    for (let i = 0; i < upto; i++) {
        const o = course.obstacles[i];
        p.teleport(prev[0], prev[1], prev[2]);
        H.tick(1);
        try {
            A.op(p, o.x, o.z, o.loc, 1);
        } catch {
            return false;
        }
        H.tick(40);
        prev = [p.x, p.z, p.level];
        const want = C[o.land];
        if (!want || prev.join(',') !== want.join(',')) return false;
    }
    p.teleport(prev[0], prev[1], prev[2]);
    H.tick(1);
    return true;
}

const only = process.argv[2];
for (const course of COURSES) {
    if (only && only !== course.key) continue;
    const failable = course.obstacles.map((o, i) => ({ o, i })).filter(({ o }) => o.fail);
    if (!failable.length) continue;

    const [low, high] = course.failRoll!;
    const stop = course.failStop!;
    console.log(
        `\n================ ${course.title}  (agility ${course.level}, stops failing at ${stop}, ` +
            `${curve(low, high, course.level)}/256 at the entry level)`
    );

    // THE CURVE ITSELF, as arithmetic, before anybody runs anything. Two numbers in a constant file
    // are a claim about two levels, and this is that claim.
    console.log('  the two numbers are the published curve');
    check(`    failable at ${stop - 1} (${curve(low, high, stop - 1)}/256)`, curve(low, high, stop - 1) < 256, true);
    check(`    and impossible at ${stop} (${curve(low, high, stop)}/256)`, curve(low, high, stop) >= 256, true);

    for (const { o, i } of failable) {
        const fall = C[o.fail!.land];
        const [dmgLow, dmgHigh] = o.fail!.dmg;
        console.log(`  ${o.name} - falls to ${o.fail!.land}`);
        check(`    ${o.fail!.land} is written down`, fall ? 'yes' : 'MISSING', 'yes');
        if (!fall) continue;
        check(`    ${fall[0]},${fall[1]} L${fall[2]} is not thin air`, !thinAir(fall[0], fall[1], fall[2]), true);

        const p: any = player(`fall_${course.key}_${i}`, course.start[0], course.start[1], course.start[2]);
        H.setVar(p, 'tutorial', 1000);
        setAgility(p, course.level);
        p.baseLevels[HITPOINTS] = 99;
        p.levels[HITPOINTS] = 99;

        if (!approach(p, course, i)) {
            pin(null);
            check(`    the lap reaches it`, 'no', 'yes');
            H.despawn(p);
            continue;
        }

        // AND BACK TO THE ENTRY LEVEL. The approach paid out three or four obstacles' experience,
        // which moves the level, and the level is the thing under test.
        setAgility(p, course.level);

        const prog = () => p.getVar(VarPlayerType.getByName(`${course.key}_course_progress`)!.id);
        const xpBefore = p.stats[AGILITY];
        const hpBefore = p.levels[HITPOINTS];
        const progBefore = prog();

        pin(ALWAYS_FAIL);
        A.op(p, o.x, o.z, o.loc, 1);
        H.tick(12);
        pin(null);

        const at: [number, number, number] = [p.x, p.z, p.level];
        check(`    it dropped to ${at.join(',')}`, at.join(','), fall.join(','));
        const lost = hpBefore - p.levels[HITPOINTS];
        check(`    it cost ${lost} hitpoints (${dmgLow}-${dmgHigh})`, lost >= dmgLow && lost <= dmgHigh, true);
        check('    it paid no experience', p.stats[AGILITY] - xpBefore, 0);
        check(`    and the lap counter went back (was ${progBefore})`, prog(), 0);

        // THE STOP LEVEL, both sides of it. Same pinned roll, one level apart: the only thing that
        // changes is the level, so anything that changes in the outcome is the curve working.
        for (const [level, want] of [
            [stop - 1, 'falls'],
            [stop, 'gets across']
        ] as const) {
            setAgility(p, level);
            p.levels[HITPOINTS] = 99;
            if (!approach(p, course, i)) {
                pin(null);
                check(`    at ${level} the lap reaches it`, 'no', 'yes');
                continue;
            }
            setAgility(p, level);
            pin(ALWAYS_FAIL);
            A.op(p, o.x, o.z, o.loc, 1);
            H.tick(12);
            pin(null);
            const here: [number, number, number] = [p.x, p.z, p.level];
            const fell = here.join(',') === fall.join(',');
            check(`    at ${level} agility it ${want}`, fell ? 'falls' : here.join(',') === (C[o.land] ?? []).join(',') ? 'gets across' : 'ended at ' + here.join(','), want);
        }

        H.despawn(p);
    }
}

console.log(`\n${R.ok} ok, ${R.bad} FAIL`);
process.exit(R.bad ? 1 : 0);
