import WordEnc from '#/cache/wordenc/WordEnc.js';
import Packet from '#/io/Packet.js';
import ServerGameMessageEncoder from '#/network/game/server/ServerGameMessageEncoder.js';
import ServerGameProt from '#/network/game/server/ServerGameProt.js';
import MessageClan from '#/network/game/server/model/MessageClan.js';
import WordPack from '#/wordenc/WordPack.js';

export default class MessageClanEncoder extends ServerGameMessageEncoder<MessageClan> {
    prot = ServerGameProt.MESSAGE_CLAN;

    encode(buf: Packet, message: MessageClan): void {
        buf.p8(message.from);
        buf.p8(message.channel);
        buf.p4(message.messageId);
        buf.p1(message.icons);
        WordPack.pack(buf, WordEnc.filter(message.msg));
    }

    test(message: MessageClan): number {
        return 8 + 8 + 4 + 1 + 1 + message.msg.length;
    }
}
