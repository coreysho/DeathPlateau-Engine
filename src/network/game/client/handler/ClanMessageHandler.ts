import ClanChat from '#/engine/clan/ClanChat.js';
import Player from '#/engine/entity/Player.js';
import ClientGameMessageHandler from '#/network/game/client/ClientGameMessageHandler.js';
import ClanMessage from '#/network/game/client/model/ClanMessage.js';
import ChatText from '#/wordenc/ChatText.js';

export default class ClanMessageHandler extends ClientGameMessageHandler<ClanMessage> {
    handle(message: ClanMessage, player: Player): boolean {
        const { input } = message;

        if (player.socialProtect || input.length > 100) {
            return false;
        }

        if (player.muted_until !== null && player.muted_until > new Date()) {
            return false;
        }

        const text = ChatText.decode(input);
        if (text.length === 0) {
            return false;
        }

        ClanChat.message(player, text);

        player.socialProtect = true;
        return true;
    }
}
