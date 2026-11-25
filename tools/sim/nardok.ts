/**
 * NARDOK'S BONE WEAPONS, and the gate in front of it.
 *
 * He was added on 2026-11-24 because Wanted!'s third clue - "A spear, and it is made of BONE.
 * Nobody sells those. Somebody down a hole carved it." - sent a player looking for a bone weapon
 * shop this build did not have. It had the weapons and nobody selling them.
 *
 * WHAT IS WORTH CHECKING HERE, and it is not "does a shop open". It is that the SHELF is Old
 * School's, that he is standing where Old School stands him, and that the quest gate refuses in a
 * way the player can read. A shop that silently does nothing to somebody who has not done The Lost
 * Tribe is indistinguishable from a broken npc, which is the failure this whole file exists after.
 *
 * CORRECTED 2026-11-25, and both corrections were things this file asserted as correct:
 *
 *   THE SHELF WAS TWO ROWS OF FIVE. It said "ten spears and five daggers and nothing else", and
 *   that the club being absent was "exactly as in Old School". It is not: Nardok's is the one shop
 *   that sells all five - club, spear, dagger, Dorgeshuun crossbow, bone bolts - and the crossbow
 *   and the bolts are the rows worth the walk down. A test agreeing with the shop it tests is the
 *   expensive kind of green, so the stock list here is now written out in full.
 *
 *   AND HE WAS IN THE WRONG PLACE - 3313,9630 against Old School's 3322,9608, nine west and
 *   twenty-two north, in a part of the mine nobody walks through. Nothing failed; he was simply
 *   somewhere else, which is why the walk below starts from the tile he used to stand on.
 */
import * as H from './harness.js';
import { check, R, player } from './a1lib.js';
import InvType from '#/cache/config/InvType.js';
import NpcType from '#/cache/config/NpcType.js';
import ObjType from '#/cache/config/ObjType.js';
import VarPlayerType from '#/cache/config/VarPlayerType.js';
import World from '#/engine/World.js';
import Player from '#/engine/entity/Player.js';

await H.boot();

const LOST_TRIBE_COMPLETE = 11;
const shopVarp = VarPlayerType.getId('shop');
const nardokShop = InvType.getId('nardok_shop');

console.log('HE IS IN THE WORLD, where the mine is');
const id = NpcType.getId('nardok');
check('nardok is a real npc type', id !== -1, true);
const nardok = World.npcs.find((n: any) => n && n.isActive && n.type === id)!;
check('and one is standing in the Dorgesh-Kaan mine', nardok !== undefined, true);
check(`  at Old School's 3322,9608 (${nardok?.x},${nardok?.z})`, [nardok?.x, nardok?.z], [3322, 9608]);
const t = NpcType.get(id);
check('  his first option is Talk-to', t.op?.[0], 'Talk-to');
check('  his third is Trade', t.op?.[2], 'Trade');
// NOT ATTACKABLE, and that is deliberate rather than an oversight: the miners and guards either
// side of him fight, and a shopkeeper in a city of his own people does not.
check('  and nothing on his menu is Attack', (t.op ?? []).includes('Attack'), false);

console.log('\nTHE SHELF IS OLD SCHOOL’S, all five rows of it');
const inv = InvType.get(nardokShop);
const stock = Array.from(inv.stockobj ?? []).filter(o => o > 0);
const SHELF = ['cave_goblin_bone_club', 'cave_goblin_bone_spear', 'bone_dagger', 'dorgeshuun_crossbow', 'bone_bolts'];
check('five rows, in his own order', stock.map(o => ObjType.get(o).debugname), SHELF);
check('  and his stock numbers', Array.from(inv.stockcount ?? []).slice(0, 5), [10, 10, 5, 5, 1000]);
// The prices are the objs' own and are asserted here because the shop multiplies them: a changed
// cost would quietly move what a player pays without touching this file. All five already match
// Old School's, which is why nothing is written down twice in the inv.
check('  the prices are Old School\'s', stock.map(o => ObjType.get(o).cost), [600, 600, 2000, 2000, 3]);
// THE BONE BOLT PACK is the one row of his that is NOT here: it was added in 2015 and this build
// has no pack item for it. That is an absence with a reason, so it is asserted rather than left
// to be noticed as a gap later.
check('  and no bone bolt pack, which postdates this build', ObjType.getId('bone_bolt_pack'), -1);

// WHAT THIS PAIR DOES AND DOES NOT PROVE. The two sections below are only worth anything
// together: on its own "the shop does not open" would pass just as happily if op3 never dispatched
// at all, which is the shape of a check that is green over nothing. The section AFTER it opens the
// same shelf through the same op on the same npc, so the op is known to work and the refusal is
// known to be the script choosing to refuse.
//
// HIS WORDS ARE ASSERTED NOW. This used to say they could not be - "a harness limit rather than a
// decision: ~chatnpc opens a dialogue interface instead of writing a mes() line, and neither
// mesSince nor modalMain sees it from here" - and the first half of that is true while the
// conclusion is not. A chat line is an if_settext, so it lands in H.ifaces like any other
// interface write; what it never reaches is H.mesgs. So `heard` reads the interface log, and the
// refusal is now measured rather than taken on trust from nardok.rs2.
const heard = (p: Player, fragment: string) =>
    H.ifaces.some(e => e.kind === 'text' && e.who === p.username && (e.text ?? '').includes(fragment));

console.log('\nWITHOUT THE LOST TRIBE HE SAYS SO, rather than doing nothing');
{
    const p = player('nardok_no', nardok.x - 1, nardok.z);
    H.setVarBit(p, 'lost_tribe_quest', 0);
    H.tick(1);
    H.clearLogs();
    H.opNpc(p, nardok, 3);
    H.tick(6);
    check('  the shop does not open', p.vars[shopVarp] === nardokShop, false);
    check('  and he says why', heard(p, 'not one of us'), true);
}

console.log('\nWITH IT, the counter opens');
{
    const p = player('nardok_yes', nardok.x - 1, nardok.z);
    H.setVarBit(p, 'lost_tribe_quest', LOST_TRIBE_COMPLETE);
    H.tick(1);
    H.opNpc(p, nardok, 3);
    H.tick(6);
    check('  Trade opens Nardok’s shelf', p.vars[shopVarp], nardokShop);
}

console.log('\nAND PAST COMPLETION STILL WORKS, which `=` would have broken');
{
    // The wanted_tiffy.rs2 lesson: a quest varp can sit ABOVE its completion value once post-quest
    // content writes to it, and an exact test would refuse exactly the players who had done most.
    const p = player('nardok_past', nardok.x - 1, nardok.z);
    H.setVarBit(p, 'lost_tribe_quest', LOST_TRIBE_COMPLETE + 3);
    H.tick(1);
    H.opNpc(p, nardok, 3);
    H.tick(6);
    check('  somebody past the end of the quest can still buy', p.vars[shopVarp], nardokShop);
}

console.log('\nAND A PLAYER WALKS TO HIM from the tile he used to stand on');
{
    // THE MOVE'S ONE REAL RISK: twenty-two tiles is far enough to put him through a wall and into
    // some side chamber, and an npc in the wrong pocket of a cave fails nothing - he is simply
    // never found. So this starts where he used to be, which is ground players already cross, and
    // arrives under the engine's own routing rather than a teleport.
    const p = player('nardok_walk', 3313, 9630);
    H.setVarBit(p, 'lost_tribe_quest', LOST_TRIBE_COMPLETE);
    H.tick(1);
    H.opNpc(p, nardok, 3);
    let arrived = false;
    for (let t = 0; t < 60 && !arrived; t++) {
        H.tick(1);
        arrived = p.vars[shopVarp] === nardokShop;
    }
    check('  the walk reaches him and the counter opens', arrived, true);
    check('  and he is one step away at the end', Math.max(Math.abs(p.x - nardok.x), Math.abs(p.z - nardok.z)), 1);
}

console.log('\nTHE TILL, in both directions');
{
    const p = player('nardok_till', nardok.x - 1, nardok.z);
    H.setVarBit(p, 'lost_tribe_quest', LOST_TRIBE_COMPLETE);
    H.give(p, 'coins', 100000);
    H.tick(1);
    H.opNpc(p, nardok, 3);
    H.tick(6);
    check('  the shop is open', p.vars[shopVarp], nardokShop);

    const coins = () => H.invCount(p, 'coins');
    const cost = (name: string) => ObjType.get(ObjType.getId(name)).cost;
    // THE THREE ROWS THAT WERE MISSING, bought one at a time. A full shelf is the only moment the
    // price is exactly the obj's cost, because his prices move 2% per item traded - so each of
    // these is the first of its kind off the shelf.
    for (const [slot, name] of [
        [0, 'cave_goblin_bone_club'],
        [3, 'dorgeshuun_crossbow'],
        [4, 'bone_bolts']
    ] as [number, string][]) {
        const before = coins();
        H.invButton(p, 'shop_template:inv', 2, slot);
        H.tick(2);
        check(`  a ${ObjType.get(ObjType.getId(name)).name} is bought at ${cost(name)}`, [H.invCount(p, name), before - coins()], [1, cost(name)]);
    }

    // And back across the counter. 620 per mille rather than his usual 600: the club just bought
    // left the shelf one under its base stock of ten, and 2% per item is what that is worth. 372
    // and not 360 is the delta working, and a flat 60% here would be the bug.
    const slotOf = (name: string) => {
        const id = ObjType.getId(name);
        const bag = p.getInventory(InvType.INV)!;
        for (let i = 0; i < bag.capacity; i++) if (bag.get(i)?.id === id) return i;
        return -1;
    };
    const beforeSell = coins();
    H.invButton(p, 'shop_template_side:inv', 2, slotOf('cave_goblin_bone_club'));
    H.tick(2);
    check('  selling the club back pays 60% plus the 2% he is short', coins() - beforeSell, Math.floor((cost('cave_goblin_bone_club') * (600 + 20)) / 1000));
    check('  and it leaves the pack', H.invCount(p, 'cave_goblin_bone_club'), 0);

    // HE BUYS ONLY WHAT HE SELLS - allstock=no, so an empty counter cannot be used to turn any
    // old item into coins.
    H.give(p, 'bronze_sword', 1);
    H.clearLogs();
    H.invButton(p, 'shop_template_side:inv', 2, slotOf('bronze_sword'));
    H.tick(2);
    const refused = H.mesgs.some(m => m.who === p.username && m.text.includes("You can't sell this item to this shop."));
    check('  he will not buy a bronze sword', [refused, H.invCount(p, 'bronze_sword')], [true, 1]);
}

console.log(R.bad ? `FAILED: ${R.bad} of ${R.ok + R.bad}` : `${R.ok} ok`);
process.exit(R.bad ? 1 : 0);
