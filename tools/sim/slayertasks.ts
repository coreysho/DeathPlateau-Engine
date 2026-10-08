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

console.log(`\n${R.ok} ok, ${R.bad} FAIL`);
process.exit(R.bad ? 1 : 0);
