// WHY DOES NOTHING COME OUT OF THE HOLE? npc_add said nothing, the mesbox after it ran, and the
// npc is not in the world eight ticks later. This adds one the same way the engine op does and
// watches it.
import * as H from './harness.js';
import World from '#/engine/World.js';
import Npc from '#/engine/entity/Npc.js';
import NpcType from '#/cache/config/NpcType.js';
import { EntityLifeCycle } from '#/engine/entity/EntityLifeCycle.js';

await H.boot();

for (const nm of ['vc_kingrat', 'vc_rat', 'vc_party_rat', 'vc_pox_inwarehouse', 'skeleton_hellhound']) {
    try {
        const id = NpcType.getId(nm);
        const t = NpcType.get(id);
        console.log(`${nm.padEnd(22)} id ${String(id).padStart(5)}  size ${t.size}  blockwalk ${(t as any).blockwalk}  vislevel ${t.vislevel}  hp ${(t as any).hitpoints ?? '-'}  huntmode ${(t as any).huntmode}`);
    } catch {
        console.log(`${nm} MISSING`);
    }
}

const tries: [number, number, number][] = [
    [3267, 3378, 1],
    [3268, 3378, 1],
    [3265, 3378, 1],
    [3270, 3380, 1],
    [3268, 3380, 0]
];
const id = NpcType.getId('vc_kingrat');
const type = NpcType.get(id);
for (const [x, z, level] of tries) {
    const before = [...World.npcs].filter(n => n && n.type === id).length;
    let err = '';
    try {
        const npc = new Npc(level, x, z, type.size, type.size, EntityLifeCycle.DESPAWN, World.getNextNid(), id, type.blockwalk);
        World.addNpc(npc, 2000);
    } catch (e) {
        err = String(e);
    }
    H.tick(3);
    const now = [...World.npcs].filter(n => n && n.type === id);
    console.log(`  add at ${x},${z} L${level}: before ${before} now ${now.length}${err ? '  ERR ' + err : ''}  ${now.map(n => `L${n.level} ${n.x},${n.z} active=${n.isActive}`).join(' ')}`);
}
