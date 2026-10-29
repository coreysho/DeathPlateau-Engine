// SPIRITS OF THE ELID - every clickable loc in Nardah and in the shrine, and where the cast stands.
import World from '#/engine/World.js';
import * as H from './harness.js';
import LocType from '#/cache/config/LocType.js';
import NpcType from '#/cache/config/NpcType.js';

await H.boot();
const boxes: [string, number, number, number, number][] = [
    ['Nardah', 3380, 2880, 3450, 2950],
    ['the shrine', 3328, 9536, 3391, 9599],
    ['the genie cave', 3328, 9280, 3391, 9343]
];
for (const [nm, x1, z1, x2, z2] of boxes) {
    console.log('');
    console.log(`=== clickable locs in ${nm}`);
    const rows: string[] = [];
    for (const zone of ((World.gameMap as any).zonemap.zones as Map<number, any>).values()) {
        for (const loc of zone.getAllLocsUnsafe()) {
            if (loc.x < x1 || loc.x > x2 || loc.z < z1 || loc.z > z2) continue;
            const t = LocType.get(loc.type);
            const ops = (t.op ?? []).filter(Boolean);
            const n = t.debugname ?? String(loc.type);
            if (!ops.length && !n.startsWith('elid')) continue;
            rows.push(`L${loc.level} ${loc.x},${loc.z} s${loc.shape}a${loc.angle}  ${n}  [${ops.join('/')}]`);
        }
    }
    rows.sort();
    for (const r of rows) console.log('  ' + r);
}
console.log('');
console.log('=== the cast');
for (const n of World.npcs) {
    const t = NpcType.get(n.type);
    const nm = t.debugname ?? String(n.type);
    if (!nm.startsWith('elid')) continue;
    console.log(`  ${nm.padEnd(34)} L${n.level} ${n.x},${n.z}  lvl ${t.vislevel}`);
}
