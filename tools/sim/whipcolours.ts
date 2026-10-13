// THE NINE ABYSSAL WHIP RECOLOURS: the copies, the two clicks, and the shelf they come off.
//
//   npx tsx tools/sim/whipcolours.ts
//
// THE CHECK THAT MATTERS MOST IS THE DULLEST ONE. Each coloured whip is a generated copy of
// [abyssal_whip], and that record carries the whip's attack bonuses, its special attack, its five
// animations and its hit sound. A copy that lost any of them would be a worse weapon than the whip
// it is a colour of, and nothing in the game would say so - you would notice as a missing special
// bar or a whip that walked wrong. So every param on the plain whip is compared value for value
// against all nine, and so are the fields that are not params.
//
// THE SECOND IS THE ONE THE GRACEFUL KITS GOT WRONG. An obj has ONE category. A coloured whip's is
// weapon_whip, inherited from the plain record and what drives its attack style and its special; a
// category=whip_coloured line for a Revert trigger would REPLACE it. The graceful recolours shipped
// with exactly that and tools/sim/graceful.ts caught it after the fact. Here Revert is nine
// per-obj triggers instead - and this asserts the category survived.
import * as H from './harness.js';
import InvType from '#/cache/config/InvType.js';
import ObjType from '#/cache/config/ObjType.js';
import ParamType from '#/cache/config/ParamType.js';
import EnumType from '#/cache/config/EnumType.js';
import CategoryType from '#/cache/config/CategoryType.js';
import Player from '#/engine/entity/Player.js';
import World from '#/engine/World.js';

await H.boot();
H.loginOrder();

const R = { ok: 0, bad: 0 };
const check = (what: string, got: unknown, want: unknown) => {
    const pass = JSON.stringify(got) === JSON.stringify(want);
    if (pass) R.ok++;
    else R.bad++;
    console.log(`  ${pass ? 'ok  ' : 'FAIL'} ${what}: ${JSON.stringify(got)}${pass ? '' : `   (want ${JSON.stringify(want)})`}`);
};

const COLOURS = ['volcanic', 'frozen', 'venom', 'gilded', 'shadow', 'bloodbark', 'tempest', 'bone', 'gravedigger'];
const PRICE: Record<string, number> = { gravedigger: 800 };
const BASE = 'abyssal_whip';
const obj = (n: string) => ObjType.get(ObjType.getId(n));

let bucket = 1;
function player(name: string): Player {
    const p = H.makePlayer(name, 3222, 3218, bucket++);
    H.tick(2);
    H.maxOut(p);
    H.clearInv(p);
    return p;
}
const settle = (q: Player, n = 12) => {
    for (let t = 0; t < n; t++) {
        if (!q.delayed && !q.activeScript) return;
        H.tick(1);
    }
};
const mesFor = (q: Player) => H.mesgs.filter(m => m.who === q.username).map(m => m.text);
const said = (q: Player, s: string) => mesFor(q).some(t => t.includes(s));

// ============================================================ 1. the copies are complete
console.log('== every colour is the whole whip');
{
    const base = obj(BASE);
    const own = ParamType.getId('whip_from');
    const colour = ParamType.getId('whip_colour');
    const lost: string[] = [];
    const changed: string[] = [];
    for (const c of COLOURS) {
        const w = obj(`${BASE}_${c}`);
        for (const [pid, val] of base.params) {
            if (!w.params.has(pid)) lost.push(`${c}: lost ${ParamType.get(pid).debugname}`);
            else if (JSON.stringify(w.params.get(pid)) !== JSON.stringify(val)) {
                changed.push(`${c}: ${ParamType.get(pid).debugname} ${JSON.stringify(val)} -> ${JSON.stringify(w.params.get(pid))}`);
            }
        }
        if (!w.params.has(own)) lost.push(`${c}: no whip_from`);
        if (!w.params.has(colour)) lost.push(`${c}: no whip_colour`);
    }
    check('no param from the plain whip is missing', lost, []);
    check('and none has a different value', changed, []);

    // The fields that are not params, and are just as easy to lose in a copy.
    const fields: string[] = [];
    for (const c of COLOURS) {
        const w = obj(`${BASE}_${c}`);
        if (w.cost !== base.cost) fields.push(`${c}: cost ${w.cost} not ${base.cost}`);
        if (w.weight !== base.weight) fields.push(`${c}: weight`);
        if (w.wearpos !== base.wearpos) fields.push(`${c}: wearpos`);
        if (w.manwear !== base.manwear) fields.push(`${c}: manwear model`);
        if (w.womanwear !== base.womanwear) fields.push(`${c}: womanwear model`);
        if (JSON.stringify(w.iop?.[1]) !== JSON.stringify(base.iop?.[1])) fields.push(`${c}: iop2 (Wield)`);
    }
    check('and the non-param fields came across too', fields, []);
}

console.log('== and is still a whip');
{
    // The designed-out bug: category must survive, because it is what the combat code reads.
    const want = CategoryType.getId('weapon_whip');
    const wrong = COLOURS.filter(c => obj(`${BASE}_${c}`).category !== want);
    check('all nine keep category=weapon_whip', wrong, []);
    check("which is the plain whip's own", obj(BASE).category, want);
    // Revert is per-obj, so each needs its own trigger and its own op.
    const noRevert = COLOURS.filter(c => obj(`${BASE}_${c}`).iop?.[4] !== 'Revert');
    check('and each declares iop5=Revert', noRevert, []);
    const noTrigger = COLOURS.filter(c => !H.hasScript(`[opheld5,${BASE}_${c}]`));
    check('with a trigger behind it', noTrigger, []);
}

console.log('== the recolours target both meshes');
{
    // The inventory mesh and the worn mesh do NOT share a source value for the dark segments
    // (0 vs 4228). A kit written with only the inventory pair recolours the icon in the backpack
    // and leaves the whip in the player's hand its original colour.
    //
    // THE STORED VALUES ARE NOT THE ONES IN THE CONFIG. A .obj writes recolNs as RGB15 and the
    // packer converts it to HSL16, which is what ObjType.decode reads back - so the three sources
    // arrive here as the very numbers ob2palette.py reports for the meshes (0 and 16 for the dark
    // segments, 528 for the maroon links), not as the 0 / 4228 / 6210 the generator wrote.
    const DARK_INV = 0;
    const DARK_WORN = 16;
    const SEG = 528;
    const missingWorn: string[] = [];
    for (const c of COLOURS) {
        const w = obj(`${BASE}_${c}`);
        const srcs = Array.from(w.recol_s ?? []);
        // A colour that repaints the dark coil must name BOTH dark sources; one that leaves it
        // black names neither.
        const hasInv = srcs.includes(DARK_INV);
        const hasWorn = srcs.includes(DARK_WORN);
        if (hasInv !== hasWorn) missingWorn.push(`${c}: inv=${hasInv} worn=${hasWorn}`);
        if (!srcs.includes(SEG)) missingWorn.push(`${c}: no segment pair`);
    }
    check('the inventory and worn dark sources are always paired', missingWorn, []);
    // ...and the three that repaint the coil really do carry four pairs, not two.
    const twoSurface = ['frozen', 'bloodbark', 'bone'];
    check(
        'the three that repaint the coil carry three pairs',
        twoSurface.map(c => (obj(`${BASE}_${c}`).recol_s ?? []).length),
        twoSurface.map(() => 3)
    );
    check(
        'and the six that leave it black carry one',
        COLOURS.filter(c => !twoSurface.includes(c)).map(c => (obj(`${BASE}_${c}`).recol_s ?? []).length),
        COLOURS.filter(c => !twoSurface.includes(c)).map(() => 1)
    );
}

// ============================================================ 2. the two clicks
console.log('== using a kit');
{
    const p = player('dyer');
    H.give(p, BASE, 1);
    H.give(p, 'whip_kit_venom', 1);
    H.clearLogs();
    check('the use is accepted', H.useHeldOn(p, 'whip_kit_venom', BASE), true);
    settle(p);
    check('a venom whip, and the kit is gone', [H.invCount(p, `${BASE}_venom`), H.invCount(p, 'whip_kit_venom'), H.invCount(p, BASE)], [1, 0, 0]);
}
{
    // ...and the other way round, which is the whole reason the trigger is on the kit category.
    const p = player('dyer2');
    H.give(p, BASE, 1);
    H.give(p, 'whip_kit_gilded', 1);
    check('whip onto kit is the same click', H.useHeldOn(p, BASE, 'whip_kit_gilded'), true);
    settle(p);
    check('and makes the same whip', H.invCount(p, `${BASE}_gilded`), 1);
}
{
    // THE BUG THE GRACEFUL KITS SHIPPED WITH: a second kit on an already-coloured item consumed
    // itself silently. Here the colour is refused and the kit survives.
    const p = player('twice');
    H.give(p, `${BASE}_venom`, 1);
    H.give(p, 'whip_kit_shadow', 1);
    H.clearLogs();
    H.useHeldOn(p, 'whip_kit_shadow', `${BASE}_venom`);
    settle(p);
    check('a second kit is refused', [H.invCount(p, `${BASE}_venom`), H.invCount(p, 'whip_kit_shadow'), H.invCount(p, `${BASE}_shadow`)], [1, 1, 0]);
    check('and says what to do', said(p, 'already coloured'), true);
}
{
    const p = player('wrong');
    H.give(p, 'bronze_sword', 1);
    H.give(p, 'whip_kit_bone', 1);
    H.clearLogs();
    H.useHeldOn(p, 'whip_kit_bone', 'bronze_sword');
    settle(p);
    check('a kit on a sword does nothing', [H.invCount(p, 'bronze_sword'), H.invCount(p, 'whip_kit_bone')], [1, 1]);
    check('and says so', said(p, 'only works on an abyssal whip'), true);
}

console.log('== Revert');
{
    const p = player('reverter');
    H.give(p, `${BASE}_tempest`, 1);
    H.clearLogs();
    check('op5 is accepted', H.opheld(p, `${BASE}_tempest`, 5), true);
    settle(p);
    check('the plain whip and the kit both come back', [H.invCount(p, BASE), H.invCount(p, 'whip_kit_tempest'), H.invCount(p, `${BASE}_tempest`)], [1, 1, 0]);
    // ...and the whip that comes back is tradeable again, which is what keeps an untradeable
    // result from locking anything away.
    check('and the plain whip is tradeable', obj(BASE).tradeable, true);
    check(
        'while every colour is not',
        COLOURS.filter(c => obj(`${BASE}_${c}`).tradeable),
        []
    );
}
{
    // TWO ITEMS ARRIVE WHERE ONE LEFT. With no free slot the kit would land on the floor, which is
    // the one place a player would not look for it.
    const p = player('fullpack');
    H.give(p, `${BASE}_frozen`, 1);
    H.fillInv(p);
    H.clearLogs();
    H.opheld(p, `${BASE}_frozen`, 5);
    settle(p);
    check('a full pack keeps the coloured whip', H.invCount(p, `${BASE}_frozen`), 1);
    check('and loses no kit', H.invCount(p, 'whip_kit_frozen'), 0);
    check('and says why', said(p, 'free inventory space'), true);
}

// ============================================================ 3. the shelf
console.log('== the Undertaker sells them');
{
    const t = InvType.get(InvType.getId('death_token_shop'));
    const stocked = Array.from(t.stockobj ?? []).map(id => ObjType.get(id).debugname);
    const missing = COLOURS.map(c => `whip_kit_${c}`).filter(k => !stocked.includes(k));
    check('all nine kits are on the shelf', missing, []);
    check('seventeen rows now', t.size, 17);
    check(
        'and the eight he already sold are still there',
        ['slayer_imbue_scroll', 'undertaker_hat', 'undertaker_coat', 'undertaker_trousers', 'undertaker_boots', 'undertaker_cane', 'gravedigger_kit', 'undertaker_cape'].filter(n => !stocked.includes(n)),
        []
    );
    // The price is the kit's own cost, because the Undertaker runs at 1000 per mille.
    const prices = COLOURS.map(c => obj(`whip_kit_${c}`).cost);
    check(
        'eight at 500 and the house colour at 800',
        prices,
        COLOURS.map(c => PRICE[c] ?? 500)
    );
}
{
    // Bought with Death tokens, through the real shop.
    const shop = World.getInventory(InvType.getId('death_token_shop'))!;
    check('the shelf is stocked at boot', shop.getItemCount(ObjType.getId('whip_kit_gravedigger')) > 0, true);
}

console.log('== and they are on his collection log page');
{
    const logged = new Set<number>();
    for (const v of EnumType.get(EnumType.getId('collection_log_items')).values.values()) {
        logged.add(Number(v));
    }
    const missing = COLOURS.map(c => `whip_kit_${c}`).filter(k => !logged.has(ObjType.getId(k)));
    check('every kit can be logged', missing, []);
}

console.log('');
console.log(`${R.ok} passed, ${R.bad} failed`);
process.exit(R.bad ? 1 : 0);
