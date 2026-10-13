// FARMING GROWTH TIMES - suggestion #22, "reducing farming patch times".
//
//   npx tsx tools/sim/farmgrowth.ts
//
// WHAT THE CHANGE IS. Every seed's farming_stages and farming_cycle in the cache are Old School's
// own numbers and stay that way; the reduction is applied when the growth clock is read, by
// ~farming_growth_minutes, against a per-family divisor in content's farming_growth.enum. So the
// authentic figure and the live figure are both present at runtime, which is what lets this file
// hold one against the other rather than against a list typed out by hand.
//
// THE RULE, stated once here and once in the enum: halve every family whose longest crop takes
// more than three hours. The first thing checked is that the enum IS that rule - that no family
// over three hours was missed and none under it was caught - because a divisor table is otherwise
// just seven numbers somebody chose.
//
// AND THE TWO THINGS THAT WOULD GO WRONG QUIETLY:
//
//   THE TIER LADDERS. Within a family the crops are a ladder - oak, willow, maple, yew, magic -
//   and anything that halves by total time rather than by family reorders it: a maple at 5.3 hours
//   would halve while a willow at 4 hours would not, and the lower tree would finish last. Every
//   family's ordering is compared against the authentic ordering, crop by crop.
//
//   THE CALL SITE. ~farming_growth_minutes being right is not the same as the growth engine
//   calling it, which is the same class of bug as a skill perk wired into the wrong branch. So a
//   fruit tree is planted and the clock moved back by hand: it must advance a stage at 80 minutes
//   and not at 79, where Old School's own 160 would have moved nothing.
//
// Produce regrowth is deliberately NOT reduced - a grown fruit tree still puts a fruit back every
// 40 minutes - and that is checked too, because halving both would have been a yield change
// wearing a growth change as a disguise.
import fs from 'fs';

import * as H from './harness.js';
import EnumType from '#/cache/config/EnumType.js';
import ObjType from '#/cache/config/ObjType.js';
import ParamType from '#/cache/config/ParamType.js';
import Player from '#/engine/entity/Player.js';
import ScriptProvider from '#/engine/script/ScriptProvider.js';
import ScriptRunner from '#/engine/script/ScriptRunner.js';
import { ProtectedActivePlayer } from '#/engine/script/ScriptPointer.js';
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

const P_STAGES = ParamType.getId('farming_stages');
const P_CYCLE = ParamType.getId('farming_cycle');
const P_FAMILY = ParamType.getId('farming_family');
const P_CROP = ParamType.getId('farming_crop');
const THREE_HOURS = 180;

/** The content constants, read back by name so renumbering cannot make this sim test nothing. */
const CONST = fs.readFileSync(`${Environment.BUILD_SRC_DIR}/scripts/skill_farming/configs/farming.constant`, 'utf8');
const constant = (name: string): number => {
    const m = CONST.match(new RegExp('\\^' + name + '\\s*=\\s*(-?\\d+)'));
    if (!m) throw new Error('no such constant: ' + name);
    return parseInt(m[1], 10);
};
const FAMILY = Object.fromEntries(['allotment', 'hops', 'flower', 'herb', 'bush', 'tree', 'fruit_tree', 'cactus', 'calquat', 'mushroom', 'belladonna', 'spirit_tree'].map(n => [n, constant('farming_family_' + n)])) as Record<string, number>;
const familyName = (id: number) => Object.keys(FAMILY).find(k => FAMILY[k] === id) ?? `family ${id}`;

/** Every seed the cache gives a growth cycle, with its authentic numbers. */
type Seed = { obj: number; name: string; family: number; stages: number; cycle: number };
const SEEDS: Seed[] = [];
for (const [name, id] of ObjType.configNames) {
    const t = ObjType.get(id);
    const cycle = t.params.get(P_CYCLE);
    const stages = t.params.get(P_STAGES);
    const family = t.params.get(P_FAMILY);
    if (typeof cycle !== 'number' || typeof stages !== 'number' || typeof family !== 'number') continue;
    if (stages < 1) continue; // the scarecrow, which is placed rather than grown
    SEEDS.push({ obj: id, name: String(name), family, stages, cycle });
}

const p: Player = H.makePlayer('farmer', 3222, 3218, 1);
H.tick(2);
H.maxOut(p);
H.clearInv(p);

function runProtected(name: string, args: unknown[] = []): number[] {
    const script = ScriptProvider.getByName(name);
    if (!script) throw new Error('no such script: ' + name);
    const was = p.protect;
    p.protect = true;
    const state = ScriptRunner.init(script, p, null, args as never[]);
    for (const ptr of ProtectedActivePlayer) state.pointerAdd(ptr);
    ScriptRunner.execute(state);
    p.protect = was;
    return (state as unknown as { intStack: number[]; isp: number }).intStack.slice(0, (state as unknown as { isp: number }).isp);
}
const growthMinutes = (s: Seed) => runProtected('[proc,farming_growth_minutes]', [s.obj])[0];
const regrowMinutes = (s: Seed) => runProtected('[proc,farming_regrow_minutes]', [s.obj])[0];

// ============================================================ 1. the enum is the stated rule
console.log('== the divisor table is "halve every family over three hours", and nothing else');
{
    const divisors = EnumType.get(EnumType.getId('farming_family_growth_divisor'));
    const longest = new Map<number, number>();
    for (const s of SEEDS) longest.set(s.family, Math.max(longest.get(s.family) ?? 0, s.stages * s.cycle));

    const wrong: string[] = [];
    for (const [family, top] of longest) {
        const d = (divisors.values.get(family) as number) ?? 1;
        const want = top > THREE_HOURS ? 2 : 1;
        if (d !== want) wrong.push(`${familyName(family)} tops out at ${top}m and has divisor ${d}, not ${want}`);
    }
    check('every family divides by 2 if and only if its longest crop is over 3 hours', wrong, []);
    check(
        'which is these seven and no others',
        [...longest.keys()]
            .filter(f => ((divisors.values.get(f) as number) ?? 1) !== 1)
            .map(familyName)
            .sort(),
        ['belladonna', 'cactus', 'calquat', 'fruit_tree', 'mushroom', 'spirit_tree', 'tree']
    );
    // A divisor of 0 would be a division by zero in the proc. It floors at 1, but the table should
    // not be relying on that.
    check(
        'and no divisor is zero or negative',
        [...divisors.values.values()].filter(v => (v as number) < 1),
        []
    );
}

// ============================================================ 2. the proc agrees with the table
console.log('== and the proc returns exactly the table applied to the cache');
{
    const divisors = EnumType.get(EnumType.getId('farming_family_growth_divisor'));
    const wrong: string[] = [];
    for (const s of SEEDS) {
        const d = (divisors.values.get(s.family) as number) ?? 1;
        const want = Math.max(1, Math.floor(s.cycle / d));
        const got = growthMinutes(s);
        if (got !== want) wrong.push(`${s.name}: ${got}m per cycle, not ${want}m`);
    }
    check(`all ${SEEDS.length} seeds`, wrong, []);
}

// ============================================================ 3. nothing short moved
console.log('== the farm run is untouched: flowers, allotments, hops and herbs');
{
    const SHORT = [FAMILY.allotment, FAMILY.hops, FAMILY.flower, FAMILY.herb, FAMILY.bush];
    const moved: string[] = [];
    for (const s of SEEDS) {
        if (!SHORT.includes(s.family)) continue;
        if (growthMinutes(s) !== s.cycle) moved.push(`${s.name} (${familyName(s.family)})`);
    }
    check('every crop in the five short families still takes exactly as long as Old School', moved, []);
    // The 80-minute heartbeat a farm run is planned around, named rather than implied.
    const herb = SEEDS.find(s => s.name === 'guam_seed')!;
    check('a herb is still 80 minutes', growthMinutes(herb) * herb.stages, 80);
    const potato = SEEDS.find(s => s.name === 'potato_seed')!;
    check('and a potato still 40', growthMinutes(potato) * potato.stages, 40);
}

// ============================================================ 4. the tier ladders survived
console.log('== and no family reordered itself');
{
    const byFamily = new Map<number, Seed[]>();
    for (const s of SEEDS) {
        if (!byFamily.has(s.family)) byFamily.set(s.family, []);
        byFamily.get(s.family)!.push(s);
    }
    const reordered: string[] = [];
    for (const [family, seeds] of byFamily) {
        const authentic = [...seeds].sort((a, b) => a.stages * a.cycle - b.stages * b.cycle || a.name.localeCompare(b.name)).map(s => s.name);
        const live = [...seeds].sort((a, b) => a.stages * growthMinutes(a) - b.stages * growthMinutes(b) || a.name.localeCompare(b.name)).map(s => s.name);
        if (JSON.stringify(authentic) !== JSON.stringify(live)) reordered.push(familyName(family));
    }
    check('every family grows in the same order it always did', reordered, []);
    // The tree ladder written out, because it is the one with five rungs and the one a per-crop
    // rule would have broken.
    const trees = SEEDS.filter(s => s.family === FAMILY.tree)
        .map(s => ({ n: s.name.replace('plantpot_', '').replace('_sapling', ''), m: s.stages * growthMinutes(s) }))
        .sort((a, b) => a.m - b.m);
    check(
        'oak, willow, maple, yew, magic - in that order, at half their old times',
        trees.map(t => `${t.n} ${t.m}m`),
        ['oak 80m', 'willow 120m', 'maple 160m', 'yew 200m', 'magic_tree 240m']
    );
}

// ============================================================ 5. the headline numbers
console.log("== the figures the enum's own comment quotes");
{
    const total = (name: string) => {
        const s = SEEDS.find(x => x.name === name)!;
        return s.stages * growthMinutes(s);
    };
    check('a fruit tree: 16 hours becomes 8', [total('plantpot_apple_sapling'), 8 * 60], [480, 480]);
    check('a calquat: 21.3 becomes 10.7', total('plantpot_calquat_sapling'), 640);
    check('a spirit tree: 64 becomes 32', total('plantpot_spirit_tree_sapling'), 1920);
    check('a cactus: 9.3 becomes 4.7', total('cactus_seed'), 280);
    check('belladonna: 5.3 becomes 2.7', total('belladonna_seed'), 160);
    check('a mushroom: 4 becomes 2', total('mushroom_seed'), 120);
}

// ============================================================ 6. produce regrowth is untouched
console.log("== but a grown plant still pays at Old School's rate");
{
    const wrong: string[] = [];
    for (const s of SEEDS) {
        const want = s.family === FAMILY.bush ? s.cycle : Math.max(1, Math.floor(s.cycle / 4));
        const got = regrowMinutes(s);
        if (got !== want) wrong.push(`${s.name}: a ${got}m regrow, not ${want}m`);
    }
    check('every regrow is the raw cycle, not the reduced one', wrong, []);
    const apple = SEEDS.find(s => s.name === 'plantpot_apple_sapling')!;
    check('a fruit tree still puts a fruit back every 40 minutes', regrowMinutes(apple), 40);
    const jang = SEEDS.find(s => s.name === 'jangerberry_bush_seed')!;
    check('and a bush a berry every 20', regrowMinutes(jang), 20);
}

// ============================================================ 7. the growth engine calls it
console.log('== and the growth engine is actually using it');
{
    const HEALTHY = constant('farming_healthy');
    const FRUIT_PATCH = constant('farming_patch_fruit_tree_patch_1');
    const VEG_PATCH = constant('farming_patch_veg_patch_1');

    /** Plant $seed at stage 0 in $patch, $ago minutes ago, bring it up to date, return its stage. */
    const grownFor = (s: Seed, patch: number, ago: number): number => {
        runProtected('[proc,farming_set_crop_id]', [patch, ObjType.get(s.obj).params.get(P_CROP) as number]);
        // PAID THE FARMER, which is what makes a multi-cycle run deterministic: ~farming_disease_chance
        // returns 0 on a protected patch, so the plant cannot catch something and die halfway and
        // turn a growth-time test into a coin flip. Growth itself is not affected by it.
        runProtected('[proc,farming_set_protected]', [patch, 1]);
        runProtected('[proc,farming_set_state]', [patch, runProtected('[proc,farming_encode]', [s.obj, 0, HEALTHY, 0])[0]]);
        const now = runProtected('[proc,farming_now]')[0];
        runProtected('[proc,farming_set_time]', [patch, now - ago]);
        runProtected('[proc,farming_update]', [patch]);
        return runProtected('[proc,farming_decode]', [patch, s.obj])[0];
    };
    const clear = (patch: number) => runProtected('[proc,farming_set_crop_id]', [patch, 0]);

    const apple = SEEDS.find(s => s.name === 'plantpot_apple_sapling')!;
    check('a fruit tree has not moved after 79 minutes', grownFor(apple, FRUIT_PATCH, 79), 0);
    clear(FRUIT_PATCH);
    // 80, and not 160: under Old School's own cycle this sapling would still be at stage 0, so
    // this one assertion is the whole change, end to end.
    check('and has after 80, where Old School would have needed 160', grownFor(apple, FRUIT_PATCH, 80) >= 1, true);
    clear(FRUIT_PATCH);
    check('six cycles finish it', grownFor(apple, FRUIT_PATCH, 80 * 6) >= apple.stages, true);
    clear(FRUIT_PATCH);

    // And the untouched side of the same engine: a potato is still a potato.
    const potato = SEEDS.find(s => s.name === 'potato_seed')!;
    check('a potato has not moved after 9 minutes', grownFor(potato, VEG_PATCH, 9), 0);
    clear(VEG_PATCH);
    check('and has after 10, exactly as before', grownFor(potato, VEG_PATCH, 10) >= 1, true);
    clear(VEG_PATCH);
}

console.log('');
console.log(`${R.ok} passed, ${R.bad} failed`);
process.exit(R.bad ? 1 : 0);
