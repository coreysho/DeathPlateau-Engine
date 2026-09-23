import ClanChat from '#/engine/clan/ClanChat.js';
import { fromBase37, toDisplayName } from '#/util/JString.js';
import { ScriptOpcode } from '#/engine/script/ScriptOpcode.js';
import { CommandHandlers } from '#/engine/script/ScriptRunner.js';

// Clan Setup's four commands (custom, clan chat). All of them are about the ACTIVE PLAYER'S OWN
// channel - nobody sets up somebody else's. "which": 0 who can enter, 1 who can talk, 2 who can kick.
// A rank is -1 anyone, 0 any friends, 1-6 Recruit to General, 7 only me (engine/clan/ClanChat.ts).
// The friend commands index the owner's friends by name, the order Clan Setup lists them in.
const ClanOps: CommandHandlers = {
    // clan_setname(string $name): "" closes the channel and puts everybody in it out.
    [ScriptOpcode.CLAN_SETNAME]: state => {
        ClanChat.setName(state.activePlayer, state.popString());
    },

    [ScriptOpcode.CLAN_SETRANK]: state => {
        const [which, rank] = state.popInts(2);
        ClanChat.setRank(state.activePlayer, which, rank);
    },

    [ScriptOpcode.CLAN_NAME]: state => {
        state.pushString(ClanChat.nameOf(state.activePlayer.username));
    },

    [ScriptOpcode.CLAN_RANK]: state => {
        state.pushInt(ClanChat.rankSetting(state.activePlayer.username, state.popInt()));
    },

    [ScriptOpcode.CLAN_FRIEND_COUNT]: state => {
        state.pushInt(ClanChat.friendsOf(state.activePlayer).length);
    },

    [ScriptOpcode.CLAN_FRIEND]: state => {
        const friend = ClanChat.friendsOf(state.activePlayer)[state.popInt()];
        state.pushString(friend === undefined ? '' : toDisplayName(fromBase37(friend)));
    },

    [ScriptOpcode.CLAN_FRIEND_RANK]: state => {
        state.pushInt(ClanChat.friendRank(state.activePlayer, state.popInt()));
    },

    [ScriptOpcode.CLAN_SETFRIENDRANK]: state => {
        const [index, rank] = state.popInts(2);
        ClanChat.setFriendRank(state.activePlayer, index, rank);
    }
};

export default ClanOps;
