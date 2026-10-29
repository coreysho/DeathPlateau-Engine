// THE TOXIC STAFF OF THE DEAD: made, taken apart, charged, spent, and given back.
//
//   npx tsx tools/sim/toxicstaff.ts
//
// Asked for as "add toxic staff of the dead from osrs cache - implement the ability to create it
// with the correct items". The items are the cache's (area_zulrah/configs/toxic_staff.obj); the
// correct items, and everything that follows from holding one, are what this holds to the wiki:
//
//   * a magic fang on a STAFF OF THE DEAD with a chisel, 59 Crafting, and reversible while it is
//     uncharged - but not once it holds scales;
//   * 75 Attack and 75 Magic to wield;
//   * charged, it is +8 magic attack over the uncharged staff and nothing else;
//   * Zulrah's scales charge it, 11,000 of them, and it spends ten on entering combat and ten
//     every interval it stays in one - the serpentine helm's model, NOT the trident of the
//     swamp's cast-by-cast one;
//   * Uncharge gives every unused scale back, which the trident does not do;
//   * run dry in the hands and it stays wielded as the uncharged staff.
//
// AND THE FANG NOW HAS TWO HOMES, so the last block checks a fang used on a chisel still reaches
// the trident when a trident is what you are carrying.
import * as H from './harness.js';
import * as A from './a1lib.js';
import { check, R, player } from './a1lib.js';
import ObjType from '#/cache/config/ObjType.js';
import InvType from '#/cache/config/InvType.js';
import ParamType from '#/cache/config/ParamType.js';
import { PlayerStat } from '#/engine/entity/PlayerStat.js';

await H.boot();
H.loginOrder();

const CRAFTING = 59;
const MAX = 11000;
const COST = 10;

function kit(p: any, crafting = CRAFTING) {
    H.clearInv(p);
    p.setLevel(PlayerStat.CRAFTING, crafting);
    H.give(p, 'magic_fang', 1);
    H.give(p, 'staff_of_the_dead', 1);
    H.give(p, 'chisel', 1);
    H.setVar(p, 'toxic_staff_charges', 0);
    H.tick(1);
}

console.log("THE ITEMS ARE THE CACHE'S, AND THE FANG IS THE ONLY DIFFERENCE BETWEEN THEM");
{
    const magic = ParamType.getId('magicattack');
    const bare: any = ObjType.get(ObjType.getId('staff_of_the_dead'));
    const cold: any = ObjType.get(ObjType.getId('toxic_staff_uncharged'));
    const hot: any = ObjType.get(ObjType.getId('toxic_staff_of_the_dead'));
    check('  both records exist', [cold.name, hot.name], ['Toxic staff (uncharged)', 'Toxic Staff of the Dead']);
    check("  uncharged carries the staff of the dead's magic attack", cold.params?.get(magic), bare.params?.get(magic));
    check('  charged is +8 on it', hot.params?.get(magic), (bare.params?.get(magic) as number) + 8);
    for (const key of ['stabattack', 'slashattack', 'strengthbonus', 'magicdefence'] as const) {
        const id = ParamType.getId(key);
        check(`    and ${key} is the staff of the dead's on both`, [cold.params?.get(id), hot.params?.get(id)], [bare.params?.get(id), bare.params?.get(id)]);
    }
    check('  the charged one is untradeable', hot.tradeable, false);
    check('    and the uncharged one is not', cold.tradeable, true);
    // The two records point at each other, which is how nothing below has to name them twice.
    check(
        '  each names the other',
        [ObjType.get(cold.params?.get(ParamType.getId('toxic_staff_charged')) as number).debugname, ObjType.get(hot.params?.get(ParamType.getId('toxic_staff_uncharged')) as number).debugname],
        ['toxic_staff_of_the_dead', 'toxic_staff_uncharged']
    );
}

console.log('\nAND THE FANG DOES NOT TAKE POWER OF DEATH OFF IT');
{
    // The staff of the dead's special attack landed the same day this did. A staff of the dead
    // with a fang on it is still a staff of the dead, and Old School's toxic staff has the spec.
    const specwep = ParamType.getId('specwep');
    const energy = ParamType.getId('sa_energy');
    const bare: any = ObjType.get(ObjType.getId('staff_of_the_dead'));
    for (const n of ['toxic_staff_uncharged', 'toxic_staff_of_the_dead']) {
        const t: any = ObjType.get(ObjType.getId(n));
        check(`  ${n.padEnd(24)} carries the spec bar`, t.params?.get(specwep), bare.params?.get(specwep));
        check("    at the staff of the dead's price", t.params?.get(energy), bare.params?.get(energy));
    }
    // And the one proc that says which staves it applies to knows all four.
    const p: any = player('toxspec', 3200, 3200);
    H.maxOut(p);
    H.tick(2);
    for (const [n, want] of [
        ['staff_of_the_dead', 1],
        ['staff_of_light', 1],
        ['toxic_staff_uncharged', 1],
        ['toxic_staff_of_the_dead', 1],
        ['abyssal_whip', 0]
    ] as [string, number][]) {
        const got = A.runProcProtected(p, '[proc,sotd_spec_weapon]', [ObjType.getId(n)]);
        check(`  ~sotd_spec_weapon knows ${n}`, got[0], want);
    }
    H.despawn(p);
}

console.log('\nTHE CORRECT ITEMS MAKE ONE, AND NOTHING ELSE DOES');
{
    const p: any = player('toxmake', 3200, 3200);
    H.maxOut(p);

    kit(p, CRAFTING - 1);
    A.useHeld(p, 'magic_fang', 'staff_of_the_dead');
    check(`  ${CRAFTING - 1} Crafting is refused`, H.invCount(p, 'toxic_staff_uncharged'), 0);
    check('    and keeps both halves', [H.invCount(p, 'magic_fang'), H.invCount(p, 'staff_of_the_dead')], [1, 1]);

    kit(p);
    H.clearInv(p);
    H.give(p, 'magic_fang', 1);
    H.give(p, 'staff_of_the_dead', 1); // no chisel
    H.tick(1);
    A.useHeld(p, 'magic_fang', 'staff_of_the_dead');
    check('  no chisel, no staff', H.invCount(p, 'toxic_staff_uncharged'), 0);

    kit(p);
    A.useHeld(p, 'magic_fang', 'staff_of_the_dead');
    check('  fang on staff at 59 Crafting makes one', H.invCount(p, 'toxic_staff_uncharged'), 1);
    check('    spending both halves', [H.invCount(p, 'magic_fang'), H.invCount(p, 'staff_of_the_dead')], [0, 0]);
    check('    and keeping the chisel', H.invCount(p, 'chisel'), 1);

    // "This process is reversible, provided that the staff is uncharged."
    A.useHeld(p, 'chisel', 'toxic_staff_uncharged');
    check('  a chisel takes it apart again', [H.invCount(p, 'magic_fang'), H.invCount(p, 'staff_of_the_dead')], [1, 1]);
    check('    leaving no staff behind', H.invCount(p, 'toxic_staff_uncharged'), 0);

    // Dismantle does the same without needing the chisel in the pack.
    kit(p);
    A.useHeld(p, 'magic_fang', 'staff_of_the_dead');
    H.clearInv(p);
    H.give(p, 'toxic_staff_uncharged', 1);
    H.tick(1);
    A.held(p, 'toxic_staff_uncharged', 4);
    check('  Dismantle needs no chisel', [H.invCount(p, 'magic_fang'), H.invCount(p, 'staff_of_the_dead')], [1, 1]);
    H.despawn(p);
}

console.log('\nSCALES GO IN, AND EVERY UNUSED ONE COMES BACK OUT');
{
    const p: any = player('toxcharge', 3200, 3200);
    H.maxOut(p);
    H.clearInv(p);
    H.setVar(p, 'toxic_staff_charges', 0);
    H.give(p, 'toxic_staff_uncharged', 1);
    H.give(p, 'zulrahs_scales', 500);
    H.tick(1);

    A.useHeld(p, 'zulrahs_scales', 'toxic_staff_uncharged');
    check('  scales charge it', H.getVar(p, 'toxic_staff_charges'), 500);
    check('    and it becomes the charged record', H.invCount(p, 'toxic_staff_of_the_dead'), 1);
    check('    with the uncharged one gone', H.invCount(p, 'toxic_staff_uncharged'), 0);
    check('    and the scales spent', H.invCount(p, 'zulrahs_scales'), 0);

    const m = A.mark();
    A.held(p, 'toxic_staff_of_the_dead', 3);
    check('  Check says how many', A.saw(A.mesSince(p, m), '500 scales'), true);

    // "Players may uncharge the staff at any time to recover all unused scales."
    A.held(p, 'toxic_staff_of_the_dead', 5);
    check('  Uncharge gives every scale back', H.invCount(p, 'zulrahs_scales'), 500);
    check('    and leaves the uncharged staff', H.invCount(p, 'toxic_staff_uncharged'), 1);
    check('    holding nothing', H.getVar(p, 'toxic_staff_charges'), 0);

    // A charged staff does not come apart - the fang only comes off an empty one.
    H.clearInv(p);
    H.give(p, 'toxic_staff_of_the_dead', 1);
    H.give(p, 'chisel', 1);
    H.setVar(p, 'toxic_staff_charges', 100);
    H.tick(1);
    A.useHeld(p, 'chisel', 'toxic_staff_of_the_dead');
    check('  a charged staff keeps its fang', H.invCount(p, 'magic_fang'), 0);
    check('    and is still a staff', H.invCount(p, 'toxic_staff_of_the_dead'), 1);

    // It will not take more than eleven thousand.
    H.clearInv(p);
    H.give(p, 'toxic_staff_uncharged', 1);
    H.give(p, 'zulrahs_scales', MAX + 250);
    H.setVar(p, 'toxic_staff_charges', 0);
    H.tick(1);
    A.useHeld(p, 'zulrahs_scales', 'toxic_staff_uncharged');
    check('  it fills to eleven thousand and no further', H.getVar(p, 'toxic_staff_charges'), MAX);
    check('    leaving the rest in the pack', H.invCount(p, 'zulrahs_scales'), 250);
    H.despawn(p);
}

console.log("\nAND IT SPENDS THEM THE SERPENTINE HELM'S WAY, NOT THE TRIDENT'S");
{
    const p: any = player('toxburn', 3200, 3200);
    H.maxOut(p);
    H.clearInv(p);
    H.give(p, 'toxic_staff_of_the_dead', 1);
    H.setVar(p, 'toxic_staff_charges', 25);
    H.equip(p, { rhand: 'toxic_staff_of_the_dead' });
    H.tick(2);

    A.runProcProtected(p, '[proc,toxic_staff_combat_entry]');
    H.tick(1);
    check('  entering combat costs ten straight away', H.getVar(p, 'toxic_staff_charges'), 25 - COST);
    A.runProcProtected(p, '[proc,toxic_staff_combat_entry]');
    H.tick(1);
    check('    and entering it again while already in it costs nothing', H.getVar(p, 'toxic_staff_charges'), 25 - COST);

    // Run it dry. The staff stays in the hand as the uncharged record rather than vanishing.
    const m = A.mark();
    A.runProcProtected(p, '[proc,toxic_staff_burn]');
    A.runProcProtected(p, '[proc,toxic_staff_burn]');
    H.tick(2);
    check('  it runs dry rather than going negative', H.getVar(p, 'toxic_staff_charges'), 0);
    check('    and says so', A.saw(A.mesSince(p, m), 'run out of scales'), true);
    check('    staying wielded as the uncharged staff', ObjType.get(p.getInventory(InvType.getId('worn'))!.get(3)!.id).debugname, 'toxic_staff_uncharged');
    H.despawn(p);
}

console.log('\nAND THE FANG STILL KNOWS THE TRIDENT');
{
    const p: any = player('toxfang', 3200, 3200);
    H.maxOut(p);
    p.setLevel(PlayerStat.CRAFTING, CRAFTING);

    // THE DIRECTION MATTERS AND IT IS THE ENGINE'S, not a preference: OpHeldUHandler looks up the
    // trigger of the item being used ON first, so a CHISEL used on the FANG reaches
    // [opheldu,magic_fang] while a fang used on a chisel reaches Crafting's [opheldu,chisel] and
    // its case list. The chisel-on-fang branch is the ambiguous one - it names a tool, not a
    // weapon - and it picks by what is in the pack.
    H.clearInv(p);
    H.give(p, 'magic_fang', 1);
    H.give(p, 'chisel', 1);
    H.give(p, 'trident_of_the_seas_uncharged', 1);
    H.tick(1);
    A.useHeld(p, 'chisel', 'magic_fang');
    check('  chisel on fang, holding a trident, makes the trident', H.invCount(p, 'trident_of_the_swamp_uncharged'), 1);
    check('    and no staff', H.invCount(p, 'toxic_staff_uncharged'), 0);

    // With a staff of the dead instead, the same click makes the staff.
    H.clearInv(p);
    H.give(p, 'magic_fang', 1);
    H.give(p, 'chisel', 1);
    H.give(p, 'staff_of_the_dead', 1);
    H.tick(1);
    A.useHeld(p, 'chisel', 'magic_fang');
    check('  chisel on fang, holding a staff of the dead, makes the staff', H.invCount(p, 'toxic_staff_uncharged'), 1);

    // The unambiguous click, both ways round.
    H.clearInv(p);
    H.give(p, 'magic_fang', 1);
    H.give(p, 'chisel', 1);
    H.give(p, 'staff_of_the_dead', 1);
    H.tick(1);
    A.useHeld(p, 'staff_of_the_dead', 'magic_fang');
    check('  staff on fang makes it too', H.invCount(p, 'toxic_staff_uncharged'), 1);

    // And the fang used straight on the trident is unchanged by any of this.
    H.clearInv(p);
    H.give(p, 'magic_fang', 1);
    H.give(p, 'chisel', 1);
    H.give(p, 'trident_of_the_seas_uncharged', 1);
    H.tick(1);
    A.useHeld(p, 'magic_fang', 'trident_of_the_seas_uncharged');
    check('  and fang straight on the trident still works', H.invCount(p, 'trident_of_the_swamp_uncharged'), 1);
    H.despawn(p);
}

console.log(`\n${R.ok} ok, ${R.bad} FAIL`);
process.exit(R.bad ? 1 : 0);
