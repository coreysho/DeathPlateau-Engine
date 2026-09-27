import * as rsbuf from '#/network/rsbuf/index.js';

import { Interaction } from '#/engine/entity/Interaction.js';
import { NetworkPlayer } from '#/engine/entity/NetworkPlayer.js';
import ServerTriggerType from '#/engine/script/ServerTriggerType.js';
import World from '#/engine/World.js';
import ClientGameMessageHandler from '#/network/game/client/ClientGameMessageHandler.js';
import OpPlayer from '#/network/game/client/model/OpPlayer.js';
import UnsetMapFlag from '#/network/game/server/model/UnsetMapFlag.js';

export default class OpPlayerHandler extends ClientGameMessageHandler<OpPlayer> {
    handle(message: OpPlayer, player: NetworkPlayer): boolean {
        const { playerSlot } = message;

        if (player.delayed) {
            // normal: cannot interact while delayed
            player.write(new UnsetMapFlag());
            return false;
        }

        const other = World.getPlayer(playerSlot);
        if (!other) {
            // bad client or lag: player does not exist
            player.write(new UnsetMapFlag());
            return false;
        }

        if (!rsbuf.hasPlayer(player.slot, other.slot)) {
            // bad client or lag: player is not visible on client
            player.write(new UnsetMapFlag());
            return false;
        }

        // custom (2026-09-27) - a bot fights and can be followed; it does not trade, duel or answer
        // anything else (engine/bot). Attack is op 2 and Follow op 3 wherever set_player_op puts them.
        if (other.isBot && message.op !== 2 && message.op !== 3) {
            player.messageGame(`${other.displayName} is a bot - it doesn't trade or duel.`);
            player.write(new UnsetMapFlag());
            return false;
        }

        // todo: validate set_player_op is set?

        const trigger: ServerTriggerType = ServerTriggerType.APPLAYER1 + (message.op - 1);
        player.clearPendingAction();
        player.setInteraction(Interaction.ENGINE, other, trigger);
        player.opcalled = true;
        return true;
    }
}
