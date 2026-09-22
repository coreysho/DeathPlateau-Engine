// A PvP/PvM simulation harness that drives the REAL engine: real World.cycle(), real compiled
// content scripts, real map. Nothing here models the engine - it boots it and steps it by hand.
import World from '#/engine/World.js';
import Player from '#/engine/entity/Player.js';
import Npc from '#/engine/entity/Npc.js';
import ScriptProvider from '#/engine/script/ScriptProvider.js';
import ScriptRunner from '#/engine/script/ScriptRunner.js';
import ObjType from '#/cache/config/ObjType.js';
import ParamType from '#/cache/config/ParamType.js';
import LocType from '#/cache/config/LocType.js';
import CategoryType from '#/cache/config/CategoryType.js';
import NpcType from '#/cache/config/NpcType.js';
import InvType from '#/cache/config/InvType.js';
import VarPlayerType from '#/cache/config/VarPlayerType.js';
import VarBitType from '#/cache/config/VarBitType.js';
import VarNpcType from '#/cache/config/VarNpcType.js';
import Component from '#/cache/config/Component.js';
import SynthSound from '#/network/game/server/model/SynthSound.js';
import IfOpenMain from '#/network/game/server/model/IfOpenMain.js';
import IfSetText from '#/network/game/server/model/IfSetText.js';
import ServerGameMessage from '#/network/game/server/ServerGameMessage.js';
import fs from 'fs';
import Environment from '#/util/Environment.js';
import { NpcMode } from '#/engine/entity/NpcMode.js';
import { PlayerStatMap } from '#/engine/entity/PlayerStat.js';
import { toBase37 } from '#/util/JString.js';
import { EntityLifeCycle } from '#/engine/entity/EntityLifeCycle.js';
import { Interaction } from '#/engine/entity/Interaction.js';
import ServerTriggerType from '#/engine/script/ServerTriggerType.js';

export type Hit = { tick: number; who: string; damage: number; type: number };
export type Say = { tick: number; who: string; text: string };
export type Sound = { tick: number; who: string; synth: string; loops: number; delay: number };
export type Iface = { tick: number; who: string; kind: 'open' | 'text'; com: number; text?: string };

export const hits: Hit[] = [];
export const anims: { tick: number; who: string; seq: number }[] = [];
export const mesgs: Say[] = [];
export const sounds: Sound[] = [];
export const ifaces: Iface[] = [];

let booted = false;

// id -> name straight out of the content's pack file, so sounds print as names rather than numbers.
let synthNames: Map<number, string> | null = null;
function synthName(id: number): string {
    if (!synthNames) {
        synthNames = new Map();
        try {
            for (const line of fs.readFileSync(`${Environment.BUILD_SRC_DIR}/pack/synth.pack`, 'ascii').split(/\r?\n/)) {
                const eq = line.indexOf('=');
                if (eq > 0) synthNames.set(parseInt(line.slice(0, eq)), line.slice(eq + 1));
            }
        } catch {
            // no pack file reachable - ids will do
        }
    }
    return synthNames.get(id) ?? String(id);
}

export async function boot() {
    if (booted) return;
    await World.start(false, false);
    booted = true;

    // Record every hitsplat at the moment it is applied. applyDamage is the single chokepoint for
    // player damage in the engine (Player.applyDamage), so this catches melee, ranged, magic,
    // specials, poison and burns alike, with the tick it actually landed on.
    const origApply = (Player.prototype as any).applyDamage;
    (Player.prototype as any).applyDamage = function (damage: number, type: number) {
        hits.push({ tick: World.currentTick, who: this.username, damage, type });
        return origApply.call(this, damage, type);
    };
    const origAnim = (Player.prototype as any).playAnimation;
    (Player.prototype as any).playAnimation = function (seq: number, delay: number) {
        if (seq !== -1) anims.push({ tick: World.currentTick, who: this.username, seq });
        return origAnim.call(this, seq, delay);
    };
    // WARM UP PAST TICK 8. Half the combat guards in the content are of the form
    // `if (add(%lastcombat, 8) > map_clock)`, and on a world that has only just started map_clock
    // is 0-4 - so an untouched player reads as "in combat two seconds ago" and monsters refuse to
    // engage them. Real worlds are never in that state; a warm-up puts the clock where it belongs.
    for (let i = 0; i < 30; i++) World.cycle();

    // Every sound the server asks a client to play. Player.write is called before its
    // not-connected early return, so this catches them even with no socket on the other end.
    const origWrite = (Player.prototype as any).write;
    (Player.prototype as any).write = function (message: ServerGameMessage) {
        if (message instanceof IfOpenMain) {
            ifaces.push({ tick: World.currentTick, who: this.username, kind: 'open', com: message.component });
        }
        if (message instanceof IfSetText) {
            ifaces.push({ tick: World.currentTick, who: this.username, kind: 'text', com: message.component, text: message.text });
        }
        if (message instanceof SynthSound) {
            sounds.push({
                tick: World.currentTick,
                who: this.username,
                synth: synthName(message.synth),
                loops: message.loops,
                delay: message.delay
            });
        }
        return origWrite.call(this, message);
    };

    const origMes = (Player.prototype as any).messageGame;
    (Player.prototype as any).messageGame = function (msg: string) {
        mesgs.push({ tick: World.currentTick, who: this.username, text: msg });
        return origMes.call(this, msg);
    };
}

export function clearLogs() {
    ifaces.length = 0;
    sounds.length = 0;
    hits.length = 0;
    anims.length = 0;
    mesgs.length = 0;
}

/** Create a maxed player standing at (x, z). `ip` decides their bucket in World.playerLoop. */
export function makePlayer(name: string, x: number, z: number, ip: number = 2130706433): Player {
    const p = new Player(name, toBase37(name), BigInt(Math.floor(Math.random() * 1e9)));
    p.teleport(x, z, 0);
    (p as any).__ip = ip;
    World.newPlayers.add(p);
    return p;
}

/** World.processLogins buckets by IP; this forces a known bucket so loop order is controllable. */
export function loginOrder(...players: Player[]) {
    // players are logged in by the order they were added to newPlayers, but bucketed by ip.
    // We patch playerLoop.add via the ip we stashed on the player.
    const orig = (World.playerLoop as any).add.bind(World.playerLoop);
    (World.playerLoop as any).add = (key: bigint, value: any) => {
        const ip = (value as any).__ip;
        orig(typeof ip === 'number' ? BigInt(ip) : key, value);
    };
    void players;
}

export function maxOut(p: Player) {
    for (const [, stat] of PlayerStatMap) {
        p.setLevel(stat, 99);
    }
}

export function equip(p: Player, slots: Record<string, string>) {
    const wearpos: Record<string, number> = {
        hat: 0,
        back: 1,
        front: 2,
        rhand: 3,
        torso: 4,
        lhand: 5,
        arms: 6,
        legs: 7,
        head: 8,
        hands: 9,
        feet: 10,
        jaw: 11,
        ring: 12,
        quiver: 13
    };
    for (const [slot, objName] of Object.entries(slots)) {
        const obj = ObjType.getId(objName);
        if (obj === -1) throw new Error('no such obj: ' + objName);
        p.invSet(InvType.WORN, obj, 1, wearpos[slot]);
    }
}

/** Every obj debugname that carries the named param - for sweeping a whole content family. */
export function objNamesByParam(paramName: string): string[] {
    const param = ParamType.getId(paramName);
    if (param === -1) throw new Error('no such param: ' + paramName);
    const out: string[] = [];
    for (const [name, id] of ObjType.configNames) {
        if (ObjType.get(id).params?.has(param)) out.push(name);
    }
    return out.sort();
}

/** Is this loc wired for cooking - by category, or by a trigger of its own? */
export function locCookInfo(locName: string): { category: string | null; cooks: boolean; ownHandler: boolean } {
    const id = LocType.getId(locName);
    if (id === -1) throw new Error('no such loc: ' + locName);
    const type = LocType.get(id);
    const category = type.category === -1 ? null : (CategoryType.get(type.category)?.debugname ?? String(type.category));
    const own = ScriptProvider.getByTriggerSpecific(ServerTriggerType.APLOCU, id, -1) !== undefined || ScriptProvider.getByTriggerSpecific(ServerTriggerType.OPLOCU, id, -1) !== undefined;
    const byCategory = ScriptProvider.getByTrigger(ServerTriggerType.OPLOCU, id, type.category) !== undefined;
    return { category, cooks: own || byCategory, ownHandler: own };
}

/** The npc currently in this player's follower slot, if any. */
export function followerOf(p: Player): Npc | null {
    const v = VarPlayerType.getByName('follower_uid');
    if (!v) throw new Error('no follower_uid varp');
    const uid = p.getVar(v.id) as number;
    for (const npc of World.npcs) {
        if (npc && npc.uid === uid && npc.isActive) return npc;
    }
    return null;
}

export function clearInv(p: Player) {
    const inv = p.getInventory(InvType.INV)!;
    for (let i = 0; i < inv.capacity; i++) {
        if (inv.get(i)) p.invDelSlot(InvType.INV, i);
    }
}

export function give(p: Player, objName: string, count = 1) {
    const obj = ObjType.getId(objName);
    if (obj === -1) throw new Error('no such obj: ' + objName);
    p.invAdd(InvType.INV, obj, count);
}

export function runProc(p: Player, name: string, args: any[] = [], secondary?: Player): number[] {
    const script = ScriptProvider.getByName(name);
    if (!script) throw new Error('no such script: ' + name);
    const state = ScriptRunner.init(script, p, secondary ?? null, args);
    ScriptRunner.execute(state);
    return (state as any).intStack.slice(0, (state as any).isp);
}

/**
 * What the client's "Attack" click does: OpPlayerHandler, minus the visibility checks.
 * Returns false when the click is thrown away, which is what the real handler does to any click
 * made while the player is delayed.
 */
export function attack(p: Player, target: Player) {
    if (p.delayed) return false;
    p.clearPendingAction();
    // OpPlayerHandler sends APPLAYER1 + (op - 1); the engine derives the op trigger from it as
    // targetOp + 7. Passing OPPLAYER2 here instead looks right and is not: it makes getOpTrigger
    // look up trigger 102, which does not exist.
    p.setInteraction(Interaction.ENGINE, target, ServerTriggerType.APPLAYER1 + 1);
    (p as unknown as { opcalled: boolean }).opcalled = true;
    return true;
}

export function attackNpc(p: Player, target: Npc) {
    if (p.delayed) return false;
    p.clearPendingAction();
    p.setInteraction(Interaction.ENGINE, target, ServerTriggerType.APNPC1 + 1);
    (p as unknown as { opcalled: boolean }).opcalled = true;
    return true;
}

/** What the client's inventory right-click does: OpHeldHandler, minus the client validation. */
export function opheld(p: Player, objName: string, op: number) {
    if (p.delayed) return false; // OpHeldHandler: "normal: cannot interact while delayed"
    const id = ObjType.getId(objName);
    if (id === -1) throw new Error('no such obj: ' + objName);
    const inv = p.getInventory(InvType.INV)!;
    let slot = -1;
    for (let i = 0; i < inv.capacity; i++) {
        if (inv.get(i)?.id === id) {
            slot = i;
            break;
        }
    }
    if (slot === -1) throw new Error('not carrying ' + objName);
    const obj = ObjType.get(id);
    p.lastItem = id;
    p.lastSlot = slot;
    p.closeModal();
    p.moveClickRequest = false;
    const trigger = ServerTriggerType.OPHELD1 + (op - 1);
    const script = ScriptProvider.getByTrigger(trigger, obj.id, obj.category);
    if (!script) throw new Error('no opheld' + op + ' trigger for ' + objName);
    p.executeScript(ScriptRunner.init(script, p), true);
    return true;
}

/**
 * What a minimap/step click does. World.processClientsIn throws the whole path away when the
 * player is delayed ("player.unsetMapFlag(); continue;"), so this does too - that discard IS the
 * "can't move after eating" bug, and a harness that quietly walks anyway cannot show it.
 */
export function walkTo(p: Player, x: number, z: number) {
    if (p.delayed) {
        p.unsetMapFlag();
        return false;
    }
    p.clearPendingAction();
    p.queueWaypoint(x, z);
    p.moveClickRequest = !p.busy();
    return true;
}

export function setVar(p: Player, varpName: string, value: number) {
    const v = VarPlayerType.getByName(varpName);
    if (!v) throw new Error('no such varp: ' + varpName);
    p.setVar(v.id, value);
}

/** Run a script with an npc as the active npc and a player as the active player. */
export function runNpcProc(npc: Npc, name: string, player: Player | null = null, args: any[] = []) {
    const script = ScriptProvider.getByName(name);
    if (!script) throw new Error('no such script: ' + name);
    const state = ScriptRunner.init(script, npc, player, args);
    ScriptRunner.execute(state);
}

/** What clicking a component does: IfButtonHandler, minus the visibility check. */
export function ifButton(p: Player, comName: string) {
    const comId = Component.getId(comName);
    if (comId === -1) throw new Error('no such component: ' + comName);
    const com = Component.get(comId);
    p.lastCom = comId;
    const script = ScriptProvider.getByTriggerSpecific(ServerTriggerType.IF_BUTTON, comId, -1);
    if (!script) throw new Error('no if_button trigger for ' + comName);
    const root = Component.get(com.rootLayer);
    p.executeScript(ScriptRunner.init(script, p), root.overlay == false);
    return true;
}

export function hasScript(name: string) {
    return ScriptProvider.getByName(name) !== undefined;
}

/** npc_setmode's own behaviour: set the mode and target the active player. */
export function setNpcMode(npc: Npc, mode: 'OPPLAYER2' | 'APPLAYER2', target: Player) {
    npc.setInteraction(Interaction.SCRIPT, target, mode === 'OPPLAYER2' ? NpcMode.OPPLAYER2 : NpcMode.APPLAYER2);
}

export function setNpcVar(npc: Npc, name: string, value: number) {
    const v = VarNpcType.getByName(name);
    if (!v) throw new Error('no such varn: ' + name);
    npc.setVar(v.id, value);
}

export function setVarBit(p: Player, name: string, value: number) {
    const v = VarBitType.getByName(name);
    if (!v) throw new Error('no such varbit: ' + name);
    p.setVarBit(v.id, value);
}

export function getVarBit(p: Player, name: string): number {
    const v = VarBitType.getByName(name);
    if (!v) throw new Error('no such varbit: ' + name);
    return p.getVarBit(v.id);
}

export function getVar(p: Player, varpName: string): number {
    const v = VarPlayerType.getByName(varpName);
    if (!v) throw new Error('no such varp: ' + varpName);
    return p.getVar(v.id) as number;
}

export function addNpc(npcName: string, x: number, z: number): Npc {
    return addNpcAt(npcName, x, z, 0);
}

export function addNpcAt(npcName: string, x: number, z: number, level: number): Npc {
    const id = NpcType.getId(npcName);
    if (id === -1) throw new Error('no such npc: ' + npcName);
    const type = NpcType.get(id);
    const npc = new Npc(level, x, z, type.size, type.size, EntityLifeCycle.DESPAWN, World.getNextNid(), type.id, type.blockwalk);
    World.addNpc(npc, 5000);
    return npc;
}

/** Take a player out of the world immediately - logout() is only a request. */
export function despawn(...players: Player[]) {
    for (const p of players) {
        World.removePlayer(p);
    }
}

export function tick(n = 1) {
    for (let i = 0; i < n; i++) World.cycle();
}

export function soundsFor(name: string) {
    return sounds.filter(s => s.who === name);
}

export function hitsFor(name: string) {
    return hits.filter(h => h.who === name);
}

export function timeline(names: string[], from: number, to: number): string[] {
    const out: string[] = [];
    for (let t = from; t <= to; t++) {
        const parts: string[] = [];
        for (const n of names) {
            const hs = hits.filter(h => h.tick === t && h.who === n);
            if (hs.length) parts.push(`${n}<-${hs.map(h => h.damage).join('+')}`);
        }
        if (parts.length) out.push(`  t${String(t).padStart(3)}  ${parts.join('   ')}`);
    }
    return out;
}
