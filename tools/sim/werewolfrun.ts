// A LAP OF THE WEREWOLF AGILITY COURSE, on the real engine.
//
// The map seals every stretch of this course into its own walkable pocket, so a lap is the only
// proof that matters: if any obstacle puts the player somewhere the next one cannot be reached
// from, the lap stops there and says so. The pockets, measured by werewolfland.ts, are
//
//   entry -> stones -> 84 -> hurdle -> 16 -> hurdle -> 15 -> hurdle -> 43 -> pipe -> 73
//         -> slope -> 14 -> zip line -> entry
//
// and the lap below walks exactly that, middle lane throughout, checking after every obstacle that
// the player is where the course says and that the experience paid is the wiki's.
import { readFileSync } from 'fs';

import * as H from './harness.ts';
import * as A from './a1lib.ts';
import { check, R, player } from './a1lib.ts';
import { thinAir } from './mapfloor.ts';
import { getExpByLevel } from '#/engine/entity/Player.js';
import World from '#/engine/World.js';
import ObjType from '#/cache/config/ObjType.js';
import JavaRandom from '#/util/JavaRandom.js';

await H.boot();

const AGILITY = 16;

const K: Record<string, number> = {};
const C: Record<string, [number, number, number]> = {};
for (const line of readFileSync('../content/scripts/skill_agility/configs/werewolf_course.constant', 'utf8').split(/\r?\n/)) {
    let m = /^\^(\w+)\s*=\s*(\d+)_(\d+)_(\d+)_(\d+)_(\d+)/.exec(line);
    if (m) {
        C[m[1]] = [Number(m[3]) * 64 + Number(m[5]), Number(m[4]) * 64 + Number(m[6]), Number(m[2])];
        continue;
    }
    m = /^\^(\w+)\s*=\s*(-?\d+)\s*(?:\/\/.*)?$/.exec(line);
    if (m) K[m[1]] = Number(m[2]);
}

function setAgility(p: any, level: number) {
    p.stats[AGILITY] = level <= 1 ? 0 : getExpByLevel(level);
    p.baseLevels[AGILITY] = level;
    p.levels[AGILITY] = level;
}

const at = (p: any) => `${p.x},${p.z}`;

// name, the loc to click, where it is, the x the player must end on (null = whichever lane they
// were in), the z, and what it should pay.
//
// THE LANE IS NOT FIXED AND MUST NOT BE ASSERTED. A hurdle keeps the player's own x - that is what
// makes one script serve all three lanes - so where they come out depends on which tile the engine
// walked them to, and the stones leave them at x 3540 rather than the middle lane's 3539. Pinning
// the x here failed a hurdle that had done exactly the right thing.
const LAP: [string, string, number, number, number | null, number, number][] = [
    ['stepping stones', 'loc_5138', 3538, 9875, 3540, 9882, K.werewolf_xp_stones],
    ['hurdle 1', 'loc_5133', 3539, 9893, null, 9894, K.werewolf_xp_hurdle],
    ['hurdle 2', 'loc_5133', 3539, 9896, null, 9897, K.werewolf_xp_hurdle],
    ['hurdle 3', 'loc_5133', 3539, 9899, null, 9900, K.werewolf_xp_hurdle],
    ['pipe', 'loc_5152', 3541, 9905, null, 9909, K.werewolf_xp_pipe],
    ['skull slope', 'loc_5136', 3532, 9910, 3531, null as unknown as number, K.werewolf_xp_slope],
    ['zip line', 'loc_5139', 3528, 9911, 3527, 9897, K.werewolf_xp_zip]
];

console.log('\n================ WEREWOLF AGILITY COURSE  (agility 60)');

console.log('\n  the obstacles are all on the map');
for (const [name, loc, lx, lz] of LAP) {
    const found = A.locsNamed(loc, lx - 1, lz - 1, lx + 1, lz + 1, [0]);
    check(`    ${name.padEnd(16)} ${loc} at ${lx},${lz}`, found.length > 0, true);
}

console.log('\n  and no landing is in thin air');
for (const [name, , lx, lz, ex, ez] of LAP) {
    const x = ex ?? lx;
    const z = ez ?? lz;
    check(`    ${name.padEnd(16)} ${x},${z}`, !thinAir(x, z, 0), true);
}

console.log('\n  a lap, middle lane throughout');
const p: any = player('werewolf_lap', 3538, 9873, 0);
H.setVar(p, 'tutorial', 1000);
setAgility(p, K.werewolf_level);
const before = p.stats[AGILITY];
let ok = true;
for (const [name, loc, lx, lz, ex, ez, xp] of LAP) {
    const was = p.stats[AGILITY];
    try {
        A.op(p, lx, lz, loc, 1);
    } catch (e) {
        // The real reason rather than a guess at it: A.op throws for a loc that is missing, on
        // another level, OR - since harness.opLoc started making OpLocHandler's check - for an op
        // the loc does not have. Three different causes were all reported as the middle one.
        console.log(`    ${name}: ${String((e as { message?: unknown })?.message ?? e)}`);
        ok = false;
        break;
    }
    H.tick(30);
    const wrongX = ex !== null && p.x !== ex;
    const wrongZ = ez !== null && p.z !== ez;
    if (wrongX || wrongZ) {
        console.log(`    ${name}: ended at ${at(p)}, expected ${ex ?? 'any'},${ez ?? 'any'}`);
        ok = false;
        break;
    }
    const paid = p.stats[AGILITY] - was;
    check(`    ${name.padEnd(16)} -> ${at(p)}, paid ${paid / 10}`, paid, xp);
}
check('    every obstacle put the player where the course says', ok, true);
if (ok) {
    check(`    and the five obstacles paid ${(K.werewolf_lap - K.werewolf_xp_stick) / 10}`, p.stats[AGILITY] - before, K.werewolf_lap - K.werewolf_xp_stick);
}

console.log('\n  the stones carry the player back as well as across');
{
    const q: any = player('werewolf_back', 3540, 9882, 0);
    H.setVar(q, 'tutorial', 1000);
    setAgility(q, K.werewolf_level);
    A.op(q, 3540, 9881, 'loc_5138', 1);
    H.tick(30);
    check(`    from the north bank -> ${at(q)}`, at(q), '3538,9873');
    H.despawn(q);
}

console.log('\n  and it is shut to anyone under the level');
{
    const q: any = player('werewolf_low', 3538, 9873, 0);
    H.setVar(q, 'tutorial', 1000);
    setAgility(q, K.werewolf_level - 1);
    const from = H.ifaces.length;
    A.op(q, 3538, 9875, 'loc_5138', 1);
    H.tick(6);
    const said = H.ifaces
        .slice(from)
        .filter(i => i.who === q.username && i.kind === 'text' && i.text)
        .map(i => i.text!);
    check(`    ${K.werewolf_level - 1} agility is turned away`, A.saw(said, `Agility level of ${K.werewolf_level}`), true);
    // they walk up to the stone before being refused, which is what a player does - what matters
    // is that they are still on the near bank and not out on the water
    check(`    and is still on the near bank (${at(q)})`, q.z <= 9874, true);
    H.despawn(q);
}

console.log('\n  the trapdoor wants the quest and the ring');
{
    const q: any = player('werewolf_door', 3543, 3463, 0);
    H.setVar(q, 'tutorial', 1000);
    setAgility(q, K.werewolf_level);
    H.setVar(q, 'fenk_quest', 0);
    let from = H.ifaces.length;
    A.op(q, 3543, 3462, 'loc_5131', 1);
    H.tick(6);
    let said = H.ifaces
        .slice(from)
        .filter(i => i.who === q.username && i.kind === 'text' && i.text)
        .map(i => i.text!);
    check('    quest unfinished is turned away', A.saw(said, 'bares his teeth'), true);

    H.setVar(q, 'fenk_quest', 99);
    from = H.ifaces.length;
    A.op(q, 3543, 3462, 'loc_5131', 1);
    H.tick(6);
    said = H.ifaces
        .slice(from)
        .filter(i => i.who === q.username && i.kind === 'text' && i.text)
        .map(i => i.text!);
    check('    and without the ring, so is a finished quest', A.saw(said, 'for werewolves'), true);

    H.equip(q, { ring: 'ring_of_charos' });
    A.op(q, 3543, 3462, 'loc_5131', 1);
    H.tick(6);
    A.op(q, 3543, 3462, 'loc_5132', 1);
    H.tick(10);
    check(`    with both, the trapdoor lets you down (${at(q)})`, at(q), '3543,9862');
    check(
        '    and the stick is waiting on the course',
        [...World.gameMap.getZone(3541, 9902, 0).getAllObjsUnsafe()].some(o => o.type === ObjType.getId('waa_stick') && o.x === 3541 && o.z === 9902),
        true
    );
    H.despawn(q);
}

console.log('\n  the stick is what the bonus is paid for');
{
    const q: any = player('werewolf_stick', 3528, 9866, 0);
    H.setVar(q, 'tutorial', 1000);
    setAgility(q, K.werewolf_level);
    const npc = H.npcNear('werewolf_trainer_stick', 3528, 9865, 0);
    check('    the Give-Stick trainer is on the map at 3528,9865', npc !== null, true);
    if (npc) {
        const was = q.stats[AGILITY];
        H.opNpc(q, npc, 1);
        H.tick(8);
        check('    with no stick he pays nothing', q.stats[AGILITY] - was, 0);
        H.give(q, 'waa_stick', 1);
        H.opNpc(q, npc, 1);
        H.tick(8);
        check(`    and with the stick he pays ${K.werewolf_xp_stick / 10}`, q.stats[AGILITY] - was, K.werewolf_xp_stick);
        check('    taking it off you', H.invCount(q, 'waa_stick'), 0);
    }
    H.despawn(q);
}

console.log('\n  the deathslide is the one obstacle that can be failed');
{
    const curve = (low: number, high: number, lvl: number) => Math.floor((low * (99 - lvl)) / 98) + Math.floor((high * (lvl - 1)) / 98) + 1;
    const lo = K.werewolf_zip_low;
    const hi = K.werewolf_zip_high;
    check(`    at 80 neither roll can be lost (${curve(lo, hi, 80)}/256)`, curve(lo, hi, 80) >= 256, true);
    check(`    and at 79 one still can (${curve(lo, hi, 79)}/256)`, curve(lo, hi, 79) < 256, true);
    check(`    at the course's own 60 each roll is ${curve(lo, hi, 60)}/256`, curve(lo, hi, 60) < 256, true);

    const origND = JavaRandom.nextDouble.bind(JavaRandom);
    const pin = (v: number | null) => {
        (JavaRandom as unknown as { nextDouble: () => number }).nextDouble = v === null ? origND : () => v;
    };

    // A HELMET STOPS YOU EVEN TRYING.
    {
        const q: any = player('werewolf_helm', 3528, 9910, 0);
        H.setVar(q, 'tutorial', 1000);
        setAgility(q, K.werewolf_level);
        H.equip(q, { hat: 'bronze_med_helm' });
        const from = H.ifaces.length;
        A.op(q, 3528, 9911, 'loc_5139', 1);
        H.tick(8);
        const said = H.ifaces
            .slice(from)
            .filter(i => i.who === q.username && i.kind === 'text' && i.text)
            .map(i => i.text!);
        // one word, not a phrase: ~mesbox wraps its text into separate interface lines, so
        // 'rather in the way' straddled a line break and matched nothing
        check('    a helmet is refused', A.saw(said, 'helmet'), true);
        check('    and the player has not moved', at(q), '3528,9910');
        H.despawn(q);
    }

    // FORCED TO FAIL: the roll is lost, so the slide still finishes but it costs.
    {
        const q: any = player('werewolf_fell', 3528, 9910, 0);
        H.setVar(q, 'tutorial', 1000);
        setAgility(q, K.werewolf_level);
        q.baseLevels[3] = 99;
        q.levels[3] = 99;
        const hpBefore = q.levels[3];
        const xpBefore = q.stats[AGILITY];
        pin(0.999);
        A.op(q, 3528, 9911, 'loc_5139', 1);
        H.tick(14);
        pin(null);
        check(`    a lost roll still ends at the bottom (${at(q)})`, at(q), '3527,9897');
        const paid = q.stats[AGILITY] - xpBefore;
        const steps = (K.werewolf_xp_zip - paid) / K.werewolf_zip_step;
        check(`    and pays ${paid / 10}, which is ${steps} step(s) of 20 under 200`, paid < K.werewolf_xp_zip && steps >= 1 && steps <= 3, true);
        const lost = hpBefore - q.levels[3];
        check(`    and costs ${lost} hitpoints (${K.werewolf_zip_hit_low}-${K.werewolf_zip_hit_low + K.werewolf_zip_hit_span - 1})`, lost >= K.werewolf_zip_hit_low && lost < K.werewolf_zip_hit_low + K.werewolf_zip_hit_span, true);
        H.despawn(q);
    }

    // AND AT 80/80 IT CANNOT BE FAILED, however the roll falls.
    {
        const q: any = player('werewolf_eighty', 3528, 9910, 0);
        H.setVar(q, 'tutorial', 1000);
        setAgility(q, 80);
        q.stats[2] = getExpByLevel(80);
        q.baseLevels[2] = 80;
        q.levels[2] = 80;
        q.baseLevels[3] = 99;
        q.levels[3] = 99;
        const hpBefore = q.levels[3];
        const xpBefore = q.stats[AGILITY];
        pin(0.999);
        A.op(q, 3528, 9911, 'loc_5139', 1);
        H.tick(14);
        pin(null);
        check('    80 agility and 80 strength never fall', q.stats[AGILITY] - xpBefore, K.werewolf_xp_zip);
        check('    and take no damage', hpBefore - q.levels[3], 0);
        H.despawn(q);
    }
}

console.log("\n  so a full lap with the stick is the 2006 540, not the wiki's 730");
check(`    ${(K.werewolf_lap - K.werewolf_xp_stick) / 10} + ${K.werewolf_xp_stick / 10}`, K.werewolf_lap, K.werewolf_xp_stones + K.werewolf_xp_hurdle * 3 + K.werewolf_xp_pipe + K.werewolf_xp_slope + K.werewolf_xp_zip + K.werewolf_xp_stick);

H.despawn(p);
console.log(`\n${R.ok} ok, ${R.bad} FAIL`);
process.exit(R.bad ? 1 : 0);
