// ::sz and the staff zone, against the booted world.
//
// The square is content's (content/tools/genstaffzone.py builds maps/m22_56.jm2 and registers it in
// pack/map.pack); the command and the rank are this repository's. Three things can each be right on
// their own and still leave the zone broken, so each is asked of the running server rather than of
// the generator that wrote the file:
//
//   THE SQUARE    is it in the build at all, is it walkable, and does the plateau's rock line hold?
//                 A .jm2 with no ID line in pack/map.pack is not an error - it is silently skipped,
//                 and ::sz lands in a black void with no collision. That is how this file began.
//   THE CELLS     a cage whose door is shut must not be routable from outside. The generator's own
//                 flood fill says so about its model of the map; this asks the engine's router.
//   THE GATE      who may type ::sz, who is refused and still cannot get in another way.
//
//   BUILD_SRC_DIR=../content npx tsx tools/sim/staffzone.ts
import * as H from './harness.js';
import { check, R, player, at, mark, mesOf, mesSince, connected, walkable, locsNamed, findNpc, op } from './a1lib.js';

import { canTravel } from '#/engine/GameMap.js';
import { CollisionType } from '#/engine/routefinder/index.js';

import ClientCheat from '#/network/game/client/model/ClientCheat.js';
import ClientCheatHandler from '#/network/game/client/handler/ClientCheatHandler.js';
import ScriptProvider from '#/engine/script/ScriptProvider.js';
import Player from '#/engine/entity/Player.js';

const BASE_X = 22 * 64; // 1408
const BASE_Z = 56 * 64; // 3584
const T = (x: number, z: number): [number, number] => [BASE_X + x, BASE_Z + z];

const ARRIVE = T(32, 32); // 0_22_56_32_32, the camp
const EDGEVILLE = [3086, 3491]; // 0_48_54_14_35 - ::home, and where the login guard puts people
const WILDERNESS = [3093, 3524]; // just north of the Edgeville ditch

// Out in the open, so they are reachable from the arrival tile on foot and nothing stands between.
const DISTRICTS: [string, [number, number]][] = [
    ['camp', ARRIVE],
    ['boss pad', T(31, 15)],
    ['sparring ring', T(46, 16)],
    ['dummy row', T(15, 21)]
];
// The two buildings are shut, which is what a door is for: the tile outside the door, the door's
// own tile, and a tile deep inside the room.
const ROOMS: [string, [number, number], [number, number], [number, number]][] = [
    ['office', T(18, 37), T(18, 38), T(13, 48)],
    ['vault', T(44, 37), T(44, 38), T(45, 45)]
];
const CELLS: [number, number][] = [T(21, 41), T(21, 46)];
const RING = { x0: BASE_X + 42, x1: BASE_X + 50, z0: BASE_Z + 12, z1: BASE_Z + 20 };

await H.boot();

const handler = new ClientCheatHandler();
const run = (p: Player, text: string): string[] => {
    const from = mark();
    handler.handle(new ClientCheat(text), p);
    H.tick(2);
    return mesSince(p, from);
};
const rank = (p: Player, level: number) => {
    p.staffModLevel = level;
    return p;
};
/**
 * A staff member STANDING IN THE ZONE: logged in outside it, given the rank, and only then put
 * there.
 *
 * Not a convenience - the login guard is why. a1lib's player() logs in at the tile you name and the
 * [login,_] trigger runs there and then, before any line of a test can set a rank, so a test player
 * created on these tiles is moved to Edgeville by ~staffzone_login before it does anything. Every
 * check below that wants somebody inside the zone was reading Edgeville instead, and the first
 * reading of it was that the doors would not open ("I can't reach that!").
 */
const staff = (name: string, level: number, x: number, z: number): Player => {
    const p = rank(player(name, 3200, 3200), level);
    p.teleport(x, z, 0);
    H.tick(1);
    return p;
};

console.log('\nTHE SQUARE IS IN THE BUILD, AND WALKABLE');
check('content has the teleport', ScriptProvider.getByName('[proc,staffzone_teleport]') !== null, true);
check('content has the login guard', ScriptProvider.getByName('[proc,staffzone_login]') !== null, true);
check('the arrival tile is walkable', walkable(0, ARRIVE[0], ARRIVE[1]), true);
for (const [name, [x, z]] of DISTRICTS) {
    check(`${name} is reachable from the arrival tile`, connected(0, ARRIVE[0], ARRIVE[1], x, z), true);
}
check('the rock line outside the plateau is not walkable', [walkable(0, ...T(4, 32)), walkable(0, ...T(32, 4)), walkable(0, ...T(59, 32))], [false, false, false]);
// walkable() asks the collision map, and the void beyond a map square has no collision allocated -
// it reads as "not blocked" because nothing is there to block. So the question worth asking is the
// one a player can act on: can you WALK off the plateau? The blocked ring is eight tiles deep.
check('you cannot walk off the plateau', [connected(0, ARRIVE[0], ARRIVE[1], BASE_X + 1, BASE_Z + 32), connected(0, ARRIVE[0], ARRIVE[1], BASE_X + 70, BASE_Z + 32)], [false, false]);

console.log('\nTHE CELLS HOLD');
for (let i = 0; i < CELLS.length; i++) {
    const [x, z] = CELLS[i];
    check(`cell ${i + 1} is somewhere you can stand`, walkable(0, x, z), true);
    check(`cell ${i + 1} cannot be walked into with the door shut`, connected(0, ARRIVE[0], ARRIVE[1], x, z), false);
}
check('each cell has its door', locsNamed('loc_1513', ...T(19, 39), ...T(23, 48), [0]).length, 2);

console.log('\nTHE TWO BUILDINGS OPEN');
for (const [name, outside, door, inside] of ROOMS) {
    check(`the ${name} door is reachable from the camp`, connected(0, ARRIVE[0], ARRIVE[1], outside[0], outside[1]), true);
    check(`the ${name} is shut until it is opened`, connected(0, outside[0], outside[1], inside[0], inside[1]), false);
    const doorman = staff(`sz${name}`, 2, outside[0], outside[1]);
    op(doorman, door[0], door[1], 'loc_1513');
    H.tick(2);
    check('and open once it is', connected(0, outside[0], outside[1], inside[0], inside[1]), true);
}

console.log('\nTHE SPARRING RING IS RAILED, WITH THE CORNERS OPEN');
// locsNamed cannot see a railing or a brick wall: GameMap only puts a loc in a zone when its type is
// ACTIVE, and scenery with no op is not - so counting them proves nothing and these ask the
// collision map instead, which is what a player walks into.
check('the fence refuses a step over it', [canTravel(0, RING.x0 + 4, RING.z0, 0, -1, 1, 0, CollisionType.NORMAL), canTravel(0, RING.x0, RING.z0 + 4, -1, 0, 1, 0, CollisionType.NORMAL)], [false, false]);
check('the corner is the way in', connected(0, ARRIVE[0], ARRIVE[1], RING.x0 + 4, RING.z0 + 4), true);

console.log('\nWHAT IS IN IT');
const SQ: [number, number, number, number] = [BASE_X, BASE_Z, BASE_X + 63, BASE_Z + 63];
for (const [name, want] of [
    ['altar', 1],
    ['bankbooth', 4],
    ['sworddummy', 5]
] as [string, number][]) {
    check(`${name}`, locsNamed(name, ...SQ, [0]).length, want);
}
const mod = staff('szmod', 2, ARRIVE[0], ARRIVE[1]);
for (const npc of ['banker1', 'banker2', 'generalshopkeeper5', 'generalassistant5']) {
    let there = false;
    try {
        there = findNpc(npc, mod, true) !== null;
    } catch {
        there = false;
    }
    check(`${npc} is spawned in the zone`, there, true);
}

console.log('\n::sz - WHO GETS IN');
const plain = player('szplain', 3200, 3200);
check('a player with no rank types ::sz and stays put', run(plain, 'sz') && at(plain), [3200, 3200, 0]);

const mod2 = rank(player('szmod2', 3200, 3200), 2);
run(mod2, 'sz');
check('a moderator lands on the arrival tile', at(mod2), [ARRIVE[0], ARRIVE[1], 0]);

console.log('\nAND HELPERS, WHO ARE NOT A RANK');
// A Helper is staffModLevel 0 with a flag set, so every check written against staffmodlevel reads
// them as an ordinary player. Both halves of "staff only" have to make the same exception, and a
// test that only drove the command would miss the one that puts them back out again at login.
const help = player('szhelper', 3200, 3200);
help.helper = true;
run(help, 'sz');
check('a Helper lands on the arrival tile', at(help), [ARRIVE[0], ARRIVE[1], 0]);
check('and their staff level is still 0', help.staffModLevel, 0);

const helpIn = player('szhelper2', 3200, 3200);
helpIn.helper = true;
helpIn.teleport(ARRIVE[0], ARRIVE[1], 0);
H.tick(1);
const hfrom = mark();
H.runProc(helpIn, '[proc,staffzone_login]', [], undefined, true);
H.tick(1);
check('a Helper logging in there is left alone', at(helpIn), [ARRIVE[0], ARRIVE[1], 0]);
check('and told nothing', mesSince(helpIn, hfrom), []);

console.log('\n::sz IS NOT A WAY OUT OF A FIGHT');
check('the test tile really is Wilderness', walkable(0, WILDERNESS[0], WILDERNESS[1]), true);
const wild = rank(player('szwild', WILDERNESS[0], WILDERNESS[1]), 2);
const refused = run(wild, 'sz');
check(
    'a moderator in the Wilderness is refused',
    refused.some(m => m.includes("can't teleport to the staff zone from the Wilderness")),
    true
);
check('and has not moved', at(wild), [WILDERNESS[0], WILDERNESS[1], 0]);
const admin = rank(player('szadmin', WILDERNESS[0], WILDERNESS[1]), 3);
run(admin, 'sz');
check('an administrator is not held to it', at(admin), [ARRIVE[0], ARRIVE[1], 0]);

console.log('\n::home IS THE WAY OUT');
run(mod2, 'home');
check('a moderator leaves the zone by ::home', at(mod2), [EDGEVILLE[0], EDGEVILLE[1], 0]);

console.log('\nTHE LOGIN GUARD - ::teleother AND A RANK TAKEN AWAY');
// No proc call here: this is the real [login,_] trigger, running where the player logged in.
const guest = player('szguest', ARRIVE[0], ARRIVE[1]);
check('a player logging in inside the zone is put in Edgeville', at(guest), [EDGEVILLE[0], EDGEVILLE[1], 0]);
check(
    'and told why',
    mesOf(guest).some(m => m.includes('staff-only area')),
    true
);

const stay = staff('szstay', 2, ARRIVE[0], ARRIVE[1]);
const from = mark();
H.runProc(stay, '[proc,staffzone_login]', [], undefined, true);
H.tick(1);
check('a moderator logging in there stays', at(stay), [ARRIVE[0], ARRIVE[1], 0]);
check('and is told nothing', mesSince(stay, from), []);

console.log(`\n${R.ok} ok, ${R.bad} FAIL`);
process.exit(R.bad ? 1 : 0);
