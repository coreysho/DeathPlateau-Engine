// SEARCHING POH FURNITURE: does anything come out of it?
//
//   npx tsx tools/sim/pohsearch.ts
//
// DeathPlateau-Bugs#93. Twenty-one pieces carry op1=Search and every one of them answered with a
// message and nothing else - "The tools are all where you left them" at a rack whose own cache
// `desc` reads "Hammer, chisel, saw and shears." They were never dead options, because they DID
// answer, so tools/sim/opsweep.ts never flagged them.
//
// Fifteen now open a window on their own list. This file is the proof of three things:
//
//   the LISTS are what the wiki publishes, per piece, in the right order
//   a Take really hands the item over, and does NOT empty the grid - the contents are unlimited
//   the fifteen are exactly the pieces that should have a list, and the other six still do not
//
// WHY THE LISTS ARE WRITTEN OUT AGAIN HERE. tools/furnspec.json is the source and this is a second
// copy of it, which is normally the thing to avoid - but the spec is also the thing under test. A
// check that read the spec would pass for any spec, including one where the generator silently
// dropped a tier or mapped the mahogany shelves onto the wooden ones. These came off the wiki
// pages a second time, by position, and the point is that two independent transcriptions agree.
import * as H from './harness.js';
import { check, R, player, mark, mesSince } from './a1lib.js';
import InvType from '#/cache/config/InvType.js';
import ObjType from '#/cache/config/ObjType.js';
import LocType from '#/cache/config/LocType.js';

await H.boot();

// name, the line under it, and the items in list order. The order matters: it is what the slots
// come out as, and it is the only thing tying this cache's tiers to the wiki's - the names differ
// (this repo's "Oak shelves 1" is the wiki's "Wooden shelves 3") and so do the levels.
const PIECES: [string, string[]][] = [
    ['Wooden larder', ['bucket_milk', 'poh_tea_leaves']],
    ['Oak larder', ['bucket_milk', 'egg', 'pot_flour', 'poh_tea_leaves']],
    ['Teak larder', ['bucket_milk', 'egg', 'pot_flour', 'poh_tea_leaves', 'potato', 'garlic', 'onion', 'cheese']],
    ['Wooden shelves', ['poh_kettle_empty', 'poh_teapot_clay_empty', 'poh_claycup_empty']],
    ['Oak shelves 1', ['poh_kettle_empty', 'poh_teapot_clay_empty', 'poh_claycup_empty', 'beer_glass']],
    ['Oak shelves 2', ['poh_kettle_empty', 'poh_teapot_porcelain_empty', 'poh_chinacup_empty', 'beer_glass', 'cake_tin']],
    ['Teak shelves 1', ['poh_kettle_empty', 'poh_teapot_clay_empty', 'poh_claycup_empty', 'beer_glass', 'cake_tin', 'bowl_empty']],
    ['Teak shelves 2', ['poh_kettle_empty', 'poh_teapot_porcelain_empty', 'poh_chinacup_empty', 'beer_glass', 'cake_tin', 'bowl_empty', 'piedish']],
    ['Mahogany shelves 1', ['poh_kettle_empty', 'poh_teapot_porcelain_empty', 'poh_chinacup_empty', 'beer_glass', 'cake_tin', 'bowl_empty', 'piedish', 'pot_empty']],
    ['Mahogany shelves 2', ['poh_kettle_empty', 'poh_teapot_giltporcelain_empty', 'poh_giltchinacup_empty', 'beer_glass', 'cake_tin', 'bowl_empty', 'piedish', 'pot_empty', 'chefs_hat']],
    ['Wooden tools 1', ['saw', 'hammer', 'chisel', 'shears']],
    ['Wooden tools 2', ['bucket_empty', 'knife', 'spade', 'tinderbox']],
    ['Oak tools', ['brown_apron', 'glassblowingpipe', 'needle']],
    ['Teak tools', ['amulet_mould', 'necklace_mould', 'ring_mould', 'holy_symbol_mould', 'tiara_mould']],
    ['Mahogany tools', ['rake', 'spade', 'gardening_trowel', 'dibber', 'watering_can_0', 'secateurs']]
];

const SEARCH_INV = InvType.getId('poh_search_items');
const gridOf = (p: any): string[] => {
    const inv = p.getInventory(SEARCH_INV);
    const out: string[] = [];
    for (let i = 0; i < inv.capacity; i++) {
        const o = inv.get(i);
        if (o) out.push(ObjType.get(o.id).debugname ?? String(o.id));
    }
    return out;
};

const p: any = player('pohsearch', 3222, 3218);
const show = (n: number, what: string) => H.runProc(p, '[proc,poh_search_show]', [n, what, 'line'], undefined, true);

// ------------------------------------------------------------------ the lists
console.log('WHAT IS IN EACH OF THE FIFTEEN');
for (let n = 0; n < PIECES.length; n++) {
    const [what, want] = PIECES[n];
    show(n, what);
    check(`${what}`, gridOf(p), want);
}

// ------------------------------------------------------------------ taking one
console.log('TAKING ONE, AND THE GRID NOT EMPTYING');
// The teak larder: eight items, the longest list that is not shelves, and the one a player is most
// likely to pull from twice in a row.
show(2, 'Teak larder');
H.clearInv(p);
check('the larder is offering eight things', gridOf(p).length, 8);
H.invButton(p, 'poh_search_window:items', 1, 0);
H.tick(1);
check('taking slot 0 hands over a bucket of milk', H.invCount(p, 'bucket_milk'), 1);
check('  ...and the larder still has all eight', gridOf(p).length, 8);
H.invButton(p, 'poh_search_window:items', 1, 0);
H.invButton(p, 'poh_search_window:items', 1, 0);
H.tick(1);
check('unlimited means unlimited: three buckets from one larder', H.invCount(p, 'bucket_milk'), 3);
H.invButton(p, 'poh_search_window:items', 1, 7);
H.tick(1);
check('and the last slot is the cheese', H.invCount(p, 'cheese'), 1);
check('  ...with the grid untouched', gridOf(p), PIECES[2][1]);

console.log('AN EMPTY SLOT GIVES NOTHING');
const before = H.invCount(p, 'bucket_milk');
H.invButton(p, 'poh_search_window:items', 1, 9);
H.invButton(p, 'poh_search_window:items', 1, 11);
H.tick(1);
check('clicking past the end of a short list is a no-op', H.invCount(p, 'bucket_milk'), before);
check('  ...and adds nothing at all', H.invCount(p, 'cheese'), 1);

console.log('A FULL PACK REFUSES RATHER THAN SWALLOWING THE CLICK');
H.clearInv(p);
show(10, 'Wooden tools 1');
H.fillInv(p);
const m = mark();
H.invButton(p, 'poh_search_window:items', 1, 0);
H.tick(1);
check(
    'a full pack is told so',
    mesSince(p, m).some(x => x.includes('inventory space')),
    true
);
check('  ...and gets no saw', H.invCount(p, 'saw'), 0);

// ------------------------------------------------------------------ the guard
console.log('AND ONLY IN YOUR OWN HOUSE');
H.clearInv(p);
// The grid is still holding Wooden tools 1 from the section above, and the refused open is for the
// wooden larder - so "unchanged" is the assertion that it did not get as far as filling anything.
// It is not emptied either: the guard returns before ~poh_search_show touches the inv, and only
// [if_close] clears it.
const m2 = mark();
H.runProc(p, '[proc,poh_search_open]', [0, 'Wooden larder', 'line'], undefined, true);
check(
    'outside a house, Search refuses',
    mesSince(p, m2).some(x => x.includes('your own house')),
    true
);
check('  ...and never gets as far as the larder', gridOf(p), PIECES[10][1]);

// ------------------------------------------------------------------ who has a list and who does not
console.log('EVERY BUILDABLE PIECE THAT SAYS Search');
// A loc is a piece a player can BUILD iff it has a removal trigger: tools/genfurn.py writes one
// [oploc5] per piece and nothing else does. That is the filter that matters, because the cache also
// carries Search locs no family uses - a whole second seven-tier Shelves set (poh_kitchen_crockery_*,
// "plates and tea cups" against the shelves' "kitchen utensils"), the treasure chest's open states
// and two weapons racks. No hotspot builds any of them, so no player can click one.
// Buildable is the oploc5 test, whatever the loc is called - the cape rack's six are loc474_1876x
// and the tool stores are loc_1369x, so a name filter would miss them. The unbuilt side is taken by
// name instead, because the cache has twenty-two other loc474_* locs with a Search option that have
// nothing to do with a house.
const buildable: string[] = [];
const spare: string[] = [];
for (let id = 0; id < LocType.count; id++) {
    const t = LocType.get(id);
    if (!t || !t.op || t.op[0] !== 'Search') continue;
    const name = t.debugname ?? String(id);
    if (H.hasScript(`[oploc5,${name}]`)) buildable.push(name);
    else if (name.startsWith('poh_')) spare.push(name);
}
check(
    'every buildable piece with op1=Search answers the click',
    buildable.filter(n => !H.hasScript(`[oploc1,${n}]`)),
    []
);
check('there are 28 of them', buildable.length, 28);

// The three kinds, by name, because the whole of #93 is which kind each piece is in.
const windowed = buildable.filter(n => /^poh_larder_|^poh_kitchen_shelves_|^loc_13699$|^loc_1370[0-3]$/.test(n)).sort();
const caperack = buildable.filter(n => /^loc474_1876[6-9]$|^loc474_1877[01]$/.test(n)).sort();
const rest = buildable.filter(n => !windowed.includes(n) && !caperack.includes(n)).sort();
check('fifteen open the new Search window', windowed.length, PIECES.length);
check('  ...and they are the larder, the shelves and the five tool stores', windowed, [
    'loc_13699',
    'loc_13700',
    'loc_13701',
    'loc_13702',
    'loc_13703',
    'poh_kitchen_shelves_1',
    'poh_kitchen_shelves_2',
    'poh_kitchen_shelves_3',
    'poh_kitchen_shelves_4',
    'poh_kitchen_shelves_5',
    'poh_kitchen_shelves_6',
    'poh_kitchen_shelves_7',
    'poh_larder_1',
    'poh_larder_2',
    'poh_larder_3'
]);
// Six of the 28 were never the bug: the cape rack's Search opens the costume room's own storage,
// which has worked all along (~poh_store_open).
check('six are the cape rack, whose Search already opened a store', caperack.length, 6);
// And seven still answer with a message, on purpose. Nothing is published for the POH bookcase or
// the scroll rack - the wiki has no Search result for either, and Scroll rack has no page at all -
// and there are no boxing gloves anywhere in this cache for the glove rack to hold.
check('and seven still answer with a message, deliberately', rest, ['loc_13597', 'loc_13598', 'loc_13599', 'loc_13600', 'loc_13601', 'loc_13602', 'poh_weapons_rack_gloves']);
// Pinned so one cannot arrive quietly: give a family one of these locs and it gains a removal
// trigger, leaves this list, and the check above then demands a handler for it.
check('and the poh_ Search locs nothing builds at all', spare.sort(), [
    'poh_kitchen_crockery_1',
    'poh_kitchen_crockery_2',
    'poh_kitchen_crockery_3',
    'poh_kitchen_crockery_4',
    'poh_kitchen_crockery_5',
    'poh_kitchen_crockery_6',
    'poh_kitchen_crockery_7',
    'poh_treasure_mag_openchest',
    'poh_treasure_magic_openchest',
    'poh_treasure_oak_openchest',
    'poh_treasure_openwoodencrate',
    'poh_treasure_teak_openchest',
    'poh_weapons_rack_gloves+woodenstuff',
    'poh_weapons_rack_gloves+woodenstuff+pugels'
]);

console.log(`\n${R.ok} ok, ${R.bad} FAIL`);
process.exit(R.bad > 0 ? 1 : 0);
