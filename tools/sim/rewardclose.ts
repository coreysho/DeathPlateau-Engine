// Closing a reward window hands the loot over: the casket's (trail_reward) into the pack, the Fishing
// Trawler's (trawler_catch) onto the floor. Both used to run the move in the [if_close] itself,
// which has no protected access, so it threw "requires protected access" and moved nothing.
import * as H from './harness.ts';
import InvType from '#/cache/config/InvType.js';
import ObjType from '#/cache/config/ObjType.js';
import Component from '#/cache/config/Component.js';

await H.boot();
H.loginOrder();
let ok = 0, bad = 0;
const check = (what: string, got: unknown, want: unknown) => {
    const pass = JSON.stringify(got) === JSON.stringify(want);
    pass ? ok++ : bad++;
    console.log(`  ${pass ? 'ok  ' : 'FAIL'} ${what}: ${JSON.stringify(got)}${pass ? '' : `   (want ${JSON.stringify(want)})`}`);
};
const count = (p: any, inv: string) => {
    const i = p.getInventory(InvType.getId(inv))!;
    let n = 0;
    for (let s = 0; s < i.capacity; s++) if (i.get(s)) n++;
    return n;
};
const errors: string[] = [];
const origErr = console.error;
console.error = (...a: unknown[]) => { errors.push(a.join(' ')); origErr(...a); };

const p: any = H.makePlayer('reward_a', 3222, 3218, 90);
H.tick(3);
H.clearInv(p);

console.log('CASKET');
p.invAdd(InvType.getId('trail_rewardinv'), ObjType.getId('coins'), 5000);
p.invAdd(InvType.getId('trail_rewardinv'), ObjType.getId('rune_full_helm'), 1);
p.openMainModal(Component.getId('trail_reward'));
H.tick(1);
p.closeModal();
H.tick(2);
check('the loot is in the pack', [H.invCount(p, 'coins'), H.invCount(p, 'rune_full_helm')], [5000, 1]);
check('  and the reward inv is empty', count(p, 'trail_rewardinv'), 0);

console.log('TRAWLER');
p.invAdd(InvType.getId('trawler_rewardinv'), ObjType.getId('raw_shark'), 3);
p.openMainModal(Component.getId('trawler_catch'));
H.tick(1);
p.closeModal();
H.tick(2);
check('what is left in the net is gone from it (dropped at your feet)', count(p, 'trawler_rewardinv'), 0);

check('no "requires protected access" errors', errors.filter(e => e.includes('protected access')).length, 0);
console.log(`\n${ok} ok, ${bad} FAIL`);
process.exit(bad ? 1 : 0);
