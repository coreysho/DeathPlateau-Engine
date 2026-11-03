// WHY WILL NPC_ADD NOT PUT A GOLEM IN THESE ROOMS? Ids, standability, and a direct add at each of
// the three spawn tiles.
import * as H from './harness.js';
import World from '#/engine/World.js';
import Npc from '#/engine/entity/Npc.js';
import NpcType from '#/cache/config/NpcType.js';
import { EntityLifeCycle } from '#/engine/entity/EntityLifeCycle.js';
import { canTravel } from '#/engine/GameMap.js';
import { CollisionType } from '#/engine/routefinder/index.js';

await H.boot();

const DIRS: [number, number][] = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1]
];
const standable = (l: number, x: number, z: number) => DIRS.some(([dx, dz]) => canTravel(l, x, z, dx, dz, 1, 0, CollisionType.NORMAL));

const spots: [string, number, number][] = [
    ['grey old 3375,9547', 3375, 9547],
    ['grey new 3376,9547', 3376, 9547],
    ['grey 3377,9547', 3377, 9547],
    ['white 3366,9540', 3366, 9540],
    ['white 3365,9540', 3365, 9540],
    ['black old 3373,9556', 3373, 9556],
    ['black new 3374,9556', 3374, 9556],
    ['black 3375,9556', 3375, 9556]
];

for (const nm of ['elid_golem_black', 'elid_golem_white', 'elid_golem_grey']) {
    const id = NpcType.getId(nm);
    const t = NpcType.get(id);
    console.log(`${nm.padEnd(18)} id ${id}  size ${t.size}  blockwalk ${(t as any).blockwalk}  vislevel ${t.vislevel}`);
}

const id = NpcType.getId('elid_golem_grey');
const type = NpcType.get(id);
for (const [nm, x, z] of spots) {
    const before = [...World.npcs].filter(n => n && n.type === id).length;
    let err = '';
    try {
        const npc = new Npc(0, x, z, type.size, type.size, EntityLifeCycle.DESPAWN, World.getNextNid(), id, type.blockwalk);
        World.addNpc(npc, 500);
    } catch (e) {
        err = String(e).slice(0, 80);
    }
    H.tick(2);
    const now = [...World.npcs].filter(n => n && n.type === id);
    console.log(`  ${nm.padEnd(22)} standable ${standable(0, x, z)}  before ${before} now ${now.length}${err ? '  ERR ' + err : ''}`);
}

// EXITS, because the engine's own timers keep the event loop alive for ever otherwise. This file
// prints a report rather than asserting anything, so it had no process.exit at all and simply hung
// once it had finished printing: ten minutes of wall clock using 0.4 seconds of CPU, which is a
// process waiting rather than working. tools/sim/sweep.sh runs every sim with a cap of 5400s, so
// fourteen files in this shape could spend the better part of a day being killed one by one.
//
// The nightly never noticed because its filter only runs a sim that CAN report a verdict
// (`grep -qE 'process\.exit\([^0-9)]'`), and a file with no exit at all does not match.
process.exit(0);
