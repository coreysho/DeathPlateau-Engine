import CategoryType from '#/cache/config/CategoryType.js';
import Component from '#/cache/config/Component.js';
import InvType from '#/cache/config/InvType.js';
import ObjType from '#/cache/config/ObjType.js';
import Player from '#/engine/entity/Player.js';
import ScriptFile from '#/engine/script/ScriptFile.js';
import ScriptProvider from '#/engine/script/ScriptProvider.js';
import ScriptRunner from '#/engine/script/ScriptRunner.js';
import ClientGameMessageHandler from '#/network/game/client/ClientGameMessageHandler.js';
import WearOp from '#/network/game/client/model/WearOp.js';
import { LoggerEventType } from '#/server/logger/LoggerEventType.js';
import Environment from '#/util/Environment.js';

// An item's own option in the Worn Equipment tab - OSRS's worn options: a glory's Edgeville, a
// slayer helmet's Check, a skill cape's Teleport (oldschool.runescape.wiki/w/Worn_Equipment). The
// tab's Remove is the inventory component's own op and still arrives as INV_BUTTON1; the options
// after it come from the item (ObjType.wearop, obj config wearop1-8) and arrive here.
//
// THE HANDLER IS A LABEL FOUND BY NAME, NOT A TRIGGER. The natural home would be a trigger per op,
// [wearop1,obj] beside [opheld1,obj], but the script compiler is the @lostcityrs/runescript npm
// package with its trigger list compiled in, and nothing here can add one to it. So the engine
// looks the script up by name, as it already does for [mapzone,...] and [zone,...]:
//
//   [label,wearop<n>_<subject>]
//
// where <subject> is written exactly as an opheld trigger's would be - an obj, or _<category> for a
// whole family, hence the double underscore:
//
//   [label,wearop1_amulet_of_glory_4]      that one obj
//   [label,wearop1__category_557]          every obj in category_557
//
// The obj wins over its category, as ScriptProvider.getByTrigger does. last_item and last_slot are
// set as for opheld (ScriptState.wearop lets a label read them); last_slot is the worn slot (the
// wearpos), so a handler that changes the item writes it back to worn, not inv.
export default class WearOpHandler extends ClientGameMessageHandler<WearOp> {
    handle(message: WearOp, player: Player): boolean {
        const { op, obj: objId, slot, com: comId } = message;

        if (player.delayed) {
            // normal: cannot interact while delayed
            return false;
        }

        if (op < 1 || op > ObjType.WEAROP_COUNT) {
            // bad client: no such option
            return false;
        }

        const com = Component.get(comId);
        if (typeof com === 'undefined') {
            // bad client: component is not acceptable for this packet
            return false;
        } else if (!player.isComponentVisible(com)) {
            // bad client or lag: component is not visible
            return false;
        }

        // Only an inventory component showing the player's OWN worn items. Any component bound to it
        // will do - the client offers these in the Worn Equipment tab - but never someone else's
        // worn items, nor a backpack or a bank: those are opheld and inv_button.
        const listener = player.invListeners.find(l => l.com === comId);
        const inv = player.getInventoryFromListener(listener);
        if (!inv || inv !== player.getInventory(InvType.WORN)) {
            // bad client or lag: not the worn inventory
            return false;
        }

        if (!inv.validSlot(slot)) {
            // bad client: real inventory is smaller
            return false;
        } else if (!inv.hasAt(slot, objId)) {
            // bad client or lag: item is not worn there
            return false;
        }

        const obj = ObjType.get(objId);
        if (obj.wearop[op - 1] === null) {
            // bad client: not a worn option this item has
            return false;
        }

        player.lastItem = objId;
        player.lastSlot = slot;

        // As OpHeldHandler: operating an item closes a dialogue but keeps what you were doing.
        if (com.rootLayer != player.modalMain) {
            player.closeModal();
        }
        player.moveClickRequest = false;

        player.addSessionLog(LoggerEventType.MODERATOR, `${obj.wearop[op - 1]} ${obj.debugname} (worn)`);

        const script = WearOpHandler.findScript(obj, op);
        if (script) {
            const state = ScriptRunner.init(script, player);
            state.wearop = true;
            player.executeScript(state, true);
        } else if (Environment.NODE_DEBUG) {
            player.messageGame(`No handler for [label,wearop${op}_${obj.debugname}]`);
        }

        return true;
    }

    /** The content script for worn option `op` (1-based) of `obj`, by the naming rule above. */
    static findScript(obj: ObjType, op: number): ScriptFile | undefined {
        const own = ScriptProvider.getByName(`[label,wearop${op}_${obj.debugname}]`);
        if (own) {
            return own;
        }

        if (obj.category !== -1) {
            const category = CategoryType.get(obj.category);
            if (category && category.debugname) {
                return ScriptProvider.getByName(`[label,wearop${op}__${category.debugname}]`);
            }
        }

        return undefined;
    }
}
