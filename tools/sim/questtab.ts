// The quest tab's five pages, against the real engine - run with `npx tsx tools/sim/questtab.ts`.
//
//   login        the tab opens on the Character Summary, with this player's name, levels and quests
//   summary      after maxing: combat 126, total 2,277, and Total XP 299,791,913 (23 x 13,034,431)
//   switching    every button on every page shows its page (if_settab) and fills it first
//   collection   a row per collection log tab, its bar, and the latest item logged
//   counters     a death, a player killed, a monster killed and a Slayer task each move their count
//   bank         the bank's worth in obj cost, "1.0M" style, right-aligned like every value there
//   server       players online, the UTC clock, uptime; the quick actions open what they say
//
// QT_DUMP=<file> writes the last texts, positions and colours sent for every quest tab component, so
// the pages can be drawn with the client's own code as they really came out.
import fs from 'fs';
import * as H from './harness.ts';
import InvType from '#/cache/config/InvType.js';
import ObjType from '#/cache/config/ObjType.js';
import Component from '#/cache/config/Component.js';
import FontType from '#/cache/config/FontType.js';
import World from '#/engine/World.js';
import ScriptProvider from '#/engine/script/ScriptProvider.js';
import ScriptRunner from '#/engine/script/ScriptRunner.js';
import Player from '#/engine/entity/Player.js';
import IfSetTab from '#/network/game/server/model/IfSetTab.js';
import IfSetPosition from '#/network/game/server/model/IfSetPosition.js';
import IfSetColour from '#/network/game/server/model/IfSetColour.js';
import IfSetText from '#/network/game/server/model/IfSetText.js';
import ServerGameMessage from '#/network/game/server/ServerGameMessage.js';

await H.boot();
H.loginOrder();

// what the harness does not already record: the tab slot, positions and colours - and the last of
// each per component, for QT_DUMP
const tabs: { who: string; com: string; tab: number }[] = [];
const last: Record<string, Record<string, { text?: string; pos?: [number, number]; colour?: number }>> = {};
const at = (who: string, com: number) => {
    const name = Component.get(com).comName ?? String(com);
    return ((last[who] ??= {})[name] ??= {});
};
const origWrite = (Player.prototype as any).write;
(Player.prototype as any).write = function (m: ServerGameMessage) {
    if (m instanceof IfSetTab) tabs.push({ who: this.username, com: m.component === -1 ? 'null' : Component.get(m.component).comName!, tab: m.tab });
    if (m instanceof IfSetText) at(this.username, m.component).text = m.text;
    if (m instanceof IfSetPosition) at(this.username, m.component).pos = [m.x, m.y];
    if (m instanceof IfSetColour) at(this.username, m.component).colour = m.colour;
    return origWrite.call(this, m);
};

let ok = 0, bad = 0;
const check = (what: string, got: unknown, want: unknown) => {
    const pass = JSON.stringify(got) === JSON.stringify(want);
    pass ? ok++ : bad++;
    console.log(`  ${pass ? 'ok  ' : 'FAIL'} ${what}: ${JSON.stringify(got)}${pass ? '' : `   (want ${JSON.stringify(want)})`}`);
};
const text = (p: Player, com: string) => last[p.username]?.[com]?.text;
const pos = (p: Player, com: string) => last[p.username]?.[com]?.pos;
const shown = (p: Player) => tabs.filter(t => t.who === p.username && t.tab === 2).at(-1)?.com;
const p12 = FontType.get(1);
const commas = (n: number) => n.toLocaleString('en-US');

const a: Player = H.makePlayer('qtab_a', 3222, 3218, 50);
const b: Player = H.makePlayer('qtab_b', 3224, 3218, 51);
H.tick(3);

console.log('LOGIN');
check('the quest tab opens on the Character Summary', shown(a), 'questtab_summary');
check('  the name banner is the player', text(a, 'questtab_summary:name'), a.displayName);
check('  the combat level is ~player_combat_level', text(a, 'questtab_summary:combat'), String(H.runProc(a, '[proc,player_combat_level]')[0]));
check('  quests done counts the quest list', /^0 \/ 1\d\d$/.test(text(a, 'questtab_summary:quests') ?? ''), true);
check('  game mode Realism (never chosen reads as the authentic rate)', text(a, 'questtab_summary:mode'), 'Game mode: @whi@Realism@lre@   XP: @whi@x1');
// b logs in on the same tick, after a's login script has run
check('  players online', /^Players online: @gre@[12]$/.test(text(a, 'questtab_summary:online') ?? ''), true);
check('  first seen is set at login', H.getVar(a, 'player_first_seen') > 0, true);

console.log('SUMMARY');
H.maxOut(a);
H.tick(1);
H.ifButton(a, 'questtab_pstats:tab_summary');
check('combat level', text(a, 'questtab_summary:combat'), '126');
check('total level', text(a, 'questtab_summary:total'), '2,277');
check('total XP past the millions carry', text(a, 'questtab_summary:xp'), 'Total XP: @whi@299,791,913');

console.log('SWITCHING');
const pages: [string, string][] = [['summary', 'questtab_summary'], ['quests', 'questlist'], ['collection', 'questtab_collection'],
    ['pstats', 'questtab_pstats'], ['sstats', 'questtab_sstats']];
const badBefore = bad;
for (const [, from] of pages) {
    for (const [key, to] of pages) {
        if (to === from) continue;
        H.ifButton(a, `${from}:tab_${key}`);
        if (shown(a) !== to) check(`${from} -> ${key}`, shown(a), to);
    }
}
check('all twenty buttons show their page', bad - badBefore, 0);
check('%questtab_page follows the last one pressed (Server -> Player Statistics)', H.getVar(a, 'questtab_page'), 3);

console.log('COLLECTION LOG');
H.ifButton(a, 'questtab_summary:tab_collection');
check('four rows, named from the log', [0, 1, 2, 3].map(i => text(a, `questtab_collection:row${i}_name`)), ['Bosses', 'Clues', 'Minigames', 'Other']);
check('  nothing obtained: red, and the bar slid all the way out', [text(a, 'questtab_collection:row0_count')?.slice(0, 7), pos(a, 'questtab_collection:row0_fill')], ['@red@0 ', [-168, 0]]);
check('  nothing logged yet', text(a, 'questtab_collection:latest'), 'Nothing yet');
const head = ObjType.getId('barrows_ahrim_head');
H.runProc(a, '[proc,collection_log_add]', [head, 1]);
H.ifButton(a, 'questtab_summary:tab_collection');
const row0 = text(a, 'questtab_collection:row0_count')!;
const of0 = Number(row0.split(' / ')[1]);
check('one Barrows piece: 1 of the Bosses tab, yellow', row0, `@yel@1 / ${of0}`);
check('  its bar is one share of 168 wide', pos(a, 'questtab_collection:row0_fill'), [Math.trunc(168 / of0) - 168, 0]);
check('  right-aligned by its width in the font', pos(a, 'questtab_collection:row0_count'), [78 - p12.stringWidth(row0), 0]);
check('  and it is the latest item', text(a, 'questtab_collection:latest'), `${ObjType.get(head).name} @lre@(just now)`);
check('  the summary counts it too', (H.ifButton(a, 'questtab_collection:tab_summary'), text(a, 'questtab_summary:collections')?.startsWith('Collections logged: @whi@1 / ')), true);

console.log('COUNTERS');
H.ifButton(a, 'questtab_summary:tab_pstats');
check('a fresh account: no deaths, kills or tasks', ['deaths', 'pvp', 'npcs', 'slayer'].map(k => text(a, `questtab_pstats:${k}`)), ['0', '0', '0', '0']);
check('  XP locked: No, in green', text(a, 'questtab_pstats:locked'), '@gre@No');
// b dies to a: a's hero points on b, then the death queue
H.maxOut(b);
b.heroPoints.addHero(a.hash64, 10);
H.runProc(b, '[proc,player_die]');
H.tick(8);
check('b died once', H.getVar(b, 'player_deaths'), 1);
check('  a killed a player', H.getVar(a, 'player_pvp_kills'), 1);
check('  and a has not died', H.getVar(a, 'player_deaths'), 0);
// a kills a chicken
const chicken = H.addNpc('chicken', a.x + 1, a.z);
H.attackNpc(a, chicken);
let t = 0;
while (H.getVar(a, 'player_npc_kills') === 0 && t++ < 40) H.tick(1);
check('a chicken killed is a monster killed', H.getVar(a, 'player_npc_kills'), 1);
// ~complete_task writes protected varps: it runs from a queue in game, so run it with protected access
a.executeScript(ScriptRunner.init(ScriptProvider.getByName('[proc,complete_task]')!, a), true);
check('a Slayer task completed', H.getVar(a, 'slayer_tasks_done'), 1);
H.setVar(a, 'player_playtime', 1440 * 33 + 60 * 6 + 37);
H.ifButton(a, 'questtab_summary:tab_pstats');
check('the page shows them', ['deaths', 'pvp', 'npcs', 'slayer', 'playtime'].map(k => text(a, `questtab_pstats:${k}`)), ['0', '1', '1', '1', '33d 6h 37m']);
check('  a value is right-aligned in its 84px column', pos(a, 'questtab_pstats:playtime'), [84 - p12.stringWidth('33d 6h 37m'), 0]);
check('  account age from first seen', text(a, 'questtab_pstats:age'), '0 days');
const before = H.getVar(a, 'player_playtime');
H.tick(101);
check('a minute online is a minute played', H.getVar(a, 'player_playtime'), before + 1);

console.log('BANK');
const bank = InvType.getId('bank');
const coins = ObjType.getId('coins'), whip = ObjType.getId('abyssal_whip'), rune = ObjType.getId('rune_platebody');
a.invAdd(bank, coins, 180_000_000);
a.invAdd(bank, whip, 3);
a.invAdd(bank, rune, 10);
const k = Math.trunc(180_000_000 / 1000) + Math.trunc(3 * ObjType.get(whip).cost / 1000) + Math.trunc(10 * ObjType.get(rune).cost / 1000);
H.ifButton(a, 'questtab_summary:tab_pstats');
check(`the bank's worth in obj cost (${commas(k)}K)`, text(a, 'questtab_pstats:bank'), `@yel@${Math.trunc(k / 1000)}.${Math.trunc((k % 1000) / 100)}M`);
a.invAdd(bank, coins, 1_900_000_000);
H.ifButton(a, 'questtab_summary:tab_pstats');
const k2 = k + 1_900_000;
check('  past what an int holds, in billions', text(a, 'questtab_pstats:bank'), `@yel@${Math.trunc(k2 / 1000000)}.${Math.trunc((k2 % 1000000) / 100000)}B`);

console.log('SERVER');
H.ifButton(a, 'questtab_summary:tab_sstats');
check('players online', text(a, 'questtab_sstats:online'), `Players online: @gre@${World.getTotalPlayers()}`);
const now = new Date();
const h = now.getUTCHours() % 12 || 12, ampm = now.getUTCHours() < 12 ? 'AM' : 'PM';
const mon = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][now.getUTCMonth()];
check('the time in UTC', text(a, 'questtab_sstats:time'), `Server time: @gre@${h}:${String(now.getUTCMinutes()).padStart(2, '0')} ${ampm}, ${now.getUTCDate()} ${mon}`);
check('uptime from map_clock', text(a, 'questtab_sstats:uptime'), `Uptime: @gre@${Math.floor(World.currentTick / 100)} mins`);
// a sim player is not a NetworkPlayer, so the modal is read off the player rather than the wire
const modal = () => { const m = (a as any).modalMain; return m === -1 ? null : Component.get(m).comName; };
H.ifButton(a, 'questtab_sstats:act_bosses');
check('View boss kill counts opens the boss kill window', modal(), 'boss_kills');
H.ifButton(a, 'questtab_sstats:act_collog');
check('Open collection log opens the log', modal(), 'collection_log');
H.ifButton(a, 'questtab_summary:collog');
check('  as do the Character Summary button', modal(), 'collection_log');
H.ifButton(a, 'questtab_sstats:act_drops');
check('View monster drop tables says how', H.mesgs.filter(m => m.who === a.username).at(-1)?.text, 'Examine any monster you can attack to see what it drops, and how often.');

console.log('QUESTS');
// a quest moving re-shows the page the player is on rather than jumping to the quest list
H.ifButton(a, 'questtab_summary:tab_pstats');
H.runProc(a, '[proc,send_quest_progress]', [Component.getId('questlist:cook'), 1, 2]);
check('quest progress keeps the Player Statistics page up', shown(a), 'questtab_pstats');

if (process.env.QT_DUMP) {
    fs.writeFileSync(process.env.QT_DUMP, JSON.stringify(last[a.username], null, 1));
    console.log('dumped to ' + process.env.QT_DUMP);
}
console.log(`\n${ok} ok, ${bad} FAIL`);
process.exit(bad ? 1 : 0);
