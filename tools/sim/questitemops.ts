// TWENTY-FIVE QUEST ITEMS THAT COULD NOT BE CLICKED, and now reach their handlers.
//
//   npx tsx tools/sim/questitemops.ts
//
// Each of these had an [opheld1,...] in the content and no iop1 in its obj config, so no client
// drew the option and the handler had never run for any player. tools/sim/orphans.ts found all 25
// in one pass; this asserts that each one is reachable AND that it does what its handler says.
//
// THE LABELS WERE DERIVED, NOT CHOSEN, and this file records from what - which is the part worth
// keeping, because a label is user-visible text and a wrong one is worse than none:
//
//   Read     the handler's own words. handsand_scroll_magic prints "You read the scroll aloud";
//            ahoy_book_of_haricanto is a book. 383 objs in this build already use iop1=Read.
//   Empty    the four golden bowls inv_del themselves, inv_add the empty bowl and say "You empty
//            the pure water out of the golden bowl". 7 objs already use iop1=Empty.
//   Eat      mdaughter_white_pearl_fruit is @player_consume_item, on the same line as monkfish,
//            mm_banana_stew and mm_monkey_nuts - all three of which declare iop1=Eat.
//   Look-at  seventeen whose handler is one ~mesbox describing the item and nothing else. 12 objs
//            already use iop1=Look-at, including the heart crystals.
//   Fish     the softest of the 25 and flagged as such: tbwt_karambwan_vessel_loaded_with_
//            karambwanji runs @tbwt_karambwan_drop, which is the action the karambwan spot npcs
//            offer as op1=Fish. Taken from a sibling ACTION rather than a sibling item, because
//            neither vessel obj declares an iop at all.
//
// The biggest single thing recovered here is mourning_colour_wheel, whose ~mesbox is the Mourning's
// End mirror puzzle's instructions - "A MIRROR TAKES THE BEAM ROUND ONE CORNER... THE LIGHT ENTERS
// AT THE TOP OF THE EAST WALL AND MUST LEAVE BY THE HOLE IN THE WEST". The puzzle's own hint sheet,
// unreadable.
import * as H from './harness.js';
import { check, R } from './a1lib.js';
import InvType from '#/cache/config/InvType.js';
import ObjType from '#/cache/config/ObjType.js';
import ScriptProvider from '#/engine/script/ScriptProvider.js';
import ServerTriggerType from '#/engine/script/ServerTriggerType.js';

await H.boot();

/** name -> the label it must declare, and a phrase its handler must produce when clicked. */
const ITEMS: [string, string, string | null][] = [
    ['ahoy_book_of_haricanto', 'Read', 'Book of Haricanto'],
    ['handsand_scroll_magic', 'Read', 'Rarve has not keyed it'],
    ['mdaughter_white_pearl_fruit', 'Eat', null],
    ['goldbowl_pure', 'Empty', 'You empty the pure water'],
    ['goldbowl_water', 'Empty', 'You empty the plain water'],
    ['goldbowlbless_pure', 'Empty', 'You empty the pure water'],
    ['goldbowlbless_water', 'Empty', 'You empty the plain water'],
    ['tbwt_karambwan_vessel_loaded_with_karambwanji', 'Fish', 'nowhere here deep enough'],
    ['crystalshard_necklace_unstrung', 'Look-at', 'ball of wool'],
    ['deal_bucket_swill', 'Look-at', "bucket of 'rum'"],
    ['deal_slugling', 'Look-at', 'Feed us'],
    ['devious_glowingorb', 'Look-at', 'hooded figure'],
    ['fairy_queen_secateurs', 'Look-at', 'four hundred years old'],
    ['fairy_skull', 'Look-at', 'grave matter'],
    ['glowing_fungus', 'Look-at', 'pale blue light'],
    ['handsand_beerhand', 'Look-at', "Guard Captain's beer"],
    ['handsand_sandyhand', 'Look-at', 'packed solid with sand'],
    ['ics_little_holy_symbol', 'Look-at', 'symbol of Icthlarin'],
    ['ics_little_linen', 'Look-at', 'sheet of linen'],
    ['ics_little_pileofsalt', 'Look-at', 'pile of salt'],
    ['ics_little_sap_bucket', 'Look-at', 'tree sap'],
    ['ics_little_unholy_symbol', 'Look-at', 'the other way up'],
    ['mourning_colour_wheel', 'Look-at', 'A MIRROR TAKES THE BEAM'],
    ['mourning_mirror', 'Look-at', 'fits them four ways'],
    ['swan_army', 'Look-at', 'Bone seeds']
];

const p = H.makePlayer('questitem', 3222, 3218);
H.tick(3);
const inv = p.getInventory(InvType.INV)!;

for (const [name, label, phrase] of ITEMS) {
    const id = ObjType.getId(name);
    if (id === -1) {
        check(`${name} exists`, false, true);
        continue;
    }
    const type = ObjType.get(id);
    check(`${name} iop1`, type.iop?.[0], label);
    // The handler the click will reach has to be the specific one, not a global fallback.
    const script = ScriptProvider.getByTriggerSpecific(ServerTriggerType.OPHELD1, id, -1);
    check(`${name} has its own [opheld1]`, !!script, true);

    if (phrase === null) {
        continue; // eating runs a shared consume proc; the label is the assertion
    }
    inv.removeAll();
    p.invAdd(InvType.INV, id, 1);
    const fromMes = H.mesgs.length;
    const fromIface = H.ifaces.length;
    H.opheld(p, name, 1);
    H.tick(3);
    // BOTH CHANNELS. ~mesbox opens a modal and fills it with if_settext, which lands in H.ifaces;
    // mes() goes to the chatbox and lands in H.mesgs. Asserting only the second passed the four
    // golden bowls and failed all seventeen describers, which says nothing about the content.
    // JOINED WITH A SPACE, not a separator, because ~mesbox WORD-WRAPS: it sends one if_settext
    // per rendered line, so "Rarve has not keyed it to anywhere yet" arrives as "...Rarve has not
    // keyed" and "it to anywhere yet." Matching per line fails on any phrase that straddles a wrap,
    // which is how two of these looked broken while both handlers were running correctly.
    const said = [
        ...H.mesgs.slice(fromMes).map(m => m.text),
        ...H.ifaces
            .slice(fromIface)
            .filter(f => f.kind === 'text')
            .map(f => f.text ?? '')
    ]
        .join(' ')
        .replace(/\s+/g, ' ');
    check(`${name} says its piece`, said.includes(phrase), true);
}

console.log(`\n${R.ok} ok, ${R.bad} FAIL`);
process.exit(R.bad ? 1 : 0);
