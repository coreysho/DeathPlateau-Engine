// USE A ON B, AND THEN B ON A. Asked for as "some items have to be used in a certain way, can't use
// vice versa; eg. serpentine visage on chisel".
//
// Using one held item on another is SYMMETRIC in the client: there is one menu entry, "Use", and
// which of the two you pick up first is a matter of where your mouse was. So any pair that does
// something one way round and nothing the other way round is a bug, with no exceptions to argue
// about - which is what makes this sweepable rather than a list somebody has to keep.
//
// WHAT THE ENGINE DOES. OpHeldUHandler looks for a trigger four times: [opheldu,b] where b is the
// item you clicked SECOND, then [opheldu,a], then b's category, then a's. The first hit wins, and
// last_item is set to whichever half carried it. Two ways that leaves a pair broken:
//
//   * BOTH halves have a trigger of their own. Only b's ever runs, and if b's script does not know
//     about a it says "Nothing interesting happens" - while the other way round works. The chisel
//     is the example: [opheldu,chisel] has a case list, and a serpentine visage was not on it.
//   * NEITHER half has one and the pairing lives on a CATEGORY. The two "a" branches used to swap
//     last_item/last_useitem even when their lookup MISSED, so a category trigger was handed the
//     two the wrong way round - both ways round. That is the ornament kits, every one of them.
//
//   npx tsx tools/sim/opheldu.ts            # the named pairs, then every trigger's refusal
//   npx tsx tools/sim/opheldu.ts --sweep    # and all 108,345 pairs both ways round, which is slow
import * as H from './harness.js';
import { check, R, player, mark, mesSince } from './a1lib.js';
import ObjType from '#/cache/config/ObjType.js';
import ScriptProvider from '#/engine/script/ScriptProvider.js';
import ServerTriggerType from '#/engine/script/ServerTriggerType.js';
import Player from '#/engine/entity/Player.js';
import InvType from '#/cache/config/InvType.js';

// The pair sweep is 108,345 pairs run both ways round and takes minutes; the silent-decliner scan
// above is 466 runs and finds the same faults by their cause, so the sweep is the opt-in backstop.
const SWEEP = process.argv.includes('--sweep');

await H.boot();

const name = (id: number) => ObjType.get(id).debugname ?? String(id);

// "Nothing interesting happens." is what BOTH the handler (no trigger at all) and the content
// (~displaymessage(^dm_default), 787 call sites) say when a pair is not a pairing. It is the only
// signal there is, which is also why it has to be the only thing the script said: a script that
// prints it after doing something real would otherwise read as a refusal.
const NOTHING = 'Nothing interesting happens.';

// TWO DIFFERENT QUESTIONS, and conflating them cost a run: `handled` is "did these two items go
// together", which treats "Nothing interesting happens." as a no, while `answered` is "did the script
// respond at all", for which that message is a yes. The silent-decliner scan wants the second one.
type Outcome = { handled: boolean; answered: boolean; why: string };

/**
 * Use `a` on `b` on a freshly stocked player and say whether anything came of it.
 *
 * "Did anything come of it" is TWO signals, not one. "Nothing interesting happens." is what both
 * the handler (no trigger found at all) and the content (~displaymessage(^dm_default), 787 call
 * sites) say to refuse a pair - but a script may also refuse in silence, or work in silence, so a
 * run that changed the inventory counts as working whatever it said.
 */
function tryUse(p: Player, a: string, b: string): Outcome {
    // WIPE WHAT THE LAST PAIR LEFT BEHIND, or the sweep lies about the next one. make_softclay ends
    // on p_delay, and OpHeldUHandler throws away any use made while the player is delayed - so "use a
    // bowl of water on clay" was reported broken purely because "use clay on a bowl of water", tried
    // one line earlier, had left the player mid-animation. A queued script would do the same with its
    // messages, landing them on whichever pair happened to be running when they fired.
    p.delayed = false;
    p.delayedUntil = -1;
    p.activeScript = null;
    p.queue.clear();
    p.engineQueue.clear();
    p.closeModal();
    H.clearInv(p);
    H.give(p, a, 1);
    H.give(p, b, 1);
    const from = mark();
    const ifacesFrom = H.ifaces.length;
    try {
        H.useHeldOn(p, a, b);
    } catch (e) {
        return { handled: false, answered: false, why: 'threw: ' + (e as Error).message };
    }
    const mes = mesSince(p, from);
    const kept = H.invCount(p, a) === 1 && H.invCount(p, b) === 1 && invSlots(p) === 2;
    // A CHAT BOX IS AN ANSWER TOO. ~chatplayer is not mes - the ogre potion refuses a vial with
    // "Hmmm. Perhaps I shouldn't try and mix these items together", through a dialogue - so a run
    // that opened an interface counts as having said something.
    const spoke = (mes.length > 0 && !(mes.length === 1 && mes[0] === NOTHING)) || H.ifaces.length > ifacesFrom;
    const answered = mes.length > 0 || H.ifaces.length > ifacesFrom || !kept;
    if (spoke || !kept) {
        return { handled: true, answered, why: mes.join(' | ') || 'inventory changed' };
    }
    return { handled: false, answered, why: mes.join(' | ') || 'silence' };
}

const invSlots = (p: Player): number => {
    // InvType.INV is resolved from the cache at boot, so it is NOT 0 - reading inventory 0 here
    // made every pair look like it had changed something, and all five named checks passed vacuously.
    const inv = p.getInventory(InvType.INV)!;
    let n = 0;
    for (let i = 0; i < inv.capacity; i++) if (inv.get(i)) n++;
    return n;
};

// ===================================================================== the pairs that were reported
console.log('THE TWO SHAPES OF THE BUG, ON THE REAL HANDLER');
{
    const p = player('opheldu_named', 3222, 3222);

    // 1. BOTH HALVES CARRY A TRIGGER: the chisel's own case list decides, and the visage was not on
    //    it. Use chisel -> visage carves the helm; use visage -> chisel used to say nothing.
    for (const [a, b] of [['chisel', 'serpentine_visage'], ['serpentine_visage', 'chisel']] as const) {
        const o = tryUse(p, a, b);
        check(`  ${a} on ${b} does something`, o.handled ? 'yes' : o.why, 'yes');
    }

    // 2. NEITHER HALF CARRIES ONE: the pairing is on category ornament_kit. Both ways round reached
    //    the trigger with last_item set to the SCIMITAR, so the script could not find the pairing.
    for (const [a, b] of [['rune_scimitar', 'rune_scimitar_ornament_kit_guthix'],
        ['rune_scimitar_ornament_kit_guthix', 'rune_scimitar']] as const) {
        const o = tryUse(p, a, b);
        check(`  ${a} on ${b} does something`, o.handled ? 'yes' : o.why, 'yes');
    }
    // AND THE OUTCOME, not just "something happened". The ornament kits were broken SYMMETRICALLY -
    // both ways round reached [opheldu,_ornament_kit] with the scimitar as last_item and both ways
    // round said "those two don't go together" - so a sweep for asymmetry could never have seen them.
    // A refusal is a message like any other; only the result tells you.
    for (const [a, b] of [['chisel', 'serpentine_visage'], ['serpentine_visage', 'chisel']] as const) {
        H.clearInv(p);
        H.give(p, 'chisel', 1);
        H.give(p, 'serpentine_visage', 1);
        H.useHeldOn(p, a, b);
        check(`  ${a} on ${b} really carves the helm`, H.invCount(p, 'serpentine_helm_uncharged'), 1);
    }

    // and the kit really made the gilded one, not just "something"
    H.clearInv(p);
    H.give(p, 'rune_scimitar', 1);
    H.give(p, 'rune_scimitar_ornament_kit_guthix', 1);
    H.useHeldOn(p, 'rune_scimitar_ornament_kit_guthix', 'rune_scimitar');
    check('  and the Guthix kit really gilds it', H.invCount(p, 'rune_scimitar_guthix'), 1);
}

// ============================================ every trigger answers when it does not know the pair
// THE HAND-OVER ONLY WORKS IF THE SCRIPT SAYS SO. opheldu_decline is asked for by ~displaymessage,
// so a script that falls off the end in SILENCE - no case default, no else - swallows the click and
// the other half never hears about it. [opheldu,lens_mould] and [opheldu,ibandoll] were two of those,
// and between them they broke 60 pairs.
//
// This is the O(n) version of the sweep below and it names the file to fix rather than the symptom:
// hand every trigger an item it cannot possibly have a recipe with, and it has to answer.
console.log('');
console.log('AND EVERY TRIGGER SAYS SOMETHING WHEN HANDED AN ITEM IT CANNOT USE');
const declared: number[] = [];
for (let i = 0; i < ObjType.count; i++) {
    const t = ObjType.get(i);
    if (!t) continue;
    if (ScriptProvider.getByTriggerSpecific(ServerTriggerType.OPHELDU, i, -1)) declared.push(i);
}
{
    // An inert partner: no trigger of its own and no category trigger either, so the only script that
    // can run is the one under test. Chosen from the cache rather than written here, because an item
    // that gains a trigger later would quietly turn this whole section into a no-op.
    let inert = -1;
    for (let i = 0; i < ObjType.count && inert === -1; i++) {
        const t = ObjType.get(i);
        if (!t || !t.debugname || t.dummyitem !== 0 || t.certtemplate !== -1) continue;
        if (ScriptProvider.getByTriggerSpecific(ServerTriggerType.OPHELDU, i, -1)) continue;
        if (t.category !== -1 && ScriptProvider.getByTriggerSpecific(ServerTriggerType.OPHELDU, -1, t.category)) continue;
        inert = i;
    }
    check('  there is an item with no use-on of its own to test with', inert !== -1, true);
    console.log(`  ${declared.length} objs carry an [opheldu,<obj>]; the inert partner is ${name(inert)}`);

    const p = player('opheldu_silent', 3222, 3222);
    const silent: string[] = [];
    for (const x of declared) {
        if (x === inert) continue;
        if (!tryUse(p, name(inert), name(x)).answered) silent.push(name(x));
    }
    for (const sName of silent) console.log(`       [opheldu,${sName}] says nothing`);
    check('  no trigger swallows a click in silence', silent.length, 0);
}

// ============================================================ every pair of items that declares one
// The universe is the objs that have an [opheldu,x] of their own. A pair where only ONE half has a
// trigger cannot be asymmetric - the handler finds the same script either way round - so the sweep
// is over the objs that can collide, which is also what keeps it to minutes rather than hours.
if (SWEEP) {
    console.log('');
    console.log('AND EVERY ORDERED PAIR OF THE OBJS THAT DECLARE A TRIGGER');
    const p = player('opheldu_sweep', 3222, 3222);
    const bad: string[] = [];
    let pairs = 0;
    for (const x of declared) {
        for (const y of declared) {
            if (x >= y) continue;
            const nx = name(x), ny = name(y);
            pairs++;
            const forward = tryUse(p, nx, ny);
            const back = tryUse(p, ny, nx);
            if (forward.handled !== back.handled) {
                const works = forward.handled ? `${nx} on ${ny}` : `${ny} on ${nx}`;
                const fails = forward.handled ? `${ny} on ${nx}` : `${nx} on ${ny}`;
                bad.push(`${works} works, ${fails} does not`);
            }
        }
    }
    console.log(`  ${pairs} unordered pairs, both ways round each`);
    for (const b of bad) console.log(`       ${b}`);
    check('  no pair works one way round only', bad.length, 0);
}

console.log('');
console.log(`OPHELDU ${R.ok} ok, ${R.bad} FAIL`);
process.exit(R.bad ? 1 : 0);
