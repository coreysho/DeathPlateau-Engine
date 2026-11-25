// SIR TIFFY CASHIEN'S ARMOURIES - initiate and proselyte, the counter and both worn gates.
//
//   NODE_MEMBERS=true npx tsx tools/sim/templeknight.ts     (exit code is the verdict)
//
// NODE_MEMBERS matters: every piece of both sets is members=yes, and a sim world defaults to
// free-to-play, where ~equip refuses a members obj before any of this build's own gates are
// reached. Run without it and the wear tests fail for a reason that has nothing to do with them.
//
// WHAT IS WORTH TESTING HERE, in order of how badly it would hurt to get wrong:
//
//   1. THE DIALOGUE RESTRUCTURE. Wanted! starts and ends with Tiffy and used to claim his whole
//      conversation whenever it had anything to say, which meant an initiate could not reach the
//      armoury for as long as that quest was open. Both now hang off one menu. That is a change to
//      a quest nobody asked for, so it is driven here at every Wanted! state: the option is
//      offered, it still reaches the quest, and the greeting the menu now says is not said twice.
//   2. The stats. Initiate shipped in the 377 cache with models and NO combat params at all, so it
//      wore as decoration; proselyte is an OSRS import whose params are hand-written. Both are
//      checked against the armour they are meant to match - mithril and adamant - read out of this
//      same build rather than typed in, so the test cannot agree with a mistake in the content.
//   3. The counter: the right list, the right prices, and refusing to buy what it does not sell.
//   4. The proselyte gate is CLOSED, which is the current intended state - see the stub in
//      temple_knight/scripts/temple_knight.rs2. When The Slug Menace lands and the stub is flipped,
//      section 2 is the part that has to be inverted.
import * as H from './harness.js';
import { drive } from './a1lib.js';
import Component from '#/cache/config/Component.js';
import InvType from '#/cache/config/InvType.js';
import ObjType from '#/cache/config/ObjType.js';
import ParamType from '#/cache/config/ParamType.js';
import Player from '#/engine/entity/Player.js';
import { PlayerStat } from '#/engine/entity/PlayerStat.js';
import World from '#/engine/World.js';
import Environment from '#/util/Environment.js';

await H.boot();
H.loginOrder();

const R = { ok: 0, bad: 0 };
const check = (what: string, got: unknown, want: unknown) => {
    const pass = JSON.stringify(got) === JSON.stringify(want);
    if (pass) R.ok++;
    else R.bad++;
    console.log(`  ${pass ? 'ok  ' : 'FAIL'} ${what}: ${JSON.stringify(got)}${pass ? '' : `   (want ${JSON.stringify(want)})`}`);
};

if (!Environment.NODE_MEMBERS) {
    console.log('FAIL this sim needs NODE_MEMBERS=true - both sets are members items and f2p refuses them all');
    process.exit(1);
}

// Falador Park, the grass in front of Tiffy's bench. ^rd_park is 0_46_52_53_44, i.e. (2997, 3372).
const PARK: [number, number] = [2997, 3372];
const DEFENCE_LEVEL = 20; // ^initiate_defence_level
const RD_DONE = 2; // ^recruitmentdrive_complete
const INITIATE = ['basic_tk_helm', 'basic_tk_body', 'basic_tk_legs'];
const PROSELYTE = ['proselyte_sallet', 'proselyte_hauberk', 'proselyte_cuisse', 'proselyte_tasset'];
const WEARPOS = { hat: 0, torso: 4, legs: 7 };

let bucket = 1;
// WANTED! IS NOT STARTED ON A FRESH ACCOUNT (%wanted_main = 0), and ~wanted_tiffy_wants says yes
// in that state - so a player who has only finished Recruitment Drive gets the THREE-option menu.
// That is correct, and it is section 6's business; the sections that are about the shop on its own
// put Wanted! behind them with ^wanted_complete so the menu is the two-option one.
const WANTED_DONE = 50; // ^wanted_complete

function player(name: string, rd = 0): Player {
    const p = H.makePlayer(name, PARK[0], PARK[1], bucket++);
    H.tick(2);
    H.maxOut(p);
    H.clearInv(p);
    // A sim player is mid-tutorial (%tutorial = 0) and some equip paths read it; past the end, so
    // wearing something behaves the way it does for a real player.
    H.setVar(p, 'tutorial', 1000);
    if (rd) H.setVarBit(p, 'rd_main', rd);
    return p;
}
const settle = (q: Player, n = 20) => {
    for (let t = 0; t < n; t++) {
        if (!q.delayed && !q.activeScript) return;
        H.tick(1);
    }
};
const mesFor = (q: Player) => H.mesgs.filter(m => m.who === q.username).map(m => m.text);
const said = (q: Player, fragment: string) => mesFor(q).some(t => t.includes(fragment));
const coins = (q: Player) => H.invCount(q, 'coins');
const slotOf = (q: Player, objName: string) => {
    const id = ObjType.getId(objName);
    const inv = q.getInventory(InvType.INV)!;
    for (let i = 0; i < inv.capacity; i++) if (inv.get(i)?.id === id) return i;
    return -1;
};

/** The chat menu interface that is open right now (multi2 / multi3 / ...), or null. */
function menuIface(q: Player): string | null {
    const name = q.modalChat === -1 ? '' : (Component.get(q.modalChat).comName ?? '');
    const iface = name.split(':')[0];
    return iface.startsWith('multi') ? iface : null;
}
/** The options on the open menu, option 1 first - only meaningful while one IS open. */
function chatOptions(q: Player): string[] {
    const iface = menuIface(q);
    if (!iface) return [];
    const out: string[] = [];
    for (let i = 1; i <= 5; i++) {
        const com = Component.getId(`${iface}:com_${i}`);
        if (com === -1) continue;
        const e = [...H.ifaces].reverse().find(f => f.who === q.username && f.kind === 'text' && f.com === com);
        if (e?.text) out.push(e.text);
    }
    return out;
}
/**
 * Click Talk-to on Tiffy and drive the conversation.
 *
 * a1lib's talk() is not used: it teleports the player to npc.x + 1, and the tile east of Tiffy is
 * the other half of his bench (rd_bench2_half at m46_52 52,45 and 53,45). Every player here is
 * spawned on PARK, which quest_rd.constant already establishes as open grass in front of him.
 */
function tiffyTalk(q: Player, picks: (number | string)[] = [], stop?: () => boolean): string[] {
    const npc = H.npcNear('rd_teleporter_guy', PARK[0], PARK[1])!;
    H.opNpc(q, npc, 1);
    for (let t = 0; t < 25 && !q.activeScript; t++) H.tick(1);
    return drive(q, picks, 3, stop);
}
/** Talk to Tiffy and stop the moment a menu is on screen, leaving it open to be read. */
const tiffyMenu = (q: Player) => tiffyTalk(q, [], () => menuIface(q) !== null);
/** Whatever the shop interface's title was last set to for this player. */
function shopTitle(q: Player): string | null {
    const com = Component.getId('shop_template:com_76');
    for (const e of [...H.ifaces].reverse()) {
        if (e.kind === 'text' && e.who === q.username && e.com === com) return e.text ?? null;
    }
    return null;
}
/** The debugnames on a shop's shelf, in slot order. */
function shelf(invName: string): string[] {
    const inv = World.getInventory(InvType.getId(invName))!;
    const out: string[] = [];
    for (let i = 0; i < inv.capacity; i++) {
        const o = inv.get(i);
        if (o) out.push(ObjType.get(o.id).debugname ?? String(o.id));
    }
    return out;
}
const param = (objName: string, paramName: string) => ObjType.get(ObjType.getId(objName)).params?.get(ParamType.getId(paramName));
const DEFENCES = ['magicattack', 'rangeattack', 'stabdefence', 'slashdefence', 'crushdefence', 'magicdefence', 'rangedefence'];
const defenceLine = (objName: string) => DEFENCES.map(k => param(objName, k) ?? 0);
const greetings = (lines: string[]) => lines.filter(t => t.includes('Mind the pigeons')).length;

// ============================================================ 0. the two sets
console.log('== the two sets wear as the armour they are meant to match');
{
    const scout = player('scout');
    const tiffy = H.npcNear('rd_teleporter_guy', PARK[0], PARK[1]);
    check('Tiffy is on his bench in the park', [tiffy?.x, tiffy?.z], [2997, 3373]);
    // The shop is reached through his dialogue in Old School, not a Trade option, and that is how
    // it is built here - so he must not have grown one.
    check('his only option is Talk-to', [H.npcOpWord(scout, tiffy!, 1), H.npcOpWord(scout, tiffy!, 3)], ['Talk-to', null]);

    // Initiate is mithril's defence line, proselyte is adamant's. BOTH SIDES ARE READ OUT OF THE
    // BUILD: if somebody renumbers mithril, this moves with it instead of going stale.
    const pairs: [string, string, number][] = [
        ['basic_tk_helm', 'mithril_full_helm', 3],
        ['basic_tk_body', 'mithril_platebody', 6],
        ['basic_tk_legs', 'mithril_platelegs', 5],
        ['proselyte_sallet', 'adamant_full_helm', 4],
        ['proselyte_hauberk', 'adamant_platebody', 8],
        ['proselyte_cuisse', 'adamant_platelegs', 6],
        ['proselyte_tasset', 'adamant_plateskirt', 6]
    ];
    for (const [piece, like, prayer] of pairs) {
        check(`${piece} defends like ${like}`, defenceLine(piece), defenceLine(like));
        check(`${piece} prayer bonus`, param(piece, 'prayerbonus'), prayer);
        check(`${piece} has a category`, (ObjType.get(ObjType.getId(piece)).category ?? -1) !== -1, true);
    }
    check('the initiate set is +14 prayer', INITIATE.reduce((n, o) => n + ((param(o, 'prayerbonus') as number) ?? 0), 0), 14);
    check('a proselyte set is +18 prayer', ['proselyte_sallet', 'proselyte_hauberk', 'proselyte_cuisse'].reduce((n, o) => n + ((param(o, 'prayerbonus') as number) ?? 0), 0), 18);

    // Not Saradomin items, in either set - they do not count as one in Old School's God Wars.
    for (const o of [...INITIATE, ...PROSELYTE]) check(`${o} is not a saradominitem`, param(o, 'saradominitem') ?? 0, 0);

    // The cache's own 2006 names, and the port keeping Old School's.
    check('the 377 names are kept', INITIATE.map(o => ObjType.get(ObjType.getId(o)).name), ['Initiate helm', 'Initiate platemail', 'Initiate platelegs']);
    check('the port keeps its own', PROSELYTE.map(o => ObjType.get(ObjType.getId(o)).name), ['Proselyte sallet', 'Proselyte hauberk', 'Proselyte cuisse', 'Proselyte tasset']);

    // A worn model per sex for every piece, and a chathead pair for the two helms. An import that
    // misses one of these wears as an invisible piece or draws a bald face beside your chat.
    for (const o of [...INITIATE, ...PROSELYTE]) {
        const t = ObjType.get(ObjType.getId(o));
        check(`${o} has both worn models`, [t.manwear !== -1, t.womanwear !== -1], [true, true]);
    }
    for (const o of ['basic_tk_helm', 'proselyte_sallet']) {
        const t = ObjType.get(ObjType.getId(o));
        check(`${o} has a chathead pair`, [t.manhead !== -1, t.womanhead !== -1], [true, true]);
    }
    H.despawn(scout);
}

// ============================================================ 1. the initiate worn gate
console.log('\n== initiate: Recruitment Drive, then 20 Defence');
{
    const p = player('initwear');
    H.give(p, 'basic_tk_helm', 1);
    H.clearLogs();
    H.opheld(p, 'basic_tk_helm', 2);
    settle(p);
    check('without the quest it is refused', said(p, 'Only Temple Knight initiates may wear this armour.'), true);
    check('and stays in the pack', [H.wornName(p, WEARPOS.hat), H.invCount(p, 'basic_tk_helm')], [null, 1]);

    H.setVarBit(p, 'rd_main', RD_DONE);
    p.setLevel(PlayerStat.DEFENCE, DEFENCE_LEVEL - 1);
    H.clearLogs();
    H.opheld(p, 'basic_tk_helm', 2);
    settle(p);
    check('with the quest but 19 Defence it is still refused', said(p, 'You are not a high enough level to use this item.'), true);
    check('and says which level', said(p, `defence level of ${DEFENCE_LEVEL}`), true);
    check('and still stays in the pack', H.wornName(p, WEARPOS.hat), null);

    p.setLevel(PlayerStat.DEFENCE, DEFENCE_LEVEL);
    H.clearLogs();
    H.opheld(p, 'basic_tk_helm', 2);
    settle(p);
    check('at 20 Defence it goes on', H.wornName(p, WEARPOS.hat), 'basic_tk_helm');

    // And the other two pieces, in their own slots - a helm passing says nothing about the legs.
    for (const [piece, slot] of [
        ['basic_tk_body', WEARPOS.torso],
        ['basic_tk_legs', WEARPOS.legs]
    ] as [string, number][]) {
        H.give(p, piece, 1);
        H.opheld(p, piece, 2);
        settle(p);
        check(`${piece} goes on`, H.wornName(p, slot), piece);
    }
    H.despawn(p);
}

// ============================================================ 2. the proselyte worn gate
console.log('\n== proselyte: closed until The Slug Menace exists (the intended state for now)');
{
    const p = player('prosewear', RD_DONE);
    for (const piece of PROSELYTE) H.give(p, piece, 1);
    for (const piece of PROSELYTE) {
        H.clearLogs();
        H.opheld(p, piece, 2);
        settle(p);
        check(`${piece} is refused`, said(p, 'Only Temple Knight proselytes may wear this armour.'), true);
    }
    // 99 in everything, the quest before it done, and still nothing worn: the only thing in the way
    // is the rank, which is what ~tk_proselyte_rank returning false means.
    check('nothing is worn', [H.wornName(p, WEARPOS.hat), H.wornName(p, WEARPOS.torso), H.wornName(p, WEARPOS.legs)], [null, null, null]);
    H.despawn(p);
}

// ============================================================ 3. before the quest
console.log('\n== before the quest he is just a man on a bench');
{
    const p = player('nobody');
    H.clearLogs();
    const lines = tiffyTalk(p);
    check('he says hello', lines.some(t => t.includes('Lovely park, this')), true);
    check('and offers nothing', chatOptions(p), []);
    check('and opens no shop', p.modalMain, -1);
    H.despawn(p);
}

// ============================================================ 4. the initiate armoury
console.log('\n== after the quest: the initiate counter');
{
    const p = player('initiate', RD_DONE);
    H.setVarBit(p, 'wanted_main', WANTED_DONE);
    H.clearLogs();
    const lines = tiffyMenu(p);
    check('two options', chatOptions(p), ['Can I buy some armour?', 'Nothing, thanks.']);
    check('and the greeting was said once', greetings(lines), 1);

    const more = drive(p, [1]);
    check('the initiate counter opens', p.modalMain, Component.getId('shop_template'));
    check('with the right title', shopTitle(p), 'Initiate Temple Knight Armoury');
    check('and he says what your rank allows', more.some(t => t.includes('Initiate issue only')), true);
    check('three pieces on the shelf, in the order the counter lists them', shelf('tk_initiate_armoury'), ['basic_tk_helm', 'basic_tk_legs', 'basic_tk_body']);
    H.despawn(p);

    // "Nothing, thanks." is the other half of the menu and must open nothing.
    const q = player('initiate2', RD_DONE);
    H.setVarBit(q, 'wanted_main', WANTED_DONE);
    H.clearLogs();
    tiffyMenu(q);
    const bye = drive(q, [2]);
    check('declining is answered', bye.some(t => t.includes('decorative')), true);
    check('and opens no shop', q.modalMain, -1);
    H.despawn(q);
}

// ============================================================ 5. the till
console.log('\n== buying and selling');
{
    const helmPrice = ObjType.get(ObjType.getId('basic_tk_helm')).cost;
    check('the helm costs 3,000 - the 377 value, not Old School\'s 6,000', helmPrice, 3000);

    const p = player('buyer', RD_DONE);
    H.setVarBit(p, 'wanted_main', WANTED_DONE);
    H.give(p, 'coins', 100000);
    tiffyTalk(p, [1]);
    check('the shop is open', p.modalMain, Component.getId('shop_template'));

    // The helm is shelf slot 0, and inv_button2 on the shop's own strip is "Buy 1".
    const before = coins(p);
    H.clearLogs();
    H.invButton(p, 'shop_template:inv', 2, 0);
    settle(p);
    check('a helm is bought', H.invCount(p, 'basic_tk_helm'), 1);
    check('at its cost, because the sell multiplier is 1000 per mille', before - coins(p), helmPrice);

    // And back, at half - Old School's counter buys at 50%.
    const beforeSell = coins(p);
    H.invButton(p, 'shop_template_side:inv', 2, slotOf(p, 'basic_tk_helm'));
    settle(p);
    check('selling it back pays half', coins(p) - beforeSell, Math.floor(helmPrice / 2));
    check('and it leaves the pack', H.invCount(p, 'basic_tk_helm'), 0);

    // THE COUNTER ONLY BUYS WHAT IT SELLS. A proselyte piece carried to the initiate desk is
    // exactly what Tiffy's own line is about, and allstock=no is what makes it true.
    H.give(p, 'proselyte_hauberk', 1);
    H.clearLogs();
    H.invButton(p, 'shop_template_side:inv', 2, slotOf(p, 'proselyte_hauberk'));
    settle(p);
    check('it will not buy a proselyte hauberk', said(p, "You can't sell this item to this shop."), true);
    check('and does not take it', H.invCount(p, 'proselyte_hauberk'), 1);
    H.despawn(p);
}

// ============================================================ 6. Wanted! shares the menu
console.log('\n== Wanted! is an option on the same menu, not a hijack of the conversation');
{
    // Not started: the quest wants to talk, and so does the shop.
    const p = player('wanted0', RD_DONE);
    H.setVarBit(p, 'wanted_main', 0); // ^wanted_not_started
    H.clearLogs();
    const lines = tiffyMenu(p);
    check('three options', chatOptions(p), ['Do you have any jobs for me yet?', 'Can I buy some armour?', 'Nothing, thanks.']);
    check('the greeting is still said once', greetings(lines), 1);

    // THE REGRESSION THIS SECTION EXISTS FOR: the armoury is reachable while that quest is open.
    drive(p, [2]);
    check('the counter opens anyway', shopTitle(p), 'Initiate Temple Knight Armoury');
    H.despawn(p);

    // ...and the quest is still reachable from option 1. This player has no quest points, so what
    // comes back is Wanted!'s own requirement refusal, which is proof the jump landed in it.
    const q = player('wanted1', RD_DONE);
    H.setVarBit(q, 'wanted_main', 0);
    H.clearLogs();
    const qlines = tiffyTalk(q, [1]);
    check('option 1 lands in Wanted!', qlines.some(t => t.includes('somebody with a history')) || said(q, 'quest points to start Wanted!'), true);
    check('without a second greeting', greetings(qlines), 1);
    H.despawn(q);

    // Mid-quest: the orb has been handed over, so the quest's line is the reminder.
    const r = player('wanted2', RD_DONE);
    H.setVarBit(r, 'wanted_main', 10); // ^wanted_recruited
    // With the orb in hand. Without one, that quest's own handler lends a replacement instead -
    // its lost-commorb branch - and that is not what this check is about.
    H.give(r, 'wanted_crystal_ball', 1);
    H.clearLogs();
    const rlines = tiffyTalk(r, [1]);
    check('mid-quest option 1 gets the reminder', rlines.some(t => t.includes('Savant')), true);
    H.despawn(r);

    // The deed done: "any jobs yet?" would be the wrong thing to say, so the option is reworded.
    const s = player('wanted3', RD_DONE);
    H.setVarBit(s, 'wanted_main', 40); // ^wanted_cornered
    H.clearLogs();
    tiffyMenu(s);
    check('the option reads for where the quest is', chatOptions(s)[0], 'About Solus Dellagar...');
    H.despawn(s);

    // AFTER Wanted!, the quest stops asking for the conversation and the menu goes back to two.
    const t = player('wanted4', RD_DONE);
    H.setVarBit(t, 'wanted_main', 50); // ^wanted_complete
    H.clearLogs();
    tiffyMenu(t);
    check('back to two options once it is over', chatOptions(t), ['Can I buy some armour?', 'Nothing, thanks.']);
    H.despawn(t);
}

console.log(`\n${R.ok} ok, ${R.bad} failed`);
process.exit(R.bad === 0 ? 0 : 1);
