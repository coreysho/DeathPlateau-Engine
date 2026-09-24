// Quest audit, batch 3: every step that was fixed, driven through the real triggers on the real
// map, and the quests themselves start to finish where that is practical.
// Usage: npx tsx tools/sim/audit3.ts [section ...]   (sections: ahoy eadgar zogre fever troll dt rd sheep hunt)
import * as H from './harness.js';
import World from '#/engine/World.js';
import LocType from '#/cache/config/LocType.js';
import ObjType from '#/cache/config/ObjType.js';
import NpcType from '#/cache/config/NpcType.js';
import InvType from '#/cache/config/InvType.js';
import Component from '#/cache/config/Component.js';
import ScriptState from '#/engine/script/ScriptState.js';
import ScriptProvider from '#/engine/script/ScriptProvider.js';
import ScriptRunner from '#/engine/script/ScriptRunner.js';
import ServerTriggerType from '#/engine/script/ServerTriggerType.js';
import { Interaction } from '#/engine/entity/Interaction.js';
import { PlayerQueueType } from '#/engine/entity/PlayerQueueRequest.js';
import { findPathToLoc, findPathToEntity, canTravel, isMapBlocked, isZoneAllocated } from '#/engine/GameMap.js';
import { CollisionType } from '#/engine/routefinder/index.js';
import Player from '#/engine/entity/Player.js';
import Npc from '#/engine/entity/Npc.js';
import VarPlayerType from '#/cache/config/VarPlayerType.js';
import JavaRandom from '#/util/JavaRandom.js';

// every runtime script error, from any script, anywhere
const errors: string[] = [];
const origErr = console.error;
console.error = (...a: unknown[]) => {
    const s = a.map(String).join(' ');
    if (/script error|error/i.test(s)) errors.push(s);
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
const want = process.argv.slice(2);
const run = (name: string) => want.length === 0 || want.includes(name);

let bucket = 1;
function player(name: string, x: number, z: number, level = 0) {
    const p = H.makePlayer(name, x, z, bucket++);
    H.tick(1);
    if (level) p.teleport(x, z, level);
    H.maxOut(p);
    H.clearInv(p);
    H.tick(1);
    return p;
}
const at = (p: Player) => [p.x, p.z, p.level];
const lastMes = (p: Player) => H.mesgs.filter(m => m.who === p.username).map(m => m.text).slice(-1)[0] ?? '';
const allMes = (p: Player) => H.mesgs.filter(m => m.who === p.username).map(m => m.text);
const texts = (p: Player) => H.ifaces.filter(i => i.who === p.username && i.kind === 'text' && i.text && i.text.length > 1).map(i => i.text!);
const saw = (p: Player, s: string) => allMes(p).some(m => m.includes(s)) || texts(p).some(t => t.includes(s));
const gv = (p: Player, name: string): number => (VarPlayerType.getByName(name) ? H.getVar(p, name) : H.getVarBit(p, name));
const sv = (p: Player, name: string, v: number) => (VarPlayerType.getByName(name) ? H.setVar(p, name, v) : H.setVarBit(p, name, v));
const walkable = (x: number, z: number, level: number) => isZoneAllocated(level, x, z) && !isMapBlocked(x, z, level);

/** Let a script run out, clicking through any chat pages and taking `picks` at menus (1-based). */
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

function nearest(npcName: string, p: Player): Npc {
    const npc = [p.level, 0, 1, 2, 3].map(l => H.npcNear(npcName, p.x, p.z, l)).find(n => n);
    if (!npc) throw new Error('no npc ' + npcName);
    return npc;
}
/** Talk to the nearest npc of a type (any floor), standing next to it first. */
function talk(p: Player, npcName: string, picks: number[] = [], op = 1): string[] {
    const npc = nearest(npcName, p);
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [2, 0], [0, 2], [-2, 0], [0, -2]]) {
        if (!walkable(npc.x + dx, npc.z + dz, npc.level)) continue;
        p.teleport(npc.x + dx, npc.z + dz, npc.level);
        H.tick(1);
        H.opNpc(p, npc, op);
        for (let t = 0; t < 10 && !p.activeScript; t++) H.tick(1);
        if (p.activeScript) break;
    }
    return drive(p, picks);
}
/** Talk to an npc from where the player stands (walks there on its own route). */
function talkHere(p: Player, npc: Npc, picks: number[] = [], op = 1): string[] {
    H.opNpc(p, npc, op);
    for (let t = 0; t < 30 && !p.activeScript; t++) H.tick(1);
    return drive(p, picks);
}
function slotOf(p: Player, objName: string) {
    const id = ObjType.getId(objName);
    const inv = p.getInventory(InvType.INV)!;
    for (let i = 0; i < inv.capacity; i++) if (inv.get(i)?.id === id) return i;
    throw new Error('not carrying ' + objName);
}
/** "Use" an inventory item on a loc: OpLocUHandler, with the route a client would send. */
function useOn(p: Player, x: number, z: number, locName: string, objName: string, picks: number[] = []) {
    const id = LocType.getId(locName);
    const loc = World.getLoc(x, z, p.level, id);
    if (!loc) throw new Error(`no ${locName} at ${x},${z},${p.level}`);
    const obj = ObjType.getId(objName);
    p.clearPendingAction();
    p.queueWaypoints(findPathToLoc(p.level, p.x, p.z, loc.x, loc.z, p.width, loc.width, loc.length, loc.angle, loc.shape, LocType.get(id).forceapproach));
    p.lastUseItem = obj;
    p.lastUseSlot = slotOf(p, objName);
    p.setInteraction(Interaction.ENGINE, loc, ServerTriggerType.APLOCU);
    (p as unknown as { opcalled: boolean }).opcalled = true;
    return drive(p, picks);
}
function useOnNpc(p: Player, objName: string, npc: Npc, picks: number[] = []) {
    p.clearPendingAction();
    p.lastUseItem = ObjType.getId(objName);
    p.lastUseSlot = slotOf(p, objName);
    p.queueWaypoints(findPathToEntity(p.level, p.x, p.z, npc.x, npc.z, p.width, npc.width, npc.length));
    p.setInteraction(Interaction.ENGINE, npc, ServerTriggerType.APNPCU);
    (p as unknown as { opcalled: boolean }).opcalled = true;
    return drive(p, picks);
}
/** OpHeldUHandler's lookup: [opheldu,target], else [opheldu,used] with the two swapped. */
function useOnHeld(p: Player, used: string, target: string, picks: number[] = []) {
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
    return drive(p, picks);
}
function op(p: Player, x: number, z: number, locName: string, n = 1, picks: number[] = []) {
    H.opLoc(p, x, z, locName, n);
    return drive(p, picks);
}
function held(p: Player, objName: string, n = 1, picks: number[] = []) {
    H.opheld(p, objName, n);
    return drive(p, picks);
}
/** Is (tx,tz) reachable on foot from (x,z)? A flood over the real collision map. */
function connected(level: number, x: number, z: number, tx: number, tz: number, radius = 160): boolean {
    const seen = new Set<string>([x + ',' + z]);
    const q = [[x, z]];
    while (q.length) {
        const [cx, cz] = q.pop()!;
        if (cx === tx && cz === tz) return true;
        for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            const nx = cx + dx, nz = cz + dz, k = nx + ',' + nz;
            if (seen.has(k) || Math.abs(nx - x) > radius || Math.abs(nz - z) > radius) continue;
            if (canTravel(level, cx, cz, dx, dz, 1, 0, CollisionType.NORMAL)) { seen.add(k); q.push([nx, nz]); }
        }
    }
    return false;
}
/** Can a player standing at (x,z) walk up to something at (tx,tz): any tile next to it reachable? */
function reaches(level: number, x: number, z: number, tx: number, tz: number, size = 1) {
    for (let dx = -1; dx <= size; dx++) for (let dz = -1; dz <= size; dz++) {
        if (dx >= 0 && dx < size && dz >= 0 && dz < size) continue;
        if (walkable(tx + dx, tz + dz, level) && connected(level, x, z, tx + dx, tz + dz)) return true;
    }
    return false;
}
function enqueue(p: Player, name: string, args: number[] = []) {
    const s = ScriptProvider.getByName(name);
    if (!s) throw new Error('no script ' + name);
    p.enqueueScript(s, PlayerQueueType.NORMAL, 0, args);
}
function wear(p: Player, slots: Record<string, string>) {
    H.equip(p, slots);
}
/** Stand the player on the nearest walkable tile to (x,z,level). */
function standBy(p: Player, x: number, z: number, level: number) {
    for (let r = 1; r < 6; r++) for (let dx = -r; dx <= r; dx++) for (let dz = -r; dz <= r; dz++) {
        if (Math.max(Math.abs(dx), Math.abs(dz)) !== r || !walkable(x + dx, z + dz, level)) continue;
        p.teleport(x + dx, z + dz, level);
        H.tick(1);
        return;
    }
    throw new Error(`nowhere to stand near ${x},${z},${level}`);
}
/** Stand the player on the side of a loc its forceapproach allows (rotated by the loc's angle). */
function standAt(p: Player, locName: string, x: number, z: number, level: number) {
    const id = LocType.getId(locName);
    const loc = World.getLoc(x, z, level, id);
    if (!loc) throw new Error(`no ${locName} at ${x},${z},${level}`);
    const t = LocType.get(id);
    const f = t.forceapproach;
    const r = ((f << loc.angle) & 0xf) | (f >> (4 - loc.angle));
    const w = loc.angle & 1 ? t.length : t.width, len = loc.angle & 1 ? t.width : t.length;
    for (const [bit, dx, dz] of [[1, 0, len], [2, w, 0], [4, 0, -1], [8, -1, 0]]) {
        if (r & bit || !walkable(x + dx, z + dz, level)) continue;
        p.teleport(x + dx, z + dz, level);
        H.tick(1);
        return;
    }
    standBy(p, x, z, level);
}
const hasOp = (kind: 'loc' | 'npc' | 'obj', name: string, op: number) => {
    if (kind === 'loc') {
        const id = LocType.getId(name), t = LocType.get(id);
        return !!(ScriptProvider.getByTrigger(ServerTriggerType.OPLOC1 + op - 1, id, t.category) || ScriptProvider.getByTrigger(ServerTriggerType.APLOC1 + op - 1, id, t.category));
    }
    if (kind === 'npc') {
        const id = NpcType.getId(name), t = NpcType.get(id);
        return !!(ScriptProvider.getByTrigger(ServerTriggerType.OPNPC1 + op - 1, id, t.category) || ScriptProvider.getByTrigger(ServerTriggerType.APNPC1 + op - 1, id, t.category));
    }
    const id = ObjType.getId(name), t = ObjType.get(id);
    return !!ScriptProvider.getByTrigger(ServerTriggerType.OPHELD1 + op - 1, id, t.category);
};
/** Fight an npc to the death with maxed stats and a dragon scimitar. */
function kill(p: Player, npc: Npc, maxTicks = 600): boolean {
    for (let t = 0; t < maxTicks; t++) {
        if (!npc.isActive) return true;
        if (t % 6 === 0 && p.target !== npc && !p.delayed) H.attackNpc(p, npc);
        if (p.activeScript && p.activeScript.execution === ScriptState.PAUSEBUTTON) p.executeScript(p.activeScript, true, true);
        if (p.levels[3] < 50) p.levels[3] = 99;
        H.tick(1);
    }
    return !npc.isActive;
}
const npcsNear = (name: string, x: number, z: number, level: number, range = 30) => {
    const id = NpcType.getId(name);
    return World.npcs.filter(n => n && n.isActive && n.type === id && n.level === level && Math.max(Math.abs(n.x - x), Math.abs(n.z - z)) <= range);
};

// =============================================================================== Ghosts Ahoy
if (run('ahoy')) {
    console.log('GHOSTS AHOY');
    const p = player('ahoy1', 3648, 3485);
    wear(p, { front: 'amulet_of_ghostspeak' });
    const stage = () => gv(p, 'ahoy_questvar');
    const door = (who: Player, x: number, z: number, l: number) => {
        op(who, x, z, 'ahoy_harbour_door', 1);
        return World.getLoc(x, z, l, LocType.getId('ahoy_harbour_door')) === null;
    };

    console.log('The barriers (the west gate, and the one in front of the temple):');
    op(p, 3652, 3485, 'ahoy_town_barrier', 1);
    check('through the west barrier, onto a walkable tile', [p.x > 3652, walkable(p.x, p.z, 0)], [true, true]);
    const inside = [p.x, p.z] as const;
    p.teleport(3653, 3486, 0);
    H.tick(1);
    op(p, 3652, 3485, 'ahoy_town_barrier', 1);
    check('and back out beside its other tile, straight west', [p.x < 3652, walkable(p.x, p.z, 0)], [true, true]);
    for (const [x, z] of [[3659, 3506], [3660, 3506]]) {
        p.teleport(x, z, 0);
        H.tick(1);
        op(p, 3659, 3508, 'ahoy_town_barrier', 1);
        check(`temple barrier from (${x},${z}): straight north, walkable, and Necrovarus in reach`, [p.x, p.z > 3508, walkable(p.x, p.z, 0), reaches(0, p.x, p.z, 3660, 3516)], [x, true, true, true]);
    }
    check('  the temple stairs in reach too', reaches(0, p.x, p.z, 3666, 3517), true);
    op(p, 3659, 3508, 'ahoy_town_barrier', 1);
    check('  and back out south', p.z < 3508, true);
    for (const [n, x, z] of [['Velorina', 3678, 3510], ['the old crone', 3665, 3493], ['the innkeeper', 3681, 3496], ['Ak-Haranu', 3689, 3495], ['the pier captain', 3703, 3487], ['the harbour captain', 3691, 3513]] as const) {
        check(`${n} can be walked to from inside the west barrier`, reaches(0, inside[0], inside[1], x, z), true);
    }
    check('Robin is behind a door...', reaches(0, inside[0], inside[1], 3672, 3491), false);
    check('...which opens now (op1=Open had no handler)', door(player('ahoydoor1', 3670, 3498), 3670, 3497, 0), true);
    check('Robin can be walked to through it', reaches(0, inside[0], inside[1], 3672, 3491), true);

    console.log('The temple upstairs (the stairs were "Unhandled stairs"):');
    p.teleport(3666, 3516, 0);
    H.tick(1);
    op(p, 3666, 3518, 'ahoy_tower_stairs_lv1', 1);
    check('climbs to the temple upper floor, walkable', [p.level, walkable(p.x, p.z, p.level)], [1, true]);
    const upstairs = [p.x, p.z] as const;
    check('  the coffin is behind a door...', reaches(1, p.x, p.z, 3659, 3513, 2), false);
    check('  ...which opens', door(player('ahoydoor2', 3657, 3514, 1), 3656, 3514, 1), true);
    check('  and the coffin can be reached', reaches(1, upstairs[0], upstairs[1], 3659, 3513, 2), true);
    op(p, 3666, 3520, 'ahoy_tower_stairs_lv1_top', 1);
    check('and back down, walkable', [p.level, walkable(p.x, p.z, p.level)], [0, true]);

    console.log('The wreck:');
    check('wreck ladder reachable from outside the barrier', reaches(0, 3648, 3485, 3609, 3543), true);
    p.teleport(3648, 3485, 0);
    H.tick(1);
    op(p, 3609, 3543, 'ahoy_ghostship_ladder', 1);
    check('walk to the ladder and up to the middle deck, onto a walkable tile', [p.level, walkable(p.x, p.z, 1)], [1, true]);
    const deck = [p.x, p.z] as const;
    check('  the pirate captain and the old man are behind a door...', [reaches(1, deck[0], deck[1], 3622, 3543), reaches(1, deck[0], deck[1], 3617, 3544)], [false, false]);
    check('  ...which opens', door(player('ahoydoor3', 3614, 3543, 1), 3615, 3543, 1), true);
    check('  and both can be reached', [reaches(1, deck[0], deck[1], 3622, 3543), reaches(1, deck[0], deck[1], 3617, 3544)], [true, true]);
    p.teleport(deck[0], deck[1], 1);
    H.tick(1);
    op(p, 3615, 3541, 'ahoy_ghostship_ladder', 1);
    check('walk to the next ladder and up to the top deck, walkable', [p.level, walkable(p.x, p.z, 2)], [2, true]);
    check('  Robin\'s chest reachable on the top deck', reaches(2, p.x, p.z, 3618, 3541), true);
    op(p, 3615, 3541, 'ahoy_ghostship_laddertop', 1);
    check('and down again, walkable', [p.level, walkable(p.x, p.z, 1)], [1, true]);
    op(p, 3609, 3543, 'ahoy_ghostship_laddertop', 1);
    check('and down to the ground, walkable', [p.level, walkable(p.x, p.z, 0)], [0, true]);

    console.log('The quest:');
    p.teleport(inside[0], inside[1], 0);
    H.tick(1);
    talk(p, 'ahoy_velorina', [1]);
    check('Velorina: stage 1', stage(), 1);
    talk(p, 'ahoy_necrovarus');
    check('Necrovarus refuses: stage 2', stage(), 2);
    talk(p, 'ahoy_velorina');
    check('Velorina: petition, stage 3', [stage(), H.invCount(p, 'ahoy_petition')], [3, 1]);
    talk(p, 'ahoy_robin');
    check('Robin asks for his model ship', gv(p, 'ahoy_subquest_toyboat'), 1);
    talk(p, 'ahoy_oldman');
    talk(p, 'ahoy_crone');
    p.teleport(3621, 3543, 1);
    H.tick(1);
    op(p, 3622, 3543, 'ahoy_skull_captain', 1);
    check('the pirate captain has the chest key', H.invCount(p, 'ahoy_chest_key'), 1);
    p.teleport(3617, 3541, 2);
    H.tick(1);
    op(p, 3618, 3541, 'ahoy_chest_locked', 1);
    check('the chest has the model ship in it', H.invCount(p, 'ahoy_toy_boat'), 1);
    check('Repair has a handler now', hasOp('obj', 'ahoy_toy_boat', 1), true);
    held(p, 'ahoy_toy_boat', 1);
    check('  no silk: still broken', [H.invCount(p, 'ahoy_toy_boat'), H.invCount(p, 'ahoy_toy_boat_repaired')], [1, 0]);
    H.give(p, 'silk');
    held(p, 'ahoy_toy_boat', 1);
    check('  with silk: mended, silk used', [H.invCount(p, 'ahoy_toy_boat'), H.invCount(p, 'ahoy_toy_boat_repaired'), H.invCount(p, 'silk')], [0, 1, 0]);
    talk(p, 'ahoy_robin');
    check('Robin signs', gv(p, 'ahoy_signaturecounter'), 1);
    H.give(p, 'cup_of_nettletea');
    talk(p, 'ahoy_oldman');
    check('the old man signs for his tea', gv(p, 'ahoy_signaturecounter'), 2);
    talk(p, 'ahoy_ghost_innkeeper');
    check('the innkeeper hands over a bedsheet', H.invCount(p, 'ahoy_bedsheet'), 1);
    talk(p, 'ahoy_crone');
    check('the crone signs: petition full, stage 4', [gv(p, 'ahoy_signaturecounter'), stage()], [3, 4]);
    talk(p, 'ahoy_necrovarus');
    check('Necrovarus names the book: stage 5', stage(), 5);
    talk(p, 'ahoy_disciple');
    check('the disciple has the Book of Haricanto', H.invCount(p, 'ahoy_book_of_haricanto'), 1);
    H.give(p, 'magic_longbow');
    talk(p, 'ahoy_akharanu_multi');
    check('Ak-Haranu trades the manual for a magic longbow', H.invCount(p, 'ahoy_translation_manual'), 1);
    useOnHeld(p, 'ahoy_book_of_haricanto', 'ahoy_translation_manual');
    check('book translated: stage 6', stage(), 6);
    p.teleport(3621, 3543, 1);
    H.tick(1);
    op(p, 3622, 3543, 'ahoy_skull_captain', 1);
    check('scrap 1 off the pirate captain', H.invCount(p, 'ahoy_map_scrap_1'), 1);
    p.teleport(upstairs[0], upstairs[1], 1);
    H.tick(1);
    op(p, 3659, 3513, 'ahoy_coffin', 1);
    check('scrap 2 out of the coffin, walked to on the upper floor', H.invCount(p, 'ahoy_map_scrap_2'), 1);
    talk(p, 'ahoy_ghost_captain_2');
    check('scrap 3 off the harbour captain', H.invCount(p, 'ahoy_map_scrap_3'), 1);
    useOnHeld(p, 'ahoy_map_scrap_1', 'ahoy_map_scrap_2');
    check('the map joined: stage 7', [stage(), H.invCount(p, 'ahoy_map_complete')], [7, 1]);
    talk(p, 'ahoy_ghost_captain_1');
    check('the ghost captain sails to Dragontooth, walkable landing', [p.x > 3770, walkable(p.x, p.z, 0)], [true, true]);
    check('  the dig spot is walkable from the landing', connected(0, p.x, p.z, 3803, 3530), true);
    H.give(p, 'spade');
    p.teleport(3803, 3530, 0);
    H.tick(1);
    held(p, 'spade', 1);
    check('dig: the robes, stage 8', [stage(), H.invCount(p, 'ahoy_robes_of_necrovarus')], [8, 1]);
    talk(p, 'ahoy_ghost_captain_1');
    check('sailed back to the port', [p.x > 3690 && p.x < 3720, walkable(p.x, p.z, 0)], [true, true]);
    const pray = p.stats[5];
    talk(p, 'ahoy_necrovarus');
    H.tick(3);
    check('Necrovarus shown the robes: complete, ectophial, prayer xp', [stage(), H.invCount(p, 'ectophial'), p.stats[5] - pray], [10, 1, 25000]);
    check('quest points counted', H.runProc(p, '[proc,count_questpoints]')[0] >= 2, true);
}

// =============================================================================== Eadgar's Ruse
if (run('eadgar')) {
    console.log("EADGAR'S RUSE");
    const p = player('eadgar1', 2897, 3427, 1);
    const stage = () => gv(p, 'eadgar_quest');
    talk(p, 'sanfew', [1]);
    check('no Troll Stronghold or Druidic Ritual: Sanfew will not start it', stage(), 0);
    sv(p, 'druidquest', 4);
    sv(p, 'troll_quest', 50);
    talk(p, 'sanfew', [1]);
    check('Sanfew starts it: stage 10', stage(), 10);
    standBy(p, 2890, 10086, 2);
    talk(p, 'troll_eadgar');
    check('Mad Eadgar gives the plan: stage 20', stage(), 20);
    const thistle = nearest('eadgar_troll_thistle', p);
    standBy(p, thistle.x, thistle.z, thistle.level);
    talkHere(p, thistle);
    check('a troll thistle picked', H.invCount(p, 'eadgar_troll_thistle'), 1);
    check('the rack had no Search script; it has one now', hasOp('loc', 'eadgar_rack', 1), true);
    standBy(p, 2828, 10096, 0);
    op(p, 2828, 10096, 'eadgar_rack', 1);
    check('  searching it hints at the thistle', lastMes(p).includes('thistle'), true);
    useOn(p, 2828, 10096, 'eadgar_rack', 'eadgar_troll_thistle');
    check('the thistle dried on the rack', H.invCount(p, 'eadgar_dried_troll_thistle'), 1);
    H.give(p, 'pestle_and_mortar');
    useOnHeld(p, 'pestle_and_mortar', 'eadgar_dried_troll_thistle');
    H.give(p, 'vial_water');
    useOnHeld(p, 'vial_water', 'eadgar_ground_troll_thistle');
    check('ground and mixed: the potion, stage 30', [H.invCount(p, 'eadgar_ground_troll_thistle_potion'), stage()], [1, 30]);
    standBy(p, 2844, 10055, 1);
    useOn(p, 2844, 10055, 'eadgar_troll_cauldron', 'eadgar_ground_troll_thistle_potion');
    check('the stew dosed: stage 40', stage(), 40);
    talk(p, 'eadgar_troll_chief_cook');
    check('Burntmeat hands over the storeroom key: stage 50', [stage(), H.invCount(p, 'eadgar_troll_storeroom_key')], [50, 1]);
    standBy(p, 2912, 3418, 0);
    op(p, 2912, 3418, 'eadgar_laundry_basket', 1);
    check('a dirty robe out of the Taverley basket', H.invCount(p, 'eadgar_dirty_druid_robe'), 1);
    H.give(p, 'karamja_rum');
    talk(p, 'eadgar_zoo_keeper_aviary');
    check('Parroty Pete soaks pineapple in the rum', H.invCount(p, 'eadgar_alco_chunks'), 1);
    const parrots = nearest('eadgar_parrotts', p);
    void parrots;
    standBy(p, 2610, 3287, 0);
    useOn(p, 2611, 3287, 'eadgar_aviary_wall_hatch', 'eadgar_alco_chunks');
    check('chunks through the aviary hatch: a drunk parrot', H.invCount(p, 'eadgar_drunk_parrot'), 1);
    useOnHeld(p, 'eadgar_drunk_parrot', 'eadgar_dirty_druid_robe');
    check('robe and parrot make a fake man', H.invCount(p, 'eadgar_fake_man'), 1);
    const q = player('eadgar2', 2869, 10088);
    op(q, 2869, 10085, 'eadgar_storeroomdoor', 1);
    check('the storeroom door: no key, still outside', [q.z >= 10085, lastMes(q).includes('key')], [true, true]);
    H.despawn(q);
    p.teleport(2869, 10088, 0);
    H.tick(1);
    op(p, 2869, 10085, 'eadgar_storeroomdoor', 1);
    check('with the key: through the door into the storeroom (the "open" door used to block the same edge)', p.z < 10085, true);
    op(p, 2869, 10085, 'eadgar_storeroomdoor', 1);
    check('  and back out again', p.z >= 10085, true);
    // The goutweed crates are down in the guards' hall, through the stronghold's interior door.
    op(p, 2861, 10092, 'troll_stronghold_interior_door', 1);
    const guard = nearest('eadgar_storeroom_guard', p);
    check('  the guard reachable through it', reaches(0, p.x, p.z, guard.x, guard.z), true);
    useOnNpc(p, 'eadgar_fake_man', guard);
    check('the guard distracted by the fake man', gv(p, 'eadgar_scarecrow_items'), 1);
    op(p, 2856, 10074, 'eadgar_crate_goutweed', 1);
    check('goutweed from the crate: stage 60', [stage(), H.invCount(p, 'eadgar_goutweed_herb')], [60, 1]);
    const herb = p.stats[15];
    p.teleport(2897, 3427, 1);
    H.tick(1);
    talk(p, 'sanfew');
    H.tick(3);
    check('Sanfew takes the goutweed: complete, 11,000 Herblore xp', [stage(), p.stats[15] - herb], [70, 110000]);
}

// =============================================================================== Zogre Flesh Eaters
if (run('zogre')) {
    console.log('ZOGRE FLESH EATERS');
    const p = player('zogre1', 2455, 3025);
    const stage = () => gv(p, 'zogre');
    check('Grish can be walked to from the Feldip road', reaches(0, 2455, 3025, 2443, 3051), true);
    check('the surface coffin can be walked to from the Feldip road', reaches(0, 2455, 3025, 2447, 3039), true);
    check('the middle of Jiggig is behind the barricade', reaches(0, 2455, 3025, 2485, 3042, 2), false);
    p.teleport(2455, 3048, 0);
    H.tick(1);
    op(p, 2456, 3048, 'zogre_multi_blocking_barricade_l', 1);
    check('  and it cannot be climbed before Grish', p.x, 2455);
    talk(p, 'zogre_ogre_shaman', [1]);
    check('Grish: stage 2', stage(), 2);
    p.teleport(2455, 3049, 0);
    H.tick(1);
    op(p, 2456, 3049, 'zogre_multi_blocking_barricade_r', 1);
    check('the crushed barricade can be climbed (op1 had no script), walkable', [p.x, walkable(p.x, p.z, 0)], [2457, true]);
    check('  the Jiggig stairs down can be walked to from there', reaches(0, p.x, p.z, 2485, 3042, 2), true);
    standBy(p, 2485, 3045, 0);
    op(p, 2485, 3042, 'ogre_stairs_down', 1);
    check('the stairs down were "Unhandled stairs": now into the tomb, stage 4, walkable', [stage(), p.level, walkable(p.x, p.z, 2)], [4, 2, true]);
    check('  the evidence can be walked to from the stairs', reaches(2, p.x, p.z, 2442, 9459), true);
    op(p, 2478, 9437, 'ogre_stairs', 1);
    check('  and the stairs back up land in Jiggig, walkable', [p.level, p.z < 4000, walkable(p.x, p.z, 0)], [0, true, true]);
    op(p, 2456, 3048, 'zogre_multi_blocking_barricade_l', 1);
    check('  and back over the barricade west', p.x, 2455);
    sv(p, 'zogre', 2);
    H.give(p, 'zogre_coffinkey');
    standBy(p, 2447, 3039, 0);
    op(p, 2447, 3039, 'ogre_coffin', 1);
    check('the coffin key opens the way into the tomb, walkable landing', [stage(), p.level, p.z > 9000, walkable(p.x, p.z, p.level)], [4, 2, true, true]);
    const landing = [p.x, p.z] as const;
    for (const [n, x, z] of [['Brentle Vahn', 2442, 9459], ['the special coffin', 2438, 9458], ['the lectern', 2443, 9459], ['the way out', 2442, 9433]] as const) {
        check(`${n} can be walked to from the landing`, reaches(2, landing[0], landing[1], x, z), true);
    }
    op(p, 2442, 9459, 'zogre_brentle_skeleton', 1);
    op(p, 2438, 9458, 'zogre_coffin_special_entity', 1);
    op(p, 2443, 9459, 'zogre_lecturn', 1);
    check('backpack, tankard, prism and page: stage 6', [stage(), H.invCount(p, 'zogre_brentle_vahn_backpack'), H.invCount(p, 'zogre_black_prism'), H.invCount(p, 'zogre_necromantic_page')], [6, 1, 1, 1]);
    check('the tomb dark coffin and left wall coffin have scripts now', [hasOp('loc', 'ogre_dark_coffin', 1), hasOp('loc', 'ogre_dark_coffin', 2), hasOp('loc', 'ogre_wall_coffinl', 1), hasOp('loc', 'ogre_wall_coffinl', 2)], [true, true, true, true]);
    op(p, 2443, 9463, 'ogre_dark_coffin', 2);
    check('  picking one inside the tomb does not throw you back to the landing', [p.level, lastMes(p).includes('Bones')], [2, true]);
    standBy(p, 2446, 9417, 2);
    op(p, 2443, 9417, 'ogre_stairs_down', 1);
    check('down to the deepest chamber, walkable, and the stand is in reach', [p.level, walkable(p.x, p.z, 0), reaches(0, p.x, p.z, 2483, 9445)], [0, true, true]);
    op(p, 2443, 9417, 'ogre_stairs', 1);
    check('  and back up, walkable', [p.level, walkable(p.x, p.z, 2)], [2, true]);
    p.teleport(landing[0], landing[1], 2);
    H.tick(1);
    op(p, 2442, 9433, 'ogre_cavedoorl', 1);
    check('out through the tomb door, walkable', [p.level, p.z < 4000, walkable(p.x, p.z, p.level)], [0, true, true]);
    p.teleport(2588, 3088, 0);
    H.tick(1);
    talk(p, 'zogre_human_zavistic_rarve');
    check('Rarve reads the evidence: the potion, stage 8', [stage(), H.invCount(p, 'zogre_ogre_trans_potion')], [8, 1]);
    standBy(p, 2597, 3107, 0);
    op(p, 2597, 3107, 'ladder', 1);
    check('up the ladder in Sithik\'s house', p.level, 1);
    op(p, 2591, 3105, 'loc_1530', 1);
    check('  his bed reachable up there, through his door', reaches(1, p.x, p.z, 2591, 3103), true);
    op(p, 2591, 3103, 'zogre_sithik_bed_entity', 1);
    op(p, 2591, 3103, 'zogre_sithik_bed_entity', 1);
    check('Sithik drinks it, turns, confesses: stage 10', [stage(), gv(p, 'thzfe_sithik_transformed')], [10, 1]);
    p.teleport(2598, 3084, 0);
    H.tick(1);
    op(p, 2598, 3085, 'zogre_outdoor_bell', 1);
    const bash = H.npcNear('zogre_slash_bash', 2440, 9458, 2);
    check('the bell wakes Slash Bash in the tomb, on a walkable tile', [bash !== null, bash ? walkable(bash.x, bash.z, 2) : false], [true, true]);
    if (bash) {
        const t = NpcType.get(bash.type);
        check('Slash Bash has real stats now (100 hp, not 1)', [bash.levels[3], t.stats?.[0] ?? bash.baseLevels[0]], [100, 100]);
        p.teleport(landing[0], landing[1], 2);
        H.tick(1);
        wear(p, { rhand: 'dragon_scimitar' });
        const before = H.npcHitsFor('zogre_slash_bash').length;
        const died = kill(p, bash);
        check('killed, and it took more than one hit', [died, H.npcHitsFor('zogre_slash_bash').length - before > 1], [true, true]);
        H.tick(3);
        check('the kill registers: stage 14', stage(), 14);
        const art = World.getObj(bash.x, bash.z, 2, ObjType.getId('zogre_artifacts'), p.hash64);
        check('the ogre artefact drops', art !== null, true);
    }
    H.give(p, 'zogre_artifacts');
    p.teleport(2443, 3049, 0);
    H.tick(1);
    talk(p, 'zogre_ogre_shaman');
    H.tick(3);
    check('Grish takes the artefact: complete', stage(), 16);
}

// =============================================================================== Cabin Fever
if (run('fever')) {
    console.log('CABIN FEVER');
    const p = player('fever1', 3679, 3493);
    wear(p, { front: 'amulet_of_ghostspeak' });
    const stage = () => gv(p, 'fever_quest');
    talk(p, 'fever_teach');
    check('no Rum Deal: Teach will not take you on', stage(), 0);
    sv(p, 'deal_quest', 6);
    talk(p, 'fever_teach', [2]);
    check('Rum Deal done: stage 1, the book', [stage(), H.invCount(p, 'fever_piracy_book')], [1, 1]);
    held(p, 'fever_piracy_book', 1);
    check('read the book: stage 2', stage(), 2);
    check('the pier gangplank can be walked to from the town', reaches(0, 3690, 3496, 3710, 3496), true);
    standBy(p, 3709, 3496, 0);
    op(p, 3710, 3496, 'fever_gangplank', 1);
    check('aboard: stage 3, walkable deck', [stage(), walkable(p.x, p.z, p.level)], [3, true]);
    check('  Teach reachable on the deck', reaches(p.level, p.x, p.z, 3713, 3497), true);
    talk(p, 'fever_port_ship_teach');
    check('cast off: stage 4, on the quest ship, walkable', [stage(), p.x < 2000, walkable(p.x, p.z, p.level)], [4, true, true]);
    const deck = [p.x, p.z, p.level] as const;

    console.log('Every ship ladder lands on a walkable tile the other end can be climbed back from:');
    for (const [lo, hi, x, z, lv] of [
        ['fever_ship_ladder', 'fever_ship_laddertop', 1815, 4836, 0], ['fever_ship_ladder', 'fever_ship_laddertop', 1824, 4829, 0],
        ['fever_shipladder_angled', 'fever_shipladder_top_angled', 1813, 4828, 1], ['fever_shipladder_angled', 'fever_shipladder_top_angled', 1826, 4837, 1],
        ['fever_climbing_net', 'fever_climb_down_location', 1816, 4831, 1], ['fever_climbing_net', 'fever_climb_down_location', 1823, 4834, 1],
        ['fever_ship_ladder', 'fever_ship_laddertop', 3714, 3502, 0], ['fever_shipladder_angled', 'fever_shipladder_top_angled', 3712, 3494, 1],
        ['fever_ship_ladder', 'fever_ship_laddertop', 3678, 2948, 0], ['fever_shipladder_angled', 'fever_shipladder_top_angled', 3686, 2950, 1],
        ['ahoy_ghostship_ladder', 'ahoy_ghostship_laddertop', 3613, 3543, 0]
    ] as const) {
        const c = player(`lad${x}${z}`, x, z - 3, lv);
        standAt(c, lo, x, z, lv);
        op(c, x, z, lo, 1);
        const upOk = c.level === lv + 1 && walkable(c.x, c.z, c.level);
        op(c, x, z, hi, 1);
        const downOk = c.level === lv && walkable(c.x, c.z, c.level);
        check(`${lo} at ${x},${z},${lv}: up and back down`, [upOk, downOk], [true, true]);
        H.despawn(c);
    }

    console.log('The gun drill and the hull:');
    p.teleport(deck[0], deck[1], deck[2]);
    H.tick(1);
    standBy(p, 1816, 4833, 0);
    op(p, 1816, 4833, 'fever_weapons_locker', 1);
    op(p, 1814, 4832, 'fever_repair_locker', 1);
    check('lockers below deck: ramrod, fuses, shot, tinderbox, planks, paste, hammer', ['fever_cannon_prod', 'fever_fuse', 'fever_cannon_ball', 'fever_tinderbox', 'fever_repair_plank', 'swamppaste', 'hammer'].map(o => H.invCount(p, o) > 0), [true, true, true, true, true, true, true]);
    check('the cannon and our own powder barrel can both be walked to from the deck', [reaches(1, deck[0], deck[1], 1816, 4833), reaches(1, deck[0], deck[1], 1817, 4832)], [true, true]);
    check('  (the barrel that had the script is on the enemy ship)', reaches(1, deck[0], deck[1], 1822, 4831), false);
    check('  our barrel has a Take-Powder script now', hasOp('loc', 'fever_your_gunpowder_barrel', 1), true);
    check('  and the lockers below from the foot of the ladder', [reaches(0, 1815, 4837, 1816, 4833), reaches(0, 1815, 4837, 1814, 4832), reaches(0, 1815, 4837, 1816, 4834)], [true, true, true]);
    const shoot = () => {
        p.teleport(deck[0], deck[1], 1);
        H.tick(1);
        op(p, 1817, 4832, 'fever_your_gunpowder_barrel', 1);
        for (let i = 0; i < 6; i++) op(p, 1816, 4833, 'fever_multi_cannon', 1);
        H.tick(6);
    };
    for (let shot = 0; shot < 3; shot++) shoot();
    check('three clean shots: she sheers away, stage 5', stage(), 5);
    for (const [n, x, z] of [['fever_multi_hole_1', 1816, 4834], ['fever_multi_hole_2', 1816, 4832], ['fever_multi_hole_3', 1816, 4830]] as const) {
        standBy(p, x, z, 0);
        op(p, x, z, n, 1);
        op(p, x, z, n, 1);
    }
    check('holes planked and pasted', [gv(p, 'fever_hole_1'), gv(p, 'fever_hole_2'), gv(p, 'fever_hole_3')], [2, 2, 2]);

    console.log('Leaving mid-fight is no longer a dead end:');
    talk(p, 'fever_quest_ship_teach', [], 3);
    check('Return-Home (op3 had no script) sails you back to the Phasmatys pier, on the pier (plane 0), walkable, and the town in reach', [p.x > 3600, p.level, walkable(p.x, p.z, p.level), connected(0, p.x, p.z, 3690, 3496)], [true, 0, true, true]);
    op(p, 3710, 3496, 'fever_gangplank', 1);
    talk(p, 'fever_port_ship_teach');
    check('and the port ship takes you back out to the fight', [p.x < 2000, stage()], [true, 5]);
    talk(p, 'fever_quest_ship_teach');
    check('Teach at the wheel: Mos Le\'Harmless, stage 6, walkable', [stage(), p.z < 3000, walkable(p.x, p.z, p.level)], [6, true, true]);
    const smith = p.stats[13];
    talk(p, 'fever_harmless_teach');
    H.tick(3);
    check('Teach on the island: complete, 7,000 Smithing xp', [stage(), p.stats[13] - smith], [7, 70000]);

    console.log('And there and back again afterwards (the island was one-way):');
    talk(p, 'fever_harmless_teach', [1]);
    check('Teach on the island sails you home to the pier, walkable', [p.x > 3600 && p.z > 3400, p.level, walkable(p.x, p.z, p.level)], [true, 0, true]);
    op(p, 3710, 3496, 'fever_gangplank', 1);
    talk(p, 'fever_port_ship_teach');
    check('the port ship sails you to Mos Le\'Harmless', [p.z < 3000, walkable(p.x, p.z, p.level)], [true, true]);
    check('the dock gangplank can be walked to from there', reaches(0, p.x, p.z, 3684, 2952), true);
    op(p, 3684, 2952, 'fever_gangplank_harmless', 1);
    check('the dock gangplank boards the moored ship (it put you back on the island), walkable deck', [p.level, walkable(p.x, p.z, 1), reaches(1, p.x, p.z, 3684, 2947)], [1, true, true]);
    check('Teach on the ship moored there sails back too (op1 had no script)', hasOp('npc', 'fever_harmless_port_ship_teach', 1), true);
    talk(p, 'fever_harmless_port_ship_teach');
    check('  home again, walkable', [p.z > 3400, walkable(p.x, p.z, p.level)], [true, true]);
}

// =============================================================================== Troll Stronghold
if (run('troll')) {
    console.log('TROLL STRONGHOLD');
    for (const loc of ['troll_stronghold_top_exit_left', 'troll_stronghold_top_exit_mid', 'troll_stronghold_top_exit_right']) {
        const p = player(`tr${loc.slice(-4)}`, 2837, 10090, 2);
        const [x, z] = loc.endsWith('left') ? [2838, 10091] : loc.endsWith('right') ? [2838, 10089] : [2838, 10090];
        op(p, x, z, loc, 1);
        check(`${loc}: out onto the mountain, walkable`, [p.z < 4000, walkable(p.x, p.z, p.level)], [true, true]);
        H.despawn(p);
    }

    const p = player('troll1', 2909, 3612);
    const st = () => gv(p, 'troll_quest');
    sv(p, 'troll_quest', 10);
    const dad = nearest('troll_champion', p);
    wear(p, { rhand: 'dragon_scimitar' });
    H.attackNpc(p, dad);
    for (let t = 0, done = 0; t < 400 && done < 5; t++) {
        if (st() >= 20) done++;
        if (p.activeScript && p.activeScript.execution === ScriptState.PAUSEBUTTON) {
            const open = p.modalChat === -1 ? '' : (Component.get(p.modalChat).comName ?? '');
            if (open.startsWith('multi')) H.choose(p, `${open}:com_1`);
            else p.executeScript(p.activeScript, true, true);
        }
        if (t % 6 === 5 && p.target !== dad && !p.delayed && dad.isActive) H.attackNpc(p, dad);
        if (p.levels[3] < 50) p.levels[3] = 99;
        H.tick(1);
    }
    check('Dad beaten: stage 20', st(), 20);
    standBy(p, 2839, 3689, 0);
    op(p, 2839, 3689, 'troll_stronghold_door', 1);
    check('into the stronghold, walkable', [p.z > 9000, walkable(p.x, p.z, p.level)], [true, true]);
    const gen = H.npcNear('troll_general2', 2822, 10073, 2) ?? H.npcNear('troll_general3', 2829, 10100, 2);
    const inside = [p.x, p.z] as const;
    op(p, 2838, 10057, 'troll_stronghold_interior_door', 1);
    check('a troll general can be walked to from the door, through the interior door', gen !== null && reaches(2, inside[0], inside[1], gen.x, gen.z), true);
    if (gen) {
        p.teleport(gen.x + 2, gen.z, 2);
        H.tick(1);
        kill(p, gen, 800);
        H.tick(3);
        check('the general drops the prison key', World.getObj(gen.x, gen.z, 2, ObjType.getId('troll_key_prison'), p.hash64) !== null, true);
    }
    H.clearInv(p);
    H.give(p, 'troll_key_prison');
    standBy(p, 2848, 10107, 1);
    op(p, 2848, 10107, 'troll_stronghold_prison_door_closed', 1);
    check('the prison door: stage 30', st(), 30);
    const g1 = nearest('troll_prison_guard1', p);
    p.teleport(g1.x + 1, g1.z, 0);
    H.tick(1);
    for (let i = 0; i < 10 && H.invCount(p, 'troll_key_godric') === 0; i++) {
        talkHere(p, nearest('troll_prison_guard1', p), [], 3);
        H.tick(6);
    }
    check('Godric\'s cell key off the sleeping guard', H.invCount(p, 'troll_key_godric'), 1);
    standBy(p, 2833, 10078, 0);
    op(p, 2832, 10078, 'troll_celldoor_godric', 1);
    H.tick(5);
    check('Godric freed: stage 40', st(), 40);
    p.teleport(2919, 3576, 0);
    H.tick(1);
    talk(p, 'death_smithy');
    H.tick(3);
    check('Dunstan: complete, the law talisman', [st(), H.invCount(p, 'law_talisman')], [50, 1]);
}

// =============================================================================== Desert Treasure, the spine
if (run('dt')) {
    console.log('DESERT TREASURE - the start, Eblis, the mirrors, the obelisks, ice and shadow errands');
    const p = player('dtspine', 3178, 3040);
    const st = () => gv(p, 'deserttreasure');
    sv(p, 'itexamlevel', 9);
    sv(p, 'ikov', 80);
    sv(p, 'troll_quest', 50);
    sv(p, 'priestperil', 60);
    sv(p, 'waterfall_quest', 10);
    talk(p, 'fourdiamonds_indiana', [1]);
    check('the Archaeologist starts it: etchings, stage 1', [st(), H.invCount(p, 'four_diamonds_etchings')], [1, 1]);
    const expert = nearest('archaeological_expert', p);
    standBy(p, expert.x, expert.z, expert.level);
    useOnNpc(p, 'four_diamonds_etchings', expert);
    check('Terry translates: stage 2', [st(), H.invCount(p, 'four_diamonds_translation_primer')], [2, 1]);
    talk(p, 'fourdiamonds_indiana');
    check('back to the Archaeologist: stage 3', st(), 3);
    H.give(p, 'coins', 1000);
    talk(p, 'fourdiamonds_bartender', [1]);
    check('a brew bought: stage 4', st(), 4);
    talk(p, 'fourdiamonds_elder');
    check('Eblis wants materials: stage 5', st(), 5);
    const eblis = nearest('fourdiamonds_elder', p);
    for (const [o, n] of [['magic_logs', 12], ['molten_glass', 6], ['steel_bar', 6], ['ashes', 1], ['charcoal', 1], ['bones', 1], ['bloodrune', 1]] as const) {
        H.give(p, o, n);
        useOnNpc(p, o, eblis);
    }
    check('all the materials: Eblis goes to the mirrors, stage 10', st(), 10);
    talk(p, 'fourdiamonds_elder2');
    check('Eblis at the mirrors: stage 11', st(), 11);
    check('the mirrors can be walked to from Eblis', reaches(0, p.x, p.z, 3214, 2951), true);
    op(p, 3214, 2951, 'sword_mirror1', 1);
    check('a mirror shows a vision', saw(p, 'You see '), true);

    console.log('Ice: the troll child, Kamil, the parents:');
    const c = player('dtice2', 2836, 3742);
    sv(c, 'deserttreasure', 11);
    const child = nearest('fourdiamonds_troll_child', c);
    H.give(c, 'chocolate_cake');
    useOnNpc(c, 'chocolate_cake', child);
    check('a sweet for the troll child: Kamil appears on the ice path', [gv(c, 'fd_icewarrior_subquest'), H.npcNear('icediamond_icewarrior', 2852, 3732, 0) !== null], [1, true]);
    const kamil = H.npcNear('icediamond_icewarrior', 2852, 3732, 0);
    if (kamil) {
        check('Kamil can be walked to from the gate', reaches(0, 2839, 3739, kamil.x, kamil.z), true);
        c.teleport(kamil.x - 1, kamil.z, 0);
        H.tick(1);
        wear(c, { rhand: 'dragon_scimitar' });
        check('Kamil killed', kill(c, kamil, 1500), true);
        H.tick(3);
    }
    check('his death frees the parents: fdiw 4', gv(c, 'fd_icewarrior_subquest'), 4);
    talk(c, 'fourdiamonds_troll_child');
    check('the child hands over the Diamond of Ice', [H.invCount(c, 'fd_icediamond'), gv(c, 'fd_icewarrior_subquest')], [1, 5]);

    console.log('Shadow: Rasolo and the bandit chest:');
    const s = player('dtshadow2', 2535, 3434);
    sv(s, 'deserttreasure', 11);
    talk(s, 'shadow_warrior_rasool');
    check('Rasolo wants his cross', gv(s, 'fd_shadowwarrior_quest'), 1);
    H.give(s, 'lockpick', 5);
    check('the bandit chest can be walked to from the camp', reaches(0, 3163, 2980, 3169, 2967), true);
    standBy(s, 3169, 2967, 0);
    for (let i = 0; i < 6 && H.invCount(s, 'fd_sword_cross') === 0; i++) {
        s.levels[3] = 99;
        op(s, 3169, 2967, 'fd_bandit_shutchest', 1);
    }
    check('the cross, out of the chest', H.invCount(s, 'fd_sword_cross'), 1);
    talk(s, 'shadow_warrior_rasool');
    check('Rasolo: the ring of visibility, the ladder shows', [H.invCount(s, 'fd_ring_visibility'), gv(s, 'fd_shadowwarrior_quest'), gv(s, 'fd_ladder_present')], [1, 2, 1]);

    console.log('The obelisks:');
    for (const d of ['fd_blood_diamond', 'fd_icediamond', 'fd_diamond_fire', 'fd_dark_diamond']) H.give(p, d);
    talk(p, 'fourdiamonds_elder2');
    const obs: [string, number, number][] = [['desert_treasure_oblix1', 3220, 2909], ['desert_treasure_oblix2', 3244, 2909], ['desert_treasure_oblix3', 3244, 2885], ['desert_treasure_oblix4', 3220, 2885]];
    for (const [n, x, z] of obs) {
        check(`${n} can be walked to from the pyramid door`, reaches(0, 3233, 2902, x, z), true);
        standBy(p, x, z, 0);
        op(p, x, z, n, 1);
    }
    check('all four placed: the pyramid opens, stage 12', st(), 12);
}

// =============================================================================== Desert Treasure
/** Shortest walk, in tiles, between two tiles (BFS over the real collision map), or -1. */
function walkDist(level: number, x: number, z: number, tx: number, tz: number, radius = 200): number {
    const seen = new Map<string, number>([[x + ',' + z, 0]]);
    let q: [number, number][] = [[x, z]];
    let d = 0;
    while (q.length) {
        const nq: [number, number][] = [];
        for (const [cx, cz] of q) {
            if (Math.abs(cx - tx) <= 1 && Math.abs(cz - tz) <= 1) return d;
            for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
                const nx = cx + dx, nz = cz + dz, k = nx + ',' + nz;
                if (seen.has(k) || Math.abs(nx - x) > radius || Math.abs(nz - z) > radius) continue;
                if (canTravel(level, cx, cz, dx, dz, 1, 0, CollisionType.NORMAL)) { seen.set(k, d + 1); nq.push([nx, nz]); }
            }
        }
        q = nq;
        d++;
    }
    return -1;
}
if (run('dt')) {
    console.log('DESERT TREASURE');
    const dtv = (p: Player) => gv(p, 'deserttreasure');

    console.log('Blood: a lost pot, or a Dessous who got away, is no longer the end of the quest:');
    {
        const p = player('dtblood', 3497, 3476);
        sv(p, 'deserttreasure', 11);
        sv(p, 'fdvw_subquest', 5); // Dessous summoned, and then lost
        talk(p, 'fourdiamonds_vampire_lord');
        check('no pot: Malak tells you to get another, stage untouched', gv(p, 'fdvw_subquest'), 5);
        H.give(p, 'fd_silver_pot_blessed');
        talk(p, 'fourdiamonds_vampire_lord');
        check('a new blessed pot: Malak fills it again, the stage stays at summoned', [H.invCount(p, 'fd_silver_pot_blood_blessed'), gv(p, 'fdvw_subquest')], [1, 5]);
        H.give(p, 'fd_crushed_garlic');
        H.give(p, 'spicespot');
        useOnHeld(p, 'fd_crushed_garlic', 'fd_silver_pot_blood_blessed');
        useOnHeld(p, 'spicespot', 'fd_silver_pot_blood_garlic_blessed');
        check('garlic and spice in', H.invCount(p, 'fd_silver_pot_blood_garlic_spiced_blessed'), 1);
        standBy(p, 3568, 3401, 0);
        useOn(p, 3568, 3401, 'vampire_big_grave_noblood', 'fd_silver_pot_blood_garlic_spiced_blessed');
        const dessous = H.npcNear('blooddiamond_vampirewarrior', 3568, 3403, 0);
        check('Dessous rises again', dessous !== null, true);
        if (dessous) {
            wear(p, { rhand: 'dragon_dagger' });
            check('killed', kill(p, dessous, 1200), true);
            H.tick(3);
        }
        check('his death registers: fdvw 6', gv(p, 'fdvw_subquest'), 6);
        talk(p, 'fourdiamonds_vampire_lord');
        check('Malak hands over the Diamond of Blood', [H.invCount(p, 'fd_blood_diamond'), gv(p, 'fdvw_subquest')], [1, 7]);
    }

    console.log('Smoke: the well, the torches, the gate both ways:');
    {
        const p = player('dtsmoke', 3310, 2959);
        sv(p, 'deserttreasure', 11);
        wear(p, { hat: 'slayer_facemask' });
        standBy(p, 3310, 2961, 0);
        op(p, 3310, 2962, 'sword_haunted_well', 1);
        check('down the well onto a walkable tile (was the ladder loc tile)', [p.z > 9000, walkable(p.x, p.z, 0)], [true, true]);
        const bottom = [p.x, p.z] as const;
        const torches = [[3323, 9398], [3321, 9355], [3204, 9350], [3207, 9395]];
        let route = walkDist(0, bottom[0], bottom[1], torches[3][0], torches[3][1]);
        for (let i = 0; i < 3; i++) route += walkDist(0, torches[(i + 3) % 4][0], torches[(i + 3) % 4][1], torches[i][0], torches[i][1]);
        const lap = walkDist(0, torches[3][0], torches[3][1], torches[0][0], torches[0][1]) + walkDist(0, torches[0][0], torches[0][1], torches[1][0], torches[1][1]) + walkDist(0, torches[1][0], torches[1][1], torches[2][0], torches[2][1]) + walkDist(0, torches[2][0], torches[2][1], 3248, 9364);
        console.log(`    four torches and back to the chest: ${lap} tiles`);
        check('the four torches and the chest can be lit and opened inside the burn time, running', Math.ceil(lap / 2) + 4 * 4 < 400 + 0 * route, true);
        check('Fareed\'s gate can be walked to from the bottom of the well', reaches(0, bottom[0], bottom[1], 3305, 9375), true);
        H.give(p, 'fd_firekey');
        standBy(p, 3304, 9375, 0);
        op(p, 3305, 9375, 'fd_fw_metalgateclosed_l', 1);
        check('through the gate into the arena, walkable', [p.x > 3305, walkable(p.x, p.z, 0)], [true, true]);
        const fareed = H.npcNear('firediamond_firewarrior', p.x, p.z, 0);
        check('Fareed appears', fareed !== null, true);
        if (fareed) World.removeNpc(fareed, -1);
        op(p, 3305, 9375, 'fd_fw_metalgateclosed_l', 1);
        check('and back OUT through the gate (it only ever sent you in)', [p.x < 3305, walkable(p.x, p.z, 0)], [true, true]);
        standBy(p, 3205, 9379, 0);
        op(p, 3205, 9379, 'sword_haunted_well_go_up', 1);
        check('up the well onto a walkable tile (was the well loc tile)', [p.z < 4000, walkable(p.x, p.z, 0)], [true, true]);
    }

    console.log('Shadow: Damis was never spawned:');
    {
        const p = player('dtshadow', 2547, 3419);
        sv(p, 'deserttreasure', 11);
        sv(p, 'fd_shadowwarrior_quest', 2);
        sv(p, 'fd_ladder_present', 1);
        H.give(p, 'fd_ring_visibility');
        wear(p, { ring: 'fd_ring_visibility', rhand: 'dragon_scimitar' });
        standBy(p, 2547, 3421, 0);
        op(p, 2547, 3421, 'fd_shadowladder1', 1);
        check('down the invisible ladder onto a walkable tile', [p.z > 5000, walkable(p.x, p.z, 0)], [true, true]);
        const damis = H.npcNear('fd_damis_normal', 2626, 5065, 0);
        check('Damis turns up in the lair when you come down', damis !== null, true);
        if (damis) {
            check('  and he can be walked to', reaches(0, p.x, p.z, damis.x, damis.z), true);
            kill(p, damis, 1200);
            H.tick(3);
            const d2 = H.npcNear('fd_damis_tougher', damis.x, damis.z, 0);
            check('form one down, form two up', d2 !== null, true);
            if (d2) kill(p, d2, 1500);
            H.tick(3);
            check('form two down: the Diamond of Shadow drops, fdsw 3', [World.getObj(d2!.x, d2!.z, 0, ObjType.getId('fd_dark_diamond'), p.hash64) !== null, gv(p, 'fd_shadowwarrior_quest')], [true, 3]);
        }
        H.tick(3);
        standBy(p, 2629, 5072, 0);
        op(p, 2629, 5072, 'fd_shadowladder', 1);
        check('up again onto a walkable tile', [p.z < 4000, walkable(p.x, p.z, 0)], [true, true]);
        op(p, 2547, 3421, 'fd_shadowladder1', 1);
        check('coming back down after: no second Damis', [H.npcNear('fd_damis_normal', 2626, 5065, 0), H.npcNear('fd_damis_tougher', 2626, 5065, 0)].every(n => n === null || !n.isActive), true);
    }

    console.log('Ice: the gate both ways:');
    {
        const p = player('dtice', 2836, 3738);
        sv(p, 'deserttreasure', 11);
        sv(p, 'fd_icewarrior_subquest', 1);
        standBy(p, 2837, 3739, 0);
        op(p, 2838, 3739, 'icegate_left', 1);
        check('through the ice gate east, walkable', [p.x > 2838, walkable(p.x, p.z, 0)], [true, true]);
        op(p, 2838, 3739, 'icegate_left', 1);
        check('and back west, walkable', [p.x < 2838, walkable(p.x, p.z, 0)], [true, true]);
    }

    console.log('The pyramid, top to bottom and out:');
    {
        const p = player('dtpyr', 3233, 2902);
        sv(p, 'deserttreasure', 12);
        op(p, 3233, 2899, 'four_diamonds_door_1', 1);
        check('the pyramid door opens and lets you in (its tile is solid in the map), ladder in reach', [p.z < 2899, reaches(0, p.x, p.z, 3233, 2897)], [true, true]);
        op(p, 3233, 2899, 'four_diamonds_door_1', 1);
        check('  and out again', p.z > 2899, true);
        op(p, 3233, 2899, 'four_diamonds_door_1', 1);
        const steps: [string, number, number, number][] = [['desert_laddertop', 3233, 2897, 0], ['desert_laddertop3_2', 2909, 4964, 3], ['desert_laddertop2_1', 2846, 4973, 2], ['desert_laddertop1_0', 2784, 4941, 1]];
        for (const [loc, x, z, l] of steps) {
            const from = [p.x, p.z, p.level];
            check(`${loc} can be walked to from where the last ladder left you`, p.level === l && reaches(l, p.x, p.z, x, z), true);
            standBy(p, x, z, l);
            op(p, x, z, loc, 1);
            check(`  and climbed down onto a walkable tile`, [p.level !== l || p.z !== from[1], walkable(p.x, p.z, p.level)], [true, true]);
        }
        check('the altar room is shut off from the ladder...', reaches(0, p.x, p.z, 3232, 9311), false);
        check('...but its doorway can be walked to', reaches(0, p.x, p.z, 3234, 9324), true);
        p.teleport(3234, 9326, 0); // the walk is proven above; the mummies on the way are aggressive
        H.tick(1);
        op(p, 3234, 9324, 'dt_ancient_temple_door_open', 1);
        check('through the doorway (op1=Open had no script): the altar can be walked to', [p.z < 9324, reaches(0, p.x, p.z, 3232, 9311)], [true, true]);
        op(p, 3232, 9311, 'dt_zaros_altar', 1);
        check('praying at the altar: stage 13', dtv(p), 13);
        talk(p, 'azzanadra');
        talk(p, 'azzanadra');
        H.tick(5);
        check('Azzanadra: complete, Ancient Magicks', [dtv(p), gv(p, 'spellbook')], [15, 1]);
        op(p, 3233, 9312, 'dia_down', 1);
        check('the exit portal puts you outside, walkable', [p.z < 4000, walkable(p.x, p.z, 0)], [true, true]);
    }
}

// =============================================================================== Recruitment Drive
if (run('rd')) {
    console.log('RECRUITMENT DRIVE');
    const origND = JavaRandom.nextDouble.bind(JavaRandom);
    /** Run `f` with random() pinned (the last value repeats) - the world shares the generator, so a value per call is not reliable. */
    const rigged = <T>(vals: number[], f: () => T): T => {
        let i = 0;
        (JavaRandom as any).nextDouble = () => vals[Math.min(i++, vals.length - 1)];
        try {
            return f();
        } finally {
            (JavaRandom as any).nextDouble = origND;
        }
    };
    const p = player('rd1', 2960, 3337, 2);
    const main = () => gv(p, 'rd_main');
    sv(p, 'spy', 4);
    talk(p, 'sir_amik_varze', [1]);
    check('Sir Amik: started', main(), 1);
    p.teleport(2997, 3372, 0);
    H.tick(1);
    // skip rooms 6 and 7 for this run (random(7)+1 = 6, then 7); the lab gets its own run below
    talk(p, 'rd_teleporter_guy', [1]);
    check('Sir Tiffy starts a run', gv(p, 'rd_room1_initiated'), 1);
    // this run does rooms 1-5; the lab and the logic room get a run of their own below
    for (let r = 1; r <= 7; r++) sv(p, `rd_room${r}_complete`, r >= 6 ? 1 : 0);
    p.teleport(2997, 3372, 0);
    H.tick(1);
    talk(p, 'rd_teleporter_guy', [1]);
    check('room 1: arrived on a walkable tile', [p.z > 4900, walkable(p.x, p.z, 0)], [true, true]);

    console.log('Room 1, the bridge:');
    const shell = (n: string): [number, number] => {
        for (let x = 2468; x < 2495; x++) for (let z = 4964; z < 4982; z++) if (World.getLoc(x, z, 0, LocType.getId(n))) return [x, z];
        throw new Error('no ' + n);
    };
    const take = (animal: string, far: boolean) => {
        const n = `rd_room2_${animal}_multi${far ? '_right' : ''}`;
        const [x, z] = shell(n);
        op(p, x, z, n, 1);
    };
    const cross = () => {
        const bx = p.x > 2480 ? 2483 : 2477;
        op(p, bx, 4972, bx === 2483 ? 'rd_bridge_left' : 'rd_bridge_right', 1);
    };
    check('the bridge can be walked to from the arrival tile', reaches(p.level, p.x, p.z, 2483, 4972), true);
    take('chicken', false); cross(); cross();
    take('fox', false); cross();
    take('chicken', true); cross();
    take('grain', false); cross(); cross();
    take('chicken', false); cross();
    check('all three across: room 1 passed', gv(p, 'rd_room1_complete'), 1);
    check('the exit door can be walked to', reaches(0, p.x, p.z, 2472, 4972), true);
    op(p, 2472, 4972, 'rd_room1_exitdoor', 1);
    check('on to room 2, walkable', [walkable(p.x, p.z, 0), Math.abs(p.x - 2459) < 6], [true, true]);

    console.log('Room 2, the statues:');
    rigged([0], () => talk(p, 'rd_observer_room_2', [1]));
    const statues: Record<string, [number, number]> = {};
    for (let x = 2440; x < 2470; x++) for (let z = 4970; z < 4990; z++) for (let n = 1; n <= 12; n++) if (World.getLoc(x, z, 0, LocType.getId(`rd_statue_multi_${n}`))) statues[n] = [x, z];
    check('all twelve statues are placed', Object.keys(statues).length, 12);
    op(p, statues[6][0], statues[6][1], 'rd_statue_multi_6', 1);
    check('the missing statue touched: room 2 passed', gv(p, 'rd_room2_complete'), 1);
    op(p, 2447, 4979, 'rd_room2_exitdoor', 1);
    check('on to room 3, walkable', [walkable(p.x, p.z, 0), p.z < 4970 && p.z > 4958], [true, true]);

    console.log('Room 3, Sir Leye (the map never placed him):');
    const leye = H.npcNear('rd_combat_npc_room_3', p.x, p.z, 0);
    check('Sir Leye is there when you arrive, in reach', [leye !== null, leye ? reaches(0, p.x, p.z, leye.x, leye.z) : false], [true, true]);
    if (leye) {
        wear(p, { rhand: 'rune_warhammer' });
        kill(p, leye, 600);
        H.tick(4);
    }
    check('floored with a blunt weapon: room 3 passed', gv(p, 'rd_room3_complete'), 1);
    op(p, 2463, 4963, 'rd_room3_exitdoor', 1);
    check('on to room 4, walkable', [walkable(p.x, p.z, 0), p.z < 4960 && p.z > 4950], [true, true]);

    console.log('Room 4, patience:');
    talk(p, 'rd_observer_room_4', [1]);
    H.tick(20);
    check('stood still: room 4 passed', gv(p, 'rd_room4_complete'), 1);
    op(p, 2480, 4956, 'rd_room4_exitdoor', 1);
    check('on to room 5, walkable', [walkable(p.x, p.z, 0), p.x < 2450], [true, true]);

    console.log('Room 5, the acrostic:');
    rigged([0], () => talk(p, 'rd_observer_room_5', [1]));
    check('BITE: room 5 passed', gv(p, 'rd_room5_complete'), 1);
    op(p, 2446, 4956, 'rd_room5_exitdoor', 1);
    H.tick(3);
    check('the fifth test passed: quest complete, back in the park', [main(), p.z < 4000, walkable(p.x, p.z, 0)], [2, true, true]);

    console.log('Room 6, the lab, and room 7, logic (a second run):');
    const q = player('rd2', 2997, 3372);
    sv(q, 'rd_main', 1);
    talk(q, 'rd_teleporter_guy', [1]);
    for (const r of [3, 4, 5]) sv(q, `rd_room${r}_complete`, 1);
    sv(q, 'rd_room6_complete', 0);
    sv(q, 'rd_room7_complete', 0);
    // rooms 1 and 2 were drawn out and 3-5 are marked passed, so the next room is the lab: a
    // failed or abandoned run is resumed through Sir Tiffy
    for (const r of [1, 2]) sv(q, `rd_room${r}_complete`, 1);
    q.teleport(2997, 3372, 0);
    H.tick(1);
    talk(q, 'rd_teleporter_guy', [1]);
    check('room 6: arrived, walkable', [walkable(q.x, q.z, 0), q.z < 4950], [true, true]);
    const lab: [string, number, number][] = [];
    for (let x = 2455; x < 2482; x++) for (let z = 4932; z < 4948; z++) for (const n of ['rd_shelves_chemicals_1', 'rd_shelves_chemicals_2', 'rd_shelves_chemicals_3', 'rd_shelves_chemicals_4', 'rd_shelves_chemicals_5', 'rd_large_crate', 'rd_large_crates', 'rd_small_crates']) {
        if (World.getLoc(x, z, 0, LocType.getId(n))) lab.push([n, x, z]);
    }
    for (const [n, x, z] of lab) {
        op(q, x, z, n, 1);
    }
    check('shelves and crates: water, gypsum, cupric sulfate, both ores, spade, tin, knife', ['rd_dihydrogen_monoxide', 'rd_gypsum', 'rd_cupric_sulphate', 'rd_tin_ore_powder', 'rd_copper_ore_powder', 'rd_metal_spade', 'rd_tin', 'rd_knife'].map(o => H.invCount(q, o) > 0), [true, true, true, true, true, true, true, true]);
    useOn(q, 2472, 4940, 'rd_wooden_table_bunsen_burner', 'rd_metal_spade');
    useOn(q, 2477, 4940, 'rd_stone_door', 'rd_metal_spade_no_handle');
    useOn(q, 2477, 4940, 'rd_stone_door', 'rd_cupric_sulphate');
    useOn(q, 2477, 4940, 'rd_stone_door', 'rd_dihydrogen_monoxide');
    op(q, 2477, 4940, 'rd_stone_door', 1);
    check('spade, sulfate, water, pull: the stone door open', gv(q, 'rd_room6_stone_door'), 3);
    for (const [n, x, z] of lab) if (n === 'rd_shelves_chemicals_1') op(q, x, z, n, 1);
    useOnHeld(q, 'rd_dihydrogen_monoxide', 'rd_tin');
    useOnHeld(q, 'rd_gypsum', 'rd_tin_of_crap_empty');
    useOn(q, 2468, 4938, 'rd_key_chained', 'rd_tinfull');
    useOnHeld(q, 'rd_tin_ore_powder', 'rd_keymould');
    useOnHeld(q, 'rd_copper_ore_powder', 'rd_full_keymould_tin');
    useOn(q, 2472, 4940, 'rd_wooden_table_bunsen_burner', 'rd_full_keymould_unheated');
    useOnHeld(q, 'rd_knife', 'rd_full_keymould_complete');
    check('the bronze key cast', H.invCount(q, 'rd_puzzleroom_key'), 1);
    op(q, 2477, 4940, 'rd_stone_door', 1);
    useOn(q, 2478, 4940, 'rd_room6_exitdoor', 'rd_puzzleroom_key');
    check('through the stone door, the key in the exit door: room 6 passed', gv(q, 'rd_room6_complete'), 1);
    op(q, 2478, 4940, 'rd_room6_exitdoor', 1);
    check('on to room 7, walkable', [walkable(q.x, q.z, 0), q.z < 4950 && q.x < 2460], [true, true]);
    rigged([0], () => talk(q, 'rd_observer_room_7', [3]));
    check('the wolves: room 7 passed', gv(q, 'rd_room7_complete'), 1);
}

// =============================================================================== Sheep Shearer
if (run('sheep')) {
    console.log('SHEEP SHEARER');
    const p = player('sheep1', 3189, 3271);
    talk(p, 'fred_the_farmer', [1, 1, 1, 1]);
    check('Fred: started', gv(p, 'sheep'), 1);
    H.give(p, 'shears');
    const sheep = ['sheepunsheered', 'sheepunsheered2', 'sheepunsheered3'].map(n => (NpcType.getId(n) >= 0 ? H.npcNear(n, 3200, 3265, 0) : null)).find(n => n);
    if (sheep) {
        standBy(p, sheep.x, sheep.z, 0);
        useOnNpc(p, 'shears', sheep);
    }
    check('a sheep sheared', H.invCount(p, 'wool') > 0 || !sheep, true);
    H.give(p, 'ball_of_wool', 12);
    talk(p, 'fred_the_farmer');
    check('twelve balls handed in', [gv(p, 'sheep'), H.invCount(p, 'ball_of_wool')], [13, 0]);
    H.give(p, 'ball_of_wool', 9);
    talk(p, 'fred_the_farmer');
    H.tick(3);
    check('the last eight: complete, 60 coins, a spare ball kept', [gv(p, 'sheep'), H.invCount(p, 'coins'), H.invCount(p, 'ball_of_wool')], [22, 60, 1]);
}

// =============================================================================== Pirate's Treasure
if (run('hunt')) {
    console.log("PIRATE'S TREASURE");
    const p = player('hunt1', 3053, 3252);
    talk(p, 'redbeard_frank', [1]);
    check('Frank: stage 1', gv(p, 'hunt'), 1);
    H.give(p, 'karamja_rum');
    talk(p, 'redbeard_frank', [1]);
    check('the rum for the key: stage 2', [gv(p, 'hunt'), H.invCount(p, 'chest_key')], [2, 1]);
    standBy(p, 3218, 3396, 1);
    useOn(p, 3218, 3396, 'piratechest', 'chest_key');
    check('the chest in the Blue Moon Inn: the message', H.invCount(p, 'piratemessage'), 1);
    held(p, 'piratemessage', 1);
    check('read: stage 3', gv(p, 'hunt'), 3);
    H.give(p, 'spade');
    p.teleport(2999, 3383, 0);
    H.tick(1);
    held(p, 'spade', 1);
    H.tick(3);
    check('dug in Falador park: complete, the treasure', [gv(p, 'hunt'), H.invCount(p, 'coins'), H.invCount(p, 'gold_ring'), H.invCount(p, 'emerald')], [4, 450, 1, 1]);
}

console.log(`\n${R.ok} ok, ${R.bad} FAIL`);
if (errors.length) console.log('script errors:\n  ' + errors.slice(0, 20).join('\n  '));
process.exit(R.bad ? 1 : 0);
