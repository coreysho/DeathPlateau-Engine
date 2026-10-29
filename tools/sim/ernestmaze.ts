// THE LEVER MAZE under Draynor Manor, solved against the content's own door conditions.
//
// Ernest the Chicken's oil can sits behind nine doors whose open/shut state is a boolean function of
// six levers, recomputed by [proc,recalculate_ernest_doors] every time a lever is pulled. The wiki's
// walkthrough gives a sequence in terms of its own door numbers, which are not the names the
// implementation uses, so "follow the wiki" cannot be checked by reading. This searches the real
// state space instead: every one of the 64 lever states is fed through the real proc, the regions
// are the engine's own collision, and a BFS over (room, lever state) finds the shortest way from the
// ladder to the oil can.
//
// If this prints a route, the puzzle is solvable and the route is what a manifest should walk. If it
// prints no route, the maze is broken and the quest cannot be finished.
//
//   npx tsx tools/sim/ernestmaze.ts
import * as H from './harness.js';
import { canTravel } from '#/engine/GameMap.js';
import { CollisionType } from '#/engine/routefinder/index.js';

await H.boot();

const BOX = [3088, 9740, 3122, 9775]; // the whole basement, generously
// the LANDING, not the ladder's own tile: the ladder loc blocks the tile it stands on, so
// asking which room 3117,9754 is in gets you a one-tile region of nothing.
const LADDER: [number, number] = [3116, 9754];
const OILCAN: [number, number] = [3092, 9755];

const LEVERS: [string, number, number][] = [
    ['A', 3108, 9745],
    ['B', 3118, 9752],
    ['C', 3112, 9760],
    ['D', 3108, 9767],
    ['E', 3097, 9767],
    ['F', 3096, 9765]
];

// name, x, z, dir (1 = the wall runs north-south and you pass east/west, 0 = you pass north/south)
const DOORS: [string, number, number, number][] = [
    ['1to2', 3105, 9765, 1],
    ['2to3', 3100, 9765, 1],
    ['4to5', 3105, 9760, 1],
    ['5to6', 3100, 9760, 1],
    ['8to9', 3100, 9755, 1],
    ['2to5', 3102, 9763, 0],
    ['3to6', 3097, 9763, 0],
    ['4to7', 3108, 9758, 0],
    ['5to8', 3102, 9758, 0]
];

// ---------------------------------------------------------------- the rooms, by collision alone
// Every door is a blocking loc whether it is open or shut - passing one is the [aploc1] op walking
// you through it - so the regions never change, and one flood with everything shut labels them.
const key = (x: number, z: number) => x * 20000 + z;
const region = new Map<number, number>();
let regions = 0;
const dirs = [[0, 1], [0, -1], [1, 0], [-1, 0]];
for (let sx = BOX[0]; sx <= BOX[2]; sx++) {
    for (let sz = BOX[1]; sz <= BOX[3]; sz++) {
        if (region.has(key(sx, sz))) continue;
        // a tile nothing can leave is not a room
        if (!dirs.some(([dx, dz]) => canTravel(0, sx, sz, dx, dz, 1, 0, CollisionType.NORMAL))) continue;
        const id = regions++;
        region.set(key(sx, sz), id);
        let q = [[sx, sz]];
        while (q.length) {
            const next: number[][] = [];
            for (const [x, z] of q) {
                for (const [dx, dz] of dirs) {
                    const nx = x + dx;
                    const nz = z + dz;
                    if (nx < BOX[0] || nx > BOX[2] || nz < BOX[1] || nz > BOX[3]) continue;
                    if (region.has(key(nx, nz))) continue;
                    if (!canTravel(0, x, z, dx, dz, 1, 0, CollisionType.NORMAL)) continue;
                    region.set(key(nx, nz), id);
                    next.push([nx, nz]);
                }
            }
            q = next;
        }
    }
}

const regionAt = (x: number, z: number): number => region.get(key(x, z)) ?? -1;

/** The first walkable tile within three steps of a door, on the given side. */
function side(x: number, z: number, dx: number, dz: number): number {
    for (let n = 1; n <= 3; n++) {
        const r = regionAt(x + dx * n, z + dz * n);
        if (r !== -1) return r;
    }
    return -1;
}

const doorSides = DOORS.map(([name, x, z, dir]) => {
    const [a, b] = dir === 1 ? [side(x, z, -1, 0), side(x, z, 1, 0)] : [side(x, z, 0, -1), side(x, z, 0, 1)];
    return { name, x, z, dir, a, b };
});

// ---------------------------------------------------------------- the doors, by the real proc
const p: any = H.makePlayer('ernest', LADDER[0], LADDER[1]);
H.tick(2);
p.applyDamage = function () {};
H.setVar(p, 'macro_event', 1);
H.maxOut(p);
H.tick(1);

const bitNames = ['a', 'b', 'c', 'd', 'e', 'f'];
const openFor: boolean[][] = [];
for (let state = 0; state < 64; state++) {
    for (let i = 0; i < 6; i++) H.setVarBit(p, 'ernestlever_' + bitNames[i], (state >> i) & 1);
    H.runProc(p, '[proc,recalculate_ernest_doors]', [], undefined, true);
    openFor.push(DOORS.map(([name]) => H.getVarBit(p, 'ernestdoor_' + name) === 1));
}

console.log('the basement has ' + regions + ' separate rooms');
console.log('ladder is in room ' + regionAt(LADDER[0], LADDER[1]) + ', the oil can is in room ' + regionAt(OILCAN[0], OILCAN[1]));
console.log('');
for (const d of doorSides) console.log('  door ' + d.name.padEnd(5) + ' at ' + d.x + ',' + d.z + '  joins rooms ' + d.a + ' and ' + d.b);
console.log('');
for (const [n, x, z] of LEVERS) console.log('  lever ' + n + ' at ' + x + ',' + z + '  is in room ' + regionAt(x, z));
console.log('');

// ---------------------------------------------------------------- the search
const startRoom = regionAt(LADDER[0], LADDER[1]);
const goalRoom = regionAt(OILCAN[0], OILCAN[1]);
type Node = { room: number; state: number };
const skey = (n: Node) => n.room * 64 + n.state;
const prev = new Map<number, [number, string]>();
const seen = new Set<number>([skey({ room: startRoom, state: 0 })]);
let frontier: Node[] = [{ room: startRoom, state: 0 }];
let found: Node | null = null;
while (frontier.length && !found) {
    const next: Node[] = [];
    for (const node of frontier) {
        if (node.room === goalRoom) {
            found = node;
            break;
        }
        const moves: [Node, string][] = [];
        for (let i = 0; i < 6; i++) {
            const [name, lx, lz] = LEVERS[i];
            if (regionAt(lx, lz) !== node.room) continue;
            const to = node.state ^ (1 << i);
            moves.push([{ room: node.room, state: to }, 'pull lever ' + name + ' ' + (((to >> i) & 1) === 1 ? 'down' : 'up')]);
        }
        for (let d = 0; d < doorSides.length; d++) {
            if (!openFor[node.state][d]) continue;
            const { a, b, name } = doorSides[d];
            if (node.room === a) moves.push([{ room: b, state: node.state }, 'go through door ' + name]);
            else if (node.room === b) moves.push([{ room: a, state: node.state }, 'go through door ' + name]);
        }
        for (const [to, how] of moves) {
            if (seen.has(skey(to))) continue;
            seen.add(skey(to));
            prev.set(skey(to), [skey(node), how]);
            next.push(to);
        }
    }
    frontier = next;
}

if (!found) {
    console.log('NO ROUTE from the ladder to the oil can, in any of the 64 lever states.');
    console.log('Ernest the Chicken cannot be finished.');
    process.exit(1);
}

const steps: string[] = [];
let cur = skey(found);
while (cur !== skey({ room: startRoom, state: 0 })) {
    const [from, how] = prev.get(cur)!;
    steps.unshift(how);
    cur = from;
}
console.log('SOLVED in ' + steps.length + ' moves:');
steps.forEach((s, i) => console.log('  ' + String(i + 1).padStart(2) + '. ' + s));
process.exit(0);
