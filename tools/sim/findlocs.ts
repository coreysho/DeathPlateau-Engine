// Where a loc type actually stands on the map, by name or name prefix.
//
//   npx tsx tools/sim/findlocs.ts roguesden_walldecor_safe
//   npx tsx tools/sim/findlocs.ts roguesden_            # every loc whose name starts with it
import World from '#/engine/World.js';
import * as H from './harness.js';
import LocType from '#/cache/config/LocType.js';

await H.boot();
const want = process.argv[2] ?? '';
const counts = new Map<string, { n: number; first: string; ops: string }>();
for (const zone of ((World.gameMap as any).zonemap.zones as Map<number, any>).values()) {
    for (const loc of zone.getAllLocsUnsafe()) {
        const t = LocType.get(loc.type);
        const name = t.debugname ?? String(loc.type);
        if (!name.startsWith(want)) continue;
        const row = counts.get(name) ?? { n: 0, first: `${loc.level},${loc.x},${loc.z}`, ops: (t.op ?? []).filter(Boolean).join(',') };
        row.n++;
        counts.set(name, row);
    }
}
const rows = [...counts.entries()].sort((a, b) => a[0].localeCompare(b[0]));
console.log(`${rows.length} loc types matching "${want}"`);
for (const [name, r] of rows) console.log(`  ${String(r.n).padStart(4)}x ${name.padEnd(42)} first at ${r.first.padEnd(16)} ops ${r.ops}`);
process.exit(0);
