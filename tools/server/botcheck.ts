/**
 * Who played without touching a mouse. Triage for macros and bots, from outside the running server.
 *
 * WHAT IT READS AND WHY THAT IS THE QUESTION. The client reports where the cursor went, where it
 * was clicked, whether the camera was turned and whether the window kept focus. A bot that drives
 * the real client produces all of it. A bot that speaks the protocol straight at the server
 * produces NONE of it, because nothing is moving a mouse to report - and you can see that without
 * decoding a single byte of what was reported. session_input counts both halves for every session:
 * what the player did, and what the client said a person was doing while they did it.
 *
 * NEITHER HALF MEANS ANYTHING ALONE. Somebody standing in a bank for an hour moves no mouse
 * either, and a thousand mouse packets prove nothing if the account never did anything. It is a
 * high action count against a near-zero telemetry count that is worth looking at.
 *
 * WHAT THIS CANNOT DO, said plainly because the temptation runs the other way:
 *
 *   * it does not catch a screen-scraper running on the real client with humanised mouse movement.
 *     That one reports a cursor because there IS a cursor. Catching it needs the full capture
 *     (input_report, off unless somebody turns it on for a suspect) and the statistics - click
 *     position entropy, the shape of the gaps between clicks - which is a different job;
 *   * it does not prove anything on its own. A verdict here is EVIDENCE FOR A PERSON TO WEIGH. A
 *     wrongly banned player tells everybody and you cannot take it back, so this prints a ranked
 *     list and a reason, and stops there. Nothing in it bans anybody.
 *
 * Usage:
 *   npx tsx tools/server/botcheck.ts                 the last 7 days
 *   npx tsx tools/server/botcheck.ts --days 30
 *   npx tsx tools/server/botcheck.ts --min-actions 200
 */
import { db, toDbDate } from '#/db/query.js';

function arg(name: string, fallback: number): number {
    const at = process.argv.indexOf('--' + name);
    if (at === -1) {
        return fallback;
    }
    const value = Number(process.argv[at + 1]);
    return Number.isFinite(value) && value >= 0 ? value : fallback;
}

const DAYS = arg('days', 7);
// Below this, a session is too short to say anything about. A packet bot that did forty things is
// indistinguishable from somebody who logged in, banked and left.
const MIN_ACTIONS = arg('min-actions', 100);

async function main() {
    // toDbDate, not a Date: the column is stored as 'YYYY-MM-DD HH:MM:SS' text on sqlite, so a
    // Date object compares as something else entirely and silently matches nothing.
    const since = toDbDate(Date.now() - DAYS * 86400000);

    const rows = await db
        .selectFrom('session_input')
        .innerJoin('session', 'session.uuid', 'session_input.session_uuid')
        .leftJoin('account', 'account.id', 'session.account_id')
        .select([
            'account.username as username',
            'session.ip as ip',
            'session.uid as uid',
            'session_input.timestamp as ended',
            'session_input.user_actions as actions',
            'session_input.mouse_moves as moves',
            'session_input.mouse_clicks as clicks',
            'session_input.camera_moves as camera',
            'session_input.focus_changes as focus'
        ])
        .where('session_input.timestamp', '>=', since)
        .execute();

    if (rows.length === 0) {
        console.log(`No session_input rows in the last ${DAYS} day(s).`);
        console.log('If that is a surprise, check LOGGER_SERVER is set in .env - with it unset the');
        console.log('logger drops everything it is handed and records nothing at all.');
        return;
    }

    const scored = rows
        .map(r => {
            const telemetry = r.moves + r.clicks + r.camera + r.focus;
            return { ...r, telemetry, perAction: r.actions > 0 ? telemetry / r.actions : 0 };
        })
        .filter(r => r.actions >= MIN_ACTIONS)
        .sort((a, b) => a.perAction - b.perAction);

    console.log(`${rows.length} session(s) in the last ${DAYS} day(s), ${scored.length} with at least ${MIN_ACTIONS} actions.\n`);
    console.log('Ranked by how little the client reported per action. Lowest is most worth a look.\n');
    // padEnd/padStart, not a printf format: node's console.log understands %s and %d and silently
    // prints '%-18s' as the literal four characters, which is how the first run of this came out.
    const row = (a: string, b: string, c: string, d: string, e: string, f: string, g: string) =>
        `${a.padEnd(18)} ${b.padStart(8)} ${c.padStart(9)} ${d.padStart(7)} ${e.padStart(7)} ${f.padStart(7)}  ${g}`;

    console.log(row('player', 'actions', 'telemetry', 'per act', 'camera', 'focus', 'reading'));

    for (const r of scored.slice(0, 25)) {
        let reading: string;
        if (r.telemetry === 0) {
            reading = 'NOTHING REPORTED - not the real client, or not a person';
        } else if (r.perAction < 0.2) {
            reading = 'almost nothing reported - worth the full capture';
        } else if (r.camera === 0 && r.focus === 0) {
            reading = 'never turned the camera or left the window';
        } else {
            reading = 'looks like somebody playing';
        }

        console.log(
            row(
                r.username ?? '(no account row)',
                String(r.actions),
                String(r.telemetry),
                r.perAction.toFixed(2),
                String(r.camera),
                String(r.focus),
                reading
            )
        );
    }

    const silent = scored.filter(r => r.telemetry === 0);
    console.log();
    if (silent.length === 0) {
        console.log('Nothing played silently. No packet bots in this window.');
    } else {
        console.log(`${silent.length} session(s) did ${MIN_ACTIONS}+ things and reported NO input at all.`);
        console.log('That is the strong signal: turn the full capture on for those accounts and watch.');
        const byUid = new Map<number, Set<string>>();
        for (const r of silent) {
            if (!byUid.has(r.uid)) {
                byUid.set(r.uid, new Set());
            }
            byUid.get(r.uid)!.add(r.username ?? '(unknown)');
        }
        for (const [uid, names] of byUid) {
            if (names.size > 1) {
                console.log(`  uid ${uid} covers ${names.size} accounts: ${[...names].join(', ')} - one install, so one person.`);
            }
        }
    }
}

main()
    .then(() => process.exit(0))
    .catch(err => {
        console.error(err);
        process.exit(1);
    });
