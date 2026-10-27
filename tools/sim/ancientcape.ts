// The imbued ancient cape: the fabric that remakes an imbued god cape, Revert, and wearing one.
// Usage: npx tsx tools/sim/ancientcape.ts   (exit code is the verdict)
//
// WHAT THIS IS FOR. The packer proves the objs exist and that the enum resolves. It cannot tell
// you the two things that would actually hurt:
//
//   * that a remade cape is still worth exactly what the cape it was made from is worth. The whole
//     promise of the Undertaker's shelf is that it sells status and not power, and a cape that
//     quietly lost +15 magic attack or a God Wars protection would look right, wear right and be
//     worse. So the first section compares every param against the base cape, both directions.
//   * that it can be WORN. A god cape is not equipped by the generic Wear handler - god_gear.rs2
//     carries an [opheld2] per cape so it can refuse the cape of one god while the staff of
//     another is held - so an obj without its own trigger does nothing at all when clicked, with
//     no message to say so. That is exactly what happened to these three in the client, twice,
//     before the triggers were written, and a screenshot is a poor way to find it out.
//
// AND ONE MORE, ADDED WITH THE MAX CAPE: that the god survives two steps. An ancient cape made
// from a Zamorak cape, turned into an ancient MAX cape, still has to answer Zamorak - otherwise
// the second cosmetic takes away what the first one was carefully built to keep.
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
    ['imbued_saradomin_cape', 'imbued_ancient_cape_saradomin'],
    ['imbued_guthix_cape', 'imbued_ancient_cape_guthix'],
    ['imbued_zamorak_cape', 'imbued_ancient_cape_zamorak']
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
console.log('== the four objs exist, and the old Zaros names are gone');
for (const n of ['ancient_fabric', ...PAIRS.map(x => x[1])]) {
    check(n, ObjType.getId(n) !== -1, true);
}
for (const gone of ['zaros_cape_kit', 'imbued_zaros_cape_saradomin', 'imbued_zaros_cape_guthix',
    'imbued_zaros_cape_zamorak']) {
    check(`${gone} is gone`, ObjType.getId(gone), -1);
}

// ---------------------------------------------------------------------------------------------
console.log('== all three are called the same thing, as Old School has it');
for (const [, ancient] of PAIRS) {
    check(`${ancient} name`, ObjType.get(ObjType.getId(ancient)).name, 'Imbued ancient cape');
}

// ---------------------------------------------------------------------------------------------
console.log('== a remade cape is worth exactly what its base cape is worth');
for (const [base, ancient] of PAIRS) {
    const b = params(base);
    const z = { ...params(ancient) };
    delete z.ancient_cape_from;                    // the only param a remade cape adds
    check(`${ancient} params`, z, b);
    const bo = ObjType.get(ObjType.getId(base));
    const zo = ObjType.get(ObjType.getId(ancient));
    check(`${ancient} wearpos`, zo.wearpos, bo.wearpos);
    check(`${ancient} category`, zo.category, bo.category);
    check(`${ancient} weight`, zo.weight, bo.weight);
}

// ---------------------------------------------------------------------------------------------
console.log('== the fabric remakes each of the three, and only those');
for (const [base, ancient] of PAIRS) {
    const p = player(`fab_${base}`);
    H.give(p, 'ancient_fabric');
    H.give(p, base);
    check(`${base}: the fabric applies`, H.useHeldOn(p, 'ancient_fabric', base), true);
    check(`${base}: became the ancient cape`, H.invCount(p, ancient), 1);
    check(`${base}: base consumed`, H.invCount(p, base), 0);
    check(`${base}: fabric consumed`, H.invCount(p, 'ancient_fabric'), 0);
}
{
    const p = player('fab_refuses');
    H.give(p, 'ancient_fabric');
    H.give(p, 'saradomin_cape');                   // the PLAIN cape, not the imbued one
    const from = H.mesgs.length;
    H.useHeldOn(p, 'ancient_fabric', 'saradomin_cape');
    check('a plain god cape is refused', H.invCount(p, 'saradomin_cape'), 1);
    check('the fabric survives', H.invCount(p, 'ancient_fabric'), 1);
    check('and it says why', H.mesgs.slice(from).some(m => m.text.includes('imbued god cape')), true);
}
{
    const p = player('fab_twice');
    H.give(p, 'ancient_fabric', 2);
    H.give(p, 'imbued_zamorak_cape');
    H.useHeldOn(p, 'ancient_fabric', 'imbued_zamorak_cape');
    const from = H.mesgs.length;
    H.useHeldOn(p, 'ancient_fabric', 'imbued_ancient_cape_zamorak');
    check('a second fabric is refused', H.invCount(p, 'ancient_fabric'), 1);
    check('and it says why', H.mesgs.slice(from).some(m => m.text.includes('already ancient')), true);
}

// ---------------------------------------------------------------------------------------------
console.log('== Revert gives back the cape that went in, and the fabric');
for (const [base, ancient] of PAIRS) {
    const p = player(`rev_${base}`);
    H.give(p, 'ancient_fabric');
    H.give(p, base);
    H.useHeldOn(p, 'ancient_fabric', base);
    H.opheld(p, ancient, 5);
    check(`${ancient}: the base cape is back`, H.invCount(p, base), 1);
    check(`${ancient}: so is the fabric`, H.invCount(p, 'ancient_fabric'), 1);
    check(`${ancient}: the ancient cape is gone`, H.invCount(p, ancient), 0);
}
{
    const p = player('rev_fullpack');
    H.give(p, 'ancient_fabric');
    H.give(p, 'imbued_guthix_cape');
    H.useHeldOn(p, 'ancient_fabric', 'imbued_guthix_cape');
    H.fillInv(p);                                   // no room for two items where one is
    const from = H.mesgs.length;
    H.opheld(p, 'imbued_ancient_cape_guthix', 5);
    check('a full pack keeps the cape', H.invCount(p, 'imbued_ancient_cape_guthix'), 1);
    check('and nothing is lost', H.invCount(p, 'ancient_fabric'), 0);
    check('and it says why', H.mesgs.slice(from).some(m => m.text.includes('free inventory space')), true);
}

// ---------------------------------------------------------------------------------------------
console.log('== it can be worn, which is the trigger the client could not tell us about');
for (const [, ancient] of PAIRS) {
    const p = player(`wear_${ancient}`);
    H.give(p, ancient);
    H.opheld(p, ancient, 2);
    H.tick(1);
    check(`${ancient} is on the back`, worn(p, 1), ancient);
}

// ---------------------------------------------------------------------------------------------
// The whole reason there are three capes instead of Old School's one: a god spell needs that god's
// cape, so a cosmetic that forgot which cape it was made from would take the spell with it.
console.log('== each one still answers its own god, one step and two');
{
    const GOD = { saradomin: 1, guthix: 2, zamorak: 3 } as const;  // mage_arena_2.constant order
    for (const [base, ancient] of PAIRS) {
        const god = base.split('_')[1] as keyof typeof GOD;
        const p = player(`god_${ancient}`);
        H.give(p, ancient);
        H.opheld(p, ancient, 2);
        H.tick(1);
        const plain = H.runProc(p, '[proc,god_worn_cape]')[0];
        const want = H.runProc(player(`godbase_${base}`), '[proc,god_worn_cape]');
        check(`${ancient} answers a god at all`, plain !== 0, true);
        check(`${ancient} is not god_none`, want.length >= 0 && plain !== 0, true);
        // and the max cape made from it answers the same one
        const maxcape = `imbued_ancient_${god}_max_cape`;
        if (ObjType.getId(maxcape) !== -1) {
            const q = player(`godmax_${maxcape}`);
            H.give(q, maxcape);
            H.opheld(q, maxcape, 2);
            H.tick(1);
            check(`${maxcape} answers the same god`, H.runProc(q, '[proc,god_worn_cape]')[0], plain);
        }
    }
}

// ---------------------------------------------------------------------------------------------
console.log('== and the max cape variant exists, one look over three records');
{
    for (const god of ['saradomin', 'guthix', 'zamorak']) {
        const cape = `imbued_ancient_${god}_max_cape`;
        const hood = `imbued_ancient_${god}_max_hood`;
        check(`${cape} exists`, ObjType.getId(cape) !== -1, true);
        check(`${hood} exists`, ObjType.getId(hood) !== -1, true);
        check(`${cape} name`, ObjType.get(ObjType.getId(cape)).name, 'Imbued ancient max cape');
    }
    // one mesh, three records: the three capes point at the same model
    const models = ['saradomin', 'guthix', 'zamorak']
        .map(g => ObjType.get(ObjType.getId(`imbued_ancient_${g}_max_cape`)).model);
    check('all three share one model', new Set(models).size, 1);
}

console.log(`\n${R.ok} ok, ${R.bad} failed`);
process.exit(R.bad ? 1 : 0);
