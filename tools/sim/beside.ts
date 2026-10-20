// WHERE DO YOU STAND TO TALK TO THIS NPC? Every placement of each named npc, with the tiles beside
// it a player can actually be put on and the size of the pocket those tiles belong to.
//
//   npx tsx tools/sim/beside.ts dwarf_city_gardener_dwarf elstan
//
// This is the other half of walkmap.ts. A manifest's `talk` step walks to the npc, and the step
// that reports "4 tiles off at x,z; player stuck at a,b" is nearly always one whose setpos landed
// on the wrong side of a desk, a counter or a shop wall. The answer is a tile from this list.
import World from '#/engine/World.js';
import * as H from './harness.js';
import NpcType from '#/cache/config/NpcType.js';
import { canTravel } from '#/engine/GameMap.js';
import { CollisionType } from '#/engine/routefinder/index.js';

await H.boot();
const DIRS: [number, number][] = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const names = process.argv.slice(2);
if (!names.length) {
    console.log('usage: beside.ts <npc name> [<npc name> ...]');
    process.exit(2);
}
function pocket(level: number, x: number, z: number, cap = 400) {
    const seen = new Set<string>([x + ',' + z]);
    const q: [number, number][] = [[x, z]];
    while (q.length && seen.size < cap) {
        const [cx, cz] = q.shift()!;
        for (const [dx, dz] of DIRS) {
            const k = (cx + dx) + ',' + (cz + dz);
            if (seen.has(k) || !canTravel(level, cx, cz, dx, dz, 1, 0, CollisionType.NORMAL)) continue;
            seen.add(k); q.push([cx + dx, cz + dz]);
        }
    }
    return seen;
}
for (const nm of names) {
    let id = -1;
    try { id = NpcType.getId(nm); } catch { console.log(nm + ': no such npc'); continue; }
    let found = 0;
    for (const n of World.npcs) {
        if (!n || n.type !== id) continue;
        found++;
        // the npc's own tile may be behind a counter, so the pocket is grown from each neighbour
        const beside: string[] = [];
        for (const [dx, dz] of DIRS) {
            const x = n.x + dx, z = n.z + dz;
            if (!DIRS.some(([bx, bz]) => canTravel(n.level, x - bx, z - bz, bx, bz, 1, 0, CollisionType.NORMAL))) continue;
            beside.push(`${x},${z} (pocket ${pocket(n.level, x, z).size})`);
        }
        console.log(`${nm.padEnd(38)} L${n.level} ${n.x},${n.z}  stand at: ${beside.join('  ') || 'NOWHERE - it is walled in'}`);
    }
    if (!found) console.log(`${nm.padEnd(38)} (none placed)`);
}
