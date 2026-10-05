// THE OWNER'S NINE PK KITS, spawned on the real engine - npx tsx tools/sim/pkkits.ts
//
// A kit is a list of obj NAMES, and a name that does not resolve is not a compile error: the kit
// sits in the file looking right and the bot either spawns without the piece or does not spawn at
// all. Five of these nine name items this build calls something other than their Old School name
// (RFD gauntlets for gloves, viking_helmet for a berserker helm, secret_ghost_* for ghostly robes,
// magictraining_bookofmagic for a mage's book), so "it is spelled correctly" is the first thing
// worth proving and the easiest to get wrong.
//
// Then the rules the kits were written to, which are the owner's and not the engine's: 99
// Hitpoints and 52 Prayer on all nine, an Armadyl godsword only where Attack can wield one, an
// inventory that fits in 28 slots, and the right spellbook actually reaching the varp.
import * as H from './harness.ts';
import { check, R } from './a1lib.ts';
import ObjType from '#/cache/config/ObjType.js';
import InvType from '#/cache/config/InvType.js';
import Environment from '#/util/Environment.js';
import BotManager from '#/engine/bot/BotManager.js';
import BotPlayer from '#/engine/bot/BotPlayer.js';
import { DEFAULT_BOT_CONFIG } from '#/engine/bot/BotConfig.js';
import { getVarp } from '#/engine/bot/BotBrain.js';
import { BOT_KITS } from '#/engine/bot/BotKits.js';
import { PlayerStat } from '#/engine/entity/PlayerStat.js';
import type Player from '#/engine/entity/Player.js';

/**
 * Levels AND the combat level they add up to, as bots.ts does it.
 *
 * Writing the level arrays alone leaves combatLevel at 3, and canAttack() compares combat levels -
 * so a "maxed" victim read as 117 levels below the bot and got walked past. That is what made this
 * file report that Vengeance and the Dharok switch were both broken when neither was.
 */
const setStats = (p: Player, levels: Partial<Record<PlayerStat, number>>) => {
    for (const [stat, lvl] of Object.entries(levels)) p.setLevel(Number(stat), lvl as number);
    p.combatLevel = p.getCombatLevel();
};

await H.boot();
Environment.NODE_BOTS = true;
BotManager.start({ ...DEFAULT_BOT_CONFIG, roamers: { low: 0, mid: 0, high: 0, max: 0 }, pkers: 0 });
// MELEE BOTS ARE PENNED unless this is cleared: areaFor() hands a melee kit config.meleeArea in
// place of its bracket's range, so the two melee kits below would not count a victim standing
// outside that pen as attackable at all - and the first run of this reported, wrongly, that
// neither Vengeance nor the Dharok switch worked. bots.ts clears it before its PKer tests too.
BotManager.config.meleeArea = null;

const MINE = BOT_KITS.filter(k => k.id.startsWith('pk-'));
console.log(`${MINE.length} kits added from the loadout screenshots`);
check('  all nine are there', MINE.length, 9);

// ---------------------------------------------------------------- every name resolves
console.log('\nEVERY PIECE IS A REAL OBJ');
const bad: string[] = [];
for (const k of MINE) {
    const names = [...k.worn, ...k.inv.map(i => i[0]), k.food,
        ...(k.wornAmmo ? [k.wornAmmo[0]] : []),
        ...(k.specWeapon ? [k.specWeapon] : []),
        ...(k.lowHpWeapon ? [k.lowHpWeapon] : []),
        ...(k.mageSet ?? []), ...(k.meleeSet ?? []),
        ...k.dropExtras.map(d => d[0])];
    for (const n of names) if (ObjType.getId(n) === -1) bad.push(`${k.id}: ${n}`);
}
for (const b of bad) console.log('  ' + b);
check('  no kit names an obj this build does not have', bad.length, 0);

// ---------------------------------------------------------------- the owner's rules
console.log('\nTHE RULES THEY WERE WRITTEN TO');
const H99 = MINE.filter(k => k.stats[PlayerStat.HITPOINTS] !== 99).map(k => k.id);
check('  99 hitpoints on all nine', H99.length ? H99.join(' ') : 'yes', 'yes');
const P52 = MINE.filter(k => k.stats[PlayerStat.PRAYER] !== 52).map(k => k.id);
check('  52 prayer, which is Smite', P52.length ? P52.join(' ') : 'yes', 'yes');
check('  all nine are pkers', MINE.every(k => k.kinds.length === 1 && k.kinds[0] === 'pker'), true);

// An Armadyl godsword needs 75 Attack. A kit under that has to spec with something else, or it
// carries a sword it can never draw.
const wrongSpec = MINE.filter(k => {
    const att = k.stats[PlayerStat.ATTACK] ?? 1;
    return att >= 75 ? k.specWeapon !== 'armadyl_godsword' : k.specWeapon === 'armadyl_godsword';
}).map(k => `${k.id} (${k.stats[PlayerStat.ATTACK]} att, ${k.specWeapon})`);
for (const w of wrongSpec) console.log('  ' + w);
check('  the godsword only where Attack can wield it', wrongSpec.length, 0);

// 28 slots, and the food has to fit in what the rest leaves.
const over = MINE.filter(k => k.inv.length + k.foodCount > 28)
    .map(k => `${k.id}: ${k.inv.length} + ${k.foodCount} food`);
for (const o of over) console.log('  ' + o);
check('  every inventory fits in 28 slots', over.length, 0);
check('  and they all eat manta rays', MINE.every(k => k.food === 'mantaray'), true);

// ---------------------------------------------------------------- on the real engine
console.log('\nEACH ONE SPAWNS AND IS WEARING ITS KIT');
const BOOK: Record<string, number> = { normal: 0, ancient: 1, lunar: 2 };
for (const k of MINE) {
    const bot = BotManager.spawn('pker', { kitId: k.id, at: { x: 3200, z: 3200, level: 0 }, manual: true }) as BotPlayer;
    if (!bot) { check(`  ${k.id.padEnd(22)} spawned`, false, true); continue; }
    H.tick(2);
    const worn = bot.getInventory(InvType.WORN)!;
    let on = 0;
    for (let i = 0; i < worn.capacity; i++) if (worn.get(i)) on++;
    // wornAmmo is a piece too: the kit lists it apart from `worn` only because it has a count
    const want = k.worn.length + (k.wornAmmo ? 1 : 0);
    check(`  ${k.id.padEnd(22)} wearing ${want}`, on, want);
    check(`  ${''.padEnd(22)} spellbook ${k.spellbook ?? 'normal'}`, getVarp(bot, 'spellbook'), BOOK[k.spellbook ?? 'normal']);
    BotManager.despawn(bot);
    H.tick(1);
}

// ---------------------------------------------------------------- the two new behaviours
// BOTH OF THESE ARE NEW ENGINE CODE, so a clean kit list proves nothing about them. A bot that
// never casts and a bot that never switches look exactly like a bot that is simply fighting.
console.log('');
console.log('VENGEANCE, WHICH IS A SPELL CAST ON NOBODY');
{
    const victim = H.makePlayer('vengvictim', 3160, 3668);
    H.tick(2);
    // MAXED, because a PKer only attacks inside a combat-level range and both these kits are 126.
    // A 70s victim is sixty levels below them and gets walked past, which is what made the first
    // run of this report that neither behaviour worked.
    setStats(victim, { [PlayerStat.ATTACK]: 99, [PlayerStat.STRENGTH]: 99, [PlayerStat.DEFENCE]: 99, [PlayerStat.HITPOINTS]: 99, [PlayerStat.RANGED]: 99, [PlayerStat.MAGIC]: 99, [PlayerStat.PRAYER]: 99 });
    const bot = BotManager.spawn('pker', { kitId: 'pk-max-melee-verac', at: { x: 3164, z: 3668, level: 0 }, manual: true }) as BotPlayer;
    let engaged = false;
    for (let t = 0; t < 40 && !engaged; t++) {
        H.tick(1);
        engaged = BotManager.stateOf(bot)?.pvpTarget != null;
    }
    check('  it finds someone to fight', engaged, true);
    let cast = false;
    for (let t = 0; t < 60 && !cast; t++) {
        H.tick(1);
        if (getVarp(bot, 'vengeance') === 1) cast = true;
    }
    check('  a lunar kit vengeances itself in a fight', cast, true);
    if (bot) BotManager.despawn(bot);
    H.despawn(victim);
    H.tick(3);
}

console.log('');
console.log('AND THE DHAROK SWITCH, WHICH WAITS ON ITS OWN HEALTH');
{
    const victim = H.makePlayer('dharokvictim', 3160, 3668);
    H.tick(2);
    // MAXED, because a PKer only attacks inside a combat-level range and both these kits are 126.
    // A 70s victim is sixty levels below them and gets walked past, which is what made the first
    // run of this report that neither behaviour worked.
    setStats(victim, { [PlayerStat.ATTACK]: 99, [PlayerStat.STRENGTH]: 99, [PlayerStat.DEFENCE]: 99, [PlayerStat.HITPOINTS]: 99, [PlayerStat.RANGED]: 99, [PlayerStat.MAGIC]: 99, [PlayerStat.PRAYER]: 99 });
    const bot = BotManager.spawn('pker', { kitId: 'pk-max-dharok', at: { x: 3164, z: 3668, level: 0 }, manual: true }) as BotPlayer;
    H.tick(3);
    const held = () => {
        const w = bot.getInventory(InvType.WORN)!.get(3);
        return w ? (ObjType.get(w.id).debugname ?? '?') : '-';
    };
    check('  it opens on the whip, at full health', held(), 'abyssal_whip');
    // WAIT FOR THE FIGHT FIRST. manageLowHpWeapon only runs from fightPlayer, so forcing the health
    // down before the bot has found anyone just burns the budget while it is still walking over -
    // which is what made this report a failure that the same code passed in isolation.
    let engaged = false;
    for (let t = 0; t < 40 && !engaged; t++) {
        H.tick(1);
        engaged = BotManager.stateOf(bot)?.pvpTarget != null;
    }
    check('  it finds someone to fight', engaged, true);
    let swapped = false;
    for (let t = 0; t < 40 && !swapped; t++) {
        // held near death, which is the whole point of a Dharok set: 40% of 99 is 39
        bot.levels[PlayerStat.HITPOINTS] = 20;
        H.tick(1);
        if (held() === 'barrows_dharok_weapon') swapped = true;
    }
    check('  and takes the axe out once it is nearly dead', swapped, true);
    if (bot) BotManager.despawn(bot);
    H.despawn(victim);
    H.tick(3);
}

console.log(`\n${R.ok} ok, ${R.bad} FAIL`);
process.exit(R.bad ? 1 : 0);
