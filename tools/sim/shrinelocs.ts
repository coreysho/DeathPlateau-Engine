// Every loc the shrine square carries, so a boat that should not be there can be named.
//
//   npx tsx tools/sim/shrinelocs.ts [square]
//
// The shrine is copied terrain on m36_79 rather than an instance built from OSRS's own squares, so
// anything the importer brought across is sitting on the square as static scenery and shows up here.
import World from '#/engine/World.js';
import * as H from './harness.ts';
import LocType from '#/cache/config/LocType.js';

await H.boot();
const square = process.argv[2] ?? '36_79';
const [sx, sz] = square.split('_').map(Number);
const x0 = sx * 64, z0 = sz * 64;

const rows: { name: string; x: number; z: number; level: number; shape: number; ops: string }[] = [];
for (const zone of ((World.gameMap as any).zonemap.zones as Map<number, any>).values()) {
    for (const loc of zone.getAllLocsUnsafe()) {
        if (loc.x < x0 || loc.x >= x0 + 64 || loc.z < z0 || loc.z >= z0 + 64) continue;
        const t = LocType.get(loc.type);
        rows.push({
            name: t.debugname ?? String(loc.type),
            x: loc.x, z: loc.z, level: loc.level, shape: loc.shape,
            ops: (t.op ?? []).filter(Boolean).join(',')
        });
    }
}
rows.sort((a, b) => a.name.localeCompare(b.name) || a.x - b.x || a.z - b.z);
console.log(`${rows.length} locs on m${square}\n`);
// Anything a player can click is the interesting half; the rest is scenery.
console.log('--- CLICKABLE ---');
for (const r of rows.filter(r => r.ops))
    console.log(`  ${r.name.padEnd(28)} (${r.x},${r.z},${r.level}) shape=${String(r.shape).padEnd(3)} [${r.ops}]`);
console.log('\n--- names containing boat/ship/raft ---');
for (const r of rows.filter(r => /boat|ship|raft|canoe/i.test(r.name)))
    console.log(`  ${r.name.padEnd(28)} (${r.x},${r.z},${r.level}) shape=${r.shape} [${r.ops || '-'}]`);
process.exit(0);
