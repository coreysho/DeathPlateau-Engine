// The Wilderness chaos altar's bone offering, on the real engine.
//
//   * 3.5x the bone's own experience per offering, the gilded-altar-with-two-burners rate
//   * a 50% chance the bone survives, re-rolled next time round - so a full inventory lasts about
//     twice as long as it has bones, and the average lands near 7x burying
//   * only the altar in the hut at level 38. The other four [chaosaltar] locs in this build, the
//     level 12 church included, are plain Pray-at altars and must stay that way
//
//   npx tsx tools/sim/chaosaltar.ts
import * as H from './harness.ts';
import * as A from './a1lib.ts';
import { check, R, player } from './a1lib.ts';
import ObjType from '#/cache/config/ObjType.js';

await H.boot();

const ALTAR = { x: 2947, z: 3820 };          // level 38 Wilderness, the training altar
const CHURCH = { x: 3239, z: 3608 };         // level 12, no bonus in Old School

const xp = (p: any) => p.stats[5];           // prayer
const near = (p: any, c: { x: number; z: number }) => { p.teleport(c.x + 2, c.z, 0); H.tick(1); };

// ---------------------------------------------------------------- the rate
console.log('WHAT ONE OFFERING IS WORTH');
{
    const p = player('altar1', ALTAR.x + 2, ALTAR.z);
    near(p, ALTAR);
    H.give(p, 'bones', 1);
    const before = xp(p);
    A.useOn(p, ALTAR.x, ALTAR.z, 'chaosaltar', 'bones');
    const gained = xp(p) - before;
    // One CLICK is not one offering: a bone that survives the roll is still in the pack and the
    // loop offers it again, so a single bone pays 157 over and over until a roll finally takes it.
    // That re-roll is the method - it is what makes the average 7x burying rather than 3.5x.
    check('  every offering pays 3.5x a burial (bones: 4.5 -> 15.7)', gained % 157, 0);
    check('  and it paid at least once', gained >= 157, true);
    check('  the bone is gone by the end', H.invCount(p, 'bones'), 0);
    H.despawn(p);
}

// ---------------------------------------------------------------- the save
console.log('HOW LONG AN INVENTORY LASTS');
{
    const p = player('altar2', ALTAR.x + 2, ALTAR.z);
    near(p, ALTAR);
    H.give(p, 'bones', 28);
    const before = xp(p);
    for (let i = 0; i < 400 && H.invCount(p, 'bones') > 0; i++) {
        A.useOn(p, ALTAR.x, ALTAR.z, 'chaosaltar', 'bones');
        H.tick(3);
    }
    const offerings = (xp(p) - before) / 157;
    check('  every bone was eventually consumed', H.invCount(p, 'bones'), 0);
    // 28 bones at a 50% save roll average 56 offerings; allow a wide band for the dice
    check(`  28 bones bought about 56 offerings (got ${offerings.toFixed(0)})`,
        offerings > 30 && offerings < 95, true);
    check('  which is roughly 7x burying', (xp(p) - before) / (28 * 45) > 4, true);
    H.despawn(p);
}

// ---------------------------------------------------------------- only the right altar
console.log('THE OTHER ALTARS ARE UNCHANGED');
{
    const p = player('altar3', CHURCH.x + 2, CHURCH.z);
    near(p, CHURCH);
    H.give(p, 'bones', 5);
    const before = xp(p);
    const mark = A.mark();
    A.useOn(p, CHURCH.x, CHURCH.z, 'chaosaltar', 'bones');
    H.tick(2);
    check('  the level 12 church pays nothing', xp(p) - before, 0);
    check('  and keeps your bones', H.invCount(p, 'bones'), 5);
    check('  saying nothing interesting happens', A.said(p, mark, 'Nothing interesting'), true);
    H.despawn(p);
}

// ---------------------------------------------------------------- not just any item
console.log('IT ONLY TAKES BONES');
{
    const p = player('altar4', ALTAR.x + 2, ALTAR.z);
    near(p, ALTAR);
    H.give(p, 'coins', 100);
    const mark = A.mark();
    A.useOn(p, ALTAR.x, ALTAR.z, 'chaosaltar', 'coins');
    H.tick(2);
    check('  coins are refused', [H.invCount(p, 'coins'), A.said(p, mark, 'Nothing interesting')], [100, true]);
    H.despawn(p);
}

console.log(`\n${R.ok} ok, ${R.bad} FAIL`);
process.exit(R.bad ? 1 : 0);
