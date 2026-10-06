import CategoryType from '#/cache/config/CategoryType.js';
import Component from '#/cache/config/Component.js';
import ObjType from '#/cache/config/ObjType.js';
import Player from '#/engine/entity/Player.js';
import { opHeldUAlternate } from '#/engine/script/OpHeldUTrigger.js';
import ScriptProvider from '#/engine/script/ScriptProvider.js';
import ScriptRunner from '#/engine/script/ScriptRunner.js';
import ServerTriggerType from '#/engine/script/ServerTriggerType.js';
import ClientGameMessageHandler from '#/network/game/client/ClientGameMessageHandler.js';
import OpHeldU from '#/network/game/client/model/OpHeldU.js';
import Environment from '#/util/Environment.js';

export default class OpHeldUHandler extends ClientGameMessageHandler<OpHeldU> {
    handle(message: OpHeldU, player: Player): boolean {
        const { obj, slot, com: comId, useObj, useSlot, useCom: useComId } = message;

        if (player.delayed) {
            // normal: cannot interact while delayed
            return false;
        }

        if (comId !== useComId) {
            // bad client: opheldu cannot target different components
            return false;
        }

        const com = Component.get(comId);
        if (typeof com === 'undefined' || !com.usable) {
            // bad client: component is not acceptable for this packet
            return false;
        } else if (!player.isComponentVisible(com)) {
            // bad client or lag: component is not visible
            return false;
        }

        const useCom = Component.get(useComId);
        if (typeof useCom === 'undefined' || !useCom.usable) {
            // bad client: component is not acceptable for this packet
            return false;
        } else if (!player.isComponentVisible(useCom)) {
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
        } else if (!inv.hasAt(slot, obj)) {
            // bad client or lag: item does not exist in inventory
            player.moveClickRequest = false; // removed early osrs
            player.clearPendingAction();
            return false;
        }

        const useListener = player.invListeners.find(l => l.com === useComId);
        const useInv = player.getInventoryFromListener(useListener);
        if (!useInv) {
            // bad client or lag: inventory is not transmitted to client
            return false;
        }

        if (!useInv.validSlot(useSlot)) {
            // bad client: real inventory is smaller
            return false;
        } else if (!useInv.hasAt(useSlot, useObj)) {
            // bad client or lag: item does not exist in inventory
            player.moveClickRequest = false; // removed early osrs
            player.clearPendingAction();
            return false;
        }

        player.lastItem = obj;
        player.lastSlot = slot;
        player.lastUseItem = useObj;
        player.lastUseSlot = useSlot;

        const objType = ObjType.get(player.lastItem);
        const useObjType = ObjType.get(player.lastUseItem);

        player.clearPendingAction();

        if ((objType.members || useObjType.members) && !Environment.NODE_MEMBERS) {
            player.messageGame("To use this item please login to a members' server.");
            return false;
        }

        // FOUR LOOKUPS, AND THE SWAP BELONGS TO THE ONE THAT HITS. last_item has to be the half
        // that carried the trigger - that is the whole contract a [opheldu,x] script is written
        // against - so a lookup that misses must leave last_item/last_useitem exactly as they
        // were. Both of the "a" branches below used to swap whether or not they found anything,
        // which meant that whenever neither item had a trigger of its own the pair arrived at the
        // CATEGORY branches already reversed. Every category trigger in the content then read the
        // two the wrong way round: an ornament kit used on a rune scimitar reached
        // [opheldu,_ornament_kit] with the scimitar as last_item and answered "those two do not go
        // together", both ways round, because neither obj has an opheldu of its own.
        const swap = (): void => {
            [player.lastItem, player.lastUseItem] = [player.lastUseItem, player.lastItem];
            [player.lastSlot, player.lastUseSlot] = [player.lastUseSlot, player.lastSlot];
        };

        // [opheldu,b]
        let script = ScriptProvider.getByTriggerSpecific(ServerTriggerType.OPHELDU, objType.id, -1);

        // [opheldu,a]
        if (!script) {
            script = ScriptProvider.getByTriggerSpecific(ServerTriggerType.OPHELDU, useObjType.id, -1);
            if (script) {
                swap();
            }
        }

        // [opheldu,b_category]
        const objCategory = objType.category !== -1 ? CategoryType.get(objType.category) : null;
        if (!script && objCategory) {
            script = ScriptProvider.getByTriggerSpecific(ServerTriggerType.OPHELDU, -1, objCategory.id);
        }

        // [opheldu,a_category]
        const useObjCategory = useObjType.category !== -1 ? CategoryType.get(useObjType.category) : null;
        if (!script && useObjCategory) {
            script = ScriptProvider.getByTriggerSpecific(ServerTriggerType.OPHELDU, -1, useObjCategory.id);
            if (script) {
                swap();
            }
        }

        if (script) {
            // THE OTHER HALF GETS A GO IF THIS ONE DOES NOT KNOW THE PAIR. Only one of the two
            // scripts is chosen, and the chosen one is whichever item the player happened to click
            // SECOND - which is why "use a serpentine visage on a chisel" did nothing while "use a
            // chisel on a visage" carved a helm: [opheldu,chisel] has a case list, and a visage was
            // not on it. A sweep of every pair of items that both declare a trigger found 963 pairs
            // that worked one way round only (tools/sim/opheldu.ts).
            //
            // A script says so by calling opheldu_decline, which ~displaymessage does for all 787 of
            // its "Nothing interesting happens." call sites. The offer is made once per click, so a
            // second refusal prints the message rather than bouncing the click back again.
            player.opheldUHandoverAvailable = opHeldUAlternate(player) !== null;
            player.opheldUHandoverAsked = false;
            player.executeScript(ScriptRunner.init(script, player), true);
            player.opheldUHandoverAvailable = false;

            if (player.opheldUHandoverAsked) {
                player.opheldUHandoverAsked = false;
                const other = opHeldUAlternate(player);
                // activeScript means the first script suspended rather than finished - it cannot
                // have both delayed and declined, but if it somehow did, starting a second script
                // here would strand the first one half-run.
                if (other && !player.activeScript) {
                    swap();
                    player.executeScript(ScriptRunner.init(other, player), true);
                }
            }
        } else {
            if (Environment.NODE_DEBUG) {
                player.messageGame(`No trigger for [opheldu,${objType.debugname}]`);
            }

            // todo: is this appropriate?
            player.messageGame('Nothing interesting happens.');
        }

        return true;
    }
}
