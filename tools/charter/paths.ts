import World from '#/engine/World.js';
import { findPath } from '#/engine/GameMap.js';
await World.start(false, false);
const a = process.argv.slice(2).map(Number);
const [sx, sz] = a;
for (let i = 2; i < a.length; i += 2) {
    const p = findPath(0, sx, sz, a[i], a[i + 1]);
    const last = p.length ? p[0] : -1;
    const lx = (last >> 14) & 0x3fff, lz = last & 0x3fff;
    const first = p.length ? p[p.length - 1] : -1;
    console.log(`${sx},${sz} -> ${a[i]},${a[i + 1]}: ${p.length} wp; p[0]=${lx},${lz} p[n-1]=${(first >> 14) & 0x3fff},${first & 0x3fff}`);
}
process.exit(0);
