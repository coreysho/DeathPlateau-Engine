import VoteBook, { CreditResult } from '#/engine/vote/VoteBook.js';
import VoteSites, { VoteSite } from '#/engine/vote/VoteSites.js';
import World from '#/engine/World.js';
import ScriptProvider from '#/engine/script/ScriptProvider.js';
import Environment from '#/util/Environment.js';
import { printError, printInfo } from '#/util/Logger.js';

// THE VOTE SERVICE. Both ways a vote can arrive end here, and here is where a credited vote becomes
// tickets in somebody's hand.
//
//   a site calls us    src/web.ts  ->  fromCallback()
//   a player claims    vote_claim  ->  claim()
//
// Both finish at VoteBook.credit(), which is the only thing that writes a vote down, and then at
// deliver(), which is the only thing that tries to hand it over.
//
// NOTHING HERE TOUCHES AN INVENTORY. The ledger owes the tickets; the game hands them over, through
// [queue,vote_deliver] -> ~vote_grant_tickets, which is content's only door for being given one and
// which cannot fail (a full pack goes to %vote_tickets_pending and the clerk holds it). So a vote
// credited while the player is offline, mid-fight, or standing in a bank with 28 full slots is the
// same vote: it is owed, and it is handed over the next time the game can.
//
// THE CLAIM IS ASYNCHRONOUS AND A SCRIPT IS NOT. vote_claim starts the asking and returns at once;
// the answer arrives a second or two later, credits, and pokes the player. That is why the clerk
// says "let me look" rather than printing a result - there is nothing to print yet.

export const enum ClaimStatus {
    /** Asking the sites now. Something will be said when they answer. */
    STARTED = 0,
    /** No site is configured with a check, so there is nothing to ask. */
    NO_SITES = 1,
    /** This player already has a claim in flight. */
    BUSY = 2,
    /** The ledger will not open, so there is nowhere to put a vote even if one is found. */
    UNAVAILABLE = 3
}

export type ClaimOutcome = {
    site: VoteSite;
    /** A vote was found and credited. */
    credited: boolean;
    /** Why not, in a few words, when it was not. */
    reason: string;
};

let book: VoteBook | null = null;
let bookRefused = false;
const inFlight = new Set<string>();

export default class VoteService {
    static ledger(): VoteBook {
        if (!book) {
            const file = Environment.VOTE_LEDGER || `data/vote/${Environment.NODE_PROFILE}.sqlite`;
            book = new VoteBook(file);
            printInfo(`Vote ledger open: ${file}`);
        }
        return book;
    }

    /**
     * The ledger, or null if it will not open.
     *
     * VOTING IS NOT WORTH A BROKEN LOGIN. [login,_] calls ~vote_login, so the first thing a failed
     * ledger did was throw a script error into the chatbox and abandon the REST OF THE LOGIN SCRIPT
     * - everything after that line, for a feature this server has no voting site for yet. The
     * callers that only read a balance go through here instead and get nothing rather than an
     * exception; the ones that would have to invent an answer (a callback crediting a real vote)
     * still refuse out loud.
     *
     * It is tried once. A ledger that cannot be opened now will not open itself a tick later, and
     * retrying on every vote_owed would put the same stack trace in the log at every login.
     */
    static ledgerOrNull(): VoteBook | null {
        if (book) {
            return book;
        }
        if (bookRefused) {
            return null;
        }
        try {
            return VoteService.ledger();
        } catch (err) {
            bookRefused = true;
            printError(`vote: ${err instanceof Error ? err.message : err}`);
            printError('vote: voting is off until that is fixed. Nothing else is affected.');
            return null;
        }
    }

    /** Only for the tests, which run the whole service against an in-memory ledger. */
    static useLedger(replacement: VoteBook | null) {
        book = replacement;
        bookRefused = false;
        inFlight.clear();
    }

    // ------------------------------------------------------------------ a site calling us

    /**
     * What the HTTP route hands over: a site id and whatever came in the query string and the body.
     * The two are merged because sites disagree about which they use and several send the same
     * values in both, with the body winning - it is the one a site signs.
     */
    static fromHttp(siteId: string, query: unknown, body: unknown): { status: number; body: string } {
        const params: Record<string, string> = {};
        for (const source of [query, body]) {
            if (!source || typeof source !== 'object') {
                continue;
            }
            for (const [k, v] of Object.entries(source as Record<string, unknown>)) {
                if (v === null || typeof v === 'object') {
                    continue; // a nested object is not a parameter any toplist sends
                }
                params[k] = String(v);
            }
        }
        return VoteService.fromCallback(siteId, params);
    }

    /**
     * A site's callback, as flat parameters.
     *
     * Returns a line for the HTTP response. The site is a machine: it wants 200 and a word.
     */
    static fromCallback(siteId: string, params: Record<string, string>): { status: number; body: string } {
        const site = VoteSites.get(siteId);
        if (!site || !site.callback) {
            // Deliberately the same answer as a bad secret. An unlisted id and a wrong key should
            // not be distinguishable from outside.
            return { status: 404, body: 'unknown' };
        }

        const given = params[site.callback.secretParam ?? 'secret'] ?? '';
        if (!timingSafeEqual(given, site.callback.secret)) {
            printError(`vote: ${siteId} callback with a wrong secret`);
            return { status: 404, body: 'unknown' };
        }

        const username = (params[site.callback.userParam] ?? '').trim();
        if (!username.length || username.length > 12) {
            return { status: 400, body: 'no player' };
        }

        const at = Date.now();
        const ref = (site.callback.refParam ? params[site.callback.refParam] : '') || VoteBook.refForWindow(username, at, VoteSites.cooldownMs(site));
        // No cooldown on a callback: the site has already decided this vote counts, and refusing it
        // because our clock disagrees with theirs is how a real vote goes unpaid. The (site, ref)
        // key is what stops a retry paying twice.
        const ledger = VoteService.ledgerOrNull();
        if (!ledger) {
            // A real vote, and nowhere to write it down. 503 rather than 200: every toplist that
            // retries a callback retries on a non-200, so the vote is not lost by saying so.
            return { status: 503, body: 'unavailable' };
        }
        const result = ledger.credit(site.id, ref, username, site.tickets, at, 0);
        if (result === CreditResult.DUPLICATE) {
            return { status: 200, body: 'duplicate' };
        }
        printInfo(`vote: ${username} credited ${site.tickets} from ${site.id}`);
        VoteService.deliver(username);
        return { status: 200, body: 'ok' };
    }

    // ------------------------------------------------------------------ us asking a site

    /** Sites that can be asked whether a player has voted. */
    static checkable(): VoteSite[] {
        return VoteSites.all().filter(s => s.check);
    }

    /**
     * Ask every checkable site whether this player has voted, and credit what comes back. Returns
     * immediately; `onDone` runs when every site has answered or timed out.
     */
    static claim(username: string, onDone?: (outcomes: ClaimOutcome[]) => void): ClaimStatus {
        const who = username.toLowerCase();
        if (!VoteService.ledgerOrNull()) {
            return ClaimStatus.UNAVAILABLE;
        }
        const sites = VoteService.checkable();
        if (!sites.length) {
            return ClaimStatus.NO_SITES;
        }
        if (inFlight.has(who)) {
            return ClaimStatus.BUSY;
        }
        inFlight.add(who);

        Promise.all(sites.map(site => VoteService.claimOne(site, who)))
            .then(outcomes => {
                inFlight.delete(who);
                if (outcomes.some(o => o.credited)) {
                    VoteService.deliver(who);
                }
                onDone?.(outcomes);
            })
            .catch(err => {
                inFlight.delete(who);
                printError(`vote: claim for ${who} fell over: ${err instanceof Error ? err.message : err}`);
                onDone?.([]);
            });

        return ClaimStatus.STARTED;
    }

    private static async claimOne(site: VoteSite, username: string): Promise<ClaimOutcome> {
        const cooldown = VoteSites.cooldownMs(site);
        const since = VoteService.ledger().lastVote(site.id, username);
        const now = Date.now();
        if (cooldown > 0 && since > 0 && now - since < cooldown) {
            return { site, credited: false, reason: 'cooldown' };
        }

        let body: string;
        try {
            body = await VoteService.ask(site, username);
        } catch (err) {
            printError(`vote: ${site.id} would not answer for ${username}: ${err instanceof Error ? err.message : err}`);
            return { site, credited: false, reason: 'unreachable' };
        }

        if (!matches(body, site)) {
            return { site, credited: false, reason: 'no vote' };
        }

        const ref = refFrom(body, site) || VoteBook.refForWindow(username, now, cooldown);
        const result = VoteService.ledger().credit(site.id, ref, username, site.tickets, now, cooldown);
        if (result !== CreditResult.CREDITED) {
            return { site, credited: false, reason: result === CreditResult.DUPLICATE ? 'already claimed' : 'cooldown' };
        }
        printInfo(`vote: ${username} claimed ${site.tickets} from ${site.id}`);
        return { site, credited: true, reason: 'credited' };
    }

    private static async ask(site: VoteSite, username: string): Promise<string> {
        const check = site.check!;
        const url = check.url.replaceAll('{user}', encodeURIComponent(username)).replaceAll('{key}', encodeURIComponent(check.key ?? ''));
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), Environment.VOTE_CHECK_TIMEOUT);
        try {
            const res = await fetch(url, {
                method: check.method ?? 'GET',
                headers: check.headers,
                signal: controller.signal
            });
            return await res.text();
        } finally {
            clearTimeout(timer);
        }
    }

    // ------------------------------------------------------------------ handing them over

    static owed(username: string): number {
        return VoteService.ledgerOrNull()?.owed(username) ?? 0;
    }

    static take(username: string, want: number): number {
        return VoteService.ledgerOrNull()?.take(username, want) ?? 0;
    }

    /**
     * Poke an online player so the game hands over what they are owed now rather than at their next
     * login. Silent if they are not on this world - the ledger keeps.
     */
    static deliver(username: string) {
        const player = World.getPlayerByUsername(username.toLowerCase());
        if (!player) {
            return;
        }
        const script = ScriptProvider.getByName('[queue,vote_deliver]');
        if (!script) {
            printError('vote: [queue,vote_deliver] is missing from the content - tickets will sit in the ledger');
            return;
        }
        player.enqueueScript(script);
    }
}

/** Compares in time that does not depend on how much of the secret was right. */
function timingSafeEqual(a: string, b: string): boolean {
    if (a.length !== b.length || !a.length) {
        return false;
    }
    let diff = 0;
    for (let i = 0; i < a.length; i++) {
        diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
    }
    return diff === 0;
}

function dig(body: string, path: string): unknown {
    let node: unknown;
    try {
        node = JSON.parse(body);
    } catch {
        return undefined;
    }
    for (const key of path.split('.')) {
        if (node === null || typeof node !== 'object') {
            return undefined;
        }
        node = (node as Record<string, unknown>)[key];
    }
    return node;
}

/** Does this response say the player voted? */
function matches(body: string, site: VoteSite): boolean {
    const want = site.check!.success;
    if (want.contains !== undefined) {
        return body.includes(want.contains);
    }
    if (want.json !== undefined) {
        const got = dig(body, want.json);
        // Loose on purpose: a toplist that answers 1, "1" and true on different days is normal.
        return String(got) === String(want.equals);
    }
    return false;
}

function refFrom(body: string, site: VoteSite): string {
    if (!site.check?.refJson) {
        return '';
    }
    const got = dig(body, site.check.refJson);
    return got === undefined || got === null ? '' : String(got);
}
