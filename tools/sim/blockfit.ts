// WHERE CAN A SIZE-N NPC ACTUALLY STAND? Prints a plain walkability grid for a box and then every
// tile where an NxN footprint is entirely clear, because npc_add on a tile that does not fit the
// npc puts it there for one tick and the engine takes it away again.
//
//   npx tsx tools/sim/blockfit.ts <level> <x1>,<z1> <x2>,<z2> [size]
//
// Written for Dream Mentor: The Inadequacy is size 5 and the quest spawned it nine tiles north of
// the arena centre, next to the lectern, where a 5x5 does not fit. nearnpc saw it in the tick it
// was added and the fight step two ticks later found an empty arena.
//
// walkmap.ts answers the same question with locs drawn over it, and takes minutes on a box this
// size; this one only reads collision flags, so it is instant.
import * as H from './harness.js';
import { isFlagged, isZoneAllocated } from '#/engine/GameMap.js';
import { CollisionFlag } from '#/engine/routefinder/index.js';

await H.boot();

const level = Number(process.argv[2] ?? 0);
const [x1, z1] = (process.argv[3] ?? '0,0').split(',').map(Number);
const [x2, z2] = (process.argv[4] ?? '0,0').split(',').map(Number);
const size = Number(process.argv[5] ?? 1);

const clear = (x: number, z: number) => isZoneAllocated(level, x, z) && !isFlagged(x, z, level, CollisionFlag.WALK_BLOCKED);

console.log(`L${level} ${x1},${z1} .. ${x2},${z2}   '.' clear, '#' blocked, ' ' not allocated`);
let header = '      ';
for (let x = x1; x <= x2; x++) header += x % 10 === 0 ? String(Math.floor(x / 10) % 10) : ' ';
console.log(header);
for (let z = z2; z >= z1; z--) {
    let row = String(z).padStart(5) + ' ';
    for (let x = x1; x <= x2; x++) {
        row += !isZoneAllocated(level, x, z) ? ' ' : clear(x, z) ? '.' : '#';
    }
    console.log(row);
}

if (size > 1) {
    const fits: string[] = [];
    for (let x = x1; x + size - 1 <= x2; x++) {
        for (let z = z1; z + size - 1 <= z2; z++) {
            let ok = true;
            for (let dx = 0; dx < size && ok; dx++) {
                for (let dz = 0; dz < size && ok; dz++) {
                    if (!clear(x + dx, z + dz)) ok = false;
                }
            }
            if (ok) fits.push(`${x},${z}`);
        }
    }
    console.log('');
    console.log(`${fits.length} tiles take a ${size}x${size} footprint (south-west corner):`);
    console.log('  ' + fits.join('  '));
}
process.exit(0);
