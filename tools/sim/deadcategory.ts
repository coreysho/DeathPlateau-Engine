// FOR EVERY DEAD OPTION, THE CATEGORY THAT WOULD ANSWER IT - guessed from the locs and npcs that
// already work, not from a remembered list.
//
//   npx tsx tools/sim/deadcategory.ts            every suggestion, strongest evidence first
//   npx tsx tools/sim/deadcategory.ts --placed    only the ones a player can walk up to
//   npx tsx tools/sim/deadcategory.ts --npcs      npcs instead of locs
//   npx tsx tools/sim/deadcategory.ts --category ladder_up    every line that suggestion covers
//
// WHY THIS EXISTS. opsweep says 2,824 options are dead. That is a list, not a work queue, and the
// two biggest live buckets in it turned out to be the SAME ONE BUG wearing different hats:
//
//   175 rocks with an inert Mine, because the loc had no category=mining_rock_normal
//   123 Ape Atoll jungle trees with an inert Chop-down, because the loc had no category=tree
//    21 woodcutting Ents nobody could chop, because the npc had no category=macro_event_ent
//
// In all three cases the handler was already written, already dispatching on category, and a
// working sibling was sitting in the same file or the same cache family with the right line on it.
// Each took an afternoon of reading to find and ten seconds to fix. This does the reading.
//
// HOW IT DECIDES, strongest evidence first. The method is deadrocks.ts's, which learned ore from
// seam colour by reading the 119 rocks already in mine.dbrow; here the thing learned is the
// category and the evidence is:
//
//   MODEL    a wired loc drawn with the same model, answering the same option slot by category.
//            Two locs with the same model are usually the same object twice.
//   LABEL    a wired loc whose option at the same slot has the SAME LABEL. "Mine" is answered by
//            exactly one category in this build, so a dead "Mine" has exactly one candidate.
//   NAME     a wired loc sharing a name stem - mm_bush_kharazi_jungle_tree1 and
//            kharazi_jungle_tree1 share "kharazi_jungle_tree".
//
// WHAT IT WILL NOT DO is decide. A category is necessary and rarely sufficient: the jungle trees
// also needed rows in woodcutting_trees and a next_loc_stage, and the rocks need an ore and a
// depletion decision. The suggestion is where to start reading, and the sibling it names is the
// worked precedent to copy. Several of the loudest rows here are deliberate - see the
// already-explained list at the bottom - so read the sibling before changing anything.
import * as H from './harness.js';
import CategoryType from '#/cache/config/CategoryType.js';
import { isVisibleOp } from '#/cache/config/OpVisibility.js';
import LocType from '#/cache/config/LocType.js';
import NpcType from '#/cache/config/NpcType.js';
import ScriptProvider from '#/engine/script/ScriptProvider.js';
import ServerTriggerType from '#/engine/script/ServerTriggerType.js';
import World from '#/engine/World.js';

const argv = process.argv.slice(2);
const PLACED_ONLY = argv.includes('--placed');
const NPCS = argv.includes('--npcs');
const catAt = argv.indexOf('--category');
/** Only the lines whose best suggestion is this category, all of them rather than the first 60. */
const ONLY = catAt === -1 ? null : argv[catAt + 1];

await H.boot();

/** A specific or category trigger, never the global - the same rule opsweep applies, trap 3. */
function claimed(trigger: number, type: number, category: number): boolean {
    if (ScriptProvider.getByTriggerSpecific(trigger, type, -1)) {
        return true;
    }
    return category !== -1 && !!ScriptProvider.getByTriggerSpecific(trigger, -1, category);
}
/** Answered BY ITS CATEGORY, which is the only kind of wiring this tool can suggest copying. */
function claimedByCategory(trigger: number, category: number): boolean {
    return category !== -1 && !!ScriptProvider.getByTriggerSpecific(trigger, -1, category);
}

// ------------------------------------------------------------------- the world, counted once

const counts = new Map<number, number>();
const places = new Map<number, string>();
if (NPCS) {
    for (const npc of World.npcs) {
        if (!npc) continue;
        counts.set(npc.type, (counts.get(npc.type) ?? 0) + 1);
        if (!places.has(npc.type)) places.set(npc.type, `${npc.x},${npc.z},${npc.level}`);
    }
} else {
    for (const zone of World.gameMap.existingZones()) {
        for (const loc of zone.getAllLocsUnsafe()) {
            counts.set(loc.type, (counts.get(loc.type) ?? 0) + 1);
            if (!places.has(loc.type)) places.set(loc.type, `${loc.x},${loc.z},${loc.level}`);
        }
    }
}

// --------------------------------------------------------------------------- the two populations

const COUNT = NPCS ? NpcType.count : LocType.count;
const OP = NPCS ? ServerTriggerType.OPNPC1 : ServerTriggerType.OPLOC1;
const AP = NPCS ? ServerTriggerType.APNPC1 : ServerTriggerType.APLOC1;
const get = (id: number) => (NPCS ? NpcType.get(id) : LocType.get(id));
const kinOf = (id: number): number[] => {
    const type = get(id);
    const kin = ((NPCS ? (type as NpcType).multinpc : (type as LocType).multiloc) ?? []).filter(i => i >= 0);
    return [id, ...kin];
};

type Slot = { id: number; name: string; op: number; label: string; models: number[]; instances: number };
const deadSlots: Slot[] = [];
/** How many types in the build carry each category - the tie-break when two look equally likely. */
const categorySize = new Map<number, number>();
/** label -> categories that answer it; model -> categories; name stem -> categories. */
const byLabel = new Map<string, Map<number, string[]>>();
const byModel = new Map<number, Map<number, string[]>>();
const byStem = new Map<string, Map<number, string[]>>();

const modelsOf = (id: number): number[] => {
    const type = get(id);
    return [...((NPCS ? (type as NpcType).models : (type as LocType).models) ?? [])];
};
/** "mm_bush_kharazi_jungle_tree1" -> the stems it shares with a sibling, longest first. */
const stemsOf = (name: string): string[] => {
    const parts = name.split('_').filter(Boolean);
    const out: string[] = [];
    for (let from = 0; from < parts.length; from++) {
        for (let to = parts.length; to > from + 1; to--) {
            out.push(parts.slice(from, to).join('_'));
        }
    }
    return out;
};

const note = (into: Map<string | number, Map<number, string[]>>, key: string | number, category: number, who: string): void => {
    let m = into.get(key);
    if (!m) {
        m = new Map();
        into.set(key, m);
    }
    const list = m.get(category);
    if (!list) m.set(category, [who]);
    else if (list.length < 3) list.push(who);
};

for (let id = 0; id < COUNT; id++) {
    const c = get(id)?.category ?? -1;
    if (c !== -1) categorySize.set(c, (categorySize.get(c) ?? 0) + 1);
}

for (let id = 0; id < COUNT; id++) {
    const type = get(id);
    if (!type?.op || !type.debugname) continue;
    const kin = kinOf(id);
    const instances = kin.reduce((n, k) => n + (counts.get(k) ?? 0), 0);
    for (let op = 0; op < type.op.length; op++) {
        const label = type.op[op];
        if (!isVisibleOp(label) || /^(attack|take)$/i.test(label)) continue;
        const alive = kin.some(k => claimed(OP + op, k, get(k).category) || claimed(AP + op, k, get(k).category));
        if (alive) {
            // A WIRED SIBLING IS ONLY USEFUL IF ITS CATEGORY IS WHAT ANSWERS IT. One answered by a
            // trigger of its own teaches nothing that can be copied onto another loc.
            if (!claimedByCategory(OP + op, type.category) && !claimedByCategory(AP + op, type.category)) continue;
            const where = `${type.debugname} op${op + 1}`;
            note(byLabel as never, `${op}:${label.toLowerCase()}`, type.category, where);
            for (const m of modelsOf(id)) note(byModel as never, m, type.category, where);
            // THE STEM IS KEYED BY SLOT AND LABEL TOO, because a name alone means nothing about an
            // option. The first version offered category=door_closed for dwarf_keldagrim_bookcase
            // op1="Search" - true, dwarf_keldagrim_door_interior is wired and shares the stem, and
            // a bookcase is not a door. A stem match only says anything when the sibling's option
            // at the same slot carries the same wording.
            for (const st of stemsOf(type.debugname)) note(byStem as never, `${st}|${op}:${label.toLowerCase()}`, type.category, where);
            continue;
        }
        if (PLACED_ONLY && instances === 0) continue;
        deadSlots.push({ id, name: type.debugname, op, label, models: modelsOf(id), instances });
    }
}

// ------------------------------------------------------------------------------- the suggestions

type Hit = { category: number; why: string; strength: number; because: string[] };

// A LABEL IS ONLY EVIDENCE WHEN FEW CATEGORIES ANSWER IT, which the first version of this got
// wrong and said so loudly: it offered `category=hemenster_gate` for 1,459 maze walls, because
// "Open" is answered by twenty-odd door categories and the first one alphabetically won. That is a
// histogram, not a rule - the same mistake worn_rig in content's skilltools_battery had to unlearn.
// "Mine" is answered by exactly one category in this build, which is why the rocks were findable
// this way at all. So the label's weight is a function of how many categories claim it:
//
//     1 category   strong - there is only one thing this wording can mean
//   2-3 categories moderate
//    >3 categories noise, reported only when nothing else is known and marked as such
const LABEL_UNIQUE = 3;
const LABEL_FEW = 1;
const SAME_MODEL = 4;
const NAME_STEM = 2;

function suggest(slot: Slot): Hit[] {
    const hits = new Map<number, Hit>();
    const take = (m: Map<number, string[]> | undefined, why: string, strength: number): void => {
        if (!m) return;
        for (const [category, because] of m) {
            const have = hits.get(category);
            if (!have || have.strength < strength) hits.set(category, { category, why, strength, because });
        }
    };
    for (const m of slot.models) take(byModel.get(m), 'same model', SAME_MODEL);
    const label = byLabel.get(`${slot.op}:${slot.label.toLowerCase()}`);
    if (label) {
        const n = label.size;
        take(label, n === 1 ? `the only category that answers "${slot.label}"` : `one of ${n} that answer "${slot.label}"`, n === 1 ? LABEL_UNIQUE : n <= 3 ? LABEL_FEW : 0);
    }
    for (const st of stemsOf(slot.name)) {
        if ([...hits.values()].some(h => h.strength >= NAME_STEM)) break;
        take(byStem.get(`${st}|${slot.op}:${slot.label.toLowerCase()}`), `name stem "${st}", same label`, NAME_STEM);
    }
    // THE TIE-BREAK IS HOW MANY TYPES ALREADY USE THE CATEGORY, not alphabetical and not how many
    // examples happened to be collected. Three categories answer "Mine"; mining_rock_normal is on
    // 118 rocks and mining_rock_fast on a handful, so the common one is the better first guess, and
    // it is the one rimmington_rocks.loc set when the owner did this by hand.
    return [...hits.values()].filter(h => h.strength > 0).sort((a, b) => b.strength - a.strength || (categorySize.get(b.category) ?? 0) - (categorySize.get(a.category) ?? 0));
}

const rows = deadSlots
    .map(slot => ({ slot, hits: suggest(slot) }))
    .filter(r => r.hits.length)
    .sort((a, b) => b.slot.instances - a.slot.instances || b.hits[0].strength - a.hits[0].strength || a.slot.name.localeCompare(b.slot.name));

const kind = NPCS ? 'npc' : 'loc';
console.log(`${deadSlots.length} dead ${kind} options${PLACED_ONLY ? ' on something the map places' : ''}, ${rows.length} with a wired sibling to copy`);
console.log('(a suggestion is where to start reading, never the whole fix - see the header)');
console.log('');

let shown = 0;
for (const { slot, hits } of rows) {
    if (ONLY && (CategoryType.get(hits[0].category)?.debugname ?? '') !== ONLY) continue;
    if (!ONLY && shown >= 60) break;
    shown++;
    const best = hits[0];
    const cat = CategoryType.get(best.category)?.debugname ?? String(best.category);
    const at =
        places.get(slot.id) ??
        kinOf(slot.id)
            .map(k => places.get(k))
            .find(Boolean);
    console.log(`${kind}  ${slot.name} op${slot.op + 1}="${slot.label}"  x${slot.instances}${at ? ' ' + at : ''}`);
    // HOW MANY TYPES ALREADY CARRY THE CATEGORY IS PRINTED, because it is the reader's only way to
    // tell a generic category from a bespoke one and the tool cannot. `ladder_up` is on ONE loc and
    // is still the right answer for a dead Climb-up, because ladders.rs2 dispatches on it
    // generically. `rashiliyia_tomb_door_opened` is on two and is the right answer for nothing
    // outside Rashiliyia's tomb, however true it is that no other category answers "Enter".
    const size = (c: number) => `${categorySize.get(c) ?? 0} loc${(categorySize.get(c) ?? 0) === 1 ? '' : 's'} use it`;
    console.log(`     try category=${cat}  (${best.why}; ${size(best.category)}; ${best.because.join(', ')})`);
    for (const other of hits.slice(1, 3)) {
        console.log(`     or  category=${CategoryType.get(other.category)?.debugname ?? other.category}  (${other.why}; ${size(other.category)}; ${other.because[0]})`);
    }
}
if (rows.length > shown) console.log(`... and ${rows.length - shown} more`);

// A count of which categories get suggested most, because that is how the mining and woodcutting
// buckets became one piece of work each rather than 175 and 123 separate ones.
const tally = new Map<string, number>();
for (const { hits } of rows) {
    const cat = CategoryType.get(hits[0].category)?.debugname ?? String(hits[0].category);
    tally.set(cat, (tally.get(cat) ?? 0) + 1);
}
console.log('');
console.log('-- the categories suggested most, which is where one fix covers many lines');
for (const [cat, n] of [...tally.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15)) {
    console.log(`  ${String(n).padStart(5)}  ${cat}`);
}
