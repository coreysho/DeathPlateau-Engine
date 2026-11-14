/**
 * Give the Veteran rank to everybody who played before launch, in one pass.
 *
 *   npx tsx tools/server/veteran.ts                  what it WOULD do, and nothing else
 *   npx tsx tools/server/veteran.ts --confirm        do it
 *   npx tsx tools/server/veteran.ts --list           name every account, not just the counts
 *   npx tsx tools/server/veteran.ts --profile main   which world (default: NODE_PROFILE)
 *   npx tsx tools/server/veteran.ts --before 2026-11-15   a different launch day
 *   npx tsx tools/server/veteran.ts --registered     count registering as playing (see below)
 *   npx tsx tools/server/veteran.ts --skip-staff     leave staff accounts alone
 *
 * WHY THIS EXISTS. ::veteran takes one username, typed in game, and files one request at a time
 * through the login thread. The launch post promised the rank to everyone who tested and said
 * "there is nothing you need to do to qualify - we can see who was here", which is a promise about
 * a list nothing in the build produces.
 *
 * WHO COUNTS AS HAVING PLAYED. Two tests, and an account must pass both:
 *
 *   it has a save file   The server writes one at logout, so a save is proof somebody played -
 *                        where a row in account_login only proves they reached the login screen,
 *                        and account.registration_date proves nothing at all. Saves are looked for
 *                        in the live folder AND in every wiped-* folder beside it, because the
 *                        launch wipe MOVES a player's save to data/players/<profile>/wiped-<stamp>/
 *                        rather than deleting it. That archive is, exactly, the list of people who
 *                        were here before launch - the wipe itself produces the roster this needs.
 *                        Staff saves are never moved (wipe.ts leaves staff alone), so theirs are
 *                        found in the live folder instead, and both places are read for that
 *                        reason rather than for tidiness.
 *
 *   it registered first  account.registration_date is before the cutoff. This is what keeps a
 *                        player who joined AFTER launch out: their save is in the live folder too,
 *                        and the save test alone cannot tell the two apart once the world has been
 *                        running a while.
 *
 * So this is correct run before the wipe, straight after it, or months later, which matters
 * because the rank is meant to arrive after launch day rather than on it.
 *
 * --registered drops the save test and gives the rank to every account registered before the
 * cutoff, including ones that never played a minute. It is here because it is the other reading of
 * the promise, not because it is the right one.
 *
 * THE CUTOFF IS EASTERN MIDNIGHT. The box keeps America/New_York and the launch post names a day,
 * not an instant; registration_date is stored UTC (toDbDate goes through toISOString), so the day
 * given is converted before it is compared. Default: November 15 2026.
 *
 * IT ONLY EVER GRANTS. An account that already has the rank is left alone and counted separately,
 * so this can be run again after more people have played without taking anything back - and
 * somebody granted by hand with ::veteran keeps it whatever the tests here say.
 *
 * STAFF ARE INCLUDED, and it costs them nothing: chatCrown asks about the veteran flag LAST, so a
 * staff member who is also a veteran still shows their own crown. They get the cape like anyone
 * else who was here. --skip-staff if that is not wanted.
 *
 * SAFE TO RUN WITH THE WORLD UP. It writes one column that is read at login, so anybody online
 * sees their emblem and gets their cape the next time they log in - World.veteranCape hands the
 * cape out then. Nothing is read from a live character, so there is no save to race.
 */
import fs from 'fs';
import path from 'path';

import { db } from '#/db/query.js';
import Environment from '#/util/Environment.js';

const args = process.argv.slice(2);
const confirm = args.includes('--confirm');
const listAll = args.includes('--list');
const registeredOnly = args.includes('--registered');
const skipStaff = args.includes('--skip-staff');

function valueOf(flag: string): string | null {
    const at = args.indexOf(flag);
    if (at !== -1 && at + 1 < args.length) {
        return args[at + 1];
    }
    const inline = args.find(a => a.startsWith(flag + '='));
    return inline ? inline.slice(flag.length + 1) : null;
}

function fail(message: string): never {
    console.error(`veteran: ${message}`);
    process.exit(1);
}

const profile = valueOf('--profile') ?? Environment.NODE_PROFILE;

/**
 * Eastern midnight on the given day, as a UTC instant.
 *
 * Worked out from the zone itself rather than by subtracting five hours, because the offset is not
 * always five: a launch day in March or October would be four, and a hard-coded -05:00 would move
 * the cutoff by an hour without saying so.
 */
function easternMidnight(day: string): Date {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) {
        fail(`--before wants a day as YYYY-MM-DD, not "${day}"`);
    }
    const naive = new Date(`${day}T00:00:00Z`);
    const shown = new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/New_York',
        hour12: false,
        year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit'
    }).formatToParts(naive);
    const hour = Number(shown.find(p => p.type === 'hour')?.value ?? '0');
    // How far behind UTC Eastern is on that date: midnight UTC reads as (24 - offset) the day
    // before, so the offset falls straight out of the hour.
    const offset = hour === 0 ? 0 : 24 - hour;
    return new Date(naive.getTime() + offset * 3600_000);
}

const cutoff = easternMidnight(valueOf('--before') ?? '2026-11-15');

/** Every username with a save file, live or archived by a wipe. Lower case, no extension. */
function playedUsernames(): { all: Set<string>; live: number; archived: number; folders: string[] } {
    const root = path.join('data/players', profile);
    const all = new Set<string>();
    let live = 0;
    let archived = 0;
    const folders: string[] = [];
    if (!fs.existsSync(root)) {
        fail(`no save folder at ${root} - is --profile right?`);
    }
    for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
        if (entry.isFile() && entry.name.endsWith('.sav')) {
            all.add(entry.name.slice(0, -4).toLowerCase());
            live++;
        } else if (entry.isDirectory() && entry.name.startsWith('wiped-')) {
            folders.push(entry.name);
            for (const name of fs.readdirSync(path.join(root, entry.name))) {
                if (name.endsWith('.sav')) {
                    const user = name.slice(0, -4).toLowerCase();
                    if (!all.has(user)) {
                        archived++;
                    }
                    all.add(user);
                }
            }
        }
    }
    return { all, live, archived, folders };
}

/** registration_date comes back as a string from sqlite and a Date from mysql. */
function asDate(value: unknown): Date | null {
    if (value instanceof Date) {
        return value;
    }
    if (typeof value === 'string') {
        // 'YYYY-MM-DD HH:MM:SS', written by toDbDate from an ISO string, so it is UTC.
        const d = new Date(value.replace(' ', 'T') + (value.includes('Z') ? '' : 'Z'));
        return isNaN(d.getTime()) ? null : d;
    }
    return null;
}

async function main(): Promise<void> {
    const saves = playedUsernames();
    const accounts = await db
        .selectFrom('account')
        .select(['id', 'username', 'staffmodlevel', 'veteran', 'registration_date'])
        .execute();

    const grant: typeof accounts = [];
    const already: typeof accounts = [];
    const noSave: typeof accounts = [];
    const tooLate: typeof accounts = [];
    const staffSkipped: typeof accounts = [];
    const undated: typeof accounts = [];

    for (const account of accounts) {
        if (skipStaff && (account.staffmodlevel ?? 0) > 0) {
            staffSkipped.push(account);
            continue;
        }
        const registered = asDate(account.registration_date);
        if (registered === null) {
            // Not assumed either way: an account whose date cannot be read is reported rather
            // than quietly granted or quietly skipped.
            undated.push(account);
            continue;
        }
        if (registered >= cutoff) {
            tooLate.push(account);
            continue;
        }
        if (!registeredOnly && !saves.all.has(account.username.toLowerCase())) {
            noSave.push(account);
            continue;
        }
        if ((account.veteran ?? 0) > 0) {
            already.push(account);
            continue;
        }
        grant.push(account);
    }

    const names = (rows: typeof accounts): string =>
        rows.map(r => r.username).sort((a, b) => a.localeCompare(b)).join(', ');

    console.log(`world            ${profile}`);
    console.log(`cutoff           ${cutoff.toISOString()}  (midnight Eastern)`);
    console.log(`test             ${registeredOnly ? 'registered before the cutoff' : 'registered before the cutoff AND has a save file'}`);
    console.log(`save files       ${saves.all.size} accounts (${saves.live} live, ${saves.archived} only in ${saves.folders.length} wiped-* folder(s))`);
    if (!registeredOnly && saves.all.size === 0) {
        console.log('                 ^ none at all, so nothing can qualify - check --profile');
    }
    console.log('');
    console.log(`accounts         ${accounts.length}`);
    console.log(`  to grant       ${grant.length}`);
    console.log(`  already had it ${already.length}`);
    console.log(`  registered after the cutoff   ${tooLate.length}`);
    if (!registeredOnly) {
        console.log(`  no save, never played         ${noSave.length}`);
    }
    if (skipStaff) {
        console.log(`  staff, skipped                ${staffSkipped.length}`);
    } else {
        const staff = grant.filter(a => (a.staffmodlevel ?? 0) > 0).length;
        if (staff > 0) {
            console.log(`  (${staff} of those to grant ${staff === 1 ? 'is a staff member' : 'are staff'} - they keep their own crown)`);
        }
    }
    if (undated.length) {
        console.log(`  NO READABLE REGISTRATION DATE ${undated.length}: ${names(undated)}`);
        console.log('                 ^ neither granted nor excluded. Look at these by hand.');
    }

    if (listAll && grant.length) {
        console.log(`\nto grant: ${names(grant)}`);
    } else if (grant.length) {
        const sample = grant.slice(0, 12);
        console.log(`\nto grant: ${names(sample)}${grant.length > sample.length ? `, and ${grant.length - sample.length} more (--list for all)` : ''}`);
    }

    if (!confirm) {
        console.log('\nnothing was written. Pass --confirm to grant the rank.');
        return;
    }
    if (!grant.length) {
        console.log('\nnothing to do.');
        return;
    }

    // One statement, not one per account: this is a single column on rows that are not otherwise
    // being touched, and a loop of hundreds of updates is a loop of hundreds of chances to stop
    // half way through.
    await db
        .updateTable('account')
        .set({ veteran: 1 })
        .where(
            'id',
            'in',
            grant.map(a => a.id)
        )
        .execute();

    const check = await db
        .selectFrom('account')
        .select(['id'])
        .where('veteran', '=', 1)
        .execute();
    console.log(`\ngranted ${grant.length}. ${check.length} accounts now carry the rank.`);
    console.log('They get the emblem, and the cape from World.veteranCape, at their next login.');
}

main()
    .then(() => process.exit(0))
    .catch(err => {
        console.error(err);
        process.exit(1);
    });
