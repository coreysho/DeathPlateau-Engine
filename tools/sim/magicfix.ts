// Three magic-combat bugs reported from play - run with `npx tsx tools/sim/magicfix.ts`.
//
//   blood spells   the four Ancient Blood spells heal the caster for 25% of the damage the spell
//                  deals, on a monster AND on a player, off the ROLL (so the killing blow heals
//                  too), landing with the hitsplat, and never past the caster's own maximum
//                  hitpoints - https://oldschool.runescape.wiki/w/Blood_spells
//   staff styles   the staff combat tab has five options, not three: Bash/Pound/Focus, a Spell box
//                  that trains Magic alone (2 xp per point of damage) and a Spell box that casts
//                  defensively (1.33 Magic + 1 Defence), manual cast and autocast alike
//                  https://oldschool.runescape.wiki/w/Defensive_casting
//   dead targets   no cast is started at a monster that is already dead or mid-death, and no runes
//                  are spent on one
import * as H from './harness.ts';
import World from '#/engine/World.js';
import Npc from '#/engine/entity/Npc.js';
import Player from '#/engine/entity/Player.js';

await H.boot();
H.loginOrder();
let ok = 0, bad = 0, n = 0;
const check = (what: string, got: unknown, want: unknown) => {
    const pass = JSON.stringify(got) === JSON.stringify(want);
    pass ? ok++ : bad++;
    console.log(`  ${pass ? 'ok  ' : 'FAIL'} ${what}: ${JSON.stringify(got)}${pass ? '' : `   (want ${JSON.stringify(want)})`}`);
};

const HP = 3, DEF = 1, MAG = 6;
const RUNES = ['airrune', 'waterrune', 'earthrune', 'firerune', 'mindrune', 'chaosrune', 'deathrune', 'bloodrune', 'soulrune'];
const BLOOD_BLITZ = 206, FIRE_WAVE = 15, WIND_STRIKE = 51;
const FIRE_WAVE_XP = 425; // magic_combat_spells.dbrow: the cast itself, all of it Magic

/** A maxed player with a staff and every rune, standing exactly where asked. */
function mage(x = 3090, z = 3300): any {
    const p: any = H.makePlayer('mgfx' + n, x, z, 60 + (n % 20));
    n++;
    H.tick(2);
    H.maxOut(p);
    H.clearInv(p);
    H.equip(p, { rhand: 'staff_of_air' });
    for (const r of RUNES) H.give(p, r, 5000);
    H.setVar(p, 'tutorial', 1000); // ^tutorial_complete - below it combat xp goes through ~tutorial_give_xp
    H.tick(1);
    return p;
}

/**
 * Clear the board between fights. Without it every fight of a loop leaves a player still
 * autocasting at a monster still standing, and the next fight reads its hitsplats off a log that
 * has somebody else's in it.
 */
function done(...things: (Player | Npc)[]) {
    for (const t of things) {
        if (t instanceof Npc) World.removeNpc(t, 0);
        else H.despawn(t);
    }
    H.tick(1);
}

// ---------------------------------------------------------------- blood spells
console.log('BLOOD SPELLS HEAL THE CASTER');
{
    // Hurt, so a heal has somewhere to go. One cast per fight, and a cast can splash, so this keeps
    // going until three have landed hard enough to be worth a whole point of healing.
    const heals: { tick: number; amount: number }[] = [];
    const landed: { tick: number; damage: number }[] = [];
    for (let i = 0; i < 40 && landed.length < 3; i++) {
        const p = mage();
        H.setVar(p, 'spellbook', 1);
        p.levels[HP] = 40;
        const npc = H.addNpc('mossgiant', p.x + 3, p.z);
        H.tick(1);
        H.clearLogs();
        H.castOnNpc(p, npc, 'ancient_magic:blood_blitz');
        const rises: { tick: number; amount: number }[] = [];
        let hp = p.levels[HP];
        for (let t = 0; t < 6; t++) {
            H.tick(1);
            if (p.levels[HP] > hp) rises.push({ tick: World.currentTick, amount: p.levels[HP] - hp });
            hp = p.levels[HP];
        }
        // a hit of 1-3 is a heal of 0, which nothing can see
        const hit = H.npcHits.filter(h => Math.floor((h.damage * 25) / 100) > 0);
        done(p, npc);
        if (hit.length !== 1) continue;
        landed.push(hit[0]);
        heals.push(...rises);
    }
    check('a Blood Blitz that hits heals the caster', landed.length, 3);
    check('  by a quarter of the damage it dealt', heals.map(h => h.amount), landed.map(h => Math.floor((h.damage * 25) / 100)));
    check('  on the tick the hitsplat lands, not the tick of the cast', heals.map(h => h.tick), landed.map(h => h.tick));
}
{
    // at full hitpoints there is nothing to heal: stat_heal never goes past the base level
    const p = mage();
    H.setVar(p, 'spellbook', 1);
    H.setVarBit(p, 'autocast_set', 1);
    H.setVarBit(p, 'autocast_spell', BLOOD_BLITZ);
    const npc = H.addNpc('mossgiant', p.x + 3, p.z);
    H.tick(1);
    H.attackNpc(p, npc);
    let over = false;
    for (let t = 0; t < 12; t++) {
        H.tick(1);
        if (p.levels[HP] > p.baseLevels[HP]) over = true;
    }
    check('at full hitpoints the heal is capped at the maximum', over, false);
    done(p, npc);
}
{
    // THE KILLING BLOW. The heal used to be taken from the damage AFTER it was trimmed to the
    // monster's remaining hitpoints, so the cast that finished something off healed nothing.
    let healedOnKills = 0, kills = 0;
    for (let i = 0; i < 300 && kills < 60; i++) {
        const p = mage();
        H.setVar(p, 'spellbook', 1);
        H.setVarBit(p, 'autocast_set', 1);
        H.setVarBit(p, 'autocast_spell', BLOOD_BLITZ);
        p.levels[HP] = 40;
        const npc = H.addNpc('chicken', p.x + 2, p.z);
        H.tick(1);
        const before = p.levels[HP];
        H.attackNpc(p, npc);
        for (let t = 0; t < 10 && npc.levels[HP] > 0; t++) H.tick(1);
        const killed = npc.levels[HP] === 0;
        if (killed) H.tick(3);
        const healed = p.levels[HP] > before;
        done(p, npc);
        if (!killed) continue; // splashed every cast - nothing to say about this one
        kills++;
        if (healed) healedOnKills++;
    }
    // A chicken has 3 hitpoints, so the OLD heal - a quarter of the damage after it was trimmed to
    // what the target had left - was 0 on every one of these, every time. Now it is a quarter of the
    // roll, which a Blood Blitz only fails to reach a whole point of on a roll of 0-3 out of 0-25.
    check('the blow that kills heals too - off the roll, not the hitpoints left', [kills, healedOnKills > (kills * 3) / 4], [60, true]);
}
{
    // PvP: this side of combat had no heal at all until now. Deep wilderness, both maxed.
    let healed = -1, dealt = -1;
    for (let i = 0; i < 25 && dealt < 0; i++) {
        const a = mage(3100, 3700);
        const b = mage(3102, 3700);
        H.setVar(a, 'spellbook', 1);
        a.levels[HP] = 40;
        H.tick(2);
        H.clearLogs();
        H.castOnPlayer(a, b, 'ancient_magic:blood_blitz');
        // b hits back, so only the FIRST rise in the caster's hitpoints is the heal
        let rise = -1, hp = a.levels[HP];
        for (let t = 0; t < 6; t++) {
            H.tick(1);
            if (rise < 0 && a.levels[HP] > hp) rise = a.levels[HP] - hp;
            hp = a.levels[HP];
        }
        const hit = H.hits.filter(h => h.who === b.username && h.damage > 0);
        done(a, b);
        if (hit.length === 0 || Math.floor((hit[0].damage * 25) / 100) === 0) continue;
        dealt = hit[0].damage;
        healed = rise;
    }
    check('a Blood Blitz on another player lands', dealt > 0, true);
    check('  and heals the caster a quarter of it', healed, Math.floor((dealt * 25) / 100));
}

// ---------------------------------------------- the staff tab's two Spell options
console.log('\nSTAFF COMBAT OPTIONS');
{
    const p = mage();
    H.ifButton(p, 'combat_staff_2:auto_cast');
    H.ifButton(p, 'staff_spells:ssb0'); // Wind Strike
    check('the plain Spell box arms autocast on a magic style', [H.getVar(p, 'com_mode'), H.getVarBit(p, 'autocast_set'), H.getVarBit(p, 'autocast_spell')], [3, 1, WIND_STRIKE]);
    check('  which casts rather than swings, for Magic xp', [H.getVar(p, 'damagetype'), H.getVar(p, 'damagestyle')], [4, 7]);
    H.ifButton(p, 'combat_staff_2:auto_defensive');
    H.ifButton(p, 'staff_spells:ssb0');
    check('the defensive Spell box is the fifth style', [H.getVar(p, 'com_mode'), H.getVarBit(p, 'autocast_set')], [4, 1]);
    check('  Magic and Defence', [H.getVar(p, 'damagetype'), H.getVar(p, 'damagestyle')], [4, 8]);
    H.ifButton(p, 'combat_staff_2:staff2a'); // Bash
    check('picking Bash turns autocast off, as Old School does', [H.getVar(p, 'com_mode'), H.getVarBit(p, 'autocast_set')], [0, 0]);
    check('  and the spell is remembered for the next time', H.getVarBit(p, 'autocast_spell'), WIND_STRIKE);
    check('  and the staff swings again', H.getVar(p, 'damagetype'), 2); // ^crush_style
    done(p);
}
{
    // A Spell style with nothing armed - the picker was cancelled, or the runes ran out and the
    // spell was dropped mid-fight. Swinging from there would roll the MAGIC attack roll and a max hit
    // that was never worked out for it, so the tab goes back to Bash first (player_combat.rs2).
    const p = mage();
    H.setVar(p, 'com_mode', 4);
    H.runProc(p, '[proc,player_combat_stat]');
    const npc = H.addNpc('mossgiant', p.x + 1, p.z);
    H.tick(1);
    H.attackNpc(p, npc);
    H.tick(3);
    check('a Spell style with no spell armed falls back to Bash and swings', [H.getVar(p, 'com_mode'), H.getVar(p, 'damagetype')], [0, 2]);
    done(p, npc);
}

/** One Fire Wave at a fresh monster on combat-tab style $style: the xp it paid and the damage. */
function castFor(style: number, manual: boolean) {
    const p = mage();
    H.setVar(p, 'com_mode', style);
    H.runProc(p, '[proc,player_combat_stat]');
    if (!manual) {
        H.setVarBit(p, 'autocast_set', 1);
        H.setVarBit(p, 'autocast_spell', FIRE_WAVE);
    }
    const npc = H.addNpc('mossgiant', p.x + 3, p.z);
    H.tick(1);
    H.clearLogs();
    const mag = p.stats[MAG], def = p.stats[DEF];
    if (manual) H.castOnNpc(p, npc, 'magic:fire_wave');
    else H.attackNpc(p, npc);
    for (let t = 0; t < 6; t++) H.tick(1);
    const hit = H.npcHits;
    const out = { magic: p.stats[MAG] - mag, defence: p.stats[DEF] - def, damage: hit.length === 1 && hit[0].damage > 0 ? hit[0].damage : -1 };
    done(p, npc);
    return out;
}

/** A cast that connected exactly once, so there is a damage number to check the xp split against. */
function hitFor(style: number, manual: boolean) {
    for (let i = 0; i < 30; i++) {
        const r = castFor(style, manual);
        if (r.damage > 0) return r;
    }
    throw new Error('never connected');
}
{
    const a = hitFor(3, false);
    check('autocast on the plain Spell style: 2 Magic xp per point of damage', [a.defence, a.magic], [0, FIRE_WAVE_XP + a.damage * 20]);
    const b = hitFor(4, false);
    check('autocast on the defensive Spell style: 1.33 Magic and 1 Defence', [b.defence, b.magic], [b.damage * 10, FIRE_WAVE_XP + Math.floor((b.damage * 10 * 133) / 100)]);
    const c = hitFor(4, true);
    check('a MANUAL cast on it splits the xp the same way', [c.defence, c.magic], [c.damage * 10, FIRE_WAVE_XP + Math.floor((c.damage * 10 * 133) / 100)]);
    const d = hitFor(2, true);
    check('a manual cast on Focus - a MELEE style - is not a defensive cast', [d.defence, d.magic], [0, FIRE_WAVE_XP + d.damage * 20]);
}

// ------------------------------------------------- no cast at something already dead
console.log('\nNOTHING IS CAST AT A CORPSE');
{
    // A chicken EIGHT TILES OFF dies to one Fire Wave. Eight, because this is a timing window: the
    // hitsplat that takes a monster to 0 arrives several ticks after the cast that caused it, and the
    // autocast queued by that same cast can come due on the very tick it lands. The engine drops an
    // interaction with a monster the moment its death script DELAYS it, which is the tick after - so
    // what was left over was the tick in between: 0 hitpoints, not delayed yet, still a valid target.
    // Twelve of a hundred and seventeen kills paid runes for a cast into a corpse there before this
    // (the same loop with the check taken back out of ~pvm_combat_spell_checks).
    let kills = 0, castsAtACorpse = 0;
    for (let i = 0; i < 120; i++) {
        const p = mage();
        H.setVarBit(p, 'autocast_set', 1);
        H.setVarBit(p, 'autocast_spell', FIRE_WAVE);
        const npc = H.addNpc('chicken', p.x + 8, p.z);
        H.tick(1);
        H.attackNpc(p, npc);
        let runes = H.invCount(p, 'bloodrune'); // one per Fire Wave
        let died = false;
        for (let t = 0; t < 16; t++) {
            H.tick(1);
            const now = H.invCount(p, 'bloodrune');
            const cast = now < runes;
            runes = now;
            if (npc.levels[HP] === 0) died = true;
            if (cast && npc.levels[HP] === 0) castsAtACorpse++;
        }
        done(p, npc);
        if (died) kills++;
    }
    check('a chicken killed by Fire Wave from eight tiles, over and over', kills > 100, true);
    check('  not one cast is paid for on or after the tick it reaches 0 hitpoints', castsAtACorpse, 0);
}

console.log(`\n${ok} ok, ${bad} FAIL`);
process.exit(bad ? 1 : 0);
