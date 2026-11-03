// EVERY LADDER AND STAIRCASE THAT DOES NOTHING, and whether a plain vertical link would be right.
//
//   npx tsx tools/sim/deadladders.ts
//   npx tsx tools/sim/deadladders.ts --certain     only the ones with a partner at the far end
//
// tools/sim/deadcategory.ts says 47 placed locs offer Climb-up, Climb-down or Climb and have no
// script to answer it - the second largest live bucket in opsweep after the mining rocks, and the
// most consequential kind, because a ladder that does nothing is a room nobody can get into.
//
// THE FIX LOOKS LIKE ONE LINE AND IS NOT. ladders.rs2 has a generic handler - [oploc1,_ladder_up]
// and [oploc1,_ladder_down], used today by exactly two locs on Lunar Isle - and it does the naive
// thing: `~climb_ladder(movecoord(coord(), 0, +-1, 0))`, straight up or down from the tile the
// player is standing on. For a ladder between two floors of a house that is exactly right. For a
// dungeon entrance it is wrong, and ~climb_ladder does not validate: it p_telejumps, so a wrong
// destination puts the player inside a wall. Several of these names - chickenquest_chamber_exit,
// champions_arenaladder, fairy_ladder_wind_up - are clearly links between places that are nowhere
// near each other vertically.
//
// SO THIS CLASSIFIES RATHER THAN DECIDES, the way deadrocks.ts does for the rocks. For each dead
// ladder, at each place the map puts one, it asks:
//
//   1. is the tile one level up or down from it somewhere a player can stand?
//   2. is there a LADDER OF THE OPPOSITE DIRECTION within two tiles of that destination?
//
// Both true is the strong case: two ladders facing each other across one floor is what a plain
// vertical link looks like, and `category=ladder_up` / `ladder_down` would be right. Only (1) is
// the weak case - the ground is clear, but nothing says the far end belongs to this ladder.
// Neither means the destination is somewhere else entirely and the ladder needs its own
// [oploc1,name] with the coordinates written out, which is what most of ladders.rs2 already is.
//
// A SHARED MODEL OUTRANKS ALL OF IT, and is the reason this tool does not just print the category.
// ahoy_ghostshipladder_angled sits directly below ahoy_ghostshipladder_top_angled, so rule (2)
// passes and `category=ladder_up` looks right - and it is wrong, because its model is
// `shipladder_angled`, whose handler steps TWO TILES OUT in the direction the ladder faces before
// changing level. ladders.rs2's own comment says so. So every row names the wired ladder that
// shares its model, where there is one and there are not many, and that ladder is what to copy.
// Only a model used by a FEW wired ladders counts: the plain ladder model is drawn by eleven of
// them, each with a trigger of its own, so sharing it says nothing but "this is a ladder".
//
// AND ONE MORE THING THE CATEGORY CANNOT DO, which the first version of this got wrong: the
// generic handler lives on op1 only, and a loc carries one category. A ladder in the middle of
// three floors has Climb-up on one slot and Climb-down on another, so no category can answer both.
// Those get their own section rather than a half-fix.
import * as H from './harness.js';
import { walkable } from './a1lib.js';
import CategoryType from '#/cache/config/CategoryType.js';
import { isVisibleOp } from '#/cache/config/OpVisibility.js';
import LocType from '#/cache/config/LocType.js';
import ScriptProvider from '#/engine/script/ScriptProvider.js';
import ServerTriggerType from '#/engine/script/ServerTriggerType.js';
import World from '#/engine/World.js';

const CERTAIN_ONLY = process.argv.slice(2).includes('--certain');

await H.boot();

/** Ladders that already work, indexed by model - what to copy when a dead one shares a model. */
const wiredByModel = new Map<number, string[]>();
for (let id = 0; id < LocType.count; id++) {
    const type = LocType.get(id);
    if (!type?.op || !type.debugname) continue;
    for (let op = 0; op < type.op.length; op++) {
        const label = type.op[op];
        if (!label || !isVisibleOp(label)) continue;
        if (!/^climb/i.test(label)) continue;
        const own = !!ScriptProvider.getByTriggerSpecific(ServerTriggerType.OPLOC1 + op, id, -1);
        const byCat = type.category !== -1 && !!ScriptProvider.getByTriggerSpecific(ServerTriggerType.OPLOC1 + op, -1, type.category);
        if (!own && !byCat) continue;
        const how = own ? `[oploc1,${type.debugname}]` : `category=${CategoryType.get(type.category)?.debugname}`;
        for (const m of type.models ?? []) {
            const list = wiredByModel.get(m) ?? [];
            if (!list.includes(how)) list.push(how);
            wiredByModel.set(m, list);
        }
    }
}

function claimed(trigger: number, type: number, category: number): boolean {
    if (ScriptProvider.getByTriggerSpecific(trigger, type, -1)) {
        return true;
    }
    return category !== -1 && !!ScriptProvider.getByTriggerSpecific(trigger, -1, category);
}

/** Which way a label goes, or null when it is not a vertical move at all. */
function direction(label: string): 1 | -1 | 0 | null {
    const l = label.toLowerCase();
    if (/^climb[- ]?up$/.test(l) || /^climb[- ]?up\b/.test(l)) return 1;
    if (/^climb[- ]?down$/.test(l)) return -1;
    if (/^climb(-over)?$/.test(l)) return 0;
    return null;
}

// ------------------------------------------------------- every placed ladder, dead or alive

type Place = { type: number; x: number; z: number; level: number };
const placed: Place[] = [];
for (const zone of World.gameMap.existingZones()) {
    for (const loc of zone.getAllLocsUnsafe()) {
        placed.push({ type: loc.type, x: loc.x, z: loc.z, level: loc.level });
    }
}

/** Every placed loc offering a vertical move, with which way it goes - the partner index. */
type Climb = Place & { dir: 1 | -1 | 0; label: string };
const climbs: Climb[] = [];
for (const p of placed) {
    const type = LocType.get(p.type);
    for (const label of type?.op ?? []) {
        if (!label || !isVisibleOp(label)) continue;
        const dir = direction(label);
        if (dir === null) continue;
        climbs.push({ ...p, dir, label });
    }
}

// ----------------------------------------------------------------------------- the dead ones

type Row = { name: string; op: number; label: string; dir: number; instances: number; clear: number; partnered: number; offset: number; where: string; partner: string | null; sameModel: string[] };
const rows = new Map<string, Row>();
for (const p of placed) {
    const type = LocType.get(p.type);
    if (!type?.op || !type.debugname) continue;
    for (let op = 0; op < type.op.length; op++) {
        const label = type.op[op];
        if (!label || !isVisibleOp(label)) continue;
        const dir = direction(label);
        if (dir === null || dir === 0) continue;
        if (claimed(ServerTriggerType.OPLOC1 + op, p.type, type.category) || claimed(ServerTriggerType.APLOC1 + op, p.type, type.category)) continue;

        const key = `${type.debugname} op${op + 1}`;
        let row = rows.get(key);
        if (!row) {
            const sameModel = [...new Set([...(type.models ?? [])].flatMap(m => wiredByModel.get(m) ?? []))];
            row = { name: type.debugname, op: op + 1, label, dir, instances: 0, clear: 0, partnered: 0, offset: 0, where: `${p.x},${p.z},${p.level}`, partner: null, sameModel };
            rows.set(key, row);
        }
        row.instances++;
        const to = p.level + dir;
        if (to < 0 || to > 3) continue;
        // The destination the generic handler would pick, give or take the tile the player ends up
        // standing on - so the loc's own footprint and the ring around it, one level away.
        let clear = false;
        for (let dx = -1; dx <= 1 && !clear; dx++) {
            for (let dz = -1; dz <= 1 && !clear; dz++) {
                if (walkable(to, p.x + dx, p.z + dz)) clear = true;
            }
        }
        if (!clear) continue;
        row.clear++;
        // THE PARTNER MUST BE ON THE SAME TILE, not near it. This said "within two tiles" and the
        // three Lunar Isle ladders it then recommended carry a comment in lunar_isle.loc saying
        // somebody had already tried exactly that and reverted it: their other half is ONE tile
        // away, the direction varies by placement, and _ladder_up / _ladder_down mean "same tile,
        // one level" - so it teleported players into the wall between the two halves. A partner one
        // tile off is evidence AGAINST the generic category, not for it.
        const mate = climbs.find(c => c.level === to && c.dir === -dir && c.x === p.x && c.z === p.z);
        const nearby = climbs.find(c => c.level === to && c.dir === -dir && Math.max(Math.abs(c.x - p.x), Math.abs(c.z - p.z)) <= 2);
        if (mate) {
            row.partnered++;
            row.partner ??= `${LocType.get(mate.type).debugname} "${mate.label}" at ${mate.x},${mate.z},${mate.level}`;
        } else if (nearby) {
            row.offset++;
            row.partner ??= `${LocType.get(nearby.type).debugname} "${nearby.label}" at ${nearby.x},${nearby.z},${nearby.level} - OFF BY ${Math.max(Math.abs(nearby.x - p.x), Math.abs(nearby.z - p.z))} TILES`;
        }
    }
}

const list = [...rows.values()].sort((a, b) => b.partnered - a.partnered || b.instances - a.instances || a.name.localeCompare(b.name));

// THE GENERIC HANDLER IS ON op1 AND ONLY op1 - `[oploc1,_ladder_up]`, `[oploc1,_ladder_down]` -
// and a loc carries ONE category. So a ladder in the middle of three floors, with Climb-up on one
// slot and Climb-down on another, cannot be wired this way at all however clear its two
// destinations are: whichever category it took would answer one option and leave the other dead.
// ladders.rs2 already has the shape those want, [label,ladder_options], which asks which way.
// elf_village_ladder_mid and wild_ladder_middle are both of these, and the first version of this
// tool put them in the confident list, which would have been a half-fix presented as a whole one.
const bothWays = new Set<string>();
const seenDir = new Map<string, Set<number>>();
for (const r of list) {
    const dirs = seenDir.get(r.name) ?? new Set<number>();
    dirs.add(r.dir);
    seenDir.set(r.name, dirs);
    if (dirs.size > 1) bothWays.add(r.name);
}
const canTakeCategory = (r: Row) => r.op === 1 && !bothWays.has(r.name);

// A dead ladder whose model belongs to a FEW wired ladders is one of them, and that outranks the
// partner test. "A few" is the whole of it: the plain ladder model is drawn by a dozen ladders that
// each have their own trigger, so sharing it says only "this is a ladder". The same mistake as
// worn_rig's in content's skilltools_battery, made again here and caught the same way - a model is
// evidence when it is distinctive and a histogram when it is not. shipladder_angled is shared with
// two; the ordinary ladder with eleven.
const DISTINCTIVE = 3;
const copyWired = list.filter(r => r.sameModel.length > 0 && r.sameModel.length <= DISTINCTIVE && r.sameModel.some(h => h.startsWith('[oploc1,')));
const certain = list.filter(r => !copyWired.includes(r) && r.partnered === r.instances && r.instances > 0 && canTakeCategory(r));
const twoWay = list.filter(r => !certain.includes(r) && !copyWired.includes(r) && (bothWays.has(r.name) || r.op !== 1));
const offsetPartner = list.filter(r => !certain.includes(r) && !twoWay.includes(r) && !copyWired.includes(r) && r.offset > 0);
const maybe = list.filter(r => !certain.includes(r) && !twoWay.includes(r) && !copyWired.includes(r) && !offsetPartner.includes(r) && r.clear > 0);
const elsewhere = list.filter(r => !certain.includes(r) && !twoWay.includes(r) && !copyWired.includes(r) && !offsetPartner.includes(r) && r.clear === 0);

console.log(`${list.length} placed locs offer Climb-up or Climb-down with no script to answer it`);
console.log(`  ${copyWired.length} share a DISTINCTIVE model with a ladder that has its own trigger - copy that one`);
console.log(`  ${certain.length} take the generic category: one direction, on op1, with a partner at the far end of EVERY instance`);
console.log(`  ${twoWay.length} go both ways or hang off op2+, so no single category can answer them`);
console.log(`  ${offsetPartner.length} have a partner ONE OR TWO TILES OFF, which rules the generic category OUT - they need an angle-aware trigger`);
console.log(`  ${maybe.length} have clear ground one level away but no partner there`);
console.log(`  ${elsewhere.length} have nothing standable one level away, so they go somewhere else entirely`);
console.log('');
console.log(`the generic handler is category=ladder_up / ladder_down in ladders.rs2; ${CategoryType.getId('ladder_up') === -1 ? 'MISSING' : 'present'}`);
console.log('');

const show = (title: string, rs: Row[], note: string): void => {
    if (!rs.length) return;
    console.log(`-- ${title} (${rs.length})`);
    console.log(`   ${note}`);
    for (const r of rs) {
        console.log(`   ${r.name} op${r.op}="${r.label}"  x${r.instances} at ${r.where}`);
        if (r.sameModel.length && r.sameModel.length <= DISTINCTIVE) console.log(`      same model as: ${r.sameModel.join(', ')}`);
        else if (r.sameModel.length) console.log(`      model shared with ${r.sameModel.length} wired ladders, so it says only "this is a ladder"`);
        if (r.partner) console.log(`      partner: ${r.partner}  (${r.partnered}/${r.instances} instances have one)`);
        else if (r.clear) console.log(`      ground is clear at ${r.clear}/${r.instances} instances, no partner`);
    }
    console.log('');
};

show('a ladder with its own trigger uses the same model', copyWired, 'copy that trigger - the generic category would send the player to the wrong tile');
show('one direction on op1, with a partner at the far end of every instance', certain, 'category=ladder_up / ladder_down is very likely right');
if (!CERTAIN_ONLY) {
    show('two directions, or not on op1', twoWay, 'one category cannot answer both - these want their own trigger, like [label,ladder_options]');
    show('a partner one or two tiles off', offsetPartner, 'NOT the generic category - see loc474_16732 in lunar_isle.loc, where that was tried and reverted');
    show('clear ground, no partner', maybe, 'read the area before wiring - the far end may belong to something else');
    show('nothing standable one level away', elsewhere, 'these need their own [oploc1,name] with the destination written out');
}
