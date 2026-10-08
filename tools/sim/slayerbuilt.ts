// The six slayer tasks built on 8 October 2026, asked of the running engine: the monsters that
// count, the gate each task is behind, and the fungicide can.
//
// Before this round the five masters between them refused eight tasks and handed out one that could
// not be finished. What is left refused is a PLACE rather than a monster - nothing spawns a shade,
// and the dark beasts are walled into mines with no door - and content's tools/slayer_battery.py is
// what keeps that list honest. This is the other half: that the gates let the right player through.
import * as H from './harness.ts';
import { check, R, player } from './a1lib.ts';
import NpcType from '#/cache/config/NpcType.js';
import { NpcStat } from '#/engine/entity/NpcStat.js';
import ObjType from '#/cache/config/ObjType.js';
import ParamType from '#/cache/config/ParamType.js';
import Player from '#/engine/entity/Player.js';

await H.boot();

const SLAYER_CATEGORY = ParamType.getId('slayer_category');
const catOf = (npcName: string): number => {
    const t = NpcType.get(NpcType.getId(npcName));
    const v = t.params.get(SLAYER_CATEGORY);
    return typeof v === 'number' ? v : -1;
};
// Task ids as content numbers them (skill_slayer/configs/slayer.constant).
const MOGRE = 67;
const ELF = 56;
const FEVER = 69;
const ZYGOMITE = 74;
const REDDRAGON = 26;
const AVIANSIE = 78;
const SHADE = 64;

console.log('THE MONSTERS, AND WHAT THEY COUNT AS');
{
    // The mogre counted as an OGRE, which is the kind of mistake that looks like it works.
    check('  a Mogre is a mogre, not an ogre', catOf('mudskipper_ogre'), MOGRE);
    const hp = (npcName: string): number => NpcType.get(NpcType.getId(npcName)).stats[NpcStat.HITPOINTS];
    check('  and it can fight back at last', [NpcType.get(NpcType.getId('mudskipper_ogre')).vislevel, hp('mudskipper_ogre')], [60, 60]);
    check('  both Elf warriors count', [catOf('regicide_darkelf'), catOf('regicide_darkelf2')], [ELF, ELF]);
    check('  the fever spiders count', catOf('deal_fever_spiders1'), FEVER);
    check(
        '  all four zygomites count - the two mushrooms as well as the two monsters',
        ['slayer_mutated_zygomite_adolescent_cap', 'slayer_mutated_zygomite_adult_capt', 'slayer_mutated_zygomite_adolescent', 'slayer_mutated_zygomite_adult'].map(catOf),
        [ZYGOMITE, ZYGOMITE, ZYGOMITE, ZYGOMITE]
    );
    check('  and the zygomites can fight', hp('slayer_mutated_zygomite_adult'), 75);
    check(
        '  every aviansie in the eyrie counts',
        [...Array(15).keys()].map(i => catOf(`gwd_aviansie_${i + 1}`)),
        [...Array(15).keys()].map(() => AVIANSIE)
    );
}

console.log('\nTHE GATE ON EACH TASK');
{
    const p: Player = player('taskgatesim', 3200, 3200);
    const can = (task: number): boolean => H.runProc(p, '[proc,validate_slayer_target]', [task])[0] === 1;
    const clear = () => {
        H.setVar(p, 'regicide_quest', 0);
        H.setVar(p, 'deal_quest', 0);
        H.setVar(p, 'zanaris', 0);
        H.setVar(p, 'slayer_unlocks', 0);
        H.setVar(p, 'priestperil', 0);
    };
    clear();
    (p as unknown as { baseLevels: number[] }).baseLevels[18] = 99; // Slayer, so the level is never what refuses

    check('  a mogre needs nothing but the explosive', can(MOGRE), true);

    check('  an elf task waits for Regicide', can(ELF), false);
    H.setVar(p, 'regicide_quest', 15);
    check('  and is given once it is done', can(ELF), true);

    check('  a fever spider waits for Rum Deal', can(FEVER), false);
    H.setVar(p, 'deal_quest', 6);
    check('  and is given once it is done', can(FEVER), true);

    // Two conditions, and the sim is worth more for testing them apart than together.
    check('  a zygomite needs Lost City AND the unlock', can(ZYGOMITE), false);
    H.setVar(p, 'zanaris', 6);
    check('  Lost City alone is not enough - the fungicide is what kills one', can(ZYGOMITE), false);
    H.setVar(p, 'slayer_unlocks', 1 << 5);
    check("  with 'Shroom Sprayer bought, it is given", can(ZYGOMITE), true);

    H.setVar(p, 'slayer_unlocks', 0);
    check('  red dragons wait for Seeing Red', can(REDDRAGON), false);
    H.setVar(p, 'slayer_unlocks', 1 << 6);
    check('  and arrive with it', can(REDDRAGON), true);

    H.setVar(p, 'slayer_unlocks', 0);
    check('  aviansies wait for Watch the Birdie', can(AVIANSIE), false);
    H.setVar(p, 'slayer_unlocks', 1 << 7);
    check('  and arrive with it', can(AVIANSIE), true);

    // The one that is still a place rather than a monster.
    H.setVar(p, 'slayer_unlocks', -1);
    check('  a shade is refused however much you have bought', can(SHADE), false);
    H.despawn(p);
}

console.log('\nTHE FUNGICIDE CAN: TEN PUMPS, THEN A REFILL');
{
    const p: Player = player('spraysim', 3200, 3200);
    H.clearInv(p);
    H.give(p, 'slayer_spray_pump_10', 1);
    const held = (name: string) => H.invCount(p, name);

    H.runProc(p, '[proc,zygomite_spray_spend]', []);
    check('  one spray takes the can from 10 to 9', [held('slayer_spray_pump_10'), held('slayer_spray_pump_9')], [0, 1]);
    for (let i = 0; i < 9; i++) {
        H.runProc(p, '[proc,zygomite_spray_spend]', []);
    }
    check('  ten sprays empty it', [held('slayer_spray_pump_0'), H.runProc(p, '[proc,zygomite_spray_held]', [])[0]], [1, 0]);

    // An empty can is a tin until fungicide goes back in it, which is what the shop sells it for.
    H.give(p, 'slayer_fungicide', 1);
    H.runProc(p, '[proc,zygomite_spray_refill]', [ObjType.getId('slayer_spray_pump_0')]);
    check('  and fungicide fills it again', [held('slayer_spray_pump_10'), held('slayer_fungicide')], [1, 0]);
    check('  which makes it count as held once more', H.runProc(p, '[proc,zygomite_spray_held]', [])[0], 1);
    H.despawn(p);
}

console.log(`\n${R.ok} ok, ${R.bad} FAIL`);
process.exit(R.bad ? 1 : 0);
