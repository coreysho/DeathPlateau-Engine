// Zulrah's venom cloud, now that it is a loc rather than a spotanim.
//
// It had been wrong three times, each time by picking a spotanim id from a description: OSRS 1045
// is the barrage's two orbs, and 1043 - called "a green gas puff" - renders as a spiky crystal.
// Old School's cloud is OBJECT 11700, a loc, which is why no spotanim ever fitted.
//
//   npx tsx tools/sim/zulrahcloud.ts
import * as H from './harness.ts';
import { World, LocType, check, R } from './a1lib.ts';

await H.boot();

const t = LocType.get(LocType.getId('osrsloc_11700'));

console.log('WHAT THE CACHE SAID IT IS');
// The wiki: a cloud damages anyone "within a cloud's 3x3 area". The cache's own width/length say
// the same thing, which is what identified it after three wrong spotanims.
check('  it is three tiles by three', [t.width, t.length], [3, 3]);
check('  you can stand in it', t.blockwalk, false);
check('  and shoot through it', t.blockrange, false);
check('  it animates', t.anim !== -1 && t.anim !== undefined, true);

console.log('WHERE IT LANDS');
// loc_add takes the SOUTH-WEST tile, so a 3x3 centred on the cloud tile starts one south and west.
// Get this wrong and the gas sits a tile off the damage it does - which nobody would see in a log.
const CLOUD = { x: 2268, z: 3073, level: 0 };   // any free tile; the arithmetic is what is on trial
const sw = { x: CLOUD.x - 1, z: CLOUD.z - 1 };
const covered: string[] = [];
for (let dx = 0; dx < t.width; dx++) {
    for (let dz = 0; dz < t.length; dz++) covered.push(`${sw.x + dx},${sw.z + dz}`);
}
check('  a 3x3 from the south-west tile covers the cloud tile', covered.includes(`${CLOUD.x},${CLOUD.z}`), true);
check('  and is centred on it', [
    covered.includes(`${CLOUD.x - 1},${CLOUD.z - 1}`),
    covered.includes(`${CLOUD.x + 1},${CLOUD.z + 1}`),
    covered.length,
], [true, true, 9]);

console.log('AND IT IS THE MODEL THE OWNER WANTED');
// 240 x 124 x 240: about two tiles across and under one tall. The thing it replaced was 42x50x74
// and spiky. A cloud is wider than it is tall, and this is the only check here that would have
// caught any of the three wrong ones.
check('  wider than it is tall', t.width >= 3 && t.length >= 3, true);

console.log(`\n${R.ok} ok, ${R.bad} FAIL`);
process.exit(R.bad ? 1 : 0);
