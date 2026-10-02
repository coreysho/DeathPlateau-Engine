// Does Zulrah TELEPORT on ticks that are not dives?
//
// NpcInfoEncoder.writeNpcs removes an npc from the client the moment other.tele is set - the
// protocol cannot express a jump, so the client throws the npc away and adds it back at the new
// place. That costs a whole tick of absence, which is exactly the length the owner reports:
// "disappears for a quick tick and comes back".
//
// THE PREVIOUS MEASUREMENT OF THIS WAS WORTHLESS AND LOOKED FINE. tools/sim/zulrahvis.ts drove
// rsbuf.npcInfo after H.tick, and World.cycle ends with rsbuf.cleanup(), which sets the mirror's
// tele to false, masks to 0 and animId to -1. So it asked "was Zulrah removed?" of a mirror that
// had already had every teleport and every animation wiped out of it. The only drops it could see
// were the ones caused by coord, which persists - the dives - and it reported everything else as
// clean.
//
// This reads tele off the engine's own Npc, hooked at resetPathingEntity, which is the last thing
// that touches it before it is cleared. Nothing can set tele without this seeing it, however it was
// set - teleport(), changeType(), a direct assignment, anything.
//
//   npx tsx tools/sim/zulrahtele.ts
import World from '#/engine/World.js';
import NpcEntity from '#/engine/entity/Npc.js';
import PathingEntity from '#/engine/entity/PathingEntity.js';
import SeqType from '#/cache/config/SeqType.js';
import * as H from './harness.ts';
import * as A from './a1lib.ts';
import NpcType from '#/cache/config/NpcType.js';
import ObjType from '#/cache/config/ObjType.js';
import InvType from '#/cache/config/InvType.js';
import InstanceMap from '#/engine/InstanceMap.js';

await H.boot();

const ids = new Set(['zulrah', 'zulrah_magma', 'zulrah_tanzanite'].map(x => NpcType.getId(x)));
const seqName = (id: number) => { try { return (SeqType.get(id) as any)?.debugname ?? String(id); } catch { return String(id); } };

// what Zulrah was told to play, per tick
const animOf = new Map<number, number[]>();
const origAnim = (NpcEntity.prototype as any).playAnimation;
(NpcEntity.prototype as any).playAnimation = function (seq: number, delay: number) {
    if (seq !== -1 && ids.has(this.type)) {
        const t = World.currentTick;
        animOf.set(t, [...(animOf.get(t) ?? []), seq]);
    }
    return origAnim.call(this, seq, delay);
};

// and whether it teleported, read the instant before the flag is cleared
type Tele = { tick: number; level: number; x: number; z: number };
const teles: Tele[] = [];
const origReset = (PathingEntity.prototype as any).resetPathingEntity;
(PathingEntity.prototype as any).resetPathingEntity = function () {
    if (this.tele && ids.has(this.type) && this instanceof NpcEntity) {
        teles.push({ tick: World.currentTick, level: this.level, x: this.x, z: this.z });
    }
    return origReset.call(this);
};

const p: any = H.makePlayer('ztele', 34 * 64 + 36, 47 * 64 + 48, 262);
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

const start = World.currentTick;
for (let i = 0; i < 900; i++) {
    const s = snake();
    if (!s) break;
    if (s.level === 0 && p.target !== s) H.attackNpc(p, s);
    H.tick(1);
    p.levels[3] = p.baseLevels[3];
    if (i % 64 === 0) H.clearLogs();
}
const ticks = World.currentTick - start;

console.log(`${ticks} ticks of a real fight\n`);
const anims = [...animOf.values()].flat();
const hist = new Map<number, number>();
for (const a of anims) hist.set(a, (hist.get(a) ?? 0) + 1);
console.log('animations played:');
for (const [id, n] of [...hist].sort((a, b) => b[1] - a[1])) console.log(`  ${String(n).padStart(4)}x  ${seqName(id)}`);

// A teleport ON LEVEL 0 is a jump the player is watching. One on level 3 is the dive, which is
// supposed to take it away.
const onFloor = teles.filter(t => t.level === 0);
const diving = teles.filter(t => t.level !== 0);
console.log(`\nteleports: ${teles.length}`);
console.log(`  while hidden on level 3 (the dive):  ${diving.length}`);
console.log(`  WHILE VISIBLE ON LEVEL 0:            ${onFloor.length}   <- each one is a tick of absence`);
if (onFloor.length) {
    console.log(`\n  one every ${(ticks / onFloor.length).toFixed(1)} ticks, at:`);
    for (const t of onFloor.slice(0, 16)) {
        const played = (animOf.get(t.tick) ?? []).map(seqName).join(', ') || '-';
        console.log(`    tick ${String(t.tick - start).padStart(3)}  ${t.x},${t.z}   playing: ${played}`);
    }
}
process.exit(0);
