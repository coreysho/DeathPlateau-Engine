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
// AND THE SECOND HALF: CAN A CLIENT WITH AN OLDER COPY TELL? Models, animations, music and maps
// do not come down with the archives. A client keeps its own copy of each and decides whether to
// keep it by comparing the two bytes it stores on the end against map_version/model_version and the
// crc over the rest against map_crc/model_crc, both read out of the versionlist. So the versionlist
// is the only thing that tells a client its copy has gone out of date, and a versionlist that
// advertises what the previous build packed is a cache no client can heal from: it keeps last
// build's walls, floors and models and goes on keeping them through every restart, because by the
// only test it has they are current. "Clear your cache" is then the only fix, and it is not one you
// can give several hundred people.
//
// It has happened once already, and silently: FileStream.read used to answer the crc pass from the
// bytes it had cached before the write, so every file that changed went into the versionlist under
// its previous crc (see the note at the end of FileStream.write). Nothing in the build noticed. The
// guard in packClientVersionList that skips the whole pass when no source looks newer can lose the
// same way round. Both end as the same four bytes being wrong, so this checks the four bytes rather
// than the reasons: for every on-demand file, is what the versionlist says about it what the cache
// actually holds? One pass, about a second.
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
import Jagfile from '#/io/Jagfile.js';
import Packet from '#/io/Packet.js';

/** idx0's nine entries. File 0 is unused, and the other eight are the jagfiles by name. */
const ARCHIVES: readonly string[] = ['', 'title', 'config', 'interface', 'media', 'versionlist', 'textures', 'wordenc', 'sounds'];

/** What each idx file holds, for a message that says what a player would have lost. */
const INDEXES: readonly string[] = ['archives', 'models', 'animations', 'music', 'maps'];

/**
 * The four on-demand archives and the versionlist entries that describe them. The index is the idx
 * file they live in; the client numbers the same four 0-3 and offsets by one to reach the cache.
 */
const ONDEMAND: readonly { what: string; version: string; crc: string; index: number }[] = [
    { what: 'model', version: 'model_version', crc: 'model_crc', index: 1 },
    { what: 'animation', version: 'anim_version', crc: 'anim_crc', index: 2 },
    { what: 'music', version: 'midi_version', crc: 'midi_crc', index: 3 },
    { what: 'map', version: 'map_version', crc: 'map_crc', index: 4 }
];

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
 * Does the versionlist describe the cache it shipped with? Every on-demand file, checked the way a
 * client checks its own copy - the version in its last two bytes and the crc over everything
 * before them, against what the versionlist advertises for it. One line per file that disagrees.
 *
 * Reads the versionlist out of the cache rather than off disk at data/pack/client/versionlist,
 * because the copy in the cache is the one the web server hands out.
 */
export function checkVersionList(dir: string = 'data/pack'): string[] {
    const cache = new FileStream(dir, false, true);
    // As above: this walks the whole 31MB and none of it is wanted afterwards.
    cache.discardPacked = true;

    const complaints: string[] = [];
    try {
        const packed = cache.read(0, 5);
        if (!packed) {
            // checkClientCache already complains about a missing archive by name, and without it
            // there is nothing here to compare against.
            return complaints;
        }

        const versionlist = new Jagfile(new Packet(packed));

        for (const group of ONDEMAND) {
            const versions = versionlist.read(group.version);
            const crcs = versionlist.read(group.crc);
            if (!versions || !crcs) {
                complaints.push(`the versionlist has no ${group.version}/${group.crc} - no ${group.what} can be checked by a client at all`);
                continue;
            }

            const advertised = versions.length / 2;
            const count = cache.count(group.index);
            if (count > advertised) {
                complaints.push(`${count - advertised} ${group.what} file(s) are packed past the end of ${group.version} - a client is never told they exist`);
            }

            for (let file = 0; file < advertised; file++) {
                const version = versions.g2();
                // getcrc returns a signed int and g4 reads an unsigned one, so narrow both before
                // comparing them. Skip this and every crc with its top bit set reads as wrong -
                // which is half of them, and looks exactly like a thoroughly broken build.
                const crc = crcs.g4() | 0;

                const data = cache.read(group.index, file);

                if (!data) {
                    if (version !== 0) {
                        complaints.push(`${group.what} ${file} is advertised at version ${version} but is not packed - a client will ask for it on every login and never be given it`);
                    }
                    continue;
                }

                if (version === 0) {
                    // Version 0 is how the versionlist says "there is no such file", and the
                    // client's request() returns on it before it asks for anything.
                    complaints.push(`${group.what} ${file} is packed but advertised at version 0 - a client will never request it`);
                    continue;
                }

                const held = ((data[data.length - 2] & 0xff) << 8) | (data[data.length - 1] & 0xff);
                const actual = Packet.getcrc(data, 0, data.length - 2) | 0;
                if (held !== version || actual !== crc) {
                    complaints.push(`${group.what} ${file} is advertised as version ${version} crc ${crc} but the cache holds version ${held} crc ${actual} - a client that already has the old one will keep it`);
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
    const complaints = [...checkClientCache(dir), ...checkVersionList(dir)];
    if (complaints.length === 0) {
        return;
    }

    for (const line of complaints) {
        console.error(`  ${line}`);
    }
    throw new Error(
        `${complaints.length} problem(s) with the cache in ${dir}. ` +
            'Two builds writing one checkout at the same time will leave files that cannot be read back; ' +
            'a versionlist describing an earlier build leaves files no client can tell are stale. ' +
            `Delete ${dir} and build again - a rebuild from nothing is a minute and a half.`
    );
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

    // AND THE VERSIONLIST HALF. Three models, a versionlist that describes them, then each of the
    // three ways a build can describe them wrongly. The crc case is the one that has actually
    // happened; the other two are the same four bytes read the other way round.
    const vdir = fs.mkdtempSync(path.join(os.tmpdir(), 'cachecheck-vl-'));

    /** A cache holding `models` as idx1, and a versionlist advertising `advertise` for them. */
    const build = (models: Uint8Array[], advertise: { version: number; crc: number }[]) => {
        const built = new FileStream(vdir, true);
        for (let file = 1; file < ARCHIVES.length; file++) {
            if (file !== 5) {
                built.write(0, file, new Uint8Array(600).fill(file));
            }
        }
        for (let id = 0; id < models.length; id++) {
            built.write(1, id, models[id], 1);
        }

        const jag = Jagfile.new(true);
        const version = new Packet(new Uint8Array(advertise.length * 2));
        const crc = new Packet(new Uint8Array(advertise.length * 4));
        for (const entry of advertise) {
            version.p2(entry.version);
            crc.p4(entry.crc);
        }
        jag.write('model_version', version);
        jag.write('model_crc', crc);
        // The other three tables have to be there to be read, and one entry advertising nothing is
        // the smallest honest thing to put in them.
        for (const name of ['anim', 'midi', 'map']) {
            const emptyVersion = new Packet(new Uint8Array(2));
            emptyVersion.p2(0);
            const emptyCrc = new Packet(new Uint8Array(4));
            emptyCrc.p4(0);
            jag.write(`${name}_version`, emptyVersion);
            jag.write(`${name}_crc`, emptyCrc);
        }

        const out = path.join(vdir, 'versionlist.jag');
        jag.save(out);
        built.write(0, 5, fs.readFileSync(out));
        built.close();
        fs.rmSync(out);
    };

    const models = [new Uint8Array(900).fill(11), new Uint8Array(900).fill(22), new Uint8Array(900).fill(33)];
    const truth = models.map(data => ({ version: 1, crc: Packet.getcrc(data, 0, data.length) }));

    build(models, truth);
    check('a versionlist describing its own cache is accepted', checkVersionList(vdir), []);

    // THE ONE THAT HAPPENED: the file changed, the versionlist kept the crc of what it replaced.
    const stale = truth.map((entry, id) => (id === 1 ? { version: 1, crc: Packet.getcrc(models[0], 0, models[0].length) } : entry));
    build(models, stale);
    check("a file advertised under another build's crc is caught", checkVersionList(vdir).length, 1);
    check('and it names the file and both crcs', /^model 1 is advertised as version 1 crc -?\d+ but the cache holds version 1 crc -?\d+ /.test(checkVersionList(vdir)[0]), true);

    // Packed, but advertised as not existing - the client's request() returns before it asks.
    build(
        models,
        truth.map((entry, id) => (id === 2 ? { version: 0, crc: 0 } : entry))
    );
    check('a packed file advertised at version 0 is caught', checkVersionList(vdir), ['model 2 is packed but advertised at version 0 - a client will never request it']);

    // Advertised, but not there - the client asks on every login and is refused every time.
    build(models.slice(0, 2), truth);
    check('a file advertised but not packed is caught', checkVersionList(vdir), ['model 2 is advertised at version 1 but is not packed - a client will ask for it on every login and never be given it']);

    fs.rmSync(vdir, { recursive: true, force: true });

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
    const complaints = [...checkClientCache(dir), ...checkVersionList(dir)];
    for (const line of complaints) {
        console.log(`  ${line}`);
    }
    console.log(complaints.length === 0 ? `${dir}: every file reads back, and the versionlist describes all of them` : `${dir}: ${complaints.length} problem(s) a client could not get past`);
    process.exit(complaints.length === 0 ? 0 : 1);
}
