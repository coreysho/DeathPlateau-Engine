// WHERE IS THIS NPC? Every live spawn of each name, which is the first thing a walk needs and the
// one thing the spawn files make awkward to look up ([[npc-spawns-live-in-jm2]]).
//
//   npx tsx tools/sim/npcwhere.ts <name> [name...]
import * as H from './harness.js';
import World from '#/engine/World.js';
import NpcType from '#/cache/config/NpcType.js';

await H.boot();
const names = process.argv.slice(2);
if (!names.length) {
    console.log('usage: npcwhere.ts <name> [name...]');
    process.exit(1);
}
console.log('');
for (const name of names) {
    const id = NpcType.getId(name);
    if (id === -1) {
        console.log(name + ': NO SUCH NPC');
        continue;
    }
    const at: string[] = [];
    for (const npc of World.npcs) {
        if (!npc || npc.type !== id) continue;
        at.push(npc.x + ',' + npc.z + (npc.level ? ' L' + npc.level : '') + (npc.isActive ? '' : ' (asleep)'));
    }
    console.log(name.padEnd(34) + (at.length ? at.join('   ') : 'nowhere on the map'));
}
process.exit(0);
