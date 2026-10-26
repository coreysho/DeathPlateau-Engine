// THE ELDER CHAOS HOOD'S CHATHEAD, which wore a different colour from the hood.
//
//   npx tsx tools/sim/elderchaos.ts
//
// Reported as "elder chaos - still not fixed in chat box still black". The chat box draws the
// player's chathead, and a hat's contribution to it is its manhead/womanhead model - so that is
// what "in chat box" is about.
//
// WHAT WAS WRONG: the set was imported from a modern OSRS cache by tools/models/importosrs.py,
// which bakes each obj's recolours into the mesh. It did that for the three icons and the six worn
// models - every one of them came out with HSL16 929 for the cloth, 914 for its shadow and 2954
// for the trim - and it did NOT do it for the two head models, which still carry the olive brown
// the OSRS cache ships, 8741 and 4888. The trim colour the heads share with the rest of the set is
// what gives it away: all three rows are the same three surfaces, two of them unrecoloured.
//
// The fix is a recolour pair on the obj, which is what recolours are for: ObjType.method228 applies
// them when it builds the head model, and neither source colour appears in the icon or the worn
// models, so the pair reaches the chathead and nothing else.
//
// THE NUMBERS IN A .obj ARE RGB15, NOT THE HSL16 A MODEL STORES. ObjConfig.ts puts every recolour
// value over 100 through ColorConversion.rgb15toHsl16, so a pair written as the model's own
// colours matches nothing at all and silently does nothing - which the first attempt at this did.
// This checks the pairs AS THE CLIENT RECEIVES THEM, after that conversion, which is the only form
// in which they can be compared with what the model holds.
import * as H from './harness.js';
import { check, R } from './a1lib.js';
import ObjType from '#/cache/config/ObjType.js';

await H.boot();

/** The three colours every model in this set uses, and the two the heads used instead. */
const CLOTH = 929;
const SHADOW = 914;
const OLIVE_CLOTH = 8741;
const OLIVE_SHADOW = 4888;

const recol = (name: string) => {
    const t: { recol_s?: Int32Array | null; recol_d?: Int32Array | null } = ObjType.get(ObjType.getId(name));
    if (!t.recol_s || !t.recol_d) return [] as [number, number][];
    return [...t.recol_s].map((s, i) => [s, t.recol_d![i]] as [number, number]);
};

console.log("THE HOOD RECOLOURS ITS CHATHEAD ONTO THE HOOD'S OWN COLOURS");
{
    const t: { manhead: number; womanhead: number } = ObjType.get(ObjType.getId('elder_chaos_hood'));
    check('  it has a chathead at all, for both genders', [t.manhead >= 0, t.womanhead >= 0], [true, true]);
    check(
        "  and maps the olive cloth and its shadow onto the hood's red",
        recol('elder_chaos_hood').sort((a, b) => a[0] - b[0]),
        [
            [OLIVE_SHADOW, SHADOW],
            [OLIVE_CLOTH, CLOTH]
        ].sort((a, b) => a[0] - b[0])
    );
}

console.log("\nAND THE TOP'S OWN PAIR IS UNTOUCHED");
{
    // 127 is the white sash on the top's mesh and 929 is the red it becomes. This was already
    // right, and reads as a dead pair if you compare the .obj's RGB15 against the model's HSL16
    // without converting - which is the trap this whole file is about.
    check('  the top still turns its white sash red', recol('elder_chaos_top'), [[127, CLOTH]]);
    check('  and the robe needs no recolour', recol('elder_chaos_robe'), []);
}

console.log('\nAND NOTHING ELSE IN THE SET GREW ONE');
{
    // The sources must not appear in the icon or worn models, or this pair would repaint those too.
    // Asserted as the pair being absent from the other two objs rather than by reading meshes,
    // which the engine has no decoder for.
    check(
        '  the top does not carry the chathead pair',
        recol('elder_chaos_top').some(([s]) => s === OLIVE_CLOTH || s === OLIVE_SHADOW),
        false
    );
    check(
        '  nor does the robe',
        recol('elder_chaos_robe').some(([s]) => s === OLIVE_CLOTH || s === OLIVE_SHADOW),
        false
    );
}

console.log(`\n${R.ok} ok, ${R.bad} FAIL`);
process.exit(R.bad ? 1 : 0);
