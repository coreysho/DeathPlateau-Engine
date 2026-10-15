// HOW MANY MIRRORS DOES EACH STEP OF THE TEMPLE NEED? With the third dimension in, the shaft is no
// longer a free chute - a beam only leaves a corridor for the shaft if a tilted mirror puts it
// there, which is what the walkthrough does - so the number of mirrors a route costs went up, and
// the temple's own four may not be enough to open the first door.
//
// This asks the graph itself. Every pillar either lets the beam straight through (free) or holds a
// mirror (one mirror), and a mirror can turn the beam to any direction except straight on and
// straight back: flat settings swap one corridor for the one beside it, tilted ones swap a corridor
// for the shaft, and there is a setting for every pair. So the cheapest route to any doorway is a
// shortest path over (pillar, direction) with those two weights, which is Dijkstra with weights 0
// and 1 - and the answer is what a player has to have in their hands.
//
//   npx tsx tools/sim/templesolve.ts
import * as H from './harness.js';
import VarBitType from '#/cache/config/VarBitType.js';

await H.boot();

const p: any = H.makePlayer('templesolve', 29 * 64 + 60, 72 * 64 + 31);
H.tick(1);
p.teleport(29 * 64 + 60, 72 * 64 + 31, 0);
H.tick(1);
H.maxOut(p);
H.tick(2);
p.closeModal();

const v = (n: string) => (VarBitType.getByName(n) ? H.getVarBit(p, n) : H.getVar(p, n));
const dark = () => {
    H.runProc(p, '[proc,m2_dark]', [], undefined, true);
    H.runProc(p, '[proc,m2_pillars_dark]', [], undefined, true);
};
const edge = (pid: number, d: number, colour: number) => H.runProc(p, '[proc,m2_edge]', [pid, d, colour], undefined, true)[0];

// ---------------------------------------------------------------- read the graph out of the engine
const PILLARS = 35;
const DIRS = [1, 2, 3, 4, 5, 6];
const NAME: Record<number, string> = { 1: 'north', 2: 'east', 3: 'south', 4: 'west', 5: 'up', 6: 'down' };
// next[pillar][dir] = the pillar that edge arrives at, or 0
const next: number[][] = [];
// lights[pillar][dir] = the names of the varbits that edge sets
const lights: string[][][] = [];
const ALL = new Set<string>();
for (let pid = 0; pid <= PILLARS; pid++) {
    next[pid] = [];
    lights[pid] = [];
}
// the full list of light varbits, so an edge's writes can be read back
const NAMES: string[] = [];
for (let i = 0; i < 4000; i++) {
    const n = VarBitType.get(i)?.debugname;
    if (n && n.startsWith('mourning_light_temple_')) NAMES.push(n);
}
for (let pid = 1; pid <= PILLARS; pid++) {
    for (const d of DIRS) {
        dark();
        next[pid][d] = edge(pid, d, 7);
        const lit: string[] = [];
        for (const n of NAMES) {
            if (v(n) > 0) {
                lit.push(n);
                ALL.add(n);
            }
        }
        lights[pid][d] = lit;
    }
}
dark();
console.log('');
console.log(
    'the graph as the engine has it: ' +
        NAMES.length +
        ' light varbits, ' +
        [...Array(PILLARS).keys()].reduce((a, i) => a + DIRS.filter(d => lights[i + 1][d].length > 0 || next[i + 1][d] > 0).length, 0) +
        ' edges, of which ' +
        [...Array(PILLARS).keys()].reduce((a, i) => a + DIRS.filter(d => next[i + 1][d] === 0 && lights[i + 1][d].length > 0).length, 0) +
        ' run into an outer wall'
);

// ---------------------------------------------------------------- cheapest routes
const KEY = (pid: number, d: number, free: number) => (pid * 10 + d) * 2 + free;
const opposite: Record<number, number> = { 1: 3, 2: 4, 3: 1, 4: 2, 5: 6, 6: 5 };

/**
 * Dijkstra from the entry over (pillar, direction, has-a-spare-socket); cost is mirrors placed.
 *
 * THE SPARE SOCKET MATTERS AS MUCH AS THE MIRROR COUNT. A coloured door needs a crystal in a
 * socket somewhere upstream of it, and a crystal cannot share a socket with a mirror - so a route
 * that turns a corner at every single pillar it touches cannot be coloured at all, however few
 * mirrors it uses. The third element of the state is whether the beam has passed straight through
 * at least one pillar on the way, which is where the crystal goes.
 */
const parent = new Map<number, [number, string]>();
function cheapest() {
    const dist = new Map<number, number>();
    const start = KEY(35, 3, 0);
    dist.set(start, 0);
    const q: [number, number][] = [[0, start]];
    while (q.length) {
        q.sort((a, b) => a[0] - b[0]);
        const [cost, key] = q.shift()!;
        if (cost > (dist.get(key) ?? Infinity)) continue;
        const free = key % 2;
        const rest = (key - free) / 2;
        const pid = Math.floor(rest / 10);
        const d = rest % 10;
        const push = (npid: number, nd: number, c: number, nfree: number, how: string) => {
            if (npid <= 0) return;
            const k = KEY(npid, nd, nfree);
            if (c < (dist.get(k) ?? Infinity)) {
                dist.set(k, c);
                parent.set(k, [key, how]);
                q.push([c, k]);
            }
        };
        // straight on through this pillar: free, and it leaves a socket spare
        if (next[pid][d] > 0) push(next[pid][d], d, cost, 1, 'through ' + pid);
        // or a mirror here, turning to anything but straight on and straight back
        for (const nd of DIRS) {
            if (nd === d || nd === opposite[d]) continue;
            if (next[pid][nd] > 0) push(next[pid][nd], nd, cost + 1, free, 'mirror at ' + pid + ' turning ' + NAME[d] + ' to ' + NAME[nd]);
        }
    }
    return dist;
}

const dist = cheapest();

/** mirrors needed for some traversed edge to light `segment`, and whether a socket is spare */
function departures() {
    const plain = new Map<string, number>();
    const coloured = new Map<string, number>();
    for (let pid = 1; pid <= PILLARS; pid++) {
        for (const d of DIRS) {
            for (const free of [0, 1]) {
                const arrive = dist.get(KEY(pid, d, free));
                if (arrive === undefined) continue;
                // AN EDGE THAT LEAVES THE TEMPLE STILL LIGHTS ITS CORRIDOR, and the doorways in the
                // outer walls are exactly those edges - 1_16_north is pillar 12 going north into the
                // wall. A first version skipped them for having no destination and called half the
                // doors in the building unreachable.
                for (const nd of DIRS) {
                    if (lights[pid][nd].length === 0) continue;
                    const cost = nd === d ? arrive : nd === opposite[d] ? Infinity : arrive + 1;
                    if (!isFinite(cost)) continue;
                    // going straight on leaves this pillar's socket spare as well
                    const spare = free === 1 || nd === d ? 1 : 0;
                    for (const seg of lights[pid][nd]) {
                        if (cost < (plain.get(seg) ?? Infinity)) plain.set(seg, cost);
                        if (spare === 1 && cost < (coloured.get(seg) ?? Infinity)) coloured.set(seg, cost);
                    }
                }
            }
        }
    }
    return { plain, coloured };
}
const { plain, coloured } = departures();

console.log('');
console.log('THE CHEAPEST ROUTE TO EACH DOORWAY, IN MIRRORS');
console.log('  (and with a socket left spare for the crystal a coloured door needs)');
const DOORS: [string, string, string][] = [
    ['floor 1 room 16 north   yellow, a chest', 'mourning_light_temple_1_16_north', 'yellow'],
    ['floor 1 room 1  south   yellow, a chest', 'mourning_light_temple_1_1_south', 'yellow'],
    ['floor 1 room 13 east    cyan, a chest', 'mourning_light_temple_1_13_east', 'cyan'],
    ['floor 1 room 13 north   cyan, a chest', 'mourning_light_temple_1_13_north', 'cyan'],
    ['floor 2 room 16 north   blue, a chest', 'mourning_light_temple_2_16_north', 'blue'],
    ['floor 2 room 16 west    blue, a chest', 'mourning_light_temple_2_15_east', 'blue'],
    ['floor 2 room 4  west    magenta, a chest', 'mourning_light_temple_2_3_east', 'magenta'],
    ['the black door to the altar', 'mourning_light_temple_1_d_west', 'any colour'],
    ['out of the hole in the west wall', 'mourning_light_temple_1_b_west', 'any colour']
];
for (const [what, seg, colour] of DOORS) {
    const a = plain.get(seg);
    const b = coloured.get(seg);
    console.log('  ' + what.padEnd(42) + (a === undefined ? 'UNREACHABLE' : a + ' mirrors').padEnd(14) + (colour === 'any colour' ? '' : 'with a spare socket: ' + (b === undefined ? 'NO ROUTE' : b + ' mirrors')) + '   (' + colour + ')');
}
console.log('');
console.log('  the temple kit, waiting in the collector: 4 mirrors - and every chest holds two more');

// ---------------------------------------------------------------- can magenta be made at all?
// A crystal is a filter and no filter puts a colour back, so no single beam in this building can be
// magenta - and three of its doors are. Two beams crossing add, which means magenta needs a crossing
// tile with both axes live, a red beam down one of them and a blue beam down the other, and a
// fractured crystal to make the second beam in the first place. This says whether the two halves can
// be reached and coloured; the crossing arithmetic itself is driven in tools/sim/templecross.ts.
console.log('');
console.log('MAGENTA: A CROSSING WITH BOTH AXES LIVE, ONE BEAM RED AND THE OTHER BLUE');
const CROSSINGS: [string, string, string][] = [
    ['floor 1 room 15', 'mourning_light_temple_1_14_east', 'mourning_light_temple_1_11_south'],
    ['floor 3 room 14', 'mourning_light_temple_3_13_15', 'mourning_light_temple_3_10_south'],
    ['floor 3 room 4', 'mourning_light_temple_3_3_east', 'mourning_light_temple_3_16_north']
];
for (const [where, ew, ns] of CROSSINGS) {
    const a = coloured.get(ew);
    const b = coloured.get(ns);
    console.log(
        '  ' +
            where.padEnd(16) +
            'east-west ' +
            (a === undefined ? 'no colourable route' : a + ' mirrors').padEnd(22) +
            'north-south ' +
            (b === undefined ? 'no colourable route' : b + ' mirrors') +
            (a !== undefined && b !== undefined ? '   <- magenta can be made here' : '')
    );
}

// ---------------------------------------------------------------- and the routes themselves
// The cheapest route is no use as a number alone: the sims have to place the mirrors, and so does
// a player. This walks the parents back from the state that lights the wanted corridor.
function route(segment: string) {
    let best: [number, number] | null = null;
    for (let pid = 1; pid <= PILLARS; pid++) {
        for (const d of DIRS) {
            for (const free of [0, 1]) {
                const arrive = dist.get(KEY(pid, d, free));
                if (arrive === undefined) continue;
                for (const nd of DIRS) {
                    if (lights[pid][nd].length === 0 || !lights[pid][nd].includes(segment)) continue;
                    const cost = nd === d ? arrive : nd === opposite[d] ? Infinity : arrive + 1;
                    if (!isFinite(cost)) continue;
                    if (!best || cost < best[1]) best = [KEY(pid, d, free), cost];
                    if (nd !== d) {
                        // the last mirror is part of the route
                        const tail = 'mirror at ' + pid + ' turning ' + NAME[d] + ' to ' + NAME[nd];
                        lastStep.set(segment, tail);
                    } else {
                        lastStep.set(segment, 'through ' + pid + ' going ' + NAME[nd]);
                    }
                }
            }
        }
    }
    if (!best) return null;
    const steps: string[] = [];
    let k: number | undefined = best[0];
    while (k !== undefined) {
        const par = parent.get(k);
        if (!par) break;
        steps.push(par[1]);
        k = par[0];
    }
    steps.reverse();
    const tail = lastStep.get(segment);
    if (tail) steps.push(tail);
    return { cost: best[1], steps };
}
const lastStep = new Map<string, string>();

for (const [what, seg] of [
    ['OUT OF THE HOLE IN THE WEST WALL', 'mourning_light_temple_1_b_west'],
    ['THE FIRST YELLOW DOOR (floor 1 room 16, a chest behind it)', 'mourning_light_temple_1_16_north'],
    ['THE BLACK DOOR TO THE DEATH ALTAR', 'mourning_light_temple_1_d_west']
] as [string, string][]) {
    const r = route(seg);
    console.log('');
    console.log(what + ': ' + (r ? r.cost + ' mirrors' : 'no route'));
    if (r) for (const s of r.steps) console.log('   ' + s);
}
