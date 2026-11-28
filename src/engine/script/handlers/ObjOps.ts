import InvType from '#/cache/config/InvType.js';
import ObjType from '#/cache/config/ObjType.js';
import { ParamHelper } from '#/cache/config/ParamHelper.js';
import ParamType from '#/cache/config/ParamType.js';
import { CoordGrid } from '#/engine/CoordGrid.js';
import { EntityLifeCycle } from '#/engine/entity/EntityLifeCycle.js';
import Obj from '#/engine/entity/Obj.js';
import Npc from '#/engine/entity/Npc.js';
import { NpcStat } from '#/engine/entity/NpcStat.js';
import NpcType from '#/cache/config/NpcType.js';
import ScriptState from '#/engine/script/ScriptState.js';
import ServerTriggerType from '#/engine/script/ServerTriggerType.js';
import { ObjIterator } from '#/engine/script/ScriptIterators.js';
import { ScriptOpcode } from '#/engine/script/ScriptOpcode.js';
import { ActiveObj, ActivePlayer } from '#/engine/script/ScriptPointer.js';
import { CommandHandlers } from '#/engine/script/ScriptRunner.js';
import { check, CoordValid, DurationValid, InvTypeValid, ObjStackValid, ObjTypeValid, ParamTypeValid } from '#/engine/script/ScriptValidators.js';
import World from '#/engine/World.js';
import { WealthEventType } from '#/server/logger/WealthEventType.js';
import Environment from '#/util/Environment.js';

const ObjOps: CommandHandlers = {
    // https://x.com/JagexAsh/status/1679942100249464833
    // https://x.com/NobodyImpo74600/status/1791469645939065036
    [ScriptOpcode.OBJ_ADD]: state => {
        const [coord, objId, count, duration] = state.popInts(4);

        if (objId === -1 || count === -1) {
            return;
        }

        const objType: ObjType = check(objId, ObjTypeValid);
        check(duration, DurationValid);
        const position: CoordGrid = check(coord, CoordValid);
        check(count, ObjStackValid);

        if (objType.dummyitem !== 0) {
            throw new Error(`attempted to add dummy item: ${objType.debugname}`);
        }

        if (objType.members && !Environment.NODE_MEMBERS) {
            return;
        }

        if (!objType.stackable || count === 1) {
            for (let i = 0; i < count; i++) {
                const obj: Obj = new Obj(position.level, position.x, position.z, EntityLifeCycle.DESPAWN, objId, 1);
                World.addObj(obj, state.activePlayer.hash64, duration);

                state.activeObj = obj;
                state.pointerAdd(ActiveObj[state.intOperand]);
            }
        } else {
            const obj: Obj = new Obj(position.level, position.x, position.z, EntityLifeCycle.DESPAWN, objId, count);
            World.addObj(obj, state.activePlayer.hash64, duration);

            state.activeObj = obj;
            state.pointerAdd(ActiveObj[state.intOperand]);
        }

        reportDeathDrop(state, objId, count);
    },

    // https://x.com/JagexAsh/status/1778879334167548366
    [ScriptOpcode.OBJ_ADDALL]: state => {
        const [coord, objId, count, duration] = state.popInts(4);

        if (objId === -1 || count === -1) {
            return;
        }

        const objType: ObjType = check(objId, ObjTypeValid);
        check(duration, DurationValid);
        const position: CoordGrid = check(coord, CoordValid);
        check(count, ObjStackValid);

        if (objType.dummyitem !== 0) {
            throw new Error(`attempted to add dummy item: ${objType.debugname}`);
        }

        if (objType.members && !Environment.NODE_MEMBERS) {
            return;
        }

        if (!objType.stackable || count === 1) {
            for (let i = 0; i < count; i++) {
                const obj: Obj = new Obj(position.level, position.x, position.z, EntityLifeCycle.DESPAWN, objId, 1);
                World.addObj(obj, Obj.NO_RECEIVER, duration);

                state.activeObj = obj;
                state.pointerAdd(ActiveObj[state.intOperand]);
            }
        } else {
            const obj: Obj = new Obj(position.level, position.x, position.z, EntityLifeCycle.DESPAWN, objId, count);
            World.addObj(obj, Obj.NO_RECEIVER, duration);

            state.activeObj = obj;
            state.pointerAdd(ActiveObj[state.intOperand]);
        }
    },

    [ScriptOpcode.OBJ_PARAM]: state => {
        const paramType: ParamType = check(state.popInt(), ParamTypeValid);

        const objType: ObjType = check(state.activeObj.type, ObjTypeValid);
        if (paramType.isString()) {
            state.pushString(ParamHelper.getStringParam(paramType.id, objType, paramType.defaultString));
        } else {
            state.pushInt(ParamHelper.getIntParam(paramType.id, objType, paramType.defaultInt));
        }
    },

    [ScriptOpcode.OBJ_NAME]: state => {
        const objType: ObjType = check(state.activeObj.type, ObjTypeValid);

        state.pushString(objType.name ?? objType.debugname ?? 'null');
    },

    [ScriptOpcode.OBJ_DEL]: state => {
        const duration: number = ObjType.get(state.activeObj.type).respawnrate;
        if (state.pointerGet(ActivePlayer[state.intOperand])) {
            World.removeObj(state.activeObj, duration);
        } else {
            World.removeObj(state.activeObj, duration);
        }
    },

    [ScriptOpcode.OBJ_COUNT]: state => {
        const obj: Obj = state.activeObj;

        if (obj.isValid(state.activePlayer.hash64)) {
            state.pushInt(state.activeObj.count);
            return;
        }

        state.pushInt(0);
    },

    [ScriptOpcode.OBJ_TYPE]: state => {
        state.pushInt(check(state.activeObj.type, ObjTypeValid).id);
    },

    // https://x.com/JagexAsh/status/1679942100249464833
    [ScriptOpcode.OBJ_TAKEITEM]: state => {
        const invType: InvType = check(state.popInt(), InvTypeValid);

        const obj: Obj = state.activeObj;
        const objType = ObjType.get(obj.type);

        if (!obj.isValid(state.activePlayer.hash64)) {
            return false;
        }

        state.activePlayer.invAdd(invType.id, obj.type, obj.count);

        const value = obj.count * objType.cost;
        state.activePlayer.addWealthEvent({
            event_type: WealthEventType.PICKUP,
            account_items: [{ id: objType.id, name: objType.debugname, count: obj.count }],
            account_value: value
        });

        if (obj.lifecycle === EntityLifeCycle.RESPAWN) {
            World.removeObj(obj, objType.respawnrate);
        } else if (obj.lifecycle === EntityLifeCycle.DESPAWN) {
            World.removeObj(obj, 0);
        }
    },

    [ScriptOpcode.OBJ_COORD]: state => {
        const coord: CoordGrid = state.activeObj;
        state.pushInt(CoordGrid.packCoord(coord.level, coord.x, coord.z));
    },

    [ScriptOpcode.OBJ_FIND]: state => {
        const [coord, objId] = state.popInts(2);

        const objType: ObjType = check(objId, ObjTypeValid);
        const position: CoordGrid = check(coord, CoordValid);

        const obj = World.getObj(position.x, position.z, position.level, objType.id, state.activePlayer.hash64);
        if (!obj) {
            state.pushInt(0);
            return;
        }

        state.activeObj = obj;
        state.pointerAdd(ActiveObj[state.intOperand]);
        state.pushInt(1);
    },

    [ScriptOpcode.OBJ_FINDALLZONE]: state => {
        const coord: CoordGrid = check(state.popInt(), CoordValid);

        state.objIterator = new ObjIterator(World.currentTick, coord.level, coord.x, coord.z);
    },

    [ScriptOpcode.OBJ_FINDNEXT]: state => {
        const result = state.objIterator?.next();
        if (!result || result.done) {
            state.pushInt(0);
            return;
        }

        state.activeObj = result.value;
        state.pointerAdd(ActiveObj[state.intOperand]);
        state.pushInt(1);
    }

    // obj_setvar // https://x.com/JagexAsh/status/1679942100249464833
    // obj_adddelayed // https://x.com/JagexAsh/status/1730321158858276938
};

/**
 * custom (2026-11-28) - an npc's drop, for the loot tracker of the player it was dropped for.
 *
 * A DROP IS AN obj_add WHOSE SCRIPT IS AN NPC DYING: self is the npc, and either the script is its
 * death queue - [ai_queue3,_] and every death script there is, through the gosubs, labels and procs
 * the drop tables are written as (a jump keeps the trigger) - or the npc is at no hitpoints, which
 * catches the few that die through another queue. Everything an npc hands over while alive - a
 * quest item, a shop's spill - is neither, and is not loot.
 *
 * The receiver is the player the obj is for, which is npc_findhero's player: the same one the drop
 * is private to, so the tracker credits exactly the kills the game does.
 */
export function reportDeathDrop(state: ScriptState, objId: number, count: number): void {
    const self = state.self;
    if (!(self instanceof Npc)) {
        return;
    }
    const receiver = state.activePlayer;
    if (!receiver.lootFeed.enabled) {
        return;
    }
    if (state.trigger !== ServerTriggerType.AI_QUEUE3 && self.levels[NpcStat.HITPOINTS] !== 0) {
        return;
    }
    const type = NpcType.get(self.type);
    receiver.lootFeed.add(self, 'n', type.name ?? type.debugname ?? 'Unknown', type.vislevel, objId, count);
}

export default ObjOps;
