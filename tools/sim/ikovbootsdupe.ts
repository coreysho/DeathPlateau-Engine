// THE BOOTS OF LIGHTNESS, PUT ON AND TAKEN OFF - counted, because a 99-bot fuzz run says the count
// does not come back the same.
//
// NOT ikovboots.ts, WHICH IS A DIFFERENT SIM AND WAS HERE FIRST. That one checks the boots get a
// player over the lava bridge. This one asks whether wearing them twice leaves you with two pairs.
// Written as ikovboots.ts originally, which silently overwrote the other and lost it until the
// merge put it back - a reminder to look before naming a new file in a directory of 300.
//
//   npx tsx tools/sim/ikovboots.ts
//
// Temple of Ikov has two objs for one pair of boots: ikov_bootsoflightness weighs 12oz in the
// pocket and ikov_bootsoflightnessworn weighs -10lb on the foot, and the lava bridge refuses anyone
// whose weight is not already negative. So putting them on swaps the obj and taking them off swaps
// it back - [opheld2,ikov_bootsoflightness] in quest_ikov/scripts/ikov_dungeon.rs2 on the way on,
// [proc,on_unequip] in player/scripts/equip.rs2 on the way off.
//
// A swap in two places is a thing to count. The fuzz run's item audit reported
//
//     60 item moves and nothing else over 30 ticks, and the totals changed:
//     ikov_bootsoflightness +16, ikov_bootsoflightnessworn +1
//
// and the audit's whole business is equipping and unequipping over and over, which is this swap
// over and over. Sixty moves is about sixteen cycles and the number that appeared is sixteen.
//
// ONE PAIR GOES IN AND ONE PAIR MUST COME OUT, however many times it is worn. That is the only
// assertion here, and it is made after every single cycle so the run says WHEN it first diverges
// rather than only that it did.
// WHAT ELSE WAS SWEPT FOR THE SAME BUG, and why none of it found a second one. Written down so the
// next person does not repeat four searches that came back clean:
//
//   every hook in [proc,on_unequip]      the boots were the only one wrong. ~castlewars_flag_drop
//                                        already opens with `if (inv_total($inv, $obj) < 1) return`
//                                        - the exact guard added here, so the right shape was
//                                        already in the codebase. The greegree, Ghosts Ahoy
//                                        bedsheet, Easter ring and runecraft hooks touch no items
//                                        at all.
//   op handlers that swap obj A for B    86 of them, 31 with no inv_total guard - and NOT 31 bugs.
//                                        An [opheldN,x] fires once per click, which is the whole
//                                        difference: the boots handler has no yield and no second
//                                        click, it was on_unequip running twice inside ONE unequip.
//   swaps that yield before deleting     47, split 25 guarded to 22 not. p_delay sets p.delayed and
//                                        the engine refuses a delayed player's input, so the yield
//                                        is a protection rather than a gap, and the 25 look like
//                                        convention rather than necessity.
//   item-swapping procs by caller count  over-selects and finds nothing. ~shilo_sandscoop has three
//                                        callers and is fine: they are three separate [oplocu,sandN]
//                                        triggers, one fires per click, each guarded on last_useitem.
//
// THE PROPERTY THAT MATTERED - "this proc runs more than once for one logical action" - is not
// visible to any of those. Static call-site counting cannot see it and neither can a grep. What
// caught it was the fuzzer's item-conservation watcher, holding totals still over a window while
// the bot equipped and unequipped, and that is the general protection against the next one.
import * as H from './harness.js';
import InvType from '#/cache/config/InvType.js';
import ObjType from '#/cache/config/ObjType.js';

await H.boot();

let ok = 0;
let bad = 0;
const check = (what: string, good: boolean, detail = '') => {
    if (good) {
        ok++;
    } else {
        bad++;
        console.log('  FAIL ' + what + (detail ? ' - ' + detail : ''));
    }
};

const UNWORN = ObjType.getId('ikov_bootsoflightness');
const WORN = ObjType.getId('ikov_bootsoflightnessworn');

const p = H.makePlayer('ikov', 3222, 3218) as unknown as {
    getInventory(t: number): { capacity: number; get(i: number): { id: number; count: number } | null } | null;
};
H.tick(2);
H.maxOut(p as never);
H.clearInv(p as never);
H.tick(1);

/** Every pair the player holds, worn or pocketed, as [unworn, worn, total]. */
function pairs(): [number, number, number] {
    let unworn = 0;
    let worn = 0;
    for (const invName of ['inv', 'worn']) {
        const inv = p.getInventory(InvType.getId(invName));
        if (!inv) continue;
        for (let i = 0; i < inv.capacity; i++) {
            const item = inv.get(i);
            if (!item) continue;
            if (item.id === UNWORN) unworn += item.count;
            if (item.id === WORN) worn += item.count;
        }
    }
    return [unworn, worn, unworn + worn];
}

/** The slot a given obj sits in, in the backpack, or -1. */
function slotOf(objId: number): number {
    const inv = p.getInventory(InvType.getId('inv'))!;
    for (let i = 0; i < inv.capacity; i++) {
        if (inv.get(i)?.id === objId) return i;
    }
    return -1;
}

H.give(p as never, 'ikov_bootsoflightness', 1);
H.tick(1);
check('one pair to start with', pairs()[2] === 1, JSON.stringify(pairs()));

console.log('');
console.log('-- putting them on and taking them off, one pair, over and over');
const CYCLES = 20;
let diverged = -1;
for (let c = 1; c <= CYCLES; c++) {
    // ON. [opheld2,ikov_bootsoflightness] swaps the obj and equips the result.
    const onSlot = slotOf(UNWORN);
    if (onSlot === -1) {
        check(`cycle ${c}: a pocketed pair to put on`, false, `holdings are ${JSON.stringify(pairs())}`);
        break;
    }
    H.opheld(p as never, 'ikov_bootsoflightness', 2);
    H.tick(2);
    if (c <= 2) {
        console.log(`     cycle ${c} after putting them ON:  ${JSON.stringify(pairs())}  (unworn, worn, total)`);
    }

    // OFF. The same click a player makes: Remove on the worn slot, which is what the fuzz run's
    // trail shows as `invop wornitems:worn slot1 op1 (Remove)`.
    const wornInv = p.getInventory(InvType.getId('worn'))!;
    let wornSlot = -1;
    for (let i = 0; i < wornInv.capacity; i++) {
        if (wornInv.get(i)?.id === WORN) wornSlot = i;
    }
    if (wornSlot === -1) {
        check(`cycle ${c}: the boots went on`, false, `holdings are ${JSON.stringify(pairs())}`);
        break;
    }
    H.invButton(p as never, 'wornitems:worn', 1, wornSlot);
    H.tick(2);
    if (c <= 2) {
        console.log(`     cycle ${c} after taking them OFF: ${JSON.stringify(pairs())}  (unworn, worn, total)`);
    }

    const [unworn, worn, total] = pairs();
    if (total !== 1 && diverged === -1) {
        diverged = c;
        console.log(`  cycle ${c} is the first to come out wrong: ${unworn} pocketed + ${worn} worn = ${total} pairs`);
    }
}

const [unworn, worn, total] = pairs();
console.log(`  after ${CYCLES} cycles: ${unworn} pocketed + ${worn} worn = ${total} pairs`);
check(`${CYCLES} cycles of on and off leave exactly one pair`, total === 1, `ended with ${total}${diverged > 0 ? `, first wrong on cycle ${diverged}` : ''}`);

console.log('');
console.log(ok + ' ok, ' + bad + ' FAIL');
process.exit(bad ? 1 : 0);
