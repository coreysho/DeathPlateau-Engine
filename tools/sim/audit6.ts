// Quest audit, batch 6, driven through the real content on the real map: every step that was fixed,
// and each fixed quest from start to complete where that is practical.
// Usage: npx tsx tools/sim/audit6.ts
//
// Mountain Daughter  - the rockslide landing, Hamal's tent door, the Ancient Rock's tent and the rock
//                      itself, the tall tree / pole vault / flat stones to the island, the treeline
//                      stumps to the Kendal's cave, and the Kendal as a real fight.
// Spirits of the Elid - the crevice landing and exit, the robe / lake / golem / genie doors, the two
//                      channel obstacles on their multiloc shells, the ranged shot, the genie's cave.
// Forgettable Tale   - Veldaban's first conversation, the boards in Keldagrim, the chamber landings.
// Swan Song          - the crawl-hole and the colony gate, Kathy Corkat's boat, the colony doors.
// In Search of the Myreque - the cellar landing, the false wall, the Myreque's doors and its tunnel
//                      (the original quest now, ported from PlagueCityRS 349).
import * as H from './harness.js';
import World from '#/engine/World.js';
import Player from '#/engine/entity/Player.js';
import Npc from '#/engine/entity/Npc.js';
import LocType from '#/cache/config/LocType.js';
import ObjType from '#/cache/config/ObjType.js';
import InvType from '#/cache/config/InvType.js';
import NpcType from '#/cache/config/NpcType.js';
import Component from '#/cache/config/Component.js';
import ScriptState from '#/engine/script/ScriptState.js';
import ScriptProvider from '#/engine/script/ScriptProvider.js';
import ScriptRunner from '#/engine/script/ScriptRunner.js';
import ServerTriggerType from '#/engine/script/ServerTriggerType.js';
import { Interaction } from '#/engine/entity/Interaction.js';
import { findPathToLoc, findPathToEntity, canTravel, isMapBlocked } from '#/engine/GameMap.js';
import { CollisionType } from '#/engine/routefinder/index.js';

const errors: string[] = [];
const origErr = console.error;
console.error = (...a: unknown[]) => {
    const s = a.map(String).join(' ');
    if (/script error/i.test(s)) errors.push(s);
    origErr(...a);
};

await H.boot();
H.loginOrder();

const R = { ok: 0, bad: 0 };
const check = (what: string, got: unknown, want: unknown) => {
    const pass = JSON.stringify(got) === JSON.stringify(want);
    if (pass) R.ok++;
    else R.bad++;
    console.log(`  ${pass ? 'ok  ' : 'FAIL'} ${what}: ${JSON.stringify(got)}${pass ? '' : `   (want ${JSON.stringify(want)})`}`);
};

let bucket = 1;
function player(name: string, x: number, z: number, level = 0) {
    const p = H.makePlayer(name, x, z, bucket++);
    H.tick(1);
    if (level) p.teleport(x, z, level);
    H.maxOut(p);
    H.clearInv(p);
    H.tick(1);
    return p;
}
const at = (p: Player) => [p.x, p.z, p.level];
const lastMes = (p: Player) => H.mesgs.filter(m => m.who === p.username).map(m => m.text).slice(-1)[0] ?? '';
const saidSince = (p: Player, from: number, s: string) => H.mesgs.slice(from).some(m => m.who === p.username && m.text.includes(s));
const free = (p: Player) => !isMapBlocked(p.x, p.z, p.level);

function slotOf(p: Player, objName: string) {
    const id = ObjType.getId(objName);
    const inv = p.getInventory(InvType.INV)!;
    for (let i = 0; i < inv.capacity; i++) if (inv.get(i)?.id === id) return i;
    throw new Error('not carrying ' + objName);
}

/** Let a script run out, clicking through any chat pages and taking `picks` at menus (1-based). */
function drive(p: Player, picks: number[] = [], guardTicks = 3): string[] {
    const from = H.ifaces.length;
    let idle = 0;
    for (let guard = 0; guard < 600 && idle < guardTicks; guard++) {
        const s = p.activeScript;
        if (!s || s.execution !== ScriptState.PAUSEBUTTON) {
            if (!s && !p.delayed && [...p.queue.all()].length === 0 && !p.target) idle++;
            else idle = 0;
            H.tick(1);
            continue;
        }
        idle = 0;
        const names = p.resumeButtons.map((id: number) => Component.get(id).comName ?? '');
        const open = p.modalChat === -1 ? '' : (Component.get(p.modalChat).comName ?? '');
        const multi = open.startsWith('multi') ? names.find((n: string) => n.startsWith(open + ':')) : null;
        if (multi) {
            const pick = picks.shift();
            if (pick === undefined) throw new Error('unexpected menu: ' + open);
            H.choose(p, `${multi.split(':')[0]}:com_${pick}`);
        } else {
            p.executeScript(s, true, true);
        }
    }
    if (picks.length) throw new Error('menus not reached: ' + picks.join(','));
    return H.ifaces.slice(from).filter(i => i.who === p.username && i.kind === 'text' && i.text && i.text.length > 1).map(i => i.text!);
}

function findNpc(npcName: string, p: Player): Npc {
    const npc = [p.level, 0, 1, 2, 3].map(l => H.npcNear(npcName, p.x, p.z, l)).find(n => n);
    if (!npc) throw new Error('no npc ' + npcName);
    return npc;
}

/** Talk to the nearest npc of a type, standing next to it first (for steps nobody changed). */
function talk(p: Player, npcName: string, picks: number[] = [], op = 1): string[] {
    const npc = findNpc(npcName, p);
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [2, 0], [0, 2], [-2, 0], [0, -2]]) {
        p.teleport(npc.x + dx, npc.z + dz, npc.level);
        H.tick(1);
        H.opNpc(p, npc, op);
        for (let t = 0; t < 10 && !p.activeScript; t++) H.tick(1);
        if (p.activeScript) break;
    }
    return drive(p, picks);
}

/** Talk to an npc from wherever the player is standing, walking the real route - no teleport. */
function walkTalk(p: Player, npcName: string, picks: number[] = []): boolean {
    const npc = findNpc(npcName, p);
    H.opNpc(p, npc, 1);
    for (let t = 0; t < 80 && !p.activeScript; t++) H.tick(1);
    if (!p.activeScript) return false;
    drive(p, picks);
    return true;
}

function op(p: Player, x: number, z: number, locName: string, n = 1, picks: number[] = []) {
    H.opLoc(p, x, z, locName, n);
    return drive(p, picks);
}

/** "Use" an inventory item on a loc: OpLocUHandler, with the route a client would send. */
function useOn(p: Player, x: number, z: number, locName: string, objName: string, picks: number[] = []) {
    const id = LocType.getId(locName);
    const loc = World.getLoc(x, z, p.level, id);
    if (!loc) throw new Error(`no ${locName} at ${x},${z},${p.level}`);
    p.clearPendingAction();
    p.queueWaypoints(findPathToLoc(p.level, p.x, p.z, loc.x, loc.z, p.width, loc.width, loc.length, loc.angle, loc.shape, LocType.get(id).forceapproach));
    p.lastUseItem = ObjType.getId(objName);
    p.lastUseSlot = slotOf(p, objName);
    p.setInteraction(Interaction.ENGINE, loc, ServerTriggerType.APLOCU);
    (p as any).opcalled = true;
    return drive(p, picks);
}

/** OpNpcUHandler. */
function useOnNpc(p: Player, npc: Npc, objName: string) {
    p.clearPendingAction();
    p.lastUseItem = ObjType.getId(objName);
    p.lastUseSlot = slotOf(p, objName);
    p.queueWaypoints(findPathToEntity(p.level, p.x, p.z, npc.x, npc.z, p.width, npc.width, npc.length));
    p.setInteraction(Interaction.ENGINE, npc, ServerTriggerType.APNPCU);
    (p as any).opcalled = true;
    return drive(p);
}

/** OpHeldUHandler, the target's trigger first and then the used item's, swapping. */
function useHeld(p: Player, usedName: string, targetName: string) {
    const target = ObjType.getId(targetName);
    const used = ObjType.getId(usedName);
    p.lastItem = target;
    p.lastSlot = slotOf(p, targetName);
    p.lastUseItem = used;
    p.lastUseSlot = slotOf(p, usedName);
    let script = ScriptProvider.getByTriggerSpecific(ServerTriggerType.OPHELDU, target, -1);
    if (!script) {
        script = ScriptProvider.getByTriggerSpecific(ServerTriggerType.OPHELDU, used, -1);
        [p.lastItem, p.lastUseItem] = [p.lastUseItem, p.lastItem];
        [p.lastSlot, p.lastUseSlot] = [p.lastUseSlot, p.lastSlot];
    }
    if (!script) throw new Error(`no opheldu for ${usedName} on ${targetName}`);
    p.executeScript(ScriptRunner.init(script, p), true);
    return drive(p);
}

function held(p: Player, objName: string, n: number, picks: number[] = []) {
    H.opheld(p, objName, n);
    return drive(p, picks);
}

/** Tiles reachable on foot from (x,z), and whether any tile beside (tx,tz) is one of them. */
function reach(level: number, x: number, z: number, radius = 120) {
    const seen = new Set<string>([x + ',' + z]);
    const q = [[x, z]];
    while (q.length) {
        const [cx, cz] = q.pop()!;
        for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            const nx = cx + dx, nz = cz + dz, k = nx + ',' + nz;
            if (seen.has(k) || Math.abs(nx - x) > radius || Math.abs(nz - z) > radius) continue;
            if (canTravel(level, cx, cz, dx, dz, 1, 0, CollisionType.NORMAL)) { seen.add(k); q.push([nx, nz]); }
        }
    }
    return (tx: number, tz: number, r = 1) => {
        for (let dx = -r; dx <= r; dx++) for (let dz = -r; dz <= r; dz++) if (seen.has(tx + dx + ',' + (tz + dz))) return true;
        return false;
    };
}

function kill(p: Player, npc: Npc, maxTicks = 600): boolean {
    H.attackNpc(p, npc);
    for (let t = 0; t < maxTicks; t++) {
        H.tick(1);
        if (!npc.isActive || npc.levels[3] <= 0) {
            for (let i = 0; i < 8; i++) H.tick(1);
            return true;
        }
        if (!p.target && !p.delayed && t % 8 === 7) H.attackNpc(p, npc);
        if (p.levels[3] < 40) p.levels[3] = 99;
    }
    return false;
}
const hasObjOnFloor = (x: number, z: number, level: number, objName: string, p: Player) => {
    for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) if (World.getObj(x + dx, z + dz, level, ObjType.getId(objName), p.hash64)) return true;
    return false;
};
const locAt = (x: number, z: number, level: number, name: string) => World.getLoc(x, z, level, LocType.getId(name)) !== null;

// ============================================================================== Mountain Daughter
console.log('MOUNTAIN DAUGHTER');
{
    const V = 'mdaughter_quest_var';
    const p = player('md', 2761, 3657);
    H.setVarBit(p, V, 0);
    H.equip(p, { rhand: 'rune_scimitar' });

    op(p, 2760, 3658, 'mdaughter_rockslide');
    check('rockslide from the south: lands north of it, on a free tile', [at(p), free(p)], [[2761, 3660, 0], true]);
    op(p, 2760, 3658, 'mdaughter_rockslide');
    check('rockslide from the north: back south, free tile', [at(p), free(p)], [[2761, 3657, 0], true]);
    op(p, 2760, 3658, 'mdaughter_rockslide');

    // Hamal is in a tent with a closed flap
    const inTent = reach(0, p.x, p.z);
    check('with the flap shut Hamal cannot be walked to', inTent(2811, 3673), false);
    const from = H.mesgs.length;
    op(p, 2805, 3672, 'mdaughter_tent_door');
    check('  the tent flap opens (no "Nothing interesting happens")', [saidSince(p, from, 'Nothing interesting'), locAt(2805, 3672, 0, 'mdaughter_tent_door')], [false, false]);
    check('  and Hamal answers from across the camp, walking in', walkTalk(p, 'mdaughter_hamal', [1]), true);
    check('  quest started', H.getVarBit(p, V), 10);

    // the pearls: the bushes on White Wolf Mountain
    const b = player('md_bush', 2849, 3496);
    let picks = 0;
    for (let i = 0; i < 40 && H.invCount(b, 'mdaughter_white_pearl_fruit') < 3; i++) { op(b, 2849, 3497, 'mdaughter_white_pearl_bush', 3); picks++; }
    check('white pearls can be picked from the thorny bushes', H.invCount(b, 'mdaughter_white_pearl_fruit') >= 3, true);
    H.give(p, 'mdaughter_white_pearl_fruit', 3);
    talk(p, 'mdaughter_hamal');
    check('three pearls: Hamal speaks plainly (relations 1)', [H.getVarBit(p, 'mdaughter_relations_var'), H.invCount(p, 'mdaughter_white_pearl_fruit')], [1, 0]);
    talk(p, 'mdaughter_svidi');
    check('Svidi found', H.getVarBit(p, V), 20);
    talk(p, 'viking_brundt');
    check('Brundt writes the guarantee', [H.getVarBit(p, V), H.invCount(p, 'mdaughter_safety_guarantee')], [30, 1]);
    talk(p, 'mdaughter_svidi');
    check('Svidi takes it and gives the necklace', [H.getVarBit(p, V), H.invCount(p, 'mdaughter_necklace')], [40, 1]);
    talk(p, 'mdaughter_hamal');
    check('Hamal knows the necklace', H.getVarBit(p, V), 50);

    p.teleport(2808, 3659, 0);
    H.tick(1);
    H.give(p, 'spade');
    op(p, 2808, 3660, 'mdaughter_roots_1');
    check('dig below the roots: Asleif', [H.getVarBit(p, V), H.invCount(p, 'mdaughter_daughter_corpse')], [60, 1]);

    // the Ancient Rock's tent
    p.teleport(2799, 3668, 0);
    H.tick(1);
    H.give(p, 'rune_pickaxe');
    check('the Ancient Rock cannot be walked to with the flaps shut', reach(0, p.x, p.z)(2799, 3660), false);
    op(p, 2799, 3665, 'mdaughter_rocktent_door');
    check('  Go-through takes you into the tent', [at(p), free(p)], [[2799, 3665, 0], true]);
    check('  and the rock is in reach from there', reach(0, p.x, p.z)(2799, 3660), true);
    useOn(p, 2799, 3660, 'mdaughter_ancient_rock', 'rune_pickaxe');
    check('  pickaxe on the Ancient Rock: half a rock', H.invCount(p, 'mdaughter_half_rock'), 1);
    op(p, 2799, 3665, 'mdaughter_rocktent_door');
    check('  and back out through the flap', [at(p)[1] > 3665, free(p)], [true, true]);

    // the pole, the tree, the vault and the stones
    p.teleport(2801, 3703, 0);
    H.tick(1);
    op(p, 2802, 3703, 'mdaughter_passable_tree');
    check('a pole from the dead tree', H.invCount(p, 'mdaughter_stick'), 1);
    p.teleport(2771, 3680, 0);
    H.tick(1);
    op(p, 2772, 3679, 'mdaughter_lake_tree', 3);
    check('Climb the tall tree: onto the ledge by the rocks', [at(p), free(p)], [[2772, 3684, 0], true]);
    op(p, 2773, 3688, 'mdaughter_polerocks');
    check('vault the rocks with the pole: the north ledge', [at(p), free(p)], [[2773, 3691, 0], true]);
    op(p, 2775, 3691, 'mdaughter_flatstone1');
    check('jump the flat stones: onto the island', [at(p), free(p)], [[2778, 3691, 0], true]);
    check('  the burial ground is in reach', reach(0, p.x, p.z)(2783, 3694), true);
    p.teleport(2782, 3693, 0);
    H.tick(1);
    held(p, 'mdaughter_daughter_corpse', 3);
    check('Bury the corpse at the burial ground: a mound', H.getVarBit(p, 'mdaughter_burial_state'), 1);
    useOn(p, 2783, 3694, 'mdaughter_multimound', 'mdaughter_half_rock');
    check('the half rock on the mound: a cairn, stage buried', [H.getVarBit(p, 'mdaughter_burial_state'), H.getVarBit(p, V)], [2, 70]);
    p.teleport(2778, 3691, 0);
    H.tick(1);
    op(p, 2777, 3691, 'mdaughter_flatstone2');
    check('back over the stones', at(p), [2774, 3691, 0]);
    op(p, 2773, 3688, 'mdaughter_polerocks');
    check('back off the rocks and round the tree to the shore', [at(p), free(p)], [[2771, 3680, 0], true]);
    // without a pole, the ledge is not a trap
    const np = player('md_nopole', 2771, 3680);
    op(np, 2772, 3679, 'mdaughter_lake_tree', 3);
    op(np, 2773, 3688, 'mdaughter_polerocks');
    check('  on the ledge with no pole: sent back to the shore, not stranded', at(np), [2771, 3680, 0]);

    // the treeline and the cave
    // let the first stump grow back, then fell it again while already holding a pole
    for (let i = 0; i < 110 && !locAt(2802, 3703, 0, 'mdaughter_passable_tree'); i++) H.tick(1);
    p.teleport(2801, 3703, 0);
    H.tick(1);
    op(p, 2802, 3703, 'mdaughter_passable_tree');
    check('with a pole already, the first tree still falls', locAt(2802, 3703, 0, 'mdaughter_passable_tree_stump'), true);
    op(p, 2802, 3703, 'mdaughter_passable_tree_stump');
    check('  Step-over the stump', [at(p), free(p)], [[2803, 3703, 0], true]);
    op(p, 2807, 3703, 'mdaughter_passable_tree');
    op(p, 2807, 3703, 'mdaughter_passable_tree_stump');
    check('  the second tree and its stump', [at(p), free(p)], [[2808, 3703, 0], true]);
    H.setVarBit(p, 'mdaughter_bear_multi_state', 1); // what the old fight code left behind
    op(p, 2809, 3703, 'mdaughter_caveentrance');
    check('into the Kendal\'s cave, on a free tile, and the Kendal visible again', [at(p), free(p), H.getVarBit(p, 'mdaughter_bear_multi_state')], [[2807, 10104, 0], true, 0]);
    check('  the Kendal is in reach', reach(0, p.x, p.z)(2786, 10081, 2), true);

    const kendal = findNpc('mdaughter_multi_bear', p);
    const kt = NpcType.get(kendal.type);
    check('the Kendal has real stats (hp, attack, defence)', [kendal.baseLevels[3], kendal.baseLevels[0], kendal.baseLevels[1]], [50, 65, 60]);
    void kt;
    talk(p, 'mdaughter_multi_bear', [1]);
    check('  unmasked, he fights - and the multi stays on the visible Kendal', H.getVarBit(p, 'mdaughter_bear_multi_state'), 0);
    const kx = kendal.x, kz = kendal.z;
    const hitsBefore = H.npcHits.length;
    const died = kill(p, kendal);
    check('  a melee player actually hits him', H.npcHits.slice(hitsBefore).length > 0, true);
    check('  and kills him: stage kendal_dead, bearhead dropped', [died, H.getVarBit(p, V), hasObjOnFloor(kx, kz, 0, 'mdaughter_bear_helmet', p)], [true, 80, true]);
    H.give(p, 'mdaughter_bear_helmet');
    p.teleport(2810, 3673, 0);
    H.tick(1);
    const atk = p.stats[0];
    talk(p, 'mdaughter_hamal');
    check('the bearhead to Hamal: complete, Attack xp', [H.getVarBit(p, V), p.stats[0] > atk], [90, true]);
}

// ============================================================================== Spirits of the Elid
console.log('SPIRITS OF THE ELID');
{
    const p = player('elid', 3441, 2915);
    H.setVarBit(p, 'elidquest', 0);
    talk(p, 'elid_mayor', [1]);
    check('Awusah starts it', H.getVarBit(p, 'elidquest'), 10);
    talk(p, 'elid_ghaslor');
    check('Ghaslor', H.getVarBit(p, 'elidquest'), 20);
    p.teleport(3419, 2930, 0);
    H.tick(1);
    op(p, 3420, 2930, 'elid_cupboard_closed_withrobes');
    op(p, 3420, 2930, 'elid_cupboard_open_withrobes', 2);
    check('robes from the cupboard', [H.getVarBit(p, 'elidquest'), H.invCount(p, 'elid_robetop'), H.invCount(p, 'elid_robebottoms')], [25, 1, 1]);
    H.clearInv(p);
    H.equip(p, { torso: 'elid_robetop', legs: 'elid_robebottoms' });
    p.teleport(3374, 2904, 0);
    H.tick(1);
    op(p, 3373, 2904, 'elid_crevice_clickzone');
    check('down the crevice: a free tile in the water source (was solid rock)', [at(p), free(p), H.getVarBit(p, 'elidquest')], [[3349, 9537, 0], true, 27]);
    check('  the exit is in reach from the landing', reach(0, p.x, p.z)(3349, 9536), true);
    op(p, 3347, 9533, 'elid_underground_exit');
    check('  and Leave takes you back up', at(p), [3374, 2903, 0]);
    talk(p, 'elid_shiratti');
    check('Shiratti\'s key', H.invCount(p, 'elid_key'), 1);
    p.teleport(3374, 2904, 0);
    H.tick(1);
    op(p, 3373, 2904, 'elid_crevice_clickzone');

    op(p, 3353, 9544, 'elid_underground_robe_door');
    check('the robe door (robes on): through to the hub', [at(p), free(p)], [[3353, 9545, 0], true]);
    op(p, 3354, 9558, 'elid_underground_lake_door');
    check('the lake door: through to the spirits', [at(p), free(p)], [[3354, 9559, 0], true]);
    check('  the spirits are talked to on foot', walkTalk(p, 'elid_waterspirit'), true);
    check('  stage met_spirits', H.getVarBit(p, 'elidquest'), 30);
    op(p, 3354, 9558, 'elid_underground_lake_door');
    check('  and back through the lake door', at(p), [3354, 9557, 0]);

    H.give(p, 'rune_pickaxe');
    op(p, 3374, 9547, 'elid_greygolem_door');
    check('grey golem door: the key opens it and you go through', [at(p), free(p), !!H.npcNear('elid_golem_grey', p.x, p.z)], [[3375, 9547, 0], true, true]);
    op(p, 3378, 9547, 'elid_waterchannel_mining_multiloc');
    check('  clear the fallen rock (trigger on the multiloc shell)', H.getVarBit(p, 'elid_miningchannel'), 1);
    op(p, 3374, 9547, 'elid_greygolem_door');
    check('  and back out', at(p), [3373, 9547, 0]);

    op(p, 3365, 9542, 'elid_whitegolem_door');
    check('white golem door: through, south', [at(p), free(p)], [[3365, 9541, 0], true]);
    const wg = H.npcNear('elid_golem_white', p.x, p.z);
    check('  its golem stands on a free tile', wg ? !isMapBlocked(wg.x, wg.z, 0) : false, true);
    op(p, 3365, 9538, 'elid_waterchannel_thieving_multiloc');
    check('  clear the spike trap', H.getVarBit(p, 'elid_thievingchannel'), 1);
    op(p, 3365, 9542, 'elid_whitegolem_door');

    op(p, 3372, 9556, 'elid_blackgolem_door');
    check('black golem door: through, east', [at(p), free(p)], [[3373, 9556, 0], true]);
    H.give(p, 'bronze_arrow', 5);
    const target = findNpc('elid_ranging_target_multinpc', p);
    useOnNpc(p, target, 'bronze_arrow');
    check('  an arrow on the target from across the channel', [H.getVarBit(p, 'elid_rangingchannel'), H.getVarBit(p, 'elidquest')], [1, 35]);
    op(p, 3372, 9556, 'elid_blackgolem_door');

    // the genie
    p.teleport(3374, 2904, 0);
    H.tick(1);
    op(p, 3373, 2904, 'elid_crevice_clickzone', 1, [2]);
    check('the crevice now forks: the genie\'s cave, on a free tile', [at(p), free(p)], [[3374, 9306, 0], true]);
    check('  the genie cannot be walked to with his door shut', reach(0, p.x, p.z)(3371, 9320), false);
    op(p, 3371, 9312, 'elid_genie_door');
    check('  through his door', [at(p), free(p)], [[3371, 9313, 0], true]);
    check('  the genie, on foot', walkTalk(p, 'elid_genie', [1]), true);
    check('  the statuette', [H.getVarBit(p, 'elidquest'), H.invCount(p, 'elid_statuette')], [40, 1]);
    op(p, 3371, 9312, 'elid_genie_door');
    op(p, 3373, 9305, 'elid_climbing_rope');
    check('  and the rope back up', at(p), [3374, 2903, 0]);
    // lose it, get it back
    H.clearInv(p);
    talk(p, 'elid_genie');
    check('a lost statuette can be had again from the genie', H.invCount(p, 'elid_statuette'), 1);
    talk(p, 'elid_ghaslor');
    talk(p, 'elid_mayor');
    check('Ghaslor, then Awusah', H.getVarBit(p, 'elidquest'), 55);
    p.teleport(3426, 2929, 0);
    H.tick(1);
    const pray = p.stats[5];
    useOn(p, 3426, 2930, 'elid_statuette_multiloc', 'elid_statuette');
    for (let i = 0; i < 5; i++) H.tick(1);
    check('the statuette on its plinth: complete, Prayer xp', [H.getVarBit(p, 'elidquest'), p.stats[5] > pray], [60, true]);

    // Nardah itself
    const n = player('nardah', 3427, 2892);
    H.clearLogs();
    op(n, 3426, 2893, 'elid_bankbooth', 2);
    check('Nardah\'s bank booth opens the bank', n.containsModalInterface() || H.ifaces.some(i => i.who === 'nardah' && i.kind === 'open'), true);
    n.closeModal();
    n.teleport(3403, 2926, 0);
    H.tick(1);
    op(n, 3403, 2927, 'elid_ladder_up');
    check('a Nardah ladder climbs up', at(n), [3403, 2926, 1]);
    op(n, 3403, 2927, 'elid_laddertop');
    check('  and down', at(n), [3403, 2926, 0]);
    n.teleport(3445, 2910, 0);
    H.tick(1);
    op(n, 3446, 2911, 'elid_mayor_stairs');
    check('Awusah\'s stairs go up, onto a free tile', [at(n), free(n)], [[3446, 2910, 1], true]);
    op(n, 3447, 2911, 'elid_mayor_stairstop');
    check('  and down', [at(n), free(n)], [[3445, 2911, 0], true]);
}

// ============================================================================== Forgettable Tale
console.log('FORGETTABLE TALE OF A DRUNKEN DWARF');
{
    const p = player('forget', 2828, 10212, 1);
    H.setVarBit(p, 'giantdwarf_quest', 60);
    H.setVarBit(p, 'forget_quest', 0);
    const gd = H.getVarBit(p, 'giantdwarf_quest');
    void gd;
    talk(p, 'dwarf_city_black_guard_supreme_leader');
    check('Veldaban, first time: the story (and he remembers telling it)', H.getVarBit(p, 'forget_veldaban_exposition'), 1);
    H.give(p, 'beer');
    talk(p, 'dwarf_city_black_guard_supreme_leader');
    check('  second time, with a beer: started (was the same speech forever)', [H.getVarBit(p, 'forget_quest'), H.invCount(p, 'beer')], [10, 0]);
    talk(p, 'dwarf_city_gardener_dwarf');
    check('Rind\'s letter', H.invCount(p, 'forget_gardener_letter'), 1);
    talk(p, 'elstan');
    talk(p, 'dwarf_city_gardener_dwarf');
    check('Elstan, then Rind: seeds', H.getVarBit(p, 'forget_quest'), 20);

    p.teleport(2924, 10159, 0);
    H.tick(1);
    H.give(p, 'hammer');
    useOn(p, 2926, 10158, 'keldagrim_boardedupdoor_multi', 'hammer');
    check('a hammer on the boards in Keldagrim: stage tunnel, at the cart', [H.getVarBit(p, 'forget_quest'), at(p), free(p)], [30, [1864, 4956, 1], true]);
    op(p, 1864, 4957, 'forget_train_cart');
    check('ride the cart', at(p), [1906, 4964, 2]);
    op(p, 1906, 4965, 'forget_metal_crate_withpapers1');
    op(p, 1910, 4966, 'forget_metal_crate_withpapers2');
    op(p, 1903, 4970, 'forget_metal_crate_withpapers3');
    check('three crates: papers', H.getVarBit(p, 'forget_quest'), 40);
    op(p, 1897, 4965, 'forget_story_exit_prev');
    check('back to the rails', at(p), [1864, 4956, 1]);
    op(p, 1864, 4957, 'forget_train_cart');
    op(p, 1914, 4965, 'forget_story_exit_next');
    check('the cave mouth by the crates: chamber one, on a free tile (was walled in)', [at(p), free(p)], [[1888, 4982, 2], true]);
    let hops = 0;
    while (H.getVarBit(p, 'forget_quest') < 50 && hops < 20) {
        if (p.x > 1880) op(p, 1889, 4982, 'forget_story_exit_next');
        else op(p, 1867, 4983, 'forget_story_exit_prev');
        hops++;
    }
    check('twelve panels between the two chambers: story', H.getVarBit(p, 'forget_quest'), 50);
    if (p.x > 1880) op(p, 1889, 4982, 'forget_story_exit_next');
    op(p, 1867, 4983, 'forget_story_exit_prev');
    check('  and the chamber lets you out afterwards', at(p), [1864, 4956, 1]);
    op(p, 1864, 4957, 'forget_train_cart', 2);
    check('Return: beside Veldaban, on a free tile', [at(p), free(p)], [[2828, 10211, 1], true]);
    check('  Veldaban is in reach', reach(1, p.x, p.z)(2828, 10210), true);
    talk(p, 'dwarf_city_black_guard_supreme_leader');
    check('tell Veldaban: complete', H.getVarBit(p, 'forget_quest'), 70);
}

// ============================================================================== Swan Song
console.log('SWAN SONG');
{
    const p = player('swan', 2345, 3649);
    H.setVarBit(p, 'swansong', 0);
    op(p, 2344, 3651, 'loc_14922');
    check('the crawl-hole before the quest: Herman will not let you', at(p)[1] < 3653, true);
    talk(p, 'swan_multioutside', [1]);
    check('Herman outside starts it', H.getVarBit(p, 'swansong'), 5);
    p.teleport(2344, 3650, 0);
    H.tick(1);
    op(p, 2344, 3651, 'loc_14922');
    check('through the hole', [at(p), free(p)], [[2344, 3655, 0], true]);
    check('  Franklin cannot be walked to past the shut gate', reach(0, p.x, p.z)(2344, 3667), false);
    op(p, 2343, 3662, 'loc_14929');
    check('  the colony gate: through', [at(p)[1] >= 3663, free(p)], [true, true]);
    check('  Franklin, Arnold, Herman\'s desk and the fishing grounds are in reach', [reach(0, p.x, p.z)(2344, 3667), reach(0, p.x, p.z)(2330, 3691), reach(0, p.x, p.z)(2354, 3683), reach(0, p.x, p.z)(2343, 3702)], [true, true, true, true]);
    op(p, 2343, 3662, 'loc_14929');
    check('  and back out through the gate', at(p)[1] <= 3662, true);
    op(p, 2343, 3662, 'loc_14929');

    // the colony's house doors
    const door = World.getLoc(2351, 3679, 0, LocType.getId('loc_14923'));
    if (door) {
        p.teleport(2352, 3679, 0);
        H.tick(1);
        const from = H.mesgs.length;
        op(p, 2351, 3679, 'loc_14923');
        check('a colony door opens', [saidSince(p, from, 'Nothing interesting'), locAt(2351, 3679, 0, 'loc_14923')], [false, false]);
    }

    // the quest itself, through its own triggers
    // the west wall, as merged from fix-woodplank: Franklin's press and five iron sheets - driven here
    // on top of this batch's way in, to show the two meet (the press is behind a workshop door, the
    // walls are on the west palisade)
    talk(p, 'swan_franklin');
    check('Franklin asks for sheets and hands over a tinderbox and a hammer', [H.getVarBit(p, 'swansong_franklin'), H.invCount(p, 'tinderbox'), H.invCount(p, 'hammer')], [1, 1, 1]);
    H.give(p, 'logs');
    H.give(p, 'iron_bar', 5);
    p.teleport(2338, 3675, 0);
    H.tick(1);
    op(p, 2337, 3675, 'loc_14923');
    check('  the workshop door opens', locAt(2337, 3675, 0, 'loc_14923'), false);
    check('  the press and firebox are in reach from the colony', [reach(0, p.x, p.z)(2341, 3675), reach(0, p.x, p.z)(2343, 3675)], [true, true]);
    useOn(p, 2343, 3675, 'loc_14955', 'logs');
    useOn(p, 2343, 3675, 'loc_14955', 'tinderbox');
    for (let i = 0; i < 5; i++) useOn(p, 2341, 3675, 'loc_14954', 'iron_bar');
    check('  logs, lit, five bars through the press: five sheets', [H.getVarBit(p, 'swansong_franklin'), H.invCount(p, 'iron_sheet')], [3, 5]);
    for (let n = 0; n < 5; n++) {
        const z = 3688 - n;
        check(`  wall ${n + 1} (2311,${z}) is in reach`, reach(0, p.x, p.z)(2311, z), true);
        useOn(p, 2311, z, `loc_1493${3 + n}`, 'iron_sheet');
    }
    talk(p, 'swan_herman');
    check('five wall sections, Herman: fish', H.getVarBit(p, 'swansong'), 10);
    H.clearInv(p);
    H.give(p, 'harpoon');
    const spot = findNpc('swan_fishingspot', p);
    for (let i = 0; i < 6; i++) {
        p.teleport(spot.x, spot.z - 1, 0);
        H.tick(1);
        H.opNpc(p, spot, 1);
        drive(p);
    }
    check('monkfish from the colony\'s spots', H.getVarBit(p, 'swansong_fish') >= 5, true);
    talk(p, 'swan_herman');
    check('fed; the letter goes; the Wise Old Man arrives', H.getVarBit(p, 'swansong'), 30);
    talk(p, 'swan_multioutside');
    talk(p, 'swan_multioutside');
    check('he looks at them, and the ambush', H.getVarBit(p, 'swansong'), 65);
    talk(p, 'swan_arnold');
    check('Arnold: the book and the bone seeds', [H.getVarBit(p, 'swansong'), H.invCount(p, 'swan_army')], [80, 1]);
    H.give(p, 'bones', 5);
    for (let i = 0; i < 5; i++) useHeld(p, 'bones', 'swan_army');
    check('five bones into the packet', H.getVarBit(p, 'swansong_bones'), 5);
    held(p, 'swan_army', 4);
    check('planted', H.getVarBit(p, 'swansong'), 90);
    p.levels[3] = 10;
    talk(p, 'swan_herman');
    check('the battle, fought on 10 hitpoints: through it, still standing', [H.getVarBit(p, 'swansong'), p.levels[3] >= 1, p.x > 2300 && p.z > 3600], [190, true, true]);
    talk(p, 'swan_herman');
    check('Herman: complete', H.getVarBit(p, 'swansong'), 200);

    // Kathy Corkat
    const k = player('kathy', 2367, 3485);
    H.setVarBit(k, 'swansong', 5);
    talk(k, 'swan_boat_boatwoman', [], 3);
    check('Kathy\'s boat, stronghold end: Travel to the colony, a free tile', [at(k), free(k)], [[2357, 3639, 0], true]);
    talk(k, 'swan_boatwoman_2', [], 3);
    check('  and back', [at(k), free(k)], [[2368, 3485, 0], true]);
}

// ============================================================================== In Search of the Myreque
console.log('IN SEARCH OF THE MYREQUE');
{
    // The original quest (ported from PlagueCityRS 349): its placements. The whole quest is played in
    // tools/sim/port349_routequest.ts.
    const p = player('myreque', 3494, 3463);
    H.setVar(p, 'routequest', 0);
    op(p, 3494, 3464, 'thrt_tavern_trap_door');
    check('the trapdoor is locked until the way out has been found', at(p), [3494, 3463, 0]);
    H.setVar(p, 'routequest', 97); // ^routequest_found_exit
    op(p, 3494, 3464, 'thrt_tavern_trap_door');
    check('  then: below the ladder on a free tile (not the ladder\'s own tile)', [at(p), free(p)], [[3477, 9845, 0], true]);
    op(p, 3477, 9846, 'thrttavernbasementladder');
    check('  and the ladder back up: beside the trapdoor, a free tile', [Math.abs(p.x - 3494) <= 1 && Math.abs(p.z - 3464) <= 1, p.level, free(p)], [true, 0, true]);
    p.teleport(3480, 9838, 0);
    H.tick(1);
    op(p, 3480, 9837, 'thrttavernbasementfalsewall');
    check('Search the false wall from the basement: through into the Hollows', [p.x, p.z < 9838, p.level, free(p)], [3480, true, 0, true]);
    op(p, 3480, 9837, 'thrttavernbasementfalsewall');
    check('  and back', [p.x, p.z >= 9837, free(p)], [3480, true, true]);
    p.teleport(3500, 9811, 0);
    H.tick(1);
    op(p, 3500, 9812, 'freedomfighterundergroundentrancel');
    check('the Myreque\'s doors off the Hollows: out into Mort Myre, a free tile', [at(p), free(p)], [[3509, 3449, 0], true]);
    op(p, 3510, 3447, 'freedomfighterentrancel');
    check('  and the doors in the swamp back down', [at(p), free(p)], [[3500, 9811, 0], true]);
    H.setVar(p, 'routequest', 105);
    p.teleport(3491, 9824, 0);
    H.tick(1);
    op(p, 3492, 9824, 'route_stalagmite_cave_entrace', 2);
    check('the stalagmite: into the hideout, a free tile', [at(p), free(p)], [[3505, 9832, 0], true]);
    op(p, 3505, 9831, 'route_cavewalltunnel');
    check('the hideout\'s tunnel: out beside the stalagmite', [at(p), free(p)], [[3491, 9824, 0], true]);
    p.teleport(3498, 3380, 0);
    H.tick(1);
    op(p, 3498, 3377, 'route_rowboat_hollows');
    check('the Hollows boat: to Mort\'ton, a free tile', [at(p), free(p)], [[3522, 3284, 0], true]);
    H.clearLogs();
    talk(p, 'multi_vanstrom_stranger_entity');
    check('the man in the tavern chair answers Talk-to', H.ifaces.some(i => i.who === 'myreque' && i.kind === 'text' && (i.text ?? '').includes('been through this before')), true);
}

// ============================================================================== getting there on foot
console.log('GETTING THERE ON FOOT');
{
    // The colony's outside ground is an island in this cache: Kathy's boat is the way there.
    check('Swan Song: the ground Herman stands on is not joined to the mainland on foot', reach(0, 2461, 3382, 300)(2345, 3650), false);
    check('  Kathy Corkat, Stronghold end, can be walked to from outside the Stronghold gate', reach(0, 2461, 3382, 300)(2368, 3486), true);
    const k0 = player('kathy0', 2367, 3485);
    H.setVarBit(k0, 'swansong', 0);
    talk(k0, 'swan_boat_boatwoman', [1]);
    check('  before the quest, talking to her rows you up', at(k0), [2357, 3639, 0]);
    check('  and Herman is walkable from where she lands', reach(0, k0.x, k0.z)(2345, 3651), true);
    const taverley = reach(0, 2895, 3455, 200);
    check('Mountain Daughter: the thorny bushes can be walked to from Taverley', taverley(2849, 3497), true);
    const canifis = reach(0, 3494, 3485, 60);
    check('In Search of the Myreque: the trapdoor in the Hair of the Dog, from Canifis', canifis(3494, 3464), true);
}

// ============================================================================== old quests: spot checks
console.log('DRAGON SLAYER (spot check: the Lady Lumbridge after the charter piers)');
{
    const p = player('dragon', 3047, 3203);
    H.setVar(p, 'dragonquest', 3);
    const plank = World.getLoc(3046, 3205, 0, LocType.getId('dragonshipgangplank_on')) ?? null;
    let found: [number, number] | null = null;
    for (let x = 3035; x <= 3060 && !found; x++) for (let z = 3195; z <= 3215 && !found; z++) if (World.getLoc(x, z, 0, LocType.getId('dragonshipgangplank_on'))) found = [x, z];
    void plank;
    check('the gangplank is still placed at Port Sarim', !!found, true);
    if (found) {
        op(p, found[0], found[1], 'dragonshipgangplank_on');
        check('  and a ship-owner boards her', p.level, 1);
    }
}

console.log(`\n${R.ok} ok, ${R.bad} FAIL`);
if (errors.length) console.log('script errors:\n' + errors.join('\n'));
process.exit(R.bad ? 1 : 0);
