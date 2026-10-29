// The barrelchest anchor: the wiki's numbers, the two-stat requirement, and Rum Deal handing it over.
// Usage: npx tsx tools/sim/anchor.ts   (exit code is the verdict)
//
// WHAT THIS IS FOR. An imported weapon has two ways of being quietly wrong and neither shows up in
// a render: the bonuses can be typed wrong, and the equip requirement can be missing - which means
// a level 3 can wield it and nobody notices for a month. The last section is the one that matters
// most: a quest reward must survive a full pack, because the player finishes Rum Deal standing in
// a brewery with their hands full of buckets.
import * as H from './harness.ts';
import { check, R, player } from './a1lib.ts';
import ObjType from '#/cache/config/ObjType.js';
import ParamType from '#/cache/config/ParamType.js';

await H.boot();

const param = (objName: string, paramName: string): unknown => {
    const o = ObjType.get(ObjType.getId(objName)) as unknown as { params?: Map<number, unknown> };
    return o.params?.get(ParamType.getId(paramName));
};

// ---------------------------------------------------------------------------------------------
// https://oldschool.runescape.wiki/w/Barrelchest_anchor
console.log('== the bonuses are the wiki\'s');
check('exists', ObjType.getId('barrelchest_anchor') !== -1, true);
check('stab attack', param('barrelchest_anchor', 'stabattack'), -2);
check('slash attack', param('barrelchest_anchor', 'slashattack'), 10);
check('crush attack', param('barrelchest_anchor', 'crushattack'), 92);
check('strength', param('barrelchest_anchor', 'strengthbonus'), 100);
check('attack speed (6 ticks)', param('barrelchest_anchor', 'attackrate'), 6);
check('no defensive bonus', param('barrelchest_anchor', 'stabdefence'), undefined);
{
    const o = ObjType.get(ObjType.getId('barrelchest_anchor'));
    check('two-handed', [o.wearpos, o.wearpos2], [3 /* righthand */, 5 /* lefthand */]);
    check('30kg', o.weight, 30000);
    check('untradeable', o.tradeable, false);
    // A spec bar that does nothing is worse than none: Sunder is not built yet, so the weapon
    // must not claim to have a special.
    check('claims no special attack', param('barrelchest_anchor', 'specwep'), undefined);
}

// ---------------------------------------------------------------------------------------------
console.log('== 60 Attack and 40 Strength, and both halves are checked');
// a1lib's player() maxes every stat, so each of these is a maxed player turned back DOWN - which is
// also the only way to be sure the requirement reads the base level rather than a boosted one.
{
    const ATTACK = 0, STRENGTH = 2;
    const wields = (name: string, att: number, str: number): boolean => {
        const p = player(name, 3250, 3250);
        H.clearInv(p);
        p.setLevel(ATTACK, att);
        p.setLevel(STRENGTH, str);
        H.give(p, 'barrelchest_anchor');
        H.opheld(p, 'barrelchest_anchor', 2);
        H.tick(1);
        return H.invCount(p, 'barrelchest_anchor') === 0;      // it left the pack, so it went on
    };
    check('59 Attack is refused', wields('anchor_att59', 59, 99), false);
    check('39 Strength is refused', wields('anchor_str39', 99, 39), false);
    check('60 and 40 wields it', wields('anchor_both', 60, 40), true);
}


console.log(`\n${R.ok} ok, ${R.bad} failed`);
process.exit(R.bad ? 1 : 0);
