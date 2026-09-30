// Which spent-rock loc should each unwired rock turn into?
//
//   npx tsx tools/sim/rockspent.ts
//
// A rock is a model plus two recolours: a BODY colour and an ore SEAM colour. Its spent partner is
// the same model with the seam painted the body colour - recol_d = [body, body]. Note the body
// source colour differs per model (10299 on 3184, 37 on 3183/3195), which is why matching on a
// fixed slot silently finds nothing. A rock with no partner must not be wired: it would mine once
// and leave permanent scenery.
import World from '#/engine/World.js';
import * as H from './harness.js';
import LocType from '#/cache/config/LocType.js';
import ParamType from '#/cache/config/ParamType.js';
import ScriptProvider from '#/engine/script/ScriptProvider.js';
import ServerTriggerType from '#/engine/script/ServerTriggerType.js';
import fs from 'fs';

await H.boot();
const SEAM = 24, BODY_SRC = [10299, 37];
const P_EMPTY = ParamType.getId('mining_rock_empty');
const nameOf = (id: number) => LocType.get(id).debugname ?? String(id);
const hasMine = (t: LocType) => (t.op ?? []).some(o => o === 'Mine');
const wired = (id: number) => !!(ScriptProvider.getByTriggerSpecific(ServerTriggerType.OPLOC1, id, -1) ||
    ScriptProvider.getByTrigger(ServerTriggerType.OPLOC1, id, LocType.get(id).category));
const modelOf = (t: any) => t.model ?? t.models?.[0];
function colours(t: any): { body: number | null; seam: number | null } {
    const s = t.recol_s, d = t.recol_d;
    let body: number | null = null, seam: number | null = null;
    if (s && d) for (let i = 0; i < s.length; i++) {
        if (BODY_SRC.includes(s[i])) body = d[i];
        else if (s[i] === SEAM) seam = d[i];
    }
    return { body, seam };
}

const dbrow = fs.readFileSync('../content/scripts/skill_mining/configs/mine.dbrow', 'utf8');
const rockOre = new Map<string, string>();
for (const m of dbrow.matchAll(/\[(\w+)\]((?:\r?\n(?!\[)[^\r\n]*)*)/g)) {
    const ore = /^data=ore_name,(\S+)/m.exec(m[2])?.[1];
    if (!ore) continue;
    for (const r of m[2].matchAll(/^data=rock,(\S+)/gm)) rockOre.set(r[1], ore);
}
const seamOre = new Map<number, string>();
for (let id = 0; id < LocType.count; id++) {
    const t = LocType.get(id); if (!t) continue;
    const ore = rockOre.get(nameOf(id)); const { seam } = colours(t);
    if (ore && seam !== null) seamOre.set(seam, ore);
}
// A spent rock LOOKS spent: seam painted the body colour. The tag is content-authored, so an
// untagged one is just a family nobody has wired yet.
const spentByKey = new Map<string, { id: number; tagged: boolean }>();
for (let id = 0; id < LocType.count; id++) {
    const t = LocType.get(id); if (!t) continue;
    const { body, seam } = colours(t);
    if (body === null || seam === null || body !== seam) continue;
    const k = `${modelOf(t)}|${body}`;
    const tagged = t.params?.get(P_EMPTY) === 1;
    const prev = spentByKey.get(k);
    if (!prev || (tagged && !prev.tagged)) spentByKey.set(k, { id, tagged });
}

const placed = new Map<number, number>();
for (const zone of ((World.gameMap as any).zonemap.zones as Map<number, any>).values())
    for (const loc of zone.getAllLocsUnsafe()) placed.set(loc.type, (placed.get(loc.type) ?? 0) + 1);

const rows: { area: string; line: string; ok: boolean; n: number }[] = [];
for (let id = 0; id < LocType.count; id++) {
    const t = LocType.get(id);
    if (!t || !hasMine(t) || wired(id) || !placed.has(id)) continue;
    const { body, seam } = colours(t);
    if (seam === null) continue;
    const ore = seamOre.get(seam);
    const p = spentByKey.get(`${modelOf(t)}|${body}`);
    const n = placed.get(id)!;
    const ok = !!ore && !!p;
    rows.push({ area: '', n, ok, line: `  ${nameOf(id).padEnd(15)} x${String(n).padEnd(4)} ${(ore ?? 'ORE UNKNOWN (seam ' + seam + ')').padEnd(26)} ` +
        (p ? `-> ${nameOf(p.id)}${p.tagged ? '' : '  [needs mining_rock_empty]'}` : '-> NO SPENT PARTNER EXISTS') });
}
const good = rows.filter(r => r.ok), bad = rows.filter(r => !r.ok);
console.log(`WIREABLE NOW: ${good.length} locs, ${good.reduce((s,r)=>s+r.n,0)} placements`);
good.forEach(r => console.log(r.line));
console.log(`\nBLOCKED: ${bad.length} locs, ${bad.reduce((s,r)=>s+r.n,0)} placements`);
bad.forEach(r => console.log(r.line));
process.exit(0);
