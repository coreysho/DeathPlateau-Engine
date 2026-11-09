// The quest helper's table, read the way a PLAYER reads it.
//
//   npx tsx tools/quest/WordingCheck.ts [quests.json]
//
// WHAT THIS IS FOR. Every row in data/quests.json is a sentence a person reads while standing in
// the game with the quest open, and the sentences are GENERATED - out of sim prose written for
// another developer, and out of debugnames out of the server's own source. Each rule below is a
// shape that reached the panel and read as a machine talking:
//
//   "Go to the walk back north out of the swamp."   a journey described as if it were a place
//   "Go to and the east room."                      a fragment joined to the step before it
//   "Use an item on Cauldron."                      true, and no use to someone at the cauldron
//   "Talk to agrith reen alkharid."                 a handle out of the content, lowercased
//   "plaguesheep 1."                                a step with no verb at all
//
// WHY A CHECK AND NOT A TEST OF THE EXPORTER. The exporter's rules are regular expressions over
// English, and the interesting input is not what I would think to write down - it is the 5,322
// rows that 106 sims actually produce. So this reads the shipped table and asserts the shapes
// that cannot be right, which is a test over the real corpus rather than over my memory of it.
// A rule that fires names the quest and the row, because the fix is nearly always in the sim's
// prose rather than here.
import * as fs from 'fs';
import * as path from 'path';

const file = process.argv[2] ?? path.join(import.meta.dirname, '..', '..', 'data', 'quests.json');
const table = JSON.parse(fs.readFileSync(file, 'utf8')) as {
    quests: {
        name: string;
        stages: { steps: { text: string; kind: string; why?: string; id?: number; also?: number[] }[] }[];
    }[];
};

interface Row {
    quest: string;
    text: string;
    kind: string;
    why?: string;
    /** The step's own npc id, and the others it would take: a crowd the player cannot tell apart. */
    id?: number;
    also?: number[];
}

const rows: Row[] = [];
for (const quest of table.quests) {
    for (const stage of quest.stages) {
        for (const step of stage.steps) {
            rows.push({
                quest: quest.name,
                text: step.text,
                kind: step.kind,
                why: step.why,
                id: step.id,
                also: step.also
            });
        }
    }
}

/** A handle like `fever_multi_cannon`, but not a filename like `gnome_glider.rs2`. */
const HANDLE = /\b[a-z][a-z0-9]*_[a-z0-9_]+\b(?!\.[a-z0-9]{2,4}\b)/;

const RULES: { name: string; wrong: (row: Row) => boolean }[] = [
    { name: 'a server handle instead of a name', wrong: r => HANDLE.test(r.text) },
    { name: 'a stranded "Go to"', wrong: r => /^Go to (?:and|to|the walk|the way|all the way)\b/i.test(r.text) },
    { name: 'no full stop', wrong: r => !/[.!?]$/.test(r.text) },
    { name: 'does not open on a capital', wrong: r => !/^[A-Z"']/.test(r.text) },
    { name: 'an unnamed item', wrong: r => /\ban item\b/.test(r.text) },
    { name: 'empty', wrong: r => !r.text.trim() },
    { name: 'double spacing', wrong: r => /\s\s/.test(r.text) },
    // A step you can click has a verb in front of it; the ones that did not were a debugname on
    // its own. Walks and notes are prose and say what they say.
    // A note under an instruction is a label - which helmet, which attempt - and the manifests
    // write them as running commentary, so they arrive as the next sentence of a story.
    { name: 'an explanation that opens on a conjunction', wrong: r => /^(?:And|Then|But|So|Also)\b/.test(r.why ?? '') },
    // A walk that names nowhere tells a player nothing; it takes the name of what it leads to.
    { name: 'a walk with nothing in it', wrong: r => r.kind === 'walk' && r.text === 'Travel here.' },
    // A FAMILY IS OTHER npcs, and the client walks it after failing on the step's own id, so its
    // own id in there is dead weight and a repeat is a wasted comparison every frame. A family on
    // a step with no id of its own is a family of strangers: nothing would ever match the step
    // itself, so the marker could only ever point at somebody else.
    { name: "a family holding the step's own id", wrong: r => (r.also ?? []).includes(r.id ?? -1) },
    { name: 'a family with the same id twice', wrong: r => new Set(r.also ?? []).size !== (r.also ?? []).length },
    { name: 'a family on a step with no id', wrong: r => (r.also ?? []).length > 0 && (r.id ?? -1) < 0 },
    { name: 'an empty family, which is no family', wrong: r => Array.isArray(r.also) && r.also.length === 0 },
    {
        name: 'no verb in front of the target',
        wrong: r => r.kind !== 'walk' && r.kind !== 'note' && !/^[A-Z][a-zA-Z-]* /.test(r.text)
    }
];

let failed = 0;
for (const rule of RULES) {
    const hits = rows.filter(rule.wrong);
    if (!hits.length) {
        console.log(`  ok   no row has ${rule.name} (${rows.length} read)`);
        continue;
    }
    failed += hits.length;
    console.log(`  FAIL ${hits.length} rows have ${rule.name}:`);
    for (const hit of hits.slice(0, 8)) console.log(`         ${hit.quest} | ${hit.text}`);
    if (hits.length > 8) console.log(`         ... and ${hits.length - 8} more`);
}

// The table is only worth reading if it has the quests in it: an empty file passes every rule
// above and would make this check a decoration.
if (rows.length < 1000) {
    console.log(`  FAIL only ${rows.length} rows in ${file}, which is not the quest table`);
    failed++;
}

console.log(failed ? `\n${failed} rows read as a machine talking` : '\nALL PASS');
process.exit(failed ? 1 : 0);
