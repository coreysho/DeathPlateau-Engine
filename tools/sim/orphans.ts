// EVERY TRIGGER NO CLICK CAN EVER FIRE - the exact inverse of opsweep.ts, and the other half of the
// same cross-reference.
//
//   npx tsx tools/sim/orphans.ts                 the report
//   npx tsx tools/sim/orphans.ts --baseline      rewrite tools/sim/orphans-baseline.txt
//   npx tsx tools/sim/orphans.ts --check         fail if anything is orphaned that was not before
//
// WHY BOTH TOOLS EXIST. opsweep asks "the cache offers this option - does a script answer it?" and
// finds content nobody wrote. This asks the opposite: "a script answers this option - does the cache
// offer it?" and finds content somebody DID write that nothing can reach. They are different bugs
// with different fixes, and neither one can be read off the source by hand.
//
// A script coverage report cannot tell them apart either, and that is the point of this file. On
// this build 14,900-odd triggers have never run in a fuzz process, and "never run" lumps together
// three completely different things: content that works and nobody walked to, content that works
// and needs a quest state the run did not have, and content that CANNOT run because the loc it is
// written against has no such option in the cache. The third kind is not a to-do item for a
// playtester, it is a bug in the content, and it is the only one of the three that is decidable
// without running anything.
//
// WHAT COUNTS AS UNREACHABLE. Only the trigger families where the cache is the definitive answer:
//
//   [oplocN,x] / [aplocN,x]   LocType x must have a label at op N
//   [opnpcN,x] / [apnpcN,x]   NpcType x must have one at op N
//   [opobjN,x] / [apobjN,x]   ObjType x must have one at op N (its ground menu)
//   [opheldN,x]               ObjType x must have one at iop N (its backpack menu)
//   [inv_buttonN,com]         Component com must have one at iop N
//   [if_button,com]           Component com must be a button at all
//
// EVERYTHING ELSE IS LEFT OUT ON PURPOSE. [queue,N] and [ai_queueN,x] are fired by a `queue` or
// `npc_queue` command from another script, so deciding whether one is reachable means reading
// compiled bytecode for its callers - a different and much weaker check, since a missed caller
// would report working content as broken. [opheldu], [oplocu] and the targeted-spell triggers have
// no label behind them at all: the player invents the combination, so there is nothing in the cache
// to disagree with. A trigger this tool says nothing about is not a trigger it has cleared.
//
// `hidden` IS NOT MISSING, and getting this wrong is what the first version of this tool did. It
// reported [oploc3,_tree] in woodcut.rs2 and [oploc3,_mining_rock_normal] in mining.rs2 as
// unreachable - core skilling content that obviously works - because a tree's op3 is the literal
// string "hidden" and opsweep's isVisibleOp says a client will not draw it.
//
// A client will not. The SERVER will:
//
//     ScriptOpcode.P_OPLOC:  if (!locType.op || !locType.op[type]) return;
//
// p_oploc(n) re-enters an op from script, and it accepts any slot whose label is non-null - which
// "hidden" is. So a hidden op with a script behind it is the documented idiom for "server-invoked
// only", not an oversight; farming_triggers.rs2 says so in as many words ("only p_oploc(3) fires
// it"), and this build calls p_oploc 65 times across slots 1 to 4.
//
// So the two tools ask deliberately different questions about the same field:
//
//   opsweep   would a CLIENT draw this option? `hidden` means no, so a hidden op needs no script.
//   orphans   does the cache DECLARE this slot at all? `hidden` means yes, so a script is fine.
//
// Which leaves a null slot as the only honest orphan: p_oploc returns early on it and no client can
// click it, so nothing in the game can reach the script.
//
// THE OTHER TWO TRAPS ARE opsweep's, for the same reasons - see its header. A category trigger is
// alive if ANY type in that category declares the slot, and a multiloc shell answers for its
// children and vice versa.
import fs from 'fs';
import path from 'path';

import * as H from './harness.js';
import Component from '#/cache/config/Component.js';
import { locCanOp, npcCanOp } from '#/cache/config/OpVisibility.js';
import LocType from '#/cache/config/LocType.js';
import NpcType from '#/cache/config/NpcType.js';
import ObjType from '#/cache/config/ObjType.js';
import ScriptProvider from '#/engine/script/ScriptProvider.js';
import ServerTriggerType from '#/engine/script/ServerTriggerType.js';

const argv = process.argv.slice(2);
const WRITE_BASELINE = argv.includes('--baseline');
const CHECK = argv.includes('--check');
const BASELINE_FILE = path.join('tools', 'sim', 'orphans-baseline.txt');

await H.boot();

/** What a lookupKey means: `trigger | (scope << 8) | (id << 10)`, scope 2 = type, 1 = category. */
function decode(lookupKey: number): { trigger: number; scope: number; id: number } {
    return { trigger: lookupKey & 0xff, scope: (lookupKey >> 8) & 0x3, id: lookupKey >> 10 };
}

/** The op slot (1-based) and the menu a trigger reads, or null if this tool does not judge it. */
function slotOf(trigger: number): { kind: 'loc' | 'npc' | 'obj' | 'held' | 'grid' | 'button'; op: number } | null {
    const range = (base: number, kind: 'loc' | 'npc' | 'obj' | 'held' | 'grid') => (trigger >= base && trigger <= base + 4 ? { kind, op: trigger - base + 1 } : null);
    return (
        range(ServerTriggerType.OPLOC1, 'loc') ??
        range(ServerTriggerType.APLOC1, 'loc') ??
        range(ServerTriggerType.OPNPC1, 'npc') ??
        range(ServerTriggerType.APNPC1, 'npc') ??
        range(ServerTriggerType.OPOBJ1, 'obj') ??
        range(ServerTriggerType.APOBJ1, 'obj') ??
        range(ServerTriggerType.OPHELD1, 'held') ??
        range(ServerTriggerType.INV_BUTTON1, 'grid') ??
        (trigger === ServerTriggerType.IF_BUTTON ? { kind: 'button' as const, op: 1 } : null)
    );
}

/** Every type id in a category, worked out once per menu kind. */
function byCategory(count: number, categoryOf: (id: number) => number): Map<number, number[]> {
    const out = new Map<number, number[]>();
    for (let id = 0; id < count; id++) {
        const cat = categoryOf(id);
        if (cat === -1) {
            continue;
        }
        const list = out.get(cat);
        if (list) {
            list.push(id);
        } else {
            out.set(cat, [id]);
        }
    }
    return out;
}
const locsInCat = byCategory(LocType.count, i => LocType.get(i).category);
const npcsInCat = byCategory(NpcType.count, i => NpcType.get(i).category);
const objsInCat = byCategory(ObjType.count, i => ObjType.get(i).category);

/**
 * Is this slot DECLARED on this type - any label at all, `hidden` included? See the header: that is
 * the question p_oploc asks, and it is not the question opsweep asks.
 */
function declared(label: string | null | undefined): boolean {
    return label !== null && label !== undefined && label !== '';
}

/** Does this one type declare the slot the trigger is written against? */
function typeOffers(kind: string, id: number, op: number): boolean {
    if (kind === 'loc') {
        return locCanOp(id, op);
    }
    if (kind === 'npc') {
        return npcCanOp(id, op);
    }
    if (kind === 'obj') {
        return declared(ObjType.get(id)?.op?.[op - 1]);
    }
    if (kind === 'held') {
        return declared(ObjType.get(id)?.iop?.[op - 1]);
    }
    if (kind === 'grid') {
        return declared(Component.get(id)?.iop?.[op - 1]);
    }
    // button
    const com = Component.get(id);
    return !!com && com.buttonType !== Component.NO_BUTTON;
}

/** The same question for a category trigger: alive if ANY member carries the label. */
function categoryOffers(kind: string, cat: number, op: number): boolean {
    const members = kind === 'grid' || kind === 'button' ? undefined : membersOf(kind, cat);
    if (!members) {
        return false; // a category with no members at all: nothing can ever be it
    }
    return members.some(id => typeOffers(kind, id, op));
}

/** Every type id in the category a trigger is written against, for the kind of menu it reads. */
function membersOf(kind: string, cat: number): number[] | undefined {
    if (kind === 'loc') {
        return locsInCat.get(cat);
    }
    if (kind === 'npc') {
        return npcsInCat.get(cat);
    }
    return objsInCat.get(cat);
}

/** The menu a trigger of this kind reads, for the `why` line. */
function menuOf(kind: string, id: number): (string | null)[] {
    switch (kind) {
        case 'loc':
            return LocType.get(id)?.op ?? [];
        case 'npc':
            return NpcType.get(id)?.op ?? [];
        case 'held':
            return ObjType.get(id)?.iop ?? [];
        case 'grid':
            return Component.get(id)?.iop ?? [];
        default:
            return ObjType.get(id)?.op ?? [];
    }
}

// ------------------------------------------------------------------------------------- the sweep

type Row = { line: string; why: string };
const orphans: Row[] = [];
let judged = 0;

for (let id = 0; id < ScriptProvider.count; id++) {
    const script = ScriptProvider.get(id);
    if (!script || script.info.lookupKey === 0xffffffff) {
        continue;
    }
    const { trigger, scope, id: subject } = decode(script.info.lookupKey);
    const slot = slotOf(trigger);
    if (!slot) {
        continue; // a family this tool does not judge - see the header
    }
    // A global `_` trigger applies to everything, so there is nothing to disagree with.
    if (scope === 0) {
        continue;
    }
    judged++;
    const alive = scope === 2 ? typeOffers(slot.kind, subject, slot.op) : categoryOffers(slot.kind, subject, slot.op);
    if (alive) {
        continue;
    }
    // Say WHY, because "unreachable" on its own sends the reader back to the cache to work it out.
    let why: string;
    if (scope === 1) {
        const members = membersOf(slot.kind, subject);
        why = !members ? 'that category has no members' : `none of the ${members.length} in that category declares an op${slot.op}`;
    } else if (slot.kind === 'button') {
        why = Component.get(subject) ? 'that component is not a button' : 'no such component';
    } else {
        const labels = menuOf(slot.kind, subject);
        const has = labels.map((l, i) => (declared(l) ? `op${i + 1}="${l}"` : null)).filter(Boolean);
        why = has.length ? `that slot is empty; it declares ${has.join(', ')}` : 'it declares no options at all';
    }
    orphans.push({ line: `${script.name} - ${script.fileName}`, why });
}

orphans.sort((a, b) => a.line.localeCompare(b.line));

console.log('TRIGGERS NO CLICK CAN FIRE');
console.log(`  ${judged} triggers checked (the click-driven families only - see this file's header)`);
console.log(`  ${orphans.length} of them are written against a slot the cache does not declare at all`);
console.log('');
console.log('  TWO KINDS, AND THIS CANNOT TELL THEM APART - a human read of each cluster can:');
console.log('    a LOST FEATURE. [opheld1,ahoy_book_of_haricanto] reads the Book of Haricanto and');
console.log('      checks %ahoy_given_book, and the obj declares no iop1, so the book cannot be read.');
console.log('    DEFENSIVE DEAD CODE. the 24 [opheld2,barrows_*_broken] are ~barrows_broken_refuse,');
console.log('      and the comment above them says a broken piece "just cannot be re-equipped" - which');
console.log('      is already true, because the obj offers no Wear. The refusal never runs. The');
console.log('      behaviour is right and the handler is redundant.');
console.log('  Both are worth knowing. The first is a bug; the second will mislead the next reader.');
console.log('');
// Grouped by file, because a cluster is one decision and not twenty-four.
const byFile = new Map<string, Row[]>();
for (const row of orphans) {
    const file = row.line.slice(row.line.lastIndexOf(' - ') + 3);
    const list = byFile.get(file);
    if (list) {
        list.push(row);
    } else {
        byFile.set(file, [row]);
    }
}
for (const [file, rows] of [...byFile].sort((a, b) => b[1].length - a[1].length)) {
    console.log(`  -- ${file} (${rows.length})`);
    for (const row of rows.slice(0, 8)) {
        console.log(`     ${row.line.slice(0, row.line.lastIndexOf(' - '))}`);
        console.log(`         ${row.why}`);
    }
    if (rows.length > 8) {
        console.log(`     ... and ${rows.length - 8} more in this file`);
    }
}

const signature = orphans.map(r => r.line).sort();
if (WRITE_BASELINE) {
    fs.mkdirSync(path.dirname(BASELINE_FILE), { recursive: true });
    fs.writeFileSync(
        BASELINE_FILE,
        [
            '# Triggers written against an option the cache does not offer, as of the build this was',
            '# written on. Rewritten with: npx tsx tools/sim/orphans.ts --baseline',
            '# Checked with:                npx tsx tools/sim/orphans.ts --check   (fails on anything NEW)',
            '#',
            '# A ratchet, not an approval. Every line is content somebody wrote that nothing can run.',
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
