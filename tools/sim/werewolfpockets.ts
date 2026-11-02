// THE POCKETS OF THE WEREWOLF AGILITY COURSE, and where the deathslide can possibly land.
//
// werewolfland.ts showed the course is a chain of sealed pockets with one obstacle between each:
// 1007 (the entry, with the exit ladder) -> stones -> 84 -> hurdles -> 16 -> 15 -> 43 -> pipe ->
// 73 -> skull slope -> 14 -> zip line -> back to the entry. The one landing the map does not hand
// over is the zip line's, because a deathslide crosses open ground rather than going through
// anything. So: the extent of every pocket, and the part of the entry pocket nearest the slide.
import * as H from './harness.ts';
import { canTravel, isFlagged } from '#/engine/GameMap.js';
import { CollisionFlag, CollisionType } from '#/engine/routefinder/index.js';
import { drawn, onLoc } from './mapfloor.ts';

await H.boot();

const DIRS: [number, number][] = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1]
];

function pocket(x: number, z: number, cap = 4000) {
    const seen = new Set<string>([x + ',' + z]);
    const q: [number, number][] = [[x, z]];
    while (q.length && seen.size < cap) {
        const [cx, cz] = q.shift()!;
        for (const [dx, dz] of DIRS) {
            const k = cx + dx + ',' + (cz + dz);
            if (seen.has(k) || !canTravel(0, cx, cz, dx, dz, 1, 0, CollisionType.NORMAL)) continue;
            seen.add(k);
            q.push([cx + dx, cz + dz]);
        }
    }
    return seen;
}

for (const [x, z] of [[3540, 9870], [3540, 9880], [3540, 9895], [3540, 9906], [3532, 9910], [3528, 9910], [3549, 9864], [3550, 9880]] as [number, number][]) {
    const p = H.makePlayer(`wp_${x}_${z}`, x, z);
    p.teleport(x, z, 0);
    H.tick(2);
}

const NAMED: [string, number, number][] = [
    ['entry / exit ladder', 3549, 9865],
    ['after the stones', 3540, 9882],
    ['between hurdle 1 and 2', 3539, 9894],
    ['between hurdle 2 and 3', 3539, 9897],
    ['after hurdle 3 / before pipes', 3539, 9901],
    ['slope foot (after the pipes)', 3533, 9910],
    ['slope top (the slide)', 3531, 9910]
];

const seen: { name: string; tiles: Set<string>; box: number[] }[] = [];
for (const [name, x, z] of NAMED) {
    const tiles = pocket(x, z);
    let x0 = 9999, x1 = 0, z0 = 99999, z1 = 0;
    for (const t of tiles) {
        const [tx, tz] = t.split(',').map(Number);
        x0 = Math.min(x0, tx); x1 = Math.max(x1, tx);
        z0 = Math.min(z0, tz); z1 = Math.max(z1, tz);
    }
    const dup = seen.find(s => s.tiles.size === tiles.size && s.tiles.has(x + ',' + z));
    console.log(`${name.padEnd(30)} ${String(tiles.size).padStart(5)} tiles   x ${x0}..${x1}  z ${z0}..${z1}` +
        (dup ? `   (same pocket as "${dup.name}")` : ''));
    seen.push({ name, tiles, box: [x0, x1, z0, z1] });
}

// WHICH TILES OF THE ENTRY POCKET LIE NEAREST THE SLIDE. A deathslide from 3527..3529,9910 runs
// out over the course; the landing has to be somewhere a player can stand, in the entry pocket,
// and drawn. These are the candidates, nearest the slide first.
const entry = seen[0].tiles;
const from: [number, number] = [3528, 9910];
const cands = [...entry]
    .map(t => t.split(',').map(Number) as [number, number])
    .filter(([x, z]) => drawn(x, z, 0) || onLoc(x, z, 0))
    .filter(([x, z]) => !isFlagged(x, z, 0, CollisionFlag.WALK_BLOCKED))
    .sort((a, b) => (a[0] - from[0]) ** 2 + (a[1] - from[1]) ** 2 - ((b[0] - from[0]) ** 2 + (b[1] - from[1]) ** 2));
console.log('');
console.log('entry-pocket tiles nearest the zip line at 3528,9910:');
for (const [x, z] of cands.slice(0, 12)) {
    const d = Math.max(Math.abs(x - from[0]), Math.abs(z - from[1]));
    console.log(`   ${x},${z}   ${d} tiles away   ${drawn(x, z, 0) ? 'floor' : 'on a loc'}`);
}

// and the entry pocket's own shape, so the trapdoor landing and the trainers can be placed in it
console.log('');
console.log('the entry pocket, west edge by row (where the slide would arrive):');
const byRow = new Map<number, number[]>();
for (const t of entry) {
    const [tx, tz] = t.split(',').map(Number);
    if (!byRow.has(tz)) byRow.set(tz, []);
    byRow.get(tz)!.push(tx);
}
for (const z of [...byRow.keys()].sort((a, b) => b - a).slice(0, 14)) {
    const xs = byRow.get(z)!.sort((a, b) => a - b);
    console.log(`   z ${z}:  x ${xs[0]}..${xs[xs.length - 1]}  (${xs.length} tiles)`);
}

process.exit(0);
