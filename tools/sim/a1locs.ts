// Every loc with right-click ops in a rectangle, all levels; (!) marks an op with no trigger.
// Usage: npx tsx tools/sim/a1locs.ts x1 z1 x2 z2
import { H, World, LocType, ScriptProvider, ServerTriggerType } from './a1lib.js';
await H.boot();
const [x1, z1, x2, z2] = process.argv.slice(2).map(Number);
for (const l of [0, 1, 2, 3]) {
    const seen = new Set();
    for (let x = x1 & ~7; x <= x2; x += 8) for (let z = z1 & ~7; z <= z2; z += 8)
        for (const lc of World.gameMap.getZone(x, z, l).getAllLocsUnsafe()) {
            if (lc.x < x1 || lc.x > x2 || lc.z < z1 || lc.z > z2) continue;
            const t = LocType.get(lc.type);
            const ops = (t.op ?? []).map((o, i) => o ? `${i + 1}=${o}${ScriptProvider.getByTrigger(ServerTriggerType.OPLOC1 + i, t.id, t.category) ? '' : '(!)'}` : '').filter(Boolean);
            if (!ops.length) continue;
            const k = `${l} ${lc.x},${lc.z} ${t.debugname} s${lc.shape}a${lc.angle} ${ops.join(' ')}`;
            if (!seen.has(k)) { seen.add(k); console.log(k); }
        }
}
process.exit(0);
