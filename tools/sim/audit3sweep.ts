// Audit helper: every loc / npc / obj whose debugname starts with one of the given prefixes, and
// every op on it that has no script behind it. Usage: npx tsx tools/sim/audit3sweep.ts ahoy_ eadgar_
import * as H from './harness.js';
import LocType from '#/cache/config/LocType.js';
import NpcType from '#/cache/config/NpcType.js';
import ObjType from '#/cache/config/ObjType.js';
import ScriptProvider from '#/engine/script/ScriptProvider.js';
import ServerTriggerType from '#/engine/script/ServerTriggerType.js';

await H.boot();
const prefixes = process.argv.slice(2);
const want = (n: string | null) => !!n && prefixes.some(p => n.startsWith(p));

const locShells = new Map<number, number[]>();
for (let i = 0; i < LocType.count; i++) {
    const t = LocType.get(i);
    for (const c of t.multiloc ?? []) if (c >= 0) locShells.set(c, [...(locShells.get(c) ?? []), i]);
}
const npcShells = new Map<number, number[]>();
for (let i = 0; i < NpcType.count; i++) {
    const t = NpcType.get(i);
    for (const c of t.multinpc ?? []) if (c >= 0) npcShells.set(c, [...(npcShells.get(c) ?? []), i]);
}
const hasLoc = (id: number, op: number) => {
    const t = LocType.get(id);
    return !!(ScriptProvider.getByTrigger(ServerTriggerType.OPLOC1 + op, id, t.category) || ScriptProvider.getByTrigger(ServerTriggerType.APLOC1 + op, id, t.category));
};
const hasNpc = (id: number, op: number) => {
    const t = NpcType.get(id);
    return !!(ScriptProvider.getByTrigger(ServerTriggerType.OPNPC1 + op, id, t.category) || ScriptProvider.getByTrigger(ServerTriggerType.APNPC1 + op, id, t.category));
};
for (let i = 0; i < LocType.count; i++) {
    const t = LocType.get(i);
    if (!want(t.debugname)) continue;
    (t.op ?? []).forEach((o, op) => {
        if (!o) return;
        const ids = locShells.get(i) ?? [i];
        if (!ids.some(id => hasLoc(id, op))) console.log(`LOC ${t.debugname} op${op + 1}=${o}${locShells.has(i) ? ' (child of ' + ids.map(s => LocType.get(s).debugname).join(',') + ')' : ''}`);
    });
}
for (let i = 0; i < NpcType.count; i++) {
    const t = NpcType.get(i);
    if (!want(t.debugname)) continue;
    (t.op ?? []).forEach((o, op) => {
        if (!o || o === 'Attack') return;
        const ids = npcShells.get(i) ?? [i];
        if (!ids.some(id => hasNpc(id, op))) console.log(`NPC ${t.debugname} op${op + 1}=${o}${npcShells.has(i) ? ' (child of ' + ids.map(s => NpcType.get(s).debugname).join(',') + ')' : ''}`);
    });
}
for (let i = 0; i < ObjType.count; i++) {
    const t = ObjType.get(i);
    if (!want(t.debugname)) continue;
    t.iop.forEach((o, op) => {
        if (!o || op === 4) return;
        if (!ScriptProvider.getByTrigger(ServerTriggerType.OPHELD1 + op, i, t.category)) console.log(`OBJ ${t.debugname} iop${op + 1}=${o}`);
    });
}
process.exit(0);
