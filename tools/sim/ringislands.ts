// THE FOUR DESTINATIONS NO NAME WILL FIND.
//
//   npx tsx tools/sim/ringislands.ts
//
// findmarks.ts finds a place by the loc or npc that only exists there. Two of RuneScape's fairy
// ring destinations have no such landmark - they are empty islands - and two more are areas whose
// map data exists while nothing on it carries the name. So this works the other way round:
//   * for the islands, find every small landmass in a region and say how big it is, because
//     "an island" is a geometric fact, not a name;
//   * for the two areas, probe the coordinate and print what is around it, which is the only
//     thing that can tell a real find from a wrong guess.
import World from '#/engine/World.js';
import * as H from './harness.ts';
import LocType from '#/cache/config/LocType.js';
import NpcType from '#/cache/config/NpcType.js';
import { isFlagged, isZoneAllocated } from '#/engine/GameMap.js';
import { CollisionFlag } from '#/engine/routefinder/index.js';

await H.boot();

const locAt = new Set<string>();
for (const zone of ((World.gameMap as any).zonemap.zones as Map<number, any>).values())
    for (const loc of zone.getAllLocsUnsafe()) locAt.add(`${loc.level},${loc.x},${loc.z}`);

/** The connected walkable area containing this tile, up to `cap`. Returns the tiles. */
function flood(lv: number, x: number, z: number, cap: number): Set<string> {
    const seen = new Set<string>();
    if (!isZoneAllocated(lv, x, z) || isFlagged(x, z, lv, CollisionFlag.WALK_BLOCKED)) return seen;
    seen.add(`${x},${z}`);
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
    return seen;
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
    return [...names.entries()].sort((a, b) => a[1] - b[1]).slice(0, 8).map(([n, c]) => (c > 1 ? `${n}x${c}` : n));
}

// ---------------------------------------------------------------- the two named areas
const AREAS: [string, number, number, number][] = [
    ['DLS  Myreque hideout under The Hollows', 0, 3498, 9821],
    ['DLR  Poison Waste, southern Tirannwn', 0, 2200, 3060],
    ['DLR  alt: further north in Tirannwn', 0, 2200, 3120]
];
for (const [label, lv, x, z] of AREAS) {
    console.log(`\n== ${label}  (target ${x},${z})`);
    if (!isZoneAllocated(lv, x, z)) {
        console.log('   no map data at that tile');
        continue;
    }
    let best: { x: number; z: number; d: number } | null = null;
    for (let dx = -20; dx <= 20; dx++)
        for (let dz = -20; dz <= 20; dz++) {
            const tx = x + dx, tz = z + dz;
            if (tx % 64 < 1 || tx % 64 > 62 || tz % 64 < 1 || tz % 64 > 62) continue;
            if (!freeBlock(lv, tx, tz)) continue;
            const d = Math.abs(dx) + Math.abs(dz);
            if (!best || d < best.d) best = { x: tx, z: tz, d };
        }
    if (!best) {
        console.log('   no free 3x3 within 20');
        continue;
    }
    console.log(`   ${best.x},${best.z}  ${best.d} off, reach ${flood(lv, best.x, best.z, 300).size}`);
    console.log(`   near: ${near(lv, best.x, best.z).join(', ') || '(nothing named)'}`);
}

// ---------------------------------------------------------------- the two islands
// An island is a walkable area small enough to be surrounded by water. Scanned on a coarse grid
// and clustered, so each landmass is reported once rather than per tile.
const REGIONS: [string, number, number, number, number][] = [
    ['AIR  island SE of Ardougne', 2660, 2820, 3170, 3300],
    ['BIP  island on the Salve, SW of Mort Myre', 3370, 3460, 3280, 3390]
];
for (const [label, x0, x1, z0, z1] of REGIONS) {
    console.log(`\n== ${label}   x ${x0}-${x1}, z ${z0}-${z1}`);
    const found: { x: number; z: number; size: number }[] = [];
    const claimed = new Set<string>();
    for (let x = x0; x <= x1; x += 3) {
        for (let z = z0; z <= z1; z += 3) {
            if (claimed.has(`${x},${z}`)) continue;
            if (!isZoneAllocated(0, x, z) || isFlagged(x, z, 0, CollisionFlag.WALK_BLOCKED)) continue;
            const area = flood(0, x, z, 400);
            for (const k of area) claimed.add(k);
            // >=400 is the mainland; a 9-tile ring needs at least a few dozen tiles to sit in
            if (area.size >= 400 || area.size < 20) continue;
            found.push({ x, z, size: area.size });
        }
    }
    if (!found.length) {
        console.log('   no island between 20 and 400 tiles in this region');
        continue;
    }
    for (const f of found.slice(0, 6)) {
        // the best ring tile on this island
        let spot: { x: number; z: number } | null = null;
        for (let dx = -20; dx <= 20 && !spot; dx++)
            for (let dz = -20; dz <= 20 && !spot; dz++) {
                const tx = f.x + dx, tz = f.z + dz;
                if (tx % 64 < 1 || tx % 64 > 62 || tz % 64 < 1 || tz % 64 > 62) continue;
                if (freeBlock(0, tx, tz) && flood(0, tx, tz, 400).size === f.size) spot = { x: tx, z: tz };
            }
        console.log(`   island of ${f.size} tiles near ${f.x},${f.z}` + (spot ? `  -> ring at ${spot.x},${spot.z}` : '  -> NO free 3x3 on it'));
        if (spot) console.log(`      near: ${near(0, spot.x, spot.z).join(', ') || '(nothing named)'}`);
    }
}
process.exit(0);
