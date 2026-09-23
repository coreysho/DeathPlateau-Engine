import Packet from '#/io/Packet.js';
import ClientGameMessageDecoder from '#/network/game/client/ClientGameMessageDecoder.js';
import ClientGameProt from '#/network/game/client/ClientGameProt.js';
import ClanJoinChat from '#/network/game/client/model/ClanJoinChat.js';

export default class ClanJoinChatDecoder extends ClientGameMessageDecoder<ClanJoinChat> {
    prot = ClientGameProt.CLAN_JOINCHAT;

    decode(buf: Packet) {
        return new ClanJoinChat(buf.g8());
    }
}
