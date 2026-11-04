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
// In Search of the Myreque - the cellar landing, the false wall, the Myreque's door and its tunnel.
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
const saidSince = (p: Player, from: number, s: string) => H.mesgs.slice(from).some(m => m.who === p.username && m.text.includes(s));
// A ~mesbox IS NOT A mes. The first goes out as an interface with text set on it and lands in
// H.ifaces; only the second reaches the chatbox and H.mesgs. Three checks here asked saidSince
// for lines the content says through a mesbox and read "it did not say that" about a refusal that
// had worked perfectly.
const boxedSince = (p: Player, from: number, s: string) => H.ifaces.slice(from).some(i => i.who === p.username && i.kind === 'text' && (i.text ?? '').includes(s));
/** Either channel: a mes in the chatbox or a ~mesbox over it. */
const toldSince = (p: Player, mesFrom: number, ifaceFrom: number, s: string) => saidSince(p, mesFrom, s) || boxedSince(p, ifaceFrom, s);
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
    return H.ifaces
        .slice(from)
        .filter(i => i.who === p.username && i.kind === 'text' && i.text && i.text.length > 1)
        .map(i => i.text!);
}

function findNpc(npcName: string, p: Player): Npc {
    const npc = [p.level, 0, 1, 2, 3].map(l => H.npcNear(npcName, p.x, p.z, l)).find(n => n);
    if (!npc) throw new Error('no npc ' + npcName);
    return npc;
}

/** Talk to the nearest npc of a type, standing next to it first (for steps nobody changed). */
function talk(p: Player, npcName: string, picks: number[] = [], op = 1): string[] {
    const npc = findNpc(npcName, p);
    for (const [dx, dz] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
        [1, 1],
        [-1, -1],
        [2, 0],
        [0, 2],
        [-2, 0],
        [0, -2]
    ]) {
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
        for (const [dx, dz] of [
            [1, 0],
            [-1, 0],
            [0, 1],
            [0, -1]
        ]) {
            const nx = cx + dx,
                nz = cz + dz,
                k = nx + ',' + nz;
            if (seen.has(k) || Math.abs(nx - x) > radius || Math.abs(nz - z) > radius) continue;
            if (canTravel(level, cx, cz, dx, dz, 1, 0, CollisionType.NORMAL)) {
                seen.add(k);
                q.push([nx, nz]);
            }
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

    // THE SLIDE IS WATCHED, which is the camp's whole point and is newer than this block was.
    // [oploc1,mdaughter_rockslide] refuses from the SOUTH while the quest has not started - "a
    // spear comes over it" - and an outsider's way in is a rope round the boulder on the ledge
    // above. The old pair of checks here opped the slide at stage 0 and read a player who had not
    // moved as a wrong landing, then read the SECOND op - from the same tile, refused the same way
    // - as "back south, free tile" and passed it. A check that passes because nothing happened is
    // worse than the one that failed beside it.
    let from = H.mesgs.length;
    const fromIf = H.ifaces.length;
    op(p, 2760, 3658, 'mdaughter_rockslide');
    check('the slide turns an outsider back, and does not move them', [at(p), toldSince(p, from, fromIf, 'not letting you in')], [[2761, 3657, 0], true]);
    H.give(p, 'rope');
    p.teleport(2765, 3665, 0); // the strip of ledge above the path, reached by the west route up
    H.tick(1);
    useOn(p, 2765, 3666, 'mdaughter_cliff_boulder', 'rope');
    check('  a rope round the cliff boulder drops you into the camp, on a free tile', [p.z > 3660, free(p)], [true, true]);
    check('  and the rope is coiled up again at the bottom rather than taken', H.invCount(p, 'rope'), 1);

    // Hamal is in a tent with a closed flap
    const inTent = reach(0, p.x, p.z);
    check('with the flap shut Hamal cannot be walked to', inTent(2811, 3673), false);
    from = H.mesgs.length;
    p.teleport(2804, 3672, 0);
    H.tick(1);
    op(p, 2805, 3672, 'mdaughter_tent_door');
    check('  the tent flap opens (no "Nothing interesting happens")', [saidSince(p, from, 'Nothing interesting'), locAt(2805, 3672, 0, 'mdaughter_tent_door')], [false, false]);
    // TWO MENUS, NOT ONE: a p_choice3 ("Why is everyone so hostile?") and then a p_choice2 ("I
    // could look for her."), and the second is the one that starts the quest. One pick left the
    // second menu unanswered, and the throw it caused reads as "unexpected menu: multi3" seventy
    // lines further on, where the next conversation walked into the opening choice again.
    check('  and Hamal answers from across the camp, walking in', walkTalk(p, 'mdaughter_hamal', [1, 1]), true);
    check('  quest started', H.getVarBit(p, V), 10);

    // AND NOW THE SLIDE LETS YOU THROUGH, which is the last line he says: "I will tell the slide
    // you may come and go." Landing tiles are what this block is for, and they can only be read
    // once the camp knows you.
    p.teleport(2761, 3657, 0);
    H.tick(1);
    op(p, 2760, 3658, 'mdaughter_rockslide');
    check('rockslide from the south: lands north of it, on a free tile', [at(p), free(p)], [[2761, 3660, 0], true]);
    op(p, 2760, 3658, 'mdaughter_rockslide');
    check('  and from the north: back south, free tile', [at(p), free(p)], [[2761, 3657, 0], true]);
    op(p, 2760, 3658, 'mdaughter_rockslide');

    // THE PEARLS, and the thorns are the point of them: [oploc3,mdaughter_white_pearl_bush] reads
    // inv_getobj(worn, ^wearpos_hands) and takes four hitpoints off anybody reaching in bare.
    // Forty bare-handed picks came away with nothing, and the check above them said the bush was
    // broken. Both halves are asserted now, so a glove check that stops working cannot read as a
    // bush that stopped fruiting.
    const b = player('md_bush', 2849, 3496);
    from = H.mesgs.length;
    op(b, 2849, 3497, 'mdaughter_white_pearl_bush', 3);
    check('bare hands come away with nothing, and it says why', [H.invCount(b, 'mdaughter_white_pearl_fruit'), saidSince(b, from, 'thorns go straight through')], [0, true]);
    H.give(b, 'leather_gloves');
    H.equip(b, { hands: 'leather_gloves' });
    H.tick(1);
    let picks = 0;
    for (let i = 0; i < 40 && H.invCount(b, 'mdaughter_white_pearl_fruit') < 3; i++) {
        op(b, 2849, 3497, 'mdaughter_white_pearl_bush', 3);
        picks++;
    }
    console.log(`  three white pearls took ${picks} picks of the bush`);
    check('white pearls can be picked from the thorny bushes with gloves on', H.invCount(b, 'mdaughter_white_pearl_fruit') >= 3, true);
    // and eating one is the only way anybody has ever got a seed out of a White Pearl
    held(b, 'mdaughter_white_pearl_fruit', 3);
    check('  and eating one leaves the seed', H.invCount(b, 'mdaughter_white_pearl_seed'), 1);
    // THE SPINE OF THIS QUEST IS quest_mdaughter_run.ts'S, and it is no longer the spine this
    // block was written against. Stage 20 is the pool in the bubbles off the island, not Svidi;
    // stage 30 is the pool again once Rellekka has its peace and the camp has its food; Brundt
    // wants the Ancient Rock back before he writes anything and takes half of it; Ragnar has the
    // necklace at stage 60; the roots give MUD rather than Asleif; and the cairn is five rocks off
    // the goat pen rather than half a rock. The run plays all of that start to finish and passes,
    // so the progression is deleted rather than ported. What is kept is the map: the two tent
    // flaps, the three crossings and the tile each one puts you down on, the two trees on the path
    // and the Kendal's cave - the geography the run only walks one line through.
    //
    // The vars below are set rather than earned for the same reason the stage is: each obstacle is
    // its own claim, and earning the state again here would only be a second, worse copy of the
    // run.

    // THE ROOTS GIVE MUD, and the mud is what makes the tall tree climbable: "The geysers have
    // left the bark wet through... Something would have to be worked into the bark first."
    p.teleport(2808, 3659, 0);
    H.tick(1);
    H.give(p, 'spade');
    op(p, 2808, 3660, 'mdaughter_roots_1');
    check('dig below the roots: a handful of mud', H.invCount(p, 'mdaughter_mud'), 1);

    // the Ancient Rock's tent
    p.teleport(2799, 3668, 0);
    H.tick(1);
    H.give(p, 'rune_pickaxe');
    H.setVarBit(p, 'mdaughter_relations_var', 3); // ^mdaughter_peace_brundt_wants_rock
    check('the Ancient Rock cannot be walked to with the flaps shut', reach(0, p.x, p.z)(2799, 3660), false);
    op(p, 2799, 3665, 'mdaughter_rocktent_door');
    check('  Go-through takes you into the tent', [at(p), free(p)], [[2799, 3665, 0], true]);
    check('  and the rock is in reach from there', reach(0, p.x, p.z)(2799, 3660), true);
    useOn(p, 2799, 3660, 'mdaughter_ancient_rock', 'rune_pickaxe');
    check('  a pickaxe on the Ancient Rock: half a rock', H.invCount(p, 'mdaughter_half_rock'), 1);
    op(p, 2799, 3665, 'mdaughter_rocktent_door');
    check('  and back out through the flap', [at(p)[1] > 3665, free(p)], [true, true]);

    // THE THREE CROSSINGS. An axe for the dead tree (a pole, unless you already have one), the mud
    // for the bark, the pole for the vault and one plank for both flat stones - the plank goes down
    // and comes back up inside the one click, which is how the quest's single plank does both ways.
    p.teleport(2801, 3703, 0);
    H.tick(1);
    H.give(p, 'bronze_axe');
    op(p, 2802, 3703, 'mdaughter_passable_tree');
    check('a pole cut from the dead tree', [H.invCount(p, 'mdaughter_stick'), locAt(2802, 3703, 0, 'mdaughter_passable_tree_stump')], [1, true]);
    H.give(p, 'plank');
    p.teleport(2771, 3680, 0);
    H.tick(1);
    let from2 = H.mesgs.length;
    let from2If = H.ifaces.length;
    op(p, 2772, 3679, 'mdaughter_lake_tree', 3);
    check('wet bark: you slide back down and stay on the shore', [at(p), toldSince(p, from2, from2If, 'slide back down')], [[2771, 3680, 0], true]);
    useOn(p, 2772, 3679, 'mdaughter_lake_tree', 'mdaughter_mud');
    check('  mud worked into the bark', [H.getVarBit(p, 'mdaughter_mud_var'), H.invCount(p, 'mdaughter_mud')], [1, 0]);
    op(p, 2772, 3679, 'mdaughter_lake_tree', 3);
    check('Climb the tall tree: onto the ledge by the rocks', [at(p), free(p)], [[2772, 3684, 0], true]);
    op(p, 2773, 3688, 'mdaughter_polerocks');
    check('vault the rocks with the pole: the north ledge', [at(p), free(p)], [[2773, 3691, 0], true]);
    op(p, 2775, 3691, 'mdaughter_flatstone1');
    check('plank the flat stones: onto the island', [at(p), free(p), H.invCount(p, 'plank')], [[2778, 3691, 0], true, 1]);
    check('  the burial ground is in reach', reach(0, p.x, p.z)(2783, 3694), true);

    // THE BURIAL: her necklace on her before she goes in the ground, and five rocks off the goat
    // pen on top of her. Both of those are the quest's, not this block's, so they are handed over.
    p.teleport(2782, 3693, 0);
    H.tick(1);
    H.setVarBit(p, V, 60); // ^mdaughter_has_necklace, which is where the burial starts
    H.give(p, 'mdaughter_daughter_corpse');
    from2 = H.mesgs.length;
    from2If = H.ifaces.length;
    held(p, 'mdaughter_daughter_corpse', 3);
    check('without the necklace she does not go in the ground', [H.getVarBit(p, 'mdaughter_burial_state'), toldSince(p, from2, from2If, 'Ragnar kept her necklace')], [0, true]);
    H.give(p, 'mdaughter_necklace');
    held(p, 'mdaughter_daughter_corpse', 3);
    check('Bury the corpse at the burial ground: a mound, and the necklace with her', [H.getVarBit(p, 'mdaughter_burial_state'), H.invCount(p, 'mdaughter_necklace'), H.getVarBit(p, V)], [1, 0, 70]);
    H.give(p, 'mdaughter_rock', 5);
    useOn(p, 2783, 3694, 'mdaughter_multimound', 'mdaughter_rock');
    check('five rocks on the mound: a cairn', H.getVarBit(p, 'mdaughter_burial_state'), 2);

    // and back, which is the half nobody can be left stranded by
    p.teleport(2778, 3691, 0);
    H.tick(1);
    op(p, 2777, 3691, 'mdaughter_flatstone2');
    check('back over the stones', at(p), [2774, 3691, 0]);
    op(p, 2773, 3688, 'mdaughter_polerocks');
    check('back off the rocks and round the tree to the shore', [at(p), free(p)], [[2771, 3680, 0], true]);
    // without a pole, the ledge is not a trap
    const np = player('md_nopole', 2771, 3680);
    H.give(np, 'mdaughter_mud');
    useOn(np, 2772, 3679, 'mdaughter_lake_tree', 'mdaughter_mud');
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
    // THE CAVE OPENS AT ^mdaughter_asked_of_death and the Kendal only talks from there: before it
    // he says "LEAVE FOOD AND GO". The burial above left this player on 70, which is a later stage
    // than the one the cave belongs to, so the stage goes back to where this obstacle lives - each
    // block here sets the state its own claim needs, since the spine is quest_mdaughter_run's.
    H.setVarBit(p, V, 30); // ^mdaughter_asked_of_death
    H.setVarBit(p, 'mdaughter_bear_discovery', 0);
    H.setVarBit(p, 'mdaughter_bear_mayattack', 0);
    H.setVarBit(p, 'mdaughter_bear_multi_state', 1); // what the old fight code left behind
    op(p, 2809, 3703, 'mdaughter_caveentrance');
    check("into the Kendal's cave, on a free tile, and the Kendal visible again", [at(p), free(p), H.getVarBit(p, 'mdaughter_bear_multi_state')], [[2807, 10104, 0], true, 0]);
    check('  the Kendal is in reach', reach(0, p.x, p.z)(2786, 10081, 2), true);

    const kendal = findNpc('mdaughter_multi_bear', p);
    const kt = NpcType.get(kendal.type);
    check('the Kendal has real stats (hp, attack, defence)', [kendal.baseLevels[3], kendal.baseLevels[0], kendal.baseLevels[1]], [50, 65, 60]);
    void kt;
    // FOUR CHOICES, NOT ONE. "It's just me, no one special", then "You mean a sacrifice?", then
    // "Give me her remains", then "Then I'll take her off your body" - and only the last of them
    // sets %mdaughter_bear_mayattack. One pick walked into the second menu and threw.
    talk(p, 'mdaughter_multi_bear', [1, 1, 1, 1]);
    check('  the whole confession, and he may be attacked', [H.getVarBit(p, 'mdaughter_bear_discovery'), H.getVarBit(p, 'mdaughter_bear_mayattack'), H.getVarBit(p, 'mdaughter_bear_multi_state')], [1, 1, 0]);
    const kx = kendal.x,
        kz = kendal.z;
    const hitsBefore = H.npcHits.length;
    const died = kill(p, kendal);
    check('  a melee player actually hits him', H.npcHits.slice(hitsBefore).length > 0, true);
    check('  and kills him: stage kendal_dead, bearhead dropped', [died, H.getVarBit(p, V), hasObjOnFloor(kx, kz, 0, 'mdaughter_bear_helmet', p)], [true, 40, true]);
    // and Asleif is at the foot of the pillars, which is the thing he was standing over. The
    // ending - Hamal seeing her, Ragnar's necklace, the goat pen and the cairn - is
    // quest_mdaughter_run's; what this block is for is that the cave gives her up at all.
    // ^mdaughter_corpse_pile is 0_43_157_36_30, which is 2788,10078: "nothing in the map puts her
    // there, so she goes on the floor when the thing that carried her off is dead".
    check('  and Asleif is on the floor at the foot of the pillars', hasObjOnFloor(2788, 10078, 0, 'mdaughter_daughter_corpse', p), true);
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
    // TWO TORN ROBES, AND A NEEDLE AND THREAD. The cupboard used to hand out the finished robes;
    // it hands out elid_robetop_torn and elid_robebottoms_torn now - "This robe is too torn to
    // wear.", which is what the cache says about them and what they were referenced by nothing
    // for - and sewing both of them is what reaches ^elid_has_robes. The whole of the rest of
    // this quest block was failing because the player never had a wearable robe.
    op(p, 3420, 2930, 'elid_cupboard_closed_withrobes');
    op(p, 3420, 2930, 'elid_cupboard_open_withrobes', 2);
    check('torn robes from the cupboard, and the stage has not moved for them', [H.invCount(p, 'elid_robetop_torn'), H.invCount(p, 'elid_robebottoms_torn'), H.getVarBit(p, 'elidquest')], [1, 1, 20]);
    H.give(p, 'needle');
    H.give(p, 'thread', 2);
    useHeld(p, 'needle', 'elid_robetop_torn');
    check('  one sewn: still 20, because the shrine wants both', [H.invCount(p, 'elid_robetop'), H.getVarBit(p, 'elidquest')], [1, 20]);
    useHeld(p, 'needle', 'elid_robebottoms_torn');
    check('robes from the cupboard, sewn: stage 25', [H.getVarBit(p, 'elidquest'), H.invCount(p, 'elid_robetop'), H.invCount(p, 'elid_robebottoms')], [25, 1, 1]);
    H.clearInv(p);
    H.equip(p, { torso: 'elid_robetop', legs: 'elid_robebottoms' });
    // AND THE BALLAD, which the robe door wants as well as the robes: "You are dressed for the
    // shrine and you do not know a word anybody down here would recognise." Ghaslor hands it over
    // above and the clearInv on the line before this threw it away, so the door below stayed shut
    // and every check past it was reporting a player who had not moved.
    H.give(p, 'elid_ballad');
    p.teleport(3374, 2904, 0);
    H.tick(1);
    op(p, 3373, 2904, 'elid_crevice_clickzone');
    check('down the crevice: a free tile in the water source (was solid rock)', [at(p), free(p), H.getVarBit(p, 'elidquest')], [[3349, 9537, 0], true, 27]);
    check('  the exit is in reach from the landing', reach(0, p.x, p.z)(3349, 9536), true);
    op(p, 3347, 9533, 'elid_underground_exit');
    check('  and Leave takes you back up', at(p), [3374, 2903, 0]);
    talk(p, 'elid_shiratti');
    check("Shiratti's key", H.invCount(p, 'elid_key'), 1);
    p.teleport(3374, 2904, 0);
    H.tick(1);
    op(p, 3373, 2904, 'elid_crevice_clickzone');

    op(p, 3353, 9544, 'elid_underground_robe_door');
    check('the robe door (robes and ballad): through to the hub', [at(p), free(p)], [[3353, 9545, 0], true]);
    op(p, 3354, 9558, 'elid_underground_lake_door');
    check('the lake door: through to the spirits', [at(p), free(p)], [[3354, 9559, 0], true]);
    check('  the spirits are talked to on foot', walkTalk(p, 'elid_waterspirit'), true);
    check('  stage met_spirits', H.getVarBit(p, 'elidquest'), 30);
    op(p, 3354, 9558, 'elid_underground_lake_door');
    check('  and back through the lake door', at(p), [3354, 9557, 0]);

    H.give(p, 'rune_pickaxe');
    // THE GOLEM IS FOUGHT INSIDE THIS CLICK, and there is no honest way to catch it standing.
    // The door spawns it on the far side on npc_setmode(opplayer2), op()'s drive() counts a player
    // with a combat target as busy, and a maxed player with auto-retaliate kills a golem long
    // before drive() goes idle - so by the time the click returns the room is empty and
    // H.npcNear finds nothing. Asking for the npc was asking to see a fight that had already
    // finished; what PROVES it happened is the bit, which only [ai_queue3,elid_golem_grey] ->
    // [queue,elid_golem_down] sets, and which npc_find deliberately is not used for because it
    // "cannot tell killed from despawned twenty minutes later". Measured, not assumed: elid_main
    // reads 158 on the way in with bit 13 clear, and 1/bit 13 set on the way out.
    op(p, 3374, 9547, 'elid_greygolem_door');
    H.tick(3);
    check('grey golem door: the key opens it, you go through, and its golem is beaten', [at(p), free(p), H.getVarBit(p, 'elid_greygolem')], [[3375, 9547, 0], true, 1]);
    op(p, 3378, 9547, 'elid_waterchannel_mining_multiloc');
    check('  clear the fallen rock (trigger on the multiloc shell)', H.getVarBit(p, 'elid_miningchannel'), 1);
    op(p, 3374, 9547, 'elid_greygolem_door');
    check('  and back out', at(p), [3373, 9547, 0]);

    op(p, 3365, 9542, 'elid_whitegolem_door');
    check('white golem door: through, south, and its golem beaten too', [at(p), free(p), H.getVarBit(p, 'elid_whitegolem')], [[3365, 9541, 0], true, 1]);
    op(p, 3365, 9538, 'elid_waterchannel_thieving_multiloc');
    check('  clear the spike trap', H.getVarBit(p, 'elid_thievingchannel'), 1);
    op(p, 3365, 9542, 'elid_whitegolem_door');

    op(p, 3372, 9556, 'elid_blackgolem_door');
    check('black golem door: through, east', [at(p), free(p)], [[3373, 9556, 0], true]);
    H.give(p, 'bronze_arrow', 5);
    // THE SHOT IS TAKEN FROM A DISTANCE, AND THE FIRST CLICK ONLY SETS THE RANGE. The channel runs
    // between the target and the black golem's room so nobody can stand beside it, which is why the
    // content uses [apnpcu]: it opens with `if (npc_range(coord) > 7) { p_aprange(7); return; }`, so
    // a click from further out asks the engine to re-run the trigger once the player has walked into
    // range - and the walk needs ticks the sim was not giving it. One click with no ticks lands the
    // arrow only when the black golem's door happens to leave the player inside seven tiles, which
    // is why this passed alone and failed in a sweep twenty minutes later.
    // AND THE GOLEM IS FOUGHT INSIDE THE DOOR CLICK ABOVE, which leaves the player wherever the
    // fight ended with a combat target still set - and a combat target replaces the interaction
    // this shot needs. Settle first, then keep asking: the approach has to be walked, and thirty
    // ticks was not enough for it once a fight was happening first.
    H.tick(10);
    p.clearPendingAction();
    const target = findNpc('elid_ranging_target_multinpc', p);
    for (let t = 0; t < 90 && H.getVarBit(p, 'elid_rangingchannel') === 0; t++) {
        if (t % 10 === 0) useOnNpc(p, target, 'bronze_arrow');
        H.tick(1);
    }
    check('  an arrow on the target from across the channel', [H.getVarBit(p, 'elid_rangingchannel'), H.getVarBit(p, 'elidquest')], [1, 35]);
    op(p, 3372, 9556, 'elid_blackgolem_door');

    // the genie
    p.teleport(3374, 2904, 0);
    H.tick(1);
    op(p, 3373, 2904, 'elid_crevice_clickzone', 1, [2]);
    check("the crevice now forks: the genie's cave, on a free tile", [at(p), free(p)], [[3374, 9306, 0], true]);
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
    check("Nardah's bank booth opens the bank", n.containsModalInterface() || H.ifaces.some(i => i.who === 'nardah' && i.kind === 'open'), true);
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
    check("Awusah's stairs go up, onto a free tile", [at(n), free(n)], [[3446, 2910, 1], true]);
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
    check("Rind's letter", H.invCount(p, 'forget_gardener_letter'), 1);
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
    check("  Franklin, Arnold, Herman's desk and the fishing grounds are in reach", [reach(0, p.x, p.z)(2344, 3667), reach(0, p.x, p.z)(2330, 3691), reach(0, p.x, p.z)(2354, 3683), reach(0, p.x, p.z)(2343, 3702)], [true, true, true, true]);
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
    check("monkfish from the colony's spots", H.getVarBit(p, 'swansong_fish') >= 5, true);
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
    check("Kathy's boat, stronghold end: Travel to the colony, a free tile", [at(k), free(k)], [[2357, 3639, 0], true]);
    talk(k, 'swan_boatwoman_2', [], 3);
    check('  and back', [at(k), free(k)], [[2368, 3485, 0], true]);
}

// ============================================================================== In Search of the Myreque
console.log('IN SEARCH OF THE MYREQUE');
{
    const p = player('myreque', 3494, 3463);
    H.setVar(p, 'routequest', 0);
    op(p, 3494, 3464, 'thrt_tavern_trap_door');
    check("down the trapdoor, below the ladder on a free tile (was the ladder's own tile)", [at(p), free(p)], [[3477, 9845, 0], true]);
    check('  Veliaf cannot be reached from the cellar on foot', reach(0, p.x, p.z)(3506, 9838), false);
    op(p, 3480, 9837, 'thrttavernbasementfalsewall');
    check('Search the false wall: through into the Hollows', [at(p), free(p)], [[3480, 9836, 0], true]);
    check("  the Myreque's door is in reach", reach(0, p.x, p.z)(3500, 9812), true);
    op(p, 3500, 9812, 'freedomfighterundergroundentrancel');
    check('  their door: into the hideout', [at(p), free(p)], [[3505, 9832, 0], true]);
    check('  Veliaf, on foot', walkTalk(p, 'route_veliaf_hurtz', [1, 1, 1, 1]), true);
    check('  three questions right: sent for the route', H.getVar(p, 'routequest'), 3);
    op(p, 3505, 9831, 'route_cavewalltunnel');
    check("the hideout's tunnel: back out by the door", [at(p), free(p)], [[3500, 9811, 0], true]);

    // the ladder, Cyreg, Curpile
    p.teleport(3483, 9842, 0);
    H.tick(1);
    H.give(p, 'hammer');
    H.give(p, 'nails', 10);
    H.give(p, 'woodplank', 3);
    for (let i = 0; i < 3; i++) op(p, 3483, 9841, 'ladder_broken');
    check('three rungs', H.getVarBit(p, 'bridgerung3'), 1);
    op(p, 3483, 9841, 'ladder_broken');
    check('  climb it: the south swamp, a free tile', [at(p), free(p)], [[3498, 3382, 0], true]);
    talk(p, 'route_cyreg_paddlehorn');
    talk(p, 'route_curpile_fyod');
    p.teleport(3498, 3376, 0);
    H.tick(1);
    op(p, 3498, 3377, 'route_rowboat_hollows');
    check('the boat under the bank: a free tile by the stalagmite (was blocked)', [at(p), free(p)], [[3491, 9821, 0], true]);
    p.teleport(3505, 9833, 0);
    H.tick(1);
    talk(p, 'route_veliaf_hurtz');
    check('Veliaf: complete', H.getVar(p, 'routequest'), 5);
    H.clearLogs();
    talk(p, 'multi_vanstrom_stranger_entity');
    check(
        'the man in the tavern chair answers Talk-to',
        H.ifaces.some(i => i.who === 'myreque' && i.kind === 'text' && (i.text ?? '').includes('passing through')),
        true
    );
}

// ============================================================================== getting there on foot
console.log('GETTING THERE ON FOOT');
{
    // IT IS NOT AN ISLAND, which is what this used to assert. A flood from Herman's tile reaches the
    // Stronghold gate in 388 steps, down the coast at x 2346-2367 from z 3650 to z 3425 and then
    // east - a real walking route, not a gap in the collision map - and Old School is the same: the
    // Piscatoris colony can be walked to from the Eagles' Peak side and Kathy's boat is a shortcut
    // rather than the only way in. So the check now asserts the route, which is the thing worth
    // holding: if an import ever walls the coast off, the boat still works and nothing else would
    // notice. Kathy's own two legs are below.
    check('Swan Song: the ground Herman stands on can be walked to from the mainland', reach(0, 2461, 3382, 300)(2345, 3650), true);
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
