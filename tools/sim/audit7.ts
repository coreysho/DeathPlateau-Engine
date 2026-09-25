// Quest audit, batch 7, driven through the real content on the real map - every fixed step, and
// each fixed quest from start to complete: Rum Deal (Braindeath Island's stairs, ladders, jetty and
// gate, the weed patch, the way home), Throne of Miscellania (the jetties, the throne-room doors,
// the castle and Etceteria stairs, the house doors), Garden of Tranquillity (the patch and gardener
// labels that never came back, the trolley), Haunted Mine (the key/points deadlock, the lift, the
// level-5 stairs, Treus Dayth's door, the crystal), Enakhra's Lament (the ring landings, the one-way
// doors, the pillar ladders), Tai Bwo Wannai Trio (the Shaikahan's stats and kill, the bamboo doors),
// Roving Elves and the end of Priest in Peril (with the Port Phasmatys charter gate), and spot
// checks of the Dig Site's teleports.
// Usage: npx tsx tools/sim/audit7.ts [deal|misc|garden|hauntedmine|enakh|tbwt|roving|priest|spots ...]
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
import { findPathToLoc, canTravel, isFlagged } from '#/engine/GameMap.js';
import { CollisionType, CollisionFlag } from '#/engine/routefinder/index.js';
import Player from '#/engine/entity/Player.js';
import Npc from '#/engine/entity/Npc.js';
import NpcType from '#/cache/config/NpcType.js';

await H.boot();
H.loginOrder();

const only = process.argv.slice(2);
const want = (s: string) => only.length === 0 || only.includes(s);

const R = { ok: 0, bad: 0 };
const check = (what: string, got: unknown, wantv: unknown) => {
    const pass = JSON.stringify(got) === JSON.stringify(wantv);
    if (pass) R.ok++;
    else R.bad++;
    console.log(`  ${pass ? 'ok  ' : 'FAIL'} ${what}: ${JSON.stringify(got)}${pass ? '' : `   (want ${JSON.stringify(wantv)})`}`);
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
const v = (p: Player, name: string) => H.getVar(p, name);
const vb = (p: Player, name: string) => H.getVarBit(p, name);

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

function npcAny(name: string, x: number, z: number, level: number): Npc | null {
    return [level, 0, 1, 2, 3].map(l => H.npcNear(name, x, z, l)).find(n => n) ?? null;
}

/** Talk to the nearest npc of a type (any floor), standing next to it first. */
function talk(p: Player, npcName: string, picks: number[] = [], op = 1): string[] {
    const npc = npcAny(npcName, p.x, p.z, p.level);
    if (!npc) throw new Error('no npc ' + npcName);
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [2, 0], [0, 2], [-2, 0], [0, -2]]) {
        p.teleport(npc.x + dx, npc.z + dz, npc.level);
        H.tick(1);
        H.opNpc(p, npc, op);
        for (let t = 0; t < 10 && !p.activeScript; t++) H.tick(1);
        if (p.activeScript) break;
    }
    return drive(p, picks);
}
/** Op an npc from where the player stands: they must be able to walk to it. */
function opNpcHere(p: Player, npcName: string, op = 1, picks: number[] = []): boolean {
    const npc = npcAny(npcName, p.x, p.z, p.level);
    if (!npc) throw new Error('no npc ' + npcName);
    settle(p);
    H.opNpc(p, npc, op);
    let started = false;
    for (let t = 0; t < 40 && !started; t++) { H.tick(1); if (p.activeScript) started = true; }
    drive(p, picks);
    return started;
}

function slotOf(p: Player, objName: string) {
    const obj = ObjType.getId(objName);
    const inv = p.getInventory(InvType.INV)!;
    for (let i = 0; i < inv.capacity; i++) if (inv.get(i)?.id === obj) return i;
    throw new Error('not carrying ' + objName);
}
/** "Use" an inventory item on a loc: OpLocUHandler, with the route a client would send. */
function useOn(p: Player, x: number, z: number, locName: string, objName: string, picks: number[] = []) {
    const id = LocType.getId(locName);
    const loc = World.getLoc(x, z, p.level, id);
    if (!loc) throw new Error(`no ${locName} at ${x},${z},${p.level}`);
    const obj = ObjType.getId(objName);
    const slot = slotOf(p, objName);
    settle(p);
    p.clearPendingAction();
    p.queueWaypoints(findPathToLoc(p.level, p.x, p.z, loc.x, loc.z, p.width, loc.width, loc.length, loc.angle, loc.shape, LocType.get(id).forceapproach));
    p.lastUseItem = obj;
    p.lastUseSlot = slot;
    p.setInteraction(Interaction.ENGINE, loc, ServerTriggerType.APLOCU);
    (p as unknown as { opcalled: boolean }).opcalled = true;
    drive(p, picks);
}
/** Use an item on another item: OpHeldUHandler's lookup (the target's trigger, else the used item's). */
function useOnHeld(p: Player, useName: string, onName: string, picks: number[] = []) {
    const use = ObjType.get(ObjType.getId(useName));
    const on = ObjType.get(ObjType.getId(onName));
    p.lastItem = on.id;
    p.lastSlot = slotOf(p, onName);
    p.lastUseItem = use.id;
    p.lastUseSlot = slotOf(p, useName);
    let script = ScriptProvider.getByTrigger(ServerTriggerType.OPHELDU, on.id, on.category);
    if (!script) {
        script = ScriptProvider.getByTrigger(ServerTriggerType.OPHELDU, use.id, use.category);
        [p.lastItem, p.lastUseItem] = [p.lastUseItem, p.lastItem];
        [p.lastSlot, p.lastUseSlot] = [p.lastUseSlot, p.lastSlot];
    }
    if (!script) throw new Error(`no opheldu for ${useName} on ${onName}`);
    p.executeScript(ScriptRunner.init(script, p), true);
    drive(p, picks);
}
import ScriptRunner from '#/engine/script/ScriptRunner.js';

/** A click made while delayed is thrown away, as the real handlers do - so wait the delay out first. */
function settle(p: Player) {
    for (let t = 0; t < 20 && (p.delayed || p.activeScript); t++) H.tick(1);
}
function op(p: Player, x: number, z: number, locName: string, n = 1, picks: number[] = []) {
    settle(p);
    H.opLoc(p, x, z, locName, n);
    return drive(p, picks);
}

/** Every tile reachable on foot from (x,z), over the real collision map. */
function reachSet(level: number, x: number, z: number, radius = 160) {
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
    return seen;
}
/** Can the player standing at (x,z) walk up to (tx,tz) - onto it, or beside it if it is a loc/npc? */
function reaches(level: number, x: number, z: number, tx: number, tz: number, radius = 160): boolean {
    const s = reachSet(level, x, z, radius);
    for (const [dx, dz] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) if (s.has(tx + dx + ',' + (tz + dz))) return true;
    return false;
}
const walkable = (level: number, x: number, z: number) => !isFlagged(x, z, level, CollisionFlag.WALK_BLOCKED);

/** Remove every closed door/gate (wall-shaped loc with op1 Open) in a box, so a flood can pass them. */
function openDoors(level: number, x0: number, z0: number, x1: number, z1: number, except: string[] = []) {
    for (let x = x0; x <= x1 + 8; x += 8) for (let z = z0; z <= z1 + 8; z += 8) {
        const zone = World.gameMap.getZone(x, z, level);
        for (const loc of [...zone.getAllLocsUnsafe()]) {
            if (loc.x < x0 || loc.x > x1 || loc.z < z0 || loc.z > z1) continue;
            const t = LocType.get(loc.type);
            if (except.includes(t.debugname!)) continue;
            const op1 = (t.op ?? [])[0];
            if ((loc.shape <= 3 || loc.shape === 9) && op1 && /^open$/i.test(op1)) World.removeLoc(loc, 1000000);
        }
    }
}
function locAt(name: string, level: number, x: number, z: number) {
    return World.getLoc(x, z, level, LocType.getId(name));
}
function enqueue(p: Player, name: string, args: number[] = []) {
    const s = ScriptProvider.getByName(name);
    if (!s) throw new Error('no script ' + name);
    p.enqueueScript(s, PlayerQueueType.NORMAL, 0, args);
}
void enqueue; void NpcType;

// ======================================================================================= Rum Deal
if (want('deal')) {
    console.log('RUM DEAL');
    const p = player('rumdeal', 3681, 3537);
    talk(p, 'deal_pete');
    check('Pete rows you out: stage 1, on the jetty on the brewery floor', [v(p, 'deal_quest'), p.level, walkable(p.level, p.x, p.z)], [1, 1, true]);
    check('the jetty walks to Captain Braindeath', reaches(1, p.x, p.z, 2144, 5106), true);
    talk(p, 'deal_captian_braindeath', [1]);

    console.log('Down the outside stairs to the crew:');
    p.teleport(2137, 5090, 1);
    H.tick(1);
    op(p, 2137, 5088, 'deal_stairs_top');
    check('south stairs down land outside, on the ground', [p.level, walkable(0, p.x, p.z), reaches(0, p.x, p.z, 2154, 5076)], [0, true, true]);
    for (const s of ['a', 'b', 'c', 'd', 'e', 'f']) {
        const sw = npcAny('deal_pirate_' + s, p.x, p.z, 0)!;
        check(`swab ${s} can be walked to`, reaches(0, p.x, p.z, sw.x, sw.z), true);
        talk(p, 'deal_pirate_' + s, [], 3);
    }
    check('all six intimidated: stage 2', v(p, 'deal_quest'), 2);
    for (const [bx, tx] of [[2137, 2137], [2149, 2149], [2163, 2163]]) {
        p.teleport(bx, 5086, 0);
        H.tick(1);
        op(p, bx, 5088, 'deal_stairs_bottom');
        check(`stairs at ${bx} climb into the brewery`, [p.level, walkable(1, p.x, p.z), reaches(1, p.x, p.z, 2144, 5106)], [1, true, true]);
        op(p, tx, 5088, 'deal_stairs_top');
        check(`and back down`, [p.level, reaches(0, p.x, p.z, 2154, 5076)], [0, true]);
    }

    console.log('The cellar: wrench and seed:');
    p.teleport(2140, 5106, 1);
    H.tick(1);
    op(p, 2139, 5105, 'deal_laddertop');
    check('the north-west ladder goes down to the cellar', [p.level, walkable(0, p.x, p.z), reaches(0, p.x, p.z, 2157, 5094)], [0, true, true]);
    op(p, 2157, 5093, 'deal_broomcupboard');
    check('broom cupboard: wrench and blindweed seed', [H.invCount(p, 'deal_wrench'), H.invCount(p, 'deal_blindweed_seed')], [1, 1]);
    op(p, 2139, 5105, 'deal_ladder_up');
    check('and back up the ladder', [p.level, reaches(1, p.x, p.z, 2144, 5106)], [1, true]);
    talk(p, 'deal_davey');
    check('Davey blesses the wrench', H.invCount(p, 'deal_wrench_blessed'), 1);
    p.teleport(2144, 5094, 1);
    H.tick(1);
    op(p, 2142, 5093, 'deal_brewvat_tap');
    check('the tap is fixed: stage 3', v(p, 'deal_quest'), 3);

    console.log('The ingredients:');
    p.teleport(2163, 5090, 1);
    H.tick(1);
    op(p, 2163, 5088, 'deal_stairs_top');
    p.teleport(2161, 5067, 0);
    H.tick(1);
    check('the blindweed patch can be walked to from the stairs', reaches(0, 2163, 5087, 2162, 5070), true);
    for (let i = 0; i < 3; i++) op(p, 2162, 5069, 'deal_blindweed', 2);
    check('three passes of weeding clear the patch (it starts at weeds3)', vb(p, 'deal_farming'), 3);
    op(p, 2162, 5069, 'deal_blindweed', 2);
    op(p, 2162, 5069, 'deal_blindweed', 2);
    op(p, 2162, 5069, 'deal_blindweed', 1);
    check('weed, plant, grow, pick: a blindweed', H.invCount(p, 'deal_blindweed'), 1);
    talk(p, 'deal_captian_donnie');
    check('Donnie hands over the sluglings', H.invCount(p, 'deal_slugling'), 1);
    H.give(p, 'net');
    const squid = H.npcNear('deal_squid', 2162, 5061, 0)!;
    p.teleport(2161, 5067, 0);
    H.tick(1);
    check('a karamthulhu spot is reachable from the ground', opNpcHere(p, 'deal_squid', 1), true);
    check('a karamthulhu', H.invCount(p, 'deal_karamthulhu'), 1);
    void squid;

    console.log('Through 50% Luke\'s gate to the stagnant lake:');
    p.teleport(2129, 5090, 0);
    H.tick(1);
    check('the west stairs foot is in Luke\'s yard', reaches(0, 2128, 5095, 2120, 5097), true);
    p.teleport(2121, 5094, 0);
    H.tick(1);
    op(p, 2120, 5098, 'deal_gate_closed');
    check('the gate lets you through to the north', [at(p), reaches(0, p.x, p.z, 2134, 5160)], [[2120, 5099, 0], true]);
    H.give(p, 'bucket_empty');
    p.teleport(2132, 5160, 0);
    H.tick(1);
    useOn(p, 2133, 5161, 'deal_stagnant', 'bucket_empty');
    check('a bucket of stagnant water', H.invCount(p, 'deal_stagnant_bucket'), 1);
    p.teleport(2120, 5100, 0);
    H.tick(1);
    op(p, 2120, 5098, 'deal_gate_closed');
    check('and back through the gate', [at(p), reaches(0, p.x, p.z, 2154, 5076)], [[2120, 5098, 0], true]);
    p.teleport(2127, 5095, 0);
    H.tick(1);
    op(p, 2129, 5094, 'deal_stairs_bottom');
    check('the west stairs climb from the yard into the brewery', [p.level, reaches(1, p.x, p.z, 2144, 5106)], [1, true]);
    op(p, 2129, 5095, 'deal_stairs_top');
    check('and back down into the yard', [p.level, reaches(0, p.x, p.z, 2120, 5097)], [0, true]);
    p.teleport(2150, 5111, 0);
    H.tick(1);
    op(p, 2151, 5109, 'deal_stairs_bottom');
    check('the north shore stairs climb into the brewery', [p.level, reaches(1, p.x, p.z, 2144, 5106)], [1, true]);
    op(p, 2152, 5109, 'deal_stairs_top');
    check('and back down', [p.level, walkable(0, p.x, p.z)], [0, true]);

    console.log('The hopper room:');
    H.give(p, 'deal_spider_body');
    p.teleport(2163, 5094, 1);
    H.tick(1);
    op(p, 2163, 5092, 'deal_ladder_up');
    check('the south-east ladder climbs to the hopper room', [p.level, reaches(2, p.x, p.z, 2141, 5104)], [2, true]);
    for (const it of ['deal_blindweed', 'deal_stagnant_bucket', 'deal_spider_body', 'deal_karamthulhu', 'deal_slugling']) useOn(p, 2142, 5102, 'deal_hopper', it);
    check('all five in the hopper: stage 4', v(p, 'deal_quest'), 4);
    for (let i = 0; i < 5; i++) op(p, 2141, 5103, 'deal_multi_lever');
    check('five pulls and the spirit: stage 5', v(p, 'deal_quest'), 5);
    op(p, 2163, 5092, 'deal_laddertop');
    check('back down to the brewery floor', p.level, 1);
    talk(p, 'deal_captian_braindeath');
    check('Braindeath: complete, with the Slayer gloves', [v(p, 'deal_quest'), H.invCount(p, 'deal_slayer_gloves')], [6, 1]);
    talk(p, 'deal_island_pete');
    check('Pete rows you home', [p.x > 3600, p.level], [true, 0]);
}

// ======================================================================================= Throne of Miscellania
if (want('misc')) {
    // The quest itself - the original one since 2026-09-25 - is tools/sim/miscellania.ts. What stays
    // here is audit 7's map work: the jetties, the house doors, the throne-room doors and the stairs.
    console.log('THRONE OF MISCELLANIA');
    const p = player('miscq', 2628, 3692);
    talk(p, 'viking_sailor');
    check('the Rellekka sailor rows you north onto the island pier, on the ground', [at(p), walkable(0, p.x, p.z)], [[2581, 3846, 0], true]);
    check('the pier walks to the castle gate', reaches(0, p.x, p.z, 2520, 3858), true);
    talk(p, 'misc_sailor', [1]);
    check('and back south, onto the Rellekka jetty', [at(p), walkable(0, p.x, p.z), reaches(0, p.x, p.z, 2640, 3690)], [[2628, 3693, 0], true, true]);
    talk(p, 'viking_sailor');

    console.log('The house doors:');
    p.teleport(2512, 3848, 0);
    H.tick(1);
    const m0 = H.mesgs.length;
    op(p, 2512, 3850, 'misc_viking_abode_door_low');
    check('a Miscellania house door opens (the generic door code)', [locAt('misc_viking_abode_door_low', 0, 2512, 3850) === null, mesSince(p, m0).some(m => m.includes('Nothing interesting'))], [true, false]);

    console.log('Into the castle:');
    openDoors(0, 2495, 3840, 2525, 3880, ['misc_viking_abode_door_low']);
    openDoors(1, 2495, 3840, 2525, 3880, ['misc_ulby_throneroomdoor']);
    check('the castle staircase can be walked to from the pier', reaches(0, 2581, 3845, 2504, 3848), true);
    p.teleport(2504, 3847, 0);
    H.tick(1);
    op(p, 2505, 3848, 'loc_1742');
    check('up to the throne room floor', [p.level, walkable(1, p.x, p.z)], [1, true]);
    check('...which reaches the throne room door, but not Ghrim or the King', [reaches(1, p.x, p.z, 2506, 3856), reaches(1, p.x, p.z, 2499, 3858)], [true, false]);
    // a Heroes' Guild member, whom the guard lets in
    H.setVar(p, 'heroquest', 15);
    p.teleport(2506, 3855, 1);
    H.tick(1);
    op(p, 2506, 3857, 'misc_ulby_throneroomdoor');
    check('the guard lets a hero through the throne door', [at(p), reaches(1, p.x, p.z, 2503, 3860)], [[2506, 3857, 1], true]);
    p.teleport(2506, 3858, 1);
    H.tick(1);
    op(p, 2506, 3857, 'misc_ulby_throneroomdoor');
    check('out through the south door', at(p), [2506, 3856, 1]);
    op(p, 2506, 3857, 'misc_ulby_throneroomdoor');
    check('and back in: the guard remembers you', at(p), [2506, 3857, 1]);
    p.teleport(2506, 3862, 1);
    H.tick(1);
    op(p, 2506, 3863, 'misc_ulby_throneroomdoor');
    check('out through the north door too', [at(p), reaches(1, p.x, p.z, 2502, 3866)], [[2506, 3864, 1], true]);

    console.log('Down the castle stairs:');
    p.teleport(2504, 3849, 1);
    H.tick(1);
    op(p, 2505, 3848, 'loc_1743', 3);
    check('Climb-down from the throne room floor lands on the ground floor', [p.level, walkable(0, p.x, p.z), reaches(0, p.x, p.z, 2540, 3860)], [0, true, true]);
    p.teleport(2504, 3849, 1);
    H.tick(1);
    op(p, 2505, 3848, 'loc_1743', 1, [2]);
    check('Climb -> down does the same', p.level, 0);
    p.teleport(2504, 3849, 1);
    H.tick(1);
    op(p, 2505, 3848, 'loc_1743', 2);
    check('Climb-up goes to the floor above', [p.level, walkable(2, p.x, p.z)], [2, true]);
    op(p, 2505, 3848, 'loc_1743', 3);
    check('and back down from it', [p.level, walkable(1, p.x, p.z)], [1, true]);
    p.teleport(2504, 3870, 1);
    H.tick(1);
    op(p, 2505, 3871, 'loc_1743', 3);
    check('the north staircase goes down too', [p.level, walkable(0, p.x, p.z), reaches(0, p.x, p.z, 2540, 3860)], [0, true, true]);

    console.log('Etceteria:');
    openDoors(0, 2590, 3855, 2630, 3890, ['misc_viking_abode_door_low']);
    openDoors(1, 2590, 3855, 2630, 3890);
    check('Etceteria castle stairs reach from the pier', reaches(0, 2581, 3845, 2612, 3866, 200), true);
    p.teleport(2612, 3866, 0);
    H.tick(1);
    op(p, 2613, 3867, 'loc_1738');
    check('the Etceteria stairs climb to Sigrid', [p.level, walkable(1, p.x, p.z), reaches(1, p.x, p.z, 2611, 3872)], [1, true, true]);
    p.teleport(2614, 3866, 1);
    H.tick(1);
    op(p, 2614, 3867, 'loc_1740');
    check('the Etceteria stairs come back down into the village', [p.level, walkable(0, p.x, p.z), reaches(0, p.x, p.z, 2581, 3845, 200)], [0, true, true]);
}

// ======================================================================================= Garden of Tranquillity
if (want('garden')) {
    console.log('GARDEN OF TRANQUILLITY');
    const p = player('gardenq', 3222, 3474);
    talk(p, 'king_roald', [1]);
    check('Roald starts it', [vb(p, 'garden_quest'), H.invCount(p, 'garden_list')], [5, 1]);
    H.give(p, 'bucket_compost', 8);
    H.give(p, 'plant_cure', 1);
    // Bernald first, so the list is finished at a gardener - the path the old label bug broke
    p.teleport(2914, 3533, 0);
    H.tick(1);
    useOn(p, 2914, 3534, 'garden_burthorpe_vines', 'plant_cure');
    talk(p, 'bernald');
    check('Bernald: vines cured, four vine seeds', [vb(p, 'garden_bernald_varbit'), H.invCount(p, 'garden_vine_seed')], [5, 4]);
    for (const g of ['elstan', 'kragen', 'lyra', 'dantaera', 'brother_althric']) {
        talk(p, g);
        const said = talk(p, g);
        void said;
    }
    check('every gardener has paid out, the list finished at a gardener: stage 10', [vb(p, 'garden_quest'), vb(p, 'garden_elstan_varbit'), vb(p, 'garden_althric_varbit')], [10, 2, 2]);
    H.give(p, 'rake');
    H.give(p, 'watering_can_8', 1);
    const seeds: Record<string, string> = { garden_delphinium_patch: 'garden_delphinium_seed', garden_rosebush_patch_white: 'garden_rosebush_seed_white', garden_rosebush_patch_red: 'garden_rosebush_seed_red', garden_rosebush_patch_pink: 'garden_rosebush_seed_pink', garden_snowdrop_patch: 'garden_snowdrop_seed', garden_vine_patch: 'garden_vine_seed', garden_white_tree_patch: 'garden_white_tree_shoot', garden_orchid_pink_patch: 'garden_orchid_pink_seed', garden_orchid_yellow_patch: 'garden_orchid_yellow_seed' };
    for (const name of Object.keys(seeds)) {
        // every tile of a patch type shares one varbit, so any instance a gardener can walk up to
        // will do: try them in turn until one of them can be reached from the garden path
        const tiles: [number, number][] = [];
        for (let x = 3200; x < 3264; x++) for (let z = 3456; z < 3520; z++) if (locAt(name, 0, x, z)) tiles.push([x, z]);
        const first = name.includes('orchid') ? 'bucket_compost' : 'rake';
        let spot: [number, number] | null = null;
        for (const [x, z] of tiles) {
            p.teleport(3228, 3477, 0);
            H.tick(1);
            const m0 = H.mesgs.length;
            useOn(p, x, z, name, first);
            if (!mesSince(p, m0).some(m => m.includes('reach'))) { spot = [x, z]; break; }
        }
        if (!spot) { check(name + ' can be reached from the garden', false, true); continue; }
        const [x, z] = spot;
        if (first === 'rake') for (let i = 0; i < 2; i++) useOn(p, x, z, name, 'rake');
        useOn(p, x, z, name, seeds[name]);
        const can = ['watering_can_8', 'watering_can_7', 'watering_can_6', 'watering_can_5', 'watering_can_4', 'watering_can_3', 'watering_can_2', 'watering_can_1'].find(c => H.invCount(p, c) > 0);
        if (!can) H.give(p, 'watering_can_8');
        useOn(p, x, z, name, can ?? 'watering_can_8');
    }
    check('every bed fully grown (the tree to 8)', ['delphiniums', 'rosebush_white', 'rosebush_red', 'rosebush_pink', 'snowdrops', 'vines', 'white_tree', 'orchids_pink', 'orchids_yellow'].map(g => vb(p, 'garden_' + g + '_varbit')), [7, 7, 7, 7, 7, 7, 8, 7, 7]);
    check('nine beds up: stage 30', vb(p, 'garden_quest'), 30);
    p.teleport(3222, 3474, 0);
    H.tick(1);
    talk(p, 'king_roald');
    check('Roald hands over the palace trolley', H.invCount(p, 'garden_trolley_obj'), 1);
    talk(p, 'king_roald');
    check('and only one', H.invCount(p, 'garden_trolley_obj'), 1);
    p.teleport(2965, 3379, 0);
    H.tick(1);
    useOn(p, 2965, 3381, 'falador_statue_saradomin', 'garden_trolley_obj');
    p.teleport(3229, 3477, 0);
    H.tick(1);
    useOn(p, 3229, 3479, 'garden_saradomin_statue_multi', 'garden_trolley_obj');
    p.teleport(3231, 3215, 0);
    H.tick(1);
    useOn(p, 3231, 3217, 'garden_lumbridge_statue', 'garden_trolley_obj');
    p.teleport(3233, 3485, 0);
    H.tick(1);
    useOn(p, 3233, 3487, 'garden_king_statue_multi', 'garden_trolley_obj');
    check('both statues placed: stage 40', vb(p, 'garden_quest'), 40);
    talk(p, 'king_roald');
    check('Roald: complete, with the pie', [vb(p, 'garden_quest'), H.invCount(p, 'garden_pie')], [50, 1]);
}

// ======================================================================================= Haunted Mine
if (want('hauntedmine')) {
    console.log('HAUNTED MINE');
    const p = player('hmine', 3444, 3256);
    talk(p, 'saradominist_zealot');
    check('the zealot refuses: stage 1', v(p, 'hauntedmine'), 1);

    console.log('Points before the key (the old deadlock):');
    const q = player('hmine2', 2780, 4518);
    H.setVar(q, 'hauntedmine', 1);
    H.setVar(q, 'hauntedmine_bits', 173);
    for (let i = 0; i < 30 && H.invCount(q, 'hauntedmine_lift_key') === 0; i++) talk(q, 'saradominist_zealot', [], 3);
    check('the zealot can still be picked with the points already set, and that sets the points stage', [H.invCount(q, 'hauntedmine_lift_key'), v(q, 'hauntedmine')], [1, 3]);

    for (let i = 0; i < 30 && H.invCount(p, 'hauntedmine_lift_key') === 0; i++) talk(p, 'saradominist_zealot', [], 3);
    check('pickpocketed the key: stage 2', [H.invCount(p, 'hauntedmine_lift_key'), v(p, 'hauntedmine')], [1, 2]);

    console.log('Into the mine, the back way, to the points:');
    /** Of the given placements of a loc, op the first one the player can walk to from here. */
    const climbAny = (what: string, name: string, spots: [number, number][]) => {
        const reach = reachSet(p.level, p.x, p.z, 200);
        const spot = spots.find(([x, z]) => [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dz]) => reach.has(x + dx + ',' + (z + dz))));
        if (!spot) { check(what + ': one can be walked to', false, true); return false; }
        const before = at(p);
        op(p, spot[0], spot[1], name);
        const moved = JSON.stringify(before) !== JSON.stringify(at(p));
        check(what + ': climbed onto a walkable tile', [moved, walkable(p.level, p.x, p.z)], [true, true]);
        return moved;
    };
    check('the back entrance (2) can be walked to from the zealot', reaches(0, 3444, 3257, 3429, 3225), true);
    p.teleport(3428, 3226, 0);
    H.tick(1);
    op(p, 3429, 3225, 'hauntedmine_back_entrance2');
    check('crawl in', p.z > 9000, true);
    climbAny('m53_150 ladder down', 'hauntedmine_laddertop', [[3413, 9633], [3422, 9625]]);
    climbAny('level 2 ladder down', 'hauntedmine_laddertop_1sw', [[2797, 4599], [2798, 4567]]);
    climbAny('level 3 ladder east', 'hauntedmine_laddertop_1e', [[2696, 4497], [2710, 4540], [2725, 4486], [2732, 4529]]);
    check('this side reaches both lever banks and the diagram', [reaches(0, p.x, p.z, 2785, 4517, 200), reaches(0, p.x, p.z, 2768, 4533, 200), reaches(0, p.x, p.z, 2769, 4522, 200)], [true, true, true]);
    op(p, 2769, 4522, 'hauntedmine_points_info');
    for (const [n, x, z] of [[1, 2785, 4517], [3, 2786, 4517], [4, 2786, 4515], [6, 2768, 4533], [8, 2770, 4533]] as [number, number, number][]) {
        // the two banks are a long walk apart - further than one click's path search - so walk over first
        if (n === 6) { p.teleport(2767, 4532, 0); H.tick(1); }
        op(p, x, z, 'hauntedmine_point_lever' + n);
    }
    check('points 1, 3, 4, 6 and 8 thrown: stage 3', [v(p, 'hauntedmine_bits') & 255, v(p, 'hauntedmine')], [173, 3]);

    console.log('Out, and in by the secondary entrance to the valve:');
    p.teleport(3437, 9636, 0);
    H.tick(1);
    op(p, 3437, 9637, 'hauntedmine_secondary_entrance_inside');
    check('crawled back out to the surface, into the cart pocket', [p.z < 4000, reaches(0, 3444, 3236, p.x, p.z)], [true, true]);
    p.teleport(3446, 3236, 0);
    H.tick(1);
    check('the cart pocket cannot be walked into', reaches(0, 3446, 3236, 3440, 3233), false);
    op(p, 3445, 3236, 'hauntedmine_obstacle_cart');
    check('climb over the cart into it', [p.x < 3445, reaches(0, p.x, p.z, 3440, 3233)], [true, true]);
    op(p, 3440, 3232, 'hauntedmine_secondary_entrance');
    climbAny('m53_150 ladder down', 'hauntedmine_laddertop', [[3413, 9633], [3422, 9625]]);
    climbAny('level 2 ladder down', 'hauntedmine_laddertop_1sw', [[2797, 4599], [2798, 4567]]);
    const r3 = reachSet(0, p.x, p.z, 200);
    const e = ([[2732, 4529], [2710, 4540], [2696, 4497]] as [number, number][]).find(([x, z]) => r3.has(x + 1 + ',' + z) || r3.has(x - 1 + ',' + z) || r3.has(x + ',' + (z + 1)) || r3.has(x + ',' + (z - 1)));
    op(p, e![0], e![1], 'hauntedmine_laddertop_1e');
    check('the valve side reaches the valve and the lift', [reaches(0, p.x, p.z, 2808, 4497), reaches(0, p.x, p.z, 2806, 4493)], [true, true]);
    op(p, 2807, 4492, 'lift_side_r');
    check('the lift will not go down before the valve', p.z > 4480, true);
    op(p, 2808, 4496, 'hauntedmine_lift_valve');
    check('valve: the lift goes down onto the level-5 track, stage 4', [v(p, 'hauntedmine'), walkable(0, p.x, p.z), p.z < 4460], [4, true, true]);
    check('level 5 reaches both staircases down', [reaches(0, p.x, p.z, 2746, 4437), reaches(0, p.x, p.z, 2692, 4437)], [true, true]);

    console.log('Treus Dayth:');
    p.teleport(2745, 4436, 0);
    H.tick(1);
    op(p, 2746, 4436, 'hauntedmine_dark_stairs_top');
    check('east stairs down to the boss level, beside the door', [walkable(0, p.x, p.z), reaches(0, p.x, p.z, 2800, 4453)], [true, true]);
    op(p, 2799, 4453, 'hauntedmine_boss_door');
    check('through the door into the chamber, with the key in it', [at(p), reaches(0, p.x, p.z, 2791, 4454)], [[2798, 4453, 0], true]);
    check('the key sits still on its crate (it used to wander off)', [npcAny('hauntedmine_boss_key', p.x, p.z, 0)!.x, npcAny('hauntedmine_boss_key', p.x, p.z, 0)!.z], [2788, 4455]);
    opNpcHere(p, 'hauntedmine_boss_key');
    check('Treus Dayth: stage 5', v(p, 'hauntedmine'), 5);
    opNpcHere(p, 'hauntedmine_boss_key');
    check('the crystal-mine key', H.invCount(p, 'hauntedmine_reward_key'), 1);
    p.teleport(2798, 4453, 0);
    H.tick(1);
    op(p, 2799, 4453, 'hauntedmine_boss_door');
    check('back out through the door', [at(p), reaches(0, p.x, p.z, 2812, 4453)], [[2800, 4453, 0], true]);
    op(p, 2812, 4452, 'hauntedmine_light_stairs_bottom');
    check('east stairs back up to level 5', [walkable(0, p.x, p.z), reaches(0, p.x, p.z, 2692, 4437)], [true, true]);

    console.log('The crystal:');
    op(p, 2692, 4436, 'hauntedmine_dark_stairs_top');
    check('west stairs down to the large doors', [walkable(0, p.x, p.z), reaches(0, p.x, p.z, 2773, 4451)], [true, true]);
    op(p, 2773, 4450, 'hauntedmine_rewarddoor_l');
    check('the key opens the doors: complete, with the shard', [v(p, 'hauntedmine'), H.invCount(p, 'crystalshard_necklace_unstrung')], [6, 1]);
    H.give(p, 'chisel');
    H.give(p, 'ball_of_wool');
    useOnHeld(p, 'chisel', 'crystalshard_necklace_unstrung');
    check('chisel and wool: the Salve amulet', H.invCount(p, 'crystalshard_necklace'), 1);
    op(p, 2773, 4450, 'hauntedmine_rewarddoor_l');
    check('the doors now lead into the crystal room', [p.z < 4450, reaches(0, p.x, p.z, 2798, 4433)], [true, true]);
    H.clearInv(p);
    H.give(p, 'chisel');
    op(p, 2800, 4430, 'crystalcorner');
    check('a lost shard can be cut again from the outcrop', H.invCount(p, 'crystalshard_necklace_unstrung'), 1);
    op(p, 2773, 4450, 'hauntedmine_rewarddoor_l');
    op(p, 2755, 4452, 'hauntedmine_light_stairs_bottom');
    check('west stairs back up to level 5', [walkable(0, p.x, p.z), reaches(0, p.x, p.z, 2746, 4437)], [true, true]);
    p.teleport(2726, 4455, 0);
    H.tick(1);
    op(p, 2726, 4456, 'lift_flooded');
    check('the flooded lift rides back up to the valve', [reaches(0, p.x, p.z, 2808, 4497)], [true]);
}

// ======================================================================================= Enakhra's Lament
if (want('enakh')) {
    console.log('ENAKHRAS LAMENT');
    const p = player('enakhq', 3190, 2927);
    talk(p, 'enakh_lazim_statue_east_multinpc', [1]);
    check('Lazim takes you on: stage 10, with a chisel', [vb(p, 'enakh_quest'), H.invCount(p, 'enakh_chisel')], [10, 1]);
    p.teleport(3173, 2920, 0);
    H.tick(1);
    for (let i = 0; i < 4; i++) op(p, 3173, 2918, 'enakh_mining_stone');
    check('the rock: a pickaxe, then the base, the body and the granite', ['bronze_pickaxe', 'enakh_sandstone_huge_base+legs', 'enakh_sandstone_huge_body', 'enakh_granite_medium'].map(o => H.invCount(p, o)), [1, 1, 1, 1]);
    useOnHeld(p, 'enakh_chisel', 'enakh_sandstone_huge_base+legs');
    useOnHeld(p, 'enakh_chisel', 'enakh_sandstone_huge_body');
    p.teleport(3189, 2923, 0);
    H.tick(1);
    useOn(p, 3189, 2925, 'enakh_statue_east_multiloc', 'enakh_sandstone_crafted_base+legs');
    useOn(p, 3189, 2925, 'enakh_statue_east_multiloc', 'enakh_sandstone_crafted_body');
    talk(p, 'enakh_lazim_statue_east_multinpc');
    check('base and body up, Lazim squares them: stage 20', vb(p, 'enakh_quest'), 20);
    useOnHeld(p, 'enakh_chisel', 'enakh_granite_medium', [1]);
    p.teleport(3189, 2923, 0);
    H.tick(1);
    useOn(p, 3189, 2925, 'enakh_statue_east_multiloc', 'enakh_statue_head_zamorak');
    check('the head goes on and it all falls in: stage 30', [vb(p, 'enakh_quest'), vb(p, 'enakh_statue_fallen')], [30, 3]);

    console.log('Down a boulder into the ring:');
    for (const [dir, bx, bz] of [['n', 3148, 2937], ['e', 3194, 2925], ['s', 3189, 2888], ['w', 3146, 2908]] as [string, number, number][]) {
        check(`boulder ${dir} can be walked to from the statue`, reaches(0, 3190, 2923, bx, bz, 200), true);
    }
    const land = (dir: string, bx: number, bz: number) => {
        const r = reachSet(0, 3190, 2923, 200);
        const s = [[0, 1], [0, -1], [1, 0], [-1, 0], [0, 2], [2, 0], [0, -2], [-2, 0]].map(([dx, dz]) => [bx + dx, bz + dz]).find(([x, z]) => r.has(x + ',' + z));
        if (s) { p.teleport(s[0], s[1], 0); H.tick(1); }
        op(p, bx, bz, 'enakh_secret_boulder_multiloc_' + dir);
        check(`boulder ${dir} lands on a walkable tile in the ring`, [p.z > 9000, walkable(0, p.x, p.z)], [true, true]);
    };
    land('n', 3148, 2937);
    check('into the ring: stage 40', vb(p, 'enakh_quest'), 40);
    land('e', 3194, 2925);
    land('w', 3146, 2908);
    land('s', 3189, 2888);
    check('the south boulder lands beside the fallen statue and Lazim', [reaches(0, p.x, p.z, 3129, 9325), reaches(0, p.x, p.z, 3127, 9325)], [true, true]);
    talk(p, 'enakh_lazim_fallen_statue_east_multinpc');
    p.teleport(3127, 9327, 0);
    H.tick(1);
    for (let i = 0; i < 4; i++) useOn(p, 3129, 9325, 'enakh_fallen_statue_east_multiloc', 'enakh_chisel');
    check('four limbs off the fallen statue', ['enakh_arm_left', 'enakh_arm_right', 'enakh_leg_left', 'enakh_leg_right'].map(o => H.invCount(p, o)), [1, 1, 1, 1]);
    op(p, 3128, 9319, 'enakh_pedestal_sigil_m');
    check('the M sigil from this quadrant', H.invCount(p, 'enakh_sigil_m'), 1);

    console.log('Round the ring through the corner doors:');
    const door = (what: string, name: string, x: number, z: number, targetX: number, targetZ: number) => {
        op(p, x, z, name);
        check(what, reaches(0, p.x, p.z, targetX, targetZ), true);
    };
    // SE -> NE by the right-leg door, NE -> NW by the left-arm door, NW -> SW by the left-leg door...
    door('right-leg door: SE quadrant into the NE one', 'enakh_door_right_leg', 3129, 9290, 3111, 9288);
    door('right-leg door back again', 'enakh_door_right_leg', 3129, 9290, 3128, 9319);
    door('and out once more', 'enakh_door_right_leg', 3129, 9290, 3111, 9288);
    door('left-arm door: NE into NW', 'enakh_door_left_arm', 3082, 9287, 3080, 9305);
    door('left-leg door: NW into SW', 'enakh_door_left_leg', 3079, 9334, 3097, 9336);
    door('right-arm door: SW into SE', 'enakh_door_right_arm', 3126, 9337, 3128, 9319);
    door('right-arm door back into SW', 'enakh_door_right_arm', 3126, 9337, 3097, 9336);
    door('left-leg door back into NW', 'enakh_door_left_leg', 3079, 9334, 3080, 9305);
    door('the M door into the middle', 'enakh_door_m_sigil', 3097, 9312, 3104, 9310);
    door('and back out of it', 'enakh_door_m_sigil', 3097, 9312, 3080, 9305);
    door('and in again', 'enakh_door_m_sigil', 3097, 9312, 3104, 9310);
    p.teleport(3104, 9310, 0);
    H.tick(1);
    op(p, 3104, 9309, 'enakh_temple_ladderup');
    check('up the middle ladder to the temple, beside the pedestal', [p.level, walkable(1, p.x, p.z), reaches(1, p.x, p.z, 3104, 9312)], [1, true, true]);
    const temple = at(p);

    console.log('The four elements:');
    check('the temple floor reaches the fountain, the furnace, the braziers and the prison', [reaches(1, p.x, p.z, 3091, 9307), reaches(1, p.x, p.z, 3115, 9323), reaches(1, p.x, p.z, 3116, 9307), reaches(1, p.x, p.z, 3091, 9324)], [true, true, true, true]);
    H.give(p, 'tinderbox');
    opNpcHere(p, 'enakh_dummy_fountain_multinpc', 2);
    opNpcHere(p, 'enakh_dummy_furnace_multinpc', 2);
    for (const [i, x, z] of [[1, 3114, 9306], [2, 3116, 9306], [3, 3118, 9306], [4, 3114, 9309], [5, 3116, 9309], [6, 3118, 9309]] as [number, number, number][]) useOn(p, x, z, `enakh_brazier_${i}_multiloc`, 'tinderbox');
    talk(p, 'enakh_pentyn');
    useOn(p, 3091, 9324, 'enakh_light_prison', 'enakh_chisel');
    check('ice, smoke, shadow and blood: stage 50', [vb(p, 'enakh_ice_room'), vb(p, 'enakh_smoke_room'), vb(p, 'enakh_shadow_room'), vb(p, 'enakh_blood_room'), vb(p, 'enakh_quest')], [1, 1, 1, 1, 50]);

    console.log('Through the barrier, up to the altar, and the head:');
    p.teleport(temple[0], temple[1], 1);
    H.tick(1);
    check('the barrier can be walked up to', reaches(1, p.x, p.z, 3104, 9318), true);
    op(p, 3104, 9319, 'enakh_magic_wall');
    check('through the barrier to the ladder up', [p.z > 9319, reaches(1, p.x, p.z, 3104, 9332)], [true, true]);
    op(p, 3104, 9332, 'enakh_temple_ladderup');
    check('up to the altar level', [p.level, walkable(2, p.x, p.z), reaches(2, p.x, p.z, 3108, 9320)], [2, true, true]);
    talk(p, 'enakh_lazim_altar_multinpc');
    check('Lazim hands over the head he has been carrying', H.invCount(p, 'enakh_stone_head_akthanakos'), 1);
    op(p, 3104, 9332, 'enakh_temple_ladderdown');
    check('back down', [p.level, walkable(1, p.x, p.z)], [1, true]);
    op(p, 3104, 9319, 'enakh_magic_wall');
    check('back through the barrier to the pedestal', reaches(1, p.x, p.z, 3104, 9312), true);
    useOn(p, 3104, 9312, 'enakh_pedestal_multiloc', 'enakh_stone_head_akthanakos');
    check('the head in the pedestal: Akthanakos out, stage 60', [vb(p, 'enakh_quest'), vb(p, 'enakh_akthanakos_form')], [60, 1]);
    check('Akthanakos is not on this side of the temple', reaches(1, p.x, p.z, 3105, 9297), false);
    op(p, 3104, 9319, 'enakh_magic_wall');
    op(p, 3104, 9332, 'enakh_temple_ladderup');
    check('the altar level runs south to the boneguard', reaches(2, p.x, p.z, 3104, 9308), true);
    check('the boneguard stays in its corridor', [npcAny('enakh_boneguard_multinpc', 3104, 9307, 2)!.x, npcAny('enakh_boneguard_multinpc', 3104, 9307, 2)!.z], [3104, 9307]);
    p.teleport(3104, 9310, 2);
    H.tick(1);
    opNpcHere(p, 'enakh_boneguard_multinpc');
    check('climb over the bones', [p.z < 9307, reaches(2, p.x, p.z, 3104, 9301)], [true, true]);
    op(p, 3104, 9300, 'enakh_temple_pillar_ladder_top');
    check('down the pillar into the south hall, beside Akthanakos', [p.level, walkable(1, p.x, p.z), reaches(1, p.x, p.z, 3105, 9297)], [1, true, true]);
    talk(p, 'enakh_akthanakos_multinpc');
    check('he walks through the big wall', vb(p, 'enakh_largewall_multivar'), 4);
    talk(p, 'enakh_enakhra_multinpc');
    check('Enakhra drops the hood: stage 65', vb(p, 'enakh_quest'), 65);
    talk(p, 'enakh_akthanakos_multinpc');
    check('Akthanakos: complete, with the camulet', [vb(p, 'enakh_quest'), H.invCount(p, 'camulet')], [70, 1]);
    p.teleport(3104, 9298, 1);
    H.tick(1);
    op(p, 3104, 9300, 'enakh_temple_pillar_ladder');
    check('back up the pillar to the corridor', [p.level, walkable(2, p.x, p.z), reaches(2, p.x, p.z, 3097, 9290)], [2, true, true]);
    p.teleport(3104, 9284, 2);
    H.tick(1);
    op(p, 3104, 9285, 'enakh_temple_pillar_ladder_top');
    check('the south pillar goes down behind the big wall', [p.level, walkable(1, p.x, p.z), reaches(1, p.x, p.z, 3104, 9287)], [1, true, true]);
    op(p, 3104, 9285, 'enakh_temple_pillar_ladder');
    check('and back up', [p.level, walkable(2, p.x, p.z)], [2, true]);
    p.teleport(3104, 9310, 0);
    H.tick(1);
    op(p, 3104, 9309, 'enakh_temple_ladderup');
    op(p, 3104, 9309, 'enakh_temple_ladderdown');
    check('down the middle ladder again', [p.level, walkable(0, p.x, p.z)], [0, true]);
    for (const [x, z] of [[3079, 9306], [3087, 9336], [3121, 9286], [3127, 9329]] as [number, number][]) {
        const r = reachSet(0, x + 1, z + 1, 30);
        const s2 = [[0, 1], [0, -1], [1, 0], [-1, 0]].map(([dx, dz]) => [x + dx, z + dz]).find(([a, b]) => walkable(0, a, b));
        p.teleport(s2![0], s2![1], 0);
        H.tick(1);
        op(p, x, z, 'enakh_temple_ladderup');
        const up = [p.level, walkable(1, p.x, p.z)];
        op(p, x, z, 'enakh_temple_ladderdown');
        check(`quadrant ladder ${x},${z}: up onto a walkable tile and down again`, [...up, p.level, walkable(0, p.x, p.z)], [1, true, 0, true]);
        void r;
    }
}

// ======================================================================================= Tai Bwo Wannai Trio
// The quest is now the original (ported from PlagueCityRS 349, original dialogue and stage numbers);
// the whole playthrough, the Karamja extras and the save migration are tools/sim/port349_tbwt.ts.
// What stays here is what this audit fixed that the port kept: the Shaikahan's real combat stats and
// the sons' bamboo doors, which now open (the cache's tbwt_bamboo_door_inactive) once the quest is done.
if (want('tbwt')) {
    console.log('TAI BWO WANNAI TRIO');
    const p = player('tbwtq', 2781, 3087, 1);
    H.setVar(p, 'junglepotion', 13);
    talk(p, 'tbwt_timfraku', [1, 3, 1, 1]); // roving adventurer - Trufitus sent me - gratitude - Yes
    check('Timfraku: started (original stage 3)', v(p, 'tbwt_main'), 3);
    for (const son of ['tbwt_tiadeche_multinpc_shore', 'tbwt_tinsay_multinpc_island', 'tbwt_tamayu_multinpc_jungle']) talk(p, son, son.includes('tiadeche') ? [1] : []);
    check('all three sons given the news (original stage 2 each)', [v(p, 'tbwt_tiadeche'), v(p, 'tbwt_tinsay'), v(p, 'tbwt_tamayu')], [2, 2, 2]);
    const beast = H.npcNear('tbwt_beast', 2906, 3094, 0)!;
    check('the Shaikahan has real combat stats now', [beast.levels[3], beast.levels[0]], [100, 80]);

    console.log('The sons\' houses:');
    const m0 = H.mesgs.length;
    p.teleport(2783, 3057, 0);
    H.tick(1);
    op(p, 2782, 3057, 'tbwt_bamboo_door');
    check('before the quest is done: no permission', [H.mesgs.slice(m0).some(m => m.text.includes('permission')), p.x, p.z], [true, 2783, 3057]);
    H.setVar(p, 'tbwt_main', 6);
    for (const [x, z] of [[2782, 3057], [2792, 3054], [2802, 3058]] as [number, number][]) {
        p.teleport(x + 1, z, 0);
        H.tick(1);
        const outside = reaches(0, p.x, p.z, 2795, 3080, 60);
        op(p, x, z, 'tbwt_bamboo_door');
        const a1 = at(p);
        H.tick(5);
        op(p, x, z, 'tbwt_bamboo_door');
        const a2 = at(p);
        check(`bamboo door at ${x},${z} opens you through and back`, [outside, a1[0] !== x + 1 || a1[1] !== z, walkable(0, a1[0], a1[1]), a2[0] === x + 1 && a2[1] === z], [true, true, true, true]);
    }
}

// ======================================================================================= Roving Elves
if (want('roving')) {
    console.log('ROVING ELVES');
    const p = player('rovingq', 2290, 3149);
    H.setVar(p, 'waterfall_quest', 10);
    H.setVar(p, 'regicide_quest', 15);
    talk(p, 'roving_islwyn');
    check('Islwyn: stage 1', v(p, 'roving_elves_quest'), 1);
    talk(p, 'roving_female_woodelf');
    check('Eluned: stage 2', v(p, 'roving_elves_quest'), 2);
    H.give(p, 'glarials_amulet_waterfall_quest');
    p.teleport(2530, 9842, 0);
    H.tick(1);
    op(p, 2530, 9844, 'glarials_chest_closed_waterfall_quest');
    op(p, 2530, 9844, 'glarials_chest_open_waterfall_quest');
    check('the seed in Glarial\'s chest: stage 3', [v(p, 'roving_elves_quest'), H.invCount(p, 'roving_old_consecration_seed')], [3, 1]);
    talk(p, 'roving_female_woodelf');
    check('Eluned wakes it: stage 4', [v(p, 'roving_elves_quest'), H.invCount(p, 'roving_new_consecration_seed')], [4, 1]);
    H.give(p, 'spade');
    p.teleport(2603, 9908, 0);
    H.tick(1);
    H.opheld(p, 'roving_new_consecration_seed', 1);
    drive(p);
    check('planted beside the chalice: stage 5', v(p, 'roving_elves_quest'), 5);
    talk(p, 'roving_islwyn', [1]);
    check('Islwyn: complete, with the crystal bow', [v(p, 'roving_elves_quest'), H.invCount(p, 'roving_crystal_bow_new')], [10, 1]);
}

// ======================================================================================= Priest in Peril
if (want('priest')) {
    console.log('PRIEST IN PERIL (the end, and the Port Phasmatys gate)');
    const p = player('priestq', 3440, 9893);
    H.setVar(p, 'priestperil', 59);
    check('not complete: no charter to Port Phasmatys', H.runProc(p, '[proc,charter_can_sail]', [6])[0], 0);
    H.give(p, 'blankrune', 1);
    const drezel = npcAny('priestperiltrappedmonk2', p.x, p.z, 0)!;
    p.teleport(drezel.x + 1, drezel.z, 0);
    H.tick(1);
    p.lastUseItem = ObjType.getId('blankrune');
    p.lastUseSlot = slotOf(p, 'blankrune');
    p.clearPendingAction();
    p.setInteraction(Interaction.ENGINE, drezel, ServerTriggerType.APNPCU);
    drive(p);
    check('the last essence: complete, wolfbane, a quest point', [v(p, 'priestperil'), H.invCount(p, 'dagger_wolfbane'), v(p, 'qp') > 0], [60, 1, true]);
    check('complete: the charter sails to Port Phasmatys', H.runProc(p, '[proc,charter_can_sail]', [6])[0], 1);
}

// ======================================================================================= spot checks
if (want('spots')) {
    console.log('SPOT CHECKS (the batch\'s other teleports)');
    // Dig Site: the winch ropes down the two shafts, the ladders back up, and the end of the blast
    for (const [x, z, what] of [[3370, 9764, 'winch 1, after the blast'], [3370, 9828, 'winch 1, before'], [3353, 9754, 'winch 2, after'], [3353, 9818, 'winch 2, before'], [3370, 3427, 'ladder 1 top'], [3354, 3417, 'ladder 2 top'], [3368, 9831, 'blast run end'], [3368, 9767, 'blast landing']] as [number, number, string][]) {
        check(`Dig Site ${what} (${x},${z}) is walkable`, walkable(0, x, z), true);
    }
    check('Dig Site: the blast brick stands where the run starts (3379,9826)', walkable(0, 3379, 9826), true);
    const d = player('digsacks', 3355, 9760);
    const m0 = H.mesgs.length;
    op(d, 3354, 9760, 'digsitesackkey');
    check('Dig Site: the shaft sacks can be searched', mesSince(d, m0).some(m => m.includes('nothing of interest')), true);
    // Priest in Peril: through the holy barrier, and the trapdoor down
    check('Priest in Peril: holy barrier far side (3423,3485) is walkable', walkable(0, 3423, 3485), true);
    check('Priest in Peril: east trapdoor bottom (3440,9887) is walkable', walkable(0, 3440, 9887), true);
    // Druidic Ritual: the cauldron in Taverley Dungeon can be walked to from the ladder
    check('Druidic Ritual: Sanfew is upstairs in his house, Kaqemeex in the circle', [npcAny('sanfew', 2897, 3426, 1)?.level, npcAny('kaqemeex', 2925, 3486, 0)?.level], [1, 0]);
}
console.log(`\n${R.ok} ok, ${R.bad} FAIL`);
process.exit(R.bad ? 1 : 0);
