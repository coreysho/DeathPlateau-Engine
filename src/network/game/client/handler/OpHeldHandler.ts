import Component from '#/cache/config/Component.js';
import ObjType from '#/cache/config/ObjType.js';
import Player from '#/engine/entity/Player.js';
import ScriptProvider from '#/engine/script/ScriptProvider.js';
import ScriptRunner from '#/engine/script/ScriptRunner.js';
import ServerTriggerType from '#/engine/script/ServerTriggerType.js';
import ClientGameMessageHandler from '#/network/game/client/ClientGameMessageHandler.js';
import OpHeld from '#/network/game/client/model/OpHeld.js';
import { LoggerEventType } from '#/server/logger/LoggerEventType.js';
import Environment from '#/util/Environment.js';

export default class OpHeldHandler extends ClientGameMessageHandler<OpHeld> {
    handle(message: OpHeld, player: Player): boolean {
        const { obj: objId, slot, com: comId } = message;

        if (player.delayed) {
            // normal: cannot interact while delayed
            return false;
        }

        const com = Component.get(comId);
        if (typeof com === 'undefined' || !com.operable) {
            // bad client: component is not acceptable for this packet
            return false;
        } else if (!player.isComponentVisible(com)) {
            // bad client or lag: component is not visible
            return false;
        }

        const listener = player.invListeners.find(l => l.com === comId);
        const inv = player.getInventoryFromListener(listener);
        if (!inv) {
            // bad client or lag: inventory is not transmitted to client
            return false;
        }

        if (!inv.validSlot(slot)) {
            // bad client: real inventory is smaller
            return false;
        } else if (!inv.hasAt(slot, objId)) {
            // bad client or lag: item does not exist in inventory
            return false;
        }

        const obj = ObjType.get(objId);
        if (obj.iop[message.op - 1] === null) {
            // bad client: not a valid item option
            return false;
        }

        player.lastItem = objId;
        player.lastSlot = slot;

        if (com.rootLayer != player.modalMain) {
            // AN INVENTORY OPTION NO LONGER DROPS YOUR TARGET. This was clearPendingAction(),
            // which is closeModal() PLUS clearInteraction(), and clearInteraction() sets
            // this.target = null - so eating, drinking, burying or equipping anything stopped you
            // attacking. Reported from play 2026-09-21 as "actions get cancelled for doing
            // anything - you should be able to do multiple things" and "pvp is way off".
            //
            // Upstream LostCityRS does the same, so this is a DELIBERATE DIVERGENCE decided by
            // Corey on 2026-09-21: Old School feel over 2004 authenticity. It is the first of two
            // mechanisms behind that report and it is deliberately alone on this branch, so the
            // difference it makes can be felt on its own. The second is the `if (player.delayed)
            // return false` at the top of this file and its fifteen siblings, which DISCARDS a
            // click made during a delay rather than deferring it; that one is not touched here.
            //
            // The modal still closes, because clicking an item while a dialogue is open should
            // dismiss the dialogue. Only the interaction survives.
            //
            // Not changed in OpHeldU or OpHeldT: using one item on another, or casting on an item,
            // is its own action rather than something you do while fighting.
            //
            // See Content/claude/combat-delays-investigation.md.
            player.closeModal();
        }

        player.moveClickRequest = false; // uses the dueling ring op to move whilst busy & queue pending: https://youtu.be/GPfN3Isl2rM

        // opheld5 gets wealth logged in content
        if (message.op !== 5) {
            player.addSessionLog(LoggerEventType.MODERATOR, `${obj.iop[message.op - 1]} ${obj.debugname}`);
        }

        const trigger: ServerTriggerType = ServerTriggerType.OPHELD1 + (message.op - 1);
        const script = ScriptProvider.getByTrigger(trigger, obj.id, obj.category);
        if (script) {
            player.executeScript(ScriptRunner.init(script, player), true);
        } else if (Environment.NODE_DEBUG) {
            player.messageGame(`No trigger for [${ServerTriggerType.toString(trigger)},${obj.debugname}]`);
        }

        return true;
    }
}
