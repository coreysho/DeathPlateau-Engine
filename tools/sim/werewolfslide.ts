// WHAT IS UNDER THE DEATHSLIDE?
//
// The slide runs from the top platform at about 3528,9910 south to 3527,9897, and Old School lets
// it be failed - the only obstacle on this course that can be. What Old School does NOT say is
// where a failed slide puts the player down, which is a coordinate rather than a number and the
// reason the fall was left out of the first pass.
//
// So before inventing one: is the ground the slide crosses walkable at all? If the strip between
// the top platform and the landing is solid ground a player can stand on and walk off, a fall can
// land there. If it is a sealed pocket, dropping somebody into it strands them, and the only
// honest landing is the bottom of the slide itself.
import * as H from './harness.ts';
import { canTravel, isFlagged } from '#/engine/GameMap.js';
import { CollisionFlag, CollisionType } from '#/engine/routefinder/index.js';
import { drawn, onLoc } from './mapfloor.ts';

await H.boot();

const DIRS: [number, number][] = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const stand = (x: number, z: number) => DIRS.some(([dx, dz]) => canTravel(0, x - dx, z - dz, dx, dz, 1, 0, CollisionType.NORMAL));
const open = (x: number, z: number) => !isFlagged(x, z, 0, CollisionFlag.WALK_BLOCKED);

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

for (const [x, z] of [[3528, 9910], [3527, 9897], [3527, 9902], [3540, 9906]] as [number, number][]) {
    const p = H.makePlayer(`wsl_${x}_${z}`, x, z);
    p.teleport(x, z, 0);
    H.tick(2);
}

const entry = pocket(3527, 9897);
const top = pocket(3528, 9910);
console.log(`\nthe entry pocket has ${entry.size} tiles, the slide's top platform ${top.size}`);

console.log('\n   . walkable   # blocked, something drawn   : blocked, nothing drawn');
console.log('');
for (let z = 9912; z >= 9894; z--) {
    let row = `  z${z}  `;
    for (let x = 3522; x <= 3534; x++) {
        if (open(x, z) && stand(x, z)) {
            const k = `${x},${z}`;
            row += entry.has(k) ? 'E' : top.has(k) ? 'T' : '.';
            continue;
        }
        row += drawn(x, z, 0) || onLoc(x, z, 0) ? '#' : ':';
    }
    console.log(row);
}
let hdr = '        ';
for (let x = 3522; x <= 3534; x++) hdr += x % 10;
console.log(hdr + '   (x 3522..3534)   E = the entry pocket, T = the top platform');

console.log('\nany walkable tile under the slide that is in NEITHER pocket:');
let orphan = 0;
for (let z = 9898; z <= 9907; z++) {
    for (let x = 3522; x <= 3534; x++) {
        const k = `${x},${z}`;
        if (open(x, z) && stand(x, z) && !entry.has(k) && !top.has(k)) {
            console.log(`   ${k}  pocket of ${pocket(x, z).size}`);
            orphan++;
        }
    }
}
if (!orphan) console.log('   none - the strip the slide crosses cannot be stood on at all');

process.exit(0);
