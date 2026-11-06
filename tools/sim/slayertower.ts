// THE SLAYER TOWER, FROM THE FRONT DOOR TO THE TOP FLOOR.
// Usage: NODE_MEMBERS=true npx tsx tools/sim/slayertower.ts   (exit code is the verdict)
//
// Reported from play as "cant get into slayer tower", and that is literally what it was. The tower
// had nothing behind it at all: three doors and two chains, every one of them placed on the map
// with its right-click option already authored in the cache, and not one answered by a script.
//
//   slayertower_door / _mirror   Open        3428,3535 L0   the front door
//   loc_10527 / loc_10529        Open        3426,3555 L1   splits the 1st floor in two
//   loc_5126                     Open        3445,3554 L2
//   loc_9319 "Spikey chain"      Climb-up    3422,3550 L0  and  3447,3576 L1
//   loc_9320 "Spikey chain"      Climb-down  3422,3550 L1  and  3447,3576 L2
//
// Every closed door leaf already had its open twin in the cache, mirror flag included, so the doors
// only ever needed a category and a next stage; the generic door system does the rest. The chains
// are Agility shortcuts - 61 for the lower, 71 for the upper - and the wiki says of the pair that
// "Both instances of the shortcut are the same object, despite their different Agility level
// requirements", which is why the requirement is read off the coordinate rather than the loc.
import * as H from './harness.js';
import * as A from './a1lib.js';
import { check, R, player } from './a1lib.js';

await H.boot();
H.loginOrder();

const AGILITY = 16;
const LOWER: [number, number] = [3422, 3550];
const UPPER: [number, number] = [3447, 3576];

const climber = (name: string, x: number, z: number, level: number, agility: number) => {
    const p: any = player(name, 3428, 3533, 0);
    H.maxOut(p);
    H.clearInv(p);
    p.setLevel(AGILITY, agility);
    p.teleport(x, z, level);
    H.tick(1);
    H.clearLogs();
    return p;
};

console.log('== nothing around the tower is a dead click any more');
{
    // The whole building, all four levels. This is the check that would have caught it on day one.
    const dead = [...A.deadLocOps(3400, 3520, 3460, 3580, [0, 1, 2, 3]).keys()];
    check('no loc op in the tower goes unanswered', dead, []);
}

console.log('\n== the front door opens, and there is a way in');
{
    const p: any = player('stdoor', 3428, 3533, 0);
    H.maxOut(p);
    H.tick(1);
    // Shut, the doorway is the only gap in that wall and it is closed.
    check('the doorway is shut to begin with', A.connected(0, 3428, 3533, 3428, 3537, 80), false);
    H.clearLogs();
    check('Open is answered', H.opLoc(p, 3428, 3535, 'slayertower_door', 1), true);
    for (let t = 0; t < 12; t++) H.tick(1);
    check('  and the way in is open', A.connected(0, 3428, 3533, 3428, 3537, 80), true);
    // A double door: opening one leaf opens both, which is what the left/right categories are for.
    // An opened leaf is loc_added on the square it swings TO, not the one it stood on, so this asks
    // whether the closed leaves are gone and an open one is somewhere beside the doorway.
    check('  neither closed leaf is still there', [H.locAt(0, 3428, 3535, 'slayertower_door'), H.locAt(0, 3429, 3535, 'slayertower_door_mirror')], [false, false]);
    check('  and an open leaf has appeared', H.locsNear('slayertower_door_open', 3428, 3535, 0).length + H.locsNear('slayertower_door_open_mirror', 3428, 3535, 0).length > 0, true);
    H.despawn(p);
}

console.log('\n== the 1st floor door opens, which is what joins that floor up');
{
    const p: any = player('stfloor1', 3423, 3550, 1);
    H.maxOut(p);
    H.tick(1);
    // Shut, the chain at the west end and the chain to the 2nd floor are on opposite sides of it.
    check('the two halves start separated', A.connected(1, 3423, 3550, 3446, 3576, 900), false);
    p.teleport(3426, 3554, 1);
    H.tick(1);
    H.clearLogs();
    check('Open is answered', H.opLoc(p, 3426, 3555, 'loc_10527', 1), true);
    for (let t = 0; t < 12; t++) H.tick(1);
    check('  and the floor joins up', A.connected(1, 3423, 3550, 3446, 3576, 900), true);
    H.despawn(p);
}

console.log('\n== and the 2nd floor door');
{
    const p: any = player('stfloor2', 3445, 3553, 2);
    H.maxOut(p);
    H.tick(1);
    H.clearLogs();
    check('Open is answered', H.opLoc(p, 3445, 3554, 'loc_5126', 1), true);
    for (let t = 0; t < 12; t++) H.tick(1);
    check('  the closed leaf is gone', H.locAt(2, 3445, 3554, 'loc_5126'), false);
    check('    and the open one is beside it', H.locsNear('loc_5128', 3445, 3554, 2).length > 0, true);
    H.despawn(p);
}

console.log('\n== the lower chain: Agility 61, ground floor to the 1st and back');
{
    const up = climber('stlo61', 3423, LOWER[1], 0, 61);
    H.opLoc(up, LOWER[0], LOWER[1], 'loc_9319', 1);
    for (let t = 0; t < 12; t++) H.tick(1);
    check('a 61 climbs it', [up.x, up.z, up.level], [3423, 3550, 1]);
    // 3 xp clean, 6 on a slip, and either way you arrive: the wiki is explicit that a failure
    // "will still climb to the different level".
    check('  and it pays Agility either way', up.stats[AGILITY] > 0, true);
    H.despawn(up);

    const low = climber('stlo60', 3423, LOWER[1], 0, 60);
    H.opLoc(low, LOWER[0], LOWER[1], 'loc_9319', 1);
    for (let t = 0; t < 12; t++) H.tick(1);
    check('  a 60 does not', low.level, 0);
    H.despawn(low);

    const down = climber('stlodn', 3423, LOWER[1], 1, 61);
    H.opLoc(down, LOWER[0], LOWER[1], 'loc_9320', 1);
    for (let t = 0; t < 12; t++) H.tick(1);
    check('  and it goes back down', [down.x, down.z, down.level], [3423, 3550, 0]);
    H.despawn(down);
}

console.log('\n== the upper chain: Agility 71, 1st floor to the 2nd and back');
{
    const up = climber('stup71', 3448, UPPER[1], 1, 71);
    H.opLoc(up, UPPER[0], UPPER[1], 'loc_9319', 1);
    for (let t = 0; t < 12; t++) H.tick(1);
    check('a 71 climbs it', [up.x, up.z, up.level], [3448, 3576, 2]);
    H.despawn(up);

    // 70 is enough for the lower chain and not for this one, which is the whole point of reading
    // the requirement off the coordinate rather than the loc.
    const low = climber('stup70', 3448, UPPER[1], 1, 70);
    H.opLoc(low, UPPER[0], UPPER[1], 'loc_9319', 1);
    for (let t = 0; t < 12; t++) H.tick(1);
    check('  a 70 does not', low.level, 1);
    H.despawn(low);

    const down = climber('stupdn', 3448, UPPER[1], 2, 71);
    H.opLoc(down, UPPER[0], UPPER[1], 'loc_9320', 1);
    for (let t = 0; t < 12; t++) H.tick(1);
    check('  and it goes back down', [down.x, down.z, down.level], [3448, 3576, 1]);
    H.despawn(down);
}

console.log('\n== and a slip costs hitpoints rather than the climb');
{
    // 2-5 damage on a failure, and you arrive anyway. Climb it until a slip happens.
    let slipped = false;
    let arrived = false;
    let hurt = 0;
    for (let n = 0; n < 30 && !slipped; n++) {
        const p: any = climber('stslip' + n, 3423, LOWER[1], 0, 99);
        const hp = p.levels[3];
        H.opLoc(p, LOWER[0], LOWER[1], 'loc_9319', 1);
        for (let t = 0; t < 12; t++) H.tick(1);
        if (A.said(p, 0, 'slip on the spikes')) {
            slipped = true;
            arrived = p.level === 1;
            hurt = hp - p.levels[3];
        }
        H.despawn(p);
    }
    check('a slip happens', slipped, true);
    check('  and you still arrive', arrived, true);
    check('  having taken 2 to 5', hurt >= 2 && hurt <= 5, true);
}

console.log(`\n${R.ok} ok, ${R.bad} FAIL`);
process.exit(R.bad ? 1 : 0);
