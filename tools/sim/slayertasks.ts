// The Slayer audit, in the engine: the monsters that count, the level they ask for, and the Rewards
// right-click.
//
// What makes this worth running rather than reading: a slayer kill counts through ONE route - npc
// death reads param=slayer_category off the npc it killed - and three of this build's tasks were
// handed out with nothing carrying the category at all. The kills counted for nothing, and the
// Slayer level requirement, which the attack check reads off the same param, was never asked for
// either. content's tools/slayer_battery.py holds that line over the source; this asks the loaded
// cache, which is what the engine actually reads at runtime.
import fs from 'fs';

import * as H from './harness.ts';
import { check, R, player, talk } from './a1lib.ts';
import Component from '#/cache/config/Component.js';
import EnumType from '#/cache/config/EnumType.js';
import NpcType from '#/cache/config/NpcType.js';
import ParamType from '#/cache/config/ParamType.js';
import Player from '#/engine/entity/Player.js';
import ScriptProvider from '#/engine/script/ScriptProvider.js';
import ScriptRunner from '#/engine/script/ScriptRunner.js';
import ServerTriggerType from '#/engine/script/ServerTriggerType.js';
import Environment from '#/util/Environment.js';

await H.boot();

const SLAYER_CATEGORY = ParamType.getId('slayer_category');
const catOf = (npcName: string): number => {
    const t = NpcType.get(NpcType.getId(npcName));
    const v = t.params.get(SLAYER_CATEGORY);
    return typeof v === 'number' ? v : -1;
};

// The task ids are content constants, read back by name so that renumbering slayer.constant cannot
// make this sim quietly test nothing.
const CONSTANTS = fs.readFileSync(`${Environment.BUILD_SRC_DIR}/scripts/skill_slayer/configs/slayer.constant`, 'utf8');
const taskId = (constName: string): number => {
    const m = CONSTANTS.match(new RegExp('\\^' + constName + '\\s*=\\s*(\\d+)'));
    if (!m) {
        throw new Error('no such constant: ' + constName);
    }
    return parseInt(m[1], 10);
};

console.log('THE MONSTERS THAT COUNT');
{
    check('  a dust devil is a dust devil task', catOf('slayer_dustdevil'), taskId('slayer_dustdevil'));
    check(
        '  all five Slayer Tower mages count',
        [1, 2, 3, 4, 5].map(i => catOf(`slayer_infernal_mage_${i}`)),
        [1, 2, 3, 4, 5].map(() => taskId('slayer_infernalmage'))
    );
    check('  and the Vampire counts', catOf('vampire_juve'), taskId('slayer_vampire'));
    // The superior was tagged while the monster it comes from was not, which is exactly how the dust
    // devil slipped through: the pair has to agree.
    check('  a superior counts as the monster it comes from', catOf('superior_choke_devil'), catOf('slayer_dustdevil'));
}

console.log('\nAND THE LEVEL THAT GOES WITH THEM');
{
    const req = EnumType.get(EnumType.getId('slayer_req'));
    const level = (task: string): number => {
        const v = req.values.get(taskId(task));
        return typeof v === 'number' ? v : -1;
    };
    check('  dust devil 65, which nothing was asking for', level('slayer_dustdevil'), 65);
    check('  infernal mage 45, the same', level('slayer_infernalmage'), 45);
    check('  cave slime 17, announced at the level-up and never required', level('slayer_caveslime'), 17);
    check('  desert lizard 22', level('slayer_lizard'), 22);
    check('  harpie bug swarm 33', level('slayer_harpiebugswarm'), 33);
    check('  fever spider 42 and zygomite 57, written down for when their tasks open', [level('slayer_feverspider'), level('slayer_mutatedzygomite')], [42, 57]);
}

console.log('\nTHE REWARDS RIGHT-CLICK');
{
    const masters = ['slayer_master_1', 'slayer_master_2', 'slayer_master_3', 'slayer_master_4', 'slayer_master_5'];
    const wired = masters.map(m => {
        const t = NpcType.get(NpcType.getId(m));
        const byId = ScriptProvider.getByTriggerSpecific(ServerTriggerType.OPNPC3, t.id, -1);
        const byCat = t.category !== -1 ? ScriptProvider.getByTriggerSpecific(ServerTriggerType.OPNPC3, -1, t.category) : undefined;
        return (t.op?.[2] ?? '') === 'Rewards' && !!(byId ?? byCat);
    });
    check(
        '  every master has a Rewards option that reaches a script',
        wired,
        masters.map(() => true)
    );

    // And it opens the window rather than answering in the chatbox. The proc pauses on a button, so
    // it is started and left where it stops: what matters is the modal the player is in by then.
    const p: Player = player('rewardsim', 3200, 3200);
    const script = ScriptProvider.getByName('[proc,slayer_rewards_window]');
    check('  the window proc exists', !!script, true);
    if (script) {
        p.executeScript(ScriptRunner.init(script, p, null, []), true);
        check('  and running it puts the player in the Slayer Rewards window', (p as unknown as { modalMain: number }).modalMain, Component.getId('slayer_rewards'));
    }
    H.despawn(p);
}

console.log('\nTHE TWO WILDERNESS ROWS DURADEL NEVER HAD');
// ANKOU AND LAVA DRAGONS (2026-10-13). Both were imported for the Wilderness carrying a
// slayer_category that no master's table named, which is a category with no task: the kills
// counted towards nothing because nothing handed them out. Ankou are a plain Duradel row; lava
// dragons were behind Playing with Fire until 2026-11-28, when the One-armed veteran became the
// Wilderness master and took them - so Duradel gives them to nobody now, unlock or not.
//
// WHAT IS WORTH TESTING is not the table - content's slayer_battery reads that - but the roll:
// that ankou actually come up, and that lava dragons never do from him. Both are a property of
// ~generate_slayer_task walking the weights and re-rolling whatever ~validate_slayer_target
// refuses, which only the running engine does.
{
    const ANKOU = taskId('slayer_ankou');
    const LAVA = taskId('slayer_lavadragon');
    check('  an ankou is an ankou task', catOf('ankou'), ANKOU);
    check('  and a lava dragon is a lava dragon task', catOf('lava_dragon'), LAVA);

    const combat = EnumType.get(EnumType.getId('combat_req'));
    check("  ankou ask for combat 40, Old School's own number", combat.values.get(ANKOU) ?? 0, 40);
    check('  and lava dragons ask for nothing, as there too', combat.values.get(LAVA) ?? 0, 0);

    const duradel = H.npcNear('slayer_master_5', 2869, 2982, 1);
    check('  Duradel is where he always was', !!duradel, true);

    const newTarget = ScriptProvider.getByName('[proc,slayer_new_target]');
    check('  the assignment proc exists', !!newTarget, true);
    if (duradel && newTarget) {
        // The master's own dialogue runs this in PLAYER context with himself as the active npc -
        // switch_npc(npc_type) is what picks his table - so that is how it is driven here.
        const roll = (q: Player): number => {
            q.executeScript(ScriptRunner.init(newTarget, q, duradel, []), true);
            return H.getVar(q, 'slayer_target');
        };
        const sample = (q: Player, n: number): Map<number, number> => {
            const seen = new Map<number, number>();
            for (let i = 0; i < n; i++) {
                const t = roll(q);
                seen.set(t, (seen.get(t) ?? 0) + 1);
            }
            return seen;
        };

        const ROLLS = 800;
        const p: Player = player('duradelroll', 2869, 2984, 1);
        H.maxOut(p);
        H.setVar(p, 'slayer_unlocks', 0);
        const without = sample(p, ROLLS);
        // Weight 5 out of 225 is about 1 in 45, so 800 rolls that never produced one would mean
        // the row is unreachable rather than unlucky.
        check(`  ankou come up without any unlock: ${without.get(ANKOU) ?? 0} of ${ROLLS}`, (without.get(ANKOU) ?? 0) > 0, true);
        check('  and lava dragons never do', without.get(LAVA) ?? 0, 0);
        check('  while red dragons and aviansies stay locked too', [without.get(taskId('slayer_reddragon')) ?? 0, without.get(taskId('slayer_aviansie')) ?? 0], [0, 0]);
        H.despawn(p);

        const q: Player = player('duradelunlocked', 2869, 2984, 1);
        H.maxOut(q);
        // Bit 11 is the retired Playing with Fire. A player who bought it and has not logged in
        // since still holds it; it must not put lava dragons back on Duradel's list.
        H.setVar(q, 'slayer_unlocks', 1 << 11);
        const withIt = sample(q, ROLLS);
        check(`  and the retired Playing with Fire bit does not bring them back: ${withIt.get(LAVA) ?? 0} of ${ROLLS}`, withIt.get(LAVA) ?? 0, 0);
        check('  ankou are unaffected by it', (withIt.get(ANKOU) ?? 0) > 0, true);
        H.despawn(q);
    }
}

console.log('\nTHE ONE-ARMED VETERAN, THE WILDERNESS MASTER');
// OLD SCHOOL'S KRYSTILIA (2026-11-28), on the npc who was already standing on the line north of
// Edgeville. Content's slayer_battery holds his table and his wiring over the source; this asks the
// running engine the four things only it can answer - what his roll actually hands out, to whom,
// whether a kill counts where it is made, and what finishing pays.
{
    const vet = H.npcNear('wilderness_veteran', 3087, 3517, 0);
    check('  the veteran is on the line', !!vet, true);
    const t = NpcType.get(NpcType.getId('wilderness_veteran'));
    const turael = NpcType.get(NpcType.getId('slayer_master_1'));
    check('  in the same category as every other master', t.category !== -1 && t.category === turael.category, true);
    check('  with Rewards and Trade beside his Talk-to', [t.op?.[0], t.op?.[2], t.op?.[3]], ['Talk-to', 'Rewards', 'Trade']);
    check(
        '  and both reach a script',
        [ServerTriggerType.OPNPC3, ServerTriggerType.OPNPC4].map(tr => !!ScriptProvider.getByTriggerSpecific(tr, -1, t.category)),
        [true, true]
    );
    check('  while his Talk-to is still his own', !!ScriptProvider.getByName('[opnpc1,wilderness_veteran]'), true);

    const VET = [
        'ankou', 'bandit', 'bear', 'blackdemon', 'blackdragon', 'blackknight', 'chaosdruid', 'darkwarrior',
        'earthwarrior', 'firegiant', 'greaterdemon', 'greendragon', 'hellhound', 'hillgiant', 'icegiant',
        'icewarrior', 'lavadragon', 'lesserdemon', 'magicaxe', 'mossgiant', 'pirate', 'rogue', 'scorpion',
        'skeleton', 'spider', 'zombie'
    ].map(n => taskId('slayer_' + n));
    const MASTER_VETERAN = taskId('slayer_master_veteran');
    const newTarget = ScriptProvider.getByName('[proc,slayer_new_target]');

    // the seven new categories, on the npcs that stand where his kills count
    check(
        '  the seven new tasks each have a monster that counts',
        [['rogue', 'rogue'], ['dark_warrior', 'darkwarrior'], ['pirate_aggressive', 'pirate'], ['magicaxe', 'magicaxe'],
            ['chaos_druid', 'chaosdruid'], ['elder_chaos_druid', 'chaosdruid'], ['brawling_bandit', 'bandit'],
            ['guard_bandit', 'bandit'], ['aggressive_black_knight', 'blackknight']].map(([n, c]) => catOf(n) === taskId('slayer_' + c)),
        [true, true, true, true, true, true, true, true, true]
    );

    if (vet && newTarget) {
        const sample = (q: Player, n: number): Map<number, number> => {
            const seen = new Map<number, number>();
            for (let i = 0; i < n; i++) {
                q.executeScript(ScriptRunner.init(newTarget, q, vet, []), true);
                const got = H.getVar(q, 'slayer_target');
                seen.set(got, (seen.get(got) ?? 0) + 1);
            }
            return seen;
        };
        const ROLLS = 1200;
        const p: Player = player('vetroll', 3087, 3516);
        H.maxOut(p);
        H.setVar(p, 'slayer_unlocks', 0);
        const rolled = sample(p, ROLLS);
        const stray = [...rolled.keys()].filter(k => !VET.includes(k));
        check('  every task he gives is on his list', stray, []);
        check(`  and between them his rolls reach all 26 rows: ${[...rolled.keys()].length}`, VET.every(k => (rolled.get(k) ?? 0) > 0), true);
        check('  lava dragons included, with no unlock bought', (rolled.get(taskId('slayer_lavadragon')) ?? 0) > 0, true);
        check('  and he is recorded as the master who gave it', H.getVar(p, 'slayer_task_master'), MASTER_VETERAN);
        H.despawn(p);

        // NO COMBAT REQUIREMENT, as Krystilia asks for none: a combat-3 player is given ankou,
        // which ask for 40 from anybody else. And THE TWO LOCKED HUTS: with Thieving 1 neither
        // magic axes nor pirates come up, because he does not send anybody to a lock they cannot
        // pick. H.makePlayer is a fresh account - every stat at its starting level.
        const fresh: Player = H.makePlayer('vetfresh', 3087, 3516);
        H.tick(1);
        const low = sample(fresh, ROLLS);
        check(`  a combat 3 player is still given ankou: ${low.get(taskId('slayer_ankou')) ?? 0} of ${ROLLS}`, (low.get(taskId('slayer_ankou')) ?? 0) > 0, true);
        check('  but never the magic axes or pirates without the Thieving for their locks', [low.get(taskId('slayer_magicaxe')) ?? 0, low.get(taskId('slayer_pirate')) ?? 0], [0, 0]);
        H.despawn(fresh);
    }

    // WHERE THE KILL IS MADE. The real kill path: [queue,progress_task] on the player, with the
    // monster's uid, exactly as npc_death queues it. The level-2 tile is a few steps north of him.
    const kq = ScriptProvider.getByName('[queue,progress_task]');
    check('  the kill queue exists', !!kq, true);
    if (kq) {
        const SKEL = taskId('slayer_skeleton');
        const k: Player = player('vetkill', 3087, 3516);
        const bones = H.addNpc('skeleton_armed', 3089, 3516);
        const kill = (): void => {
            k.executeScript(ScriptRunner.init(kq, k, null, [bones.uid]), true);
        };
        H.setVar(k, 'slayer_target', SKEL);
        H.setVar(k, 'slayer_count', 10);
        H.setVar(k, 'slayer_task_master', MASTER_VETERAN);
        H.clearLogs();
        kill();
        check('  south of the signs his kill does not count', H.getVar(k, 'slayer_count'), 10);
        check('  and says why', H.mesgs.some(m => m.text.includes('only kills in the Wilderness count')), true);
        k.teleport(3087, 3530, 0);
        H.tick(1);
        kill();
        check('  north of them it does', H.getVar(k, 'slayer_count'), 9);
        k.teleport(3088, 9958, 0);
        H.tick(1);
        kill();
        check('  and so does one in the Wilderness underground', H.getVar(k, 'slayer_count'), 8);
        // and a task from anybody else still counts wherever it is done
        k.teleport(3087, 3516, 0);
        H.tick(1);
        H.setVar(k, 'slayer_task_master', 5);
        kill();
        check("  while Duradel's task counts south of the signs, as it always did", H.getVar(k, 'slayer_count'), 7);
        H.despawn(k);
    }

    // WHAT FINISHING PAYS: 25 before the streak multipliers, Krystilia's number.
    const pts: Player = player('vetpoints', 3087, 3516);
    H.setVar(pts, 'slayer_points', 0);
    H.setVar(pts, 'slayer_streak', 5); // the 6th in a row: paid, and no milestone
    H.setVar(pts, 'slayer_task_master', MASTER_VETERAN);
    H.runProc(pts, '[proc,complete_task]', [], undefined, true);
    check('  a finished veteran task pays 25 points', H.getVar(pts, 'slayer_points'), 25);
    H.setVar(pts, 'slayer_streak', 9); // the 10th: five times over
    H.runProc(pts, '[proc,complete_task]', [], undefined, true);
    check('  and the 10th in a row pays 125', H.getVar(pts, 'slayer_points'), 150);
    H.despawn(pts);

    // PLAYING WITH FIRE IS REFUNDED ONCE, at login, and the bit goes as the points come back.
    const ref: Player = player('vetrefund', 3087, 3516);
    H.setVar(ref, 'slayer_points', 0);
    H.setVar(ref, 'slayer_unlocks', (1 << 11) | (1 << 4));
    H.runProc(ref, '[proc,slayer_login]', [], undefined, true);
    check('  a player who bought Playing with Fire gets the 100 points back', H.getVar(ref, 'slayer_points'), 100);
    check('  and loses the bit but no other unlock', H.getVar(ref, 'slayer_unlocks'), 1 << 4);
    H.runProc(ref, '[proc,slayer_login]', [], undefined, true);
    check('  and only once', H.getVar(ref, 'slayer_points'), 100);
    H.despawn(ref);

    // HIS CONVERSATION, clicked through the way a player clicks it. Option 1 is "I need a
    // Wilderness assignment."; the warning's option 1 is "Yes, I understand...".
    const said = (lines: string[], s: string): boolean => lines.some(l => l.includes(s));
    const talker: Player = player('vettalk', 3087, 3516);
    H.setVar(talker, 'slayer_count', 0);
    H.setVar(talker, 'slayer_task_master', 5);
    const first = talk(talker, 'wilderness_veteran', [1, 1, 2]);
    check('  a player coming from another master is warned first', said(first, 'Listen first. Whatever I give you'), true);
    check('  and, having said yes, is given a task of his', H.getVar(talker, 'slayer_count') > 0 && H.getVar(talker, 'slayer_task_master') === MASTER_VETERAN, true);
    const again = talk(talker, 'wilderness_veteran', [1]);
    check('  asking again while on it is refused', said(again, "You've still got"), true);
    H.despawn(talker);

    const novice: Player = H.makePlayer('vetnovice', 3087, 3516);
    H.tick(1);
    const sent = talk(novice, 'wilderness_veteran', [1]);
    check('  and a player who has never trained Slayer is sent to Turael', said(sent, 'Turael in Burthorpe') && H.getVar(novice, 'slayer_count') === 0, true);
    H.despawn(novice);
}

console.log(`\n${R.ok} ok, ${R.bad} FAIL`);
process.exit(R.bad ? 1 : 0);
