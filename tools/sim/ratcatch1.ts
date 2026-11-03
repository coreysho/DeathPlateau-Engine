// RAT CATCHERS - the whole cast and where the cache puts it.
import World from '#/engine/World.js';
import * as H from './harness.js';
import LocType from '#/cache/config/LocType.js';
import NpcType from '#/cache/config/NpcType.js';

await H.boot();

console.log('=== every vc_ / ratcatcher npc, placed or not');
const want: string[] = [];
for (let i = 0; i < NpcType.count; i++) {
    const n = NpcType.get(i).debugname ?? '';
    if (n.startsWith('vc_') || n.startsWith('ratcatcher')) want.push(n);
}
for (const nm of want) {
    const id = NpcType.getId(nm);
    const t = NpcType.get(id);
    const spots: string[] = [];
    for (const n of World.npcs) if (n.type === id) spots.push(`L${n.level} ${n.x},${n.z}`);
    console.log(`  ${nm.padEnd(44)} lvl ${String(t.vislevel).padStart(4)} hp ${String((t as any).hitpoints ?? '-').padStart(4)} ops [${(t.op ?? []).filter(Boolean).join('/')}]  ${spots.length ? spots.slice(0, 4).join(' ') : '(not placed)'}`);
}

console.log('');
console.log('=== every vc_ / ratcatcher loc, placed or not');
const placed = new Map<string, string[]>();
for (const zone of ((World.gameMap as any).zonemap.zones as Map<number, any>).values()) {
    for (const loc of zone.getAllLocsUnsafe()) {
        const n = LocType.get(loc.type).debugname ?? '';
        if (!n.startsWith('vc_') && !n.startsWith('ratcatcher')) continue;
        if (!placed.has(n)) placed.set(n, []);
        placed.get(n)!.push(`L${loc.level} ${loc.x},${loc.z}`);
    }
}
for (let i = 0; i < LocType.count; i++) {
    const t = LocType.get(i);
    const n = t.debugname ?? '';
    if (!n.startsWith('vc_') && !n.startsWith('ratcatcher')) continue;
    const spots = placed.get(n) ?? [];
    console.log(`  ${n.padEnd(40)} [${(t.op ?? []).filter(Boolean).join('/')}]  ${spots.length ? spots.slice(0, 6).join(' ') : '(not placed)'}`);
}

console.log('');
console.log('=== the ones the walkthrough names');
for (const nm of ['gertrude', 'apothecary', 'ali_the_snake_charmer', 'feud_ali_the_snake_charmer', 'feud_badir_the_snake_charmer', 'king_rat', 'vc_the_beast', 'vc_pox', 'vc_pox_inwarehouse']) {
    try {
        const id = NpcType.getId(nm);
        const t = NpcType.get(id);
        let where = 'not placed';
        for (const n of World.npcs)
            if (n.type === id) {
                where = `L${n.level} ${n.x},${n.z}`;
                break;
            }
        console.log(`  ${nm.padEnd(40)} lvl ${t.vislevel} ops [${(t.op ?? []).filter(Boolean).join('/')}] ${where}`);
    } catch {
        console.log(`  ${nm.padEnd(40)} MISSING`);
    }
}

// EXITS, because the engine's own timers keep the event loop alive for ever otherwise. This file
// prints a report rather than asserting anything, so it had no process.exit at all and simply hung
// once it had finished printing: ten minutes of wall clock using 0.4 seconds of CPU, which is a
// process waiting rather than working. tools/sim/sweep.sh runs every sim with a cap of 5400s, so
// fourteen files in this shape could spend the better part of a day being killed one by one.
//
// The nightly never noticed because its filter only runs a sim that CAN report a verdict
// (`grep -qE 'process\.exit\([^0-9)]'`), and a file with no exit at all does not match.
process.exit(0);
