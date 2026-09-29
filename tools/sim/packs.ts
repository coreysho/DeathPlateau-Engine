// Item packs against the real engine - run with `npx tsx tools/sim/packs.ts`.
//
// Added with the water-filled vial pack (content scripts/item_packs). Two things are being held
// down here, and they are different in kind:
//
//   shops     what the PACKED InvType actually holds, and what Inventory.fromType then seeds a
//             live shop container with. A shop that reads right in all.inv and packs wrong is a
//             real failure mode in this build - a gap in the stock numbering used to pack as obj
//             65535 and show as a blank square in the shop window - so the stock is read back out
//             of the built cache rather than out of the source file.
//   opening   that Open gives the documented contents, that a completely full inventory can still
//             open a pack (the pack's own slot is what the contents go into), and that the rest of
//             a stack of packs then open themselves without pinning the player in place.
import * as H from './harness.ts';
import InvType from '#/cache/config/InvType.js';
import ObjType from '#/cache/config/ObjType.js';
import ParamType from '#/cache/config/ParamType.js';
import { Inventory } from '#/engine/Inventory.js';
import Player from '#/engine/entity/Player.js';

await H.boot();
H.loginOrder();
let ok = 0,
    bad = 0,
    n = 0;
const check = (what: string, got: unknown, want: unknown) => {
    const pass = JSON.stringify(got) === JSON.stringify(want);
    pass ? ok++ : bad++;
    console.log(`  ${pass ? 'ok  ' : 'FAIL'} ${what}: ${JSON.stringify(got)}${pass ? '' : `   (want ${JSON.stringify(want)})`}`);
};

const fresh = () => {
    H.clearLogs();
    const p: Player = H.makePlayer('pack' + n, 3222, 3218, 70 + n);
    n++;
    H.tick(2);
    H.clearInv(p);
    H.tick(1);
    return p;
};

// ---------------------------------------------------------------- the item itself
// Every number here was read out of a modern OSRS cache (obj 11879) by tools/models/importosrs.py,
// and agrees with the item's own OSRS wiki page: value 201, weight 2.100, noteable, tradeable, free.
console.log('\nwater-filled vial pack, the obj');
{
    const id = ObjType.getId('water_filled_vial_pack');
    const o = ObjType.get(id);
    const cert = ObjType.get(ObjType.getId('cert_water_filled_vial_pack'));
    check('name', o.name, 'Water-filled vial pack');
    check('examine', o.desc, 'A pack containing 100 vials of water.');
    check('cost', o.cost, 201);
    check('weight (grams)', o.weight, 2100);
    check('members', o.members, false);
    check('tradeable', o.tradeable, true);
    check('stackable', o.stackable, false);
    // The wiki's "options = Open, Drop". Drop is iop5 on every obj in the build, so the pack adds
    // only Open - there is no Open-all, no Use, nothing else to click.
    check('inventory ops', o.iop?.filter(x => x), ['Open', 'Drop']);
    check('noted form links back', cert.certlink, id);
    check('obj id is inside the round-s range', id >= 10730 && id <= 10769, true);
    check('model id is inside the round-s range', o.model >= 24600 && o.model <= 24699, true);

    const contents = ParamType.getId('item_pack_contents');
    const amount = ParamType.getId('item_pack_amount');
    check('opens into', ObjType.get(o.params!.get(contents) as number).debugname, 'cert_vial_water');
    check('how many', o.params!.get(amount), 100);
}

// ---------------------------------------------------------------- the shops
// shop -> [slot the pack must sit in (1-based, the OSRS row order), stock, restock]. Each number is
// off that shop's own Stock table on the OSRS wiki.
console.log('\nshops that stock it');
const SHOPS: Record<string, [number, number, number]> = {
    adventurershop: [2, 250, 10], // Aemad's Adventuring Supplies, East Ardougne
    herbloreshop: [2, 750, 50], // Jatix's Herblore Shop, Taverley
    herbloreshop2: [2, 8, 50], // Frincos' Fabulous Herb Store, Entrana
    herbloreshopogre: [2, 8, 50], // Grud's Herblore Stall, Gu'Tanoth
    junglestore: [13, 50, 50], // Jiminua's Jungle Store, Tai Bwo Wannai
    shilojunglestore: [22, 50, 50], // Obli's General Store, Shilo Village
    viking_general_store: [13, 10, 20], // Sigmund the Merchant, Rellekka
    razmiregeneralstore: [10, 50, 100], // Razmire General Store, Mort'ton
    lighthouseshop: [17, 100, 100] // Jossik's Wares, the Lighthouse
};
const packId = ObjType.getId('water_filled_vial_pack');
for (const [shop, [slot, stock, restock]] of Object.entries(SHOPS)) {
    const t = InvType.getByName(shop)!;
    const i = slot - 1;
    check(`${shop} stock${slot}`, [ObjType.get(t.stockobj![i]).debugname, t.stockcount![i], t.stockrate![i]], ['water_filled_vial_pack', stock, restock]);
    // The live container, not just the type: this is the step that would have caught the blank
    // square, because obj 65535 only appears once Inventory.fromType has seeded the shop.
    const live = Inventory.fromType(InvType.getId(shop));
    check(`${shop} live container holds ${stock}`, live.getItemCount(packId), stock);
    check(`${shop} live container has no blank square`, [...Array(live.capacity).keys()].some(s => live.get(s)?.id === 65535), false);
}

// ---------------------------------------------------------------- what it costs
// No price is written anywhere for this item: shop.rs2 works one out from the obj's cost and the
// shop's own multiplier, so the check is that the multiplier each shop ALREADY had, applied to
// cost 201, lands on the price Old School charges. Right-hand column is the price the shop's own
// OSRS wiki page prints. calc_shop_value is the engine's own proc, called here with a price_mod of
// 0, which is what it gets at full stock.
console.log('\nwhat a player pays');
{
    const p = fresh();
    // shop, its sell multiplier as this build already had it, the OSRS wiki's price
    const PRICED: [string, number, number, number][] = [
        ['Aemad-s', 1300, 20, 261],
        ['Jatix-s', 1000, 30, 201],
        ['Frincos-', 1000, 20, 201],
        ['Grud-s', 1300, 30, 261],
        ['Jiminua-s', 1500, 20, 301],
        ['Obli-s', 1500, 20, 301],
        ['Sigmund-s', 1300, 30, 261],
        ['Razmire-s', 1300, 30, 261]
    ];
    for (const [who, sell, haggle, want] of PRICED) {
        check(`${who} charges`, H.runProc(p, '[proc,calc_shop_value]', [201, haggle, sell, 0])[0], want);
    }
    // The one that does not match, and is deliberately left alone. Old School's Lighthouse store
    // sells at 1100 and would charge 221; this build's Jossik has always sold at 1300, so he
    // charges 261. Changing it would reprice all 24 of his other lines - every one of them 2006
    // stock - to chase one 2014 item, which is exactly what the era rule forbids.
    check('Jossik charges (his own 1300, not OSRS-s 1100)', H.runProc(p, '[proc,calc_shop_value]', [201, 15, 1300, 0])[0], 261);
}

// ---------------------------------------------------------------- opening one
console.log('\nopening one pack');
{
    const p = fresh();
    H.give(p, 'water_filled_vial_pack', 1);
    H.opheld(p, 'water_filled_vial_pack', 1);
    check('the pack is gone', H.invCount(p, 'water_filled_vial_pack'), 0);
    check('100 NOTED vials of water', H.invCount(p, 'cert_vial_water'), 100);
    check('and no unnoted ones', H.invCount(p, 'vial_water'), 0);
    check('it took one slot, not a hundred', [...Array(p.getInventory(InvType.INV)!.capacity).keys()].filter(s => p.getInventory(InvType.INV)!.get(s)).length, 1);
}

// ---------------------------------------------------------------- opening with no free slot
// The case the brief calls "no space". There is none to be had: the inventory is 28/28 with the
// pack as one of them, and it opens anyway, because the pack's own slot is freed before the noted
// stack is added. This is the check that would fail if anyone ever "fixed" the missing space guard.
console.log('\nopening with a completely full inventory');
{
    const p = fresh();
    H.give(p, 'water_filled_vial_pack', 1);
    H.fillInv(p);
    const inv = p.getInventory(InvType.INV)!;
    check('inventory really is full first', inv.freeSlotCount, 0);
    H.opheld(p, 'water_filled_vial_pack', 1);
    check('it still opened', H.invCount(p, 'cert_vial_water'), 100);
    check('the pack is gone', H.invCount(p, 'water_filled_vial_pack'), 0);
    check('still full, the stack took the pack-s slot', inv.freeSlotCount, 0);
    check('nothing else was destroyed to make room', H.invCount(p, 'bronze_arrow'), 27);
}

// A full inventory that ALREADY holds noted vials merges into that stack instead.
{
    const p = fresh();
    H.give(p, 'water_filled_vial_pack', 1);
    H.give(p, 'cert_vial_water', 5);
    H.fillInv(p);
    H.opheld(p, 'water_filled_vial_pack', 1);
    check('merged into the stack already held', H.invCount(p, 'cert_vial_water'), 105);
}

// ---------------------------------------------------------------- the rest open themselves
// Measured cadence with five packs: the clicked one opens on the click, then the rest at ticks
// +3, +5, +7 and +9 - one every 2 ticks once the run is going. The OSRS wiki's Item pack page puts
// it at "1 pack every 1 or 2 game ticks", so this is inside what Old School does. The first gap is
// the odd one at 3 ticks, because the queue entry is made during the tick the click lands in.
console.log('\nthree packs, one click');
{
    const p = fresh();
    H.give(p, 'water_filled_vial_pack', 3);
    H.opheld(p, 'water_filled_vial_pack', 1);
    check('the clicked one opens at once', [H.invCount(p, 'water_filled_vial_pack'), H.invCount(p, 'cert_vial_water')], [2, 100]);
    check('the player is not pinned in place', p.delayed, false);
    H.tick(3);
    check('the second follows on its own', [H.invCount(p, 'water_filled_vial_pack'), H.invCount(p, 'cert_vial_water')], [1, 200]);
    H.tick(2);
    check('and the last, two ticks after that', [H.invCount(p, 'water_filled_vial_pack'), H.invCount(p, 'cert_vial_water')], [0, 300]);
    H.tick(6);
    check('nothing keeps running once they are gone', H.invCount(p, 'cert_vial_water'), 300);
}

// Walking away stops the run - the weak queue is cleared by clearPendingAction, and that is the
// interruption OSRS's "you can keep moving" behaviour needs to not be a pin.
console.log('\nwalking away mid-run');
{
    const p = fresh();
    H.give(p, 'water_filled_vial_pack', 3);
    H.opheld(p, 'water_filled_vial_pack', 1);
    check('walk click is accepted, not discarded', H.walkTo(p, 3226, 3218), true);
    H.tick(6);
    check('the player did move', [p.x, p.z], [3226, 3218]);
    check('packs left unopened', H.invCount(p, 'water_filled_vial_pack') > 0, true);
}

// ================================================================ the rune packs
// Five elemental rune packs, added after the vial pack. They differ from it in one way that is
// worth holding down: their contents are UNNOTED. The OSRS wiki's Item pack page says a pack opens
// noted "unless the item is already stackable", and runes stack, so these hand over real runes
// while the vial pack hands over a note.
console.log('\nthe five rune packs, the objs');
const RUNE_PACKS: [string, string, number, string][] = [
    // pack, examine noun, cost from the cache, the rune it becomes
    ['air_rune_pack', 'air', 430, 'airrune'],
    ['water_rune_pack', 'water', 430, 'waterrune'],
    ['earth_rune_pack', 'earth', 430, 'earthrune'],
    ['fire_rune_pack', 'fire', 430, 'firerune'],
    ['mind_rune_pack', 'mind', 330, 'mindrune']
];
{
    const contents = ParamType.getId('item_pack_contents');
    const amount = ParamType.getId('item_pack_amount');
    const models = new Set<number>();
    for (const [pack, noun, cost, rune] of RUNE_PACKS) {
        const id = ObjType.getId(pack);
        const o = ObjType.get(id);
        check(`${pack} name/examine`, [o.name, o.desc], [`${noun[0].toUpperCase()}${noun.slice(1)} rune pack`, `A pack containing 100 ${noun} runes.`]);
        check(`${pack} cost`, o.cost, cost);
        check(`${pack} weight (grams)`, o.weight, 4535);
        check(`${pack} free, tradeable, unstackable`, [o.members, o.tradeable, o.stackable], [false, true, false]);
        check(`${pack} inventory ops`, o.iop?.filter(x => x), ['Open', 'Drop']);
        check(`${pack} noted form links back`, ObjType.get(ObjType.getId('cert_' + pack)).certlink, id);
        check(`${pack} obj id in range`, id >= 10732 && id <= 10769, true);
        check(`${pack} model id in range`, o.model >= 24601 && o.model <= 24699, true);
        check(`${pack} opens into 100 UNNOTED ${rune}`, [ObjType.get(o.params!.get(contents) as number).debugname, o.params!.get(amount)], [rune, 100]);
        models.add(o.model);
    }
    // They are five different sacks, not one sack five times - the glyph on the front is the only
    // way a player tells them apart in the inventory.
    check('five distinct models', models.size, 5);
}

// The sixth pack is absent ON PURPOSE. Old School sells a chaos rune pack beside these five in
// every shop below; the owner left it out because 100 chaos runes for one click is a lever on a
// 2006 rune economy that five cheap elementals are not. This check is here so that decision cannot
// be undone by accident - if someone adds the obj without reading item_packs.obj, this fails and
// tells them where to look.
console.log('\nthe chaos rune pack, which is deliberately not here');
{
    check('no chaos_rune_pack obj', ObjType.getId('chaos_rune_pack'), -1);
    const packIds = new Set(RUNE_PACKS.map(([p]) => ObjType.getId(p)));
    packIds.add(ObjType.getId('water_filled_vial_pack'));
    const strayPacks: string[] = [];
    for (let i = 0; i < ObjType.count; i++) {
        const o = ObjType.get(i);
        if (o?.category === ObjType.get(ObjType.getId('air_rune_pack')).category && !packIds.has(i)) strayPacks.push(o.debugname ?? String(i));
    }
    check('and nothing else has crept into the item_pack category', strayPacks, []);
}

// ---------------------------------------------------------------- the rune shops
// shop -> first pack row (1-based), then fire/water/air/earth stock+restock, then mind's. Old
// School lists them fire, water, air, earth, mind in every one of these shops. Numbers are off
// each shop's own OSRS wiki Stock table.
console.log('\nshops that stock the rune packs');
{
    const RUNE_SHOPS: [string, number, number, number, number, number][] = [
        // shop, first row, elem stock, elem restock, mind stock, mind restock
        ['runeshop', 9, 80, 10, 40, 10], // Aubury's Rune Shop, Varrock
        ['magicshop', 9, 80, 10, 40, 10], // Betty's Magic Emporium, Port Sarim
        ['magicguildshop', 13, 80, 10, 40, 10], // Magic Guild Store, Wizards' Guild
        ['pest_rune_store', 9, 80, 10, 40, 10], // Void Knight Magic Store
        ['magearena_runeshop', 12, 5, 40, 4, 40], // Lundail's, the Mage Arena
        ['darkruneshop_uber', 9, 50, 2, 35, 5], // Battle Runes, after Enter the Abyss
        ['darkruneshop_crap', 9, 35, 15, 25, 25] // Battle Runes, before it
    ];
    const ORDER = ['fire_rune_pack', 'water_rune_pack', 'air_rune_pack', 'earth_rune_pack', 'mind_rune_pack'];
    for (const [shop, first, es, er, ms, mr] of RUNE_SHOPS) {
        const t = InvType.getByName(shop)!;
        const got = ORDER.map((_, k) => {
            const i = first - 1 + k;
            return [ObjType.get(t.stockobj![i]).debugname, t.stockcount![i], t.stockrate![i]];
        });
        const want = ORDER.map(p => [p, p === 'mind_rune_pack' ? ms : es, p === 'mind_rune_pack' ? mr : er]);
        check(`${shop} rows ${first}-${first + 4}`, got, want);
        const live = Inventory.fromType(InvType.getId(shop));
        check(`${shop} live container, no blank square`, [...Array(live.capacity).keys()].some(s => live.get(s)?.id === 65535), false);
        check(`${shop} sells no chaos pack`, [...Array(live.capacity).keys()].some(s => (ObjType.get(live.get(s)?.id ?? 0).debugname ?? '').includes('chaos_rune_pack')), false);
    }
    // Tutab's is the odd one and is meant to be: Old School stocks only the four elementals on Ape
    // Atoll, with no mind pack, matching the loose runes the shop carries.
    const tutab = InvType.getByName('mm_magic_shop')!;
    check('mm_magic_shop rows 6-9 are the four elementals', [0, 1, 2, 3].map(k => [ObjType.get(tutab.stockobj![5 + k]).debugname, tutab.stockcount![5 + k], tutab.stockrate![5 + k]]), [
        ['fire_rune_pack', 40, 10],
        ['water_rune_pack', 40, 10],
        ['air_rune_pack', 40, 10],
        ['earth_rune_pack', 40, 10]
    ]);
    const tutabLive = Inventory.fromType(InvType.getId('mm_magic_shop'));
    check('mm_magic_shop has no mind pack, as OSRS has it', tutabLive.getItemCount(ObjType.getId('mind_rune_pack')), 0);
    check('mm_magic_shop live container, no blank square', [...Array(tutabLive.capacity).keys()].some(s => tutabLive.get(s)?.id === 65535), false);
    // The TzHaar rune store takes the TzHaar variants in Old School, not these, so it gets none.
    const tz = Inventory.fromType(InvType.getId('tzhaar_shop_rune'));
    check('tzhaar_shop_rune got none of them', RUNE_PACKS.map(([p]) => tz.getItemCount(ObjType.getId(p))), [0, 0, 0, 0, 0]);
}

// ---------------------------------------------------------------- what they cost
// Every one of these shops sells at multiplier 1000 except the worse of the Zamorak mage's two
// tables, so the price is just the cache's cost - which is the point: nothing here sets a price.
console.log('\nwhat a player pays for a rune pack');
{
    const p = fresh();
    check('430 at a 1000-multiplier rune shop', H.runProc(p, '[proc,calc_shop_value]', [430, 1, 1000, 0])[0], 430);
    check('330 for the mind pack there', H.runProc(p, '[proc,calc_shop_value]', [330, 1, 1000, 0])[0], 330);
    // darkruneshop_crap is the pre-Abyss table and sells at 1300, so it is dearer, as OSRS has it.
    check('559 at the Zamorak mage-s worse table', H.runProc(p, '[proc,calc_shop_value]', [430, 30, 1300, 0])[0], 559);
}

// ---------------------------------------------------------------- opening them
console.log('\nopening a rune pack');
{
    // A rune has no noted form at all - it stacks, so it never needed one. That is the whole reason
    // item_pack_contents names the rune itself here where the vial pack names a cert, and it is
    // also why "did it come out noted?" cannot be asked the way it was asked of the vial pack.
    check('a rune has no noted form to come out as', RUNE_PACKS.map(([, , , rune]) => ObjType.getId('cert_' + rune)), [-1, -1, -1, -1, -1]);
    for (const [pack, , , rune] of RUNE_PACKS) {
        const p = fresh();
        H.give(p, pack, 1);
        H.opheld(p, pack, 1);
        const inv = p.getInventory(InvType.INV)!;
        const used = [...Array(inv.capacity).keys()].filter(s => inv.get(s)).length;
        check(`${pack} -> 100 ${rune} in one slot, pack gone`, [H.invCount(p, rune), H.invCount(p, pack), used], [100, 0, 1]);
    }
}

// A full inventory opens one all the same, for the same reason the vial pack does - except here
// the runes stack, so a player who already carries that rune just gets a bigger pile.
console.log('\nopening a rune pack with a completely full inventory');
{
    const p = fresh();
    H.give(p, 'fire_rune_pack', 1);
    H.fillInv(p);
    check('inventory really is full first', p.getInventory(InvType.INV)!.freeSlotCount, 0);
    H.opheld(p, 'fire_rune_pack', 1);
    check('it still opened', [H.invCount(p, 'firerune'), H.invCount(p, 'fire_rune_pack')], [100, 0]);
}
{
    const p = fresh();
    H.give(p, 'airrune', 7);
    H.give(p, 'air_rune_pack', 1);
    H.fillInv(p);
    H.opheld(p, 'air_rune_pack', 1);
    check('merged into the runes already carried', H.invCount(p, 'airrune'), 107);
}

// The auto-run is the shared trigger's, so it works for these too without a line of its own.
console.log('\nthree rune packs, one click');
{
    const p = fresh();
    H.give(p, 'earth_rune_pack', 3);
    H.opheld(p, 'earth_rune_pack', 1);
    check('the clicked one opens at once', [H.invCount(p, 'earth_rune_pack'), H.invCount(p, 'earthrune')], [2, 100]);
    H.tick(3);
    check('the second follows on its own', [H.invCount(p, 'earth_rune_pack'), H.invCount(p, 'earthrune')], [1, 200]);
    H.tick(2);
    check('and the last', [H.invCount(p, 'earth_rune_pack'), H.invCount(p, 'earthrune')], [0, 300]);
}

console.log(`\n${ok} ok, ${bad} FAIL`);
process.exit(bad ? 1 : 0);
