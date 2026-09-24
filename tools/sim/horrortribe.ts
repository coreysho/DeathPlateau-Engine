// Horror from the Deep and The Lost Tribe, driven through the real content on the real map.
// Usage: npx tsx tools/sim/horrortribe.ts
//
// Horror from the Deep: the broken bridge the OSRS way (a plank on your own side, leap the gap, a
// plank on the far side, then a safe crossing), the lighthouse's front door and Gunnjorn's key, the
// basement ladders in their OSRS order (lighthouse -> basement -> strange wall -> Jossik's cave and
// back up again), the bosses turning up in Jossik's cave, and the casket back to Jossik upstairs.
//
// The Lost Tribe: the whole quest in its OSRS order, every step clicked - Sigmund, the Lumbridge
// witnesses, the Duke, the rubble, the brooch, Reldo and the library, the goblin generals, the bow
// to Mistag, the Duke's refusal, Sigmund's pocket and chest, the H.A.M. hideout, the treaty.
import * as H from './harness.js';
import World from '#/engine/World.js';
import LocType from '#/cache/config/LocType.js';
import ObjType from '#/cache/config/ObjType.js';
import InvType from '#/cache/config/InvType.js';
import Component from '#/cache/config/Component.js';
import ScriptState from '#/engine/script/ScriptState.js';
import ScriptProvider from '#/engine/script/ScriptProvider.js';
import ServerTriggerType from '#/engine/script/ServerTriggerType.js';
import { Interaction } from '#/engine/entity/Interaction.js';
import { PlayerQueueType } from '#/engine/entity/PlayerQueueRequest.js';
import { findPath, findPathToLoc, canTravel } from '#/engine/GameMap.js';
import { CollisionType } from '#/engine/routefinder/index.js';
import Player from '#/engine/entity/Player.js';

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
const mesSince = (p: Player, from: number) => H.mesgs.slice(from).filter(m => m.who === p.username).map(m => m.text);

/** Let a script run out, clicking through any chat pages and taking `picks` at menus (1-based). */
function drive(p: Player, picks: number[] = [], guardTicks = 3): string[] {
    const from = H.ifaces.length;
    let idle = 0;
    for (let guard = 0; guard < 400 && idle < guardTicks; guard++) {
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

/** Talk to the nearest npc of a type (any floor), standing next to it first. */
function talk(p: Player, npcName: string, picks: number[] = [], op = 1): string[] {
    const npc = [p.level, 0, 1, 2, 3].map(l => H.npcNear(npcName, p.x, p.z, l)).find(n => n);
    if (!npc) throw new Error('no npc ' + npcName);
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [2, 0], [0, 2]]) {
        p.teleport(npc.x + dx, npc.z + dz, npc.level);
        H.tick(1);
        H.opNpc(p, npc, op);
        for (let t = 0; t < 10 && !p.activeScript; t++) H.tick(1);
        if (p.activeScript) break;
    }
    return drive(p, picks);
}

/** "Use" an inventory item on a loc: OpLocUHandler, with the route a client would send. */
function useOn(p: Player, x: number, z: number, locName: string, objName: string) {
    const id = LocType.getId(locName);
    const loc = World.getLoc(x, z, p.level, id);
    if (!loc) throw new Error(`no ${locName} at ${x},${z},${p.level}`);
    const obj = ObjType.getId(objName);
    const inv = p.getInventory(InvType.INV)!;
    let slot = -1;
    for (let i = 0; i < inv.capacity; i++) if (inv.get(i)?.id === obj) { slot = i; break; }
    if (slot === -1) throw new Error('not carrying ' + objName);
    p.clearPendingAction();
    p.queueWaypoints(findPathToLoc(p.level, p.x, p.z, loc.x, loc.z, p.width, loc.width, loc.length, loc.angle, loc.shape, LocType.get(id).forceapproach));
    p.lastUseItem = obj;
    p.lastUseSlot = slot;
    p.setInteraction(Interaction.ENGINE, loc, ServerTriggerType.APLOCU);
    (p as unknown as { opcalled: boolean }).opcalled = true;
    drive(p);
}
function op(p: Player, x: number, z: number, locName: string, n = 1, picks: number[] = []) {
    H.opLoc(p, x, z, locName, n);
    return drive(p, picks);
}
/** Is (tx,tz) reachable on foot from (x,z)? A flood over the real collision map. */
function connected(level: number, x: number, z: number, tx: number, tz: number, radius = 160): boolean {
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
function enqueue(p: Player, name: string, args: number[] = []) {
    const s = ScriptProvider.getByName(name);
    if (!s) throw new Error('no script ' + name);
    p.enqueueScript(s, PlayerQueueType.NORMAL, 0, args);
}

// =============================================================================== Horror from the Deep
console.log('HORROR FROM THE DEEP');
{
    console.log('The broken bridge, from the lighthouse side:');
    const a = player('hftdbridge', 2575, 3611);
    H.setVar(a, 'horror', 1);
    H.give(a, 'woodplank', 2);
    H.give(a, 'nails', 60);
    H.give(a, 'hammer');
    op(a, 2596, 3608, 'horror_broken_bridge_left_spot', 1);
    check('Cross before any plank: refused, still on the west side', [a.x <= 2596, lastMes(a).includes('too rotten')], [true, true]);
    useOn(a, 2596, 3608, 'horror_broken_bridge_left_spot', 'woodplank');
    check('plank on the west span: bit 0, 1 plank and 30 nails used', [H.getVar(a, 'horror_bridges'), H.invCount(a, 'woodplank'), H.invCount(a, 'nails')], [1, 1, 30]);
    useOn(a, 2596, 3608, 'horror_broken_bridge_left_spot', 'woodplank');
    check('a second plank on the same span is refused', [H.getVar(a, 'horror_bridges'), H.invCount(a, 'woodplank')], [1, 1]);
    op(a, 2596, 3608, 'horror_broken_bridge_left_spot', 1);
    check('Cross leaps the gap to the east span', at(a), [2598, 3608, 0]);
    useOn(a, 2598, 3608, 'horror_broken_bridge_right_spot', 'woodplank');
    check('plank on the east span: both bits, all planks and nails used', [H.getVar(a, 'horror_bridges'), H.invCount(a, 'woodplank'), H.invCount(a, 'nails')], [3, 0, 0]);
    const hp = a.levels[3];
    op(a, 2598, 3608, 'horror_broken_bridge_right_spot', 1);
    check('repaired: crosses back west without a scratch', [at(a), a.levels[3] === hp, lastMes(a)], [[2596, 3608, 0], true, 'You cross the repaired bridge.']);
    check('east shore walks on to Rellekka side', connected(0, 2599, 3608, 2640, 3648), true);

    console.log('From the Rellekka side, no hammer:');
    const b = player('hftdeast', 2620, 3625);
    H.setVar(b, 'horror', 1);
    H.give(b, 'woodplank', 2);
    H.give(b, 'nails', 60);
    useOn(b, 2598, 3608, 'horror_broken_bridge_right_spot', 'woodplank');
    check('no hammer: told so, nothing used', [lastMes(b), H.invCount(b, 'woodplank')], ['You need a hammer to nail the plank in place.', 2]);
    H.give(b, 'hammer');
    useOn(b, 2598, 3608, 'horror_broken_bridge_right_spot', 'woodplank');
    check('east span fixed from the east side (bit 1)', H.getVar(b, 'horror_bridges'), 2);
    op(b, 2598, 3608, 'horror_broken_bridge_right_spot', 1);
    check('leaps west', at(b), [2596, 3608, 0]);
    useOn(b, 2596, 3608, 'horror_broken_bridge_left_spot', 'woodplank');
    check('west span fixed too', H.getVar(b, 'horror_bridges'), 3);

    console.log('The lighthouse front door:');
    const c = player('hftddoor', 2509, 3634);
    op(c, 2509, 3636, 'horror_lighthouse_doorway', 1);
    check('quest not started: locked, still outside', [c.z < 3636, lastMes(c)], [true, 'The door is locked.']);
    H.setVar(c, 'horror', 1);
    op(c, 2509, 3636, 'horror_lighthouse_doorway', 1);
    check('started, no key: locked, points at Gunnjorn', [c.z < 3636, lastMes(c).includes('Gunnjorn')], [true, true]);
    talk(c, 'gunnjorn');
    check('Gunnjorn hands over the key', H.invCount(c, 'horror_key'), 1);
    c.teleport(2509, 3634, 0);
    H.tick(1);
    op(c, 2509, 3636, 'horror_lighthouse_doorway', 1);
    check('with the key: unlocked and inside', [c.z >= 3636, (H.getVar(c, 'horror_bridges') >> 2) & 1], [true, 1]);
    op(c, 2509, 3636, 'horror_lighthouse_doorway', 1);
    check('walk back out', c.z < 3636, true);
    H.clearInv(c);
    op(c, 2509, 3636, 'horror_lighthouse_doorway', 1);
    check('unlocked for good: in again without the key', c.z >= 3636, true);

    console.log('Down to the basement, the strange wall, Jossik:');
    c.teleport(2509, 3643, 0);
    H.tick(1);
    op(c, 2509, 3644, 'horror_ladder_top', 1);
    check('lighthouse ladder lands in the basement, south of the wall', [c.level, c.z < 4627, c.z > 4600], [1, true, true]);
    check('basement ladder foot is reachable from the arrival tile', connected(1, c.x, c.z, 2519, 4619), true);
    check('the wall is reachable from the arrival tile', connected(1, c.x, c.z, 2516, 4626), true);
    for (const item of ['firerune', 'airrune', 'waterrune', 'earthrune', 'bronze_sword', 'bronze_arrow']) H.give(c, item);
    c.teleport(2514, 4626, 1);
    H.tick(1);
    for (const item of ['firerune', 'airrune', 'waterrune', 'earthrune', 'bronze_sword', 'bronze_arrow']) useOn(c, 2514, 4627, 'horror_mid_left_door', item);
    check('all six placed: wall solved, stage 2', [H.getVar(c, 'horror_wall'), H.getVar(c, 'horror')], [63, 2]);
    check('the hinged panels are gone - the way north is open', connected(1, 2514, 4626, 2515, 4629), true);
    c.teleport(2515, 4629, 1);
    H.tick(1);
    op(c, 2515, 4630, 'horror_ladder_top2', 1);
    check('ladder down lands in Jossik\'s cave', [c.level, c.z > 4630 && c.z < 4640], [0, true]);
    const jr = H.npcNear('horror_dagannoth_jr4', c.x, c.z, 0);
    check('the level-100 dagannoth is waiting in the cave', jr !== null && Math.abs(jr.z - c.z) < 12, true);
    const words = talk(c, 'horror_lighthousekeeeper_injured');
    check('Jossik talks, and no second dagannoth is added', [words.length > 0, World.npcs.filter(n => n && n.isActive && n.type === jr?.type).length], [true, 1]);
    enqueue(c, '[queue,horror_boss_slain]', [1]);
    H.tick(3);
    check('dagannoth dead: stage 3, the Mother surfaces in the same cave', [H.getVar(c, 'horror'), H.npcNear('horror_dagganoth_aira', c.x, c.z, 0) !== null || H.npcNear('horror_dagganoth_airb', c.x, c.z, 0) !== null || H.npcNear('horror_dagganoth_airc', c.x, c.z, 0) !== null || H.npcNear('horror_dagganoth_air', c.x, c.z, 0) !== null], [3, true]);
    enqueue(c, '[queue,horror_boss_slain]', [2]);
    H.tick(3);
    check('Mother dead: stage 4 and the casket', [H.getVar(c, 'horror'), H.invCount(c, 'horror_casket')], [4, 1]);
    talk(c, 'horror_lighthousekeeeper_injured');
    check('casket shown to Jossik: stage 5', H.getVar(c, 'horror'), 5);

    console.log('And back up to the lighthouse on foot:');
    op(c, 2515, 4631, 'horror_ladder_base2', 1);
    check('up to the room north of the wall', [c.level, c.z >= 4627], [1, true]);
    H.tick(110); // the panels have swung shut again behind us
    check('the wall has closed again', connected(1, c.x, c.z, 2516, 4626), false);
    op(c, 2516, 4627, 'horror_far_right_door', 1);
    check('the wall opens from the north side', connected(1, c.x, c.z, 2516, 4626), true);
    c.teleport(2519, 4619, 1);
    H.tick(1);
    op(c, 2519, 4618, 'horror_ladder_base', 1);
    check('basement ladder climbs back up into the lighthouse', [c.level, c.z > 3636 && c.z < 3650], [0, true]);
    check('the lighthouse ground floor reaches the spiral stairs', connected(0, c.x, c.z, 2506, 3639), true);
    talk(c, 'horror_lighthousekeeeper_well', [4]);
    H.tick(3);
    check('Jossik upstairs: quest complete', H.getVar(c, 'horror'), 6);

    console.log('Walled in on the north side without having solved the wall (the Waterbirth maze exit):');
    H.tick(110); // let the panels opened above swing shut
    const d = player('hftdmaze', 2515, 4629, 1);
    H.setVar(d, 'horror', 1);
    op(d, 2516, 4627, 'horror_far_right_door', 1);
    check('the hinged panel opens from the north side', connected(1, 2515, 4629, 2516, 4626), true);
    H.tick(110);
    const e2 = player('hftdsouth', 2516, 4625, 1);
    H.setVar(e2, 'horror', 1);
    op(e2, 2516, 4627, 'horror_far_right_door', 1);
    check('but not from the south, unsolved', [connected(1, 2516, 4625, 2515, 4629), lastMes(e2).includes('budge')], [false, true]);

    console.log('Post-quest:');
    c.teleport(2515, 4629, 1);
    H.tick(1);
    op(c, 2515, 4630, 'horror_ladder_top2', 1);
    check('the ladder down now leads to the dagannoth caves', [c.level, c.z > 9990], [0, true]);
    op(c, 2515, 10007, 'horror_ladder_base2', 1);
    check('and back up', [c.level, c.z >= 4627 && c.z < 4640], [1, true]);
}

// =============================================================================== The Lost Tribe
console.log('THE LOST TRIBE');
{

    const obj = (name: string) => ObjType.getId(name);
    const takeObj = (p: Player, x: number, z: number, name: string) => {
        const o = World.getObj(x, z, p.level, obj(name), p.hash64);
        if (!o) return false;
        p.clearPendingAction();
        p.queueWaypoints(findPath(p.level, p.x, p.z, o.x, o.z));
        p.setInteraction(Interaction.ENGINE, o, ServerTriggerType.APOBJ3);
        (p as unknown as { opcalled: boolean }).opcalled = true;
        drive(p);
        return true;
    };
    const stage = (p: Player) => H.getVarBit(p, 'lost_tribe_quest');

    console.log('Sigmund, without the quest requirements:');
    const n = player('ltnoreqs', 3209, 3220, 1);
    talk(n, 'lost_tribe_sigmund', [1]);
    check('no Goblin Diplomacy / Rune Mysteries: not started', stage(n), 0);

    console.log('The whole quest:');
    const p = player('ltfull', 3209, 3220, 1);
    H.setVar(p, 'goblinquest', 6);
    H.setVar(p, 'runemysteries', 6);
    talk(p, 'lost_tribe_sigmund', [1, 1]);
    check('Sigmund starts the quest', stage(p), 1);
    H.setVarBit(p, 'lost_tribe_contact', 2); // pin the witness to Father Aereck for the test
    talk(p, 'duke_of_lumbridge', [2]);
    check('the Duke does not know what happened', stage(p), 1);
    talk(p, 'cook', [1]);
    check('the cook saw nothing', stage(p), 1);
    talk(p, 'father_aereck', [1]);
    check('Father Aereck saw the goblin: stage 2', stage(p), 2);
    talk(p, 'duke_of_lumbridge', [2]);
    check('told the Duke: stage 3', stage(p), 3);

    console.log('The cellar:');
    check('the rubble can be walked to from the cellar ladder', connected(0, 3210, 9616, 3218, 9618), true);
    p.teleport(3217, 9618, 0);
    H.tick(1);
    op(p, 3219, 9618, 'lost_tribe_cellar_wall', 1);
    check('no way through before digging', [at(p), lastMes(p)], [[3219, 9618, 0], "There's no way through here."]);
    H.give(p, 'bronze_pickaxe');
    useOn(p, 3219, 9618, 'lost_tribe_cellar_wall', 'bronze_pickaxe');
    check('pickaxe on the rubble: stage 4, the hole is open', stage(p), 4);
    op(p, 3219, 9618, 'lost_tribe_cellar_wall', 1);
    check('squeeze through to the cave side', at(p), [3221, 9618, 0]);
    check('the brooch lies ten steps in, and can be walked to', [World.getObj(3228, 9614, 0, obj('lost_tribe_brooch'), p.hash64) !== null, connected(0, 3221, 9618, 3228, 9614)], [true, true]);
    op(p, 3221, 9618, 'lost_tribe_cellar_wall_back', 1);
    op(p, 3219, 9618, 'lost_tribe_cellar_wall', 1);
    check('a second visit does not add a second brooch', World.getObj(3228, 9614, 0, obj('lost_tribe_brooch'), p.hash64)?.count ?? 0, 1);
    takeObj(p, 3228, 9614, 'lost_tribe_brooch');
    check('picked up the brooch', H.invCount(p, 'lost_tribe_brooch'), 1);
    check('the tunnel from the cellar hole reaches Mistag on foot', connected(0, 3221, 9618, 3318, 9615, 200), true);
    talk(p, 'duke_of_lumbridge', [2]);
    check('brooch shown to the Duke: stage 5', stage(p), 5);

    console.log('Varrock library:');
    talk(p, 'reldo');
    p.teleport(3208, 3496, 0);
    H.tick(1);
    op(p, 3207, 3496, 'lost_tribe_bookcase', 1);
    check('the bookcase gives the goblin book', H.invCount(p, 'lost_tribe_book'), 1);
    H.opheld(p, 'lost_tribe_book', 1);
    drive(p);
    check('reading it names the Dorgeshuun: stage 6', stage(p), 6);

    console.log('The goblin generals:');
    talk(p, 'general_bentnoze');
    check('the generals teach the goblin greeting: stage 7', stage(p), 7);

    console.log('Mistag:');
    p.teleport(3318, 9615, 0);
    H.tick(1);
    talk(p, 'lost_tribe_mistag');
    check('Mistag will not talk before the bow', stage(p), 7);
    p.teleport(3317, 9615, 0);
    H.tick(1);
    H.ifButton(p, 'emotes:goblin_bow');
    drive(p);
    check('the goblin bow in front of Mistag: stage 8', stage(p), 8);
    talk(p, 'lost_tribe_mistag', [1]);
    check('Mistag talks, takes the brooch back for a mining helmet, and has me walked out: stage 9', [stage(p), H.invCount(p, 'lost_tribe_brooch'), H.invCount(p, 'cave_goblin_mining_helmet_unlit'), p.x < 3240], [9, 0, 1, true]);
    check('Kazgar is on duty at the Lumbridge end', H.npcNear('lost_tribe_guide', 3231, 9610, 0) !== null, true);

    console.log('Sigmund, the Duke and the H.A.M. hideout:');
    talk(p, 'duke_of_lumbridge', [2]);
    check('the Duke will not listen without proof', [stage(p), H.getVarBit(p, 'lost_tribe_sigmund_accused')], [9, 1]);
    for (let i = 0; i < 20 && H.invCount(p, 'lost_tribe_chest_key') === 0; i++) talk(p, 'lost_tribe_sigmund', [], 3);
    check('pickpocketing Sigmund gets his key', H.invCount(p, 'lost_tribe_chest_key'), 1);
    // the chest opens from the south, inside the little room behind Sigmund (door on its west side)
    p.teleport(3209, 3216, 1);
    H.tick(1);
    check('the chest is locked without the key', (() => { const q = player('ltchest', 3209, 3216, 1); op(q, 3209, 3217, 'lost_tribe_chest', 1); return lastMes(q); })(), 'The chest is locked.');
    op(p, 3209, 3217, 'lost_tribe_chest', 1);
    check('his chest holds H.A.M. robes', [H.invCount(p, 'ham_shirt'), H.getVarBit(p, 'lost_tribe_ham')], [1, 1]);
    p.teleport(3166, 3251, 0);
    H.tick(1);
    op(p, 3166, 3252, 'ham_multi_trapdoor', 1);
    check('the hideout trapdoor is locked', H.getVarBit(p, 'ham_thief'), 0);
    for (let i = 0; i < 20 && H.getVarBit(p, 'ham_thief') === 0; i++) op(p, 3166, 3252, 'ham_multi_trapdoor', 5);
    check('picked the lock', H.getVarBit(p, 'ham_thief'), 1);
    op(p, 3166, 3252, 'ham_multi_trapdoor', 1);
    check('climbed down into the hideout', [at(p), connected(0, p.x, p.z, 3152, 9646)], [[3149, 9652, 0], true]);
    p.teleport(3152, 9646, 0);
    H.tick(1);
    op(p, 3152, 9645, 'lost_tribe_crate', 1);
    check('the crate holds the silverware', H.invCount(p, 'lost_tribe_silverware'), 1);
    p.teleport(3149, 9652, 0);
    H.tick(1);
    op(p, 3149, 9653, 'osf_ham_ladder', 1);
    check('the ladder climbs back out beside the trapdoor', at(p), [3166, 3251, 0]);
    talk(p, 'duke_of_lumbridge', [2]);
    check('silverware to the Duke: the treaty, stage 10', [stage(p), H.invCount(p, 'lost_tribe_treaty'), H.invCount(p, 'lost_tribe_silverware')], [10, 1, 0]);

    console.log('The treaty to Mistag:');
    talk(p, 'lost_tribe_guide', [1]);
    check('Kazgar walks me to Mistag', p.x > 3300, true);
    const xp = p.stats[14];
    talk(p, 'lost_tribe_mistag');
    H.tick(3);
    drive(p);
    check('quest complete: stage 11, ring of life, 3,000 Mining xp', [stage(p), H.invCount(p, 'ring_of_life'), p.stats[14] - xp], [11, 1, 30000]);
    check('the goblin emotes play', (() => { H.ifButton(p, 'emotes:goblin_salute'); drive(p); return lastMes(p).includes('unlocked'); })(), false);
}

console.log(`\n${R.ok} ok, ${R.bad} FAIL`);
process.exit(R.bad ? 1 : 0);
