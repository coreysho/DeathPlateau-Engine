// Five checks from the 2026-09-24 list - run with `npx tsx tools/sim/misc0924.ts`.
//
//   trollheim multi   the thrower-troll path up to the Troll Stronghold is multicombat: two trolls
//                     both throw at one player there; the same pair just south of it is single-way
//   barrows degrade   1 point entering combat (-> "100"), then one per 90 ticks in combat; 250 a
//                     quarter; 0 is broken and cannot be worn; magic and PvP count; a varp left at
//                     1 by a logout does not stop it working
//   defender block    a defender plays its own block (OSRS seq 4177) over the weapon's; a shield
//                     plays the shield block; bare off-hand plays the weapon's
//   fishing spots     Rellekka's spots (and every other Fishing spot) never walk
import * as H from './harness.ts';
import InvType from '#/cache/config/InvType.js';
import ObjType from '#/cache/config/ObjType.js';
import NpcType from '#/cache/config/NpcType.js';
import SeqType from '#/cache/config/SeqType.js';
import ParamType from '#/cache/config/ParamType.js';
import World from '#/engine/World.js';
import Npc from '#/engine/entity/Npc.js';
import Player from '#/engine/entity/Player.js';
import { CoordGrid } from '#/engine/CoordGrid.js';
const NOMOVE = 5; // NOMOVE (a const enum, so not importable at runtime)

await H.boot();
H.loginOrder();
let ok = 0, bad = 0, n = 0;
const check = (what: string, got: unknown, want: unknown) => {
    const pass = JSON.stringify(got) === JSON.stringify(want);
    pass ? ok++ : bad++;
    console.log(`  ${pass ? 'ok  ' : 'FAIL'} ${what}: ${JSON.stringify(got)}${pass ? '' : `   (want ${JSON.stringify(want)})`}`);
};

// every npc animation, with the npc it came from
const npcAnims: { tick: number; nid: number; seq: number }[] = [];
const origNpcAnim = (Npc.prototype as any).playAnimation;
(Npc.prototype as any).playAnimation = function (seq: number, delay: number) {
    if (seq !== -1) npcAnims.push({ tick: World.currentTick, nid: this.nid, seq });
    return origNpcAnim.call(this, seq, delay);
};

const fresh = (x: number, z: number) => {
    H.clearLogs();
    const p: Player = H.makePlayer('misc' + n, x, z, 60 + n); n++;
    H.tick(2); H.maxOut(p); H.clearInv(p); H.tick(1);
    return p;
};
const worn = (p: Player, slot: number) => { const o = p.getInventory(InvType.WORN)!.get(slot); return o ? ObjType.get(o.id).debugname : null; };
const HAT = 0, RHAND = 3, TORSO = 4, LEGS = 7;
const multi = (x: number, z: number) => World.gameMap.isMulti(CoordGrid.packCoord(0, x, z));
const seq = (name: string) => SeqType.getId(name);
const ParamId = (name: string) => ParamType.getId(name);
const oparam = (obj: string, param: string) => ObjType.get(ObjType.getId(obj)).params?.get(ParamId(param)) as number | undefined;

// ============================================================================ 1. Trollheim multi
console.log('TROLLHEIM MULTICOMBAT');
{
    // the thrower trolls' own spawns (m45_57) and the top of the path
    const spawns = [[2886, 3698], [2889, 3699], [2893, 3700], [2898, 3698], [2902, 3696]];
    check('every Trollheim thrower-troll spawn is multi', spawns.map(([x, z]) => multi(x, z)), spawns.map(() => true));
    check('the rest of the polygon: 2900,3690 / 2885,3760 / 2915,3690', [multi(2900, 3690), multi(2885, 3760), multi(2915, 3690)], [true, true, true]);
    check('outside it: 2879,3700 (west) / 2900,3687 (south) / 2884,3735 (the notch) / 2913,3700 (east)',
        [multi(2879, 3700), multi(2900, 3687), multi(2884, 3735), multi(2913, 3700)], [false, false, false, false]);
    check('Death Plateau still multi (2850,3600 / 2879,3607) and single just south (2851,3598)',
        [multi(2850, 3600), multi(2879, 3607), multi(2851, 3598)], [true, true, false]);

    // Two thrower trolls set on one player: inside both throw, outside only one does.
    const throwSeq = seq('troll_rock_throw');
    const pair = (px: number, pz: number) => {
        const p = fresh(px, pz);
        p.levels[3] = 99; (p as any).baseLevels[3] = 99;
        const a = H.addNpc('troll_thrower1', px - 2, pz);
        const b = H.addNpc('troll_thrower2', px + 2, pz);
        H.tick(1);
        npcAnims.length = 0;
        H.setNpcMode(a, 'APPLAYER2', p);
        H.setNpcMode(b, 'APPLAYER2', p);
        for (let t = 0; t < 40; t++) {
            p.levels[3] = 99; // keep the player alive and fighting
            H.tick(1);
        }
        const throwers = new Set(npcAnims.filter(x => x.seq === throwSeq && (x.nid === a.nid || x.nid === b.nid)).map(x => x.nid));
        World.removeNpc(a, -1); World.removeNpc(b, -1);
        H.despawn(p);
        H.tick(1);
        return throwers.size;
    };
    check('inside (2900,3692): both trolls throw at the one player', pair(2900, 3692), 2);
    check('just south, outside (2900,3684): only one does', pair(2900, 3684), 1);
}

// ============================================================================ 2. Barrows
console.log('BARROWS DEGRADING');
{
    const LUM = [3222, 3218];
    const dharok = () => ({ hat: 'barrows_dharok_head', torso: 'barrows_dharok_body', legs: 'barrows_dharok_legs', rhand: 'barrows_dharok_weapon' });
    const setOf = (p: Player) => [worn(p, HAT), worn(p, TORSO), worn(p, LEGS), worn(p, RHAND)];
    const hitBy = (p: Player, npcName = 'man') => {
        const m = H.addNpc(npcName, p.x + 1, p.z);
        H.tick(1);
        H.setNpcMode(m, 'OPPLAYER2', p);
        return m;
    };

    // the man is kept alive and set back on the player whenever he wanders off, so the fight goes on
    const keepFighting = (p: Player, m: Npc) => {
        p.levels[3] = 99;
        m.levels[3] = 500; // far beyond one Dharok hit, so he never dies mid-test
        if (!m.target) H.setNpcMode(m, 'OPPLAYER2', p);
    };
    const p = fresh(LUM[0], LUM[1]);
    H.equip(p, dharok());
    const m = hitBy(p);
    for (let t = 0; t < 4; t++) { p.levels[3] = 99; keepFighting(p, m); H.tick(1); }
    check('entering combat (a man hits you): every piece -> 100', setOf(p),
        ['barrows_dharok_head_100', 'barrows_dharok_body_100', 'barrows_dharok_legs_100', 'barrows_dharok_weapon_100']);
    // 249 more points to 75 (the "100" state already used 1): put the helm one point short, keep
    // fighting to the next 90-tick point
    H.setVar(p, 'barrows_wear_hat', 248);
    let t75 = -1;
    const t0 = World.currentTick;
    for (let t = 0; t < 100 && t75 < 0; t++) {
        p.levels[3] = 99; keepFighting(p, m); H.tick(1);
        if (worn(p, HAT) === 'barrows_dharok_head_75') t75 = World.currentTick - t0;
    }
    check('100 -> 75 on the 249th point, the next 90-tick point of the fight', [worn(p, HAT), t75 > 0 && t75 <= 90], ['barrows_dharok_head_75', true]);
    check('  the body, one point in, still 100', worn(p, TORSO), 'barrows_dharok_body_100');
    const pts = ['', '_100', '_75', '_50', '_25', '_broken'].map(sfx => oparam('barrows_dharok_head' + sfx, 'degrade_points') ?? 0);
    check("  the chain's points: 0 / 1 / 250 / 500 / 750 / 1000 (15 hours at 90 ticks a point)", pts, [0, 1, 250, 500, 750, 1000]);
    // 25 -> 0: broken, keeps sitting on the player until removed
    H.equip(p, { hat: 'barrows_dharok_head_25' });
    H.setVar(p, 'barrows_wear_hat', 249);
    const mes0 = H.mesgs.length;
    for (let t = 0; t < 200 && worn(p, HAT) !== 'barrows_dharok_head_broken'; t++) { p.levels[3] = 99; keepFighting(p, m); H.tick(1); }
    check('25 -> 0 (broken), still worn', worn(p, HAT), 'barrows_dharok_head_broken');
    check('  "has fully degraded"', H.mesgs.slice(mes0).some(x => x.who === p.username && /fully degraded/.test(x.text)), true);
    World.removeNpc(m, -1);
    // stop fighting: the timer lets go
    for (let t = 0; t < 100; t++) H.tick(1);
    check('out of combat the timer stops (barrows_degrading 0)', H.getVar(p, 'barrows_degrading'), 0);
    // a broken piece cannot go back on
    p.getInventory(InvType.WORN)!.delete(HAT);
    H.give(p, 'barrows_dharok_head_broken');
    const mes1 = H.mesgs.length;
    H.opheld(p, 'barrows_dharok_head_broken', 2);
    H.tick(2);
    check('a broken helm will not go back on', [worn(p, HAT), H.mesgs.slice(mes1).some(x => /broken and needs repairing/.test(x.text))], [null, true]);
    // Bob charges degrade_points * degrade_repair_rate: a full set from 0 is 330,000 as in OSRS
    const full = ['head', 'body', 'legs', 'weapon'].reduce((s, sl) => s + (oparam(`barrows_dharok_${sl}_broken`, 'degrade_points') ?? 0) * (oparam(`barrows_dharok_${sl}_broken`, 'degrade_repair_rate') ?? 0), 0);
    check("Bob's price for a broken set: 330,000", full, 330000);
    H.despawn(p);
}
{
    // a perm varp left at 1 by a logout mid-fight (timers are not saved) no longer blocks degrading
    const p = fresh(3226, 3218);
    H.equip(p, { hat: 'barrows_guthan_head' });
    H.setVar(p, 'barrows_degrading', 1);
    const m = H.addNpc('man', p.x + 1, p.z); H.tick(1); H.setNpcMode(m, 'OPPLAYER2', p);
    for (let t = 0; t < 4; t++) { p.levels[3] = 99; H.tick(1); }
    check('stale barrows_degrading=1 from a logout: combat still degrades', worn(p, HAT), 'barrows_guthan_head_100');
    World.removeNpc(m, -1); H.despawn(p);
}
{
    // magic at a monster counts (Ahrim's)
    const p = fresh(3230, 3218);
    H.equip(p, { hat: 'barrows_ahrim_head', rhand: 'barrows_ahrim_weapon' });
    H.give(p, 'airrune', 100); H.give(p, 'mindrune', 100);
    const m = H.addNpc('goblin', p.x + 3, p.z); H.tick(1);
    // cast until one goes off (a goblin can wander a step out of line of sight first)
    for (let t = 0; t < 20 && worn(p, HAT) === 'barrows_ahrim_head'; t++) {
        if (t % 5 === 0) H.castOnNpc(p, m, 'magic:wind_strike');
        p.levels[3] = 99; m.levels[3] = 500; H.tick(1);
    }
    check('casting wind strike at a goblin degrades Ahrim\'s', [worn(p, HAT), worn(p, RHAND)], ['barrows_ahrim_head_100', 'barrows_ahrim_weapon_100']);
    World.removeNpc(m, -1); H.despawn(p);
}
{
    // PvP counts, for both players (wilderness)
    const a = fresh(3100, 3530);
    const b = fresh(3102, 3530);
    H.equip(a, { hat: 'barrows_verac_head', rhand: 'rune_scimitar' });
    H.equip(b, { hat: 'barrows_torag_head' });
    H.runProc(a, '[proc,player_combat_stat]');
    H.tick(1);
    H.attack(a, b);
    for (let t = 0; t < 6; t++) { a.levels[3] = 99; b.levels[3] = 99; H.tick(1); }
    check('PvP: attacker and defender both degrade', [worn(a, HAT), worn(b, HAT)], ['barrows_verac_head_100', 'barrows_torag_head_100']);
    H.despawn(a, b);
}

// ============================================================================ 3. defender block
console.log('DEFENDER BLOCK ANIM');
{
    const blockWith = (slots: Record<string, string>) => {
        const p = fresh(3222, 3214);
        H.equip(p, slots);
        H.runProc(p, '[proc,player_combat_stat]');
        H.tick(1);
        H.anims.length = 0;
        const m = H.addNpc('man', p.x + 1, p.z); H.tick(1); H.setNpcMode(m, 'OPPLAYER2', p);
        for (let t = 0; t < 8; t++) { p.levels[3] = 99; H.tick(1); }
        // the first thing the player plays is the block as the man's first punch lands (after that
        // auto retaliate swings back, which is not what is being checked)
        const got = H.anims.filter(x => x.who === p.username).map(x => x.seq).slice(0, 1);
        World.removeNpc(m, -1); H.despawn(p);
        return got.map(s => SeqType.get(s).debugname);
    };
    check('rune scimitar + rune defender, hit: the defender block', blockWith({ rhand: 'rune_scimitar', lhand: 'rune_defender' }), ['osrs_defender_block']);
    check('  dragon defender too', blockWith({ rhand: 'rune_scimitar', lhand: 'dragon_defender' }), ['osrs_defender_block']);
    check('  bronze defender with no weapon', blockWith({ lhand: 'bronze_defender' }), ['osrs_defender_block']);
    check('rune scimitar + rune kiteshield: the shield block', blockWith({ rhand: 'rune_scimitar', lhand: 'rune_kiteshield' }), ['human_shield_defence']);
    check('rune scimitar alone: the scimitar\'s own block', blockWith({ rhand: 'rune_scimitar' }),
        [SeqType.get(ObjType.get(ObjType.getId('rune_scimitar')).params!.get(ParamId('defend_anim')) as number).debugname]);
    const defenders = ['bronze_defender', 'iron_defender', 'steel_defender', 'black_defender', 'mithril_defender', 'adamant_defender', 'rune_defender', 'dragon_defender'];
    check('all eight defenders carry shield_defend_anim=osrs_defender_block',
        defenders.map(d => ObjType.get(ObjType.getId(d)).params?.get(ParamId('shield_defend_anim'))), defenders.map(() => seq('osrs_defender_block')));
}

// ============================================================================ 4. fishing spots
console.log('FISHING SPOTS');
{
    const spots = [...World.npcs].filter(x => x && x.isActive && NpcType.get(x.type).name === 'Fishing spot');
    const rellekka = spots.filter(x => (NpcType.get(x.type).debugname ?? '').startsWith('0_41_57_'));
    check('Rellekka has fishing spots spawned', rellekka.length > 0, true);
    const types = new Set(spots.map(x => x.type));
    const wandering = [...types].filter(t => NpcType.get(t).moverestrict !== NOMOVE).map(t => NpcType.get(t).debugname);
    check('every spawned Fishing spot type is moverestrict=nomove', wandering, []);
    const allTypes: string[] = [];
    for (let id = 0; id < NpcType.count; id++) {
        const t = NpcType.get(id);
        if (t.name === 'Fishing spot' && t.moverestrict !== NOMOVE) allTypes.push(t.debugname ?? String(id));
    }
    check('...and every Fishing spot config, spawned or not', allTypes, []);
    const before = rellekka.map(x => [x.x, x.z]);
    const beforeAll = new Map(spots.map(x => [x.nid, `${x.x},${x.z}`]));
    for (let t = 0; t < 600; t++) H.tick(1);
    check('Rellekka spots in the same place 600 ticks later', rellekka.map(x => [x.x, x.z]), before);
    // spots with a relocation timer may teleport; none may take a step to an adjacent tile
    const stepped = spots.filter(x => {
        const [bx, bz] = beforeAll.get(x.nid)!.split(',').map(Number);
        const d = Math.max(Math.abs(x.x - bx), Math.abs(x.z - bz));
        return d > 0 && NpcType.get(x.type).timer === -1;
    }).map(x => NpcType.get(x.type).debugname);
    check('no fishing spot without a relocation timer moved at all', stepped, []);
}

console.log(`\n${ok} ok, ${bad} FAIL`);
process.exit(bad ? 1 : 0);
