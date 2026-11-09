// THE QUEST HELPER'S STEP TABLE, read out of the sim manifests that already prove it.
//
//   npx tsx tools/quest/ExportHelper.ts [out.json]
//
// WHY THE MANIFESTS AND NOT A NEW FILE. tools/sim/quest_*_run.ts already holds, for 108 quests,
// the ordered steps a player takes: who to talk to, which loc to click and where it is, what to be
// carrying, and - in `stage:` markers - the value of the quest's own varp after each leg. That is
// a quest helper's data exactly, and the nightly job RUNS it: a wrong coordinate or a renamed npc
// fails a sim. A hand-written helper script would be a second copy of the same knowledge with
// nothing checking it, which is how RuneLite's helpers drift from the game.
//
// READ WITH THE TYPESCRIPT AST, not by importing. Each manifest is a `const m: Manifest` inside a
// script whose first statement is `await H.boot()`, so importing one boots a world for forty
// seconds and the object is not exported anyway. The literals are static data - strings, numbers,
// arrays, nested objects - so the compiler's own parser reads them with no engine in the room, and
// nothing in tools/sim has to change to be exportable.
//
// WHAT IS DROPPED, and why the helper is not just the manifest re-emitted. A manifest is written
// for a robot that can teleport and set varps:
//
//   setpos   927 of them - a teleport to the start of a leg. A player walks; this becomes a
//            "travel to" marker rather than an instruction, because the manifest deliberately
//            does NOT record the route (the sims assert reachability separately).
//   stage    841 - the robot writing the quest's varp to skip ahead. These are the SEGMENT KEYS
//            here, not steps: everything between two of them is what you do at that stage.
//   rng      the dice pinned for a step. Meaningless to a player.
//   wait     a tick count for an animation.
//   level    a plane change the engine does; the loc click above it is the player's instruction.
//
// WHAT IS KEPT is talk/loc/held/worn/useNpc/useObj (the clicks), has/hasnt (the item list), go
// (a real walk the sim makes on foot), and the `note` lines, which carry the wiki's own step
// wording and are what the panel shows.
import * as fs from 'fs';
import * as path from 'path';
import * as ts from 'typescript';
import NpcType from '#/cache/config/NpcType.js';
import LocType from '#/cache/config/LocType.js';
import ObjType from '#/cache/config/ObjType.js';
import VarPlayerType from '#/cache/config/VarPlayerType.js';
import VarBitType from '#/cache/config/VarBitType.js';

const SIM = path.join(import.meta.dirname, '..', 'sim');

/** A step as the helper needs it: something to do, or something to be carrying. */
type HelperStep = {
    /** What the panel shows. */
    text: string;
    /** 'talk' | 'loc' | 'obj' | 'walk' | 'note' - decides the icon and what gets highlighted. */
    kind: string;
    /** The npc or loc to highlight, by debugname, or null for a step with no target. */
    target?: string;
    /**
     * And its numeric id, which is the only form the client has.
     *
     * A plugin sees `Actor.npcId` and `SceneLoc.id`; debugnames exist on the server and are not
     * in the cache the client loads, and `ctx.getLocName` answers the display name ("Door"), of
     * which there are hundreds. So the name is resolved here, where NpcType and LocType are
     * already loaded, and the step carries the number. An unresolved name leaves this -1 and the
     * step still shows its text - it just cannot be highlighted.
     */
    id?: number;
    /**
     * What a PLAYER calls it: "Door", "Restless ghost", "Ghostspeak amulet".
     *
     * The debugname is the server's handle and some of them say nothing to anybody - the panel
     * read "loc 1530" and "ghostx" where it meant a churchyard door and the ghost. The cache has
     * the display name and the exporter has the cache, so it is resolved here; the client's
     * getLocName could answer for locs but there is no equivalent for an npc that is not already
     * standing in the scene, which is exactly the one the step is sending you to find.
     */
    label?: string;
    /** Where it is, when the manifest says. */
    at?: number[];
    /** Which right-click option, when it is not the first. */
    op?: number;
    /** Dialogue options to choose, in order. */
    picks?: string[];
};

type HelperStage = {
    /** The quest varp value this leg begins at. */
    from: number;
    /**
     * The wiki headings for this leg, in the order they appear.
     *
     * A LIST, because a leg often spans two of them and because a single `heading` put every
     * quest's wording one leg late: "wiki step 1: Father Aereck" sits BEFORE the talk step it
     * introduces and before the `stage:` that closes the leg, so holding it for the next stage
     * described Father Aereck above the walk to Father Urhney's shack. A heading describes the
     * steps that follow it inside the leg it is written in, and nothing else.
     */
    headings: string[];
    steps: HelperStep[];
    /**
     * Everything the player must be holding by the end of this leg, with the obj id.
     *
     * The id is what makes the list a CHECKLIST rather than a note: the plugin ticks a row off
     * with ctx.countObj(id), which needs the number. Emitted as strings at first, which left the
     * panel unable to tell "you need a hammer" from "you have one".
     */
    items: { name: string; id: number; n: number }[];
    /** What must be WORN by the end of it - an equip is a different instruction from a carry. */
    worn: { name: string; id: number }[];
};

type HelperQuest = {
    /** The varp or varbit id behind stageVar, for the same reason step ids exist. */
    stageVarId?: number;
    /** True when stageVar is a varbit rather than a varp - the client reads them differently. */
    stageIsVarbit?: boolean;
    id: string;
    name: string;
    source: string;
    stageVar: string;
    done: number;
    start: number[];
    stages: HelperStage[];
};

// ---------------------------------------------------------------- reading the literal

/**
 * Named coordinates out of a sim file's own top-level consts.
 *
 * Most manifests do not write a tile twice: they declare `const NARNODE = [2466, 3495, 0]` and
 * then use the name, which is how a reader can tell "back to the King" from "to Glough". Without
 * resolving those, 86 of the 108 manifests read as non-static and the export covered a fifth of
 * the quests - the identifier is the ONLY thing that was not a literal in most of them.
 */
function constants(src: ts.SourceFile): Map<string, unknown> {
    const env = new Map<string, unknown>();
    for (const st of src.statements) {
        if (!ts.isVariableStatement(st)) continue;
        for (const d of st.declarationList.declarations) {
            if (!ts.isIdentifier(d.name) || !d.initializer) continue;
            const v = literal(d.initializer, env);
            if (v !== undefined) env.set(d.name.text, v);
        }
    }
    return env;
}

/** A literal node to a plain JS value, or undefined for anything that is not static data. */
function literal(node: ts.Node, env?: Map<string, unknown>): unknown {
    if (ts.isIdentifier(node)) return env?.get(node.text);
    if (ts.isStringLiteralLike(node)) return node.text;
    if (ts.isNumericLiteral(node)) return Number(node.text);
    if (node.kind === ts.SyntaxKind.TrueKeyword) return true;
    if (node.kind === ts.SyntaxKind.FalseKeyword) return false;
    if (node.kind === ts.SyntaxKind.NullKeyword) return null;
    // `-1` is a prefix expression, not a numeric literal, and coordinates use it.
    if (ts.isPrefixUnaryExpression(node) && node.operator === ts.SyntaxKind.MinusToken) {
        const inner = literal(node.operand, env);
        return typeof inner === 'number' ? -inner : undefined;
    }
    // `1 << 2` for the bitfield stages.
    if (ts.isBinaryExpression(node)) {
        const l = literal(node.left, env);
        const r = literal(node.right, env);
        if (typeof l !== 'number' || typeof r !== 'number') return undefined;
        if (node.operatorToken.kind === ts.SyntaxKind.LessThanLessThanToken) return l << r;
        if (node.operatorToken.kind === ts.SyntaxKind.PlusToken) return l + r;
        if (node.operatorToken.kind === ts.SyntaxKind.MinusToken) return l - r;
        return undefined;
    }
    if (ts.isAsExpression(node) || ts.isParenthesizedExpression(node)) return literal(node.expression, env);
    // TOWER_CORNER[0] - a tile named once and then indexed, which is how the manifests write
    // "two tiles east of the corner". 1257 of these, the single commonest non-literal.
    if (ts.isElementAccessExpression(node)) {
        const obj = literal(node.expression, env);
        const idx = literal(node.argumentExpression, env);
        if (Array.isArray(obj) && typeof idx === 'number') return obj[idx];
        return undefined;
    }
    if (ts.isArrayLiteralExpression(node)) {
        const out: unknown[] = [];
        for (const el of node.elements) {
            const v = literal(el, env);
            if (v === undefined) return undefined;
            out.push(v);
        }
        return out;
    }
    if (ts.isObjectLiteralExpression(node)) {
        const out: Record<string, unknown> = {};
        for (const prop of node.properties) {
            if (!ts.isPropertyAssignment(prop)) return undefined;
            const key = ts.isIdentifier(prop.name) || ts.isStringLiteralLike(prop.name) ? prop.name.text : undefined;
            if (key === undefined) return undefined;
            const v = literal(prop.initializer, env);
            if (v === undefined) return undefined;
            out[key] = v;
        }
        return out;
    }
    return undefined;
}

/**
 * The `const m: Manifest = {...}` out of one sim file, or null when it has none.
 *
 * A manifest that SPREADS A FUNCTION CALL into its steps - `...southIn()`, and there are 107 of
 * them - cannot be read without running the generator, and a quest exported without those steps
 * would have a silent hole in the middle of it. A helper that quietly skips three steps is worse
 * than one that admits it does not know the quest, so those are refused here and named in the
 * report rather than half-exported.
 */
function manifestOf(file: string): Record<string, unknown> | null {
    const src = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.ESNext, true);
    const env = constants(src);
    let decl: ts.Expression | null = null;
    const visit = (node: ts.Node) => {
        if (decl) return;
        if (ts.isVariableDeclaration(node) && node.type && node.type.getText(src) === 'Manifest' && node.initializer) {
            decl = node.initializer;
            return;
        }
        ts.forEachChild(node, visit);
    };
    ts.forEachChild(src, visit);
    if (!decl) return null;

    // A generated run of steps cannot be read without running the generator, and half a quest is
    // not a quest, so say so instead of exporting one with a hole in it.
    let spread = false;
    const findSpread = (n: ts.Node) => {
        if (ts.isSpreadElement(n)) {
            spread = true;
            return;
        }
        ts.forEachChild(n, findSpread);
    };
    findSpread(decl);
    if (spread) {
        generated.push(path.basename(file));
        return null;
    }

    const v = literal(decl, env);
    return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

/** Manifests refused because they build steps with a function call - reported, never half-read. */
const generated: string[] = [];

// ---------------------------------------------------------------- manifest to helper

// EVERY STEP KIND, CLASSIFIED ON PURPOSE. questrun's Step union has 37 members and guessing the
// kind from "the first key that is not an option" got six of them wrong - most visibly `go`, whose
// value is a TILE, so the exporter stringified [2146, 5105] into "2146,5105" and asked the cache
// for an item of that name. 668 lookups failed that way. Anything not named below still becomes a
// step and still shows its text; it just carries no target, which is the safe end of the mistake:
// a step with no highlight reads as "do this", a step with the wrong highlight points at a door in
// another kingdom.
const NPC_KINDS = new Set(['talk', 'useNpc', 'fight', 'herd', 'wakehunt']);
const LOC_KINDS = new Set(['loc', 'useLoc', 'castLoc']);
// `cast` names a spell ("magic:wind_blast"), which is neither an item nor anything standing in
// the scene, so it stays a text-only step. Left out of OBJ_KINDS deliberately rather than left to
// fail a lookup: four permanent entries in the unresolved report would hide the next real one.
const OBJ_KINDS = new Set(['held', 'take']);
/** Tiles, not names: the instruction is "be here", and `at` already carries where. */
const WALK_KINDS = new Set(['go', 'mapexit', 'sneak']);
/** The sim asserting the game agrees with it. Not instructions. */
const ASSERT_KINDS = new Set(['varis', 'count', 'zone', 'nearnpc', 'hasnt']);
/** The robot-only steps. See the header for why each one goes. */
const DROP = new Set(['stage', 'rng', 'wait', 'level', 'setpos', 'setvar', 'close', 'resume', 'press', 'say', 'sv', 'varbit', 'seed']);

/**
 * A note's wording, tidied for a player.
 *
 * The manifests write headings as "wiki step 8: Veliaf first, then the other five" - the prefix is
 * a cross-reference for whoever is comparing the sim against the guide, and it is noise in a panel.
 * The text after it is already the instruction, so the prefix comes off and the rest stays as the
 * person who read the wiki wrote it.
 */
function tidy(note: string): { heading: boolean; text: string } {
    const m = /^wiki(?: step)?s?\s*([0-9]+(?:\s*[-,and]+\s*[0-9]+)*)?\s*:?\s*(.*)$/i.exec(note.trim());
    if (m) return { heading: true, text: (m[2] || '').trim() };
    return { heading: false, text: note.trim() };
}

/**
 * A step's prose, with the tile taken off the end.
 *
 * The manifests write "across the entrance hall -> 3108,3163" so that somebody diffing the sim
 * against the map can see both. The panel draws the tile from `at`, so the arrow and the digits
 * are repetition in a one-line instruction.
 */
function prose(why: unknown): string {
    return (typeof why === 'string' ? why : '').replace(/\s*[-=]>\s*\d{3,5}\s*,\s*\d{3,5}\s*$/, '').trim();
}

function stepsOf(raw: unknown[]): { stages: HelperStage[]; dropped: Record<string, number> } {
    const dropped: Record<string, number> = {};
    const stages: HelperStage[] = [];
    let cur: HelperStage = { from: 0, headings: [], steps: [], items: [], worn: [] };

    const push = () => {
        if (cur.steps.length || cur.items.length || cur.worn.length || cur.headings.length) stages.push(cur);
    };

    for (const entry of raw) {
        if (!entry || typeof entry !== 'object') continue;
        const s = entry as Record<string, unknown>;

        // A `stage:` marker closes the current leg and opens the next one at that varp value.
        if ('stage' in s) {
            push();
            cur = { from: Number(s.stage), headings: [], steps: [], items: [], worn: [] };
            continue;
        }

        const kind = Object.keys(s).find(k => !['why', 'picks', 'op', 'at', 'want', 'tries', 'until', 'soft', 'n', 'r', 'exact', 'obj'].includes(k));
        if (!kind) continue;

        if (ASSERT_KINDS.has(kind)) {
            dropped[kind] = (dropped[kind] ?? 0) + 1;
            continue;
        }

        if (DROP.has(kind)) {
            dropped[kind] = (dropped[kind] ?? 0) + 1;
            // A setpos is still worth a line: it is the walk between two legs.
            if (kind === 'setpos' && Array.isArray(s.setpos)) {
                cur.steps.push({ text: prose(s.why) || 'Travel here.', kind: 'walk', at: s.setpos as number[] });
            }
            continue;
        }

        if (kind === 'note') {
            const { heading, text } = tidy(String(s.note));
            if (!text) continue;
            if (heading) cur.headings.push(text);
            else cur.steps.push({ text, kind: 'note' });
            continue;
        }

        // AN ASSERTION, NOT AN INSTRUCTION. `{ held: x, op: 2, why: 'wear it' }` is the click;
        // the `{ worn: x }` after it is the sim checking the click worked. Emitting both gave
        // every equip two lines, the second one invented by defaultText ("Wear amulet of
        // ghostspeak.") directly under the real one.
        if (kind === 'worn' && typeof s.why !== 'string') {
            const wid = idOf('obj', String(s.worn));
            cur.worn.push({ name: (wid >= 0 ? ObjType.get(wid)?.name : null) || String(s.worn), id: wid });
            continue;
        }

        // `give` IS THE SHOPPING LIST. It reads like an instruction and is not one: it is the sim
        // handing the player an item before a leg, which is why a run ends by printing "items the
        // run had to be handed: steel_longsword, coins x10". That list is exactly what a helper
        // means by what you need to bring, so it joins `has` rather than becoming a step telling
        // somebody to give a hammer to a hammer.
        if (kind === 'give' || kind === 'has') {
            const item = String(kind === 'give' ? s.give : s.has);
            const n = typeof s.n === 'number' ? s.n : 1;
            const id = idOf('obj', item);
            if (id < 0) unresolved.set('item:' + item, (unresolved.get('item:' + item) ?? 0) + 1);
            const shown = id >= 0 ? ObjType.get(id)?.name : null;
            const seen = cur.items.find(x => x.name === item);
            // The same item asked for twice in a leg means the larger count, not two rows.
            if (seen) seen.n = Math.max(seen.n, n);
            else cur.items.push({ name: shown || item, id, n });
            continue;
        }

        if (kind === '__never__') {
            const item = String(s.has);
            const n = typeof s.n === 'number' ? s.n : 1;
            cur.items.push(n > 1 ? `${item} x${n}` : item);
            continue;
        }

        const why = prose(s.why);
        const npc = NPC_KINDS.has(kind);
        const loc = LOC_KINDS.has(kind);
        const obj = OBJ_KINDS.has(kind);
        const walk = WALK_KINDS.has(kind);
        // `fight: ['a','b']` is one npc that changes form mid-fight; the first name is the one
        // standing there when the player arrives, so that is what gets highlighted.
        const raw = s[kind];
        const target = npc || loc || obj ? String(Array.isArray(raw) ? raw[0] : raw) : '';

        const step: HelperStep = {
            kind: npc ? 'talk' : loc ? 'loc' : walk ? 'walk' : obj ? 'obj' : 'note',
            text: why || defaultText(kind, target || String(raw))
        };
        if (target) {
            step.target = target;
            const id = npc ? idOf('talk', target) : loc ? idOf('loc', target) : idOf('obj', target);
            if (id >= 0) {
                step.id = id;
                const shown = npc ? NpcType.get(id)?.name : loc ? LocType.get(id)?.name : ObjType.get(id)?.name;
                if (shown) step.label = shown;
            } else {
                unresolved.set(kind + ':' + target, (unresolved.get(kind + ':' + target) ?? 0) + 1);
            }
        }
        if (Array.isArray(s.at)) step.at = s.at as number[];
        else if (walk && Array.isArray(raw)) step.at = raw as number[];
        if (typeof s.op === 'number') step.op = s.op;
        if (Array.isArray(s.picks)) step.picks = (s.picks as unknown[]).map(String);
        cur.steps.push(step);
    }
    push();
    return { stages, dropped };
}

function defaultText(kind: string, target: string): string {
    const pretty = String(target).replace(/_/g, ' ');
    if (kind === 'fight') return `Kill ${pretty}.`;
    if (kind === 'give') return `Give an item to ${pretty}.`;
    if (kind === 'take') return `Pick up ${pretty}.`;
    if (kind === 'cast') return `Cast ${pretty}.`;
    if (kind === 'castLoc') return `Cast a spell on ${pretty}.`;
    if (kind === 'useLoc') return `Use an item on ${pretty}.`;
    if (kind === 'use') return `Use ${pretty.replace(',', ' on ')}.`;
    if (kind === 'herd') return `Herd ${pretty}.`;
    if (kind === 'mapexit' || kind === 'sneak') return 'Go here.';
    if (kind === 'talk') return `Talk to ${pretty}.`;
    if (kind === 'loc') return `Use ${pretty}.`;
    if (kind === 'held') return `Use ${pretty} from your inventory.`;
    if (kind === 'worn') return `Wear ${pretty}.`;
    if (kind === 'useNpc') return `Use an item on ${pretty}.`;
    if (kind === 'go') return 'Walk here.';
    return pretty;
}

// ---------------------------------------------------------------- main

// The cache, without a world. World.start loads these from data/pack and then spawns 12,666 npcs
// and rolls for all of them; the four loaders are all this needs and they take no time.
ObjType.load('data/pack');
LocType.load('data/pack');
NpcType.load('data/pack');
VarPlayerType.load('data/pack');
VarBitType.load('data/pack');

/** A debugname to its cache id, by what kind of step it came from. -1 when the cache has no such name. */
function idOf(kind: string, name: string): number {
    try {
        if (kind === 'talk' || kind === 'useNpc' || kind === 'apnpc') return NpcType.getId(name);
        if (kind === 'loc' || kind === 'useLoc') return LocType.getId(name);
        return ObjType.getId(name);
    } catch {
        return -1;
    }
}

const out: HelperQuest[] = [];
const unresolved = new Map<string, number>();
const skipped: string[] = [];
const allDropped: Record<string, number> = {};

for (const file of fs
    .readdirSync(SIM)
    .filter(f => /^quest_.*_run\.ts$/.test(f))
    .sort()) {
    const m = manifestOf(path.join(SIM, file));
    if (!m || !Array.isArray(m.steps) || typeof m.stageVar !== 'string') {
        skipped.push(file);
        continue;
    }
    const { stages, dropped } = stepsOf(m.steps);
    for (const [k, v] of Object.entries(dropped)) allDropped[k] = (allDropped[k] ?? 0) + v;
    // A quest tracks progress in either a varp or a varbit, and the client reads the two
    // differently (getVarp by id; getVarbit decodes a range out of its parent varp), so which it
    // is has to travel with the number.
    let stageVarId = -1;
    let stageIsVarbit = false;
    const asVarp = VarPlayerType.getByName(m.stageVar);
    if (asVarp) {
        stageVarId = asVarp.id;
    } else {
        const asBit = VarBitType.getByName(m.stageVar);
        if (asBit) {
            stageVarId = asBit.id;
            stageIsVarbit = true;
        }
    }
    if (stageVarId < 0) unresolved.set('stageVar:' + m.stageVar, 1);
    out.push({
        stageVarId,
        stageIsVarbit,
        id: file.replace(/^quest_|_run\.ts$/g, ''),
        name: String(m.quest ?? file),
        source: String(m.source ?? ''),
        stageVar: m.stageVar,
        done: Number(m.done ?? 0),
        start: Array.isArray(m.start) ? (m.start as number[]) : [],
        stages
    });
}

const dest = process.argv[2] ?? path.join(import.meta.dirname, '..', '..', 'data', 'quests.json');
fs.mkdirSync(path.dirname(dest), { recursive: true });
fs.writeFileSync(dest, JSON.stringify({ quests: out }, null, 1));

const steps = out.reduce((a, q) => a + q.stages.reduce((b, s) => b + s.steps.length, 0), 0);
const items = out.reduce((a, q) => a + q.stages.reduce((b, s) => b + s.items.length, 0), 0);
const targets = out.reduce((a, q) => a + q.stages.reduce((b, s) => b + s.steps.filter(x => x.target).length, 0), 0);
console.log(`${out.length} quests, ${out.reduce((a, q) => a + q.stages.length, 0)} stages, ${steps} steps`);
console.log(`  ${targets} of those steps name an npc or loc to highlight, and ${items} items are listed`);
console.log(
    `  dropped as robot-only: ${Object.entries(allDropped)
        .map(([k, v]) => k + ' ' + v)
        .join(', ')}`
);
if (generated.length) console.log(`  steps built by a function, so NOT exported (${generated.length}): ${generated.join(' ')}`);
const unread = skipped.filter(f => !generated.includes(f));
if (unread.length) console.log(`  NO MANIFEST READ (${unread.length}): ${unread.join(' ')}`);
const withId = out.reduce((a, q) => a + q.stages.reduce((b, st) => b + st.steps.filter(x => typeof x.id === 'number').length, 0), 0);
const varOk = out.filter(q => (q.stageVarId ?? -1) >= 0).length;
console.log(`  ${withId} of ${targets} targets resolved to a cache id; ${varOk} of ${out.length} quests resolved their progress var`);
if (unresolved.size) {
    const worst = [...unresolved].sort((a, b) => b[1] - a[1]).slice(0, 8);
    console.log(`  unresolved names (${unresolved.size}): ${worst.map(([k, n]) => k + (n > 1 ? ' x' + n : '')).join(', ')}`);
}
console.log(`  -> ${dest}`);
process.exit(unread.length > 4 ? 1 : 0);
