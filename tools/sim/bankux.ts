// The bankux round (2026-09-30), against the real engine and content. Two complaints from play:
//
//   1. "when 'all' or 'x' amount is selected in bank you cannot withdraw '1' - no right click
//      option to withdraw 1". The bank grid only ever had ONE of its five options rewritten, and
//      option 1 is the cache's "Withdraw 1" - so picking All wrote over the only Withdraw-1 entry
//      there was. This asserts what the server actually transmits (if_setinvop) for every one of
//      the five quantity modes, and then fires the real InvButton packet to prove the entry the
//      menu offers takes the number it says.
//   2. "bank doesnt remember 'swap' / 'insert' options". %bankinsert was a temp varp, so it held
//      for a session and reset to Swap on the next login; %bankcert (withdraw-as-note) was worse,
//      force-reset to Item on every single bank open. This asserts the whole class of bank
//      settings survives closing the bank AND a save/load round trip - and that the one setting
//      that is deliberately NOT remembered, the viewed tab, still resets.
//
// Usage: npx tsx tools/sim/bankux.ts
import * as H from './harness.js';
import Component from '#/cache/config/Component.js';
import InvType from '#/cache/config/InvType.js';
import ObjType from '#/cache/config/ObjType.js';
import Player from '#/engine/entity/Player.js';
import { PlayerLoading } from '#/engine/entity/PlayerLoading.js';
import VarPlayerType from '#/cache/config/VarPlayerType.js';
import Packet from '#/io/Packet.js';
import InvButton from '#/network/game/client/model/InvButton.js';
import InvButtonHandler from '#/network/game/client/handler/InvButtonHandler.js';
import ScriptProvider from '#/engine/script/ScriptProvider.js';
import ScriptRunner from '#/engine/script/ScriptRunner.js';

await H.boot();
H.loginOrder();

const R = { ok: 0, bad: 0 };
const check = (what: string, got: unknown, want: unknown) => {
    const pass = JSON.stringify(got) === JSON.stringify(want);
    if (pass) R.ok++;
    else R.bad++;
    console.log(`  ${pass ? 'ok  ' : 'FAIL'} ${what}: ${JSON.stringify(got)}${pass ? '' : `   (want ${JSON.stringify(want)})`}`);
};
const com = (name: string) => {
    const id = Component.getId(name);
    if (id === -1) throw new Error('no such component ' + name);
    return id;
};

/**
 * The five right-click options the player is actually looking at, op 1 first - which is the menu
 * Client.java builds from Component.iop (see the var26 loop in its inv-slot menu code). An option
 * the server has rewritten with if_setinvop wins; one it has not falls back to the cache's own
 * wording, because that is exactly what the client has in hand. Reading it this way is the point:
 * the bug being fixed was four options the server never touched, so a helper that only reported
 * what was transmitted would have shown nothing wrong with four of them.
 */
const opsOf = (p: Player, comName: string): (string | null)[] => {
    const id = com(comName);
    const cached = Component.get(id).iop;
    const out: (string | null)[] = [];
    for (let op = 1; op <= 5; op++) {
        const sent = H.ifaces.filter(i => i.who === p.username && i.kind === 'invop' && i.com === id && i.op === op);
        out.push(sent.length ? (sent[sent.length - 1].text ?? null) : (cached?.[op - 1] ?? null));
    }
    return out;
};

/**
 * Opening and closing the bank need PROTECTED access, the way a real click on a booth has it:
 * ~banktab_show writes %banktab, and pop_varp refuses an unprotected script. H.runProc runs
 * unprotected, so these go through executeScript with protect set, as H.ifButton does.
 */
const protectedRun = (p: Player, name: string) => {
    const script = ScriptProvider.getByName(name);
    if (!script) throw new Error('no such script: ' + name);
    p.executeScript(ScriptRunner.init(script, p), true);
};
const openBank = (p: Player) => {
    protectedRun(p, '[proc,bankpin_open_bank_real]');
    H.tick(1);
};
const closeBank = (p: Player) => {
    protectedRun(p, '[label,closebank]');
    H.tick(1);
};
const bankSlotOf = (p: Player, objName: string) => {
    const inv = p.getInventory(InvType.getId('bank'))!;
    for (let i = 0; i < inv.capacity; i++) if (inv.get(i)?.id === ObjType.getId(objName)) return i;
    return -1;
};
const invSlotOf = (p: Player, objName: string) => {
    const inv = p.getInventory(InvType.INV)!;
    for (let i = 0; i < inv.capacity; i++) if (inv.get(i)?.id === ObjType.getId(objName)) return i;
    return -1;
};

// The quantity buttons, in the order their ^bank_qty_* constants are numbered.
const QTY_BUTTONS = ['bankqty1', 'bankqty5', 'bankqty10', 'bankqtyx', 'bankqtyall'];
const WITHDRAW_ALL_FIVE = ['Withdraw 1', 'Withdraw 5', 'Withdraw 10', 'Withdraw X', 'Withdraw All'];

let bucket = 1;
function player(name: string): Player {
    const p = H.makePlayer(name, 3222, 3222, bucket++);
    H.tick(2);
    H.maxOut(p);
    H.clearInv(p);
    return p;
}

// ================================================= 1. the right-click menu keeps all five amounts
console.log('THE BANK MENU OFFERS ALL FIVE AMOUNTS WHATEVER THE BUTTONS SAY');
{
    const p = player('bankux_menu');
    openBank(p);
    check('a fresh bank opens on Withdraw 1 and offers all five', opsOf(p, 'bank_main:bank'), WITHDRAW_ALL_FIVE);
    check('...and the side pack mirrors it', opsOf(p, 'bank_side:inv'), WITHDRAW_ALL_FIVE.map(o => o.replace('Withdraw', 'Deposit')));

    // Every mode: the selected amount is option 1 (the left click) and the other four follow in
    // OSRS's own order. THE POINT OF THE ROUND is that "Withdraw 1" is in every one of these lists.
    const want: Record<string, string[]> = {
        bankqty1: ['Withdraw 1', 'Withdraw 5', 'Withdraw 10', 'Withdraw X', 'Withdraw All'],
        bankqty5: ['Withdraw 5', 'Withdraw 1', 'Withdraw 10', 'Withdraw X', 'Withdraw All'],
        bankqty10: ['Withdraw 10', 'Withdraw 1', 'Withdraw 5', 'Withdraw X', 'Withdraw All'],
        bankqtyall: ['Withdraw All', 'Withdraw 1', 'Withdraw 5', 'Withdraw 10', 'Withdraw X']
    };
    for (const button of ['bankqty5', 'bankqty10', 'bankqtyall', 'bankqty1']) {
        H.ifButton(p, `bank_main:${button}`);
        H.tick(1);
        check(`${button} sets the five options to`, opsOf(p, 'bank_main:bank'), want[button]);
        check(`...and the pack's to`, opsOf(p, 'bank_side:inv'), want[button].map(o => o.replace('Withdraw', 'Deposit')));
    }

    // X is the odd one out: the SELECTED entry spells the stored amount out, the explicit entry
    // underneath stays the letter X because clicking that one asks for a number.
    H.setVar(p, 'bankquantity_x', 250);
    H.setVar(p, 'bankquantity', 3); // ^bank_qty_x, without the p_countdialog the button would run
    H.runProc(p, '[proc,bank_apply_quantity]');
    H.tick(1);
    check('with X set to 250 the menu reads', opsOf(p, 'bank_main:bank'),
        ['Withdraw 250', 'Withdraw 1', 'Withdraw 5', 'Withdraw 10', 'Withdraw All']);
    check('...and the X button\'s face says', H.ifaces.filter(i => i.who === p.username && i.kind === 'text' && i.com === com('bank_main:bankqtyxtext')).pop()?.text, '250');
    check('a stored X of 250 still leaves Withdraw 1 in the menu', opsOf(p, 'bank_main:bank').includes('Withdraw 1'), true);

    // and the wording is never a lie: op -> amount comes from the same proc the labels do
    H.setVar(p, 'bankquantity', 4); // All
    H.runProc(p, '[proc,bank_apply_quantity]');
    const amounts = [1, 2, 3, 4, 5].map(op => H.runProc(p, '[proc,bank_op_amount]', [op])[0]);
    check('with All selected the five options take', amounts, [0x7fffffff, 1, 5, 10, -1]); // -1 = null = "ask me"
}

// ================================================= the menu entry actually withdraws that number
console.log('AND THE WITHDRAW-1 ENTRY REALLY TAKES ONE');
{
    const p = player('bankux_take');
    const invButton = new InvButtonHandler();
    openBank(p);

    // put 100 feathers in the bank through the real deposit op, which also exercises the pack's
    // rewritten options: option 5 with qty 1 selected is "Deposit All".
    H.give(p, 'feather', 100);
    check('Deposit All from the pack is accepted', invButton.handle(
        new InvButton(5, ObjType.getId('feather'), invSlotOf(p, 'feather'), com('bank_side:inv')), p), true);
    H.tick(1);
    check('100 feathers are banked', p.getInventory(InvType.getId('bank'))!.get(bankSlotOf(p, 'feather'))?.count, 100);

    // Now select All - the mode that used to leave no way back to a single item - and take one
    // using whichever op the menu now words "Withdraw 1".
    H.ifButton(p, 'bank_main:bankqtyall');
    H.tick(1);
    const ops = opsOf(p, 'bank_main:bank');
    const one = ops.indexOf('Withdraw 1') + 1;
    check('the menu has a Withdraw 1 entry while All is selected', one > 0, true);
    check('Withdraw 1 is accepted', invButton.handle(
        new InvButton(one, ObjType.getId('feather'), bankSlotOf(p, 'feather'), com('bank_main:bank')), p), true);
    H.tick(1);
    check('exactly one feather came out', H.invCount(p, 'feather'), 1);
    check('...and ninety-nine are still banked', p.getInventory(InvType.getId('bank'))!.get(bankSlotOf(p, 'feather'))?.count, 99);

    // the left click still means All
    check('the left click (op 1) is accepted', invButton.handle(
        new InvButton(1, ObjType.getId('feather'), bankSlotOf(p, 'feather'), com('bank_main:bank')), p), true);
    H.tick(1);
    check('...and takes the lot', H.invCount(p, 'feather'), 100);
}

// ================================================= 2. the remembered settings
console.log('THE BANK REMEMBERS ITS SETTINGS ACROSS A CLOSE AND A LOGIN');
{
    // The whole class, not just Swap/Insert: every setting the bar can change, the varp behind it,
    // and the value to set it to.
    const settings: [string, string, number][] = [
        ['swap/insert', 'bankinsert', 1],
        ['withdraw-as-note', 'bankcert', 1],
        ['quantity', 'bankquantity', 4],
        ['the X amount', 'bankquantity_x', 6000],
        ['placeholders', 'bankplaceholders', 1]
    ];
    for (const [, varp] of settings) {
        const t = VarPlayerType.getByName(varp)!;
        check(`[${varp}] is saved with the character`, t.scope === VarPlayerType.SCOPE_PERM, true);
    }

    const p = player('bankux_keep');
    openBank(p);
    // through the real buttons wherever there is one, so the if_button handlers are under test too
    H.ifButton(p, 'bank_main:com_100'); // Insert
    H.ifButton(p, 'bank_main:com_93'); // Note (a toggle: flips 0 -> 1)
    H.ifButton(p, 'bank_main:bankqtyall');
    H.ifButton(p, 'bank_main:banklock'); // always set placeholders
    H.setVar(p, 'bankquantity_x', 6000);
    H.tick(1);
    for (const [what, varp, value] of settings) {
        check(`${what} is set`, H.getVar(p, varp), value);
    }

    closeBank(p);
    openBank(p);
    for (const [what, varp, value] of settings) {
        check(`${what} survives closing and reopening the bank`, H.getVar(p, varp), value);
    }
    check('...and reopening re-sends all five options, which if_setinvop does not keep',
        opsOf(p, 'bank_main:bank'), ['Withdraw All', 'Withdraw 1', 'Withdraw 5', 'Withdraw 10', 'Withdraw X']);

    // A LOGOUT AND BACK IN. Player.save writes only perm varps, so this is the real test of the
    // fix: a temp varp comes back as 0 here however the session left it.
    const reloaded = PlayerLoading.load('bankux_keep', new Packet(new Uint8Array(p.save())), null);
    for (const [what, varp, value] of settings) {
        check(`${what} survives a logout and login`, H.getVar(reloaded, varp), value);
    }
    // The four the CLIENT needs for itself are transmitted, so a login hands the bank its saved
    // state before it is ever opened: the Swap/Insert and Item/Note buttons light themselves off
    // their varp, and bankinsert is also clientcode 9 (Client.bankArrangeMode, which decides
    // whether a drag draws as a swap or an insert). %bankquantity_x is the exception and stays
    // server side - the client only ever sees it as text, on the button's face and in the wording
    // of the options above.
    for (const [, varp] of settings) {
        check(`[${varp}] is resent to the client on login`, VarPlayerType.getByName(varp)!.transmit, varp !== 'bankquantity_x');
    }

    // THE ONE EXCEPTION, and it is deliberate: the viewed tab is temp and reset on every open, so
    // nobody comes back tomorrow to a bank that looks empty because they left it on tab 7.
    check('[banktab] is deliberately NOT saved', VarPlayerType.getByName('banktab')!.scope === VarPlayerType.SCOPE_PERM, false);
    H.setVar(p, 'banktab', 7);
    closeBank(p);
    openBank(p);
    check('...and the bank always opens on the all-items tab', H.getVar(p, 'banktab'), 0);
}

console.log(`\nbankux: ${R.ok} ok, ${R.bad} failed`);
process.exit(R.bad ? 1 : 0);
