// The nine Graceful recolours: the shop that sells them, the kit that applies one, and Revert.
// Usage: npx tsx tools/sim/graceful.ts   (exit code is the verdict)
//
// WHAT THIS IS FOR. The packer proves the 63 generated objs exist and that every name the enum and
// the stock list mention resolves. It cannot tell you that a coloured piece is still worth the same
// as the piece it is a colour of - and that is the one mistake here that would never be noticed,
// because the ENTIRE graceful effect is each record's own weight= line and its
// param=energy_restore with no script anywhere (skilling_outfits/scripts/outfit_effects.rs2 says
// so). A colour that lost 4kg of weight reduction would look right, wear right, and quietly be
// worse. So the first and longest section here is 54 comparisons against the plain pieces.
import * as H from './harness.js';
import InvType from '#/cache/config/InvType.js';
import NpcType from '#/cache/config/NpcType.js';
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

const PIECES = ['hood', 'top', 'legs', 'boots', 'gloves', 'cape'];
const COLOURS = ['draynor', 'alkharid', 'varrock', 'canifis', 'falador', 'seers', 'pollnivneach', 'rellekka', 'ardougne'];
const LUMBRIDGE = [3222, 3222];
let bucket = 1;
function player(name: string): Player {
    const p = H.makePlayer(name, LUMBRIDGE[0], LUMBRIDGE[1], bucket++);
    H.tick(2);
    H.maxOut(p);
    H.clearInv(p);
    return p;
}
const settle = (n = 4) => {
    for (let t = 0; t < n; t++) H.tick(1);
};
const mesSince = (p: Player, from: number) =>
    H.mesgs
        .slice(from)
        .filter(m => m.who === p.username)
        .map(m => m.text);
const param = (objName: string, paramName: string): unknown => {
    const o = ObjType.get(ObjType.getId(objName)) as unknown as { params: Map<number, unknown> };
    return o.params?.get(ParamType.getId(paramName));
};

// ---------------------------------------------------------------------------------------------
console.log('== all 63 objs exist');
{
    const missing: string[] = [];
    for (const c of COLOURS) {
        for (const pc of PIECES) if (ObjType.getId(`graceful_${pc}_${c}`) === -1) missing.push(`graceful_${pc}_${c}`);
        if (ObjType.getId(`graceful_kit_${c}`) === -1) missing.push(`graceful_kit_${c}`);
    }
    check('every colour of every piece, and nine kits', missing, []);
}

// ---------------------------------------------------------------------------------------------
console.log('== a colour is worth exactly what the plain piece is worth');
{
    // The whole point. weight and energy_restore ARE the graceful set, so these must match the
    // plain record to the number - and so must the wear positions, or a colour could occupy a
    // different slot and stack with itself.
    const bad: string[] = [];
    for (const pc of PIECES) {
        const plain = ObjType.get(ObjType.getId(`graceful_${pc}`)) as unknown as Record<string, unknown>;
        for (const c of COLOURS) {
            const col = ObjType.get(ObjType.getId(`graceful_${pc}_${c}`)) as unknown as Record<string, unknown>;
            if (col.weight !== plain.weight) bad.push(`${pc}/${c} weight ${col.weight} vs ${plain.weight}`);
            if (param(`graceful_${pc}_${c}`, 'energy_restore') !== param(`graceful_${pc}`, 'energy_restore')) {
                bad.push(`${pc}/${c} energy_restore`);
            }
            for (const f of ['wearpos', 'wearpos2', 'wearpos3', 'category']) {
                if (col[f] !== plain[f]) bad.push(`${pc}/${c} ${f}`);
            }
            if (col.tradeable !== plain.tradeable) bad.push(`${pc}/${c} tradeable`);
        }
    }
    check('54 colours match their plain piece on weight, energy, slots, category, tradeable', bad, []);
    // And a spot value, so "they all match" cannot pass by everything being null.
    check('the plain cape really does reduce weight', (ObjType.get(ObjType.getId('graceful_cape')) as unknown as Record<string, unknown>).weight, -4000);
    check('and so does the Varrock one', (ObjType.get(ObjType.getId('graceful_cape_varrock')) as unknown as Record<string, unknown>).weight, -4000);
    check('the plain cape restores energy', param('graceful_cape', 'energy_restore'), 8);
    check('and so does the Varrock one', param('graceful_cape_varrock', 'energy_restore'), 8);
}

// ---------------------------------------------------------------------------------------------
console.log('== the colours really are different colours');
{
    // Two recolour pairs per piece against the two largest face groups on the mesh. If the
    // generator ever wrote the same target twice, every colour would be the same colour.
    // ObjType keeps them as recol_s / recol_d arrays, not recol1s/recol1d fields - the config
    // spelling is not the decoded spelling.
    const mains = new Set<string>();
    for (const c of COLOURS) {
        const o = ObjType.get(ObjType.getId(`graceful_cape_${c}`)) as unknown as { recol_s: Uint16Array | null; recol_d: Uint16Array | null };
        // 8417 and 8396, not the config's 32656 and 22160: a config carries recolNs as RGB15 and
        // the packer converts it to the HSL16 a model actually stores. Those two numbers are
        // exactly what tools/models/ob2palette.py reports as the two largest face groups on every
        // graceful mesh, so this checks the recolour targets a colour the mesh really has - which
        // is the one thing a wrong source would get silently wrong (ob2render.py warns about it
        // for the same reason).
        check(`${c}: recolours the garment and the trim the meshes actually use`, [...(o.recol_s ?? [])], [8417, 8396]);
        mains.add(JSON.stringify([...(o.recol_d ?? [])]));
    }
    check('nine distinct colour pairs', mains.size, 9);
}

// ---------------------------------------------------------------------------------------------
console.log("== Grace's shop");
{
    const g = NpcType.get(NpcType.getId('grace')) as unknown as Record<string, unknown>;
    check('she has a Trade option again', (g.op as string[])?.[2], 'Trade');
    const shop = InvType.get(InvType.getId('grace_shop'));
    check('the shop holds nine rows', shop.size, 9);
    const stocked = [...(shop.stockobj ?? [])].map(id => ObjType.get(id).debugname);
    check(
        'and the nine rows are the nine kits',
        stocked,
        COLOURS.map(c => `graceful_kit_${c}`)
    );
    // The price. She sells at the item's own cost against a per-mille multiplier of 1000, so a
    // kit's cost IS its mark price.
    const costs = COLOURS.map(c => (ObjType.get(ObjType.getId(`graceful_kit_${c}`)) as unknown as Record<string, number>).cost);
    check(
        'every kit costs 50',
        costs,
        COLOURS.map(() => 50)
    );
    // Marks, not coins - the thing that makes the whole shelf a sink for rooftop laps.
    const cur = (NpcType.get(NpcType.getId('grace')) as unknown as { params: Map<number, unknown> }).params?.get(ParamType.getId('shop_currency'));
    check('shop_currency is the mark', ObjType.get(Number(cur)).debugname, 'mark_of_grace');
    // Untradeable, so ~can_sell_obj refuses them: she cannot buy a kit back and turn it into marks.
    check('kits are untradeable, so there is no buy-back', (ObjType.get(ObjType.getId('graceful_kit_varrock')) as unknown as Record<string, unknown>).tradeable, false);
}

// ---------------------------------------------------------------------------------------------
console.log('== applying a kit, and taking it back off');
{
    const p = player('dye');
    for (const pc of PIECES) {
        H.clearInv(p);
        H.give(p, `graceful_${pc}`);
        H.give(p, 'graceful_kit_varrock');
        settle(2);
        check(`${pc}: the kit applies`, H.useHeldOn(p, 'graceful_kit_varrock', `graceful_${pc}`), true);
        settle();
        check(`  ${pc} is Varrock now, and the kit is gone`, [H.invCount(p, `graceful_${pc}_varrock`), H.invCount(p, `graceful_${pc}`), H.invCount(p, 'graceful_kit_varrock')], [1, 0, 0]);
        // Revert hands back BOTH, so a colour can be moved around a set for nothing.
        H.opheld(p, `graceful_${pc}_varrock`, 4);
        settle();
        check(`  ${pc}: Revert gives back the piece and the kit`, [H.invCount(p, `graceful_${pc}`), H.invCount(p, 'graceful_kit_varrock'), H.invCount(p, `graceful_${pc}_varrock`)], [1, 1, 0]);
    }
}

// ---------------------------------------------------------------------------------------------
console.log('== the refusals');
{
    const p = player('refuse');
    // A kit on a piece that is already coloured.
    H.clearInv(p);
    H.give(p, 'graceful_cape_varrock');
    H.give(p, 'graceful_kit_falador');
    settle(2);
    let from = H.mesgs.length;
    H.useHeldOn(p, 'graceful_kit_falador', 'graceful_cape_varrock');
    settle();
    check(
        'an already-coloured piece is refused, and says why',
        mesSince(p, from).some(m => /already recoloured/i.test(m)),
        true
    );
    check('  and nothing was consumed', [H.invCount(p, 'graceful_kit_falador'), H.invCount(p, 'graceful_cape_varrock')], [1, 1]);
    // The bug this replaced: it used to turn the cape Falador and eat the Varrock dye, because the
    // coloured copies had inherited graceful_slot from the plain record.
    check('  and the colour was not swapped', H.invCount(p, 'graceful_cape_falador'), 0);

    // A kit on something that is not graceful at all.
    H.clearInv(p);
    H.give(p, 'graceful_kit_falador');
    H.give(p, 'rune_scimitar');
    settle(2);
    from = H.mesgs.length;
    H.useHeldOn(p, 'graceful_kit_falador', 'rune_scimitar');
    settle();
    check(
        'a non-graceful item is refused',
        mesSince(p, from).some(m => /only works on graceful/i.test(m)),
        true
    );
    check('  and the kit survives', H.invCount(p, 'graceful_kit_falador'), 1);

    // Revert with a full pack: two items would arrive where one left.
    H.clearInv(p);
    H.give(p, 'graceful_cape_varrock');
    H.fillInv(p);
    settle(2);
    from = H.mesgs.length;
    H.opheld(p, 'graceful_cape_varrock', 4);
    settle();
    check(
        'Revert into a full pack is refused',
        mesSince(p, from).some(m => /free inventory space/i.test(m)),
        true
    );
    check('  and the coloured piece is still there', H.invCount(p, 'graceful_cape_varrock'), 1);
}

console.log(`\n${R.ok} ok, ${R.bad} FAIL`);
process.exit(R.bad === 0 ? 0 : 1);
