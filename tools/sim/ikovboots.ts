// Temple of Ikov: the boots of lightness, which are the only way anybody gets over the lava bridge.
//
// The bridge refuses a player whose weight is not already negative (ikov_dungeon.rs2, `weight >= 0`
// -> @ikov_bridgefail), and the cache has two pairs of boots for exactly that: the pocketed pair
// weighs 12oz and the worn pair -10lb. Neither was referenced anywhere in the quest, so wearing
// them did nothing to the player's weight and the bridge could not be crossed.
//
//   NODE_MEMBERS=true npx tsx tools/sim/ikovboots.ts
import * as H from './harness.js';

await H.boot();

const p: any = H.makePlayer('ikbt', 2672, 9806);
H.tick(2);
p.teleport(2672, 9806, 0);
H.maxOut(p);
H.tick(1);

// A sim player is not a NetworkPlayer, and it is NetworkPlayer's update pass that calls
// calculateRunWeight() when an inventory changes - so the probe has to ask for it. A real player
// gets it for free on every inventory change, which is what the bridge's `weight` reads.
const w = () => {
    (p as unknown as { calculateRunWeight: () => void }).calculateRunWeight();
    return (p as unknown as { runweight: number }).runweight;
};
console.log('');
console.log('IKOV BOOTS OF LIGHTNESS');
console.log('  weight with nothing on            ' + w());

H.give(p, 'ikov_bootsoflightness', 1);
H.tick(1);
console.log('  carrying the pocketed pair        ' + w() + '   (12oz each in the cache)');

H.opheld(p, 'ikov_bootsoflightness', 2);
H.tick(2);
const worn = -1; // read below from the runweight instead
const pocket = H.invCount(p, 'ikov_bootsoflightness');
console.log('  after Wear: worn=' + worn + ' pocketed=' + pocket);
console.log('  weight wearing them              ' + w() + '   (must be below zero)');

const ok = pocket === 0 && w() < 0;

// The way back off is [proc,on_unequip] in player/scripts/equip.rs2 - the same central hook Monkey
// Madness' greegrees and Ghosts Ahoy' bedsheet use - so it is not driven from here.
console.log('');
console.log(ok ? 'PASS' : 'FAIL');
process.exit(ok ? 0 : 1);
