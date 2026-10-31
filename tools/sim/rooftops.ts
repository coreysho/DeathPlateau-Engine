// Every rooftop course after Al Kharid, on the real engine, from one table.
//
// Draynor and Al Kharid have sims of their own because each taught something the next one needed.
// What they taught is built in here, so a course added below inherits all of it:
//
//   * a landing has to be somewhere the player can actually STAND - engine collision, not the map
//     file, because a roof is terrain in one town and locs in another (Draynor's is terrain and
//     Varrock's is locs, and an overlay-based check calls Varrock's roofs thin air);
//   * a WALKED crossing is replayed tile by tile with ~agility_walk's diagonal-first rule, because
//     Draynor shipped both tightropes crossing the row NEXT to the rope and a landings-only check
//     passed it;
//   * the experience is in TENTHS of a point - stat_advance takes xp * 10 - which Draynor and Al
//     Kharid both got wrong, paying a tenth of the rate;
//   * and the lap is walked end to end, which is the only thing that catches an obstacle a player
//     cannot reach from the one before it. Al Kharid's tropical tree is exactly that.
//
//   npx tsx tools/sim/rooftops.ts [course]
import { readFileSync } from 'fs';

import * as H from './harness.ts';
import * as A from './a1lib.ts';
import { COURSES } from './courses.ts';
import { thinAir } from './mapfloor.ts';
import { check, R, player } from './a1lib.ts';
import VarPlayerType from '#/cache/config/VarPlayerType.js';
import { CollisionFlag } from '#/engine/routefinder/index.js';
import { isFlagged } from '#/engine/GameMap.js';
import JavaRandom from '#/util/JavaRandom.js';

await H.boot();

// EVERY ATTEMPT SUCCEEDS WHILE A LAP IS BEING WALKED. stat_random's roll is
// floor(nextDouble() * 256) and success is `value > roll`, so a pinned 0 passes everything. Eleven
// rooftop obstacles can now be failed, and they are at their most failable at the entry level,
// which is the level these laps run at - so an unpinned lap would lose a landing, its experience
// and its counter to a one-in-eight roll several runs in ten. tools/sim/roofall.ts pins it the
// other way and tests the fall on purpose.
const origNextDouble = JavaRandom.nextDouble.bind(JavaRandom);
const alwaysPass = (on: boolean) => {
    (JavaRandom as unknown as { nextDouble: () => number }).nextDouble = on ? () => 0 : origNextDouble;
};

// ---------------------------------------------------------------- the constant files
const K: Record<string, number> = {};
const C: Record<string, [number, number, number]> = {};
for (const course of COURSES) {
    const text = readFileSync(`../content/scripts/skill_agility/configs/${course.key}_course.constant`, 'utf8');
    for (const line of text.split(/\r?\n/)) {
        let m = /^\^(\w+)\s*=\s*(\d+)_(\d+)_(\d+)_(\d+)_(\d+)/.exec(line);
        if (m) {
            C[m[1]] = [Number(m[3]) * 64 + Number(m[5]), Number(m[4]) * 64 + Number(m[6]), Number(m[2])];
            continue;
        }
        m = /^\^(\w+)\s*=\s*(-?\d+)\s*(?:\/\/.*)?$/.exec(line);
        if (m) K[m[1]] = Number(m[2]);
    }
}

// ~agility_walk moves one tile a tick and spends its diagonal FIRST.
function _walk(from: [number, number, number], to: [number, number, number]) {
    const out: [number, number, number][] = [[from[0], from[1], from[2]]];
    let [x, z] = from;
    while (x !== to[0] || z !== to[1]) {
        x += Math.sign(to[0] - x);
        z += Math.sign(to[1] - z);
        out.push([x, z, to[2]]);
    }
    return out;
}

/**
 * THE TWO LANDINGS THAT READ AS THIN AIR AND ARE CORRECT. Asked and answered - do not reopen.
 *
 * Pollnivneach's course is climbed across market furniture, and at these two points thinAir() is
 * true: no overlay, no underlay and no loc on the tile, at 3355,2978 on plane 1 and 3362,3000 on
 * plane 2. This used to end "what this needs is a decision about Pollnivneach's market roofs -
 * probably floor added to the map". It needs nothing, and floor added to the map would be a bug.
 *
 * OLD SCHOOL HAS EXACTLY WHAT WE HAVE. Both tiles read " f1" - flagged, no overlay, no underlay -
 * in the rev236 cache AND in the newest one, and the ring of locs around each matches ours tile
 * for tile (their 26587 is our 18964; their 14937, the banner, is our 19069 at 28,34). So the
 * terrain is faithful and adding floor would make this square diverge from the thing it was
 * grafted from.
 *
 * AND THE RENDERER SAYS IT LOOKS RIGHT. The course cam photographs both landings - shots
 * pollnivneach_2c_after and _8c_after - and in each the player is standing on the white roof of
 * the building next door, not hanging over the street. thinAir() asks whether anything is drawn
 * ON the tile; it cannot see a neighbouring loc whose MODEL overhangs it, which is what carries
 * the player here. That is a false positive of the predicate, not a fault in the map.
 *
 * MOVING THEM WAS TRIED AND IS WORSE, which is still true and still the second reason to leave
 * them: one tile away, 3355,2977 and 3362,3001, are canopy tiles, and from 3355,2977 the engine
 * will not let the player click the banner at all - "banner: ended at 3355,2977, expected
 * 3362,2977".
 */
const AIRBORNE_ON_PURPOSE = new Set(['pollnivneach_land_stall', 'pollnivneach_land_tree2']);

const only = process.argv[2];
for (const course of COURSES) {
    if (only && only !== course.key) continue;
    // Draynor and Al Kharid are in the table for courseland.ts's sake and have sims of their own,
    // which know things this one does not - Draynor's tightropes are WALKED rather than glided.
    if (!only && course.ownSim) continue;
    console.log(`\n================ ${course.title}  (agility ${course.level}, ${course.lapXp / 10} a lap)`);

    console.log('  every obstacle is in the world');
    for (const o of course.obstacles) {
        const found = A.locsNamed(o.loc, o.x - 1, o.z - 1, o.x + 1, o.z + 1, [o.level]);
        check(`    ${o.name.padEnd(14)} ${o.loc} at ${o.x},${o.z} level ${o.level}`, found.length > 0, true);
    }

    console.log('  every landing is a tile the constants name');
    for (const o of course.obstacles) {
        check(`    ${o.name.padEnd(14)} is written down`, C[o.land] ? 'yes' : o.land + ' MISSING', 'yes');
    }

    // AND NONE OF THEM IS IN THIN AIR. This is the one check here that is not about collision, and
    // it is the one that was missing: a landing with no overlay, no underlay and no loc on it is a
    // tile the client draws nothing for, and the player stands in the sky. Fifteen of the
    // fifty-eight were, on seven courses, and everything below passed on every one of them.
    //
    // It is deliberately narrower than "blocked". Draynor's whole rooftop deck is "o175 f1" -
    // drawn and flagged - because a grafted roof is not meant to be walked on, and half of these
    // obstacles are climbed ON TO, which lands you on a loc with no floor under it. Both are the
    // design. Nothing at all is the fault. See mapfloor.ts.
    console.log('  and no landing is in thin air');
    for (const o of course.obstacles) {
        const c = C[o.land];
        if (!c) continue;
        if (AIRBORNE_ON_PURPOSE.has(o.land)) {
            console.log(`    ${o.name.padEnd(14)} ${c[0]},${c[1]} L${c[2]}   in the air, and the alternative is worse - see below`);
            continue;
        }
        check(`    ${o.name.padEnd(14)} ${c[0]},${c[1]} L${c[2]}`, !thinAir(c[0], c[1], c[2]), true);
    }

    // WHICH LANDINGS SIT ON A FLAGGED TILE - printed, not asserted. A teleport can put you on a
    // flagged tile and you walk off it, and most of these are fine in play; the flags are the map's
    // own, matching Old School tile for tile. What matters is the checks around it. Asserting this
    // one would mean arguing it away on seven courses every run.
    {
        const on = course.obstacles.filter(o => C[o.land] && isFlagged(C[o.land][0], C[o.land][1], C[o.land][2], CollisionFlag.WALK_BLOCKED));
        console.log(on.length ? `    note: ${on.map(o => `${o.name} (${C[o.land][0]},${C[o.land][1]})`).join(', ')} land on flagged tiles` : '    note: no landing sits on a flagged tile');
    }

    // AND THE LAP CAN CARRY ON FROM IT. Two ways it can, and a landing only has to manage one:
    //
    //   you can WALK off it - some neighbour you can step onto; or
    //   you can USE THE NEXT OBSTACLE from where you stand, without walking at all.
    //
    // The second is not a loophole, it is the design. Pollnivneach's basket drops you on a one-tile
    // island and the market stall is the tile beside you; Ardougne's steep roof does the same into
    // gap 4. Testing only the first condemns both, and moving those landings "somewhere you can
    // walk" breaks a lap that worked - which is exactly what happened on the first pass at this.
    //
    // Al Kharid's tropical tree failed BOTH: an island with its next obstacle six tiles away. That
    // is the fault worth catching, and nothing caught it, because the check above passed c[2],
    // c[0], c[1] to isFlagged(x, z, level) and read collision off a tile somewhere else entirely.
    console.log('  and the lap can carry on from every landing');
    for (let i = 0; i < course.obstacles.length; i++) {
        const o = course.obstacles[i];
        const n = course.obstacles[(i + 1) % course.obstacles.length];
        const c = C[o.land];
        if (!c) continue;
        const canWalkOff = (
            [
                [1, 0],
                [-1, 0],
                [0, 1],
                [0, -1]
            ] as const
        ).some(([dx, dz]) => A.walkable(c[2], c[0] + dx, c[1] + dz));
        const canUseNext = c[2] === n.level && !!A.reachLoc(c[2], c[0], c[1], n.loc, n.x, n.z);
        check(`    ${o.name.padEnd(14)} ${canWalkOff ? 'walk off' : canUseNext ? `use ${n.name}` : 'STUCK'}`, canWalkOff || canUseNext, true);
    }

    // A WALKED CROSSING STAYS ON THE OBSTACLE, tested as geometry rather than as collision.
    //
    // The fault this exists for is Draynor's: ~agility_walk spends its diagonal FIRST, so a crossing
    // whose start and finish are not on one row or one column leaves the rope on the first step and
    // walks the row beside it. That is a question about the three coordinates, not about collision.
    //
    // It used to ask whether the walked tiles were blocked, and that is the wrong question: the span
    // of a rope or a washing line is open air, so of course it is blocked, and the player is force
    // walked across it regardless. Varrock's clothes line failed on exactly that - 3209 to 3212 over
    // the street - while being perfectly correct: start, finish and the line itself all on z3414.
    const walked = course.obstacles.filter(o => o.walk);
    if (walked.length) {
        console.log('  and a walked crossing stays on the obstacle');
        for (const o of walked) {
            const a = C[o.walk!],
                b = C[o.land];
            if (!a || !b) {
                check(`    ${o.name.padEnd(14)} has both ends`, 'missing', 'ok');
                continue;
            }
            const straight = a[0] === b[0] || a[1] === b[1];
            const onLine = a[0] === b[0] ? o.x === a[0] : o.z === a[1];
            check(
                `    ${o.name.padEnd(14)} ${a[0]},${a[1]} -> ${b[0]},${b[1]}, loc at ${o.x},${o.z}`,
                straight && onLine ? 'straight, and along the obstacle' : !straight ? 'start and finish are not on one row or column' : 'straight, but the obstacle is on a different line',
                'straight, and along the obstacle'
            );
        }
    }

    console.log("  the experience is the wiki's");
    const sum = course.obstacles.reduce((a, o) => a + (K[o.xp] ?? 0), 0);
    check(`    the obstacles add to ${course.lapXp / 10} (${course.lapXp} tenths)`, sum, course.lapXp);
    check("    and the level gate is the wiki's", K[`${course.key}_level`], course.level);

    console.log('  a full lap');
    alwaysPass(true);
    const p: any = player(`run_${course.key}`, course.start[0], course.start[1], course.start[2]);
    H.setVar(p, 'tutorial', 1000);
    p.baseLevels[16] = course.level;
    p.levels[16] = course.level;
    const before = p.stats[16];
    const prog = () => p.getVar(VarPlayerType.getByName(`${course.key}_course_progress`)!.id);
    let ok = true;
    let prev: [number, number, number] = course.start;
    for (const o of course.obstacles) {
        p.teleport(prev[0], prev[1], prev[2]);
        H.tick(1);
        try {
            A.op(p, o.x, o.z, o.loc, 1);
        } catch {
            console.log(`    ${o.name}: the loc is not on the level the player arrived at`);
            ok = false;
            break;
        }
        H.tick(40); // enough for a long walk across a roof, then the obstacle itself
        const at: [number, number, number] = [p.x, p.z, p.level];
        const want = C[o.land];
        if (!want || at.join(',') !== want.join(',')) {
            console.log(`    ${o.name}: ended at ${at.join(',')}, expected ${want ? want.join(',') : '?'}`);
            ok = false;
            break;
        }
        prev = at;
    }
    check('    every obstacle put the player where the constant says', ok, true);
    if (ok) {
        check(`    the lap paid ${course.lapXp / 10}`, p.stats[16] - before, course.lapXp);
        check('    and the counter reset', prog(), 0);
    }
    H.despawn(p);
    alwaysPass(false);

    console.log('  and it is shut to anyone under the level');
    const q: any = player(`low_${course.key}`, course.start[0], course.start[1], course.start[2]);
    H.setVar(q, 'tutorial', 1000);
    q.baseLevels[16] = course.level - 1;
    q.levels[16] = course.level - 1;
    const from = H.ifaces.length;
    const first = course.obstacles[0];
    A.op(q, first.x, first.z, first.loc, 1);
    H.tick(4);
    const said = H.ifaces
        .slice(from)
        .filter(i => i.who === q.username && i.kind === 'text' && i.text)
        .map(i => i.text!);
    check(`    ${course.level - 1} agility is turned away`, A.saw(said, `Agility level of ${course.level}`), true);
    H.despawn(q);
}

console.log(`\n${R.ok} ok, ${R.bad} FAIL`);
process.exit(R.bad ? 1 : 0);
