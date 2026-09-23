import ClientGameProtCategory from '#/network/game/client/ClientGameProtCategory.js';
import ClientGameMessage from '#/network/game/client/ClientGameMessage.js';

// custom (clan chat): the owner whose channel to join, or 0 to leave the one you are in
export default class ClanJoinChat extends ClientGameMessage {
    category = ClientGameProtCategory.USER_EVENT;

    constructor(readonly owner: bigint) {
        super();
    }
}
