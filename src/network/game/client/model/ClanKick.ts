import ClientGameProtCategory from '#/network/game/client/ClientGameProtCategory.js';
import ClientGameMessage from '#/network/game/client/ClientGameMessage.js';

// custom (clan chat): kick this member out of the channel you are in
export default class ClanKick extends ClientGameMessage {
    category = ClientGameProtCategory.USER_EVENT;

    constructor(readonly target: bigint) {
        super();
    }
}
