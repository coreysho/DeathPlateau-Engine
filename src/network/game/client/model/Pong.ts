import ClientGameProtCategory from '#/network/game/client/ClientGameProtCategory.js';
import ClientGameMessage from '#/network/game/client/ClientGameMessage.js';

/** custom (2026-11-03) - the client's immediate answer to ServerGameProt.PING. */
export default class Pong extends ClientGameMessage {
    category = ClientGameProtCategory.CLIENT_EVENT;

    constructor(readonly seq: number) {
        super();
    }
}
