import Packet from '#/io/Packet.js';
import ClientGameMessageDecoder from '#/network/game/client/ClientGameMessageDecoder.js';
import ClientGameProt from '#/network/game/client/ClientGameProt.js';
import WearOp from '#/network/game/client/model/WearOp.js';

export default class WearOpDecoder extends ClientGameMessageDecoder<WearOp> {
    prot = ClientGameProt.WEAROP;

    decode(buf: Packet) {
        const op = buf.g1();
        const obj = buf.g2();
        const slot = buf.g2();
        const com = buf.g2();
        return new WearOp(op, obj, slot, com);
    }
}
