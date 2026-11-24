import * as H from './harness.js';
import World from '#/engine/World.js';
import NpcType from '#/cache/config/NpcType.js';
await H.boot();
for (const nm of ['phoenixdoor2', 'blackarmdoor', 'blackarmcupboardshut', 'blackarmcupboardopen']) {
    const hits = H.locsNear(nm, 3250, 3400, 0);
    console.log(nm, JSON.stringify(hits.slice(0, 6)));
}
const names = ['weaponsmaster', 'katrine', 'tramp'];
for (const nm of names) {
    const id = NpcType.getId(nm);
    const at: string[] = [];
    for (const n of World.npcs) if (n && n.isActive && n.type === id) at.push(`${n.x},${n.z},${n.level}`);
    console.log(nm, at.slice(0, 5).join(' | '));
}
