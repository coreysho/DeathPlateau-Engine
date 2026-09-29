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

console.log(`\n${ok} ok, ${bad} FAIL`);
process.exit(bad ? 1 : 0);
