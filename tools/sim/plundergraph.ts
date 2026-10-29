// WHICH ROOM IS BEHIND WHICH TOMB DOOR. The eight rooms of Jalsavrah are sealed from each other by
// their tomb doors; between them are short corridors. This takes each door, steps to the far side
// of it, floods the corridor there, and says which other rooms that corridor touches - so the room
// order is read off the map rather than chosen.
//
//   npx tsx tools/sim/plundergraph.ts
import { readFileSync } from 'fs';

import * as H from './harness.ts';
import LocType from '#/cache/config/LocType.js';
import { canTravel } from '#/engine/GameMap.js';
import { CollisionType } from '#/engine/routefinder/index.js';

await H.boot();

const BX = 30 * 64,
    BZ = 69 * 64;
{
    const p = H.makePlayer('plunder_graph_seed', BX + 32, BZ + 32);
    p.teleport(BX + 32, BZ + 32, 0);
    H.tick(2);
}

type Row = { name: string; x: number; z: number; shape: number; angle: number };
const rows: Row[] = [];
{
    const text = readFileSync('../content/maps/m30_69.jm2', 'utf8');
    let section = '';
    for (const line of text.split(/\r?\n/)) {
        if (line.startsWith('====')) {
            section = line.replace(/=/g, '').trim();
            continue;
        }
        if (section !== 'LOC') continue;
        const m = /^(\d+) (\d+) (\d+): (\d+) (\d+)(?: (\d+))?\s*$/.exec(line);
        if (!m || m[1] !== '0') continue;
        const name = LocType.get(Number(m[4]))?.debugname ?? m[4];
        if (!/^plunder_/.test(name)) continue;
        rows.push({ name, x: BX + Number(m[2]), z: BZ + Number(m[3]), shape: Number(m[5]), angle: Number(m[6] ?? 0) });
    }
}

const key = (x: number, z: number) => (x << 16) | z;
const flood = (x: number, z: number, stop: Set<number> = new Set()): Set<number> => {
    const seen = new Set<number>([key(x, z)]);
    const q: [number, number][] = [[x, z]];
    while (q.length) {
        const [cx, cz] = q.shift()!;
        for (const [dx, dz] of [
            [1, 0],
            [-1, 0],
            [0, 1],
            [0, -1]
        ]) {
            const nx = cx + dx,
                nz = cz + dz;
            if (nx < BX || nx > BX + 63 || nz < BZ || nz > BZ + 63) continue;
            const k = key(nx, nz);
            if (seen.has(k) || stop.has(k)) continue;
            if (!canTravel(0, cx, cz, dx, dz, 1, 0, CollisionType.NORMAL)) continue;
            seen.add(k);
            q.push([nx, nz]);
        }
    }
    return seen;
};

// The rooms, as plunderprobe finds them: a flood from beside each Grand Gold Chest.
const chests = rows.filter(r => r.name === 'plunder_chest').sort((a, b) => a.z - b.z || a.x - b.x);
const roomTiles: Set<number>[] = [];
for (const c of chests) {
    let seed: [number, number] | null = null;
    for (const [dx, dz] of [
        [0, -1],
        [0, 1],
        [-1, 0],
        [1, 0],
        [0, -2],
        [0, 2]
    ]) {
        const x = c.x + dx,
            z = c.z + dz;
        if (canTravel(0, x, z, 1, 0, 1, 0, CollisionType.NORMAL) || canTravel(0, x, z, 0, 1, 1, 0, CollisionType.NORMAL)) {
            seed = [x, z];
            break;
        }
    }
    roomTiles.push(seed ? flood(seed[0], seed[1]) : new Set());
}
const roomOfTile = (x: number, z: number): number => roomTiles.findIndex(s => s.has(key(x, z)));
const label = (i: number) => (i < 0 ? '-' : `R${i + 1}(${chests[i].x},${chests[i].z})`);

// Every room tile, so a corridor flood stops at a room rather than swallowing it.
const allRoom = new Set<number>();
for (const s of roomTiles) for (const k of s) allRoom.add(k);

// A wall loc (shape 0) sits on the edge of its own tile; the angle says which edge, and so which
// tile is on the far side.
const FAR: Record<number, [number, number]> = { 0: [-1, 0], 1: [0, 1], 2: [1, 0], 3: [0, -1] };

console.log('rooms:');
chests.forEach((c, i) => console.log(`  ${label(i)}  ${roomTiles[i].size} tiles`));

console.log('\ndoors:');
for (const d of rows.filter(r => /^plunder_door_\d$/.test(r.name)).sort((a, b) => a.x - b.x || a.z - b.z)) {
    const [dx, dz] = FAR[d.angle];
    const inner = roomOfTile(d.x, d.z);
    const outerX = d.x + dx,
        outerZ = d.z + dz;
    const corridor = allRoom.has(key(outerX, outerZ)) ? new Set([key(outerX, outerZ)]) : flood(outerX, outerZ, allRoom);
    // Which rooms does that corridor border? Any room tile orthogonally beside a corridor tile.
    const borders = new Set<number>();
    for (const k of corridor) {
        const x = k >>> 16,
            z = k & 0xffff;
        for (const [ax, az] of [
            [1, 0],
            [-1, 0],
            [0, 1],
            [0, -1]
        ]) {
            const r = roomOfTile(x + ax, z + az);
            if (r >= 0) borders.add(r);
        }
    }
    const fromOuter = roomOfTile(outerX, outerZ);
    if (fromOuter >= 0) borders.add(fromOuter);
    borders.delete(inner);
    console.log(`  ${d.name} ${d.x},${d.z} r${d.angle}: in ${label(inner)} -> corridor of ${corridor.size} tiles -> ${[...borders].map(label).join(', ') || 'DEAD END'}`);
}

console.log('\nspear traps (the way into a room):');
for (const t of rows.filter(r => r.name === 'plunder_speartrap').sort((a, b) => a.x - b.x || a.z - b.z)) {
    const sides = [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1]
    ]
        .map(([dx, dz]) => roomOfTile(t.x + dx, t.z + dz))
        .filter(r => r >= 0);
    console.log(`  ${t.x},${t.z} r${t.angle}: beside ${[...new Set(sides)].map(label).join(', ') || 'no room'}`);
}

// ---- the room table, in the form the content wants -------------------------------------------
// Each room is entered through its spear trap from the corridor outside it. The trap is two 2x1
// locs side by side making a two-wide doorway; the tile on the corridor side is where the player
// arrives, and the tile on the room side is where passing it puts them.
console.log('');
console.log('room table:');
const roomTrap = (i: number) =>
    rows
        .filter(r => r.name === 'plunder_speartrap')
        .filter(t =>
            [
                [1, 0],
                [-1, 0],
                [0, 1],
                [0, -1]
            ].some(([dx, dz]) => roomOfTile(t.x + dx, t.z + dz) === i)
        );
for (let i = 0; i < chests.length; i++) {
    const traps = roomTrap(i);
    // The trap is four 2x1 locs making one barrier across the corridor. Its footprint turns with
    // the placement angle - 2x1 at angles 0 and 2, 1x2 at 1 and 3 - and what matters is the
    // standable tile on each side of the whole barrier, not of any one loc.
    const barrier = new Set<number>();
    for (const t of traps) {
        const w = t.angle % 2 === 1 ? 1 : 2;
        const l = t.angle % 2 === 1 ? 2 : 1;
        for (let dx = 0; dx < w; dx++) for (let dz = 0; dz < l; dz++) barrier.add(key(t.x + dx, t.z + dz));
    }
    const outside = new Set<string>(),
        inside = new Set<string>();
    for (const b of barrier) {
        const bx = b >>> 16,
            bz = b & 0xffff;
        for (const [dx, dz] of [
            [1, 0],
            [-1, 0],
            [0, 1],
            [0, -1]
        ]) {
            const x = bx + dx,
                z = bz + dz;
            if (barrier.has(key(x, z))) continue;
            const walkable = [
                [1, 0],
                [-1, 0],
                [0, 1],
                [0, -1]
            ].some(([ax, az]) => canTravel(0, x + ax, z + az, -ax, -az, 1, 0, CollisionType.NORMAL));
            if (!walkable) continue;
            if (roomTiles[i].has(key(x, z))) inside.add(`${x},${z}`);
            else if (roomOfTile(x, z) < 0) outside.add(`${x},${z}`);
        }
    }
    const mine = (re: RegExp) =>
        rows
            .filter(r => re.test(r.name))
            .filter(r =>
                [
                    [0, 0],
                    [1, 0],
                    [-1, 0],
                    [0, 1],
                    [0, -1],
                    [1, 1],
                    [-1, -1],
                    [1, -1],
                    [-1, 1]
                ].some(([dx, dz]) => roomOfTile(r.x + dx, r.z + dz) === i)
            );
    console.log(`R${i + 1} chest ${chests[i].x},${chests[i].z}`);
    console.log(`   trap locs : ${traps.map(t => `${t.x},${t.z}`).join(' ')}`);
    console.log(`   outside   : ${[...outside].join(' ')}`);
    console.log(`   inside    : ${[...inside].join(' ')}`);
    console.log(
        `   sarc      : ${mine(/^plunder_sarcophagus$/)
            .map(r => `${r.x},${r.z}`)
            .join(' ')}`
    );
    console.log(
        `   doors     : ${mine(/^plunder_door_\d$/)
            .map(r => `${r.name.slice(-1)}:${r.x},${r.z}`)
            .join(' ')}`
    );
    console.log(
        `   exits     : ${mine(/^plunder_exit/)
            .map(r => `${r.x},${r.z}`)
            .join(' ')}`
    );
    console.log(
        `   urns      : ${mine(/^plunder_urn_\d+$/)
            .map(r => `${r.name.replace('plunder_urn_', '')}:${r.x},${r.z}`)
            .join(' ')}`
    );
}
process.exit(0);
