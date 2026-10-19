// THE SHIP'S LADDERS on both Ghosts Ahoy vessels, every placement, both directions, from every side
// a player can stand on.
//
// What this is guarding. ahoy_ghostship_ladder at 3615,3545 L1 used to answer "I can't reach that!"
// from everywhere - forceapproach=south rotates with the angle and the one permitted tile is solid
// hull - and its mate on the quarterdeck mirrored you down onto that same solid tile, so you arrived
// standing inside the ship. The landing is a table now (quest_ahoy/configs/ahoy_ladders.enum) and
// the forceapproach is gone.
//
// A side can still refuse when there is a hull wall between that tile and the ladder, which is
// ordinary geometry - in play the route finder walks you round to a side that works. What must never
// happen again is a ladder with NO working side, or a landing tile inside scenery.
//
//   npx tsx tools/sim/ahoyladders.ts
import * as H from './harness.js';
import { walkable } from './a1lib.js';
await H.boot();
const p: any = H.makePlayer('lad', 3609, 3542);
H.tick(2);
let bad = 0, ok = 0;
const worked = new Set<string>();
const scenery: string[] = [];
const tests: [string, number, number, number][] = [
    ['ahoy_ghostship_ladder', 3609, 3543, 0], ['ahoy_ghostship_ladder', 3613, 3543, 0],
    ['ahoy_ghostship_ladder', 3615, 3541, 1], ['ahoy_ghostship_ladder', 3615, 3545, 1],
    ['ahoy_ghostship_ladder', 3696, 3511, 0], ['ahoy_ghostship_ladder', 3696, 3516, 0],
    ['ahoy_ghostship_laddertop', 3609, 3543, 1], ['ahoy_ghostship_laddertop', 3613, 3543, 1],
    ['ahoy_ghostship_laddertop', 3615, 3541, 2], ['ahoy_ghostship_laddertop', 3615, 3545, 2],
    ['ahoy_ghostship_laddertop', 3696, 3511, 1], ['ahoy_ghostship_laddertop', 3696, 3516, 1]
];
for (const [name, lx, lz, lvl] of tests) {
    const sides: [number, number, string][] = [[0, -1, 'S'], [0, 1, 'N'], [-1, 0, 'W'], [1, 0, 'E']];
    const results: string[] = [];
    for (const [dx, dz, side] of sides) {
        if (!walkable(lvl, lx + dx, lz + dz)) continue;
        p.teleport(lx + dx, lz + dz, lvl);
        H.tick(1);
        H.clearLogs();
        H.opLoc(p, lx, lz, name, 1);
        for (let i = 0; i < 14; i++) H.tick(1);
        const said = H.mesgs.map((m: any) => m.text).join('/');
        const moved = p.level !== lvl;
        const stuck = moved && !walkable(p.level, p.x, p.z);
        if (moved && !stuck) {
            ok++;
            worked.add(name.replace('ahoy_ghostship_', '') + ' ' + lx + ',' + lz + ' L' + lvl);
            results.push(side + ':L' + p.level + ' ' + p.x + ',' + p.z);
        }
        else {
            bad++;
            if (stuck) scenery.push(name + ' ' + lx + ',' + lz + ' from the ' + side + ' lands on ' + p.x + ',' + p.z + ', which is scenery');
            results.push(side + ':no ' + (stuck ? 'LANDED IN SCENERY at ' + p.x + ',' + p.z : said || 'did not move')); }
    }
    console.log('  ' + name.replace('ahoy_ghostship_', '') + ' ' + lx + ',' + lz + ' L' + lvl + '  ' + results.join('   '));
}
console.log('\n' + ok + ' climbs worked, ' + bad + ' sides refused');
console.log('');
let fatal = 0;
for (const [name, lx, lz, lvl] of tests) {
    const key = name.replace('ahoy_ghostship_', '') + ' ' + lx + ',' + lz + ' L' + lvl;
    if (!worked.has(key)) {
        console.log('  FAIL ' + key + ' cannot be climbed from any side');
        fatal++;
    }
}
for (const s of scenery) {
    console.log('  FAIL ' + s);
    fatal++;
}
if (!fatal) console.log('  ok   every ladder is climbable, and no landing is inside scenery');
process.exit(fatal ? 1 : 0);
