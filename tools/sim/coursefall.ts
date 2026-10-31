// WHERE A FAILED ROOFTOP OBSTACLE DROPS YOU, derived rather than chosen.
//
// "Failing the obstacle will drop the player below, requiring them to start the course over" - the
// wiki's page for Falador's hand holds, the only one that spells the mechanic out. So a failure is
// a LANDING, in the street, and it is the one kind of landing in this build that nothing has ever
// checked. The three courses that already had a slip rolled ^*_mark_chance and took a little
// damage where they stood, with a comment saying why: "a fall needs a street tile per obstacle and
// that is guesswork."
//
// It is not guesswork any more, because the same three tests that caught nineteen thin-air
// landings apply to a fall tile, plus one that only a fall needs:
//
//   FLOOR      the mapsquare draws a floor there - mapfloor.drawn, and NOT onLoc: a fall lands in
//              the street, so the top of a market stall or a basket is the wrong answer even
//              though a player can stand on it
//   OPEN       the engine does not flag it WALK_BLOCKED
//   STANDABLE  some neighbour can step onto it, which is the question tilemap cannot answer
//   BACK TO THE START  it is in the same level-0 walkable region as the course's own start tile.
//              This is the one a fall needs and a crossing does not: Old School makes you start
//              the course over, so a fall tile you cannot walk back to the entrance from is a
//              player stuck in somebody's back yard.
//
// The search is rings outward from the obstacle's own tile, so the answer is the closest street
// tile to the thing you fell off, which is where falling off it would put you.
//
//   npx tsx tools/sim/coursefall.ts [course]        report
//   npx tsx tools/sim/coursefall.ts --write         and write the constants
import { readFileSync, writeFileSync } from 'fs';

import * as H from './harness.js';
import { COURSES } from './courses.js';
import { drawn } from './mapfloor.js';
import { canTravel, isFlagged } from '#/engine/GameMap.js';
import { CollisionFlag, CollisionType } from '#/engine/routefinder/index.js';

await H.boot();

const args = process.argv.slice(2);
const writing = args.includes('--write');
const only = args.filter(a => !a.startsWith('--'));

const DIRS: [number, number][] = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1]
];
const key = (x: number, z: number) => x * 20000 + z;

const open = (x: number, z: number, level: number) => !isFlagged(x, z, level, CollisionFlag.WALK_BLOCKED);

/** Can a player be put here at all - some neighbour can step onto it. */
function standable(x: number, z: number, level: number): boolean {
    return DIRS.some(([dx, dz]) => canTravel(level, x - dx, z - dz, dx, dz, 1, 0, CollisionType.NORMAL));
}

/**
 * Every tile walkable from here on this plane.
 *
 * THE CAP MUST NOT BIND, or "not joined to the start" means "the flood stopped before it got
 * there" and a perfectly good fall tile is rejected for it. The street regions here come out
 * around 225,000 tiles; at a cap of 40,000 the frontier stopped about 113 tiles out, which was
 * still comfortably past every obstacle - the three tiles Al Kharid's zip line rejects are
 * rejected identically either way - but the margin was luck rather than design. The count is
 * printed per course so a cap that starts binding is visible.
 */
function region(x: number, z: number, level: number, cap = 400000): Set<number> {
    const seen = new Set<number>([key(x, z)]);
    let q: [number, number][] = [[x, z]];
    while (q.length && seen.size < cap) {
        const next: [number, number][] = [];
        for (const [cx, cz] of q) {
            for (const [dx, dz] of DIRS) {
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

/** The tiles of a Chebyshev ring of radius r around x,z, nearest-first within the ring. */
function ring(x: number, z: number, r: number): [number, number][] {
    if (r === 0) return [[x, z]];
    const out: [number, number][] = [];
    for (let dx = -r; dx <= r; dx++) {
        for (let dz = -r; dz <= r; dz++) {
            if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
            out.push([x + dx, z + dz]);
        }
    }
    // euclidean within the ring, then a fixed order, so the answer never depends on iteration luck
    out.sort((a, b) => {
        const da = (a[0] - x) ** 2 + (a[1] - z) ** 2;
        const db = (b[0] - x) ** 2 + (b[1] - z) ** 2;
        return da - db || a[0] - b[0] || a[1] - b[1];
    });
    return out;
}

const REACH = 16;
let missing = 0;
const proposals: { course: string; name: string; line: string }[] = [];

/**
 * STAND IN A PLACE BEFORE MEASURING IT. A zone is not allocated until somebody has been near it,
 * and an unallocated zone answers "blocked" to everything - so a probe that measures first calls
 * the whole street solid and every fall tile impossible. pyrfall.ts learned this the same way.
 */
function seed(key: string, x: number, z: number) {
    const p = H.makePlayer(`fall_seed_${key}_${x}_${z}`, x, z);
    p.teleport(x, z, 0);
    H.tick(2);
}

for (const course of COURSES) {
    const failable = course.obstacles.filter(o => o.fail);
    if (!failable.length) continue;
    if (only.length && !only.includes(course.key)) continue;

    // the start, and a box round every failable obstacle wide enough to cover the search
    seed(course.key, course.start[0], course.start[1]);
    for (const o of failable) {
        for (const [dx, dz] of [
            [0, 0],
            [-REACH, 0],
            [REACH, 0],
            [0, -REACH],
            [0, REACH]
        ] as const) {
            seed(course.key, o.x + dx, o.z + dz);
        }
    }

    const back = region(course.start[0], course.start[1], 0);
    console.log('');
    console.log(`${course.title} (${failable.length} failable, stops at ${course.failStop} Agility, ${back.size} street tiles from the start)`);

    for (const o of failable) {
        let got: { x: number; z: number; r: number } | null = null;
        const why: string[] = [];
        for (let r = 0; r <= REACH && !got; r++) {
            for (const [x, z] of ring(o.x, o.z, r)) {
                if (!drawn(x, z, 0)) continue;
                if (!open(x, z, 0)) continue;
                if (!standable(x, z, 0)) continue;
                if (!back.has(key(x, z))) {
                    if (why.length < 3) why.push(`${x},${z} is floor but not joined to the start`);
                    continue;
                }
                got = { x, z, r };
                break;
            }
        }
        if (!got) {
            missing++;
            console.log(`  ${o.name.padEnd(15)} NOTHING within ${REACH} tiles` + (why.length ? ` (${why.join('; ')})` : ''));
            continue;
        }
        const line = `^${o.fail!.land} = 0_${got.x >> 6}_${got.z >> 6}_${got.x & 63}_${got.z & 63}`;
        const note = why.length ? `, past ${why.length} tile(s) not joined to the start` : '';
        console.log(
            `  ${o.name.padEnd(15)} falls to ${String(got.x) + ',' + got.z} L0  ` +
                `${got.r} tile(s) from the obstacle at ${o.x},${o.z} L${o.level}  ` +
                `dmg ${o.fail!.dmg[0]}-${o.fail!.dmg[1]}${note}`
        );
        proposals.push({ course: course.key, name: o.fail!.land, line });
    }
}

console.log('');
console.log(`${proposals.length} fall tile(s) derived, ${missing} with nothing to land on`);

if (writing && proposals.length) {
    const byCourse = new Map<string, string[]>();
    for (const p of proposals) {
        if (!byCourse.has(p.course)) byCourse.set(p.course, []);
        byCourse.get(p.course)!.push(p.line);
    }
    for (const [course, lines] of byCourse) {
        const path = `../content/scripts/skill_agility/configs/${course}_course.constant`;
        const text = readFileSync(path, 'utf8');
        const crlf = text.includes('\r\n');
        const body = text.replace(/\r\n/g, '\n').replace(/\n+$/, '');
        const already = lines.filter(l => body.includes(l.split(' =')[0] + ' ='));
        if (already.length) {
            console.log(`${course}: ${already.length} already present, left alone`);
        }
        const add = lines.filter(l => !body.includes(l.split(' =')[0] + ' ='));
        if (!add.length) continue;
        const block = [
            '',
            '// WHERE A FAILURE DROPS YOU, derived by tools/sim/coursefall.ts: the nearest street tile to',
            '// the obstacle that the client draws a floor for, that the engine does not block, that a',
            '// neighbour can step onto, and that is in the same walkable region as the course start - so',
            '// a player who falls can walk back and start the lap over, which is what Old School makes',
            '// them do. Re-derive rather than hand-edit.',
            ...add
        ].join('\n');
        writeFileSync(path, (body + block + '\n').replace(/\n/g, crlf ? '\r\n' : '\n'), 'utf8');
        console.log(`${course}: wrote ${add.length} constant(s) to ${path}`);
    }
}

process.exit(missing ? 1 : 0);
