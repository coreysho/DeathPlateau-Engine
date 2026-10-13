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
import { check, R, player } from './a1lib.ts';
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
// counted towards nothing because nothing handed them out. Ankou are a plain Duradel row now;
// lava dragons are behind Playing with Fire, his third unlock-only row.
//
// WHAT IS WORTH TESTING is not the table - content's slayer_battery reads that - but the roll:
// that ankou actually come up, and that lava dragons cannot come up for a player who has not
// bought the unlock. Both are a property of ~generate_slayer_task walking the weights and
// re-rolling whatever ~validate_slayer_target refuses, which only the running engine does.
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
        // Weight 5 out of 233 is about 1 in 47, so 800 rolls that never produced one would mean
        // the row is unreachable rather than unlucky.
        check(`  ankou come up without any unlock: ${without.get(ANKOU) ?? 0} of ${ROLLS}`, (without.get(ANKOU) ?? 0) > 0, true);
        check('  and lava dragons never do', without.get(LAVA) ?? 0, 0);
        check('  while red dragons and aviansies stay locked too', [without.get(taskId('slayer_reddragon')) ?? 0, without.get(taskId('slayer_aviansie')) ?? 0], [0, 0]);
        H.despawn(p);

        const q: Player = player('duradelunlocked', 2869, 2984, 1);
        H.maxOut(q);
        // Playing with Fire alone - bit 11, and nothing else - so what comes up can only be from it.
        H.setVar(q, 'slayer_unlocks', 1 << 11);
        const withIt = sample(q, ROLLS);
        check(`  with Playing with Fire bought they do: ${withIt.get(LAVA) ?? 0} of ${ROLLS}`, (withIt.get(LAVA) ?? 0) > 0, true);
        check('  and that one bit unlocked nothing else', [withIt.get(taskId('slayer_reddragon')) ?? 0, withIt.get(taskId('slayer_aviansie')) ?? 0], [0, 0]);
        check('  ankou are unaffected by it', (withIt.get(ANKOU) ?? 0) > 0, true);
        H.despawn(q);
    }
}

console.log(`\n${R.ok} ok, ${R.bad} FAIL`);
process.exit(R.bad ? 1 : 0);
