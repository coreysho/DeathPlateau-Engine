// Does Zulrah die EVERY time its hitpoints reach zero?
//
//   npx tsx tools/sim/zulrahkill.ts [kills]
//
// The owner reports a snake that drops to zero, keeps its life, heals back and carries on to the
// next phase. tools/sim/zulrah.ts already kills it once and passes, so a single kill proves
// nothing: the fight is driven by a PLAYER timer ([timer,zulrah_fight]) that reaches in and drives
// the snake every tick, including the two or three ticks [proc,npc_death] spends suspended in
// npc_arrivedelay and npc_delay before it reaches npc_del. If that ever preempts the dying snake
// the symptom is exactly what was reported, and it would show up as an INTERMITTENT failure that
// one kill can easily miss. So this kills it over and over and reports the rate.
import * as H from './harness.ts';
import * as A from './a1lib.ts';
import World from '#/engine/World.js';
import NpcType from '#/cache/config/NpcType.js';
import ObjType from '#/cache/config/ObjType.js';
import InvType from '#/cache/config/InvType.js';
import InstanceMap from '#/engine/InstanceMap.js';
import { NpcStat } from '#/engine/entity/NpcStat.js';

await H.boot();
const HP = NpcStat.HITPOINTS;
const REGICIDE_COMPLETE = 15;
const DOCK_BOAT = [34 * 64 + 38, 47 * 64 + 48];
const DOCK_BOAT_LOC = 'osrsloc_46242';
const KILLS = Number(process.argv[2] ?? 6);

let n = 0;
/** One whole fight, boat to corpse. Returns how it ended. */
function oneKill(): { died: boolean; ticks: number; lastHp: number; colour: string } {
    const p: any = H.makePlayer('zk' + n, DOCK_BOAT[0] - 2, DOCK_BOAT[1], 200 + n); n++;
    H.tick(2); H.maxOut(p); H.clearInv(p); H.setVar(p, 'tutorial', 1000);
    H.setVar(p, 'regicide_quest', REGICIDE_COMPLETE);
    H.setVar(p, 'zulrah_volunteered', 1);
    H.equip(p, { rhand: 'magic_shortbow', quiver: 'rune_arrow' });
    p.invSet(InvType.WORN, ObjType.getId('rune_arrow'), 30000, 13);
    H.tick(1);
    A.op(p, DOCK_BOAT[0], DOCK_BOAT[1], DOCK_BOAT_LOC, 1);
    H.tick(8);

    const inst = H.getVar(p, 'zulrah_instance') as number;
    const [ix, iz] = [(inst >> 14) & 0x3fff, inst & 0x3fff];
    const SLOT = InstanceMap.INSTANCE_ZONES * 8;
    const ids = new Set(['zulrah', 'zulrah_magma', 'zulrah_tanzanite'].map(x => NpcType.getId(x)));
    const mySnake = () => {
        for (const s of (World as any).npcs)
            if (s && s.isActive && ids.has(s.type) && s.x >= ix && s.x < ix + SLOT && s.z >= iz && s.z < iz + SLOT) return s;
        return null;
    };

    let ticks = 0, died = false, last: any = null;
    for (; ticks < 4000; ticks++) {
        const s = mySnake();
        if (!s) { died = true; break; }
        last = s;
        if (s.level === 0 && p.target !== s) H.attackNpc(p, s);
        H.tick(1);
        p.levels[HP] = p.baseLevels[HP];        // the player, and ONLY the player
        if (ticks % 64 === 0) H.clearLogs();
    }
    const colour = last ? (NpcType.get(last.type).debugname ?? '?') : '?';
    const lastHp = last ? last.levels[HP] : -1;
    H.despawn(p);
    H.tick(2);
    return { died, ticks, lastHp, colour };
}

console.log(`KILLING ZULRAH ${KILLS} TIMES, EACH A WHOLE FIGHT FROM THE BOAT`);
let dead = 0;
const survivors: string[] = [];
for (let i = 0; i < KILLS; i++) {
    const r = oneKill();
    if (r.died) { dead++; console.log(`  kill ${i + 1}: died after ${r.ticks} ticks`); }
    else { survivors.push(`kill ${i + 1}: SURVIVED 4000 ticks on ${r.lastHp} hitpoints as ${r.colour}`); console.log('  ' + survivors.at(-1)); }
}
console.log(`\n${dead}/${KILLS} died`);
console.log(dead === KILLS ? '1 checks: 1 ok, 0 FAILED' : `1 checks: 0 ok, 1 FAILED\n  ${survivors.join('\n  ')}`);
process.exit(0);
