// The Zaros mage arena cape: the kit that repaints an imbued god cape, Revert, and wearing one.
// Usage: npx tsx tools/sim/zaroscape.ts   (exit code is the verdict)
//
// WHAT THIS IS FOR. The packer proves the four objs exist and that the enum resolves. It cannot
// tell you the two things that would actually hurt:
//
//   * that a repaint is still worth exactly what the cape it was made from is worth. The whole
//     promise of the Undertaker's shelf is that it sells status and not power, and a repaint that
//     quietly lost +15 magic attack or a God Wars protection would look right, wear right and be
//     worse. So the first section compares every param against the base cape, both directions.
//   * that it can be WORN. A god cape is not equipped by the generic Wear handler - god_gear.rs2
//     carries an [opheld2] per cape so it can refuse the cape of one god while the staff of
//     another is held - so an obj without its own trigger does nothing at all when clicked, with
//     no message to say so. That is exactly what happened to these three in the client, twice,
//     before the triggers were written, and a screenshot is a poor way to find it out.
import * as H from './harness.js';
import ObjType from '#/cache/config/ObjType.js';
import ParamType from '#/cache/config/ParamType.js';
import Player from '#/engine/entity/Player.js';

await H.boot();
H.loginOrder();

const R = { ok: 0, bad: 0 };
const check = (what: string, got: unknown, want: unknown) => {
    const pass = JSON.stringify(got) === JSON.stringify(want);
    if (pass) R.ok++;
    else R.bad++;
    console.log(`  ${pass ? 'ok  ' : 'FAIL'} ${what}: ${JSON.stringify(got)}${pass ? '' : `   (want ${JSON.stringify(want)})`}`);
};

const PAIRS: [string, string][] = [
    ['imbued_saradomin_cape', 'imbued_zaros_cape_saradomin'],
    ['imbued_guthix_cape', 'imbued_zaros_cape_guthix'],
    ['imbued_zamorak_cape', 'imbued_zaros_cape_zamorak']
];
const LUMBRIDGE = [3222, 3222];
let bucket = 1;
function player(name: string): Player {
    const p = H.makePlayer(name, LUMBRIDGE[0], LUMBRIDGE[1], bucket++);
    H.tick(2);
    H.maxOut(p);
    H.clearInv(p);
    return p;
}
const params = (objName: string): Record<string, unknown> => {
    const o = ObjType.get(ObjType.getId(objName)) as unknown as { params?: Map<number, unknown> };
    const out: Record<string, unknown> = {};
    for (const [id, v] of o.params ?? []) out[ParamType.get(id).debugname ?? String(id)] = v;
    return out;
};
const worn = (p: Player, slot: number): string | null => {
    const inv = p.getInventory(94 /* worn */);
    const o = inv?.get(slot);
    return o ? (ObjType.get(o.id).debugname ?? String(o.id)) : null;
};

// ---------------------------------------------------------------------------------------------
console.log('== the four objs exist');
for (const n of ['zaros_cape_kit', ...PAIRS.map(x => x[1])]) {
    check(n, ObjType.getId(n) !== -1, true);
}

// ---------------------------------------------------------------------------------------------
console.log('== a repaint is worth exactly what its base cape is worth');
for (const [base, zaros] of PAIRS) {
    const b = params(base);
    const z = { ...params(zaros) };
    delete z.zaros_cape_from;                      // the only param a repaint adds
    check(`${zaros} params`, z, b);
    const bo = ObjType.get(ObjType.getId(base));
    const zo = ObjType.get(ObjType.getId(zaros));
    check(`${zaros} wearpos`, zo.wearpos, bo.wearpos);
    check(`${zaros} category`, zo.category, bo.category);
    check(`${zaros} weight`, zo.weight, bo.weight);
}

// ---------------------------------------------------------------------------------------------
console.log('== the kit repaints each of the three, and only those');
for (const [base, zaros] of PAIRS) {
    const p = player(`kit_${base}`);
    H.give(p, 'zaros_cape_kit');
    H.give(p, base);
    check(`${base}: the kit applies`, H.useHeldOn(p, 'zaros_cape_kit', base), true);
    check(`${base}: became the repaint`, H.invCount(p, zaros), 1);
    check(`${base}: base consumed`, H.invCount(p, base), 0);
    check(`${base}: kit consumed`, H.invCount(p, 'zaros_cape_kit'), 0);
}
{
    const p = player('kit_refuses');
    H.give(p, 'zaros_cape_kit');
    H.give(p, 'saradomin_cape');                   // the PLAIN cape, not the imbued one
    const from = H.mesgs.length;
    H.useHeldOn(p, 'zaros_cape_kit', 'saradomin_cape');
    check('a plain god cape is refused', H.invCount(p, 'saradomin_cape'), 1);
    check('the kit survives', H.invCount(p, 'zaros_cape_kit'), 1);
    check('and it says why', H.mesgs.slice(from).some(m => m.text.includes('imbued god cape')), true);
}
{
    const p = player('kit_twice');
    H.give(p, 'zaros_cape_kit', 2);
    H.give(p, 'imbued_zamorak_cape');
    H.useHeldOn(p, 'zaros_cape_kit', 'imbued_zamorak_cape');
    const from = H.mesgs.length;
    H.useHeldOn(p, 'zaros_cape_kit', 'imbued_zaros_cape_zamorak');
    check('a second kit is refused', H.invCount(p, 'zaros_cape_kit'), 1);
    check('and it says why', H.mesgs.slice(from).some(m => m.text.includes('already been repainted')), true);
}

// ---------------------------------------------------------------------------------------------
console.log('== Revert gives back the cape that went in, and the kit');
for (const [base, zaros] of PAIRS) {
    const p = player(`rev_${base}`);
    H.give(p, 'zaros_cape_kit');
    H.give(p, base);
    H.useHeldOn(p, 'zaros_cape_kit', base);
    H.opheld(p, zaros, 5);
    check(`${zaros}: the base cape is back`, H.invCount(p, base), 1);
    check(`${zaros}: so is the kit`, H.invCount(p, 'zaros_cape_kit'), 1);
    check(`${zaros}: the repaint is gone`, H.invCount(p, zaros), 0);
}
{
    const p = player('rev_fullpack');
    H.give(p, 'zaros_cape_kit');
    H.give(p, 'imbued_guthix_cape');
    H.useHeldOn(p, 'zaros_cape_kit', 'imbued_guthix_cape');
    H.fillInv(p);                                   // no room for two items where one is
    const from = H.mesgs.length;
    H.opheld(p, 'imbued_zaros_cape_guthix', 5);
    check('a full pack keeps the cape', H.invCount(p, 'imbued_zaros_cape_guthix'), 1);
    check('and nothing is lost', H.invCount(p, 'zaros_cape_kit'), 0);
    check('and it says why', H.mesgs.slice(from).some(m => m.text.includes('free inventory space')), true);
}

// ---------------------------------------------------------------------------------------------
console.log('== it can be worn, which is the trigger the client could not tell us about');
for (const [, zaros] of PAIRS) {
    const p = player(`wear_${zaros}`);
    H.give(p, zaros);
    H.opheld(p, zaros, 2);
    H.tick(1);
    check(`${zaros} is on the back`, worn(p, 1), zaros);
}

console.log(`\n${R.ok} ok, ${R.bad} failed`);
process.exit(R.bad ? 1 : 0);
