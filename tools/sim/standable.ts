// Can a player actually stand there, and get there?
//
//   npx tsx tools/sim/standable.ts <x>,<z>[,<level>] ...
//
// Two different questions, and only asking the first one is how an npc ends up on a tile nobody can
// reach. `blocked` is the tile itself; `reaches` floods out from it and says how much of the world
// is joined to it. A tile that is clear but reaches 1 is an island.
//
// USE CollisionFlag.WALK_BLOCKED, WHICH IS 0x240100 AND NOT 0x1. A bare 0x1 is a bit nothing sets,
// so it answers "not blocked" for every tile on the map including solid rock - which is exactly the
// wrong answer to be confident about.
import * as H from './harness.ts';
import { isFlagged, canTravel, isZoneAllocated } from '#/engine/GameMap.js';
import { CollisionFlag, CollisionType } from '#/engine/routefinder/index.js';

await H.boot();

export function reach(level: number, x: number, z: number, cap = 400): number {
    if (!isZoneAllocated(level, x, z) || isFlagged(x, z, level, CollisionFlag.WALK_BLOCKED)) return 0;
    const seen = new Set([`${x},${z}`]);
    const q: [number, number][] = [[x, z]];
    while (q.length && seen.size < cap) {
        const [cx, cz] = q.pop()!;
        for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            const k = `${cx + dx},${cz + dz}`;
            if (!seen.has(k) && canTravel(level, cx, cz, dx, dz, 1, 0, CollisionType.NORMAL)) {
                seen.add(k);
                q.push([cx + dx, cz + dz]);
            }
        }
    }
    return seen.size;
}

const args = process.argv.slice(2);
if (!args.length) throw new Error('give at least one x,z[,level], or: near <x>,<z>[,level]');

// `near` answers the question a blocked coordinate actually raises: where NEAR here can somebody
// stand? The wiki's {{Map}} markers carry a radius (r=2 to r=8), so a coordinate off one is the
// middle of a marker rather than a tile, and landing on a wall is expected rather than surprising.
if (args[0] === 'near') {
    const [x, z, lv] = args[1].split(',').map(Number);
    const level = lv ?? 0;
    const found: [number, number, number, number][] = [];
    for (let dx = -8; dx <= 8; dx++) {
        for (let dz = -8; dz <= 8; dz++) {
            const r = reach(level, x + dx, z + dz);
            if (r >= 10) found.push([Math.max(Math.abs(dx), Math.abs(dz)), x + dx, z + dz, r]);
        }
    }
    found.sort((a, b) => a[0] - b[0] || b[3] - a[3]);
    console.log(`standable tiles near (${x},${z},${level}), nearest first:`);
    for (const [d, fx, fz, r] of found.slice(0, 6)) {
        console.log(`  ${d} away  (${fx},${fz})  reaches ${r >= 400 ? '400+' : r}`);
    }
    if (!found.length) console.log('  nothing within 8 tiles');
    process.exit(0);
}
for (const a of args) {
    const [x, z, lv] = a.split(',').map(Number);
    const level = lv ?? 0;
    const alloc = isZoneAllocated(level, x, z);
    const blocked = alloc && isFlagged(x, z, level, CollisionFlag.WALK_BLOCKED);
    const r = reach(level, x, z);
    const verdict = !alloc ? 'NO ZONE' : blocked ? 'BLOCKED' : r < 10 ? `ISLAND (reaches ${r})` : 'ok';
    console.log(`(${x},${z},${level})`.padEnd(18) + `${verdict.padEnd(22)} reaches ${r >= 400 ? '400+' : r}`);
}
process.exit(0);
