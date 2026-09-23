import ClanChat from '#/engine/clan/ClanChat.js';
import Player from '#/engine/entity/Player.js';
import Packet from '#/io/Packet.js';
import ClientGameMessageHandler from '#/network/game/client/ClientGameMessageHandler.js';
import ClanMessage from '#/network/game/client/model/ClanMessage.js';
import WordPack from '#/wordenc/WordPack.js';

export default class ClanMessageHandler extends ClientGameMessageHandler<ClanMessage> {
    handle(message: ClanMessage, player: Player): boolean {
        const { input } = message;

        if (player.socialProtect || input.length > 100) {
            return false;
        }

        if (player.muted_until !== null && player.muted_until > new Date()) {
            return false;
        }

        const buf: Packet = Packet.alloc(0);
        buf.pdata(input, 0, input.length);
        buf.pos = 0;
        const text = WordPack.unpack(buf, input.length);
        buf.release();

        ClanChat.message(player, text);

        player.socialProtect = true;
        return true;
    }
}
