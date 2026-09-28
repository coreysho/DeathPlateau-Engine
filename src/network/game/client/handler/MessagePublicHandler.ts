import { PlayerInfoProt } from '#/network/rsbuf/index.js';

import WordEnc from '#/cache/wordenc/WordEnc.js';
import Player from '#/engine/entity/Player.js';
import ClientGameMessageHandler from '#/network/game/client/ClientGameMessageHandler.js';
import MessagePublic from '#/network/game/client/model/MessagePublic.js';
import ChatText from '#/wordenc/ChatText.js';
import { chatCrown } from '#/engine/entity/ChatCrown.js';

export default class MessagePublicHandler extends ClientGameMessageHandler<MessagePublic> {
    handle(message: MessagePublic, player: Player): boolean {
        const { colour, effect, input } = message;

        if (player.socialProtect || colour < 0 || colour > 11 || effect < 0 || effect > 5 || input.length > 100) {
            return false;
        }

        if (player.muted_until !== null && player.muted_until > new Date()) {
            // todo: do we still log their attempt to chat?
            return false;
        }

        // the line as typed (ChatText) - case, '@', '<', '_' and all. Effects 3-5 are the client's
        // shake, scroll and slide; the 225-era bound of 2 threw those lines away.
        const unpack: string = ChatText.decode(input);
        if (unpack.length === 0) {
            return false;
        }

        player.chatColour = colour;
        player.chatEffect = effect;
        player.chatRights = chatCrown(player.staffModLevel);
        player.logMessage = unpack;

        player.chatMessage = ChatText.encode(WordEnc.filter(unpack));
        player.masks |= PlayerInfoProt.CHAT;

        player.socialProtect = true;
        return true;
    }
}
