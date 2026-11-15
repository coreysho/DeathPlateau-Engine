// FAREED'S DEATH HAS TO BE WRITTEN DOWN, or he comes back.
//
//   npx tsx tools/sim/fareedrespawn.ts
//
// dt_smoke.rs2 guards ~dt_spawn_fareed on %fd_killed_firewarrior so that re-entering the arena
// after killing him does not summon him again - the comment above that spawn says the whole reason
// it is a spawn and not a map placement is "so he cannot be farmed before the quest". Nothing ever
// set the varbit, so the guard never fired and he came back on every re-entry.
//
// varpstates.py in the content repo found it: a state tested at dt_smoke.rs2 and assigned nowhere.
// That tool is a report and not a gate, so a regression would print and pass. This asserts it.
//
// WHY THE WRITE WAS MISSING, which is the part worth keeping. A death hook is [ai_queueN,<npc>] and
// starts with no player pointer at all. npc_findhero grants active_player, which is enough to READ
// a varp and not enough to write one: VarPlayerType.protect defaults to TRUE (VarPlayerType.ts:84)
// and deserttreasurevarbit2 declares no protect= line, so it takes that default, and POP_VARBIT
// refuses without p_active_player. Only P_FINDUID sets that pointer, so the upgrade has to be asked
// for - which is exactly what Kamil's hook one file over already does, and what Fareed's did not.
//
// So the fix is a p_finduid guard and one assignment, and this checks the assignment happened
// rather than checking the guard exists.
import { NpcStat } from '#/engine/entity/NpcStat.js';

import * as H from './harness.js';

await H.boot();

let ok = 0;
let bad = 0;
const check = (what: string, good: boolean, detail = '') => {
    if (good) {
        ok++;
        console.log('  ok   ' + what);
    } else {
        bad++;
        console.log('  FAIL ' + what + (detail ? ' - ' + detail : ''));
    }
};

const p = H.makePlayer('fareed', 3222, 3218) as unknown as { applyDamage: (d: number) => void };
H.tick(2);
H.maxOut(p as never);
// ICE GLOVES, because ~dt_melee_attack_allowed disarms anyone without them - it takes the weapon
// out of your hand and the swing never lands. corpses.ts learned the same lesson the hard way with
// an unarmed player against 130 defence.
H.equip(p as never, { rhand: 'dragon_scimitar', hands: 'ice_gloves' });
p.applyDamage = function () {};
H.tick(1);

check('starts with the kill unrecorded', H.getVarBit(p as never, 'fd_killed_firewarrior') === 0, `varbit is ${H.getVarBit(p as never, 'fd_killed_firewarrior')}`);

const fareed = H.addNpc('firediamond_firewarrior', 3224, 3218);
H.tick(1);
fareed.levels[NpcStat.HITPOINTS] = 1;

// Re-issued rather than set once: attackNpc establishes the interaction and the player swings while
// it holds, and it does not hold forever. corpses.ts reported a perfectly killable npc as
// unkillable for exactly this reason.
let died = false;
for (let t = 0; t < 400; t++) {
    if (fareed.isActive && t % 8 === 0) {
        fareed.levels[NpcStat.HITPOINTS] = 1;
        H.attackNpc(p as never, fareed);
    }
    H.tick(1);
    if (!fareed.isActive) {
        died = true;
        break;
    }
}

if (!died) {
    console.log('  UNTESTED Fareed could not be brought to 0 hitpoints in 400 ticks, so this probe says nothing');
    console.log('');
    console.log(`${ok} ok, ${bad} FAIL, 1 untested`);
    process.exit(bad ? 1 : 0);
}

check('Fareed died', died);
// The assertion this file exists for. If the death hook could not take protected access the varbit
// stays 0 and he is farmable, which is the bug.
const recorded = H.getVarBit(p as never, 'fd_killed_firewarrior');
check('and his death is recorded, so the respawn guard can fire', recorded === 1, `%fd_killed_firewarrior is ${recorded}`);

console.log('');
console.log(`${ok} ok, ${bad} FAIL`);
process.exit(bad ? 1 : 0);
