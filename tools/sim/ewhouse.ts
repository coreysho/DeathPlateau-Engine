// IS THIS ROOM SEALED, OR IS THERE JUST A DOOR IN THE WAY? Flood a tile's pocket, print the edges
// out of it, and name the loc that closes it.
//
// Asked here of the Seers' Village house that holds the battered book, because questrun could not
// walk to the bookcase: 34 tiles, one door, loc_1530. The answer was A DOOR, not a seal - loc_1530
// carries category=door_closed and `[oploc1,_door_closed]` matches the CATEGORY, not the name, so
// an unnamed door is not an unhandled one. 61 unnamed wall locs are placed 882 times in this world
// and almost all of them are handled exactly this way. What questrun cannot do is open one: it
// walks on canTravel, so a shut door is a wall and the manifest has to click it.
//
// The other half of the finding is in the manifest: ~open_door's replacement lasts a few hundred
// ticks and then the door is back, which for a room with one way out means the steps inside it have
// to be short.
import * as H from './harness.js';
import World from '#/engine/World.js';
import LocType from '#/cache/config/LocType.js';
import { canTravel } from '#/engine/GameMap.js';
import { CollisionType } from '#/engine/routefinder/index.js';

await H.boot();

const flood = (level: number, x: number, z: number, cap = 120) => {
    const seen = new Set([`${x},${z}`]);
    const q: [number, number][] = [[x, z]];
    while (q.length && seen.size < cap) {
        const [cx, cz] = q.pop()!;
        for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            const k = `${cx + dx},${cz + dz}`;
            if (!seen.has(k) && canTravel(level, cx, cz, dx, dz, 1, 0, CollisionType.NORMAL)) {
                seen.add(k);
                q.push([cx + dx, cz + dz]);
            }
        }
    }
    return seen;
};

const pocket = flood(0, 2715, 3481);
console.log(`from 2715,3481 the player can reach ${pocket.size} tiles${pocket.size < 120 ? ' - A SEALED POCKET' : '+ (open world)'}`);
const xs = [...pocket].map(k => Number(k.split(',')[0]));
const zs = [...pocket].map(k => Number(k.split(',')[1]));
if (pocket.size < 120) {
    console.log(`  x ${Math.min(...xs)}..${Math.max(...xs)}  z ${Math.min(...zs)}..${Math.max(...zs)}`);
    console.log('  ' + [...pocket].sort().join(' '));
}

console.log('');
console.log('edges out of the room, north side:');
for (let x = 2712; x <= 2718; x++) {
    const ok = canTravel(0, x, 3482, 0, 1, 1, 0, CollisionType.NORMAL);
    console.log(`  ${x},3482 -> ${x},3483  ${ok ? 'open' : 'BLOCKED'}`);
}

console.log('');
for (const id of [1530, 1507, 1511]) {
    const t = LocType.get(id);
    console.log(`loc ${id}  name "${t.name}"  debugname ${t.debugname ?? '(none)'}  ops ${(t.op ?? []).filter(Boolean).join('/')}`);
}

console.log('');
let n1530 = 0;
let n1507 = 0;
const where: string[] = [];
for (const zone of ((World.gameMap as any).zonemap.zones as Map<number, any>).values()) {
    for (const lc of zone.getAllLocsUnsafe()) {
        if (lc.type === 1530) {
            n1530++;
            if (where.length < 12) where.push(`${lc.level},${lc.x},${lc.z} s${lc.shape}a${lc.angle}`);
        }
        if (lc.type === 1507) n1507++;
    }
}
console.log(`loc 1530 is placed ${n1530} times, loc 1507 ${n1507} times`);
console.log('  first few 1530: ' + where.join('  '));
process.exit(0);
