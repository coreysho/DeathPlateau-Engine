// WHICH TILES CAN BE STOOD ON, as a picture. The quickest way to see why a click will not land:
// the Legends' Quest magic trial gate is a solid 2x2 with rock on three sides, so 2762,9312 is the
// only tile it can be reached from, and a router that stops "within two" settles on the diagonal
// and is refused in silence. A region flood answers reachability ([[standable-is-not-reachable]]);
// this answers the smaller question of what is floor at all.
//
//   npx tsx tools/sim/openmap.ts <x0> <x1> <z0> <z1> [level]
import * as H from './harness.js';
import { isFlagged } from '#/engine/GameMap.js';
import { CollisionFlag } from '#/engine/routefinder/index.js';

await H.boot();
const a = process.argv.slice(2).map(Number);
const [x0, x1, z0, z1] = a;
const level = a[4] ?? 0;
if (!x1) {
    console.log('usage: openmap.ts <x0> <x1> <z0> <z1> [level]');
    process.exit(1);
}
const open = (x: number, z: number) => !isFlagged(x, z, level, CollisionFlag.WALK_BLOCKED);
console.log('');
for (let z = z1; z >= z0; z--) {
    let row = String(z) + ' ';
    for (let x = x0; x <= x1; x++) row += open(x, z) ? '.' : '#';
    console.log(row);
}
let ruler = '     ';
for (let x = x0; x <= x1; x++) ruler += x % 10 === 0 ? '|' : '.';
console.log(ruler + '   (| every tenth x, from ' + x0 + ')');
process.exit(0);
