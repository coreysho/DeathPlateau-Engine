import Packet from '#/io/Packet.js';
import ClientGameMessageDecoder from '#/network/game/client/ClientGameMessageDecoder.js';
import ClientGameProt from '#/network/game/client/ClientGameProt.js';
import ClanMessage from '#/network/game/client/model/ClanMessage.js';

export default class ClanMessageDecoder extends ClientGameMessageDecoder<ClanMessage> {
    prot = ClientGameProt.CLAN_MESSAGE;

    decode(buf: Packet, length: number) {
        const input = buf.data.slice(buf.pos, buf.pos + length);
        buf.pos += length;
        return new ClanMessage(input);
    }
}
