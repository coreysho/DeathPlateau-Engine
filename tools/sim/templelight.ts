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

function settle(p: Player, max = 200) {
    let idle = 0;
    for (let g = 0; g < max; g++) {
        const s = p.activeScript;
        if (s && s.execution === ScriptState.PAUSEBUTTON) {
            p.executeScript(s, true, true);
            idle = 0;
            continue;
        }
        H.tick(1);
        if (!p.activeScript && !p.target && !p.delayed && p.queue.head() === null) {
            if (++idle >= 3) break;
        } else idle = 0;
    }
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

const opLoc = (x: number, z: number, name: string, op = 1) => {
    H.opLoc(p, x, z, name, op);
    settle(p);
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

// ----------------------------------------------------------------- the route, in white
console.log('');
console.log('THE OLD ROUTE, STILL WHITE');
p.teleport(...T(59, 5), 2);
H.tick(1);
const seg = (n: string) => v(p, 'mourning_light_temple_' + n);
// pillar 35 (floor 3 room 16) is where the light comes in, travelling south, and it has no south
// corridor - so the first mirror is what starts the beam moving at all.
useOn('mourning_mirror', ...T(59, 5), 'mourning_temple_pillar_3_16');     // rotation 0: south -> west
check('a mirror in the entry pillar: the mirror leaves your hands', H.invCount(p, 'mourning_mirror'), 9);
p.teleport(...T(42, 6), 2);
H.tick(1);
useOn('mourning_mirror', ...T(42, 5), 'mourning_temple_pillar_3_15');     // rotation 0
useOn('mourning_mirror', ...T(42, 5), 'mourning_temple_pillar_3_15');     // a quarter turn: west -> north
p.teleport(...T(42, 21), 2);
H.tick(1);
for (let i = 0; i < 4; i++) useOn('mourning_mirror', ...T(42, 20), 'mourning_temple_pillar_3_11'); // rot 3
check('three mirrors send the light down the shaft and out of the west wall',
    [v(p, 'mourning_quest_main'), seg('1_b_west')], [40, 7]);
check('  and every segment on the way is WHITE, not the old hardcoded red',
    ['3_15_16', '3_11_15', '3_10_11', '3_10_west', '1_b_west', '1_d_west'].map(seg), [7, 7, 7, 7, 7, 7]);

// ----------------------------------------------------------------- colour
console.log('');
console.log('ONE CRYSTAL');
p.teleport(...T(31, 21), 2);
H.tick(1);
useOn('mourning_crystal_yellow', ...T(31, 20), 'mourning_temple_pillar_3_10');
check('the yellow crystal goes into the pass-through pillar', H.invCount(p, 'mourning_crystal_yellow'), 0);
check('  before it the light is white, after it the light is yellow',
    [seg('3_10_11'), seg('3_10_west'), seg('1_b_west'), seg('1_d_west')], [7, 2, 2, 2]);
check('  and the pillar itself draws yellow', v(p, 'mourning_light_temple_3_10_up'), 2);

console.log('');
console.log('TWO CRYSTALS: THE MIXING THE WALKTHROUGH DESCRIBES');
p.teleport(...T(25, 31), 0);
H.tick(1);
useOn('mourning_crystal_cyan', ...T(25, 31), 'mourning_temple_pillar_1_b');
check('cyan in the pillar at the foot of the shaft - which the first trace skipped entirely',
    H.invCount(p, 'mourning_crystal_cyan'), 0);
check('  yellow and then cyan leaves GREEN', [seg('1_b_west'), seg('1_d_west')], [3, 3]);
check('  and the light still gets out of the hole', v(p, 'mourning_quest_main'), 40);

console.log('');
console.log('A CRYSTAL THAT LEAVES NOTHING');
opLoc(...T(25, 31), 'mourning_temple_pillar_1_b');   // Search: take the cyan back out
check('the cyan comes back out of the socket', H.invCount(p, 'mourning_crystal_cyan'), 1);
useOn('mourning_crystal_red', ...T(25, 31), 'mourning_temple_pillar_1_b');
check('yellow light through a red crystal keeps the red the two have in common', seg('1_b_west'), 1);
opLoc(...T(25, 31), 'mourning_temple_pillar_1_b');
useOn('mourning_crystal_blue', ...T(25, 31), 'mourning_temple_pillar_1_b');
check('yellow light through a BLUE crystal has nothing left: the beam dies at that pillar',
    [seg('1_b_west'), seg('1_d_west')], [0, 0]);
opLoc(...T(25, 31), 'mourning_temple_pillar_1_b');
check('  and taking it out brings the yellow beam back', [seg('1_b_west'), H.invCount(p, 'mourning_crystal_blue')], [2, 1]);

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
// ten mirrors came out of the collector and three chests; three are in sockets, so seven are in
// hand. The yellow crystal is in pillar 3_10 and the blue is in hand.
check('before the lever: seven mirrors in hand, three in sockets', held(), [7, 0, 1]);
p.teleport(...T(56, 31), 1);
H.tick(1);
opLoc(...T(57, 31), 'mourning_temple_light_wall_lever');
check('Pull takes every fitting out of its socket and puts it in the tray',
    [v(p, 'mourning_temple_mirrors_reset_tray'), v(p, 'mourning_temple_orange_crystal_reset_tray')], [3, 1]);
check('  the temple goes dark', ['3_15_16', '3_10_west', '1_b_west'].map(seg), [0, 0, 0]);
check('  and so do the doors', [v(p, 'mourning_door_1_13_east'), v(p, 'mourning_door_1_1_south')], [0, 0]);
check('  nothing was handed back yet', held(), [7, 0, 1]);
opLoc(...T(58, 31), 'mourning_temple_light_wall_collector');
check('and Collect hands all of it back', held(), [10, 1, 1]);

console.log('');
console.log(`${R.ok} ok, ${R.bad} failed`);
process.exit(R.bad ? 1 : 0);
