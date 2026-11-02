import Packet from '#/io/Packet.js';
import ServerGameMessageEncoder from '#/network/game/server/ServerGameMessageEncoder.js';
import ServerGameProt from '#/network/game/server/ServerGameProt.js';
import SetLoginToken from '#/network/game/server/model/SetLoginToken.js';

export default class SetLoginTokenEncoder extends ServerGameMessageEncoder<SetLoginToken> {
    prot = ServerGameProt.SET_LOGIN_TOKEN;

    encode(buf: Packet, message: SetLoginToken): void {
        buf.pjstr(message.token);
    }

    test(message: SetLoginToken): number {
        return 1 + message.token.length;
    }
}
