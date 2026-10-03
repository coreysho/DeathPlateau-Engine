// Can you punch Zulrah? You should need a halberd: Old School puts the snake across water from the
// walkway, so a one-tile weapon cannot touch it and a two-tile one can.
//
//   npx tsx tools/sim/zulrahreach.ts
import World from '#/engine/World.js';
import * as H from './harness.ts';
import * as A from './a1lib.ts';
import { NpcType, ObjType, check, R } from './a1lib.ts';
import InstanceMap from '#/engine/InstanceMap.js';
import InvType from '#/cache/config/InvType.js';
import { CollisionFlag } from '#/engine/routefinder/index.js';
import { isFlagged } from '#/engine/GameMap.js';

await H.boot();

console.log('HALBERD REACH');
const missing: string[] = [];
let have = 0;
for (let i = 0; i < 40000; i++) {
    const t = ObjType.get(i);
    if (!t || !t.debugname || !t.debugname.includes('halberd')) continue;
    if (t.wearpos !== 3) continue;
    const vals = [...(t.params?.values() ?? [])];
    if (vals.includes(2)) have++; else missing.push(t.debugname);
}
check('  every wielded halberd reaches two tiles', missing.length, 0);
if (missing.length) console.log('    still at fist range:', missing.join(', '));
check(`  and ${have} of them do`, have > 0, true);

console.log('\nHOW FAR ZULRAH SITS FROM THE WALKWAY');
const ids = new Set(['zulrah', 'zulrah_magma', 'zulrah_tanzanite'].map(x => NpcType.getId(x)));
const p: any = H.makePlayer('reach', 34 * 64 + 36, 47 * 64 + 48, 270);
H.tick(2); H.maxOut(p); H.clearInv(p); H.setVar(p, 'tutorial', 1000);
H.setVar(p, 'regicide_quest', 15); H.setVar(p, 'zulrah_volunteered', 1);
H.tick(1);
A.op(p, 34 * 64 + 38, 47 * 64 + 48, 'osrsloc_46242', 1);
H.tick(8);
const inst = H.getVar(p, 'zulrah_instance') as number;
const [ix, iz] = [(inst >> 14) & 0x3fff, inst & 0x3fff];
const SLOT = InstanceMap.INSTANCE_ZONES * 8;
const snake = () => (World as any).npcs.find((s: any) => s && s.isActive && ids.has(s.type)
    && s.x >= ix && s.x < ix + SLOT && s.z >= iz && s.z < iz + SLOT) ?? null;

let best = 99, bestAt = '';
for (let i = 0; i < 400; i++) {
    const s = snake();
    if (s && s.level === 0) {
        // nearest tile of the snake's footprint to any tile you can actually stand on
        for (let x = s.x - 8; x <= s.x + s.width + 8; x++) {
            for (let z = s.z - 8; z <= s.z + s.length + 8; z++) {
                if (isFlagged(0, x, z, CollisionFlag.WALK_BLOCKED)) continue;
                const dx = Math.max(s.x - x, 0, x - (s.x + s.width - 1));
                const dz = Math.max(s.z - z, 0, z - (s.z + s.length - 1));
                const d = Math.max(dx, dz);
                if (d > 0 && d < best) { best = d; bestAt = `${x},${z} -> snake at ${s.x},${s.z}`; }
            }
        }
    }
    H.tick(1);
}
console.log(`  closest you can stand to Zulrah's body: ${best} tiles (${bestAt})`);
// The arena lets you stand one tile from the snake's body, so geometry alone does not stop a
// punch - min_attackrange does. Moving the snake or the walkway would mean re-laying the cloud
// fill with it, which is a lot of risk for a rule one param states exactly.
check('  you can indeed stand within fist range', best, 1);
const zt = NpcType.get(NpcType.getId('zulrah'));
const minReach = [...(zt.params?.values() ?? [])];
check('  so Zulrah demands a two-tile weapon', minReach.includes(2), true);
for (const form of ['zulrah', 'zulrah_magma', 'zulrah_tanzanite']) {
    const t = NpcType.get(NpcType.getId(form));
    check(`  ${form} too`, [...(t.params?.values() ?? [])].includes(2), true);
}

console.log(`\n${R.ok} ok, ${R.bad} FAIL`);
process.exit(R.bad ? 1 : 0);
