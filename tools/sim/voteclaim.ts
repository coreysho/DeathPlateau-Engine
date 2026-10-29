// CLAIMING A VOTE, END TO END, WITH NO VOTING SITE IN THE WORLD.
//
//   npx tsx tools/sim/voteclaim.ts
//
// The vote shop was built in October and the claiming half was left out, because claiming needs a
// site to claim from and no site had been chosen. Everything in FRONT of the site is the same
// whichever one it turns out to be, so this is that everything, and this file is how it is tested
// without one: the sites are configured in memory, and the toplist that answers "yes, they voted"
// is a real HTTP server started on localhost for the duration of the run. The engine makes a real
// fetch to it and parses a real response.
//
// WHAT IS BEING HELD TO ACCOUNT:
//
//   - a vote credited to somebody ONLINE reaches their inventory without them asking
//   - a vote credited to somebody OFFLINE is waiting at their next login
//   - a vote credited to somebody whose pack is FULL is not lost; the clerk holds it
//   - the same vote credited TWICE pays once, whether the site retries or the player clicks again
//   - a callback with the WRONG SECRET, or for an unknown site, does nothing and says nothing
//   - a site's COOLDOWN is enforced against the ledger, not against anything in the save
//   - with NO SITES CONFIGURED - the default, and the state this server is in today - nothing
//     pretends to work: the clerk says so and the claim path returns ^vote_claim_nosites
//   - a LEDGER THAT WILL NOT OPEN is not allowed to take [login,_] down with it
import fs from 'fs';
import http from 'http';
import { AddressInfo } from 'net';
import os from 'os';
import path from 'path';

import * as H from './harness.js';
import * as A from './a1lib.js';
import { check, R, player } from './a1lib.js';
import VoteBook, { CreditResult } from '#/engine/vote/VoteBook.js';
import VoteService, { ClaimOutcome, ClaimStatus } from '#/engine/vote/VoteService.js';
import VoteSites, { VoteSite } from '#/engine/vote/VoteSites.js';
import ScriptProvider from '#/engine/script/ScriptProvider.js';
import World from '#/engine/World.js';
import Environment from '#/util/Environment.js';

await H.boot();
H.loginOrder();

// A toplist. /callback-style sites never get asked anything; this one is the other kind - we ask it
// whether a player has voted and it answers in JSON, which is what most of them do.
let voted = new Set<string>();
let asked: string[] = [];
const stub = http.createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://localhost');
    asked.push(url.pathname + '?' + url.searchParams.toString());
    if (url.searchParams.get('key') !== 'topsecret') {
        res.writeHead(403).end('{"status":"bad key"}');
        return;
    }
    const user = (url.searchParams.get('user') ?? '').toLowerCase();
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify(voted.has(user) ? { status: 1, voteid: 'vote-' + user + '-1' } : { status: 0 }));
});
await new Promise<void>(resolve => stub.listen(0, '127.0.0.1', resolve));
const port = (stub.address() as AddressInfo).port;

const CALLBACK_SITE: VoteSite = {
    id: 'pushy',
    name: 'Pushy Toplist',
    url: 'https://example.invalid/vote/pushy',
    tickets: 1,
    cooldownHours: 12,
    callback: { secret: 'hunter2', secretParam: 'key', userParam: 'player', refParam: 'voteid' }
};
const CHECK_SITE: VoteSite = {
    id: 'asky',
    name: 'Asky Toplist',
    url: 'https://example.invalid/vote/asky',
    tickets: 2,
    cooldownHours: 12,
    check: {
        url: `http://127.0.0.1:${port}/api?user={user}&key={key}`,
        key: 'topsecret',
        success: { json: 'status', equals: 1 },
        refJson: 'voteid'
    }
};

/** A fresh ledger and a fresh site list for each block, so no test leans on another. */
function reset(sites: VoteSite[]) {
    VoteSites.override(sites);
    VoteService.useLedger(new VoteBook(':memory:'));
    voted = new Set();
    asked = [];
}

/** Tick until the in-flight claim has landed and the queued delivery has run. */
function settle(ticks = 20) {
    for (let t = 0; t < ticks; t++) H.tick(1);
}

console.log('WITH NO SITES CONFIGURED, NOTHING PRETENDS TO WORK');
{
    reset([]);
    check('  the engine knows of no sites', VoteSites.count(), 0);
    check('    so there is nothing to ask', VoteService.checkable().length, 0);
    check('    and a claim says so rather than starting one', VoteService.claim('nobody'), ClaimStatus.NO_SITES);

    // And the clerk says it out loud, which is the part a player sees.
    const p: any = player('voteoff', 3094, 3491, 0);
    H.clearInv(p);
    H.tick(2);
    const lines = A.talk(p, 'vote_clerk', [2]);
    check('  the clerk admits there is nowhere to vote yet', A.saw(lines, 'nowhere to vote yet') || A.saw(lines, 'listed somewhere'), true);
    H.despawn(p);
}

console.log('\nA SITE CALLING OUR CALLBACK PAYS A PLAYER WHO IS STANDING THERE');
{
    reset([CALLBACK_SITE]);
    const p: any = player('voteon', 3094, 3491, 0);
    H.clearInv(p);
    H.tick(2);
    check('  no tickets to start with', H.invCount(p, 'vote_ticket'), 0);

    const res = VoteService.fromCallback('pushy', { key: 'hunter2', player: 'voteon', voteid: 'abc123' });
    check('  the site is told ok', [res.status, res.body], [200, 'ok']);
    settle();
    check('  and the ticket is in the pack, unasked for', H.invCount(p, 'vote_ticket'), 1);
    check('  with nothing left owed', VoteService.owed('voteon'), 0);

    // Sites retry. A retry is the same vote.
    const again = VoteService.fromCallback('pushy', { key: 'hunter2', player: 'voteon', voteid: 'abc123' });
    settle();
    check('  a retry is recognised', [again.status, again.body], [200, 'duplicate']);
    check('  and pays nothing more', H.invCount(p, 'vote_ticket'), 1);
    H.despawn(p);
}

console.log('\nAND IT DOES NOT MATTER HOW THE SITE SENDS IT');
{
    // What the route hands over: the query string and the body, merged. Toplists use one, the
    // other, or both, and a POST is as often a form as it is JSON.
    reset([CALLBACK_SITE]);
    const viaQuery = VoteService.fromHttp('pushy', { key: 'hunter2', player: 'qstring', voteid: 'q1' }, undefined);
    check('  all in the query string', viaQuery.body, 'ok');

    const viaBody = VoteService.fromHttp('pushy', {}, { key: 'hunter2', player: 'bodyman', voteid: 'b1' });
    check('  all in the body', viaBody.body, 'ok');

    const split = VoteService.fromHttp('pushy', { key: 'hunter2' }, { player: 'splitman', voteid: 's1' });
    check('  half in each', split.body, 'ok');
    check('    and all three were credited', [VoteService.owed('qstring'), VoteService.owed('bodyman'), VoteService.owed('splitman')], [1, 1, 1]);

    // Numbers and booleans arrive as whatever the parser made of them; a nested object is not a
    // parameter any toplist sends and is ignored rather than stringified into nonsense.
    const odd = VoteService.fromHttp('pushy', { key: 'hunter2', player: 'oddity', voteid: 12345, extra: { a: 1 } }, undefined);
    check('  a numeric vote id is still a vote id', odd.body, 'ok');
    check('    filed under its own ref', VoteService.ledger().history('oddity')[0]?.ref, '12345');
}

console.log('\nA CALLBACK THAT CANNOT PROVE WHO IT IS DOES NOTHING');
{
    reset([CALLBACK_SITE]);
    const wrong = VoteService.fromCallback('pushy', { key: 'hunter3', player: 'voteon', voteid: 'x' });
    check('  a wrong secret is refused', [wrong.status, wrong.body], [404, 'unknown']);
    check('  and nothing was credited', VoteService.owed('voteon'), 0);
    const nosite = VoteService.fromCallback('nosuchsite', { key: 'hunter2', player: 'voteon' });
    check('  an unknown site answers identically, so neither can be probed for', [nosite.status, nosite.body], [404, 'unknown']);
    const noplayer = VoteService.fromCallback('pushy', { key: 'hunter2', player: '' });
    check('  and a callback with no player is refused', noplayer.status, 400);
}

console.log('\nA VOTE CREDITED WHILE YOU ARE OFFLINE IS WAITING AT YOUR NEXT LOGIN');
{
    reset([CALLBACK_SITE]);
    // Nobody of this name is online. The credit has nowhere to go but the ledger.
    const res = VoteService.fromCallback('pushy', { key: 'hunter2', player: 'latecomer', voteid: 'v9' });
    check('  the site is still told ok', res.body, 'ok');
    check('  and the ledger owes it', VoteService.owed('latecomer'), 1);

    // makePlayer rather than the player() helper: that one clears the inventory AFTER the login
    // ticks, which would wipe the very ticket this is about.
    const p: any = H.makePlayer('latecomer', 3094, 3491);
    settle();
    check('  logging in hands it over', H.invCount(p, 'vote_ticket'), 1);
    check('  and the ledger is square', VoteService.owed('latecomer'), 0);
    H.despawn(p);
}

console.log('\nAND A FULL PACK LOSES NOTHING');
{
    reset([CALLBACK_SITE]);
    const p: any = player('votefull', 3094, 3491, 0);
    H.clearInv(p);
    H.fillInv(p);
    H.tick(2);
    check('  the pack is full', H.invCount(p, 'vote_ticket'), 0);

    VoteService.fromCallback('pushy', { key: 'hunter2', player: 'votefull', voteid: 'v1' });
    settle();
    check('  the ledger has handed it over', VoteService.owed('votefull'), 0);
    check('    but there was no room for it', H.invCount(p, 'vote_ticket'), 0);
    check('    so the clerk is holding it', H.getVar(p, 'vote_tickets_pending'), 1);

    // And the clerk hands it over, through her real Talk-to rather than the proc behind it.
    H.clearInv(p);
    H.tick(1);
    A.talk(p, 'vote_clerk', [4]);
    check('  the clerk hands it over when there is room', H.invCount(p, 'vote_ticket'), 1);
    check('    holding nothing after that', H.getVar(p, 'vote_tickets_pending'), 0);
    H.despawn(p);
}

console.log('\nASKING A TOPLIST IS A REAL REQUEST TO A REAL SERVER');
{
    reset([CHECK_SITE]);
    const p: any = player('voteask', 3094, 3491, 0);
    H.clearInv(p);
    H.tick(2);

    // Nobody has voted yet.
    const first = await claimAndWait('voteask');
    check('  the site was asked', asked.length, 1);
    check(
        '  it said no, so nothing was credited',
        first.some(o => o.credited),
        false
    );
    check('    and nothing arrived', H.invCount(p, 'vote_ticket'), 0);

    voted.add('voteask');
    const second = await claimAndWait('voteask');
    check('  once it says yes, the vote is credited', second.filter(o => o.credited).length, 1);
    settle();
    check('    and the site decides how many tickets that is', H.invCount(p, 'vote_ticket'), 2);

    // The site still says yes - it will keep saying yes for the rest of the day. The ledger is what
    // stops that being paid again, using the vote id the site gave and then its cooldown.
    const third = await claimAndWait('voteask');
    check(
        '  claiming again inside the cooldown pays nothing',
        third.some(o => o.credited),
        false
    );
    check('    and the pack is unchanged', H.invCount(p, 'vote_ticket'), 2);
    H.despawn(p);
}

console.log('\nAND THE CLERK IS HOW A PLAYER ASKS FOR ANY OF IT');
{
    reset([CHECK_SITE]);
    const p: any = player('voteclerk', 3094, 3491, 0);
    H.clearInv(p);
    H.tick(2);

    // "Where can I vote?" - the list, with the site's own name and address in it. The 1 answers
    // the reminder question that follows it ("Thanks.").
    const where = A.talk(p, 'vote_clerk', [3, 1]);
    check('  she names the site', A.saw(where, 'Asky Toplist'), true);
    check('    and where to go', A.saw(where, 'example.invalid'), true);

    // "I've voted - can you check?" - she starts a claim and says so. The result is a game message
    // a moment later, because a script cannot wait for a web request.
    voted.add('voteclerk');
    asked = [];
    const m = A.mark();
    const asking = A.talk(p, 'vote_clerk', [2]);
    check('  asked to check, she goes and looks', A.saw(asking, 'check the ledger'), true);
    for (let t = 0; t < 40 && !asked.length; t++) {
        await new Promise(r => setTimeout(r, 25));
    }
    settle();
    check('    the site really was asked', asked.length, 1);
    check(
        '    the thanks names the site',
        A.mesSince(p, m).some(l => l.includes('Asky Toplist')),
        true
    );
    check('    and the tickets arrive', H.invCount(p, 'vote_ticket'), 2);
    H.despawn(p);
}

console.log('\nA TOPLIST THAT WILL NOT ANSWER IS NOT A VOTE, AND NOT A CRASH');
{
    const dead: VoteSite = { ...CHECK_SITE, id: 'dead', check: { ...CHECK_SITE.check!, url: 'http://127.0.0.1:1/api?user={user}&key={key}' } };
    reset([dead]);
    const p: any = player('votedead', 3094, 3491, 0);
    H.tick(2);
    const outcomes = await claimAndWait('votedead');
    check('  the claim comes back', outcomes.length, 1);
    check('    saying the site could not be reached', outcomes[0].reason, 'unreachable');
    check('    and nothing was credited', VoteService.owed('votedead'), 0);
    H.despawn(p);
}

console.log('\nTHE LEDGER IS THE ONLY THING THAT DECIDES, AND IT IS NOT IN THE SAVE');
{
    reset([CALLBACK_SITE, CHECK_SITE]);
    // Two sites, one player, same day: each is its own cooldown and its own count of tickets.
    VoteService.fromCallback('pushy', { key: 'hunter2', player: 'votetwo', voteid: 'p1' });
    voted.add('votetwo');
    await claimAndWait('votetwo');
    check('  one vote on each site', VoteService.ledger().history('votetwo').length, 2);
    check('    is three tickets, because the sites are worth different amounts', VoteService.owed('votetwo'), 3);

    check('  the cooldown is read off the ledger', VoteService.ledger().lastVote('pushy', 'votetwo') > 0, true);
    const tooSoon = VoteService.ledger().credit('pushy', 'p2', 'votetwo', 1, Date.now(), 12 * 3600000);
    check('    and refuses a second vote inside it', tooSoon, CreditResult.TOO_SOON);
    check('  a player who has never voted is owed nothing', VoteService.owed('nobody'), 0);
}

console.log('\nAND A SITE THAT GIVES A VOTE NO ID IS STILL HELD TO ONE PER COOLDOWN');
{
    // Some toplists send nothing that identifies the vote. The ledger then files it under the
    // cooldown window it fell in, so a player clicking Claim twenty times in an evening is still
    // one credit - which is the most that can be promised without an id from the site.
    reset([]);
    const book = VoteService.ledger();
    const noon = Date.UTC(2026, 9, 27, 12, 0, 0);
    const twelveHours = 12 * 3600000;
    const first = VoteBook.refForWindow('windowy', noon, twelveHours);
    check('  the same window is the same ref', VoteBook.refForWindow('WINDOWY', noon + 1000, twelveHours), first);
    check('    and the next window is not', VoteBook.refForWindow('windowy', noon + twelveHours, twelveHours) === first, false);

    check('  the first claim credits', book.credit('idless', first, 'windowy', 1, noon, 0), CreditResult.CREDITED);
    check('    the second does not', book.credit('idless', first, 'windowy', 1, noon + 1000, 0), CreditResult.DUPLICATE);
    check('    and only one ticket is owed', book.owed('windowy'), 1);
}

console.log('\nAND THE ONLY PLAYER TOLD ANYTHING IS ONE WHO COULD VOTE AND HAS NOT');
{
    // The reminder, which is deliberately not a broadcast: nothing is said to somebody who has
    // voted, and nothing is said at all on a server with nowhere to vote.
    const timerScript = ScriptProvider.getByName('[softtimer,vote_reminder]');
    check('  the timer exists', !!timerScript, true);
    const armed = (q: any) => q.timers.get(timerScript!.id)?.interval ?? -1;

    // Firing it by hand rather than ticking to it: the first interval is five minutes of game
    // ticks, which is a minute of wall clock in here for nothing. What is being tested is what the
    // handler decides, and that login arms it at all.
    const fire = (q: any) => {
        const m = A.mark();
        A.runProcProtected(q, '[softtimer,vote_reminder]');
        H.tick(1);
        return A.mesSince(q, m).some(l => l.includes('You can vote again'));
    };

    reset([]);
    {
        const p: any = player('remindnone', 3094, 3491, 0);
        H.tick(2);
        check('  with nowhere to vote, no timer is armed', armed(p), -1);
        check('    and firing it says nothing', fire(p), false);
        H.despawn(p);
    }

    reset([CHECK_SITE]);
    {
        const p: any = player('remindme', 3094, 3491, 0);
        H.tick(2);
        check('  with a site, login arms it for the short interval', armed(p), 500);
        check('    and somebody who has never voted is reminded', fire(p), true);
        check('    after which it settles into the long one', armed(p), 3000);

        // AND IT REALLY FIRES ON ITS OWN, through World's own processTimers rather than by hand.
        // The clock is wound back instead of ticking five minutes of game time for one message.
        const t = (p.timers as Map<number, { clock: number; interval: number }>).get(timerScript!.id)!;
        t.clock = World.currentTick - (t.interval + 1);
        const m = A.mark();
        H.tick(2);
        check(
            '    and the world fires it when it comes due',
            A.mesSince(p, m).some(l => l.includes('You can vote again')),
            true
        );

        // Voted just now: the ledger says so, and the reminder has nothing to say.
        VoteService.ledger().credit('asky', 'r1', 'remindme', 2, Date.now(), 0);
        check('  somebody who has just voted is told nothing', fire(p), false);

        // The same vote, thirteen hours ago, against a twelve-hour cooldown.
        VoteService.useLedger(new VoteBook(':memory:'));
        VoteService.ledger().credit('asky', 'r2', 'remindme', 2, Date.now() - 13 * 3600000, 0);
        check('    and is reminded again once the cooldown has run out', fire(p), true);
        H.despawn(p);
    }

    {
        // Off, through the clerk, which is where somebody annoyed by it would go.
        const p: any = player('remindoff', 3094, 3491, 0);
        H.tick(2);
        check('  reminders start on', H.getVar(p, 'vote_reminders_off'), 0);
        A.talk(p, 'vote_clerk', [3, 2]);
        check('    the clerk can turn them off', H.getVar(p, 'vote_reminders_off'), 1);
        check('    the timer is dropped there and then', armed(p), -1);
        check('    and firing it anyway says nothing', fire(p), false);

        A.talk(p, 'vote_clerk', [3, 1]);
        check('    and she can turn them back on', H.getVar(p, 'vote_reminders_off'), 0);
        check('    re-arming the timer', armed(p), 500);
        H.despawn(p);
    }
}

console.log('\nAND A LEDGER THAT WILL NOT OPEN DOES NOT TAKE THE LOGIN SCRIPT DOWN WITH IT');
{
    // FROM A REAL LOGIN, 28 October: "script error: vote_owed unable to open database file", with
    // a backtrace through [proc,vote_deliver] -> [proc,vote_login] -> [login,_]. A script error
    // ABANDONS THE SCRIPT, so everything in login.rs2 after ~vote_login stopped happening - for a
    // feature this server has no voting site for. Reading a balance must never be able to do that.
    //
    // THE LEDGER IS BROKEN THE ONLY WAY THAT WORKS AS ROOT: a directory where the database file
    // should be. Permissions cannot be used - root is not refused by them, so a chmod 000 ledger
    // opens fine in here and would make this test pass for the wrong reason.
    const broken = path.join(os.tmpdir(), `voteclaim-broken-${process.pid}.sqlite`);
    fs.mkdirSync(broken, { recursive: true });
    const previous = Environment.VOTE_LEDGER;
    Environment.VOTE_LEDGER = broken;
    VoteSites.override([CALLBACK_SITE]);
    VoteService.useLedger(null);

    check('  the ledger refuses to open', VoteService.ledgerOrNull(), null);

    // And ledger() - the one that throws - still does. That is the split: the paths that would have
    // to invent an answer keep the exception, and only the ones that can honestly say "nothing"
    // swallow it. This call is also exactly what [proc,vote_deliver] used to reach.
    let threw = false;
    try {
        VoteService.ledger();
    } catch {
        threw = true;
    }
    check('    while ledger() still throws, which is what the login hit', threw, true);

    let opened = '';
    try {
        new VoteBook(broken);
    } catch (err) {
        opened = err instanceof Error ? err.message : String(err);
    }
    check('    and says which file it was', opened.includes(path.resolve(broken)), true);
    check("    rather than only sqlite's own sentence", opened === 'unable to open database file', false);

    // The two calls [proc,vote_deliver] makes, which is what the login ran into.
    check('  vote_owed answers nothing rather than throwing', VoteService.owed('brokenly'), 0);
    check('    and vote_take takes nothing', VoteService.take('brokenly', 5), 0);

    // THE WHOLE LOGIN SCRIPT RUNS. animmag_attract is armed by the line directly after
    // ~vote_login in login.rs2, so a player who has it is a player the script got past the vote.
    const attract = ScriptProvider.getByName('[softtimer,animmag_attract]');
    check('  the timer login sets after ~vote_login exists', !!attract, true);
    const m = A.mark();
    const p: any = H.makePlayer('brokenly', 3094, 3491, 0);
    H.tick(2);
    check('    and login gets past ~vote_login to set it', p.timers.has(attract!.id), true);
    check(
        '    with no script error in the chatbox',
        A.mesSince(p, m).some(l => l.includes('script error')),
        false
    );

    // The clerk, who would otherwise say "no new votes found" - which reads as "you did not vote".
    check('  a claim says the ledger is unavailable', VoteService.claim('brokenly'), ClaimStatus.UNAVAILABLE);
    const lines = A.talk(p, 'vote_clerk', [2]);
    check('    and the clerk says so without blaming the player', A.saw(lines, "can't get at the ledger"), true);
    H.despawn(p);

    // A SITE'S CALLBACK IS A REAL VOTE WITH NOWHERE TO GO. 503, not 200: every toplist that
    // retries a callback retries on a non-200, so saying so is what saves the vote.
    const reply = VoteService.fromCallback(CALLBACK_SITE.id, { key: 'hunter2', player: 'brokenly' });
    check('  a callback refuses out loud', reply.status, 503);

    // IT IS TRIED ONCE. The directory is gone now, so the ledger WOULD open - and it must not go
    // and look, or every login on a broken server writes the same stack trace to the log again.
    fs.rmSync(broken, { recursive: true, force: true });
    check('  and it does not try again once it has refused', VoteService.ledgerOrNull(), null);

    Environment.VOTE_LEDGER = previous;
    VoteService.useLedger(new VoteBook(':memory:'));
    check('    until something hands it a working one', VoteService.ledgerOrNull() === null, false);
}

async function claimAndWait(username: string): Promise<ClaimOutcome[]> {
    let done: (o: ClaimOutcome[]) => void = () => {};
    const landed = new Promise<ClaimOutcome[]>(r => (done = r));
    const status = VoteService.claim(username, outcomes => done(outcomes));
    if (status !== ClaimStatus.STARTED) {
        return [];
    }
    const outcomes = await landed;
    settle();
    return outcomes;
}

stub.close();
console.log(`\n${R.ok} ok, ${R.bad} FAIL`);
process.exit(R.bad ? 1 : 0);
