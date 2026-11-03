import fs from 'fs';
import path from 'path';

import InvType from '#/cache/config/InvType.js';
import ObjType from '#/cache/config/ObjType.js';
import VarBitType from '#/cache/config/VarBitType.js';
import VarPlayerType from '#/cache/config/VarPlayerType.js';
import { setVarp } from '#/engine/bot/BotBrain.js';
import type BotPlayer from '#/engine/bot/BotPlayer.js';
import { PLAYER_STAT_COUNT, PlayerStat } from '#/engine/entity/PlayerStat.js';
import Environment from '#/util/Environment.js';
import { printInfo, printWarning } from '#/util/Logger.js';

// custom (2026-11-02) - WHO the fuzzer is, as opposed to what it clicks.
//
// THE MEASUREMENT THAT MADE THIS NECESSARY. Eight fuzzers, 3,545 ticks, coverage-guided, on the
// build of 2 November: 238 of 15,410 triggers reached. 1.5%, and the curve was flat - 154 triggers
// by tick 545 and 238 by tick 3,545, which is five new triggers per hundred ticks and falling. At
// that rate half the content is reached some time in 1933.
//
// The bots were not short of clicks. They took about 8,000 actions each. They were short of being
// anybody. A fuzzer came out of BotManager.outfit with a combat kit, 24 everyday tools, and every
// quest varp in the game at zero except the four that gate dragon weapons. So:
//
//   - every quest is at stage 0, so every [opnpc1] on every quest npc gets the stage-0 branch and
//     nothing else, forever. 106 quests, and the fuzzer can only ever see the first line of each.
//   - every door, gate, ladder and cave mouth a quest opens is shut, so whole regions of the map
//     are not merely unvisited, they are unreachable on foot - which is how the fuzzer stayed in
//     Lumbridge: there was nowhere else it could get to.
//   - it holds 24 of some 4,000 obj types, so [opheld2] (1,200 triggers - every Wear and Wield in
//     the game) can only fire for the handful it happens to carry, and [opheldu] (524) needs BOTH
//     halves of a recipe to be in the same backpack by luck.
//   - its stats are a combat kit's, so every skill gate above the kit's level is shut.
//
// A persona fixes all four at the point of spawn, which costs one spawn's worth of work and buys
// content no amount of extra clicking could reach. Seeded from the bot's own fuzz seed, so a run
// still replays: the same seed gives the same persona.
//
// WHY STAGES ARE RANDOM RATHER THAN ALL COMPLETE. A completed quest closes content too: the npc
// stops offering the quest dialogue, the cutscene loc goes inert, the reward is already taken. The
// interesting states are the middle ones, and a fleet of bots wants to be spread across them. So
// each bot rolls each quest independently, weighted towards "somewhere in the middle", and one bot
// in four is given everything complete so that post-quest content gets a visitor too.
//
// AND WHY ONE OF THEM IS DELIBERATELY FEEBLE. 'weak' has the quests and the items and combat stats
// of 1, and it exists because of Npc.huntPlayers:
//
//     if (hunt.checkNotTooStrong === OUTSIDE_WILDERNESS && !player.isInWilderness()
//         && player.combatLevel > type.vislevel * 2) continue;
//
// A monster will not hunt a player more than twice its own level. A rolled 'mid' persona averages
// somewhere around combat level 70 and a 'done' one is 126, so outside the Wilderness almost
// nothing in the game will come near either of them - and [ai_queue*] (769 triggers for queue 3
// alone), [ai_opplayer2] (175) and [ai_applayer2] (132) all fire from an npc deciding to engage.
// Roughly eleven hundred triggers in this build are reachable only by being weak enough to be worth
// attacking.

export type PersonaKind = 'fresh' | 'weak' | 'mid' | 'done';

/**
 * The stats that go into Player.getCombatLevel. A 'weak' persona holds these at 1 and rolls the
 * rest, because what makes a monster refuse to hunt you is your COMBAT level and nothing else.
 */
const COMBAT_STATS: ReadonlySet<number> = new Set([PlayerStat.ATTACK, PlayerStat.STRENGTH, PlayerStat.DEFENCE, PlayerStat.HITPOINTS, PlayerStat.PRAYER, PlayerStat.RANGED, PlayerStat.MAGIC]);

/** One quest, as questvarps.json describes it: the varp that tracks it and its completed value. */
type QuestVarp = { name: string; varp: string; value: number };

let questTable: QuestVarp[] | null = null;

/**
 * The quest table, out of the CONTENT repo rather than the cache: questvarps.json is the quest
 * interface's own source of truth (106 quests, each with the varp it tracks and the value that
 * means complete), and nothing else in the build lists them. If it cannot be read the personas
 * simply have no quest progress, which is the behaviour this file replaces - never a failed spawn.
 */
function quests(): QuestVarp[] {
    if (questTable) {
        return questTable;
    }
    questTable = [];
    const file = path.join(Environment.BUILD_SRC_DIR, 'questvarps.json');
    try {
        const raw: unknown = JSON.parse(fs.readFileSync(file, 'utf8'));
        if (Array.isArray(raw)) {
            for (const row of raw) {
                const r = row as { name?: unknown; varp?: unknown; value?: unknown };
                if (typeof r.varp === 'string' && typeof r.value === 'number' && VarPlayerType.getId(r.varp) !== -1) {
                    questTable.push({ name: typeof r.name === 'string' ? r.name : r.varp, varp: r.varp, value: r.value });
                }
            }
        }
        printInfo(`bot personas: ${questTable.length} quests from ${file}`);
    } catch (err) {
        printWarning(`bot personas: no quest table at ${file} - fuzzers will have no quest progress (${String((err as { message?: unknown })?.message ?? err)})`);
    }
    return questTable;
}

/**
 * Every obj a player could plausibly be holding: it exists, it has a name, and it is not a
 * placeholder, a cert template or a members item on a free world. Worked out once.
 *
 * The point of the list is [opheld1..5] and [opheldu]: 2,400-odd triggers that only fire for an obj
 * the bot is actually carrying, and the old 24-item kit could reach about twenty of them.
 */
let carriable: number[] | null = null;
function carriableObjs(): number[] {
    if (carriable) {
        return carriable;
    }
    carriable = [];
    for (let id = 0; id < ObjType.count; id++) {
        const type = ObjType.get(id);
        if (!type || !type.debugname) {
            continue;
        }
        // A cert template is the note graphic, not an item; a dummy has no business in a backpack.
        if (type.certtemplate !== -1) {
            continue;
        }
        if (type.members && !Environment.NODE_MEMBERS) {
            continue;
        }
        carriable.push(id);
    }
    return carriable;
}

/** The tools and materials most of the skilling content asks for - kept from the old stockFuzzer. */
const STAPLES: Record<string, number> = {
    coins: 1000000,
    tinderbox: 1,
    knife: 1,
    bronze_axe: 1,
    bronze_pickaxe: 1,
    hammer: 1,
    chisel: 1,
    needle: 1,
    thread: 100,
    net: 1,
    bucket_empty: 1,
    jug_empty: 1,
    pot_empty: 1,
    vial_empty: 1,
    spade: 1,
    logs: 10,
    bones: 5,
    bucket_water: 1,
    airrune: 1000,
    mindrune: 1000,
    earthrune: 1000,
    waterrune: 1000,
    firerune: 1000,
    bodyrune: 1000,
    lawrune: 100,
    naturerune: 100,
    chaosrune: 500,
    deathrune: 100,
    cosmicrune: 100,
    grain: 5,
    clay: 5
};

/** A seeded roll, so a persona is part of the replay rather than a surprise. */
type Roll = { int(min: number, max: number): number; next(): number };

/**
 * Give a fuzzer a life. Called from BotManager right after outfit(), so it overwrites the kit's
 * stats and adds to the kit's inventory rather than fighting it.
 *
 * Returns a one-line description, which goes in the run's log and in a finding's replay line: a
 * finding that only reproduces at a particular persona is useless without it.
 */
export function applyPersona(bot: BotPlayer, rng: Roll, kind: PersonaKind): string {
    if (kind === 'fresh') {
        // Deliberately kept: a tutorial-fresh account with nothing is the state most of the
        // "requirements" branches in the content are written against, and it is the one state the
        // old fuzzer DID cover. One bot in a fleet should still be it.
        return 'fresh (kit stats, no quests)';
    }

    // ---- stats. 'done' is a maxed account; 'mid' rolls each skill, which is what spreads a fleet
    // across the level gates rather than putting them all on one side of every one; 'weak' is
    // feeble on purpose, so that monsters will hunt it - see the note at the top of this file.
    let statNote: string;
    if (kind === 'done') {
        for (let stat = 0; stat < PLAYER_STAT_COUNT; stat++) {
            bot.setLevel(stat, 99);
        }
        statNote = 'all 99';
    } else if (kind === 'weak') {
        for (let stat = 0; stat < PLAYER_STAT_COUNT; stat++) {
            // Non-combat skills are still rolled: a weak persona is about being ATTACKABLE, not
            // about failing every skill gate as well.
            bot.setLevel(stat, COMBAT_STATS.has(stat) ? 1 : rng.int(1, 99));
        }
        bot.setLevel(PlayerStat.HITPOINTS, 10);
        // Agility is not combat and it is what keeps the bot moving rather than walking all run.
        bot.setLevel(PlayerStat.AGILITY, Math.max(bot.levels[PlayerStat.AGILITY], 60));
        statNote = 'combat 1 on purpose (huntable)';
    } else {
        for (let stat = 0; stat < PLAYER_STAT_COUNT; stat++) {
            bot.setLevel(stat, rng.int(1, 99));
        }
        // Hitpoints and Agility are not free to roll low: at 10 hitpoints a fuzzer dies to the first
        // thing it right-clicks and spends the run respawning, and at Agility 1 it spends it walking.
        bot.setLevel(PlayerStat.HITPOINTS, Math.max(bot.levels[PlayerStat.HITPOINTS], 50));
        bot.setLevel(PlayerStat.AGILITY, Math.max(bot.levels[PlayerStat.AGILITY], 60));
        statNote = 'rolled stats';
    }
    bot.combatLevel = bot.getCombatLevel();

    // ---- quests. This is the one that matters: a stage-0 account cannot see past the first line of
    // any of the 106 quests, and cannot walk through any door one of them opens.
    const table = quests();
    let moved = 0;
    for (const quest of table) {
        let value: number;
        if (kind === 'done') {
            value = quest.value;
        } else {
            const roll = rng.next();
            // A quarter untouched, half somewhere in the middle, a quarter finished. The middle is
            // where the content is - a finished quest's npc stops offering it.
            if (roll < 0.25) {
                continue;
            } else if (roll < 0.75) {
                value = rng.int(1, Math.max(1, quest.value));
            } else {
                value = quest.value;
            }
        }
        setVarp(bot, quest.varp, value);
        moved++;
    }
    // The varbit-tracked ones the kits already knew about, which questvarps.json does not list.
    const dt = VarBitType.getByName('deserttreasure');
    if (dt) {
        bot.setVarBit(dt.id, kind === 'done' ? 15 : rng.int(0, 15));
    }

    // ---- items. A sample of the whole obj table, which is the only way [opheld*] and [opheldu] get
    // more than the twenty triggers the staple kit could reach. The backpack is 28 slots, so the
    // sample is small per bot and different per bot, and over a fleet and a few respawns it is the
    // table. The bank gets a much larger sample, because the bank has 800 slots and the fuzzer's
    // bank ops are how items get into the backpack later in the run.
    const inv = bot.getInventory(InvType.INV);
    const bankId = InvType.getId('bank');
    const pool = carriableObjs();
    let sampled = 0;
    // THE STAPLES GO IN THE BANK, not the backpack. The first cut of this put all 32 in the
    // backpack and left four slots for the random sample, which is the old 24-item kit with extra
    // steps - the whole point of the sample is that [opheld1..5] and [opheldu] are 2,400 triggers
    // that only fire for an obj the bot is holding. A handful of the tools come along because
    // without a tinderbox and a knife a great deal of the skilling content cannot start at all;
    // the rest are a bank withdraw away, which is a move the fuzzer makes anyway.
    const CARRIED_STAPLES = ['coins', 'tinderbox', 'knife', 'hammer', 'chisel', 'needle', 'thread', 'bucket_empty', 'airrune', 'mindrune'];
    for (const name of CARRIED_STAPLES) {
        const id = ObjType.getId(name);
        if (id !== -1 && inv) {
            bot.invAdd(InvType.INV, id, STAPLES[name] ?? 1);
        }
    }
    if (inv) {
        // Leave a few slots free: a recipe that produces an item into a full backpack is a different
        // test, and one the conservation watcher should not have to reason about on every window.
        while (inv.freeSlotCount > 4) {
            const id = pool[rng.int(0, pool.length - 1)];
            const type = ObjType.get(id);
            bot.invAdd(InvType.INV, id, type.stackable ? rng.int(1, 1000) : 1);
            sampled++;
        }
    }
    if (bankId !== -1) {
        for (const [name, count] of Object.entries(STAPLES)) {
            const id = ObjType.getId(name);
            if (id !== -1) {
                bot.invAdd(bankId, id, count);
            }
        }
        // 400 random objs in the bank. Withdrawing one is a legal move the fuzzer already makes, so
        // this is the pipe through which the rest of the obj table reaches the backpack over a run.
        for (let i = 0; i < 400; i++) {
            const id = pool[rng.int(0, pool.length - 1)];
            const type = ObjType.get(id);
            bot.invAdd(bankId, id, type.stackable ? rng.int(1, 10000) : rng.int(1, 5));
        }
    }

    return `${kind} (${statNote}, ${moved}/${table.length} quests moved, ${sampled} sampled objs + ${bankId !== -1 ? '400 banked' : 'no bank'})`;
}
