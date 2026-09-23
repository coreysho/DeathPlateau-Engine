import ClientGameProtCategory from '#/network/game/client/ClientGameProtCategory.js';
import ClientGameMessage from '#/network/game/client/ClientGameMessage.js';

// custom (clan chat): a line typed with "/" in front, word-packed like public and private chat
export default class ClanMessage extends ClientGameMessage {
    category = ClientGameProtCategory.USER_EVENT;

    constructor(readonly input: Uint8Array) {
        super();
    }
}
