// The two God Wars staves and Saradomin's light.
// Usage: npx tsx tools/sim/gwdstaves.ts   (exit code is the verdict)
//
// WHAT THIS IS FOR.
//
//   * THE COMBINE CANNOT BE UNDONE, so it is the one thing here that could cost a player a staff
//     worth a million coins. The confirmation has to hold both halves: saying no has to leave the
//     light AND the staff exactly where they were, and saying yes has to consume one and replace
//     the other in place rather than adding a third item to the pack.
//   * THE STAFF OF LIGHT ANSWERS TWO GODS. It is the only item in the dungeon that opens a
//     Saradomin door and a Zamorak door, and that is two params on one obj - easy to write, easy
//     to lose, and invisible until somebody walks into a door.
//   * A WEAPON WITH NO EQUIP REQUIREMENT. The generic [opheld2,_] checks no stats at all, so an
//     imported weapon is wieldable at level 1 until something gates it, and nothing errors.
import fs from 'fs';
import Environment from '#/util/Environment.js';
import * as H from './harness.ts';
import { check, R, player, useHeld, mesSince, mark } from './a1lib.ts';
import ObjType from '#/cache/config/ObjType.js';
import ParamType from '#/cache/config/ParamType.js';

await H.boot();

const param = (objName: string, paramName: string): unknown => {
    const o = ObjType.get(ObjType.getId(objName)) as unknown as { params?: Map<number, unknown> };
    return o.params?.get(ParamType.getId(paramName));
};

// ---------------------------------------------------------------------------------------------
// Both staves are OSRS objs 11791 and 22296, read by fillosrsstats.py out of the item table.
console.log('== the two staves carry the cache\'s own numbers');
for (const staff of ['staff_of_the_dead', 'staff_of_light']) {
    check(`${staff} exists`, ObjType.getId(staff) !== -1, true);
    check(`${staff} stab`, param(staff, 'stabattack'), 55);
    check(`${staff} slash`, param(staff, 'slashattack'), 70);
    check(`${staff} magic attack`, param(staff, 'magicattack'), 17);
    check(`${staff} magic defence`, param(staff, 'magicdefence'), 17);
    check(`${staff} strength`, param(staff, 'strengthbonus'), 72);
    check(`${staff} four ticks`, param(staff, 'attackrate'), 4);
    const o = ObjType.get(ObjType.getId(staff));
    check(`${staff} is a staff, so it autocasts`, o.category,
        ObjType.get(ObjType.getId('battlestaff')).category);
    check(`${staff} one-handed`, [o.wearpos, o.wearpos2], [3 /* righthand */, -1]);
    // Power of Death is not built, so the bar must not claim it.
    check(`${staff} claims no special attack`, param(staff, 'specwep'), undefined);
}

// ---------------------------------------------------------------------------------------------
console.log('== the God Wars alignment, which is the reason to make one');
{
    check('the staff of the dead is Zamorak\'s', param('staff_of_the_dead', 'gwd_prot_zamorak'), 1);
    check('and only Zamorak\'s', param('staff_of_the_dead', 'gwd_prot_saradomin'), undefined);
    check('the staff of light is Zamorak\'s', param('staff_of_light', 'gwd_prot_zamorak'), 1);
    check('AND Saradomin\'s', param('staff_of_light', 'gwd_prot_saradomin'), 1);
}

// ---------------------------------------------------------------------------------------------
console.log('== Saradomin\'s light is not a weapon and has no dead options');
{
    const id = ObjType.getId('saradomins_light');
    check('it exists', id !== -1, true);
    const o = ObjType.get(id);
    check('nowhere to wear it', o.wearpos, -1);
    // Old School's Consume lifts the darkness in Zamorak's fortress. There is no darkness here,
    // so the option is deliberately absent rather than present and silent. Drop is on every obj
    // in the game, so the assertion is about Consume and not about the length of the list.
    check('nothing but Drop', o.iop, [null, null, null, null, 'Drop']);
}

// ---------------------------------------------------------------------------------------------
console.log('== 75 Magic and 75 Attack, and both halves are checked, for both staves');
{
    const ATTACK = 0, MAGIC = 6;
    const wields = (staff: string, name: string, att: number, mag: number): boolean => {
        const p = player(name, 2900, 3700);
        H.clearInv(p);
        p.setLevel(ATTACK, att);
        p.setLevel(MAGIC, mag);
        H.give(p, staff);
        H.opheld(p, staff, 2);
        H.tick(1);
        return H.invCount(p, staff) === 0;         // it left the pack, so it went on
    };
    for (const staff of ['staff_of_the_dead', 'staff_of_light']) {
        check(`${staff}: 74 Attack is refused`, wields(staff, `${staff}_a74`, 74, 99), false);
        check(`${staff}: 74 Magic is refused`, wields(staff, `${staff}_m74`, 99, 74), false);
        check(`${staff}: 75 and 75 wields it`, wields(staff, `${staff}_both`, 75, 75), true);
    }
}

// ---------------------------------------------------------------------------------------------
console.log('== the combine, and the way out of it');
{
    const p = player('sol_no', 2900, 3700);
    H.clearInv(p);
    H.give(p, 'saradomins_light');
    H.give(p, 'staff_of_the_dead');
    useHeld(p, 'saradomins_light', 'staff_of_the_dead', [2]);   // "No, leave them as they are."
    check('saying no keeps the light', H.invCount(p, 'saradomins_light'), 1);
    check('and the staff', H.invCount(p, 'staff_of_the_dead'), 1);
    check('and makes nothing', H.invCount(p, 'staff_of_light'), 0);
}
{
    const p = player('sol_yes', 2900, 3700);
    H.clearInv(p);
    H.give(p, 'saradomins_light');
    H.give(p, 'staff_of_the_dead');
    useHeld(p, 'saradomins_light', 'staff_of_the_dead', [1]);   // "Combine them?"
    check('saying yes consumes the light', H.invCount(p, 'saradomins_light'), 0);
    check('and the staff', H.invCount(p, 'staff_of_the_dead'), 0);
    check('and gives the staff of light', H.invCount(p, 'staff_of_light'), 1);
    // One item in, one out - not two. A pack with a hole in it is how a combine loses a staff.
    const inv = p.getInventory(93);
    let used = 0;
    for (let i = 0; i < (inv?.capacity ?? 28); i++) if (inv?.get(i)) used++;
    check('one slot used, not two', used, 1);
}
{
    const p = player('sol_wrong', 2900, 3700);
    H.clearInv(p);
    H.give(p, 'saradomins_light');
    H.give(p, 'zamorakian_spear');
    const from = mark();
    useHeld(p, 'saradomins_light', 'zamorakian_spear');
    check('the light refuses anything else', H.invCount(p, 'saradomins_light'), 1);
    check('and says why', mesSince(p, from).some(m => m.includes('staff of the dead')), true);
}
{
    // Irreversible: there is no Revert and nothing turns it back.
    const o = ObjType.get(ObjType.getId('staff_of_light'));
    check('the staff of light has no Revert', o.iop.some(x => x === 'Revert'), false);
}

// ---------------------------------------------------------------------------------------------
console.log('== and both are on the right boss, at Old School\'s rates');
{
    const rs2 = fs.readFileSync(`${Environment.BUILD_SRC_DIR}/scripts/bosses/godwars/scripts/gwd_drops.rs2`, 'ascii');
    const kril = rs2.slice(rs2.indexOf('[proc,gwd_unique_roll_kril]'), rs2.indexOf('[proc,gwd_unique_roll_zilyana]'));
    const zil = rs2.slice(rs2.indexOf('[proc,gwd_unique_roll_zilyana]'), rs2.indexOf('[proc,gwd_unique_roll_kreearra]'));
    // The unique roll is random(1524) and 1524 = LCM of 381/508/762/127, so a rate is a band
    // width: 3/1524 is 1/508 and 6/1524 is 1/254. The whole table is asserted rather than just
    // the new line, because a band is only right relative to the one below it - an item inserted
    // in the middle moves every rate after it without touching a number.
    //
    // `$drop = null` appears twice in each proc - the declaration and the `if ($drop = null)`
    // comparison, since `=` is a comparison inside an if - so it is filtered out here.
    const drops = (proc: string) => (proc.match(/\$drop = (\w+)/g) ?? [])
        .map(m => m.slice('$drop = '.length)).filter(n => n !== 'null');
    check("K'ril's uniques, in band order", drops(kril),
        ['zamorakian_spear', 'zamorak_hilt', 'godsword_shard_1', 'godsword_shard_2',
            'godsword_shard_3', 'staff_of_the_dead']);
    check('the staff of the dead is the 1/508 band', /\$random < 24\)[^}]*staff_of_the_dead/.test(kril), true);
    check("Zilyana's uniques, in band order", drops(zil),
        ['saradomin_sword', 'saradomin_hilt', 'godsword_shard_1', 'godsword_shard_2',
            'godsword_shard_3', 'armadyl_crossbow', 'saradomins_light']);
    check("Saradomin's light is the 1/254 band", /\$random < 30\)[^}]*saradomins_light/.test(zil), true);
    check('neither is on the other boss', kril.includes('saradomins_light') || zil.includes('staff_of_the_dead'), false);
}

console.log(`\n${R.ok} ok, ${R.bad} failed`);
process.exit(R.bad ? 1 : 0);
