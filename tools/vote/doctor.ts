// WHY THE VOTE LEDGER WILL NOT OPEN.
//
//   npm run vote:doctor
//
// node:sqlite answers every one of these with the same five words - "unable to open database file"
// - and no path: a missing directory, a directory that is really a file, a directory the process
// may not write in, a file it may not write to, a lock held by something else, and a filesystem
// that will not carry a WAL database. On 28 October that sentence arrived in a player's chatbox
// with no way to tell which of them it was, and from the other side of the internet there was no
// way to find out. This is the thing to run ON THE MACHINE.
//
// It does what the engine does, in the order the engine does it, and says what happened at each
// step: where it is running from, what it resolves the ledger path to, what every directory on the
// way there is, whether a file can be made in it at all, and then the four sqlite steps - open,
// WAL, write, read. The first FAIL is the answer.
//
// It writes only to a probe file it deletes and to the ledger itself, which it leaves exactly as it
// found it: the table it makes is dropped, and a ledger that did not exist before is removed.
import fs from 'fs';
import os from 'os';
import path from 'path';
import { DatabaseSync } from 'node:sqlite';

import Environment from '#/util/Environment.js';

let bad = 0;

function ok(label: string, detail = '') {
    console.log(`  ok    ${label}${detail ? '  ' + detail : ''}`);
}

function fail(label: string, err: unknown) {
    bad++;
    const e = err as NodeJS.ErrnoException;
    const code = e?.code ? ` [${e.code}]` : '';
    console.log(`  FAIL  ${label}${code}  ${e instanceof Error ? e.message : String(err)}`);
}

// The engine's own line, so this cannot drift from it: VoteService.ledger().
const file = Environment.VOTE_LEDGER || `data/vote/${Environment.NODE_PROFILE}.sqlite`;
const resolved = path.resolve(file);
const dir = path.dirname(resolved);
const existed = fs.existsSync(resolved);

console.log('WHERE');
console.log(`  node            ${process.version} on ${process.platform}`);
console.log(`  running as      ${os.userInfo().username}${process.getuid ? ` (uid ${process.getuid()})` : ''}`);
console.log(`  working dir     ${process.cwd()}`);
console.log(`  NODE_PROFILE    ${Environment.NODE_PROFILE}`);
console.log(`  VOTE_LEDGER     ${Environment.VOTE_LEDGER || '(unset, so the path below is the default)'}`);
console.log(`  ledger          ${resolved}`);
console.log(`  exists already  ${existed ? 'yes' : 'no'}`);
// WHICH FILESYSTEM IT IS ON. Permissions are not the only thing that stops a write, and on a
// server running as root they are the LEAST likely thing: root walks past a mode, and does not
// walk past a read-only mount. A world under a systemd unit with ProtectSystem=strict, or in a
// container with a read-only volume, sees a directory that looks perfectly writable and cannot
// make a file in it. The mount's own options say so in one line.
try {
    const mounts = fs
        .readFileSync('/proc/mounts', 'utf8')
        .trim()
        .split('\n')
        .map(l => l.split(' '));
    let best: string[] | null = null;
    for (const m of mounts) {
        const point = m[1].replace(/\\040/g, ' ');
        const prefix = point.endsWith('/') ? point : point + '/';
        if ((resolved + '/').startsWith(prefix) && (!best || point.length > best[1].length)) {
            best = m;
        }
    }
    if (best) {
        const opts = best[3].split(',');
        console.log(`  filesystem      ${best[2]} on ${best[1]} (${best[0]}), ${opts.slice(0, 4).join(',')}`);
        if (opts.includes('ro')) {
            bad++;
            console.log('  FAIL            that filesystem is mounted READ-ONLY. Root does not get past that.');
        }
        if (/^(nfs|cifs|smb|fuse)/.test(best[2])) {
            bad++;
            console.log(`  FAIL            ${best[2]} is a network filesystem, and sqlite will not carry a WAL`);
            console.log('                  database on one. Put the ledger on local disk with VOTE_LEDGER.');
        }
    }
} catch {
    // Not Linux, or no /proc. Nothing to say rather than something wrong.
}
if (/onedrive|dropbox|google ?drive|icloud/i.test(resolved)) {
    console.log('  NOTE            that path is inside a file-syncing folder. Those hold handles open and');
    console.log('                  replace files underneath a process, which sqlite will not survive. Set');
    console.log('                  VOTE_LEDGER to somewhere outside it.');
}

// EVERY DIRECTORY ON THE WAY, not just the last one. A world started from the wrong place makes a
// data/vote under the wrong parent, and the only way to see that is to be told the whole path.
console.log('\nTHE PATH TO IT');
{
    const parts: string[] = [];
    let at = dir;
    while (true) {
        parts.unshift(at);
        const up = path.dirname(at);
        if (up === at) {
            break;
        }
        at = up;
    }
    for (const part of parts) {
        try {
            const st = fs.statSync(part);
            if (!st.isDirectory()) {
                fail(part, new Error('is not a directory - something on the path is a file'));
                continue;
            }
            try {
                fs.accessSync(part, fs.constants.W_OK);
                ok(part, 'directory, writable');
            } catch {
                fail(part, new Error('directory, NOT writable by this process'));
            }
        } catch (err) {
            fail(part, err);
        }
    }
}

// CAN A FILE BE MADE THERE AT ALL. Antivirus and folder redirection both refuse the create while
// leaving the directory looking perfectly writable to accessSync.
console.log('\nMAKING A FILE THERE');
{
    const probe = path.join(dir, `.votedoctor-${process.pid}`);
    try {
        fs.mkdirSync(dir, { recursive: true });
        ok('the directory is there (made it if it was not)');
    } catch (err) {
        fail('creating the directory', err);
    }
    // The ledger path being a DIRECTORY is the one cause that leaves every check above green and
    // only shows up as sqlite's five words, so it is worth naming on its own.
    if (existed) {
        try {
            const st = fs.statSync(resolved);
            if (st.isDirectory()) {
                fail(path.basename(resolved), new Error('is a DIRECTORY, and the ledger needs to be a file there'));
            } else {
                fs.accessSync(resolved, fs.constants.R_OK | fs.constants.W_OK);
                ok('the ledger file is readable and writable', `${st.size} bytes`);
            }
        } catch (err) {
            fail('the ledger file', err);
        }
    }
    try {
        fs.writeFileSync(probe, 'probe');
        fs.readFileSync(probe);
        fs.unlinkSync(probe);
        ok('a file can be created, written, read and deleted there');
    } catch (err) {
        fail('creating a probe file', err);
        try {
            fs.unlinkSync(probe);
        } catch {
            /* it was never made */
        }
    }
}

// AND THEN SQLITE, one step at a time, because WAL is a separate thing that can fail on its own:
// it needs to create <ledger>-wal and -shm beside the database, which a read-only directory or a
// network share will refuse after the open has already succeeded.
console.log('\nSQLITE');
{
    let db: DatabaseSync | null = null;
    try {
        db = new DatabaseSync(resolved);
        ok('open');
    } catch (err) {
        fail('open', err);
    }
    if (db) {
        try {
            db.exec('PRAGMA journal_mode = WAL');
            ok('PRAGMA journal_mode = WAL');
        } catch (err) {
            fail('PRAGMA journal_mode = WAL', err);
        }
        try {
            db.exec('CREATE TABLE IF NOT EXISTS votedoctor (x INTEGER)');
            db.exec('INSERT INTO votedoctor (x) VALUES (1)');
            const row = db.prepare('SELECT COUNT(*) AS n FROM votedoctor').get() as { n: number };
            db.exec('DROP TABLE votedoctor');
            ok('write and read back', `${row.n} row`);
        } catch (err) {
            fail('write and read back', err);
        }
        try {
            db.close();
        } catch {
            /* nothing useful to say about a close that fails */
        }
    }
    // Leave it as it was found. A ledger that already existed keeps all of its votes - nothing
    // above touched the vote or owed tables.
    if (!existed) {
        for (const leftover of [resolved, `${resolved}-wal`, `${resolved}-shm`]) {
            try {
                fs.unlinkSync(leftover);
            } catch {
                /* it was never made */
            }
        }
    }
}

console.log(bad === 0 ? '\nThe ledger opens here. If the world still cannot, it is not running as this user or from this directory.' : `\n${bad} problem(s). The FIRST one is the cause; the rest follow from it.`);
process.exit(bad ? 1 : 0);
