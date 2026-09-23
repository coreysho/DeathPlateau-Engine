import ClanChat from '#/engine/clan/ClanChat.js';
import { ScriptOpcode } from '#/engine/script/ScriptOpcode.js';
import { CommandHandlers } from '#/engine/script/ScriptRunner.js';

// Clan Setup's four commands (custom, clan chat). All of them are about the ACTIVE PLAYER'S OWN
// channel - nobody sets up somebody else's. "which": 0 who can enter, 1 who can talk, 2 who can kick.
// A rank is -1 anyone, 0 any friends, 7 only me (engine/clan/ClanChat.ts has the rest).
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
    }
};

export default ClanOps;
