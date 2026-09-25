// Hunter's catches as weapons, herb tar, and the black warlock (content skill_hunter/scripts/
// hunter_salamander.rs2, hunter_chinchompa.rs2, hunter_tar.rs2, hunter_warlock.rs2), on the real engine:
//
//   salamanders   wield needs Attack, Ranged and Magic; each style (Scorch, Flare, Blaze) burns one of the
//                 salamander's own tar an attack, swings at its own speed (5, 4, 5) and trains its own
//                 skill - Strength 4, Ranged 4, Magic 2 xp a damage, Hitpoints 1.33 - and no other;
//                 the wrong tar will not do; Blaze stays under floor(0.5 + Magic * (64 + 92) / 640)
//   chinchompas   one thrown per attack, never dropped; in multi-combat the 3x3 round the target is hit
//                 (on the same tick), not what cannot be attacked; in single combat only the target;
//                 a missed accuracy roll misses the whole group; the fuse table; Medium fuse is quicker;
//                 at players, the same splash in multi and none in single
//   herb tar      15 swamp tar + a guam leaf + a pestle and mortar -> 15 guam tar and 30 xp, Herblore 19
//   black warlock seven on the Feldip hunting grounds; netted at 45 (not 44) for 54 xp into a jar;
//                 released for Strength + 4 + 15%
import * as H from './harness.ts';
import World from '#/engine/World.js';
import InvType from '#/cache/config/InvType.js';
import ObjType from '#/cache/config/ObjType.js';
import NpcType from '#/cache/config/NpcType.js';
import SeqType from '#/cache/config/SeqType.js';
import Component from '#/cache/config/Component.js';
import ScriptProvider from '#/engine/script/ScriptProvider.js';
import ScriptRunner from '#/engine/script/ScriptRunner.js';
import ServerTriggerType from '#/engine/script/ServerTriggerType.js';
import { Interaction } from '#/engine/entity/Interaction.js';
import { CoordGrid } from '#/engine/CoordGrid.js';
import { NpcMode } from '#/engine/entity/NpcMode.js';

await H.boot();
H.loginOrder();
// every hit an npc takes, by the npc itself rather than by its type's name (the harness's npcHits)
const byNpc = new Map<number, number[]>();
{
    const Npc = (await import('#/engine/entity/Npc.js')).default;
    const orig = (Npc.prototype as any).applyDamage;
    (Npc.prototype as any).applyDamage = function (damage: number, type: number) {
        const l = byNpc.get(this.nid) ?? []; l.push(Math.min(damage, this.levels[3])); byNpc.set(this.nid, l);
        return orig.call(this, damage, type);
    };
}
let ok = 0, bad = 0, n = 0;
const check = (what: string, got: unknown, want: unknown) => {
    const pass = JSON.stringify(got) === JSON.stringify(want);
    pass ? ok++ : bad++;
    console.log(`  ${pass ? 'ok  ' : 'FAIL'} ${what}: ${JSON.stringify(got)}${pass ? '' : `   (want ${JSON.stringify(want)})`}`);
};
const ATT = 0, DEF = 1, STR = 2, HP = 3, RNG = 4, MAG = 6, HERB = 15, HUNT = 22;
const fresh = (x: number, z: number) => {
    const p: any = H.makePlayer('hg' + n, x, z, 60 + n); n++;
    H.tick(2); H.maxOut(p); H.clearInv(p); H.setVar(p, 'tutorial', 1000); H.tick(1);
    return p;
};
const worn = (p: any, slot: number) => { const o = p.getInventory(InvType.WORN)!.get(slot); return o ? { name: ObjType.get(o.id).debugname, count: o.count } : null; };
const multi = (x: number, z: number) => World.gameMap.isMulti(CoordGrid.packCoord(0, x, z));
// a monster that will not die or wander off mid-test
const dummy = (name: string, x: number, z: number, hp = 250) => {
    const npc: any = H.addNpc(name, x, z);
    npc.baseLevels[HP] = hp; npc.levels[HP] = hp;
    npc.targetOp = NpcMode.NONE; // stands still until it is attacked
    return npc;
};
const setStyle = (p: any, mode: number) => { H.setVar(p, 'com_mode', mode); H.runProc(p, '[proc,player_combat_stat]'); };
const stopAll = (p: any) => { p.clearPendingAction?.(); p.clearInteraction?.(); };

// ------------------------------------------------------------------------------ salamanders
console.log('SALAMANDERS');
{
    const p = fresh(3222, 3218);
    for (const s of [ATT, RNG, MAG]) p.setLevel(s, 69);
    H.give(p, 'black_salamander');
    H.opheld(p, 'black_salamander', 2);
    H.tick(1);
    check('a black salamander refused at 69 Attack/Ranged/Magic', worn(p, 3), null);
    check('  and it says which', H.mesgs.filter(m => m.who === p.username).map(m => m.text).slice(-4),
        ['You are not a high enough level to use this item.', 'You need to have an Attack level of 70.', 'You need to have a Ranged level of 70.', 'You need to have a Magic level of 70.']);
    H.maxOut(p);
    H.opheld(p, 'black_salamander', 2);
    H.tick(1);
    check('wielded at 70+', worn(p, 3)?.name, 'black_salamander');
    check('  in both hands (the shield slot is its too)', ObjType.get(ObjType.getId('black_salamander')).wearpos2, 5);
    const labels = H.ifaces.filter(i => i.who === p.username && i.kind === 'text' && [25, 26, 27].map(c => Component.getId(`combat_thrown:com_${c}`)).includes(i.com)).map(i => i.text);
    check('  the combat tab reads Scorch, Flare, Blaze', labels.slice(-3), ['Scorch', 'Flare', 'Blaze']);
    H.despawn(p);
}
const STYLES = [
    { mode: 0, name: 'Scorch', skill: STR, per: 40, rate: 5, sound: 'salamander_flame' },
    { mode: 1, name: 'Flare', skill: RNG, per: 40, rate: 4, sound: 'salamander_blaze' },
    { mode: 2, name: 'Blaze', skill: MAG, per: 20, rate: 5, sound: 'salamander_scorch' }
];
for (const st of STYLES) {
    H.clearLogs();
    const p = fresh(3222 + n * 4, 3230);
    H.equip(p, { rhand: 'black_salamander', quiver: 'harralander_tar' });
    p.invSet(InvType.WORN, ObjType.getId('harralander_tar'), 100, 13);
    setStyle(p, st.mode);
    const npc = dummy('mossgiant', p.x + 1, p.z);
    const xp0 = [...p.stats];
    H.tick(1);
    H.attackNpc(p, npc);
    const swings: number[] = [];
    const attackSeq = SeqType.getId('osrs_salamander_attack');
    for (let t = 0; t < 26; t++) {
        H.tick(1);
        if (!p.target && !p.delayed) H.attackNpc(p, npc);
    }
    for (let t = 0; t < 6; t++) { stopAll(p); H.tick(1); } // stop, and let the last attack's hit land
    for (const a of H.anims) if (a.who === p.username && a.seq === attackSeq) swings.push(a.tick);
    const dealt = (byNpc.get(npc.nid) ?? []).reduce((a, h) => a + h, 0);
    const tar = worn(p, 13)?.count ?? 0;
    const gained = (s: number) => p.stats[s] - xp0[s];
    check(`${st.name}: attacks every ${st.rate} ticks`, [...new Set(swings.slice(1).map((t, i) => t - swings[i]))], [st.rate]);
    check(`${st.name}: one harralander tar an attack`, 100 - tar, swings.length);
    check(`${st.name}: ${[, , 'Strength', , 'Ranged', , 'Magic'][st.skill]} xp is ${st.per / 10} a damage (dealt ${dealt})`, gained(st.skill), st.per * dealt);
    check(`${st.name}: and no other combat skill but Hitpoints`, [ATT, DEF, STR, RNG, MAG].filter(s => s !== st.skill && gained(s) !== 0), []);
    check(`${st.name}: Hitpoints 1.33 a damage`, gained(HP), (byNpc.get(npc.nid) ?? []).reduce((a, d) => a + Math.floor(133 * d * 10 / 100), 0));
    check(`${st.name}: its own sound`, H.sounds.some(s => s.who === p.username && s.synth === st.sound), true);
    if (st.mode === 2) {
        const most = Math.max(...(byNpc.get(npc.nid) ?? []));
        check('Blaze never beats floor(0.5 + 99 * (64 + 92) / 640) = 24', most <= 24, true);
    }
    H.despawn(p);
}
{
    H.clearLogs();
    const p = fresh(3240, 3230);
    H.equip(p, { rhand: 'black_salamander' });
    p.invSet(InvType.WORN, ObjType.getId('guam_tar'), 10, 13);
    setStyle(p, 0);
    const npc = dummy('mossgiant', p.x + 1, p.z);
    H.tick(1);
    H.attackNpc(p, npc);
    H.tick(6);
    check('guam tar will not feed a black salamander', [worn(p, 13)?.count, H.mesgs.some(m => m.who === p.username && m.text === "You can't use that ammo with your salamander.")], [10, true]);
    H.despawn(p);
}

{
    // at a player, in the wilderness: Blaze burns tar and trains Magic there too
    H.clearLogs();
    const a = fresh(3100, 3770), b = fresh(3101, 3770);
    H.equip(a, { rhand: 'red_salamander' });
    a.invSet(InvType.WORN, ObjType.getId('tarromin_tar'), 30, 13);
    setStyle(a, 2);
    const xp0 = a.stats[MAG];
    H.tick(1);
    H.attack(a, b);
    for (let t = 0; t < 12; t++) { H.tick(1); if (!a.target && !a.delayed) H.attack(a, b); }
    stopAll(a); H.tick(3);
    const swings = H.anims.filter(x => x.who === a.username && x.seq === SeqType.getId('osrs_salamander_attack')).length;
    const perHit = H.hits.filter(h => h.who === b.username).map(h => h.damage);
    check('PvP Blaze: a tarromin tar a swing', [swings > 1, 30 - (worn(a, 13)?.count ?? 0)], [true, swings]);
    check('PvP Blaze: Magic xp 2 a damage (times the PvP bonus, 1.125 at these levels)', a.stats[MAG] - xp0, perHit.reduce((t, d) => t + Math.floor(1125 * (20 * d) / 1000), 0));
    H.despawn(a, b);
}

// ------------------------------------------------------------------------------ chinchompas
console.log('CHINCHOMPAS');
{
    const p = fresh(3222, 3240);
    const fuse = (style: number, d: number) => { H.setVar(p, 'damagestyle', style); return H.runProc(p, '[proc,chinchompa_fuse_pct]', [d])[0]; };
    const row = (style: number) => [1, 3, 4, 6, 7, 9].map(d => fuse(style, d));
    check('Short fuse at 1,3,4,6,7,9 tiles', row(4), [100, 100, 75, 75, 50, 50]);
    check('Medium fuse', row(5), [75, 75, 100, 100, 75, 75]);
    check('Long fuse', row(6), [50, 50, 75, 75, 100, 100]);
    H.despawn(p);
}
// a 3x3 of npcs at 5 tiles: the target in the middle, two attackable neighbours, a butterfly (no Attack)
// and one attackable npc just outside the 3x3
function throwAt(x: number, z: number, opts: { defence?: number; style?: number } = {}) {
    H.clearLogs();
    const p = fresh(x, z);
    H.equip(p, { rhand: 'chinchompa' });
    p.invSet(InvType.WORN, ObjType.getId('chinchompa'), 50, 3);
    setStyle(p, opts.style ?? 0);
    const tx = x + 5, tz = z;
    const target = dummy('man', tx, tz);
    const side = [dummy('cow', tx, tz + 1), dummy('cow', tx + 1, tz - 1)];
    const moth: any = H.addNpc('butterfly', tx - 1, tz);
    moth.targetOp = NpcMode.NONE;
    const far = dummy('cow', tx + 2, tz);
    if (opts.defence) for (const t of [target, ...side]) { t.baseLevels[DEF] = opts.defence; t.levels[DEF] = opts.defence; }
    H.tick(1);
    H.attackNpc(p, target);
    let t0 = -1;
    for (let t = 0; t < 12 && t0 < 0; t++) {
        H.tick(1);
        if (H.anims.some(a => a.who === p.username && a.seq === SeqType.getId('human_chinchompa_attack'))) t0 = World.currentTick;
    }
    stopAll(p);
    H.tick(6);
    // hits by the npc itself (byNpc), each with the tick it landed on (the harness's npcHits)
    const ticksOf = (npc: any) => H.npcHits.filter(h => h.tick >= t0 && h.who === NpcType.get(npc.type).debugname).map(h => h.tick);
    const res = {
        thrown: 50 - (worn(p, 3)?.count ?? 0),
        targetHits: byNpc.get(target.nid) ?? [],
        sideHits: side.map(s => byNpc.get(s.nid) ?? []),
        landed: [...new Set([...ticksOf(target), ...side.flatMap(ticksOf)])],
        mothHit: (byNpc.get(moth.nid) ?? []).length > 0,
        farHit: (byNpc.get(far.nid) ?? []).length > 0
    };
    for (const e of [target, ...side, moth, far]) World.removeNpc(e, 0);
    H.despawn(p);
    return res;
}
{
    // scorpion valley, multi-combat
    const X = 3212, Z = 3918;
    check('the multi test ground is multi-combat', [multi(X, Z), multi(X + 6, Z)], [true, true]);
    const r = throwAt(X, Z);
    check('multi: one chinchompa thrown', r.thrown, 1);
    check('multi: the target is hit once', r.targetHits.length, 1);
    check('multi: both attackable neighbours in the 3x3 are hit once each', r.sideHits.map(h => h.length), [1, 1]);
    check('multi: all on the same tick', r.landed.length, 1);
    check('multi: not the butterfly (no Attack op), not the cow outside the 3x3', [r.mothHit, r.farHit], [false, false]);
    const m = throwAt(X, Z, { defence: 60000 });
    check('multi: a missed roll on the target misses the whole group', [...m.targetHits, ...m.sideHits.flat()], [0, 0, 0]);
}
{
    const X = 3222, Z = 3250;
    check('the single test ground is single-combat', [multi(X, Z), multi(X + 6, Z)], [false, false]);
    const r = throwAt(X, Z);
    check('single: one thrown, the target hit', [r.thrown, r.targetHits.length], [1, 1]);
    check('single: nothing else is', [r.sideHits.flat().length, r.mothHit, r.farHit], [0, false, false]);
}
{
    // fuse speeds: Short 4, Medium 3
    for (const [style, rate] of [[0, 4], [1, 3]]) {
        H.clearLogs();
        const p = fresh(3222 + style * 10, 3260);
        H.equip(p, { rhand: 'red_chinchompa' });
        p.invSet(InvType.WORN, ObjType.getId('red_chinchompa'), 50, 3);
        setStyle(p, style);
        const npc = dummy('mossgiant', p.x + 4, p.z, 2000);
        H.tick(1);
        H.attackNpc(p, npc);
        for (let t = 0; t < 20; t++) { H.tick(1); if (!p.target && !p.delayed) H.attackNpc(p, npc); }
        const ts = H.anims.filter(a => a.who === p.username && a.seq === SeqType.getId('human_chinchompa_attack')).map(a => a.tick);
        check(`${style ? 'Medium' : 'Short'} fuse throws every ${rate} ticks`, [...new Set(ts.slice(1).map((t, i) => t - ts[i]))], [rate]);
        check('  one red chinchompa a throw, none left on the ground', 50 - (worn(p, 3)?.count ?? 0), ts.length);
        H.despawn(p);
    }
}
{
    // at players, in the wilderness: multi splashes onto the player beside the target, single does not
    for (const [X, Z, isMulti] of [[3212, 3930, true], [3100, 3760, false]] as [number, number, boolean][]) {
        H.clearLogs();
        check(`the wilderness at ${X},${Z} is ${isMulti ? 'multi' : 'single'}-combat`, multi(X + 4, Z), isMulti);
        const a = fresh(X, Z), b = fresh(X + 4, Z), c = fresh(X + 4, Z + 1);
        H.equip(a, { rhand: 'chinchompa' });
        a.invSet(InvType.WORN, ObjType.getId('chinchompa'), 20, 3);
        for (const q of [b, c]) { q.baseLevels[DEF] = 1; q.levels[DEF] = 1; H.runProc(q, '[proc,player_combat_stat]'); }
        setStyle(a, 0);
        H.tick(1);
        H.attack(a, b);
        let t0 = -1;
        for (let t = 0; t < 12 && t0 < 0; t++) { H.tick(1); if (H.anims.some(x => x.who === a.username && x.seq === SeqType.getId('human_chinchompa_attack'))) t0 = World.currentTick; }
        stopAll(a);
        H.tick(6);
        const first = (h: any) => t0 >= 0 && h.tick >= t0 && h.tick <= t0 + 3;
        const hb = H.hits.filter(h => h.who === b.username && first(h)), hc = H.hits.filter(h => h.who === c.username && first(h));
        check(`${isMulti ? 'multi' : 'single'}: the target player takes the throw`, hb.length, 1);
        check(`${isMulti ? 'multi' : 'single'}: the player beside them ${isMulti ? 'is' : 'is not'} caught in it`, hc.length, isMulti ? 1 : 0);
        H.despawn(a, b, c);
    }
}

// ------------------------------------------------------------------------------ herb tar
console.log('HERB TAR');
{
    const p = fresh(3222, 3270);
    H.setVar(p, 'druidquest', 4);
    const useTarOnHerb = () => {
        const inv = p.getInventory(InvType.INV)!;
        const slotOf = (nm: string) => { for (let i = 0; i < inv.capacity; i++) if (inv.get(i)?.id === ObjType.getId(nm)) return i; return -1; };
        p.lastItem = ObjType.getId('swamp_tar'); p.lastSlot = slotOf('swamp_tar');
        p.lastUseItem = ObjType.getId('guam_leaf'); p.lastUseSlot = slotOf('guam_leaf');
        const script = ScriptProvider.getByTriggerSpecific(ServerTriggerType.OPHELDU, ObjType.getId('swamp_tar'), -1)!;
        p.executeScript(ScriptRunner.init(script, p), true);
    };
    H.give(p, 'pestle_and_mortar'); H.give(p, 'guam_leaf'); H.give(p, 'swamp_tar', 20);
    p.setLevel(HERB, 18);
    useTarOnHerb(); H.tick(3);
    check('Herblore 18: no guam tar', H.invCount(p, 'guam_tar'), 0);
    p.setLevel(HERB, 19);
    const xp0 = p.stats[HERB];
    useTarOnHerb(); H.tick(3);
    check('Herblore 19: 15 guam tar from 15 swamp tar and the leaf', [H.invCount(p, 'guam_tar'), H.invCount(p, 'swamp_tar'), H.invCount(p, 'guam_leaf')], [15, 5, 0]);
    check('  for 30 Herblore xp', p.stats[HERB] - xp0, 300);
    H.despawn(p);
}

// ------------------------------------------------------------------------------ black warlock
console.log('BLACK WARLOCK');
{
    const id = NpcType.getId('hunter_black_warlock');
    const all: any[] = []; for (const npc of World.npcs) if (npc && npc.type === id) all.push(npc);
    check('seven black warlocks on the Feldip hunting grounds', all.map(w => `${w.startX},${w.startZ}`).sort(),
        ['2532,2905', '2540,2898', '2540,2914', '2550,2893', '2551,2915', '2563,2920', '2566,2886'].sort());
    const w = all[0];
    const p = fresh(w.x, w.z - 1);
    H.give(p, 'net'); H.give(p, 'hunter_butterfly_jar');
    const net = () => {
        const inv = p.getInventory(InvType.INV)!;
        let slot = -1; for (let i = 0; i < inv.capacity; i++) if (inv.get(i)?.id === ObjType.getId('net')) slot = i;
        p.clearPendingAction();
        p.lastUseItem = ObjType.getId('net'); p.lastUseSlot = slot;
        p.setInteraction(Interaction.ENGINE, w, ServerTriggerType.APNPCU);
        p.opcalled = true;
    };
    p.setLevel(HUNT, 44);
    const refused = () => H.mesgs.some(m => m.who === p.username && /Hunter level of 45/.test(m.text)) || H.ifaces.some(i => i.who === p.username && /Hunter level of 45/.test(i.text ?? ''));
    for (let i = 0; i < 40 && !refused(); i++) { if (!p.target && !p.delayed) net(); H.tick(1); }
    check('Hunter 44: refused', [H.invCount(p, 'black_warlock'), refused()], [0, true]);
    p.closeModal?.();
    p.setLevel(HUNT, 45);
    const xp0 = p.stats[HUNT];
    for (let i = 0; i < 200 && H.invCount(p, 'black_warlock') === 0; i++) {
        if (!w.isActive) break;
        if (!p.target && !p.delayed) net();
        H.tick(1);
    }
    check('Hunter 45: netted into the jar', [H.invCount(p, 'black_warlock'), H.invCount(p, 'hunter_butterfly_jar')], [1, 0]);
    check('  for 54 Hunter xp (and the Guild hunter roll takes nothing from it)', p.stats[HUNT] - xp0 >= 540, true);
    H.tick(4);
    const str = p.levels[STR];
    H.opheld(p, 'black_warlock', 4);
    H.tick(1);
    check('released: the jar back and Strength + 4 + 15%', [H.invCount(p, 'hunter_butterfly_jar'), p.levels[STR] - str], [1, 4 + Math.floor(99 * 15 / 100)]);
    H.despawn(p);
}

console.log(`\n${ok} ok, ${bad} FAIL`);
process.exit(bad ? 1 : 0);
