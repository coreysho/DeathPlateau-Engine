import Packet from '#/io/Packet.js';
import ClientGameMessageDecoder from '#/network/game/client/ClientGameMessageDecoder.js';
import ClientGameProt from '#/network/game/client/ClientGameProt.js';
import ClanKick from '#/network/game/client/model/ClanKick.js';

export default class ClanKickDecoder extends ClientGameMessageDecoder<ClanKick> {
    prot = ClientGameProt.CLAN_KICK;

    decode(buf: Packet) {
        return new ClanKick(buf.g8());
    }
}
