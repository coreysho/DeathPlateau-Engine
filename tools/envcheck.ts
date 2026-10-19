/**
 * Every setting in Environment reads the environment variable it is named after.
 *
 * WHY THIS IS WORTH A BUILD STEP. The file is one long list of near-identical lines, which is
 * exactly the shape a copy-paste gets lost in, and a wrong variable name is invisible from every
 * direction: it compiles, it lints, the setting has a plausible value, and the only symptom is
 * that setting the variable in .env does nothing - or that setting a DIFFERENT one silently
 * changes this one.
 *
 * It had happened twice. NODE_HOP_TIME read NODE_MAX_NPCS, copied from three lines above it, so
 * the relog delay was however many NPCs the world allowed, in milliseconds; .env.example offers
 * NODE_MAX_NPCS=8191, so uncommenting a line about NPCs would have cut the hop timer from 45
 * seconds to 8 with nothing to connect the two. NODE_LIMIT_BYTES_PER_TRACKING_SESSION read
 * NODE_MAX_BYTES_PER_TRACKING_SESSION, which nothing noticed because nothing reads that setting
 * at all.
 *
 * The check is deliberately textual rather than runtime: it reads the source, because at runtime
 * a key that reads the wrong variable looks exactly like a key whose variable is unset.
 *
 *   npx tsx tools/envcheck.ts
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const FILE = path.join(HERE, '..', 'src/util/Environment.ts');

const source = fs.readFileSync(FILE, 'utf8');

// KEY: tryParseWhatever(process.env.VARIABLE, ...)
const entry = /^\s{4}([A-Z0-9_]+):\s*tryParse\w+\(\s*process\.env\.([A-Z0-9_]+)/gm;

let total = 0;
const wrong: { key: string; reads: string; line: number }[] = [];

for (const match of source.matchAll(entry)) {
    total++;
    const [, key, reads] = match;
    if (key !== reads) {
        wrong.push({ key, reads, line: source.slice(0, match.index ?? 0).split('\n').length });
    }
}

if (total === 0) {
    // The pattern stopped matching - a reformat, or the file moved. Silence here would read as a
    // pass, and a check that cannot fail is worse than no check.
    console.log('envcheck: FAILED - matched no settings at all in src/util/Environment.ts');
    console.log('  the pattern has gone stale against the file; fix the pattern, not the file');
    process.exit(1);
}

for (const w of wrong) {
    console.log(`  Environment.ts:${w.line}  ${w.key} reads process.env.${w.reads}`);
}

console.log(wrong.length === 0 ? `\nALL PASS - ${total} settings, each reading its own variable` : `\n${wrong.length} SETTING(S) READ THE WRONG VARIABLE, of ${total}`);
process.exit(wrong.length === 0 ? 0 : 1);
