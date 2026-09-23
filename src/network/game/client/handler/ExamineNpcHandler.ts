import * as rsbuf from '#/network/rsbuf/index.js';

import NpcType from '#/cache/config/NpcType.js';
import Npc from '#/engine/entity/Npc.js';
import Player from '#/engine/entity/Player.js';
import ScriptProvider from '#/engine/script/ScriptProvider.js';
import ScriptRunner from '#/engine/script/ScriptRunner.js';
import World from '#/engine/World.js';
import ClientGameMessageHandler from '#/network/game/client/ClientGameMessageHandler.js';
import ExamineNpc from '#/network/game/client/model/ExamineNpc.js';

// Examine on an npc. The client used to print the description itself; now it asks, and
// [proc,npc_examine] in content (skill_combat/scripts/player/elemental_weakness.rs2) answers with
// the description and anything else worth knowing - the elemental weakness, for one.
//
// It is not an interaction: the player does not walk, face or stop what they are doing, and a
// delayed player can still read what a thing is, exactly as they could when the client did it.
export default class ExamineNpcHandler extends ClientGameMessageHandler<ExamineNpc> {
    handle(message: ExamineNpc, player: Player): boolean {
        const npc = World.getNpc(message.npcSlot);
        if (!npc || !rsbuf.hasNpc(player.slot, npc.nid)) {
            // lag or a bad client: nothing that player can see
            return false;
        }

        ExamineNpcHandler.examine(player, npc);
        return true;
    }

    /**
     * Everything after the visibility gate, on its own so it can be driven without a network client
     * (tools/sim/run.ts examine): the engine builds a player's npc view only for a connected client,
     * so the gate in handle() - the same rsbuf.hasNpc check OpNpcHandler makes - cannot pass there.
     */
    static examine(player: Player, npc: Npc): void {
        // The form THIS player sees, as OpNpcHandler resolves it - a quest npc can be a different
        // npc per player, and the examine should describe the one on their screen.
        let npcType = NpcType.get(npc.type);
        if (npcType.multivarp !== -1) {
            const state = player.getVar(npcType.multivarp) as number;
            if (state >= 0 && state < npcType.multinpc.length && npcType.multinpc[state] !== -1) {
                npcType = NpcType.get(npcType.multinpc[state]);
            }
        } else if (npcType.multivarbit !== -1) {
            const state = player.getVarBit(npcType.multivarbit);
            if (state >= 0 && state < npcType.multinpc.length && npcType.multinpc[state] !== -1) {
                npcType = NpcType.get(npcType.multinpc[state]);
            }
        }

        const script = ScriptProvider.getByName('[proc,npc_examine]');
        if (!script) {
            // a content build from before npc_examine: say what the client used to
            player.messageGame(npcType.desc ?? `It's a ${npcType.name}.`);
            return;
        }
        player.executeScript(ScriptRunner.init(script, player, null, [npcType.id]), false);
    }
}
