// Every loc placement in a box, with its shape and angle, so a built room can be read off.
//
//   npx tsx tools/sim/roomdump.ts <level> <x> <z> [radius]
import World from '#/engine/World.js';
import * as H from './harness.js';
import LocType from '#/cache/config/LocType.js';
import NpcType from '#/cache/config/NpcType.js';

await H.boot();
const level = Number(process.argv[2]);
const cx = Number(process.argv[3]);
const cz = Number(process.argv[4]);
const R = Number(process.argv[5] ?? 20);

const rows: string[] = [];
for (const zone of ((World.gameMap as any).zonemap.zones as Map<number, any>).values()) {
    for (const loc of zone.getAllLocsUnsafe()) {
        if (loc.level !== level || Math.abs(loc.x - cx) > R || Math.abs(loc.z - cz) > R) continue;
        const t = LocType.get(loc.type);
        rows.push(`  ${loc.x},${loc.z}  shape=${loc.shape} angle=${loc.angle}  ${t.debugname ?? 'loc_' + loc.type}  "${t.name ?? ''}"  ops=${(t.op ?? []).filter(Boolean).join('/')}`);
    }
}
rows.sort();
console.log(`${rows.length} locs within ${R} of ${level},${cx},${cz}`);
for (const r of rows) console.log(r);

console.log('npcs:');
for (const npc of World.npcs) {
    if (!npc || npc.level !== level || Math.abs(npc.x - cx) > R || Math.abs(npc.z - cz) > R) continue;
    const t = NpcType.get(npc.type);
    console.log(`  ${npc.x},${npc.z}  ${t.debugname}  "${t.name}"  ops=${(t.op ?? []).filter(Boolean).join('/')}`);
}
process.exit(0);
