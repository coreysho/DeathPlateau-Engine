// EVERY RADIO BUTTON WHOSE SCRIPT DISAGREES WITH THE CACHE - the third cross-reference, and the
// one that finds wiring that LOOKS right.
//
//   npx tsx tools/sim/ifselect.ts                 the report
//   npx tsx tools/sim/ifselect.ts --baseline      rewrite tools/sim/ifselect-baseline.txt
//   npx tsx tools/sim/ifselect.ts --check         fail on anything new
//
// WHAT THE OTHER TWO TOOLS CANNOT SEE. opsweep asks "the cache offers an option - does a script
// answer it?" and orphans asks the reverse. Both are questions about EXISTENCE, and a button can
// pass them both while doing the wrong thing. Thessalia's women's trousers window passed both: all
// eight of its [if_button] handlers existed, and every option they answered existed. Six of the
// seven styles still handed out somebody else's trousers, because the handlers were attached to
// the wrong buttons - shifted one along the row, and running two past the end onto the overlay
// graphics that mark the selection.
//
// THE CACHE ALREADY KNOWS THE ANSWER. A 377 radio button (buttontype=select) carries a client-side
// script that decides whether to draw itself highlighted:
//
//     script1op1=pushvar,if1      push the value of varp `if1`
//     script1=eq,4                highlight when it equals 4
//
// That is the interface stating, in the cache, which value of which varp means "I am the chosen
// one". The server's [if_button] handler for that same component has to store that same value in
// that same varp or the two halves disagree: the player clicks Long Narrow Skirt, the server
// remembers something else, and either the highlight lands on a different button or the confirm
// hands over a different item. Nobody has to decide what the right value is - the cache says.
//
// So this walks every select button in the cache, reads the varp and value out of its highlight
// script, finds the [if_button] handler for it in the content sources, and compares.
//
// WHAT IT WILL NOT JUDGE. The handler side is read from .rs2 text, not from compiled bytecode, so
// this only speaks up when the body is unambiguous: a single `%varp = N;` assignment and nothing
// else. A handler that branches, calls a proc, or sets several varps is left alone and counted as
// unjudged - it may well be right, and guessing from source text would produce false alarms of
// exactly the kind that make a ratchet worthless. The same goes for a button whose highlight
// script is anything other than one plain `pushvar` + `eq`.
//
// THREE KINDS OF FINDING:
//   MISMATCH   the handler stores a value, and it is not the one the cache highlights on. Always
//              a bug: the button and its highlight cannot both be right.
//   WRONG VARP the handler stores into a different varp than the one the button watches. Same.
//   NO HANDLER the button is drawn, labelled and clickable, and no script claims it. This is the
//              hole opsweep leaves - it checks inventory grids (inv_button) but not plain
//              if_button - and it is how "Plain", the first button in that trousers window, went
//              unnoticed.
import fs from 'fs';
import path from 'path';

import * as H from './harness.js';
import Component from '#/cache/config/Component.js';
import VarPlayerType from '#/cache/config/VarPlayerType.js';
import Environment from '#/util/Environment.js';

const argv = process.argv.slice(2);
const WRITE_BASELINE = argv.includes('--baseline');
const CHECK = argv.includes('--check');
const BASELINE_FILE = path.join('tools', 'sim', 'ifselect-baseline.txt');

await H.boot();

/** buttontype=select. The other button types do not carry a "this one is chosen" highlight. */
const BUTTON_SELECT = 5;
/** nameToScript('pushvar') in tools/pack/interface/PackShared.ts. */
const SCRIPT_PUSHVAR = 5;
/** nameToComparator('eq') in the same file. */
const CMP_EQ = 1;

// ------------------------------------------------------------- what the cache says each button is

type Button = { com: string; varp: string; value: number; label: string };
const buttons: Button[] = [];
/** Select buttons whose highlight script is not a plain pushvar+eq: nothing to compare against. */
let unreadable = 0;

for (let id = 0; id < Component.count; id++) {
    const com = Component.get(id);
    if (!com || !com.comName || com.buttonType !== BUTTON_SELECT) {
        continue;
    }
    const script = com.scripts?.[0];
    // [pushvar, varpId, 0] and nothing more - the trailing 0 ends the script, and anything longer
    // is doing arithmetic we will not read.
    if (!script || script.length !== 3 || script[0] !== SCRIPT_PUSHVAR || script[2] !== 0 || com.scriptComparator?.[0] !== CMP_EQ) {
        unreadable++;
        continue;
    }
    const varp = VarPlayerType.get(script[1]);
    if (!varp?.debugname) {
        unreadable++;
        continue;
    }
    buttons.push({
        com: com.comName,
        varp: varp.debugname,
        value: com.scriptOperand![0],
        label: (com as unknown as { option?: string }).option ?? ''
    });
}

// ------------------------------------------------------------------- what the scripts actually do

/** com name -> the single varp assignment its [if_button] body makes, or null when we will not judge it. */
const handlers = new Map<string, { varp: string; value: number } | null>();

function walk(dir: string, out: string[]): string[] {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, e.name);
        if (e.isDirectory()) {
            walk(p, out);
        } else if (e.name.endsWith('.rs2')) {
            out.push(p);
        }
    }
    return out;
}

const TRIGGER = /^\[([a-z_0-9]+)\s*,\s*([^\]]+)\]\s*(.*)$/;
const ASSIGN = /^%([a-zA-Z_0-9]+)\s*=\s*(\d+)\s*;\s*$/;

for (const file of walk(path.join(Environment.BUILD_SRC_DIR, 'scripts'), [])) {
    const lines = fs.readFileSync(file, 'ascii').split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
        const m = TRIGGER.exec(lines[i].trim());
        if (!m || m[1] !== 'if_button') {
            continue;
        }
        const com = m[2].trim();
        // The body is either the rest of this line, or the lines until the next trigger/blank run.
        const body: string[] = [];
        if (m[3].trim()) {
            body.push(m[3].trim());
        } else {
            for (let j = i + 1; j < lines.length; j++) {
                const l = lines[j].trim();
                if (l.startsWith('[')) break;
                if (l.startsWith('//')) continue;
                if (!l) {
                    // one blank line inside a body is normal; two ends it
                    if (!lines[j + 1]?.trim() || lines[j + 1].trim().startsWith('[')) break;
                    continue;
                }
                body.push(l);
            }
        }
        if (body.length !== 1) {
            handlers.set(com, null);
            continue;
        }
        const a = ASSIGN.exec(body[0]);
        handlers.set(com, a ? { varp: a[1], value: parseInt(a[2]) } : null);
    }
}

// --------------------------------------------------------------------------------- the comparison

const findings: string[] = [];
let unjudged = 0;
let agreed = 0;

for (const b of buttons.sort((x, y) => x.com.localeCompare(y.com))) {
    const label = b.label ? ` "${b.label}"` : '';
    if (!handlers.has(b.com)) {
        findings.push(`nohandler ${b.com}${label} - nothing claims [if_button], the cache highlights it on %${b.varp} = ${b.value}`);
        continue;
    }
    const h = handlers.get(b.com);
    if (!h) {
        // null: a body this tool will not read from source. undefined cannot happen - has() passed.
        unjudged++;
        continue;
    }
    if (h.varp !== b.varp) {
        findings.push(`wrongvarp ${b.com}${label} - the handler sets %${h.varp}, the cache highlights on %${b.varp}`);
    } else if (h.value !== b.value) {
        findings.push(`mismatch  ${b.com}${label} - the handler sets %${h.varp} = ${h.value}, the cache highlights on ${b.value}`);
    } else {
        agreed++;
    }
}

console.log('RADIO BUTTONS WHOSE SCRIPT DISAGREES WITH THE CACHE');
console.log(`  ${buttons.length} select buttons carry a readable pushvar+eq highlight (${unreadable} do not, and are skipped)`);
console.log(`  ${agreed} agree, ${unjudged} have a handler too involved to read from source, ${findings.length} do not agree`);
console.log('');
for (const f of findings) {
    console.log(`  ${f}`);
}

const signature = findings.slice().sort();

if (WRITE_BASELINE) {
    fs.mkdirSync(path.dirname(BASELINE_FILE), { recursive: true });
    fs.writeFileSync(
        BASELINE_FILE,
        [
            '# Radio buttons whose [if_button] handler disagrees with the highlight script in the cache,',
            '# as of the build this was written on.',
            '# Rewritten with: npx tsx tools/sim/ifselect.ts --baseline',
            '# Checked with:   npx tsx tools/sim/ifselect.ts --check   (fails on anything NEW)',
            '#',
            '# A ratchet, not an approval. A mismatch line is a button that stores the wrong thing; a',
            '# nohandler line is a button that is drawn and labelled and does nothing at all.',
            `# ${signature.length} lines at the time of writing.`,
            '',
            ...signature
        ].join('\n') + '\n',
        'utf8'
    );
    console.log(`\nbaseline written: ${BASELINE_FILE} (${signature.length} lines)`);
    process.exit(0);
}

if (CHECK) {
    let before: Set<string>;
    try {
        before = new Set(
            fs
                .readFileSync(BASELINE_FILE, 'utf8')
                .split(/\r?\n/)
                .filter(l => l && !l.startsWith('#'))
        );
    } catch {
        console.log(`\nno baseline at ${BASELINE_FILE} - run with --baseline first`);
        process.exit(1);
    }
    const added = signature.filter(l => !before.has(l));
    const fixed = [...before].filter(l => !signature.includes(l));
    console.log(`\nAGAINST THE BASELINE: ${added.length} new, ${fixed.length} fixed`);
    for (const line of added.slice(0, 40)) {
        console.log(`   NEW  ${line}`);
    }
    if (fixed.length) {
        console.log(`   ${fixed.length} fixed - rerun with --baseline to bank them`);
    }
    process.exit(added.length ? 1 : 0);
}

process.exit(0);
