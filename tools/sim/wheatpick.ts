// EVERY WHEAT IN THE FIELD CAN BE PICKED.
// Usage: npx tsx tools/sim/wheatpick.ts   (exit code is the verdict)
//
// The 377 cache has four wheat locs - wheat, wheat_tall, wheat_small, wheat_smallest - all named
// "Wheat", all drawn from the same model, all offering op2=Pick, and differing only in how big
// they are drawn. pickables.rs2 wired three of them to [label,pick_wheat] and missed wheat_tall,
// so in a field where the rest work, the tall ones answer "Nothing interesting happens."
//
// It is the Lumbridge field by the windmill, which is where grain for Cook's Assistant comes from.
//
// FOUND BY tools/sim/placeddead.ts: of opsweep's 1,628 dead loc options, 580 are on locs that are
// actually placed on the map, and this was one of them.
import * as H from './harness.js';
import { check, R, player, mesOf } from './a1lib.js';
import LocType from '#/cache/config/LocType.js';
import ObjType from '#/cache/config/ObjType.js';

await H.boot();

const GRAIN = ObjType.getId('grain');
const INV = 93;
const WHEATS = ['wheat', 'wheat_tall', 'wheat_small', 'wheat_smallest'];

console.log('== all four are the same wheat as far as a player can tell');
for (const nm of WHEATS) {
    const id = LocType.getId(nm);
    check(`${nm} is in the cache`, id !== -1, true);
    if (id === -1) continue;
    check('  it is called Wheat', LocType.get(id).name, 'Wheat');
    check('  and offers Pick on op2', LocType.get(id).op?.[1], 'Pick');
}

console.log('\n== each one that is placed hands over grain');
for (const nm of WHEATS) {
    const spots = H.locsNear(nm, 3155, 3304, 0);
    if (spots.length === 0) {
        console.log(`  --   ${nm} is not placed anywhere, so nothing to click`);
        continue;
    }
    const s = spots[0];
    const p: any = player(`pick${nm.slice(5, 12)}`, s.x + 1, s.z, 0);
    H.clearLogs();
    H.opLoc(p, s.x, s.z, nm, 2);
    H.tick(4);
    check(`${nm} (${spots.length} in the world, nearest ${s.x},${s.z}) is picked`, mesOf(p), ['You pick some grain.']);
    check('  and the grain is in the bag', p.invTotal(INV, GRAIN), 1);
}

console.log(`\n${R.ok} ok, ${R.bad} FAIL`);
process.exit(R.bad ? 1 : 0);
