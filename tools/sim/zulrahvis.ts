// Does the SERVER ever stop telling the client about Zulrah on a tick that is not a dive?
//
// The owner's words: "zulrah goes away and comes back", on every animation it does. The client is
// cleared of blame as far as it can be - NpcType.method475 has exactly one null return, it is
// counted, and it reads zero; so is the frame-transform bail. The npc is being built and posed.
//
// So this watches the one thing nobody has watched: build-area membership, tick by tick.
// NpcInfoEncoder.writeNpcs drops an npc - and the client throws it away and re-adds it - when ANY
// of these is true:
//
//     nid === -1 | tele | coord.y() !== player.coord.y() | !withinDistanceSw(...) | !active
//
// Two of those are the dive and are supposed to happen. The other three are not, and
// withinDistanceSw is measured from the SOUTH-WEST TILE of a FIVE-BY-FIVE npc, which is the kind of
// thing that is right for a goblin and wrong for a boss.
//
//   npx tsx tools/sim/zulrahvis.ts
import World from '#/engine/World.js';
import * as H from './harness.ts';
import * as A from './a1lib.ts';
import NpcType from '#/cache/config/NpcType.js';
import ObjType from '#/cache/config/ObjType.js';
import InvType from '#/cache/config/InvType.js';
import InstanceMap from '#/engine/InstanceMap.js';
import * as rsbuf from '#/network/rsbuf/index.js';
import NpcEntity from '#/engine/entity/Npc.js';
import SeqType from '#/cache/config/SeqType.js';

await H.boot();

const ids = new Set(['zulrah', 'zulrah_magma', 'zulrah_tanzanite'].map(x => NpcType.getId(x)));
const nameOf = (t: number) => NpcType.get(t)?.debugname ?? String(t);

// THE HARNESS ONLY HOOKS Player.playAnimation, so npc animations go unrecorded and the first
// version of this reported an empty histogram - which is a fight that proves nothing, not a
// fight without drops. Hook the npc side.
const animTicks = new Map<number, number[]>();   // tick -> seqs Zulrah was told to play
const origAnim = (NpcEntity.prototype as any).playAnimation;
(NpcEntity.prototype as any).playAnimation = function (seq: number, delay: number) {
    if (seq !== -1 && ids.has(this.type)) {
        const t = World.currentTick;
        animTicks.set(t, [...(animTicks.get(t) ?? []), seq]);
    }
    return origAnim.call(this, seq, delay);
};

const p: any = H.makePlayer('zvis', 34 * 64 + 36, 47 * 64 + 48, 261);
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

const cheb = (ax: number, az: number, bx: number, bz: number) => Math.max(Math.abs(ax - bx), Math.abs(az - bz));

type Row = { tick: number; seen: boolean; level: number; dist: number; anim: number; type: string; active: boolean };
const rows: Row[] = [];
let tick = 0;
let lastAnim = -1;
let prevX = p.x, prevZ = p.z, prevLevel = p.level;

for (; tick < 900; tick++) {
    const s = snake();
    if (!s) break;
    if (s.level === 0 && p.target !== s) H.attackNpc(p, s);
    // the animation the npc was told to play this tick, read BEFORE the tick clears the masks
    H.tick(1);
    p.levels[3] = p.baseLevels[3];
    const after = snake();
    if (!after) break;
    // A socketless sim player never writes npc info, so build.npcs stays empty and hasNpc is always
    // false - which is what the first run of this measured, and it measured nothing. Drive the
    // encoder by hand, at the point in the cycle the real server drives it: after computeNpc has
    // mirrored every npc for this tick and before anything else moves.
    rsbuf.npcInfo(0, p.slot, Math.abs(prevX - p.x), Math.abs(prevZ - p.z), prevLevel !== p.level, false);
    prevX = p.x; prevZ = p.z; prevLevel = p.level;
    const anim = (animTicks.get(World.currentTick) ?? animTicks.get(World.currentTick - 1) ?? [])[0] ?? -1;
    rows.push({
        tick,
        seen: rsbuf.hasNpc(p.slot, after.nid),
        level: after.level,
        dist: cheb(p.x, p.z, after.x, after.z),
        anim,
        type: nameOf(after.type),
        active: after.isActive,
    });
    lastAnim = anim;
    if (tick % 64 === 0) H.clearLogs();
}

console.log(`${rows.length} ticks of a real fight\n`);

// every tick where membership flipped, and what else was true at the time
let flips = 0, divesOut = 0, mysteryOut = 0;
const mystery: Row[] = [];
for (let i = 1; i < rows.length; i++) {
    const a = rows[i - 1], b = rows[i];
    if (a.seen === b.seen) continue;
    flips++;
    if (!b.seen) {
        if (b.level !== 0) divesOut++;
        else { mysteryOut++; mystery.push(b); }
    }
}

console.log(`membership flips: ${flips}`);
console.log(`  dropped while diving (level ${rows.find(r => r.level !== 0)?.level ?? '?'}): ${divesOut}  - expected, that is the dive`);
console.log(`  dropped while ON LEVEL 0 and alive:                ${mysteryOut}  - NOT expected`);
if (mystery.length) {
    console.log('\nthe ones that are not dives:');
    for (const m of mystery.slice(0, 20)) {
        console.log(`  tick ${String(m.tick).padStart(3)}  ${m.type.padEnd(17)} level ${m.level}  sw-distance ${m.dist}  active ${m.active}  anim ${m.anim}`);
    }
}

// VALIDATE THE EXPERIMENT BEFORE BELIEVING ITS ZERO. A fight in which Zulrah never animated would
// report no animation-time drops for the most boring reason there is.
const seqName = (id: number) => { try { return (SeqType.get(id) as any)?.debugname ?? String(id); } catch { return String(id); } };
const hist = new Map<number, number>();
for (const r of rows) if (r.anim !== -1) hist.set(r.anim, (hist.get(r.anim) ?? 0) + 1);
console.log('');
console.log('animations Zulrah actually played:');
for (const [id, n] of [...hist].sort((a, b) => b[1] - a[1])) console.log(`  ${String(n).padStart(4)}x  ${seqName(id)}`);
if (!hist.size) console.log('  NONE - this fight proves nothing');

// THE QUESTION. Of the ticks Zulrah was told to play an animation, on how many did the server
// stop telling the client about it? That is the reported bug, stated as a number.
const animRows = rows.filter(r => r.anim !== -1);
const animDropped = animRows.filter(r => !r.seen);
console.log('');
console.log(`ticks Zulrah animated: ${animRows.length}`);
console.log(`  of those, dropped from the client: ${animDropped.length}`);
for (const r of animDropped.slice(0, 12)) {
    console.log(`    tick ${String(r.tick).padStart(3)}  ${seqName(r.anim)}  level ${r.level}  sw-distance ${r.dist}`);
}

const maxDist = Math.max(...rows.filter(r => r.level === 0).map(r => r.dist));
console.log(`\nfurthest the player ever stood from Zulrah's south-west tile: ${maxDist}`);
console.log(`ticks visible: ${rows.filter(r => r.seen).length} / ${rows.length}`);
process.exit(0);
