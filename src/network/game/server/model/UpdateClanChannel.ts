import ServerGameMessage from '#/network/game/server/ServerGameMessage.js';

export type ClanMemberInfo = {
    name: bigint;
    world: number;
    rank: number;
};

// custom (clan chat): the whole channel the receiver is in - who owns it, what it is called, who is
// in it and at what rank. owner 0 means not in a channel.
export default class UpdateClanChannel extends ServerGameMessage {
    constructor(
        readonly owner: bigint,
        readonly name: bigint,
        readonly kickRank: number,
        readonly members: ClanMemberInfo[]
    ) {
        super();
    }
}
