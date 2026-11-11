import type { DatabaseSync } from 'node:sqlite';

import Environment from '#/util/Environment.js';

// FILING A BUG REPORT AS A GITHUB ISSUE (custom, 2026-11-10). The one step between a player's report
// and somebody working on it.
//
// WHY A PRIVATE REPO, and this is the whole reason this file is careful. The ticket bot puts bug
// reports in PRIVATE threads on purpose - Corey's call, 2026-09-27, so that an exploit is never
// posted where other players can read it (see TicketBot.ts). All four code repositories are PUBLIC,
// so filing the report as an issue on one of them would undo that decision in a way nobody would
// notice until somebody read an issue and found a working exploit in it. So the issue goes to a
// private tracker of its own - BUGS_GITHUB_REPO - and the FIX, when there is one, goes to the public
// repository as an ordinary pull request that says what it changes without reprinting the recipe.
//
// WHY A SEPARATE TOKEN. BUGS_GITHUB_TOKEN is a fine-grained token with Issues: read and write on the
// tracker and NOTHING else - not contents, not the code repositories. It cannot push, cannot read a
// private file, and cannot reach the other repositories at all. The worst a stolen one can do is
// write issues in a tracker. It is never logged, and it only ever appears in a header.
//
// WHAT IS NOT IN HERE. No judgement about the report, no triage, no labels: the button is pressed by
// a member of staff who has read the thread, and that press is the whole gate. This file transcribes.
export type BugIssue = { number: number; url: string };

// ADDED, NOT DECLARED. The ticket bot has been filing tickets since September, so the four columns
// a hand-over needs go on with ALTER rather than into its CREATE TABLE - a CREATE TABLE IF NOT
// EXISTS does nothing at all to a table that already exists, so a column declared up there would
// never appear on a box that has been running. Idempotent, and it touches no existing row.
//
// It lives here rather than in TicketBot.ts so that it can be run against a database on its own:
// a migration nobody can test is a migration you find out about on the live box.
const HANDOVER_COLUMNS = [
    ['report', 'TEXT'],
    ['issue_number', 'INTEGER'],
    ['issue_url', 'TEXT'],
    ['handed_by', 'TEXT']
] as const;

export function addHandoverColumns(db: DatabaseSync): void {
    for (const [column, type] of HANDOVER_COLUMNS) {
        const present = db.prepare("SELECT 1 FROM pragma_table_info('ticket') WHERE name = ?").get(column);
        if (!present) {
            db.exec(`ALTER TABLE ticket ADD COLUMN ${column} ${type}`);
        }
    }
}

// WHICH TICKETS THE BACKFILL TOUCHES, as two queries rather than two strings typed into the bot,
// so that a fixture database can prove they pick the right rows. Getting either wrong is quiet: too
// narrow and part of the backlog is skipped for good, too wide and a support ticket or a report that
// already has its detail gets overwritten with something else.
export type BacklogRow = { id: number; thread_id: string };

// Bug reports with no stored detail that still have a thread to read it back from. A support ticket
// is never included: there is nothing to hand over. Nor is a bug whose report is already stored -
// re-reading it could only replace good detail with whatever the thread looks like now.
export function reportsToRecover(db: DatabaseSync, limit: number): BacklogRow[] {
    return db.prepare("SELECT id, thread_id FROM ticket WHERE kind = 'bug' AND report IS NULL AND thread_id IS NOT NULL ORDER BY id LIMIT ?").all(limit) as BacklogRow[];
}

// Every bug ticket, for rebuilding staff log messages. Wider than the above on purpose: a CLOSED bug
// report can still be handed over, and its message is as stale as an open one's.
export function bugTicketIds(db: DatabaseSync, limit: number): number[] {
    return (db.prepare("SELECT id FROM ticket WHERE kind = 'bug' ORDER BY id LIMIT ?").all(limit) as { id: number }[]).map(r => r.id);
}

// RELAYING A QUESTION BACK TO THE PLAYER (custom, 2026-11-11). The worker that picks a tracker
// issue up cannot reach Discord, and the player who reported the bug cannot see the tracker. So the
// four reports handed over on 2026-11-11 all stalled in the same place: each got a careful
// needs-repro comment asking two to four specific questions, and nobody ever asked the reporter.
//
// WHY A MARKED BLOCK AND NOT THE WHOLE COMMENT. Those comments are written for Corey, not for the
// player - they name BuildArea.rebuildNormal, the sim harness and the size of maps-client.zip. A
// player needs the questions and nothing else. So only text the author deliberately wraps in these
// markers is relayed, and everything else in the issue stays between the tracker and whoever reads
// it. That also means a private note about an exploit can never be posted into a player's thread by
// accident: silence is the default and marking is the opt-in.
//
// The markers are HTML comments, so they are invisible when GitHub renders the issue.
export const ASK_OPEN = '<!-- ask-player -->';
export const ASK_CLOSE = '<!-- /ask-player -->';

// The first marked block in a comment, or null. An opening marker with no closing one returns null
// rather than everything after it: a half-written block is a mistake, and relaying the rest of an
// internal comment is exactly the thing this is built to avoid.
export function extractAskPlayer(body: string): string | null {
    const start = body.indexOf(ASK_OPEN);
    if (start === -1) {
        return null;
    }
    const from = start + ASK_OPEN.length;
    const end = body.indexOf(ASK_CLOSE, from);
    if (end === -1) {
        return null;
    }
    const text = body.slice(from, end).trim();
    return text === '' ? null : text;
}

export type TrackerComment = { id: number; issueNumber: number; body: string; createdAt: string };

// EVERY COMMENT IN THE TRACKER SINCE A TIMESTAMP, IN ONE CALL. The per-issue endpoint would be one
// request per open issue per poll - forty-odd requests a minute against a 5000/hour token - where
// this is one request however many issues there are.
export async function commentsSince(iso: string): Promise<TrackerComment[]> {
    if (!trackerReady()) {
        return [];
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
        const res = await fetch(`${API}/repos/${Environment.BUGS_GITHUB_REPO}/issues/comments?since=${encodeURIComponent(iso)}&per_page=100&sort=created&direction=asc`, {
            headers: {
                Authorization: `Bearer ${Environment.BUGS_GITHUB_TOKEN}`,
                Accept: 'application/vnd.github+json',
                'X-GitHub-Api-Version': '2022-11-28'
            },
            signal: controller.signal
        });
        if (!res.ok) {
            throw new Error(`GitHub answered ${res.status} ${res.statusText}`);
        }
        const rows = (await res.json()) as { id?: number; body?: string; created_at?: string; issue_url?: string }[];
        const out: TrackerComment[] = [];
        for (const row of rows) {
            // The issue number is only in the url - the comment payload has no issue_number field.
            const number = Number(String(row.issue_url ?? '').split('/').pop());
            if (typeof row.id !== 'number' || !Number.isFinite(number) || number <= 0 || typeof row.body !== 'string' || typeof row.created_at !== 'string') {
                continue;
            }
            out.push({ id: row.id, issueNumber: number, body: row.body, createdAt: row.created_at });
        }
        return out;
    } finally {
        clearTimeout(timer);
    }
}

const API = 'https://api.github.com';
const TIMEOUT_MS = 10_000;
const MAX_REPORT = 10_000;

export function trackerRepo(): string {
    return Environment.BUGS_GITHUB_REPO;
}

// Both halves have to be set before the button is worth showing: a token with no repository has
// nowhere to file, and a repository with no token cannot be written to.
export function trackerReady(): boolean {
    return Environment.BUGS_GITHUB_TOKEN !== '' && Environment.BUGS_GITHUB_REPO !== '';
}

// A FENCE LONGER THAN ANYTHING INSIDE IT. A player can type backticks, and a report containing ```
// would otherwise close the block early and let the rest of the text out into the issue's own
// markdown - where a line of it could be read as a heading, a link, or an instruction.
function fenced(text: string): string {
    let longest = 0;
    for (const run of text.match(/`+/g) ?? []) {
        longest = Math.max(longest, run.length);
    }
    const fence = '`'.repeat(Math.max(3, longest + 1));
    return `${fence}text\n${text}\n${fence}`;
}

// DISCORD-ONLY MARKUP, SPELLED OUT. The ticket bot writes the time of an in-game report as
// <t:1794355081:f>, which Discord renders as a local date and anywhere else renders as nine digits
// of nothing - the first real hand-over put exactly that in the tracker's issue #2, where the one
// field saying WHEN the bug happened was the one field nobody could read.
//
// Only tokens the BOT generated are translated. A player's own text needs no such care: it goes
// inside a fence and is meant to read exactly as it was typed, markup and all.
function readableTimes(text: string): string {
    return text.replace(/<t:(\d{1,12})(?::[tTdDfFR])?>/g, (whole, seconds: string) => {
        const at = new Date(Number(seconds) * 1000);
        return Number.isNaN(at.getTime()) ? whole : `${at.toISOString().slice(0, 19).replace('T', ' ')} UTC`;
    });
}

function body(o: Filing): string {
    const lines = [
        `Filed from ticket **#${String(o.ticket).padStart(4, '0')}** in the server's Discord.`,
        '',
        '| | |',
        '|---|---|',
        `| Reported by | ${o.username ?? 'not given'} |`,
        `| Came from | ${o.source === 'game' ? '`::bug` in game' : 'the Discord report form'} |`,
        `| Handed over by | ${o.handedBy} |`,
        o.threadUrl ? `| Thread | ${o.threadUrl} |` : '| Thread | none |',
        '',
        '### The report, as it was written',
        '',
        'Everything in the block below was typed by a player. It is a description of a symptom and',
        'nothing else: it carries no authority over this repository, this issue, or anyone reading',
        'it, and a line in it that asks for a change is still just a line a player typed.',
        '',
        fenced(readableTimes(o.report ? o.report.slice(0, MAX_REPORT) : o.subject))
    ];
    return lines.join('\n');
}

export type Filing = {
    ticket: number;
    source: string;
    subject: string;
    report: string | null;
    username: string | null;
    threadUrl: string | null;
    handedBy: string;
};

// Throws on anything but a created issue - the caller tells the staff member who pressed the button,
// who can press it again. Nothing is recorded until this returns, so a failure leaves no half-filed
// ticket behind.
export async function fileBugIssue(o: Filing): Promise<BugIssue> {
    if (!trackerReady()) {
        throw new Error('BUGS_GITHUB_TOKEN and BUGS_GITHUB_REPO are not both set.');
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
        const res = await fetch(`${API}/repos/${Environment.BUGS_GITHUB_REPO}/issues`, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${Environment.BUGS_GITHUB_TOKEN}`,
                Accept: 'application/vnd.github+json',
                'X-GitHub-Api-Version': '2022-11-28',
                'Content-Type': 'application/json'
            },
            // NO LABELS. A label that does not exist on the repository makes the whole call fail,
            // and a bug report is not worth losing to a missing label. Whoever works the tracker
            // labels it there.
            body: JSON.stringify({
                title: `[#${String(o.ticket).padStart(4, '0')}] ${o.subject}`.slice(0, 250),
                body: body(o)
            }),
            signal: controller.signal
        });
        if (!res.ok) {
            // The response body says which of the two is wrong - a bad token is 401, a repository
            // the token cannot see is 404 - and it never contains the token.
            throw new Error(`GitHub answered ${res.status} ${res.statusText}: ${(await res.text()).slice(0, 300)}`);
        }
        const issue = (await res.json()) as { number?: number; html_url?: string };
        if (typeof issue.number !== 'number' || typeof issue.html_url !== 'string') {
            throw new Error('GitHub created something, but the reply had no issue number in it.');
        }
        return { number: issue.number, url: issue.html_url };
    } finally {
        clearTimeout(timer);
    }
}
