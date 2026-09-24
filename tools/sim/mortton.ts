// Shades of Mort'ton, start to finish, on the real engine: the diary, Serum 207 (both ways round),
// Razmire's dose and his two shops, Loar Shadows rising into Loar Shades (attacked, and hunting),
// sinking back, the five-kill tally, Ulsquire, the temple walls, the altar, sacred oil, pyre logs and
// the pyre. Usage: npx tsx tools/sim/mortton.ts
import * as H from './harness.js';
import World from '#/engine/World.js';
import Npc from '#/engine/entity/Npc.js';
import Player from '#/engine/entity/Player.js';
import Component from '#/cache/config/Component.js';
import ObjType from '#/cache/config/ObjType.js';
import InvType from '#/cache/config/InvType.js';
import LocType from '#/cache/config/LocType.js';
import NpcType from '#/cache/config/NpcType.js';
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

// map square 54_51
const X = 3456, Z = 3264;
const at = (lx: number, lz: number) => [X + lx, Z + lz] as const;
const RAZMIRE = at(33, 32), ULSQUIRE = at(40, 25), SHELF = at(25, 15), ALTAR = at(50, 52), WALL = at(48, 52), PYRE = at(6, 18);

const S = {
    not_started: 0, read_diary: 5, made_serum: 10, kill_shades: 15, killed_1: 20, killed_2: 25, killed_5: 40,
    shades_to_razmire: 45, shades_to_ulsquire: 47, ulsquire_temple: 50, rebuild_temple: 55, can_light_altar: 60,
    created_sacred_oil: 65, created_pyre_logs: 70, logs_on_pyre: 75, complete: 80
};
const BIT = { ulsquire_visible: 1, razmire_visible: 3 };
const stage = (p: Player) => H.getVar(p, 'morttonquest');

let bucket = 1;
function player(name: string, st: number, x: number, z: number) {
    const p = H.makePlayer(name, x, z, bucket++);
    H.tick(1);
    H.maxOut(p);
    H.clearInv(p);
    H.setVar(p, 'morttonquest', st);
    return p;
}

function slotOf(p: Player, objName: string) {
    const id = ObjType.getId(objName);
    const inv = p.getInventory(InvType.INV)!;
    for (let i = 0; i < inv.capacity; i++) if (inv.get(i)?.id === id) return i;
    throw new Error('not carrying ' + objName);
}

/** Wait for whatever the player is doing, clicking through any dialogue, taking `picks` at menus. */
function settle(p: Player, picks: number[] = [], max = 200): string[] {
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

function npcNear(name: string, x: number, z: number) {
    const n = H.npcNear(name, x, z);
    if (!n) throw new Error('no ' + name + ' near ' + x + ',' + z);
    return n;
}

function talk(p: Player, npcName: string, x: number, z: number, picks: number[] = []) {
    const npc = npcNear(npcName, x, z);
    p.teleport(npc.x + 1, npc.z, 0);
    H.tick(1);
    H.opNpc(p, npc, 1);
    return settle(p, picks);
}

function useOnNpc(p: Player, objName: string, npc: Npc) {
    p.teleport(npc.x + 1, npc.z, 0);
    H.tick(1);
    p.clearPendingAction();
    p.lastUseItem = ObjType.getId(objName);
    p.lastUseSlot = slotOf(p, objName);
    p.queueWaypoints(findPathToEntity(p.level, p.x, p.z, npc.x, npc.z, p.width, npc.width, npc.length));
    p.setInteraction(Interaction.ENGINE, npc, ServerTriggerType.APNPCU);
    (p as unknown as { opcalled: boolean }).opcalled = true;
    return settle(p);
}

function locAt(x: number, z: number, locName: string) {
    return World.getLoc(x, z, 0, LocType.getId(locName));
}

function useOnLoc(p: Player, objName: string, x: number, z: number, locName: string) {
    const loc = locAt(x, z, locName);
    if (!loc) throw new Error(`no ${locName} at ${x},${z}`);
    p.clearPendingAction();
    p.lastUseItem = ObjType.getId(objName);
    p.lastUseSlot = slotOf(p, objName);
    p.queueWaypoints(findPathToLoc(p.level, p.x, p.z, loc.x, loc.z, p.width, loc.width, loc.length, loc.angle, loc.shape, LocType.get(loc.type).forceapproach));
    p.setInteraction(Interaction.ENGINE, loc, ServerTriggerType.APLOCU);
    (p as unknown as { opcalled: boolean }).opcalled = true;
    return settle(p);
}

function opLoc(p: Player, x: number, z: number, locName: string, op: number) {
    H.opLoc(p, x, z, locName, op);
    return settle(p);
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

const typeName = (n: Npc) => NpcType.get(n.type).debugname;
const mesSince = (p: Player, from: number) => H.mesgs.slice(from).filter(m => m.who === p.username).map(m => m.text);

/** Attack the nearest shadow of a kind and fight it to the death. Returns the npc and every type it was. */
function killShade(p: Player, kind = 'shadeshadow_level1'): { npc: Npc; types: Set<string>; died: boolean } {
    const npc = npcNear(kind, p.x, p.z);
    p.teleport(npc.x + 1, npc.z, 0);
    H.tick(1);
    const nid = npc.nid;
    const types = new Set<string>([typeName(npc)]);
    H.attackNpc(p, npc);
    let died = false;
    for (let t = 0; t < 400; t++) {
        H.tick(1);
        if (!npc.isActive) {
            died = true;
            break;
        }
        types.add(typeName(npc));
        // re-click if the fight stopped (another shade hunting us, a lost interaction)
        if (!p.target && !p.delayed && t % 8 === 7) H.attackNpc(p, npc);
        if (p.levels[3] < 30) p.levels[3] = 99;
    }
    void nid;
    settle(p);
    return { npc, types, died };
}

// ============================================================================================
console.log('MORT\'TON  Razmire\'s shops (the reported inv_transmit -1)');
{
    const p = player('mortshop', S.kill_shades, RAZMIRE[0] + 1, RAZMIRE[1]);
    H.setVar(p, 'morttonmulti', 1 << BIT.razmire_visible);
    const e0 = errors.length;
    const shopCom = Component.getId('shop_template');
    const opened = () => p.modalMain === shopCom;
    talk(p, 'razmire_keelgan_afflicted', ...RAZMIRE, [1]);
    check('general store opens', opened(), true);
    check('  %shop is razmiregeneralstore', H.getVar(p, 'shop'), InvType.getId('razmiregeneralstore'));
    p.closeModal();
    talk(p, 'razmire_keelgan_afflicted', ...RAZMIRE, [2]);
    check('builders\' store opens', opened(), true);
    check('  %shop is razmirebuildingstore', H.getVar(p, 'shop'), InvType.getId('razmirebuildingstore'));
    check('  no script errors', errors.slice(e0), []);
    p.closeModal();
    H.despawn(p);
}

// ============================================================================================
console.log('The diary and Serum 207');
const q = player('mortquest', S.not_started, SHELF[0] + 1, SHELF[1] + 1);
H.equip(q, { rhand: 'rune_scimitar' });
{
    const text = talk(q, 'razmire_keelgan_afflicted', ...RAZMIRE);
    check('afflicted Razmire before the quest: talks, no stage change', [text.length > 0, stage(q)], [true, S.not_started]);
    q.teleport(SHELF[0] + 1, SHELF[1] + 1, 0);
    H.tick(1);
    opLoc(q, ...SHELF, 'shades_experimentshelf', 1);
    check('shelf gives the diary, stage read_diary', [H.invCount(q, 'serum_book'), stage(q)], [1, S.read_diary]);

    H.give(q, 'tarrominvial', 3);
    H.give(q, 'ashes', 3);
    useOnHeld(q, 'ashes', 'tarrominvial');
    check('ashes on the tarromin potion: Serum 207, stage made_serum', [H.invCount(q, 'mort_serum4'), stage(q)], [1, S.made_serum]);
    useOnHeld(q, 'tarrominvial', 'ashes');
    check('tarromin potion on the ashes: a second serum', H.invCount(q, 'mort_serum4'), 2);
    useOnHeld(q, 'tarrominvial', 'serum_book');
    check('potion on the diary still works too', H.invCount(q, 'mort_serum4'), 3);

    const n = player('mortnodiary', S.not_started, SHELF[0] + 2, SHELF[1] + 2);
    H.give(n, 'tarrominvial');
    H.give(n, 'ashes');
    useOnHeld(n, 'ashes', 'tarrominvial');
    check('without the diary read: nothing made', [H.invCount(n, 'mort_serum4'), H.invCount(n, 'tarrominvial')], [0, 1]);
    H.despawn(n);
}

console.log('Razmire\'s dose');
{
    const raz = npcNear('razmire_keelgan_afflicted', ...RAZMIRE);
    useOnNpc(q, 'mort_serum4', raz);
    check('dose taken, stage kill_shades, Razmire lucid', [H.invCount(q, 'mort_serum3'), stage(q), (H.getVar(q, 'morttonmulti') >> BIT.razmire_visible) & 1], [1, S.kill_shades, 1]);
    const text = talk(q, 'razmire_keelgan_afflicted', ...RAZMIRE, [3]);
    check('he gives the job', text.some(t => /five/i.test(t)), true);
}

// ============================================================================================
console.log('Loar Shadows rise into Loar Shades');
{
    const e0 = errors.length;
    const first = killShade(q);
    check('the shadow attacked became a shade', [...first.types].sort(), ['shade_level1', 'shadeshadow_level1']);
    check('  and died', first.died, true);
    check('  tally advanced: stage killed_1', stage(q), S.killed_1);
    const remains = World.getObj(first.npc.x, first.npc.z, 0, ObjType.getId('shade_bones1'), q.hash64);
    check('  Loar remains on the ground', remains !== null && remains !== undefined, true);

    // the dead shade comes back as a shadow
    let back = false;
    for (let t = 0; t < 300 && !back; t++) {
        H.tick(1);
        back = first.npc.isActive && typeName(first.npc) === 'shadeshadow_level1';
    }
    check('  it respawns as a shadow', back, true);

    const text = talk(q, 'razmire_keelgan_afflicted', ...RAZMIRE, [3]);
    check('Razmire with one down: counts, does not move on', [text.some(t => /1 of five/.test(t)), stage(q)], [true, S.killed_1]);

    for (let i = 2; i <= 5; i++) {
        const k = killShade(q);
        check(`kill ${i}: rose, died`, [k.types.has('shade_level1'), k.died], [true, true]);
    }
    check('five down: stage killed_5_shades', stage(q), S.killed_5);
    check('  no script errors in the fighting', errors.slice(e0), []);
}

console.log('A shadow that hunts a player rises too, and sinks back when left alone');
{
    const shadow = npcNear('shadeshadow_level1', X + 30, Z + 30);
    const v = player('mortbait', S.not_started, shadow.x + 1, shadow.z);
    check('the Loar Shadow is aggressive (huntmode set)', NpcType.get(shadow.type).huntmode !== -1 && NpcType.get(shadow.type).huntrange > 0, true);
    // The hunt itself needs a client observing the npc (World: rsbuf.getNpcObservers), which a
    // socketless sim player never is - so this does what a successful hunt does: the hunt's
    // find_newmode (opplayer2) on the player it found.
    H.setNpcMode(shadow, 'OPPLAYER2', v);
    const h0 = H.hits.length;
    let rose = false;
    for (let t = 0; t < 30; t++) {
        H.tick(1);
        if (v.levels[3] < 30) v.levels[3] = 99;
        if (shadow.isActive && typeName(shadow) === 'shade_level1') rose = true;
    }
    check('hunting a player: the shadow rises on its own', rose, true);
    check('  and the shade attacks them', H.hits.slice(h0).some(h => h.who === v.username), true);
    const nid = shadow.nid;
    v.teleport(X + 3, Z + 60, 0); // well away
    H.despawn(v);
    let sank = false;
    for (let t = 0; t < 80 && !sank; t++) {
        H.tick(1);
        sank = shadow.isActive && typeName(shadow) === 'shadeshadow_level1';
    }
    check('  left alone, it sinks back into a shadow where it is', [sank, shadow.nid === nid], [true, true]);
    const hp = shadow.levels[3];
    check('  with its stats carried over (not healed to 0 or anything odd)', hp > 0 && hp <= 38, true);
}

console.log('The catacombs\' shadows rise the same way, and do not count for the quest');
{
    const c = player('mortcata', S.kill_shades, 3490, 9690);
    H.equip(c, { rhand: 'rune_scimitar' });
    const k = killShade(c, 'shadeshadow_level2');
    check('a Phrin Shadow rose into a Phrin Shade and died', [[...k.types].sort(), k.died], [['shade_level2', 'shadeshadow_level2'], true]);
    check('  Phrin remains dropped', !!World.getObj(k.npc.x, k.npc.z, 0, ObjType.getId('shade_bones2'), c.hash64), true);
    check('  the Loar tally did not move', stage(c), S.kill_shades);
    H.despawn(c);
}

// ============================================================================================
console.log('Razmire and Ulsquire');
{
    // Ulsquire dosed early must not skip the shades (a separate player at the shade stage)
    const e = player('mortearly', S.killed_2, ULSQUIRE[0] + 1, ULSQUIRE[1]);
    H.setVar(e, 'morttonmulti', (1 << BIT.razmire_visible) | (1 << BIT.ulsquire_visible));
    talk(e, 'ulsquire_shauncy_afflicted', ...ULSQUIRE);
    check('lucid Ulsquire before the shades are done: stage unchanged', stage(e), S.killed_2);
    const t2 = talk(e, 'razmire_keelgan_afflicted', ...RAZMIRE, [3]);
    check('Razmire at two down says two, not the temple', [t2.some(t => /2 of five/.test(t)), t2.some(t => /temple, then/i.test(t))], [true, false]);
    H.despawn(e);

    talk(q, 'razmire_keelgan_afflicted', ...RAZMIRE);
    check('Razmire hears about the five: stage shades_to_razmire', stage(q), S.shades_to_razmire);
    const uls = npcNear('ulsquire_shauncy_afflicted', ...ULSQUIRE);
    useOnNpc(q, 'mort_serum3', uls);
    check('Ulsquire dosed: stage shades_to_ulsquire', stage(q), S.shades_to_ulsquire);
    talk(q, 'ulsquire_shauncy_afflicted', ...ULSQUIRE);
    check('Ulsquire talks: stage ulsquire_temple', stage(q), S.ulsquire_temple);
}

// ============================================================================================
console.log('The altar comes back for a player it was lost under');
{
    const a = player('mortaltar', S.can_light_altar, WALL[0] - 1, WALL[1]);
    H.setVar(a, 'temple_repaired_p', 10);
    check('before: the broken altar', !!locAt(...ALTAR, 'templefire_altar_nofire_broken'), true);
    opLoc(a, ...WALL, 'templewall_base', 1);
    check('clicking the finished temple restores the working altar', !!locAt(...ALTAR, 'templefire_altar_nofire'), true);
    H.despawn(a);
}

console.log('The temple walls');
{
    q.teleport(WALL[0] - 1, WALL[1], 0);
    H.tick(1);
    const m0 = H.mesgs.length;
    opLoc(q, ...WALL, 'templewall_base', 1);
    check('no hammer: refused', [H.getVar(q, 'temple_repaired_p'), mesSince(q, m0).some(m => /hammer/.test(m))], [0, true]);
    H.give(q, 'hammer');
    const m1 = H.mesgs.length;
    opLoc(q, ...WALL, 'templewall_base', 1);
    check('no materials: refused', [H.getVar(q, 'temple_repaired_p'), mesSince(q, m1).some(m => /swamp paste/.test(m))], [0, true]);
    H.give(q, 'woodplank', 5);
    H.give(q, 'limestonebrick', 5);
    H.give(q, 'swamppaste', 25);
    const segs: [number, number, string][] = [];
    for (let i = 0; i < 5; i++) {
        // whichever wall segment is at the spot now (a repair changes it)
        const here = ['templewall_base', 'templewall_2', 'templewall_4', 'templewall_6', 'templewall_8'].find(n => locAt(...WALL, n));
        segs.push([...WALL, here ?? '?']);
        opLoc(q, ...WALL, here!, 1);
    }
    check('five repairs: 10 courses, materials used up', [H.getVar(q, 'temple_repaired_p'), H.invCount(q, 'woodplank'), H.invCount(q, 'limestonebrick'), H.invCount(q, 'swamppaste')], [10, 0, 0, 0]);
    check('  stage can_light_altar', stage(q), S.can_light_altar);
    check('  the wall shows the last course', !!locAt(...WALL, 'templewall_10'), true);
    check('  the working altar is there', !!locAt(...ALTAR, 'templefire_altar_nofire'), true);
}

console.log('The altar, the oil, the logs, the pyre');
{
    H.give(q, 'tinderbox');
    opLoc(q, ...ALTAR, 'templefire_altar_nofire', 1);
    check('lit', !!locAt(...ALTAR, 'templefire_altar'), true);
    H.give(q, 'oliveoil3');
    useOnLoc(q, 'oliveoil3', ...ALTAR, 'templefire_altar');
    check('olive oil blessed: sacred oil(3), stage created_sacred_oil', [H.invCount(q, 'sacred_oil3'), stage(q)], [1, S.created_sacred_oil]);

    H.give(q, 'magic_logs');
    q.setLevel(11, 70); // firemaking
    useOnHeld(q, 'sacred_oil3', 'magic_logs');
    check('magic logs at 70 Firemaking: refused', [H.invCount(q, 'magic_logs_pyre'), H.invCount(q, 'sacred_oil3')], [0, 1]);
    q.setLevel(11, 99);
    useOnHeld(q, 'sacred_oil3', 'magic_logs');
    check('magic logs want 4 doses, the vial has 3: refused', [H.invCount(q, 'magic_logs_pyre'), H.invCount(q, 'sacred_oil3')], [0, 1]);
    H.give(q, 'logs');
    useOnHeld(q, 'logs', 'sacred_oil3');
    check('logs on the oil: pyre logs, two doses used, stage created_pyre_logs', [H.invCount(q, 'logs_pyre'), H.invCount(q, 'sacred_oil1'), stage(q)], [1, 1, S.created_pyre_logs]);

    q.teleport(PYRE[0] - 2, PYRE[1], 0);
    H.tick(1);
    useOnLoc(q, 'logs_pyre', ...PYRE, 'temple_pyre');
    check('wood on the pyre', !!locAt(...PYRE, 'temple_pyre_logs'), true);
    H.give(q, 'shade_bones1');
    useOnLoc(q, 'shade_bones1', ...PYRE, 'temple_pyre_logs');
    check('remains on the pyre: stage logs_on_pyre', [!!locAt(...PYRE, 'temple_pyre_bones_logs'), stage(q)], [true, S.logs_on_pyre]);
    const e0 = errors.length;
    opLoc(q, ...PYRE, 'temple_pyre_bones_logs', 1);
    check('pyre lit: QUEST COMPLETE', stage(q), S.complete);
    check('  no script errors at the end', errors.slice(e0), []);
    const text = talk(q, 'razmire_keelgan_afflicted', ...RAZMIRE, [3]);
    check('Razmire afterwards', text.some(t => /temple is lit/.test(t)), true);
}

check('no script errors anywhere', errors, []);
console.log(`MORT'TON  ${R.ok} ok, ${R.bad} FAIL`);
process.exit(R.bad ? 1 : 0);
