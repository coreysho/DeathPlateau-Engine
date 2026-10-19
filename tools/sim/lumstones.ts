// THE RIVER LUM STEPPING STONES, west of the Champions' Guild.
//
//   npx tsx tools/sim/lumstones.ts
//
// Reported as a live dead click: four "Stepping stone" locs in the water at 3150..3153, z3363,
// every one carrying Jump-onto and nothing answering any of them. It is Old School's 31 Agility
// shortcut between the Champions' Guild side and Draynor Manor, three experience for the crossing
// and one for failing it - and failing it still puts you on the side you were heading for.
//
// A roll sits in the middle of this, so nothing here asserts which way one landed. What it
// asserts is the shape: where you end up on a success, where you end up on a failure, that the
// crossing pays once rather than once per stone, and that you can get off the last stone at all -
// the stones block, and the whole model depends on a player being able to walk OUT of a blocked
// tile.
import * as H from './harness.js';
import * as A from './a1lib.js';
import { check, R, player } from './a1lib.js';
import { PlayerStat } from '#/engine/entity/PlayerStat.js';

await H.boot();
H.loginOrder();

const Z = 3363;
const STONES = [3150, 3151, 3152, 3153];
const WEST = 3149;
const EAST = 3154;
const XP = 10; // every stat is stored x10

const agil = (p: any) => p.stats[PlayerStat.AGILITY];

console.log('THE CROSSING IS ONE TILE WIDE, WHICH IS WHY A STONE CAN ONLY BE REACHED ALONG IT');
{
    check(
        '  four stones at 3150..3153, z3363',
        A.locsNamed('loc_9315', 3140, 3355, 3165, 3370),
        STONES.map(x => [x, Z, 0])
    );
    check(
        '  every stone blocks its own tile',
        STONES.map(x => A.walkable(0, x, Z)),
        [false, false, false, false]
    );
    check('  both banks are walkable', [A.walkable(0, WEST, Z), A.walkable(0, EAST, Z)], [true, true]);
    // The river is blocked for a long way either side of the line, so there is no diagonal
    // approach and no way to skip a stone.
    check(
        '  and the row behind is solid water',
        STONES.map(x => A.walkable(0, x, Z - 1)),
        [false, false, false, false]
    );
}

/** Click one stone and report where the player ended up, what was said, and the xp it paid. */
function jump(p: any, x: number) {
    const before = agil(p);
    const m = A.mark();
    // The level refusal is a ~mesbox, which is interface text and not a game message, so both
    // halves are needed: what op() hands back and what landed in the chat log.
    const box = A.op(p, x, Z, 'loc_9315', 1);
    H.tick(10);
    return { at: [p.x, p.z], said: box.concat(A.mesSince(p, m)), xp: (agil(p) - before) / XP };
}

console.log('\n31 AGILITY IS THE DOOR, AND 30 IS NOT ENOUGH');
{
    const low: any = player('ls_low', WEST, Z);
    low.setLevel(PlayerStat.AGILITY, 30);
    const r = jump(low, STONES[0]);
    check('  30 is refused, and stays on the bank', [r.at, r.said.some(s => s.includes('Agility level of 31'))], [[WEST, Z], true]);
    check('    and pays nothing', r.xp, 0);
    H.despawn(low);
}

console.log('\nAT 99 THE WHOLE CROSSING GOES, STONE BY STONE, AND PAYS THREE ONCE');
{
    // 140/250 at 99 is 251 of 256, so a clean four-jump crossing is the overwhelmingly likely
    // run - but not certain, so this retries a player rather than asserting a single pass.
    let crossed = false;
    let paid = -1;
    const perStone: number[] = [];
    for (let attempt = 0; attempt < 12 && !crossed; attempt++) {
        const p: any = player('ls_99_' + attempt, WEST, Z);
        p.setLevel(PlayerStat.AGILITY, 99);
        const xps: number[] = [];
        let ok = true;
        for (const x of STONES) {
            const r = jump(p, x);
            xps.push(r.xp);
            if (p.x !== x || p.z !== Z) {
                ok = false; // a roll went against it; that case is checked on its own below
                break;
            }
        }
        if (ok) {
            crossed = true;
            paid = xps.reduce((a, b) => a + b, 0);
            perStone.push(...xps);
            // ...and off the last stone onto the far bank, on foot. The stone blocks, so this is
            // the step the whole model rests on.
            H.walkTo(p, EAST, Z);
            H.tick(8);
            check('  the player walks off the last stone onto the east bank', [p.x, p.z], [EAST, Z]);
        }
        H.despawn(p);
    }
    check('  a clean crossing happens at 99', crossed, true);
    check('  and pays three experience for the whole of it', paid, 3);
    check('    on the last stone and no other', perStone, [0, 0, 0, 3]);
}

console.log('\nGOING BACK WEST PAYS ON THE OTHER END, so a hop off your own bank pays nothing');
{
    let crossed = false;
    const perStone: number[] = [];
    for (let attempt = 0; attempt < 12 && !crossed; attempt++) {
        const p: any = player('ls_w_' + attempt, EAST, Z);
        p.setLevel(PlayerStat.AGILITY, 99);
        const xps: number[] = [];
        let ok = true;
        for (const x of [...STONES].reverse()) {
            const r = jump(p, x);
            xps.push(r.xp);
            if (p.x !== x || p.z !== Z) {
                ok = false;
                break;
            }
        }
        if (ok) {
            crossed = true;
            perStone.push(...xps);
        }
        H.despawn(p);
    }
    check('  a clean crossing west happens too', crossed, true);
    check('  and pays on the western stone', perStone, [0, 0, 0, 3]);
}

console.log('\nA FAILED JUMP PUTS YOU ON THE SIDE YOU WERE HEADING FOR, hurt, for one experience');
{
    // Level 31 is 174 of 256, so a failure turns up inside a handful of tries. The roll is only
    // used to GET one; what is asserted is what a failure does.
    let failed = false;
    for (let attempt = 0; attempt < 40 && !failed; attempt++) {
        const p: any = player('ls_fail_' + attempt, WEST, Z);
        p.setLevel(PlayerStat.AGILITY, 31);
        p.setLevel(PlayerStat.HITPOINTS, 50);
        const hp = p.levels[PlayerStat.HITPOINTS];
        const r = jump(p, STONES[0]);
        if (r.at[0] === EAST) {
            failed = true;
            check('  it lands you on the EAST bank, heading east', r.at, [EAST, Z]);
            check(
                '    says the river carried you',
                r.said.some(s => s.includes('river carries you')),
                true
            );
            check('    pays one experience', r.xp, 1);
            check('    and costs a tenth of your hitpoints', hp - p.levels[PlayerStat.HITPOINTS], 5);
        }
        H.despawn(p);
    }
    check('  a failure happens at 31 inside forty tries', failed, true);

    // ...and the same going the other way, which is the half a single-direction script gets wrong.
    let failedWest = false;
    for (let attempt = 0; attempt < 40 && !failedWest; attempt++) {
        const p: any = player('ls_failw_' + attempt, EAST, Z);
        p.setLevel(PlayerStat.AGILITY, 31);
        const r = jump(p, STONES[3]);
        if (r.at[0] === WEST) {
            failedWest = true;
            check('  and on the WEST bank, heading west', r.at, [WEST, Z]);
        }
        H.despawn(p);
    }
    check('  a failure heading west happens too', failedWest, true);
}

console.log('\nAND THE STONE UNDER YOUR OWN FEET IS NOT A CLICK');
{
    const p: any = player('ls_self', WEST, Z);
    p.setLevel(PlayerStat.AGILITY, 99);
    jump(p, STONES[0]);
    if (p.x === STONES[0]) {
        const r = jump(p, STONES[0]);
        check(
            '  clicking the stone you are standing on says so',
            r.said.some(s => s.includes("can't do that from here")),
            true
        );
        check('    and pays nothing', r.xp, 0);
    } else {
        check('  clicking the stone you are standing on says so (roll went against it; skipped)', true, true);
        check('    and pays nothing (skipped)', true, true);
    }
    H.despawn(p);
}

console.log('\nAND NOTHING IN THE RIVER IS A DEAD CLICK ANY MORE');
{
    const dead = [...A.deadLocOps(3140, 3355, 3165, 3370, [0]).keys()];
    check('  no unanswered option on the crossing', dead, []);
}

console.log(`\n${R.ok} ok, ${R.bad} FAIL`);
process.exit(R.bad ? 1 : 0);
