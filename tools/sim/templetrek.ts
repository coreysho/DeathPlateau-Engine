// TEMPLE TREKKING, start to finish. Picks an escort in Burgh de Rott, takes a route, and plays
// every leg: the room it lands in, whether the escort came with it, whether the event put out what
// it should have, and whether the way out works. Then it checks the token and what the token pays.
//
// The questions worth being certain about are structural, because the trek is fourteen rooms of
// map that nothing had ever stood in: is every entry tile floor, does every room have its three
// Paths, and does a Continue-trek actually land you in the next room rather than in the water.
//
//   npx tsx tools/sim/templetrek.ts [route]
import * as H from './harness.js';
import World from '#/engine/World.js';
import LocType from '#/cache/config/LocType.js';
import NpcType from '#/cache/config/NpcType.js';
import Component from '#/cache/config/Component.js';
import ScriptState from '#/engine/script/ScriptState.js';
import { isMapBlocked, isZoneAllocated, findPathToLoc, findPathToEntity, canTravel } from '#/engine/GameMap.js';
import { CollisionType } from '#/engine/routefinder/index.js';
import ObjType from '#/cache/config/ObjType.js';
import { Interaction } from '#/engine/entity/Interaction.js';
import ServerTriggerType from '#/engine/script/ServerTriggerType.js';

await H.boot();

const ROUTE = Number(process.argv[2] ?? 1);
const M2_COMPLETE = 110;

// the fourteen rooms, read out of configs/templetrek.constant
const ROOMS: [number, [number, number], [number, number], [number, number], [number, number] | null][] = [
    [1, [1999, 5030], [1999, 5051], [1999, 5028], [1989, 5042]],
    [2, [2028, 5030], [2040, 5048], [2028, 5028], [2021, 5049]],
    [3, [2191, 5030], [2191, 5051], [2191, 5028], [2181, 5042]],
    [4, [2220, 5030], [2232, 5048], [2220, 5028], [2213, 5049]],
    [5, [2255, 5030], [2255, 5051], [2255, 5028], [2245, 5042]],
    [6, [2284, 5030], [2296, 5048], [2284, 5028], [2275, 5049]],
    [7, [2319, 5029], [2319, 5051], [2319, 5027], [2308, 5042]],
    [8, [2348, 5031], [2360, 5048], [2348, 5027], [2340, 5050]],
    [9, [2383, 5027], [2383, 5052], [2383, 5025], [2373, 5042]],
    [10, [2412, 5028], [2424, 5050], [2412, 5026], [2401, 5048]],
    [11, [2143, 5001], [2134, 5032], [2143, 4999], [2126, 5016]],
    [12, [2082, 5041], [2103, 5037], [2080, 5041], null],
    [13, [2092, 5004], [2090, 5024], [2092, 5002], null],
    [14, [2269, 5006], [2269, 5021], [2269, 5004], null],
    // the boat: no Path locs anywhere near it, so no success/fail/evade coords - the Boat loc
    // carries op4=Continue-trek and op5=Escape-event instead
    [15, [2062, 5035], [2062, 5034], [2062, 5034], null]
];
const EVENT_OF: Record<number, string> = {
    1: 'snakes', 5: 'snakes', 9: 'snakes',
    2: 'ghasts', 6: 'ghasts', 10: 'ghasts',
    3: 'snails', 7: 'snails',
    4: 'vampyres', 8: 'vampyres',
    11: 'shades', 12: 'bridge', 13: 'vines', 14: 'samaritan', 15: 'tentacles'
};

// Use an item on a loc. The harness has no helper for this and three of Temple Trekking's events
// need it, because the locs they hang off - the vine tree, the branch - carry no option of their
// own. Same shape as the audits' own useOnLoc.
const slotOf = (obj: string): number => {
    const id = ObjType.getId(obj);
    const inv = p.invs.get(93)!;
    for (let i = 0; i < inv.capacity; i++) {
        if (inv.get(i)?.id === id) return i;
    }
    return -1;
};
const useNpcObj = (npc: any, objName: string): void => {
    p.clearPendingAction();
    p.lastUseItem = ObjType.getId(objName);
    p.lastUseSlot = slotOf(objName);
    p.queueWaypoints(findPathToEntity(p.level, p.x, p.z, npc.x, npc.z, p.width, npc.width, npc.length));
    p.setInteraction(Interaction.ENGINE, npc, ServerTriggerType.APNPCU);
    (p as unknown as { opcalled: boolean }).opcalled = true;
};
const useLocObj = (x: number, z: number, locName: string, objName: string): boolean => {
    const loc = World.getLoc(x, z, p.level, LocType.getId(locName));
    if (!loc) return false;
    const lt = LocType.get(loc.type) as unknown as { forceapproach: number };
    p.clearPendingAction();
    p.lastUseItem = ObjType.getId(objName);
    p.lastUseSlot = slotOf(objName);
    p.queueWaypoints(findPathToLoc(p.level, p.x, p.z, loc.x, loc.z, p.width, loc.width, loc.length, loc.angle, loc.shape, lt.forceapproach));
    p.setInteraction(Interaction.ENGINE, loc, ServerTriggerType.APLOCU);
    (p as unknown as { opcalled: boolean }).opcalled = true;
    return true;
};

const legOf = () => H.getVarBit(p, 'trek_leg');
// A coord is one packed int in RuneScript and runProc only takes ints, so a proc that takes a
// coord has to be handed it this way - passing nothing left ~in_templetrek reading zero and
// reporting that a trek room is not a trek room.
const packCoord = () => (p.level << 28) | (p.x << 14) | p.z;

let bad = 0;
const check = (what: string, got: unknown, want: unknown) => {
    const ok = JSON.stringify(got) === JSON.stringify(want);
    if (!ok) bad++;
    console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${what}: ${JSON.stringify(got)}${ok ? '' : '   (want ' + JSON.stringify(want) + ')'}`);
};

const p: any = H.makePlayer('trekrun', 3480, 3243);
H.tick(2);
H.maxOut(p);
H.runProc(p, '[proc,player_combat_stat]');

// ------------------------------------------------------------------ the map, before anything runs
// Teleport into each room first so its zone is allocated - isZoneAllocated is false until something
// has been there, and asking before visiting reports every tile blocked.
console.log('THE FOURTEEN ROOMS: every entry tile floor, and every Path in place');
for (const [n, entry, success, fail, evade] of ROOMS.filter(r => r[0] <= 14)) {
    p.teleport(entry[0], entry[1], 0);
    H.tick(2);
    const floor = isZoneAllocated(0, entry[0], entry[1]) && !isMapBlocked(entry[0], entry[1], 0);
    const sp = World.getLoc(success[0], success[1], 0, LocType.getId('templetrek_swamp_success_path')) !== null;
    const fp = World.getLoc(fail[0], fail[1], 0, LocType.getId('templetrek_swamp_fail_path')) !== null;
    const ep = evade === null ? true : World.getLoc(evade[0], evade[1], 0, LocType.getId('templetrek_swamp_evade_path')) !== null;
    check(`room ${n} (${EVENT_OF[n]}) entry ${entry[0]},${entry[1]}`, [floor, sp, fp, ep], [true, true, true, true]);
}

// ---------------------------------------------------------------------------- the escorts appear
console.log('\nTHE SIX IN BURGH DE ROTT');
p.teleport(3480, 3243, 0);
H.tick(2);
H.setVarBit(p, 'myreque_2_quest', 0); // a varbit on myreque_2_main_var
H.setVarBit(p, 'templetrek_npcs_visible', 0);
check('hidden before In Aid of the Myreque', H.getVarBit(p, 'templetrek_npcs_visible'), 0);
H.setVarBit(p, 'myreque_2_quest', M2_COMPLETE);
// protect: true, because templetrek_main_var is transmitted and a transmitted varp needs
// protected access to write - the same thing a real opnpc or the login script already has.
H.runProc(p, '[proc,trek_unlock]', [], undefined, true);
check('visible once the quest is done', H.getVarBit(p, 'templetrek_npcs_visible'), 1);
// The six placed npcs are the MULTI forms - multinpc only changes what a client draws - so that is
// what is standing there and what the op arrives on.
for (const nm of ['templetrek_multi_retired_man_easy', 'templetrek_multi_retired_soldier_easy', 'templetrek_multi_man_med',
                  'templetrek_multi_woman_med', 'templetrek_multi_oldman_hard', 'templetrek_multi_child_hard']) {
    check(`${nm.replace('templetrek_multi_', '')} is in Burgh de Rott`, H.npcNear(nm, 3478, 3238, 0) !== null, true);
}

// ------------------------------------------------------------------------------- the escort's pack
// Old School lets you stock the follower with up to fifteen food items before you leave, and the
// cache keeps a four-bit counter for exactly that. There is no interface for it, so it is done by
// using the food on them.
console.log("\nSTOCKING THE PACK");
H.setVarBit(p, 'templetrek_multi_npc_food_give', 0);
H.clearInv(p);
H.give(p, 'lobster', 20);
H.give(p, 'bronze_axe');
const volunteer = H.npcNear('templetrek_multi_retired_man_easy', 3481, 3241, 0)!;
p.teleport(3481, 3242, 0);
H.tick(2);
useNpcObj(volunteer, 'lobster');
for (let i = 0; i < 20 && H.getVarBit(p, 'templetrek_multi_npc_food_give') === 0; i++) H.tick(1);
p.closeModal();
check('a lobster goes in the pack', [H.getVarBit(p, 'templetrek_multi_npc_food_give'), H.invCount(p, 'lobster')], [1, 19]);

useNpcObj(volunteer, 'bronze_axe');
for (let i = 0; i < 20; i++) H.tick(1);
p.closeModal();
check('an axe does not', [H.getVarBit(p, 'templetrek_multi_npc_food_give'), H.invCount(p, 'bronze_axe')], [1, 1]);

// fill it to the brim and then try one more
for (let n = 2; n <= 15; n++) {
    useNpcObj(volunteer, 'lobster');
    for (let i = 0; i < 20 && H.getVarBit(p, 'templetrek_multi_npc_food_give') < n; i++) H.tick(1);
    p.closeModal();
}
check('fifteen is as many as it holds', H.getVarBit(p, 'templetrek_multi_npc_food_give'), 15);
const spare = H.invCount(p, 'lobster');
useNpcObj(volunteer, 'lobster');
for (let i = 0; i < 20; i++) H.tick(1);
p.closeModal();
check('the sixteenth is refused and stays in your pack', [H.getVarBit(p, 'templetrek_multi_npc_food_give'), H.invCount(p, 'lobster')], [15, spare]);
H.clearInv(p);

// ------------------------------------------------------------------------------- driving dialogue
const drive = (picks: number[] = []): string[] => {
    const from = H.ifaces.length;
    let idle = 0;
    for (let guard = 0; guard < 600 && idle < 3; guard++) {
        const sc = p.activeScript;
        if (!sc || sc.execution !== ScriptState.PAUSEBUTTON) {
            if (!sc && !p.delayed && [...p.queue.all()].length === 0 && !p.target) idle++;
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
            if (pick === undefined) break;
            H.choose(p, `${multi.split(':')[0]}:com_${pick}`);
        } else {
            p.executeScript(sc, true, true);
        }
    }
    return H.ifaces.slice(from).filter((i: any) => i.who === p.username && i.kind === 'text' && i.text && i.text.length > 1).map((i: any) => i.text!);
};

// -------------------------------------------------------------------------------------- the trek
console.log(`\nA TREK ON ROUTE ${ROUTE}`);
const escort = H.npcNear('templetrek_multi_retired_man_easy', 3481, 3241, 0);
if (!escort) {
    check('Dalcian Fang can be talked to', false, true);
    process.exit(1);
}
H.opNpc(p, escort, 1);
const said = drive([ROUTE]);
console.log(`        said: ${said.join(' | ').slice(0, 150)}`);
check('route and escort are set, and you are in the vestibule', [H.getVarBit(p, 'trek_route'), H.getVarBit(p, 'trek_escort'), p.x, p.z], [ROUTE, 1, 2052, 5044]);

const legs = ROUTE === 1 ? 5 : ROUTE === 2 ? 4 : 3;
const roomOf = (x: number, z: number) => ROOMS.find(r => Math.abs(r[1][0] - x) <= 3 && Math.abs(r[1][1] - z) <= 3)?.[0] ?? 0;

// A ROOM CHANGE IS NOT DONE WHEN THE VARBIT CHANGES. trek_next_room writes trek_room, then
// mes/p_delay(2)/p_teleport, then places the escort and starts the event - so a probe that stops
// ticking as soon as the varbit moves measures the room before the player is in it, and reads an
// event that has not run. Wait for the player to actually be standing on the entry tile.
const settle = (): number => {
    for (let i = 0; i < 60; i++) {
        H.tick(1);
        const room = H.getVarBit(p, 'trek_room');
        if (room !== 0) {
            const r = ROOMS.find(q => q[0] === room)!;
            if (p.x === r[1][0] && p.z === r[1][1] && !p.delayed) return room;
        }
    }
    p.closeModal();
    return H.getVarBit(p, 'trek_room');
};

// Walk to a Path and take it. Two things to get right. The rooms are twenty tiles long, so the op
// needs time to route there - and an op sent while the player is still inside a p_delay from the
// previous step is dropped, which is what made the bridge room look like a dead end: the
// Walk-across ends in a delay and the Continue-trek click landed in the middle of it.
const idle = (n = 25): void => {
    for (let i = 0; i < n; i++) {
        if (!p.delayed && !p.activeScript) return;
        H.tick(1);
    }
};
const takePath = (at: [number, number], loc: string): void => {
    const legBefore = H.getVarBit(p, 'trek_leg');
    for (let go = 0; go < 2; go++) {
        idle();
        p.closeModal();
        H.opLoc(p, at[0], at[1], loc, 2);
        for (let i = 0; i < 90; i++) {
            H.tick(1);
            if (H.getVarBit(p, 'trek_leg') !== legBefore) return;
        }
    }
};

// out of the vestibule and into leg 1
H.opLoc(p, 2051, 5047, 'templetrek_swamp_continue_1', 2);
settle();

for (let leg = 1; leg <= legs; leg++) {
    const room = H.getVarBit(p, 'trek_room');
    const ev = EVENT_OF[room];
    console.log(`\n  --- leg ${leg} of ${legs}: room ${room} (${ev})`);
    const r = ROOMS.find(q => q[0] === room)!;
    check('the player is standing in that room', [p.x, p.z], [r[1][0], r[1][1]]);
    // p.level, not 0: the boat deck is on plane 2, and looking for the escort on the ground floor
    // reported route 3's last leg as having arrived without them.
    check('the escort came too', H.npcNear('templetrek_retired_man_easy', p.x, p.z, p.level) !== null, true);

    if (['snakes', 'ghasts', 'snails', 'vampyres', 'shades'].includes(ev)) {
        const spawned = H.getVarBit(p, 'trek_spawned');
        // AND THEY HAVE TO EXIST. trek_spawned is a number the script wrote; it says nothing about
        // whether an npc came out. These are big - a ghast is 2x2, a snail 3x3, a swamp snake 3x3
        // on route 1 and 5x5 on route 3 - so two of them spawned too close together means the
        // second one silently never appears, and the room can never be cleared.
        const types: Record<string, string[]> = {
            snakes: ['templetrek_snake_1', 'templetrek_snake_2', 'templetrek_snake_3'],
            ghasts: ['templetrek_ghast_invis_1', 'templetrek_ghast_invis_2', 'templetrek_ghast_invis_3',
                     'templetrek_ghast_vis_1', 'templetrek_ghast_vis_2', 'templetrek_ghast_vis_3'],
            snails: ['templetrek_giantsnail_1', 'templetrek_giantsnail_2', 'templetrek_giantsnail_3'],
            vampyres: ['templetrek_vampire_1', 'templetrek_vampire_2', 'templetrek_vampire_3'],
            shades: ['templetrek_shade_1', 'templetrek_shade_2', 'templetrek_shade_3']
        };
        let alive = 0;
        for (const nm of types[ev]) {
            const id = NpcType.getId(nm);
            for (const npc of World.npcs) {
                if (npc && npc.isActive && npc.type === id && npc.level === p.level &&
                    Math.max(Math.abs(npc.x - p.x), Math.abs(npc.z - p.z)) <= 20) alive++;
            }
        }
        check('it put three monsters out, all three of them real, and the way on is shut',
              [spawned, alive, H.getVarBit(p, 'trek_event_done')], [3, 3, 0]);
        // resolved the blunt way: this probe is about the trek machine, not the fighting
        H.setVarBit(p, 'trek_kills', spawned);
        H.setVarBit(p, 'trek_event_done', 1);
    } else if (ev === 'tentacles') {
        // the boat. Five of them come up out of the water around a six-tile deck, and the deck is
        // the only thing to stand on.
        check('the deck is where the trek put you', [p.x, p.z, p.level], [2062, 5035, 2]);
        let arms = 0;
        const armId = NpcType.getId('templetrek_tentacle_arm');
        const headId = NpcType.getId('templetrek_tentacle_head');
        let heads = 0;
        for (const npc of World.npcs) {
            if (!npc || !npc.isActive || npc.level !== 2) continue;
            if (Math.max(Math.abs(npc.x - p.x), Math.abs(npc.z - p.z)) > 6) continue;
            if (npc.type === armId) arms++;
            if (npc.type === headId) heads++;
        }
        check('four tentacles and a head, all risen and done spawning', [arms, heads, H.getVarBit(p, 'trek_spawned')], [4, 1, 5]);
        check('the way on is shut until they are dealt with', H.getVarBit(p, 'trek_event_done'), 0);
        // the boat refuses to go on while they are up
        const ifaceMark = H.ifaces.length;
        H.opLoc(p, 2062, 5034, 'templetrek_boat_dummy_poly', 4);
        for (let i = 0; i < 30; i++) H.tick(1);
        const held = H.ifaces.slice(ifaceMark).some((i: any) => (i.text ?? '').includes('has not finished with you'));
        p.closeModal();
        check('Continue-trek is refused while the thing is alive', [held, H.getVarBit(p, 'trek_leg')], [true, legOf()]);
        H.setVarBit(p, 'trek_kills', 5);
        H.setVarBit(p, 'trek_event_done', 1);
    } else if (ev === 'bridge') {
        check('the way on is shut', H.getVarBit(p, 'trek_event_done'), 0);
        H.give(p, 'plank', 5);
        H.give(p, 'hammer');
        // three stages, one piece of wood each, and the loc changes under you every time
        for (const [from, to] of [['templetrek_bridge_broken', 1], ['templetrek_bridge_fixed_1', 2], ['templetrek_bridge_fixed_2', 3]] as [string, number][]) {
            H.opLoc(p, 2090, 5039, from, 1);
            for (let i = 0; i < 40 && H.getVarBit(p, 'trek_bridge_fixed') < to; i++) H.tick(1);
            p.closeModal();
            check(`stage ${to}: ${from.replace('templetrek_bridge_', '')} mended`, H.getVarBit(p, 'trek_bridge_fixed'), to);
        }
        check('three pieces of wood finish it', [H.getVarBit(p, 'trek_bridge_fixed'), H.getVarBit(p, 'trek_event_done'), H.invCount(p, 'plank')], [3, 1, 2]);
        // and the ditch is crossed by clicking the bridge, not by walking: Walk-across is the only
        // op on the finished one, and the Continue-trek path is on the far bank
        H.opLoc(p, 2090, 5039, 'templetrek_bridge_fixed_3', 2);
        for (let i = 0; i < 40 && p.x < 2091; i++) H.tick(1);
        p.closeModal();
        check('Walk-across puts you on the east bank', [p.x, p.z], [2091, 5039]);
    } else if (ev === 'samaritan') {
        // what he actually does is tested on its own further down, forced rather than waited for
        check('Abidor Crank is here and the room is already clear', [H.npcNear('templetrek_good_samaritan', p.x, p.z, 0) !== null, H.getVarBit(p, 'trek_event_done')], [true, 1]);
    } else if (ev === 'vines') {
        check('the way on is shut', H.getVarBit(p, 'trek_event_done'), 0);
        H.give(p, 'knife');
        // two cuts off the vine tree, both with the knife used ON the loc - it has no option of
        // its own, which is the whole reason this is an oplocu
        for (let cut = 1; cut <= 2; cut++) {
            useLocObj(2095, 5010, 'templetrek_swamptree_small_vines', 'knife');
            for (let i = 0; i < 30 && H.invCount(p, 'templetrek_short_vine') < cut; i++) H.tick(1);
            p.closeModal();
        }
        check('two lengths of vine cut', H.invCount(p, 'templetrek_short_vine'), 2);
        H.useHeldOn(p, 'templetrek_short_vine', 'templetrek_short_vine');
        for (let i = 0; i < 30 && H.invCount(p, 'templetrek_long_vine') === 0; i++) H.tick(1);
        p.closeModal();
        check('twisted into a rope', [H.invCount(p, 'templetrek_long_vine'), H.getVarBit(p, 'trek_vine_state')], [1, 2]);
        useLocObj(2093, 5014, 'templetrek_swamptree_branch', 'templetrek_long_vine');
        for (let i = 0; i < 40 && H.getVarBit(p, 'trek_event_done') === 0; i++) H.tick(1);
        p.closeModal();
        check('the rope goes over the branch and the way opens', H.getVarBit(p, 'trek_event_done'), 1);
        // and the gully is crossed by swinging, because z 5014 and 5015 are solid. idle() first:
        // the rope handler sets its flag and THEN animates, so the probe now stops ticking while
        // the script is still in its p_delay - and a click sent inside a delay is dropped.
        idle();
        p.closeModal();
        H.opLoc(p, 2093, 5014, 'templetrek_swamptree_branch_vine', 2);
        for (let i = 0; i < 40 && p.z < 5016; i++) H.tick(1);
        p.closeModal();
        check('Swing-on puts you on the north island', [p.x, p.z], [2093, 5016]);
    }

    const legBefore = H.getVarBit(p, 'trek_leg');
    if (ev === 'tentacles') {
        // op4 on the boat, not a Path
        for (let go = 0; go < 2 && H.getVarBit(p, 'trek_leg') === legBefore; go++) {
            idle();
            p.closeModal();
            H.opLoc(p, 2062, 5034, 'templetrek_boat_dummy_poly', 4);
            for (let i = 0; i < 90 && H.getVarBit(p, 'trek_leg') === legBefore; i++) H.tick(1);
        }
    } else {
        takePath(r[2], 'templetrek_swamp_success_path');
    }
    if (leg < legs) {
        const now = settle();
        check('Continue-trek took you to the next room', [H.getVarBit(p, 'trek_leg'), now !== 0, now !== room || legs === 1], [legBefore + 1, true, true]);
    } else {
        for (let i = 0; i < 40 && H.getVarBit(p, 'trek_route') !== 0; i++) H.tick(1);
        p.closeModal();
        check('the last leg lands at Paterdomus and clears the trek', [p.x, p.z, H.getVarBit(p, 'trek_route')], [3417, 3486, 0]);
    }
}

// ------------------------------------------------------------------------------------ the reward
console.log('\nTHE TOKEN');
const token = ROUTE === 1 ? 'templetrek_blue_token' : ROUTE === 2 ? 'templetrek_yellow_token' : 'templetrek_red_token';
check(`the escort handed over a ${token.replace('templetrek_', '').replace('_', ' ')}`, H.invCount(p, token), 1);
// a clean pack: the legs above leave planks, a knife and whatever the trek handed out, and claiming
// wants two free spaces
H.clearInv(p);
H.give(p, token);
H.setVarBit(p, 'templetrek_npc_point_value', 4500);
const invBefore = H.invCount(p, token);
H.opheld(p, token, 1);
for (let i = 0; i < 20; i++) H.tick(1);
p.closeModal();
check('clicking it spends the token and the points', [H.invCount(p, token), H.getVarBit(p, 'templetrek_npc_point_value')], [invBefore - 1, 0]);
let got = 0;
for (const nm of ['blankrune', 'bow_string', 'silver_bar', 'unidentified_harralander', 'coal', 'iron_ore', 'watermelon_seed', 'raw_lobster']) got += H.invCount(p, nm);
for (let i = 1; i <= 3; i++) {
    for (const sk of ['agility', 'firemaking', 'fishing', 'mining', 'slayer', 'thieving', 'woodcutting']) {
        got += H.invCount(p, `templetrek_tome_${sk}_level_${i}`);
    }
}
check('and paid something out', got > 0, true);

// NOTHING LEFT BEHIND BY A NATURAL TREK. Checked here rather than at the end of the run, because
// everything below this point forces rooms and routes directly and is allowed to strand a villager
// doing it - a leg transition is not. This is the check that caught the real leak: the teardown used
// to run AFTER the teleport, so every leg left its escort standing three hundred tiles away.
let strays = 0;
for (const nm of ['templetrek_retired_man_easy', 'templetrek_retired_soldier_easy', 'templetrek_man_med',
                  'templetrek_woman_med', 'templetrek_oldman_hard', 'templetrek_child_hard']) {
    const id = NpcType.getId(nm);
    for (const npc of World.npcs) {
        if (npc && npc.isActive && npc.type === id) {
            strays++;
            console.log(`        stray ${nm} at ${npc.x},${npc.z} L${npc.level}`);
        }
    }
}
check('\nNO VILLAGER LEFT IN THE SWAMP: strays', strays, 0);

// ---------------------------------------------------------------------------- escaping and evading
// Two things a player will do far more often than finishing: give up, and slip past. Both are run
// from a fresh trek, because the one above is over by now.
const freshTrek = (route: number): number => {
    H.clearInv(p);
    p.teleport(3480, 3243, 0);
    H.tick(2);
    const e = H.npcNear('templetrek_multi_retired_man_easy', 3481, 3241, 0)!;
    H.opNpc(p, e, 1);
    drive([route]);
    p.closeModal();
    H.opLoc(p, 2051, 5047, 'templetrek_swamp_continue_1', 2);
    return settle();
};

console.log('\nESCAPE: the Path you came in by abandons the trek');
let room = freshTrek(1);
let r = ROOMS.find(q => q[0] === room)!;
idle();
p.closeModal();
H.opLoc(p, r[3][0], r[3][1], 'templetrek_swamp_fail_path', 2);
for (let i = 0; i < 90 && H.getVarBit(p, 'trek_route') !== 0; i++) H.tick(1);
p.closeModal();
check('escaping puts you back in Burgh de Rott with no trek', [p.x, p.z, H.getVarBit(p, 'trek_route'), H.getVarBit(p, 'trek_escort')], [3480, 3243, 0, 0]);

console.log('\nEVADE: route 1 can slip past anything, route 3 can never');
room = freshTrek(1);
r = ROOMS.find(q => q[0] === room)!;
while (r[4] === null) {
    // a puzzle room has no Evade Path placed, so draw again by escaping and starting over
    idle();
    p.closeModal();
    H.opLoc(p, r[3][0], r[3][1], 'templetrek_swamp_fail_path', 2);
    for (let i = 0; i < 90 && H.getVarBit(p, 'trek_route') !== 0; i++) H.tick(1);
    p.closeModal();
    room = freshTrek(1);
    r = ROOMS.find(q => q[0] === room)!;
}
const legBefore = H.getVarBit(p, 'trek_leg');
check('the event is live and nothing is dead yet', [H.getVarBit(p, 'trek_event_done'), H.getVarBit(p, 'trek_kills')], [0, 0]);
idle();
p.closeModal();
H.opLoc(p, r[4]![0], r[4]![1], 'templetrek_swamp_evade_path', 2);
for (let i = 0; i < 90 && H.getVarBit(p, 'trek_leg') === legBefore; i++) H.tick(1);
p.closeModal();
check('route 1 evades without a single kill', H.getVarBit(p, 'trek_leg'), legBefore + 1);

// AND ROUTE 3 REFUSES. Done by setting the route on the trek already running rather than by
// starting a fresh one: the gate reads %trek_route and nothing else, and ~trek_talk turns away
// anybody who is already escorting somebody - so a second freshTrek() quietly did nothing and the
// refusal "failed" on a route-1 trek that was still going.
// Room 1 every time rather than whatever was drawn: its Evade Path is ten tiles from its entry and
// the sweep below proves both are in one region, so if no refusal comes back it is the gate that is
// wrong and not the walk. Taking the drawn room meant a puzzle room (no Evade Path at all) or a
// twenty-five tile hike could pass the check for the wrong reason.
// ...and the previous evade is let finish first. It advanced a leg, which means trek_next_room is
// mid-p_delay with a teleport still to come - force the room before that lands and the script puts
// the player back in whatever it drew, twenty rooms from the Evade Path about to be clicked.
idle(40);
p.closeModal();
H.setVarBit(p, 'trek_route', 3);
r = ROOMS.find(q => q[0] === 1)!;
H.setVarBit(p, 'trek_room', 1);
H.setVarBit(p, 'trek_event_done', 0);
p.clearPendingAction();
p.queueWaypoints([]);
p.teleport(r[1][0], r[1][1], 0);
H.tick(3);
const legBefore3 = H.getVarBit(p, 'trek_leg');
const ifaceMark3 = H.ifaces.length;
idle();
p.closeModal();
H.opLoc(p, r[4]![0], r[4]![1], 'templetrek_swamp_evade_path', 2);
for (let i = 0; i < 60; i++) H.tick(1);
// a ~mesbox is interface text, not a chat message, so it lands in ifaces and not mesgs
const refused = H.ifaces.slice(ifaceMark3).some((i: any) => (i.text ?? '').includes('no slipping past'));
p.closeModal();
// the player has to have GOT to the Path for the refusal to mean anything
const atPath = Math.max(Math.abs(p.x - r[4]![0]), Math.abs(p.z - r[4]![1])) <= 2;
check('route 3 refuses, and the leg does not advance', [H.getVarBit(p, 'trek_leg'), atPath, refused], [legBefore3, true, true]);
// this test forced a room too, so the escort of the room it was forced out of goes now
H.runProc(p, '[proc,trek_clear_escort]', [], undefined, true);
// leave no trek running
H.setVarBit(p, 'trek_route', 0);
H.setVarBit(p, 'trek_escort', 0);
H.setVarBit(p, 'trek_room', 0);
H.setVarBit(p, 'trek_leg', 0);

// --------------------------------------------------------------------------- the escort can die
// The stake of the whole minigame, and the thing it was missing: Old School says a trek fails if
// you or the follower die. There is no npc-against-npc combat in this build, so the mauling is a
// queue - and this is where it is proved that leaving your charge among the monsters kills them.
console.log('\nTHE ESCORT');
check('an easy escort has hitpoints to lose', NpcType.get(NpcType.getId('templetrek_retired_man_easy')).stats[3], 70);
check('a hard one has fewer', NpcType.get(NpcType.getId('templetrek_child_hard')).stats[3], 30);
check('a medium one is in between', NpcType.get(NpcType.getId('templetrek_man_med')).stats[3], 50);

// A fresh trek, forced into room 1 - snakes. Hunting for a combat room by starting treks and
// abandoning them until one came up was flaky and left state behind; the room is set directly, the
// same way the route 3 evade refusal is tested.
// Tear down whatever the evade test left running FIRST. Forcing a room on top of a live trek puts
// a second escort down and strands the first - which is what the stray villager in this probe's own
// output turned out to be, not a leak in the teardown.
idle(40);
p.closeModal();
H.runProc(p, '[proc,trek_player_died]', [], undefined, true);
freshTrek(1);
idle(40);
p.closeModal();
// the natural room's escort goes before the forced room's is placed
H.runProc(p, '[proc,trek_clear_escort]', [], undefined, true);
let eroom = 1;
const er = ROOMS.find(q => q[0] === eroom)!;
H.setVarBit(p, 'trek_room', eroom);
H.setVarBit(p, 'trek_event_done', 0);
p.clearPendingAction();
p.queueWaypoints([]);
p.teleport(er[1][0], er[1][1], 0);
H.tick(3);
// the event has to be live for the watch to bite, so start it by hand
H.runProc(p, '[proc,trek_place_escort]', [], undefined, true);
H.runProc(p, '[proc,trek_spawn_monsters]', [NpcType.getId('templetrek_snake_1'), 0], undefined, true);
H.tick(3);
console.log(`  (room ${eroom}, snakes, forced)`);
const charge = H.npcNear('templetrek_retired_man_easy', p.x, p.z, 0);
check('the escort is here with full hitpoints', charge ? charge.levels[3] : 0, 70);

// Put them next to one of the monsters and KEEP them there. The escort is on playerfollow, so it
// walks straight back to the player the tick after it is moved - which is why the first version of
// this test saw exactly one bite and concluded the mauling did not work.
const pin = [p.x + 5, p.z + 4];
console.log(`        watch queued: ${H.queued(p, '[queue,trek_escort_watch]').length}`);
// First with an EMPTY pack, so the bite is the only thing moving the number.
H.setVarBit(p, 'templetrek_multi_npc_food_give', 0);
const hpBefore = charge ? charge.levels[3] : 0;
for (let i = 0; i < 40; i++) {
    if (charge) { charge.x = pin[0]; charge.z = pin[1]; }
    H.tick(1);
}
const hpAfter = charge ? charge.levels[3] : 0;
check('left among the monsters, they are mauled', hpAfter < hpBefore, true);
console.log(`        ${hpBefore} -> ${hpAfter} hitpoints over 40 ticks, empty pack`);

// Then with a stocked one and the escort down near half, which is the threshold for eating. The two
// are measured separately because together they cancel: four meals at eight points against ten
// bites at four leaves them no worse off, and that reads as the mauling not working.
H.setVarBit(p, 'templetrek_multi_npc_food_give', 5);
if (charge) charge.levels[3] = 40;
for (let i = 0; i < 40; i++) {
    if (charge) { charge.x = pin[0]; charge.z = pin[1]; }
    H.tick(1);
}
check('and with food in the pack they eat out of it to stay up', H.getVarBit(p, 'templetrek_multi_npc_food_give') < 5, true);
console.log(`        pack: 5 -> ${H.getVarBit(p, 'templetrek_multi_npc_food_give')}, hitpoints ${charge ? charge.levels[3] : -1}`);

// and when it runs out the trek is over
if (charge) charge.levels[3] = 2;
for (let i = 0; i < 120 && H.getVarBit(p, 'trek_route') !== 0; i++) {
    if (charge) { charge.x = pin[0]; charge.z = pin[1]; }
    H.tick(1);
}
for (let i = 0; i < 20 && p.x !== 3480; i++) H.tick(1);
p.closeModal();
check('when they go down the trek fails and you are back in Burgh de Rott',
      [p.x, p.z, H.getVarBit(p, 'trek_route'), H.getVarBit(p, 'trek_escort'), H.getVarBit(p, 'templetrek_npc_point_value')],
      [3480, 3243, 0, 0, 0]);
// Counted around THIS test's escort rather than across the whole map. The forced-state tests above
// strand villagers in other rooms by design, and the map-wide count belongs where it is - after a
// natural trek, where nothing is allowed to be left behind.
let escorts = 0;
const eid = NpcType.getId('templetrek_retired_man_easy');
for (const npc of World.npcs) {
    if (npc && npc.isActive && npc.type === eid &&
        Math.max(Math.abs(npc.x - pin[0]), Math.abs(npc.z - pin[1])) <= 30) escorts++;
}
check('and the escort is gone', escorts, 0);
check('and the pack is emptied with the trek', H.getVarBit(p, 'templetrek_multi_npc_food_give'), 0);

// ------------------------------------------------------------------------------- Abidor Crank
// Forced, because the samaritan room is one room in fourteen and a run that never draws it never
// tests him. Old School: he heals you AND the follower, raises your Defence, and turns rotten food
// into stew - the first pass healed the player and left the villager bleeding.
console.log('\nABIDOR CRANK');
idle(40);
p.closeModal();
H.runProc(p, '[proc,trek_player_died]', [], undefined, true);
freshTrek(1);
idle(40);
p.closeModal();
H.runProc(p, '[proc,trek_clear_escort]', [], undefined, true);
const cr = ROOMS.find(q => q[0] === 14)!;
H.setVarBit(p, 'trek_room', 14);
p.clearPendingAction();
p.queueWaypoints([]);
p.teleport(cr[1][0], cr[1][1], 0);
H.tick(3);
H.runProc(p, '[proc,trek_place_escort]', [], undefined, true);
H.runProc(p, '[label,trek_event_samaritan_start]', [], undefined, true);
H.tick(3);
p.closeModal();
const crank = H.npcNear('templetrek_good_samaritan', p.x, p.z, 0);
check('he is sitting by the path', crank !== null, true);
if (crank) {
    const mine = H.npcNear('templetrek_retired_man_easy', p.x, p.z, p.level);
    if (mine) mine.levels[3] = 10;
    p.levels[3] = 10;
    H.clearInv(p);
    H.give(p, 'rotten_food', 3);
    // let the forced setup settle, and stand right next to him - an op sent while the player is
    // still delayed is dropped, and one sent from out of range waits on a walk that may not finish
    idle(40);
    p.closeModal();
    p.clearPendingAction();
    p.queueWaypoints([]);
    p.teleport(crank.x, crank.z - 1, 0);
    H.tick(3);
    H.opNpc(p, crank, 1);
    const said2 = drive([]);
    for (let i = 0; i < 20; i++) H.tick(1);
    p.closeModal();
    console.log(`        said: ${said2.join(' | ').slice(0, 160) || '(nothing)'}`);
    console.log(`        player hp ${p.levels[3]}, charge hp ${mine ? mine.levels[3] : -1}, rotten ${H.invCount(p, 'rotten_food')}, stew ${H.invCount(p, 'stew')}`);
    check('he feeds you both and turns the rotten food into stew',
          [p.levels[3] > 10, mine ? mine.levels[3] > 10 : false, H.invCount(p, 'rotten_food'), H.invCount(p, 'stew')],
          [true, true, 0, 3]);
}
H.runProc(p, '[proc,trek_player_died]', [], undefined, true);

// the player dying in the swamp tears the trek down too, or they are on one for ever
console.log('\nDYING IN THE SWAMP');
eroom = freshTrek(2);
check('in a trek room, the death hook knows where you are', H.runProc(p, '[proc,in_templetrek]', [packCoord()], undefined, true)[0], 1);
H.runProc(p, '[proc,trek_player_died]', [], undefined, true);
check('the trek is torn down', [H.getVarBit(p, 'trek_route'), H.getVarBit(p, 'trek_escort')], [0, 0]);
p.teleport(3480, 3243, 0);
H.tick(2);
check('and Burgh de Rott is not a trek room', H.runProc(p, '[proc,in_templetrek]', [packCoord()], undefined, true)[0], 0);

// ---------------------------------------------------------------- every room's way out, one by one
// A trek draws its rooms at random, so one run proves five of the fourteen. This asks about all of
// them, and asks by FLOODING rather than by walking: stand nothing on the tile, just take the
// engine's own canTravel and see whether the Continue-trek path is in the same region as the entry.
//
// Driving a player there instead was the first attempt and it was no good - rooms are twenty-five
// tiles long, a walk that far is at the mercy of the tick budget, and it reported rooms as broken
// that a real leg had already walked. The question is reachability, so ask reachability.
console.log("\nEVERY ROOM: the way north is in the same region as the entry tile");
const region = (sx: number, sz: number): Set<string> => {
    const seen = new Set<string>([`${sx},${sz}`]);
    const st: [number, number][] = [[sx, sz]];
    while (st.length) {
        const [cx, cz] = st.pop()!;
        for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            const nx = cx + dx, nz = cz + dz;
            const k = `${nx},${nz}`;
            if (seen.has(k)) continue;
            if (Math.abs(nx - sx) > 45 || Math.abs(nz - sz) > 45) continue;
            if (!canTravel(0, cx, cz, dx, dz, 1, 0, CollisionType.NORMAL)) continue;
            seen.add(k);
            st.push([nx, nz]);
        }
    }
    return seen;
};
// The two puzzle rooms are the exception and are MEANT to be two regions: the bridge room's banks
// have no walking route between them and the vine crossing is a two-tile gap of solid ground. Those
// two are proven by the legs above instead, which cross them the way a player does.
const PUZZLE = new Set([12, 13]);
for (const [n, entry, success, fail, evade] of ROOMS.filter(r => r[0] <= 14)) {
    p.teleport(entry[0], entry[1], 0);
    H.tick(3);
    const reg = region(entry[0], entry[1]);
    const near = (t: [number, number]) => [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dz]) => reg.has(`${t[0] + dx},${t[1] + dz}`));
    const want = !PUZZLE.has(n);
    check(`room ${n} (${EVENT_OF[n]}): entry region ${reg.size} tiles, Continue-trek in it`, near(success), want);
    check(`room ${n}: Escape and Evade in it too`, [near(fail), evade === null ? true : near(evade)], [true, true]);
}

console.log(bad === 0 ? '\nall checks passed' : `\n${bad} FAILED`);
process.exit(bad === 0 ? 0 : 1);
