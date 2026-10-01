// How often is the client told to throw Zulrah away and add it again?
//
//   npx tsx tools/sim/zulrahredraw.ts
//
// The owner's words are "disappears for a quick tick and comes back", and a TICK is 600ms - far too
// long for a dropped frame. The client-side instruments agree: with both compiled in (the session
// banner names them), two fights produced model-not-ready events only on first sight of each model
// and NO missing animation frames at all, and it flickered anyway. So the npc is being drawn,
// correctly posed, and still goes away.
//
// That leaves the npc info block. Two things in it make a client remove an entity and add it back
// rather than move it: a TELEPORT - the protocol cannot express a jump, so the npc is re-added at
// the new place - and a CHANGE_TYPE. Either costs a tick of absence, which is the length reported.
//
// HOOK THE CALLS, NOT THE FLAGS. masks and tele are cleared at the end of every tick, so reading
// them after H.tick reads zeroes - the first version of this did exactly that and reported no
// teleports at all in a fight that visibly dives.
import World from '#/engine/World.js';
import Npc from '#/engine/entity/Npc.js';
import * as H from './harness.ts';
import * as A from './a1lib.ts';
import NpcType from '#/cache/config/NpcType.js';
import ObjType from '#/cache/config/ObjType.js';
import InvType from '#/cache/config/InvType.js';
import InstanceMap from '#/engine/InstanceMap.js';

await H.boot();

const ids = new Set(['zulrah', 'zulrah_magma', 'zulrah_tanzanite'].map(x => NpcType.getId(x)));
const nameOf = (t: number) => NpcType.get(t)?.debugname ?? String(t);

let teleports = 0;
let changetypes = 0;
let tick = 0;
const events: string[] = [];

const origTele = (Npc.prototype as any).teleport;
const origType = (Npc.prototype as any).changeType;
(Npc.prototype as any).teleport = function (x: number, z: number, level: number) {
    if (ids.has(this.type)) {
        teleports++;
        if (events.length < 24) events.push(`  tick ${String(tick).padStart(3)}  TELEPORT    ${nameOf(this.type)} -> level ${level}`);
    }
    return origTele.call(this, x, z, level);
};
(Npc.prototype as any).changeType = function (type: number, duration: number, reset?: boolean) {
    if (ids.has(this.type) || ids.has(type)) {
        changetypes++;
        if (events.length < 24) events.push(`  tick ${String(tick).padStart(3)}  CHANGETYPE  ${nameOf(this.type)} -> ${nameOf(type)}`);
    }
    return origType.call(this, type, duration, reset);
};

const p: any = H.makePlayer('redraw', 34 * 64 + 36, 47 * 64 + 48, 260);
H.tick(2); H.maxOut(p); H.clearInv(p); H.setVar(p, 'tutorial', 1000);
H.setVar(p, 'regicide_quest', 15);
H.setVar(p, 'zulrah_volunteered', 1);
H.equip(p, { rhand: 'magic_shortbow', quiver: 'rune_arrow' });
p.invSet(InvType.WORN, ObjType.getId('rune_arrow'), 30000, 13);
H.tick(1);
A.op(p, 34 * 64 + 38, 47 * 64 + 48, 'osrsloc_46242', 1);
H.tick(8);

const inst = H.getVar(p, 'zulrah_instance') as number;
const [ix, iz] = [(inst >> 14) & 0x3fff, inst & 0x3fff];
const SLOT = InstanceMap.INSTANCE_ZONES * 8;
const snake = () => {
    for (const s of (World as any).npcs) {
        if (s && s.isActive && ids.has(s.type) && s.x >= ix && s.x < ix + SLOT && s.z >= iz && s.z < iz + SLOT) return s;
    }
    return null;
};

for (; tick < 700; tick++) {
    const s = snake();
    if (!s) break;
    if (s.level === 0 && p.target !== s) H.attackNpc(p, s);
    H.tick(1);
    p.levels[3] = p.baseLevels[3];
    if (tick % 64 === 0) H.clearLogs();
}

console.log(`${tick} ticks of a real fight\n`);
events.forEach(e => console.log(e));
const total = teleports + changetypes;
console.log(`\nteleports: ${teleports}   changetypes: ${changetypes}`);
console.log(total ? `one re-add every ${(tick / total).toFixed(1)} ticks` : 'nothing asked the client to re-add it');
process.exit(0);
