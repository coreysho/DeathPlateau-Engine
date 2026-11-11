import fs from 'fs';
import os from 'os';
import path from 'path';
import { DatabaseSync } from 'node:sqlite';

import { addHandoverColumns, bugTicketIds, fileBugIssue, reportsToRecover, trackerReady, trackerRepo } from '#/server/tickets/BugTracker.js';

// WHAT A HAND-OVER DOES, CHECKED WITHOUT DISCORD OR GITHUB (custom, 2026-11-10).
//
// The "Hand to Claude" button in server/tickets/TicketBot.ts is one press that writes a private
// GitHub issue and alters a live sqlite table. Neither half can be tried out on Corey's box without
// consequences - a migration you cannot test is a migration you find out about in production - so
// this runs both against a temporary database and a stubbed fetch.
//
// Run it with: npx tsx tools/tickets/bugtracker-check.ts
//
// WHAT IT DOES NOT COVER. It never talks to GitHub, so it cannot say whether the token is right or
// the repository exists. The button's own answer does that: it reports GitHub's status line back to
// whoever pressed it.

// RUN IT WITH `npm run tickets:check`, which sets the two fake values below in the shell. They
// cannot be set in this file: Environment snapshots process.env once, when it is first loaded, and
// an import at the top of a file runs before any statement in it - so by the time a line here could
// assign one, the empty value is already frozen. Setting them before node starts is also the honest
// test, because it is the path the real bot takes. `dotenv/config` does not override a variable
// that is already set, so a real token in .env cannot leak in here either.
const WANT_REPO = 'coreysho/DeathPlateau-Bugs';
const WANT_TOKEN = 'ghp_thisisnotarealtokenatall0000000000';
if (process.env.BUGS_GITHUB_REPO !== WANT_REPO || process.env.BUGS_GITHUB_TOKEN !== WANT_TOKEN) {
    console.log('Run this with `npm run tickets:check` - it needs the two stand-in values set before node starts.');
    process.exit(1);
}

let ok = 0;
const bad: string[] = [];

function check(what: string, got: unknown, want: unknown) {
    if (got === want) {
        ok++;
        return;
    }
    bad.push(`${what}\n      wanted: ${JSON.stringify(want)}\n      got:    ${JSON.stringify(got)}`);
}

function checkThat(what: string, got: boolean) {
    check(what, got, true);
}

// ---------------------------------------------------------------- the migration, on an old table

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bugtracker-'));
const dbPath = path.join(dir, 'tickets.sqlite');
try {
    const db = new DatabaseSync(dbPath);
    // The ticket table EXACTLY as it was before 2026-11-10, with a row in it, because the thing that
    // matters is what happens to a database that already has tickets in it.
    db.exec(`
        CREATE TABLE ticket (
            id             INTEGER PRIMARY KEY AUTOINCREMENT,
            kind           TEXT NOT NULL,
            source         TEXT NOT NULL,
            opener_id      TEXT,
            username       TEXT,
            subject        TEXT NOT NULL,
            thread_id      TEXT,
            log_channel_id TEXT,
            log_message_id TEXT,
            status         TEXT NOT NULL DEFAULT 'open',
            claimed_by     TEXT,
            created        INTEGER NOT NULL,
            closed         INTEGER,
            closed_by      TEXT,
            close_reason   TEXT
        );
    `);
    db.prepare('INSERT INTO ticket (kind, source, subject, username, created) VALUES (?, ?, ?, ?, ?)').run('bug', 'game', 'fell through the floor', 'zezima', 1762000000000);

    const columns = () => (db.prepare("SELECT name FROM pragma_table_info('ticket')").all() as { name: string }[]).map(r => r.name);
    checkThat('before: the four columns are not there', !columns().includes('report') && !columns().includes('issue_url'));

    addHandoverColumns(db);
    for (const column of ['report', 'issue_number', 'issue_url', 'handed_by']) {
        checkThat(`after: ticket.${column} exists`, columns().includes(column));
    }

    // THE ROW SURVIVES. An ALTER that dropped or rewrote the existing tickets would be the worst
    // outcome here and the easiest to miss, since the bot would start up perfectly well.
    const row = db.prepare('SELECT * FROM ticket WHERE id = 1').get() as Record<string, unknown>;
    check('the ticket that was already there still reads back', row?.subject, 'fell through the floor');
    check('its new columns are null, not missing', row?.issue_url, null);

    // TWICE IS THE NORMAL CASE: the bot runs this on every start, so a second pass has to be a
    // no-op rather than an error that stops support from coming up.
    addHandoverColumns(db);
    addHandoverColumns(db);
    check('running it three times leaves 19 columns', columns().length, 19);

    // ---- which tickets the backfill picks up
    //
    // The real backlog is 44 bug reports with no stored detail, filed before the columns existed.
    // Both queries are quiet when wrong: too narrow and part of that backlog is skipped for good,
    // too wide and a support ticket - or a report whose detail is already stored - is overwritten.
    const add = db.prepare('INSERT INTO ticket (id, kind, source, subject, created, report, thread_id) VALUES (?, ?, ?, ?, ?, ?, ?)');
    add.run(10, 'bug', 'game', 'no detail, has a thread', 1, null, 't10');
    add.run(11, 'bug', 'game', 'detail already stored', 1, 'the full report', 't11');
    add.run(12, 'bug', 'game', 'no detail and no thread', 1, null, null);
    add.run(13, 'support', 'discord', 'a support ticket with no detail', 1, null, 't13');
    add.run(14, 'bug', 'discord', 'another one to recover', 1, null, 't14');
    db.prepare("UPDATE ticket SET status = 'closed' WHERE id = 14").run();

    const toRecover = reportsToRecover(db, 500);
    check('only the bug reports missing detail that still have a thread', toRecover.map(r => r.id).join(','), '10,14');
    check('and it brings the thread id along', toRecover[0]?.thread_id, 't10');
    checkThat('a closed one is included - a closed report can still be handed over', toRecover.some(r => r.id === 14));

    // The log-message rebuild is deliberately WIDER: every bug ticket, whatever its state.
    check('the rebuild covers every bug ticket and no support ticket', bugTicketIds(db, 500).join(','), '1,10,11,12,14');
    check('the limit is honoured', reportsToRecover(db, 1).length, 1);
    db.close();
} finally {
    fs.rmSync(dir, { recursive: true, force: true });
}

// ---------------------------------------------------------------- what gets sent to GitHub

check('the tracker reads its repository from the environment', trackerRepo(), WANT_REPO);
checkThat('and counts itself ready with both halves set', trackerReady());

type Sent = { url: string; init: RequestInit };
const real = globalThis.fetch;
let sent: Sent | null = null;
let reply: { status: number; json: unknown } = { status: 201, json: { number: 12, html_url: 'https://github.com/coreysho/DeathPlateau-Bugs/issues/12' } };
globalThis.fetch = (async (url: string, init: RequestInit) => {
    sent = { url, init };
    return {
        ok: reply.status >= 200 && reply.status < 300,
        status: reply.status,
        statusText: 'Stubbed',
        json: async () => reply.json,
        text: async () => JSON.stringify(reply.json)
    };
}) as unknown as typeof globalThis.fetch;

// A report with a fenced code block inside it, which is the case that breaks a naive ``` fence and
// lets a player's text out into the issue's own markdown.
const nasty = 'the fairy ring eats my code\n\n```\nAJR\n```\n\nand ```` this ```` too';
const filing = {
    ticket: 7,
    source: 'game',
    subject: 'the fairy ring eats my code',
    report: nasty,
    username: 'Zezima',
    threadUrl: 'https://discord.com/channels/1/2/3',
    handedBy: 'corey'
};

try {
    const issue = await fileBugIssue(filing);
    check('it returns the issue number GitHub gave it', issue.number, 12);
    check('and the issue url', issue.url, 'https://github.com/coreysho/DeathPlateau-Bugs/issues/12');

    const s = sent as unknown as Sent;
    check('it posts', s.init.method, 'POST');
    check('to the tracker, not a code repository', s.url, 'https://api.github.com/repos/coreysho/DeathPlateau-Bugs/issues');
    const headers = s.init.headers as Record<string, string>;
    checkThat('with the token as a bearer', headers.Authorization === `Bearer ${WANT_TOKEN}`);
    check('and a pinned api version', headers['X-GitHub-Api-Version'], '2022-11-28');

    const body = JSON.parse(String(s.init.body)) as { title: string; body: string; labels?: unknown };
    check('the title carries the ticket number, zero padded', body.title, '[#0007] the fairy ring eats my code');
    checkThat('no labels are sent at all', body.labels === undefined);
    checkThat('the report is in the body, every character of it', body.body.includes(nasty));
    checkThat('the body says the quoted text is a player\'s, not an instruction', body.body.includes('no authority over this repository'));
    checkThat('the thread is linked so staff can get back to the player', body.body.includes(filing.threadUrl));
    checkThat('the reporter is named', body.body.includes('Zezima'));
    checkThat('and who handed it over', body.body.includes('corey'));

    // THE FENCE IS LONGER THAN ANYTHING IN THE REPORT. The report contains a run of four backticks,
    // so a five-backtick fence is the shortest that can hold it.
    checkThat('the fence outlasts the backticks inside it', body.body.includes('`````text\n'));
    const afterFence = body.body.split('`````text\n')[1] ?? '';
    checkThat('and nothing of the report escapes it', afterFence.startsWith(nasty) && afterFence.trimEnd().endsWith('`````'));

    // THE TIME IS READABLE OFF DISCORD. <t:...:f> is a local date in Discord and nine digits of
    // nothing everywhere else, and the field it is in is the one that says WHEN the bug happened.
    // Issue #2 in the real tracker is where this turned up.
    sent = null;
    await fileBugIssue({ ...filing, report: 'it broke\n\nWhen: <t:1794355081:f>\n\nWorld: 10' });
    const timed = JSON.parse(String((sent as unknown as Sent).init.body)) as { body: string };
    checkThat('a Discord timestamp is spelled out', timed.body.includes('When: 2026-11-10 23:58:01 UTC'));
    checkThat('and the token itself is gone', !timed.body.includes('<t:'));
    checkThat('the rest of the report is untouched', timed.body.includes('it broke') && timed.body.includes('World: 10'));

    // EVERY STYLE DISCORD WRITES, because the bot uses :f today and a later field could use any of
    // them - :R especially, which is the "2 hours ago" one.
    sent = null;
    await fileBugIssue({ ...filing, report: 'a <t:1794355081:R> b <t:1794355081> c <t:1794355081:D>' });
    const styles = JSON.parse(String((sent as unknown as Sent).init.body)) as { body: string };
    checkThat('relative, bare and date-only styles all convert', (styles.body.match(/2026-11-10 23:58:01 UTC/g) ?? []).length === 3);

    // AND NOT A PLAYER'S OWN ANGLE BRACKETS. Only the bot's timestamps are translated; anything
    // else a player typed stays exactly as typed, because it is quoted evidence.
    sent = null;
    await fileBugIssue({ ...filing, report: 'the shop says <t:abc> and <@12345> too' });
    const left = JSON.parse(String((sent as unknown as Sent).init.body)) as { body: string };
    checkThat("a player's own angle brackets are left alone", left.body.includes('<t:abc>') && left.body.includes('<@12345>'));

    // A LONG TITLE IS CLIPPED, because GitHub rejects one over 256 and a rejected call loses the
    // report. ::bug takes a whole sentence, so this is the normal case and not the odd one.
    sent = null;
    await fileBugIssue({ ...filing, subject: 'x'.repeat(400) });
    const long = JSON.parse(String((sent as unknown as Sent).init.body)) as { title: string };
    checkThat('a long subject is clipped under GitHub\'s limit', long.title.length <= 250);

    // AND AN OLD TICKET, from before the report column existed, still files - on its subject.
    sent = null;
    await fileBugIssue({ ...filing, report: null });
    const old = JSON.parse(String((sent as unknown as Sent).init.body)) as { body: string };
    checkThat('a ticket with no stored report falls back to its subject', old.body.includes(filing.subject));

    // ---- and the two ways it can fail
    reply = { status: 404, json: { message: 'Not Found' } };
    let threw = '';
    try {
        await fileBugIssue(filing);
    } catch (err) {
        threw = (err as Error).message;
    }
    checkThat('a 404 throws, naming the status', threw.includes('404'));
    // THE TOKEN IS NEVER IN THE ERROR. This message is sent straight back into Discord, where the
    // staff log is a channel - so a token in it would be a token posted in a channel.
    checkThat('and the error does not carry the token', !threw.includes(WANT_TOKEN));

    reply = { status: 201, json: { html_url: 'https://github.com/x/y/issues/1' } };
    threw = '';
    try {
        await fileBugIssue(filing);
    } catch (err) {
        threw = (err as Error).message;
    }
    checkThat('a reply with no issue number throws rather than being recorded', threw.includes('no issue number'));
} finally {
    globalThis.fetch = real;
}

console.log();
for (const line of bad) {
    console.log(`  FAIL  ${line}`);
}
console.log(`${ok} ok, ${bad.length} FAIL`);
process.exit(bad.length ? 1 : 0);
