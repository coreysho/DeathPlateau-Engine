// Shared helpers for the Fremennik Trials sims (port349_viking.ts, fremtrials.ts, fremtrials2.ts):
// players on the quest, clicking through dialogue, talking, using items on locs, npcs and each
// other the way the packet handlers do, and 349's %viking_bits layout.
import * as H from './harness.js';
import Component from '#/cache/config/Component.js';
import ScriptState from '#/engine/script/ScriptState.js';
import ScriptProvider from '#/engine/script/ScriptProvider.js';
import ScriptRunner from '#/engine/script/ScriptRunner.js';
import ServerTriggerType from '#/engine/script/ServerTriggerType.js';
import ObjType from '#/cache/config/ObjType.js';
import LocType from '#/cache/config/LocType.js';
import InvType from '#/cache/config/InvType.js';
import NpcType from '#/cache/config/NpcType.js';
import World from '#/engine/World.js';
import Player from '#/engine/entity/Player.js';
import Npc from '#/engine/entity/Npc.js';
import { Interaction } from '#/engine/entity/Interaction.js';
import { findPathToLoc, findPathToEntity, canTravel, isFlagged } from '#/engine/GameMap.js';
import { CollisionType, CollisionFlag } from '#/engine/routefinder/index.js';

export const R = { ok: 0, bad: 0 };
export const check = (what: string, got: unknown, want: unknown) => {
    const pass = JSON.stringify(got) === JSON.stringify(want);
    if (pass) R.ok++;
    else R.bad++;
    console.log(`  ${pass ? 'ok  ' : 'FAIL'} ${what}: ${JSON.stringify(got)}${pass ? '' : `   (want ${JSON.stringify(want)})`}`);
};

/** Every console.error the engine prints (a script error is reported there) - read it at the end. */
export const errors: string[] = [];
const origErr = console.error;
console.error = (...a: unknown[]) => {
    errors.push(a.map(x => (x instanceof Error ? x.stack ?? x.message : String(x))).join(' '));
    origErr(...a);
};

/** Overhead text from npcs (the harness only records players'). */
export const npcSays: { who: string; text: string }[] = [];
const origNpcSay = (Npc.prototype as any).say;
(Npc.prototype as any).say = function (text: string) {
    npcSays.push({ who: NpcType.get(this.type).debugname ?? '', text });
    return origNpcSay.call(this, text);
};

// ---- 349's %viking_bits layout (quest_viking.constant) ----
export const RANGE: Record<string, [number, number]> = {
    seerdoor: [3, 5], swensen: [10, 11], reveller: [12, 13], sigli: [14, 15], thorvald: [16, 17], peer: [18, 19], olaf: [20, 22], sigmund: [23, 26]
};
export const BIT = { firecracker: 0, poisonsalesman: 1, lowalc: 2, reddisk1: 6, reddisk2: 7, chest: 8, learnedOlaf: 9, cabbage: 27, onion: 28, rock: 29, potato: 30 };
export const bits = (p: Player) => H.getVar(p, 'viking_bits');
export const bit = (p: Player, n: number) => (bits(p) >>> n) & 1;
export const stage = (p: Player, trial: string) => {
    const [lo, hi] = RANGE[trial];
    return (bits(p) >>> lo) & ((1 << (hi - lo + 1)) - 1);
};
export const setStage = (p: Player, trial: string, v: number) => {
    const [lo, hi] = RANGE[trial];
    const mask = ((1 << (hi - lo + 1)) - 1) << lo;
    H.setVar(p, 'viking_bits', (bits(p) & ~mask) | (v << lo));
};
export const setBit = (p: Player, n: number) => H.setVar(p, 'viking_bits', bits(p) | (1 << n));
export const viking = (p: Player) => H.getVar(p, 'viking');
export const at = (p: Player) => [p.x, p.z, p.level];

let bucket = 20;
/** A player standing at (x, z), maxed, empty-handed, with %viking and %viking_bits as given. */
export function player(name: string, x: number, z: number, vikingStage = 0, level = 0): Player {
    const p = H.makePlayer(name, x, z, bucket++);
    H.tick(1);
    if (level) p.teleport(x, z, level);
    H.maxOut(p);
    H.clearInv(p);
    H.setVar(p, 'viking', vikingStage);
    H.setVar(p, 'viking_bits', 0);
    H.tick(1);
    return p;
}

/** Click through whatever the player has open: continue on every page, `picks` at menus (1-based). */
export function drain(p: Player, picks: number[] = [], maxTicks = 60) {
    let idle = 0;
    for (let guard = 0; guard < 600 && idle < maxTicks; guard++) {
        const s = p.activeScript as any;
        if (!s || s.execution !== ScriptState.PAUSEBUTTON) {
            if (!s && !p.delayed && idle > 3 && !p.target && !p.hasWaypoints()) break;
            H.tick(1);
            idle++;
            continue;
        }
        idle = 0;
        const names = (p as any).resumeButtons.map((id: number) => Component.get(id).comName ?? '');
        const open = (p as any).modalChat === -1 ? '' : Component.get((p as any).modalChat).comName ?? '';
        const multi = open.startsWith('multi') ? names.find((n: string) => n.startsWith(open + ':')) : null;
        if (multi) {
            const pick = picks.shift();
            if (pick === undefined) throw new Error('unexpected menu: ' + names.join(','));
            H.choose(p, `${multi.split(':')[0]}:com_${pick}`);
        } else {
            p.executeScript(s, true, true);
        }
    }
    H.tick(1);
    return picks.length; // menus that never came up
}

export const text = (p: Player, from: number) =>
    H.ifaces.slice(from).filter(i => i.who === p.username && i.kind === 'text').map(i => i.text ?? '').join(' | ').replace(/\|/g, ' ').replace(/\s+/g, ' ');
export const mesSince = (p: Player, from: number) => H.mesgs.slice(from).filter(m => m.who === p.username).map(m => m.text);
export const has = (t: string, s: string) => t.includes(s);

/** Talk to the nearest npc of this type, from a tile next to it. Returns the text shown. */
export function talk(p: Player, npcName: string, picks: number[] = []): string {
    const npc = H.npcNear(npcName, p.x, p.z, p.level) ?? [0, 1, 2, 3].map(l => H.npcNear(npcName, p.x, p.z, l)).find(n => n);
    if (!npc) throw new Error('no npc ' + npcName);
    const from = H.ifaces.length;
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1]]) {
        p.teleport(npc.x + dx, npc.z + dz, npc.level);
        H.tick(1);
        H.opNpc(p, npc, 1);
        for (let t = 0; t < 12 && !p.activeScript; t++) H.tick(1);
        if (p.activeScript) break;
    }
    const left = drain(p, picks);
    if (left) throw new Error(`${npcName}: ${left} menu pick(s) unused`);
    return text(p, from);
}

/** Click an op on a loc at absolute (x, z) on the player's level, with a real route. */
export function clickLoc(p: Player, x: number, z: number, locName: string, op: number, picks: number[] = []) {
    const from = H.ifaces.length;
    H.tick(2);
    H.opLoc(p, x, z, locName, op);
    drain(p, picks);
    return text(p, from);
}

export function slotOf(p: Player, objName: string) {
    const id = ObjType.getId(objName);
    const inv = p.getInventory(InvType.INV)!;
    for (let i = 0; i < inv.capacity; i++) if (inv.get(i)?.id === id) return i;
    throw new Error('not carrying ' + objName);
}

/** OpLocUHandler: use an item on a loc at absolute (x, z), with a real route. */
export function useOnLoc(p: Player, x: number, z: number, locName: string, objName: string, picks: number[] = []) {
    const id = LocType.getId(locName);
    const loc = World.getLoc(x, z, p.level, id);
    if (!loc) throw new Error(`no ${locName} at ${x},${z},${p.level}`);
    const from = H.ifaces.length;
    p.clearPendingAction();
    p.lastUseItem = ObjType.getId(objName);
    p.lastUseSlot = slotOf(p, objName);
    p.queueWaypoints(findPathToLoc(p.level, p.x, p.z, loc.x, loc.z, p.width, loc.width, loc.length, loc.angle, loc.shape, LocType.get(id).forceapproach));
    p.setInteraction(Interaction.ENGINE, loc, ServerTriggerType.APLOCU);
    (p as any).opcalled = true;
    drain(p, picks);
    return text(p, from);
}

/** OpNpcUHandler. */
export function useOnNpc(p: Player, npcName: string, objName: string, picks: number[] = []) {
    const npc = H.npcNear(npcName, p.x, p.z, p.level)!;
    p.teleport(npc.x + 1, npc.z, npc.level);
    H.tick(1);
    const from = H.ifaces.length;
    p.clearPendingAction();
    p.lastUseItem = ObjType.getId(objName);
    p.lastUseSlot = slotOf(p, objName);
    p.queueWaypoints(findPathToEntity(p.level, p.x, p.z, npc.x, npc.z, p.width, npc.width, npc.length));
    p.setInteraction(Interaction.ENGINE, npc, ServerTriggerType.APNPCU);
    (p as any).opcalled = true;
    drain(p, picks);
    return text(p, from);
}

/** OpHeldUHandler: `used` picked with Use, clicked on `target`; the target's trigger first. */
export function useHeld(p: Player, usedName: string, targetName: string, picks: number[] = []) {
    const target = ObjType.getId(targetName);
    const used = ObjType.getId(usedName);
    const from = H.ifaces.length;
    p.lastItem = target;
    p.lastSlot = slotOf(p, targetName);
    p.lastUseItem = used;
    p.lastUseSlot = slotOf(p, usedName);
    p.clearPendingAction();
    let script = ScriptProvider.getByTriggerSpecific(ServerTriggerType.OPHELDU, target, -1);
    if (!script) {
        script = ScriptProvider.getByTriggerSpecific(ServerTriggerType.OPHELDU, used, -1);
        [p.lastItem, p.lastUseItem] = [p.lastUseItem, p.lastItem];
        [p.lastSlot, p.lastUseSlot] = [p.lastUseSlot, p.lastSlot];
    }
    if (!script) {
        p.messageGame('Nothing interesting happens.');
        return '';
    }
    p.executeScript(ScriptRunner.init(script, p), true);
    drain(p, picks);
    return text(p, from);
}

/** OpHeldHandler, then click through. */
export function held(p: Player, objName: string, op: number, picks: number[] = []) {
    const from = H.ifaces.length;
    H.opheld(p, objName, op);
    drain(p, picks);
    return text(p, from);
}

/** OpObjHandler: an op on a ground obj at absolute (x, z). */
export function opObj(p: Player, x: number, z: number, objName: string, op: number) {
    const id = ObjType.getId(objName);
    const obj = World.getObj(x, z, p.level, id, p.hash64);
    if (!obj) throw new Error(`no ${objName} at ${x},${z}`);
    p.clearPendingAction();
    p.queueWaypoints(findPathToEntity(p.level, p.x, p.z, obj.x, obj.z, 1, 1, 1));
    p.setInteraction(Interaction.ENGINE, obj, ServerTriggerType.APOBJ1 + (op - 1));
    (p as any).opcalled = true;
    drain(p);
}

/** Every live npc of a type anywhere. */
export function npcsOf(npcName: string): Npc[] {
    const id = NpcType.getId(npcName);
    const out: Npc[] = [];
    for (const npc of World.npcs) if (npc && npc.isActive && npc.type === id) out.push(npc);
    return out;
}

/** Tick until `f` holds (or `max` ticks pass); returns whether it did. */
export function until(f: () => boolean, max = 200) {
    for (let i = 0; i < max; i++) {
        if (f()) return true;
        H.tick(1);
    }
    return f();
}

export function done() {
    const scriptErrors = errors.filter(e => /script|Error|error/.test(e));
    check('no script errors', scriptErrors.slice(0, 3), []);
    console.log(`\n${R.ok} ok, ${R.bad} FAIL`);
    process.exit(R.bad ? 1 : 0);
}

/** Run a script by name with protected access, the way the login trigger runs ~port349_login. */
export function runProtected(p: Player, name: string) {
    const script = ScriptProvider.getByName(name);
    if (!script) throw new Error('no such script: ' + name);
    p.executeScript(ScriptRunner.init(script, p), true);
}

/** Every tile a player at (x, z) can walk to within `radius`, as "x,z" keys. */
export function reachSet(level: number, x: number, z: number, radius = 20): Set<string> {
    const seen = new Set<string>([x + ',' + z]);
    const q = [[x, z]];
    while (q.length) {
        const [cx, cz] = q.pop()!;
        for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            const nx = cx + dx, nz = cz + dz, k = nx + ',' + nz;
            if (seen.has(k) || Math.abs(nx - x) > radius || Math.abs(nz - z) > radius) continue;
            if (canTravel(level, cx, cz, dx, dz, 1, 0, CollisionType.NORMAL)) { seen.add(k); q.push([nx, nz]); }
        }
    }
    return seen;
}
export const walkable = (level: number, x: number, z: number) => !isFlagged(x, z, level, CollisionFlag.WALK_BLOCKED);
