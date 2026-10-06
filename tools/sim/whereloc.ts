// Every placement of one loc type, and whether a player standing somewhere can actually click it.
//
//   npx tsx tools/sim/whereloc.ts roguesden_walldecor_safe 1,3061,4984
//
// The second argument is where the player stands (level,x,z) and defaults to the foot of the
// Rogues' Den trapdoor. "clickable" is a1lib's reachLoc - the same footprint test the engine makes
// when a click arrives - run from a tile beside the loc, so it answers "is this loc usable at all"
// rather than "can you walk the whole way there from the door".
import World from '#/engine/World.js';
import * as H from './harness.js';
import * as A from './a1lib.js';
import LocType from '#/cache/config/LocType.js';

await H.boot();
const want = process.argv[2];
const from = (process.argv[3] ?? '1,3061,4984').split(',').map(Number);

const found: { level: number; x: number; z: number; shape: number; angle: number }[] = [];
for (const zone of ((World.gameMap as any).zonemap.zones as Map<number, any>).values()) {
    for (const loc of zone.getAllLocsUnsafe()) {
        if ((LocType.get(loc.type).debugname ?? '') !== want) continue;
        found.push({ level: loc.level, x: loc.x, z: loc.z, shape: loc.shape, angle: loc.angle });
    }
}
console.log(`${found.length} x ${want}`);
for (const l of found) {
    let near = false;
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        if (A.reachLoc(l.level, l.x + dx, l.z + dz, want, l.x, l.z)) near = true;
    }
    const walk = A.reachLoc(from[0], from[1], from[2], want, l.x, l.z);
    console.log(`  ${l.level},${l.x},${l.z} shape ${l.shape} angle ${l.angle}  ` +
        `${near ? 'clickable from beside it' : 'NOT clickable'}; ` +
        `${l.level === from[0] && walk ? 'walkable from ' + from.join(',') : 'no walk route from ' + from.join(',')}`);
}
process.exit(0);
