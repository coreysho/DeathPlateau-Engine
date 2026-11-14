import ServerGameMessage from '#/network/game/server/ServerGameMessage.js';

export default class MessagePrivate extends ServerGameMessage {
    constructor(
        readonly from: bigint,
        readonly messageId: number,
        /**
         * The ICON to draw beside the sender, as chatCrown's number - not their staff level.
         * It was the staff level, which is why a veteran's private message arrived with no
         * emblem while the same player's public chat had one. The two are deliberately separate
         * fields on the wire from the friend server: staffLvl still means staff level, because
         * FriendServerRepository.register treats anything above 1 as staff and crown 7 would
         * quietly enrol every veteran.
         */
        readonly crown: number,
        readonly msg: string
    ) {
        super();
    }
}
