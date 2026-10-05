// Grace, in the Rogues' Den, and the first thing in this build that takes a Mark of Grace.
//
// The rooftop courses have been handing marks out since Draynor opened and nothing in the world
// would take one. She sells the six Graceful pieces for 260 marks all told, which is Old School's
// price, and she takes marks rather than coins through param=shop_currency - the same route the
// TzHaar traders take Tokkul, so there is no second shop implementation behind her.
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

const PIECES: [string, number][] = [
    ['graceful_hood', 35], ['graceful_top', 55], ['graceful_legs', 60],
    ['graceful_gloves', 30], ['graceful_boots', 40], ['graceful_cape', 40],
];
const SET = PIECES.reduce((a, [, n]) => a + n, 0);

console.log('SHE IS WHERE OLD SCHOOL PUTS HER');
const grace = H.npcNear('grace', 3053, 4969, 1);
check('  Grace stands in the Rogues\' Den at 3053,4969', grace !== null, true);

console.log('\nAND SHE DEALS IN MARKS, NOT COINS');
{
    const t = NpcType.get(NpcType.getId('grace')) as any;
    const p = (n: string) => t.params?.get(ParamType.getId(n));
    check('  her till is marks of grace', p('shop_currency'), ObjType.getId('mark_of_grace'));
    // per mille, not percent: ~calc_shop_value ends in scale($mult, 1000, $cost)
    check('  she sells at the price on the item', p('shop_sell_multiplier'), 1000);
    check('  buys back at the same', p('shop_buy_multiplier'), 1000);
    // A mark price is a fixed price. With a delta the shop would charge more as its stock ran
    // down, which for a currency you earn one lap at a time is a tax nobody can see coming.
    check('  and the price does not drift with stock', p('shop_delta'), 0);
}

console.log('\nTHE OUTFIT COSTS WHAT THE WIKI SAYS');
for (const [name, marks] of PIECES) {
    check(`  ${name.padEnd(16)} ${String(marks).padStart(2)} marks`, ObjType.get(ObjType.getId(name)).cost, marks);
}
check(`  the set is ${SET}`, SET, 260);

console.log('\nBUYING ONE');
{
    const p: any = player('runner', 3053, 4970, 1);
    H.clearInv(p);
    H.give(p, 'mark_of_grace', 100);

    // Her greeting is a ~chatnpc, which is an INTERFACE and not a chat line - A.mesOf cannot see
    // it, which is what the first version of this check got wrong and why it read the stats panel
    // back instead. Read the interfaces, from a mark taken before the click.
    const from = H.ifaces.length;
    H.opNpc(p, grace!, 1);
    H.tick(2);
    const said = H.ifaces.slice(from).filter(i => i.who === p.username && i.kind === 'text' && i.text).map(i => i.text!);
    check('  Talk-to gets a word out of her', A.saw(said, 'something a little more graceful'), true);

    // and the shop itself, down the path a click takes. op3 Trade, not the proc on its own:
    // ~openshop_activenpc reads npc_param(owned_shop) off the ACTIVE NPC, and a bare proc run has
    // no active npc, so %shop stayed -1 and every buy threw "inv_total ... Input was -1".
    H.opNpc(p, grace!, 3);
    H.tick(2);
    A.runProcProtected(p, '[label,buy_item]', [ObjType.getId('graceful_legs'), 1]);
    check('  the legs arrive', H.invCount(p, 'graceful_legs'), 1);
    check('  and cost 60 marks of the 100', H.invCount(p, 'mark_of_grace'), 40);

    // 40 left, and the top is 55
    A.runProcProtected(p, '[label,buy_item]', [ObjType.getId('graceful_top'), 1]);
    check('  what you cannot afford, you do not get', H.invCount(p, 'graceful_top'), 0);
    check('  and it costs you nothing to be told so', H.invCount(p, 'mark_of_grace'), 40);

    // AND SHE WILL NOT TAKE IT BACK. Old School lets you sell graceful to her; this build's
    // ~can_sell_obj refuses any untradeable item at any shop, and every piece is untradeable.
    // Asserted rather than wished away, so the day that rule changes this goes red and says so.
    A.runProcProtected(p, '[label,sell_item]', [ObjType.getId('graceful_legs'), 1]);
    check('  she will not buy it back (untradeable, as every shop here treats them)',
        [H.invCount(p, 'graceful_legs'), H.invCount(p, 'mark_of_grace')], [1, 40]);
    H.despawn(p);
}

console.log('\nAND SHE TAKES NOTHING ELSE');
{
    // allstock=no: a player cannot turn a bronze dagger into marks of grace.
    const t = InvType.get(InvType.getId('grace_shop')) as any;
    check('  her shop is not a general store', t.allstock, false);
    check('  and holds only the six', t.stockobj?.filter((o: number) => o !== -1).length, 6);
}

console.log(`\n${R.ok} ok, ${R.bad} FAIL`);
process.exit(R.bad ? 1 : 0);
