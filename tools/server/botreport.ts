/**
 * What one player's captured input looks like. Stage two: the evidence, not the triage.
 *
 * botcheck.ts ranks every session by how much the client reported, which finds a bot that is not
 * running the client at all and finds nothing else - because a real client reports about 30 packets
 * a minute whether the mouse is touched or not. This reads the capture itself, which is the only
 * thing that can tell a parked cursor from a moving one.
 *
 * TURN THE CAPTURE ON FIRST. In game, as an administrator: ::track NAME. It is off by default and
 * costs about a megabyte per player-hour, so there is nothing here until somebody asks for it, and
 * ::track with no name lists who is being watched. ::untrack NAME stops it.
 *
 * WHAT THE NUMBERS MEAN, and the direction a script moves each one:
 *
 *   still share       of the time the cursor was watched, how much of it it did not move.
 *                     An autoclicker parks the cursor; a hand never stops drifting.
 *   click spread      distinct click positions over clicks. One pixel for everything gives
 *                     almost zero; a hand clicking real things gives almost one.
 *   top pixel share   how much of the clicking landed on the single commonest pixel. A script
 *                     gives 1.
 *   gap variation     the spread of the gaps between clicks over their mean. A fixed sleep
 *                     gives 0. A hand gives a third or more.
 *   top gap share     how much of the gaps were the commonest single value. A fixed sleep
 *                     gives 1.
 *
 * NONE OF IT IS PROOF, and the failure mode is believing otherwise. A player doing one repetitive
 * thing by hand - fletching a thousand arrow shafts at one inventory slot - moves these numbers in
 * the same direction as a script does, just not as far. What a script cannot fake is ALL of them at
 * once: a parked cursor AND one pixel AND an identical gap. Read them together, and read them
 * against what the player was supposed to be doing.
 *
 * Usage:
 *   npx tsx tools/server/botreport.ts NAME
 *   npx tsx tools/server/botreport.ts NAME --sessions 5
 */
import { analyseInput, decodeInputReport, type InputEvent } from '#/engine/entity/tracking/InputReport.js';
import { db } from '#/db/query.js';

const name = process.argv[2];
if (!name || name.startsWith('--')) {
    console.log('usage: npx tsx tools/server/botreport.ts NAME [--sessions N]');
    process.exit(1);
}

const at = process.argv.indexOf('--sessions');
const SESSIONS = at === -1 ? 3 : Math.max(1, Number(process.argv[at + 1]) || 3);

async function main() {
    const account = await db.selectFrom('account').select(['id', 'username']).where('username', '=', name.toLowerCase().replace(/ /g, '_')).executeTakeFirst();

    if (!account) {
        console.log(`No account called ${name}.`);
        return;
    }

    const sessions = await db
        .selectFrom('session')
        .select(['uuid', 'timestamp'])
        .where('account_id', '=', account.id)
        .orderBy('timestamp', 'desc')
        .limit(SESSIONS)
        .execute();

    if (sessions.length === 0) {
        console.log(`${account.username} has no sessions on record.`);
        return;
    }

    let anyCapture = false;

    for (const session of sessions) {
        const rows = await db.selectFrom('input_report').select(['data']).where('session_uuid', '=', session.uuid).orderBy('timestamp', 'asc').execute();

        console.log(`\n${account.username}, session of ${new Date(session.timestamp).toLocaleString()}`);

        if (rows.length === 0) {
            console.log('  nothing captured. ::track ' + account.username + ' in game turns it on for the next one.');
            continue;
        }

        anyCapture = true;

        // every flush of the session, read as one stream: the cursor's position carries across
        // them in the client, and a batch split by a flush is a batch either way
        const events: InputEvent[] = [];
        for (const row of rows) {
            events.push(...decodeInputReport(new Uint8Array(row.data as Buffer)));
        }

        const s = analyseInput(events);
        console.log(`  ${rows.length} flush(es), ${events.length} events, ${s.clicks} click(s), ${s.cursorSamples} cursor sample(s)`);

        if (s.cursorSamples === 0 && s.clicks === 0) {
            console.log('  the capture holds no cursor and no clicks at all - that is not a client somebody is using');
            continue;
        }

        const show = (label: string, value: number, botward: 'high' | 'low', bound: number) => {
            const odd = botward === 'high' ? value >= bound : value <= bound;
            console.log(`  ${label.padEnd(18)} ${value.toFixed(3).padStart(7)}   ${odd ? '<-- like a script' : 'like a hand'}`);
        };

        show('still share', s.stillShare, 'high', 0.8);
        show('click spread', s.clickSpread, 'low', 0.1);
        show('top pixel share', s.topPixelShare, 'high', 0.8);
        if (s.clicks > 2) {
            show('gap variation', s.gapVariation, 'low', 0.05);
            show('top gap share', s.topGapShare, 'high', 0.8);
        } else {
            console.log('  (too few clicks to say anything about their timing)');
        }
        console.log(`  camera moved ${s.cameraMoves} time(s), window focus changed ${s.focusChanges} time(s)`);

        const flags = [s.stillShare >= 0.8, s.clickSpread <= 0.1, s.topPixelShare >= 0.8, s.clicks > 2 && s.gapVariation <= 0.05, s.clicks > 2 && s.topGapShare >= 0.8].filter(Boolean).length;

        if (flags >= 4) {
            console.log('  READING: every measure points one way at once. A hand does not do that.');
        } else if (flags >= 2) {
            console.log('  READING: some measures look mechanical. One repetitive job done by hand looks like this too -');
            console.log('           worth asking what they were doing, not worth acting on alone.');
        } else {
            console.log('  READING: looks like somebody playing.');
        }
    }

    if (!anyCapture) {
        console.log(`\nNothing has been captured for ${account.username}. ::track ${account.username} in game, let them play, then run this again.`);
    }
}

main()
    .then(() => process.exit(0))
    .catch(err => {
        console.error(err);
        process.exit(1);
    });
