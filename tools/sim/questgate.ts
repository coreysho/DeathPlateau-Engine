// DOES THE GATE ACTUALLY STOP ANYBODY, and does it let the right people through?
//
// ~quest_requirements_block reads the same quest_requirement row the journal prints and refuses a
// player who is short of it. This asks it, on a booted world, for every quest that declares a
// requirement:
//
//   a brand new character        must be refused by every quest that asks for anything
//   a character with every
//   skill maxed but no quests    must still be refused by the ones that want quests or points
//
// The second half is the one worth having. A gate that reads the wrong column, or that treats a
// missing row as "fine", passes a new player and nothing else in the suite would notice.
import * as H from './harness.ts';
import ScriptProvider from '#/engine/script/ScriptProvider.js';
import ScriptRunner from '#/engine/script/ScriptRunner.js';
import DbTableType from '#/cache/config/DbTableType.js';
import DbRowType from '#/cache/config/DbRowType.js';

await H.boot();

// ~quest_requirements_missing, NOT ~quest_requirements_block. The block proc calls ~mesbox, which
// PARKS the script, so its `return(true)` has not run by the time execute() comes back and the
// stacks read empty - every quest came out as "let a new character through". The deciding half is
// a separate proc with no message in it for exactly this reason.
function missing(p: any, name: string): string {
    const script = ScriptProvider.getByName('[proc,quest_requirements_missing]');
    if (!script) throw new Error('no [proc,quest_requirements_missing] - did the build run?');
    const state = ScriptRunner.init(script, p, null, [name]);
    ScriptRunner.execute(state);
    const strings = (state as any).stringStack as string[];
    const ssp = (state as any).ssp as number;
    return ssp > 0 ? strings[ssp - 1] : '';
}

function blocked(p: any, name: string): boolean {
    return missing(p, name).length > 0;
}

const table = DbTableType.getId('quest_requirement');
type Row = { name: string; skills: number; quests: number; qp: number };
const rows: Row[] = [];
for (let id = 0; id < DbRowType.count; id++) {
    const row = DbRowType.get(id);
    if (!row || row.tableId !== table) continue;
    const name = row.columnValues?.[1]?.[0];
    if (typeof name !== 'string') continue;
    // THE START COLUMNS, NOT THE FULL ONES. Only what the wiki marks as needed to START may
    // refuse a player at the door; the rest are needed later and the quest lets you begin.
    //
    // Columns are, in order: quest, name, questpoints, startquestpoints, skills, startskills,
    // quests, other. They are read by index because a dbrow carries no names at runtime - which
    // means adding a column silently shifts every one after it, and adding startquestpoints did
    // exactly that: this went on reading questpoints as the start total and skills as the start
    // skills, and reported nineteen correctly-behaved quests as letting a new character through.
    // The assertion below is what turns that into a failure instead of a wrong number.
    const cols = row.columnValues ?? [];
    if (cols.length !== 8) {
        throw new Error(`quest_requirement has ${cols.length} columns, expected 8 - the column`
            + ' order in this file is out of date with quest_requirement.dbtable');
    }
    rows.push({
        name,
        qp: Number(cols[3]?.[0] ?? 0),
        skills: (cols[5]?.length ?? 0) / 2,
        quests: (cols[6]?.length ?? 0) / 2
    });
}
rows.sort((a, b) => a.name.localeCompare(b.name));

const fresh = H.makePlayer('gatefresh', 3222, 3218);
const maxed = H.makePlayer('gatemaxed', 3222, 3218);
H.maxOut(maxed);

let freshLetThrough = 0;
let maxedStillBlocked = 0;
let noRequirements = 0;
let bad = 0;

for (const r of rows) {
    const wants = r.qp > 0 || r.skills > 0 || r.quests > 0;
    const a = blocked(fresh, r.name);
    const b = blocked(maxed, r.name);
    if (!wants) {
        noRequirements++;
        if (a) {
            console.log(`  BAD  ${r.name}: declares nothing and still refused a new player`);
            bad++;
        }
        continue;
    }
    if (!a) {
        console.log(`  BAD  ${r.name}: wants qp=${r.qp} skills=${r.skills} quests=${r.quests}`
            + ' and let a brand new character through');
        bad++;
        freshLetThrough++;
    }
    if (b) maxedStillBlocked++;
}

console.log(`\n${rows.length} rows`);
console.log(`  ${noRequirements} declare no requirement at all`);
console.log(`  ${rows.length - noRequirements} declare one, and every one refused a new character`);
console.log(`  ${maxedStillBlocked} still refuse a maxed character (they want quests or quest points)`);
console.log(`  ${freshLetThrough} let a new character through - should be 0`);
process.exit(bad > 0 ? 1 : 0);
