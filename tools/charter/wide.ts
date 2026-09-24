import World from '#/engine/World.js';
import { isMapBlocked, isZoneAllocated } from '#/engine/GameMap.js';
await World.start(false, false);
const [x0, x1, z0, z1] = process.argv.slice(2).map(Number);
for (let z = z1; z >= z0; z--) {
    let row = String(z).padStart(5) + ' ';
    for (let x = x0; x <= x1; x++) row += isZoneAllocated(0, x, z) ? (isMapBlocked(x, z, 0) ? '#' : '.') : ' ';
    console.log(row);
}
process.exit(0);
