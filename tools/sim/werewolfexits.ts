// WHERE EACH OBSTACLE PUTS THE PLAYER DOWN. The last unknowns before the course can be written.
//
// werewolfland.ts gave both sides of the hurdles, the slope and the zip line, but the pipe's north
// end has no standable neighbour at all - its exit is somewhere further into pocket 73 - and the
// stones' far bank wants confirming. So: the nearest standable tile in the destination pocket to
// each obstacle, which is where a squeeze or a jump has to land.
import * as H from './harness.ts';
import { canTravel, isFlagged } from '#/engine/GameMap.js';
import { CollisionFlag, CollisionType } from '#/engine/routefinder/index.js';
import { drawn, onLoc } from './mapfloor.ts';

await H.boot();

const DIRS: [number, number][] = [[1, 0], [-1, 0], [0, 1], [0, -1]];

function pocket(x: number, z: number, cap = 4000) {
    const seen = new Set<string>([x + ',' + z]);
    const q: [number, number][] = [[x, z]];
    while (q.length && seen.size < cap) {
        const [cx, cz] = q.shift()!;
        for (const [dx, dz] of DIRS) {
            const k = cx + dx + ',' + (cz + dz);
            if (seen.has(k) || !canTravel(0, cx, cz, dx, dz, 1, 0, CollisionType.NORMAL)) continue;
            seen.add(k);
            q.push([cx + dx, cz + dz]);
        }
    }
    return seen;
}

for (const [x, z] of [[3540, 9870], [3540, 9880], [3540, 9895], [3540, 9906], [3532, 9910], [3528, 9910], [3540, 9912]] as [number, number][]) {
    const p = H.makePlayer(`we_${x}_${z}`, x, z);
    p.teleport(x, z, 0);
    H.tick(2);
}

function nearest(label: string, fromX: number, fromZ: number, seedX: number, seedZ: number, n = 5) {
    const tiles = [...pocket(seedX, seedZ)]
        .map(t => t.split(',').map(Number) as [number, number])
        .filter(([x, z]) => !isFlagged(x, z, 0, CollisionFlag.WALK_BLOCKED))
        .filter(([x, z]) => drawn(x, z, 0) || onLoc(x, z, 0))
        .sort((a, b) =>
            Math.max(Math.abs(a[0] - fromX), Math.abs(a[1] - fromZ)) - Math.max(Math.abs(b[0] - fromX), Math.abs(b[1] - fromZ)));
    console.log(`\n${label}  (from ${fromX},${fromZ})`);
    for (const [x, z] of tiles.slice(0, n)) {
        console.log(`   ${x},${z}   ${Math.max(Math.abs(x - fromX), Math.abs(z - fromZ))} away   ${drawn(x, z, 0) ? 'floor' : 'on a loc'}`);
    }
}

// the three pipes: each exits north out of z9908 into pocket 73
nearest('pipe W exit (3538,9908 -> pocket 73)', 3538, 9908, 3540, 9912);
nearest('pipe M exit (3541,9908 -> pocket 73)', 3541, 9908, 3540, 9912);
nearest('pipe E exit (3544,9908 -> pocket 73)', 3544, 9908, 3540, 9912);

// the stones' far bank, for the record
nearest('stones far bank (3540,9881 -> pocket 84)', 3540, 9881, 3540, 9885);
// and the stones' near bank, now the approach tile is open
nearest('stones near bank (3538,9875 -> the entry)', 3538, 9875, 3538, 9873);

process.exit(0);
