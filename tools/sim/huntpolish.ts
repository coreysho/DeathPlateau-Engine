// Hunter polish (content skill_hunter/scripts/hunter_netbait.rs2, hunter_butterfly_share.rs2,
// hunter_salamander.rs2, hunter_piscatoris.rs2), on the real engine:
//
//   net trap bait   a creature's own tar used on your set net trap (the tree or the net) baits it - one tar,
//                   once; the wrong tar, somebody else's trap, and a second tar are refused; the trap's next
//                   spring takes the bait; setting a trap again starts it unbaited; and the roll a baited
//                   trap makes is the creature's stat_random range + 8 of 256 (+3%), measured
//   jars shared     in multi-combat a black warlock / ruby harvest / sapphire glacialis / snowy knight used
//                   on a player gives its effect to them and at most three more within the 5x5 round them,
//                   each on their own level, only those accepting aid, never the user; the empty jar comes
//                   back; in single combat, or at a player not accepting aid, nothing is used
//   ruby harvest    released: Attack + 4 + 15%
//   swamp lizard    Scorch poisons (severity 30: 6 a hit), about one hit in four, at monsters and players;
//                   Flare and Blaze never, and no other salamander
import * as H from './harness.ts';
import World from '#/engine/World.js';
import InvType from '#/cache/config/InvType.js';
import ObjType from '#/cache/config/ObjType.js';
import LocType from '#/cache/config/LocType.js';
import VarNpcType from '#/cache/config/VarNpcType.js';
import ScriptProvider from '#/engine/script/ScriptProvider.js';
import ScriptRunner from '#/engine/script/ScriptRunner.js';
import ServerTriggerType from '#/engine/script/ServerTriggerType.js';
import { CoordGrid } from '#/engine/CoordGrid.js';
import { NpcMode } from '#/engine/entity/NpcMode.js';

await H.boot();
H.loginOrder();
let ok = 0, bad = 0, n = 0;
const check = (what: string, got: unknown, want: unknown) => {
    const pass = JSON.stringify(got) === JSON.stringify(want);
    pass ? ok++ : bad++;
    console.log(`  ${pass ? 'ok  ' : 'FAIL'} ${what}: ${JSON.stringify(got)}${pass ? '' : `   (want ${JSON.stringify(want)})`}`);
};
const ATT = 0, DEF = 1, STR = 2, HP = 3, HUNT = 22;
const fresh = (x: number, z: number) => {
    const p: any = H.makePlayer('hp' + n, x, z, 80 + n); n++;
    H.tick(2); H.maxOut(p); H.clearInv(p); H.setVar(p, 'tutorial', 1000); H.tick(1);
    return p;
};
const said = (p: any) => H.mesgs.filter(m => m.who === p.username).map(m => m.text);
const last = (p: any) => said(p).slice(-1)[0];
const slotOf = (p: any, name: string) => { const inv = p.getInventory(InvType.INV)!; for (let i = 0; i < inv.capacity; i++) if (inv.get(i)?.id === ObjType.getId(name)) return i; return -1; };
const multi = (x: number, z: number) => World.gameMap.isMulti(CoordGrid.packCoord(0, x, z));

// ------------------------------------------------------------------------------ net trap bait
console.log('NET TRAP BAIT');
{
    const TREE = LocType.getId('hunter_young_tree_swamp');
    const DIR = [[0, 1], [1, 0], [0, -1], [-1, 0]];
    // a Canifis young tree (the area the net pass uses)
    let tree: any = null;
    for (let x = 3520; x <= 3575 && !tree; x++) for (let z = 3425; z <= 3460 && !tree; z++) { const l = World.getLoc(x, z, 0, TREE); if (l) tree = l; }
    check('a young swamp tree at Canifis', tree !== null, true);
    const nx = tree.x + DIR[tree.angle][0], nz = tree.z + DIR[tree.angle][1];
    const tx = tree.x, tz = tree.z;
    const p = fresh(nx, nz), q = fresh(nx + 3, nz + 3);
    const bait = () => H.getVar(p, 'hunter_net_bait') & 1;
    const at = (x: number, z: number, name: string) => World.getLoc(x, z, 0, LocType.getId(name));
    const set = () => {
        H.give(p, 'net'); H.give(p, 'rope');
        p.teleport(nx, nz, 0); H.tick(1);
        H.opLoc(p, tx, tz, 'hunter_young_tree_swamp', 1);
        H.tick(6);
        return at(tx, tz, 'hunter_nettrap_swamp_set') !== null && at(nx, nz, 'hunter_nettrap_net') !== null;
    };
    // [oplocu] as the engine fires it on arrival: the used item in last_useitem, the loc as the target
    const useOn = (who: any, obj: string, loc: any) => {
        who.lastUseItem = ObjType.getId(obj); who.lastUseSlot = slotOf(who, obj);
        const t = LocType.get(loc.type);
        const s = ScriptProvider.getByTrigger(ServerTriggerType.OPLOCU, t.id, t.category)!;
        who.executeScript(ScriptRunner.init(s, who, loc), true);
    };
    p.setLevel(HUNT, 40);
    check('Set-trap on it: the tree bent and the net laid', set(), true);
    H.give(p, 'guam_tar', 5); H.give(p, 'marrentill_tar', 5);
    useOn(p, 'marrentill_tar', at(tx, tz, 'hunter_nettrap_swamp_set'));
    check('marrentill tar (an orange salamander\'s) will not bait a swamp lizard\'s trap', [bait(), H.invCount(p, 'marrentill_tar'), last(p)], [0, 5, 'Nothing interesting happens.']);
    H.give(q, 'guam_tar', 5);
    useOn(q, 'guam_tar', at(tx, tz, 'hunter_nettrap_swamp_set'));
    check('guam tar from somebody else: not their trap', [bait(), H.invCount(q, 'guam_tar'), last(q)], [0, 5, "This isn't your trap."]);
    useOn(p, 'guam_tar', at(tx, tz, 'hunter_nettrap_swamp_set'));
    check('guam tar on your own set tree baits it, one tar used', [bait(), H.invCount(p, 'guam_tar'), last(p)], [1, 4, 'You bait the trap with the guam tar.']);
    useOn(p, 'guam_tar', at(nx, nz, 'hunter_nettrap_net'));
    check('  and once: tar on the net now is refused', [H.invCount(p, 'guam_tar'), last(p)], [4, 'The trap is already baited.']);
    // Dismantle and set again: a new trap is unbaited
    H.opLoc(p, tx, tz, 'hunter_nettrap_swamp_set', 1); H.tick(4);
    check('Dismantle takes it down', at(tx, tz, 'hunter_nettrap_swamp_set'), null);
    check('set again, it starts unbaited', [set(), bait()], [true, 0]);
    useOn(p, 'guam_tar', at(nx, nz, 'hunter_nettrap_net'));
    check('guam tar on the net baits it too', [bait(), H.invCount(p, 'guam_tar')], [1, 3]);
    // a lizard beside the net, the hunter off it: the real loop springs it, and the bait is taken
    p.teleport(nx + (tree.angle % 2 === 0 ? 2 : 0), nz + (tree.angle % 2 === 1 ? 2 : 0), 0);
    const liz: any = H.addNpc('hunter_swamp_lizard', nx + (tree.angle % 2 === 0 ? -1 : 0), nz + (tree.angle % 2 === 1 ? -1 : 0));
    liz.targetOp = NpcMode.NONE;
    const sprung = () => ['catching', 'caught', 'escaping', 'escaped'].some(s => at(tx, tz, `hunter_nettrap_swamp_${s}`) || at(nx, nz, `hunter_nettrap_swamp_${s}`));
    let t = 0;
    for (; t < 600 && !sprung(); t++) { H.tick(1); p.lastResponse = World.currentTick; }
    check(`a swamp lizard beside it springs the trap (${t} ticks)`, sprung(), true);
    check('  and the spring takes the bait', bait(), 0);
    // the roll itself: [proc,hunter_net_roll](colour, bonus), counted at Hunter 29
    p.setLevel(HUNT, 29);
    const N = 40000;
    const rate = (bonus: number) => { let hit = 0; for (let i = 0; i < N; i++) hit += H.runProc(p, '[proc,hunter_net_roll]', [0, bonus])[0]; return hit / N; };
    const want = (low: number, high: number) => (Math.floor((low * 70) / 98) + Math.floor((high * 28) / 98) + 1) / 256;
    const r0 = rate(0), r8 = rate(8);
    const near = (a: number, b: number) => Math.abs(a - b) < 0.012;
    check(`unbaited at 29: ${(r0 * 100).toFixed(1)}% of ${N} rolls, stat_random(52, 360) says ${(want(52, 360) * 100).toFixed(1)}%`, near(r0, want(52, 360)), true);
    check(`baited at 29: ${(r8 * 100).toFixed(1)}%, stat_random(60, 368) says ${(want(60, 368) * 100).toFixed(1)}% - the bait's +3%`, near(r8, want(60, 368)), true);
    check('  the bait adds 3.1 points (8 of 256) to the catch chance', (want(60, 368) - want(52, 360)).toFixed(3), '0.031');
    H.despawn(p, q);
}

// ------------------------------------------------------------------------------ jars shared
console.log('JARS SHARED');
{
    // [opplayeru,<jar>] as the engine fires it: the used item in last_useitem, the target as the secondary
    const useOnPlayer = (p: any, obj: string, target: any) => {
        p.lastUseItem = ObjType.getId(obj); p.lastUseSlot = slotOf(p, obj);
        const o = ObjType.get(ObjType.getId(obj));
        const s = ScriptProvider.getByTrigger(ServerTriggerType.OPPLAYERU, o.id, o.category)!;
        p.executeScript(ScriptRunner.init(s, p, target), true);
    };
    const X = 3212, Z = 3930;
    check('the test ground is multi-combat', multi(X, Z), true);
    const a = fresh(X - 1, Z), b = fresh(X, Z);
    // round b: c, d, e and h accepting aid within two tiles, f not accepting, g three tiles off
    const c = fresh(X + 1, Z), d = fresh(X, Z + 1), e = fresh(X - 1, Z - 2), f = fresh(X + 2, Z + 2), g = fresh(X + 3, Z), h = fresh(X + 2, Z - 1);
    const all = { a, b, c, d, e, f, g, h };
    H.setVar(f, 'option_aid', 2);
    // everyone at a different Strength, so each boost is seen to be on the receiver's own level
    const strs: Record<string, number> = { a: 50, b: 99, c: 40, d: 60, e: 70, f: 80, g: 90, h: 30 };
    for (const [k, p] of Object.entries(all)) { (p as any).baseLevels[STR] = strs[k]; (p as any).levels[STR] = strs[k]; }
    H.give(a, 'black_warlock', 3);
    const boosted = () => Object.fromEntries(Object.entries(all).map(([k, p]) => [k, (p as any).levels[STR] - strs[k]]));
    useOnPlayer(a, 'black_warlock', b);
    const got = boosted();
    const want = (s: number) => 4 + Math.floor(s * 15 / 100);
    check('the target gets 4 + 15% of their own Strength', got.b, want(99));
    const others = ['c', 'd', 'e', 'h'].filter(k => got[k] > 0);
    check('  and three more round them accepting aid - no more, even with four there', others.length, 3);
    check('  each on their own level', others.every(k => got[k] === want(strs[k])), true);
    check('  not the one not accepting aid, not one 3 tiles off, not the user', [got.f, got.g, got.a], [0, 0, 0]);
    check('  one black warlock used, the jar back', [H.invCount(a, 'black_warlock'), H.invCount(a, 'hunter_butterfly_jar')], [2, 1]);
    check('  the user is told', last(a), `You let the black warlock out of its jar over ${b.displayName}.`);
    for (const p of Object.values(all)) (p as any).levels[STR] = (p as any).baseLevels[STR];
    // at somebody not accepting aid
    useOnPlayer(a, 'black_warlock', f);
    check('at a player not accepting aid: refused, nothing used', [H.invCount(a, 'black_warlock'), f.levels[STR] - strs.f, last(a)], [2, 0, `${f.displayName} is not accepting aid.`]);
    // the others: ruby harvest (Attack), sapphire glacialis (Defence), snowy knight (Hitpoints)
    for (const [jar, stat, name] of [['hunter_jar_ruby', ATT, 'Attack'], ['sapphire_glacialis', DEF, 'Defence']] as [string, number, string][]) {
        for (const p of Object.values(all)) (p as any).levels[stat] = (p as any).baseLevels[stat];
        H.give(a, jar);
        useOnPlayer(a, jar, b);
        check(`${jar}: ${name} + 4 + 15% for the target and three round them`, [b.levels[stat] - b.baseLevels[stat], ['c', 'd', 'e', 'h'].filter(k => (all as any)[k].levels[stat] > (all as any)[k].baseLevels[stat]).length], [want(b.baseLevels[stat]), 3]);
        for (const p of Object.values(all)) (p as any).levels[stat] = (p as any).baseLevels[stat];
    }
    for (const p of Object.values(all)) (p as any).levels[HP] = 50;
    H.give(a, 'snowy_knight');
    useOnPlayer(a, 'snowy_knight', b);
    check('snowy knight: 15 Hitpoints for the target and three round them', [b.levels[HP], ['c', 'd', 'e', 'h'].filter(k => (all as any)[k].levels[HP] === 65).length, a.levels[HP]], [65, 3, 50]);
    H.despawn(...Object.values(all));
    // single combat: nothing
    const SX = 3100, SZ = 3760;
    check('the single test ground is single-combat', multi(SX, SZ), false);
    const s1 = fresh(SX, SZ), s2 = fresh(SX + 1, SZ);
    s2.baseLevels[STR] = 60; s2.levels[STR] = 60;
    H.give(s1, 'black_warlock');
    useOnPlayer(s1, 'black_warlock', s2);
    check('in single combat: nothing happens, nothing is used', [s2.levels[STR], H.invCount(s1, 'black_warlock'), last(s1)], [60, 1, 'Nothing interesting happens.']);
    H.despawn(s1, s2);
}

// ------------------------------------------------------------------------------ ruby harvest
console.log('RUBY HARVEST');
{
    const p = fresh(3222, 3218);
    p.baseLevels[ATT] = 70; p.levels[ATT] = 70;
    H.give(p, 'hunter_jar_ruby');
    H.opheld(p, 'hunter_jar_ruby', 1);
    check('released: Attack + 4 + 15%, and the jar back', [p.levels[ATT], H.invCount(p, 'hunter_jar_ruby'), H.invCount(p, 'hunter_butterfly_jar')], [70 + 4 + 10, 0, 1]);
    H.despawn(p);
}

// ------------------------------------------------------------------------------ swamp lizard poison
console.log('SWAMP LIZARD POISON');
{
    const POISON = VarNpcType.getByName('npc_poison')!.id;
    const setStyle = (p: any, mode: number) => { H.setVar(p, 'com_mode', mode); H.runProc(p, '[proc,player_combat_stat]'); };
    // swings at a dummy, counting the hits that land and the ones that start a poison (the npc's poison is
    // cleared after each, so every one can be seen)
    const swing = (salamander: string, tar: string, mode: number, ticks: number) => {
        H.clearLogs();
        const p = fresh(3222 + (n % 6) * 4, 3240);
        H.equip(p, { rhand: salamander });
        p.invSet(InvType.WORN, ObjType.getId(tar), 1000, 13);
        setStyle(p, mode);
        const npc: any = H.addNpc('mossgiant', p.x + 1, p.z);
        npc.baseLevels[HP] = 30000; npc.levels[HP] = 30000; npc.baseLevels[DEF] = 1; npc.levels[DEF] = 1;
        npc.targetOp = NpcMode.NONE;
        H.tick(1);
        let hitsN = 0, poisons = 0; const sev: number[] = [];
        const seen = H.npcHits.length;
        H.attackNpc(p, npc);
        for (let t = 0; t < ticks; t++) {
            H.tick(1);
            if (!p.target && !p.delayed) H.attackNpc(p, npc);
            const v = npc.getVar(POISON) as number;
            if (v > 0) { poisons++; sev.push(v); npc.setVar(POISON, 0); }
        }
        hitsN = H.npcHits.slice(seen).filter(h => h.damage > 0 && h.type !== 2).length;
        H.despawn(p);
        return { hits: hitsN, poisons, sev: [...new Set(sev)] };
    };
    const sc = swing('swamp_lizard', 'guam_tar', 0, 1200);
    check(`Scorch: poisons (${sc.poisons} of ${sc.hits} hits)`, sc.poisons > 0, true);
    check('  about one hit in four (between 12% and 40%)', sc.poisons / sc.hits > 0.12 && sc.poisons / sc.hits < 0.4, true);
    check('  at severity 30 - 6 a hit', sc.sev, [30]);
    for (const [name, sal, tar, mode] of [['Flare', 'swamp_lizard', 'guam_tar', 1], ['Blaze', 'swamp_lizard', 'guam_tar', 2], ['an orange salamander\'s Scorch', 'orange_salamander', 'marrentill_tar', 0]] as [string, string, string, number][]) {
        const r = swing(sal, tar, mode, 300);
        check(`${name}: never poisons (${r.hits} hits)`, [r.hits > 10, r.poisons], [true, 0]);
    }
    // at a player, in the wilderness
    H.clearLogs();
    const a = fresh(3100, 3770), b = fresh(3101, 3770);
    H.equip(a, { rhand: 'swamp_lizard' });
    a.invSet(InvType.WORN, ObjType.getId('guam_tar'), 1000, 13);
    b.baseLevels[DEF] = 1; b.levels[DEF] = 1; b.baseLevels[HP] = 99; b.levels[HP] = 99;
    setStyle(a, 0);
    H.tick(1);
    let pois = 0;
    H.attack(a, b);
    for (let t = 0; t < 400 && pois === 0; t++) {
        H.tick(1); b.levels[HP] = 99;
        if (!a.target && !a.delayed) H.attack(a, b);
        pois = H.getVar(b, 'poison');
    }
    check('Scorch at a player poisons them, at 30', pois, 30);
    H.despawn(a, b);
}

console.log(`\n${ok} ok, ${bad} FAIL`);
process.exit(bad ? 1 : 0);
