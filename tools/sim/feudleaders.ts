// THE FEUD'S TWO LEADERS ARE DRAWN FROM A STAGE, NOT JUST FROM A CONVERSATION (DeathPlateau-Bugs#118).
//
// The Menaphite leader renders only while a bit in the quest varp is set, and each bit was set by
// one conversation. A character who was already past that conversation, or whose leader was removed
// by a server restart, was left with a stage that says "go and talk to him" and nobody to talk to.
// feud_reconcile_leaders (run at login) catches them up from the stage.
//
//   npx tsx tools/sim/feudleaders.ts
import * as H from './harness.js';
import World from '#/engine/World.js';

await H.boot();
let ok = 0;
let fail = 0;
function check(name: string, cond: boolean, detail = '') {
    if (cond) {
        ok++;
        console.log('  ok   ' + name);
    } else {
        fail++;
        console.log('  FAIL ' + name + (detail ? '  -- ' + detail : ''));
    }
}

const TENT = [3331, 2952] as const;
const LEADER = [3332, 2954] as const;

function player(name: string, stage: number, bits: { boss?: number; bandit?: number; vis2?: number } = {}) {
    const p: any = H.makePlayer(name, 3338, 2957);
    H.tick(2);
    p.teleport(3338, 2957, 0);
    p.applyDamage = function () {};
    H.setVarBit(p, 'feud_var', stage);
    H.setVarBit(p, 'feud_boss_vis', bits.boss ?? 0);
    H.setVarBit(p, 'feud_bandit_boss_vis', bits.bandit ?? 0);
    H.setVarBit(p, 'feud_boss_vis2', bits.vis2 ?? 0);
    H.tick(1);
    return p;
}
function clickable(p: any, npc: any) {
    return !!npc && H.npcOpWord(p, npc, 1) === 'Talk-to';
}

console.log('A PLAYER WHO IS PAST THE CAMEL JOKE BUT HAS NO BIT FOR THE TENT');
let p = player('feudlead1', 20);
const tent: any = H.npcNear('feud_menap_boss', TENT[0], TENT[1]);
check('the tent boss is placed', !!tent);
check('before the login reconcile he cannot be clicked', !clickable(p, tent));
H.runProc(p, '[proc,feud_reconcile_leaders]', [], undefined, true);
H.tick(1);
check('after it he can: Talk-to is on his menu', clickable(p, tent), `bit=${H.getVarBit(p, 'feud_boss_vis')}`);
check('and so can the bandit boss, whose bit it also raises', H.getVarBit(p, 'feud_bandit_boss_vis') === 1);

console.log('A PLAYER AT THE POISONED STAGE WHOSE LEADER IS GONE');
p = player('feudlead2', 52);
const before: any = H.npcNear('feud_menap_boss2', LEADER[0], LEADER[1]);
if (before) World.removeNpc(before, 0);
H.runProc(p, '[proc,feud_reconcile_leaders]', [], undefined, true);
H.tick(1);
const leader: any = H.npcNear('feud_menap_boss2', LEADER[0], LEADER[1]);
check('a leader stands outside the tent', !!leader);
check('and he can be clicked', clickable(p, leader), `vis2=${H.getVarBit(p, 'feud_boss_vis2')}`);
H.runProc(p, '[proc,feud_reconcile_leaders]', [], undefined, true);
H.tick(1);
let count = 0;
for (const n of [H.npcNear('feud_menap_boss2', LEADER[0], LEADER[1])]) if (n) count++;
check('running it twice does not add a second one', count === 1);

console.log('WHAT IT MUST LEAVE ALONE');
p = player('feudlead3', 12);
H.runProc(p, '[proc,feud_reconcile_leaders]', [], undefined, true);
check('before the Operator takes you on, nothing is set', H.getVarBit(p, 'feud_boss_vis') === 0 && H.getVarBit(p, 'feud_bandit_boss_vis') === 0);
p = player('feudlead4', 62, { boss: 0 });
H.runProc(p, '[proc,feud_reconcile_leaders]', [], undefined, true);
check('a finished character is not touched', H.getVarBit(p, 'feud_boss_vis') === 0 && H.getVarBit(p, 'feud_boss_vis2') === 0);
p = player('feudlead5', 56, { vis2: 0 });
H.runProc(p, '[proc,feud_reconcile_leaders]', [], undefined, true);
H.tick(1);
check('once the tough guy is dead the leader is not brought back', H.getVarBit(p, 'feud_boss_vis2') === 0);
p = player('feudlead6', 28, { boss: 1, bandit: 1 });
H.runProc(p, '[proc,feud_reconcile_leaders]', [], undefined, true);
check('it only ever raises a bit', H.getVarBit(p, 'feud_boss_vis') === 1 && H.getVarBit(p, 'feud_bandit_boss_vis') === 1);

console.log(`\n${ok} ok, ${fail} FAIL`);
process.exit(fail ? 1 : 0);
