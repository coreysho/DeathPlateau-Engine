import Packet from '#/io/Packet.js';
import ClientGameMessageDecoder from '#/network/game/client/ClientGameMessageDecoder.js';
import ClientGameProt from '#/network/game/client/ClientGameProt.js';
import Pong from '#/network/game/client/model/Pong.js';

export default class PongDecoder extends ClientGameMessageDecoder<Pong> {
    prot = ClientGameProt.PONG;

    decode(buf: Packet) {
        return new Pong(buf.g1());
    }
}
