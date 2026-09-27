// The Horror from the Deep god books, end to end - run with `npx tsx tools/sim/hftdbooks.ts`.
//
//   after the quest   Jossik opens the casket: a damaged book with no pages in it, and Check says so
//                     page by page (it used to say "Pages still missing: 2, 3, 4." whatever was in it)
//   pages             any order, either way round (page on book, book on page); each one updates the
//                     Check list and the cache's own varbit; a second copy, another god's page and a
//                     random obj are refused; the fourth page turns the book into the finished one
//   stats             every damaged and finished book: shield slot, the OSRS wiki's bonuses, no
//                     requirement to wield, and the +5 Prayer read by the equipment script
//   preach            the finished book's menu, the preach seq, and the passage said overhead
//   Jossik            a lost book comes back with its pages - a finished one comes back finished
//   symbols           a finished book blesses the symbols of its god at 50 Prayer
//   clue rewards      the three casket procs, rolled thousands of times: pages come out of every
//                     tier, all twelve of them, at the OSRS per-page rate
import * as H from './harness.ts';
import World from '#/engine/World.js';
import Player from '#/engine/entity/Player.js';
import Npc from '#/engine/entity/Npc.js';
import ObjType from '#/cache/config/ObjType.js';
import ParamType from '#/cache/config/ParamType.js';
import InvType from '#/cache/config/InvType.js';
import SeqType from '#/cache/config/SeqType.js';
import Component from '#/cache/config/Component.js';
import ScriptState from '#/engine/script/ScriptState.js';
import ScriptProvider from '#/engine/script/ScriptProvider.js';
import ScriptRunner from '#/engine/script/ScriptRunner.js';
import ServerTriggerType from '#/engine/script/ServerTriggerType.js';
import { PlayerStat } from '#/engine/entity/PlayerStat.js';

await H.boot();
H.loginOrder();

let ok = 0, bad = 0;
const check = (what: string, got: unknown, want: unknown) => {
    const pass = JSON.stringify(got) === JSON.stringify(want);
    pass ? ok++ : bad++;
    console.log(`  ${pass ? 'ok  ' : 'FAIL'} ${what}: ${JSON.stringify(got)}${pass ? '' : `   (want ${JSON.stringify(want)})`}`);
};
const truthy = (what: string, pass: boolean, got: unknown) => {
    pass ? ok++ : bad++;
    console.log(`  ${pass ? 'ok  ' : 'FAIL'} ${what}: ${JSON.stringify(got)}`);
};

let bucket = 1;
function player(name: string, x: number, z: number, level = 0, vars: Record<string, number> = {}) {
    const p = H.makePlayer(name, x, z, bucket++);
    if (level) p.teleport(x, z, level);
    for (const [k, v] of Object.entries(vars)) H.setVar(p, k, v);
    H.tick(1);
    H.maxOut(p);
    H.clearInv(p);
    H.tick(1);
    return p;
}

/** Click through whatever dialogue is open, taking `picks` at menus; returns the text it showed. */
function drive(p: Player, picks: number[] = [], guardTicks = 3): string[] {
    const from = H.ifaces.length;
    let idle = 0;
    for (let guard = 0; guard < 400 && idle < guardTicks; guard++) {
        const s = p.activeScript;
        if (!s || s.execution !== ScriptState.PAUSEBUTTON) {
            if (!s && !p.delayed && [...p.queue.all()].length === 0 && !p.target) idle++;
            else idle = 0;
            H.tick(1);
            continue;
        }
        idle = 0;
        const names = p.resumeButtons.map((id: number) => Component.get(id).comName ?? '');
        const open = p.modalChat === -1 ? '' : (Component.get(p.modalChat).comName ?? '');
        const multi = open.startsWith('multi') ? names.find((n: string) => n.startsWith(open + ':')) : null;
        if (multi) {
            const pick = picks.shift();
            if (pick === undefined) throw new Error('unexpected menu: ' + open);
            H.choose(p, `${multi.split(':')[0]}:com_${pick}`);
        } else {
            p.executeScript(s, true, true);
        }
    }
    if (picks.length) throw new Error('menus not reached: ' + picks.join(','));
    return H.ifaces.slice(from).filter(i => i.who === p.username && i.kind === 'text' && i.text && i.text.length > 1).map(i => i.text!);
}
function talkNear(p: Player, npc: Npc, picks: number[] = []) {
    for (const [dx, dz] of [[0, -1], [1, 0], [-1, 0], [0, 1], [1, 1], [-1, -1], [2, 0], [0, 2]]) {
        p.teleport(npc.x + dx, npc.z + dz, npc.level);
        H.tick(1);
        H.opNpc(p, npc, 1);
        for (let t = 0; t < 6 && !p.activeScript; t++) H.tick(1);
        if (p.activeScript) break;
    }
    return drive(p, picks);
}
const slotOf = (p: Player, objName: string) => {
    const id = ObjType.getId(objName);
    const inv = p.getInventory(InvType.INV)!;
    for (let i = 0; i < inv.capacity; i++) if (inv.get(i)?.id === id) return i;
    return -1;
};
/** "Use X on Y" in the pack: OpHeldUHandler - Y's trigger, else X's with the two swapped. */
function useOn(p: Player, used: string, target: string) {
    const a = ObjType.getId(used), b = ObjType.getId(target);
    const sa = slotOf(p, used), sb = slotOf(p, target);
    if (sa === -1 || sb === -1) throw new Error(`not carrying ${used} / ${target}`);
    p.lastItem = b; p.lastSlot = sb; p.lastUseItem = a; p.lastUseSlot = sa;
    let script = ScriptProvider.getByTriggerSpecific(ServerTriggerType.OPHELDU, b, -1);
    if (!script) {
        script = ScriptProvider.getByTriggerSpecific(ServerTriggerType.OPHELDU, a, -1);
        [p.lastItem, p.lastUseItem] = [p.lastUseItem, p.lastItem];
        [p.lastSlot, p.lastUseSlot] = [p.lastUseSlot, p.lastSlot];
    }
    const from = H.mesgs.length;
    if (!script) {
        return ['Nothing interesting happens.'];
    }
    p.executeScript(ScriptRunner.init(script, p), true);
    drive(p);
    return H.mesgs.slice(from).filter(m => m.who === p.username).map(m => m.text);
}
function checkBook(p: Player, book: string): string[] {
    // the mesbox is drawn inside the click itself, before drive() starts watching
    const from = H.ifaces.length;
    H.opheld(p, book, 3);
    drive(p);
    const shown = H.ifaces.slice(from).filter(i => i.who === p.username && i.kind === 'text' && i.text).map(i => i.text!);
    // only the mesbox's lines - the side tabs redraw text of their own while it is open
    return shown.filter(l => / page is (missing|in the book)\.$/.test(l));
}
const missing = (lines: string[]) => lines.filter(l => l.endsWith('page is missing.')).map(l => l.split(' ')[1]);

const PAGE = (g: string, n: number) => `holy_book_${g}_page${n}`;

// ============================================================ after the quest
console.log('After the quest - the casket and the book in it:');
const j = player('hftdbk1', 2510, 3640, 1, { horror: 6, horror_bridges: 7 | (1 << 3) });
const well = () => H.npcNear('horror_lighthousekeeeper_well', j.x, j.z, 1)!;
talkNear(j, well(), [2, 2]);
check('Zamorak twice: the damaged book of Zamorak', H.invCount(j, 'unfinished_zamorakbook'), 1);
check('and it has no pages in it: %godbook_multi is 0', H.getVar(j, 'godbook_multi'), 0);
let lines = checkBook(j, 'unfinished_zamorakbook');
check('Check goes through all four pages, every one missing', lines, ['The first page is missing.', 'The second page is missing.', 'The third page is missing.', 'The fourth page is missing.']);
truthy('and the old "Pages still missing: 2, 3, 4." placeholder is gone', !H.mesgs.some(m => m.who === j.username && m.text.includes('Pages still missing')), false);

// ============================================================ pages in any order
console.log('Pages, in any order:');
for (let n = 1; n <= 4; n++) H.give(j, PAGE('z', n), 1);
H.give(j, PAGE('z', 3), 1); // a second page 3
H.give(j, PAGE('s', 1), 1);
H.give(j, 'bronze_arrow', 1);
const bookSlot = slotOf(j, 'unfinished_zamorakbook');

let m = useOn(j, PAGE('z', 3), 'unfinished_zamorakbook');
check('page 3 on the book: added', m, ['You add the page to the book...']);
check('Check: 1, 2 and 4 missing', missing(checkBook(j, 'unfinished_zamorakbook')), ['first', 'second', 'fourth']);
check('the cache varbit horror_unholypage3 is set, the others not', [1, 2, 3, 4].map(n => H.getVarBit(j, `horror_unholypage${n}`)), [0, 0, 1, 0]);
check('one page 3 used, the second kept', H.invCount(j, PAGE('z', 3)), 1);

m = useOn(j, PAGE('z', 3), 'unfinished_zamorakbook');
check('the second page 3: refused, and kept', [m, H.invCount(j, PAGE('z', 3))], [['The book already has that page.'], 1]);
m = useOn(j, PAGE('s', 1), 'unfinished_zamorakbook');
check('a Saradomin page in the Zamorak book: nothing, and kept', [m, H.invCount(j, PAGE('s', 1))], [['Nothing interesting happens.'], 1]);
m = useOn(j, 'bronze_arrow', 'unfinished_zamorakbook');
check('an arrow: nothing', m, ['Nothing interesting happens.']);

m = useOn(j, 'unfinished_zamorakbook', PAGE('z', 1)); // the book on the page, the other way round
check('the book used on page 1: added all the same', m, ['You add the page to the book...']);
check('Check: 2 and 4 missing', missing(checkBook(j, 'unfinished_zamorakbook')), ['second', 'fourth']);
m = useOn(j, PAGE('z', 4), 'unfinished_zamorakbook');
lines = checkBook(j, 'unfinished_zamorakbook');
check('page 4: only the second missing now', [m, missing(lines)], [['You add the page to the book...'], ['second']]);
check('...and the first, third and fourth read as in the book', lines.filter(l => l.endsWith('in the book.')).length, 3);

m = useOn(j, PAGE('z', 2), 'unfinished_zamorakbook');
check('the last page: added, and the book is complete', m, ['You add the page to the book...', 'The book is now complete!']);
check('the damaged book became the unholy book, in the same slot', [H.invCount(j, 'unfinished_zamorakbook'), H.invCount(j, 'zamorakbook_complete'), slotOf(j, 'zamorakbook_complete')], [0, 1, bookSlot]);
check('all four Zamorak pages used up (the spare page 3 aside)', [1, 2, 3, 4].map(n => H.invCount(j, PAGE('z', n))), [0, 0, 1, 0]);
check('all four unholy page varbits set', [1, 2, 3, 4].map(n => H.getVarBit(j, `horror_unholypage${n}`)), [1, 1, 1, 1]);
m = useOn(j, PAGE('z', 3), 'zamorakbook_complete');
check('a page on the finished book: it already has it', m, ['The book already has that page.']);

// ============================================================ stats
console.log('Stats (OSRS wiki item pages):');
const P = (name: string) => ParamType.getId(name);
const ATK = ['stabattack', 'slashattack', 'crushattack', 'magicattack', 'rangeattack'];
const DEF = ['stabdefence', 'slashdefence', 'crushdefence', 'magicdefence', 'rangedefence'];
const stats = (obj: string) => {
    const t = ObjType.get(ObjType.getId(obj));
    const v = (k: string) => (t.params.get(P(k)) as number | undefined) ?? 0;
    return { wearpos: t.wearpos, atk: ATK.map(v), def: DEF.map(v), prayer: v('prayerbonus'), str: v('strengthbonus') };
};
const WANT: Record<string, { atk: number; def: number }> = {
    unfinished_saradominbook: { atk: 0, def: 0 }, unfinished_zamorakbook: { atk: 0, def: 0 }, unfinished_guthixbook: { atk: 0, def: 0 },
    saradominbook_complete: { atk: 0, def: 8 }, zamorakbook_complete: { atk: 8, def: 0 }, guthixbook_complete: { atk: 4, def: 4 }
};
const sp = player('hftdbk2', 3222, 3218);
for (const [obj, w] of Object.entries(WANT)) {
    check(`${obj} (${ObjType.get(ObjType.getId(obj)).name}): shield slot, attack, defence, prayer`, stats(obj),
        { wearpos: 5, atk: Array(5).fill(w.atk), def: Array(5).fill(w.def), prayer: 5, str: 0 });
    // wield it at level 1 in everything - there is no requirement
    for (const s of [PlayerStat.ATTACK, PlayerStat.DEFENCE, PlayerStat.PRAYER, PlayerStat.MAGIC]) sp.setLevel(s, 1);
    H.clearInv(sp);
    H.give(sp, obj);
    H.opheld(sp, obj, 2);
    drive(sp);
    const worn = sp.getInventory(InvType.WORN)!.get(5);
    check(`...wielded at level 1 into the shield slot, and the equipment script reads +5 Prayer`, [worn?.id === ObjType.getId(obj), H.getVar(sp, 'prayer_drain_resistance')], [true, 70]);
    sp.invDelSlot(InvType.WORN, 5);
}

// ============================================================ preach
console.log('Preach:');
H.clearLogs();
H.opheld(j, 'zamorakbook_complete', 3);
drive(j, [4]);
const said = H.ifaces.filter(i => i.who === j.username && i.kind === 'text' && i.text).map(i => i.text!);
const menu = said.slice(said.indexOf('Select a relevant passage'), said.indexOf('Select a relevant passage') + 5);
check('the menu', menu, ['Select a relevant passage', 'Wedding Ceremony', 'Last Rites', 'Blessings', 'Preach']);
check('the Zamorak preach seq, with the book in hand', H.anims.filter(a => a.who === j.username).map(a => a.seq), [SeqType.getId('horror_preach_zamorak')]);
const sermon = H.saysFor(j.username).map(s => s.text);
check('a sermon, three lines overhead, ending on Zamorak', [sermon.length, sermon[2]], [3, 'Zamorak give me strength!']);
truthy('...said a tick or two apart, not all at once', new Set(H.saysFor(j.username).map(s => s.tick)).size === 3, H.saysFor(j.username).map(s => s.tick));
const g = player('hftdbk3', 3222, 3218);
H.give(g, 'guthixbook_complete');
H.clearLogs();
H.opheld(g, 'guthixbook_complete', 3);
drive(g, [1]);
check('the book of balance: the Wedding Ceremony', H.saysFor(g.username).map(s => s.text), ['Light and dark, day and night,', 'Balance arises from contrast.', 'I unify thee in the name of Guthix.']);
H.clearLogs();
H.opheld(g, 'guthixbook_complete', 3);
drive(g, [2]);
check('...and Last Rites', H.saysFor(g.username).map(s => s.text), ['Thy death was not in vain,', 'for it brought some balance to the world.', 'May Guthix bring you rest.']);
const s = player('hftdbk4', 3222, 3218);
H.give(s, 'saradominbook_complete');
H.clearLogs();
H.opheld(s, 'saradominbook_complete', 3);
drive(s, [3]);
check('the holy book: Blessings', H.saysFor(s.username).map(x => x.text), ['Go in peace in the name of Saradomin;', 'May his glory shine upon you like the sun.']);

// ============================================================ Jossik
console.log('Jossik gives a lost book back with its pages:');
{
    // Zamorak was finished above; lose it
    H.clearInv(j);
    talkNear(j, well(), [2]);
    check('the finished unholy book comes back finished', [H.invCount(j, 'zamorakbook_complete'), H.invCount(j, 'unfinished_zamorakbook')], [1, 0]);
    // a Saradomin book with two pages in, lost
    const k = player('hftdbk5', 2510, 3640, 1, { horror: 6, horror_bridges: 7 | (1 << 5) });
    H.setVarBit(k, 'horror_holypage2', 1);
    H.setVarBit(k, 'horror_holypage4', 1);
    talkNear(k, H.npcNear('horror_lighthousekeeeper_well', k.x, k.z, 1)!, [2]);
    check('a damaged Saradomin book with two pages in comes back damaged...', H.invCount(k, 'unfinished_saradominbook'), 1);
    check('...with the same two pages in it', missing(checkBook(k, 'unfinished_saradominbook')), ['first', 'third']);
}

// ============================================================ symbols
console.log('Blessing symbols:');
{
    const b = player('hftdbk6', 3222, 3218);
    H.give(b, 'saradominbook_complete');
    H.give(b, 'stringstar');
    H.give(b, 'stringsnake');
    b.setLevel(PlayerStat.PRAYER, 49);
    check('49 Prayer: not yet', [useOn(b, 'stringstar', 'saradominbook_complete'), H.invCount(b, 'stringstar')], [['You need a Prayer level of at least 50 in order to do this.'], 1]);
    b.setLevel(PlayerStat.PRAYER, 70);
    check('70 Prayer: the unblessed symbol is blessed, for 70/10 + 2 = 9 prayer points', [useOn(b, 'stringstar', 'saradominbook_complete'), H.invCount(b, 'blessedstar'), b.levels[PlayerStat.PRAYER]], [['You bless the unblessed symbol.'], 1, 61]);
    check('the holy book will not bless a symbol of Zamorak', useOn(b, 'stringsnake', 'saradominbook_complete'), ['Nothing interesting happens.']);
}

// ============================================================ clue rewards
console.log('Clue caskets, rolled many times:');
{
    const c = player('hftdbk7', 3222, 3218);
    const reward = c.getInventory(InvType.getId('trail_rewardinv'))!;
    const pageIds = new Map<number, string>();
    for (const g of ['s', 'z', 'g']) for (let n = 1; n <= 4; n++) pageIds.set(ObjType.getId(PAGE(g, n)), PAGE(g, n));
    const seen = new Map<string, number>();
    // per-roll page chance for the tier, times the tier's mean roll count (2-4, 3-5, 4-6)
    const tiers: [string, number, number][] = [['easy', 3 * (1 / 72), 6000], ['medium', 4 * (5 / 341), 6000], ['hard', 5 * (6 / 325), 6000]];
    for (const [tier, perCasket, N] of tiers) {
        let pages = 0;
        for (let i = 0; i < N; i++) {
            // as the casket's own opheld runs it: with protected access (H.runProc has none)
            c.closeModal();
            c.executeScript(ScriptRunner.init(ScriptProvider.getByName(`[proc,trail_clue_${tier}_reward]`)!, c), true);
            for (let slot = 0; slot < reward.capacity; slot++) {
                const it = reward.get(slot);
                if (it && pageIds.has(it.id)) {
                    pages += it.count;
                    seen.set(pageIds.get(it.id)!, (seen.get(pageIds.get(it.id)!) ?? 0) + it.count);
                }
            }
            reward.removeAll();
            H.clearInv(c);
            c.queue.clear();
        }
        const want = N * perCasket;
        truthy(`${tier}: ${pages} pages from ${N} caskets, against ${want.toFixed(0)} expected (within 25%)`, Math.abs(pages - want) < want * 0.25, pages);
    }
    check('every one of the twelve pages turned up', [...pageIds.values()].filter(n => !seen.has(n)), []);
    console.log('    ' + [...pageIds.values()].map(n => `${n.replace('holy_book_', '')}=${seen.get(n) ?? 0}`).join(' '));
}

console.log(`\n${ok} ok, ${bad} FAIL`);
process.exit(bad ? 1 : 0);
