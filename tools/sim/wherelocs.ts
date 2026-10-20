// WHERE IS EVERY ONE OF THESE LOCS? Several loc names at once, with each placement's level, coord,
// shape and angle, and the ops the type carries.
//
//   npx tsx tools/sim/wherelocs.ts eadgar_rack eadgar_crate_goutweed
//
// whereloc.ts answers "can this one be clicked from beside it" for a single name; this one answers
// "what coord do I put in the manifest" for a whole quest's worth at once, which is the question
// that comes up first.
import World from '#/engine/World.js';
import * as H from './harness.js';
import LocType from '#/cache/config/LocType.js';

await H.boot();
const want = process.argv.slice(2);
if (!want.length) {
    console.log('usage: wherelocs.ts <loc name> [<loc name> ...]');
    process.exit(2);
}
const hits = new Map<string, string[]>();
for (const zone of ((World.gameMap as any).zonemap.zones as Map<number, any>).values()) {
    for (const loc of zone.getAllLocsUnsafe()) {
        const n = LocType.get(loc.type).debugname ?? '';
        if (!want.includes(n)) continue;
        if (!hits.has(n)) hits.set(n, []);
        hits.get(n)!.push(`L${loc.level} ${loc.x},${loc.z} s${loc.shape}a${loc.angle}`);
    }
}
for (const n of want) {
    let ops = '';
    try {
        ops = (LocType.get(LocType.getId(n)).op ?? []).filter(Boolean).join('/');
    } catch {
        console.log(`${n.padEnd(32)} no such loc`);
        continue;
    }
    const v = hits.get(n) ?? [];
    console.log(`${n.padEnd(32)} [${ops}]  ${v.length ? v.slice(0, 12).join('  ') + (v.length > 12 ? ' ...' : '') : '(none placed)'}`);
}
