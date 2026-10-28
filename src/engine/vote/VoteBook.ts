import fs from 'fs';
import path from 'path';
import { DatabaseSync } from 'node:sqlite';

// THE VOTE LEDGER (custom, 2026-10-27). Who has voted where, and what they are still owed for it.
//
// A vote is cast on a site this server has nothing to do with, and arrives here as a claim: either
// the site calls back (src/web.ts, /vote/<site>/callback) or the player clicks Claim and the engine
// asks the site (VoteCheck.ts). Both ends finish here, at credit(), and credit() is the only thing
// that turns a vote into tickets.
//
// WHY ITS OWN DATABASE, for the same two reasons the trading post has one. A vote can be credited
// while the player is offline, and an offline player's save is a file the login server owns, so the
// tickets have to wait somewhere that is not the save - that is the `owed` table, which the game
// drains at login and at the Vote clerk. And the credit must be atomic with the duplicate check: a
// site that retries its callback, or a player who clicks Claim twice, must not be paid twice, and
// "insert if new, else do nothing" is one statement against a local file rather than a promise a
// tick cannot wait for.
//
// THE DUPLICATE KEY IS (site, ref). Every voting site gives a vote some identity - a vote id, a
// transaction id, an IP plus a timestamp - and whatever that is goes in `ref`. A site that offers
// nothing at all gets a ref synthesised from its cooldown window (see refForWindow), so the worst
// case is still one credit per cooldown rather than one per click.
//
// ONE WORLD'S LEDGER. Two worlds pointed at the same file would each think they owned it; that is
// true of the trading post too and is written down there.

/**
 * Which of the several things that all report as "unable to open database file" it actually was.
 * Checked after the failure, not before it, so this never decides whether to open - it only
 * explains. WAL needs to write `-wal` and `-shm` beside the database, so a readable file in a
 * directory it cannot write in fails too, which is why the directory is tested as well as the file.
 */
function whyNot(file: string): string {
    const dir = path.dirname(file);
    try {
        if (!fs.statSync(dir).isDirectory()) {
            return `${dir} is not a directory`;
        }
    } catch {
        return `${dir} does not exist`;
    }
    try {
        fs.accessSync(dir, fs.constants.W_OK);
    } catch {
        return `${dir} is not writable by this process`;
    }
    try {
        fs.accessSync(file, fs.constants.R_OK | fs.constants.W_OK);
    } catch (err) {
        return fs.existsSync(file) ? 'the file is there but not readable and writable' : `the file cannot be created (${err instanceof Error ? err.message : err})`;
    }
    return 'the directory and the file both look fine, so this is sqlite itself - a lock held by another process, or a filesystem that will not take a WAL database';
}

export type VoteRow = {
    id: number;
    site: string;
    ref: string;
    username: string;
    tickets: number;
    cast_at: number; // unix ms, when the site says the vote happened
    credited: number; // unix ms, when this row was written
};

export const enum CreditResult {
    /** Written. The player is owed `tickets` more than they were. */
    CREDITED = 0,
    /** This exact vote has been credited before. Nothing changed. */
    DUPLICATE = 1,
    /** The site's cooldown has not elapsed since this player's last credited vote there. */
    TOO_SOON = 2
}

export default class VoteBook {
    private readonly db: DatabaseSync;

    constructor(file: string) {
        if (file !== ':memory:') {
            fs.mkdirSync(path.dirname(file), { recursive: true });
        }
        try {
            this.db = new DatabaseSync(file);
        } catch (err) {
            // node:sqlite says "unable to open database file" and nothing else, for a missing
            // directory, a directory that is really a file, a directory it may not write in, and a
            // file it may not write to alike. That sentence arrived in a player's chatbox with no
            // way to tell which, so say which here instead of making somebody guess.
            throw new Error(`vote ledger ${path.resolve(file)}: ${whyNot(file)} (${err instanceof Error ? err.message : err})`, { cause: err });
        }
        this.db.exec('PRAGMA journal_mode = WAL');
        this.db.exec('PRAGMA synchronous = FULL');
        this.db.exec(`
            -- One row per credited vote. Append-only: nothing here is ever updated or deleted, so
            -- it doubles as the audit trail when somebody asks why they were or were not paid.
            CREATE TABLE IF NOT EXISTS vote (
                id       INTEGER PRIMARY KEY AUTOINCREMENT,
                site     TEXT    NOT NULL,
                ref      TEXT    NOT NULL,
                username TEXT    NOT NULL,
                tickets  INTEGER NOT NULL,
                cast_at  INTEGER NOT NULL,
                credited INTEGER NOT NULL,
                UNIQUE (site, ref)
            );
            CREATE INDEX IF NOT EXISTS vote_who ON vote (username, site, cast_at);

            -- What a player has been credited but not yet been handed. The game empties this into
            -- the inventory through ~vote_grant_tickets; see content/scripts/vote.
            CREATE TABLE IF NOT EXISTS owed (
                username TEXT    PRIMARY KEY,
                tickets  INTEGER NOT NULL
            );
        `);
    }

    close() {
        this.db.close();
    }

    /**
     * Record a vote and add its tickets to what the player is owed, unless this vote has been seen
     * before or the site's cooldown has not elapsed. Both halves happen in one transaction.
     *
     * `cooldownMs` of 0 turns the cooldown check off, which is what a site callback wants: the site
     * has already decided the vote counts, and second-guessing it with our own clock is how a
     * genuine vote gets refused because the two machines disagree about the time.
     */
    credit(site: string, ref: string, username: string, tickets: number, castAt: number, cooldownMs = 0): CreditResult {
        const who = username.toLowerCase();
        this.db.exec('BEGIN IMMEDIATE');
        try {
            if (cooldownMs > 0) {
                const last = this.db.prepare('SELECT MAX(cast_at) AS cast_at FROM vote WHERE site = ? AND username = ?').get(site, who) as { cast_at: number | null } | undefined;
                if (last && last.cast_at !== null && castAt - last.cast_at < cooldownMs) {
                    this.db.exec('ROLLBACK');
                    return CreditResult.TOO_SOON;
                }
            }
            const now = Date.now();
            const ins = this.db.prepare('INSERT OR IGNORE INTO vote (site, ref, username, tickets, cast_at, credited) VALUES (?, ?, ?, ?, ?, ?)').run(site, ref, who, tickets, castAt, now);
            if (ins.changes === 0) {
                this.db.exec('ROLLBACK');
                return CreditResult.DUPLICATE;
            }
            this.db.prepare('INSERT INTO owed (username, tickets) VALUES (?, ?) ON CONFLICT (username) DO UPDATE SET tickets = tickets + ?').run(who, tickets, tickets);
            this.db.exec('COMMIT');
            return CreditResult.CREDITED;
        } catch (err) {
            this.db.exec('ROLLBACK');
            throw err;
        }
    }

    /** Tickets credited and not yet handed over. */
    owed(username: string): number {
        const row = this.db.prepare('SELECT tickets FROM owed WHERE username = ?').get(username.toLowerCase()) as { tickets: number } | undefined;
        return row?.tickets ?? 0;
    }

    /**
     * Take up to `want` tickets off what the player is owed, and return how many were actually
     * taken. Never returns more than is there, so a caller that hands out what it is given cannot
     * hand out tickets nobody earned.
     */
    take(username: string, want: number): number {
        if (want < 1) {
            return 0;
        }
        const who = username.toLowerCase();
        this.db.exec('BEGIN IMMEDIATE');
        try {
            const row = this.db.prepare('SELECT tickets FROM owed WHERE username = ?').get(who) as { tickets: number } | undefined;
            const have = row?.tickets ?? 0;
            const took = Math.min(have, want);
            if (took > 0) {
                if (took === have) {
                    this.db.prepare('DELETE FROM owed WHERE username = ?').run(who);
                } else {
                    this.db.prepare('UPDATE owed SET tickets = tickets - ? WHERE username = ?').run(took, who);
                }
            }
            this.db.exec('COMMIT');
            return took;
        } catch (err) {
            this.db.exec('ROLLBACK');
            throw err;
        }
    }

    /** When this player's last credited vote on this site was cast, or 0. */
    lastVote(site: string, username: string): number {
        const row = this.db.prepare('SELECT MAX(cast_at) AS cast_at FROM vote WHERE site = ? AND username = ?').get(site, username.toLowerCase()) as { cast_at: number | null } | undefined;
        return row?.cast_at ?? 0;
    }

    /** Every credited vote for a player, newest first. For a staff lookup, and for the tests. */
    history(username: string, limit = 20): VoteRow[] {
        return this.db.prepare('SELECT * FROM vote WHERE username = ? ORDER BY cast_at DESC LIMIT ?').all(username.toLowerCase(), limit) as unknown as VoteRow[];
    }

    /**
     * The ref to use for a site that gives a vote no identity of its own: the cooldown window the
     * vote falls in. Two claims inside one window produce the same ref, so the second is a
     * DUPLICATE rather than a second payment, which is the behaviour a site with no vote id can
     * still be held to.
     */
    static refForWindow(username: string, at: number, cooldownMs: number): string {
        const window = cooldownMs > 0 ? Math.floor(at / cooldownMs) : at;
        return `w:${username.toLowerCase()}:${window}`;
    }
}
