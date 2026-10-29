// A ROUTE THAT IS ALLOWED TO USE OBSTACLES. Plain walking cannot leave Isafdar: the forest bands
// are solid and the only joins are fifteen dense-forest crossings, each of which steps you two
// tiles past itself. A questrun "NO WALKABLE ROUTE" there is not a bug, it is the map - what the
// manifest needs is the ORDER of crossings, and that is what this prints.
//
//   npx tsx tools/sim/crossroute.ts <level> <ax>,<az> <bx>,<bz> ["locname pattern"]
//
// The BFS walks tiles as usual and, from any tile beside a matching loc, also takes the jump that
// loc's own handler would make: two tiles through it, on the axis the player approached from. That
// is the rule in [label,regicide_cross_forest] and the one every Isafdar band shares.
import * as H from './harness.js';
import World from '#/engine/World.js';
import LocType from '#/cache/config/LocType.js';
import { canTravel } from '#/engine/GameMap.js';
import { CollisionType } from '#/engine/routefinder/index.js';

await H.boot();

const level = Number(process.argv[2]);
const [ax, az] = process.argv[3].split(',').map(Number);
const [bx, bz] = process.argv[4].split(',').map(Number);
const re = new RegExp(process.argv[5] ?? 'cross_over', 'i');

// every matching loc on this level, by tile
type Obst = { name: string; x: number; z: number; x1: number; z1: number };
const obstacles: Obst[] = [];
for (const zone of ((World.gameMap as any).zonemap.zones as Map<number, any>).values()) {
    for (const loc of zone.getAllLocsUnsafe()) {
        if (loc.level !== level) continue;
        const t = LocType.get(loc.type);
        const nm = t.debugname ?? 'loc_' + loc.type;
        if (!re.test(nm)) continue;
        // AN OBSTACLE HAS TO BE CLICKABLE. regicide_trap_arrowtrip is "Twigs" - blockwalk=no and
        // no ops at all, the decoration the tripwire's crossbows hide in - and counting it as a
        // crossing had the flood jumping over scenery nobody can click, which made a route that
        // does not exist.
        if (!(t.op ?? []).filter(Boolean).length) continue;
        // THE FOOTPRINT, not the origin tile. Every dense forest type is width=3 length=2, and
        // GameMap measures it at the loc's original angle: odd angles swap the two. Treating these
        // as one tile is what made the band walling off Tyras Camp look one-way - the tile beside
        // its origin is inside the footprint, so the only "adjacent" tiles were on one side.
        const odd = (loc.angle & 0x1) === 1;
        const sx = odd ? t.length : t.width;
        const sz = odd ? t.width : t.length;
        obstacles.push({ name: nm, x: loc.x, z: loc.z, x1: loc.x + sx - 1, z1: loc.z + sz - 1 });
    }
}
console.log(`${obstacles.length} obstacles matching ${re} on L${level}`);

// CAN YOU STAND HERE? Asking canTravel to step OFF a tile is the wrong question - it tests the
// destination's flags, so a solid tile next to open ground answers yes and every pit, tree and
// wall read as walkable. Ask whether a neighbour can step ONTO it instead.
const standable = (x: number, z: number) =>
    canTravel(level, x, z + 1, 0, -1, 1, 0, CollisionType.NORMAL) ||
    canTravel(level, x, z - 1, 0, 1, 1, 0, CollisionType.NORMAL) ||
    canTravel(level, x + 1, z, -1, 0, 1, 0, CollisionType.NORMAL) ||
    canTravel(level, x - 1, z, 1, 0, 1, 0, CollisionType.NORMAL);
const blocked = (x: number, z: number) => !standable(x, z);

// A LOG BALANCE IS A PAIR, not a two-tile hop: both banks carry the same _start type and crossing
// puts you on the other one. Group them by name so the landing is the far bank.
const pairs = new Map<string, Obst[]>();
for (const o of obstacles) {
    if (!/logbalance/i.test(o.name)) continue;
    if (!pairs.has(o.name)) pairs.set(o.name, []);
    pairs.get(o.name)!.push(o);
}

// the landing tile for a click on $o from $fx,$fz, by the handler's own rule
function landing(o: Obst, fx: number, fz: number): [number, number] {
    // the tracks are a one-way walk to a fixed tile, ^regicide_old_camp_landing
    if (/old_camp_footprints/i.test(o.name)) return [2231, 3150];
    if (/logbalance/i.test(o.name)) {
        const far = (pairs.get(o.name) ?? []).find(q => q.x !== o.x || q.z !== o.z);
        if (!far) return [o.x, o.z];
        // on past the far bank if its own tile is solid - two of the three carry the _start
        // decoration on ground you cannot stand on, which is what ~regicide_log_walk allows for.
        const ddx = Math.sign(far.x - o.x);
        const ddz = Math.sign(far.z - o.z);
        for (let n = 0; n <= 10; n++) {
            if (!blocked(far.x + ddx * n, far.z + ddz * n)) return [far.x + ddx * n, far.z + ddz * n];
        }
        return [far.x, far.z];
    }
    // the same rule ~regicide_obstacle_end uses: straight on through, as far as the first tile
    // beyond it you can stand on, up to ten.
    // ~regicide_obstacle_end's own rule: the axis you came from, then the first clear tile from
    // the loc's ORIGIN outward, which is what the content walks you to.
    let dx = 0;
    let dz = 0;
    if (fz > o.z1) dz = -1;
    else if (fz < o.z) dz = 1;
    else if (fx > o.x1) dx = -1;
    else dx = 1;
    for (let n = 1; n <= 10; n++) {
        if (!blocked(o.x + dx * n, o.z + dz * n)) return [o.x + dx * n, o.z + dz * n];
    }
    return [o.x + dx * 10, o.z + dz * 10];
}

const key = (x: number, z: number) => x * 100000 + z;

// Indexed by the tile you would be standing on. Scanning all 60-odd obstacles for every tile the
// flood touches is what made this take minutes rather than seconds.
const byTile = new Map<number, Obst[]>();
for (const o of obstacles) {
    for (let x = o.x; x <= o.x1; x++) {
        for (let z = o.z; z <= o.z1; z++) {
            for (const [dx, dz] of [[0, 1], [0, -1], [1, 0], [-1, 0]] as [number, number][]) {
                const nx = x + dx;
                const nz = z + dz;
                if (nx >= o.x && nx <= o.x1 && nz >= o.z && nz <= o.z1) continue;
                const k = key(nx, nz);
                if (!byTile.has(k)) byTile.set(k, []);
                if (!byTile.get(k)!.includes(o)) byTile.get(k)!.push(o);
            }
        }
    }
}

const from = new Map<number, { px: number; pz: number; via?: string }>();
from.set(key(ax, az), { px: -1, pz: -1 });
const q: [number, number][] = [[ax, az]];
const dirs: [number, number][] = [
    [0, 1],
    [0, -1],
    [1, 0],
    [-1, 0]
];
let hit = false;
// An index rather than q.shift(): a failed search floods the whole connected world and shift() on
// a hundred thousand entries turns the BFS into an O(n^2) crawl.
let head = 0;
const CAP = Number(process.env.CAP ?? 60000);
while (head < q.length && !hit && from.size < CAP) {
    const [x, z] = q[head++];
    for (const [dx, dz] of dirs) {
        const nx = x + dx;
        const nz = z + dz;
        if (from.has(key(nx, nz))) continue;
        if (!canTravel(level, x, z, dx, dz, 1, 0, CollisionType.NORMAL)) continue;
        from.set(key(nx, nz), { px: x, pz: z });
        q.push([nx, nz]);
        if (nx === bx && nz === bz) hit = true;
    }
    // and the obstacles we are standing next to
    for (const o of byTile.get(key(x, z)) ?? []) {
        const [lx, lz] = landing(o, x, z);
        if (from.has(key(lx, lz))) continue;
        if (blocked(lx, lz)) continue;
        from.set(key(lx, lz), { px: x, pz: z, via: `${o.name} at ${o.x},${o.z}` });
        q.push([lx, lz]);
        if (lx === bx && lz === bz) hit = true;
    }
}

if (!from.has(key(bx, bz))) {
    console.log(`no route from ${ax},${az} to ${bx},${bz} even using the obstacles${from.size >= CAP ? ' (CAPPED at ' + CAP + ' tiles)' : ''}`);
    console.log(`  reached ${from.size} tiles. Crossings used:`);
    const used = new Set<string>();
    for (const v of from.values()) if (v.via) used.add(v.via);
    for (const u of [...used].sort()) console.log(`    ${u}`);
    // THE FRONTIER is the useful half of a failure: every obstacle the flood got next to, and
    // what taking it would have done. An obstacle on the frontier whose landing tile is solid is
    // a bug in the obstacle, not a gap in the map.
    console.log('  on the frontier:');
    // every loc with an op, not just the ones the pattern matched - the thing that joins two
    // regions is sometimes not the thing you went looking for.
    const everything: Obst[] = [];
    for (const zone of ((World.gameMap as any).zonemap.zones as Map<number, any>).values()) {
        for (const loc of zone.getAllLocsUnsafe()) {
            if (loc.level !== level) continue;
            const t = LocType.get(loc.type);
            if (!(t.op ?? []).filter(Boolean).length) continue;
            const nm = t.debugname ?? 'loc_' + loc.type;
            everything.push({ name: nm + ' [' + (t.op ?? []).filter(Boolean).join('/') + ']', x: loc.x, z: loc.z });
        }
    }
    for (const o of everything) {
        for (const [dx, dz] of dirs) {
            const sx = o.x + dx;
            const sz = o.z + dz;
            if (!from.has(key(sx, sz))) continue;
            const [lx, lz] = landing(o, sx, sz);
            const why = from.has(key(lx, lz)) ? 'already reached' : blocked(lx, lz) ? 'LANDS IN SOLID GROUND' : 'open';
            console.log(`    ${o.name} at ${o.x},${o.z}  from ${sx},${sz} -> ${lx},${lz}  ${why}`);
        }
    }
    process.exit(1);
}
const steps: string[] = [];
let cx = bx;
let cz = bz;
while (!(cx === ax && cz === az)) {
    const f = from.get(key(cx, cz))!;
    if (f.via) steps.push(`  click ${f.via}   (from ${f.px},${f.pz} -> ${cx},${cz})`);
    cx = f.px;
    cz = f.pz;
}
steps.reverse();
console.log(`route from ${ax},${az} to ${bx},${bz}: ${steps.length} obstacle(s)`);
for (const s of steps) console.log(s);
