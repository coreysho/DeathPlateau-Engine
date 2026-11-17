// Which of opsweep's dead LOC options sit on locs a player can actually walk up to?
//
//   npx tsx tools/sim/placeddead.ts
//
// opsweep-baseline.txt lists 1,628 dead loc options. Most are on locs that are never placed on
// the map at all - content nobody can reach, which is a different problem and not an urgent one.
// This filters that list down to the ones with spawns, which is the set a player can click: 580
// options across 516 locs on the build this was written against.
//
// It found wheat_tall, whose op2="Pick" did nothing in the Lumbridge field (see wheatpick.ts).
// log_withaxe, which a player DID report as tracker issue 26, was on the same list.
//
// Hand-run, so no computed process.exit: sims.yml only takes files whose exit code is a verdict.
import * as H from './harness.js';
import LocType from '#/cache/config/LocType.js';
import World from '#/engine/World.js';
import fs from 'fs';

await H.boot();

// every placement on the map, bucketed by type id
const spawns = new Map<number, { x: number; z: number; level: number }[]>();
for (const zone of (World.gameMap as any).zonemap.zones.values()) {
    for (const loc of zone.getAllLocsUnsafe()) {
        const list = spawns.get(loc.type) ?? [];
        list.push({ x: loc.x, z: loc.z, level: loc.level });
        spawns.set(loc.type, list);
    }
}

const lines = fs.readFileSync('tools/sim/opsweep-baseline.txt', 'utf8').split('\n');
type Row = { name: string; ops: string[]; n: number; where: { x: number; z: number; level: number } };
const byName = new Map<string, Row>();
let deadLocLines = 0;

for (const line of lines) {
    const m = line.match(/^dead loc\s+(\S+)\s+(op\d="[^"]*")/);
    if (!m) continue;
    deadLocLines++;
    const id = LocType.getId(m[1]);
    if (id === -1) continue;
    const placed = spawns.get(id);
    if (!placed || placed.length === 0) continue;
    const row = byName.get(m[1]) ?? { name: m[1], ops: [], n: placed.length, where: placed[0] };
    row.ops.push(m[2]);
    byName.set(m[1], row);
}

const rows = [...byName.values()].sort((a, b) => b.n - a.n);
const totalOps = rows.reduce((s, r) => s + r.ops.length, 0);
console.log(`dead loc lines in the baseline : ${deadLocLines}`);
console.log(`...on locs that are PLACED     : ${totalOps} options across ${rows.length} locs`);
console.log(`...on locs never placed at all : ${deadLocLines - totalOps}\n`);
console.log('placed, dead, by number of spawns:');
for (const r of rows.slice(0, 30)) {
    const w = r.where;
    console.log(`  ${String(r.n).padStart(4)}x  ${r.name.padEnd(34)} ${r.ops.join(' ')}   first at ${w.x},${w.z}${w.level ? ' level ' + w.level : ''}`);
}
process.exit(0);
