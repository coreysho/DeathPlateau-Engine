// CAN YOU WALK TO THORGEL? The Temple of Light is three floors of sixteen rooms, and every tool in
// here so far has asked about the LIGHT: templeverticals.ts proves the beam can reach the black
// door, templesolve.ts finds the mirrors that do it. Nothing asked about the PLAYER, and the player
// has to get to the Death Altar on foot - down the west end of the bottom floor, which is its own
// 178-tile region with exactly two ways in.
//
// So: flood every floor, then put a player on every tile that can reach a staircase, ladder, rope,
// wall jump or hanging rope and actually click it, and see which region it lands in. The doors of
// light are taken as passable, because templeverticals.ts already proved the beam can be routed to
// each of them. What comes out is the walking graph of the temple, and a route from the way in to
// the black door.
//
//   npx tsx tools/sim/templewalk.ts
import * as H from './harness.js';
import Player from '#/engine/entity/Player.js';
import World from '#/engine/World.js';
import LocType from '#/cache/config/LocType.js';
import { isFlagged, canTravel } from '#/engine/GameMap.js';
import { CollisionFlag, CollisionType } from '#/engine/routefinder/index.js';

await H.boot();

const X0 = 1856,
    X1 = 1940,
    Z0 = 4608,
    Z1 = 4672;
const open = (l: number, x: number, z: number) => !isFlagged(x, z, l, CollisionFlag.WALK_BLOCKED);
const KEY = (l: number, x: number, z: number) => l * 100000000 + x * 10000 + z;

// ---------------------------------------------------------------- the regions, floor by floor
const region = new Map<number, string>();
const size = new Map<string, number>();
let next = 0;
for (let l = 0; l <= 2; l++) {
    for (let x = X0; x <= X1; x++) {
        for (let z = Z0; z <= Z1; z++) {
            if (!open(l, x, z) || region.has(KEY(l, x, z))) continue;
            const name = `L${l}.${next++}`;
            const q: [number, number][] = [[x, z]];
            region.set(KEY(l, x, z), name);
            let n = 0;
            while (q.length) {
                const [cx, cz] = q.shift()!;
                n++;
                for (const [dx, dz] of [
                    [1, 0],
                    [-1, 0],
                    [0, 1],
                    [0, -1]
                ] as const) {
                    const nx = cx + dx,
                        nz = cz + dz;
                    if (nx < X0 || nx > X1 || nz < Z0 || nz > Z1) continue;
                    if (region.has(KEY(l, nx, nz))) continue;
                    if (!canTravel(l, cx, cz, dx, dz, 1, 1, CollisionType.NORMAL)) continue;
                    region.set(KEY(l, nx, nz), name);
                    q.push([nx, nz]);
                }
            }
            size.set(name, n);
        }
    }
}
const reg = (l: number, x: number, z: number) => region.get(KEY(l, x, z)) ?? '-';

// ---------------------------------------------------------------- every loc in the box
type Placed = { name: string; x: number; z: number; l: number; w: number; h: number; ops: string[] };
const locs: Placed[] = [];
for (const zone of ((World.gameMap as any).zonemap.zones as Map<number, any>).values()) {
    for (const loc of zone.getAllLocsUnsafe()) {
        if (loc.level > 2) continue;
        if (loc.x < X0 || loc.x > X1 || loc.z < Z0 || loc.z > Z1) continue;
        const t = LocType.get(loc.type);
        const ops = ((t.op ?? []) as (string | null)[]).map(o => o ?? '') as string[];
        if (!ops.some(o => o)) continue;
        locs.push({ name: t.debugname ?? 'loc_' + loc.type, x: loc.x, z: loc.z, l: loc.level, w: t.width, h: t.length, ops });
    }
}

const VERTICAL = /stairs|ladder|way_down|way_rope|wall_jump|agility_hanging/;
const DOOR = /^mourning_door_/;

// ---------------------------------------------------------------- the player who clicks them all
const p: Player = H.makePlayer('tmpwalk', 1916, 4639);
H.tick(2);
H.maxOut(p);
H.clearInv(p);
p.applyDamage = function () {};
H.tick(1);
// the five doors of light are locks on a beam colour; templeverticals.ts proves the beam can be
// routed to each, so for a walking question they are open
for (const n of ['1_13_east', '1_13_north', '1_16_north', '1_16_west', '1_1_east', '1_1_south', '1_b', '1_c', '2_16_north', '2_16_west', '2_4_south', '2_4_west']) {
    H.setVarBit(p, 'mourning_door_' + n, 1);
}
H.setVarBit(p, 'mourning_quest_main', 40);
H.setVarBit(p, 'mourning_light_door_1_c_first_time', 1);
H.tick(1);

type Edge = { from: string; to: string; via: string; at: string; stand: string };
const edges: Edge[] = [];
const climb = (lp: Placed) => {
    // every open tile that touches the footprint, including the diagonals
    const sides: [number, number][] = [];
    for (let dx = -1; dx <= lp.w; dx++)
        for (let dz = -1; dz <= lp.h; dz++) {
            const x = lp.x + dx,
                z = lp.z + dz;
            if (dx >= 0 && dx < lp.w && dz >= 0 && dz < lp.h) continue;
            if (open(lp.l, x, z)) sides.push([x, z]);
        }
    for (const op of [1, 2, 3, 4, 5]) {
        if (!lp.ops[op - 1]) continue;
        for (const [sx, sz] of sides) {
            const from = reg(lp.l, sx, sz);
            p.teleport(sx, sz, lp.l);
            H.tick(1);
            p.closeModal();
            try {
                H.opLoc(p, lp.x, lp.z, lp.name, op);
            } catch {
                continue;
            }
            for (let t = 0; t < 12; t++) H.tick(1);
            p.closeModal();
            if (p.level === lp.l && reg(p.level, p.x, p.z) === from) continue;
            const to = reg(p.level, p.x, p.z);
            if (to === '-') continue;
            if (edges.some(e => e.from === from && e.to === to && e.via === lp.name)) continue;
            edges.push({ from, to, via: `${lp.name}[${lp.ops[op - 1]}]`, at: `${lp.x},${lp.z},L${lp.l}`, stand: `${sx},${sz}` });
        }
    }
};

for (const lp of locs) if (VERTICAL.test(lp.name) || DOOR.test(lp.name)) climb(lp);

console.log('');
console.log('THE WALKING GRAPH OF THE TEMPLE OF LIGHT');
const byRegion = new Map<string, Edge[]>();
for (const e of edges) {
    if (!byRegion.has(e.from)) byRegion.set(e.from, []);
    byRegion.get(e.from)!.push(e);
}
for (const [r, es] of [...byRegion].sort()) {
    console.log(`  ${r} (${size.get(r)} tiles)`);
    for (const e of es) console.log(`      -> ${e.to} (${size.get(e.to)})  ${e.via} at ${e.at}, from ${e.stand}`);
}

// ---------------------------------------------------------------- the route that matters
const START = reg(0, 1916, 4639); // through the tunnel from the mourners' dig
const TARGETS: [string, string][] = [
    ['the east cave and its five corpses', reg(0, 1926, 4642)],
    ['the west corridor, behind the black door', reg(0, 1884, 4639)],
    ['Thorgel and the ruins', reg(0, 1860, 4641)],
    ['the black crystal on the top floor', reg(2, 1907, 4639)]
];
console.log('');
console.log(`you arrive in ${START} (${size.get(START)} tiles) at 1916,4639`);
for (const [what, target] of TARGETS) {
    const prev = new Map<string, Edge | null>([[START, null]]);
    const q = [START];
    while (q.length) {
        const r = q.shift()!;
        if (r === target) break;
        for (const e of byRegion.get(r) ?? []) {
            if (prev.has(e.to)) continue;
            prev.set(e.to, e);
            q.push(e.to);
        }
    }
    if (!prev.has(target)) {
        console.log(`  NO WALKING ROUTE to ${what} (${target}, ${size.get(target)} tiles)`);
        continue;
    }
    const chain: Edge[] = [];
    for (let r = target; prev.get(r); r = prev.get(r)!.from) chain.unshift(prev.get(r)!);
    console.log(`  ${what} (${target}): ${chain.length} climbs`);
    for (const e of chain) console.log(`      ${e.from} -> ${e.to}   ${e.via} at ${e.at}, standing ${e.stand}`);
}
process.exit(0);
