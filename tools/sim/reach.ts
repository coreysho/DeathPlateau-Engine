// WHAT CAN YOU ACTUALLY WALK TO FROM HERE? One flood over the engine's own canTravel, printed as a
// map: '.' reachable on foot, '#' not, 'S' the start.
//
//   npx tsx tools/sim/reach.ts sx sz level x1 z1 x2 z2
//
// Closed doors block, which is the point: a failed walk in a quest run is nearly always a door or a
// staircase nobody clicked, not a bug. The Wizards' Tower ground floor is three chambers joined by
// two doors and Lumbridge Castle's is five - neither is obvious from a map screenshot, and both
// cost the Rune Mysteries run several wrong guesses before this existed.
import { H } from './a1lib.js';
import { canTravel } from '#/engine/GameMap.js';
import { CollisionType } from '#/engine/routefinder/index.js';

await H.boot();

const [sx, sz, l, x1, z1, x2, z2] = process.argv.slice(2).map(Number);

const key = (a: number, b: number) => a * 20000 + b;
const seen = new Set<number>([key(sx, sz)]);
let q: number[][] = [[sx, sz]];
// Diagonals included, because the engine walks them: a doorway that only opens on the diagonal
// reads as a sealed room without them.
const dirs = [[0, 1], [0, -1], [1, 0], [-1, 0], [1, 1], [1, -1], [-1, 1], [-1, -1]];
let n = 0;
while (q.length && n < 200000) {
    const next: number[][] = [];
    for (const [x, z] of q) {
        n++;
        for (const [dx, dz] of dirs) {
            const nx = x + dx, nz = z + dz;
            if (nx < x1 - 4 || nx > x2 + 4 || nz < z1 - 4 || nz > z2 + 4) continue;
            if (seen.has(key(nx, nz))) continue;
            if (!canTravel(l, x, z, dx, dz, 1, 0, CollisionType.NORMAL)) continue;
            seen.add(key(nx, nz));
            next.push([nx, nz]);
        }
    }
    q = next;
}

// A START TILE THAT IS ITSELF BLOCKED prints one dot and tells you nothing, which is how three
// goes at the Port Sarim docks were spent. So when the flood goes nowhere, print the tiles that
// have at least one way out instead - that is a map of where a player could stand at all.
const dead = seen.size <= 2;
if (dead) {
    console.log('(the start tile is walled in, so this is every tile with a way out, not a flood)');
}
for (let z = z2; z >= z1; z--) {
    let row = String(z) + ' ';
    for (let x = x1; x <= x2; x++) {
        if (x === sx && z === sz) {
            row += 'S';
            continue;
        }
        if (dead) {
            row += dirs.some(([dx, dz]) => canTravel(l, x, z, dx, dz, 1, 0, CollisionType.NORMAL)) ? '.' : '#';
        } else {
            row += seen.has(key(x, z)) ? '.' : '#';
        }
    }
    console.log(row);
}
let head = '     ';
for (let x = x1; x <= x2; x++) head += String(x % 10);
console.log(head);
process.exit(0);
