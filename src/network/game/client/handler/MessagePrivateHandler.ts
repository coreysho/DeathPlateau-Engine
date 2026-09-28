import Player from '#/engine/entity/Player.js';
import World from '#/engine/World.js';
import ClientGameMessageHandler from '#/network/game/client/ClientGameMessageHandler.js';
import MessagePrivate from '#/network/game/client/model/MessagePrivate.js';
import { fromBase37 } from '#/util/JString.js';
import ChatText from '#/wordenc/ChatText.js';

export default class MessagePrivateHandler extends ClientGameMessageHandler<MessagePrivate> {
    handle(message: MessagePrivate, player: Player): boolean {
        const { username, input } = message;

        if (player.socialProtect || input.length > 100) {
            return false;
        }

        if (player.muted_until !== null && player.muted_until > new Date()) {
            // todo: do we still log their attempt to chat?
            return false;
        }

        if (fromBase37(username) === 'invalid_name') {
            World.notifyPlayerBan('automated', player.username, Date.now() + 172800000);
            return false;
        }

        const text = ChatText.decode(input);
        if (text.length === 0) {
            return false;
        }
        World.sendPrivateMessage(player, username, text);

        player.socialProtect = true;
        return true;
    }
}
