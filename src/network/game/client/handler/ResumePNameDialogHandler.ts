import Player from '#/engine/entity/Player.js';
import ScriptState from '#/engine/script/ScriptState.js';
import ClientGameMessageHandler from '#/network/game/client/ClientGameMessageHandler.js';
import ResumePNameDialog from '#/network/game/client/model/ResumePNameDialog.js';
import { fromBase37 } from '#/util/JString.js';

// The answer to p_namedialog. It arrives base37-packed - a-z, 0-9 and _, twelve at most - and is
// handed to the script as that string, underscores for spaces, exactly as a username would be.
export default class ResumePNameDialogHandler extends ClientGameMessageHandler<ResumePNameDialog> {
    handle(message: ResumePNameDialog, player: Player): boolean {
        if (!player.activeScript || player.activeScript.execution !== ScriptState.NAMEDIALOG) {
            return false;
        }

        player.activeScript.lastString = fromBase37(message.input);
        player.executeScript(player.activeScript, true, true);
        return true;
    }
}
