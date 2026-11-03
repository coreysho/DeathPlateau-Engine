// EVERY ENT THE WOODCUTTING ANTI-MACRO EVENT CAN SPAWN, chopped.
//
// An Ent replaces the tree you are cutting for sixty ticks and breaks your axe on the sixth swing.
// Twenty-one of the thirty-six Ents in antimacro.npc had op1="Chop down" and NO
// category=macro_event_ent, so [opnpc1,_macro_event_ent] never saw the click and the Ent could not
// be chopped at all - including the one that spawns at an ordinary tree, an oak, a willow, a yew, a
// maple and a magic tree, which is to say nearly every tree a player cuts.
//
// It was in the opsweep baseline the whole time, filed under "not placed anywhere on the map,
// nobody can reach them today" - because an Ent is never placed on the map, it is npc_add'ed by
// macro_event_ent_spawn. That bucket means "unreachable" for scenery and means nothing at all for
// an npc a script spawns, which is why this was sitting in a 2,800-line report looking handled.
//
// The sim derives the list from the data rather than naming names: every loc with a chopping
// category and a param=ent, the Ent that param names, and then the chop. If somebody adds a tree
// with an Ent and forgets the category, this goes red.
//
//   npx tsx tools/sim/woodcutents.ts
import * as H from './harness.js';
import LocType from '#/cache/config/LocType.js';
import NpcType from '#/cache/config/NpcType.js';
import ParamType from '#/cache/config/ParamType.js';
import CategoryType from '#/cache/config/CategoryType.js';
import { MoveRestrict } from '#/engine/entity/MoveRestrict.js';

await H.boot();

let ok = 0;
let bad = 0;
const check = (what: string, good: boolean, detail = '') => {
    if (good) {
        ok++;
    } else {
        bad++;
        console.log('  FAIL ' + what + (detail ? ' - ' + detail : ''));
    }
};

const ENT = ParamType.getId('ent');
const ENT_TREE_LOC = ParamType.getId('ent_tree_loc');
const MACRO_EVENT_ENT = CategoryType.getId('macro_event_ent');
// The categories whose [oploc1,...] can reach ~macro_randomwoodcutting and so spawn an Ent.
const CHOPPING = new Set(['tree']);

// ------------------------------------------------- every Ent a tree in this build can spawn

type Pair = { tree: string; ent: string; entId: number };
const pairs: Pair[] = [];
for (const [locName, locId] of LocType.configNames) {
    const loc = LocType.get(locId);
    const raw = loc.params?.get(ENT);
    if (raw === undefined) continue;
    const category = loc.category === -1 ? null : (CategoryType.get(loc.category)?.debugname ?? null);
    if (!category || !CHOPPING.has(category)) continue;
    const entId = Number(raw);
    pairs.push({ tree: locName, ent: NpcType.get(entId).debugname ?? String(entId), entId });
}
pairs.sort((a, b) => a.ent.localeCompare(b.ent));
console.log(`${pairs.length} trees in this build carry param=ent and a category that can spawn it`);
check('and there are more than a handful of them', pairs.length > 20, String(pairs.length));

// ------------------------------------------------- the wiring, then the chop

const p: any = H.makePlayer('ents', 3222, 3218);
H.tick(2);
p.applyDamage = function () {};
H.maxOut(p);
H.tick(1);

// Somewhere empty, so no real npc or loc is in the way of a spawned Ent.
const SPOT = [3222, 3218];
let chopped = 0;

for (const { tree, ent, entId } of pairs) {
    const type = NpcType.get(entId);
    const cat = type.category === -1 ? null : (CategoryType.get(type.category)?.debugname ?? null);
    check(`${ent} (at ${tree}) carries category=macro_event_ent`, type.category === MACRO_EVENT_ENT, `category=${cat}`);
    const back = type.params?.get(ENT_TREE_LOC);
    check(`${ent} names its tree in param=ent_tree_loc`, back !== undefined && Number(back) === LocType.getId(tree), back === undefined ? 'no ent_tree_loc' : `points at ${LocType.get(Number(back)).debugname}`);
    check(`${ent} offers Chop down on op1`, type.op?.[0] === 'Chop down', JSON.stringify(type.op?.[0]));
    // An Ent stands where its tree was. One that wanders walks out of its own inviswalls.
    check(`${ent} does not wander off`, type.moverestrict === MoveRestrict.NOMOVE && type.wanderrange === 0, `moverestrict=${type.moverestrict} wanderrange=${type.wanderrange}`);

    // and now chop it, with a rune axe, through [opnpc1,_macro_event_ent]
    H.clearInv(p);
    H.give(p, 'rune_axe', 1);
    H.setVar(p, 'macro_ent_counter', 0);
    p.teleport(SPOT[0], SPOT[1], 0);
    H.tick(2);
    const npc = H.addNpc(ent, SPOT[0] + 1, SPOT[1]);
    H.tick(1);
    const mark = H.mesgs.length;
    for (let t = 0; t < 120 && H.invCount(p, 'macro_broken_rune_hatchet') === 0; t++) {
        if (!p.delayed && !p.activeScript) H.opNpc(p, npc, 1);
        H.tick(1);
    }
    const said = H.mesgs.slice(mark).map(m => m.text);
    const broke = H.invCount(p, 'macro_broken_rune_hatchet') === 1;
    check(`chopping ${ent} breaks the axe and says so`, broke && said.includes("That's not a tree, it's an Ent!"), said.length ? JSON.stringify(said.slice(0, 3)) : 'said nothing at all');
    check(`chopping ${ent} never says nothing interesting happens`, !said.some(t => /interesting/i.test(t)));
    check(`chopping ${ent} gives no logs`, H.invCount(p, 'logs') === 0, String(H.invCount(p, 'logs')));
    if (broke) chopped++;
    npc.isActive = false;
    H.tick(1);
}

console.log(`${chopped} of ${pairs.length} Ents chopped through the real handler`);

// ------------------------------------------------- and the ones left out, on purpose

// An Ent with no param=ent_tree_loc must NOT carry the dispatching category: cut_ent would find no
// dbrow row and say "Nothing interesting happens." Spare cache slots are better left silent.
console.log('');
for (const [name, id] of NpcType.configNames) {
    const type = NpcType.get(id);
    if (type.category !== MACRO_EVENT_ENT) continue;
    const back = type.params?.get(ENT_TREE_LOC);
    check(`${name} carries the dispatching category, so it has an ent_tree_loc`, back !== undefined);
    if (back === undefined) continue;
    // and that loc must be a tree the woodcutting table knows, or cut_ent falls through to dm_default
    const treeName = LocType.get(Number(back)).debugname ?? String(back);
    const reachable = pairs.some(pr => pr.tree === treeName);
    check(`${name}'s tree ${treeName} can actually spawn it`, reachable);
}

console.log('');
console.log(ok + ' ok, ' + bad + ' FAIL');
process.exit(bad ? 1 : 0);
