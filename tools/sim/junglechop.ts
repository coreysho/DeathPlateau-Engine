// APE ATOLL'S TWO JUNGLE TREES, which were placed 123 times with a Chop-down that did nothing.
//
// `mm_bush_kharazi_jungle_tree1` (37 instances) and `_tree2` (86) carry op1=Chop-down + op3=hidden,
// the exact pair every working tree in this build carries, and each has its own `_stump` loc - but
// neither had `category=tree`, so `[oploc1,_tree]` never saw the click and `~displaymessage` said
// nothing interesting happened. 123 trees a player can walk up to on Ape Atoll.
//
// This sim is the evidence as much as the test. It asserts the three things that said these two are
// ordinary woodcutting trees and the rest of the jungle is scenery:
//
//   1. every OTHER jungletree1/jungletree2 loc in the build has no op at all,
//   2. they BLOCK, where the Legends' Quest hack-through jungle is all blockwalk=no,
//   3. antimacro.npc has an Ent npc drawn for each of them, which only a woodcutting tree gets.
//
// and then chops one of each and one Ent of each, through the real handlers.
//
//   npx tsx tools/sim/junglechop.ts
import * as H from './harness.js';
import { walkable } from './a1lib.js';
import LocType from '#/cache/config/LocType.js';
import NpcType from '#/cache/config/NpcType.js';
import ParamType from '#/cache/config/ParamType.js';
import CategoryType from '#/cache/config/CategoryType.js';
import World from '#/engine/World.js';

await H.boot();

let ok = 0;
let bad = 0;
const check = (what: string, got: unknown, want: unknown) => {
    if (JSON.stringify(got) === JSON.stringify(want)) {
        ok++;
        console.log('  ok   ' + what + ': ' + JSON.stringify(got));
    } else {
        bad++;
        console.log('  FAIL ' + what + ': ' + JSON.stringify(got) + '   (want ' + JSON.stringify(want) + ')');
    }
};

const locParam = (locName: string, paramName: string): string | null => {
    const type = LocType.get(LocType.getId(locName));
    const raw = type.params?.get(ParamType.getId(paramName));
    if (raw === undefined) return null;
    return LocType.get(Number(raw)).debugname ?? String(raw);
};
const category = (locName: string): string | null => {
    const type = LocType.get(LocType.getId(locName));
    return type.category === -1 ? null : (CategoryType.get(type.category)?.debugname ?? String(type.category));
};

const TREES: [string, string, string][] = [
    ['mm_bush_kharazi_jungle_tree1', 'mm_bush_kharazi_jungle_tree1_stump', 'macro_ent_jungle_tree1'],
    ['mm_bush_kharazi_jungle_tree2', 'mm_bush_kharazi_jungle_tree2_stump', 'macro_ent_jungle_tree2']
];

// ---------------------------------------------------------------- the evidence

console.log('-- the rest of the jungle is scenery, so the Chop-down on these two is deliberate');
// Found by model, not by a remembered list: every loc in the build drawn with one of the two
// jungle-tree models, whatever it is called. If somebody adds a third choppable jungle tree this
// goes red rather than going quiet.
const jungleModels = new Set<number>();
for (const seed of ['jungletree1', 'jungletree2']) {
    for (const m of LocType.get(LocType.getId(seed)).models ?? []) {
        jungleModels.add(m);
    }
}
check('the two jungle-tree models were found', jungleModels.size, 2);
const sameModel: string[] = [];
for (const [name, id] of LocType.configNames) {
    if ((LocType.get(id).models ?? []).some(m => jungleModels.has(m))) sameModel.push(name);
}
check('and locs are drawn with them', sameModel.length > 10, true);
// The general statement, which is what opsweep was reporting: a jungle tree either has no option at
// all, or it has a category that answers it. `tree` is woodcut.rs2, `jungle_tree` is Legends'
// Quest's machete jungle. Anything else is a Chop-down that does nothing.
for (const name of sameModel.sort()) {
    const chop = LocType.get(LocType.getId(name)).op?.[0] ?? null;
    check(`${name}: ${chop === null ? 'scenery, no option' : chop + ' answered by'}`, chop === null ? 'scenery' : category(name), chop === null ? 'scenery' : category(name) === 'tree' ? 'tree' : 'jungle_tree');
}

console.log('');
console.log('-- and they block, where the Legends hack-through jungle does not');
for (const [tree] of TREES) {
    check(`${tree} blocks walking`, LocType.get(LocType.getId(tree)).blockwalk, true);
}
for (const kharazi of ['kharazi_jungle_tree1', 'kharazi_jungle_tree2', 'kharazi_jungle_plant1', 'kharazi_jungle_plant2']) {
    check(`${kharazi} does not, so a player stands inside it`, LocType.get(LocType.getId(kharazi)).blockwalk, false);
}

console.log('');
console.log('-- the wiring itself');
for (const [tree, stump, ent] of TREES) {
    const type = LocType.get(LocType.getId(tree));
    check(`${tree} op1`, type.op?.[0] ?? null, 'Chop-down');
    check('  and op3 is hidden, so p_oploc(3) can keep it swinging', type.op?.[2] ?? null, 'hidden');
    check('  category', category(tree), 'tree');
    check('  next_loc_stage', locParam(tree, 'next_loc_stage'), stump);
    check(
        '  ent',
        (() => {
            const raw = type.params?.get(ParamType.getId('ent'));
            return raw === undefined ? null : (NpcType.get(Number(raw)).debugname ?? String(raw));
        })(),
        ent
    );
    // The back-link. attempt_cut_ent does db_find(woodcutting_trees:tree, npc_param(ent_tree_loc)),
    // so an ent whose ent_tree_loc is null or names a loc with no dbrow row says "Nothing
    // interesting happens" when you chop it.
    const entType = NpcType.get(NpcType.getId(ent));
    const back = entType.params?.get(ParamType.getId('ent_tree_loc'));
    check(`  ${ent} points back at it`, back === undefined ? null : (LocType.get(Number(back)).debugname ?? String(back)), tree);
}

// ---------------------------------------------------------------- chopping it

console.log('');
console.log('-- chopping one of each, on the map, through [oploc1,_tree]');
const p: any = H.makePlayer('jungle', 2730, 2725);
H.tick(2);
H.maxOut(p);
H.clearInv(p);
H.give(p, 'rune_axe', 1);
H.tick(1);

for (const [tree, stump] of TREES) {
    const spots = H.locsNear(tree, 2730, 2725, 0);
    check(`${tree} is placed on the map`, spots.length > 0, true);
    if (!spots.length) continue;
    const { x, z } = spots[0];
    // Stand beside it rather than on it: these block, so a route onto the tile does not exist.
    let stood = false;
    for (const [dx, dz] of [
        [2, 0],
        [-2, 0],
        [0, 2],
        [0, -2],
        [3, 0],
        [0, 3]
    ]) {
        if (walkable(0, x + dx, z + dz)) {
            p.teleport(x + dx, z + dz, 0);
            stood = true;
            break;
        }
    }
    check(`  a player can stand beside the one at ${x},${z}`, stood, true);
    H.tick(2);
    const before = H.invCount(p, 'logs');
    const mark = H.mesgs.length;
    H.opLoc(p, x, z, tree, 1);
    for (let t = 0; t < 60 && H.invCount(p, 'logs') === before; t++) H.tick(1);
    check('  chopping it gives logs', H.invCount(p, 'logs') - before, 1);
    const said = H.mesgs
        .slice(mark)
        .map(m => m.text)
        .filter(t => /interesting|logs|axe/i.test(t));
    check(
        '  and never says nothing interesting happens',
        said.some(t => /interesting/i.test(t)),
        false
    );
    // a normal tree (respawnrate 0 in the dbrow) always falls on the first success
    const stumpId = LocType.getId(stump);
    const fell = [...World.gameMap.getZone(x, z, 0).getAllLocsSafe()].some(l => l.x === x && l.z === z && l.type === stumpId);
    check(`  and the tree becomes ${stump}`, fell, true);
    H.clearInv(p);
    H.give(p, 'rune_axe', 1);
    H.tick(1);
}

// ---------------------------------------------------------------- and its Ent

// An Ent gives NO logs - it is the woodcutting anti-macro event, and what it does after six chops
// is break your axe. The reason it belongs in this sim is that the only thing standing between
// "That's not a tree, it's an Ent!" and "Nothing interesting happens." is
// `db_find(woodcutting_trees:tree, npc_param(ent_tree_loc))` in cut_ent: an ent whose ent_tree_loc
// is null, or names a loc with no dbrow row, falls straight through to dm_default. Both of these
// ents were in that state - tree1's ent_tree_loc named a loc that had no row, and tree2 had no
// ent_tree_loc at all.
console.log('');
console.log('-- and the Ent each tree can spawn, through [opnpc1,_macro_event_ent]');
for (const [, , ent] of TREES) {
    p.teleport(2730, 2740, 0);
    H.clearInv(p);
    H.give(p, 'rune_axe', 1);
    H.setVar(p, 'macro_ent_counter', 0);
    H.tick(2);
    const npc = H.addNpc(ent, 2731, 2740);
    H.tick(1);
    const mark = H.mesgs.length;
    for (let t = 0; t < 120 && H.invCount(p, 'macro_broken_rune_hatchet') === 0; t++) {
        if (!p.delayed && !p.activeScript) H.opNpc(p, npc, 1);
        H.tick(1);
    }
    const said = H.mesgs.slice(mark).map(m => m.text);
    check(
        `chopping ${ent} never says nothing interesting happens`,
        said.some(t => /interesting/i.test(t)),
        false
    );
    check(
        '  it is an Ent, and says so',
        said.some(t => t === "That's not a tree, it's an Ent!"),
        true
    );
    check('  and the axe comes out broken', H.invCount(p, 'macro_broken_rune_hatchet'), 1);
    check('  and no logs, because an Ent is not a tree', H.invCount(p, 'logs'), 0);
    npc.isActive = false;
}

console.log('');
console.log(ok + ' ok, ' + bad + ' FAIL');
process.exit(bad ? 1 : 0);
