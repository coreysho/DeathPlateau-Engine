// Grace, in the Rogues' Den.
//
// SHE SELLS NOTHING YET. Her shop held the Graceful outfit for Marks of Grace; the owner is
// implementing Graceful another way (2026-10-04), so the stock and her Trade option are gone and
// the plumbing is not. What this holds her to is that she is there, that she still counts marks,
// and - the part worth a test rather than a glance - that an empty shop cannot be sold into.
//
//   npx tsx tools/sim/grace.ts
import * as H from './harness.ts';
import * as A from './a1lib.ts';
import { check, R, player } from './a1lib.ts';
import InvType from '#/cache/config/InvType.js';
import ObjType from '#/cache/config/ObjType.js';
import NpcType from '#/cache/config/NpcType.js';
import ParamType from '#/cache/config/ParamType.js';

await H.boot();

console.log('SHE IS WHERE OLD SCHOOL PUTS HER');
const grace = H.npcNear('grace', 3053, 4969, 1);
check("  Grace stands in the Rogues' Den at 3053,4969", grace !== null, true);

console.log('\nAND SHE IS NOT SELLING');
{
    const t = NpcType.get(NpcType.getId('grace')) as any;
    // op3 is Trade. An option that opens an empty window is worse than no option.
    check('  no Trade option while the shelves are bare', t.op?.[2] ?? null, null);

    const shop = InvType.get(InvType.getId('grace_shop')) as any;
    check('  and the shop really is empty', (shop.stockobj ?? []).filter((o: number) => o !== -1).length, 0);
    // THE ONE THING AN EMPTY SHOP CAN STILL GET WRONG. allstock=yes would let her buy anything,
    // and her till is Marks of Grace - so a bronze dagger would become a mark.
    check('  it will not buy whatever you bring it', shop.allstock, false);

    // the plumbing stays, so putting the stock back is a stock list and one op line
    const p = (n: string) => t.params?.get(ParamType.getId(n));
    check('  her till is still marks, for when she has something', p('shop_currency'), ObjType.getId('mark_of_grace'));
    check('  at full price (per mille: scale($mult, 1000, $cost))', p('shop_sell_multiplier'), 1000);
    check('  and a mark price does not drift with stock', p('shop_delta'), 0);
}

console.log('\nSHE COUNTS YOUR MARKS');
{
    const p: any = player('runner', 3053, 4970, 1);
    H.clearInv(p);
    H.give(p, 'mark_of_grace', 7);

    // Her lines are ~chatnpc, which is an INTERFACE and not a chat line - A.mesOf cannot see them,
    // which is what the first version of this read the stats panel back for.
    const from = H.ifaces.length;
    H.opNpc(p, grace!, 1);
    A.drive(p, [2]);                                   // "How many have I got?"
    const said = H.ifaces.slice(from).filter(i => i.who === p.username && i.kind === 'text' && i.text).map(i => i.text!);
    check('  Talk-to gets a word out of her', A.saw(said, 'Been up on the rooftops'), true);
    check('  and she counts them', A.saw(said, 'carrying 7 of them'), true);
    H.despawn(p);
}

console.log(`\n${R.ok} ok, ${R.bad} FAIL`);
process.exit(R.bad ? 1 : 0);
