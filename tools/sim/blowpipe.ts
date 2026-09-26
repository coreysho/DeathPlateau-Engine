// The toxic blowpipe and venom (content toxic_blowpipe/scripts/blowpipe.rs2, blowpipe_combat.rs2,
// venom.rs2), on the real engine - run with `npx tsx tools/sim/blowpipe.ts`:
//
//   fletching    chisel + tanzanite fang -> empty blowpipe at 53 Fletching (not 52), 120 xp, either way round
//   dismantle    a fang or an empty blowpipe -> 20,000 Zulrah's scales
//   darts        each of bronze..rune loads (swapping out the kind inside); a poisoned dart is refused
//                with the refusal message and a knife is "Nothing interesting"; 16,383 at most
//   scales       16,383 at most; Uncharge gives both back and leaves it empty; Unload the darts only
//   wield        75 Ranged, not 74; the empty one has no Wield
//   max hit      +20 and the loaded dart's own ranged strength, by the combat formula, for all seven
//   speed        3 ticks (2 Rapid) at a monster, 4 (3 Rapid) at a player; no scales / no darts, no shot
//   spending     2 scales in 3 shots and a dart a shot over hundreds of shots; a Ranging cape (this
//                build's Ava's accumulator) keeps 72% of the darts; out of both, it turns empty in hand
//   venom        a quarter of the damaging hits envenom; 6, 8, ... 20 every 30 ticks; OSRS's immune
//                bosses are poisoned instead or left alone; on a player, antipoison turns it to poison,
//                a strange fruit cures it, and it survives a logout
//   special      50% energy; heals half the rolled hit; up to 1.5x the max hit; no specials in a duel
//                that turned them off, and no blowpipe in a no-ranged duel
//   relog        the scales, darts and dart kind survive a save and load
//   pvp          it fights in the Wilderness, hits and envenoms another player
import * as H from './harness.ts';
import * as A from './a1lib.ts';
import World from '#/engine/World.js';
import InvType from '#/cache/config/InvType.js';
import ObjType from '#/cache/config/ObjType.js';
import SeqType from '#/cache/config/SeqType.js';
import VarPlayerType from '#/cache/config/VarPlayerType.js';
import { NpcMode } from '#/engine/entity/NpcMode.js';
import { PlayerLoading } from '#/engine/entity/PlayerLoading.js';
import Packet from '#/io/Packet.js';
import ScriptProvider from '#/engine/script/ScriptProvider.js';

await H.boot();
H.loginOrder();
let ok = 0, bad = 0, n = 0;
const check = (what: string, got: unknown, want: unknown) => {
    const pass = JSON.stringify(got) === JSON.stringify(want);
    pass ? ok++ : bad++;
    console.log(`  ${pass ? 'ok  ' : 'FAIL'} ${what}: ${JSON.stringify(got)}${pass ? '' : `   (want ${JSON.stringify(want)})`}`);
};
const HP = 3, RNG = 4, FLETCH = 9;
const MAX = 16383;
const fresh = (x = 3222 + (n % 8) * 4, z = 3218 + Math.floor(n / 8) * 4) => {
    const p: any = H.makePlayer('bp' + n, x, z, 90 + n); n++;
    H.tick(2); H.maxOut(p); H.clearInv(p); H.setVar(p, 'tutorial', 1000); noRandoms(p); H.tick(1);
    return p;
};
// A random event arriving in the middle of a 1,200-tick fight takes the player away and the count with
// them (seen once in about ten runs), so the sim's players are left out of them.
const noRandoms = (p: any) => { const t = ScriptProvider.getByName('[timer,general_macro_events]'); if (t) p.clearTimer(t.id); };
const mes = (p: any) => H.mesgs.filter(m => m.who === p.username).map(m => m.text);
const lastMes = (p: any) => mes(p).slice(-1)[0];
const worn = (p: any, slot: number) => { const o = p.getInventory(InvType.WORN)!.get(slot); return o ? ObjType.get(o.id).debugname : null; };
const v = (p: any, name: string) => H.getVar(p, name);
const dartType = (p: any) => { const id = v(p, 'blowpipe_dart_type'); return id >= 0 ? ObjType.get(id).debugname : null; };
const setStyle = (p: any, mode: number) => { H.setVar(p, 'com_mode', mode); H.runProc(p, '[proc,player_combat_stat]'); };
const charge = (p: any, scales: number, darts: number, dart = 'rune_dart') => {
    H.setVar(p, 'blowpipe_scales', scales);
    H.setVar(p, 'blowpipe_darts', darts);
    H.setVar(p, 'blowpipe_dart_type', ObjType.getId(dart));
};
const dummy = (name: string, x: number, z: number, hp = 30000) => {
    const npc: any = H.addNpc(name, x, z);
    npc.baseLevels[HP] = hp; npc.levels[HP] = hp;
    npc.targetOp = NpcMode.NONE;
    return npc;
};
const setNpcVarRaw = (npc: any, name: string, value: number) => H.setNpcVar(npc, name, value);
const npcVar = (npc: any, name: string) => {
    const VarNpcType = (globalThis as any).__varn;
    return npc.getVar(VarNpcType.getByName(name).id);
};
(globalThis as any).__varn = (await import('#/cache/config/VarNpcType.js')).default;
const ATTACK = SeqType.getId('osrs_blowpipe_attack');
const shotsOf = (p: any, from = 0) => H.anims.slice(from).filter(a => a.who === p.username && a.seq === ATTACK).map(a => a.tick);
const gaps = (ts: number[]) => [...new Set(ts.slice(1).map((t, i) => t - ts[i]))];
const topUp = (...ps: any[]) => { for (const p of ps) p.levels[HP] = p.baseLevels[HP]; };

// ------------------------------------------------------------------------------ fletching
console.log('FLETCHING THE FANG');
{
    const p = fresh();
    p.setLevel(FLETCH, 52);
    H.give(p, 'chisel'); H.give(p, 'tanzanite_fang');
    A.useHeld(p, 'chisel', 'tanzanite_fang');
    check('refused at 52 Fletching', [H.invCount(p, 'tanzanite_fang'), H.invCount(p, 'toxic_blowpipe_empty')], [1, 0]);
    p.setLevel(FLETCH, 53);
    const xp0 = p.stats[FLETCH];
    A.useHeld(p, 'chisel', 'tanzanite_fang');
    check('chisel on fang at 53: an empty blowpipe', [H.invCount(p, 'tanzanite_fang'), H.invCount(p, 'toxic_blowpipe_empty')], [0, 1]);
    check('  120 Fletching xp', (p.stats[FLETCH] - xp0) / 10, 120);
    H.give(p, 'tanzanite_fang');
    A.useHeld(p, 'tanzanite_fang', 'chisel');
    check('fang on chisel works too', H.invCount(p, 'toxic_blowpipe_empty'), 2);
    check('  the chisel is kept', H.invCount(p, 'chisel'), 1);
    H.despawn(p);
}

console.log('DISMANTLE');
{
    const p = fresh();
    H.give(p, 'tanzanite_fang'); H.give(p, 'toxic_blowpipe_empty');
    A.held(p, 'tanzanite_fang', 4, ['Keep']);
    check('Keep it: the fang stays', H.invCount(p, 'tanzanite_fang'), 1);
    A.held(p, 'tanzanite_fang', 4, ['Dismantle']);
    check('a fang dismantles into 20,000 scales', [H.invCount(p, 'tanzanite_fang'), H.invCount(p, 'zulrahs_scales')], [0, 20000]);
    A.held(p, 'toxic_blowpipe_empty', 4, ['Dismantle']);
    check('so does an empty blowpipe', [H.invCount(p, 'toxic_blowpipe_empty'), H.invCount(p, 'zulrahs_scales')], [0, 40000]);
    H.despawn(p);
}

// ------------------------------------------------------------------------------ charging
console.log('LOADING DARTS AND SCALES');
{
    const p = fresh();
    H.give(p, 'toxic_blowpipe_empty');
    const DARTS = ['bronze_dart', 'iron_dart', 'steel_dart', 'black_dart', 'mithril_dart', 'adamant_dart', 'rune_dart'];
    let first = true;
    for (const d of DARTS) {
        H.give(p, d, 100);
        A.useHeld(p, d, first ? 'toxic_blowpipe_empty' : 'toxic_blowpipe');
        check(`${d}: loads 100`, [dartType(p), v(p, 'blowpipe_darts'), H.invCount(p, d)], [d, 100, 0]);
        if (first) check('  and the empty blowpipe is the charged one now', [H.invCount(p, 'toxic_blowpipe_empty'), H.invCount(p, 'toxic_blowpipe')], [0, 1]);
        else check('  the kind that was in it came back out', H.invCount(p, DARTS[DARTS.indexOf(d) - 1]), 100);
        first = false;
    }
    H.give(p, 'rune_dart_p', 50);
    A.useHeld(p, 'rune_dart_p', 'toxic_blowpipe');
    check('a poisoned rune dart is refused', [dartType(p), v(p, 'blowpipe_darts'), H.invCount(p, 'rune_dart_p'), lastMes(p)], ['rune_dart', 100, 50, "Your blowpipe can't use that kind of dart."]);
    H.give(p, 'rune_knife', 5);
    A.useHeld(p, 'rune_knife', 'toxic_blowpipe');
    check('a knife is nothing interesting', lastMes(p), 'Nothing interesting happens.');
    H.give(p, 'rune_dart', 20000);
    A.useHeld(p, 'rune_dart', 'toxic_blowpipe');
    check('20,000 rune darts: it takes 16,383', [v(p, 'blowpipe_darts'), H.invCount(p, 'rune_dart')], [MAX, 20100 - MAX]);
    A.useHeld(p, 'rune_dart', 'toxic_blowpipe');
    check('  and no more', [v(p, 'blowpipe_darts'), lastMes(p)], [MAX, "Your blowpipe can't hold any more darts."]);
    H.give(p, 'zulrahs_scales', 20000);
    A.useHeld(p, 'zulrahs_scales', 'toxic_blowpipe');
    check('20,000 scales: it takes 16,383', [v(p, 'blowpipe_scales'), H.invCount(p, 'zulrahs_scales')], [MAX, 20000 - MAX]);
    A.useHeld(p, 'zulrahs_scales', 'toxic_blowpipe');
    check('  and no more', [v(p, 'blowpipe_scales'), lastMes(p)], [MAX, "Your blowpipe can't hold any more scales."]);
    A.held(p, 'toxic_blowpipe', 3);
    check('Check', lastMes(p), 'Darts: Rune dart x 16,383. Scales: 16,383 (100.0%).');
    H.setVar(p, 'blowpipe_scales', 2345);
    A.held(p, 'toxic_blowpipe', 3);
    check('  a part charge', lastMes(p), 'Darts: Rune dart x 16,383. Scales: 2,345 (14.3%).');
    const runes = H.invCount(p, 'rune_dart');
    A.held(p, 'toxic_blowpipe', 4);
    check('Unload: the darts come out, the scales stay', [v(p, 'blowpipe_darts'), H.invCount(p, 'rune_dart') - runes, v(p, 'blowpipe_scales'), H.invCount(p, 'toxic_blowpipe')], [0, MAX, 2345, 1]);
    A.held(p, 'toxic_blowpipe', 3);
    check('  Check with no darts', lastMes(p), 'Darts: None. Scales: 2,345 (14.3%).');
    H.give(p, 'mithril_dart', 10);
    A.useHeld(p, 'mithril_dart', 'toxic_blowpipe');
    const scales = H.invCount(p, 'zulrahs_scales');
    A.held(p, 'toxic_blowpipe', 5, ['Keep']);
    check('Uncharge, Keep it: nothing moves', [v(p, 'blowpipe_scales'), v(p, 'blowpipe_darts')], [2345, 110]);
    A.held(p, 'toxic_blowpipe', 5, ['Uncharge']);
    check('Uncharge: scales and darts both come back, and it is empty', [H.invCount(p, 'zulrahs_scales') - scales, H.invCount(p, 'mithril_dart'), v(p, 'blowpipe_scales'), v(p, 'blowpipe_darts'), H.invCount(p, 'toxic_blowpipe_empty')], [2345, 110, 0, 0, 1]);
    check('  the empty one has no Wield', ObjType.get(ObjType.getId('toxic_blowpipe_empty')).iop[1], null);
    // a second blowpipe cannot share the first one's contents
    A.useHeld(p, 'zulrahs_scales', 'toxic_blowpipe_empty');
    H.give(p, 'toxic_blowpipe_empty'); H.give(p, 'zulrahs_scales', 10);
    A.useHeld(p, 'zulrahs_scales', 'toxic_blowpipe_empty');
    check('a second empty blowpipe will not take the charged one\'s contents', [H.invCount(p, 'toxic_blowpipe'), H.invCount(p, 'toxic_blowpipe_empty'), lastMes(p)], [1, 1, 'You already have a charged blowpipe. Uncharge it before charging another.']);
    H.despawn(p);
}

// ------------------------------------------------------------------------------ wield + max hit
console.log('WIELD AND MAX HIT');
{
    const p = fresh();
    p.baseLevels[RNG] = 74; p.levels[RNG] = 74;
    charge(p, 1000, 100);
    H.give(p, 'toxic_blowpipe');
    H.opheld(p, 'toxic_blowpipe', 2);
    H.tick(1);
    check('refused at 74 Ranged', [worn(p, 3), mes(p).slice(-1)[0]], [null, 'You need to have a Ranged level of 75.']);
    H.maxOut(p);
    H.opheld(p, 'toxic_blowpipe', 2);
    H.tick(1);
    check('wielded at 75+, in both hands', [worn(p, 3), ObjType.get(ObjType.getId('toxic_blowpipe')).wearpos2], ['toxic_blowpipe', 5]);
    setStyle(p, 0);
    const DARTS: [string, number][] = [['bronze_dart', 1], ['iron_dart', 3], ['steel_dart', 4], ['black_dart', 6], ['mithril_dart', 7], ['adamant_dart', 10], ['rune_dart', 14]];
    const eff = 99 + 8 + 3; // 99 Ranged, +8, Accurate's +3, no prayer
    for (const [d, str] of DARTS) {
        charge(p, 1000, 100, d);
        H.runProc(p, '[proc,player_combat_stat]');
        const want = Math.floor((eff * (20 + str + 64) + 320) / 640);
        check(`${d} (+${str}): max hit ${want}`, v(p, 'com_maxhit'), want);
    }
    charge(p, 1000, 0, 'rune_dart');
    H.runProc(p, '[proc,player_combat_stat]');
    check('no darts loaded: the blowpipe\'s +20 alone', v(p, 'com_maxhit'), Math.floor((eff * (20 + 64) + 320) / 640));
    H.despawn(p);
}

// ------------------------------------------------------------------------------ speed + spending
console.log('SPEED AND WHAT A SHOT COSTS');
const fightNpc = (p: any, npc: any, ticks: number, each?: (t: number) => void) => {
    H.attackNpc(p, npc);
    for (let t = 0; t < ticks; t++) {
        topUp(p);
        H.tick(1);
        if (each) each(t);
        if (!p.target && !p.delayed) H.attackNpc(p, npc);
    }
};
{
    const p = fresh(3090, 3300);
    charge(p, 5000, 5000);
    H.equip(p, { rhand: 'toxic_blowpipe' });
    for (const [mode, rate] of [[0, 3], [1, 2], [2, 3]]) {
        setStyle(p, mode);
        const npc = dummy('mossgiant', p.x + 3, p.z);
        const a0 = H.anims.length;
        fightNpc(p, npc, 20);
        p.clearInteraction(); H.tick(4);
        check(`${['Accurate', 'Rapid', 'Longrange'][mode]}: a shot every ${rate} ticks at a monster`, gaps(shotsOf(p, a0)), [rate]);
        World.removeNpc(npc, -1);
    }
    const reach = (mode: number) => { setStyle(p, mode); return H.runProc(p, '[proc,player_attackrange]', [ObjType.getId('toxic_blowpipe')])[0]; };
    check('reach 5, 7 on Longrange', [reach(0), reach(1), reach(2)], [5, 5, 7]);
    H.despawn(p);
}
{
    // hundreds of shots on Rapid: scales 2 in 3, darts one a shot, and a quarter of the hits envenom
    const p = fresh(3094, 3300);
    charge(p, 5000, 5000);
    H.equip(p, { rhand: 'toxic_blowpipe' });
    setStyle(p, 1);
    const npc = dummy('mossgiant', p.x + 3, p.z);
    const a0 = H.anims.length, h0 = H.npcHits.length;
    let venoms = 0;
    fightNpc(p, npc, 1200, () => {
        if (npcVar(npc, 'npc_venom') > 0) { venoms++; setNpcVarRaw(npc, 'npc_venom', 0); }
    });
    p.clearInteraction(); H.tick(6);
    const shots = shotsOf(p, a0).length;
    const usedScales = 5000 - v(p, 'blowpipe_scales'), usedDarts = 5000 - v(p, 'blowpipe_darts');
    const damaging = H.npcHits.slice(h0).filter(h => h.who === 'mossgiant' && h.type === 1 && h.damage > 0).length;
    console.log(`    ${shots} shots: ${usedScales} scales, ${usedDarts} darts; ${damaging} damaging hits, ${venoms} envenomed`);
    if (shots < 590) console.log('    DEBUG', p.x, p.z, npc.x, npc.z, npc.isActive, p.levels[HP], JSON.stringify(mes(p).slice(-6)), JSON.stringify(H.says.filter(s => s.tick > World.currentTick - 1300).slice(0, 5)));
    check('  ~600 shots in 1,200 ticks on Rapid', shots >= 590 && shots <= 601, true);
    check('  a dart every shot, none saved without a cape', usedDarts, shots);
    check('  two scales in three shots (within 4 sd)', Math.abs(usedScales - shots * 2 / 3) <= 4 * Math.sqrt(shots * 2 / 9), true);
    check('  a quarter of the damaging hits envenom (within 4 sd)', Math.abs(venoms - damaging / 4) <= 4 * Math.sqrt(damaging * 3 / 16), true);
    check('  no dart ever lands on the floor', World.getObj(npc.x, npc.z, 0, ObjType.getId('rune_dart'), p.hash64), null);
    // the Ranging cape keeps 72% of them
    H.equip(p, { back: 'ranging_cape' });
    charge(p, 5000, 5000);
    const a1 = H.anims.length;
    fightNpc(p, npc, 600);
    p.clearInteraction(); H.tick(4);
    const shots2 = shotsOf(p, a1).length, used2 = 5000 - v(p, 'blowpipe_darts');
    console.log(`    with a Ranging cape: ${shots2} shots, ${used2} darts`);
    check('  with a Ranging cape 28% of the darts are used (within 4 sd)', Math.abs(used2 - shots2 * 0.28) <= 4 * Math.sqrt(shots2 * 0.28 * 0.72), true);
    H.despawn(p);
}
{
    const p = fresh(3098, 3300);
    H.equip(p, { rhand: 'toxic_blowpipe' });
    setStyle(p, 0);
    const npc = dummy('mossgiant', p.x + 3, p.z);
    charge(p, 0, 100);
    let a0 = H.anims.length;
    fightNpc(p, npc, 6);
    check('no scales: no shot, OSRS\'s message', [shotsOf(p, a0).length, mes(p).includes("Your blowpipe needs to be charged with Zulrah's scales.")], [0, true]);
    charge(p, 100, 0);
    a0 = H.anims.length;
    fightNpc(p, npc, 6);
    check('no darts: no shot', [shotsOf(p, a0).length, lastMes(p)], [0, 'Your blowpipe contains no darts.']);
    // the last dart: it stops, says so, and a blowpipe with nothing left in it turns empty in the hands
    charge(p, 100, 1);
    a0 = H.anims.length;
    fightNpc(p, npc, 8);
    check('the last dart goes, then it stops', [shotsOf(p, a0).length, v(p, 'blowpipe_darts'), mes(p).includes('Your blowpipe has run out of scales and darts.')], [1, 0, true]);
    check('  still charged while scales are in it', worn(p, 3), 'toxic_blowpipe');
    H.setVar(p, 'blowpipe_scales', 0);
    H.runProc(p, '[proc,blowpipe_sync]', [InvType.WORN, 3]);
    check('  with nothing in it, the empty one stays in the hands', worn(p, 3), 'toxic_blowpipe_empty');
    H.despawn(p);
}

// ------------------------------------------------------------------------------ venom
console.log('VENOM');
{
    const host = fresh(3102, 3296); // the attacker a monster is envenomed by
    const npc = dummy('mossgiant', 3102, 3300);
    H.runNpcProc(npc, '[proc,npc_venom_start]', host);
    const h0 = H.npcHits.length;
    for (let i = 0; i < 30 * 10 + 2; i++) H.tick(1);
    const venomHits = H.npcHits.slice(h0).filter(h => h.who === 'mossgiant' && h.type === 2).map(h => h.damage);
    check('a monster: 6, 8, ... 20, then 20, one every 30 ticks', venomHits, [6, 8, 10, 12, 14, 16, 18, 20, 20, 20]);
    H.setNpcVar(npc, 'npc_venom', 0);
    World.removeNpc(npc, -1);
    const kraken = dummy('kraken', 3106, 3300);
    H.runNpcProc(kraken, '[proc,npc_venom_start]', host);
    check('the Kraken (immune to venom) is poisoned instead, at 6 a hit', [npcVar(kraken, 'npc_venom'), npcVar(kraken, 'npc_poison')], [0, 26]);
    const graardor = dummy('graardor', 3110, 3300);
    H.runNpcProc(graardor, '[proc,npc_venom_start]', host);
    check('General Graardor (immune to both) takes neither', [npcVar(graardor, 'npc_venom'), npcVar(graardor, 'npc_poison')], [0, 0]);
    for (const x of [kraken, graardor]) World.removeNpc(x, -1);
    H.despawn(host);

    const p = fresh();
    A.enqueue(p, '[queue,venom_player]', [0]);
    const hp0 = H.hits.length;
    H.tick(1);
    check('a player: envenomed at 6', [v(p, 'venom'), lastMes(p)], [6, 'You have been envenomed!']);
    for (let i = 0; i < 61; i++) { topUp(p); H.tick(1); }
    check('  hits 6 then 8, green', H.hits.slice(hp0).filter(h => h.who === p.username).map(h => [h.damage, h.type]), [[6, 2], [8, 2]]);
    H.give(p, '4doseantipoison');
    H.opheld(p, '4doseantipoison', 1);
    H.tick(1);
    check('  an antipoison turns it into a poison hitting 10 (5*10-4)', [v(p, 'venom'), v(p, 'poison')], [0, 46]);
    A.runProcProtected(p, '[proc,clear_poison]');
    A.enqueue(p, '[queue,venom_player]', [0]);
    H.tick(1);
    H.give(p, 'macro_triffidfruit');
    H.opheld(p, 'macro_triffidfruit', 1);
    H.tick(2);
    check('  a strange fruit cures it, and keeps it off for now', v(p, 'venom'), -1);
    A.enqueue(p, '[queue,venom_player]', [0]);
    H.tick(1);
    check('  so the next envenoming does not take', v(p, 'venom'), -1);
    H.despawn(p);
}

// ------------------------------------------------------------------------------ special
console.log('TOXIC SIPHON');
{
    const p = fresh(3090, 3300);
    charge(p, 5000, 5000);
    H.equip(p, { rhand: 'toxic_blowpipe' });
    setStyle(p, 0);
    const normalMax = v(p, 'com_maxhit');
    const specMax = Math.floor(normalMax * 3 / 2);
    const npc = dummy('mossgiant', p.x + 3, p.z);
    const specs: { heal: number; hit: number | null; energy: number }[] = [];
    H.setVar(p, 'sa_energy', 1000); H.setVar(p, 'sa_attack', 1);
    H.attackNpc(p, npc);
    for (let t = 0; t < 400 && specs.length < 40; t++) {
        p.levels[HP] = 20;
        const e0 = v(p, 'sa_energy');
        const hitsBefore = H.hits.length;
        H.tick(1);
        if (v(p, 'sa_energy') < e0) {
            const taken = H.hits.slice(hitsBefore).filter(h => h.who === p.username).reduce((a, h) => a + h.damage, 0);
            const heal = p.levels[HP] - 20 + taken;
            const tick = World.currentTick;
            specs.push({ heal, hit: null, energy: e0 - v(p, 'sa_energy') });
            // the hit that lands for it
            const h0 = H.npcHits.length;
            for (let w = 0; w < 5; w++) { p.levels[HP] = 99; H.setNpcVar(npc, 'npc_venom', 0); H.tick(1); }
            const landed = H.npcHits.slice(h0).filter(h => h.who === 'mossgiant' && h.type !== 2);
            specs[specs.length - 1].hit = landed.length ? landed[0].damage : null;
            void tick;
            H.setVar(p, 'sa_energy', 1000); H.setVar(p, 'sa_attack', 1);
        }
        if (!p.target && !p.delayed) H.attackNpc(p, npc);
    }
    check('40 specials made', specs.length, 40);
    check('  each one 50% of the energy', [...new Set(specs.map(s => s.energy))], [500]);
    check('  each one heals half the hit, rounded down', specs.filter(s => s.hit === null || s.heal !== Math.floor(s.hit / 2)).length, 0);
    const most = Math.max(...specs.map(s => s.hit ?? 0));
    console.log(`    normal max ${normalMax}, special max ${specMax}, the specials' highest ${most}`);
    check(`  never above 1.5x the max hit (${specMax})`, most <= specMax, true);
    check(`  and above the normal max (${normalMax}) at least once`, most > normalMax, true);
    p.levels[HP] = 99;
    H.despawn(p);
}

// ------------------------------------------------------------------------------ relog
console.log('CHARGES SURVIVE A RE-LOGIN');
{
    const p = fresh();
    charge(p, 12345, 678, 'adamant_dart');
    H.setVar(p, 'venom', 12);
    const back: any = PlayerLoading.load(p.username, new Packet(p.save()), null);
    const g = (name: string) => back.getVar(VarPlayerType.getByName(name)!.id);
    check('scales, darts and dart kind come back from the save', [g('blowpipe_scales'), g('blowpipe_darts'), ObjType.get(g('blowpipe_dart_type')).debugname, g('venom')], [12345, 678, 'adamant_dart', 12]);
    H.despawn(p);
}

// ------------------------------------------------------------------------------ death
console.log('DEATH');
{
    const p = fresh();
    charge(p, 500, 300);
    H.equip(p, { rhand: 'toxic_blowpipe' });
    const keep = p.getInventory(InvType.getId('deathkeep'))!;
    p.invSet(InvType.getId('deathkeep'), ObjType.getId('toxic_blowpipe'), 1, 0);
    A.runProcProtected(p, '[proc,blowpipe_death_spill]');
    check('a kept blowpipe keeps its contents', [v(p, 'blowpipe_scales'), v(p, 'blowpipe_darts')], [500, 300]);
    p.invDelSlot(InvType.getId('deathkeep'), 0);
    void keep;
    const z = World.gameMap.getZone(p.x, p.z, p.level);
    A.runProcProtected(p, '[proc,blowpipe_death_spill]');
    const floor = [...z.getAllObjsUnsafe()].filter((o: any) => o.x === p.x && o.z === p.z).map((o: any) => [ObjType.get(o.type).debugname, o.count]);
    check('a lost one goes empty, with its scales and darts on the floor', [worn(p, 3), v(p, 'blowpipe_scales'), v(p, 'blowpipe_darts'), floor.sort()], ['toxic_blowpipe_empty', 0, 0, [['rune_dart', 300], ['zulrahs_scales', 500]]]);
    H.despawn(p);
}

// ------------------------------------------------------------------------------ pvp
console.log('PVP');
{
    const a: any = H.makePlayer('bpa', 3100, 3700, 201);
    const b: any = H.makePlayer('bpb', 3103, 3700, 202);
    H.tick(2);
    for (const x of [a, b]) { H.maxOut(x); H.clearInv(x); H.setVar(x, 'tutorial', 1000); noRandoms(x); }
    charge(a, 5000, 5000);
    H.equip(a, { rhand: 'toxic_blowpipe' });
    for (const [mode, rate] of [[0, 4], [1, 3]]) {
        setStyle(a, mode);
        const a0 = H.anims.length, h0 = H.hits.length;
        H.attack(a, b);
        for (let t = 0; t < 24; t++) { topUp(a, b); H.setVar(b, 'venom', 0); H.tick(1); if (!a.target && !a.delayed) H.attack(a, b); }
        a.clearInteraction(); b.clearInteraction(); H.tick(4);
        const ts = shotsOf(a, a0);
        check(`${['Accurate', 'Rapid'][mode]}: a shot every ${rate} ticks at a player`, gaps(ts), [rate]);
        check('  and it hits them', H.hits.slice(h0).some(h => h.who === b.username && h.type === 1 && h.damage > 0), true);
        for (let i = 0; i < 20; i++) { a.clearInteraction(); b.clearInteraction(); H.setVar(a, 'lastcombat_pvp', 0); H.setVar(b, 'lastcombat_pvp', 0); H.tick(1); }
    }
    // a quarter of the damaging hits envenom a player too
    setStyle(a, 1);
    let envenomed = 0;
    const h1 = H.hits.length;
    H.attack(a, b);
    for (let t = 0; t < 300; t++) {
        topUp(a, b); H.tick(1);
        if (v(b, 'venom') > 0) { envenomed++; H.setVar(b, 'venom', 0); }
        if (!a.target && !a.delayed) H.attack(a, b);
    }
    a.clearInteraction(); b.clearInteraction(); H.tick(4);
    const damaging = H.hits.slice(h1).filter(h => h.who === b.username && h.type === 1 && h.damage > 0).length;
    console.log(`    ${damaging} damaging hits on a player, ${envenomed} envenomed`);
    check('  a quarter of the damaging hits envenom the player (within 4 sd)', Math.abs(envenomed - damaging / 4) <= 4 * Math.sqrt(damaging * 3 / 16) && envenomed > 0, true);
    // the special against a player
    for (let i = 0; i < 12; i++) { a.clearInteraction(); b.clearInteraction(); H.tick(1); }
    H.setVar(a, 'sa_energy', 1000); H.setVar(a, 'sa_attack', 1);
    a.levels[HP] = 30;
    H.attack(a, b);
    let specced = false;
    for (let t = 0; t < 12 && !specced; t++) { b.levels[HP] = 99; H.tick(1); specced = v(a, 'sa_energy') === 500; }
    check('Toxic Siphon at a player takes 50%', specced, true);
    a.clearInteraction(); H.tick(2);
    H.despawn(a, b);
}

console.log('DUEL ARENA');
{
    const a: any = H.makePlayer('bpd1', 3340, 3250, 211);
    const b: any = H.makePlayer('bpd2', 3343, 3250, 212);
    H.tick(2);
    a.teleport(3340, 3250, 0); b.teleport(3343, 3250, 0); // after login, which puts a player found in an arena outside
    H.tick(1);
    for (const x of [a, b]) { H.maxOut(x); H.clearInv(x); H.setVar(x, 'tutorial', 1000); H.setVar(x, 'duelstatus', 6); }
    H.setVar(a, 'duel2accept', b.uid); H.setVar(b, 'duel2accept', a.uid);
    charge(a, 5000, 5000);
    H.equip(a, { rhand: 'toxic_blowpipe' });
    setStyle(a, 0);
    H.setVar(a, 'dueloptions', 1 << 13); // no special attacks
    H.setVar(a, 'sa_energy', 1000); H.setVar(a, 'sa_attack', 1);
    let a0 = H.anims.length;
    H.attack(a, b);
    for (let t = 0; t < 6; t++) { topUp(a, b); H.tick(1); }
    a.clearInteraction(); H.tick(2);
    check('no specials: refused, and the energy kept', [mes(a).includes('Use of special attacks has been turned off for this duel.'), v(a, 'sa_energy')], [true, 1000]);
    H.setVar(a, 'sa_attack', 0);
    H.setVar(a, 'dueloptions', 1 << 4); // no ranged
    a0 = H.anims.length;
    H.attack(a, b);
    for (let t = 0; t < 6; t++) { topUp(a, b); H.tick(1); }
    a.clearInteraction(); H.tick(2);
    check('no ranged: the blowpipe will not fire', [shotsOf(a, a0).length, mes(a).includes('Ranging has been turned off for this duel.')], [0, true]);
    H.setVar(a, 'dueloptions', 0);
    a0 = H.anims.length;
    H.attack(a, b);
    for (let t = 0; t < 8; t++) { topUp(a, b); H.tick(1); }
    a.clearInteraction(); H.tick(2);
    check('with ranged allowed it fires in the arena', shotsOf(a, a0).length > 0, true);
    H.despawn(a, b);
}

console.log(`\n${ok} ok, ${bad} FAIL`);
process.exit(bad ? 1 : 0);
