// Does SourceSnapshot actually report the NEWEST source file?
//
//   npx tsx tools/pack/snapshotcheck.ts
//
// It did not. The walk visits every entry concurrently, and the compare-and-set read the running
// maximum BEFORE awaiting the stat - so two files could both read the same stale value and the one
// that finished last wrote its own smaller mtime over a larger one already recorded.
//
// That matters because shouldRevalidatePackFile compares a pack file's timestamp against this. An
// under-reported maximum reads as "nothing has changed" and the revalidation is skipped whole:
// category.pack is not regenerated from the configs that define its categories, and the checks
// that catch a name sitting in a pack with nothing behind it never run. Both failures are silent.
//
// The bug was intermittent - walk order decided whether it bit - so the synthetic case below is
// built to provoke it rather than hoping: many files, with the newest one placed where it gets
// walked first and therefore has the longest window to be overwritten.
import { SourceSnapshot } from '#tools/pack/SourceSnapshot.js';
import fs from 'fs';
import os from 'os';
import path from 'path';

let ok = 0, fail = 0;
const check = (what: string, got: unknown, want: unknown) => {
    const good = JSON.stringify(got) === JSON.stringify(want);
    console.log(`  ${good ? 'ok  ' : 'FAIL'} ${what}${good ? '' : `  got ${JSON.stringify(got)} want ${JSON.stringify(want)}`}`);
    good ? ok++ : fail++;
};

/** Exactly what the snapshot claims the newest mtime is, without adding an accessor for a test. */
function reported(snap: SourceSnapshot, root: string, ext: string, candidates: number[]): number {
    // isNewer(t) is "max > t", so the max is the only value that is greater than t-1 and not t.
    for (const c of candidates) if (snap.isNewer(root, ext, c - 1) && !snap.isNewer(root, ext, c)) return c;
    return -1;
}

// ------------------------------------------------------------------ the case that used to fail
console.log('A TREE WHOSE NEWEST FILE IS WALKED FIRST');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'snapcheck-'));
const COUNT = 400;
const base = Date.now() - 1000 * 60 * 60 * 24;
const mtimes: number[] = [];
// "aaa_newest" sorts first, so it is stated first and every one of the other 399 stats resolves
// after it - each one holding a `current` of 0 if the read happens before the await.
const newest = base + 1000 * 60 * 60 * 12;
for (let i = 0; i < COUNT; i++) {
    const name = i === 0 ? 'aaa_newest.loc' : `f${String(i).padStart(4, '0')}.loc`;
    const dir = path.join(tmp, i % 7 === 0 ? 'sub' + (i % 3) : '.');
    fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, name);
    fs.writeFileSync(file, 'x');
    const m = i === 0 ? newest : base + i;
    fs.utimesSync(file, new Date(m), new Date(m));
    mtimes.push(m);
}
const want = Math.max(...mtimes);
check('  the newest file is the one planted first', want, newest);

let agreed = 0;
const RUNS = 12;
for (let i = 0; i < RUNS; i++) {
    const snap = await SourceSnapshot.create([{ path: tmp, exts: ['.loc'] }]);
    if (reported(snap, tmp, '.loc', [...mtimes].sort((a, b) => b - a)) === want) agreed++;
}
check(`  reports the newest on all ${RUNS} runs, not an arbitrary one`, agreed, RUNS);

// ------------------------------------------------------------------ an extension it was not asked for
{
    const snap = await SourceSnapshot.create([{ path: tmp, exts: ['.npc'] }]);
    check('  an extension with no files reports nothing newer than zero',
        snap.isNewer(tmp, '.npc', 0), false);
}

// ------------------------------------------------------------------ a root that is not there
console.log('\nA ROOT THAT DOES NOT EXIST');
{
    const missing = path.join(tmp, 'no', 'such', 'tree');
    let threw = false;
    let snap: SourceSnapshot | null = null;
    try {
        snap = await SourceSnapshot.create([{ path: missing, exts: ['.loc'] }]);
    } catch {
        threw = true;
    }
    // ENOENT is legitimate - not every build has every source tree - and must stay quiet. Every
    // OTHER read error now throws, because reporting 0 is indistinguishable from "up to date".
    check('  is not an error, and contributes nothing', threw, false);
    check('  and nothing is newer than zero under it', snap!.isNewer(missing, '.loc', 0), false);
}

fs.rmSync(tmp, { recursive: true, force: true });
console.log(`\n${ok + fail} checks: ${ok} ok, ${fail} FAILED`);
process.exit(fail === 0 ? 0 : 1);
