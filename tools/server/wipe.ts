/**
 * The launch wipe: every player starts again, and keeps nothing but their name, their password and
 * what they voted for.
 *
 *   npx tsx tools/server/wipe.ts                 what it WOULD do, and nothing else
 *   npx tsx tools/server/wipe.ts --confirm       do it
 *   npx tsx tools/server/wipe.ts --profile main  which world (default: NODE_PROFILE)
 *
 * WHAT SURVIVES, and why each one:
 *
 *   account              the username and the password hash. Players log in with what they
 *                        already have; nobody re-registers, nobody is locked out.
 *   staff                any account with staffmodlevel > 0 is not touched at all - not its save,
 *                        not its hiscores, not its collection log. Staff keep their characters.
 *   the vote ledger      untouched, so cooldowns and uncollected tickets carry over...
 *   vote points/tickets  ...AND what a player had already collected is counted BEFORE the save is
 *                        taken away and credited back to the ledger, because both live in the
 *                        character: %vote_points is a varp and a ticket is an item. Wiping the
 *                        save without this would delete exactly the thing a voter was promised
 *                        they could keep. One ticket is one point (^vote_points_per_ticket), so
 *                        they add together and come back as tickets, to collect from the clerk.
 *   bans and mutes       ipban and the account's own ban/mute columns. A wipe is not an amnesty.
 *   moderation records   report, input_report, public_chat, private_chat. These are what happened;
 *                        they are not a character and a wipe is no reason to lose them.
 *   session history      session and its three child tables. The same argument, plus a practical
 *                        one: session_log, session_wealth and session_input key off session_uuid
 *                        and deleting the parent would orphan all three. The activity page's
 *                        history is built from these, and a server that has been up for months
 *                        should not pretend on launch day that it has not.
 *
 * WHAT GOES, for every non-staff account:
 *
 *   the save file        data/players/<profile>/<name>.sav - levels, items, bank, quests, varps,
 *                        position, appearance. MOVED, not deleted: see below.
 *   hiscore              both tables, AND FOR STAFF TOO - the one thing staff do not keep. They
 *                        are derived from the save, so leaving them would show a maxed board full
 *                        of characters that no longer exist; and a staff row would be pre-launch
 *                        progress ranked against players who start at nothing.
 *   collection_log       the same.
 *   friendlist           a fresh account has no friends list. (ignorelist goes with it.)
 *
 * NOTHING IS DELETED, it is moved. The saves go to data/players/<profile>/wiped-<timestamp>/ and
 * db.sqlite is copied to db.sqlite.bak-<timestamp> before a single row is touched. A wipe is the
 * one irreversible thing a server does, and it is done once, at the worst possible moment to
 * discover a mistake.
 *
 * IT REFUSES WHILE ANYBODY IS LOGGED IN. The server holds a character in memory and writes the
 * file at logout, so a save taken away underneath a live player comes straight back. Stop the
 * world first.
 */

// World FIRST, and not alphabetically - Player and NetworkPlayer are a cycle and only World's
// module graph resolves them in the right order. tools/server/account.ts says the same.
import World from '#/engine/World.js';

import fs from 'fs';
import path from 'path';
import { DatabaseSync } from 'node:sqlite';

import InvType from '#/cache/config/InvType.js';
import ObjType from '#/cache/config/ObjType.js';
import VarPlayerType from '#/cache/config/VarPlayerType.js';
import { db } from '#/db/query.js';
import { PlayerLoading } from '#/engine/entity/PlayerLoading.js';
import Packet from '#/io/Packet.js';
import Environment from '#/util/Environment.js';

const args = process.argv.slice(2);
const confirm = args.includes('--confirm');
const orphanToo = args.includes('--orphans');
const profileAt = args.indexOf('--profile');
const profile = profileAt === -1 ? Environment.NODE_PROFILE : args[profileAt + 1];
const stamp = new Date().toISOString().replace(/[:.]/g, '-');

function fail(message: string): never {
    console.error(`wipe: ${message}`);
    process.exit(1);
}

function savePath(username: string): string {
    return path.join('data/players', profile, `${username.toLowerCase()}.sav`);
}

/**
 * What this player would lose that they were told they could keep.
 *
 * Both halves of the vote currency live in the character: the points as a varp, the tickets as an
 * item in any permanent inventory - which is the bank as well as the backpack. Read through
 * PlayerLoading rather than a second decoder, so a save this counts is a save the server wrote.
 */
function voteValue(username: string): number {
    const file = savePath(username);
    if (!fs.existsSync(file)) {
        return 0;
    }

    const player = PlayerLoading.load(username.toLowerCase(), new Packet(new Uint8Array(fs.readFileSync(file))), null);

    const pointsVarp = VarPlayerType.getId('vote_points');
    const points = pointsVarp === -1 ? 0 : (player.vars[pointsVarp] ?? 0);

    const ticketObj = ObjType.getId('vote_ticket');
    let tickets = 0;
    if (ticketObj !== -1) {
        for (const [typeId, inventory] of player.invs) {
            const invType = InvType.get(typeId);
            if (!invType || invType.scope !== InvType.SCOPE_PERM) {
                continue;
            }
            for (const item of inventory.items) {
                if (item && item.id === ticketObj) {
                    tickets += item.count;
                }
            }
        }
    }

    // One ticket is one point, so they are the same currency counted twice. See vote.constant.
    return Math.max(0, points) + Math.max(0, tickets);
}

/** The ledger the engine keeps votes in, opened the way VoteService opens it. */
function voteLedger(): DatabaseSync {
    const file = Environment.VOTE_LEDGER || `data/vote/${profile}.sqlite`;
    if (!fs.existsSync(file)) {
        fail(`no vote ledger at ${file} - refusing to wipe, because the tickets to carry over cannot be written anywhere`);
    }
    return new DatabaseSync(file);
}

async function main() {
    if (!fs.existsSync('data/pack')) {
        fail('data/pack is empty or missing - without it a save cannot be read, so the vote points to carry over cannot be counted. Run npm run build first.');
    }
    World.reload();
    if (ObjType.count === 0 || InvType.count === 0) {
        fail('data/pack has no objs or invs in it - build it before wiping.');
    }

    // EVERY TABLE THIS WILL TOUCH, CHECKED BEFORE ANYTHING IS TOUCHED. A delete against a table
    // that does not exist is logged by Kysely and then reported here as "0 rows" - which is a wipe
    // claiming to have cleared something it did not, on the one run nobody gets to repeat. Found on
    // a rehearsal against a database that had never had the collection_log migration applied.
    const WIPES = ['hiscore', 'hiscore_large', 'collection_log', 'friendlist', 'ignorelist'] as const;
    const present = new Set((new DatabaseSync('db.sqlite').prepare("select name from sqlite_master where type = 'table'").all() as unknown as { name: string }[]).map(row => row.name));
    const missing = WIPES.filter(table => !present.has(table));
    if (missing.length > 0) {
        fail(`the database has no ${missing.join(', ')} table. It is behind the schema - run npm run sqlite:migrate first, then this again.`);
    }

    const accounts = await db.selectFrom('account').select(['id', 'username', 'staffmodlevel']).execute();
    const staff = accounts.filter(a => (a.staffmodlevel ?? 0) > 0);
    const players = accounts.filter(a => (a.staffmodlevel ?? 0) === 0);

    const online = await db.selectFrom('account_login').select(['account_id']).where('profile', '=', profile).where('logged_in', '!=', 0).execute();
    if (online.length > 0) {
        fail(`${online.length} account(s) are still logged in. Stop the world first: systemctl stop deathplateau.service`);
    }

    // Counted before anything moves, so the dry run reports the same numbers the real one acts on.
    const carrying: { id: number; username: string; tickets: number }[] = [];
    let withSave = 0;
    for (const account of players) {
        if (fs.existsSync(savePath(account.username))) {
            withSave++;
        }
        const value = voteValue(account.username);
        if (value > 0) {
            carrying.push({ id: account.id, username: account.username, tickets: value });
        }
    }

    // SAVES THAT BELONG TO NOBODY. A .sav whose account row is gone is a character nobody can
    // reach - until somebody registers that username, when the login server hands them whatever
    // was in it. Harmless on a dev box full of sim leftovers, not harmless on a live one, and a
    // wipe is the moment to find out which you have. Reported always, moved only when asked.
    const known = new Set(accounts.map(a => a.username.toLowerCase()));
    const saveDir = path.join('data/players', profile);
    const orphans: string[] = [];
    if (fs.existsSync(saveDir)) {
        for (const name of fs.readdirSync(saveDir)) {
            if (name.endsWith('.sav') && !known.has(name.slice(0, -4).toLowerCase())) {
                orphans.push(name);
            }
        }
    }

    console.log(`profile          ${profile}`);
    console.log(`staff kept       ${staff.length}${staff.length ? ` (${staff.map(a => a.username).join(', ')})` : ''}`);
    console.log(`players wiped    ${players.length}, of which ${withSave} have a character`);
    console.log(`vote carried     ${carrying.reduce((n, c) => n + c.tickets, 0)} tickets across ${carrying.length} player(s)`);
    if (orphans.length > 0) {
        console.log(`orphan saves     ${orphans.length} with no account row${orphanToo ? ' - will be moved too' : ' - LEFT ALONE (pass --orphans to move them)'}`);
    }
    for (const row of carrying) {
        console.log(`                 ${row.username}: ${row.tickets}`);
    }

    if (!confirm) {
        console.log('');
        console.log('Nothing was changed. Run it again with --confirm to do it.');
        return;
    }

    // ---------------------------------------------------------------- backups, before anything
    if (fs.existsSync('db.sqlite')) {
        fs.copyFileSync('db.sqlite', `db.sqlite.bak-${stamp}`);
        console.log(`\nbacked up        db.sqlite.bak-${stamp}`);
    }

    const attic = path.join('data/players', profile, `wiped-${stamp}`);
    fs.mkdirSync(attic, { recursive: true });

    // ---------------------------------------------------------------- the vote currency, first
    // BEFORE the saves move, so a crash between the two leaves the tickets credited twice rather
    // than lost. Twice is a conversation; lost is a player who voted for nothing.
    const ledger = voteLedger();
    // VoteBook makes this table the first time the ENGINE opens the ledger, which on a world that
    // has never paid a ticket has not happened yet - and found out here, on a rehearsal, after the
    // backup and before anything had moved. Same statement VoteBook uses, so the table this makes
    // is the table the engine expects.
    ledger.exec(`
        CREATE TABLE IF NOT EXISTS owed (
            username TEXT    PRIMARY KEY,
            tickets  INTEGER NOT NULL
        );
    `);
    const owed = ledger.prepare('INSERT INTO owed (username, tickets) VALUES (?, ?) ON CONFLICT(username) DO UPDATE SET tickets = tickets + excluded.tickets');
    for (const row of carrying) {
        owed.run(row.username.toLowerCase(), row.tickets);
    }
    ledger.close();
    console.log(`vote credited    ${carrying.length} player(s) owed their points back`);

    // ---------------------------------------------------------------- the characters
    let moved = 0;
    for (const account of players) {
        const file = savePath(account.username);
        if (fs.existsSync(file)) {
            fs.renameSync(file, path.join(attic, path.basename(file)));
            moved++;
        }
    }
    if (orphanToo) {
        for (const name of orphans) {
            fs.renameSync(path.join(saveDir, name), path.join(attic, name));
            moved++;
        }
    }
    console.log(`characters       ${moved} moved to ${attic}`);

    // ---------------------------------------------------------------- the derived rows
    const ids = players.map(a => a.id);
    // THE HISCORES GO FOR EVERYONE, staff included, which is the one place staff are not exempt.
    // They keep their characters, so a staff row on the board is months of pre-launch progress
    // ranked against players who start at nothing. updateHiscores stopped writing them at all for
    // staffmodlevel > 0 on the same day; this clears what is already there.
    const everyone = accounts.map(a => a.id);
    if (ids.length > 0) {
        const hiscores = await db.deleteFrom('hiscore').where('account_id', 'in', everyone).where('profile', '=', profile).executeTakeFirst();
        const large = await db.deleteFrom('hiscore_large').where('account_id', 'in', everyone).where('profile', '=', profile).executeTakeFirst();
        const log = await db.deleteFrom('collection_log').where('account_id', 'in', ids).where('profile', '=', profile).executeTakeFirst();
        const friends = await db.deleteFrom('friendlist').where('account_id', 'in', ids).where('profile', '=', profile).executeTakeFirst();
        const ignores = await db.deleteFrom('ignorelist').where('account_id', 'in', ids).where('profile', '=', profile).executeTakeFirst();

        console.log(`hiscore          ${hiscores?.numDeletedRows ?? 0} rows`);
        console.log(`hiscore_large    ${large?.numDeletedRows ?? 0} rows`);
        console.log(`collection_log   ${log?.numDeletedRows ?? 0} rows`);
        console.log(`friendlist       ${friends?.numDeletedRows ?? 0} rows`);
        console.log(`ignorelist       ${ignores?.numDeletedRows ?? 0} rows`);
    }

    console.log('\nDone. Start the world and log in once as a player to check the character is new and the clerk owes them their tickets.');
}

main().then(
    () => process.exit(0),
    err => {
        console.error(err);
        process.exit(1);
    }
);
