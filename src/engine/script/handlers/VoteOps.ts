import { ScriptOpcode } from '#/engine/script/ScriptOpcode.js';
import { CommandHandlers } from '#/engine/script/ScriptRunner.js';
import VoteService, { ClaimStatus } from '#/engine/vote/VoteService.js';
import VoteSites from '#/engine/vote/VoteSites.js';

// The script side of engine/vote. Content owns what a player is told and what a ticket is worth;
// this owns the ledger and the sites, and nothing here can hand out an item.
//
// THE SPLIT THAT MATTERS is vote_owed / vote_take. vote_owed only looks, so a clerk can mention a
// balance without spending it. vote_take moves tickets out of the ledger and returns how many it
// actually got - which is what content then passes to ~vote_grant_tickets, the one door that cannot
// fail. Taking first and granting second is the safe order precisely because the grant cannot fail:
// a full pack becomes %vote_tickets_pending rather than a ticket that fell on the floor.
//
// vote_claim is the odd one. Asking a toplist whether somebody voted is a web request and a script
// is not allowed to wait, so it starts the asking and returns a status at once. The answer lands a
// second or two later, credits, and queues [queue,vote_deliver] - which is why the clerk says it
// will go and look rather than printing a result it does not have yet.

const VoteOps: CommandHandlers = {
    // vote_sitecount()(int): how many voting sites are configured. 0 means voting is not set up,
    // which is the default and which content says out loud rather than papering over.
    [ScriptOpcode.VOTE_SITECOUNT]: state => {
        state.pushInt(VoteSites.count());
    },

    // vote_sitename(int $index)(string)
    [ScriptOpcode.VOTE_SITENAME]: state => {
        const index = state.popInt();
        state.pushString(VoteSites.all()[index]?.name ?? '');
    },

    // vote_siteurl(int $index)(string)
    [ScriptOpcode.VOTE_SITEURL]: state => {
        const index = state.popInt();
        state.pushString(VoteSites.all()[index]?.url ?? '');
    },

    // vote_cooldown(int $index)(int): seconds until the active player can be paid for this site
    // again, 0 if they can be paid now. Reads the ledger, so it is right whether the last vote came
    // from a callback or a claim.
    [ScriptOpcode.VOTE_COOLDOWN]: state => {
        const index = state.popInt();
        const site = VoteSites.all()[index];
        if (!site) {
            state.pushInt(0);
            return;
        }
        const cooldown = VoteSites.cooldownMs(site);
        // No ledger, no record of a last vote, so nothing is on cooldown. Reading a balance must
        // not throw into a script - see VoteService.ledgerOrNull.
        const last = VoteService.ledgerOrNull()?.lastVote(site.id, state.activePlayer.username) ?? 0;
        const left = last === 0 || cooldown === 0 ? 0 : cooldown - (Date.now() - last);
        state.pushInt(left > 0 ? Math.ceil(left / 1000) : 0);
    },

    // vote_claim()(int): go and ask every site that can be asked. Returns ^vote_claim_started,
    // ^vote_claim_nosites, ^vote_claim_busy or ^vote_claim_unavailable - see
    // content/scripts/vote/configs/vote.constant.
    [ScriptOpcode.VOTE_CLAIM]: state => {
        const player = state.activePlayer;
        const status = VoteService.claim(player.username, outcomes => {
            // The player may well have logged out while a toplist was thinking about it. The
            // tickets are in the ledger either way; this is only the talking.
            const credited = outcomes.filter(o => o.credited);
            if (credited.length) {
                // What they were given is said by [queue,vote_deliver], which is what hands it
                // over. This only names where it came from.
                player.wrappedMessageGame(`Thank you for voting on ${credited.map(o => o.site.name).join(', ')}.`);
                return;
            }
            if (!outcomes.length) {
                player.wrappedMessageGame('Something went wrong checking your votes. Try again shortly.');
                return;
            }
            if (outcomes.every(o => o.reason === 'unreachable')) {
                player.wrappedMessageGame('The voting sites are not answering right now. Try again shortly.');
                return;
            }
            if (outcomes.some(o => o.reason === 'cooldown' || o.reason === 'already claimed')) {
                player.wrappedMessageGame('You have already claimed everything you can for now.');
                return;
            }
            player.wrappedMessageGame('No new votes found. If you have just voted, give the site a minute.');
        });
        // Written out rather than passed through: the enum and the ^vote_claim_* constants are two
        // files that happen to agree on four numbers, and this is where they are made to.
        state.pushInt(status === ClaimStatus.STARTED ? 0 : status === ClaimStatus.NO_SITES ? 1 : status === ClaimStatus.BUSY ? 2 : 3);
    },

    // vote_owed()(int): tickets credited to the active player and not yet handed over. Looks only.
    [ScriptOpcode.VOTE_OWED]: state => {
        state.pushInt(VoteService.owed(state.activePlayer.username));
    },

    // vote_take(int $count)(int): take up to $count tickets out of the ledger and return how many
    // were actually taken. Whatever comes back has left the ledger and is content's to hand over.
    [ScriptOpcode.VOTE_TAKE]: state => {
        const want = state.popInt();
        state.pushInt(VoteService.take(state.activePlayer.username, want));
    }
};

export default VoteOps;
