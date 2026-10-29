// JALSAVRAH AS THE ENGINE SEES IT: the eight rooms of Pyramid Plunder, flooded one at a time, with
// every urn, chest, sarcophagus, spear trap and tomb door assigned to the room it is actually in.
//
// The rooms are sealed from each other by their tomb doors, so a flood from one room's Grand Gold
// Chest IS the room - which is the only honest way to say which urn belongs to which room, and so
// which Thieving level and loot tier it should use. Guessing from a bounding box around the chest
// puts a neighbour's doors in the wrong room; the map squares' rooms are not rectangles.
//
//   npx tsx tools/sim/plunderprobe.ts
import { readFileSync } from 'fs';

import * as H from './harness.ts';
import LocType from '#/cache/config/LocType.js';
import World from '#/engine/World.js';
import { canTravel, reachedLoc } from '#/engine/GameMap.js';
import { CollisionType } from '#/engine/routefinder/index.js';

await H.boot();

const BX = 30 * 64,
    BZ = 69 * 64;

// Seed the square so its zones are allocated and measured, not assumed.
{
    const p = H.makePlayer('plunder_seed', BX + 32, BZ + 32);
    p.teleport(BX + 32, BZ + 32, 0);
    H.tick(2);
}

type Row = { name: string; x: number; z: number; level: number; shape: number; angle: number };
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
        if (!m) continue;
        const name = LocType.get(Number(m[4]))?.debugname ?? m[4];
        if (!/^plunder_/.test(name)) continue;
        rows.push({ name, level: Number(m[1]), x: BX + Number(m[2]), z: BZ + Number(m[3]), shape: Number(m[5]), angle: Number(m[6] ?? 0) });
    }
}
console.log(`${rows.length} plunder locs placed`);

const key = (x: number, z: number) => (x << 16) | z;
const flood = (x: number, z: number, level: number): Set<number> => {
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
            if (seen.has(key(nx, nz))) continue;
            if (!canTravel(level, cx, cz, dx, dz, 1, 0, CollisionType.NORMAL)) continue;
            seen.add(key(nx, nz));
            q.push([nx, nz]);
        }
    }
    return seen;
};

// A loc belongs to the room whose flood touches it.
const touches = (room: Set<number>, r: Row): boolean => {
    const id = LocType.getId(r.name);
    const type = LocType.get(id) as unknown as { forceapproach: number };
    const loc = World.getLoc(r.x, r.z, r.level, id);
    if (!loc) return false;
    for (const packed of room) {
        const x = packed >>> 16,
            z = packed & 0xffff;
        if (Math.abs(x - r.x) > 4 || Math.abs(z - r.z) > 4) continue;
        if (reachedLoc(r.level, x, z, loc.x, loc.z, loc.width, loc.length, 1, loc.angle, loc.shape, type.forceapproach)) return true;
    }
    return false;
};

const chests = rows.filter(r => r.name === 'plunder_chest').sort((a, b) => a.z - b.z || a.x - b.x);
console.log(`\n${chests.length} Grand Gold Chests -> ${chests.length} rooms\n`);

const roomOf = new Map<string, number>();
const floods: Set<number>[] = [];
chests.forEach((c, _ii) => {
    // The chest is 3x1 and blocks, so flood from the tile in front of it.
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
        if (canTravel(c.level, x, z, 1, 0, 1, 0, CollisionType.NORMAL) || canTravel(c.level, x, z, 0, 1, 1, 0, CollisionType.NORMAL)) {
            seed = [x, z];
            break;
        }
    }
    if (!seed) {
        console.log(`chest ${c.x},${c.z}: nothing beside it`);
        floods.push(new Set());
        return;
    }
    floods.push(flood(seed[0], seed[1], c.level));
});

for (let i = 0; i < chests.length; i++) {
    const room = floods[i];
    const mine = rows.filter(r => touches(room, r));
    for (const r of mine) roomOf.set(`${r.name}@${r.x},${r.z}`, i);
    const xs = [...room].map(p => p >>> 16),
        zs = [...room].map(p => p & 0xffff);
    const tally: Record<string, number> = {};
    for (const r of mine) tally[r.name.replace(/_\d+$/, m => m)] = (tally[r.name] ?? 0) + 1;
    console.log(`room ${i + 1}: chest ${chests[i].x},${chests[i].z}  ${room.size} floor tiles, x ${Math.min(...xs)}-${Math.max(...xs)} z ${Math.min(...zs)}-${Math.max(...zs)}`);
    const urns = mine.filter(r => /^plunder_urn_\d+$/.test(r.name));
    const doors = mine.filter(r => /^plunder_door_\d$/.test(r.name));
    const traps = mine.filter(r => r.name === 'plunder_speartrap');
    const sarc = mine.filter(r => r.name === 'plunder_sarcophagus');
    const exits = mine.filter(r => /^plunder_exit/.test(r.name));
    console.log(`   urns ${urns.length}: ${urns.map(u => `${u.name.replace('plunder_urn_', '')}@${u.x},${u.z}`).join(' ')}`);
    console.log(`   doors ${doors.length}: ${doors.map(d => `${d.name.replace('plunder_door_', '')}@${d.x},${d.z} r${d.angle}`).join(' ')}`);
    console.log(`   traps ${traps.length}: ${traps.map(t => `${t.x},${t.z} r${t.angle}`).join(' ')}`);
    console.log(`   sarcophagus: ${sarc.map(s => `${s.x},${s.z} r${s.angle}`).join(' ') || 'NONE'}`);
    console.log(`   exits ${exits.length}: ${exits.map(e => `${e.x},${e.z}`).join(' ')}`);
}

// Anything the floods did not claim.
const orphans = rows.filter(r => !roomOf.has(`${r.name}@${r.x},${r.z}`) && !/^plunder_(bust|obelisk|mural|urn_d|sarcophagus_b)/.test(r.name));
console.log(`\n${orphans.length} interactive locs in no room:`);
for (const r of orphans.slice(0, 40)) console.log(`   ${r.name} ${r.x},${r.z} L${r.level}`);
process.exit(0);
