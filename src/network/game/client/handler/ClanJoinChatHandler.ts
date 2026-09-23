import ClanChat from '#/engine/clan/ClanChat.js';
import Player from '#/engine/entity/Player.js';
import ClientGameMessageHandler from '#/network/game/client/ClientGameMessageHandler.js';
import ClanJoinChat from '#/network/game/client/model/ClanJoinChat.js';
import { fromBase37 } from '#/util/JString.js';

export default class ClanJoinChatHandler extends ClientGameMessageHandler<ClanJoinChat> {
    handle(message: ClanJoinChat, player: Player): boolean {
        if (player.socialProtect) {
            return false;
        }

        if (message.owner === 0n) {
            ClanChat.leave(player, true);
        } else {
            const owner = fromBase37(message.owner);
            if (owner === 'invalid_name') {
                return false;
            }
            ClanChat.join(player, owner);
        }

        player.socialProtect = true;
        return true;
    }
}
