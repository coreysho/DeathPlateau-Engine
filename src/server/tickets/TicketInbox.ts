import fs from 'fs';
import { DatabaseSync } from 'node:sqlite';

import Environment from '#/util/Environment.js';

// THE TICKET INBOX (custom, 2026-09-27). How a ::bug typed in game reaches the ticket bot
// (server/tickets/TicketBot.ts).
//
// The ticket bot is its own process, not a worker of the world, so that support keeps working while
// the game is down or restarting - which is exactly when people need it. The two meet in one sqlite
// file: the world only ever INSERTs a row here, and the bot drains the rows it has not filed yet
// every few seconds. Nothing on the tick waits for Discord, and a report typed while the bot is
// offline is not lost - it is filed when the bot comes back.
//
// The bot keeps its own tables (tickets, config) in the same file; this side never touches them.

export const TICKET_DB_PATH = `data/tickets/${Environment.NODE_PROFILE}.sqlite`;

export const INBOX_SCHEMA = `
    CREATE TABLE IF NOT EXISTS inbox (
        id       INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL,
        text     TEXT NOT NULL,
        x        INTEGER NOT NULL,
        z        INTEGER NOT NULL,
        level    INTEGER NOT NULL,
        world    INTEGER NOT NULL,
        created  INTEGER NOT NULL,
        ticket   INTEGER,
        attempts INTEGER NOT NULL DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS inbox_unfiled ON inbox (ticket) WHERE ticket IS NULL;
`;

let db: DatabaseSync | null = null;

function inbox(): DatabaseSync {
    if (!db) {
        fs.mkdirSync('data/tickets', { recursive: true });
        db = new DatabaseSync(TICKET_DB_PATH);
        db.exec('PRAGMA journal_mode = WAL');
        // The bot may be mid-write. Wait a moment for it, but never long: this runs on the tick.
        db.exec('PRAGMA busy_timeout = 50');
        db.exec(INBOX_SCHEMA);
    }
    return db;
}

// Queue a bug report from the game. Returns its inbox id, or null if the file was busy or broken -
// the caller tells the player to try again.
export function queueBugReport(report: { username: string; text: string; x: number; z: number; level: number }): number | null {
    try {
        const result = inbox().prepare('INSERT INTO inbox (username, text, x, z, level, world, created) VALUES (?, ?, ?, ?, ?, ?, ?)').run(report.username, report.text, report.x, report.z, report.level, Environment.NODE_ID, Date.now());
        return Number(result.lastInsertRowid);
    } catch (err) {
        console.error('Ticket inbox: could not queue a bug report', err);
        return null;
    }
}
