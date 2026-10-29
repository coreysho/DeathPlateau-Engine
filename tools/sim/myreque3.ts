// THE CAVE UNDER CANIFIS, as a graph. Every route_cavewalltunnel mouth, the chamber it belongs to,
// and which landmarks share that chamber - which is the only way to wire the mouths up so the
// network is actually walkable end to end.
import World from '#/engine/World.js';
import * as H from './harness.js';
import LocType from '#/cache/config/LocType.js';
import { canTravel } from '#/engine/GameMap.js';
import { CollisionType } from '#/engine/routefinder/index.js';

await H.boot();
const DIRS: [number, number][] = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const key = (x: number, z: number) => x * 20000 + z;
function pocket(level: number, x: number, z: number, cap = 40000) {
    const seen = new Set<number>([key(x, z)]);
    const q: [number, number][] = [[x, z]];
    while (q.length && seen.size < cap) {
        const [cx, cz] = q.shift()!;
        for (const [dx, dz] of DIRS) {
            const k = key(cx + dx, cz + dz);
            if (seen.has(k) || !canTravel(level, cx, cz, dx, dz, 1, 0, CollisionType.NORMAL)) continue;
            seen.add(k); q.push([cx + dx, cz + dz]);
        }
    }
    return seen;
}
const standable = (l: number, x: number, z: number) =>
    DIRS.some(([dx, dz]) => canTravel(l, x, z, dx, dz, 1, 0, CollisionType.NORMAL));

// every mouth, and a tile beside it to flood from
type Spot = { nm: string; l: number; x: number; z: number; from: string };
const spots: Spot[] = [];
for (const zone of ((World.gameMap as any).zonemap.zones as Map<number, any>).values()) {
    for (const loc of zone.getAllLocsUnsafe()) {
        const n = LocType.get(loc.type).debugname ?? '';
        if (n !== 'route_cavewalltunnel') continue;
        if (loc.z < 9790 || loc.z > 9860) continue;
        spots.push({ nm: `mouth ${loc.x},${loc.z} a${loc.angle}`, l: loc.level, x: loc.x, z: loc.z, from: '' });
    }
}
const marks: Spot[] = [
    { nm: 'cellar ladder 3477,9846', l: 0, x: 3477, z: 9845, from: '' },
    { nm: 'false wall, cellar side', l: 0, x: 3480, z: 9838, from: '' },
    { nm: 'false wall, tunnel side', l: 0, x: 3480, z: 9836, from: '' },
    { nm: 'myreque doors, south 3500,9811', l: 0, x: 3500, z: 9811, from: '' },
    { nm: 'myreque doors, north 3500,9813', l: 0, x: 3500, z: 9813, from: '' },
    { nm: 'stalagmite 3492,9825', l: 0, x: 3492, z: 9825, from: '' },
    { nm: 'stalagmite 3492,9823', l: 0, x: 3492, z: 9823, from: '' },
    { nm: 'hideout L0 3507,9842', l: 0, x: 3507, z: 9842, from: '' },
    { nm: 'hideout L3 3506,9838', l: 3, x: 3506, z: 9838, from: '' },
    { nm: 'ivandis tomb 3484,9833', l: 0, x: 3484, z: 9833, from: '' },
    { nm: 'broken ladder 3483,9842', l: 0, x: 3483, z: 9842, from: '' }
];

const all = [...spots, ...marks];
// group into pockets
const groups: { rep: Spot; set: Set<number>; members: string[] }[] = [];
for (const s of all) {
    let tile: [number, number] | null = null;
    for (const [dx, dz] of [[0, 0] as [number, number], ...DIRS]) {
        if (standable(s.l, s.x + dx, s.z + dz)) { tile = [s.x + dx, s.z + dz]; break; }
    }
    if (!tile) { console.log(`  ${s.nm} L${s.l}: no standable tile`); continue; }
    const g = groups.find(g => g.rep.l === s.l && g.set.has(key(tile![0], tile![1])));
    if (g) { g.members.push(`${s.nm} L${s.l}`); continue; }
    const set = pocket(s.l, tile[0], tile[1]);
    groups.push({ rep: s, set, members: [`${s.nm} L${s.l}`] });
}
groups.sort((a, b) => b.set.size - a.set.size);
for (const g of groups) {
    console.log('');
    console.log(`=== chamber of ${g.set.size} tiles (plane ${g.rep.l})`);
    for (const m of g.members) console.log('    ' + m);
}
