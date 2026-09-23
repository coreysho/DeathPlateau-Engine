import ClanChat from '#/engine/clan/ClanChat.js';
import Player from '#/engine/entity/Player.js';
import ClientGameMessageHandler from '#/network/game/client/ClientGameMessageHandler.js';
import ClanKick from '#/network/game/client/model/ClanKick.js';

export default class ClanKickHandler extends ClientGameMessageHandler<ClanKick> {
    handle(message: ClanKick, player: Player): boolean {
        if (player.socialProtect) {
            return false;
        }

        ClanChat.kick(player, message.target);

        player.socialProtect = true;
        return true;
    }
}
