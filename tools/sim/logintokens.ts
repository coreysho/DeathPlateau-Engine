// SAVED LOGINS: the token store, on its own, without a world or a client.
//
// run_logintokentest.py in the client repo proves a real client and a real engine agree about the
// login block and the packet that comes back. What it cannot reach is everything that happens to a
// token AFTER it is issued - expiry, the cap, cancelling - because those take a month, six
// computers, or a command typed in game. This is that half: the store, driven directly.
//
// It needs no cache, no map and no world. It does need a database, and it makes its own rows and
// takes them away again:
//
//     npx tsx tools/sim/logintokens.ts
//
// THE INTERESTING RUN IS FROM AN EMPTY DIRECTORY, because that is the live server. The live deploy
// does not apply migrations - content/tools/deploy.sh runs sqlite:migrate on the --dev path only -
// so new code can land on a database with the old shape, and for this table that would be every
// login on the world failing at the first query. LoginToken.ensureTable is the answer and this is
// where it is checked:
//
//     mkdir /tmp/tokencheck && cd /tmp/tokencheck
//     npx --prefix <engine> tsx <engine>/tools/sim/logintokens.ts
//
// The db.sqlite it opens is the one in the current directory, so from an empty one there is no
// account_token table to find and ensureTable has to make it.
import { sql } from 'kysely';

import { db } from '#/db/query.js';
import LoginToken from '#/server/login/LoginToken.js';

const R = { ok: 0, bad: 0 };

function check(what: string, got: unknown, want: unknown) {
    const pass = JSON.stringify(got) === JSON.stringify(want);
    if (pass) R.ok++;
    else R.bad++;
    console.log(`  ${pass ? 'ok  ' : 'FAIL'} ${what}: ${JSON.stringify(got)}${pass ? '' : `   (want ${JSON.stringify(want)})`}`);
}

/** Was the table already there? Which tells us whether this run is testing ensureTable. */
async function tableExists(): Promise<boolean> {
    const rows = await sql<{
        name: string;
    }>`select name from sqlite_master where type = 'table' and name = 'account_token'`.execute(db);
    return rows.rows.length > 0;
}

/**
 * The account table, if this is a scratch directory. Only the columns a token needs to hang off -
 * this is not pretending to be the migration, it is giving ensureTable something to be checked
 * against.
 */
async function ensureAccounts(): Promise<void> {
    await sql`CREATE TABLE IF NOT EXISTS "account" (
        "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
        "username" TEXT NOT NULL,
        "password" TEXT NOT NULL,
        "registration_ip" TEXT,
        "registration_date" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "muted_until" DATETIME,
        "banned_until" DATETIME,
        "staffmodlevel" INTEGER NOT NULL DEFAULT 0,
        "members" BOOLEAN NOT NULL DEFAULT false
    )`.execute(db);
}

const NAMES = ['tokenprobe_a', 'tokenprobe_b'];

async function account(name: string): Promise<number> {
    await db.deleteFrom('account').where('username', '=', name).execute();
    await db.insertInto('account').values({ username: name, password: 'not-a-real-hash' }).execute();
    const row = await db.selectFrom('account').select('id').where('username', '=', name).executeTakeFirst();
    return row!.id;
}

async function rows(accountId: number): Promise<number> {
    const all = await db.selectFrom('account_token').select('id').where('account_id', '=', accountId).execute();
    return all.length;
}

async function main() {
    const had = await tableExists();
    console.log(had ? 'the table is already here (a migrated database)' : 'NO account_token table: ensureTable has to make it');
    await ensureAccounts();

    const mine = await account(NAMES[0]);
    const other = await account(NAMES[1]);
    // Anything left from an earlier run, now that there is a table to clear.
    await LoginToken.revokeAll(mine);
    await LoginToken.revokeAll(other);

    console.log('');
    console.log('1. a token is minted, stored, and accepted');
    const token = await LoginToken.issue(mine, 1234, '127.0.0.1');
    check('it is the shape the client expects', [token.length, LoginToken.looksLikeToken(token)], [20, true]);
    check('the account has one', await rows(mine), 1);
    check('and it is accepted', await LoginToken.accepts(mine, token), true);

    // THE TOKEN ITSELF IS NOT IN THE DATABASE. A leaked table should be worth nothing: the rows
    // hold a digest, so somebody reading them cannot sign in with what they read.
    const stored = await db.selectFrom('account_token').select('token_hash').where('account_id', '=', mine).executeTakeFirst();
    check('the row holds a digest, not the token', [stored!.token_hash === token, stored!.token_hash.length], [false, 64]);

    console.log('');
    console.log('2. and refused for everything else');
    check('a token this account was not given', await LoginToken.accepts(mine, 'qqqqwwwweeeerrrrtttt'), false);
    check("another account's token", await LoginToken.accepts(other, token), false);
    check('the right token on no account at all', await LoginToken.accepts(-1, token), false);
    check('something too short to be one', await LoginToken.accepts(mine, 'abc'), false);
    check('something with characters a token cannot have', await LoginToken.accepts(mine, token.toUpperCase()), false);
    check('nothing', await LoginToken.accepts(mine, ''), false);

    console.log('');
    console.log('3. using it pushes its month out');
    const before = await db.selectFrom('account_token').select('expires').where('account_id', '=', mine).executeTakeFirst();
    await db.updateTable('account_token').set({ expires: '2026-01-01 00:00:00', last_used: '2026-01-01 00:00:00' }).where('account_id', '=', mine).execute();
    check('a token past its month is refused', await LoginToken.accepts(mine, token), false);
    check('and is taken out rather than checked again every login', await rows(mine), 0);
    void before;

    console.log('');
    console.log('4. the cap, which drops the one unused longest');
    const kept: string[] = [];
    for (let i = 0; i < LoginToken.MAX_PER_ACCOUNT + 2; i++) {
        const t = await LoginToken.issue(mine, i, '127.0.0.1');
        kept.push(t);
        // Spread last_used, or the cap has nothing to order by: every row is this same second.
        await db
            .updateTable('account_token')
            .set({ last_used: `2026-10-${String(10 + i).padStart(2, '0')} 00:00:00` })
            .where('token_hash', '=', LoginToken.digest(t))
            .execute();
    }
    check('the account stops at the cap', await rows(mine), LoginToken.MAX_PER_ACCOUNT);
    check('the oldest is gone', await LoginToken.accepts(mine, kept[0]), false);
    check('and the newest is still good', await LoginToken.accepts(mine, kept[kept.length - 1]), true);

    console.log('');
    console.log('5. cancelling');
    const mineNow = await rows(mine);
    await LoginToken.issue(other, 1, '127.0.0.1');
    const count = await LoginToken.revokeAll(mine);
    check('revokeAll says how many there were', count, mineNow);
    check('the account has none left', await rows(mine), 0);
    check('every one of them is refused', await LoginToken.accepts(mine, kept[kept.length - 1]), false);
    check("and another account's are untouched", await rows(other), 1);
    check('cancelling again is not an error', await LoginToken.revokeAll(mine), 0);

    // Tidy up, so running this against a development database leaves nothing behind.
    await LoginToken.revokeAll(other);
    for (const name of NAMES) {
        await db.deleteFrom('account').where('username', '=', name).execute();
    }

    console.log('');
    console.log(`${R.ok} ok, ${R.bad} FAIL`);
    await db.destroy();
    process.exit(R.bad === 0 ? 0 : 1);
}

main();
