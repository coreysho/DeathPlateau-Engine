// WHAT DOES THIS ROOM LOOK LIKE? One box of the map, printed as walkability with every clickable
// loc on it and a key underneath - which is the one question that comes up in every quest run,
// because a step that reports "player stuck at x,z" is almost always a tile on the wrong side of
// a wall or a loc whose only open side faces a different chamber.
//
//   npx tsx tools/sim/walkmap.ts 2752,4480,2815,4543            one box, level 0
//   npx tsx tools/sim/walkmap.ts 1,3061,4970,3090,5000          a box on level 1
//   npx tsx tools/sim/walkmap.ts 2752,4480,2815,4543 --all      name every loc, not just the ones with ops
//
// '#' is a tile nothing can step off, '.' one that something can. A letter is a loc; the key says
// which. Locs are drawn over the walkability, so a letter is also a blocked tile more often than
// not.
import World from '#/engine/World.js';
import * as H from './harness.js';
import LocType from '#/cache/config/LocType.js';
import { canTravel } from '#/engine/GameMap.js';
import { CollisionType } from '#/engine/routefinder/index.js';

await H.boot();
const all = process.argv.includes('--all');
const boxes = process.argv.slice(2).filter(a => !a.startsWith('--'));
if (!boxes.length) {
    console.log('usage: walkmap.ts [level,]x0,z0,x1,z1 ...  [--all]');
    process.exit(2);
}

const GLYPHS = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz0123456789+*=<>?!$%&@~';

for (const spec of boxes) {
    const n = spec.split(',').map(Number);
    const [level, x0, z0, x1, z1] = n.length === 5 ? n : [0, ...n];
    const marks = new Map<string, string>();
    const key = new Map<string, string>();
    let next = 0;
    for (const zone of ((World.gameMap as any).zonemap.zones as Map<number, any>).values()) {
        for (const loc of zone.getAllLocsUnsafe()) {
            if (loc.level !== level) continue;
            if (loc.x < x0 || loc.x > x1 || loc.z < z0 || loc.z > z1) continue;
            const t = LocType.get(loc.type);
            const ops = (t.op ?? []).filter(Boolean) as string[];
            if (!all && !ops.length) continue;
            const name = t.debugname ?? String(loc.type);
            if (!key.has(name)) {
                key.set(name, GLYPHS[next % GLYPHS.length] + (ops.length ? '  [' + ops.join('/') + ']' : ''));
                next++;
            }
            marks.set(loc.x + ',' + loc.z, key.get(name)![0]);
        }
    }
    const open = (x: number, z: number) =>
        [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dz]) => canTravel(level, x, z, dx, dz, 1, 0, CollisionType.NORMAL));
    console.log('');
    console.log(`=== L${level}  ${x0},${z0} .. ${x1},${z1}`);
    let hdr = '      ';
    for (let x = x0; x <= x1; x++) hdr += x % 10 === 0 ? String((x / 10) % 10) : ' ';
    console.log(hdr);
    for (let z = z1; z >= z0; z--) {
        let row = String(z).padStart(5) + ' ';
        for (let x = x0; x <= x1; x++) row += marks.get(x + ',' + z) ?? (open(x, z) ? '.' : '#');
        console.log(row);
    }
    console.log('');
    for (const [name, g] of [...key.entries()].sort((a, b) => a[1].localeCompare(b[1]))) {
        console.log(`  ${g[0]}  ${name}${g.slice(1)}`);
    }
}
