// WHERE IS THIS LOC? Every placement of a named loc, or of a whole category, inside a box - which
// a1locs cannot show, because a loc whose only interaction is [oplocu] declares no op strings and
// is filtered out of it. A cooking range and a water source are both that shape.
//
//   npx tsx tools/sim/locwhere.ts <x0> <x1> <z0> <z1> name|cat:<category> [more...]
import * as H from './harness.js';
import World from '#/engine/World.js';
import LocType from '#/cache/config/LocType.js';
import CategoryType from '#/cache/config/CategoryType.js';

await H.boot();
const a = process.argv.slice(2);
const [x0, x1, z0, z1] = a.slice(0, 4).map(Number);
const wants = a.slice(4);
if (!x1 || !wants.length) {
    console.log('usage: locwhere.ts <x0> <x1> <z0> <z1> name|cat:<category> [more...]');
    process.exit(1);
}
const ids = new Map<number, string>();
const cats = new Map<number, string>();
for (const w of wants) {
    if (w.startsWith('cat:')) {
        const c = CategoryType.getId(w.slice(4));
        if (c === -1) console.log(w + ': NO SUCH CATEGORY');
        else cats.set(c, w.slice(4));
    } else {
        const id = LocType.getId(w);
        if (id === -1) console.log(w + ': NO SUCH LOC');
        else ids.set(id, w);
    }
}
console.log('');
const seen = new Set<string>();
for (let l = 0; l <= 3; l++)
    for (let x = x0 & ~7; x <= x1; x += 8)
        for (let z = z0 & ~7; z <= z1; z += 8)
            for (const loc of World.gameMap.getZone(x, z, l).getAllLocsUnsafe()) {
                if (loc.x < x0 || loc.x > x1 || loc.z < z0 || loc.z > z1) continue;
                const t = LocType.get(loc.type);
                const why = ids.get(loc.type) ?? cats.get(t.category);
                if (!why) continue;
                const line = `L${l} ${loc.x},${loc.z}  ${t.debugname ?? 'loc_' + loc.type}  (${why})  shape ${loc.shape} angle ${loc.angle} w${t.width} l${t.length}`;
                if (seen.has(line)) continue;
                seen.add(line);
                console.log(line);
            }
if (!seen.size) console.log('nothing of those in that box');
process.exit(0);
