// Shared helpers for the quest audit sim (audit1.ts): chat driving, loc/npc clicks with real routes,
// item-on-loc/npc, walkability floods and a dead-op scan over an area.
import * as H from './harness.js';
import World from '#/engine/World.js';
import LocType from '#/cache/config/LocType.js';
import NpcType from '#/cache/config/NpcType.js';
import ObjType from '#/cache/config/ObjType.js';
import InvType from '#/cache/config/InvType.js';
import Component from '#/cache/config/Component.js';
import ScriptState from '#/engine/script/ScriptState.js';
import ScriptRunner from '#/engine/script/ScriptRunner.js';
import ScriptPointer from '#/engine/script/ScriptPointer.js';
import ScriptProvider from '#/engine/script/ScriptProvider.js';
import ServerTriggerType from '#/engine/script/ServerTriggerType.js';
import { Interaction } from '#/engine/entity/Interaction.js';
import { PlayerQueueType } from '#/engine/entity/PlayerQueueRequest.js';
import { findPathToLoc, findPathToEntity, canTravel, isFlagged } from '#/engine/GameMap.js';
import { CollisionType, CollisionFlag } from '#/engine/routefinder/index.js';
import Player from '#/engine/entity/Player.js';
import Npc from '#/engine/entity/Npc.js';
import Loc from '#/engine/entity/Loc.js';
import { EntityLifeCycle } from '#/engine/entity/EntityLifeCycle.js';

export const R = { ok: 0, bad: 0 };
export const check = (what: string, got: unknown, want: unknown) => {
    const pass = JSON.stringify(got) === JSON.stringify(want);
    if (pass) R.ok++;
    else R.bad++;
    console.log(`  ${pass ? 'ok  ' : 'FAIL'} ${what}: ${JSON.stringify(got)}${pass ? '' : `   (want ${JSON.stringify(want)})`}`);
};

let bucket = 1;
export function player(name: string, x: number, z: number, level = 0) {
    const p = H.makePlayer(name, x, z, bucket++);
    H.tick(1);
    if (level) p.teleport(x, z, level);
    H.maxOut(p);
    H.clearInv(p);
    H.tick(1);
    return p;
}
export const at = (p: Player) => [p.x, p.z, p.level];
export const mesOf = (p: Player) => H.mesgs.filter(m => m.who === p.username).map(m => m.text);
export const lastMes = (p: Player) => mesOf(p).slice(-1)[0] ?? '';
export const mark = () => H.mesgs.length;
export const mesSince = (p: Player, from: number) =>
    H.mesgs
        .slice(from)
        .filter(m => m.who === p.username)
        .map(m => m.text);
export const said = (p: Player, from: number, s: string) => mesSince(p, from).some(m => m.includes(s));

export let chatLog: string[] = [];
/** Let a script run out, clicking through any chat pages and taking `picks` at menus (1-based). */
export function drive(p: Player, picks: (number | string)[] = [], guardTicks = 3): string[] {
    const from = H.ifaces.length;
    let idle = 0;
    for (let guard = 0; guard < 600 && idle < guardTicks; guard++) {
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
            let pick = picks.shift();
            const root = multi.split(':')[0];
            const opts: string[] = [];
            for (let i = 1; i <= 5; i++) {
                const id = Component.getId(`${root}:com_${i}`);
                const t = [...H.ifaces].reverse().find(f => f.who === p.username && f.kind === 'text' && f.com === id);
                opts.push(t?.text ?? '');
            }
            if (typeof pick === 'string') {
                const want = pick;
                const idx = opts.findIndex(o => o.toLowerCase().includes(want.toLowerCase()));
                if (idx === -1) throw new Error(`no option "${want}" in ${root}: ${opts.filter(Boolean).join(' | ')}`);
                pick = idx + 1;
            }
            if (pick === undefined) throw new Error('unexpected menu: ' + root + ': ' + opts.filter(Boolean).join(' | '));
            H.choose(p, `${root}:com_${pick}`);
        } else {
            p.executeScript(s, true, true);
        }
    }
    if (picks.length) throw new Error('menus not reached: ' + picks.join(','));
    const out = H.ifaces
        .slice(from)
        .filter(i => i.who === p.username && i.kind === 'text' && i.text && i.text.length > 1)
        .map(i => i.text!);
    chatLog = out;
    return out;
}
export const saw = (lines: string[], s: string) => lines.some(l => l.includes(s));

export function findNpc(npcName: string, p: Player): Npc {
    const npc = [p.level, 0, 1, 2, 3].map(l => H.npcNear(npcName, p.x, p.z, l)).find(n => n);
    if (!npc) throw new Error('no npc ' + npcName);
    return npc;
}
/** Talk to the nearest npc of a type (any floor), standing next to it first. */
export function talk(p: Player, npcName: string, picks: (number | string)[] = [], op = 1, teleport = true): string[] {
    const npc = findNpc(npcName, p);
    if (!teleport) {
        H.opNpc(p, npc, op);
        for (let t = 0; t < 40 && !p.activeScript; t++) H.tick(1);
        return drive(p, picks);
    }
    for (const [dx, dz] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
        [1, 1],
        [-1, -1],
        [2, 0],
        [0, 2],
        [-2, 0],
        [0, -2]
    ]) {
        p.teleport(npc.x + dx, npc.z + dz, npc.level);
        H.tick(1);
        H.opNpc(p, npc, op);
        for (let t = 0; t < 10 && !p.activeScript; t++) H.tick(1);
        if (p.activeScript) break;
    }
    return drive(p, picks);
}
function slotOf(p: Player, objName: string) {
    const obj = ObjType.getId(objName);
    if (obj === -1) throw new Error('no such obj ' + objName);
    const inv = p.getInventory(InvType.INV)!;
    for (let i = 0; i < inv.capacity; i++) if (inv.get(i)?.id === obj) return { obj, slot: i };
    throw new Error('not carrying ' + objName);
}
/** "Use" an inventory item on a loc: OpLocUHandler, with the route a client would send. */
export function useOn(p: Player, x: number, z: number, locName: string, objName: string, picks: (number | string)[] = []) {
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
    return drive(p, picks);
}
/** "Use" an inventory item on an npc: OpNpcUHandler. */
export function useOnNpc(p: Player, npcName: string, objName: string, picks: (number | string)[] = []) {
    const npc = findNpc(npcName, p);
    const { obj, slot } = slotOf(p, objName);
    p.clearPendingAction();
    p.queueWaypoints(findPathToEntity(p.level, p.x, p.z, npc.x, npc.z, p.width, npc.width, npc.length));
    p.lastUseItem = obj;
    p.lastUseSlot = slot;
    p.setInteraction(Interaction.ENGINE, npc, ServerTriggerType.APNPCU);
    (p as unknown as { opcalled: boolean }).opcalled = true;
    return drive(p, picks);
}
/** Use one held item on another: OpHeldUHandler's lookup order, swaps included. */
export function useHeld(p: Player, useName: string, onName: string, picks: (number | string)[] = []) {
    const a = slotOf(p, useName);
    const b = slotOf(p, onName);
    p.lastItem = b.obj;
    p.lastSlot = b.slot;
    p.lastUseItem = a.obj;
    p.lastUseSlot = a.slot;
    const objType = ObjType.get(b.obj);
    const useObjType = ObjType.get(a.obj);
    p.clearPendingAction();
    p.closeModal();
    const swap = () => {
        [p.lastItem, p.lastUseItem] = [p.lastUseItem, p.lastItem];
        [p.lastSlot, p.lastUseSlot] = [p.lastUseSlot, p.lastSlot];
    };
    let script = ScriptProvider.getByTriggerSpecific(ServerTriggerType.OPHELDU, objType.id, -1);
    if (!script) {
        script = ScriptProvider.getByTriggerSpecific(ServerTriggerType.OPHELDU, useObjType.id, -1);
        swap();
    }
    if (!script && objType.category !== -1) script = ScriptProvider.getByTriggerSpecific(ServerTriggerType.OPHELDU, -1, objType.category);
    if (!script && useObjType.category !== -1) {
        script = ScriptProvider.getByTriggerSpecific(ServerTriggerType.OPHELDU, -1, useObjType.category);
        swap();
    }
    if (!script) {
        p.messageGame('Nothing interesting happens.');
        return [];
    }
    p.executeScript(ScriptRunner.init(script, p), true);
    return drive(p, picks);
}
export function op(p: Player, x: number, z: number, locName: string, n = 1, picks: (number | string)[] = []) {
    H.opLoc(p, x, z, locName, n);
    return drive(p, picks);
}
export function held(p: Player, objName: string, n = 1, picks: (number | string)[] = []) {
    H.opheld(p, objName, n);
    return drive(p, picks);
}
/** Is (tx,tz) reachable on foot from (x,z)? A flood over the real collision map. */
export function connected(level: number, x: number, z: number, tx: number, tz: number, radius = 160): boolean {
    const seen = new Set<string>([x + ',' + z]);
    const q = [[x, z]];
    while (q.length) {
        const [cx, cz] = q.pop()!;
        if (Math.abs(cx - tx) + Math.abs(cz - tz) === 0) return true;
        for (const [dx, dz] of [
            [1, 0],
            [-1, 0],
            [0, 1],
            [0, -1]
        ]) {
            const nx = cx + dx,
                nz = cz + dz,
                k = nx + ',' + nz;
            if (seen.has(k) || Math.abs(nx - x) > radius || Math.abs(nz - z) > radius) continue;
            if (canTravel(level, cx, cz, dx, dz, 1, 0, CollisionType.NORMAL)) {
                seen.add(k);
                q.push([nx, nz]);
            }
        }
    }
    return false;
}
/** Can a player standing on (x,z) reach an interaction position next to the loc? */
export function reachLoc(level: number, x: number, z: number, locName: string, lx: number, lz: number, _radius = 160) {
    const id = LocType.getId(locName);
    const loc = World.getLoc(lx, lz, level, id);
    if (!loc) return false;
    const path = findPathToLoc(level, x, z, loc.x, loc.z, 1, loc.width, loc.length, loc.angle, loc.shape, LocType.get(id).forceapproach);
    if (!path.length) return false;
    const last = path[path.length - 1];
    const px = (last >> 14) & 0x3fff,
        pz = last & 0x3fff;
    // the route ends next to the loc (or on it for ground decor); compare against the loc's footprint
    const d = Math.max(Math.max(loc.x - px, 0, px - (loc.x + loc.width - 1)), Math.max(loc.z - pz, 0, pz - (loc.z + loc.length - 1)));
    return d <= 1;
}
export function walkable(level: number, x: number, z: number) {
    return !isFlagged(x, z, level, CollisionFlag.WALK_BLOCKED);
}
export function enqueue(p: Player, name: string, args: number[] = []) {
    const s = ScriptProvider.getByName(name);
    if (!s) throw new Error('no script ' + name);
    p.enqueueScript(s, PlayerQueueType.NORMAL, 0, args);
}

/** Every loc in an area whose right-click options have no trigger of their own (type or category). */
export function deadLocOps(x1: number, z1: number, x2: number, z2: number, levels = [0, 1, 2, 3]) {
    const out = new Map<string, string[]>();
    for (const level of levels) {
        for (let zx = x1 & ~7; zx <= x2; zx += 8) {
            for (let zz = z1 & ~7; zz <= z2; zz += 8) {
                const zone = World.gameMap.getZone(zx, zz, level);
                for (const loc of zone.getAllLocsUnsafe()) {
                    if (loc.x < x1 || loc.x > x2 || loc.z < z1 || loc.z > z2) continue;
                    const t = LocType.get(loc.type);
                    const variants = [t, ...t.multiloc.filter(i => i >= 0).map(i => LocType.get(i))];
                    for (let o = 0; o < 5; o++) {
                        const labels = variants.map(v => v.op?.[o]).filter(l => l && l !== 'hidden');
                        if (!labels.length) continue;
                        // an ap trigger alone answers the op too: Player.ts runs it when there is no op trigger
                        const has = [ServerTriggerType.OPLOC1 + o, ServerTriggerType.APLOC1 + o].some(trig => ScriptProvider.getByTriggerSpecific(trig, t.id, -1) || (t.category !== -1 && ScriptProvider.getByTriggerSpecific(trig, -1, t.category)));
                        if (has) continue;
                        const k = `${t.debugname} op${o + 1}=${[...new Set(labels)].join('/')}`;
                        if (!out.has(k)) out.set(k, []);
                        out.get(k)!.push(`${loc.x},${loc.z},${level}`);
                    }
                }
            }
        }
    }
    return out;
}
export function deadNpcOps(x1: number, z1: number, x2: number, z2: number) {
    const out = new Map<string, string[]>();
    for (const npc of World.npcs) {
        if (!npc || npc.x < x1 || npc.x > x2 || npc.z < z1 || npc.z > z2) continue;
        const t = NpcType.get(npc.type);
        const variants = [t, ...t.multinpc.filter(i => i >= 0).map(i => NpcType.get(i))];
        for (let o = 0; o < 5; o++) {
            const labels = variants.map(v => v.op?.[o]).filter(l => l && l !== 'hidden');
            if (!labels.length) continue;
            if (labels.every(l => /attack/i.test(l!))) continue;
            // an ap trigger alone answers the op too: Player.ts runs it when there is no op trigger
            const has = [ServerTriggerType.OPNPC1 + o, ServerTriggerType.APNPC1 + o].some(trig => ScriptProvider.getByTriggerSpecific(trig, t.id, -1) || (t.category !== -1 && ScriptProvider.getByTriggerSpecific(trig, -1, t.category)));
            if (has) continue;
            const k = `${t.debugname} op${o + 1}=${[...new Set(labels)].join('/')}`;
            if (!out.has(k)) out.set(k, []);
            out.get(k)!.push(`${npc.x},${npc.z},${npc.level}`);
        }
    }
    return out;
}
export function printDead(title: string, x1: number, z1: number, x2: number, z2: number, levels = [0, 1, 2, 3]) {
    console.log(`-- dead ops: ${title}`);
    for (const [k, v] of deadLocOps(x1, z1, x2, z2, levels)) console.log(`   loc ${k}  x${v.length} ${v.slice(0, 4).join(' ')}`);
    for (const [k, v] of deadNpcOps(x1, z1, x2, z2)) console.log(`   npc ${k}  x${v.length} ${v.slice(0, 4).join(' ')}`);
}
export function locsNamed(name: string, x1: number, z1: number, x2: number, z2: number, levels = [0, 1, 2, 3]) {
    const id = LocType.getId(name);
    const out: number[][] = [];
    for (const level of levels)
        for (let zx = x1 & ~7; zx <= x2; zx += 8)
            for (let zz = z1 & ~7; zz <= z2; zz += 8) for (const loc of World.gameMap.getZone(zx, zz, level).getAllLocsUnsafe()) if (loc.type === id && loc.x >= x1 && loc.x <= x2 && loc.z >= z1 && loc.z <= z2) out.push([loc.x, loc.z, level]);
    return out;
}
export { H, World, LocType, NpcType, ObjType, ScriptProvider, ServerTriggerType, Player, Npc };
/** An ASCII picture of an area: '#' blocked tile, 'o' reached on foot from (sx,sz), '.' free but not reached. */
export function ascii(level: number, x1: number, z1: number, x2: number, z2: number, sx: number, sz: number) {
    const seen = new Set<string>([sx + ',' + sz]);
    const q = [[sx, sz]];
    while (q.length) {
        const [cx, cz] = q.pop()!;
        for (const [dx, dz] of [
            [1, 0],
            [-1, 0],
            [0, 1],
            [0, -1]
        ]) {
            const nx = cx + dx,
                nz = cz + dz,
                k = nx + ',' + nz;
            if (seen.has(k) || nx < x1 - 20 || nx > x2 + 20 || nz < z1 - 20 || nz > z2 + 20) continue;
            if (canTravel(level, cx, cz, dx, dz, 1, 0, CollisionType.NORMAL)) {
                seen.add(k);
                q.push([nx, nz]);
            }
        }
    }
    const rows: string[] = [];
    for (let z = z2; z >= z1; z--) {
        let row = String(z).padStart(5) + ' ';
        for (let x = x1; x <= x2; x++) row += seen.has(x + ',' + z) ? 'o' : walkable(level, x, z) ? '.' : '#';
        rows.push(row);
    }
    rows.push('      ' + Array.from({ length: x2 - x1 + 1 }, (_, i) => String((x1 + i) % 10)).join(''));
    return rows.join('\n');
}

/** Fight an npc to the death with real combat. Returns whether it died. */
export function fight(p: Player, npc: Npc, maxTicks = 600): boolean {
    if (Math.max(Math.abs(p.x - npc.x), Math.abs(p.z - npc.z)) > 2 || p.level !== npc.level) {
        p.teleport(npc.x + npc.width, npc.z, npc.level);
        H.tick(1);
    }
    H.attackNpc(p, npc);
    for (let t = 0; t < maxTicks; t++) {
        H.tick(1);
        if (!npc.isActive || npc.levels[3] === 0) {
            H.tick(3);
            return true;
        }
        if (!p.target && !p.delayed && t % 6 === 5) H.attackNpc(p, npc);
        if (p.levels[3] < 50) p.levels[3] = 99;
    }
    return false;
}
/** Pick up a ground obj at the player's feet or next to it (the take op, minus the route). */
export function take(p: Player, objName: string, radius = 3): boolean {
    const id = ObjType.getId(objName);
    for (let dx = -radius; dx <= radius; dx++)
        for (let dz = -radius; dz <= radius; dz++) {
            const o = World.getObj(p.x + dx, p.z + dz, p.level, id, p.hash64 ?? -1n) ?? World.getObj(p.x + dx, p.z + dz, p.level, id, -1n);
            if (o) {
                World.removeObj(o, 0);
                H.give(p, objName, o.count);
                return true;
            }
        }
    return false;
}
/** Run a proc the way an op script would: with protected access to the player. */
export function runProcProtected(p: Player, name: string, args: any[] = []) {
    const script = ScriptProvider.getByName(name);
    if (!script) throw new Error('no such script: ' + name);
    const state = ScriptRunner.init(script, p, null, args);
    state.pointerAdd(ScriptPointer.ProtectedActivePlayer);
    p.protect = true;
    ScriptRunner.execute(state);
    p.protect = false;
}
/** Put a loc into the world (a fire to cook on, say). */
export function addLoc(name: string, x: number, z: number, level = 0, shape = 10, duration = 500) {
    const t = LocType.get(LocType.getId(name));
    const loc = new Loc(level, x, z, t.width, t.length, EntityLifeCycle.DESPAWN, t.id, shape, 0);
    World.addLoc(loc, duration);
    return loc;
}
