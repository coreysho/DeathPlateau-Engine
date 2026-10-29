// THE AGILITY PYRAMID AS THE ENGINE SEES IT: four planes of walkable tile, and every hotspot's
// click tiles. Read-only; nothing here is a test.
//
//   npx tsx tools/sim/pyrprobe.ts
import { readFileSync } from 'fs';

import * as H from './harness.ts';
import LocType from '#/cache/config/LocType.js';
import World from '#/engine/World.js';
import { canTravel, reachedLoc } from '#/engine/GameMap.js';
import { CollisionType } from '#/engine/routefinder/index.js';
import { drawn, onLoc } from './mapfloor.ts';

await H.boot();

const A = process.argv.slice(2);
const SQ = A[0] ?? 'm52_44';
const [X0, X1, Z0, Z1] = A.length > 1 ? A.slice(1, 5).map(Number) : [3352, 3378, 2828, 2854];
const [BX, BZ] = SQ.slice(1).split('_').map(n => Number(n) << 6);
const SEEDX = Math.floor((X0 + X1) / 2), SEEDZ = Math.floor((Z0 + Z1) / 2);

// A tile is standable if something beside it can step onto it, which is the question that matters:
// canTravel OUT of a tile answers yes for solid ground (see the cantravel-tests-the-destination
// memory), so the question has to be asked of a neighbour stepping in.
const standable = (x: number, z: number, level: number): boolean => {
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        if (canTravel(level, x + dx, z + dz, -dx, -dz, 1, 0, CollisionType.NORMAL)) return true;
    }
    return false;
};

// Put a player on each plane so the zones are allocated and measured rather than assumed.
for (let level = 0; level < 4; level++) {
    const p = H.makePlayer(`pyr_seed_${level}`, SEEDX, SEEDZ);
    p.teleport(SEEDX, SEEDZ, level);
    H.tick(2);
}

for (let level = 0; level < 4; level++) {
    console.log(`\n########## PLANE ${level} ##########`);
    for (let z = Z1; z >= Z0; z--) {
        let row = '';
        for (let x = X0; x <= X1; x++) {
            const st = standable(x, z, level);
            const dr = drawn(x, z, level);
            const lc = onLoc(x, z, level);
            row += st ? (dr ? '.' : (lc ? 'L' : '?')) : (dr ? '#' : (lc ? 'l' : ' '));
        }
        console.log(`${z} ${row}`);
    }
    console.log('     ' + Array.from({ length: X1 - X0 + 1 }, (_, i) => String(Math.floor((X0 + i) / 10) % 10)).join(''));
    console.log('     ' + Array.from({ length: X1 - X0 + 1 }, (_, i) => String((X0 + i) % 10)).join(''));
}
console.log('\n  . standable and drawn    # drawn but nothing can step on   L standable, on a loc');
console.log('  l blocked, on a loc      ? standable thin air               (blank) nothing');

// ---------------------------------------------------------------------------------------------
console.log('\n\n########## WHERE EACH HOTSPOT TAKES A CLICK FROM ##########');
const locsHere: { name: string; x: number; z: number; level: number }[] = [];
{
    const text = readFileSync(`../content/maps/${SQ}.jm2`, 'utf8');
    let section = '';
    for (const line of text.split(/\r?\n/)) {
        if (line.startsWith('====')) { section = line.replace(/=/g, '').trim(); continue; }
        if (section !== 'LOC') continue;
        const m = /^(\d+) (\d+) (\d+): (\d+) (\d+)(?: (\d+))?\s*$/.exec(line);
        if (!m) continue;
        const level = Number(m[1]), x = BX + Number(m[2]), z = BZ + Number(m[3]), id = Number(m[4]);
        if (x < X0 || x > X1 || z < Z0 || z > Z1) continue;
        const t = LocType.get(id);
        const nm = t?.debugname ?? String(id);
        if (!/^agility_pyramid/.test(nm)) continue;
        if (!t.op) continue;
        locsHere.push({ name: nm, x, z, level });
    }
}
locsHere.sort((a, b) => a.level - b.level || a.name.localeCompare(b.name) || a.x - b.x || a.z - b.z);
for (const { name, x, z, level } of locsHere) {
    const id = LocType.getId(name);
    const t = LocType.get(id) as unknown as { forceapproach: number; blockwalk: number; width: number; length: number; op: (string | null)[] };
    const loc = World.getLoc(x, z, level, id);
    if (!loc) { console.log(`\n${name} ${x},${z} L${level}: NOT PLACED`); continue; }
    const from: string[] = [];
    for (let dx = -3; dx <= 3; dx++) {
        for (let dz = -3; dz <= 3; dz++) {
            const cx = x + dx, cz = z + dz;
            if (!standable(cx, cz, level)) continue;
            if (reachedLoc(level, cx, cz, loc.x, loc.z, loc.width, loc.length, 1, loc.angle, loc.shape, t.forceapproach)) from.push(`${cx},${cz}`);
        }
    }
    const ops = (t.op ?? []).filter(Boolean).join('/');
    console.log(`\n${name}  ${x},${z} L${level}  shape ${loc.shape} angle ${loc.angle}  ${t.width}x${t.length}  fa ${t.forceapproach}  [${ops}]`);
    console.log(`  from: ${from.length ? from.join('  ') : 'NOWHERE'}`);
}
process.exit(0);
