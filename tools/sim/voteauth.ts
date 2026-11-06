/**
 * How a vote callback proves it is the site: all three shapes, and that none of them lets the
 * others through.
 *
 *   npx tsx tools/sim/voteauth.ts
 *
 *   a parameter   most toplists echo a shared secret back at us
 *   the path      TopG sends no secret at all, and appends its own query to our url
 *   a signature   RuneRank signs its fields with HMAC-SHA256 and never transmits the key
 *
 * WHY THE PATH AT ALL. TopG's callback is `?p_resp=NAME&ip=IP` and carries no secret - they
 * authenticate by source address, which is no use behind a tunnel. Nor can the secret go in the
 * query: TopG builds `YOURURL?p_resp=...`, so a url already carrying `?key=...` ends up with two
 * question marks and p_resp never parses. A trailing path segment is the one place a site that
 * appends its own query cannot disturb.
 *
 * No world, no ledger of consequence, no network: VoteService.fromCallback is called directly with
 * a temporary sites.json and a temporary ledger, because what is being tested is which secret is
 * believed and which is not.
 */
import { createHmac } from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';

import VoteService from '#/engine/vote/VoteService.js';
import VoteSites from '#/engine/vote/VoteSites.js';
import Environment from '#/util/Environment.js';

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'votepath-'));
const sitesFile = path.join(dir, 'sites.json');

// `topgish` has no secretParam, so the parameter it would look for defaults to "secret" - which
// TopG never sends. The path is the only way it can ever authenticate.
fs.writeFileSync(
    sitesFile,
    JSON.stringify([
        {
            id: 'withparam',
            name: 'Param Site',
            url: 'https://example.com/vote',
            playerUrl: 'https://example.com/vote?u={user}',
            tickets: 1,
            cooldownHours: 12,
            callback: { secret: 'env:VOTE_TEST_KEY', secretParam: 'key', userParam: 'u' }
        },
        {
            id: 'topgish',
            name: 'TopG-shaped',
            url: 'https://topg.org/x/in-1-x',
            playerUrl: 'https://topg.org/x/in-1-{user}',
            tickets: 1,
            cooldownHours: 12,
            callback: { secret: 'env:VOTE_TEST_KEY', userParam: 'p_resp' }
        },
        {
            // RuneRank's shape: it signs rather than echoing, dedupes on its own vote_id, and
            // sends test=true from the dashboard's "Send test vote" button.
            id: 'runerankish',
            name: 'RuneRank-shaped',
            url: 'https://runerank.com/vote/x',
            playerUrl: 'https://runerank.com/vote/x?username={user}',
            tickets: 1,
            cooldownHours: 12,
            callback: {
                secret: 'env:VOTE_TEST_KEY',
                userParam: 'username',
                refParam: 'vote_id',
                require: { test: 'false' },
                hmac: { param: 'signature', fields: ['vote_id', 'server_id', 'username', 'timestamp'] }
            }
        }
    ])
);

// THE IMPORTS ARE STATIC, so Environment was built from the real environment before any of this
// ran. Both of the things that would otherwise have to be set beforehand can be set here instead:
// the ledger path is read at the moment it opens, and load() takes the file outright. The secret
// is resolved by load(), so the variable it names only has to exist by then.
process.env.VOTE_TEST_KEY = 'correct-horse';
Environment.VOTE_LEDGER = path.join(dir, 'ledger.sqlite');
VoteSites.load(sitesFile);

let ok = 0;
let failed = 0;

function check(what: string, got: string, want: string) {
    if (got === want) {
        ok++;
        console.log(`  ok    ${what}`);
    } else {
        failed++;
        console.log(`  FAIL  ${what}: got "${got}", wanted "${want}"`);
    }
}

// A fresh name each time: the ledger dedupes by (site, ref), and without a refParam the ref is
// derived from the name and the window, so reusing one would read as a duplicate rather than as
// the thing being tested.
let n = 0;
const who = () => `probe${n++}`;

console.log('the path carries it');
check('right secret in the path credits', VoteService.fromCallback('topgish', { p_resp: who() }, 'correct-horse').body, 'ok');
check('wrong secret in the path is refused', VoteService.fromCallback('topgish', { p_resp: who() }, 'nope').body, 'unknown');
check('no secret at all is refused', VoteService.fromCallback('topgish', { p_resp: who() }).body, 'unknown');

console.log('the old shape is untouched');
check('right secret in the parameter credits', VoteService.fromCallback('withparam', { key: 'correct-horse', u: who() }).body, 'ok');
check('wrong secret in the parameter is refused', VoteService.fromCallback('withparam', { key: 'nope', u: who() }).body, 'unknown');

console.log('the path wins when both are present');
// A site that sends its own secret cannot be talked past by a caller who found the path form, and
// a wrong path secret does not quietly fall back to a parameter that happens to be right.
check('wrong path beats a right parameter', VoteService.fromCallback('withparam', { key: 'correct-horse', u: who() }, 'nope').body, 'unknown');
check('right path beats a wrong parameter', VoteService.fromCallback('withparam', { key: 'nope', u: who() }, 'correct-horse').body, 'ok');

console.log('a signed callback');
// Built the way RuneRank documents it: the hex HMAC of the four fields joined by colons. The
// values are strings here because that is what fastify's body becomes by the time it arrives -
// String(1757404800) and String(false), not the number and the boolean.
const sign = (v: Record<string, string>) => createHmac('sha256', 'correct-horse').update([v.vote_id, v.server_id, v.username, v.timestamp].join(':')).digest('hex');

const vote = (over: Partial<Record<string, string>> = {}) => {
    const v: Record<string, string> = {
        vote_id: `evt-${n++}`,
        server_id: 'srv-1',
        username: who(),
        timestamp: '1757404800',
        test: 'false',
        ...over
    };
    return { ...v, signature: sign(v) };
};

check('a correct signature credits', VoteService.fromCallback('runerankish', vote()).body, 'ok');

// THE POINT OF SIGNING. Take a genuine callback and change who it was for: the signature still
// belongs to the old name, so it no longer matches. A shared secret could not catch this.
const genuine = vote();
check('a tampered username is refused', VoteService.fromCallback('runerankish', { ...genuine, username: 'someoneelse' }).body, 'unknown');

const wrongKey = vote();
wrongKey.signature = createHmac('sha256', 'wrong-key').update([wrongKey.vote_id, wrongKey.server_id, wrongKey.username, wrongKey.timestamp].join(':')).digest('hex');
check('a signature made with another key is refused', VoteService.fromCallback('runerankish', wrongKey).body, 'unknown');

const short = vote();
delete (short as Partial<Record<string, string>>).timestamp;
check('a missing signed field is refused', VoteService.fromCallback('runerankish', short).body, 'unknown');

// Their dashboard's test button. It must answer 2xx so the delivery is not retried for 24 hours,
// and must never pay anybody.
check('a test vote is ignored, not refused', VoteService.fromCallback('runerankish', vote({ test: 'true' })).body, 'ignored');

// Retries reuse the vote_id, so the second delivery of the same vote must not pay twice.
const once = vote();
check('the first delivery credits', VoteService.fromCallback('runerankish', once).body, 'ok');
check('the same vote_id again is a duplicate', VoteService.fromCallback('runerankish', once).body, 'duplicate');

console.log('an unknown site still says nothing useful');
check('unknown site with a right secret', VoteService.fromCallback('nosuchsite', { u: who() }, 'correct-horse').body, 'unknown');

// The ledger's sqlite handle is held for the life of the process and there is no reason for this
// probe to reach into VoteService and close it, so on Windows the directory is still locked here.
// It is under the OS temp directory either way.
try {
    fs.rmSync(dir, { recursive: true, force: true });
} catch {
    console.log(`  (left ${dir} behind - the ledger is still open)`);
}

console.log(`\n${ok} ok, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
