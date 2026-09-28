// The "visuals" round (2026-09-27), on the real engine - run with `npx tsx tools/sim/visuals.ts`:
//
//   overheads   every overhead prayer sends its head icon in the appearance block - the three protect
//               prayers 0-2 as before, and now Retribution 3, Smite 4 and Redemption 5; switching one
//               overhead for another leaves only the new one; the skull rides beside it untouched; and
//               clearing an overhead bit that is not set no longer takes other bits with it
//   hitsplats   venom is drawn with the venom splat (5) on a monster and on a player, poison keeps its
//               own (2); a hit that rolls the attacker's max is the max hit splat (7) - a player's melee
//               on a monster, a monster's melee on a player, and player against player - and a hit under
//               the max is the plain one (1); a monster's own [ai_queue2] handler draws it too
//   old client  a client from before hitsplats 5-7 is sent poison for venom and damage for a max hit
//   dig         the Barrows dig: human_dig_barrows, and five ticks from the spade to the crypt (was six)
import * as H from './harness.ts';
import * as A from './a1lib.ts';
import World from '#/engine/World.js';
import SeqType from '#/cache/config/SeqType.js';
import { NpcMode } from '#/engine/entity/NpcMode.js';
import ScriptProvider from '#/engine/script/ScriptProvider.js';
import ScriptRunner from '#/engine/script/ScriptRunner.js';
import { PlayerRenderer, NpcRenderer } from '#/network/rsbuf/renderer.js';
import { Player as RsPlayer } from '#/network/rsbuf/player.js';
import { Npc as RsNpc } from '#/network/rsbuf/npc.js';
import { Packet as RsPacket } from '#/network/rsbuf/packet.js';
import { PlayerInfoProt, NpcInfoProt } from '#/network/rsbuf/prot.js';

await H.boot();
H.loginOrder();
let ok = 0, bad = 0, n = 0;
const check = (what: string, got: unknown, want: unknown) => {
    const pass = JSON.stringify(got) === JSON.stringify(want);
    pass ? ok++ : bad++;
    console.log(`  ${pass ? 'ok  ' : 'FAIL'} ${what}: ${JSON.stringify(got)}${pass ? '' : `   (want ${JSON.stringify(want)})`}`);
};
const HP = 3, STR = 2, PRAY = 5;
const BLOCK = 0, DAMAGE = 1, POISON = 2, VENOM = 5, MAX_HIT = 7;
const noRandoms = (p: any) => { const t = ScriptProvider.getByName('[timer,general_macro_events]'); if (t) p.clearTimer(t.id); };
const fresh = (x = 3222 + (n % 8) * 4, z = 3218 + Math.floor(n / 8) * 4) => {
    const p: any = H.makePlayer('vis' + n, x, z, 60 + n); n++;
    H.tick(2); H.maxOut(p); H.clearInv(p); H.setVar(p, 'tutorial', 1000); noRandoms(p); H.tick(1);
    return p;
};
const dummy = (name: string, x: number, z: number, hp = 30000) => {
    const npc: any = H.addNpc(name, x, z);
    npc.baseLevels[HP] = hp; npc.levels[HP] = hp;
    npc.targetOp = NpcMode.NONE;
    return npc;
};
// the appearance block's two icon bytes: [pk sheet index, prayer sheet index], 255 = none
const icons = (p: any) => { const a = p.generateAppearance(); return [a[1], a[2]]; };
const pray = (p: any, name: string) => { H.ifButton(p, 'prayer:prayer_' + name); H.tick(2); };
const npcProcInt = (npc: any, name: string, player: any = null): number => {
    const script = ScriptProvider.getByName(name)!;
    const state: any = ScriptRunner.init(script, npc, player, []);
    ScriptRunner.execute(state);
    return state.intStack[state.isp - 1];
};

// ------------------------------------------------------------------------------ overheads
console.log('OVERHEAD PRAYERS');
{
    const p = fresh();
    p.levels[PRAY] = 99;
    for (const [name, icon] of [['protectfrommelee', 0], ['protectfrommissiles', 1], ['protectfrommagic', 2], ['retribution', 3], ['smite', 4], ['redemption', 5]] as [string, number][]) {
        pray(p, name);
        check(`${name}: head icon ${icon}`, icons(p), [255, icon]);
    }
    check('redemption is the only overhead bit left (0x400)', p.headicons, 0x400);
    pray(p, 'redemption');
    check('redemption off: no icon', [icons(p), p.headicons], [[255, 255], 0]);
    pray(p, 'retribution');
    pray(p, 'smite');
    check('retribution then smite: smite alone, retribution switched off', [icons(p), H.getVar(p, 'prayer15'), H.getVar(p, 'prayer17')], [[255, 4], 0, 1]);
    pray(p, 'protectfrommelee');
    check('smite then protect from melee: melee alone', [icons(p), H.getVar(p, 'prayer17'), p.headicons], [[255, 0], 0, 0x8]);
    // the skull is a bit of its own, and ~headicon_del used to borrow from the bits below the one it cleared
    H.runProc(p, '[proc,headicon_add]', [0]); // skull
    H.runProc(p, '[proc,headicon_add]', [6]); // duel
    pray(p, 'smite');
    check('skulled + duel bit: smite switches melee off and leaves the skull and duel bits', [icons(p), p.headicons], [[0, 4], 0x1 | 0x40 | 0x200]);
    H.runProc(p, '[proc,prayer_deactivate_all]');
    check('~prayer_deactivate_all clears smite\'s icon too', [icons(p), p.headicons], [[0, 255], 0x1 | 0x40]);
    H.despawn(p);
}

// ------------------------------------------------------------------------------ venom
console.log('VENOM AND POISON SPLATS');
{
    const p = fresh();
    const npc = dummy('man', p.x + 2, p.z);
    H.clearLogs();
    H.runNpcProc(npc, '[proc,npc_venom_start]', p);
    H.tick(95);
    const vh = H.npcHitsFor('man');
    check('a venomed monster: 6, 8, 10, each with the venom splat', vh.map(h => [h.damage, h.type]), [[6, VENOM], [8, VENOM], [10, VENOM]]);
    H.clearLogs();
    A.enqueue(p, '[queue,venom_player]', [0]);
    H.tick(65);
    const ph = H.hitsFor(p.username);
    check('a venomed player: 6 then 8, with the venom splat', ph.map(h => [h.damage, h.type]), [[6, VENOM], [8, VENOM]]);
    H.setVar(p, 'venom', 0); // ~venom_clear, which a direct runProc has no protected access for
    H.clearLogs();
    H.setVar(p, 'poison', 0);
    A.enqueue(p, '[queue,poison_player]', [20]);
    H.tick(35);
    check('a poisoned player keeps poison\'s own splat', H.hitsFor(p.username).map(h => h.type), [POISON]);
    H.despawn(p);
    H.setNpcVar(npc, 'npc_venom', 0);
    npc.levels[HP] = 0;
}

// ------------------------------------------------------------------------------ max hits
console.log('MAX HIT SPLATS');
{
    // player -> monster, melee, the whole attack path. Strength low enough for a max of 3, so max hits come often.
    const p = fresh();
    p.baseLevels[STR] = 10; p.levels[STR] = 10;
    H.runProc(p, '[proc,player_combat_stat]');
    const max = H.getVar(p, 'com_maxhit');
    const npc = dummy('barbarian', p.x + 1, p.z);
    npc.baseLevels[1] = 1; npc.levels[1] = 1; // defence 1: most swings land
    H.clearLogs();
    for (let i = 0; i < 60; i++) {
        if (!p.target) H.attackNpc(p, npc);
        H.tick(5);
        npc.levels[HP] = npc.baseLevels[HP];
    }
    const hs = H.npcHitsFor('barbarian');
    const atMax = hs.filter(h => h.damage === max), under = hs.filter(h => h.damage > 0 && h.damage < max), zero = hs.filter(h => h.damage === 0);
    console.log(`     (${hs.length} swings at a max of ${max}: ${atMax.length} max hits, ${under.length} under, ${zero.length} misses)`);
    check('player melee on a monster: enough swings to see all three', atMax.length > 0 && under.length > 0 && zero.length > 0, true);
    check('  every hit of the max is the max hit splat', [...new Set(atMax.map(h => h.type))], [MAX_HIT]);
    check('  every hit under it is the plain one', [...new Set(under.map(h => h.type))], [DAMAGE]);
    check('  a miss is the block splat', [...new Set(zero.map(h => h.type))], [BLOCK]);
    p.clearPendingAction(); p.target = null;
    H.tick(2);

    // the monster's own handler: an imp has [ai_queue2,imp], and the flag rides through it
    const imp = dummy('imp', p.x, p.z + 3, 30000);
    H.clearLogs();
    H.runNpcProc(imp, '[proc,npc_queue_hit]', p, [3, 3, 0]);
    H.runNpcProc(imp, '[proc,npc_queue_hit]', p, [2, 3, 0]);
    H.tick(2);
    check('a monster with its own [ai_queue2] handler: 3 of 3 is a max hit, 2 of 3 is not', H.npcHitsFor('imp').map(h => [h.damage, h.type]), [[3, MAX_HIT], [2, DAMAGE]]);
    imp.levels[HP] = 0;

    // monster -> player: the default melee attack
    const q = fresh();
    const guard = dummy('guard1', q.x + 1, q.z, 30000);
    const gmax = npcProcInt(guard, '[proc,npc_melee_maxhit]', q);
    q.baseLevels[1] = 1; q.levels[1] = 1;
    H.clearLogs();
    for (let i = 0; i < 80; i++) {
        H.runNpcProc(guard, '[proc,npc_meleeattack]', q);
        H.tick(2);
        q.levels[HP] = q.baseLevels[HP];
    }
    const gh = H.hitsFor(q.username);
    const gAt = gh.filter(h => h.damage === gmax), gUnder = gh.filter(h => h.damage > 0 && h.damage < gmax);
    console.log(`     (${gh.length} guard swings at a max of ${gmax}: ${gAt.length} max hits, ${gUnder.length} under)`);
    check('a monster\'s melee on a player: max hits seen, and hits under it', gAt.length > 0 && gUnder.length > 0, true);
    check('  every hit of its max is the max hit splat', [...new Set(gAt.map(h => h.type))], [MAX_HIT]);
    check('  every hit under it is the plain one', [...new Set(gUnder.map(h => h.type))], [DAMAGE]);
    guard.levels[HP] = 0;

    // player -> player: ~.pvp_damage_max, what the pvp melee, ranged, magic and blowpipe shots call
    H.clearLogs();
    H.runProc(p, '[proc,.pvp_damage_max]', [0, 5, 5], q);
    H.tick(2);
    H.runProc(p, '[proc,.pvp_damage_max]', [0, 4, 5], q);
    H.tick(2);
    H.runProc(p, '[proc,.pvp_damage]', [0, 5], q);
    H.tick(2);
    check('player on player: 5 of 5 is a max hit, 4 of 5 is not, and the old call never is', H.hitsFor(q.username).map(h => [h.damage, h.type]), [[5, MAX_HIT], [4, DAMAGE], [5, DAMAGE]]);
    H.despawn(p, q);
    npc.levels[HP] = 0;
}

// ------------------------------------------------------------------------------ old clients
console.log('A CLIENT FROM BEFORE THE NEW SPLATS');
{
    const typeByte = (bytes: Uint8Array, alt: 'alt3' | 'alt2') => alt === 'alt3' ? (128 - bytes[1]) & 0xff : (0 - bytes[1]) & 0xff;
    const pr = new PlayerRenderer();
    const rp = new RsPlayer(5);
    for (const [type, legacy] of [[VENOM, POISON], [MAX_HIT, DAMAGE], [DAMAGE, DAMAGE], [POISON, POISON]]) {
        rp.masks = PlayerInfoProt.DAMAGE | PlayerInfoProt.DAMAGE2;
        rp.damageTaken = 9; rp.damageType = type; rp.damageTaken2 = 4; rp.damageType2 = type; rp.currentHitpoints = 50; rp.baseHitpoints = 99;
        pr.removeTemporary();
        pr.computeInfo(rp);
        const outNew = new RsPacket(16), outOld = new RsPacket(16);
        pr.write(outNew, 5, PlayerInfoProt.DAMAGE); pr.write(outNew, 5, PlayerInfoProt.DAMAGE2);
        pr.write(outOld, 5, PlayerInfoProt.DAMAGE, true); pr.write(outOld, 5, PlayerInfoProt.DAMAGE2, true);
        check(`a player's splat ${type}: a new client is sent ${type}, an old one ${legacy} (both blocks, same length)`,
            [typeByte(outNew.data.slice(0, 4), 'alt3'), typeByte(outNew.data.slice(4, 8), 'alt2'), typeByte(outOld.data.slice(0, 4), 'alt3'), typeByte(outOld.data.slice(4, 8), 'alt2'), outOld.pos],
            [type, type, legacy, legacy, 8]);
    }
    const nr = new NpcRenderer();
    const rn = new RsNpc(7, 1);
    rn.masks = NpcInfoProt.DAMAGE;
    rn.damageTaken = 12; rn.damageType = MAX_HIT; rn.currentHitpoints = 10; rn.baseHitpoints = 20;
    nr.computeInfo(rn);
    const a = new RsPacket(8), b = new RsPacket(8);
    nr.write(a, 7, NpcInfoProt.DAMAGE); nr.write(b, 7, NpcInfoProt.DAMAGE, true);
    // NpcInfoDamage writes damage p1_alt? then type - read both bytes raw and compare the type byte only
    check('a monster\'s max hit: the old client\'s block differs from the new one\'s in the type byte alone',
        [a.pos, b.pos, a.data[0] === b.data[0], a.data[1] !== b.data[1], a.data[2] === b.data[2], a.data[3] === b.data[3]], [4, 4, true, true, true, true]);
}

// ------------------------------------------------------------------------------ barrows dig
console.log('THE BARROWS DIG');
{
    const p = fresh(3566, 3289); // on Ahrim's mound (barrows.constant ^barrows_mound_ahrim)
    H.give(p, 'spade');
    H.clearLogs();
    H.opheld(p, 'spade', 1);
    let landed = -1;
    for (let i = 0; i < 12 && landed < 0; i++) {
        H.tick(1);
        if (p.level === 3) landed = World.currentTick;
    }
    const DIG = SeqType.getId('human_dig_barrows');
    const digAnims = H.anims.filter(a => a.who === p.username && a.seq === DIG);
    check('the dig plays human_dig_barrows', digAnims.length > 0, true);
    // from the tick the spade goes in (the anim) to the tick the player is in the crypt: p_delay(1) then
    // p_delay(1), two ticks each, and the telejump lands the tick after. It was p_delay(2), p_delay(1): six.
    check('  and the player is in Ahrim\'s crypt five ticks after the spade goes in (it was six)', [digAnims.length ? landed - digAnims[0].tick : -1, p.level, p.x, p.z], [5, 3, 3557, 9703]);
    const seq = SeqType.get(DIG);
    const long = SeqType.get(SeqType.getId('human_dig_long'));
    check('  human_dig_barrows: human_dig_long\'s frames, 29 client ticks a stroke', [seq.frames?.join(), seq.loops, (seq.delay as number[] | undefined)?.reduce((x, y) => x + y, 0)], [long.frames?.join(), long.loops, 29]);
    H.despawn(p);
}

console.log(`\n${ok} ok, ${bad} failed`);
process.exit(bad === 0 ? 0 : 1);
