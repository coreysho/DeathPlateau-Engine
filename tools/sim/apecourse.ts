// THE APE ATOLL AGILITY COURSE, A LAP AT A TIME. Walks the six obstacles in order from the
// plateau at the east end, and after each one says where the player ended up, whether that tile is
// one they can walk off, what the obstacle said and how much Agility experience it paid.
//
// The course is a cliff and the only thing that settles which way round it runs is the tile
// heights, so this exists to prove the landings rather than argue about them: a landing on a
// blocked tile or on the wrong storey strands a player at height, which is the one failure mode
// worth being certain about before this ships.
//
//   npx tsx tools/sim/apecourse.ts
import * as H from './harness.js';
import World from '#/engine/World.js';
import LocType from '#/cache/config/LocType.js';
import { canTravel } from '#/engine/GameMap.js';
import { CollisionType } from '#/engine/routefinder/index.js';

await H.boot();

const AGILITY = 16;
const START: [number, number, number] = [2755, 2742, 0];

type Step = {
    what: string;
    loc: string;
    at: [number, number, number];
    from: [number, number, number];
    land: [number, number, number];
    xp: number;
};

// from = the tile the lap puts you on before this obstacle, land = where it should leave you
const STEPS: Step[] = [
    { what: 'stepping stone', loc: 'loc_12568', at: [2754, 2742, 0], from: [2755, 2742, 0], land: [2753, 2742, 0], xp: 40 },
    { what: 'tropical tree', loc: 'loc_12570', at: [2753, 2741, 0], from: [2753, 2742, 0], land: [2753, 2742, 2], xp: 40 },
    // one obstacle, not two: apereach.ts says loc_12575 at the west end can be reached from nowhere
    { what: 'monkeybars', loc: 'loc_12573', at: [2752, 2741, 2], from: [2752, 2741, 2], land: [2747, 2741, 0], xp: 40 },
    { what: 'skull slope', loc: 'loc_12576', at: [2746, 2741, 0], from: [2747, 2741, 0], land: [2743, 2741, 0], xp: 60 },
    // 400, not 100: the rope is the fifth obstacle, so it also pays the 300 lap bonus
    { what: 'rope', loc: 'loc_12578', at: [2752, 2731, 0], from: [2751, 2731, 0], land: [2756, 2731, 0], xp: 400 }
];

const p: any = H.makePlayer('apecourse', START[0], START[1]);
H.tick(2);
H.maxOut(p);
H.runProc(p, '[proc,player_combat_stat]');

const walkable = (x: number, z: number, level: number): boolean => {
    // "can anything step ONTO this tile", which is the question - canTravel from the tile itself
    // answers "can I step off it" and says yes for solid ground.
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        if (canTravel(level, x + dx, z + dz, -dx, -dz, 1, 0, CollisionType.NORMAL)) return true;
    }
    return false;
};

let bad = 0;
console.log('APE ATOLL AGILITY COURSE');
for (const [n, s] of STEPS.entries()) {
    const id = LocType.getId(s.loc);
    const loc = World.getLoc(s.at[0], s.at[1], s.at[2], id);
    if (!loc) {
        console.log(`${n + 1}. ${s.what}: ${s.loc} IS NOT AT ${s.at[0]},${s.at[1]} L${s.at[2]}`);
        bad++;
        continue;
    }
    p.clearPendingAction();
    p.queueWaypoints([]);
    p.teleport(s.from[0], s.from[1], s.from[2]);
    H.tick(2);
    const stood = `${p.x},${p.z} L${p.level}`;
    const xp0 = p.stats[AGILITY];
    const mark = H.mesgs.length;
    let sent = false;
    try {
        sent = H.opLoc(p, s.at[0], s.at[1], s.loc, 1);
    } catch (e) {
        console.log(`${n + 1}. ${s.what}: op threw ${(e as Error).message}`);
        bad++;
        continue;
    }
    for (let i = 0; i < 25 && (p.delayed || p.x !== s.land[0] || p.z !== s.land[1] || p.level !== s.land[2]); i++) H.tick(1);
    const said = H.mesgs.slice(mark).map((m: any) => m.text).join(' | ');
    const gained = (p.stats[AGILITY] - xp0) / 10;
    const landed = p.x === s.land[0] && p.z === s.land[1] && p.level === s.land[2];
    const standable = walkable(p.x, p.z, p.level);
    const ok = sent && landed && standable && gained === s.xp;
    if (!ok) bad++;
    console.log(
        `${n + 1}. ${s.what} (${s.loc})  ${ok ? 'ok  ' : 'FAIL'}\n` +
        `     clicked from ${stood}${sent ? '' : '  -- THE OP DID NOT RUN'}\n` +
        `     landed  ${p.x},${p.z} L${p.level}  (want ${s.land[0]},${s.land[1]} L${s.land[2]})  ` +
        `${standable ? 'walkable' : 'NOT WALKABLE - A PLAYER WOULD BE STRANDED HERE'}\n` +
        `     xp ${gained} (want ${s.xp})   progress ${H.getVar(p, 'apeatoll_course_progress')}\n` +
        `     said: ${said || '(nothing)'}`
    );
}

// and the lap bonus: progress reaches 6 on the rope, which pays 300 and resets to 0
console.log(`\nprogress after the lap: ${H.getVar(p, 'apeatoll_course_progress')} (want 0 - the lap bonus resets it)`);
console.log(bad === 0 ? `\n${STEPS.length} of ${STEPS.length} obstacles passed` : `\n${bad} of ${STEPS.length} obstacles FAILED`);
process.exit(bad === 0 ? 0 : 1);
