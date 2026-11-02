import { createHash, randomInt } from 'crypto';
import { sql } from 'kysely';

import { db, toDbDate } from '#/db/query.js';
import Environment from '#/util/Environment.js';

/**
 * A SAVED LOGIN THAT IS NOT THE PASSWORD.
 *
 * The client offers saved accounts on the login screen, and until now what it saved was the
 * password: encrypted in ~/.deathplateau/profiles.properties, but with a key derived from values
 * any program on that machine can read, because the client has to be able to read it back without
 * asking anybody anything. Its own header says to treat a leaked file as a leaked password, and
 * that is exactly right - the obfuscation buys the careless case (a backup service indexing it, a
 * screenshare, someone glancing at the folder), not the determined one.
 *
 * So the client stores one of these instead. A token is worth one account on one computer, it can
 * be cancelled from the server without the player changing anything, and it dies on its own after
 * a month of not being used. The password never touches the disk again.
 *
 * WHAT A TOKEN IS NOT. It is not a password: nobody types it, so it needs no charset a person can
 * read out, and it needs no bcrypt. 20 characters of 36 is a shade over 103 bits, which is far
 * past anything brute-forceable, so the stored form is a plain sha256 - and that matters for more
 * than speed, because a digest can be looked up by value in one indexed query. bcrypt would mean
 * comparing a login against every row of the account, each at 100ms.
 *
 * It is not a session either. It authenticates a login and that is all; what it buys is the right
 * to start a login, exactly as the password did.
 */
export default class LoginToken {
    /**
     * 20 characters, because that is what the login block's password field holds (World's own
     * check) and because a token is carried in a field of that size. It is also what the client's
     * MAX_SECRET already allowed, so nothing in the profile store had to grow.
     */
    static readonly LENGTH = 20;

    /**
     * Lowercase and digits only. Not for readability - nobody reads it - but because the login
     * path lowercases the password it compares (`password.toLowerCase()`), and a token that
     * travelled the same way would lose a bit per letter to a change nobody would notice. An
     * alphabet with no case cannot be damaged by one.
     */
    private static readonly ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789';

    /** A month of not being used. Each use pushes it out again, so a player who plays never sees this. */
    static readonly LIFETIME_MS = 30 * 24 * 60 * 60 * 1000;

    /**
     * How many computers one account may be saved on at once. The fifth drops the one unused
     * longest - the same rule, and for the same reason, as the four cards the login screen shows.
     */
    static readonly MAX_PER_ACCOUNT = 5;

    private static ensured = false;

    /**
     * A token. randomInt is the CSPRNG, and it is asked for an index rather than handed bytes to
     * fold into the alphabet: 256 does not divide 36, so folding would make six of the characters
     * likelier than the rest and quietly cost entropy.
     */
    static mint(): string {
        let token = '';
        for (let i = 0; i < LoginToken.LENGTH; i++) {
            token += LoginToken.ALPHABET[randomInt(LoginToken.ALPHABET.length)];
        }
        return token;
    }

    /** What is stored. The token itself is never written down anywhere on this side. */
    static digest(token: string): string {
        return createHash('sha256').update(token).digest('hex');
    }

    /** Shape only, so a malformed field is refused before it reaches a query. */
    static looksLikeToken(value: string): boolean {
        if (value.length !== LoginToken.LENGTH) {
            return false;
        }
        for (const ch of value) {
            if (!LoginToken.ALPHABET.includes(ch)) {
                return false;
            }
        }
        return true;
    }

    /**
     * THE TABLE, IF THE DATABASE HAS NOT GOT IT YET.
     *
     * There is a prisma migration for this table, and the dev world applies it on every deploy.
     * The live world does not: content/tools/deploy.sh runs `npm run sqlite:migrate` only on the
     * --dev path, so a live deploy carries new code onto a database with the old shape. For most
     * tables that would be a feature nobody can reach; for this one it is every login on the
     * server failing at the first query, which is not a way to find out.
     *
     * So the sqlite path makes sure of it at startup. It is the same CREATE as the migration, and
     * IF NOT EXISTS means the migrated database is untouched. mysql is left to its migration:
     * the multiworld setup is deployed deliberately, by someone running db:migrate.
     */
    static async ensureTable(): Promise<void> {
        if (LoginToken.ensured || Environment.DB_BACKEND !== 'sqlite') {
            LoginToken.ensured = true;
            return;
        }
        await sql`CREATE TABLE IF NOT EXISTS "account_token" (
            "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
            "account_id" INTEGER NOT NULL,
            "token_hash" TEXT NOT NULL,
            "created" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "last_used" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "expires" DATETIME NOT NULL,
            "uid" INTEGER,
            "created_ip" TEXT
        )`.execute(db);
        await sql`CREATE UNIQUE INDEX IF NOT EXISTS "account_token_token_hash_key" ON "account_token"("token_hash")`.execute(db);
        await sql`CREATE INDEX IF NOT EXISTS "account_token_account_id_idx" ON "account_token"("account_id")`.execute(db);
        LoginToken.ensured = true;
    }

    /**
     * Is this token this account's? Returns false for a token that is not, has expired, or belongs
     * to somebody else - the caller gets one answer and cannot tell which, the way a password
     * check cannot.
     *
     * A successful check pushes the expiry out, so the month runs from last use rather than from
     * when the player first saved the login.
     */
    static async accepts(accountId: number, token: string): Promise<boolean> {
        if (!LoginToken.looksLikeToken(token)) {
            return false;
        }
        await LoginToken.ensureTable();

        const now = new Date();
        const row = await db.selectFrom('account_token').select(['id', 'expires']).where('account_id', '=', accountId).where('token_hash', '=', LoginToken.digest(token)).executeTakeFirst();

        if (!row) {
            return false;
        }
        if (new Date(row.expires) <= now) {
            // Done with: take it out rather than leave it to be checked again every login.
            await db.deleteFrom('account_token').where('id', '=', row.id).execute();
            return false;
        }

        await db
            .updateTable('account_token')
            .set({
                last_used: toDbDate(now),
                expires: toDbDate(new Date(now.getTime() + LoginToken.LIFETIME_MS))
            })
            .where('id', '=', row.id)
            .execute();
        return true;
    }

    /**
     * A new token for this account, to be handed to the client that just proved it knows the
     * password. The only copy is the one returned here: what goes in the table is the digest.
     */
    static async issue(accountId: number, uid: number | null, ip: string | null): Promise<string> {
        await LoginToken.ensureTable();

        const token = LoginToken.mint();
        const now = new Date();
        await db
            .insertInto('account_token')
            .values({
                account_id: accountId,
                token_hash: LoginToken.digest(token),
                created: toDbDate(now),
                last_used: toDbDate(now),
                expires: toDbDate(new Date(now.getTime() + LoginToken.LIFETIME_MS)),
                uid,
                created_ip: ip
            })
            .execute();

        // The cap, counted after the insert so the new one is in it: a player saving a login on a
        // sixth computer loses the one they have not used since, not the one they are making.
        const spare = await db.selectFrom('account_token').select('id').where('account_id', '=', accountId).orderBy('last_used', 'desc').offset(LoginToken.MAX_PER_ACCOUNT).limit(100).execute();
        if (spare.length > 0) {
            await db
                .deleteFrom('account_token')
                .where(
                    'id',
                    'in',
                    spare.map(row => row.id)
                )
                .execute();
        }

        return token;
    }

    /**
     * Cancel every saved login for the account. Called when the password changes - a player who
     * changes it because somebody else may know it has said everything about what they want to
     * happen to the logins saved under it - and by ::forgetlogins for a player who just wants to.
     *
     * Returns how many there were, so the command can say.
     */
    static async revokeAll(accountId: number): Promise<number> {
        await LoginToken.ensureTable();

        const rows = await db.selectFrom('account_token').select('id').where('account_id', '=', accountId).execute();
        if (rows.length > 0) {
            await db.deleteFrom('account_token').where('account_id', '=', accountId).execute();
        }
        return rows.length;
    }
}
