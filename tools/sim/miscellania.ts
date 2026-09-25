// Throne of Miscellania and Managing Miscellania, against the real engine and the real map -
// `npx tsx tools/sim/miscellania.ts [talk|doors|quest|kingdom|losses|migrate ...]`.
//
//   talk      every Talk-to on both islands has a handler, and each islander says their line
//   doors     the throne-room doors swing open while you pass and shut behind you; the guard
//             stops you the first time and lets a Heroes' Guild member through
//   quest     the original quest: Vargas, Sigrid, Brand's anthem, Ghrim's fix, the treaty, Derrik's
//             nib, the pen; Prince Brand's three rounds, flowers, clap, cake, kiss and ring; then
//             the people won over by weeding, mining, woodcutting, fishing and flowers; the regency
//   kingdom   Ghrim's window: workers, the cooked toggle, deposit and withdraw; three days pass -
//             wages out of the coffers, resource points in, approval decays; the harvest to the bank
//   losses    killing a Miscellanian and robbing its stall cost approval; Etceteria's stall doesn't
//   migrate   a save that finished the old invented quest keeps its regency on login
import * as H from './harness.ts';
import World from '#/engine/World.js';
import Player from '#/engine/entity/Player.js';
import Npc from '#/engine/entity/Npc.js';
import NpcType from '#/cache/config/NpcType.js';
import LocType from '#/cache/config/LocType.js';
import ObjType from '#/cache/config/ObjType.js';
import InvType from '#/cache/config/InvType.js';
import Component from '#/cache/config/Component.js';
import ScriptState from '#/engine/script/ScriptState.js';
import ScriptRunner from '#/engine/script/ScriptRunner.js';
import ScriptProvider from '#/engine/script/ScriptProvider.js';
import ServerTriggerType from '#/engine/script/ServerTriggerType.js';
import { Interaction } from '#/engine/entity/Interaction.js';
import { PlayerStat } from '#/engine/entity/PlayerStat.js';

await H.boot();
H.loginOrder();

const only = process.argv.slice(2);
const want = (s: string) => only.length === 0 || only.includes(s);
let ok = 0, bad = 0;
const check = (what: string, got: unknown, wantv: unknown) => {
    const pass = JSON.stringify(got) === JSON.stringify(wantv);
    pass ? ok++ : bad++;
    console.log(`  ${pass ? 'ok  ' : 'FAIL'} ${what}: ${JSON.stringify(got)}${pass ? '' : `   (want ${JSON.stringify(wantv)})`}`);
};
const truthy = (what: string, pass: boolean, got: unknown) => {
    pass ? ok++ : bad++;
    console.log(`  ${pass ? 'ok  ' : 'FAIL'} ${what}: ${JSON.stringify(got)}`);
};

// npc overhead text ("Thanks!") - the harness only records players'
const npcSays: { tick: number; who: string; text: string }[] = [];
const origSay = (Npc.prototype as any).say;
(Npc.prototype as any).say = function (text: string) {
    npcSays.push({ tick: World.currentTick, who: NpcType.get(this.type).debugname ?? '', text });
    return origSay.call(this, text);
};

const BANK = InvType.getId('bank');
const bankCount = (p: Player, name: string) => {
    const id = ObjType.getId(name);
    const inv = p.getInventory(BANK)!;
    let n = 0;
    for (let i = 0; i < inv.capacity; i++) {
        const s = inv.get(i);
        if (s && s.id === id) n += s.count;
    }
    return n;
};
const v = (p: Player, name: string) => H.getVar(p, name);
const vb = (p: Player, name: string) => H.getVarBit(p, name);
const at = (p: Player) => [p.x, p.z, p.level];
let bucket = 400;
function player(name: string, x: number, z: number, level = 0) {
    const p = H.makePlayer(name, x, z, bucket++);
    H.tick(1);
    p.teleport(x, z, level);
    H.maxOut(p);
    H.clearInv(p);
    H.setVar(p, 'viking', 10); // The Fremennik Trials
    H.setVar(p, 'heroquest', 15); // Heroes' Quest
    H.tick(1);
    return p;
}

/** The latest text the server wrote into a component, for this player. */
function comText(p: Player, comId: number): string {
    for (let i = H.ifaces.length - 1; i >= 0; i--) {
        const f = H.ifaces[i];
        if (f.who === p.username && f.kind === 'text' && f.com === comId) return f.text ?? '';
    }
    return '';
}

type Pick = number | string | ((opts: string[]) => number);
/** Answers any menu no pick was given for - the courtship's "say the right thing". */
let autoAnswer: Pick | null = null;
/** Run a script out: continue chat pages, answer menus from `picks` (1-based index, or text the
 *  option starts with, or a function of the options), answer count dialogs from `counts`. */
function drive(p: Player, picks: Pick[] = [], counts: number[] = [], from = H.ifaces.length): string[] {
    let idle = 0;
    for (let guard = 0; guard < 800 && idle < 3; guard++) {
        const s = p.activeScript;
        if (s && s.execution === ScriptState.COUNTDIALOG) {
            const n = counts.shift();
            if (n === undefined) throw new Error('unexpected count dialog');
            s.lastInt = n;
            p.executeScript(s, true, true);
            continue;
        }
        if (!s || s.execution !== ScriptState.PAUSEBUTTON) {
            if (!s && !p.delayed) idle++;
            else idle = 0;
            H.tick(1);
            continue;
        }
        idle = 0;
        const names = p.resumeButtons.map((id: number) => Component.get(id).comName ?? '');
        const open = p.modalChat === -1 ? '' : (Component.get(p.modalChat).comName ?? '');
        if (open.startsWith('multi')) {
            const buttons = p.resumeButtons.filter((id: number) => (Component.get(id).comName ?? '').startsWith(open + ':'));
            const opts = buttons.map(id => comText(p, id));
            const pick = picks.length ? picks.shift() : autoAnswer ?? undefined;
            if (pick === undefined) throw new Error('unexpected menu: ' + opts.join(' / '));
            let idx: number;
            if (typeof pick === 'number') idx = pick - 1;
            else if (typeof pick === 'string') idx = opts.findIndex(o => o.startsWith(pick));
            else idx = pick(opts);
            if (idx < 0 || idx >= buttons.length) throw new Error(`no option ${String(pick)} in: ${opts.join(' / ')}`);
            H.choose(p, Component.get(buttons[idx]).comName!);
        } else {
            void names;
            p.executeScript(s, true, true);
        }
    }
    if (picks.length) throw new Error('menus not reached: ' + picks.map(String).join(','));
    if (p.activeScript && process.env.MISC_DEBUG) console.log('    [still running: ' + p.activeScript.script.name + ' state ' + p.activeScript.execution + ']');
    return H.ifaces.slice(from).filter(i => i.who === p.username && i.kind === 'text' && i.text && i.text.length > 1).map(i => i.text!);
}
const said = (lines: string[], s: string) => lines.some(l => l.includes(s));

function npcAt(name: string, x: number, z: number, level: number): Npc {
    const n = H.npcNear(name, x, z, level);
    if (!n) throw new Error(`no ${name} near ${x},${z},${level}`);
    return n;
}
/** Talk to an npc, standing beside it first. */
function talk(p: Player, npc: Npc, picks: Pick[] = [], counts: number[] = [], op = 1): string[] {
    const from = H.ifaces.length;
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1]]) {
        p.teleport(npc.x + dx, npc.z + dz, npc.level);
        H.tick(1);
        H.opNpc(p, npc, op);
        for (let t = 0; t < 10 && !p.activeScript; t++) H.tick(1);
        if (p.activeScript) break;
    }
    return drive(p, picks, counts, from);
}
function slotOf(p: Player, objName: string) {
    const obj = ObjType.getId(objName);
    const inv = p.getInventory(InvType.INV)!;
    for (let i = 0; i < inv.capacity; i++) if (inv.get(i)?.id === obj) return i;
    throw new Error('not carrying ' + objName);
}
/** Use an inventory item on an npc: OpNpcUHandler. */
function useOnNpc(p: Player, npc: Npc, objName: string, picks: Pick[] = []): string[] {
    const from = H.ifaces.length;
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1]]) {
        p.teleport(npc.x + dx, npc.z + dz, npc.level);
        H.tick(1);
        p.clearPendingAction();
        p.lastUseItem = ObjType.getId(objName);
        p.lastUseSlot = slotOf(p, objName);
        p.setInteraction(Interaction.ENGINE, npc, ServerTriggerType.APNPCU);
        (p as unknown as { opcalled: boolean }).opcalled = true;
        for (let t = 0; t < 10 && !p.activeScript; t++) H.tick(1);
        if (p.activeScript) break;
    }
    return drive(p, picks, [], from);
}
/** Use one inventory item on another: OpHeldUHandler's lookup. */
function useOnHeld(p: Player, useName: string, onName: string) {
    const use = ObjType.get(ObjType.getId(useName));
    const on = ObjType.get(ObjType.getId(onName));
    p.lastItem = on.id;
    p.lastSlot = slotOf(p, onName);
    p.lastUseItem = use.id;
    p.lastUseSlot = slotOf(p, useName);
    // OpHeldUHandler's order: the target's own trigger, the used item's own, then categories
    let script = ScriptProvider.getByTriggerSpecific(ServerTriggerType.OPHELDU, on.id, -1);
    if (!script) {
        script = ScriptProvider.getByTriggerSpecific(ServerTriggerType.OPHELDU, use.id, -1);
        [p.lastItem, p.lastUseItem] = [p.lastUseItem, p.lastItem];
        [p.lastSlot, p.lastUseSlot] = [p.lastUseSlot, p.lastSlot];
    }
    if (!script) throw new Error(`no opheldu for ${useName} on ${onName}`);
    p.executeScript(ScriptRunner.init(script, p), true);
    drive(p);
}
function settle(p: Player) {
    for (let t = 0; t < 20 && (p.delayed || p.activeScript); t++) H.tick(1);
}
function op(p: Player, x: number, z: number, locName: string, n = 1, picks: Pick[] = []) {
    settle(p);
    H.tick(4); // a door or stall mid-change is not there to click
    const from = H.ifaces.length, m = H.mesgs.length;
    H.opLoc(p, x, z, locName, n);
    const out = drive(p, picks, [], from);
    if (process.env.MISC_DEBUG) console.log(`    [op ${locName} from ${p.x},${p.z}: ${H.mesgs.slice(m).filter(x => x.who === p.username).map(x => x.text).join(' | ')}]`);
    return out;
}
const locAt = (name: string, level: number, x: number, z: number) => World.getLoc(x, z, level, LocType.getId(name));
const button = (p: Player, com: string, picks: Pick[] = [], counts: number[] = []) => {
    const from = H.ifaces.length;
    H.ifButton(p, 'inter_210:' + com);
    return drive(p, picks, counts, from);
};
// the kingdom window is open: ~misc_kingdom_open wrote its coffers and it is the main modal
const opened = (p: Player, from: number, _ifname: string) => {
    const coffers = Component.getId('inter_210:com_87');
    return H.ifaces.slice(from).some(i => i.who === p.username && i.kind === 'text' && i.com === coffers) && (p as any).modalMain !== -1;
};

const VARGAS = [2501, 3859, 1], GHRIM = [2499, 3857, 1], BRAND = [2502, 3852, 1], ASTRID = [2502, 3868, 1], SIGRID = [2612, 3877, 1];
const vargas = () => npcAt('misc_king_vargas', VARGAS[0], VARGAS[1], 1);
const ghrim = () => npcAt('misc_advisor_ghrim', GHRIM[0], GHRIM[1], 1);
const brand = () => npcAt('misc_prince_brand', BRAND[0], BRAND[1], 1);
const astrid = () => npcAt('misc_princess_astrid', ASTRID[0], ASTRID[1], 1);
const sigrid = () => npcAt('misc_queen_sigrid', SIGRID[0], SIGRID[1], 1);

// =============================================================================================
if (want('talk')) {
    console.log('TALK-TO ON BOTH ISLANDS');
    // Every npc placed on the two islands' map squares whose config offers Talk-to.
    const talkable = new Set<string>();
    for (const n of World.npcs) {
        if (!n || !n.isActive) continue;
        if (n.x < 2490 || n.x > 2640 || n.z < 3830 || n.z > 3910) continue;
        const t = NpcType.get(n.type);
        if ((t.op ?? [])[0]?.toLowerCase() === 'talk-to') talkable.add(t.debugname!);
    }
    const dead: string[] = [];
    for (const name of [...talkable].sort()) {
        const t = NpcType.get(NpcType.getId(name));
        const s = ScriptProvider.getByTrigger(ServerTriggerType.OPNPC1, t.id, t.category) ?? ScriptProvider.getByTrigger(ServerTriggerType.APNPC1, t.id, t.category);
        if (!s) dead.push(name);
    }
    check(`all ${talkable.size} Talk-to npcs on Miscellania and Etceteria have a handler`, dead, []);

    const p = player('misctalk', 2520, 3860);
    const lines: [string, number, number, number, string, Pick[]][] = [
        ['misc_man_1', 2518, 3859, 0, 'Good day.', []],
        ['misc_man_2', 2501, 3868, 0, 'Good day.', []],
        ['misc_man_3', 2514, 3855, 0, 'Good day.', []],
        ['misc_man_4', 2513, 3866, 0, 'Good day.', []],
        ['misc_man_5', 2512, 3871, 0, 'Good day.', []],
        ['misc_man_6', 2515, 3863, 0, 'Good day.', []],
        ['misc_man_7', 2518, 3867, 0, 'Good day.', []],
        ['misc_woman_1', 2502, 3852, 0, 'Good day.', []],
        ['misc_woman_2', 2541, 3896, 0, 'Good day.', []],
        ['misc_woman_4', 2513, 3865, 0, 'Good day.', []],
        ['misc_woman_5', 2511, 3871, 0, 'Good day.', []],
        ['misc_woman_6', 2511, 3854, 0, 'Good day.', []],
        ['misc_etc_man_1', 2615, 3899, 0, 'Can I help you?', []],
        ['misc_etc_man_2', 2604, 3881, 0, 'Can I help you?', []],
        ['misc_etc_woman_1', 2614, 3883, 0, 'Can I help you?', []],
        ['misc_etc_woman_2', 2603, 3871, 0, 'Can I help you?', []],
        ['misc_etc_woman_3', 2603, 3858, 0, 'Can I help you?', []],
        ['etc_guard1', 2605, 3877, 0, 'Good day.', []],
        ['etc_guard2', 2603, 3877, 0, 'Good day.', []],
        ['misc_fish_monger', 2518, 3866, 0, 'Get your fresh fish here!', []],
        ['misc_veg_monger', 2516, 3864, 0, 'I sell only the finest', []],
        ['etc_fish_monger', 2605, 3876, 0, 'My fish is fresher', []],
        ['etc_veg_monger', 2602, 3876, 0, "You've come to the right place", []],
        ['misc_flowergirl', 2514, 3866, 0, '15gp for three', ['No, thank you.']],
        ['misc_lumberjack', 2550, 3869, 0, 'cutting down maple trees', []],
        ['misc_miner', 2526, 3893, 0, 'mining coal', []],
        ['misc_fisherman', 2576, 3852, 0, 'You know very well', []],
        ['misc_gardener', 2525, 3850, 0, 'weeding this herb garden', ['Good luck with that.']],
        ['misc_smithy', 2551, 3897, 0, 'Can I help you with anything?', ['Nothing, thanks.']],
        ['misc_sailor', 2581, 3847, 0, 'set sail with the tide', ['Actually, no.']],
        ['misc_advisor_ghrim', GHRIM[0], GHRIM[1], 1, 'consider the position', []],
        ['misc_king_vargas', VARGAS[0], VARGAS[1], 1, 'Who seeks audience', ['No.']],
        ['misc_prince_brand', BRAND[0], BRAND[1], 1, 'Good day, sir.', []],
        ['misc_princess_astrid', ASTRID[0], ASTRID[1], 1, 'Good day, sir.', []],
        ['misc_queen_sigrid', SIGRID[0], SIGRID[1], 1, 'Have you come for a particular reason?', []],
        ['misc_ulby_doorguard', 2505, 3856, 1, 'Halt! Who goes there?', []]
    ];
    H.give(p, 'coins', 100);
    for (const [name, x, z, level, line, picks] of lines) {
        const n = npcAt(name, x, z, level);
        const f = H.ifaces.length;
        const got = talk(p, n, [...picks]);
        truthy(`${name}: "${line}"`, said(got, line), got.find(l => l.includes(line)) ?? got.slice(0, 3));
        // if_openmain_side, which the harness does not record; the shop's title is written first
        if (name.endsWith('monger')) truthy('  ...and opens the shop', H.ifaces.slice(f).some(i => i.who === p.username && i.com === Component.getId('shop_template:com_76')), '');
        p.closeModal();
    }
    const g = talk(p, npcAt('misc_ulby_doorguard', 2505, 3856, 1));
    check('the throne-room guard, after letting you in: "Welcome back, Sir."', said(g, 'Welcome back, Sir.'), true);
}

// =============================================================================================
if (want('doors')) {
    console.log('THE THRONE-ROOM DOORS');
    const p = player('miscdoors', 2506, 3855, 1);
    H.setVar(p, 'heroquest', 0);
    let got = op(p, 2506, 3857, 'misc_ulby_throneroomdoor');
    check('not a Heroes\' Guild member: the guard stops you outside', [at(p), said(got, 'If you become a member of the Heroes\' Guild')], [[2506, 3856, 1], true]);
    check('  and the door stays shut', locAt('misc_ulby_throneroomdoor', 1, 2506, 3857) !== null, true);
    H.setVar(p, 'heroquest', 15);
    settle(p);
    H.opLoc(p, 2506, 3857, 'misc_ulby_throneroomdoor', 1);
    // through the guard's dialogue, then watch the door itself
    let swung = false, shutWhileOpen = true;
    for (let t = 0; t < 40; t++) {
        const s = p.activeScript;
        if (s && s.execution === ScriptState.PAUSEBUTTON) {
            p.executeScript(s, true, true);
            continue;
        }
        H.tick(1);
        const open = locAt('misc_ulby_throneroomdoor_inactive', 1, 2506, 3856);
        if (open) {
            swung = true;
            if (locAt('misc_ulby_throneroomdoor', 1, 2506, 3857)) shutWhileOpen = false;
        }
    }
    check('a hero: "Then you may pass." and in', [at(p), vb(p, 'misc_grantedaudience')], [[2506, 3857, 1], 1]);
    check('  the door swings open onto the corridor while you pass (the inactive door, turned)', [swung, shutWhileOpen], [true, true]);
    check('  and shuts behind you', [locAt('misc_ulby_throneroomdoor', 1, 2506, 3857) !== null, locAt('misc_ulby_throneroomdoor_inactive', 1, 2506, 3856) === null], [true, true]);
    truthy('  with the door sound', H.soundsFor(p.username).some(s => s.synth === 'door_open'), H.soundsFor(p.username).map(s => s.synth).slice(-3));
    op(p, 2506, 3857, 'misc_ulby_throneroomdoor');
    check('out again, no questions', at(p), [2506, 3856, 1]);
    got = op(p, 2506, 3857, 'misc_ulby_throneroomdoor');
    check('and back in without the guard', [at(p), said(got, 'Halt!')], [[2506, 3857, 1], false]);
    p.teleport(2506, 3862, 1);
    H.tick(1);
    op(p, 2506, 3863, 'misc_ulby_throneroomdoor');
    check('the north door: out to Astrid\'s side', at(p), [2506, 3864, 1]);
    op(p, 2506, 3863, 'misc_ulby_throneroomdoor');
    check('and in', at(p), [2506, 3863, 1]);
}

// =============================================================================================
const BRAND_RIGHT = ['Be still, my heart.', 'They don\'t understand your poetry as I do.', 'You will be the greatest bard!', 'How poetic.', 'How inspiring!', 'A much nobler pursuit, to be sure.', 'That was lovely. I\'m touched!', 'I wouldn\'t presume to have the skill...', 'I\'m glad to hear it.'];
const answer = (right: string[]) => (opts: string[]) => {
    const i = opts.findIndex(o => right.includes(o));
    if (i < 0) throw new Error('no right answer in ' + opts.join(' / '));
    return i;
};

if (want('quest') || want('kingdom') || want('losses')) {
    console.log('THE QUEST');
    const p = player('miscquest', 2502, 3859, 1);
    H.setVarBit(p, 'misc_grantedaudience', 1);
    let got = talk(p, vargas(), ['Yes.', 'I want to earn Prince Brand\'s approval.']);
    check('Vargas: the quest starts, courting Prince Brand', [v(p, 'misc_quest'), vb(p, 'misc_finish_gender')], [10, 0]);
    truthy('  "I survived, barely"', said(got, 'I survived, barely'), '');
    got = talk(p, ghrim(), ['How do I make peace with Etceteria?']);
    truthy('Ghrim: go and see Queen Sigrid', said(got, 'You should go talk to Queen Sigrid of Etceteria.'), '');
    got = talk(p, sigrid());
    check('Sigrid wants Etceteria recognised', [v(p, 'misc_quest'), said(got, 'sovereign nation')], [20, true]);
    got = talk(p, vargas(), ['Never mind.']);
    check('Vargas wants the anthem changed', [v(p, 'misc_quest'), said(got, 'The title alone')], [30, true]);
    got = talk(p, sigrid());
    check('Sigrid will change it, if somebody writes one', [v(p, 'misc_quest'), said(got, 'nonny-nonny')], [40, true]);
    got = talk(p, brand());
    check('Prince Brand writes the awful anthem', [H.invCount(p, 'misc_awful_anthem'), said(got, 'So I wrote a song about it.')], [1, true]);
    got = talk(p, sigrid());
    check('Sigrid: "this simply won\'t do"', [v(p, 'misc_quest'), said(got, 'simply won\'t do')], [40, true]);
    got = talk(p, ghrim(), ['What am I meant to be doing again?']);
    check('Ghrim makes something of it', [H.invCount(p, 'misc_awful_anthem'), H.invCount(p, 'misc_good_anthem')], [0, 1]);
    got = talk(p, sigrid());
    check('Sigrid likes it and signs a treaty', [v(p, 'misc_quest'), H.invCount(p, 'misc_treaty'), H.invCount(p, 'misc_good_anthem')], [50, 1, 0]);
    got = talk(p, vargas(), ['Never mind.']);
    check('Vargas cannot hold an ordinary pen', [v(p, 'misc_quest'), said(got, 'I doubt I will be able')], [60, true]);
    H.clearInv(p);
    H.give(p, 'misc_treaty');
    got = talk(p, npcAt('misc_smithy', 2551, 3897, 0), ['I have a slightly strange request...']);
    check('Derrik wants an iron bar', [H.invCount(p, 'misc_giant_nib'), said(got, 'I\'ll need an iron bar')], [0, true]);
    H.give(p, 'iron_bar');
    talk(p, npcAt('misc_smithy', 2551, 3897, 0), ['I have a slightly strange request...']);
    check('Derrik makes the giant nib', [H.invCount(p, 'misc_giant_nib'), H.invCount(p, 'iron_bar')], [1, 0]);
    H.give(p, 'logs');
    const m0 = H.mesgs.length;
    useOnHeld(p, 'misc_giant_nib', 'logs');
    check('nib on logs: the giant pen', [H.invCount(p, 'misc_giant_pen'), H.mesgs.slice(m0).some(m => m.text.includes('crude pen'))], [1, true]);

    console.log('Prince Brand:');
    got = talk(p, brand());
    check('the first talk: "...you have to earn my approval?"', [vb(p, 'misc_court_stage'), said(got, 'Ahahahaha!')], [1, true]);
    H.give(p, 'gold_ring');
    got = useOnNpc(p, brand(), 'gold_ring');
    check('a ring too early: "I couldn\'t possibly accept this."', [said(got, 'couldn\'t possibly accept'), H.invCount(p, 'gold_ring')], [true, 1]);
    // one wrong answer on the way, which costs a little and leaves the question open
    got = talk(p, brand(), [(opts: string[]) => opts.findIndex(o => !BRAND_RIGHT.includes(o) && o !== opts[3])]);
    const afterWrong = vb(p, 'misc_affection');
    check('a wrong answer: no bit, affection floored at the round\'s start', afterWrong, 0);
    const round = (r: number) => vb(p, `misc_s${r}_d1`) + vb(p, `misc_s${r}_d2`) + vb(p, `misc_s${r}_d3`);
    for (let i = 0; i < 6 && round(1) < 3; i++) talk(p, brand(), [answer(BRAND_RIGHT)]);
    check('three right answers: round one done', [vb(p, 'misc_s1_d1'), vb(p, 'misc_s1_d2'), vb(p, 'misc_s1_d3')], [1, 1, 1]);
    H.give(p, 'flowers_waterfall_quest_mixed');
    got = useOnNpc(p, brand(), 'flowers_waterfall_quest_mixed', ['Yes']);
    check('flowers: "They\'re lovely!"', [vb(p, 'misc_s1_give'), H.invCount(p, 'flowers_waterfall_quest_mixed')], [1, 0]);
    // clapping in his room
    const n0 = H.ifaces.length;
    let ef = H.ifaces.length;
    H.ifButton(p, 'emotes:clap');
    got = drive(p, [], [], ef);
    check('the clap emote: "Thank you. It\'s nice to be appreciated."', [said(got, 'nice to be appreciated'), vb(p, 'misc_s1_emote')], [true, 1]);
    void n0;
    got = talk(p, brand());
    check('the introduction: he learns your name', [vb(p, 'misc_court_stage'), said(got, 'Very well, Prince.')], [2, true]);
    // the flowers and the clap carried affection over, so fewer answers may be needed
    autoAnswer = answer(BRAND_RIGHT);
    for (let i = 0; i < 6 && round(2) < 3 && vb(p, 'misc_court_stage') === 2; i++) talk(p, brand());
    H.give(p, 'cake');
    got = useOnNpc(p, brand(), 'cake', ['Yes']);
    check('the cake', [vb(p, 'misc_s2_give'), H.invCount(p, 'cake')], [1, 0]);
    if (vb(p, 'misc_court_stage') === 2) talk(p, brand());
    check('"I must admit I am growing quite fond of you": round three', vb(p, 'misc_court_stage'), 3);
    for (let i = 0; i < 6 && round(3) < 3; i++) talk(p, brand());
    autoAnswer = null;
    got = talk(p, brand());
    truthy('all answered: "Hello, dear"', said(got, 'Hello, dear'), got);
    check('round three answered', [vb(p, 'misc_s3_d1'), vb(p, 'misc_s3_d2'), vb(p, 'misc_s3_d3')], [1, 1, 1]);
    got = useOnNpc(p, brand(), 'gold_ring');
    check('no kiss yet: he still will not take the ring', said(got, 'couldn\'t possibly accept'), true);
    ef = H.ifaces.length;
    H.ifButton(p, 'emotes:blow_kiss');
    got = drive(p, [], [], ef);
    check('the blown kiss: "You flatter me, my dear."', [said(got, 'You flatter me, my dear.'), vb(p, 'misc_s3_emote')], [true, 1]);
    got = useOnNpc(p, brand(), 'gold_ring', ['Yes', 'Yes']);
    check('the ring, and yes: betrothed', [vb(p, 'misc_court_stage'), vb(p, 'misc_acceptedtomarry'), H.invCount(p, 'gold_ring'), said(got, 'My heart is an open book')], [4, 1, 0, true]);
    got = talk(p, brand(), ['Not yet, dear']);
    truthy('then: "Have you convinced my father yet?"', said(got, 'How are you doing, dear?'), '');

    console.log('Princess Astrid, as the other child:');
    got = talk(p, astrid());
    truthy('Astrid, not being courted: "Good day, sir."', said(got, 'Good day, sir.'), '');
    ef = H.ifaces.length;
    H.ifButton(p, 'emotes:blow_kiss');
    got = drive(p, [], [], ef);
    truthy('  a kiss for her: "Sorry, sir, but I\'m not interested."', said(got, 'but I\'m not interested'), got);

    console.log('Princess Astrid, courted (a second regent-to-be):');
    const q = player('miscastrid', 2502, 3859, 1);
    H.setVarBit(q, 'misc_grantedaudience', 1);
    talk(q, vargas(), ['Yes.', "I want to earn Princess Astrid's approval."]);
    got = talk(q, astrid());
    check('Astrid: "many have tried to impress me"', [vb(q, 'misc_finish_gender'), vb(q, 'misc_court_stage'), said(got, 'many have tried to impress me')], [1, 1, true]);
    ef = H.ifaces.length;
    H.ifButton(q, 'emotes:dance');
    got = drive(q, [], [], ef);
    check('a dance in her room: "Impressive. I like someone who knows how to dance."', [said(got, 'Impressive.'), vb(q, 'misc_s1_emote'), vb(q, 'misc_affection')], [true, 1, 5]);
    ef = H.ifaces.length;
    H.ifButton(q, 'emotes:clap');
    got = drive(q, [], [], ef);
    truthy('  a clap: "...I suggest you find my brother."', said(got, 'If you want to applaud someone, sir'), got);
    got = talk(q, vargas(), ["I want to earn Prince Brand's approval instead.", 'Yes, Your Majesty.']);
    check('Vargas lets you change your mind, and it starts again', [vb(q, 'misc_finish_gender'), vb(q, 'misc_court_stage'), vb(q, 'misc_affection'), said(got, 'taken the news rather coldly')], [0, 0, 0, true]);

    console.log('The journal:');
    let jf = H.ifaces.length;
    H.ifButton(p, 'questlist:misc');
    H.tick(1);
    let journal = H.ifaces.slice(jf).filter(i => i.who === p.username && i.kind === 'text').map(i => i.text ?? '');
    truthy('mid-quest: the treaty and the trust', journal.some(l => l.includes('Sigrid')) && journal.some(l => l.includes('Prince Brand')), journal.filter(l => l.length > 3).slice(0, 4));

    console.log('The treaty signed:');
    got = talk(p, vargas(), ['Never mind.']);
    check('Vargas signs with the giant pen; the people are next', [v(p, 'misc_quest'), vb(p, 'misc_approval'), H.invCount(p, 'misc_giant_pen'), H.invCount(p, 'misc_treaty')], [70, 32, 0, 0]);
    truthy('  "He will, your Majesty."', said(got, 'He will, your Majesty.'), '');
    got = talk(p, ghrim(), ['What am I meant to be doing again?']);
    truthy('Ghrim: "Currently, 25% of the population supports you."', said(got, 'Currently, 25% of the population supports you.'), '');

    console.log('Winning the people over:');
    p.teleport(2526, 3853, 0);
    H.tick(1);
    let m = H.mesgs.length;
    op(p, 2525, 3853, 'misc_heather_dark');
    check('weeding without a rake', H.mesgs.slice(m).some(x => x.text.includes('You need a rake')), true);
    H.give(p, 'rake');
    let a = vb(p, 'misc_approval');
    let s0 = npcSays.length;
    op(p, 2525, 3853, 'misc_heather_dark');
    check('weeding: +1 approval, a weed, the patch bare', [vb(p, 'misc_approval') - a, H.invCount(p, 'weeds'), locAt('misc_heather_dark_noweeds', 0, 2525, 3853) !== null], [1, 1, true]);
    truthy('  Gardener Gunnhild: "Thanks!"', npcSays.slice(s0).some(x => x.who === 'misc_gardener' && x.text === 'Thanks!'), npcSays.slice(s0));
    m = H.mesgs.length;
    p.teleport(2527, 3851, 0);
    op(p, 2526, 3851, 'misc_dummy_heather_normal');
    check('Gunnhild\'s own patch is hers', H.mesgs.slice(m).some(x => x.text.includes('Gardener Gunnhild is already weeding')), true);

    // coal
    H.give(p, 'rune_pickaxe');
    p.teleport(2527, 3891, 0);
    H.tick(1);
    a = vb(p, 'misc_approval');
    s0 = npcSays.length;
    const rocks: [number, number, string][] = [[2528, 3892, 'coalrock2'], [2529, 3890, 'coalrock2'], [2529, 3892, 'coalrock2'], [2528, 3895, 'coalrock2'], [2526, 3895, 'coalrock1']];
    for (const [x, z, name] of rocks) {
        if (!locAt(name, 0, x, z)) continue;
        settle(p);
        H.opLoc(p, x, z, name, 1);
        for (let t = 0; t < 60 && locAt(name, 0, x, z); t++) H.tick(1);
        if (vb(p, 'misc_approval') > a) break;
    }
    check('coal goes to Miner Magnus: approval up, none in the pack', [vb(p, 'misc_approval') > a, H.invCount(p, 'coal')], [true, 0]);
    truthy('  Magnus: "Thanks!"', npcSays.slice(s0).some(x => x.who === 'misc_miner' && x.text === 'Thanks!'), npcSays.slice(s0));
    m = H.mesgs.length;
    op(p, 2526, 3892, 'misc_dummy_coalrock1');
    check('Magnus\'s own rock is his', H.mesgs.slice(m).some(x => x.text.includes('Miner Magnus is already mining')), true);

    // maples
    H.give(p, 'rune_axe');
    p.teleport(2544, 3867, 0);
    H.tick(1);
    const wc0 = p.stats[PlayerStat.WOODCUTTING];
    settle(p);
    H.opLoc(p, 2543, 3867, 'mapletree', 1);
    for (let t = 0; t < 120 && p.stats[PlayerStat.WOODCUTTING] === wc0; t++) H.tick(1);
    for (let t = 0; t < 30; t++) H.tick(1);
    check('maples go to Lumberjack Leif: woodcutting xp, no logs in the pack', [p.stats[PlayerStat.WOODCUTTING] > wc0, H.invCount(p, 'maple_logs')], [true, 0]);
    p.clearPendingAction();
    p.teleport(2549, 3867, 0);
    m = H.mesgs.length;
    op(p, 2550, 3867, 'misc_dummy_mapletree');
    check('"Lumberjack Leif is already cutting that down."', H.mesgs.slice(m).some(x => x.text === 'Lumberjack Leif is already cutting that down.'), true);

    // fish
    H.give(p, 'harpoon');
    const spot = npcAt('0_40_60_rarefish', 2577, 3854, 0);
    p.teleport(spot.x, spot.z + 1, 0);
    H.tick(1);
    const fx0 = p.stats[PlayerStat.FISHING];
    settle(p);
    H.opNpc(p, spot, 3);
    for (let t = 0; t < 120 && p.stats[PlayerStat.FISHING] === fx0; t++) H.tick(1);
    for (let t = 0; t < 20; t++) H.tick(1);
    check('the docks\' spots fish now, and the fish go to Frodi', [p.stats[PlayerStat.FISHING] > fx0, H.invCount(p, 'raw_tuna') + H.invCount(p, 'raw_swordfish')], [true, 0]);
    p.clearPendingAction();
    settle(p);

    // flowers: +1 half the time
    H.give(p, 'coins', 1500);
    const fl = npcAt('misc_flowergirl', 2514, 3866, 0);
    a = vb(p, 'misc_approval');
    for (let i = 0; i < 20; i++) talk(p, fl, ['Yes, please.']);
    const gained = vb(p, 'misc_approval') - a;
    truthy('twenty bunches of flowers: about half of them count', gained >= 4 && gained <= 16, gained);

    console.log('The regency:');
    got = talk(p, vargas(), ['Never mind.']);
    check('short of 75%: not yet', [v(p, 'misc_quest'), said(got, 'Ghrim tells me that the population is')], [70, true]);
    H.setVarBit(p, 'misc_approval', 95);
    p.teleport(2525, 3849, 0);
    H.tick(1);
    op(p, 2525, 3849, 'misc_heather_dark');
    check('one more weed: 96 of 127, which is 75%', vb(p, 'misc_approval'), 96);
    got = talk(p, ghrim(), ['What am I meant to be doing again?']);
    truthy('Ghrim: "This is enough for you to become Regent"', said(got, 'This is enough for you to become Regent'), '');
    const coffers0 = vb(p, 'misc_coffers');
    got = talk(p, vargas());
    check('Vargas: the ceremony, quest complete, 10,000 coins in the coffers', [v(p, 'misc_quest'), vb(p, 'misc_coffers') - coffers0, said(got, 'I declare thee')], [100, 10000, true]);
    check('  one quest point', v(p, 'qp') > 0, true);
    got = talk(p, npcAt('misc_man_1', 2518, 3859, 0));
    truthy('a citizen now: "Good day, Your Royal Highness."', said(got, 'Good day, Your Royal Highness.'), '');
    jf = H.ifaces.length;
    H.ifButton(p, 'questlist:misc');
    H.tick(1);
    journal = H.ifaces.slice(jf).filter(i => i.who === p.username && i.kind === 'text').map(i => i.text ?? '');
    truthy('the journal: complete, with the approval and the coffers', journal.some(l => l.includes('QUEST COMPLETE')) && journal.some(l => l.includes('Coffers')), journal.filter(l => l.includes('Approval')));

    // ==========================================================================================
    if (want('kingdom') || only.length === 0) {
        console.log('MANAGING MISCELLANIA');
        H.setVarBit(p, 'misc_approval', 127);
        let f = H.ifaces.length;
        got = talk(p, ghrim(), ['How is the Kingdom faring?']);
        check('Ghrim: "not yet collected anything" and the kingdom window', [said(got, 'Your subjects are content, your Highness.'), said(got, 'not yet collected anything'), opened(p, f, 'inter_210')], [true, true, true]);
        check('  the coffers shown', comText(p, Component.getId('inter_210:com_87')), '10,000');
        check('  ten idle subjects', v(p, 'if1'), 10);
        for (let i = 0; i < 5; i++) button(p, 'com_46');
        for (let i = 0; i < 7; i++) button(p, 'com_11');
        check('five to wood, and mining stops at the five that are left', [vb(p, 'misc_points_wood'), vb(p, 'misc_points_mine'), v(p, 'if1')], [5, 5, 0]);
        button(p, 'com_12');
        button(p, 'com_62');
        check('one from mining to fishing', [vb(p, 'misc_points_mine'), vb(p, 'misc_points_fish'), v(p, 'if1')], [4, 1, 0]);
        button(p, 'com_63');
        button(p, 'com_11');
        check('and back', [vb(p, 'misc_points_mine'), vb(p, 'misc_points_fish')], [5, 0]);
        button(p, 'com_107');
        check('the cooked toggle', vb(p, 'misc_cooked'), 1);
        button(p, 'com_108');
        check('  and off', vb(p, 'misc_cooked'), 0);
        button(p, 'com_95');
        check('Help shows its captions', v(p, 'if2'), 1);

        H.clearInv(p);
        H.give(p, 'coins', 1000000);
        p.teleport(2500, 3858, 1);
        H.tick(1);
        got = button(p, 'com_88', [], [1000000]);
        check('deposit 1,000,000', [vb(p, 'misc_coffers'), H.invCount(p, 'coins'), said(got, 'Added 1,000,000 coins to the coffers.')], [1010000, 0, true]);
        got = button(p, 'com_89', [], [10000]);
        check('withdraw 10,000', [vb(p, 'misc_coffers'), H.invCount(p, 'coins'), said(got, 'Withdrew 10,000 coins.')], [1000000, 10000, true]);
        got = button(p, 'com_88', [], [5000000]);
        check('a deposit takes no more than is carried', [vb(p, 'misc_coffers'), H.invCount(p, 'coins')], [1010000, 0]);

        console.log('Three days pass:');
        const today = v(p, 'misc_last_update');
        H.setVar(p, 'misc_last_update', today - 3);
        // day 1: wage 50,000 (a tenth is 101,005), 600 effectiveness, 600*127/100 = 762 points,
        // approval 127 -> 124; day 2: 744 points, 124 -> 121; day 3: 726 points, 121 -> 118
        f = H.ifaces.length;
        got = talk(p, ghrim(), ['How is the Kingdom faring?', 'Yes']);
        check('coffers paid 150,000 in wages', vb(p, 'misc_coffers'), 860000);
        check('approval 127 -> 118 (92%)', [vb(p, 'misc_approval'), said(got, 'approval rating is 92%')], [118, true]);
        check('the day is today again', v(p, 'misc_last_update'), today);
        // 2232 points: 5*160*2232/2048 = 871 maple logs, 8 nests; 5*98*2232/2048 = 534 coal, 3 gems
        const nests = ['bird_nest_seeds', 'bird_nest_ring', 'bird_nest_egg_red', 'bird_nest_egg_green', 'bird_nest_egg_blue'].reduce((s, n) => s + bankCount(p, n), 0);
        const gems = ['uncut_sapphire', 'uncut_emerald', 'uncut_ruby', 'uncut_diamond'].reduce((s, n) => s + bankCount(p, n), 0);
        check('collected to the bank: 871 maple logs, 8 nests, 534 coal, 3 gems', [bankCount(p, 'maple_logs'), nests, bankCount(p, 'coal'), gems], [871, 8, 534, 3]);
        check('  the store empty again', vb(p, 'misc_restotal'), 0);
        truthy('  "Here is a list of what your subjects have collected." - and it lists them', said(got, 'Here is a list') && said(got, 'Maple logs: 871'), got.filter(l => l.includes(':')).slice(0, 4));
        truthy('  and the window again', opened(p, f, 'inter_210'), '');

        console.log('Raw and cooked fish, and herbs:');
        button(p, 'com_12'); button(p, 'com_12'); button(p, 'com_12'); button(p, 'com_12'); button(p, 'com_12');
        button(p, 'com_47'); button(p, 'com_47'); button(p, 'com_47'); button(p, 'com_47'); button(p, 'com_47');
        for (let i = 0; i < 5; i++) button(p, 'com_62');
        for (let i = 0; i < 5; i++) button(p, 'com_27');
        button(p, 'com_107');
        H.setVarBit(p, 'misc_restotal', 2048);
        talk(p, ghrim(), ['How is the Kingdom faring?', 'Yes']);
        // 5*158*2048/2048 = 790: 395 tuna, 118 swordfish; 5*11 = 55 herbs
        check('five fishing, cooked: 395 tuna, 118 swordfish', [bankCount(p, 'tuna'), bankCount(p, 'swordfish'), bankCount(p, 'raw_tuna')], [395, 118, 0]);
        const herbs = ['unidentified_tarromin', 'unidentified_harralander', 'unidentified_irit', 'unidentified_avantoe', 'unidentified_ranarr', 'unidentified_kwuarm', 'unidentified_cadantine', 'unidentified_dwarf_weed', 'unidentified_lantadyme'].reduce((s, n) => s + bankCount(p, n), 0);
        check('five on herbs: 55 grimy herbs, never guam', [herbs, bankCount(p, 'unidentified_guam')], [55, 0]);

        console.log('A long absence:');
        H.setVarBit(p, 'misc_approval', 60);
        H.setVar(p, 'misc_last_update', v(p, 'misc_last_update') - 400);
        talk(p, ghrim(), ['What am I meant to be doing again?']);
        check('four hundred days: approval rests at 25% (32), the coffers run dry', [vb(p, 'misc_approval'), vb(p, 'misc_coffers') < 100], [32, true]);
        check('  and the store stops at its 262,143 cap or below', vb(p, 'misc_restotal') <= 262143 && vb(p, 'misc_restotal') > 0, true);

        console.log('The bank has to have room:');
        const bank = p.getInventory(BANK)!;
        // the cooked fish already have slots; take them out so the harvest needs two new ones,
        // then fill every free slot with something else
        for (let i = 0; i < bank.capacity; i++) {
            const s = bank.get(i);
            if (s && ['tuna', 'swordfish'].includes(ObjType.get(s.id).debugname!)) bank.delete(i);
        }
        const held = new Set<number>();
        for (let i = 0; i < bank.capacity; i++) if (bank.get(i)) held.add(bank.get(i)!.id);
        const skip = (n: string) => ['tuna', 'swordfish', 'raw_tuna', 'raw_swordfish', 'casket', 'vikingboots', 'vikinggloves', 'keyhalf1', 'keyhalf2'].includes(n) || n.startsWith('uncut_') || n.startsWith('trail_') || n.startsWith('unidentified_') || n.endsWith('_seed');
        const fillers = [...ObjType.configNames.values()].filter(id => ObjType.get(id).certtemplate === -1 && !held.has(id) && !skip(ObjType.get(id).debugname ?? ''));
        let k = 0;
        for (let i = 0; i < bank.capacity; i++) if (!bank.get(i)) bank.set(i, { id: fillers[k++], count: 1 });
        const rest = vb(p, 'misc_restotal');
        got = talk(p, ghrim(), ['How is the Kingdom faring?', 'Yes']);
        truthy('a full bank: "you will need N more free spaces"', said(got, 'more free space'), got.filter(l => l.includes('space')));
        check('  and nothing is lost', vb(p, 'misc_restotal'), rest);
        for (let i = 0; i < bank.capacity; i++) bank.delete(i);
    }

    // ==========================================================================================
    if (want('losses') || only.length === 0) {
        console.log('LOSING APPROVAL');
        p.closeModal();
        settle(p);
        H.setVarBit(p, 'misc_approval', 100);
        const man = npcAt('misc_man_1', 2518, 3859, 0);
        p.setLevel(PlayerStat.HITPOINTS, 99);
        const hitsBefore = H.npcHits.length;
        for (let t = 0; t < 200 && man.isActive; t++) {
            // stand beside him (he wanders) and swing again until a hit lands
            if (t % 5 === 0 && (!p.target || p.target !== man)) {
                const [dx, dz] = [[1, 0], [-1, 0], [0, 1], [0, -1]][(t / 5) % 4];
                p.teleport(man.x + dx, man.z + dz, 0);
                H.tick(1);
                H.opNpc(p, man, 2);
            }
            H.tick(1);
        }
        if (process.env.MISC_DEBUG) console.log('    [hits on npcs: ' + (H.npcHits.length - hitsBefore) + ', ragnar at ' + man.x + ',' + man.z + ']');
        for (let t = 0; t < 8; t++) H.tick(1);
        check('killing Ragnar: -6 approval', [man.isActive, vb(p, 'misc_approval'), vb(p, 'misc_killed')], [false, 94, 1]);
        const got2 = talk(p, ghrim(), ['What am I meant to be doing again?']);
        truthy('  and Ghrim has heard', said(got2, 'I should tell you right away'), '');
        check('  once', vb(p, 'misc_killed'), 0);
        H.clearInv(p);
        p.teleport(2517, 3861, 0);
        H.tick(20);
        // the greengrocer is standing right there; send him away so the theft is not seen
        const grocer = npcAt('misc_veg_monger', 2516, 3864, 0);
        grocer.teleport(2540, 3880, 0);
        H.tick(1);
        op(p, 2517, 3862, 'misc_veg_market', 2);
        check('robbing Miscellania\'s veg stall: -4 approval, a vegetable', [vb(p, 'misc_approval'), ['potato', 'cabbage', 'onion', 'tomato', 'garlic'].reduce((s, n) => s + H.invCount(p, n), 0)], [90, 1]);
        const etcGrocer = npcAt('etc_veg_monger', 2602, 3876, 0);
        etcGrocer.teleport(2620, 3860, 0);
        p.teleport(2600, 3875, 0);
        H.tick(20);
        op(p, 2600, 3876, 'etc_veg_market', 2);
        check('Etceteria\'s veg stall: a vegetable, no approval lost', [vb(p, 'misc_approval'), ['potato', 'cabbage', 'onion', 'tomato', 'garlic'].reduce((s, n) => s + H.invCount(p, n), 0)], [90, 2]);
    }
}

// =============================================================================================
if (want('migrate')) {
    console.log('OLD SAVES');
    const p = H.makePlayer('miscold', 2520, 3860, bucket++);
    H.setVar(p, 'misc_quest', 7);
    H.setVarBit(p, 'misc_approval', 100);
    H.setVarBit(p, 'misc_points_wood', 4);
    H.setVarBit(p, 'misc_points_herb', 4);
    H.setVarBit(p, 'misc_points_fish', 4);
    H.setVarBit(p, 'misc_points_mine', 3);
    H.setVarBit(p, 'misc_coffers', 750000);
    H.tick(3);
    check('the old quest finished: complete, approval 100% on the 0-127 scale, trusted', [v(p, 'misc_quest'), vb(p, 'misc_approval'), vb(p, 'misc_court_stage')], [100, 127, 4]);
    check('  its fifteen workers idle (there are ten), its coffers kept', [vb(p, 'misc_points_wood') + vb(p, 'misc_points_herb') + vb(p, 'misc_points_fish') + vb(p, 'misc_points_mine'), vb(p, 'misc_coffers')], [0, 750000]);
    const q = H.makePlayer('miscold2', 2520, 3861, bucket++);
    H.setVar(q, 'misc_quest', 4);
    H.setVarBit(q, 'misc_approval', 100);
    H.tick(3);
    check('the old quest part-way: starts again', [v(q, 'misc_quest'), vb(q, 'misc_approval')], [0, 0]);
}

console.log(`\n${ok} ok, ${bad} failed`);
process.exit(bad ? 1 : 0);
