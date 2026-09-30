// What ore SHOULD each unwired rock give?
//
//   npx tsx tools/sim/rockore.ts
//
// Every standard ore rock in the 377 cache recolours one source colour (6342 in .loc, 24 once
// packed to HSL) to a per-ore "seam"
// colour. Every rock that already works therefore tells us what one seam colour means. This
// learns that table from the working rocks and applies it to the unwired ones, so an ore only has
// to be identified once. A rock with no 6342 slot at all is mine-wall scenery, not an ore rock.
import World from '#/engine/World.js';
import * as H from './harness.js';
import LocType from '#/cache/config/LocType.js';
import NpcType from '#/cache/config/NpcType.js';
import ScriptProvider from '#/engine/script/ScriptProvider.js';
import ServerTriggerType from '#/engine/script/ServerTriggerType.js';
import fs from 'fs';

await H.boot();

// The packer converts .loc colours to HSL16, so the seam source 6342 is stored as 24.
const SEAM_SRC = 24;
const nameOf = (id: number) => (id < 0 ? 'null' : (LocType.get(id).debugname ?? String(id)));
const hasMine = (t: LocType) => (t.op ?? []).some(o => o === 'Mine');
const wired = (id: number) => !!(ScriptProvider.getByTriggerSpecific(ServerTriggerType.OPLOC1, id, -1) ||
    ScriptProvider.getByTrigger(ServerTriggerType.OPLOC1, id, LocType.get(id).category));

/** The seam colour this rock's ore is painted with, or null if it has no ore seam at all. */
function seamOf(t: LocType): number | null {
    const s = (t as any).recol_s as number[] | undefined;
    const d = (t as any).recol_d as number[] | undefined;
    if (!s || !d) return null;
    for (let i = 0; i < s.length; i++) if (s[i] === SEAM_SRC) return d[i] ?? null;
    return null;
}

// rock loc name -> ore, straight out of mine.dbrow
const dbrow = fs.readFileSync('../content/scripts/skill_mining/configs/mine.dbrow', 'utf8');
const rockOre = new Map<string, string>();
for (const m of dbrow.matchAll(/\[(\w+)\]((?:\r?\n(?!\[)[^\r\n]*)*)/g)) {
    const ore = /^data=ore_name,(\S+)/m.exec(m[2])?.[1];
    if (!ore) continue;
    for (const r of m[2].matchAll(/^data=rock,(\S+)/gm)) rockOre.set(r[1], ore);
}

const seamOre = new Map<number, Set<string>>();
for (let id = 0; id < LocType.count; id++) {
    const t = LocType.get(id);
    if (!t) continue;
    const ore = rockOre.get(nameOf(id));
    const seam = t ? seamOf(t) : null;
    if (ore && seam !== null) (seamOre.get(seam) ?? seamOre.set(seam, new Set()).get(seam)!).add(ore);
}

const placed = new Map<number, { level: number; x: number; z: number }[]>();
for (const zone of ((World.gameMap as any).zonemap.zones as Map<number, any>).values())
    for (const loc of zone.getAllLocsUnsafe())
        (placed.get(loc.type) ?? placed.set(loc.type, []).get(loc.type)!).push({ level: loc.level, x: loc.x, z: loc.z });

const npcs: { name: string; x: number; z: number; level: number }[] = [];
for (const n of World.npcs) {
    const nm = NpcType.get(n.type)?.name;
    if (nm && nm !== 'null') npcs.push({ name: nm, x: n.x, z: n.z, level: n.level });
}
const nearestNpc = (x: number, z: number, level: number) => {
    let best = '-', bd = Infinity;
    for (const c of npcs) { if (c.level !== level) continue; const d = (c.x-x)**2 + (c.z-z)**2; if (d < bd) { bd = d; best = c.name; } }
    return best;
};

console.log('SEAM -> ORE, learned from the rocks that already work');
for (const s of [...seamOre.keys()].sort((a,b)=>a-b)) console.log(`  ${String(s).padEnd(7)} ${[...seamOre.get(s)!].sort().join(', ')}`);

const scenery: string[] = [], known: string[] = [], unknown: string[] = [];
let sceneryN = 0, knownN = 0, unknownN = 0;
for (let id = 0; id < LocType.count; id++) {
    const t = LocType.get(id);
    if (!t || !hasMine(t) || wired(id)) continue;
    const ps = placed.get(id) ?? [];
    if (!ps.length) continue;
    const seam = seamOf(t);
    const p = ps[0];
    const row = `  ${nameOf(id).padEnd(16)} x${String(ps.length).padEnd(4)} (${p.x},${p.z},${p.level})`.padEnd(46) +
        ` near ${nearestNpc(p.x, p.z, p.level)}`;
    if (seam === null) { scenery.push(row); sceneryN += ps.length; }
    else if (seamOre.has(seam)) { known.push(`  seam ${String(seam).padEnd(6)} = ${[...seamOre.get(seam)!].join('/').padEnd(8)}` + row.slice(2)); knownN += ps.length; }
    else { unknown.push(`  seam ${String(seam).padEnd(6)} = ?       ` + row.slice(2)); unknownN += ps.length; }
}
console.log(`\n=== ORE KNOWN, just unwired: ${known.length} locs, ${knownN} placements ===`);
known.sort().forEach(r => console.log(r));
console.log(`\n=== ORE STILL UNIDENTIFIED: ${unknown.length} locs, ${unknownN} placements ===`);
unknown.sort().forEach(r => console.log(r));
console.log(`\n=== NO ORE SEAM AT ALL (mine-wall scenery, inert by design): ${scenery.length} locs, ${sceneryN} placements ===`);
scenery.forEach(r => console.log(r));
process.exit(0);
