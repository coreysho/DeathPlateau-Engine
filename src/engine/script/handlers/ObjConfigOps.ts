import ObjType from '#/cache/config/ObjType.js';
import { ParamHelper } from '#/cache/config/ParamHelper.js';
import ParamType from '#/cache/config/ParamType.js';
import { ScriptOpcode } from '#/engine/script/ScriptOpcode.js';
import { CommandHandlers } from '#/engine/script/ScriptRunner.js';
import { check, ObjTypeValid, ParamTypeValid } from '#/engine/script/ScriptValidators.js';

const ObjConfigOps: CommandHandlers = {
    [ScriptOpcode.OC_NAME]: state => {
        const objType: ObjType = check(state.popInt(), ObjTypeValid);

        state.pushString(objType.name ?? objType.debugname ?? 'null');
    },

    [ScriptOpcode.OC_PARAM]: state => {
        const [objId, paramId] = state.popInts(2);

        const objType: ObjType = check(objId, ObjTypeValid);
        const paramType: ParamType = check(paramId, ParamTypeValid);
        if (paramType.isString()) {
            state.pushString(ParamHelper.getStringParam(paramType.id, objType, paramType.defaultString));
        } else {
            state.pushInt(ParamHelper.getIntParam(paramType.id, objType, paramType.defaultInt));
        }
    },

    [ScriptOpcode.OC_CATEGORY]: state => {
        state.pushInt(check(state.popInt(), ObjTypeValid).category);
    },

    [ScriptOpcode.OC_DESC]: state => {
        state.pushString(check(state.popInt(), ObjTypeValid).desc ?? 'null');
    },

    /**
     * The label on one of an obj's five BACKPACK options, or "null" when that slot is empty.
     *
     * Declared in ScriptOpcode.ts since the enum was written ("official, see cs2") and never
     * implemented, which is why ~dropslot could not tell a Drop from a Destroy. ObjType seeds iop
     * as [null, null, null, null, 'Drop'], so slot 5 answers "Drop" for every item that does not
     * override it and the comparison a caller wants is against that literal.
     *
     * The slot is 1-based, the way it is written in a config (iop1..iop5) and the way opheldN
     * numbers its triggers. Out of range is an error rather than a silent "null": a script asking
     * for iop6 has a bug in it, and iop0 is the off-by-one that bug usually is.
     */
    [ScriptOpcode.OC_IOP]: state => {
        const [objId, slot] = state.popInts(2);

        const objType: ObjType = check(objId, ObjTypeValid);
        if (slot < 1 || slot > objType.iop.length) {
            throw new Error(`oc_iop: slot ${slot} is not one of 1..${objType.iop.length}`);
        }

        state.pushString(objType.iop[slot - 1] ?? 'null');
    },

    /** The same for the GROUND menu - what the option reads when the obj is lying on a tile. */
    [ScriptOpcode.OC_OP]: state => {
        const [objId, slot] = state.popInts(2);

        const objType: ObjType = check(objId, ObjTypeValid);
        if (slot < 1 || slot > objType.op.length) {
            throw new Error(`oc_op: slot ${slot} is not one of 1..${objType.op.length}`);
        }

        state.pushString(objType.op[slot - 1] ?? 'null');
    },

    [ScriptOpcode.OC_MEMBERS]: state => {
        state.pushInt(check(state.popInt(), ObjTypeValid).members ? 1 : 0);
    },

    [ScriptOpcode.OC_WEIGHT]: state => {
        state.pushInt(check(state.popInt(), ObjTypeValid).weight);
    },

    [ScriptOpcode.OC_WEARPOS]: state => {
        state.pushInt(check(state.popInt(), ObjTypeValid).wearpos);
    },

    [ScriptOpcode.OC_WEARPOS2]: state => {
        state.pushInt(check(state.popInt(), ObjTypeValid).wearpos2);
    },

    [ScriptOpcode.OC_WEARPOS3]: state => {
        state.pushInt(check(state.popInt(), ObjTypeValid).wearpos3);
    },

    [ScriptOpcode.OC_COST]: state => {
        state.pushInt(check(state.popInt(), ObjTypeValid).cost);
    },

    [ScriptOpcode.OC_TRADEABLE]: state => {
        state.pushInt(check(state.popInt(), ObjTypeValid).tradeable ? 1 : 0);
    },

    [ScriptOpcode.OC_DEBUGNAME]: state => {
        state.pushString(check(state.popInt(), ObjTypeValid).debugname ?? 'null');
    },

    [ScriptOpcode.OC_CERT]: state => {
        const objType: ObjType = check(state.popInt(), ObjTypeValid);

        if (objType.certtemplate == -1 && objType.certlink >= 0) {
            state.pushInt(objType.certlink);
        } else {
            state.pushInt(objType.id);
        }
    },

    [ScriptOpcode.OC_UNCERT]: state => {
        const objType: ObjType = check(state.popInt(), ObjTypeValid);

        if (objType.certtemplate >= 0 && objType.certlink >= 0) {
            state.pushInt(objType.certlink);
        } else {
            state.pushInt(objType.id);
        }
    },

    [ScriptOpcode.OC_STACKABLE]: state => {
        state.pushInt(check(state.popInt(), ObjTypeValid).stackable ? 1 : 0);
    }
};

export default ObjConfigOps;
