import ServerGameMessage from '#/network/game/server/ServerGameMessage.js';

// custom (2026-09-21) - the text the NEXT count or name dialog shows in place of the client's own
// "Enter amount:" / "Enter name:". Sent immediately before P_COUNTDIALOG or P_NAMEDIALOG.
export default class PDialogPrompt extends ServerGameMessage {
    constructor(readonly text: string) {
        super();
    }
}
