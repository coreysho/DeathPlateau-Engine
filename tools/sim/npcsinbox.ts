// WHO IS STANDING IN THIS BOX? Every npc inside a rectangle, with its debugname and display name.
//
//   npx tsx tools/sim/npcsinbox.ts <x1> <x2> <z1> <z2>
//
// wherenpc.ts answers "where does this npc type stand" for one name. This one answers "is there a
// guard on this gate at all" - which is how Biohazard's Varrock plague check turned out not to
// exist in the 377 cache, rather than to be unimplemented.
import World from '#/engine/World.js';
import * as H from './harness.js';
import NpcType from '#/cache/config/NpcType.js';

await H.boot();
const [x0, x1, z0, z1] = process.argv.slice(2, 6).map(Number);
let n = 0;
for (const npc of World.npcs) {
    if (!npc) continue;
    if (npc.x < x0 || npc.x > x1 || npc.z < z0 || npc.z > z1) continue;
    const t = NpcType.get(npc.type);
    console.log(`${npc.level},${npc.x},${npc.z}  ${t.debugname ?? npc.type}  "${t.name}"`);
    n++;
}
console.log(`${n} npcs in ${x0}-${x1} x ${z0}-${z1}`);
process.exit(0);
