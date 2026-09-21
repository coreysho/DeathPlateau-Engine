import Packet from '#/io/Packet.js';
import ServerGameMessageEncoder from '#/network/game/server/ServerGameMessageEncoder.js';
import ServerGameProt from '#/network/game/server/ServerGameProt.js';
import PDialogPrompt from '#/network/game/server/model/PDialogPrompt.js';

export default class PDialogPromptEncoder extends ServerGameMessageEncoder<PDialogPrompt> {
    prot = ServerGameProt.P_DIALOGPROMPT;

    encode(buf: Packet, message: PDialogPrompt): void {
        buf.pjstr(message.text);
    }

    test(message: PDialogPrompt): number {
        return 1 + message.text.length;
    }
}
