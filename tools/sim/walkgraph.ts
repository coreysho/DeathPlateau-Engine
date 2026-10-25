// HOW DOES A PLAYER GET FROM HERE TO THERE? The general form of tools/sim/templewalk.ts, which was
// written for the Temple of Light and then wanted again for the Miscellania castle, Yrsa's shop and
// Swensen's house. Flood every plane inside a box, then put a player beside every door, staircase,
// ladder, gangplank and trapdoor in it and actually click it, and see which region it lands in.
// What comes out is the walking graph, and a route between any two tiles in it.
//
// A region flood answers "can I walk there"; this answers "can I GET there", which is a different
// question as soon as a door or a staircase is in the way - and a click on an npc or a loc behind a
// wall is thrown away with no message at all, so the difference is invisible from a manifest.
//
//   npx tsx tools/sim/walkgraph.ts <x0> <x1> <z0> <z1> <maxLevel> [fromL,fromX,fromZ] [toL,toX,toZ]...
//   npx tsx tools/sim/walkgraph.ts 2490 2620 3840 3900 2  0,2581,3846  1,2503,3857  1,2503,3851
import * as H from './harness.js';
import Player from '#/engine/entity/Player.js';
import World from '#/engine/World.js';
import LocType from '#/cache/config/LocType.js';
import { isFlagged, canTravel } from '#/engine/GameMap.js';
import { CollisionFlag, CollisionType } from '#/engine/routefinder/index.js';

await H.boot();

const a = process.argv.slice(2);
const X0 = Number(a[0] ?? 0);
const X1 = Number(a[1] ?? 0);
const Z0 = Number(a[2] ?? 0);
const Z1 = Number(a[3] ?? 0);
const MAXL = Number(a[4] ?? 0);
const POINTS = a.slice(5).map(s => s.split(',').map(Number) as [number, number, number]);
if (!X1 || POINTS.length < 2) {
    console.log('usage: walkgraph.ts <x0> <x1> <z0> <z1> <maxLevel> <L,X,Z from> <L,X,Z to>...');
    process.exit(1);
}

const open = (l: number, x: number, z: number) => !isFlagged(x, z, l, CollisionFlag.WALK_BLOCKED);
const KEY = (l: number, x: number, z: number) => l * 100000000 + x * 10000 + z;

// ---------------------------------------------------------------- the regions, plane by plane
const region = new Map<number, string>();
const size = new Map<string, number>();
let next = 0;
for (let l = 0; l <= MAXL; l++)
    for (let x = X0; x <= X1; x++)
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
const reg = (l: number, x: number, z: number) => region.get(KEY(l, x, z)) ?? '-';

// ---------------------------------------------------------------- every loc worth clicking
type Placed = { name: string; x: number; z: number; l: number; w: number; h: number; ops: string[] };
const locs: Placed[] = [];
for (const zone of ((World.gameMap as any).zonemap.zones as Map<number, any>).values())
    for (const loc of zone.getAllLocsUnsafe()) {
        if (loc.level > MAXL) continue;
        if (loc.x < X0 || loc.x > X1 || loc.z < Z0 || loc.z > Z1) continue;
        const t = LocType.get(loc.type);
        const ops = ((t.op ?? []) as (string | null)[]).map(o => o ?? '');
        if (!ops.some(o => o)) continue;
        const nm = t.debugname ?? 'loc_' + loc.type;
        // a door, a way up or down, or a way across: everything else is scenery for this purpose
        if (!/open|close|pass|climb|enter|exit|cross|gangplank|jump|walk-through|squeeze/i.test(ops.join(' ') + ' ' + nm)) continue;
        locs.push({ name: nm, x: loc.x, z: loc.z, l: loc.level, w: t.width, h: t.length, ops });
    }

const p: Player = H.makePlayer('walkgraph', POINTS[0][1], POINTS[0][2]);
H.tick(2);
H.maxOut(p);
H.clearInv(p);
p.applyDamage = function () {};
H.tick(1);

type Edge = { from: string; to: string; via: string; at: string; stand: string };
const edges: Edge[] = [];
for (const lp of locs) {
    const sides: [number, number][] = [];
    for (let dx = -1; dx <= lp.w; dx++)
        for (let dz = -1; dz <= lp.h; dz++) {
            if (dx >= 0 && dx < lp.w && dz >= 0 && dz < lp.h) continue;
            if (open(lp.l, lp.x + dx, lp.z + dz)) sides.push([lp.x + dx, lp.z + dz]);
        }
    for (let op = 1; op <= 5; op++) {
        if (!lp.ops[op - 1]) continue;
        for (const [sx, sz] of sides) {
            const from = reg(lp.l, sx, sz);
            if (from === '-') continue;
            p.teleport(sx, sz, lp.l);
            H.tick(1);
            p.closeModal();
            try {
                H.opLoc(p, lp.x, lp.z, lp.name, op);
            } catch {
                continue;
            }
            for (let t = 0; t < 10; t++) H.tick(1);
            p.closeModal();
            const to = reg(p.level, p.x, p.z);
            if (to !== '-' && to !== from) {
                if (!edges.some(e => e.from === from && e.to === to && e.via.startsWith(lp.name)))
                    edges.push({ from, to, via: `${lp.name}[${lp.ops[op - 1]}]`, at: `${lp.x},${lp.z},L${lp.l}`, stand: `${sx},${sz}` });
                continue;
            }
            // AN ORDINARY DOOR DOES NOT MOVE YOU. ~open_door swaps the closed loc for an open one
            // beside it and leaves the player where they stood, so a "did the player change region"
            // test sees nothing - and yet the two rooms either side are now joined. Those are the
            // doors that matter most in a castle, so a click that opened something links this side
            // to every other region the loc touches.
            if (!/open/i.test(lp.ops[op - 1])) continue;
            for (const [ox, oz] of sides) {
                const other = reg(lp.l, ox, oz);
                if (other === '-' || other === from) continue;
                if (edges.some(e => e.from === from && e.to === other && e.via.startsWith(lp.name))) continue;
                edges.push({ from, to: other, via: `${lp.name}[${lp.ops[op - 1]}]`, at: `${lp.x},${lp.z},L${lp.l}`, stand: `${sx},${sz}` });
            }
        }
    }
}

// A DOOR OPENS FROM EITHER SIDE, and the edge was only recorded from whichever side the click was
// made on - so the graph has to be read both ways for them. A staircase is not symmetric (its
// other end is its own loc, found on its own plane) and is left one-way.
const byRegion = new Map<string, Edge[]>();
const add = (e: Edge) => {
    if (!byRegion.has(e.from)) byRegion.set(e.from, []);
    byRegion.get(e.from)!.push(e);
};
for (const e of edges) {
    add(e);
    if (/\[(open|close|pass)/i.test(e.via) && e.from.split('.')[0] === e.to.split('.')[0])
        add({ from: e.to, to: e.from, via: e.via, at: e.at, stand: e.stand });
}
console.log('');
console.log(`${size.size} regions, ${edges.length} edges, from ${locs.length} doors and climbables`);
if (process.env.WALKGRAPH_EDGES) for (const e of edges) console.log(`  EDGE ${e.from} -> ${e.to}  ${e.via} at ${e.at}, standing ${e.stand}`);
const START = reg(POINTS[0][0], POINTS[0][1], POINTS[0][2]);
console.log(`start ${POINTS[0][1]},${POINTS[0][2]} L${POINTS[0][0]} is in ${START} (${size.get(START)} tiles)`);
for (const [l, x, z] of POINTS.slice(1)) {
    const target = reg(l, x, z);
    if (target === '-') {
        console.log(`  ${x},${z} L${l}: not a standable tile`);
        continue;
    }
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
        console.log(`  ${x},${z} L${l} (${target}, ${size.get(target)} tiles): NO ROUTE`);
        continue;
    }
    const chain: Edge[] = [];
    for (let r = target; prev.get(r); r = prev.get(r)!.from) chain.unshift(prev.get(r)!);
    console.log(`  ${x},${z} L${l} (${target}, ${size.get(target)} tiles): ${chain.length} clicks`);
    for (const e of chain) console.log(`      ${e.from} -> ${e.to}   ${e.via} at ${e.at}, standing ${e.stand}`);
}
process.exit(0);
