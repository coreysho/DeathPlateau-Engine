// Animal Magnetism, start to finish against the real engine - run with `npx tsx tools/sim/animmag.ts`.
//
//   requirements  Ava refuses without The Restless Ghost / Ernest the Chicken / Priest in Peril, and
//                 without 18 Slayer, 19 Crafting, 30 Ranged, 35 Woodcutting; then she accepts
//   the farm      Alice and her husband pass messages until she names the witch; the Old Crone makes
//                 the amulet; he takes it, the chickens go on sale at 10 ecto-tokens each
//   the magnet    the Witch's 5 iron bars, the selected iron, the hammer blow in the wrong place and
//                 then in the Rimmington mine
//   the trees     no axe, a mithril axe that bounces, Turael's swap, and the twigs
//   the notes     the translation, the pattern, the container out of leather and buttons
//   journal       every stage's entry, and the quest point / xp / device reward at the end
//   the device    the attractor at 60% and the accumulator at 72% over 20,000 shots, arrows off a
//                 bow, thrown knives, blowpipe darts, the metal attraction and its interference rule
//   dead clicks   every op on everything the quest adds answers something
import * as H from './harness.ts';
import * as A from './a1lib.ts';
import World from '#/engine/World.js';
import Player from '#/engine/entity/Player.js';
import Npc from '#/engine/entity/Npc.js';
import NpcType from '#/cache/config/NpcType.js';
import ObjType from '#/cache/config/ObjType.js';
import InvType from '#/cache/config/InvType.js';
import ScriptProvider from '#/engine/script/ScriptProvider.js';
import ServerTriggerType from '#/engine/script/ServerTriggerType.js';
import ScriptState from '#/engine/script/ScriptState.js';
import { NpcMode } from '#/engine/entity/NpcMode.js';
import { NpcStat } from '#/engine/entity/NpcStat.js';
import Component from '#/cache/config/Component.js';
import { PlayerStat } from '#/engine/entity/PlayerStat.js';

await H.boot();
H.loginOrder();
const { check, R } = A;
const truthy = (what: string, pass: boolean, got: unknown) => {
    pass ? R.ok++ : R.bad++;
    console.log(`  ${pass ? 'ok  ' : 'FAIL'} ${what}: ${JSON.stringify(got)}`);
};

const AVA = [3093, 3358];
const WITCH = [3093, 3369];
const TREE = [3100, 3345];
const FARM = [3617, 3528];       // Alice's husband
const ALICE = [3627, 3526];
const CRONE = [3461, 3558];
const TURAEL = [2931, 3536];
const MINE = [2975, 3243];       // the iron mine north-east of Rimmington
const ELSEWHERE = [3222, 3218];  // Lumbridge, which is not the mine

const stage = (p: Player) => H.getVar(p, 'animmag');
const farm = (p: Player) => H.getVar(p, 'animmag_farm');
const journal = (p: Player): string => {
    const from = H.ifaces.length;
    H.ifButton(p, 'questlist:animmag');
    H.tick(1);
    return H.ifaces.slice(from).filter(i => i.who === p.username && i.kind === 'text' && i.text).map(i => i.text!).join(' ');
};
const goto = (p: Player, [x, z]: number[], level = 0) => { p.teleport(x, z, level); H.tick(1); };
/** One conversation's chat lines joined - a mesbox arrives split across several of them. */
const all = (lines: string[]) => lines.join(' ');
/**
 * Talk to an npc and return EVERY chat line it produced. a1lib's talk() starts collecting only
 * after the script has paused, which loses the first line - and a one-line answer is nothing but
 * its first line.
 */
const say = (p: Player, npc: string, picks: (number | string)[] = [], op = 1): string[] => {
    const from = H.ifaces.length;
    A.talk(p, npc, picks, op);
    return H.ifaces.slice(from)
        .filter(i => i.who === p.username && i.kind === 'text' && i.text && i.text.length > 1)
        .map(i => i.text!);
};

// =============================================================== requirements

console.log('\n-- requirements');
const q = A.player('quester', AVA[0] + 1, AVA[1]);
const low = (p: Player) => {
    p.setLevel(PlayerStat.SLAYER, 1);
    p.setLevel(PlayerStat.CRAFTING, 1);
    p.setLevel(PlayerStat.RANGED, 1);
    p.setLevel(PlayerStat.WOODCUTTING, 1);
};
low(q);
H.setVar(q, 'prieststart', 0);
H.setVar(q, 'haunted', 0);
H.setVar(q, 'priestperil', 0);
let said = say(q, 'animmag_ava', ['happy to make your home']);
truthy('no quests: Ava names the three quests', all(said).includes('The Restless Ghost') && all(said).includes('Priest in Peril'), all(said).slice(-130));
check('no quests: stage still 0', stage(q), 0);

H.setVar(q, 'prieststart', 5);
H.setVar(q, 'haunted', 3);
H.setVar(q, 'priestperil', 60);
said = say(q, 'animmag_ava', ['happy to make your home']);
truthy('no levels: Ava names all four', all(said).includes('Slayer level of 18') && all(said).includes('Woodcutting level of 35'), all(said).slice(-150));
check('no levels: stage still 0', stage(q), 0);

// 18/19/30/35 exactly - the real gate, not a boosted one
q.setLevel(PlayerStat.SLAYER, 18);
q.setLevel(PlayerStat.CRAFTING, 19);
q.setLevel(PlayerStat.RANGED, 30);
q.setLevel(PlayerStat.WOODCUTTING, 35);
truthy('journal before starting names Ava and the levels',
    journal(q).includes('Ava') && journal(q).includes('Level 30 Ranged'), journal(q).slice(0, 80));
said = say(q, 'animmag_ava', ['happy to make your home']);
truthy('accepted: she asks for two undead chickens', all(said).includes('undead chickens'), said.slice(-1)[0]);
check('accepted: stage 1', stage(q), 1);
truthy('journal at stage 1 names the farm and the tokens',
    journal(q).includes('ecto-tokens'), journal(q).slice(0, 80));

// Ava's Trade op before the quest is done is her brush-off, not a dead click
const tradeScript = ScriptProvider.getByTrigger(ServerTriggerType.OPNPC3, NpcType.getId('animmag_ava'), -1);
truthy('Ava op3 (Trade) is wired', !!tradeScript, !!tradeScript);

// =============================================================== the farm

console.log('\n-- Alice and her husband');
H.equip(q, { front: 'amulet_of_ghostspeak' });
goto(q, ALICE);
said = say(q, 'farming_shopkeeper_4', ['here about a quest']);
truthy('Alice: he is dead, I cannot talk to the dead', all(said).includes("can't talk to the dead"), said.slice(-1)[0]);
check('farm stage: Alice asked', farm(q), 1);
// Alice's own shop option still works - the quest did not eat her Talk-to
said = say(q, 'farming_shopkeeper_4', ['What are you selling']);
truthy('Alice still opens her farming shop', all(said).includes('wares'), said.slice(-1)[0]);

goto(q, FARM);
said = say(q, 'ahoy_ghost_farmer', [1]);
truthy("husband: talk to my wife and I'll think about it", all(said).includes('Talk to my wife'), said.slice(-1)[0]);
check('farm stage: the message of love', farm(q), 2);
goto(q, ALICE);
said = say(q, 'farming_shopkeeper_4', ['here about a quest']);
truthy('Alice: the savings', all(said).includes('savings'), said.slice(-1)[0]);
check('farm stage: savings', farm(q), 3);
goto(q, FARM);
said = say(q, 'ahoy_ghost_farmer');
truthy('husband: the cash is in the bank', all(said).includes('putted the cash in the bank'), said.slice(-1)[0]);
check('farm stage: bank', farm(q), 4);
goto(q, ALICE);
said = say(q, 'farming_shopkeeper_4', ['here about a quest']);
truthy('Alice: I\'ll need his bank pass', all(said).includes('bank pass'), said.slice(-1)[0]);
check('farm stage: pass', farm(q), 5);
goto(q, FARM);
said = say(q, 'ahoy_ghost_farmer');
truthy('husband: no one but a fool gives away their pass numbers', all(said).includes('pass numbers'), said.slice(-1)[0]);
check('farm stage: refused', farm(q), 6);
goto(q, ALICE);
said = say(q, 'farming_shopkeeper_4', ['here about a quest']);
truthy('Alice names the witch who changes ghostspeak amulets', all(said).includes('changes ghostspeak amulets'), said.slice(-1)[0]);
check('farm stage: the witch', farm(q), 7);

console.log('\n-- the Old Crone');
goto(q, CRONE);
said = say(q, 'ahoy_crone');
truthy('the Crone makes the amulet', all(said).includes('second amulet'), said.slice(-1)[0]);
check('crone-made amulet in the pack', H.invCount(q, 'animmag_crone_amulet'), 1);
check('farm stage: has amulet', farm(q), 8);
// lose it: she has spares
q.invDel(InvType.INV, ObjType.getId('animmag_crone_amulet'), 1);
said = say(q, 'ahoy_crone');
truthy('the Crone replaces a lost amulet', all(said).includes('saved some of Alice'), said.slice(-1)[0]);
check('replacement amulet', H.invCount(q, 'animmag_crone_amulet'), 1);

console.log('\n-- the chickens');
goto(q, FARM);
said = say(q, 'ahoy_ghost_farmer');
truthy('the amulet goes over and the two of them can talk', all(said).includes('Ta, mate'), said.slice(-1)[0]);
check('farm stage: reunited', farm(q), 9);
truthy('the sneaky undead fowl is on the farm', !!H.npcNear('animmag_sneaky_fowl', FARM[0], FARM[1]), true);

said = say(q, 'ahoy_ghost_farmer', ['buy an undead chicken']);
truthy('no tokens, no chicken', all(said).includes("don't have that many ecto-tokens"), said.slice(-1)[0]);
H.give(q, 'ectotoken', 20);
say(q, 'ahoy_ghost_farmer', ['buy an undead chicken']);
say(q, 'ahoy_ghost_farmer', ['buy an undead chicken']);
check('two chickens bought', H.invCount(q, 'animmag_undead_chicken'), 2);
check('20 ecto-tokens spent', H.invCount(q, 'ectotoken'), 0);

// =============================================================== the magnet

console.log('\n-- back to Ava, and the Witch');
const craftBefore = q.stats[PlayerStat.CRAFTING];
goto(q, AVA);
said = say(q, 'animmag_ava');
truthy('Ava takes both chickens and sends you next door', all(said).includes('Witch next door'), said.slice(-1)[0]);
check('stage 2', stage(q), 2);
check('chickens gone', H.invCount(q, 'animmag_undead_chicken'), 0);
check('50 Crafting xp for the chickens', q.stats[PlayerStat.CRAFTING] - craftBefore, 500);

goto(q, WITCH);
said = say(q, 'animmag_witch', [2]);
truthy('the Witch wants 5 iron bars', all(said).includes('5 iron bars'), said.slice(-1)[0]);
check('stage 3', stage(q), 3);
said = say(q, 'animmag_witch');
truthy('no bars: come back with all 5', all(said).includes("you don't have any"), all(said).slice(0, 200));
H.give(q, 'iron_bar', 3);
said = say(q, 'animmag_witch');
truthy('3 bars: not enough', all(said).includes("don't have enough"), all(said).slice(0, 200));
H.give(q, 'iron_bar', 2);
said = say(q, 'animmag_witch', ['Here are the bars']);
truthy('the Witch names the Rimmington mine and facing north', all(said).includes('north-east of Rimmington'), said.slice(-1)[0]);
check('bars taken', H.invCount(q, 'iron_bar'), 0);
check('selected iron given', H.invCount(q, 'animmag_selected_iron'), 1);
check('stage 4', stage(q), 4);

H.give(q, 'hammer', 1);
goto(q, ELSEWHERE);
let from = A.mark();
A.useHeld(q, 'hammer', 'animmag_selected_iron');
truthy('hammering it in Lumbridge does nothing', A.said(q, from, "aren't in the the right area"), A.mesSince(q, from).slice(-1)[0]);
check('still just an iron bar', H.invCount(q, 'animmag_bar_magnet'), 0);
goto(q, MINE);
from = A.mark();
A.useHeld(q, 'hammer', 'animmag_selected_iron');
truthy('in the mine it becomes a magnet', A.said(q, from, 'create a magnet'), A.mesSince(q, from).slice(-1)[0]);
check('bar magnet made', H.invCount(q, 'animmag_bar_magnet'), 1);
check('stage 5', stage(q), 5);
// the other way round works too (the case added to general_use/scripts/hammer.rs2)
H.give(q, 'animmag_selected_iron', 1);
A.useHeld(q, 'animmag_selected_iron', 'hammer');
check('iron-on-hammer works as well', H.invCount(q, 'animmag_bar_magnet'), 2);
q.invDel(InvType.INV, ObjType.getId('animmag_bar_magnet'), 1);

const craftBefore2 = q.stats[PlayerStat.CRAFTING];
goto(q, AVA);
said = say(q, 'animmag_ava');
truthy('Ava takes the magnet and points at the trees', all(said).includes('pesky trees'), said.slice(-1)[0]);
check('stage 6', stage(q), 6);
check('another 50 Crafting xp for the magnet', q.stats[PlayerStat.CRAFTING] - craftBefore2, 500);

// =============================================================== the trees

console.log('\n-- the undead trees');
truthy('four undead trees stand in the manor grounds',
    NpcType.getId('animmag_undead_tree') !== -1 && [...World.npcs].filter(n => n && n.isActive && n.type === NpcType.getId('animmag_undead_tree')).length >= 4,
    [...World.npcs].filter(n => n && n.isActive && n.type === NpcType.getId('animmag_undead_tree')).length);
goto(q, [TREE[0] + 1, TREE[1]]);
from = A.mark();
say(q, 'animmag_undead_tree');
truthy('no axe at all: nothing could affect this wood', A.said(q, from, 'could possibly affect this wood'), A.mesSince(q, from).slice(-1)[0]);
H.give(q, 'mithril_axe', 1);
from = A.mark();
say(q, 'animmag_undead_tree');
truthy('a mithril axe bounces off', A.said(q, from, 'bounces off the undead wood'), A.mesSince(q, from).slice(-1)[0]);
check('stage 7', stage(q), 7);
goto(q, AVA);
said = say(q, 'animmag_ava');
truthy('Ava names Turael', all(said).includes('Turael'), said.slice(-1)[0]);
check('stage 8', stage(q), 8);

console.log('\n-- Turael');
goto(q, TURAEL);
said = say(q, 'slayer_master_1', ['about those trees']);
truthy('Turael wants a mithril axe and a holy symbol', all(said).includes('holy symbol of Saradomin'), said.slice(-1)[0]);
H.give(q, 'blessedstar', 1);
said = say(q, 'slayer_master_1', ['about those trees', "I'd love one"]);
truthy('Turael hands over the blessed axe', all(said).includes("Here's a new axe"), said.slice(-1)[0]);
check('blessed axe in the pack', H.invCount(q, 'animmag_blessed_axe'), 1);
check('mithril axe and symbol taken', [H.invCount(q, 'mithril_axe'), H.invCount(q, 'blessedstar')], [0, 0]);
check('stage 9', stage(q), 9);
// his ordinary Slayer menu is still there
said = say(q, 'slayer_master_1', ['Er...nothing']);
truthy('Turael is still a Slayer Master', all(said).includes('Ello'), said.slice(0, 1)[0]);

goto(q, [TREE[0] + 1, TREE[1]]);
for (let i = 0; i < 12 && H.invCount(q, 'animmag_undead_twigs') === 0; i++) say(q, 'animmag_undead_tree');
check('undead twigs cut', H.invCount(q, 'animmag_undead_twigs') > 0, true);

// =============================================================== research and the container

console.log('\n-- the research notes');
goto(q, AVA);
said = say(q, 'animmag_ava');
truthy('Ava takes the twigs and mentions the notes', all(said).includes('research notes'), said.slice(-1)[0]);
check('stage 10', stage(q), 10);
said = say(q, 'animmag_ava');
truthy('Ava hands the notes over', all(said).includes('head doesn\'t explode'), said.slice(-1)[0]);
check('research notes in the pack', H.invCount(q, 'animmag_research_notes'), 1);
// lose them: she has copies
q.invDel(InvType.INV, ObjType.getId('animmag_research_notes'), 1);
said = say(q, 'animmag_ava');
truthy('Ava replaces lost notes', all(said).includes('copies I made'), all(said).slice(0, 140));
check('replacement notes', H.invCount(q, 'animmag_research_notes'), 1);

// The translation: three lines of the notes, each a five-way pick. The right mark is the one the
// script rolled into %animmag_notes_mark, which is exactly what the margin note describes.
const translate = (p: Player) => {
    H.opheld(p, 'animmag_research_notes', 1);
    for (let guard = 0; guard < 400; guard++) {
        const st = p.activeScript;
        if (!st) {
            H.tick(1);
            if (H.invCount(p, 'animmag_translated_notes') > 0 || guard > 20) break;
            continue;
        }
        if (st.execution !== ScriptState.PAUSEBUTTON) {
            H.tick(1);
            continue;
        }
        const open = p.modalChat === -1 ? '' : (Component.get(p.modalChat).comName ?? '');
        if (open.startsWith('multi5')) H.choose(p, `multi5:com_${H.getVar(p, 'animmag_notes_mark') + 1}`);
        else p.executeScript(st, true, true);
    }
    H.tick(2);
};
translate(q);
check('the notes translate', H.invCount(q, 'animmag_translated_notes'), 1);
check('stage 11', stage(q), 11);

said = say(q, 'animmag_ava');
truthy('Ava takes the translation and gives a pattern', all(said).includes('polished buttons'), said.slice(-1)[0]);
check('pattern in the pack', H.invCount(q, 'animmag_pattern'), 1);
check('stage 12', stage(q), 12);

console.log('\n-- the container');
H.give(q, 'polished_buttons', 1);
from = A.mark();
A.useHeld(q, 'polished_buttons', 'animmag_pattern');
truthy('no leather: the game says so', A.said(q, from, 'need hard leather'), A.mesSince(q, from).slice(-1)[0]);
H.give(q, 'hard_leather', 1);
from = A.mark();
A.useHeld(q, 'hard_leather', 'animmag_pattern');
truthy('all three: a container', A.said(q, from, 'fasten it with the buttons'), A.mesSince(q, from).slice(-1)[0]);
check('container made', H.invCount(q, 'animmag_container'), 1);
check('the three parts are gone', [H.invCount(q, 'animmag_pattern'), H.invCount(q, 'hard_leather'), H.invCount(q, 'polished_buttons')], [0, 0, 0]);
truthy('journal at stage 12 names the container',
    journal(q).includes('container'), journal(q).slice(0, 80));

// =============================================================== the reward

console.log('\n-- the reward');
A.runProcProtected(q, '[proc,update_questpoints]');
const before = {
    craft: q.stats[PlayerStat.CRAFTING], fletch: q.stats[PlayerStat.FLETCHING],
    slayer: q.stats[PlayerStat.SLAYER], wc: q.stats[PlayerStat.WOODCUTTING],
    qp: H.getVar(q, 'qp')
};
say(q, 'animmag_ava');
H.tick(3);
check('quest complete', stage(q), 13);
check('1,000 Crafting xp', q.stats[PlayerStat.CRAFTING] - before.craft, 10000);
check('1,000 Fletching xp', q.stats[PlayerStat.FLETCHING] - before.fletch, 10000);
check('1,000 Slayer xp', q.stats[PlayerStat.SLAYER] - before.slayer, 10000);
check('2,500 Woodcutting xp', q.stats[PlayerStat.WOODCUTTING] - before.wc, 25000);
check('1 quest point', H.getVar(q, 'qp') - before.qp, 1);
check('30 Ranged gets the attractor', H.invCount(q, 'avas_attractor'), 1);
check('and not the accumulator', H.invCount(q, 'avas_accumulator'), 0);
truthy('journal after the quest says QUEST COMPLETE', journal(q).includes('QUEST COMPLETE'), journal(q).slice(-60));

// 50 Ranged gets the accumulator straight away
const r50 = A.player('ranger50', AVA[0] + 1, AVA[1]);
H.setVar(r50, 'prieststart', 5); H.setVar(r50, 'haunted', 3); H.setVar(r50, 'priestperil', 60);
H.setVar(r50, 'animmag', 12);
r50.setLevel(PlayerStat.RANGED, 50);
H.give(r50, 'animmag_container', 1);
say(r50, 'animmag_ava');
H.tick(3);
check('50 Ranged gets the accumulator', H.invCount(r50, 'avas_accumulator'), 1);
check('and not the attractor', H.invCount(r50, 'avas_attractor'), 0);

// Ava upgrades an attractor for 75 steel arrows, but not below 50 Ranged
console.log('\n-- Ava\'s counter');
said = say(q, 'animmag_ava', [], 3);
truthy('below 50 Ranged she will not upgrade', all(said).includes('Ranged level is 50'), said.slice(-1)[0]);
q.setLevel(PlayerStat.RANGED, 50);
said = say(q, 'animmag_ava', [], 3);
truthy('no arrows, no upgrade', all(said).includes("don't have that many steel arrows"), said.slice(-1)[0]);
H.give(q, 'steel_arrow', 75);
say(q, 'animmag_ava', ['Here you go'], 3);
check('75 steel arrows buy the upgrade', [H.invCount(q, 'avas_accumulator'), H.invCount(q, 'avas_attractor'), H.invCount(q, 'steel_arrow')], [1, 0, 0]);

// =============================================================== Ava's devices in a fight

console.log('\n-- what the device does');
const saveRate = (p: Player, cape: string | null, n = 20000) => {
    if (cape) H.equip(p, { back: cape });
    else p.invDel(InvType.WORN, p.getInventory(InvType.WORN)!.get(1)?.id ?? 0, 1);
    let kept = 0;
    for (let i = 0; i < n; i++) if (H.runProc(p, '[proc,ranged_ammo_saved]')[0] === 1) kept++;
    return Math.round((kept * 1000) / n) / 10;
};
const bare = A.player('shooter', 3200, 3200);
check('nothing on the back saves nothing', saveRate(bare, null), 0);
const att = saveRate(bare, 'avas_attractor');
truthy('the attractor saves 60% of shots', Math.abs(att - 60) < 2, att);
const acc = saveRate(bare, 'avas_accumulator');
truthy('the accumulator saves 72% of shots', Math.abs(acc - 72) < 2, acc);
const cape = saveRate(bare, 'ranging_cape');
truthy('the Ranging cape still saves 72%', Math.abs(cape - 72) < 2, cape);

// A real bow shot: the arrow stays in the quiver instead of landing on the floor.
/** A punchbag that will not die and will not fight back. */
const dummy = (x: number, z: number) => {
    const npc = H.addNpc('mossgiant', x, z) as unknown as { baseLevels: Int32Array; levels: Int32Array; targetOp: number };
    npc.baseLevels[NpcStat.HITPOINTS] = 30000;
    npc.levels[NpcStat.HITPOINTS] = 30000;
    npc.targetOp = NpcMode.NONE;
    return npc as unknown as Npc;
};
const fightNpc = (p: Player, npc: Npc, ticks: number) => {
    H.attackNpc(p, npc);
    for (let t = 0; t < ticks; t++) {
        (npc as unknown as { levels: Int32Array }).levels[NpcStat.HITPOINTS] = 30000;
        p.levels[PlayerStat.HITPOINTS] = p.baseLevels[PlayerStat.HITPOINTS];
        H.tick(1);
        if (!p.target && !p.delayed) H.attackNpc(p, npc);
    }
};
const quiverLeft = (device: string | null) => {
    const s = A.player(`archer_${device ?? 'none'}`, 3200, 3200);
    H.equip(s, device ? { rhand: 'magic_shortbow', quiver: 'rune_arrow', back: device } : { rhand: 'magic_shortbow', quiver: 'rune_arrow' });
    s.invSet(InvType.WORN, ObjType.getId('rune_arrow'), 2000, 13);
    const target = dummy(s.x + 3, s.z);
    fightNpc(s, target, 200);
    return 2000 - (s.getInventory(InvType.WORN)!.get(13)?.count ?? 0);
};
const spentNone = quiverLeft(null);
const spentAcc = quiverLeft('avas_accumulator');
truthy('with an accumulator far fewer arrows leave the quiver', spentAcc * 2 < spentNone, { none: spentNone, accumulator: spentAcc });

// Thrown weapons go through the same proc.
const thrown = (device: string | null) => {
    const s = A.player(`thrower_${device ?? 'none'}`, 3205, 3205);
    H.equip(s, device ? { rhand: 'rune_knife', back: device } : { rhand: 'rune_knife' });
    s.invSet(InvType.WORN, ObjType.getId('rune_knife'), 2000, 3);
    const target = dummy(s.x + 3, s.z);
    fightNpc(s, target, 200);
    return 2000 - (s.getInventory(InvType.WORN)!.get(3)?.count ?? 0);
};
const knivesNone = thrown(null);
const knivesAcc = thrown('avas_accumulator');
truthy('thrown knives are saved too', knivesAcc * 2 < knivesNone, { none: knivesNone, accumulator: knivesAcc });

// The blowpipe counts its darts in a varp, and asks the same proc.
console.log('\n-- the blowpipe');
const bpDarts = (device: string | null) => {
    const s = A.player(`piper_${device ?? 'none'}`, 3210, 3210);
    H.equip(s, device ? { rhand: 'toxic_blowpipe', back: device } : { rhand: 'toxic_blowpipe' });
    H.setVar(s, 'blowpipe_scales', 30000);
    H.setVar(s, 'blowpipe_darts', 2000);
    H.setVar(s, 'blowpipe_dart_type', ObjType.getId('rune_dart'));
    let spent = 0;
    for (let i = 0; i < 2000; i++) {
        const before = H.getVar(s, 'blowpipe_darts');
        A.runProcProtected(s, '[proc,blowpipe_spend]');
        if (H.getVar(s, 'blowpipe_darts') < before) spent++;
        H.setVar(s, 'blowpipe_darts', 2000);
        H.setVar(s, 'blowpipe_scales', 30000);
    }
    return Math.round((spent * 1000) / 2000) / 10;
};
const bpNone = bpDarts(null);
const bpAcc = bpDarts('avas_accumulator');
const bpAtt = bpDarts('avas_attractor');
truthy('no device: every dart is spent', bpNone > 98, bpNone);
truthy('accumulator: 28% of darts are spent', Math.abs(bpAcc - 28) < 3, bpAcc);
truthy('attractor: 40% of darts are spent', Math.abs(bpAtt - 40) < 3, bpAtt);

// =============================================================== the metal attraction

console.log('\n-- attracting metal');
const attract = (p: Player, device: string, torso?: string) => {
    H.clearInv(p);
    H.equip(p, torso ? { back: device, torso } : { back: device });
    if (!torso) p.invDel(InvType.WORN, p.getInventory(InvType.WORN)!.get(4)?.id ?? 0, 1);
    H.setVar(p, 'animmag_attract_clock', 0);
    A.enqueue(p, '[queue,animmag_attract]');       // starts the clock
    H.tick(2);
    H.setVar(p, 'animmag_attract_clock', 1);
    p.teleport(p.x + 8, p.z, p.level);
    H.tick(1);
    A.enqueue(p, '[queue,animmag_attract]');
    H.tick(2);
    const inv = p.getInventory(InvType.INV)!;
    const got: string[] = [];
    for (let i = 0; i < inv.capacity; i++) {
        const s = inv.get(i);
        if (s) got.push(ObjType.get(s.id).debugname ?? String(s.id));
    }
    return got;
};
const magnet = A.player('magnet', 3220, 3220);
const gotSteel = attract(magnet, 'avas_accumulator');
truthy('the accumulator attracts steel', gotSteel.some(n => n.startsWith('steel_')), gotSteel);
const gotIron = attract(magnet, 'avas_attractor');
truthy('the attractor attracts iron', gotIron.some(n => n.startsWith('iron_')), gotIron);
const gotPlate = attract(magnet, 'avas_accumulator', 'rune_platebody');
check('a rune platebody interferes', gotPlate, []);
const gotStud = attract(magnet, 'avas_accumulator', 'studded_body');
truthy('studded leather does not interfere', gotStud.length > 0, gotStud);

// =============================================================== dead clicks

console.log('\n-- dead clicks');
const npcOps: [string, number][] = [];
for (const name of ['animmag_ava', 'animmag_witch', 'animmag_undead_tree', 'animmag_sneaky_fowl', 'animmag_cowkiller', 'ahoy_ghost_farmer']) {
    const t = NpcType.get(NpcType.getId(name));
    for (let i = 0; i < 5; i++) {
        if (!t.op?.[i]) continue;
        const script = ScriptProvider.getByTrigger(ServerTriggerType.OPNPC1 + i, t.id, t.category);
        if (!script) npcOps.push([`${name} op${i + 1} (${t.op[i]})`, i + 1]);
    }
}
check('every new npc op answers something', npcOps.map(o => o[0]), []);

const objOps: string[] = [];
for (const name of ['animmag_undead_chicken', 'animmag_selected_iron', 'animmag_bar_magnet', 'animmag_undead_twigs',
    'animmag_blessed_axe', 'animmag_research_notes', 'animmag_translated_notes', 'animmag_pattern',
    'animmag_container', 'polished_buttons', 'avas_attractor', 'avas_accumulator', 'animmag_crone_amulet']) {
    const t = ObjType.get(ObjType.getId(name));
    for (let i = 0; i < 5; i++) {
        const label = t.iop?.[i];
        if (!label) continue;
        // Wear/Wield are answered by the generic [opheld2,_] when nothing more specific exists
        if (i === 1 && (label === 'Wear' || label === 'Wield')) continue;
        const script = ScriptProvider.getByTrigger(ServerTriggerType.OPHELD1 + i, t.id, t.category);
        if (!script) objOps.push(`${name} iop${i + 1} (${label})`);
    }
}
check('every new item op answers something', objOps, []);

console.log(`\n${R.ok} ok, ${R.bad} FAIL`);
process.exit(R.bad ? 1 : 0);
