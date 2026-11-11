import Environment from '#/util/Environment.js';
import { trackerReady, trackerRepo } from '#/server/tickets/BugTracker.js';

// IS THE BUG TRACKER ACTUALLY WIRED UP (custom, 2026-11-10). Run this on the box, in the engine
// directory, after putting BUGS_GITHUB_REPO and BUGS_GITHUB_TOKEN in .env:
//
//     npm run tickets:doctor
//
// WHY A SEPARATE CHECK FROM tickets:check. That one runs against a stubbed fetch, so it proves the
// code is right and says nothing at all about whether the token works. Everything this one looks at
// is a way for the hand-over to fail quietly MONTHS from now, at the moment a member of staff
// presses the button on a real report and gets an error instead:
//
//   - a token with the wrong repository, or no Issues permission (404 and 403 look alike from here)
//   - ISSUES TURNED OFF on the tracker, which is a per-repository switch and is off on some new
//     repositories. The button would fail with a 404 that reads exactly like a bad token.
//   - a PUBLIC tracker, which is the one that matters. The whole point of a separate tracker is
//     that bug reports stay unreadable by players (see BugTracker.ts). A public one undoes that
//     silently: everything works, and every exploit anybody reports is world-readable.
//
// It files one issue and closes it, because a write is the only thing that proves a write. Pass
// --read-only to skip that and check everything else.

const readOnly = process.argv.includes('--read-only');
let bad = 0;

function pass(what: string) {
    console.log(`  ok    ${what}`);
}
function fail(what: string, why: string) {
    console.log(`  FAIL  ${what}\n        ${why}`);
    bad++;
}

if (!trackerReady()) {
    console.log();
    console.log('  Not configured. The engine needs both of these in .env, in the directory you run the');
    console.log('  ticket bot from:');
    console.log();
    console.log('    BUGS_GITHUB_REPO=owner/name');
    console.log('    BUGS_GITHUB_TOKEN=<a fine-grained token, Issues read and write on that repo only>');
    console.log();
    console.log(`  Read back just now: BUGS_GITHUB_REPO=${Environment.BUGS_GITHUB_REPO || '(empty)'}, BUGS_GITHUB_TOKEN=${Environment.BUGS_GITHUB_TOKEN ? '(set)' : '(empty)'}`);
    process.exit(1);
}

const repo = trackerRepo();
// The token goes in a header and nowhere else - never a command line, never this output.
const headers = {
    Authorization: `Bearer ${Environment.BUGS_GITHUB_TOKEN}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'Content-Type': 'application/json'
};

async function api(path: string, init?: RequestInit) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10_000);
    try {
        const res = await fetch(`https://api.github.com/repos/${repo}${path}`, { ...init, headers, signal: controller.signal });
        return { status: res.status, ok: res.ok, body: (await res.json().catch(() => null)) as Record<string, unknown> | null };
    } finally {
        clearTimeout(timer);
    }
}

console.log();
console.log(`  tracker: ${repo}`);
console.log();

const repoRes = await api('');
if (!repoRes.ok) {
    const why =
        repoRes.status === 404
            ? 'Either the name is wrong or the token cannot see this repository. A fine-grained token must list it under "Only select repositories" - a token for a DIFFERENT repository gives this same 404.'
            : repoRes.status === 401
                ? 'The token was rejected. Check it was pasted whole, with no trailing newline or quotes.'
                : String(repoRes.body?.message ?? '');
    fail('the token can see the tracker', `GitHub answered ${repoRes.status}. ${why}`);
    console.log();
    console.log(`${bad} problem${bad === 1 ? '' : 's'} - the Hand to Claude button would fail with this.`);
    process.exit(1);
}
pass('the token can see the tracker');

if (repoRes.body?.private === true) {
    pass('and it is private, so a reported exploit stays unreadable by players');
} else {
    // Not a warning. This is the decision the whole design rests on.
    fail('and it is private', 'THIS REPOSITORY IS PUBLIC. Every bug report filed here would be world-readable, which is exactly what the private threads in the ticket bot exist to prevent. Make it private in its settings before turning the button on.');
}

if (repoRes.body?.has_issues === true) {
    pass('issues are turned on');
} else {
    fail('issues are turned on', 'Issues are DISABLED on this repository, so nothing can be filed. Settings -> General -> Features -> Issues.');
}

if (readOnly) {
    console.log('  --    skipped the write check (--read-only), so the Issues permission is unproven');
} else {
    const made = await api('/issues', {
        method: 'POST',
        body: JSON.stringify({
            title: '[tracker check] the ticket bot can file issues here',
            body: 'Filed by `npm run tickets:doctor` to prove the token has Issues: write, and closed again immediately. Nothing is wrong; this issue can be deleted.'
        })
    });
    if (made.ok && typeof made.body?.number === 'number') {
        pass(`the token can file an issue (#${made.body.number}, closed again below)`);
        const shut = await api(`/issues/${made.body.number}`, { method: 'PATCH', body: JSON.stringify({ state: 'closed' }) });
        if (shut.ok) {
            pass('and close one');
        } else {
            fail('and close one', `GitHub answered ${shut.status} - issue #${made.body.number} is still open and can be closed by hand.`);
        }
    } else {
        fail(
            'the token can file an issue',
            made.status === 403 || made.status === 404
                ? `GitHub answered ${made.status}. The token can read the repository but not write issues to it: set Repository permissions -> Issues to "Read and write", not "Read-only".`
                : `GitHub answered ${made.status}: ${String(made.body?.message ?? '')}`
        );
    }
}

console.log();
if (bad) {
    console.log(`${bad} problem${bad === 1 ? '' : 's'} - the Hand to Claude button would fail with this.`);
} else {
    console.log('All good. Restart the ticket bot (npm run tickets) and the button appears on new bug reports.');
}
process.exit(bad ? 1 : 0);
