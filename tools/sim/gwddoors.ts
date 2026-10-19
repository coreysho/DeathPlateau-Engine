// THE FIVE LOCS THAT FLANK THE THREE GOD WARS DOORS, and whether they are still there.
//
//   npx tsx tools/sim/gwddoors.ts
//
// Reported from the game as "gwd missing walls by doors", with a picture of the Bandos door standing
// in open floor with void either side. The doors were imported; the pillars and walls around them
// were not. All five models (15550, 144, 12736, 28866, 143) are in rev 474's newer format - the one
// whose footer is FF FF - and import474map.py refused that format outright, so every placement built
// on one was dropped. There was nothing wrong with the map and nothing wrong with the doors.
//
// THIS CANNOT CHECK WHAT THE PLAYER SEES, and says so rather than pretending. The server only keeps
// active=yes locs in its zones (GameMap.addStaticLoc), and all five are scenery, so no amount of
// walking about in a sim will find them: the picture is the evidence, and it is a render, not a
// test. What a sim CAN hold on to is everything that would have to be true for the picture to be
// right - the configs exist, they name models, and the collision the five bring with them is there -
// and that is enough to catch the one failure that has already happened once, which is the five
// quietly going missing again on a re-import.
import * as H from './harness.js';
import * as A from './a1lib.js';
import { check, R } from './a1lib.js';
import LocType from '#/cache/config/LocType.js';

await H.boot();

const FLANKS = ['loc474_26853', 'loc474_26854', 'loc474_26855', 'loc474_26856', 'loc474_26857'];

console.log('ALL FIVE ARE IN THE BUILD, AND ALL FIVE HAVE A MODEL');
{
    const missing = FLANKS.filter(n => LocType.getId(n) < 0);
    check('  every one of the five has a config', missing, []);
    const modelless = FLANKS.filter(n => {
        const id = LocType.getId(n);
        if (id < 0) return false;
        const t: any = LocType.get(id);
        return !(t.models?.length || t.anim !== -1);
    });
    // A loc whose models failed to convert would still get a config; this is what tells the two
    // apart, and it is the half the decoder had to earn.
    check('  and a model behind it', modelless, []);

    // The 2x3 one sits on the plane above the door and is the only one that is not 1x1.
    const big: any = LocType.get(LocType.getId('loc474_26857'));
    check('  loc474_26857 is the 2x3 piece overhead', [big.width, big.length], [2, 3]);
}

console.log('\nAND THE PILLARS ARE SOLID, which is the collision they bring with them');
{
    // Two pillars per door, one either side, on the tiles the 474 cache places them. Nothing in the
    // cache turns blockwalk off for any of the five, so a pillar blocks - and before the import
    // these six tiles were open floor, because there was no pillar on them.
    check('  bandos pillars block', [A.walkable(2, 2863, 5353), A.walkable(2, 2863, 5355)], [false, false]);
    check('  armadyl pillars block', [A.walkable(2, 2838, 5295), A.walkable(2, 2840, 5295)], [false, false]);
    check('  zamorak pillars block', [A.walkable(2, 2924, 5332), A.walkable(2, 2926, 5332)], [false, false]);

    // ...and the doorway between each pair is still open, which is the thing a solid pillar must
    // not take with it.
    check('  and the doorway between each pair is still open', [A.walkable(2, 2863, 5354), A.walkable(2, 2839, 5295), A.walkable(2, 2925, 5332)], [true, true, true]);

    // The approach to each door is unchanged too - a pillar that walled off the corridor would be
    // worse than the hole it fills.
    check('  and you can still walk up to each door', [A.connected(2, 2858, 5354, 2862, 5354, 40), A.connected(2, 2839, 5291, 2839, 5294, 40), A.connected(2, 2925, 5328, 2925, 5331, 40)], [true, true, true]);
}

console.log(`\n${R.ok} ok, ${R.bad} FAIL`);
process.exit(R.bad ? 1 : 0);
