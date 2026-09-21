import ServerGameMessage from '#/network/game/server/ServerGameMessage.js';

// Opens the chatbox's "Enter name:" prompt. The client has always handled it; nothing sent it.
export default class PNameDialog extends ServerGameMessage {}
