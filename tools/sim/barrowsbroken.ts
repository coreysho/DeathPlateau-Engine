// A BROKEN BARROWS PIECE TELLS YOU TO SEE BOB, and still does not go on.
//
//   npx tsx tools/sim/barrowsbroken.ts
//
// tier70.rs2 has had [opheld2,barrows_*_broken] ~barrows_broken_refuse for all 24 pieces since
// degrade landed, and degrade.rs2 has the proc:
//
//     mes("This item is broken and needs repairing before it can be worn again.");
//     mes("Bob in Lumbridge will repair it for you.");
//
// None of it ran. The broken objs declared no iop2 at all - only "Drop" - so no client ever drew a
// Wear option, nothing ever reached the handler, and a player holding a broken helm was told
// nothing about what to do with it. tools/sim/orphans.ts found all 24 at once.
//
// The fix was an iop2 on each broken obj, taken from its own undegraded twin rather than chosen:
// barrows_ahrim_head_100 declares iop2=Wear and barrows_ahrim_weapon_100 declares iop2=Wield, so
// head, body and legs get Wear and the weapon gets Wield.
//
// WHAT THIS HAS TO PROVE IS BOTH HALVES. Adding a Wear option to an item that must not be worn is
// only safe because the specific [opheld2,barrows_x_broken] trigger claims the click and the global
// [opheld2,_] equip code in equip.rs2 never sees it. If trigger dispatch ever changed, this would
// turn 24 broken items into wearable ones with no bonuses, so the test asserts the worn slot stays
// empty as well as asserting the message.
import * as H from './harness.js';
import { check, R } from './a1lib.js';
import InvType from '#/cache/config/InvType.js';
import ObjType from '#/cache/config/ObjType.js';

await H.boot();

const PIECES = ['ahrim', 'dharok', 'guthan', 'karil', 'torag', 'verac'];
const SLOTS = ['head', 'body', 'legs', 'weapon'];

const p = H.makePlayer('barrowsbrk', 3222, 3218);
H.tick(3);
const inv = p.getInventory(InvType.INV)!;
const worn = p.getInventory(InvType.WORN)!;

for (const piece of PIECES) {
    for (const slot of SLOTS) {
        const name = `barrows_${piece}_${slot}_broken`;
        const id = ObjType.getId(name);
        if (id === -1) {
            check(`${name} exists`, false, true);
            continue;
        }
        const type = ObjType.get(id);
        const want = slot === 'weapon' ? 'Wield' : 'Wear';
        check(`${name} iop2`, type.iop?.[1], want);

        inv.removeAll();
        worn.removeAll();
        p.invAdd(InvType.INV, id, 1);
        const from = H.mesgs.length;
        H.opheld(p, name, 2);
        H.tick(2);
        const said = H.mesgs.slice(from).map(m => m.text);
        check(
            `${name} names Bob`,
            said.some(t => t.includes('Bob in Lumbridge')),
            true
        );
        // The half that matters more: it must NOT have gone on.
        check(`${name} stays off`, worn.getItemCount(id), 0);
        check(`${name} stays in the backpack`, inv.getItemCount(id), 1);
    }
}

console.log(`\n${R.ok} ok, ${R.bad} FAIL`);
process.exit(R.bad ? 1 : 0);
