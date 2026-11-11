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
