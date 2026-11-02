import { isHiddenOp } from '#/cache/config/OpVisibility.js';
import Component, { ComActionTarget } from '#/cache/config/Component.js';
import InvType from '#/cache/config/InvType.js';
import NpcType from '#/cache/config/NpcType.js';
import ObjType from '#/cache/config/ObjType.js';
import BotPlayer from '#/engine/bot/BotPlayer.js';
import { findPath, findPathToEntity } from '#/engine/GameMap.js';
import { Interaction } from '#/engine/entity/Interaction.js';
import Npc from '#/engine/entity/Npc.js';
import Obj from '#/engine/entity/Obj.js';
import Player from '#/engine/entity/Player.js';
import ServerTriggerType from '#/engine/script/ServerTriggerType.js';
import World from '#/engine/World.js';
import IfButtonHandler from '#/network/game/client/handler/IfButtonHandler.js';
import InvButtonHandler from '#/network/game/client/handler/InvButtonHandler.js';
import MoveClickHandler from '#/network/game/client/handler/MoveClickHandler.js';
import OpHeldHandler from '#/network/game/client/handler/OpHeldHandler.js';
import OpHeldUHandler from '#/network/game/client/handler/OpHeldUHandler.js';
import OpLocHandler from '#/network/game/client/handler/OpLocHandler.js';
import OpObjHandler from '#/network/game/client/handler/OpObjHandler.js';
import InvButtonDHandler from '#/network/game/client/handler/InvButtonDHandler.js';
import OpHeldTHandler from '#/network/game/client/handler/OpHeldTHandler.js';
import OpLocTHandler from '#/network/game/client/handler/OpLocTHandler.js';
import OpLocUHandler from '#/network/game/client/handler/OpLocUHandler.js';
import OpObjTHandler from '#/network/game/client/handler/OpObjTHandler.js';
import OpObjUHandler from '#/network/game/client/handler/OpObjUHandler.js';
import ResumePauseButtonHandler from '#/network/game/client/handler/ResumePauseButtonHandler.js';
import WearOpHandler from '#/network/game/client/handler/WearOpHandler.js';
import IfButton from '#/network/game/client/model/IfButton.js';
import InvButton from '#/network/game/client/model/InvButton.js';
import MoveClick from '#/network/game/client/model/MoveClick.js';
import OpHeld from '#/network/game/client/model/OpHeld.js';
import OpHeldU from '#/network/game/client/model/OpHeldU.js';
import OpLoc from '#/network/game/client/model/OpLoc.js';
import OpObj from '#/network/game/client/model/OpObj.js';
import InvButtonD from '#/network/game/client/model/InvButtonD.js';
import OpHeldT from '#/network/game/client/model/OpHeldT.js';
import OpLocT from '#/network/game/client/model/OpLocT.js';
import OpLocU from '#/network/game/client/model/OpLocU.js';
import OpObjT from '#/network/game/client/model/OpObjT.js';
import OpObjU from '#/network/game/client/model/OpObjU.js';
import ResumePauseButton from '#/network/game/client/model/ResumePauseButton.js';
import WearOp from '#/network/game/client/model/WearOp.js';
import Loc from '#/engine/entity/Loc.js';
import { NetworkPlayer } from '#/engine/entity/NetworkPlayer.js';
import { CoordGrid } from '#/engine/CoordGrid.js';
import Environment from '#/util/Environment.js';

// A bot's hands. Every action goes through the handler a client's packet reaches - the same checks,
// the same triggers - so every game rule applies to a bot exactly as to a player. Three of them
// (op player, op npc, cast on player) are mirrored line for line rather than called, for one reason:
// their "is it visible on your client" check reads the player-info list the server builds only for a
// connected client (rsbuf.hasPlayer / hasNpc), and a bot has no client. Here that check is what it
// stands for: the other entity is within a client's view distance on the same level.

const moveClick = new MoveClickHandler();
const opHeld = new OpHeldHandler();
const opHeldU = new OpHeldUHandler();
const opObj = new OpObjHandler();
const opLocHandler = new OpLocHandler();
const ifButton = new IfButtonHandler();
const invButton = new InvButtonHandler();
const wearOp = new WearOpHandler();
const resumePause = new ResumePauseButtonHandler();
const opLocU = new OpLocUHandler();
const opObjU = new OpObjUHandler();
const opLocT = new OpLocTHandler();
const opObjT = new OpObjTHandler();
const opHeldT = new OpHeldTHandler();
const invButtonD = new InvButtonDHandler();

const VIEW_DISTANCE = 15;

function sees(p: Player, x: number, z: number, level: number): boolean {
    return p.level === level && Math.abs(p.x - x) <= VIEW_DISTANCE && Math.abs(p.z - z) <= VIEW_DISTANCE;
}

/** A path in the shape a client sends it (first waypoint first), from the server's routefinder. */
function clientPath(waypoints: ArrayLike<number>): { x: number; z: number }[] {
    const path: { x: number; z: number }[] = [];
    for (let i = 0; i < waypoints.length && i < 25; i++) {
        const c = CoordGrid.unpackCoord(waypoints[i]);
        path.push({ x: c.x, z: c.z });
    }
    return path;
}

/**
 * A minimap/ground click: MoveClickHandler. False when the click is thrown away (delayed, no route).
 * Whether it runs is the run orb's business (BotBrain.manageRun); `ctrlRun` is a ctrl-click, which
 * runs this one path whatever the orb says - kept for running for its life.
 */
export function walk(p: BotPlayer, x: number, z: number, ctrlRun = false): boolean {
    const path = clientPath(findPath(p.level, p.x, p.z, x, z));
    if (path.length === 0) {
        return false;
    }
    return moveClick.handle(new MoveClick(path, ctrlRun && p.runenergy >= 100 ? 1 : 0, false), p as unknown as NetworkPlayer);
}

/** The route a client sends with an op click (MOVE_OPCLICK), ahead of the op packet itself. */
function opClickRoute(p: BotPlayer, x: number, z: number, width: number, length: number) {
    const path = clientPath(findPathToEntity(p.level, p.x, p.z, x, z, p.width, width, length));
    if (path.length > 0) {
        moveClick.handle(new MoveClick(path, 0, true), p as unknown as NetworkPlayer);
    }
}

/** OpPlayerHandler, with the visibility check as above. op 2 is Attack. */
export function opPlayer(p: BotPlayer, other: Player, op: number): boolean {
    if (p.delayed) {
        p.unsetMapFlag();
        return false;
    }
    if (!other.isActive || other.slot === -1 || World.getPlayer(other.slot) !== other || !sees(p, other.x, other.z, other.level)) {
        p.unsetMapFlag();
        return false;
    }
    opClickRoute(p, other.x, other.z, other.width, other.length);
    p.clearPendingAction();
    p.setInteraction(Interaction.ENGINE, other, ServerTriggerType.APPLAYER1 + (op - 1));
    p.opcalled = true;
    return true;
}

/** OpNpcHandler, with the visibility check as above. */
export function opNpc(p: BotPlayer, npc: Npc, op: number): boolean {
    if (p.delayed) {
        p.unsetMapFlag();
        return false;
    }
    if (World.getNpc(npc.nid) !== npc || npc.delayed || !npc.isActive || !sees(p, npc.x, npc.z, npc.level)) {
        p.unsetMapFlag();
        return false;
    }
    const type = NpcType.get(npc.type);
    if (!type.op || isHiddenOp(type.op[op - 1])) {
        p.unsetMapFlag();
        return false;
    }
    opClickRoute(p, npc.x, npc.z, npc.width, npc.length);
    p.clearPendingAction();
    p.setInteraction(Interaction.ENGINE, npc, ServerTriggerType.APNPC1 + (op - 1));
    p.opcalled = true;
    return true;
}

/** OpPlayerTHandler (a spell cast on a player), with the visibility check as above. */
export function castOnPlayer(p: BotPlayer, other: Player, spellComName: string): boolean {
    if (p.delayed) {
        p.unsetMapFlag();
        return false;
    }
    const spellComId = Component.getId(spellComName);
    const spellCom = spellComId === -1 ? undefined : Component.get(spellComId);
    if (typeof spellCom === 'undefined' || (spellCom.actionTarget & ComActionTarget.PLAYER) === 0 || !p.isComponentVisible(spellCom)) {
        p.unsetMapFlag();
        return false;
    }
    if (!other.isActive || other.slot === -1 || World.getPlayer(other.slot) !== other || !sees(p, other.x, other.z, other.level)) {
        p.unsetMapFlag();
        return false;
    }
    opClickRoute(p, other.x, other.z, other.width, other.length);
    p.clearPendingAction();
    p.setInteraction(Interaction.ENGINE, other, ServerTriggerType.APPLAYERT, spellComId);
    p.opcalled = true;
    return true;
}

/** Take an obj off the floor: OpObjHandler. */
export function takeObj(p: BotPlayer, obj: Obj): boolean {
    const type = ObjType.get(obj.type);
    const op = type.op.findIndex(o => o === 'Take') + 1;
    if (op === 0) {
        return false;
    }
    const path = clientPath(findPath(p.level, p.x, p.z, obj.x, obj.z));
    if (path.length > 0) {
        moveClick.handle(new MoveClick(path, 0, true), p as unknown as NetworkPlayer);
    }
    return opObj.handle(new OpObj(op, obj.x, obj.z, obj.type), p as unknown as NetworkPlayer);
}

/** The component the backpack is drawn on (inventory:inv once the login script has set the tabs up). */
function backpackCom(p: Player): number {
    const listener = p.invListeners.find(l => l.type === InvType.INV && l.source === p.uid && p.isComponentVisible(Component.get(l.com)));
    return listener ? listener.com : -1;
}

/** An item's op in the backpack - eat, drink, wield: OpHeldHandler. op 1 is Eat/Drink, op 2 Wield/Wear. */
export function heldOp(p: BotPlayer, objName: string, op: number): boolean {
    const id = ObjType.getId(objName);
    if (id === -1) {
        return false;
    }
    const inv = p.getInventory(InvType.INV);
    if (!inv) {
        return false;
    }
    const slot = inv.getItemIndex(id);
    if (slot === -1) {
        return false;
    }
    const com = backpackCom(p);
    if (com === -1) {
        return false;
    }
    return opHeld.handle(new OpHeld(op, id, slot, com), p);
}

/** The op an item has for "Eat", "Drink", "Wield" or "Wear" (1-based), or 0. */
export function heldOpNamed(objName: string, ...names: string[]): number {
    const id = ObjType.getId(objName);
    if (id === -1) {
        return 0;
    }
    const iop = ObjType.get(id).iop;
    for (let i = 0; i < iop.length; i++) {
        if (iop[i] && names.includes(iop[i]!)) {
            return i + 1;
        }
    }
    return 0;
}

/** Click a button: IfButtonHandler. False when there is no such component or it is not on screen. */
export function button(p: BotPlayer, comName: string): boolean {
    const id = Component.getId(comName);
    if (id === -1) {
        return false;
    }
    return ifButton.handle(new IfButton(id), p);
}

// ------------------------------------------------------------------------------------------------
// custom (2026-09-29) - the rest of a client's hands, added for the fuzzer (BotFuzzer.ts). A fuzzer
// that could only walk, attack and eat would only ever test walking, attacking and eating; these are
// the clicks that reach the other several thousand triggers. Every one of them goes through the
// handler a real packet reaches, for the same reason the ones above do: a bug the fuzzer finds has
// to be a bug a player can reach.

/** Click a button by id, for a component the fuzzer found rather than named. */
export function buttonById(p: BotPlayer, comId: number): boolean {
    return ifButton.handle(new IfButton(comId), p);
}

/**
 * An op on a loc: OpLocHandler, called outright. Unlike op npc and op player above, this one needs
 * no mirroring - its "is it on your screen" check reads player.originX/originZ, which BuildArea
 * .rebuildNormal sets for every player in the loop, bots included.
 */
export function opLoc(p: BotPlayer, loc: Loc, op: number): boolean {
    opClickRoute(p, loc.x, loc.z, loc.width, loc.length);
    return opLocHandler.handle(new OpLoc(op, loc.x, loc.z, loc.type), p as unknown as NetworkPlayer);
}

/** Any op on a ground obj, not just Take: OpObjHandler. */
export function opObjAt(p: BotPlayer, obj: Obj, op: number): boolean {
    const path = clientPath(findPath(p.level, p.x, p.z, obj.x, obj.z));
    if (path.length > 0) {
        moveClick.handle(new MoveClick(path, 0, true), p as unknown as NetworkPlayer);
    }
    return opObj.handle(new OpObj(op, obj.x, obj.z, obj.type), p as unknown as NetworkPlayer);
}

/** An op on the backpack slot at `slot` (Eat, Wield, Drop, whatever the obj has): OpHeldHandler. */
export function heldOpSlot(p: BotPlayer, slot: number, op: number): boolean {
    const inv = p.getInventory(InvType.INV);
    const item = inv?.get(slot);
    const com = backpackCom(p);
    if (!item || com === -1) {
        return false;
    }
    return opHeld.handle(new OpHeld(op, item.id, slot, com), p);
}

/** One backpack item used on another: OpHeldUHandler. The classic way to find a missing recipe. */
export function heldUse(p: BotPlayer, slot: number, useSlot: number): boolean {
    const inv = p.getInventory(InvType.INV);
    const item = inv?.get(slot);
    const useItem = inv?.get(useSlot);
    const com = backpackCom(p);
    if (!item || !useItem || com === -1 || slot === useSlot) {
        return false;
    }
    return opHeldU.handle(new OpHeldU(item.id, slot, com, useItem.id, useSlot, com), p);
}

/**
 * An op on an item in ANY inventory the client has been sent - the bank, a shop, a trade window.
 * This is the one that exercises deposit, withdraw and the rest, which is where a dupe lives.
 */
export function invOp(p: BotPlayer, comId: number, slot: number, op: number): boolean {
    const listener = p.invListeners.find(l => l.com === comId);
    const inv = p.getInventoryFromListener(listener);
    const item = inv?.get(slot);
    if (!item) {
        return false;
    }
    return invButton.handle(new InvButton(op, item.id, slot, comId), p);
}

/** A worn item's own option (WEAROP): the glory's teleports, a ring's charge. */
export function wornOp(p: BotPlayer, comId: number, slot: number, op: number): boolean {
    const listener = p.invListeners.find(l => l.com === comId);
    const inv = p.getInventoryFromListener(listener);
    const item = inv?.get(slot);
    if (!item) {
        return false;
    }
    return wearOp.handle(new WearOp(op, item.id, slot, comId), p);
}

/** "Click here to continue", and any other script paused on a button with no options offered. */
export function resumeDialogue(p: BotPlayer): boolean {
    return resumePause.handle(new ResumePauseButton(), p);
}

/** Pick one of the options a p_choice put on screen. The com must be one the script is waiting on. */
export function chooseDialogue(p: BotPlayer, comId: number): boolean {
    if (p.resumeButtons.indexOf(comId) === -1) {
        return false;
    }
    return ifButton.handle(new IfButton(comId), p);
}

// ------------------------------------------------------------------------------------------------
// custom (2026-11-02) - USE ON, CAST ON, and DRAG. The hands the fuzzer was still missing.
//
// Counted against the build on 2 November 2026, these are the triggers no bot could reach at all,
// because no bot could send the packet: [oplocu] 505, [opnpcu] 208, [apnpct] 51, [applayert] 54,
// [opheldt] 12, [opnpct] 9, [oploct] 6, [apobju] 4, [aplocu] 4, [apnpcu] 6, [inv_buttond] 7,
// [opobju] 4, [opobjt] 1, [apobjt] 1. Around 870 of them, and they are not an obscure tail: "use
// the item on the thing" is how half of this era's quests are solved, and the fuzzer could only
// ever use an item on another item in its own backpack.
//
// Every one goes through the handler a real packet reaches, as the rest of this file does. opNpcU
// and opNpcT are mirrored rather than called, for the same reason opNpc above is: their visibility
// check reads rsbuf.hasNpc, which the server fills only for a connected client.

/** The component the bot's backpack is on, which is the `useCom` every "use" packet carries. */
function usableBackpackCom(p: BotPlayer): number {
    const com = backpackCom(p);
    if (com === -1) {
        return -1;
    }
    // OpLocU and friends refuse a component that is not `usable`, exactly as they would for a real
    // client. If the backpack's own component is not marked usable, no use-on click is possible at
    // all and the fuzzer should not pretend otherwise.
    return Component.get(com)?.usable ? com : -1;
}

/** An inventory item used on a loc: OpLocUHandler. [oplocu,...] - 505 triggers in this build. */
export function heldUseOnLoc(p: BotPlayer, loc: Loc, slot: number): boolean {
    const inv = p.getInventory(InvType.INV);
    const item = inv?.get(slot);
    const com = usableBackpackCom(p);
    if (!item || com === -1) {
        return false;
    }
    opClickRoute(p, loc.x, loc.z, loc.width, loc.length);
    return opLocU.handle(new OpLocU(loc.x, loc.z, loc.type, item.id, slot, com), p as unknown as NetworkPlayer);
}

/** An inventory item used on a ground obj: OpObjUHandler. */
export function heldUseOnObj(p: BotPlayer, obj: Obj, slot: number): boolean {
    const inv = p.getInventory(InvType.INV);
    const item = inv?.get(slot);
    const com = usableBackpackCom(p);
    if (!item || com === -1) {
        return false;
    }
    const path = clientPath(findPath(p.level, p.x, p.z, obj.x, obj.z));
    if (path.length > 0) {
        moveClick.handle(new MoveClick(path, 0, true), p as unknown as NetworkPlayer);
    }
    return opObjU.handle(new OpObjU(obj.x, obj.z, obj.type, item.id, slot, com), p as unknown as NetworkPlayer);
}

/**
 * An inventory item used on an npc. OpNpcUHandler mirrored line for line, because its visibility
 * check is rsbuf.hasNpc - see the note at the top of this file. [opnpcu,...] - 208 triggers.
 */
export function heldUseOnNpc(p: BotPlayer, npc: Npc, slot: number): boolean {
    if (p.delayed) {
        p.unsetMapFlag();
        return false;
    }
    const inv = p.getInventory(InvType.INV);
    const item = inv?.get(slot);
    const com = usableBackpackCom(p);
    if (!item || com === -1) {
        p.unsetMapFlag();
        return false;
    }
    if (World.getNpc(npc.nid) !== npc || npc.delayed || !npc.isActive || !sees(p, npc.x, npc.z, npc.level)) {
        p.unsetMapFlag();
        return false;
    }
    // The handler's own members gate. A fuzzer that walked past it would report a dead op on an item
    // the world does not offer at all.
    if (ObjType.get(item.id).members && !Environment.NODE_MEMBERS) {
        p.unsetMapFlag();
        return false;
    }
    opClickRoute(p, npc.x, npc.z, npc.width, npc.length);
    p.clearPendingAction();
    p.lastUseItem = item.id;
    p.lastUseSlot = slot;
    p.setInteraction(Interaction.ENGINE, npc, ServerTriggerType.APNPCU);
    p.opcalled = true;
    return true;
}

/** A spell (or any targeted interface component) cast on a loc: OpLocTHandler. */
export function castOnLoc(p: BotPlayer, loc: Loc, spellComId: number): boolean {
    opClickRoute(p, loc.x, loc.z, loc.width, loc.length);
    return opLocT.handle(new OpLocT(loc.x, loc.z, loc.type, spellComId), p as unknown as NetworkPlayer);
}

/** A spell cast on a ground obj: OpObjTHandler. Telekinetic grab, and the quest ones. */
export function castOnObj(p: BotPlayer, obj: Obj, spellComId: number): boolean {
    return opObjT.handle(new OpObjT(obj.x, obj.z, obj.type, spellComId), p as unknown as NetworkPlayer);
}

/** A spell cast on an inventory item: OpHeldTHandler. Enchanting, superheat, the alchemies. */
export function castOnHeld(p: BotPlayer, slot: number, spellComId: number): boolean {
    const inv = p.getInventory(InvType.INV);
    const item = inv?.get(slot);
    const com = backpackCom(p);
    if (!item || com === -1) {
        return false;
    }
    return opHeldT.handle(new OpHeldT(item.id, slot, com, spellComId), p);
}

/**
 * A spell cast on an npc. OpNpcTHandler mirrored, as heldUseOnNpc is: rsbuf.hasNpc again.
 * [apnpct] is 51 triggers and [opnpct] 9, and every one of them was unreachable by any bot.
 */
export function castOnNpc(p: BotPlayer, npc: Npc, spellComId: number): boolean {
    if (p.delayed) {
        p.unsetMapFlag();
        return false;
    }
    const spellCom = Component.get(spellComId);
    if (typeof spellCom === 'undefined' || (spellCom.actionTarget & ComActionTarget.NPC) === 0 || !p.isComponentVisible(spellCom)) {
        p.unsetMapFlag();
        return false;
    }
    if (World.getNpc(npc.nid) !== npc || npc.delayed || !npc.isActive || !sees(p, npc.x, npc.z, npc.level)) {
        p.unsetMapFlag();
        return false;
    }
    opClickRoute(p, npc.x, npc.z, npc.width, npc.length);
    p.clearPendingAction();
    p.setInteraction(Interaction.ENGINE, npc, ServerTriggerType.APNPCT, spellComId);
    p.opcalled = true;
    return true;
}

/**
 * One inventory slot dragged onto another: InvButtonDHandler. [inv_buttond] is only 7 triggers, but
 * one of them is the bank's own rearrange and another is the rune pouch - both places where two
 * stacks meet, which is where a dupe lives.
 */
export function invDrag(p: BotPlayer, comId: number, slot: number, targetSlot: number, mode = 0): boolean {
    const listener = p.invListeners.find(l => l.com === comId);
    const inv = p.getInventoryFromListener(listener);
    if (!inv || slot === targetSlot || !inv.validSlot(slot) || !inv.validSlot(targetSlot)) {
        return false;
    }
    return invButtonD.handle(new InvButtonD(comId, slot, targetSlot, mode), p);
}

/**
 * Every spell the bot could cast right now at a target of this kind.
 *
 * WHY THE INTERFACE NAME AND NOT JUST actionTarget. The obvious filter - "any component the cache
 * marks as targeting an npc" - is wrong, and measured wrong: this build has 1,857 such components
 * in `npc_browser`, 1,319 in `clan_setup`, 426 in `friends` and 420 in `music`. actionTarget is
 * interface data from the 377 client and is set all over the cache on things that are not spells.
 * A fuzzer using it unfiltered spends its run casting `music:suspicious` at skeletons, which both
 * wastes the clicks and reports dead ops that are not ops at all.
 *
 * So the filter is the spellbooks, by name. `endsWith('_magic')` was tried first and is too loose:
 * it also matched `levelup_magic`, which is the level-up popup. Three names, listed - and
 * tools/sim/opsweep.ts prints any OTHER interface whose name contains `magic` and has targeted
 * components, so a fourth book added to the content shows up as a line to read rather than as
 * silently untested content.
 */
export const SPELLBOOKS: ReadonlySet<string> = new Set(['magic', 'lunar_magic', 'ancient_magic']);

function isSpellbookCom(com: Component): boolean {
    const name = com.comName;
    if (!name) {
        return false;
    }
    const colon = name.indexOf(':');
    return SPELLBOOKS.has(colon === -1 ? name : name.slice(0, colon));
}

export function castableComs(p: BotPlayer, target: ComActionTarget): number[] {
    const out: number[] = [];
    for (let id = 0; id < Component.count; id++) {
        const com = Component.get(id);
        if (!com || !com.actionTarget || (com.actionTarget & target) === 0) {
            continue;
        }
        if (isSpellbookCom(com) && p.isComponentVisible(com)) {
            out.push(id);
        }
    }
    return out;
}
