// Monkey Madness, ported from PlagueCityRS 349 - the original quest played through on the real engine.
// Usage: BUILD_SRC_DIR=<content> npx tsx tools/sim/port349_mm.ts [quest|migrate|extras]
//
//   quest    King Narnode to Daero's training: the shipyard and Caranock, the orders, the hangar and its
//            reinitialisation (Glough's price and the last slide of the puzzle), Waydar's glider, Lumdo
//            and the chapter 2 cutscene, Garkor, Zooknock's amulet (the enchanted bar smithed at the
//            wall of flame, then strung) and the monkey child's talisman, the greegree and the chapter 3
//            cutscene, Garkor's approval, the elder guard, Kruk, Awowogei's challenge, the Ardougne zoo,
//            the chapter 4 cutscene, the sigil (and Waymottin's replacement), the Jungle Demon, the
//            report and the reward, the quest point, and the training
//   migrate  saves made against this server's earlier Monkey Madness translated on login: every old
//            stage, a fresh player untouched, and a second login changing nothing
//   extras   what the port must keep: Marim's gate (a human is refused, a monkey goes through - RFD's
//            King Awowogei needs it), the temple trapdoor to the crypt and back, Zooknock carving a
//            second, different greegree, a greegree leaving your hand off the atoll, and alchemy
// Every section asserts that no script error was raised.
import * as H from './harness.js';
import World from '#/engine/World.js';
import Npc from '#/engine/entity/Npc.js';
import Player from '#/engine/entity/Player.js';
import LocType from '#/cache/config/LocType.js';
import NpcType from '#/cache/config/NpcType.js';
import ObjType from '#/cache/config/ObjType.js';
import SeqType from '#/cache/config/SeqType.js';
import InvType from '#/cache/config/InvType.js';
import Component from '#/cache/config/Component.js';
import ScriptState from '#/engine/script/ScriptState.js';
import ScriptProvider from '#/engine/script/ScriptProvider.js';
import ScriptRunner from '#/engine/script/ScriptRunner.js';
import ServerTriggerType from '#/engine/script/ServerTriggerType.js';
import { Interaction } from '#/engine/entity/Interaction.js';
import { findPathToLoc, findPathToEntity, canTravel } from '#/engine/GameMap.js';
import { CollisionType } from '#/engine/routefinder/index.js';
import { PlayerStat } from '#/engine/entity/PlayerStat.js';

// every runtime script error, from any script, anywhere
const errors: string[] = [];
const origErr = console.error;
console.error = (...a: unknown[]) => {
    const s = a.map(String).join(' ');
    if (/script error/i.test(s)) errors.push(s);
    origErr(...a);
};

await H.boot();
H.loginOrder();

const R = { ok: 0, bad: 0 };
const check = (what: string, got: unknown, want: unknown) => {
    const pass = JSON.stringify(got) === JSON.stringify(want);
    if (pass) R.ok++;
    else R.bad++;
    console.log(`  ${pass ? 'ok  ' : 'FAIL'} ${what}: ${JSON.stringify(got)}${pass ? '' : `   (want ${JSON.stringify(want)})`}`);
};

let bucket = 1;
function player(name: string, x: number, z: number, level = 0) {
    const p = H.makePlayer(name, x, z, bucket++);
    H.tick(1);
    p.teleport(x, z, level);
    H.maxOut(p);
    H.clearInv(p);
    H.tick(1);
    return p;
}
const at = (p: Player) => [p.x, p.z, p.level];
const vp = (p: Player, v: string) => H.getVar(p, v);
const vb = (p: Player, v: string) => H.getVarBit(p, v);
const heal = (p: Player) => { p.levels[PlayerStat.HITPOINTS] = 99; p.levels[PlayerStat.PRAYER] = 99; };

/** Let a script run out, clicking through chat pages and taking `picks` at menus (1-based). */
function drive(p: Player, picks: number[] = [], guardTicks = 3): string[] {
    const from = H.ifaces.length;
    let idle = 0;
    for (let guard = 0; guard < 900 && idle < guardTicks; guard++) {
        const s = p.activeScript;
        if (!s || s.execution !== ScriptState.PAUSEBUTTON) {
            if (!s && !p.delayed && [...p.queue.all()].length === 0 && !p.target) idle++;
            else idle = 0;
            heal(p);
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

function nearestNpc(name: string, x: number, z: number, level: number): Npc | null {
    const id = NpcType.getId(name);
    if (id === -1) throw new Error('no npc type ' + name);
    let best: Npc | null = null, bd = 1e9;
    for (const n of World.npcs) {
        if (!n || !n.isActive || n.type !== id || n.level !== level) continue;
        const d = Math.max(Math.abs(n.x - x), Math.abs(n.z - z));
        if (d < bd) { bd = d; best = n; }
    }
    return best;
}

/** Stand next to the npc, click it and run the dialogue. */
function talk(p: Player, npcName: string, picks: number[] = [], op = 1, move = true): string[] {
    const npc = nearestNpc(npcName, p.x, p.z, p.level);
    if (!npc) throw new Error(`no npc ${npcName} near ${at(p)}`);
    drive(p, [], 2);
    const i0 = H.ifaces.length;
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [0, 2], [2, 0]]) {
        if (move) { p.teleport(npc.x + dx, npc.z + dz, npc.level); H.tick(1); }
        H.opNpc(p, npc, op);
        for (let t = 0; t < 12 && !p.activeScript; t++) H.tick(1);
        if (p.activeScript || !move) break;
    }
    if (!p.activeScript) console.log(`    [talk ${npcName} did not start]`, at(p), [npc.x, npc.z]);
    drive(p, picks);
    return H.ifaces.slice(i0).filter(i => i.who === p.username && i.kind === 'text' && i.text && i.text.length > 1).map(i => i.text!);
}
function opLoc(p: Player, x: number, z: number, locName: string, n = 1, picks: number[] = []) {
    H.opLoc(p, x, z, locName, n);
    return drive(p, picks);
}
function slotOf(p: Player, objName: string) {
    const obj = ObjType.getId(objName);
    const inv = p.getInventory(InvType.INV)!;
    for (let i = 0; i < inv.capacity; i++) if (inv.get(i)?.id === obj) return { obj, slot: i };
    throw new Error('not carrying ' + objName);
}
function useOnLoc(p: Player, x: number, z: number, locName: string, objName: string) {
    const id = LocType.getId(locName);
    const loc = World.getLoc(x, z, p.level, id);
    if (!loc) throw new Error(`no ${locName} at ${x},${z},${p.level}`);
    const { obj, slot } = slotOf(p, objName);
    p.clearPendingAction();
    p.queueWaypoints(findPathToLoc(p.level, p.x, p.z, loc.x, loc.z, p.width, loc.width, loc.length, loc.angle, loc.shape, LocType.get(id).forceapproach));
    p.lastUseItem = obj;
    p.lastUseSlot = slot;
    p.setInteraction(Interaction.ENGINE, loc, ServerTriggerType.APLOCU);
    (p as unknown as { opcalled: boolean }).opcalled = true;
    return drive(p);
}
function useOnNpc(p: Player, npcName: string, objName: string, picks: number[] = []) {
    const npc = nearestNpc(npcName, p.x, p.z, p.level);
    if (!npc) throw new Error(`no npc ${npcName} near ${at(p)}`);
    p.teleport(npc.x + 1, npc.z, npc.level);
    H.tick(1);
    const { obj, slot } = slotOf(p, objName);
    p.clearPendingAction();
    p.queueWaypoints(findPathToEntity(p.level, p.x, p.z, npc.x, npc.z, p.width, npc.width, npc.length));
    p.lastUseItem = obj;
    p.lastUseSlot = slot;
    p.setInteraction(Interaction.ENGINE, npc, ServerTriggerType.APNPCU);
    (p as unknown as { opcalled: boolean }).opcalled = true;
    return drive(p, picks);
}
function itemOnItem(p: Player, a: string, b: string) {
    const A = slotOf(p, a), B = slotOf(p, b);
    p.lastUseItem = A.obj; p.lastUseSlot = A.slot;
    p.lastItem = B.obj; p.lastSlot = B.slot;
    const script = ScriptProvider.getByTrigger(ServerTriggerType.OPHELDU, B.obj, ObjType.get(B.obj).category)
        ?? ScriptProvider.getByTrigger(ServerTriggerType.OPHELDU, A.obj, ObjType.get(A.obj).category);
    if (!script) throw new Error(`no opheldu for ${a} on ${b}`);
    if (!ScriptProvider.getByTrigger(ServerTriggerType.OPHELDU, B.obj, ObjType.get(B.obj).category)) {
        p.lastUseItem = B.obj; p.lastUseSlot = B.slot; p.lastItem = A.obj; p.lastSlot = A.slot;
    }
    p.executeScript(ScriptRunner.init(script, p), true);
    return drive(p);
}
/** The Hold/Wear op, and the ticks it takes to settle. */
function hold(p: Player, objName: string) {
    H.opheld(p, objName, 2);
    return drive(p);
}
const worn = (p: Player, slot: number) => { const o = p.getInventory(InvType.WORN)!.get(slot); return o ? ObjType.get(o.id).debugname : null; };
const npcName = (id: number) => (id === -1 ? null : NpcType.get(id).debugname);
const qp = (p: Player) => H.runProc(p, '[proc,count_questpoints]')[0];
const journal = (p: Player) => { H.ifButton(p, 'questlist:mm'); drive(p); };
const noErrors = (what: string, from: number) => check(`${what}: no script errors`, errors.slice(from).map(e => e.split('\n')[0]), []);

/** Is (tx,tz) reachable on foot from (x,z)? A flood over the real collision map. */
function connected(level: number, x: number, z: number, tx: number, tz: number, radius = 200): boolean {
    const seen = new Set<string>([x + ',' + z]);
    const q = [[x, z]];
    while (q.length) {
        const [cx, cz] = q.pop()!;
        if (Math.abs(cx - tx) + Math.abs(cz - tz) <= 1) return true;
        for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            const nx = cx + dx, nz = cz + dz, k = nx + ',' + nz;
            if (seen.has(k) || Math.abs(nx - x) > radius || Math.abs(nz - z) > radius) continue;
            if (canTravel(level, cx, cz, dx, dz, 1, 0, CollisionType.NORMAL)) { seen.add(k); q.push([nx, nz]); }
        }
    }
    return false;
}

const want = process.argv.slice(2);
const run = (s: string) => want.length === 0 || want.includes(s);

// =============================================================================================
if (run('quest')) {
    console.log('MONKEY MADNESS (the original)');
    const e0 = errors.length;
    const p = player('mmport', 2466, 3495);
    const st = () => vp(p, 'mm_main');
    H.setVar(p, 'grandtree', 160);
    H.setVar(p, 'treequest', 9);
    H.setVar(p, 'qp', 0);
    const qp0 = qp(p);
    journal(p);

    // --- Chapter 1 ---
    talk(p, 'grandtree_narnode', [1]);
    check('King Narnode: worried, and the quest starts with the seal', [st(), vb(p, 'mm_narnode'), H.invCount(p, 'mm_gnome_royal_seal')], [1, 3, 1]);
    journal(p);
    // the shipyard: the worker at the gate wants to see the seal
    p.teleport(2943, 3041, 0);
    H.tick(1);
    opLoc(p, 2945, 3041, 'grandtree_fencegate_l');
    check('the shipyard worker sees the Royal Seal and lets you in', [st(), p.x >= 2945], [2, true]);
    talk(p, 'grandtree_foreman');
    check('  the foreman points you at Caranock', vb(p, 'mm_foreman'), 1);
    talk(p, 'mm_caranock');
    check('Caranock blames the southerly winds', vb(p, 'mm_caranock'), 3);
    p.teleport(2466, 3495, 0);
    H.tick(1);
    talk(p, 'grandtree_narnode');
    check('Narnode hears about Caranock and writes the orders', [vb(p, 'mm_narnode'), H.invCount(p, 'mm_narnode_orders')], [7, 1]);
    // Daero in the Blurberry bar: the orders, the three topics, then the blindfold
    p.teleport(2484, 3487, 1);
    H.tick(1);
    talk(p, 'mm_daero', [1, 4, 2, 4, 3, 4, 4, 1]);
    check('Daero decodes the orders and takes you blindfolded to the hangar', [vb(p, 'mm_daero'), H.invCount(p, 'mm_narnode_orders'), at(p)], [4, 0, [2393, 9892, 0]]);
    talk(p, 'mm_daero');
    check('  and introduces Waydar: reinitialisation has to be done first', vb(p, 'mm_daero'), 5);
    talk(p, 'mm_waydar', [4]);
    // Glough knows the code, for a price; the panel then needs one last slide
    H.give(p, 'coins', 200000);
    p.teleport(2478, 3464, 1);
    H.tick(1);
    talk(p, 'grandtree_glough', [1, 1]);
    check('Glough reinitialises remotely for 200,000 coins', [vb(p, 'mm_hangar_puzzle_complete'), H.invCount(p, 'coins')], [1, 0]);
    p.teleport(2484, 3487, 1);
    H.tick(1);
    talk(p, 'mm_daero', [1]);
    check('  Daero takes you back down', at(p), [2393, 9892, 0]);
    opLoc(p, 2394, 9883, 'bunker_controlpanal');
    const reinit = p.getInventory(InvType.getId('reinitialisation_inv'))!;
    let empty = -1;
    for (let i = 0; i < 25; i++) if (!reinit.get(i)) empty = i;
    check('the panel opens the puzzle one slide from solved', [p.modalMain === Component.getId('inter_214'), empty !== 24], [true, true]);
    {
        const slot = 24; // the piece the one shuffle moved out of the corner
        const obj = reinit.get(slot)!.id;
        p.lastSlot = slot;
        p.lastItem = obj;
        const script = ScriptProvider.getByTrigger(ServerTriggerType.OPHELD5, obj, ObjType.get(obj).category)!;
        p.executeScript(ScriptRunner.init(script, p), true);
        for (let i = 0; i < 40 && vb(p, 'mm_daero') !== 6; i++) { drive(p, [], 1); H.tick(1); }
    }
    check('the last slide: the gliders unfold and you are in the powered hangar', [vb(p, 'mm_daero'), at(p)], [6, [2649, 4507, 0]]);
    talk(p, 'mm_daero');
    check('Daero orders Waydar to fly you south', vb(p, 'mm_daero'), 7);
    talk(p, 'mm_waydar', [1]);
    check('Waydar flies you to Crash Island', at(p), [2893, 2725, 0]);
    talk(p, 'mm_waydar');
    check('  where the 10th squad crashed', vb(p, 'mm_waydar'), 1);
    talk(p, 'mm_lumdo');
    check('Lumdo sees the seal, tells the story and will not leave his post', vb(p, 'mm_lumdo'), 2);
    journal(p);
    talk(p, 'mm_waydar', [4]);
    check('Waydar orders him to; the chapter 2 cutscene; Lumdo rows you to the atoll', [st(), vb(p, 'mm_lumdo'), at(p)], [3, 3, [2801, 2707, 0]]);
    journal(p);

    // --- Chapter 2 ---
    const gateText = (() => { p.teleport(2720, 2765, 0); H.tick(1); const m0 = H.mesgs.length; opLoc(p, 2721, 2766, 'mm_bamboo_largedoor_left'); return [H.mesgs.slice(m0).filter(m => m.who === p.username).map(m => m.text), at(p)]; })();
    check('Marim\'s gate is too heavy for a human', [gateText[0], (gateText[1] as number[])[1] < 2766], [['The gate is too heavy to move!'], true]);
    p.teleport(2806, 2762, 0);
    H.tick(1);
    talk(p, 'mm_garkor');
    check('Sergeant Garkor wants a monkey insider: see Zooknock', vb(p, 'mm_garkor'), 2);
    p.teleport(2804, 9147, 0);
    H.tick(1);
    talk(p, 'mm_zooknock', [1, 4]);
    check('Zooknock: the story, the plan, and the two items to find', [vb(p, 'mm_zooknock'), vb(p, 'mm_zooknock_player_is_collecting_for_amulet'), vb(p, 'mm_zooknock_player_is_collecting_for_talisman')], [5, 1, 1]);
    H.give(p, 'gold_bar');
    H.give(p, 'mm_monkey_amulet_mould');
    H.give(p, 'mm_monkey_dentures');
    useOnNpc(p, 'mm_zooknock', 'gold_bar');
    useOnNpc(p, 'mm_zooknock', 'mm_monkey_dentures');
    useOnNpc(p, 'mm_zooknock', 'mm_monkey_amulet_mould');
    check('the three handed over: an enchanted gold bar and the mould back', [H.invCount(p, 'mm_enchanted_gold_bar'), H.invCount(p, 'mm_monkey_amulet_mould'), vb(p, 'mm_zooknock_player_is_collecting_for_amulet')], [1, 1, 0]);
    const fw = [0, 1, 2].map(l => [l, World.getLoc(2809, 9191, l, LocType.getId('mm_iban_firewall_straight'))]).find(([, x]) => x)!;
    p.teleport(2807, 9191, fw[0] as number);
    H.tick(1);
    useOnLoc(p, 2809, 9191, 'mm_iban_firewall_straight', 'mm_enchanted_gold_bar');
    check('smithed at the wall of flame into the amulet', [H.invCount(p, 'mm_amulet_of_monkey_speak_without_string'), H.invCount(p, 'mm_enchanted_gold_bar')], [1, 0]);
    H.give(p, 'ball_of_wool');
    itemOnItem(p, 'ball_of_wool', 'mm_amulet_of_monkey_speak_without_string');
    check('  and strung', H.invCount(p, 'mm_amulet_of_monkey_speak'), 1);
    H.equip(p, { front: 'mm_amulet_of_monkey_speak' });
    H.clearInv(p);
    // the monkey child - his aunt calls the guards on a human, so she is walked off first
    const aunt = nearestNpc('mm_monkeys_aunt', 2738, 2794, 0)!;
    const awayAunt = () => { aunt.teleport(2700, 2830, 0); };
    p.teleport(2744, 2796, 0);
    awayAunt();
    H.tick(1);
    for (const picks of [[], [4], [2]]) { awayAunt(); talk(p, 'mm_monkey_child', picks); }
    check('the child: uncle, and twenty bananas for a new toy', vb(p, 'mm_monkey_child'), 5);
    H.give(p, 'banana', 20);
    awayAunt();
    talk(p, 'mm_monkey_child');
    check('  the bananas handed over', [vb(p, 'mm_monkey_child'), H.invCount(p, 'banana')], [6, 0]);
    p.teleport(2804, 9147, 0);
    H.tick(110);
    p.teleport(2744, 2796, 0);
    awayAunt();
    H.tick(1);
    talk(p, 'mm_monkey_child');
    check('  and the toy - a monkey talisman - lent to you', [vb(p, 'mm_monkey_child'), H.invCount(p, 'mm_monkey_talisman')], [7, 1]);
    p.teleport(2804, 9147, 0);
    H.tick(1);
    H.give(p, 'mm_normal_monkey_bones');
    useOnNpc(p, 'mm_zooknock', 'mm_monkey_talisman');
    useOnNpc(p, 'mm_zooknock', 'mm_normal_monkey_bones');
    for (let i = 0; i < 60 && st() !== 4; i++) { drive(p, [], 1); H.tick(1); }
    check('Zooknock empowers the talisman; the chapter 3 cutscene; chapter 2 done', [st(), vb(p, 'mm_zooknock'), H.invCount(p, 'mm_monkey_greegree_for_normal_monkey'), at(p)[2]], [4, 6, 1, 0]);
    journal(p);

    // --- Chapter 3 ---
    hold(p, 'mm_monkey_greegree_for_normal_monkey');
    check('holding the greegree: a Karamjan monkey', [worn(p, 3), npcName(p.npcId)], ['mm_monkey_greegree_for_normal_monkey', 'mm_transmogrification_normal_monkey']);
    p.teleport(2806, 2762, 0);
    H.tick(1);
    talk(p, 'mm_garkor');
    check('Garkor approves the disguise: seek an alliance with Awowogei', vb(p, 'mm_garkor'), 4);
    p.teleport(2801, 2756, 0);
    H.tick(1);
    talk(p, 'mm_elder_guard_2', [], 1, false);
    check('the elder guard: only Kruk can let you in', vb(p, 'mm_elder_guard'), 1);
    p.teleport(2727, 2765, 0);
    H.tick(1);
    talk(p, 'mm_kruk');
    check('Kruk takes the envoy to Awowogei', [vb(p, 'mm_kruk'), at(p)], [1, [2802, 2762, 0]]);
    opLoc(p, 2802, 2765, 'mm_throne');
    check('Awowogei sets the challenge: a captive from Ardougne', vb(p, 'mm_awowogei'), 1);
    p.teleport(2601, 3273, 0);
    H.tick(1);
    talk(p, 'mm_monkey_minder');
    check('the monkey minder puts the "escaped" monkey back in the cage', [at(p)[0], at(p)[1]], [2604, 3281]);
    talk(p, 'mm_zoo_monkey');
    check('a zoo monkey jumps into your backpack', H.invCount(p, 'mm_monkey_in_backpack'), 1);
    p.teleport(2802, 2762, 0);
    H.tick(1);
    opLoc(p, 2802, 2765, 'mm_throne');
    check('Awowogei has his captive', [vb(p, 'mm_awowogei'), H.invCount(p, 'mm_monkey_in_backpack')], [2, 0]);
    p.teleport(2806, 2762, 0);
    H.tick(1);
    talk(p, 'mm_garkor');
    for (let i = 0; i < 60 && st() !== 5; i++) { drive(p, [], 1); H.tick(1); }
    check('Garkor narrates the chapter 4 cutscene: the plan is heard', [st(), vb(p, 'mm_garkor')], [5, 5]);
    p.teleport(2806, 2762, 0);
    H.tick(1);
    talk(p, 'mm_garkor');
    check('Garkor makes you one of the 10th squad: the sigil', [vb(p, 'mm_garkor'), H.invCount(p, 'mm_sigil')], [6, 1]);
    H.clearInv(p);
    p.teleport(2805, 9148, 0);
    H.tick(1);
    talk(p, 'mm_waymottin');
    check('  lost it? Waymottin already made a spare', H.invCount(p, 'mm_sigil'), 1);
    journal(p);

    // --- Chapter 4: the final battle ---
    hold(p, 'mm_sigil');
    H.equip(p, { rhand: 'rune_scimitar' });
    H.runProc(p, '[proc,update_all]', [-1]);
    p.teleport(2805, 9148, 0);
    for (let i = 0; i < 80 && p.level !== 1; i++) { heal(p); drive(p, [], 1); H.tick(1); }
    for (let i = 0; i < 60 && !nearestNpc('mm_demon', p.x, p.z, p.level); i++) { heal(p); drive(p, [], 1); H.tick(1); }
    const demon = nearestNpc('mm_demon', p.x, p.z, p.level);
    check('the sigil summons you with the 10th squad; the Jungle Demon appears', [p.level, demon !== null, nearestNpc('mm_garkor_final_battle', p.x, p.z, 1) !== null], [1, true, true]);
    for (let i = 0; i < 600 && demon && demon.isActive && st() < 6; i++) {
        if (i % 4 === 0 && p.target !== demon) H.opNpc(p, demon, 2);
        heal(p);
        H.tick(1);
    }
    drive(p);
    check('the demon falls: stage 6', st(), 6);
    talk(p, 'mm_garkor_final_battle');
    check('Garkor sends you to report', vb(p, 'mm_garkor'), 7);
    talk(p, 'mm_zooknock_final_battle');
    check('  and Zooknock teleports you back to the atoll', [p.level, Math.abs(p.x - 2712) < 9, Math.abs(p.z - 2784) < 9], [0, true, true]);

    // --- the end ---
    H.clearInv(p);
    H.give(p, 'mm_sigil');
    p.teleport(2466, 3495, 0);
    H.tick(1);
    talk(p, 'grandtree_narnode');
    for (let i = 0; i < 20 && st() < 9; i++) { drive(p, [], 1); H.tick(1); }
    check('the report, the reward and the quest', [st(), H.invCount(p, 'coins'), H.invCount(p, 'diamond')], [9, 10000, 3]);
    check('  three quest points', qp(p) - qp0, 3);
    const xp0 = [PlayerStat.ATTACK, PlayerStat.STRENGTH, PlayerStat.DEFENCE, PlayerStat.HITPOINTS].map(s => p.stats[s]);
    p.teleport(2484, 3487, 1);
    H.tick(1);
    talk(p, 'mm_daero', [1]);
    for (let i = 0; i < 40 && st() < 10; i++) { drive(p, [], 1); H.tick(1); }
    const gained = [PlayerStat.ATTACK, PlayerStat.STRENGTH, PlayerStat.DEFENCE, PlayerStat.HITPOINTS].map((s, i) => p.stats[s] - xp0[i]);
    check('Daero\'s training: Strength and Hitpoints 35k, Attack and Defence 20k', [st(), gained], [10, [200000, 350000, 200000, 350000]]);
    check('  still three quest points after it', qp(p) - qp0, 3);
    journal(p);
    noErrors('the whole quest', e0);
}

// =============================================================================================
if (run('migrate')) {
    console.log('OLD SAVES');
    const e0 = errors.length;
    type Case = { old: number; daero?: number; orders?: boolean; main: number; bits: Record<string, number> };
    const cases: Case[] = [
        { old: 1, orders: true, main: 1, bits: { mm_narnode: 3, mm_daero: 0 } },
        { old: 2, orders: true, main: 1, bits: { mm_narnode: 3, mm_daero_option_bit_one: 0 } },
        { old: 5, orders: true, main: 1, bits: { mm_narnode: 3, mm_lumdo: 0 } },
        { old: 6, main: 3, bits: { mm_narnode: 7, mm_daero: 7, mm_lumdo: 3, mm_waydar: 1, mm_hangar_puzzle_complete: 1, mm_garkor: 0, mm_zooknock: 0 } },
        { old: 7, main: 3, bits: { mm_garkor: 0, mm_zooknock: 0, mm_zooknock_has_gold_bar: 0 } },
        { old: 8, main: 3, bits: { mm_garkor: 2, mm_zooknock: 5, mm_zooknock_player_is_collecting_for_amulet: 0, mm_zooknock_player_is_collecting_for_talisman: 1, mm_zooknock_has_dentures: 1 } },
        { old: 9, main: 3, bits: { mm_monkey_child: 7, mm_monkey_child_waiting_for_talisman: 1, mm_zooknock: 5 } },
        { old: 10, main: 4, bits: { mm_zooknock: 6, mm_garkor: 2, mm_zooknock_player_is_collecting_for_talisman: 0, mm_elder_guard: 0 } },
        { old: 11, main: 4, bits: { mm_garkor: 4, mm_kruk: 1, mm_elder_guard: 1, mm_awowogei: 1 } },
        { old: 12, main: 4, bits: { mm_garkor: 4, mm_awowogei: 1 } },
        { old: 13, main: 4, bits: { mm_garkor: 4, mm_awowogei: 2 } },
        { old: 14, main: 5, bits: { mm_garkor: 6, mm_awowogei: 2, mm_waiting_for_final_battle: 0 } },
        { old: 15, main: 6, bits: { mm_garkor: 7 } },
        { old: 20, daero: 0, main: 9, bits: { mm_daero: 7, mm_garkor: 7, mm_zooknock: 6, mm_awowogei: 2, mm_hangar_puzzle_complete: 1 } },
        { old: 20, daero: 1, main: 10, bits: { mm_daero: 7, mm_narnode: 7, mm_kruk: 1 } }
    ];
    let n = 0;
    for (const c of cases) {
        const p = H.makePlayer(`mmold${n++}`, 2466, 3495, bucket++);
        H.setVar(p, 'mm_main', c.old);
        H.setVar(p, 'grandtree', 160);
        if (c.daero !== undefined) H.setVarBit(p, 'mm_daero', c.daero);
        if (c.old === 14) H.setVarBit(p, 'mm_waiting_for_final_battle', 1);
        if (c.old >= 2 && c.old < 20) { H.setVarBit(p, 'mm_daero_option_bit_one', 1); H.setVarBit(p, 'mm_daero_option_bit_two', 1); H.setVarBit(p, 'mm_daero_option_bit_three', 1); }
        if (c.old >= 8) { H.setVarBit(p, 'mm_zooknock_has_gold_bar', 1); H.setVarBit(p, 'mm_zooknock_has_amulet_mould', 1); H.setVarBit(p, 'mm_zooknock_has_dentures', 1); }
        if (c.old >= 10) H.setVarBit(p, 'mm_elder_guard', 1);
        if (c.old >= 11 && c.old < 13) H.setVarBit(p, 'mm_awowogei', 1);
        if (c.old >= 13) H.setVarBit(p, 'mm_awowogei', 2);
        if (c.orders) { H.give(p, 'mm_gnome_royal_seal'); H.give(p, 'mm_narnode_orders'); }
        H.tick(3);
        const got = Object.fromEntries(Object.keys(c.bits).map(k => [k, vb(p, k)]));
        check(`old stage ${c.old}${c.daero !== undefined ? ` (Daero paid: ${c.daero})` : ''} -> ${c.main}`, [vp(p, 'mm_main'), got, vb(p, 'port349_mm')], [c.main, c.bits, 1]);
        if (c.orders) check('    the seal kept, the orders taken back for the King to write again', [H.invCount(p, 'mm_gnome_royal_seal'), H.invCount(p, 'mm_narnode_orders')], [1, 0]);
        if (c.old === 20) {
            const q = H.runProc(p, '[proc,count_questpoints]')[0];
            H.setVar(p, 'mm_main', 0);
            const q0 = H.runProc(p, '[proc,count_questpoints]')[0];
            H.setVar(p, 'mm_main', c.main);
            check('    and it still counts three quest points', q - q0, 3);
        }
        // a second login changes nothing
        const snap = [vp(p, 'mm_main'), vp(p, 'mm_flags'), vp(p, 'mm_gnomes'), vp(p, 'mm_monkeys'), vp(p, 'mm_misc')];
        H.runProc(p, '[proc,port349_login]');
        check('    logging in again changes nothing', [vp(p, 'mm_main'), vp(p, 'mm_flags'), vp(p, 'mm_gnomes'), vp(p, 'mm_monkeys'), vp(p, 'mm_misc')], snap);
        H.despawn(p);
    }
    // someone who had never started it
    const f = H.makePlayer('mmfresh', 2466, 3495, bucket++);
    H.tick(3);
    check('a fresh player: untouched, and marked done', [vp(f, 'mm_main'), vp(f, 'mm_flags'), vp(f, 'mm_gnomes'), vp(f, 'mm_monkeys'), vp(f, 'mm_misc'), vb(f, 'port349_mm')], [0, 0, 0, 0, 0, 1]);
    // after the migration a new-numbered stage is never translated again
    H.setVar(f, 'mm_main', 3);
    H.runProc(f, '[proc,port349_login]');
    check('  a new stage 3 stays 3 at the next login', vp(f, 'mm_main'), 3);
    // a migrated old stage-10 save can carry on: Garkor judges the greegree
    const g = H.makePlayer('mmcarry', 2804, 9147, bucket++);
    H.setVar(g, 'mm_main', 10);
    H.tick(3);
    H.maxOut(g);
    H.give(g, 'mm_monkey_greegree_for_normal_monkey');
    H.equip(g, { front: 'mm_amulet_of_monkey_speak' });
    hold(g, 'mm_monkey_greegree_for_normal_monkey');
    g.teleport(2806, 2762, 0);
    H.tick(1);
    talk(g, 'mm_garkor');
    check('an old stage-10 save carries on: Garkor sends the envoy to Awowogei', [vp(g, 'mm_main'), vb(g, 'mm_garkor')], [4, 4]);
    noErrors('the migration', e0);
}

// =============================================================================================
if (run('extras')) {
    console.log('WHAT THE PORT KEEPS');
    const e0 = errors.length;
    // a finished save, as the migration leaves one (old stage 20, Daero's training taken)
    const p = H.makePlayer('mmextra', 2720, 2765, bucket++);
    H.setVar(p, 'mm_main', 20);
    H.setVarBit(p, 'mm_daero', 1);
    H.tick(3);
    H.maxOut(p);
    check('a finished save', [vp(p, 'mm_main'), vb(p, 'mm_zooknock')], [10, 6]);
    H.give(p, 'mm_monkey_greegree_for_normal_monkey');
    H.equip(p, { front: 'mm_amulet_of_monkey_speak' });
    p.teleport(2720, 2765, 0);
    H.tick(1);
    hold(p, 'mm_monkey_greegree_for_normal_monkey');
    opLoc(p, 2721, 2766, 'mm_bamboo_largedoor_left');
    check('Marim\'s gate: a monkey goes through (RFD\'s King Awowogei is inside)', p.z > 2766, true);
    opLoc(p, 2721, 2766, 'mm_bamboo_largedoor_left');
    check('  and back out', p.z < 2766, true);
    // Kruk's yard is reached over the watchtowers: the west one stands inside the walls, the planks
    // on its top floor cross to the east one, and that comes down in Kruk's yard
    const inside = connected(0, 2721, 2768, 2712, 2766);
    p.teleport(2712, 2766, 0);
    H.tick(1);
    opLoc(p, 2713, 2766, 'mm_bamboo_ladder_watchtower_west');
    const up = p.level;
    const across = connected(2, p.x, p.z, 2730, 2766);
    p.teleport(2730, 2766, 2);
    H.tick(1);
    opLoc(p, 2729, 2766, 'mm_bamboo_ladder_top_watchtower_east');
    check('Kruk is reached on foot over the watchtowers', [inside, up, across, p.level, connected(0, p.x, p.z, 2726, 2765)], [true, 2, true, 0, true]);
    // and the zoo monkeys from where the minder puts a "monkey" back in its cage
    check('the zoo cage the minder drops you in reaches the zoo monkeys', connected(0, 2604, 3281, 2605, 3280), true);
    // the temple crypt, for RFD's nut cave
    p.teleport(2806, 2785, 0);
    H.tick(1);
    opLoc(p, 2807, 2785, 'mm_temple_trapdoor');
    opLoc(p, 2807, 2785, 'mm_temple_trapdoor_open');
    check('the temple trapdoor opens, and down into the crypt', at(p), [2807, 9201, 0]);
    opLoc(p, 2808, 9201, 'mm_climbing_rope_bottom_temple');
    check('  and the rope back up', [p.level, Math.abs(p.x - 2807) <= 2, Math.abs(p.z - 2785) <= 2], [0, true, true]);
    // Zooknock carves a different head (this server's "all eight" - the ancient skull included)
    p.teleport(2804, 9147, 0);
    H.tick(1);
    talk(p, 'mm_zooknock', [2, 1]);
    check('Zooknock will make another talisman', vb(p, 'mm_zooknock_player_is_collecting_for_talisman'), 1);
    H.give(p, 'mm_monkey_talisman');
    H.give(p, 'mm_ancient_monkey_skull');
    useOnNpc(p, 'mm_zooknock', 'mm_monkey_talisman');
    useOnNpc(p, 'mm_zooknock', 'mm_ancient_monkey_skull');
    check('  the ancient monkey skull makes the ancient greegree', H.invCount(p, 'mm_monkey_greegree_for_ancient_monkey_skull'), 1);
    H.clearInv(p);
    H.give(p, 'mm_monkey_greegree_for_small_ninja_monkey');
    hold(p, 'mm_monkey_greegree_for_small_ninja_monkey');
    check('  a small ninja greegree: its own form and its own walk', [npcName(p.npcId), (p as any).walkanim], ['mm_transmogrification_small_ninja_monkey', SeqType.getId('m_monkey_walk')]);
    // off the atoll the greegree leaves your hand
    p.teleport(2465, 3495, 0);
    for (let i = 0; i < 4; i++) { drive(p, [], 1); H.tick(1); }
    check('carried off the atoll, the greegree wrenches itself away: human again', [worn(p, 3), p.npcId, H.invCount(p, 'mm_monkey_greegree_for_small_ninja_monkey')], [null, -1, 1]);
    // logging in holding one comes back a monkey
    const q = H.makePlayer('mmrelog', 2804, 9147, bucket++);
    H.setVarBit(q, 'port349_mm', 1);
    H.setVar(q, 'mm_main', 10);
    H.equip(q, { rhand: 'mm_monkey_greegree_for_normal_monkey' });
    H.tick(3);
    check('logging in on the atoll holding a greegree: still a monkey', npcName(q.npcId), 'mm_transmogrification_normal_monkey');
    // a human in Marim: a shopkeeper calls the guards, a guard knocks you out, and you wake in the jail
    const j = player('mmjail', 2759, 2781);
    H.setVar(j, 'mm_main', 3);
    H.setVarBit(j, 'port349_mm', 1);
    H.equip(j, { front: 'mm_amulet_of_monkey_speak' });
    // the guard that appears is random and so is its path to you, so give it a few goes
    for (let attempt = 0; attempt < 4 && vb(j, 'mm_jail_count') === 0; attempt++) {
        j.teleport(2759, 2777, 0);
        H.tick(1);
        talk(j, 'mm_daga');
        for (let i = 0; i < 60 && vb(j, 'mm_jail_count') === 0; i++) { heal(j); H.tick(1); }
    }
    for (let i = 0; i < 30 && j.activeScript; i++) { drive(j, [], 1); }
    check('a human in Marim is knocked out by the guards and wakes in the jail', [vb(j, 'mm_jail_count'), j.x >= 2770 && j.x <= 2777, j.z >= 2793 && j.z <= 2795], [1, true, true]);
    for (let i = 0; i < 20 && H.getVarBit(j, 'mm_player_is_unconscious') === 1; i++) H.tick(1);
    j.teleport(2771, 2794, 0);
    H.tick(1);
    for (let i = 0; i < 6 && j.z < 2795; i++) opLoc(j, 2771, 2795, 'mm_jail_door');
    check('  and picks the cell door open', j.z >= 2795, true);
    H.despawn(j);
    // alchemy refuses a greegree
    H.give(p, 'naturerune', 10);
    H.give(p, 'firerune', 50);
    const m0 = H.mesgs.length;
    H.castOnHeld(p, 'mm_monkey_greegree_for_small_ninja_monkey', 'magic:highlvl_alchemy');
    drive(p);
    check('the magic of the monkeys defies alchemy', H.mesgs.slice(m0).some(m => m.who === p.username && /defies alchemy/.test(m.text)), true);
    noErrors('the extras', e0);
}

console.log(`\n${R.ok} ok, ${R.bad} FAIL`);
process.exit(R.bad ? 1 : 0);
