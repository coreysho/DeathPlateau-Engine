// DOES A DEAD NPC GO AWAY? Asked of the npcs a fuzz run reported as corpses, and of a control group
// that works, so the answer is a comparison and not a threshold.
//
//   npx tsx tools/sim/corpses.ts
//
// A 99-bot fuzz run reported four corpses - "still in the world N ticks after its hitpoints reached
// 0 (npc_del never ran)" - for mm_monkey_guard, mm_oipuis and mm_duke, at 12 and 16 ticks against
// the watcher's threshold of 10. Two readings were available and the finding counts alone could not
// separate them: either those npcs do not despawn, or 10 ticks is too tight and the watcher is
// wrong.
//
// WHAT THIS SETTLED. An ordinary monster leaves the world THREE TICKS after its hitpoints reach 0 -
// goblin, rat and man, the same every run. So CORPSE_TICKS = 10 is three times the norm and the
// watcher is not crying wolf: 12 and 16 ticks are real anomalies. And mm_duke, killed here where it
// stands, also goes in three ticks - so whatever produced its corpse in the fuzz run was the
// situation, not the npc.
//
// WHAT IT DID NOT SETTLE, and says so rather than passing quietly: mm_monkey_guard and mm_oipuis
// cannot be brought to 0 hitpoints by this probe at all, so it has nothing to say about them. The
// denominator is printed for that reason - a probe that skips its subject and exits 0 is the trap
// quest_garden_run fell into, aborting at step 6 and reporting 4 of 5 passing while 83 checks had
// never run.
//
// THREE WRONG TURNS GOT HERE, all of them the probe's own fault and worth leaving written down:
//
//   1. mm_duke died in three ticks on one run and was UNTESTED on the next with nothing changed.
//      That was an attack roll landing once, and it was briefly reported as a finding. It is not a
//      measurement until it repeats.
//   2. Re-setting hitpoints to 1 every tick, to make the kill certain, stopped EVERYTHING dying -
//      including the npc that had died before. Reverted.
//   3. The actual difference was never about those npcs: the controls have trivial defence and die
//      to an unarmed player at once, while all three suspects carry 130 defence and the probe's
//      player was holding nothing. Fifty swings, all missing. It wields a dragon scimitar now,
//      which was enough for mm_duke and not for the other two.
import * as H from './harness.js';
import NpcType from '#/cache/config/NpcType.js';
import { NpcStat } from '#/engine/entity/NpcStat.js';

await H.boot();

const SUSPECTS = ['mm_monkey_guard', 'mm_oipuis', 'mm_duke'];
// The control group: ordinary placed monsters nobody has ever reported a corpse for.
const CONTROLS = ['goblin', 'rat', 'man', 'guard'];

const p = H.makePlayer('mortician', 3222, 3218) as unknown as { x: number; z: number; level: number; teleport(x: number, z: number, level: number): void; applyDamage: (d: number) => void };
H.tick(2);
H.maxOut(p as never);
// A WEAPON, which is what separated the control group from the suspects. goblin, rat and man have
// trivial defence and an unarmed max-stat player kills them at once; mm_monkey_guard, mm_oipuis and
// mm_duke all carry 130 defence, and fifty unarmed swings over 400 ticks missed every time. Three
// runs of this probe reported them "could not be brought to 0 hitpoints" and the explanation was
// never anything about those npcs - it was the fist the probe was using.
H.equip(p as never, { rhand: 'dragon_scimitar' });
p.applyDamage = function () {};

let ok = 0;
let bad = 0;

/** Ticks between hitpoints reaching 0 and the npc leaving the world; -1 still standing, null unkillable. */
function timeToRemoval(name: string): number | null {
    if (NpcType.getId(name) === -1) {
        console.log(`  MISSING ${name} - no such npc, so this probe says nothing about it`);
        return null;
    }
    p.teleport(3222, 3218, 0);
    H.tick(1);
    const npc = H.addNpc(name, 3224, 3218);
    H.tick(1);
    // ONE HITPOINT, ONCE, and then hit it - so the death is the engine's own sequence rather than a
    // long fight with its own dice.
    //
    // RE-SETTING IT TO 1 EVERY TICK WAS TRIED AND IS WORSE. The idea was to make the kill certain
    // rather than leaving it to whether an attack roll lands, since mm_monkey_guard and mm_oipuis
    // survived 120 ticks here while mm_duke died in three and all three carry the same 130 across
    // the board. With the per-tick reset in, NOTHING died at all - not even the npc that had died
    // before - so whatever keeps those two alive is not the roll, and the reset was fighting
    // something else. Left as the simple version, with the subjects it cannot engage reported as
    // UNTESTED rather than quietly passing.
    npc.levels[NpcStat.HITPOINTS] = 1;
    let zeroAt = -1;
    for (let t = 0; t < 400; t++) {
        // RE-ISSUED, not set once. attackNpc establishes the interaction and the player swings
        // while it holds - but it does not hold forever, and a probe that attacks once then waits
        // out its budget reports "could not be brought to 0 hitpoints" for an npc that is perfectly
        // killable. mm_duke died in three ticks on one run of the single-attack version and was
        // UNTESTED on the next, with nothing changed: that was the roll landing once, not a
        // measurement, and it is exactly the flakiness choptrees had.
        if (zeroAt === -1 && npc.isActive && t % 8 === 0) {
            npc.levels[NpcStat.HITPOINTS] = 1;
            H.attackNpc(p as never, npc);
        }
        H.tick(1);
        if (zeroAt === -1 && npc.levels[NpcStat.HITPOINTS] === 0) {
            zeroAt = t;
        }
        if (!npc.isActive) {
            return zeroAt === -1 ? 0 : t - zeroAt;
        }
    }
    return zeroAt === -1 ? null : -1;
}

console.log('-- the control group: ordinary monsters');
const controlTimes: number[] = [];
let untested = 0;
for (const name of CONTROLS) {
    const n = timeToRemoval(name);
    if (n === null) {
        untested++;
        continue;
    }
    if (n === -1) {
        console.log(`  FAIL ${name} was STILL in the world 120 ticks after dying - the control group is not a control`);
        bad++;
    } else {
        console.log(`  ok   ${name} left the world ${n} ticks after its hitpoints reached 0`);
        controlTimes.push(n);
        ok++;
    }
}
const worstControl = controlTimes.length ? Math.max(...controlTimes) : 0;
console.log(`   the slowest ordinary death here is ${worstControl} ticks`);

console.log('');
console.log('-- the four the fuzz run reported');
for (const name of SUSPECTS) {
    const n = timeToRemoval(name);
    if (n === null) {
        console.log(`  UNTESTED ${name} - could not be brought to 0 hitpoints in 400 ticks`);
        untested++;
        continue;
    }
    if (n === -1) {
        console.log(`  FAIL ${name} was STILL in the world 120 ticks after dying - npc_del never ran`);
        bad++;
    } else if (n > worstControl) {
        console.log(`  FAIL ${name} took ${n} ticks to leave, against ${worstControl} for an ordinary monster`);
        bad++;
    } else {
        console.log(`  ok   ${name} left the world ${n} ticks after its hitpoints reached 0, same as any monster`);
        ok++;
    }
}

console.log('');
// THE DENOMINATOR IS PRINTED, because a probe that skips its subject and exits 0 is the trap
// quest_garden_run fell into: it aborted at step 6 and reported 4 of 5 passing while 83 checks had
// never run.
console.log(`${ok} ok, ${bad} FAIL, ${untested} untested of ${CONTROLS.length + SUSPECTS.length} npcs`);
process.exit(bad ? 1 : 0);
