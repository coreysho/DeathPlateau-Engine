// Where an npc type stands.
//   npx tsx tools/sim/wherenpc.ts roguesden_trader
import World from '#/engine/World.js';
import * as H from './harness.js';
import NpcType from '#/cache/config/NpcType.js';

await H.boot();
const want = process.argv[2];
const id = NpcType.getId(want);
let n = 0;
for (const npc of World.npcs) {
    if (!npc || npc.type !== id) continue;
    console.log(`  ${npc.level},${npc.x},${npc.z}`);
    n++;
}
console.log(`${n} x ${want} (npc ${id})`);
process.exit(0);
