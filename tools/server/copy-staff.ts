/**
 * Copies the staff accounts of one world's database into this one's - for the DEV WORLD, which keeps a
 * database of its own (so nothing done there - a ::ban, a ::changepassword, a test account - reaches the
 * live world) but is staff-only (NODE_MIN_STAFF_LEVEL), and so could never let anybody in to begin with.
 *
 * Run in the dev world's engine directory, pointing at the live world's database:
 *
 *   npx tsx tools/server/copy-staff.ts /opt/deathplateau/engine/db.sqlite
 *   npx tsx tools/server/copy-staff.ts /opt/deathplateau/engine/db.sqlite --min 3
 *
 * --min defaults to this world's NODE_MIN_STAFF_LEVEL (3 if that is 0). Every account at or above it in
 * the source is written here - its password hash, staff level, members flag and ban - added if new,
 * updated if not. An account here that the source has since demoted below --min is demoted here too, so
 * taking someone off the staff on live takes them off the dev world at the next deploy. Nothing else is
 * copied: not the other accounts, not saves, friends or logs. The source is opened read-only.
 *
 * Only DB_BACKEND=sqlite. deploy.sh --dev and --dev-setup run it.
 */
import fs from 'fs';
import path from 'path';
import { DatabaseSync } from 'node:sqlite';

import Environment from '#/util/Environment.js';

let source: string | undefined;
let min = Environment.NODE_MIN_STAFF_LEVEL > 0 ? Environment.NODE_MIN_STAFF_LEVEL : 3;
const args = process.argv.slice(2);
for (let i = 0; i < args.length; i++) {
    if (args[i] === '--min') {
        min = parseInt(args[++i], 10);
    } else {
        source = args[i];
    }
}

function fail(msg: string): never {
    console.error(msg);
    process.exit(1);
}

if (!source || isNaN(min) || min < 1) {
    fail('usage: npx tsx tools/server/copy-staff.ts <source db.sqlite> [--min N]   (N at least 1)');
}
if (Environment.DB_BACKEND !== 'sqlite') {
    fail(`DB_BACKEND is ${Environment.DB_BACKEND} - this copies between sqlite databases only`);
}
if (!fs.existsSync(source)) {
    fail(`no database at ${source}`);
}
if (!fs.existsSync('db.sqlite')) {
    fail('no db.sqlite here - run it in the engine directory, after npm run sqlite:migrate');
}
if (path.resolve(source) === path.resolve('db.sqlite')) {
    fail('the source is this world\'s own database');
}

type Row = {
    username: string;
    password: string;
    staffmodlevel: number;
    members: number;
    banned_until: string | number | null;
    registration_ip: string | null;
    registration_date: string | number;
};

const from = new DatabaseSync(source, { readOnly: true });
const to = new DatabaseSync('db.sqlite');

const columns = 'username, password, staffmodlevel, members, banned_until, registration_ip, registration_date';
const staff = from.prepare(`SELECT ${columns} FROM account WHERE staffmodlevel >= ?`).all(min) as unknown as Row[];
const levelInSource = from.prepare('SELECT staffmodlevel FROM account WHERE username = ?');

const find = to.prepare('SELECT id, staffmodlevel FROM account WHERE username = ?');
const update = to.prepare('UPDATE account SET password = ?, staffmodlevel = ?, members = ?, banned_until = ? WHERE id = ?');
const insert = to.prepare(`INSERT INTO account (${columns}) VALUES (?, ?, ?, ?, ?, ?, ?)`);
const demote = to.prepare('UPDATE account SET staffmodlevel = ? WHERE id = ?');

to.exec('BEGIN');
try {
    for (const a of staff) {
        const here = find.get(a.username) as { id: number; staffmodlevel: number } | undefined;
        if (here) {
            update.run(a.password, a.staffmodlevel, a.members, a.banned_until, here.id);
            console.log(`  updated ${a.username} (level ${a.staffmodlevel})`);
        } else {
            insert.run(a.username, a.password, a.staffmodlevel, a.members, a.banned_until, a.registration_ip, a.registration_date);
            console.log(`  added   ${a.username} (level ${a.staffmodlevel})`);
        }
    }

    // staff here that the source no longer has as staff - an account only this world knows is left alone
    const staffHere = to.prepare('SELECT id, username, staffmodlevel FROM account WHERE staffmodlevel >= ?').all(min) as { id: number; username: string; staffmodlevel: number }[];
    for (const a of staffHere) {
        const there = levelInSource.get(a.username) as { staffmodlevel: number } | undefined;
        if (there && there.staffmodlevel < min) {
            demote.run(there.staffmodlevel, a.id);
            console.log(`  demoted ${a.username} (level ${a.staffmodlevel} -> ${there.staffmodlevel})`);
        }
    }
    to.exec('COMMIT');
} catch (err) {
    to.exec('ROLLBACK');
    throw err;
}

console.log(`${staff.length} staff account(s) at level ${min}+ copied from ${source}`);
from.close();
to.close();
