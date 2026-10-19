// Which door shuts each chest in? With the doors locked to a colour, a chest behind a door no
// crystal in the building can open is a chest nobody can ever reach - so every chest's room has to
// be bordered by a door whose colour can actually be made.
import * as H from './harness.js';
import World from '#/engine/World.js';
import LocType from '#/cache/config/LocType.js';
import { canTravel } from '#/engine/GameMap.js';
import { CollisionType } from '#/engine/routefinder/index.js';

await H.boot();
const KEY = (x: number, z: number) => x * 10000 + z;
function reach(sx: number, sz: number, lvl: number, limit = 60000) {
    const seen = new Set<number>([KEY(sx, sz)]);
    const q: [number, number][] = [[sx, sz]];
    while (q.length && seen.size < limit) {
        const [x, z] = q.shift()!;
        for (const [dx, dz] of [
            [1, 0],
            [-1, 0],
            [0, 1],
            [0, -1]
        ] as const) {
            if (seen.has(KEY(x + dx, z + dz))) continue;
            if (!canTravel(lvl, x, z, dx, dz, 1, 1, CollisionType.NORMAL)) continue;
            seen.add(KEY(x + dx, z + dz));
            q.push([x + dx, z + dz]);
        }
    }
    return seen;
}
// every loc on the temple square, by tile and level
const locs = new Map<string, string[]>();
for (let lvl = 0; lvl < 3; lvl++) {
    for (let zx = 0; zx < 8; zx++) {
        for (let zz = 0; zz < 8; zz++) {
            const zone = World.gameMap.getZone(1856 + (zx << 3), 4608 + (zz << 3), lvl);
            for (const loc of zone.getAllLocsUnsafe()) {
                const n = LocType.get(loc.type).debugname ?? '';
                const k = lvl + ':' + loc.x + ':' + loc.z;
                if (!locs.has(k)) locs.set(k, []);
                locs.get(k)!.push(n);
            }
        }
    }
}
const chests: [string, number, number, number][] = [
    ['parts_2', 1917, 4613, 1],
    ['parts_3', 1917, 4665, 1],
    ['parts_4', 1858, 4613, 0],
    ['parts_5', 1880, 4659, 0],
    ['parts_6', 1910, 4622, 0]
];
console.log('');
for (const [name, cx, cz, lvl] of chests) {
    // the chest tile itself is blocking, so flood from each walkable neighbour
    let room = new Set<number>();
    for (const [dx, dz] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1]
    ] as const) {
        const r = reach(cx + dx, cz + dz, lvl);
        if (r.size > room.size) room = r;
    }
    const doors = new Set<string>();
    const stairs = new Set<string>();
    for (const k of room) {
        const x = Math.floor(k / 10000);
        const z = k % 10000;
        for (const [dx, dz] of [
            [1, 0],
            [-1, 0],
            [0, 1],
            [0, -1],
            [0, 0]
        ] as const) {
            for (const n of locs.get(lvl + ':' + (x + dx) + ':' + (z + dz)) ?? []) {
                if (/^mourning_door_\d/.test(n)) doors.add(n);
                if (/stairs|ladder|way_rope|way_down|wall_jump|agility_hanging/.test(n)) stairs.add(n);
            }
        }
    }
    console.log(name + ' at ' + cx + ',' + cz + ' L' + lvl + ': its region is ' + room.size + ' tiles');
    console.log('   doors on its edge: ' + ([...doors].join(', ') || 'none'));
    console.log('   ways between floors in it: ' + ([...stairs].join(', ') || 'none'));
}

// Exit rather than running off the end of the file: the world keeps worker threads and timers alive,
// so without this the sim hangs after its last line instead of finishing. gwdmap and feudhouse were
// the same, and all four were the sweep's only timeouts.
process.exit(0);
