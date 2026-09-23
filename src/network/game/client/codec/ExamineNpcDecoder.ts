import Packet from '#/io/Packet.js';
import ClientGameMessageDecoder from '#/network/game/client/ClientGameMessageDecoder.js';
import ClientGameProt from '#/network/game/client/ClientGameProt.js';
import ExamineNpc from '#/network/game/client/model/ExamineNpc.js';

export default class ExamineNpcDecoder extends ClientGameMessageDecoder<ExamineNpc> {
    prot = ClientGameProt.EXAMINE_NPC;

    decode(buf: Packet) {
        return new ExamineNpc(buf.g2());
    }
}
