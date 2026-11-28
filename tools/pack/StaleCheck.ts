// A SOURCE FILE THAT HAS GONE MAKES NOTHING NEWER.
//
//   npx tsx tools/pack/StaleCheck.ts
//
// Every staleness check in the packer asks "is any source newer than the output". A DELETED source
// cannot answer yes to that: the maximum mtime stays where it was, or drops, and "nothing is newer
// than the output" is also exactly what "up to date" looks like. So the build printed its timing,
// did nothing, and left the previous output in place.
//
// Measured on 377-wip before the guard, deleting interface_bank/scripts/bank_booth.rs2 outright:
//
//   normal build  3.1s   script.dat md5 UNCHANGED      <- six dead options still in the cache
//   with guard   19.8s   script.dat md5 changed
//   restored     19.2s   md5 back to the original
//
// DeathPlateau-Bugs#81, which also has the other shape it takes: three lines of npc config edited
// and read back as the OLD value, with a sim passing 16 of 16 against the stale pack.
//
// WHAT THIS CHECKS, and why it is not an end-to-end build. Driving a real build means a real
// source tree - and deleting a file out of the content repo to prove a point is a thing that can
// be interrupted half way. So this exercises the guard itself over a temp tree, which is the same
// code the build runs, and then reads PackFile.ts to check that every predicate still ASKS it
// before its early returns. That second half is the one that matters: the first version of this
// guard was correct and still rebuilt everything on every build, because the callers short-circuit
// and the questions behind the short circuit were never asked.
import fs from 'fs';
import os from 'os';
import path from 'path';

import { didStateChange, clearFsCache } from '#tools/pack/FsCache.js';
import { sourceSetState } from '#tools/pack/PackFile.js';

const R = { ok: 0, bad: 0 };
function check(what: string, got: unknown, want: unknown) {
    const pass = JSON.stringify(got) === JSON.stringify(want);
    if (pass) {
        R.ok++;
        console.log(`  ok   ${what}: ${JSON.stringify(got)}`);
    } else {
        R.bad++;
        console.log(`FAIL   ${what}: ${JSON.stringify(got)}   (want ${JSON.stringify(want)})`);
    }
}

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'stalecheck-'));
const tree = path.join(tmp, 'scripts');
const stamp = path.join(tmp, 'stamp.txt');
const ROOTS = [{ path: tree, exts: ['.rs2', '.npc'] }];

fs.mkdirSync(path.join(tree, 'nested'), { recursive: true });
const write = (rel: string) => fs.writeFileSync(path.join(tree, rel), '// ' + rel);
/** The listings are cached, so a test that edits the tree has to drop the cache as a build would. */
const ask = () => {
    clearFsCache();
    return didStateChange(stamp, sourceSetState(ROOTS));
};

write('a.rs2');
write('b.rs2');
write(path.join('nested', 'c.rs2'));
write('d.npc');

console.log('\n================ THE FIRST ASK IS ALWAYS A CHANGE');
// No stamp yet, so there is nothing to have been the same as. A fresh clone rebuilds, which is
// what it should do.
check('with no stamp written yet', ask(), true);

console.log('\n================ AND THEN IT SETTLES');
// THE FAILURE THAT COST THE FIRST ATTEMPT. A digest that is not stable over an unchanged tree
// reads as "the source set changed" every single build - 17s warm against 3s - so this is as
// important as the detection itself.
check('an unchanged tree is not a change', ask(), false);
check('...and still is not, asked again', ask(), false);

console.log('\n================ A DELETED FILE IS A CHANGE');
// THE WHOLE POINT. Nothing here got newer.
fs.unlinkSync(path.join(tree, 'b.rs2'));
check('deleting a source file is noticed', ask(), true);
check('...and the new set then settles', ask(), false);

console.log('\n================ IN A SUBDIRECTORY TOO');
// The packer walks recursively, so a guard that only watched the top level would miss most of the
// tree - scripts/ is nested several deep everywhere.
fs.unlinkSync(path.join(tree, 'nested', 'c.rs2'));
check('deleting a nested source file is noticed', ask(), true);
check('...and settles', ask(), false);

console.log('\n================ ADDING AND RENAMING, WHICH ARE THE SAME SHAPE');
write('e.rs2');
check('adding a file is noticed', ask(), true);
fs.renameSync(path.join(tree, 'e.rs2'), path.join(tree, 'f.rs2'));
// A RENAME KEEPS THE mtime, so the old name going and the new name arriving is the only trace.
check('renaming a file is noticed', ask(), true);
check('...and settles', ask(), false);

console.log('\n================ EVERY EXTENSION, NOT JUST THE FIRST');
// The roots carry a list of extensions and the digest covers all of them. A guard that stopped at
// the first would leave .npc, .obj and the rest unwatched - and the config half of #81 was a .npc
// edit, not a script.
fs.unlinkSync(path.join(tree, 'd.npc'));
check('deleting a file of the second extension is noticed', ask(), true);
check('...and settles', ask(), false);

console.log('\n================ CONTENTS ARE NOT ITS BUSINESS');
// mtime comparison already covers an edit. If this fired on content too it would repack the whole
// tree on every ordinary edit, which is what the mtime checks are for.
fs.writeFileSync(path.join(tree, 'a.rs2'), '// changed, same name');
check('editing a file is not a set change', ask(), false);

console.log('\n================ AND NO PREDICATE MAY ASK IT BEHIND A SHORT CIRCUIT');
// THE REGRESSION THAT MATTERS MOST, and the reason the guard is one memoised flag rather than a
// stamp per pack. didStateChange writes as it reads, so a predicate that asks only after deciding
// to rebuild for some other reason leaves the old set recorded - and shouldBuildFromScripts loops
// nine extensions returning on the first YES, while shouldRunServerCompiler is a chain of `||`.
// The first version rebuilt everything on every build for exactly that reason.
//
// Read out of the source, because there is no way to observe "it was asked first" from outside.
const src = fs.readFileSync('tools/pack/PackFile.ts', 'utf8');
for (const fn of ['function shouldRevalidatePackFile', 'export function shouldBuild(', 'function validateCategoryPack']) {
    const start = src.indexOf(fn);
    if (start < 0) {
        check(`${fn} is still in PackFile.ts`, false, true);
        continue;
    }
    const body = src.slice(start, start + 1400);
    const asked = body.indexOf('didSourceSetChange()');
    const returned = body.indexOf('return true;');
    const name = fn.replace('function ', '').replace('export ', '');
    check(`${name} asks the guard`, asked >= 0, true);
    // BEFORE its first early return, which is the whole claim.
    check('...before its first early return', asked >= 0 && (returned < 0 || asked < returned), true);
    // AND ACTS ON THE ANSWER. Asking and ignoring it is the same bug with the stamp kept tidy -
    // and the first draft of this check only looked for the call, so a predicate that dropped the
    // `if (setChanged)` passed it.
    check('...and acts on what it said', /setChanged\b/.test(body.slice(asked + 1)), true);
}

fs.rmSync(tmp, { recursive: true, force: true });
console.log(`\n${R.ok} ok, ${R.bad} FAIL`);
process.exit(R.bad ? 1 : 0);
