import * as H from './harness.js';
import * as A from './a1lib.js';
import NpcType from '#/cache/config/NpcType.js';
await H.boot();
console.log("--- npcs in Timfraku's hut area, all planes ---");
for (const npc of A.World.npcs) {
    if (!npc || npc.x < 2765 || npc.x > 2800 || npc.z < 3075 || npc.z > 3100) continue;
    const t = NpcType.get(npc.type);
    const ops = (t.op ?? []).map((o, i) => (o ? `op${i + 1}=${o}` : null)).filter(Boolean);
    if (!/tbwt|timfraku/i.test(t.debugname ?? '')) continue;
    console.log(String(npc.level), `${npc.x},${npc.z}`, (t.debugname ?? '').padEnd(32), '|', ops.join(' '));
}
console.log('\n--- dead npc ops in that box ---');
for (const [k, where] of A.deadNpcOps(2765, 3075, 2800, 3100)) console.log(' ', k, '@', where.join(' '));
