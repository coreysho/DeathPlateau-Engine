import ServerGameMessage from '#/network/game/server/ServerGameMessage.js';

// custom (clan chat): one line said in the channel the receiver is in
export default class MessageClan extends ServerGameMessage {
    constructor(
        readonly from: bigint,
        readonly channel: bigint,
        readonly messageId: number,
        readonly icons: number,
        readonly msg: string
    ) {
        super();
    }
}
