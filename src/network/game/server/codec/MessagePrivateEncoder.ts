import WordEnc from '#/cache/wordenc/WordEnc.js';
import Packet from '#/io/Packet.js';
import ServerGameMessageEncoder from '#/network/game/server/ServerGameMessageEncoder.js';
import ServerGameProt from '#/network/game/server/ServerGameProt.js';
import MessagePrivate from '#/network/game/server/model/MessagePrivate.js';
import WordPack from '#/wordenc/WordPack.js';
import { chatCrown } from '#/engine/entity/ChatCrown.js';

export default class MessagePrivateEncoder extends ServerGameMessageEncoder<MessagePrivate> {
    prot = ServerGameProt.MESSAGE_PRIVATE;

    encode(buf: Packet, message: MessagePrivate): void {
        const staffLvl: number = chatCrown(message.staffModLevel);

        buf.p8(message.from);
        buf.p4(message.messageId);
        buf.p1(staffLvl);
        WordPack.pack(buf, WordEnc.filter(message.msg));
    }

    test(message: MessagePrivate): number {
        return 8 + 4 + 1 + 1 + message.msg.length;
    }
}
