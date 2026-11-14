// THE TRADING POST'S Offer-5, Offer-All, Offer-X AND Collect-X - all four were thrown away.
//
//   npx tsx tools/sim/tradingpostops.ts
//
// if_setinvop IS NOT THE WHOLE STORY, and the comment in tradingpost.rs2 shows how easy it is to
// believe it is:
//
//     // if_setinvop is not sticky - the client rebuilds the options from the cache whenever the
//     // window loads - so every open sets all four.
//
// That is true about the CLIENT and it is the half that misleads. IF_SETINVOP writes a packet and
// nothing else: it does not touch the server's Component, which is shared and comes from the
// cache. And InvButtonHandler validates the incoming click against exactly that:
//
//     if (!com.iop || com.iop[message.op - 1] === null) return false;   // bad client
//
// So the window drew "Offer-5" because the script asked it to, the player clicked it, and the
// engine dropped the packet on the floor as a forgery - because tradingpost_side:inv declared
// option1 only. Same for Offer-All, Offer-X and the collection box's Collect-X. Four features
// that existed in full, script and all, and could not be reached by anyone.
//
// tools/sim/orphans.ts found all four in one pass: a script claims [inv_button2..4] and the
// component offers no such slot. The fix is in tools/gentradingpost.py, which writes the .if -
// three options on the grid and four on the side inventory - and the labels there are the union
// of what the script sets per window, since which three the player actually sees is still the
// script's call at runtime.
//
// AND THE HANDLER WAS NOT EVEN REFUSING THEM YET, which is the part worth being exact about. The
// guard above read `com.iop[op - 1] === null`, and Component's decoder fills all five iop slots
// unconditionally with gjstr() - so an undeclared option arrives as "" and never as null, and the
// guard rejected nothing. The clicks were getting through, and a forged packet asking for op5 on
// a one-option component got through with them. That guard now uses isHiddenOp, the same
// predicate OpHeldHandler uses, which treats null, "" and the literal "hidden" alike. Which means
// the .if declarations are what keeps the trading post working under the stricter rule rather than
// what made it work in the first place - the two changes only make sense together, and this file
// is here to keep them that way.
//
// WHAT THIS PINS. The cache declaration, through the exact predicate the handler applies, and then
// the behaviour on top - so losing either half fails here.
import * as H from './harness.js';
import { check, R } from './a1lib.js';
import Component from '#/cache/config/Component.js';
import InvType from '#/cache/config/InvType.js';
import ObjType from '#/cache/config/ObjType.js';
import { isHiddenOp } from '#/cache/config/OpVisibility.js';

await H.boot();

/** The one line InvButtonHandler actually tests. */
function accepts(comName: string, op: number): boolean {
    const com = Component.get(Component.getId(comName));
    return !!com.iop && !isHiddenOp(com.iop[op - 1]);
}

console.log('THE CACHE DECLARES THE SLOTS THE SCRIPT USES');
{
    // ~tp_side_ops_list sets op1; ~tp_offer_open sets all four.
    for (const op of [1, 2, 3, 4]) {
        check(`tradingpost_side:inv accepts op${op}`, accepts('tradingpost_side:inv', op), true);
    }
    // ~tp_grid_ops never passes a fourth label, and no [inv_button4,tradingpost:grid] exists.
    for (const op of [1, 2, 3]) {
        check(`tradingpost:grid accepts op${op}`, accepts('tradingpost:grid', op), true);
    }
    check('tradingpost:grid leaves op4 alone', accepts('tradingpost:grid', 4), false);
}

console.log('AND THE OFFER OPTIONS MOVE THE RIGHT NUMBER OF ITEMS');
{
    const p = H.makePlayer('tpops', 3222, 3218);
    H.tick(3);
    H.give(p, 'rune_dart', 40);
    // Straight into the barter window. tp_barter_add is what every one of the four side options
    // reaches; the amount is the only thing that differs.
    H.setVar(p, 'tp_window', 2);
    const barter = p.getInventory(InvType.getId('tp_barter'))!;
    const DART = ObjType.getId('rune_dart');
    const offered = () => barter.getItemCount(DART);
    check('40 darts to start, nothing offered', [H.invCount(p, 'rune_dart'), offered()], [40, 0]);

    H.invButton(p, 'tradingpost_side:inv', 1, 0);
    check('Offer: one dart', [H.invCount(p, 'rune_dart'), offered()], [39, 1]);
    H.invButton(p, 'tradingpost_side:inv', 2, 0);
    check('Offer-5: five more', [H.invCount(p, 'rune_dart'), offered()], [34, 6]);
    H.invButton(p, 'tradingpost_side:inv', 3, 0);
    check('Offer-All: the rest of them', [H.invCount(p, 'rune_dart'), offered()], [0, 40]);
    H.despawn(p);
}

console.log(`\n${R.ok} ok, ${R.bad} FAIL`);
process.exit(R.bad ? 1 : 0);
