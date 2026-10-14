// THE TEMPLE OF LIGHT HAS A COLOUR NOW. Every light varbit in the building is three bits wide and
// the cache's pillars and beams are multilocs with seven coloured children; the first version of
// the content wrote the literal 1 into every segment it lit, so the corridors drew red and the
// pillars white and no crystal could change either.
//
// This drives the real triggers on the real map: the chests pay out, a crystal goes into a pillar
// socket, the beam takes its colour, two crystals mix the way the walkthrough says they do, a
// crystal that leaves nothing kills the beam, the doors of light open to their own colour and shut
// again when it moves, and the lever puts every fitting back in your hands.
//
//   npx tsx tools/sim/templelight.ts
import * as H from './harness.js';
import Player from '#/engine/entity/Player.js';
import LocType from '#/cache/config/LocType.js';
import VarBitType from '#/cache/config/VarBitType.js';
import ScriptState from '#/engine/script/ScriptState.js';
import Component from '#/cache/config/Component.js';
import { isFlagged, findPathToLoc } from '#/engine/GameMap.js';
import { CollisionFlag } from '#/engine/routefinder/index.js';
import World from '#/engine/World.js';
import ObjType from '#/cache/config/ObjType.js';
import InvType from '#/cache/config/InvType.js';
import ServerTriggerType from '#/engine/script/ServerTriggerType.js';
import { Interaction } from '#/engine/entity/Interaction.js';

await H.boot();

const R = { ok: 0, bad: 0 };
const check = (what: string, got: unknown, want: unknown) => {
    const pass = JSON.stringify(got) === JSON.stringify(want);
    if (pass) R.ok++;
    else R.bad++;
    console.log(`  ${pass ? 'ok  ' : 'FAIL'} ${what}: ${JSON.stringify(got)}${pass ? '' : `   (want ${JSON.stringify(want)})`}`);
};
const v = (p: Player, n: string) => (VarBitType.getByName(n) ? H.getVarBit(p, n) : H.getVar(p, n));
const set = (p: Player, n: string, val: number) => (VarBitType.getByName(n) ? H.setVarBit(p, n, val) : H.setVar(p, n, val));
const B = [29 * 64, 72 * 64];
const T = (x: number, z: number) => [B[0] + x, B[1] + z] as [number, number];
const standing = (p: Player) => !isFlagged(p.x, p.z, p.level, CollisionFlag.WALK_BLOCKED);

function settle(p: Player, picks: number[] = [], max = 200) {
    let idle = 0;
    for (let g = 0; g < max; g++) {
        const s = p.activeScript;
        if (s && s.execution === ScriptState.PAUSEBUTTON) {
            idle = 0;
            // the pillar's Search is a chat menu now: a quarter turn, a tilt up, a tilt down or
            // take it out, and then which beam the tilt lifts
            const names = p.resumeButtons.map((id: number) => Component.get(id).comName ?? '');
            const open = p.modalChat === -1 ? '' : Component.get(p.modalChat).comName ?? '';
            const multi = open.startsWith('multi') ? names.find((n: string) => n.startsWith(open + ':')) : null;
            if (multi) {
                const pick = picks.shift();
                if (pick === undefined) throw new Error('unexpected menu: ' + names.join(','));
                H.choose(p, `${multi.split(':')[0]}:com_${pick}`);
                continue;
            }
            p.executeScript(s, true, true);
            continue;
        }
        H.tick(1);
        if (!p.activeScript && !p.target && !p.delayed && p.queue.head() === null) {
            if (++idle >= 3) break;
        } else idle = 0;
    }
    if (picks.length) throw new Error('menus not reached: ' + picks.join(','));
    p.closeModal();
}

const p: any = H.makePlayer('templelight', ...T(60, 31));
H.tick(1);
p.teleport(...T(60, 31), 0);
H.tick(1);
H.maxOut(p);
H.clearInv(p);
H.tick(2);
p.closeModal();

const opLoc = (x: number, z: number, name: string, op = 1, picks: number[] = []) => {
    H.opLoc(p, x, z, name, op);
    settle(p, picks);
};
// Using an item on a loc is its own packet (APLOCU) and the harness has no helper for it, so this
// is OpLocUHandler's own setup, the same few lines audit2.ts uses.
function slotOf(objName: string) {
    const id = ObjType.getId(objName);
    const inv = p.getInventory(InvType.INV)!;
    for (let i = 0; i < inv.capacity; i++) if (inv.get(i)?.id === id) return i;
    throw new Error('not carrying ' + objName);
}
const locAt = (x: number, z: number, level: number, name: string) => {
    const loc = World.getLoc(x, z, level, LocType.getId(name));
    if (!loc) throw new Error(`no ${name} at ${x},${z},${level}`);
    return loc;
};
const useOn = (obj: string, x: number, z: number, name: string) => {
    const loc = locAt(x, z, p.level, name);
    p.clearPendingAction();
    p.lastUseItem = ObjType.getId(obj);
    p.lastUseSlot = slotOf(obj);
    p.queueWaypoints(findPathToLoc(p.level, p.x, p.z, loc.x, loc.z, p.width, loc.width, loc.length, loc.angle, loc.shape, LocType.get(loc.type).forceapproach));
    p.setInteraction(Interaction.ENGINE, loc, ServerTriggerType.APLOCU);
    (p as unknown as { opcalled: boolean }).opcalled = true;
    settle(p);
};
const seg = (n: string) => v(p, 'mourning_light_temple_' + n);

// ----------------------------------------------------------------- the way in, and the fittings
console.log('');
console.log('THE WAY IN');
set(p, 'mourning_quest', 20);          // Part I complete
set(p, 'mourning_quest_main', 10);     // ^mt_arianwyn: he has explained the temple
p.teleport(2311, 9793, 0);
H.tick(1);
opLoc(2311, 9792, 'cavewalltunnel_to_temple');
check('through the tunnel: the east corridor, standing on an open tile, stage inside',
    [p.x - B[0], p.z - B[1], p.level, standing(p), v(p, 'mourning_quest_main')], [60, 31, 0, true, 20]);

console.log('');
console.log('THE COLLECTOR, WHICH IS WHERE THE TEMPLE KEPT ITS OWN FITTINGS');
// Every chest in the building is behind a door of light, so the first mirrors cannot be chest
// mirrors: the cache's tray holds four of them and the orange crystal, which is the yellow one.
check('the tray was seeded on the way in',
    [v(p, 'mourning_temple_mirrors_reset_tray'), v(p, 'mourning_temple_orange_crystal_reset_tray')], [4, 1]);
p.teleport(...T(56, 31), 1);
H.tick(1);
check('  there is a tile to stand on in front of them', standing(p), true);
opLoc(...T(58, 31), 'mourning_temple_light_wall_collector');
check('Collect hands over four mirrors, the yellow crystal and the colour wheel',
    [H.invCount(p, 'mourning_mirror'), H.invCount(p, 'mourning_crystal_yellow'), H.invCount(p, 'mourning_colour_wheel')],
    [4, 1, 1]);
check('  and the tray is empty', [v(p, 'mourning_temple_mirrors_reset_tray'), v(p, 'mourning_temple_orange_crystal_reset_tray')], [0, 0]);
opLoc(...T(58, 31), 'mourning_temple_light_wall_collector');
check('  collecting again gives nothing', H.invCount(p, 'mourning_mirror'), 4);

console.log('');
console.log('THE CHESTS, AND THE CHAIN THE DOORS MAKE OF THEM');
// Measured off the collision map: floor 1 rooms 16 and 1 are yellow, room 13 is cyan, floor 2 room
// 16 is blue and floor 2 room 4 is magenta. So a yellow room holds the cyan crystal, cyan holds the
// blue, blue holds the red - and the test walks that chain by teleporting between the rooms, which
// is what tools/sim/templerooms.ts says a player has to earn.
p.teleport(...T(24, 52), 0);
H.tick(1);
opLoc(...T(24, 51), 'mourning_temple_light_parts_5_closed');
check('the chest in a yellow room opens (the loc swaps)',
    World.getLoc(...T(24, 51), 0, LocType.getId('mourning_temple_light_parts_5_open')) !== null, true);
opLoc(...T(24, 51), 'mourning_temple_light_parts_5_open');
check('and pays out two mirrors and the CYAN crystal',
    [H.invCount(p, 'mourning_mirror'), H.invCount(p, 'mourning_crystal_cyan')], [6, 1]);
check('  the parts bit records that this chest is emptied', v(p, 'mourning_temple_parts_5'), 1);
opLoc(...T(24, 51), 'mourning_temple_light_parts_5_open');
check('  searching it again gives nothing', H.invCount(p, 'mourning_mirror'), 6);
check('  and the quest moved on', v(p, 'mourning_quest_main'), 30);
p.teleport(...T(3, 5), 0);
H.tick(1);
opLoc(...T(2, 5), 'mourning_temple_light_parts_4_closed');
opLoc(...T(2, 5), 'mourning_temple_light_parts_4_open');
check('the cyan room: two more mirrors and the BLUE crystal',
    [H.invCount(p, 'mourning_mirror'), H.invCount(p, 'mourning_crystal_blue')], [8, 1]);
p.teleport(...T(60, 5), 1);
H.tick(1);
opLoc(...T(61, 5), 'mourning_temple_light_parts_2_closed');
opLoc(...T(61, 5), 'mourning_temple_light_parts_2_open');
check('the blue room: two more mirrors and the RED crystal',
    [H.invCount(p, 'mourning_mirror'), H.invCount(p, 'mourning_crystal_red')], [10, 1]);

// ----------------------------------------------------------------- the route out of the wall
console.log('');
console.log('THE ROUTE OUT OF THE WEST WALL: FIVE MIRRORS, TWO OF THEM TILTED');
// tools/sim/templesolve.ts reads this out of the graph itself: pillar 35 flat, south to west;
// straight through 34; 33 flat, west to north; 28 flat, north to east; then 29 TILTED, east to
// down - which is the shaft - and 6 TILTED, down to west, which is the hole in the wall. The shaft
// stopped being a free chute when the third dimension went in: a beam only leaves a corridor for it
// if a tilted mirror puts it there, which is what the walkthrough does at every shaft.
//
// Pillar 35 is floor 3 room 16 at (59,5); 34 is room 15 at (42,5); 33 is room 13 at (4,5); 28 is
// room 8 at (4,31); 29 is the shaft head, floor 3 pillar a, at (25,31); 6 is the shaft foot, floor
// 1 pillar b, on the same tile two floors down.
const putMirror = (lx: number, lz: number, lvl: number, name: string, turns: number) => {
    p.teleport(...T(lx, lz + 1), lvl);
    H.tick(1);
    useOn('mourning_mirror', ...T(lx, lz), name);
    for (let i = 0; i < turns; i++) useOn('mourning_mirror', ...T(lx, lz), name);
};
const tiltMirror = (lx: number, lz: number, lvl: number, name: string, down: boolean, dir: number) => {
    p.teleport(...T(lx, lz + 1), lvl);
    H.tick(1);
    useOn('mourning_mirror', ...T(lx, lz), name);
    opLoc(...T(lx, lz), name, 1, [down ? 3 : 2, dir]);
};
putMirror(59, 5, 2, 'mourning_temple_pillar_3_16', 0);
check('one mirror in the entry pillar lights the top-floor corridor white', seg('3_15_16'), 7);
putMirror(4, 5, 2, 'mourning_temple_pillar_3_13', 1);
check('  and on through room 15 to room 13, where it turns north', seg('3_13_15'), 7);
putMirror(4, 31, 2, 'mourning_temple_pillar_3_8', 2);
// room 13 to room 8 is the segment 3_8_13; 3_1_8 is the one NORTH of room 8, which this route
// does not use and the mixing test below does
check('  north to room 8, where it turns east towards the shaft', [seg('3_8_13'), seg('3_8_east')], [7, 7]);
tiltMirror(25, 31, 2, 'mourning_temple_pillar_3_a', true, 2);
check('a TILTED mirror at the shaft head sends the beam down it', seg('1_b_east') >= 0, true);
tiltMirror(25, 31, 0, 'mourning_temple_pillar_1_b', false, 2);
check('and a tilted mirror at the foot sends it west, out of the hole: stage lit',
    [v(p, 'mourning_quest_main'), seg('1_b_west'), seg('1_d_west')], [40, 7, 7]);
check('  five mirrors, and four left in hand', H.invCount(p, 'mourning_mirror'), 5);

// ----------------------------------------------------------------- colour, along that route
console.log('');
console.log('ONE CRYSTAL, IN THE SOCKET THE ROUTE LEAVES SPARE');
// Room 15 is the pillar the beam goes straight through, so its socket is free for a crystal - and
// the solver counts that, because a route that turns a corner at every pillar it touches cannot be
// coloured at all, however few mirrors it uses.
p.teleport(...T(42, 6), 2);
H.tick(1);
useOn('mourning_crystal_yellow', ...T(42, 5), 'mourning_temple_pillar_3_15');
check('the yellow crystal goes in the spare socket', H.invCount(p, 'mourning_crystal_yellow'), 0);
check('  before it white, after it yellow, all the way out of the wall',
    [seg('3_15_16'), seg('3_13_15'), seg('1_b_west')], [7, 2, 2]);
check('  and the light is still getting out', v(p, 'mourning_quest_main'), 40);

console.log('');
console.log('TWO CRYSTALS: THE MIXING THE WALKTHROUGH DESCRIBES');
// A second spare socket: room 8 turns the beam east with a mirror, but the beam also has a
// straight-on edge north out of room 8, so taking that mirror out and letting it run north gives a
// second pass-through - 34 and 28 - with a segment beyond both of them to read the colour off.
p.teleport(...T(4, 32), 2);
H.tick(1);
opLoc(...T(4, 31), 'mourning_temple_pillar_3_8', 1, [4]);      // take the mirror back out
check('the mirror out of room 8: the beam runs straight north instead', seg('3_1_8'), 2);
useOn('mourning_crystal_cyan', ...T(4, 31), 'mourning_temple_pillar_3_8');
check('yellow and then cyan leaves GREEN', seg('3_1_8'), 3);
opLoc(...T(4, 31), 'mourning_temple_pillar_3_8');               // Search: take the cyan back
useOn('mourning_crystal_blue', ...T(4, 31), 'mourning_temple_pillar_3_8');
check('yellow and then BLUE leaves nothing at all: the beam dies at that pillar', seg('3_1_8'), 0);
opLoc(...T(4, 31), 'mourning_temple_pillar_3_8');
check('  and taking it out brings the yellow beam back', [seg('3_1_8'), H.invCount(p, 'mourning_crystal_blue')], [2, 1]);

// ----------------------------------------------------------------- the doors
console.log('');
console.log('THE DOORS OF LIGHT');
// ~m2_doors is the generated table: each door reads the segment it stands in and opens only to its
// own colour. Driving it by hand on one segment at a time is the only way to test all fourteen
// without solving the whole temple five times over.
const doors = (segName: string, colour: number) => {
    set(p, 'mourning_light_temple_' + segName, colour);
    H.runProc(p, '[proc,m2_doors]', [], undefined, true);
};
doors('1_1_south', 2);
check('yellow light in the floor 1 room 1 doorway opens its yellow door', v(p, 'mourning_door_1_1_south'), 1);
doors('1_1_south', 4);
check('  cyan light in the same doorway does not', v(p, 'mourning_door_1_1_south'), 0);
doors('1_13_east', 4);
check('cyan light opens the cyan door out of room 13', v(p, 'mourning_door_1_13_east'), 1);
doors('1_13_east', 7);
check('  white light does not: a door of light wants its own colour', v(p, 'mourning_door_1_13_east'), 0);
doors('2_16_north', 5);
check('blue light opens the blue door on floor 2', v(p, 'mourning_door_2_16_north'), 1);
doors('1_14_east', 6);
check('magenta light would open the magenta door - and no crystal in this temple can make magenta',
    v(p, 'mourning_door_1_16_west'), 1);
doors('1_d_west', 2);
check('the black door to the Death Altar takes any light at all', v(p, 'mourning_door_1_c'), 1);
doors('1_d_west', 0);
check('  and shuts again when the beam goes', v(p, 'mourning_door_1_c'), 0);

console.log('');
console.log('WALKING THROUGH ONE');
set(p, 'mourning_light_temple_1_13_east', 0);
H.runProc(p, '[proc,m2_doors]', [], undefined, true);
p.teleport(...T(6, 5), 0);
H.tick(1);
const before = [p.x - B[0], p.z - B[1]];
opLoc(...T(7, 5), 'mourning_door_1_13_east');
check('a shut door does not let you past', [p.x - B[0], p.z - B[1]], before);
set(p, 'mourning_light_temple_1_13_east', 4);
H.runProc(p, '[proc,m2_doors]', [], undefined, true);
opLoc(...T(7, 5), 'mourning_door_1_13_east');
check('and a lit one does', [p.x - B[0], p.z - B[1], standing(p)], [8, 5, true]);

// ----------------------------------------------------------------- the lever
console.log('');
console.log('THE LEVER, AND BACK TO THE COLLECTOR');
const held = () => [H.invCount(p, 'mourning_mirror'), H.invCount(p, 'mourning_crystal_yellow'), H.invCount(p, 'mourning_crystal_blue')];
// ten mirrors came out of the collector and three chests; five are in sockets, so four are in
// hand. The yellow crystal is in the spare socket at room 15 and the blue is in hand.
// ten mirrors came out of the collector and three chests. Five went into the route and the mixing
// test took one back out of room 8, so four are in sockets and six are in hand; the yellow crystal
// is in the spare socket at room 15 and the blue is in hand.
check('before the lever: six mirrors in hand, four in sockets, one crystal placed', held(), [6, 0, 1]);
p.teleport(...T(56, 31), 1);
H.tick(1);
opLoc(...T(57, 31), 'mourning_temple_light_wall_lever');
check('Pull takes every fitting out of its socket and puts it in the tray',
    [v(p, 'mourning_temple_mirrors_reset_tray'), v(p, 'mourning_temple_orange_crystal_reset_tray')], [4, 1]);
check('  the temple goes dark', ['3_15_16', '3_13_15', '1_b_west'].map(seg), [0, 0, 0]);
check('  and so do the doors', [v(p, 'mourning_door_1_13_east'), v(p, 'mourning_door_1_1_south')], [0, 0]);
check('  nothing was handed back yet', held(), [6, 0, 1]);
opLoc(...T(58, 31), 'mourning_temple_light_wall_collector');
check('and Collect hands all of it back', held(), [10, 1, 1]);

console.log('');
console.log(`${R.ok} ok, ${R.bad} failed`);
process.exit(R.bad ? 1 : 0);
