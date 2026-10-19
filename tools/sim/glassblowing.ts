// GLASSBLOWING: every product the pipe can make, which was four of them and is now seven.
//
//   npx tsx tools/sim/glassblowing.ts
//
// Reported from the game as "cant make candle lantern". The chooser was ~multiobj4 and glass.struct
// has had more products than that since the file was written, so the candle lantern, the oil lamp,
// the fishbowl and the lantern lens were unreachable - each of them a real OSRS product with a
// level and an experience value already sitting in the config.
//
// This picks each slot of the menu in turn and checks what comes out, because that is the only
// thing that proves a slot is WIRED: a product can have a struct, a param and a level and still be
// unofferable, which is exactly what these four were.
import * as H from './harness.js';
import * as A from './a1lib.js';
import { check, R, player } from './a1lib.js';
import ObjType from '#/cache/config/ObjType.js';
import ParamType from '#/cache/config/ParamType.js';
import StructType from '#/cache/config/StructType.js';
import { PlayerStat } from '#/engine/entity/PlayerStat.js';

await H.boot();
H.loginOrder();

// level, product, experience in tenths - OSRS's own table off the Molten glass page
const WANT: [number, string, number][] = [
    [1, 'beer_glass', 175],
    [4, 'candle_lantern_empty', 190],
    [12, 'oil_lamp_empty', 250],
    [33, 'vial_empty', 350],
    [42, 'fishbowl_empty', 425],
    [46, 'stafforb', 525],
    [49, 'bullseye_lantern_lens', 550]
];
const sp = (obj: string, p: string) => {
    const st = (ObjType.get(ObjType.getId(obj)) as any).params?.get(ParamType.getId('crafting_glass_struct'));
    return st === undefined ? null : ((StructType.get(st) as any).params?.get(ParamType.getId(p)) ?? null);
};

// PICKING A SLOT OF A SEVEN-WIDE TRAY. a1lib's drive() reads option labels out of com_1..com_5,
// which is multiobj2/3/4's layout; multiobj7 puts its models in com_2..com_8 and its labels in
// com_9..com_15, so a numeric pick through drive() would land on a sword graphic. The proc's own
// switch resumes on either the model or the label for a slot, so clicking the model is the click.
function pick(p: any, slot: number) {
    H.useHeldOn(p, 'molten_glass', 'glassblowingpipe');
    H.tick(1);
    H.choose(p, `multiobj7:com_${slot + 1}`);
    H.tick(3);
}

console.log("THE CONFIG: every product carries a struct, and its numbers are the wiki's");
for (const [lvl, obj, xp] of WANT) {
    check(`  ${obj.padEnd(22)} level ${lvl}, ${xp / 10} experience`, [sp(obj, 'levelrequire') ?? 1, sp(obj, 'productexp')], [lvl, xp]);
}

console.log('\nTHE MENU: each of the seven slots makes its own product');
for (let slot = 1; slot <= WANT.length; slot++) {
    const [, obj, xp] = WANT[slot - 1];
    const p: any = player('glass' + slot, 3200, 3200);
    H.clearInv(p);
    p.setLevel(PlayerStat.CRAFTING, 99);
    H.give(p, 'glassblowingpipe', 1);
    H.give(p, 'molten_glass', 1);
    H.tick(1);
    const xp0 = p.stats[PlayerStat.CRAFTING];
    pick(p, slot);
    check(`  slot ${slot} makes a ${obj}`, [H.invCount(p, obj), H.invCount(p, 'molten_glass')], [1, 0]);
    check(`    ...and pays ${xp / 10}`, p.stats[PlayerStat.CRAFTING] - xp0, xp);
    H.despawn(p);
}

console.log('\nTHE LEVELS: one under each gate is refused by name, and nothing is consumed');
for (const [lvl, obj] of WANT) {
    if (lvl === 1) continue;
    const p: any = player('glasslow_' + obj, 3200, 3200);
    H.clearInv(p);
    p.setLevel(PlayerStat.CRAFTING, lvl - 1);
    H.give(p, 'glassblowingpipe', 1);
    H.give(p, 'molten_glass', 1);
    H.tick(1);
    const m = A.mark();
    pick(p, WANT.findIndex(w => w[1] === obj) + 1);
    check(`  ${obj.padEnd(22)} refused at ${lvl - 1}`, [H.invCount(p, obj), H.invCount(p, 'molten_glass'), A.mesSince(p, m).some(s => s.includes(`level ${lvl} Crafting`))], [0, 1, true]);
    H.despawn(p);
}

console.log('\nAND IT STILL BLOWS THE WHOLE INVENTORY, one click for all of it');
{
    const p: any = player('glassall', 3200, 3200);
    H.clearInv(p);
    p.setLevel(PlayerStat.CRAFTING, 99);
    H.give(p, 'glassblowingpipe', 1);
    H.give(p, 'molten_glass', 12);
    H.tick(1);
    pick(p, 2);
    for (let t = 0; t < 60 && H.invCount(p, 'molten_glass') > 0; t++) H.tick(1);
    check('  twelve molten glass become twelve candle lanterns', [H.invCount(p, 'candle_lantern_empty'), H.invCount(p, 'molten_glass')], [12, 0]);
    H.despawn(p);
}

console.log(`\n${R.ok} ok, ${R.bad} FAIL`);
process.exit(R.bad ? 1 : 0);
