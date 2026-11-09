// WHERE EXACTLY DOES EACH NEW FAIRY RING GO?
//
//   npx tsx tools/sim/ringsites.ts
//
// "Standable ground" is nearly useless on its own: the ring already live at 3082,3206 passed it
// while being labelled Port Sarim, when it is really a 40-tile islet (OSRS calls it Draynor
// island). Three of this run's first-draft coordinates were likewise in the wrong place - the
// "polar hunter area" landed on Piscatoris, next to an existing ring - so a spot is only accepted
// here if it is clear, empty of scenery, joined to the mainland, AND its surroundings name the
// place it is supposed to be.
import World from '#/engine/World.js';
import * as H from './harness.ts';
import LocType from '#/cache/config/LocType.js';
import NpcType from '#/cache/config/NpcType.js';
import { isFlagged, isZoneAllocated } from '#/engine/GameMap.js';
import { CollisionFlag } from '#/engine/routefinder/index.js';

await H.boot();

// Every loc on the map, by tile, so a candidate can refuse a tile that already holds scenery.
const locAt = new Map<string, string[]>();
for (const zone of ((World.gameMap as any).zonemap.zones as Map<number, any>).values()) {
    for (const loc of zone.getAllLocsUnsafe()) {
        if (loc.level !== 0) continue;
        const k = `${loc.x},${loc.z}`;
        const nm = LocType.get(loc.type).debugname ?? 'loc_' + loc.type;
        const a = locAt.get(k);
        if (a) a.push(nm);
        else locAt.set(k, [nm]);
    }
}

function reach(x: number, z: number, cap = 250): number {
    if (!isZoneAllocated(0, x, z) || isFlagged(x, z, 0, CollisionFlag.WALK_BLOCKED)) return 0;
    const seen = new Set([`${x},${z}`]);
    const q: [number, number][] = [[x, z]];
    while (q.length && seen.size < cap) {
        const [cx, cz] = q.pop()!;
        for (const [dx, dz] of [
            [1, 0],
            [-1, 0],
            [0, 1],
            [0, -1]
        ]) {
            const nx = cx + dx,
                nz = cz + dz;
            const k = `${nx},${nz}`;
            if (seen.has(k) || !isZoneAllocated(0, nx, nz) || isFlagged(nx, nz, 0, CollisionFlag.WALK_BLOCKED)) continue;
            seen.add(k);
            q.push([nx, nz]);
        }
    }
    return seen.size;
}

/** A ring is nine locs in a 3x3. Every tile must be walkable AND hold nothing already. */
function freeBlock(x: number, z: number): boolean {
    for (let dx = -1; dx <= 1; dx++)
        for (let dz = -1; dz <= 1; dz++) {
            const tx = x + dx,
                tz = z + dz;
            if (!isZoneAllocated(0, tx, tz)) return false;
            if (isFlagged(tx, tz, 0, CollisionFlag.WALK_BLOCKED)) return false;
            if (locAt.has(`${tx},${tz}`)) return false;
        }
    return true;
}

function bestSpot(x: number, z: number, r = 14) {
    let best: { x: number; z: number; d: number; reach: number } | null = null;
    for (let dx = -r; dx <= r; dx++)
        for (let dz = -r; dz <= r; dz++) {
            const tx = x + dx,
                tz = z + dz;
            if (!freeBlock(tx, tz)) continue;
            const d = Math.abs(dx) + Math.abs(dz);
            if (best && d >= best.d) continue;
            best = { x: tx, z: tz, d, reach: -1 };
        }
    if (best) best.reach = reach(best.x, best.z);
    return best;
}

function neighbours(x: number, z: number, r = 18): string[] {
    const names = new Map<string, number>();
    for (let dx = -r; dx <= r; dx++)
        for (let dz = -r; dz <= r; dz++)
            for (const nm of locAt.get(`${x + dx},${z + dz}`) ?? []) {
                if (/^loc_/.test(nm)) continue;
                names.set(nm, (names.get(nm) ?? 0) + 1);
            }
    for (const npc of World.npcs) {
        if (!npc || npc.level !== 0) continue;
        if (Math.abs(npc.x - x) > r || Math.abs(npc.z - z) > r) continue;
        const t = NpcType.get(npc.type);
        const nm = t.name ?? t.debugname;
        if (nm) names.set('npc:' + nm, (names.get('npc:' + nm) ?? 0) + 1);
    }
    return [...names.entries()]
        .sort((a, b) => a[1] - b[1])
        .slice(0, 8)
        .map(([n, c]) => (c > 1 ? `${n}x${c}` : n));
}

// Targets, with the three first-draft coordinates corrected from landmark positions found in our
// own data: BIS from the zoo Penguin at 2594,3267, CKP from cosmic_altar at 2141,4832, DKS from
// Sabre-toothed kebbit at 2708,3772. AJS (Cold War penguins) and DJP (Tower of Life) are dropped:
// neither exists anywhere on this map.
const CANDS: [string, string, number, number][] = [
    ['AIQ', 'Mudskipper Point', 2996, 3114],
    ['AJR', 'Slayer cave SE of Rellekka', 2780, 3614],
    ['AKS', 'Feldip Hunter area', 2556, 2923],
    ['ALP', 'Lighthouse', 2501, 3636],
    ['ALQ', 'Haunted Woods E of Canifis', 3601, 3524],
    ['BIQ', 'nr Kalphite Hive', 3230, 3105],
    ['BIS', 'Ardougne Zoo', 2600, 3276],
    ['BKP', 'Chompy Marsh', 2400, 3045],
    ['BKR', 'Mort Myre S of Canifis', 3469, 3431],
    ['BLR', "Legends' Guild", 2733, 3353],
    ['CIP', 'Miscellania', 2513, 3886],
    ['CIQ', 'NW of Yanille', 2528, 3127],
    ['CKP', 'Cosmic entity plane', 2150, 4832],
    ['CKR', 'S of Tai Bwo Wannai', 2801, 3003],
    ['CKS', 'Canifis', 3447, 3470],
    ['CLR', 'Ape Atoll', 2707, 2787],
    ['DIS', "Wizards' Tower", 3108, 3149],
    ['DKP', 'Karamja gnome glider', 2970, 2977],
    ['DKS', 'Polar Hunter area', 2706, 3776],
    ['DLQ', 'N of Nardah', 3423, 3016]
];

for (const [code, name, x, z] of CANDS) {
    const spot = isZoneAllocated(0, x, z) ? bestSpot(x, z) : null;
    if (!spot) {
        console.log(`${code}  ${name}\n    NO FREE 3x3 within 14 of ${x},${z}\n`);
        continue;
    }
    const bad = spot.reach < 250 ? '  ** ENCLOSED **' : '';
    console.log(`${code}  ${name}`);
    console.log(`    ${spot.x},${spot.z}   ${spot.d} off target, reach ${spot.reach}${bad}`);
    console.log(`    near: ${neighbours(spot.x, spot.z).join(', ') || '(nothing named)'}\n`);
}
process.exit(0);
