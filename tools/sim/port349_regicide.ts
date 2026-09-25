// Regicide, ported from PlagueCityRS 349 (original dialogue and stage numbers), played start to finish
// on the real engine, plus the save migration from this server's old re-creation of the quest.
// Usage: BUILD_SRC_DIR=<content> npx tsx tools/sim/port349_regicide.ts
//
// The King's messenger, Lathas, Iban's temple doors into the ruined temple, Koftik, the Well of
// Voyage, Idris and the scouts, Lord Iorwerth, the tracker and the pendant, the footprints, the dense
// woodland and the guard it brings out, the camp, the Big Book o' Bangs, the chemist, coal-tar, the
// fractionalising still, brimstone, limestone from the Isafdar piles, quicklime, the loom, the bomb,
// the rabbit for the catapult guard, the catapult, Iorwerth's message, the Arandar gates, Arianwyn,
// and Lathas's reward. Then the migration, one representative old save per old stage.
import * as H from './harness.js';
import World from '#/engine/World.js';
import Npc from '#/engine/entity/Npc.js';
import Player from '#/engine/entity/Player.js';
import Component from '#/cache/config/Component.js';
import ObjType from '#/cache/config/ObjType.js';
import InvType from '#/cache/config/InvType.js';
import LocType from '#/cache/config/LocType.js';
import CategoryType from '#/cache/config/CategoryType.js';
import ScriptState from '#/engine/script/ScriptState.js';
import ScriptProvider from '#/engine/script/ScriptProvider.js';
import ScriptRunner from '#/engine/script/ScriptRunner.js';
import ServerTriggerType from '#/engine/script/ServerTriggerType.js';
import { Interaction } from '#/engine/entity/Interaction.js';
import { findPathToEntity, findPathToLoc } from '#/engine/GameMap.js';

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

// 349 stages
const S = {
    not_started: 0, received_message: 1, spoken_lathas: 2, spoken_scouts: 3, spoken_iorwerth: 4, spoken_tracker: 5,
    shown_pendant: 6, found_footprints: 7, spoken_tracker2: 8, defeated_guard: 9, entered_camp: 10, spoken_iorwerth2: 11,
    killed_tyras: 12, reported_iorwerth: 13, spoken_arianwyn: 14, complete: 15
};
const BIT = { koftik_food: 0, down_well: 1, seen_guard: 2, given_rabbit: 3, chemist_chat: 5 };
const stage = (p: Player) => H.getVar(p, 'regicide_quest');
const bits = (p: Player) => H.getVar(p, 'regicide_bits');
const bit = (p: Player, b: number) => (bits(p) >> b) & 1;
const at = (p: Player) => [p.x, p.z, p.level];
const mesSince = (p: Player, from: number) => H.mesgs.slice(from).filter(m => m.who === p.username).map(m => m.text);

let bucket = 1;
function player(name: string, x: number, z: number, level = 0) {
    const p = H.makePlayer(name, x, z, bucket++);
    H.tick(1);
    p.teleport(x, z, level);
    H.maxOut(p);
    H.clearInv(p);
    H.setVar(p, 'biohazard', 16);
    H.setVar(p, 'upass', 10);
    H.tick(1);
    return p;
}

function slotOf(p: Player, objName: string) {
    const id = ObjType.getId(objName);
    const inv = p.getInventory(InvType.INV)!;
    for (let i = 0; i < inv.capacity; i++) if (inv.get(i)?.id === id) return i;
    throw new Error('not carrying ' + objName);
}

/** Wait for whatever the player is doing, clicking through any dialogue, taking `picks` at menus. */
function settle(p: Player, picks: number[] = [], max = 300): string[] {
    const from = H.ifaces.length;
    let idle = 0;
    for (let guard = 0; guard < max; guard++) {
        const s = p.activeScript;
        if (s && s.execution === ScriptState.PAUSEBUTTON) {
            idle = 0;
            const names = p.resumeButtons.map((id: number) => Component.get(id).comName ?? '');
            const open = p.modalChat === -1 ? '' : Component.get(p.modalChat).comName ?? '';
            const multi = open.startsWith('multi') ? names.find((n: string) => n.startsWith(open + ':')) : null;
            if (multi) {
                const pick = picks.shift();
                if (pick === undefined) throw new Error('unexpected menu: ' + names.join(','));
                H.choose(p, `${multi.split(':')[0]}:com_${pick}`);
            } else {
                p.executeScript(s, true, true);
            }
            continue;
        }
        H.tick(1);
        if (!p.activeScript && !p.target && !p.delayed && p.queue.head() === null) {
            if (++idle >= 3) break;
        } else idle = 0;
    }
    if (picks.length) throw new Error('menus not reached: ' + picks.join(','));
    return H.ifaces.slice(from).filter(i => i.who === p.username && i.kind === 'text' && i.text && i.text.length > 1).map(i => i.text!);
}

function npcNear(name: string, x: number, z: number, level = 0) {
    const n = H.npcNear(name, x, z, level);
    if (!n) throw new Error('no ' + name + ' near ' + x + ',' + z);
    return n;
}

/** Talk to the nearest npc of a type, standing next to it first. */
function talk(p: Player, npcName: string, picks: number[] = [], op = 1): string[] {
    const npc = npcNear(npcName, p.x, p.z, p.level);
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [2, 0], [0, 2]]) {
        p.teleport(npc.x + dx, npc.z + dz, npc.level);
        H.tick(1);
        H.opNpc(p, npc, op);
        for (let t = 0; t < 10 && !p.activeScript; t++) H.tick(1);
        if (p.activeScript) break;
    }
    return settle(p, picks);
}

function useOnNpc(p: Player, objName: string, npc: Npc) {
    p.teleport(npc.x + 1, npc.z, npc.level);
    H.tick(1);
    p.clearPendingAction();
    p.lastUseItem = ObjType.getId(objName);
    p.lastUseSlot = slotOf(p, objName);
    p.queueWaypoints(findPathToEntity(p.level, p.x, p.z, npc.x, npc.z, p.width, npc.width, npc.length));
    p.setInteraction(Interaction.ENGINE, npc, ServerTriggerType.APNPCU);
    (p as unknown as { opcalled: boolean }).opcalled = true;
    return settle(p);
}

function locAt(x: number, z: number, level: number, locName: string) {
    return World.getLoc(x, z, level, LocType.getId(locName));
}

function useOnLoc(p: Player, objName: string, x: number, z: number, locName: string, max = 300) {
    const loc = locAt(x, z, p.level, locName);
    if (!loc) throw new Error(`no ${locName} at ${x},${z}`);
    p.clearPendingAction();
    p.lastUseItem = ObjType.getId(objName);
    p.lastUseSlot = slotOf(p, objName);
    p.queueWaypoints(findPathToLoc(p.level, p.x, p.z, loc.x, loc.z, p.width, loc.width, loc.length, loc.angle, loc.shape, LocType.get(loc.type).forceapproach));
    p.setInteraction(Interaction.ENGINE, loc, ServerTriggerType.APLOCU);
    (p as unknown as { opcalled: boolean }).opcalled = true;
    return settle(p, [], max);
}

function opLoc(p: Player, x: number, z: number, locName: string, op = 1, picks: number[] = []) {
    H.opLoc(p, x, z, locName, op);
    return settle(p, picks);
}

/** OpHeldUHandler's lookup: [opheldu,target], else [opheldu,used] with the two swapped. */
function useOnHeld(p: Player, used: string, target: string) {
    p.lastItem = ObjType.getId(target);
    p.lastSlot = slotOf(p, target);
    p.lastUseItem = ObjType.getId(used);
    p.lastUseSlot = slotOf(p, used);
    let script = ScriptProvider.getByTriggerSpecific(ServerTriggerType.OPHELDU, p.lastItem, -1);
    if (!script) {
        script = ScriptProvider.getByTriggerSpecific(ServerTriggerType.OPHELDU, p.lastUseItem, -1);
        [p.lastItem, p.lastUseItem] = [p.lastUseItem, p.lastItem];
        [p.lastSlot, p.lastUseSlot] = [p.lastUseSlot, p.lastSlot];
    }
    if (!script) throw new Error(`no opheldu for ${used} on ${target}`);
    p.executeScript(ScriptRunner.init(script, p), true);
    return settle(p);
}

/** Skilling can roll a random event, which walks off with the player if ignored - not what this measures. */
function noRandomEvent(p: Player) {
    Object.defineProperty(p, 'afkEventReady', { get: () => false, set: () => {}, configurable: true });
}

function journal(p: Player): string {
    const i0 = H.ifaces.length;
    H.ifButton(p, 'questlist:regicide');
    settle(p);
    return H.ifaces.slice(i0).filter(i => i.who === p.username && i.kind === 'text').map(i => i.text).join('|');
}

function timerOf(p: Player, name: string) {
    const s = ScriptProvider.getByName(name);
    if (!s) throw new Error('no script ' + name);
    return p.timers.get(s.id);
}

function kill(p: Player, npc: Npc, max = 600): boolean {
    p.teleport(npc.x + 1, npc.z, npc.level);
    H.tick(1);
    H.attackNpc(p, npc);
    for (let t = 0; t < max; t++) {
        H.tick(1);
        if (!npc.isActive) return true;
        if (!p.target && !p.delayed && t % 6 === 5) H.attackNpc(p, npc);
        if (p.levels[3] < 40) p.levels[3] = 99;
    }
    return false;
}

const e0 = errors.length;

// ============================================================================================
console.log('REGICIDE  the messenger and King Lathas');
const p = player('regicide', 2580, 3294, 1);
noRandomEvent(p);
check('fresh: stage 0, not in the journal yet', [stage(p), journal(p).includes('send word')], [0, true]);
talk(p, 'kinglathas');
const tm = timerOf(p, '[timer,spawn_kings_messenger]');
check('Lathas, Underground Pass done: word will be sent - the messenger\'s timer is running', [stage(p), !!tm], [0, true]);
// wait for him out in the open (Ardougne market), where he can walk up to you
p.teleport(2662, 3306, 0);
H.tick(1);
if (tm) tm.interval = 1;
for (let t = 0; t < 10 && !H.npcNear('regicide_kings_messenger', p.x, p.z, p.level); t++) H.tick(1);
if (tm) tm.interval = 1000;
check('  one messenger comes', !!H.npcNear('regicide_kings_messenger', p.x, p.z, p.level), true);
for (let t = 0; t < 20 && H.invCount(p, 'regicide_quest_kings_summons') === 0; t++) settle(p, [], 2);
if (H.invCount(p, 'regicide_quest_kings_summons') === 0 && H.npcNear('regicide_kings_messenger', p.x, p.z, p.level)) {
    // he could not path to you: you can talk to him yourself, and he still delivers it
    console.log('  (the messenger did not reach the player; talking to him)');
    talk(p, 'regicide_kings_messenger');
}
settle(p);
check('the King\'s messenger finds you: stage received_message, the summons in hand', [stage(p), H.invCount(p, 'regicide_quest_kings_summons')], [S.received_message, 1]);
H.opheld(p, 'regicide_quest_kings_summons', 1);
settle(p);
check('the summons reads on the quest scroll', p.modalMain === Component.getId('inter_109'), true);
p.closeModal();
p.teleport(2580, 3294, 1);
H.tick(1);
talk(p, 'kinglathas');
check('Lathas explains: stage spoken_lathas', stage(p), S.spoken_lathas);
check('journal: the Well of Voyage', journal(p).includes('Well of Voyage'), true);

// ============================================================================================
console.log('REGICIDE  Iban\'s temple doors, Koftik and the Well of Voyage');
p.teleport(2144, 4647, 1);
H.tick(1);
opLoc(p, 2143, 4647, 'upass_templedoor_closed_left');
check('the temple doors open onto the ruined temple (m31_73)', [Math.abs(p.x - 2014) <= 1, Math.abs(p.z - 4711) <= 1, p.level], [true, true, 1]);
{
    const text = talk(p, 'caveguide6');
    check('Koftik: bread and stew, once', [H.invCount(p, 'bread'), H.invCount(p, 'stew'), bit(p, BIT.koftik_food)], [2, 1, 1]);
    check('  and he mentions the well', text.some(t => /reparations/.test(t)), true);
    talk(p, 'caveguide6');
    check('  not twice', [H.invCount(p, 'bread'), H.invCount(p, 'stew')], [2, 1]);
}
opLoc(p, 2008, 4711, 'regicide_voyage_temple_well1');
check('into the well: the temple under Isafdar, down_well bit', [at(p), bit(p, BIT.down_well)], [[2343, 9622, 0], 1]);
opLoc(p, 2341, 9622, 'regicide_voyage_temple_well2');
check('the temple\'s well goes back up to the ruined temple', at(p), [2010, 4712, 1]);
opLoc(p, 2015, 4712, 'upass_templedoor_closed_right');
check('the ruined temple\'s doors lead back out into the real pass', at(p), [2145, 4648, 1]);
{
    // and the real temple's own doors, walked out of from inside, stay where they are
    const q = player('regicide_realtemple', 2138, 4648, 1);
    H.setVar(q, 'regicide_quest', S.spoken_lathas);
    const m0 = H.mesgs.length;
    opLoc(q, 2143, 4648, 'upass_templedoor_closed_right');
    check('  (the real temple\'s doors from inside: just out, no stray teleport)', [at(q), mesSince(q, m0).some(m => /Invalid/.test(m))], [[2145, 4648, 1], false]);
    H.despawn(q);
}
p.teleport(2343, 9622, 0);
H.tick(1);
opLoc(p, 2312, 9623, 'regicide_voyage_temple_exit');
check('out of the cave into Isafdar', at(p), [2312, 3216, 0]);
// A sim player is not a NetworkPlayer, which is what fires [mapzone]/[zone] triggers on movement.
p.triggerMapzone(p.x, p.z);
H.tick(1);

// ============================================================================================
console.log('REGICIDE  Idris');
{
    check('the scouts\' timer starts in the woods', !!timerOf(p, '[timer,spawn_idris]'), true);
    let got = false;
    for (let t = 0; t < 60 && !got; t++) {
        H.tick(1);
        if (p.activeScript) got = true;
    }
    const text = settle(p, [], 400);
    check('Idris and the two scouts: stage spoken_scouts', stage(p), S.spoken_scouts);
    check('  "You should speak with Lord Iorwerth"', text.some(t => /Lord Iorwerth/.test(t)), true);
    H.tick(20);
}

// ============================================================================================
console.log('REGICIDE  Lord Iorwerth and the tracker');
p.teleport(2206, 3252, 0);
H.tick(1);
talk(p, 'lord_iorwerth');
check('Iorwerth: stage spoken_iorwerth', stage(p), S.spoken_iorwerth);
p.teleport(2258, 3149, 0);
H.tick(1);
talk(p, 'regicide_old_camp_tracker');
check('the tracker wants proof: stage spoken_tracker', stage(p), S.spoken_tracker);
p.teleport(2206, 3252, 0);
H.tick(1);
talk(p, 'lord_iorwerth');
check('Iorwerth hands over his crystal pendant', H.invCount(p, 'regicide_crystal_pendant'), 1);
check('journal: the pendant', journal(p).includes('pendant'), true);
p.teleport(2258, 3149, 0);
H.tick(1);
talk(p, 'regicide_old_camp_tracker');
check('the pendant shown: stage shown_pendant', stage(p), S.shown_pendant);
p.teleport(2241, 3151, 0);
H.tick(1);
{
    const m0 = H.mesgs.length;
    opLoc(p, 2240, 3150, 'regicide_old_camp_footprints');
    check('the footprints: stage found_footprints', [stage(p), mesSince(p, m0).some(m => /impassable/.test(m))], [S.found_footprints, true]);
}
talk(p, 'regicide_old_camp_tracker');
check('the tracker on the tracks: stage spoken_tracker2', stage(p), S.spoken_tracker2);

// ============================================================================================
console.log('REGICIDE  the dense woodland and the guard');
p.teleport(2234, 3149, 0);
H.tick(1);
opLoc(p, 2232, 3148, 'regicide_cross_over1');
check('through the undergrowth, west', at(p), [2231, 3149, 0]);
{
    const guard = H.npcNear('regicide_old_camp_guard', p.x, p.z, 0);
    check('a Tyras guard steps out: seen_guard bit', [guard !== null, bit(p, BIT.seen_guard)], [true, 1]);
    if (guard) {
        H.equip(p, { rhand: 'dragon_scimitar' });
        const died = kill(p, guard);
        settle(p);
        check('killed: stage defeated_guard', [died, stage(p)], [true, S.defeated_guard]);
    }
}
{
    // low Agility cannot squeeze through
    const q = player('regicide_lowag', 2189, 3170);
    H.setVar(q, 'regicide_quest', S.defeated_guard);
    q.setLevel(16, 40);
    const m0 = H.mesgs.length;
    opLoc(q, 2187, 3169, 'regicide_cross_over2_tyras_camp');
    check('56 Agility needed for the woodland', [at(q), mesSince(q, m0).some(m => /56 agility/i.test(m))], [[2189, 3170, 0], true]);
    H.despawn(q);
}
p.teleport(2189, 3170, 0);
H.tick(1);
opLoc(p, 2187, 3169, 'regicide_cross_over2_tyras_camp');
check('into Tyras Camp, south through the thicket: stage entered_camp', [at(p), stage(p)], [[2188, 3168, 0], S.entered_camp]);
{
    const text = talk(p, 'regicide_general_hining');
    check('General Hining: "The king will see no one"', text.some(t => /The king will see no one/.test(t)), true);
    p.teleport(2186, 3143, 0);
    H.tick(1);
    const t2 = opLoc(p, 2186, 3144, 'regicide_tent_door');
    check('the tent guard: the king\'s quarters', t2.some(t => /king's quarters/.test(t)), true);
}

// ============================================================================================
console.log('REGICIDE  the Big Book o\' Bangs and the chemist');
p.teleport(2206, 3252, 0);
H.tick(1);
talk(p, 'lord_iorwerth');
check('Iorwerth: stage spoken_iorwerth2, the book', [stage(p), H.invCount(p, 'regicide_alchemy')], [S.spoken_iorwerth2, 1]);
p.teleport(2939, 3208, 0);
H.tick(1);
{
    const text = talk(p, 'chemist', [1, 2, 3, 4]);
    check('the chemist reads the book (chemist_chat bit), and explains all three', [bit(p, BIT.chemist_chat), text.some(t => /distil tar/.test(t)), text.some(t => /limestone/.test(t)), text.some(t => /yellow powdery/.test(t))], [1, true, true, true]);
    check('journal: naphtha, quicklime and brimstone', journal(p).includes('Naphta, Quicklime and Brimstone'), true);
}

// ============================================================================================
console.log('REGICIDE  coal-tar and the fractionalising still');
H.give(p, 'regicide_barrel_empty');
p.teleport(2263, 3128, 0);
H.tick(1);
useOnLoc(p, 'regicide_barrel_empty', 2263, 3127, 'regicide_tar_collection');
check('a barrel of coal-tar', [H.invCount(p, 'regicide_barrel_tar'), H.invCount(p, 'regicide_barrel_empty')], [1, 0]);
p.teleport(2928, 3212, 0);
H.tick(1);
H.give(p, 'coal', 200);
useOnLoc(p, 'regicide_barrel_tar', 2927, 3212, 'regicide_fractionalizing_still', 5);
check('tar into the still: the still window, the empty barrel back', [p.modalMain === Component.getId('regicide_still'), H.invCount(p, 'regicide_barrel_tar'), H.invCount(p, 'regicide_barrel_empty')], [true, 0, 1]);
{
    // tar regulator to full flow (+2 pressure a step), pressure valve to the middle (-2 a step)
    H.ifButton(p, 'regicide_still:com_132');
    H.ifButton(p, 'regicide_still:com_132');
    H.ifButton(p, 'regicide_still:com_130');
    const set = () => H.getVar(p, 'regicide_still_settings');
    check('valves: tar regulator full (bit 31), pressure valve mid (bit 27)', [(set() >>> 31) & 1, (set() >> 27) & 1], [1, 1]);
    let peak = 0;
    for (let t = 0; t < 400 && H.getVar(p, 'regicide_still_total') < 26 && p.modalMain !== -1; t++) {
        // the heat needle is one bit of 13..25; the green zone is 19..24
        let needle = 13;
        for (let b = 13; b <= 25; b++) if ((set() >> b) & 1) needle = b;
        if (needle < 21 && H.getVar(p, 'temp') < 60) H.ifButton(p, 'regicide_still:com_120');
        H.tick(1);
        peak = Math.max(peak, H.getVar(p, 'regicide_still_total'));
    }
    check('kept in the green: the still fills to 26', peak >= 26, true);
    p.closeModal();
    H.tick(1);
    check('closing it draws off a barrel of naphtha', [H.invCount(p, 'regicide_barrel_naphtha'), H.invCount(p, 'regicide_barrel_empty')], [1, 0]);
}

console.log('REGICIDE  brimstone, limestone and quicklime');
H.give(p, 'pestle_and_mortar');
p.teleport(2258, 3127, 0);
H.tick(1);
opLoc(p, 2258, 3128, 'regicide_sulphar1');
opLoc(p, 2258, 3128, 'regicide_sulphar1');
check('two lumps of brimstone', H.invCount(p, 'regicide_sulphar'), 2);
useOnHeld(p, 'pestle_and_mortar', 'regicide_sulphar');
check('pestle on the brimstone: ground', H.invCount(p, 'regicide_sulphar_dust'), 1);
useOnHeld(p, 'regicide_sulphar', 'pestle_and_mortar');
check('brimstone on the pestle: ground too (the other click order)', [H.invCount(p, 'regicide_sulphar_dust'), H.invCount(p, 'regicide_sulphar')], [2, 0]);
H.give(p, 'rune_pickaxe');
p.teleport(2323, 3268, 0);
H.tick(1);
noRandomEvent(p);
opLoc(p, 2322, 3268, 'loc_4027');
check('limestone mined from the Isafdar piles', H.invCount(p, 'limestone') >= 1, true);
{
    const q = player('regicide_lime', 2194, 3146);
    H.give(q, 'limestone');
    useOnLoc(q, 'limestone', 2193, 3146, 'regicide_furnace');
    check('limestone in a furnace before the book: refused', [H.invCount(q, 'limestone'), H.invCount(q, 'regicide_quicklime')], [1, 0]);
    H.despawn(q);
}
p.teleport(2194, 3146, 0);
H.tick(1);
{
    const hp = p.levels[3];
    noRandomEvent(p);
    useOnLoc(p, 'limestone', 2193, 3146, 'regicide_furnace');
    check('quicklime out of the camp furnace, and bare hands burnt', [H.invCount(p, 'regicide_quicklime'), p.levels[3] < hp], [1, true]);
}
H.give(p, 'pot_empty');
useOnHeld(p, 'regicide_quicklime', 'pestle_and_mortar');
check('quicklime ground into a pot (clicked onto the pestle)', [H.invCount(p, 'regicide_quicklime_dust'), H.invCount(p, 'pot_empty')], [1, 0]);
useOnHeld(p, 'regicide_quicklime_dust', 'regicide_barrel_naphtha');
check('quicklime into the naphtha', H.invCount(p, 'regicide_barrel_naphtha_quicklime_mix'), 1);
useOnHeld(p, 'regicide_sulphar_dust', 'regicide_barrel_naphtha_quicklime_mix');
check('and the brimstone: a sealed barrel bomb', H.invCount(p, 'regicide_barrel_lid'), 1);
// make room: keep only the bomb for the weaving and the fuse
H.clearInv(p);
H.give(p, 'regicide_barrel_lid');
{
    H.give(p, 'ball_of_wool');
    const m0 = H.mesgs.length;
    useOnHeld(p, 'ball_of_wool', 'regicide_barrel_lid');
    check('a ball of wool is too thin for a fuse', mesSince(p, m0).some(m => /too thin/.test(m)), true);
    H.give(p, 'ball_of_wool', 7);
}
p.teleport(2199, 3249, 0);
H.tick(1);
useOnLoc(p, 'ball_of_wool', 2198, 3249, 'regicide_loom');
check('four balls of wool woven into cloth on the loom', [H.invCount(p, 'regicide_cloth'), H.invCount(p, 'ball_of_wool')], [1, 4]);
opLoc(p, 2198, 3249, 'regicide_loom', 2);
check('  and the loom\'s own Weave does the same (ours)', [H.invCount(p, 'regicide_cloth'), H.invCount(p, 'ball_of_wool')], [2, 0]);
useOnHeld(p, 'regicide_cloth', 'regicide_barrel_lid');
check('the cloth fuse: a fused barrel bomb', [H.invCount(p, 'regicide_barrel_lid_fused'), H.invCount(p, 'regicide_barrel_lid')], [1, 0]);
check('journal: the bomb is made', journal(p).includes('The bomb was quite hard to make'), true);

// ============================================================================================
console.log('REGICIDE  the rabbit and the catapult');
{
    const rabbit = npcNear('regicide_rabbit', 2298, 3177);
    const died = kill(p, rabbit, 100);
    settle(p);
    const drop = World.getObj(rabbit.x, rabbit.z, rabbit.level, ObjType.getId('raw_rabbit'), p.hash64);
    check('an Isafdar rabbit dies in a hit or two and drops a raw rabbit', [died, !!drop], [true, true]);
    // cook it on the nearest fire or range the map has
    H.give(p, 'raw_rabbit', 3);
    const fire = CategoryType.getId('cooking_fire');
    const oven = CategoryType.getId('cooking_oven');
    let cooker: { x: number; z: number; name: string } | null = null;
    for (let r = 0; r < 60 && !cooker; r++) for (let x = 2939 - r; x <= 2939 + r && !cooker; x++) for (let z = 3208 - r; z <= 3208 + r && !cooker; z++) {
        for (const loc of World.gameMap.getZone(x, z, 0).getAllLocsUnsafe()) {
            if (loc.x !== x || loc.z !== z) continue;
            const t = LocType.get(loc.type);
            if (t.category === fire || t.category === oven) cooker = { x, z, name: t.debugname! };
        }
    }
    if (cooker) {
        p.teleport(cooker.x + 1, cooker.z, 0);
        H.tick(1);
        for (let i = 0; i < 3 && H.invCount(p, 'cooked_rabbit') === 0; i++) {
            noRandomEvent(p);
            useOnLoc(p, 'raw_rabbit', cooker.x, cooker.z, cooker.name);
        }
    }
    check(`raw rabbit cooks (${cooker?.name})`, H.invCount(p, 'cooked_rabbit') >= 1, true);
}
{
    const guard = npcNear('regicide_tyras_lazy_guard', 2179, 3184);
    const text = talk(p, 'regicide_tyras_lazy_guard');
    check('the catapult guard dreams of rabbit', text.some(t => /rabbits/.test(t)), true);
    p.teleport(2185, 3185, 0);
    H.tick(1);
    const m0 = H.mesgs.length;
    useOnLoc(p, 'regicide_barrel_lid_fused', 2185, 3183, 'regicide_catapult');
    check('the catapult with him watching: "Oi!", nothing fired', [stage(p), H.invCount(p, 'regicide_barrel_lid_fused')], [S.spoken_iorwerth2, 1]);
    void m0;
    const g2 = npcNear('regicide_tyras_lazy_guard', guard.x, guard.z);
    useOnNpc(p, 'cooked_rabbit', g2);
    check('a cooked rabbit for the guard: given_rabbit bit', bit(p, BIT.given_rabbit), 1);
}
p.teleport(2185, 3185, 0);
H.tick(1);
let tentFire = false;
{
    const loc = World.getLoc(2185, 3183, 0, LocType.getId('regicide_catapult'))!;
    p.clearPendingAction();
    p.lastUseItem = ObjType.getId('regicide_barrel_lid_fused');
    p.lastUseSlot = slotOf(p, 'regicide_barrel_lid_fused');
    p.queueWaypoints(findPathToLoc(p.level, p.x, p.z, loc.x, loc.z, p.width, loc.width, loc.length, loc.angle, loc.shape, LocType.get(loc.type).forceapproach));
    p.setInteraction(Interaction.ENGINE, loc, ServerTriggerType.APLOCU);
    (p as unknown as { opcalled: boolean }).opcalled = true;
    for (let t = 0; t < 60; t++) {
        H.tick(1);
        if (locAt(36 * 64 + 13, 71 * 64 + 6, 0, 'regicide_tent_human_fire')) tentFire = true;
    }
    settle(p);
}
check('the catapult: stage killed_tyras, the bomb gone, you back at the catapult', [stage(p), H.invCount(p, 'regicide_barrel_lid_fused'), at(p)], [S.killed_tyras, 0, [2183, 3185, 0]]);
check('  the tent in the cutscene camp caught fire', tentFire, true);
{
    const m0 = H.mesgs.length;
    H.give(p, 'regicide_barrel_lid_fused');
    useOnLoc(p, 'regicide_barrel_lid_fused', 2185, 3183, 'regicide_catapult');
    check('the catapult afterwards: "done enough damage"', mesSince(p, m0).some(m => /enough damage/.test(m)), true);
    H.clearInv(p);
}

// ============================================================================================
console.log('REGICIDE  Iorwerth\'s message, the Arandar pass and Arianwyn');
p.teleport(2258, 3149, 0);
H.tick(1);
{
    const text = talk(p, 'regicide_old_camp_tracker');
    check('the tracker heard the explosion', text.some(t => /explosion/.test(t)), true);
}
{
    const q = player('regicide_gate', 2384, 3336);
    H.setVar(q, 'regicide_quest', S.killed_tyras);
    const text = opLoc(q, 2384, 3334, 'overpass_gate_left');
    check('the Arandar gates into Tirannwn before Iorwerth writes: shut, the guard says why', [q.z > 3334, text.some(t => /documentation/.test(t))], [true, true]);
    H.despawn(q);
}
p.teleport(2206, 3252, 0);
H.tick(1);
talk(p, 'lord_iorwerth');
check('Iorwerth: stage reported_iorwerth, the message', [stage(p), H.invCount(p, 'regicide_iorwerth_message')], [S.reported_iorwerth, 1]);
{
    const m0 = H.mesgs.length;
    H.opheld(p, 'regicide_iorwerth_message', 1);
    settle(p);
    check('the seal is unbreakable', mesSince(p, m0).some(m => /unbreakable/.test(m)), true);
}
p.teleport(2384, 3332, 0);
H.tick(1);
opLoc(p, 2384, 3334, 'overpass_gate_left');
check('the Arandar gates out of Tirannwn', p.z > 3334, true);
opLoc(p, 2384, 3334, 'overpass_gate_left');
check('  and, with Iorwerth\'s word, back in', p.z < 3334, true);
p.teleport(2586, 3292, 0);
H.tick(1);
p.teleport(2587, 3299, 0);
p.triggerZone(0, 2587, 3299);
{
    let started = false;
    for (let t = 0; t < 30 && !started; t++) {
        H.tick(1);
        if (p.activeScript || p.queue.head() !== null) started = true;
    }
    // the opened message is a main window with no continue button: the player reads it and closes it
    const i0 = H.ifaces.length;
    let sawScroll = false;
    for (let t = 0; t < 12 && stage(p) !== S.spoken_arianwyn; t++) {
        settle(p, [], 40);
        if (p.modalMain === Component.getId('inter_109')) {
            sawScroll = true;
            p.closeModal();
        }
    }
    settle(p);
    const text = H.ifaces.slice(i0).filter(i => i.who === p.username && i.kind === 'text' && i.text).map(i => i.text!);
    check('Arianwyn intercepts you outside the castle: stage spoken_arianwyn', [stage(p), sawScroll], [S.spoken_arianwyn, true]);
    check('  and the message is opened: "Warmaster Iorwerth"', text.some(t => /Warmaster Iorwerth/.test(t)), true);
}
H.opheld(p, 'regicide_iorwerth_message', 1);
settle(p);
check('the letter now reads', p.modalMain === Component.getId('inter_109'), true);
p.closeModal();

// ============================================================================================
console.log('REGICIDE  the reward');
p.teleport(2580, 3294, 1);
H.tick(2);
{
    const qp0 = H.runProc(p, '[proc,count_questpoints]')[0];
    const xp0 = p.stats[16];
    const coins0 = H.invCount(p, 'coins');
    talk(p, 'kinglathas');
    H.tick(3);
    settle(p);
    check('Lathas takes the letter: QUEST COMPLETE', [stage(p), H.invCount(p, 'regicide_iorwerth_message')], [S.complete, 0]);
    check('  3 quest points, 15,000 coins, 13,750 Agility xp', [H.getVar(p, 'qp') - qp0, H.invCount(p, 'coins') - coins0, p.stats[16] - xp0], [3, 15000, 137500]);
    check('journal: QUEST COMPLETE', journal(p).includes('QUEST COMPLETE'), true);
    talk(p, 'kinglathas');
    check('  talking again pays nothing more', [H.getVar(p, 'qp') - qp0, H.invCount(p, 'coins') - coins0], [3, 15000]);
}
{
    p.teleport(2196, 3139, 0);
    H.tick(1);
    const k = npcNear('regicidegeneralshopkeeper', 2195, 3139);
    H.opNpc(p, k, 3);
    settle(p);
    check('the Quartermaster\'s Trade: the stores with dragon halberds', [p.modalMain === Component.getId('shop_template'), H.getVar(p, 'shop')], [true, InvType.getId('regicide_general_shop_2')]);
    p.closeModal();
}
{
    p.teleport(2590, 3336, 0);
    H.tick(1);
    const text = talk(p, 'elena2');
    check('Elena afterwards', text.some(t => /It's been a long time/.test(t)), true);
}
check('no script errors playing it through', errors.slice(e0), []);

// ============================================================================================
console.log('REGICIDE  the Isafdar traps and logs');
{
    const e1 = errors.length;
    const q = player('regicide_traps', 2215, 3155);
    const tries: [string, number, number, number, number][] = [
        ['regicide_trap_tripwire', 2215, 3154, 2215, 3155],
        ['regicide_trap_woodspring', 2235, 3181, 2235, 3180],
        ['regicide_pitfall_side', 2267, 3202, 2267, 3201],
        ['regicide_trap_hand_holds', 2313, 9656, 2313, 9656]
    ];
    for (const [name, x, z, sx, sz] of tries) {
        q.teleport(sx, sz, 0);
        H.tick(1);
        const before = at(q);
        const m0 = H.mesgs.length;
        opLoc(q, x, z, name);
        q.levels[3] = 99;
        // (a failed roll on the stick trap just walks you into it, with no message)
        check(`${name}: crossed, or fell, somewhere else`, JSON.stringify(at(q)) !== JSON.stringify(before), true);
        void m0;
    }
    for (const [name, x, z, sx, sz] of [['regicide_logbalance1_start', 2197, 3237, 2196, 3237], ['regicide_logbalance3_start', 2290, 3233, 2290, 3232]] as [string, number, number, number, number][]) {
        q.teleport(sx, sz, 0);
        H.tick(1);
        const before = at(q);
        opLoc(q, x, z, name);
        check(`${name}: across the log`, JSON.stringify(at(q)) !== JSON.stringify(before), true);
    }
    // the leaf pit's own zone trap, walked onto
    q.teleport(2209, 3203, 0);
    q.triggerZone(0, 2209, 3203);
    settle(q);
    check('no script errors on the traps', errors.slice(e1), []);
    H.despawn(q);
}

// ============================================================================================
console.log('REGICIDE  a full inventory at the reward');
{
    const q = player('regicide_full', 2580, 3294, 1);
    H.setVar(q, 'regicide_quest', S.spoken_arianwyn);
    H.give(q, 'regicide_iorwerth_message');
    H.fillInv(q);
    talk(q, 'kinglathas');
    H.tick(3);
    settle(q);
    const pile = World.getObj(q.x, q.z, q.level, ObjType.getId('coins'), q.hash64);
    check('complete; the message frees the slot the coins go into', [stage(q), H.invCount(q, 'coins') + (pile ? 15000 : 0)], [S.complete, 15000]);
    H.despawn(q);
}

// ============================================================================================
console.log('REGICIDE  save migration from the old version');
function migrant(name: string, oldStage: number, oldBits: number, prep?: (q: Player) => void) {
    const q = H.makePlayer(name, 3222, 3218, bucket++);
    H.setVar(q, 'regicide_quest', oldStage);
    H.setVar(q, 'regicide_bits', oldBits);
    H.setVarBit(q, 'port349_regicide', 0);
    prep?.(q);
    H.tick(2);
    return q;
}
const cases: [number, number, number, number][] = [
    // old stage, old bits, new stage, new bits
    [0, 0, 0, 0],
    [1, 0, S.spoken_lathas, 0],
    [2, 0, S.spoken_scouts, 1 << BIT.down_well],
    [3, 0, S.spoken_iorwerth, 1 << BIT.down_well],
    [4, 0, S.shown_pendant, 1 << BIT.down_well],
    [5, 0, S.entered_camp, (1 << BIT.down_well) | (1 << BIT.seen_guard)],
    [6, 0, S.entered_camp, (1 << BIT.down_well) | (1 << BIT.seen_guard)],
    [7, 0, S.spoken_iorwerth2, (1 << BIT.down_well) | (1 << BIT.seen_guard)],
    [7, 1, S.spoken_iorwerth2, (1 << BIT.down_well) | (1 << BIT.seen_guard) | (1 << BIT.given_rabbit)],
    [8, 0, S.killed_tyras, (1 << BIT.down_well) | (1 << BIT.seen_guard)],
    [9, 0, S.reported_iorwerth, (1 << BIT.down_well) | (1 << BIT.seen_guard)],
    [10, 0, S.spoken_arianwyn, (1 << BIT.down_well) | (1 << BIT.seen_guard)],
    [15, 0, S.complete, (1 << BIT.down_well) | (1 << BIT.seen_guard)]
];
let n = 0;
for (const [os, ob, ns, nb] of cases) {
    const q = migrant('regmig' + n++, os, ob);
    check(`old ${os} (bits ${ob}) -> ${ns} (bits ${nb}), flagged`, [stage(q), bits(q), H.getVarBit(q, 'port349_regicide')], [ns, nb, 1]);
    if (os === 15) {
        check('  a finished quest still counts its 3 quest points', H.getVar(q, 'qp') >= 3, true);
        const qp = H.getVar(q, 'qp');
        H.runProc(q, '[proc,port349_login]');
        H.tick(1);
        check('  logging in again changes nothing', [stage(q), bits(q), H.getVar(q, 'qp')], [ns, nb, qp]);
    }
    H.despawn(q);
}
{
    const q = migrant('regmigbomb', 7, 3);
    check('old 7 with the bomb already in the catapult: the fused barrel comes back', [stage(q), H.invCount(q, 'regicide_barrel_lid_fused'), bit(q, BIT.given_rabbit)], [S.spoken_iorwerth2, 1, 1]);
    H.runProc(q, '[proc,port349_login]');
    H.tick(1);
    check('  twice: still one barrel, same stage and bits', [stage(q), H.invCount(q, 'regicide_barrel_lid_fused'), bits(q)], [S.spoken_iorwerth2, 1, (1 << BIT.down_well) | (1 << BIT.seen_guard) | (1 << BIT.given_rabbit)]);
    H.despawn(q);
}
{
    const q = migrant('regmigfull', 7, 2, qq => H.fillInv(qq));
    const bank = q.getInventory(InvType.getId('bank'))!;
    let inBank = 0;
    for (let i = 0; i < bank.capacity; i++) if (bank.get(i)?.id === ObjType.getId('regicide_barrel_lid_fused')) inBank += bank.get(i)!.count;
    check('  with a full pack it goes to the bank', inBank, 1);
    H.despawn(q);
}
{
    const q = migrant('regmignew', 0, 0);
    H.setVar(q, 'regicide_quest', S.found_footprints);
    H.runProc(q, '[proc,port349_login]');
    H.tick(1);
    check('a player already on the ported quest is never re-migrated', stage(q), S.found_footprints);
    H.despawn(q);
}

check('no script errors anywhere', errors, []);
console.log(`REGICIDE  ${R.ok} ok, ${R.bad} FAIL`);
process.exit(R.bad ? 1 : 0);
