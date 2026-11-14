// WHERE IS THE LANDMARK THAT DEFINES THIS PLACE, and can a fairy ring stand near it?
//
//   npx tsx tools/sim/findmarks.ts
//
// Companion to ringsites.ts. That one answers "can a ring stand here"; this answers "where is
// here". Guessing from memory put three rings in the wrong place, so nothing here is assumed.
//
// A FIRST DRAFT OF THIS SEARCHED THE WRONG FIELD. It read an npc's `name` in preference to its
// `debugname`, so Lletya's elves - whose debugnames are lletya_arvel, lletya_goreu and so on -
// never matched /lletya/, and it reported Tirannwn as absent from a map that has it. Both fields
// are searched now, which is the difference between "not on this map" and "not under that name".
import World from '#/engine/World.js';
import * as H from './harness.ts';
import LocType from '#/cache/config/LocType.js';
import NpcType from '#/cache/config/NpcType.js';
import { isFlagged, isZoneAllocated } from '#/engine/GameMap.js';
import { CollisionFlag } from '#/engine/routefinder/index.js';

await H.boot();

// ---------------------------------------------------------------- can a ring stand here?
const locAt = new Set<string>();
for (const zone of ((World.gameMap as any).zonemap.zones as Map<number, any>).values())
    for (const loc of zone.getAllLocsUnsafe()) locAt.add(`${loc.level},${loc.x},${loc.z}`);

function reach(lv: number, x: number, z: number, cap = 250): number {
    if (!isZoneAllocated(lv, x, z) || isFlagged(x, z, lv, CollisionFlag.WALK_BLOCKED)) return 0;
    const seen = new Set([`${x},${z}`]);
    const q: [number, number][] = [[x, z]];
    while (q.length && seen.size < cap) {
        const [cx, cz] = q.pop()!;
        for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            const nx = cx + dx, nz = cz + dz, k = `${nx},${nz}`;
            if (seen.has(k) || !isZoneAllocated(lv, nx, nz) || isFlagged(nx, nz, lv, CollisionFlag.WALK_BLOCKED)) continue;
            seen.add(k);
            q.push([nx, nz]);
        }
    }
    return seen.size;
}

function freeBlock(lv: number, x: number, z: number): boolean {
    for (let dx = -1; dx <= 1; dx++)
        for (let dz = -1; dz <= 1; dz++) {
            const tx = x + dx, tz = z + dz;
            if (!isZoneAllocated(lv, tx, tz)) return false;
            if (isFlagged(tx, tz, lv, CollisionFlag.WALK_BLOCKED)) return false;
            if (locAt.has(`${lv},${tx},${tz}`)) return false;
        }
    return true;
}

function near(lv: number, x: number, z: number, r = 16): string[] {
    const names = new Map<string, number>();
    for (const zone of ((World.gameMap as any).zonemap.zones as Map<number, any>).values())
        for (const loc of zone.getAllLocsUnsafe()) {
            if (loc.level !== lv || Math.abs(loc.x - x) > r || Math.abs(loc.z - z) > r) continue;
            const nm = LocType.get(loc.type).debugname;
            if (nm && !/^loc_/.test(nm)) names.set(nm, (names.get(nm) ?? 0) + 1);
        }
    for (const npc of World.npcs) {
        if (!npc || npc.level !== lv) continue;
        if (Math.abs(npc.x - x) > r || Math.abs(npc.z - z) > r) continue;
        const t = NpcType.get(npc.type);
        const nm = t.name ?? t.debugname;
        if (nm) names.set('npc:' + nm, (names.get('npc:' + nm) ?? 0) + 1);
    }
    return [...names.entries()].sort((a, b) => a[1] - b[1]).slice(0, 7).map(([n, c]) => (c > 1 ? `${n}x${c}` : n));
}

// These four are caves and other realms, so the outdoors test ringsites.ts uses does not apply -
// everything here is meant to be enclosed. What still has to hold: nine free tiles, inside one
// map square, and somewhere a player can actually walk once they arrive.
// The abyss and the TzHaar city are caves, so ringsites.ts's outdoors test does not apply there -
// they are meant to be enclosed. The Fisher King's realm is not: a first pass put its ring among
// painting2_king and six suits of armour, which is his throne room. `open` asks for the same
// wall-bounded-box test ringsites.ts uses, so that one lands on the realm's grass instead.
const AREAS: [string, number, number, number, boolean][] = [
    ['ALR  Abyssal Area', 0, 3025, 4830, false],
    ['BLP  TzHaar city', 0, 2440, 5150, false],
    ['BJR  Fisher King realm (outdoors)', 0, 2629, 4675, true]
];

function openSky(lv: number, x: number, z: number, span = 13, cap = 260): boolean {
    const seen = new Set([`${x},${z}`]);
    const q: [number, number][] = [[x, z]];
    let x0 = x, x1 = x, z0 = z, z1 = z;
    while (q.length && seen.size < cap) {
        const [cx, cz] = q.pop()!;
        for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            const nx = cx + dx, nz = cz + dz;
            if (Math.abs(nx - x) > span || Math.abs(nz - z) > span) continue;
            const k = `${nx},${nz}`;
            if (seen.has(k) || !isZoneAllocated(lv, nx, nz) || isFlagged(nx, nz, lv, CollisionFlag.WALK_BLOCKED)) continue;
            seen.add(k);
            q.push([nx, nz]);
            if (nx < x0) x0 = nx;
            if (nx > x1) x1 = nx;
            if (nz < z0) z0 = nz;
            if (nz > z1) z1 = nz;
        }
    }
    return x1 - x0 >= span && z1 - z0 >= span;
}

for (const [label, lv, x, z, open] of AREAS) {
    let best: { x: number; z: number; d: number } | null = null;
    for (let dx = -22; dx <= 22; dx++)
        for (let dz = -22; dz <= 22; dz++) {
            const tx = x + dx, tz = z + dz;
            if (tx % 64 < 1 || tx % 64 > 62 || tz % 64 < 1 || tz % 64 > 62) continue;
            if (!freeBlock(lv, tx, tz)) continue;
            if (open && !openSky(lv, tx, tz)) continue;
            const d = Math.abs(dx) + Math.abs(dz);
            if (!best || d < best.d) best = { x: tx, z: tz, d };
        }
    console.log(`\n== ${label}`);
    if (!best) {
        console.log('   NO FREE 3x3 within 22 - cannot take a ring');
        continue;
    }
    console.log(`   ${best.x},${best.z} lvl${lv}   ${best.d} off, reach ${reach(lv, best.x, best.z)}`);
    console.log(`   near: ${near(lv, best.x, best.z).join(', ') || '(nothing named)'}`);
}
process.exit(0);
