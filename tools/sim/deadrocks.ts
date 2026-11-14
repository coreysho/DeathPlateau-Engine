// EVERY ROCK WITH A MINE OPTION THAT DOES NOTHING, AND WHAT THE CACHE SAYS IS IN IT.
//
//   npx tsx tools/sim/deadrocks.ts              the decision table
//   npx tsx tools/sim/deadrocks.ts --placed     only the ones a player can walk up to
//
// WHY A TOOL AND NOT A LIST. opsweep says 174 locs have a dead "Mine" or "Prospect". That is a
// true statement and a useless one: 174 names like loc_11438 tell nobody which ore the rock is
// supposed to hold, which is the one thing wiring it requires. This applies the method the repo
// already documents at length in content/scripts/skill_mining/configs/rimmington_rocks.loc and
// regional_rocks.loc, so the owner confirms an ore instead of researching a name.
//
// THE METHOD, which is Jagex's own and not an invention. Every mine in the cache is a grid of
// (three rock models) x (the ores in that mine):
//
//   recol1d  the rock BODY colour, one value per mine. It is what makes a Rimmington rock look
//            different from a Falador-west one, and it is how the families below are grouped.
//   recol2d  the ORE SEAM colour, one value per ore. Same seam colour, same ore, mine to mine.
//
// So the seam colour of a rock already wired into mine.dbrow names its ore, and that is a fact on
// disk rather than a guess. This learns the seam->ore mapping from every rock the table already
// lists, then reads the unwired rocks' seams against it. Where a seam matches exactly one wired
// ore, the answer is settled. Where it matches none, or several, the tool says so and stops - an
// ore inferred from an unmatched colour would be exactly the guess this is built to avoid.
//
// IT COMPARES THE PACKED COLOUR, NOT THE NUMBER IN THE .loc, and that difference is the point
// rather than a shortcut. The config parser quantises recol2d into the cache's 16-bit HSL, so two
// source values a step apart land on the same packed colour: the Lunar Isle mine writes
// recol2d=23140 and the Falador-west gold rocks write 23108, and both pack to 8885 because they
// are the same gold to look at. Matching the source integers would miss that, and the integer is
// an arbitrary encoding anyway - what the player sees is the packed colour. The quantisation is
// also why the tool reports ambiguity instead of guessing: one packed colour in this build is
// shared by nine different ores, and a rock wearing it is not identified by colour at all.
//
// A CAVEAT WORTH KNOWING BEFORE WIRING ANYTHING. Several of these rocks declare no op3 at all.
// mining.rs2 keeps a player swinging with p_oploc(3), and the engine's P_OPLOC returns early on a
// null slot, so a rock with no op3 mines once and stops even after its category and ore are right.
// Every working rock in the build carries op3=hidden for exactly this reason.
//
// AND THE SPENT ROCKS. "The last row of every grid is the spent rock: same recol1d, but recol2d
// either absent or equal to recol1d, because a rock with no ore colour is a rock with no ore in
// it" - regional_rocks.loc. Those want category=mining_rock_normal and param=mining_rock_empty,1
// and no ore at all, so they are reported separately. A spent rock with no category does not say
// "There is no ore currently available in this rock"; it says nothing, which is the bug.
//
// WHAT THE TOOL WILL NOT TELL YOU, and what still needs a person:
//   * whether a rock depletes. A depleting rock needs param=next_loc_stage_mining pointing at its
//     spent partner; a non-depleting one needs its own get_ore_* label in mining.rs2, the way
//     rune essence does (blankrunestone carries no next stage and get_ore_essence just calls
//     p_oploc(3) again). loc_change refuses a null type, so a rock wired as depleting without a
//     partner throws rather than failing quietly.
//   * the level, xp and rate, which live in mine.dbrow and are per-ore, not per-rock.
//   * anything about the "Mineral vein" family, which carries no recolour at all and has no
//     mechanic in this build. Its description is the only evidence of its ore.
import fs from 'fs';
import path from 'path';

import * as H from './harness.js';
import LocType from '#/cache/config/LocType.js';
import World from '#/engine/World.js';
import Environment from '#/util/Environment.js';
import { isVisibleOp } from '#/cache/config/OpVisibility.js';
import ScriptProvider from '#/engine/script/ScriptProvider.js';
import ServerTriggerType from '#/engine/script/ServerTriggerType.js';

const PLACED_ONLY = process.argv.includes('--placed');

await H.boot();

// ------------------------------------------------------------------ the seam colours of each mine

/** recol1d / recol2d as the config writes them, or null where the loc declares no recolour. */
function recols(t: LocType): { body: number | null; seam: number | null } {
    if (!t.recol_s || !t.recol_d) {
        return { body: null, seam: null };
    }
    return {
        body: t.recol_d.length > 0 ? t.recol_d[0] : null,
        seam: t.recol_d.length > 1 ? t.recol_d[1] : null
    };
}

// ------------------------------------------------------- which locs mine.dbrow already knows about

/**
 * ore name -> the locs listed under it, read straight out of the content source. The packed dbrow
 * is reachable from the engine too, but the source is the file a person will edit.
 */
function oreTables(): Map<string, string[]> {
    const file = path.join(Environment.BUILD_SRC_DIR, 'scripts', 'skill_mining', 'configs', 'mine.dbrow');
    const out = new Map<string, string[]>();
    let rocks: string[] = [];
    let ore: string | null = null;
    const flush = () => {
        if (ore && rocks.length) {
            out.set(ore, (out.get(ore) ?? []).concat(rocks));
        }
        rocks = [];
        ore = null;
    };
    for (const raw of fs.readFileSync(file, 'ascii').split(/\r?\n/)) {
        const line = raw.trim();
        if (line.startsWith('[')) {
            flush();
        } else if (line.startsWith('data=rock,')) {
            rocks.push(line.slice('data=rock,'.length));
        } else if (line.startsWith('data=ore_name,')) {
            ore = line.slice('data=ore_name,'.length);
        }
    }
    flush();
    return out;
}

const tables = oreTables();
const oreOfLoc = new Map<string, string>();
for (const [ore, locs] of tables) {
    for (const l of locs) {
        oreOfLoc.set(l, ore);
    }
}

/** seam colour -> the ores wired rocks with that seam hold. One entry means the colour is decisive. */
const seamToOre = new Map<number, Set<string>>();
for (const [loc, ore] of oreOfLoc) {
    const id = LocType.getId(loc);
    if (id === -1) continue;
    const { seam } = recols(LocType.get(id));
    if (seam === null) continue;
    if (!seamToOre.has(seam)) seamToOre.set(seam, new Set());
    seamToOre.get(seam)!.add(ore);
}

// ------------------------------------------------------------------------ where the rocks are

const placed = new Map<number, { n: number; at: string }>();
for (const zone of World.gameMap.existingZones()) {
    for (const loc of zone.getAllLocsUnsafe()) {
        const row = placed.get(loc.type);
        if (row) row.n++;
        else placed.set(loc.type, { n: 1, at: `${loc.x},${loc.z},${loc.level}` });
    }
}

// -------------------------------------------------------------------------- the rocks with no script

type Rock = {
    name: string;
    model: string;
    body: number | null;
    seam: number | null;
    ore: string | null;
    candidates: string[];
    spent: boolean;
    n: number;
    at: string;
    desc: string;
};

const rocks: Rock[] = [];
for (let id = 0; id < LocType.count; id++) {
    const t = LocType.get(id);
    if (!t?.debugname) continue;
    // A Mine or a Prospect the client would draw, with nothing claiming it. Category counts:
    // a rock in mining_rock_normal is answered by [oploc1,_mining_rock_normal].
    const hasMine = t.op?.some((label, i) => isVisibleOp(label) && /^(mine|prospect)$/i.test(label) && !claimed(i, id, t.category));
    if (!hasMine) continue;
    const { body, seam } = recols(t);
    const cands = seam === null ? [] : [...(seamToOre.get(seam) ?? [])].sort();
    const p = placed.get(id);
    rocks.push({
        name: t.debugname,
        model: t.models?.length ? String(t.models[0]) : '-',
        body,
        seam,
        ore: cands.length === 1 ? cands[0] : null,
        candidates: cands,
        // regional_rocks.loc's rule, plus recol2d=0 - a seam recoloured to nothing is nothing.
        spent: seam !== null && (seam === body || seam === 0),
        n: p?.n ?? 0,
        at: p?.at ?? '-',
        desc: t.desc ?? ''
    });
}

function claimed(op: number, id: number, category: number): boolean {
    for (const base of [ServerTriggerType.OPLOC1, ServerTriggerType.APLOC1]) {
        if (ScriptProvider.getByTriggerSpecific(base + op, id, -1)) return true;
        if (category !== -1 && ScriptProvider.getByTriggerSpecific(base + op, -1, category)) return true;
    }
    return false;
}

// ----------------------------------------------------------------------------------- the report

const shown = PLACED_ONLY ? rocks.filter(r => r.n > 0) : rocks;
const byName = new Map<string, Rock>();
for (const r of shown) byName.set(r.name, r);

console.log('ROCKS WHOSE MINE OPTION DOES NOTHING');
console.log(`  ${rocks.length} locs, ${rocks.filter(r => r.n > 0).length} of them placed on the map (${rocks.reduce((a, r) => a + r.n, 0)} instances)`);
console.log(`  the seam->ore mapping was learned from ${oreOfLoc.size} rocks already in mine.dbrow, giving ${[...seamToOre].filter(([, s]) => s.size === 1).length} decisive colours`);
console.log('');

const settled = shown.filter(r => r.ore && !r.spent);
const spent = shown.filter(r => r.spent);
const open = shown.filter(r => !r.ore && !r.spent && r.seam !== null);
const norecol = shown.filter(r => r.seam === null);

const line = (r: Rock, tail: string) => `   ${r.name.padEnd(22)} ${r.model.padEnd(16)} ${String(r.n).padStart(4)}x ${r.at.padEnd(18)} ${tail}`;

console.log(`-- ore settled by seam colour (${settled.length}) - confirm, then wire as its ore`);
for (const r of settled.sort((a, b) => b.n - a.n || a.name.localeCompare(b.name))) {
    console.log(line(r, `seam ${r.seam} -> ${r.ore}`));
}

console.log(`\n-- spent rocks (${spent.length}) - no ore; these want param=mining_rock_empty,1 so the click says so`);
for (const r of spent.sort((a, b) => b.n - a.n || a.name.localeCompare(b.name))) {
    console.log(line(r, `seam ${r.seam} = body ${r.body}`));
}

console.log(`\n-- seam colour matches no wired rock (${open.length}) - NEEDS A DECISION, do not guess from the colour`);
for (const r of open.sort((a, b) => b.n - a.n || a.name.localeCompare(b.name))) {
    console.log(line(r, `seam ${r.seam}${r.candidates.length ? ` ambiguous between ${r.candidates.join('/')}` : ' unknown'}`));
}

console.log(`\n-- no recolour at all (${norecol.length}) - the description is the only evidence`);
for (const r of norecol.sort((a, b) => b.n - a.n || a.name.localeCompare(b.name))) {
    console.log(line(r, `"${r.desc}"`));
}

console.log('\nTHE PLACED CLUSTERS, LARGEST FIRST - this is the order worth working in');
console.log('  Colours below are the PACKED HSL the cache stores, not the recol1d/recol2d a .loc');
console.log('  writes - the parser converts them. They are only used here to match one rock against');
console.log('  another, which is identity either way. "already wired" is the rest of the same mine,');
console.log('  and it is how rimmington_rocks.loc settled its grid: the ore of the missing cell is');
console.log('  the one the rest of the row does not already hold.');
const byBody = new Map<string, { n: number; names: string[]; body: number | null }>();
for (const r of rocks.filter(x => x.n > 0)) {
    const key = r.seam === null ? `no recolour / "${r.desc}"` : `body ${r.body}`;
    const row = byBody.get(key) ?? { n: 0, names: [], body: r.body };
    row.n += r.n;
    row.names.push(`${r.name}(${r.n})`);
    byBody.set(key, row);
}
/** Every rock already in an ore table that shares this body colour - the rest of the same mine. */
function wiredSiblings(body: number | null): string[] {
    if (body === null) return [];
    const out: string[] = [];
    for (const [loc, ore] of oreOfLoc) {
        const id = LocType.getId(loc);
        if (id === -1) continue;
        if (recols(LocType.get(id)).body === body) out.push(`${loc}=${ore}`);
    }
    return out.sort();
}

for (const [key, row] of [...byBody].sort((a, b) => b[1].n - a[1].n)) {
    console.log(`   ${String(row.n).padStart(4)} instances  ${key}`);
    console.log(`        dead: ${row.names.join(' ')}`);
    const sibs = wiredSiblings(row.body);
    console.log(`        already wired in the same mine: ${sibs.length ? sibs.join(' ') : '(none - this mine has no working rock at all)'}`);
}

process.exit(0);
