import * as H from './harness.ts';
import * as A from './a1lib.ts';
import { CollisionFlag } from '#/engine/routefinder/index.js';
import { isFlagged } from '#/engine/GameMap.js';
await H.boot();
const args = process.argv.slice(2);
if (args.length === 7 && args.every(a => !a.includes(','))) {
    const [lv, x0, z0, x1, z1, sx, sz] = args.map(Number);
    console.log(A.ascii(lv, x0, z0, x1, z1, sx, sz));
} else {
    for (const a of args) {
        const [x, z, lv] = a.split(',').map(Number);
        console.log(`${x},${z} lv${lv}  ${isFlagged(lv, x, z, CollisionFlag.WALK_BLOCKED) ? 'BLOCKED' : 'free'}`);
    }
}
process.exit(0);
