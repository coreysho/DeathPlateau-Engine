import Packet from '#/io/Packet.js';
import ServerGameMessageEncoder from '#/network/game/server/ServerGameMessageEncoder.js';
import ServerGameProt from '#/network/game/server/ServerGameProt.js';
import UpdateClanChannel from '#/network/game/server/model/UpdateClanChannel.js';

export default class UpdateClanChannelEncoder extends ServerGameMessageEncoder<UpdateClanChannel> {
    prot = ServerGameProt.UPDATE_CLANCHANNEL;

    encode(buf: Packet, message: UpdateClanChannel): void {
        buf.p8(message.owner);
        if (message.owner === 0n) {
            return;
        }
        buf.p8(message.name);
        buf.p1(message.kickRank);
        buf.p1(message.members.length);
        for (const member of message.members) {
            buf.p8(member.name);
            buf.p2(member.world);
            buf.p1(member.rank);
        }
    }

    test(message: UpdateClanChannel): number {
        return 8 + 8 + 1 + 1 + message.members.length * 11;
    }
}
