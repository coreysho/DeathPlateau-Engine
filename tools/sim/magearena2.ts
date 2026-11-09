// MAGE ARENA II, PLAYED THROUGH.
// Usage: NODE_MEMBERS=true npx tsx tools/sim/magearena2.ts   (exit code is the verdict)
//
// Corey: "look into mage arena 2 actually working". It is built as an arena rematch rather than the
// deep-wilderness version: Kolodion sends you back into his arena and the champions of Saradomin,
// Guthix and Zamorak come one after another. Two things stopped it being playable.
//
// THE ARENA REFUSED EVERY RETALIATION. Auto-retaliate is p_opnpc(2), a melee attack whatever you
// are holding, and npc_is_attackable blocks melee inside the Mage Arena - so every hit a champion
// landed printed "Kolodion allows only magical combat within the arena." and did nothing else.
// Measured before the fix: one line per incoming hit, for the whole fight.
//
// AND THE CHAMPIONS WERE NEARLY IMMUNE TO THE ONLY DAMAGE THE ARENA ALLOWS. An npc's magic defence
// roll is built from its MAGIC level, not its Defence (npc_defence_roll_specific), so the magic=120
// that makes a champion's own spell accurate also gave it a defence roll of (120+9)*(60+64) = 15996
// against a maxed god-staff caster's 8640 - about one hit in four, or a hundred and forty casts for
// three 150-hitpoint champions.
import * as H from './harness.js';
import * as A from './a1lib.js';
import { check, R, player } from './a1lib.js';
import VarPlayerType from '#/cache/config/VarPlayerType.js';
import NpcType from '#/cache/config/NpcType.js';
import World from '#/engine/World.js';

await H.boot();
H.loginOrder();

const setv = (p: any, n: string, v: number) => p.setVar(VarPlayerType.getByName(n)!.id, v);
const getv = (p: any, n: string) => p.getVar(VarPlayerType.getByName(n)!.id);

const MA2_COMPLETE = 4;
const MA2_IMBUED = 5;
const PRAYED_AT_STATUE = 7; // ^mage_arena_prayed_at_statue
const SPELL_FINISHED = 99;

/** A player who has finished Mage Arena I and all three god spells, in that god's cape and staff. */
const ready = (name: string, god: 'saradomin' | 'guthix' | 'zamorak') => {
    const p: any = player(name, 3105, 3934, 0);
    H.maxOut(p);
    H.clearInv(p);
    setv(p, 'magearena', PRAYED_AT_STATUE);
    setv(p, 'saramage', SPELL_FINISHED);
    setv(p, 'guthmage', SPELL_FINISHED);
    setv(p, 'zamomage', SPELL_FINISHED);
    H.give(p, `${god}_cape`, 1);
    H.give(p, `${god}_staff`, 1);
    for (const r of ['airrune', 'firerune', 'bloodrune', 'deathrune']) H.give(p, r, 20000);
    H.equip(p, { back: `${god}_cape`, rhand: `${god}_staff` });
    // %com_magicattack and its siblings are cached varps, recomputed when equipment changes. A sim
    // that writes the worn inventory straight in has to ask for the recompute, or every magic
    // attack roll is taken with an effective Magic level of nought: 576 instead of 8640.
    H.runProc(p, '[proc,player_combat_stat]');
    H.tick(1);
    return p;
};

/** Take every champion out of the world, so one section's leftovers are not the next one's target. */
const clearChampions = () => {
    const ids = ['ma2_champion_saradomin', 'ma2_champion_guthix', 'ma2_champion_zamorak'].map(n => NpcType.getId(n));
    for (const npc of World.npcs) {
        if (npc && npc.isActive && ids.includes(npc.type)) World.removeNpc(npc, -1);
    }
};

/** The champion of this god that is actually alive in the arena, if any. */
const liveChampion = (name: string) => {
    const id = NpcType.getId(name);
    for (const npc of World.npcs) {
        if (npc && npc.isActive && npc.type === id && npc.levels[3] > 0) return npc as any;
    }
    return null;
};

/** Ask Kolodion for the rematch, the way a player does, and wait for the champion to appear. */
const enterArena = (p: any) => {
    const kol: any = H.npcNear('arenamage1', 2540, 4716, 0);
    p.teleport(kol.x + 1, kol.z, kol.level);
    H.tick(1);
    H.opNpc(p, kol, 1);
    A.drive(p, ['greater challenge', "I'm ready"], 8);
    for (let t = 0; t < 20; t++) H.tick(1);
};

const SPELL: Record<string, string> = { saradomin: 'saradomin_strike', guthix: 'claws_of_guthix', zamorak: 'flames_of_zamorak' };

console.log('== Kolodion offers the rematch, and it puts you in the arena with a champion');
{
    const p = ready('ma2start', 'saradomin');
    const kol: any = H.npcNear('arenamage1', 2540, 4716, 0);
    check('Kolodion is at the arena bank', kol !== null, true);
    (p as any).teleport(kol.x + 1, kol.z, kol.level);
    H.tick(1);
    H.clearLogs();
    H.opNpc(p, kol, 1);
    A.drive(p, ['greater challenge', "I'm ready"], 6);
    check('  the rematch is under way', getv(p, 'magearena2'), 1);
    const champ: any = H.npcNear('ma2_champion_saradomin', 3105, 3934, 0);
    check("  and Saradomin's champion is in the arena", champ !== null, true);
    if (champ) check('    with its own hitpoints', champ.levels[3], 150);
    H.despawn(p);
    clearChampions();
}

console.log('\n== a god spell can kill a champion, and the arena stays quiet while it happens');
{
    const p = ready('ma2fight', 'saradomin');
    enterArena(p);
    const champ: any = liveChampion('ma2_champion_saradomin');
    check('the champion is spawned by the teleport', champ !== null, true);
    if (champ) {
        (p as any).teleport(champ.x + 3, champ.z, 0);
        H.tick(1);
        H.clearLogs();
        let casts = 0;
        for (let n = 0; n < 80 && champ.levels[3] > 0; n++) {
            if (H.castOnNpc(p, champ, 'magic:' + SPELL.saradomin)) casts++;
            for (let t = 0; t < 6; t++) H.tick(1);
            (p as any).levels[3] = 99;
        }
        const hits = H.npcHits.filter(h => h.nid === champ.nid);
        const pct = Math.round((100 * hits.length) / Math.max(casts, 1));
        console.log(`  ${casts} casts, ${hits.length} landed (${pct}%), ${hits.reduce((a, b) => a + b.damage, 0)} damage`);
        check('  it dies', champ.levels[3], 0);
        // A quarter was the old rate and it took 140 casts for the three. A third or better is the
        // fix; anything near a half would mean the champions had stopped being a fight.
        check('  landing better than one cast in four', pct > 28, true);
        check('    and not so often it is a pushover', pct < 60, true);
        // THE WHOLE POINT OF THE RETALIATE FIX. The champion hits back throughout; before it, each
        // of those hits printed the arena's melee refusal at the player.
        const spam = A.mesOf(p).filter(m => m.includes('only magical combat')).length;
        check('  and the arena never refuses a swing it was never asked for', spam, 0);
    }
    H.despawn(p);
    clearChampions();
}

console.log('\n== the three champions come in turn, and Kolodion imbues the cape at the end');
{
    const p = ready('ma2run', 'zamorak');
    enterArena(p);
    const order: string[] = [];
    for (const want of ['ma2_champion_saradomin', 'ma2_champion_guthix', 'ma2_champion_zamorak']) {
        let champ: any = null;
        for (let t = 0; t < 60 && !champ; t++) {
            champ = liveChampion(want);
            if (!champ) H.tick(1);
        }
        if (!champ) {
            console.log(`  (${want} never appeared)`);
            break;
        }
        order.push(NpcType.get(champ.type).debugname!);
        (p as any).teleport(champ.x + 3, champ.z, 0);
        for (let n = 0; n < 120 && champ.levels[3] > 0 && champ.isActive; n++) {
            H.castOnNpc(p, champ, 'magic:' + SPELL.zamorak);
            for (let t = 0; t < 6; t++) H.tick(1);
            (p as any).levels[3] = 99;
        }
        for (let t = 0; t < 12; t++) H.tick(1);
    }
    check('all three champions were fought, in order', order, ['ma2_champion_saradomin', 'ma2_champion_guthix', 'ma2_champion_zamorak']);
    check('  and the miniquest records it as finished', getv(p, 'magearena2'), MA2_COMPLETE);

    // The reward: a plain cape in the pack, imbued by Kolodion. The first one is free.
    for (let t = 0; t < 10; t++) H.tick(1);
    const kol: any = H.npcNear('arenamage1', 2540, 4716, 0);
    (p as any).teleport(kol.x + 1, kol.z, kol.level);
    H.tick(1);
    H.clearInv(p);
    H.give(p, 'zamorak_cape', 1);
    H.clearLogs();
    H.opNpc(p, kol, 1);
    A.drive(p, ['imbue my god cape'], 6);
    check('  the cape comes back imbued', H.invCount(p, 'imbued_zamorak_cape'), 1);
    check('    and the plain one is gone', H.invCount(p, 'zamorak_cape'), 0);
    check('    recorded, so the next one costs', getv(p, 'magearena2'), MA2_IMBUED);
    H.despawn(p);
}

console.log(`\n${R.ok} ok, ${R.bad} FAIL`);
process.exit(R.bad ? 1 : 0);
