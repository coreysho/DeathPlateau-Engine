// EVERY LOC IN A BOX, with its shape, angle, size, blockwalk and ops. a1locs only lists locs that
// have ops, and the thing that is in the way is usually one that has none.
//
//   npx tsx tools/sim/locdump.ts x1 z1 x2 z2 level
import { H, World, LocType } from './a1lib.js';

await H.boot();

const [x1, z1, x2, z2, l] = process.argv.slice(2).map(Number);
const seen = new Set<string>();
for (let x = x1 & ~7; x <= x2; x += 8) {
    for (let z = z1 & ~7; z <= z2; z += 8) {
        for (const lc of World.gameMap.getZone(x, z, l).getAllLocsSafe()) {
            if (lc.x < x1 || lc.x > x2 || lc.z < z1 || lc.z > z2) continue;
            const t = LocType.get(lc.type);
            const k =
                lc.x + ',' + lc.z + '  ' + (t.debugname ?? 'loc_' + t.id) +
                '  s' + lc.shape + 'a' + lc.angle + ' ' + t.width + 'x' + t.length +
                (t.blockwalk ? ' BLOCK' : '') + (t.blockrange ? '' : ' norange') +
                (t.forceapproach ? ' approach=' + t.forceapproach : '') +
                '  ' + (t.op ?? []).filter(Boolean).join('/');
            if (!seen.has(k)) {
                seen.add(k);
                console.log(k);
            }
        }
    }
}
process.exit(0);
