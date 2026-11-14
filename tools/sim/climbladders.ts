// WHERE EVERY LADDER PUTS THE PLAYER - a report, and deliberately not a verdict.
//
//   npx tsx tools/sim/climbladders.ts              the ladders the generic handler answers
//   npx tsx tools/sim/climbladders.ts --candidates those, plus every ladder with a DEAD climb option
//
// `~climb_ladder` in ladders.rs2 does not validate: it `p_telejump`s to `movecoord(coord(), 0, +-1,
// 0)`, the player's own tile one level away. So a ladder on category=ladder_up or ladder_down that
// does not really link two floors at the same tile drops the player inside a wall, and
// lunar_isle.loc carries the scar - three imported ladders put on these categories once and taken
// off again, "teleported players into the wall between the two halves".
//
// THIS WAS MEANT TO BE THE TEST THAT LET THE REMAINING 25 BE WIRED. It is not, and the reason is
// worth more than the attempt. Three versions were tried and the two ladders that already work -
// loc474_16735 and loc474_16736, wired on purpose and documented in lunar_isle.loc as the
// same-tile pair - failed all three:
//
//   1. stand a bot on a ring of tiles around the loc and click. Eleven ladders answered "I can't
//      reach that!" from tiles that are open but unroutable, which reads exactly like a broken
//      ladder, and the blocked landings it did report were on tiles the router would never pick.
//   2. check the level above every tile a player can WALK FROM. 40 of 62 "blocked" on a ladder that
//      works - of course, since a player four tiles off walks to the ladder before climbing.
//   3. check the level above every tile the router ENDS on, which is the tile ~climb_ladder reads.
//      Still 7 of 13 "blocked" on the same working ladder.
//
// Version 3 is the right question and still the wrong rule, because a ladder up to a platform or an
// upper floor SHOULD have solid tiles above most of its surroundings. The player only ever ends on
// the tile the router picks from the side they actually came from, and nothing here knows which
// side that is. A rule that calls a working ladder broken is worse than no rule.
//
// THE CALIBRATION PROVES ITS OWN USELESSNESS, which is why it is printed. loc474_16735 is wired and
// works and manages 6 of 13; loc474_16732 is the one the owner took back off these categories and
// manages 4 of 7. 46% is a working ladder and 57% is a broken one, so the ratio discriminates
// nothing and nobody should read it as a score.
//
// ONE THING IT CAN SAY, and it is worth the whole tool. A ladder whose landing is solid from EVERY
// interaction tile cannot be a vertical link - there is no side to approach it from that works, so
// whatever it does it is not "the same tile, one level". Six candidates are in that state, one of
// them (roguesden_passage_down) 0 of 32. Two more declare Climb-down on level 0, where there is no
// level below at all. Those go to the top under CANNOT BE A VERTICAL LINK and the rest is
// reporting: whoever wires a ladder in the tail needs to know the area, not these numbers.
import * as H from './harness.js';
import { reachLoc, walkable } from './a1lib.js';
import { findPathToLoc } from '#/engine/GameMap.js';
import CategoryType from '#/cache/config/CategoryType.js';
import { isVisibleOp } from '#/cache/config/OpVisibility.js';
import LocType from '#/cache/config/LocType.js';
import ScriptProvider from '#/engine/script/ScriptProvider.js';
import ServerTriggerType from '#/engine/script/ServerTriggerType.js';
import World from '#/engine/World.js';

const CANDIDATES = process.argv.slice(2).includes('--candidates');

await H.boot();

/** A report, so this NOTES rather than fails. See the header for why there is no verdict here. */
const note = (what: string, detail = '') => {
    console.log(`  ${what}${detail ? ' - ' + detail : ''}`);
};

const UP = CategoryType.getId('ladder_up');
const DOWN = CategoryType.getId('ladder_down');

/** Which way a label goes, or null when it is not a vertical move. */
function direction(label: string): 1 | -1 | null {
    const l = label.toLowerCase();
    if (/^climb[- ]?up$/.test(l)) return 1;
    if (/^climb[- ]?down$/.test(l)) return -1;
    return null;
}

type Spot = { type: number; x: number; z: number; level: number; dir: 1 | -1; op: number; wired: boolean };
const spots: Spot[] = [];
for (const zone of World.gameMap.existingZones()) {
    for (const loc of zone.getAllLocsUnsafe()) {
        const type = LocType.get(loc.type);
        if (!type?.op) continue;
        const wired = type.category === UP || type.category === DOWN;
        if (!wired && !CANDIDATES) continue;
        for (let op = 0; op < type.op.length; op++) {
            const label = type.op[op];
            if (!label || !isVisibleOp(label)) continue;
            const dir = direction(label);
            if (dir === null) continue;
            if (wired && type.category === UP && dir !== 1) continue;
            if (wired && type.category === DOWN && dir !== -1) continue;
            // --candidates MEANS THE DEAD ONES, not every ladder in the game. The first version
            // took every loc with a climb label and printed 414 of them, most with a trigger of
            // their own and nothing wrong. The population worth looking at before editing a .loc is
            // deadladders.ts's: a climb option no script answers.
            if (!wired) {
                const answered =
                    !!ScriptProvider.getByTriggerSpecific(ServerTriggerType.OPLOC1 + op, loc.type, -1) ||
                    !!ScriptProvider.getByTriggerSpecific(ServerTriggerType.APLOC1 + op, loc.type, -1) ||
                    (type.category !== -1 && (!!ScriptProvider.getByTriggerSpecific(ServerTriggerType.OPLOC1 + op, -1, type.category) || !!ScriptProvider.getByTriggerSpecific(ServerTriggerType.APLOC1 + op, -1, type.category)));
                if (answered) continue;
            }
            spots.push({ type: loc.type, x: loc.x, z: loc.z, level: loc.level, dir, op: op + 1, wired });
        }
    }
}

const byType = new Map<number, Spot[]>();
for (const s of spots) {
    byType.set(s.type, [...(byType.get(s.type) ?? []), s]);
}
console.log(`${byType.size} loc types, ${spots.length} placed instances${CANDIDATES ? ' (wired and candidate)' : ' on category=ladder_up / ladder_down'}`);
console.log('');

/**
 * THE DISTINCT TILES THE ROUTER ENDS ON, which is not the same thing as the tiles a player can walk
 * from - and getting that wrong called both of the two ladders that already work broken.
 *
 * The first version collected every tile within two squares that reachLoc accepts and checked the
 * level above THAT tile. loc474_16735 came back "40 of 62 approaches blocked", and it is a ladder
 * the owner wired on purpose and documented as same-tile. Of course it did: a player standing four
 * tiles off walks to the ladder before climbing, so the tile that matters is where the route ENDS,
 * and almost all of those 62 starting tiles end on the same two or three. ~climb_ladder reads
 * `coord()` after p_arrivedelay, so the interaction tile is the only tile in this question.
 *
 * findPathToLoc with an empty result means "already standing somewhere valid", the same fallback
 * reachLoc documents, so the start tile stands in for itself there.
 */
function landingTiles(s: Spot, name: string): { x: number; z: number }[] {
    const type = LocType.get(s.type);
    const loc = World.getLoc(s.x, s.z, s.level, s.type);
    if (!loc) return [];
    const w = type.width ?? 1;
    const l = type.length ?? 1;
    const seen = new Map<string, { x: number; z: number }>();
    for (let tx = s.x - 3; tx <= s.x + w + 2; tx++) {
        for (let tz = s.z - 3; tz <= s.z + l + 2; tz++) {
            if (!walkable(s.level, tx, tz)) continue;
            if (!reachLoc(s.level, tx, tz, name, s.x, s.z)) continue;
            const path = findPathToLoc(s.level, tx, tz, loc.x, loc.z, 1, loc.width, loc.length, loc.angle, loc.shape, type.forceapproach);
            const last = path.length ? path[path.length - 1] : (tx << 14) | tz;
            const px = (last >> 14) & 0x3fff;
            const pz = last & 0x3fff;
            seen.set(`${px},${pz}`, { x: px, z: pz });
        }
    }
    return [...seen.values()];
}

const p = H.makePlayer('climber', 3222, 3218) as unknown as {
    x: number;
    z: number;
    level: number;
    teleport(x: number, z: number, level: number): void;
};
H.tick(2);
H.maxOut(p as never);

let climbed = 0;
type Row = { name: string; instances: number; impossible: boolean; verdict: string; list: Spot[] };
const rows: Row[] = [];
for (const [type, list] of [...byType.entries()].sort((a, b) => b[1].length - a[1].length)) {
    const name = LocType.get(type).debugname ?? String(type);
    const tag = list[0].wired ? '' : ' (candidate)';
    let worstDetail = '';
    let blocked = 0;
    let reachable = 0;
    let offLevels = false;
    for (const s of list) {
        const to = s.level + s.dir;
        if (to < 0 || to > 3) {
            // A FLAT IMPOSSIBILITY, not a judgement call: two of these declare Climb-down on level
            // 0, and there is no level below 0 for ~climb_ladder to telejump to.
            offLevels = true;
            worstDetail = `${s.dir > 0 ? 'up' : 'down'} from level ${s.level} is ${to}`;
            continue;
        }
        const from = landingTiles(s, name);
        reachable += from.length;
        for (const a of from) {
            if (!walkable(to, a.x, a.z)) {
                blocked++;
                if (!worstDetail) worstDetail = `standing at ${a.x},${a.z},${s.level} lands on ${a.x},${a.z},${to}, which is blocked`;
            }
        }
    }
    const open = reachable - blocked;
    // An if-chain rather than a nested ternary: prettier indents the continuation two spaces and
    // eslint's `indent` rule wants four, so the ternary cannot satisfy both and the commit hook
    // runs both.
    let verdict: string;
    if (offLevels) {
        verdict = 'points off the levels entirely';
    } else if (reachable === 0) {
        verdict = 'nothing can route to it';
    } else if (open === 0) {
        verdict = `NO interaction tile lands on open ground (0 of ${reachable})`;
    } else {
        verdict = `${open}/${reachable} interaction tiles land on open ground${blocked ? '; ' + worstDetail : ''}`;
    }
    rows.push({ name: `${name}${tag}`, instances: list.length, impossible: offLevels || open === 0, verdict, list });

    // AND ONE REAL CLIMB, from a tile the router chose, so the numbers above cannot drift away from
    // what ladders.rs2 actually does.
    for (const s of list) {
        const from = landingTiles(s, name);
        if (!from.length) continue;
        const a = from[0];
        if (!walkable(s.level + s.dir, a.x, a.z)) continue;
        p.teleport(a.x, a.z, s.level);
        H.tick(2);
        const mark = H.mesgs.length;
        H.opLoc(p as never, s.x, s.z, name, s.op);
        for (let t = 0; t < 16 && p.level === s.level; t++) H.tick(1);
        const said = H.mesgs.slice(mark).map(m => m.text);
        const row = rows[rows.length - 1];
        if (p.level - s.level === s.dir) {
            row.verdict += `\n       climbed from ${a.x},${a.z},${s.level}: lands at ${p.x},${p.z},${p.level}, ${walkable(p.level, p.x, p.z) ? 'open ground' : 'A WALL'}`;
        } else {
            row.verdict += `\n       clicked from ${a.x},${a.z},${s.level}: no level change${said.length ? ', ' + JSON.stringify(said.slice(0, 2)) : ''}`;
        }
        climbed++;
        break;
    }
}

const impossible = rows.filter(r => r.impossible);
const rest = rows.filter(r => !r.impossible);
console.log(`-- CANNOT BE A VERTICAL LINK (${impossible.length}) - no side to approach them from works, so`);
console.log('   category=ladder_up / ladder_down is ruled OUT for these whatever else is true');
for (const r of impossible) {
    note(`${r.name} x${r.instances}`, r.verdict);
}
console.log('');
console.log(`-- everything else (${rest.length}), reported and NOT scored - see the header on the calibration`);
for (const r of rest) {
    note(`${r.name} x${r.instances}`, r.verdict);
}

console.log('');
console.log(`${climbed} of ${byType.size} climbed for real; the rest had no routable approach with an open landing.`);
console.log('No verdict on purpose - see the header. The two loc474_1673x ladders are the calibration.');
