// IS THE CACHE THE BUILD JUST WROTE ONE A CLIENT CAN READ?
//
//   npx tsx tools/pack/CacheCheck.ts
//
// and it runs at the end of every build, because a corrupt pack does not announce itself.
//
// HOW ONE HAPPENED. main_file_cache.dat is append-only, and write() picks its first block as
// (length + 519) / 520 - the end of the file as it stands. Two builds against one checkout both
// read the same end and write their blocks into each other's, so each file's chain now runs through
// blocks belonging to the other. Nothing fails while that happens. There is no error, no short
// write, and both builds finish saying they packed everything.
//
// WHAT IT LOOKS LIKE AFTERWARDS, which is the reason this file exists. The engine builds the crc
// table it serves from OnDemand.cache.read(0, i), and a chain that does not deliver reads as
// nothing, so the entry is left 0. The client asks for /config0, the web server has no archive with
// that crc and 404s, and the client sits at 30% on "Connection error". Every visible symptom is
// about the network. It cost most of a day: four runs of the login harness, the engine, the ports
// and the client's jaggrab fallback all searched before anybody read the four bytes the cache was
// returning.
//
// A CHECK, NOT A REIMPLEMENTATION. FileStream.read is the engine's own reader and it makes exactly
// the comparisons the client makes on every block - file id, chunk number, index number - and
// returns null when one of them disagrees. So this reads every file through it, from a fresh handle
// (an instance that has already written caches what it wrote, which would answer from memory and
// prove nothing), and complains about the files whose index entry claims them but whose chain will
// not give them back. A file with no index entry at all is not corruption: pack id ranges have
// gaps on purpose.
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

import FileStream from '#/io/FileStream.js';

/** idx0's nine entries. File 0 is unused, and the other eight are the jagfiles by name. */
const ARCHIVES: readonly string[] = ['', 'title', 'config', 'interface', 'media', 'versionlist', 'textures', 'wordenc', 'sounds'];

/** What each idx file holds, for a message that says what a player would have lost. */
const INDEXES: readonly string[] = ['archives', 'models', 'animations', 'music', 'maps'];

/**
 * Every file in the cache, read the way the client reads it. Returns one line per complaint, so a
 * caller can print them all rather than stopping at the first.
 */
export function checkClientCache(dir: string = 'data/pack'): string[] {
    const cache = new FileStream(dir, false, true);
    // Or the 31MB this reads stays in memory, held by the very object doing the reading.
    cache.discardPacked = true;

    const complaints: string[] = [];
    try {
        for (let index = 0; index < INDEXES.length; index++) {
            const count = cache.count(index);
            for (let file = 0; file < count; file++) {
                const named = index === 0 ? `${ARCHIVES[file]} (file ${file})` : `${INDEXES[index]} file ${file}`;

                if (!cache.has(index, file)) {
                    // Nothing claims to be here. Expected everywhere but idx0, where all eight are
                    // wanted: a missing archive is a crc of 0 and a client that cannot start.
                    if (index === 0 && file > 0) {
                        complaints.push(`${named} is not in the cache at all - the engine will serve crc 0 for it`);
                    }
                    continue;
                }

                if (!cache.read(index, file)) {
                    complaints.push(`${named} has an index entry but its blocks do not read back`);
                }
            }
        }
    } finally {
        cache.close();
    }

    return complaints;
}

/**
 * The same, as the build wants it: say so and throw. The build stopping is the point - a pack that
 * is served broken costs far more than one that was never finished, because the symptoms all point
 * away from it.
 */
export function assertClientCache(dir: string = 'data/pack'): void {
    const complaints = checkClientCache(dir);
    if (complaints.length === 0) {
        return;
    }

    for (const line of complaints) {
        console.error(`  ${line}`);
    }
    throw new Error(`${complaints.length} file(s) in ${dir} cannot be read back. ` + 'Two builds writing one checkout at the same time will do this. ' + `Delete ${dir} and build again - a rebuild from nothing is a minute and a half.`);
}

/**
 * DOES THE CHECK ACTUALLY CATCH ONE?
 *
 *   npx tsx tools/pack/CacheCheck.ts --prove
 *
 * A check that only ever says "fine" is worth nothing, and the failure it is for cannot be
 * provoked to order - it needs two builds colliding. So: pack a small cache, break it the way a
 * collision breaks one (a block that belongs to another file's chain), and see what is said.
 */
function prove(): number {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cachecheck-'));
    let ok = 0;
    let bad = 0;
    const check = (what: string, got: unknown, want: unknown) => {
        const good = JSON.stringify(got) === JSON.stringify(want);
        console.log(`  ${good ? 'ok  ' : 'FAIL'} ${what}${good ? '' : `   got ${JSON.stringify(got)} want ${JSON.stringify(want)}`}`);
        if (good) ok++;
        else bad++;
    };

    // All eight, each over 512 bytes so every one of them spans several blocks - a single-block
    // file has no chain to break.
    const cache = new FileStream(dir, true);
    for (let file = 1; file < ARCHIVES.length; file++) {
        cache.write(0, file, new Uint8Array(3000).fill(file));
    }
    cache.close();

    check('a cache straight out of the packer is readable', checkClientCache(dir), []);

    // THE COLLISION, IN ONE BYTE. Every block carries the file and chunk it belongs to, and an
    // interleaved write leaves blocks whose headers name the other build's file. Rewriting the
    // chunk number of config's second block is the same disagreement the client would meet.
    const dat = path.join(dir, 'main_file_cache.dat');
    const idx = fs.readFileSync(path.join(dir, 'main_file_cache.idx0'));
    const start = (idx[2 * 6 + 3] << 16) | (idx[2 * 6 + 4] << 8) | idx[2 * 6 + 5];
    const bytes = fs.readFileSync(dat);
    const second = (start + 1) * 520;
    check('the block being broken is the one that said chunk 1', bytes[second + 3], 1);
    bytes[second + 3] = 84;
    fs.writeFileSync(dat, bytes);

    check('a chain running through the wrong block is caught', checkClientCache(dir), ['config (file 2) has an index entry but its blocks do not read back']);

    // And the other half of it: the entry the engine reads to build its crc table, gone.
    bytes[second + 3] = 1;
    fs.writeFileSync(dat, bytes);
    const idx0 = path.join(dir, 'main_file_cache.idx0');
    const table = fs.readFileSync(idx0);
    table.fill(0, 3 * 6, 4 * 6);
    fs.writeFileSync(idx0, table);
    check('an archive with no entry at all is caught', checkClientCache(dir), ['interface (file 3) is not in the cache at all - the engine will serve crc 0 for it']);

    fs.rmSync(dir, { recursive: true, force: true });
    console.log('');
    console.log(`${ok} ok, ${bad} FAIL`);
    return bad === 0 ? 0 : 1;
}

// Runnable on its own, for looking at a cache without building one.
if (process.argv[1] && process.argv[1] === fileURLToPath(import.meta.url)) {
    if (process.argv[2] === '--prove') {
        process.exit(prove());
    }

    const dir = process.argv[2] ?? 'data/pack';
    const complaints = checkClientCache(dir);
    for (const line of complaints) {
        console.log(`  ${line}`);
    }
    console.log(complaints.length === 0 ? `${dir}: every file reads back` : `${dir}: ${complaints.length} file(s) a client could not read`);
    process.exit(complaints.length === 0 ? 0 : 1);
}
