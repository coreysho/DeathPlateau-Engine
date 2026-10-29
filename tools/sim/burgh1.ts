// IN AID OF THE MYREQUE - where Burgh de Rott actually keeps everything.
import World from '#/engine/World.js';
import * as H from './harness.js';
import LocType from '#/cache/config/LocType.js';
import NpcType from '#/cache/config/NpcType.js';

await H.boot();

const boxes: [string, number, number, number, number][] = [
    ['Burgh de Rott', 3456, 3200, 3583, 3263],
    ['the inn basement', 3456, 9600, 3583, 9663],
    ['Paterdomus catacombs', 3392, 9792, 3455, 9919],
    ['the Hollows', 3456, 9792, 3519, 9855]
];
for (const [nm, x1, z1, x2, z2] of boxes) {
    console.log('');
    console.log(`=== clickable burgh_ locs in ${nm}`);
    const rows: string[] = [];
    for (const zone of ((World.gameMap as any).zonemap.zones as Map<number, any>).values()) {
        for (const loc of zone.getAllLocsUnsafe()) {
            if (loc.x < x1 || loc.x > x2 || loc.z < z1 || loc.z > z2) continue;
            const t = LocType.get(loc.type);
            const n = t.debugname ?? String(loc.type);
            const ops = (t.op ?? []).filter(Boolean);
            if (!n.startsWith('burgh_') && !ops.length) continue;
            if (!n.startsWith('burgh_')) continue;
            rows.push(`L${loc.level} ${loc.x},${loc.z} s${loc.shape}a${loc.angle}  ${n}  [${ops.join('/')}]`);
        }
    }
    rows.sort();
    for (const r of rows) console.log('  ' + r);
}

console.log('');
console.log('=== every burgh_ npc placed');
const seen: string[] = [];
for (const n of World.npcs) {
    const t = NpcType.get(n.type);
    const nm = t.debugname ?? String(n.type);
    if (!nm.startsWith('burgh_')) continue;
    seen.push(`  ${nm.padEnd(44)} L${n.level} ${n.x},${n.z}  lvl ${t.vislevel}  hp ${(t as any).hitpoints ?? '-'}`);
}
seen.sort();
for (const s of seen) console.log(s);

console.log('');
console.log('=== the ones that matter, placed or not');
for (const nm of ['burgh_gadderanks_multinpc', 'burgh_gadderanks', 'burgh_gadderanks_attackable',
    'burgh_gadderanks_wounded', 'burgh_juve1_multinpc', 'burgh_juve2_multinpc',
    'burgh_villager_tithe_multinpc', 'burgh_vilager_leader', 'burgh_general_store_owner',
    'burgh_potential_bank_teller_multinpc', 'burgh_actual_bank_teller_multinpc',
    'burgh_rescue_veliaf_hurtz_talk', 'burgh_ivan_strom_temple_ambush']) {
    try {
        const id = NpcType.getId(nm);
        const t = NpcType.get(id);
        let where = 'not placed';
        for (const n of World.npcs) if (n.type === id) { where = `L${n.level} ${n.x},${n.z}`; break; }
        console.log(`  ${nm.padEnd(44)} id ${String(id).padStart(5)}  lvl ${t.vislevel}  hp ${(t as any).hitpoints ?? '-'}  ops [${(t.op ?? []).filter(Boolean).join('/')}]  ${where}`);
    } catch { console.log(`  ${nm} MISSING`); }
}

console.log('');
console.log('=== the rubble locs, wherever they are');
for (const want of ['burgh_inn_rubble_rock', 'burgh_inn_rubble_pile', 'burgh_outside_rubble_pile',
    'burgh_rubble_a_1', 'burgh_rubble_a_2', 'burgh_rubble_a_3', 'burgh_rubble_a_4',
    'burgh_inn_crumble_wall_rubble', 'burgh_inn_colapsed_wall_multiloc', 'burgh_well']) {
    const hits: string[] = [];
    for (const zone of ((World.gameMap as any).zonemap.zones as Map<number, any>).values()) {
        for (const loc of zone.getAllLocsUnsafe()) {
            if ((LocType.get(loc.type).debugname ?? '') !== want) continue;
            hits.push(`L${loc.level} ${loc.x},${loc.z} s${loc.shape}a${loc.angle}`);
        }
    }
    let ops = '';
    try { ops = (LocType.get(LocType.getId(want)).op ?? []).filter(Boolean).join('/'); } catch { ops = '?'; }
    console.log(`  ${want.padEnd(36)} [${ops}]  ${hits.length ? hits.join('  ') : '(none placed)'}`);
}
