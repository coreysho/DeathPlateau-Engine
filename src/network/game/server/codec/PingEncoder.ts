import Packet from '#/io/Packet.js';
import ServerGameMessageEncoder from '#/network/game/server/ServerGameMessageEncoder.js';
import ServerGameProt from '#/network/game/server/ServerGameProt.js';
import Ping from '#/network/game/server/model/Ping.js';

export default class PingEncoder extends ServerGameMessageEncoder<Ping> {
    prot = ServerGameProt.PING;

    encode(buf: Packet, message: Ping): void {
        buf.p1(message.seq);
        buf.p2(message.lastRtt);
    }
}
