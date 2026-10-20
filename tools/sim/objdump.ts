// EVERY GROUND OBJ IN A BOX. The spawns are in the map data, not in content, so the only honest
// place to read them is the running world.
//
//   npx tsx tools/sim/objdump.ts x1 z1 x2 z2 level
import { H, World, ObjType } from './a1lib.js';

await H.boot();

const [x1, z1, x2, z2, l] = process.argv.slice(2).map(Number);
for (let x = x1 & ~7; x <= x2; x += 8) {
    for (let z = z1 & ~7; z <= z2; z += 8) {
        for (const o of World.gameMap.getZone(x, z, l).getAllObjsSafe()) {
            if (o.x < x1 || o.x > x2 || o.z < z1 || o.z > z2) continue;
            const t = ObjType.get(o.type);
            console.log(o.x + ',' + o.z + '  ' + (t.debugname ?? 'obj_' + t.id) + ' x' + o.count);
        }
    }
}
process.exit(0);
