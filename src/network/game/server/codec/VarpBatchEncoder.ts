import Packet from '#/io/Packet.js';
import ServerGameMessageEncoder from '#/network/game/server/ServerGameMessageEncoder.js';
import ServerGameProt from '#/network/game/server/ServerGameProt.js';
import VarpBatch from '#/network/game/server/model/VarpBatch.js';

/**
 * PLAIN BYTE ORDER, deliberately. The varp encoders either side of this one use p2_alt2 and
 * p1_alt3, because the client they were written for reads them in Jagex's shuffled orders and the
 * server has to match. This packet is ours at both ends, so it is written the obvious way and read
 * the obvious way - see Client.java, ptype == 114. Imitating the obfuscation would buy nothing and
 * cost the next person half an hour.
 *
 * ROOM TO GROW, checked rather than assumed. The length is a short, so the packet has to stay under
 * 65535 bytes. The client keeps 4000 varps (Client.VARP_COUNT) and drops any id past that, and 4000
 * in the large half - the expensive one - is 6 bytes each plus the two counts, so 24004. The ceiling
 * is around 10900 varps, which is 36 times what the content has and nearly three times what the
 * client would accept, so there is no split to write here. If that ever stops being true, psize2
 * wraps silently rather than failing, the way BANDWIDTH_OUT did at 16 bits.
 */
export default class VarpBatchEncoder extends ServerGameMessageEncoder<VarpBatch> {
    prot = ServerGameProt.VARP_BATCH;

    encode(buf: Packet, message: VarpBatch): void {
        buf.p2(message.small.length);
        for (const [varp, value] of message.small) {
            buf.p2(varp);
            buf.p1(value & 0xff);
        }

        buf.p2(message.large.length);
        for (const [varp, value] of message.large) {
            buf.p2(varp);
            buf.p4(value);
        }
    }
}
