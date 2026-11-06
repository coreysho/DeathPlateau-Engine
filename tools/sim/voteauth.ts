/**
 * The shared secret in the URL path: TopG's shape, and that the old shape still works.
 *
 *   npx tsx tools/sim/votepathsecret.ts
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
