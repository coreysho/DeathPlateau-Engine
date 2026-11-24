// THE THREE SELL-ALLS THAT USED TO ROOT YOU TO THE SPOT FOR A TICK PER ITEM.
// Usage: NODE_MEMBERS=true npx tsx tools/sim/sellall.ts   (exit code is the verdict)
//
// Lunderwin's cabbages and Baraek's two furs each ran `while (inv_total(...) > 0) { ...; p_delay(0); }`.
// p_delay sets player.delayed, and MoveClickHandler and its fifteen siblings THROW AWAY a click
// made while that is set rather than deferring it - so selling a full pack held the player for
// twenty-eight ticks and ate everything they clicked in them, with no message to say why. Same
// class as DeathPlateau-Bugs#39 and #85; decided for Old School's no-delay cadence on 25 November
// 2026 (DeathPlateau-Bugs#86), where RSC's one-per-tick had been copied on purpose.
//
// WHY A SIM AND NOT JUST THE BATTERY. tools/holdloop_battery.py (content) reads the source for a
// `while` body with a p_delay in it, which is what caught these three and what stops a fourth
// arriving. What it cannot see is whether the sale still PAYS - a loop rewritten to sell the lot at
// once is one inv_del and one inv_add away from paying for the wrong number of items. So this
// counts the coins, and it counts the ticks the player was held.
import * as H from './harness.js';
import { check, R, player, drive } from './a1lib.js';
import NpcType from '#/cache/config/NpcType.js';
import Npc from '#/engine/entity/Npc.js';
import World from '#/engine/World.js';

await H.boot();

/** The one npc of this type standing in the world. */
function only(name: string): Npc {
    const id = NpcType.getId(name);
    for (const npc of World.npcs) {
        if (npc && npc.isActive && npc.type === id) {
            return npc;
        }
    }
    throw new Error(`no ${name} is placed - this sim's landmark moved`);
}

/**
 * Sell a pack, and return what it paid and how many ticks the whole sale took.
 *
 * THE COST IS MEASURED IN TICKS, NOT IN player.delayed, and the first version of this file got
 * that wrong in a way worth recording: it sampled `delayed` in a loop AFTER drive() returned, and
 * drive() ticks until the script is idle - so the twenty-eight-tick hold was over before the
 * sampling started, and putting the old loop back did not fail the check. A check that passes
 * against the bug it is about is worse than no check.
 *
 * Elapsed ticks cannot miss it: one p_delay(0) per item means the sale cannot finish in fewer
 * ticks than there are items, and selling them in one go takes the handful of ticks the
 * conversation itself needs.
 */
function sell(who: string, npcName: string, item: string, count: number, picks: (number | string)[]): { coins: number; left: number; ticks: number } {
    const npc = only(npcName);
    const p: any = player(who, npc.x + 1, npc.z, npc.level);
    H.maxOut(p);
    H.clearInv(p);
    H.give(p, item, count);
    H.tick(2);
    if (!H.standBeside(p, npc)) {
        throw new Error(`nowhere to stand beside ${npcName}`);
    }
    H.opNpc(p, npc, 1);
    // drive() clicks through the pages and takes the menu options, and keeps ticking until the
    // script is idle - so the sale is finished when it returns, and the ticks it spent are the
    // ticks the sale cost.
    const from = World.currentTick;
    drive(p, picks);
    return { coins: H.invCount(p, 'coins'), left: H.invCount(p, item), ticks: World.currentTick - from };
}

console.log("LUNDERWIN'S CABBAGES, 100 coins each");
{
    const r = sell('sellcab', 'fairy_lunderwin', 'cabbage', 28, ['Yes, I will sell you all my cabbages']);
    check('  the whole pack is sold', r.left, 0);
    check('  and paid for, every one of the 28', r.coins, 2800);
    // 28 items at one p_delay(0) each cannot finish inside 28 ticks; the conversation itself is a
    // handful. The bound is deliberately loose - this is about a lockout, not about a cadence.
    console.log(`      (the sale took ${r.ticks} ticks)`);
    check('  and the sale does not cost a tick per cabbage', r.ticks < 28, true);
}

console.log("\nBARAEK'S FURS, 12 coins each");
{
    const r = sell('sellfur', 'baraek', 'fur', 28, ['buy my fur', 'OK, here you go']);
    check('  the whole pack is sold', r.left, 0);
    check('  and paid for', r.coins, 336);
    console.log(`      (the sale took ${r.ticks} ticks)`);
    check('  and the sale does not cost a tick per fur', r.ticks < 28, true);
}

console.log('\nAND HIS GREY WOLF FURS, 120 coins each');
{
    const r = sell('sellwolf', 'baraek', 'grey_wolf_fur', 28, ['grey wolf fur', 'Yep, sounds fine']);
    check('  the whole pack is sold', r.left, 0);
    check('  and paid for', r.coins, 3360);
    console.log(`      (the sale took ${r.ticks} ticks)`);
    check('  and the sale does not cost a tick per fur', r.ticks < 28, true);
}

console.log(`\n${R.ok} ok, ${R.bad} FAIL`);
process.exit(R.bad ? 1 : 0);
