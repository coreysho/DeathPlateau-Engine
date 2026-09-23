import ClientGameProtCategory from '#/network/game/client/ClientGameProtCategory.js';
import ClientGameMessage from '#/network/game/client/ClientGameMessage.js';

export default class ExamineNpc extends ClientGameMessage {
    category = ClientGameProtCategory.USER_EVENT;

    constructor(readonly npcSlot: number) {
        super();
    }
}
