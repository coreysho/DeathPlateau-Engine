// The Hollows on the surface, and the cave between the doors and the hideout.
import World from '#/engine/World.js';
import * as H from './harness.js';
import LocType from '#/cache/config/LocType.js';
import { canTravel } from '#/engine/GameMap.js';
import { CollisionType } from '#/engine/routefinder/index.js';

await H.boot();
const open = (l: number, x: number, z: number) =>
    [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dz]) => canTravel(l, x, z, dx, dz, 1, 0, CollisionType.NORMAL));
const box = (l: number, x1: number, z1: number, x2: number, z2: number) => {
    console.log('');
    console.log(`=== plane ${l}, ${x1}..${x2} x ${z1}..${z2}`);
    for (let z = z2; z >= z1; z--) {
        let row = String(z).padStart(5) + ' ';
        for (let x = x1; x <= x2; x++) row += open(l, x, z) ? '.' : '#';
        console.log(row);
    }
    console.log('      ' + x1 + ' -> ' + x2);
};
box(0, 3492, 3416, 3519, 3455);
box(1, 3496, 3420, 3515, 3440);
box(0, 3456, 9792, 3511, 9835);

console.log('');
console.log('=== every harmless_dead_palm_mid / swamp_bridge1 on the map');
for (const zone of ((World.gameMap as any).zonemap.zones as Map<number, any>).values()) {
    for (const loc of zone.getAllLocsUnsafe()) {
        const n = LocType.get(loc.type).debugname ?? '';
        if (n !== 'harmless_dead_palm_mid' && n !== 'swamp_bridge1') continue;
        console.log(`  ${n.padEnd(24)} L${loc.level} ${loc.x},${loc.z} s${loc.shape}a${loc.angle}`);
    }
}

console.log('');
console.log('=== can you walk it');
const DIRS: [number, number][] = [[1, 0], [-1, 0], [0, 1], [0, -1]];
function pocket(level: number, x: number, z: number, cap = 60000) {
    const seen = new Set<number>([x * 20000 + z]);
    const q: [number, number][] = [[x, z]];
    while (q.length && seen.size < cap) {
        const [cx, cz] = q.shift()!;
        for (const [dx, dz] of DIRS) {
            const k = (cx + dx) * 20000 + (cz + dz);
            if (seen.has(k) || !canTravel(level, cx, cz, dx, dz, 1, 0, CollisionType.NORMAL)) continue;
            seen.add(k); q.push([cx + dx, cz + dz]);
        }
    }
    return seen;
}
const leg = (nm: string, l: number, x1: number, z1: number, x2: number, z2: number) => {
    const p = pocket(l, x1, z1);
    console.log(`  ${nm.padEnd(46)} ${p.has(x2 * 20000 + z2) ? 'yes' : 'NO'}   (pocket ${p.size})`);
};
leg('boat landing 3498,3382 -> south tree 3502,3425', 0, 3498, 3382, 3502, 3425);
leg('south tree 3502,3425 -> north of bridge 3502,3432', 0, 3502, 3425, 3502, 3432);
leg('north of bridge 3502,3432 -> Curpile 3504,3437', 0, 3502, 3432, 3504, 3437);
leg('Curpile 3504,3437 -> doors 3510,3448', 0, 3504, 3437, 3510, 3448);
leg('cave: 3500,9811 -> hideout mouth 3505,9831', 0, 3500, 9811, 3505, 9831);
leg('cave: 3500,9811 -> cellar ladder 3477,9845', 0, 3500, 9811, 3477, 9845);
leg('cave: 3477,9845 -> false wall tile 3480,9838', 0, 3477, 9845, 3480, 9838);
leg('canifis 3494,3465 -> tavern chair 3504,3478', 0, 3494, 3465, 3504, 3478);
