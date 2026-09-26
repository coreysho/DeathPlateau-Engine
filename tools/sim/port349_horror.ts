// Horror from the Deep as ported from PlagueCityRS 349 (the original dialogue, stages and layout),
// played start to finish on the real engine, plus the save migration from this server's old version.
// Usage: BUILD_SRC_DIR=<content> npx tsx tools/sim/port349_horror.ts
//
// Larrissa, Gunnjorn's key, the bridge (ours: a plank on your own side, leap, plank, safe crossing),
// the front door into the quest's copy of the lighthouse (m38_71), the bookcase and its three books,
// the spiral stairs, the broken lamp, the lit top floor (m39_56), the basement ladder, the strange
// wall and its study window, Jossik in his cave, the Dagannoth rising out of the water, the Mother and
// her colours, the ending, the casket, the god books (pages, blessing, preaching, buying, reclaiming),
// the post-quest caves - and old saves being translated at login.
import * as H from './harness.js';
import World from '#/engine/World.js';
import Npc from '#/engine/entity/Npc.js';
import Player from '#/engine/entity/Player.js';
import Component from '#/cache/config/Component.js';
import ObjType from '#/cache/config/ObjType.js';
import InvType from '#/cache/config/InvType.js';
import LocType from '#/cache/config/LocType.js';
import NpcType from '#/cache/config/NpcType.js';
import ScriptState from '#/engine/script/ScriptState.js';
import ScriptProvider from '#/engine/script/ScriptProvider.js';
import ScriptRunner from '#/engine/script/ScriptRunner.js';
import ServerTriggerType from '#/engine/script/ServerTriggerType.js';
import { Interaction } from '#/engine/entity/Interaction.js';
import { findPathToLoc, canTravel } from '#/engine/GameMap.js';
import { CollisionType } from '#/engine/routefinder/index.js';

// every runtime script error, from any script, anywhere
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

const vb = (p: Player, n: string) => H.getVarBit(p, n);
const stage = (p: Player) => vb(p, 'horrorquest');
const at = (p: Player) => [p.x, p.z, p.level];
const mesSince = (p: Player, from: number) => H.mesgs.slice(from).filter(m => m.who === p.username).map(m => m.text);
const lastMes = (p: Player) => H.mesgs.filter(m => m.who === p.username).map(m => m.text).slice(-1)[0] ?? '';
const typeName = (n: Npc) => NpcType.get(n.type).debugname;

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

function slotOf(p: Player, objName: string) {
    const id = ObjType.getId(objName);
    const inv = p.getInventory(InvType.INV)!;
    for (let i = 0; i < inv.capacity; i++) if (inv.get(i)?.id === id) return i;
    throw new Error('not carrying ' + objName);
}

/** While true, a fight going on does not count as busy: settle() only waits for scripts and queues. */
let fighting = false;
/** Let a script run out, clicking through chat pages and taking `picks` at menus (1-based). */
function settle(p: Player, picks: number[] = [], max = 300): string[] {
    const from = H.ifaces.length;
    let idle = 0;
    for (let guard = 0; guard < max; guard++) {
        const s = p.activeScript;
        if (s && s.execution === ScriptState.PAUSEBUTTON) {
            idle = 0;
            const names = p.resumeButtons.map((id: number) => Component.get(id).comName ?? '');
            const open = p.modalChat === -1 ? '' : Component.get(p.modalChat).comName ?? '';
            const multi = open.startsWith('multi') ? names.find((n: string) => n.startsWith(open + ':')) : null;
            if (multi) {
                const pick = picks.shift();
                if (pick === undefined) throw new Error('unexpected menu: ' + names.join(','));
                H.choose(p, `${multi.split(':')[0]}:com_${pick}`);
            } else {
                p.executeScript(s, true, true);
            }
            continue;
        }
        H.tick(1);
        if (!p.activeScript && (fighting || !p.target) && !p.delayed && p.queue.head() === null) {
            if (++idle >= 3) break;
        } else idle = 0;
    }
    if (picks.length) throw new Error('menus not reached: ' + picks.join(','));
    return H.ifaces.slice(from).filter(i => i.who === p.username && i.kind === 'text' && i.text && i.text.length > 1).map(i => i.text!);
}

function talk(p: Player, npcName: string, picks: number[] = [], op = 1): string[] {
    const from = H.ifaces.length;
    const more = talk0(p, npcName, picks, op);
    return H.ifaces.slice(from).filter(i => i.who === p.username && i.kind === 'text' && i.text && i.text.length > 1).map(i => i.text!).concat(more);
}
function talk0(p: Player, npcName: string, picks: number[] = [], op = 1): string[] {
    const npc = [p.level, 0, 1, 2, 3].map(l => H.npcNear(npcName, p.x, p.z, l)).find(n => n && Math.abs(n.x - p.x) < 40 && Math.abs(n.z - p.z) < 40);
    if (!npc) throw new Error('no npc ' + npcName + ' near ' + at(p));
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1], [2, 0], [0, 2], [-2, 0], [0, -2]]) {
        p.teleport(npc.x + dx, npc.z + dz, npc.level);
        H.tick(1);
        H.opNpc(p, npc, op);
        for (let t = 0; t < 10 && !p.activeScript; t++) H.tick(1);
        if (p.activeScript) break;
    }
    return settle(p, picks);
}

function findLoc(p: Player, x: number, z: number, locName: string) {
    const id = LocType.getId(locName);
    if (id === -1) throw new Error('no such loc ' + locName);
    const loc = World.getLoc(x, z, p.level, id);
    if (!loc) throw new Error(`no ${locName} at ${x},${z},${p.level}`);
    return loc;
}

function useOnLoc(p: Player, objName: string, x: number, z: number, locName: string, picks: number[] = []) {
    const loc = findLoc(p, x, z, locName);
    p.clearPendingAction();
    p.lastUseItem = ObjType.getId(objName);
    p.lastUseSlot = slotOf(p, objName);
    p.queueWaypoints(findPathToLoc(p.level, p.x, p.z, loc.x, loc.z, p.width, loc.width, loc.length, loc.angle, loc.shape, LocType.get(loc.type).forceapproach));
    p.setInteraction(Interaction.ENGINE, loc, ServerTriggerType.APLOCU);
    (p as unknown as { opcalled: boolean }).opcalled = true;
    return settle(p, picks);
}

function op(p: Player, x: number, z: number, locName: string, n = 1, picks: number[] = []) {
    findLoc(p, x, z, locName);
    H.opLoc(p, x, z, locName, n);
    return settle(p, picks);
}

/** OpHeldUHandler's lookup: [opheldu,target], else [opheldu,used] with the two swapped. */
function useOnHeld(p: Player, used: string, target: string) {
    p.lastItem = ObjType.getId(target);
    p.lastSlot = slotOf(p, target);
    p.lastUseItem = ObjType.getId(used);
    p.lastUseSlot = slotOf(p, used);
    let script = ScriptProvider.getByTriggerSpecific(ServerTriggerType.OPHELDU, p.lastItem, -1);
    if (!script) {
        script = ScriptProvider.getByTriggerSpecific(ServerTriggerType.OPHELDU, p.lastUseItem, -1);
        [p.lastItem, p.lastUseItem] = [p.lastUseItem, p.lastItem];
        [p.lastSlot, p.lastUseSlot] = [p.lastUseSlot, p.lastSlot];
    }
    if (!script) throw new Error(`no opheldu for ${used} on ${target}`);
    p.executeScript(ScriptRunner.init(script, p), true);
    return settle(p);
}

function heldOp(p: Player, objName: string, n: number, picks: number[] = []) {
    const from = H.ifaces.length;
    H.opheld(p, objName, n);
    const more = settle(p, picks);
    return H.ifaces.slice(from).filter(i => i.who === p.username && i.kind === 'text' && i.text && i.text.length > 1).map(i => i.text!).concat(more);
}
/** Everything said, as one string - chat lines wrap mid-sentence. */
const said = (lines: string[]) => lines.join(' ');

function connected(level: number, x: number, z: number, tx: number, tz: number, radius = 80): boolean {
    const seen = new Set<string>([x + ',' + z]);
    const q = [[x, z]];
    while (q.length) {
        const [cx, cz] = q.pop()!;
        if (cx === tx && cz === tz) return true;
        for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            const nx = cx + dx, nz = cz + dz, k = nx + ',' + nz;
            if (seen.has(k) || Math.abs(nx - x) > radius || Math.abs(nz - z) > radius) continue;
            if (canTravel(level, cx, cz, dx, dz, 1, 0, CollisionType.NORMAL)) { seen.add(k); q.push([nx, nz]); }
        }
    }
    return false;
}

function bankCount(p: Player, name: string) {
    const id = ObjType.getId(name);
    const inv = p.getInventory(InvType.getId('bank'))!;
    let n = 0;
    for (let i = 0; i < inv.capacity; i++) { const s = inv.get(i); if (s && s.id === id) n += s.count; }
    return n;
}

function npcsNear(names: string[], x: number, z: number, level: number, radius = 30): Npc[] {
    const ids = new Set(names.map(n => NpcType.getId(n)));
    const out: Npc[] = [];
    for (const n of World.npcs) if (n && n.isActive && ids.has(n.type) && n.level === level && Math.abs(n.x - x) <= radius && Math.abs(n.z - z) <= radius) out.push(n);
    return out;
}

const MOTHER = ['horror_dagganoth_aira', 'horror_dagganoth_airb', 'horror_dagganoth_airc', 'horror_dagganoth_air', 'horror_dagganoth_water', 'horror_dagganoth_melee', 'horror_dagganoth_earth', 'horror_dagganoth_fire', 'horror_dagganoth_ranged'];
const JR = ['horror_dagannoth_jr1', 'horror_dagannoth_jr2', 'horror_dagannoth_jr3', 'horror_dagannoth_jr4'];

// ================================================================================ the whole quest
console.log('HORROR FROM THE DEEP - the original, start to finish');
const p = player('hftd349', 2508, 3633);
H.equip(p, { rhand: 'rune_scimitar' });
const qp0 = H.getVar(p, 'qp');
const e0 = errors.length;
{
    console.log('Larrissa, outside the lighthouse:');
    const words = talk(p, 'horror_girlfriend_prequest', [1, 1, 1, 3]);
    check('the original dialogue ("Oh, thank Armadyl!")', said(words).includes('thank Armadyl'), true);
    check('"Okay, I\'ll help!": started', stage(p), 1);

    console.log('Gunnjorn at the agility course:');
    p.teleport(2540, 3550, 0);
    H.tick(1);
    talk(p, 'gunnjorn');
    check('he hands over Larrissa\'s key', [H.invCount(p, 'horror_key'), vb(p, 'horroragilitykey')], [1, 1]);
    H.clearInv(p);
    talk(p, 'gunnjorn');
    check('lost it: he gives another', H.invCount(p, 'horror_key'), 1);

    console.log('The front door, before the bridge:');
    p.teleport(2509, 3635, 0);
    H.tick(1);
    op(p, 2509, 3636, 'horror_lighthouse_doorway');
    check('the key unlocks the door and is used up', [vb(p, 'horrorlighthouseentrance'), H.invCount(p, 'horror_key'), lastMes(p)], [1, 0, 'You unlock the Lighthouse front door.']);
    const w = op(p, 2509, 3636, 'horror_lighthouse_doorway');
    check('bridge still broken: Larrissa won\'t go in, still outside', [p.z < 3636, said(w).includes('fix the bridge')], [true, true]);

    console.log('The broken bridge (ours: a plank on your own side, leap, plank, safe crossing):');
    p.teleport(2594, 3608, 0);
    H.tick(1);
    H.give(p, 'woodplank', 2);
    H.give(p, 'nails', 8);
    op(p, 2596, 3608, 'horror_broken_bridge_left_spot');
    check('Cross before any plank: refused', [p.x <= 2596, lastMes(p).includes('too rotten')], [true, true]);
    useOnLoc(p, 'woodplank', 2596, 3608, 'horror_broken_bridge_left_spot');
    check('no hammer: the original\'s refusal, nothing used', [vb(p, 'horrorbridgeleft'), H.invCount(p, 'woodplank')], [0, 2]);
    H.give(p, 'hammer');
    useOnLoc(p, 'woodplank', 2596, 3608, 'horror_broken_bridge_left_spot');
    check('west span: 1 plank, 4 nails', [vb(p, 'horrorbridgeleft'), H.invCount(p, 'woodplank'), H.invCount(p, 'nails')], [1, 1, 4]);
    useOnLoc(p, 'woodplank', 2596, 3608, 'horror_broken_bridge_left_spot');
    check('the same span again: refused', H.invCount(p, 'woodplank'), 1);
    op(p, 2596, 3608, 'horror_broken_bridge_left_spot');
    check('leap the gap to the east span', at(p), [2598, 3608, 0]);
    useOnLoc(p, 'woodplank', 2598, 3608, 'horror_broken_bridge_right_spot');
    check('east span: both halves down, all planks and nails used', [vb(p, 'horrorbridgeright'), H.invCount(p, 'woodplank'), H.invCount(p, 'nails')], [1, 0, 0]);
    const hp = p.levels[3];
    op(p, 2598, 3608, 'horror_broken_bridge_right_spot');
    check('repaired: back west without a scratch', [at(p), p.levels[3] === hp, lastMes(p)], [[2596, 3608, 0], true, 'You cross the repaired bridge.']);

    console.log('Into the lighthouse (the quest\'s copy, m38_71):');
    p.teleport(2509, 3635, 0);
    H.tick(1);
    op(p, 2509, 3636, 'horror_lighthouse_doorway');
    check('in: stage 2, inside m38_71', [stage(p), at(p)], [2, [2445, 4596, 0]]);
    op(p, 2445, 4596, 'horror_lighthouse_doorway');
    check('and out again, to the real front step', at(p), [2509, 3635, 0]);
    op(p, 2509, 3636, 'horror_lighthouse_doorway');
    check('and back in', at(p), [2445, 4596, 0]);
    const lw = talk(p, 'horror_girlfriend_postquest');
    check('Larrissa inside: "you must fix the light"', said(lw).includes('must fix the light'), true);
    p.teleport(2445, 4603, 0);
    H.tick(1);
    const lt = op(p, 2445, 4604, 'horror_ladder_top');
    check('the ladder down is refused until the lamp is fixed (Larrissa: "Do not let curiosity...")', [p.level, p.z < 4608, said(lt).includes('curiosity') || lastMes(p) === 'You must fix the lighthouse before any ships crash!'], [0, true, true]);

    console.log('The bookcase:');
    p.teleport(2442, 4602, 0);
    H.tick(1);
    op(p, 2442, 4600, 'horror_lighthouse_spiralstairs_base');
    check('stairs up to the middle floor', p.level, 1);
    p.teleport(2444, 4603, 1);
    H.tick(1);
    op(p, 2444, 4604, 'horror_bookcase', 1, [4]);
    check('"Take all three books"', ['horror_diary1', 'horror_diary2', 'horror_diary3'].map(n => H.invCount(p, n)), [1, 1, 1]);
    const d1 = heldOp(p, 'horror_diary1', 1);
    check('Jossik\'s journal opens on its first page', d1.some(t => t.includes('Bennath')), true);
    H.ifButton(p, 'book:com_86');
    settle(p);
    check('  and turns to the next', H.getVar(p, 'book_page'), 1);
    const d3 = heldOp(p, 'horror_diary3', 1);
    check('the manual says what fixes the lamp', d3.some(t => t.includes('Lightomatic')), true);
    p.teleport(2441, 4601, 1);
    H.tick(1);
    op(p, 2442, 4600, 'horror_lighthouse_spiralstairs_middle', 2);
    check('Climb-up: the quest copy\'s top floor', at(p), [2441, 4601, 2]);

    console.log('The broken lamp:');
    for (const it of ['tinderbox', 'swamp_tar', 'molten_glass']) H.give(p, it);
    p.teleport(2443, 4598, 2);
    H.tick(1);
    useOnLoc(p, 'tinderbox', 2443, 4599, 'horror_lighthouse_cog_broken');
    check('tinderbox before the tar: not flammable', [vb(p, 'horrorlight'), lastMes(p)], [0, 'The torch does not seem to be flammable...']);
    useOnLoc(p, 'swamp_tar', 2443, 4599, 'horror_lighthouse_cog_broken');
    useOnLoc(p, 'molten_glass', 2443, 4599, 'horror_lighthouse_cog_broken');
    check('tar and glass in, both used up, stage unchanged', [vb(p, 'horrortar'), vb(p, 'horrorglass'), H.invCount(p, 'swamp_tar'), H.invCount(p, 'molten_glass'), stage(p)], [1, 1, 0, 0, 2]);
    useOnLoc(p, 'tinderbox', 2443, 4599, 'horror_lighthouse_cog_broken');
    check('lit: stage 4, standing on the real lighthouse\'s lit top floor', [stage(p), vb(p, 'horrorlight'), p.x - 2443 === 64, p.z, p.level], [4, 1, true, 4598 - 960, 2]);
    p.teleport(2505, 3641, 2);
    H.tick(1);
    op(p, 2506, 3641, 'horror_lighthouse_spiralstairs_top');
    check('down the stairs from the lit top floor: back into the quest copy', at(p), [2442, 4602, 1]);
    p.teleport(2441, 4601, 1);
    H.tick(1);
    op(p, 2442, 4600, 'horror_lighthouse_spiralstairs_middle', 3);
    check('Climb-down to the ground floor', at(p), [2442, 4602, 0]);
    const lw3 = talk(p, 'horror_girlfriend_postquest');
    check('Larrissa: "Excellent work"', said(lw3).includes('Excellent work'), true);

    console.log('The basement and the strange wall:');
    p.teleport(2445, 4603, 0);
    H.tick(1);
    op(p, 2445, 4604, 'horror_ladder_top');
    check('down the iron ladder into the basement, south of the wall', at(p), [2518, 4618, 1]);
    check('the wall is reachable on foot', connected(1, p.x, p.z, 2514, 4626), true);
    p.teleport(2514, 4626, 1);
    H.tick(1);
    op(p, 2516, 4627, 'horror_far_right_door');
    check('the far right panel will not move yet', [p.z, lastMes(p)], [4626, 'You cannot see any way to move this part of the wall...']);
    op(p, 2514, 4627, 'horror_mid_left_door');
    check('Study: the engraved wall window (inter_201) opens', p.modalMain, Component.getId('inter_201'));
    p.closeModal();
    for (const it of ['firerune', 'waterrune', 'earthrune', 'airrune', 'bronze_dagger', 'bronze_arrow']) H.give(p, it, it.endsWith('rune') ? 5 : 1);
    useOnLoc(p, 'firerune', 2514, 4627, 'horror_mid_left_door', [2]);
    check('"No": nothing placed', [vb(p, 'horrorfire'), H.invCount(p, 'firerune')], [0, 5]);
    for (const it of ['firerune', 'waterrune', 'earthrune', 'airrune', 'bronze_dagger', 'bronze_arrow']) useOnLoc(p, it, 2514, 4627, 'horror_mid_left_door', [1]);
    check('all six placed, one of each used', [['horrorfire', 'horrorwater', 'horrorearth', 'horrorair', 'horrorsword', 'horrorarrow'].map(n => vb(p, n)), H.invCount(p, 'firerune'), H.invCount(p, 'bronze_dagger')], [[1, 1, 1, 1, 1, 1], 4, 0]);
    check('  "You hear the sound of something moving within the wall."', H.mesgs.some(m => m.who === p.username && m.text.includes('something moving within the wall')), true);
    op(p, 2516, 4627, 'horror_far_right_door');
    check('the far right panel lets you through, north', [p.z >= 4627, p.level], [true, 1]);
    op(p, 2515, 4630, 'horror_ladder_top2');
    check('down the ladder into Jossik\'s cave', [p.level, p.z > 4630 && p.z < 4640], [0, true]);

    console.log('Jossik, and the Dagannoth:');
    fighting = true;
    const jw = talk(p, 'horror_lighthousekeeeper_injured');
    check('Jossik: "I think my leg is broken"', said(jw).includes('leg is broken'), true);
    H.tick(8);
    settle(p);
    const jr4 = npcsNear(['horror_dagannoth_jr4'], p.x, p.z, 0)[0];
    check('a Dagannoth rises out of the water and comes for me', jr4 !== undefined && jr4.target === p, true);
    const other = player('hftdother', p.x + 2, p.z, 0);
    if (jr4) {
        H.attackNpc(other, jr4);
        H.tick(3);
        check('someone else attacking it: "It\'s not after you..."', lastMes(other), "It's not after you...");
        H.despawn(other);
    }
    talk(p, 'horror_lighthousekeeeper_injured');
    check('talking to Jossik again does not add a second one', npcsNear(JR, p.x, p.z, 0).length, 1);
    if (jr4) {
        const ms = H.mesgs.length;
        H.attackNpc(p, jr4);
        for (let t = 0; t < 500 && jr4.isActive; t++) {
            H.tick(1);
            if (!p.target && !p.delayed && t % 6 === 5) H.attackNpc(p, jr4);
            if (p.levels[3] < 40) p.levels[3] = 99;
            if (p.activeScript && p.activeScript.execution === ScriptState.PAUSEBUTTON) break;
        }
        check('the Dagannoth dies', jr4.isActive, false);
        settle(p);
        void ms;
    }
    check('stage 5, and Jossik: "That was one of its babies"', stage(p), 5);
    const colours: string[] = [];
    const m0 = H.mesgs.length;
    let mother: Npc | undefined;
    const track = () => {
        mother = mother && mother.isActive ? mother : npcsNear(MOTHER, p.x, p.z, 0, 40)[0];
        if (mother) {
            const tn = typeName(mother);
            if (colours[colours.length - 1] !== tn) colours.push(tn);
        }
        if (p.levels[3] < 40) p.levels[3] = 99;
    };
    for (let t = 0; t < 8; t++) { H.tick(1); track(); }
    check('the Dagannoth Mother surfaces out of the water, white, and comes for me', [colours.includes('horror_dagganoth_air'), mother?.target === p], [true, true]);

    console.log('The Mother\'s colours, and killing her:');
    // Wait for her melee (orange) form, keeping the player alive: only melee hurts her then.
    for (let t = 0; t < 200 && mother && mother.isActive && typeName(mother) !== 'horror_dagganoth_melee'; t++) {
        H.tick(1);
        track();
    }
    check('white, then blue, then orange - 30 ticks apart', colours.filter(c => !/air[abc]$/.test(c)), ['horror_dagganoth_air', 'horror_dagganoth_water', 'horror_dagganoth_melee']);
    check('  "The Dagannoth changes to blue..." / "...to orange..."', [mesSince(p, m0).includes('The Dagannoth changes to blue...'), mesSince(p, m0).includes('The Dagannoth changes to orange...')], [true, true]);
    const hitsBefore = H.npcHits.length;
    if (mother) {
        mother.levels[3] = 3;
        H.attackNpc(p, mother);
        for (let t = 0; t < 60 && mother.isActive; t++) {
            H.tick(1);
            if (!p.target && !p.delayed && t % 5 === 4) H.attackNpc(p, mother);
            if (p.levels[3] < 40) p.levels[3] = 99;
            if (typeName(mother) !== 'horror_dagganoth_melee') mother.levels[3] = Math.max(mother.levels[3], 3);
        }
    }
    check('melee hurts her in her orange form, and she dies', [H.npcHits.slice(hitsBefore).some(h => h.damage > 0), mother?.isActive], [true, false]);
    settle(p);
    fighting = false;
    check('QUEST COMPLETE: stage 10, the casket, in the post-quest caves (m39_156)', [stage(p), H.invCount(p, 'horror_casket'), p.z > 9984, p.level], [10, 1, true, 1]);
    check('2 quest points', H.getVar(p, 'qp') - qp0, 2);
    check('4,662 XP in Strength, Ranged and Magic', [p.stats[2] >= 46620, p.stats[4] >= 46620, p.stats[6] >= 46620], [true, true, true]);
    check('no script errors in the quest', errors.slice(e0), []);
}

// ================================================================================ after the quest
console.log('Jossik, upstairs, and the casket:');
{
    const e1 = errors.length;
    op(p, 2519, 9994, 'horror_ladder_base');
    check('the basement ladder climbs into the real lighthouse now', [p.z > 3584 && p.z < 3648, p.level], [true, 0]);
    op(p, 2509, 3644, 'horror_ladder_top');
    check('and the lighthouse ladder goes down to the dagannoth caves', [p.z > 9984, p.level], [true, 1]);
    p.teleport(2509, 3638, 1);
    H.tick(1);
    const cw = talk(p, 'horror_lighthousekeeeper_well', [1, 1]);
    check('"Saradomin" twice: the Holy Book of Saradomin, the casket gone', [H.invCount(p, 'unfinished_saradominbook'), H.invCount(p, 'horror_casket'), vb(p, 'horror_claimed_holybook'), said(cw).includes('Holy Book of Saradomin')], [1, 0, 1, true]);
    heldOp(p, 'unfinished_saradominbook', 3);
    check('Check: every page still missing', lastMes(p), 'Pages still missing: 1, 2, 3, 4.');
    for (let i = 1; i <= 4; i++) { H.give(p, 'holy_book_s_page' + i); useOnHeld(p, 'holy_book_s_page' + i, 'unfinished_saradominbook'); if (i === 2) { heldOp(p, 'unfinished_saradominbook', 3); check('  after two pages', lastMes(p), 'Pages still missing: 3, 4.'); } }
    check('four pages: the finished Holy book', [H.invCount(p, 'saradominbook_complete'), H.invCount(p, 'unfinished_saradominbook')], [1, 0]);
    H.give(p, 'holy_book_z_page1');
    H.give(p, 'stringstar');
    useOnHeld(p, 'stringstar', 'saradominbook_complete');
    check('it blesses a holy symbol', [H.invCount(p, 'blessedstar'), H.invCount(p, 'stringstar')], [1, 0]);
    H.setVar(p, 'sa_energy', 1000);
    heldOp(p, 'saradominbook_complete', 3, [3]);
    check('Preach: "Blessings" is said aloud and costs 25% special energy', [H.says.some(s => s.who === p.username && s.text.includes('Go in peace')), H.getVar(p, 'sa_energy')], [true, 750]);
    H.give(p, 'coins', 5000);
    talk(p, 'horror_lighthousekeeeper_well', [2, 1]);
    check('"new prayerbooks?": buy a book of Zamorak for 5,000', [H.invCount(p, 'unfinished_zamorakbook'), H.invCount(p, 'coins'), vb(p, 'horror_claimed_unholybook')], [1, 0, 1]);
    H.clearInv(p);
    talk(p, 'horror_lighthousekeeeper_well', [2]);
    check('both lost: he found them washed up, and hands them back', [H.invCount(p, 'saradominbook_complete'), H.invCount(p, 'unfinished_zamorakbook')], [1, 1]);
    talk(p, 'horror_lighthousekeeeper_well', [1]);
    check('Trade opens The Lighthouse Store', p.modalMain === Component.getId('shop_template'), true);
    p.closeModal();
    const j0 = H.ifaces.length;
    H.ifButton(p, 'questlist:horror');
    settle(p);
    check('journal: QUEST COMPLETE', H.ifaces.slice(j0).some(i => i.who === p.username && (i.text ?? '').includes('QUEST COMPLETE')), true);
    p.teleport(2509, 3637, 0);
    H.tick(1);
    op(p, 2509, 3636, 'horror_lighthouse_doorway');
    check('the front door, after the quest: out', p.z, 3635);
    op(p, 2509, 3636, 'horror_lighthouse_doorway');
    check('and into the real lighthouse', [p.x, p.z, p.level], [2509, 3636, 0]);
    const lw = talk(p, 'horror_girlfriend_prequest');
    check('Larrissa outside: thanks', said(lw).includes('rescuing my darling Jossik'), true);
    check('no script errors after the quest', errors.slice(e1), []);
}

console.log('The basalt rocks (the original\'s: fixed landings, slips at the two long jumps):');
{
    const b = player('hftdbasalt', 2522, 3594);
    const m0 = H.mesgs.length;
    const chain: [number, number, string, number[]][] = [
        [2522, 3595, 'horror_jumping_spot1', [2522, 3598]],
        [2522, 3600, 'horror_jumping_spot3', [2522, 3603]],
        [2518, 3611, 'horror_jumping_spot5', [2515, 3611]],
        [2514, 3613, 'horror_jumping_spot7', [2514, 3616]],
        [2514, 3617, 'horror_jumping_spot9', [2514, 3620]]
    ];
    const landed: number[][] = [];
    for (const [x, z, name] of chain) {
        b.levels[3] = 99;
        H.opLoc(b, x, z, name, 1);
        settle(b);
        landed.push([b.x, b.z]);
    }
    check('shore to lighthouse island, rock by rock (99 Agility)', landed, chain.map(c => c[3]));
    check('  never "I can\'t reach that!"', mesSince(b, m0).filter(t => t.includes("reach")).length, 0);
    check('  and the island walks on to the lighthouse door', connected(0, b.x, b.z, 2509, 3635), true);
    for (const [x, z, name] of [[2514, 3619, 'horror_jumping_spot10'], [2514, 3615, 'horror_jumping_spot8'], [2516, 3611, 'horror_jumping_spot6'], [2522, 3602, 'horror_jumping_spot4'], [2522, 3597, 'horror_jumping_spot2']] as [number, number, string][]) {
        b.levels[3] = 99;
        H.opLoc(b, x, z, name, 1);
        settle(b);
    }
    check('  and back to the shore', [b.x, b.z], [2522, 3594]);
}

console.log('Our Waterbirth maze exit, before the quest has let you into the lighthouse:');
{
    const m = player('hftdmazeexit', 2510, 4644, 0);
    H.setVarBit(m, 'horrorquest', 1);
    m.teleport(2515, 4629, 1);
    H.tick(1);
    op(m, 2513, 4627, 'horror_far_left_door');
    check('the far left panel lets me south', m.z < 4627, true);
    m.teleport(2519, 4619, 1);
    H.tick(1);
    op(m, 2519, 4618, 'horror_ladder_base');
    check('the basement ladder climbs into the real lighthouse, not the quest\'s copy (no lamp to skip ahead with)', [m.x < 2560, m.z > 3584 && m.z < 3648, m.level, stage(m)], [true, true, 0, 1]);
    m.teleport(2509, 3637, 0);
    H.tick(1);
    op(m, 2509, 3636, 'horror_lighthouse_doorway');
    check('and out of the front door', m.z, 3635);
}

// ================================================================================ the migration
console.log('OLD SAVES (this server\'s earlier Horror from the Deep) at login:');
{
    type Old = { horror: number; bridges?: number; lighting?: number; wall?: number; give?: string[]; bank?: string[] };
    const login = (name: string, o: Old) => {
        const q = H.makePlayer(name, 3222, 3218, bucket++);
        H.setVar(q, 'horror', o.horror);
        H.setVar(q, 'horror_bridges', o.bridges ?? 0);
        H.setVar(q, 'horror_lighting', o.lighting ?? 0);
        H.setVar(q, 'horror_wall', o.wall ?? 0);
        for (const it of o.give ?? []) q.invAdd(InvType.INV, ObjType.getId(it), 1);
        for (const it of o.bank ?? []) q.invAdd(InvType.getId('bank'), ObjType.getId(it), 1);
        H.tick(3);
        return q;
    };
    const flags = (q: Player) => ['horrorbridgeleft', 'horrorbridgeright', 'horrorlighthouseentrance', 'horroragilitykey', 'horrorfire', 'horrorair', 'horrorwater', 'horrorearth', 'horrorsword', 'horrorarrow', 'horrortar', 'horrorglass', 'horrorlight'].map(n => vb(q, n)).join('');
    const olds = (q: Player) => ['horror', 'horror_bridges', 'horror_lighting', 'horror_wall'].map(n => H.getVar(q, n));
    const e2 = errors.length;

    const f = login('mig_fresh', { horror: 0 });
    check('a fresh player: nothing set but the done bit', [H.getVar(f, 'deephorror'), H.getVar(f, 'godbook_multi'), vb(f, 'port349_horror')], [0, 0, 1]);

    const c = login('mig_done', { horror: 6, bridges: 4, lighting: 7, wall: 63, bank: ['unfinished_zamorakbook'] });
    check('old 6 (complete) -> 10, every flag, the Zamorak book they own is theirs', [stage(c), flags(c), vb(c, 'horror_claimed_unholybook'), vb(c, 'horror_claimed_holybook'), olds(c)], [10, '1111111111111', 1, 0, [0, 0, 0, 0]]);
    check('  and it counts 2 quest points', H.getVar(c, 'qp') >= 2, true);
    const c2 = login('mig_done_nobook', { horror: 6, bridges: 7, lighting: 7, wall: 63 });
    check('old 6 with no book: complete, no book claimed (Jossik\'s casket dialogue gives one)', [stage(c2), H.getVar(c2, 'godbook_multi')], [10, 0]);
    c2.teleport(2509, 3638, 1);
    H.tick(1);
    talk(c2, 'horror_lighthousekeeeper_well', [3, 3]);
    check('  and it does, once', [H.invCount(c2, 'unfinished_guthixbook'), vb(c2, 'horror_claimed_guthixbook')], [1, 1]);
    talk(c2, 'horror_lighthousekeeeper_well', [2]);
    check('  asking again gives nothing more', H.invCount(c2, 'unfinished_guthixbook'), 1);

    const k5 = login('mig_casket', { horror: 5, bridges: 7, lighting: 7, wall: 63, give: ['horror_casket'], bank: ['horror_casket'] });
    check('old 5 (casket shown) -> 5, the old casket taken back', [stage(k5), H.invCount(k5, 'horror_casket'), bankCount(k5, 'horror_casket'), olds(k5)], [5, 0, 0, [0, 0, 0, 0]]);
    const k4 = login('mig_mother', { horror: 4, bridges: 7, lighting: 7, wall: 63, give: ['horror_casket'] });
    check('old 4 (Mother dead) -> 5, casket taken back', [stage(k4), H.invCount(k4, 'horror_casket')], [5, 0]);
    const k3 = login('mig_dag', { horror: 3, bridges: 3, lighting: 5, wall: 63 });
    check('old 3 (Dagannoth dead) -> 5', [stage(k3), flags(k3)], [5, '1100111111110']);
    const k2 = login('mig_wall', { horror: 2, bridges: 7, lighting: 7, wall: 63 });
    check('old 2, in, lamp lit, wall open -> 4', [stage(k2), flags(k2)], [4, '1111111111111']);
    const k2b = login('mig_wall_nobridge', { horror: 2, bridges: 4, lighting: 7, wall: 63 });
    check('old 2 with the door open but the bridge not done -> 1, lamp to relight', [stage(k2b), flags(k2b)], [1, '0011111111110']);
    const k1 = login('mig_start', { horror: 1, bridges: 1, lighting: 2, give: ['horror_key'] });
    check('old 1, one span, key in hand, tinderbox before tar -> 1, not lit', [stage(k1), flags(k1)], [1, '1001000000000']);
    const k1b = login('mig_start_in', { horror: 1, bridges: 7, lighting: 1 });
    check('old 1, door open and both spans -> 2 (entered)', [stage(k1b), flags(k1b)], [2, '1111000000100']);

    console.log('Relighting a migrated lamp moves the stage on:');
    k2b.teleport(2443, 4598, 2);
    H.tick(1);
    H.give(k2b, 'tinderbox');
    useOnLoc(k2b, 'tinderbox', 2443, 4599, 'horror_lighthouse_cog_broken');
    check('  tinderbox on the tarred, glazed lamp -> repaired (4)', [stage(k2b), vb(k2b, 'horrorlight')], [4, 1]);

    console.log('A second login changes nothing:');
    const before = [H.getVar(k3, 'deephorror'), H.getVar(k3, 'godbook_multi')];
    H.setVar(k3, 'horror', 2);
    H.runProc(k3, '[proc,port349_migrate_horror]');
    check('  the done bit stops it (even with an old value put back)', [H.getVar(k3, 'deephorror'), H.getVar(k3, 'godbook_multi')], before);
    H.runProc(k3, '[proc,port349_login]');
    check('  and ~port349_login as a whole', [H.getVar(k3, 'deephorror'), H.getVar(k3, 'godbook_multi')], before);

    console.log('A migrated player standing in the real lighthouse mid-quest can still leave:');
    const inside = login('mig_inside', { horror: 1, bridges: 4 });
    inside.teleport(2509, 3637, 0);
    H.tick(1);
    op(inside, 2509, 3636, 'horror_lighthouse_doorway');
    check('  out of the door', inside.z, 3635);
    inside.teleport(2509, 3638, 1);
    H.tick(1);
    talk(inside, 'horror_lighthousekeeeper_well');
    check('  and Jossik upstairs hands out nothing early', [H.invCount(inside, 'unfinished_saradominbook') + H.invCount(inside, 'unfinished_zamorakbook') + H.invCount(inside, 'unfinished_guthixbook'), H.getVar(inside, 'godbook_multi')], [0, 0]);
    check('no script errors in the migration', errors.slice(e2), []);
}

check('no script errors anywhere', errors, []);
console.log(`\n${R.ok} ok, ${R.bad} FAIL`);
process.exit(R.bad ? 1 : 0);
