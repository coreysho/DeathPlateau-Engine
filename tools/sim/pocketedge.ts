// WHAT IS ON THE EDGE OF THIS POCKET? Floods from one tile and then lists every loc standing on a
// tile of the pocket or on a tile touching it, with its ops - which is the list of things a player
// standing in there could possibly click to get out.
//
//   npx tsx tools/sim/pocketedge.ts <level> <x>,<z> [cap] ["pattern"]
//
// joinpocket.ts answers "what joins these two places" and goes quiet when the two pockets do not
// touch at all - which is the normal case for an obstacle that forcewalks you across two tiles of
// solid scenery. This one answers the question that is left: what is standing at the edge.
import * as H from './harness.js';
import World from '#/engine/World.js';
import LocType from '#/cache/config/LocType.js';
import { canTravel } from '#/engine/GameMap.js';
import { CollisionType } from '#/engine/routefinder/index.js';

await H.boot();
const level = Number(process.argv[2]);
const [sx, sz] = process.argv[3].split(',').map(Number);
const cap = Number(process.argv[4] ?? 20000);
const re = new RegExp(process.argv[5] ?? '.', 'i');

const key = (x: number, z: number) => x * 100000 + z;
const seen = new Set<number>([key(sx, sz)]);
const q: [number, number][] = [[sx, sz]];
const dirs: [number, number][] = [
    [0, 1],
    [0, -1],
    [1, 0],
    [-1, 0]
];
while (q.length && seen.size < cap) {
    const [x, z] = q.shift()!;
    for (const [dx, dz] of dirs) {
        const nx = x + dx;
        const nz = z + dz;
        if (seen.has(key(nx, nz))) continue;
        if (!canTravel(level, x, z, dx, dz, 1, 0, CollisionType.NORMAL)) continue;
        seen.add(key(nx, nz));
        q.push([nx, nz]);
    }
}
console.log(`pocket from ${sx},${sz} L${level}: ${seen.size} tiles`);

// every tile of the pocket, plus every tile one step off it
const look = new Set<number>(seen);
for (const k of seen) {
    const x = Math.floor(k / 100000);
    const z = k % 100000;
    for (const [dx, dz] of dirs) look.add(key(x + dx, z + dz));
}

const found = new Map<string, string[]>();
for (const zone of ((World.gameMap as any).zonemap.zones as Map<number, any>).values()) {
    for (const loc of zone.getAllLocsUnsafe()) {
        if (loc.level !== level) continue;
        if (!look.has(key(loc.x, loc.z))) continue;
        const t = LocType.get(loc.type);
        const nm = t.debugname ?? 'loc_' + loc.type;
        if (!re.test(nm)) continue;
        const ops = (t.op ?? []).filter(Boolean).join('/');
        if (!ops) continue;
        const tag = nm + '  [' + ops + ']';
        if (!found.has(tag)) found.set(tag, []);
        found.get(tag)!.push(`${loc.x},${loc.z}${seen.has(key(loc.x, loc.z)) ? '' : ' (off)'}`);
    }
}
for (const [nm, where] of [...found].sort()) {
    console.log(`  ${nm}`);
    console.log(`      ${where.join('  ')}`);
}
