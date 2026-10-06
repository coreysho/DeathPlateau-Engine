// An ASCII plan of a piece of map: what is walkable, where the locs are, where the zone edges fall.
//
//   npx tsx tools/sim/roommap.ts <level> <x1> <z1> <x2> <z2>
//
// For deciding how much of a room an instance has to copy. Zones are 8x8 and instance_setzone works
// one whole zone at a time, so the answer is always "which zones", never "which tiles".
import World from '#/engine/World.js';
import * as H from './harness.js';
import LocType from '#/cache/config/LocType.js';
import NpcType from '#/cache/config/NpcType.js';
import { CollisionFlag } from '#/engine/routefinder/index.js';
import { isFlagged } from '#/engine/GameMap.js';

await H.boot();
const [level, x1, z1, x2, z2] = process.argv.slice(2, 7).map(Number);

const marks = new Map<string, string>();
let n = 0;
const letters = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
const legend: string[] = [];
const seen = new Map<string, string>();
for (const zone of ((World.gameMap as any).zonemap.zones as Map<number, any>).values()) {
    for (const loc of zone.getAllLocsUnsafe()) {
        if (loc.level !== level || loc.x < x1 || loc.x > x2 || loc.z < z1 || loc.z > z2) continue;
        const name = LocType.get(loc.type).debugname ?? `loc_${loc.type}`;
        let ch = seen.get(name);
        if (!ch) {
            ch = letters[n++ % letters.length];
            seen.set(name, ch);
            legend.push(`${ch} = ${name} "${LocType.get(loc.type).name ?? ''}"`);
        }
        marks.set(`${loc.x},${loc.z}`, ch);
    }
}
for (const npc of World.npcs) {
    if (!npc || npc.level !== level || npc.x < x1 || npc.x > x2 || npc.z < z1 || npc.z > z2) continue;
    marks.set(`${npc.x},${npc.z}`, '@');
    legend.push(`@ = npc ${NpcType.get(npc.type).debugname} at ${npc.x},${npc.z}`);
}

console.log(`${level},${x1},${z1} .. ${x2},${z2}   # blocked, . walkable, | zone edge`);
for (let z = z2; z >= z1; z--) {
    let row = String(z).padStart(5) + ' ';
    for (let x = x1; x <= x2; x++) {
        if (x % 8 === 0 && x !== x1) row += '|';
        row += marks.get(`${x},${z}`) ?? (isFlagged(x, z, level, CollisionFlag.WALK_BLOCKED) ? '#' : '.');
    }
    console.log(row);
    if (z % 8 === 0 && z !== z1) console.log('      ' + '-'.repeat(x2 - x1 + 1 + Math.floor((x2 - x1) / 8)));
}
console.log('x: ' + x1 + ' .. ' + x2 + '   zones x ' + (x1 >> 3) + '..' + (x2 >> 3) + ', z ' + (z1 >> 3) + '..' + (z2 >> 3));
for (const l of legend) console.log('  ' + l);
process.exit(0);
