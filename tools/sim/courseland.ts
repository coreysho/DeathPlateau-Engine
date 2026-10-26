// WHERE AN AGILITY OBSTACLE SHOULD PUT YOU, derived from the obstacle rather than chosen.
//
// courseplan.ts picked each landing as "the walkable tile beside the NEXT obstacle, on the side you
// come from". That cannot produce an island or an unreachable approach, which is what it was for,
// and it is wrong in two ways that only showed up in the real client.
//
//   It skips the walking. ~agility_roof_move GLIDES the player the whole way to the landing, so a
//   landing beside the next obstacle means sliding ten tiles diagonally across rooftops with a
//   tightrope animation playing. Falador's first tightrope crosses one tile of rope and slides
//   seven more north; four of the nine tiles it draws the player on have no floor at all.
//
//   And the tile beside an obstacle is often the obstacle's own wall. Hand holds, ledges and
//   tightropes are approached from one side and mounted on a wall, so the tile adjacent to them on
//   that side is the wall tile - blocked, and with no overlay or underlay, which means the client
//   draws nothing there. ^falador_land_rope1 is 3049,3350, and the map says "3 41 22: h12 f1":
//   height 12, flag 1, no floor. rooftops.ts has always PRINTED that as a note and never asserted
//   it.
//
// So this derives the landing from the obstacle's own geometry: its footprint, which way it is
// placed, and which side forceapproach lets you stand on. A crossing goes from the approach side to
// the far side; something you shimmy along goes to the end of its long axis, on the side you were
// already on. Then every candidate is tested against the map and the engine:
//
//   FLOOR    the mapsquare's own row for that tile at that plane carries an overlay or an underlay,
//            which is the test for whether the client draws anything - the same question
//            draynorcourse.ts asks, and the one the course cam answers from the renderer itself
//   OPEN     the engine does not flag it WALK_BLOCKED
//   ONWARD   it is in the same walkable region as the next obstacle's approach, so the lap can be
//            continued ON FOOT, which is what makes the glide unnecessary
//
//   npx tsx tools/sim/courseland.ts [course]
import { readFileSync, writeFileSync } from 'fs';

import * as H from './harness.ts';
import * as A from './a1lib.ts';
import { COURSES } from './courses.ts';
import LocType from '#/cache/config/LocType.js';
import World from '#/engine/World.js';
import { CollisionFlag, CollisionType } from '#/engine/routefinder/index.js';
import { canTravel, isFlagged, reachedLoc } from '#/engine/GameMap.js';

await H.boot();

// ---------------------------------------------------------------- the constants as they stand
const C: Record<string, [number, number, number]> = {};
for (const course of COURSES) {
    const text = readFileSync(`../content/scripts/skill_agility/configs/${course.key}_course.constant`, 'utf8');
    for (const line of text.split(/\r?\n/)) {
        const m = /^\^(\w+)\s*=\s*(\d+)_(\d+)_(\d+)_(\d+)_(\d+)/.exec(line);
        if (m) C[m[1]] = [Number(m[3]) * 64 + Number(m[5]), Number(m[4]) * 64 + Number(m[6]), Number(m[2])];
    }
}

// ---------------------------------------------------------------- is anything DRAWN on this tile
//
// A plane-3 tile is drawn only if its mapsquare row gives it an overlay (o) or an underlay (u).
// Everything else is a hole: the client has no Ground and no QuickGround for it, and a player
// standing there is standing in the air. Read straight out of the .jm2, one square at a time.
const squares = new Map<string, Set<string>>();

function drawn(x: number, z: number, level: number): boolean {
    const mx = x >> 6;
    const mz = z >> 6;
    const key = `${mx}_${mz}`;
    let set = squares.get(key);
    if (!set) {
        set = new Set<string>();
        try {
            const text = readFileSync(`../content/maps/m${mx}_${mz}.jm2`, 'utf8');
            let section = '';
            for (const line of text.split(/\r?\n/)) {
                const t = line.trim();
                if (t.startsWith('====')) {
                    section = t.replace(/=/g, '').trim();
                    continue;
                }
                if (section !== 'MAP' || !t.includes(':')) continue;
                const [head, rest] = t.split(':');
                const [pl, lx, lz] = head.trim().split(/\s+/).map(Number);
                if (/\bo\d+/.test(rest) || /\bu\d+/.test(rest)) set.add(`${pl},${lx},${lz}`);
            }
        } catch {
            // no such square - nothing is drawn there
        }
        squares.set(key, set);
    }
    return set.has(`${level},${x & 63},${z & 63}`);
}

const open = (x: number, z: number, level: number) => !isFlagged(x, z, level, CollisionFlag.WALK_BLOCKED);

/**
 * AND SOMETIMES THE FLOOR IS A LOC. Half of these obstacles are things you climb ON TO rather than
 * over - a market stall, a basket, a banner, a steep roof, a pile of fish - and the tile you end up
 * on carries no overlay and no underlay, because what you are standing on is the obstacle's own
 * model. The engine flags that tile LOC and blocks it, which is exactly right: nobody can walk
 * there, and the player put there by the obstacle is standing on top of something.
 *
 * So "thin air" is the narrower claim: nothing drawn AND no loc either. Without this distinction a
 * sweep of the landings condemns Pollnivneach's whole course, which is nine obstacles of standing
 * on market furniture.
 */
const onLoc = (x: number, z: number, level: number) => isFlagged(x, z, level, CollisionFlag.LOC);

const thinAir = (x: number, z: number, level: number) => !drawn(x, z, level) && !onLoc(x, z, level);

/** Can a player stand here at all - some neighbour can step onto it. */
function standable(x: number, z: number, level: number): boolean {
    return (
        canTravel(level, x, z + 1, 0, -1, 1, 0, CollisionType.NORMAL) ||
        canTravel(level, x, z - 1, 0, 1, 1, 0, CollisionType.NORMAL) ||
        canTravel(level, x + 1, z, -1, 0, 1, 0, CollisionType.NORMAL) ||
        canTravel(level, x - 1, z, 1, 0, 1, 0, CollisionType.NORMAL)
    );
}

/** Every tile walkable from here, out to `limit` tiles of flood. */
function region(x: number, z: number, level: number, limit = 4000): Set<number> {
    const key = (a: number, b: number) => a * 20000 + b;
    const seen = new Set<number>([key(x, z)]);
    let q: [number, number][] = [[x, z]];
    while (q.length && seen.size < limit) {
        const next: [number, number][] = [];
        for (const [cx, cz] of q) {
            for (const [dx, dz] of [
                [1, 0],
                [-1, 0],
                [0, 1],
                [0, -1]
            ] as const) {
                const nx = cx + dx;
                const nz = cz + dz;
                if (seen.has(key(nx, nz))) continue;
                if (!canTravel(level, cx, cz, dx, dz, 1, 0, CollisionType.NORMAL)) continue;
                seen.add(key(nx, nz));
                next.push([nx, nz]);
            }
        }
        q = next;
    }
    return seen;
}

// ---------------------------------------------------------------- the obstacle, as placed
const DIRS = ['west', 'north', 'east', 'south'];

/**
 * The loc actually on the map at this tile, with the shape and angle it was placed at.
 *
 * Read out of the zone the way a1lib does it: the engine has no "what is at this tile" that takes
 * a type, and a loc is held by the zone whose 8x8 block its ORIGIN falls in - so a search of one
 * tile would miss a three-tile obstacle clicked at its far end.
 */
function placed(name: string, x: number, z: number, level: number) {
    const want = LocType.getId(name);
    for (let zx = (x - 8) & ~7; zx <= x + 8; zx += 8) {
        for (let zz = (z - 8) & ~7; zz <= z + 8; zz += 8) {
            for (const loc of World.gameMap.getZone(zx, zz, level).getAllLocsUnsafe()) {
                if (loc.type !== want) continue;
                if (Math.abs(loc.x - x) > 2 || Math.abs(loc.z - z) > 2) continue;
                return { loc, x: loc.x, z: loc.z, angle: loc.angle, shape: loc.shape };
            }
        }
    }
    return null;
}

/**
 * The footprint of a placed loc, in tiles: width x length, SWAPPED on an odd angle.
 * (See the loc-footprints note: a 3x2 on angle 1 covers 2x3.)
 */
function footprint(type: LocType, angle: number): [number, number] {
    const w = type.width ?? 1;
    const l = type.length ?? 1;
    return angle % 2 === 1 ? [l, w] : [w, l];
}

/**
 * Which side of the loc a player must stand on, as a unit vector, or null when any side will do.
 *
 * forceapproach is a mask of the sides that are REFUSED, rotated by the placement angle - the
 * packer writes `forceapproach=south` as 0b1111 & ~0b0001 in its own order. What matters here is
 * the one side left open, so the mask is read back: a single allowed side gives the vector.
 */
function approachSide(type: LocType, angle: number): [number, number] | null {
    const mask = (type as unknown as { forceapproach?: number }).forceapproach ?? 0;
    if (mask === 0) return null;
    // the four bits are north, east, south, west - a set bit means that side is BLOCKED
    const sides: [number, number][] = [
        [0, 1],
        [1, 0],
        [0, -1],
        [-1, 0]
    ];
    const allowed: [number, number][] = [];
    for (let i = 0; i < 4; i++) {
        const bit = 1 << ((i - angle + 8) % 4);
        if ((mask & bit) === 0) allowed.push(sides[i]);
    }
    if (allowed.length !== 1) return null;
    return allowed[0];
}

// ---------------------------------------------------------------- the far side of the obstacle
/**
 * WHERE THE CROSSING ENDS, walked out of the map rather than chosen off it.
 *
 * THE MAP MARKS THE OBSTACLE. Old School draws the span of a rope, a plank or a set of hand holds
 * with overlay 161 - the hidden one - and FLAGS IT BLOCKED, because it is not ground: it is the
 * thing you are crossing. Falador's first tightrope says so plainly, along z3343:
 *
 *   3039 h5 o118      roof, open      <- the player clicks the rope from here
 *   3040 h5 o118      roof, open      <- the rope loc itself stands here
 *   3041 h5 o161 f1   SPAN, blocked
 *   3042 h2 o161 f1   SPAN, blocked
 *   3043 h17 o161 f1  SPAN, blocked
 *   3044 h17 o118     roof, open      <- and this is where the crossing ends
 *
 * So the landing is found by walking: leave the obstacle in the direction of travel, cross its own
 * footprint and whatever span follows it, and stop at the first tile that is drawn, open and stood
 * upon. Nothing is invented - the only inputs are the obstacle's placement and the mapsquare's own
 * rows. The old constant for that rope was 3049,3350, nine tiles on and two storeys of roof away.
 *
 * The direction of travel is forceapproach's opposite - the side you may stand on is the side you
 * come FROM - and where any side will do, it is the heading towards the next obstacle.
 */
function farSide(
    ox: number,
    oz: number,
    foot: [number, number],
    level: number,
    side: [number, number] | null,
    from: [number, number],
    next: { x: number; z: number; level: number } | null
): { at: [number, number]; span: number; why: string } | null {
    const dirs: [number, number][] = [];
    if (side) {
        dirs.push([-side[0], -side[1]]);
    } else {
        // NO FORCEAPPROACH: the player's own heading, which is the line from where they are
        // standing through the obstacle. Better evidence than the next obstacle's bearing - the
        // next one can be round a corner, and Canifis' gap 1 is crossed north while the obstacle
        // after it lies west.
        const tx = ox - from[0] !== 0 ? ox - from[0] : next ? next.x - ox : 0;
        const tz = oz - from[1] !== 0 ? oz - from[1] : next ? next.z - oz : 0;
        if (Math.abs(tx) >= Math.abs(tz)) {
            if (tx !== 0) dirs.push([Math.sign(tx), 0]);
            if (tz !== 0) dirs.push([0, Math.sign(tz)]);
        } else {
            if (tz !== 0) dirs.push([0, Math.sign(tz)]);
            if (tx !== 0) dirs.push([Math.sign(tx), 0]);
        }
    }
    // AND THE TWO SIDEWAYS HEADINGS AFTER IT. An obstacle with no forceapproach can be crossed in
    // more than one direction and the heading is a guess; trying the perpendiculars after it costs
    // nothing and is how the Seers' gaps are found, which run across the heading rather than along
    // it. Back the way the player came is never tried: that is not a crossing.
    const seen = new Set<string>();
    const all: [number, number][] = [];
    for (const d of dirs) {
        if (!seen.has(d.toString())) {
            all.push(d);
            seen.add(d.toString());
        }
    }
    for (const [dx, dz] of [...dirs]) {
        for (const perp of [
            [dz, dx],
            [-dz, -dx]
        ] as [number, number][]) {
            if (!seen.has(perp.toString())) {
                all.push(perp);
                seen.add(perp.toString());
            }
        }
    }

    // IN ORDER, FIRST ANSWER WINS. Taking the cheapest answer across all four headings instead
    // sounds better and is not: the tile immediately sideways of a tightrope costs nothing to
    // reach and crosses nothing, so Falador's first rope stopped being derived as the far end of
    // its own three-tile span and became the roof tile beside it.
    for (const [dx, dz] of all) {
        // start from the far face of the footprint, which is where the obstacle stops
        let x = ox + (dx > 0 ? foot[0] - 1 : 0);
        let z = oz + (dz > 0 ? foot[1] - 1 : 0);
        let span = 0;
        let holes = 0;
        for (let step = 0; step < 10; step++) {
            x += dx;
            z += dz;
            if (!thinAir(x, z, level) && open(x, z, level) && standable(x, z, level)) {
                // TWO KINDS OF THING GET CROSSED and they are told apart by the map. A rope, a
                // plank or a set of hand holds is DRAWN AND FLAGGED - overlay 161 and f1 - because
                // it is the obstacle itself. A gap between two roofs is drawn as nothing at all,
                // because it is a hole over the street. Both are legitimate; a long run of holes
                // is not, because it means the walk has left the course and found another roof.
                if (holes > 6) break;
                const why =
                    span && holes
                        ? `${span} of span and ${holes} of gap crossed`
                        : span
                          ? `${span} tiles of span crossed`
                          : holes
                            ? `${holes} tiles of gap crossed`
                            : 'the tile past it';
                return { at: [x, z], span, why };
            }
            if (thinAir(x, z, level)) {
                holes++;
            } else {
                span++;
            }
        }
    }
    return null;
}

/**
 * AND THE TILE AT THE NEXT OBSTACLE, when the roofs do not join up.
 *
 * This is what courseplan.ts was reaching for and it is right more often than the far side is: a
 * rooftop course is a chain of crossings with no walking in between, and on most of these courses
 * the roofs are NOT connected - the landing at the end of one obstacle has no route to the next one
 * at all. Seven landings were moved to their obstacle's own far side and then could not walk on,
 * which is a worse bug than the one being fixed.
 *
 * What courseplan got wrong was only the tile: "adjacent to the next obstacle, on the side you come
 * from" is the next obstacle's own wall as often as not, and a wall tile is blocked and has nothing
 * drawn on it. So the same idea, filtered: the closest tile to the next obstacle that is drawn, open
 * and stood upon, preferring one it can actually be clicked from.
 */
function atNext(
    next: { name: string; loc: string; x: number; z: number; level: number },
    level: number,
    fromX: number,
    fromZ: number
): [number, number] | null {
    let best: [number, number] | null = null;
    let bestScore = -1e9;
    for (let dx = -4; dx <= 4; dx++) {
        for (let dz = -4; dz <= 4; dz++) {
            const x = next.x + dx;
            const z = next.z + dz;
            if (!drawn(x, z, level) || !open(x, z, level) || !standable(x, z, level)) continue;
            // AND THE NEXT OBSTACLE HAS TO BE CLICKABLE FROM IT. Being near it is not enough: a
            // tile two squares from a gap can be across a wall from it, or on the wrong side of
            // the forceapproach. Three laps broke on exactly that - the player walked towards the
            // obstacle, never arrived, and the op never ran. The engine's own routing answers it.
            if (next.level === level && !clickable(level, x, z, next.loc, next.x, next.z)) continue;
            const d = Math.max(Math.abs(dx), Math.abs(dz));
            // close to the obstacle, and on the side the player is coming from
            const sameSide =
                Math.sign(fromX - next.x) === Math.sign(dx) || Math.sign(fromZ - next.z) === Math.sign(dz);
            const score = -d * 4 + (sameSide ? 3 : 0) + (d === 1 ? 2 : 0);
            if (score > bestScore) {
                bestScore = score;
                best = [x, z];
            }
        }
    }
    return best;
}

/**
 * CAN THE OBSTACLE BE CLICKED FROM THIS TILE - the engine's own answer, not a1lib's.
 *
 * a1lib.reachLoc routes to the loc and, when no route exists, falls back to measuring from the
 * player's own tile: within one tile of the footprint it answers yes whether or not anything can
 * get there. That false positive put Pollnivneach's market-stall landing one tile south of the
 * banner with a blocked edge between them, and the lap stopped there - the click was accepted, the
 * player never arrived, and the op never ran. rsmod's reached() applies the edge and the
 * forceapproach mask, which is what the interaction itself uses.
 */
function clickable(level: number, x: number, z: number, name: string, lx: number, lz: number): boolean {
    const id = LocType.getId(name);
    const found = placed(name, lx, lz, level);
    if (!found) return false;
    const type = LocType.get(id);
    return reachedLoc(
        level,
        x,
        z,
        found.loc.x,
        found.loc.z,
        found.loc.width,
        found.loc.length,
        1,
        found.angle,
        found.shape,
        (type as unknown as { forceapproach?: number }).forceapproach ?? 0
    );
}

/** Can a player walk from here to a tile beside that obstacle? */
function walksOnTo(x: number, z: number, level: number, next: { x: number; z: number; level: number }): boolean {
    if (next.level !== level) return false;
    const reg = region(x, z, level, 2500);
    return [
        [next.x, next.z],
        [next.x + 1, next.z],
        [next.x - 1, next.z],
        [next.x, next.z + 1],
        [next.x, next.z - 1]
    ].some(([nx, nz]) => reg.has(nx * 20000 + nz));
}

// ---------------------------------------------------------------- the report
const only = process.argv[2] && process.argv[2] !== '--fix' ? process.argv[2] : undefined;
const fixing = process.argv.includes('--fix');
const proposals: string[] = [];
let flagged = 0;
let floorless = 0;
let stranded = 0;

for (const course of COURSES) {
    if (only && only !== course.key) continue;
    console.log(`\n================ ${course.title}`);
    console.log(
        '  ' +
            'obstacle'.padEnd(15) +
            'placed'.padEnd(18) +
            'faces'.padEnd(7) +
            'landing now'.padEnd(17) +
            'map says'
    );
    let from: [number, number] = [course.start[0], course.start[1]];
    for (let i = 0; i < course.obstacles.length; i++) {
        const o = course.obstacles[i];
        const p = placed(o.loc, o.x, o.z, o.level);
        const land = C[o.land];
        let desc = 'UNPLACED';
        let foot = '?';
        let faces = '-';
        if (p) {
            const type = LocType.get(p.loc.type);
            const [fw, fl] = footprint(type, p.angle);
            foot = `${fw}x${fl}`;
            const side = approachSide(type, p.angle);
            faces = side ? DIRS[[-1, 0].toString() === side.toString() ? 0 : [0, 1].toString() === side.toString() ? 1 : [1, 0].toString() === side.toString() ? 2 : 3] : 'any';
            desc = `${p.x},${p.z} s${p.shape} a${p.angle}`;
        }
        let verdict = '';
        let fatal = false;
        if (!land) {
            verdict = 'NO CONSTANT';
        } else {
            const bits: string[] = [];
            if (thinAir(land[0], land[1], land[2])) {
                bits.push('THIN AIR');
                floorless++;
                fatal = true;
            } else if (!drawn(land[0], land[1], land[2])) {
                // not drawn, but a loc is there: the player is standing on the obstacle
                bits.push('on a loc');
            }
            if (!open(land[0], land[1], land[2])) {
                flagged++;
                if (!onLoc(land[0], land[1], land[2])) {
                    // blocked by something that is not a loc you could be standing on
                    bits.push('BLOCKED');
                    fatal = true;
                }
            }
            if (!standable(land[0], land[1], land[2]) && !onLoc(land[0], land[1], land[2])) {
                bits.push('nothing can step onto it');
            }
            // can the lap carry on from here on foot, to the NEXT obstacle's approach?
            const next = course.obstacles[(i + 1) % course.obstacles.length];
            const nland = C[next.land];
            if (nland && nland[2] === land[2] && open(land[0], land[1], land[2])) {
                const reg = region(land[0], land[1], land[2]);
                const near = [
                    [next.x, next.z],
                    [next.x + 1, next.z],
                    [next.x - 1, next.z],
                    [next.x, next.z + 1],
                    [next.x, next.z - 1]
                ].some(([x, z]) => reg.has(x * 20000 + z));
                if (!near && next.level === land[2]) {
                    bits.push('cannot walk on to ' + next.name);
                    stranded++;
                }
            }
            verdict = bits.length ? bits.join(', ') : 'floor, open' + (land[2] === o.level ? '' : ', changes plane');
        }
        console.log(
            '  ' +
                o.name.padEnd(15) +
                desc.padEnd(18) +
                faces.padEnd(7) +
                (land ? `${land[0]},${land[1]} L${land[2]}` : '-').padEnd(17) +
                verdict
        );
        // AND WHERE THE OBSTACLE ITSELF SAYS THE CROSSING ENDS. Derived for every obstacle, not
        // only the broken ones, because a derivation that agrees with the constant everywhere it
        // is sound is the only reason to believe it where it disagrees.
        if (p && land) {
            const type = LocType.get(p.loc.type);
            const nextOb = course.obstacles[i + 1] ?? null;
            const side = approachSide(type, p.angle);
            // FIRST CHOICE: the obstacle's own far side, IF the lap can go on from there on foot.
            // Second choice: a real tile at the next obstacle, because most of these roofs do not
            // join up and obstacle-to-obstacle is then the only thing that works - and is how the
            // course plays anyway.
            const far = farSide(p.x, p.z, footprint(type, p.angle), land[2], side, from, nextOb);
            let got: { at: [number, number]; why: string } | null = null;
            const farUsable =
                far &&
                (!nextOb ||
                    walksOnTo(far.at[0], far.at[1], land[2], nextOb) ||
                    (nextOb.level === land[2] && clickable(land[2], far.at[0], far.at[1], nextOb.loc, nextOb.x, nextOb.z)));
            if (far && farUsable) {
                got = { at: far.at, why: far.why + ', and walkable on from there' };
            } else if (nextOb) {
                const near = atNext(nextOb, land[2], p.x, p.z);
                if (near) {
                    got = {
                        at: near,
                        why: far
                            ? `the far side is ${far.at[0]},${far.at[1]} but nothing walks on from it - so the tile at ${nextOb.name}`
                            : `the tile at ${nextOb.name}`
                    };
                }
            } else if (far) {
                got = { at: far.at, why: far.why };
            }
            if (!got) {
                console.log(`  ${''.padEnd(15)}derived: nothing to land on${fatal ? '   <- AND THE CONSTANT IS IMPOSSIBLE' : ''}`);
                if (fatal) proposals.push(`${course.key}\t${o.land}\t${land[0]},${land[1]}\tNOTHING\t-`);
            } else if (got.at[0] === land[0] && got.at[1] === land[1]) {
                console.log(`  ${''.padEnd(15)}derived: the same tile (${got.why})`);
            } else {
                const line = `^${o.land} = ${land[2]}_${got.at[0] >> 6}_${got.at[1] >> 6}_${got.at[0] & 63}_${got.at[1] & 63}`;
                const d = Math.max(Math.abs(land[0] - got.at[0]), Math.abs(land[1] - got.at[1]));
                console.log(
                    `  ${''.padEnd(15)}derived: ${got.at[0]},${got.at[1]} L${land[2]} (${got.why}), ${d} tiles off` +
                        (fatal ? '   <- AND THE CONSTANT IS IMPOSSIBLE' : '')
                );
                if (fatal) proposals.push(`${course.key}\t${o.land}\t${land[0]},${land[1]}\t${got.at[0]},${got.at[1]}\t${line}`);
            }
        }
        from = land ? [land[0], land[1]] : from;
    }
}

console.log('');
console.log(`${floorless} landing(s) with no floor drawn, ${flagged} on a blocked tile, ${stranded} with no way on by foot`);
if (fixing && proposals.length) {
    const path = 'tools/sim/_courseland_fix.tsv';
    writeFileSync(path, proposals.join('\n') + '\n');
    console.log(`\n${proposals.length} proposed landing(s) written to ${path}`);
}
process.exit(0);
