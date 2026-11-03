import fs from 'fs';
import path from 'path';

import InvType from '#/cache/config/InvType.js';
import NpcType from '#/cache/config/NpcType.js';
import ObjType from '#/cache/config/ObjType.js';
import VarBitType from '#/cache/config/VarBitType.js';
import VarPlayerType from '#/cache/config/VarPlayerType.js';
import type BotPlayer from '#/engine/bot/BotPlayer.js';
import { isZoneAllocated } from '#/engine/GameMap.js';
import { NpcStat } from '#/engine/entity/NpcStat.js';
import { PlayerStat } from '#/engine/entity/PlayerStat.js';
import DeadOps from '#/engine/script/DeadOps.js';
import World from '#/engine/World.js';
import Environment from '#/util/Environment.js';
import { printWarning } from '#/util/Logger.js';

// custom (2026-09-29) - the fuzzer's watchers.
//
// WHY THESE AND NOT ASSERTIONS. A fuzzer clicks things nobody wrote a test for, so it cannot be told
// what the content MEANT to happen - there is no expected value to compare against. What it can be
// told is what is wrong whatever the content meant: a script that threw, an input that stopped
// having any effect, a corpse that was never deleted, a player in a state the engine cannot
// represent, and items that appeared or vanished. Every one of those is a bug in any content.
//
// Script errors are not here: ScriptFaults (engine/script/ScriptFaults.ts) already sees every one,
// and the fuzzer turns it on for itself.

export type FindingKind = 'softlock' | 'corpse' | 'coord' | 'stat' | 'varp' | 'items' | 'deadop' | 'filler';

export type Finding = {
    sig: string;
    kind: FindingKind;
    detail: string;
    /** The seed and the action trail that reached it: a finding nobody can replay is a rumour. */
    seed: number;
    bot: string;
    trail: string[];
    tick: number;
    count: number;
};

function fnv1a(text: string): string {
    let hash = 0x811c9dc5;
    for (let i = 0; i < text.length; i++) {
        hash ^= text.charCodeAt(i);
        hash = (hash + ((hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24))) >>> 0;
    }
    return (hash >>> 0).toString(16).padStart(8, '0');
}

/** Where findings collect: deduped by kind and detail, counted, and written out as JSONL. */
class FuzzFindings {
    private readonly found: Map<string, Finding> = new Map();
    private file: string = '';

    setFile(file: string): void {
        this.file = file;
    }

    add(kind: FindingKind, detail: string, bot: BotPlayer, seed: number, trail: string[]): void {
        try {
            // The signature leaves the bot, the tick and the trail out: the same bug found twice by
            // two bots is one finding. The trail kept is the FIRST one, which is the shortest route
            // to it anyone has.
            const sig = fnv1a(kind + '|' + detail);
            const existing = this.found.get(sig);
            if (existing) {
                existing.count++;
                return;
            }
            const finding: Finding = { sig, kind, detail, seed, bot: bot.username, trail: [...trail], tick: World.currentTick, count: 1 };
            this.found.set(sig, finding);
            printWarning(`fuzz ${kind} ${sig}: ${detail}`);
            printWarning(`fuzz ${sig} replay: seed ${seed}, ${bot.username}, last actions: ${trail.join(' -> ') || '(none)'}`);
            this.flush();
        } catch {
            // A watcher that crashes the world it is watching is worse than no watcher.
        }
    }

    all(): Finding[] {
        return [...this.found.values()].sort((a, b) => b.count - a.count);
    }

    size(): number {
        return this.found.size;
    }

    clear(): number {
        const n = this.found.size;
        this.found.clear();
        this.flush();
        return n;
    }

    flush(): void {
        if (!this.file) {
            return;
        }
        try {
            const dir = path.dirname(this.file);
            if (dir && !fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
            const out = this.all().map(f => JSON.stringify(f));
            fs.writeFileSync(this.file, out.join('\n') + (out.length ? '\n' : ''), 'utf8');
        } catch {
            // as above
        }
    }
}

export const findings = new FuzzFindings();

// ------------------------------------------------------------------------------------------------

/** What a watcher needs to remember between ticks. One per fuzzing bot. */
export class WatchState {
    /** Where it was, what it was carrying and what was on screen, the last time anything changed. */
    lastChangeTick = 0;
    lastFingerprint = '';
    modalSince = -1;
    /** Ticks a queued script has been sitting at the same delay without the queue moving. */
    queueStuckSince = -1;
    lastQueueFingerprint = '';

    /** Item conservation: the running total per obj id, and the tick the baseline was taken. */
    baseline: Map<number, number> | null = null;
    baselineTick = 0;
    /** Item moves since the baseline, and when the last one was - see watchItemConservation. */
    moves = 0;
    lastMoveTick = 0;
    /** After a tainting action, the tick a new baseline may be taken. */
    settleUntil = 0;
    /** An action this window that is a known source or sink, so the window does not count. */
    tainted = true;
    lastXpTotal = 0;

    /** Npcs seen at zero hitpoints, and the tick each was first seen that way. */
    readonly dying: Map<number, number> = new Map();

    /** The last tick whose messages have been read, so a message is only judged once. */
    lastMessageTick = -1;
    /** The tick an engine "No trigger" line was seen on, so its "Nothing interesting" twin is not. */
    sawNoTrigger = -1;

    /** custom (2026-11-02) - the item-audit window: the tick it started, or -1 when not in one. */
    auditUntil = -1;
    auditBaseline: Map<number, number> | null = null;
    auditMoves = 0;
    /** Where the bot stood when the window opened; it must not move. See watchItemAudit. */
    auditAt = '';
    /** Consecutive ticks inside the window with nothing to move, so a starved window closes early. */
    auditIdle = 0;
}

// A soft-lock is "nothing I do has any effect", so it needs a while before it means anything: a
// content script can legitimately hold a player still for a long cutscene or a long craft.
const SOFTLOCK_TICKS = 120;
// A modal nothing can close. closeModal is called every tick the bot is in one, so a minute of it is
// not a slow dialogue, it is a dialogue with no way out.
const MODAL_STUCK_TICKS = 100;
// How long after its hitpoints reach zero an npc is allowed to stand there. The death script's own
// arrivedelay is two ticks and the drop table follows; ten is generous.
const CORPSE_TICKS = 10;
/** The mark in WatchState.dying for a corpse already reported, so it is not reported on every pass. */
const REPORTED = -1;
// How long after the last move the totals are compared, so a script with a delay in it has finished
// putting things where they go before anyone counts them.
const SETTLE_TICKS = 8;

/**
 * A fingerprint of everything the bot's own input is supposed to be able to change. If this is the
 * same for SOFTLOCK_TICKS while the bot keeps clicking, its clicks are going nowhere.
 */
function fingerprint(bot: BotPlayer): string {
    let parts = `${bot.x},${bot.z},${bot.level},${bot.modalState},${bot.levels[PlayerStat.HITPOINTS]},${bot.runenergy}`;
    const inv = bot.getInventory(InvType.INV);
    if (inv) {
        for (let i = 0; i < inv.capacity; i++) {
            const item = inv.get(i);
            if (item) {
                parts += `|${i}:${item.id}x${item.count}`;
            }
        }
    }
    let xp = 0;
    for (let i = 0; i < bot.stats.length; i++) {
        xp += bot.stats[i];
    }
    return parts + '#' + xp;
}

function queueFingerprint(bot: BotPlayer): string {
    let out = bot.activeScript ? `${bot.activeScript.script.name}@${bot.activeScript.execution}` : '-';
    for (const r of bot.queue.all()) {
        out += `|${r.script.name}:${r.delay}`;
    }
    return out;
}

/**
 * The bot stopped getting anywhere: no coord, inventory, stat, modal or energy change for two
 * minutes while its brain kept clicking. Either the content has it cornered or an input is being
 * swallowed - both worth a look.
 */
export function watchSoftLock(bot: BotPlayer, w: WatchState, seed: number, trail: string[]): void {
    const now = World.currentTick;
    const print = fingerprint(bot);
    if (print !== w.lastFingerprint) {
        w.lastFingerprint = print;
        w.lastChangeTick = now;
    } else if (now - w.lastChangeTick === SOFTLOCK_TICKS) {
        // `===` rather than `>=`: report the moment it crosses, then let it keep running. A bot that
        // is genuinely wedged would otherwise report every tick forever.
        findings.add('softlock', `no effect from any input for ${SOFTLOCK_TICKS} ticks at ${bot.x},${bot.z},${bot.level}`, bot, seed, trail);
    }

    // A modal it cannot get out of. Every tick it is in one the brain answers it, clicks through it,
    // presses one of its buttons or closes it (BotFuzzer.tickInner), so a hundred ticks of the same
    // modal is a dialogue that refuses, not one the bot has not got round to.
    if (bot.containsModalInterface()) {
        if (w.modalSince === -1) {
            w.modalSince = now;
        } else if (now - w.modalSince === MODAL_STUCK_TICKS) {
            findings.add('softlock', `a modal that will not close after ${MODAL_STUCK_TICKS} ticks (modalState ${bot.modalState}, script ${bot.activeScript?.script.name ?? 'none'})`, bot, seed, trail);
        }
    } else {
        w.modalSince = -1;
    }

    // A queued script that never resumes: the same queue, at the same delays, going nowhere. A
    // healthy queue either counts down or empties.
    const qprint = queueFingerprint(bot);
    if (qprint === '-') {
        w.queueStuckSince = -1;
    } else if (qprint !== w.lastQueueFingerprint) {
        w.lastQueueFingerprint = qprint;
        w.queueStuckSince = now;
    } else if (w.queueStuckSince !== -1 && now - w.queueStuckSince === SOFTLOCK_TICKS) {
        findings.add('softlock', `a queued script that never resumes: ${qprint}`, bot, seed, trail);
    }
}

/**
 * An npc at zero hitpoints that is still in the world CORPSE_TICKS later. This is exactly what the
 * live .npc_findhero fault caused: the abort took npc_del with it and the corpse stood there.
 */
export function watchCorpses(bot: BotPlayer, w: WatchState, seed: number, trail: string[]): void {
    const now = World.currentTick;
    for (let dx = -1; dx <= 1; dx++) {
        for (let dz = -1; dz <= 1; dz++) {
            const zone = World.gameMap.getZone(bot.x + dx * 8, bot.z + dz * 8, bot.level);
            for (const npc of zone.getAllNpcsSafe()) {
                if (!npc.isActive) {
                    continue;
                }
                if (npc.levels[NpcStat.HITPOINTS] > 0) {
                    w.dying.delete(npc.nid);
                    continue;
                }
                const since = w.dying.get(npc.nid);
                if (since === undefined) {
                    w.dying.set(npc.nid, now);
                } else if (since !== REPORTED && now - since >= CORPSE_TICKS) {
                    findings.add('corpse', `${NpcType.get(npc.type)?.debugname ?? npc.type} was still in the world ${now - since} ticks after its hitpoints reached 0 (npc_del never ran)`, bot, seed, trail);
                    // Reported once. This runs every few ticks, so without the mark a corpse that
                    // genuinely never goes away would be reported again on every pass.
                    w.dying.set(npc.nid, REPORTED);
                }
            }
        }
    }
    // A corpse that did go away stops being interesting; keep the map from growing all session.
    if (w.dying.size > 64) {
        w.dying.clear();
    }
}

/** A player the engine could not have put there, or a stat outside what a stat can be. */
export function watchImpossibleState(bot: BotPlayer, seed: number, trail: string[]): void {
    if (bot.level < 0 || bot.level > 3 || bot.x < 0 || bot.z < 0 || bot.x > 16383 || bot.z > 16383 || !isZoneAllocated(bot.level, bot.x, bot.z)) {
        findings.add('coord', `standing off the map at ${bot.x},${bot.z},${bot.level}`, bot, seed, trail);
        return; // everything below would report on a bot that is nowhere at all
    }

    for (let stat = 0; stat < bot.baseLevels.length; stat++) {
        const base = bot.baseLevels[stat];
        const level = bot.levels[stat];
        // A boost can take a level above its base; nothing takes it above base + 20 (the biggest
        // boost in the game is a +19 from an overload-class potion this era does not have, and
        // 5 + 20% of 99 is +24 only for Ranging at 99 - so the ceiling is generous on purpose).
        if (level < 0 || base < 0 || base > 99 || level > base + 30) {
            findings.add('stat', `stat ${stat} is ${level}/${base}, which is not a level a player can have`, bot, seed, trail);
        }
    }
}

// The bit ranges every varp's varbits claim, worked out once: varp id -> the highest bit any varbit
// of it declares. A varp with varbits IS a bitfield, so a value with bits above that has been
// written by something treating it as a plain int - which silently corrupts every varbit in it.
let varpTopBit: Int32Array | null = null;
function buildVarpRanges(): Int32Array {
    const top = new Int32Array(VarPlayerType.count).fill(-1);
    for (let id = 0; id < VarBitType.count; id++) {
        const bit = VarBitType.get(id);
        if (!bit || bit.basevar < 0 || bit.basevar >= top.length) {
            continue;
        }
        if (bit.endbit > top[bit.basevar]) {
            top[bit.basevar] = bit.endbit;
        }
    }
    return top;
}

/** A varp used as a bitfield holding a value that does not fit the bitfield. */
export function watchVarps(bot: BotPlayer, seed: number, trail: string[]): void {
    if (!varpTopBit) {
        varpTopBit = buildVarpRanges();
    }
    for (let id = 0; id < varpTopBit.length; id++) {
        const top = varpTopBit[id];
        if (top < 0 || top >= 31) {
            continue; // not a bitfield, or one that uses the whole word
        }
        const value = bot.getVar(id);
        if (typeof value !== 'number' || value === 0) {
            continue;
        }
        if (value < 0 || value >>> (top + 1) !== 0) {
            const name = VarPlayerType.get(id)?.debugname ?? String(id);
            findings.add('varp', `%${name} = ${value}, past the top bit its varbits declare (bit ${top})`, bot, seed, trail);
        }
    }
}

// ------------------------------------------------------------------------------------------------
// custom (2026-11-02) - THE ONE THAT WAS MISSING: an interaction nothing answered.
//
// The watchers above all ask "is the engine in a state it should not be in". None of them can see
// the thing the owner keeps reporting by hand, which is an option that exists and does nothing. That
// is not an engine invariant - the engine is perfectly happy - so no amount of state checking finds
// it.
//
// It does not need finding. The engine says it, out loud, every single time:
//
//     Player.defaultOp:  messageGame(`No trigger for [oploc1,some_gate]`)
//                        messageGame('Nothing interesting happens.')
//
// A fuzzing bot has been collecting those in BotPlayer.messages - a 16-entry ring - and dropping
// them off the end for weeks. The fleet was being handed the to-do list and throwing it away.
//
// So: read the mailbox. Two kinds, and the difference is worth keeping:
//
//   deadop   "No trigger for [x,y]". There is no [oploc1,x] and no [aploc1,x], for the type or its
//            category. No state, item, quest or level would have made that click do anything.
//   filler   "Nothing interesting happens." with no "No trigger" line in front of it, or one of the
//            content's own equivalents. A trigger DID exist and still had nothing to say - a missing
//            recipe row, a quest stage nobody wrote, a branch that falls through to
//            ~displaymessage(^dm_default). Softer than a deadop and much more numerous, so it is
//            reported against the ACTION the bot took rather than per message, and capped.

/** Said by the content, not the engine, when it has no answer for a combination. */
const FILLER_LINES: readonly string[] = ['Nothing interesting happens.', 'Nothing interesting happens'];

/**
 * How many distinct filler findings one run will report before it stops. A dead op is a fact and
 * there are a bounded number of them; a filler is a judgement and a fuzzer using a random item on a
 * random thing generates them by the thousand, almost all of them correct behaviour ("no, you may
 * not use a bucket on a goblin"). Capped so the findings file stays a thing a person reads.
 */
const FILLER_CAP = 300;

/**
 * Trail entries that are the brain's own bookkeeping rather than a click at the world. A filler
 * finding is only as useful as the action it names, and these name nothing.
 */
const NOT_A_CLICK = /^t\d+ (audit:|nothing to do|waiting|walk to|relocated|heading|audit open bank|audit: )/;
let fillerReported = 0;

/**
 * The bot's message log since the last pass, turned into findings. `did` is what the brain did this
 * tick, which is what names the op: the engine's own line names the trigger and the target, and the
 * trail names the click.
 */
export function watchDeadInteraction(bot: BotPlayer, w: WatchState, seed: number, trail: string[]): void {
    const messages = bot.messages;
    if (!messages.length) {
        return;
    }
    for (let i = messages.length - 1; i >= 0; i--) {
        const m = messages[i];
        if (m.tick <= w.lastMessageTick) {
            break;
        }
        // `No trigger for [oploc1,railing]` - the engine built this out of the real trigger it
        // looked for and the real debugname it looked for it on, so it is the finding verbatim.
        const noTrigger = m.text.indexOf('No trigger for [');
        if (noTrigger !== -1) {
            const what = m.text.slice(noTrigger + 'No trigger for ['.length).replace(/]$/, '');
            const [trigger, ...rest] = what.split(',');
            const target = rest.join(',') || '_';
            // DeadOps is the process-wide collector (every sim and the dev world feed it too); the
            // finding is the fuzzer's own copy, with the seed and trail that reached it.
            // A LABELLED OPTION OR A COMBINATION? It matters: the first run of this put
            // [opnpct,banker1] x210 at the top of the list, which is a bot with 99 Magic casting
            // spells at a bank teller and is not a bug. DeadOps.kindFor owns that rule, because
            // Player.defaultOp records these too and the two must agree.
            //
            // AND NO `has` GUARD HERE, which was the other half of the same mistake. defaultOp
            // records the row DURING the click; this watcher reads the message a tick later, by
            // which time the row always exists - so guarding on it suppressed essentially every
            // finding. findings.add already dedupes on kind and detail, which is the right place
            // for it: DeadOps counts occurrences, findings reports the first one with its trail.
            DeadOps.record(trigger, target, bot.username, bot.x, bot.z, bot.level);
            if (DeadOps.kindFor(trigger) === 'notrigger') {
                findings.add('deadop', `[${trigger},${target}] does not exist - the cache offers that option and no script claims it`, bot, seed, trail);
            }
            w.sawNoTrigger = m.tick;
            continue;
        }
        if (FILLER_LINES.some(line => m.text === line || m.text.startsWith(line))) {
            // The engine's own pair: "No trigger for [...]" is immediately followed by this one, and
            // reporting both would double every dead op.
            if (m.tick === w.sawNoTrigger) {
                continue;
            }
            if (fillerReported >= FILLER_CAP) {
                continue;
            }
            // There is no trigger name to read here - the content said it, not the engine - so the
            // action the bot took is the only identification there is. That is why the brain's
            // lastAction is kept in words.
            // The trail's last entry is the brain's own words for the click, with its tick:
            // `t4812 oploc crate op1 @3215,3210,0`. The tick is dropped for the signature so two
            // bots hitting the same dead combination are one finding.
            //
            // Walked BACKWARDS past the brain's own bookkeeping, because the message can arrive a
            // tick or two after the click that caused it - by which time the trail's last entry may
            // be `audit: settling` or `nothing to do`, and a finding filed against that names
            // nothing anybody can go and look at. A real run produced exactly that.
            const what = (trail.findLast(step => !NOT_A_CLICK.test(step)) ?? '(unknown action)').replace(/^t\d+ /, '');
            DeadOps.recordFiller(what, bot.username, bot.x, bot.z, bot.level);
            fillerReported++;
            findings.add('filler', `a trigger ran and still had nothing to say ("${m.text}") for: ${what}`, bot, seed, trail);
        }
    }
    w.lastMessageTick = messages[messages.length - 1].tick;
}

// ------------------------------------------------------------------------------------------------
// Item conservation - the one that matters, because a dupe is the bug that costs a server.
//
// HOW IT AVOIDS DROWNING IN FALSE POSITIVES. Almost everything in a game is a source or a sink:
// mining makes ore, eating destroys food, a kill drops loot. Listing them all is hopeless and would
// be out of date the day it was written. So this is turned round: the watcher only asserts over a
// window in which the bot did nothing that could create or destroy anything - it MOVED items about
// (bank, equipment, the ground, its backpack) and nothing else. Over such a window the total across
// everything it owns must be exactly what it was. That is where dupes actually live: deposit,
// withdraw, equip, drop, pick up, and the interactions between them.
//
// Anything else the bot does - an op on a loc or an npc, an item on an item, a button, a spell, any
// xp at all - taints the window, and the baseline is simply retaken. A tainted window reports
// nothing, and reporting nothing is the right answer: the watcher does not know what that action was
// supposed to produce.

/** Actions that only ever MOVE items. Everything else voids the window. */
export const CONSERVING_ACTIONS: ReadonlySet<string> = new Set(['walk', 'invop', 'wornop', 'drop', 'equip', 'takeobj', 'closemodal', 'idle']);
/** The subset of those that actually move something, so a window of pure walking asserts nothing. */
export const MOVING_ACTIONS: ReadonlySet<string> = new Set(['invop', 'wornop', 'drop', 'equip', 'takeobj']);

/**
 * Every obj the bot owns in an inventory of its OWN - backpack, bank, equipment - and nothing on
 * the ground.
 *
 * WHY THE GROUND IS LEFT OUT, written down because it cost two rounds of false findings. ownedItems
 * above counts the bot's own drops, which is right for the opportunistic watcher and wrong for an
 * assertion, because the ground is not a reliable ledger:
 *
 *   - a drop is only counted while it is in one of the nine zones around the bot;
 *   - it stops being the bot's at all when the lootdrop timer makes it public, which is a clock
 *     nobody in this window controls;
 *   - a drop onto a tile that already holds the same obj merges, and a partial stack does not.
 *
 * Pinning the window to one tile fixed the first of those and not the other two: a run still
 * reported `potato_seed +3` off nothing but drop and take. So the audit asserts over the
 * inventories only, and the brain does not drop during one. That is no loss - a dupe lives in
 * deposit, withdraw, equip and unequip, and those are all here. Dropping is still fuzzed outside
 * the window, where nothing is asserted about it.
 */
function ownedInvItems(bot: BotPlayer): Map<number, number> {
    const total = new Map<number, number>();
    for (const inv of bot.invs.values()) {
        for (let i = 0; i < inv.capacity; i++) {
            const item = inv.get(i);
            if (item) {
                const type = ObjType.get(item.id);
                const id = type && type.certlink !== -1 && type.certtemplate !== -1 ? type.certlink : item.id;
                total.set(id, (total.get(id) ?? 0) + item.count);
            }
        }
    }
    return total;
}

function totalXp(bot: BotPlayer): number {
    let xp = 0;
    for (let i = 0; i < bot.stats.length; i++) {
        xp += bot.stats[i];
    }
    return xp;
}

// ------------------------------------------------------------------------------------------------
// custom (2026-11-02) - ITEM CONSERVATION, and why there is now only one of these.
//
// THE WATCHER THAT USED TO BE HERE is gone, and the reasoning is worth keeping because it was a
// good idea that could not be made to work. watchItemConservation asserted over a window in which
// the bot did nothing but move items, and waited for such a window to happen by chance:
//
//   - a window needed SETTLE_TICKS (8) clean ticks to take a baseline, then at least one move, then
//     8 more clean ticks - about 17 consecutive ticks with no tainting action and no xp;
//   - a tick is two actions and roughly a quarter of actions are conserving ones, so a clean tick is
//     about one in sixteen and seventeen in a row is about one in 10^20;
//   - measured: 8 fuzzers x 3,545 ticks produced 41 invops and not one comparison. The watcher the
//     file called "the one that matters, because a dupe is the bug that costs a server" had never
//     once run its assertion.
//
// Then the modal fix landed, invops went from 254 a run to 1,584, and it began to fire - and every
// time it fired it was wrong, because it counted the bot's own drops on the ground and the ground is
// not a ledger anyone controls (see ownedInvItems below). Two oracles for one property, one of them
// sound and one of them lying, is worse than one: the lying one is what teaches people to stop
// reading the list. So the opportunistic one is retired and the audit window below is the whole of
// it.
//
// WHAT WENT WITH IT, stated so it is not mistaken for coverage: nothing now checks that a drop
// LANDS - that an obj hits the floor exactly once for one drop. That is a real bug class and it
// wants a sim that drops one known item on a known tile and counts, not a fuzzer that cannot tell
// its own drops from the lootdrop timer's.
//
// THE ITEM AUDIT WINDOW, which is taken rather than waited for.
//
// watchItemConservation asserts over a window in which the bot did nothing but move items. That is
// the right test. The problem is that it waits for such a window to happen by chance, and with the
// brain's own weights it does not happen:
//
//   - a window needs SETTLE_TICKS (8) clean ticks to take a baseline, then at least one move, then
//     8 more clean ticks before the comparison - about 17 consecutive ticks with no tainting action
//     and no xp.
//   - a tick is two actions, and from FuzzBrain.act's weights roughly a quarter of actions are
//     conserving ones (walk, invop on its own inventories, wield, take its own drop, idle). So a
//     clean tick is about one in sixteen, and seventeen in a row is about one in 10^20.
//   - measured on the 2 November build: 8 fuzzers x 3,545 ticks produced 41 invops in total and not
//     one comparison. The dupe watcher - the one the file itself calls "the one that matters,
//     because a dupe is the bug that costs a server" - had never once run its assertion.
//
// So the window is no longer waited for, it is TAKEN. Every AUDIT_EVERY ticks the brain stops
// clicking the world and does nothing but move items between its own backpack, bank, equipment and
// the floor for AUDIT_TICKS, then stands still for SETTLE_TICKS. The totals at the end must equal
// the totals at the start. That is a deterministic test of exactly the surface where dupes live -
// deposit, withdraw, equip, unequip, drop, take, drag - and it runs several times a run instead of
// never.

/**
 * Ticks between audits.
 *
 * Raised from 400 after the modal fix made banks actually reachable: audits started succeeding, and
 * a succeeding audit costs its whole window. At 400 they took 4,900 of 48,000 bot-ticks, and with
 * the loiter stretch that was 30% of the run not fuzzing - coverage fell from 624 to 487. A dupe
 * check does not need to run constantly; it needs to run enough times a run to be convincing.
 */
export const AUDIT_EVERY = 900;
/** Ticks of nothing but item moves. ~60 moves at two actions a tick, which is a real workout. */
export const AUDIT_TICKS = 30;
/** Consecutive ticks with nothing left to move before the window gives up early. */
export const AUDIT_IDLE_GIVEUP = 4;

/**
 * The moves allowed INSIDE an audit window: between the bot's own inventories, nothing touching the
 * ground. See ownedInvItems for why the ground is out. MOVING_ACTIONS is the wider set the
 * opportunistic watcher uses and still includes drop and take.
 */
export const AUDIT_MOVES: ReadonlySet<string> = new Set(['invop', 'wornop', 'equip']);

/** Is this bot in an item audit right now? The brain asks, to know to move items and nothing else. */
export function inItemAudit(w: WatchState): boolean {
    return w.auditUntil !== -1;
}

/** Still moving, as opposed to standing still waiting for the last script to land. */
export function auditIsMoving(w: WatchState): boolean {
    return w.auditUntil !== -1 && World.currentTick < w.auditUntil;
}

/** The brain opening a window: the totals now are what the totals must be at the end. */
export function beginItemAudit(bot: BotPlayer, w: WatchState): void {
    w.auditUntil = World.currentTick + AUDIT_TICKS;
    w.auditBaseline = ownedInvItems(bot);
    w.auditMoves = 0;
    w.auditIdle = 0;
    w.auditAt = `${bot.x},${bot.z},${bot.level}`;
}

/**
 * Closes the window and compares. Anything that could create or destroy wealth abandons the audit
 * rather than failing it - a monster that walks up and kills the bot mid-audit is not a dupe, and a
 * watcher that cries dupe at one would be turned off within a day.
 */
export function watchItemAudit(bot: BotPlayer, w: WatchState, seed: number, trail: string[], didThisTick: string[], xpMoved: boolean): void {
    if (w.auditUntil === -1 || !w.auditBaseline) {
        return;
    }
    const now = World.currentTick;

    // THE BOT MUST NOT MOVE, and this is not fussiness - it was the whole of the first version's
    // false-positive rate. ownedItems counts the bot's own drops on the ground, but only in the nine
    // zones around it. A bot that drops a potato seed and then takes two steps has "lost" it, and
    // one that walks back towards an older drop has "gained" one. The first run of the audit
    // reported five findings and all five were that: `potato_seed -3`, `cabbage +1`, `flax +1`,
    // every one of them with nothing in the trail but drop and take.
    //
    // Pinning the window to one tile makes the ground set stable, so a drop and a take are a move
    // and nothing else. A walk - including the route the engine runs for an op click - abandons the
    // window instead of being reported.
    if (`${bot.x},${bot.z},${bot.level}` !== w.auditAt) {
        w.auditUntil = -1;
        w.auditBaseline = null;
        return;
    }

    let movedThisTick = 0;
    for (const action of didThisTick) {
        if (!CONSERVING_ACTIONS.has(action)) {
            // The brain is not supposed to do this during an audit, but a queued script from before
            // the window can still land inside it. Abandon rather than assert.
            w.auditUntil = -1;
            w.auditBaseline = null;
            return;
        }
        if (AUDIT_MOVES.has(action)) {
            w.auditMoves++;
            movedThisTick++;
        } else if (MOVING_ACTIONS.has(action)) {
            // A move the audit does not account for - a drop or a take. The brain does not make
            // these inside a window; if one arrives from a queued script, abandon rather than
            // assert against a total that does not include the ground.
            w.auditUntil = -1;
            w.auditBaseline = null;
            return;
        }
    }
    // A STARVED WINDOW CLOSES EARLY. Most of the audit's value is deposit and withdraw, and those
    // need a bank interface; a bot nowhere near one can only shuffle its equipment and the tile it
    // stands on, and runs out of moves in a few ticks. Measured on the first run: 4,978 audit ticks
    // produced 239 moves, so nineteen ticks in twenty were a bot standing still achieving nothing.
    // Sitting out the rest of the window is pure waste, so a window with nothing left to do stops
    // and compares what it has.
    if (movedThisTick === 0) {
        w.auditIdle++;
        if (w.auditIdle >= AUDIT_IDLE_GIVEUP && now < w.auditUntil) {
            w.auditUntil = now; // close the moving half; the settle below still applies
        }
    } else {
        w.auditIdle = 0;
    }
    if (xpMoved) {
        w.auditUntil = -1;
        w.auditBaseline = null;
        return;
    }
    // Dying during an audit scatters the inventory by the engine's own rules; so does a modal that
    // took wealth (a shop, a trade). Both are legitimate and neither is this watcher's business.
    if (bot.levels[PlayerStat.HITPOINTS] === 0) {
        w.auditUntil = -1;
        w.auditBaseline = null;
        return;
    }

    if (now < w.auditUntil + SETTLE_TICKS) {
        return; // still moving, or settling
    }

    const after = ownedInvItems(bot);
    const ids = new Set<number>([...w.auditBaseline.keys(), ...after.keys()]);
    const drifts: string[] = [];
    for (const id of ids) {
        const delta = (after.get(id) ?? 0) - (w.auditBaseline.get(id) ?? 0);
        if (delta !== 0) {
            drifts.push(`${ObjType.get(id)?.debugname ?? id} ${delta > 0 ? '+' : ''}${delta}`);
        }
    }
    if (drifts.length && w.auditMoves > 0) {
        // A GAIN has no innocent explanation. A LOSS can: a drop went public on the lootdrop timer
        // and somebody else took it. Said in the finding so it is checked rather than believed.
        const gained = drifts.some(d => d.includes('+'));
        findings.add('items', `item audit: ${w.auditMoves} item moves and nothing else over ${AUDIT_TICKS} ticks, and the totals changed: ${drifts.join(', ')}${gained ? '' : ' (loss only - check nobody took a public drop)'}`, bot, seed, trail);
    }
    w.auditUntil = -1;
    w.auditBaseline = null;
}

/** Everything, once a tick. Wrapped: a watcher must never be why the world went down. */
export function runWatchers(bot: BotPlayer, w: WatchState, seed: number, trail: string[], didThisTick: string[]): void {
    try {
        // Any xp at all means something was earned rather than moved, which voids an audit window.
        // Read and stored here because the audit is not the only thing that may want it later.
        const xp = totalXp(bot);
        const xpMoved = xp !== w.lastXpTotal;
        w.lastXpTotal = xp;
        watchSoftLock(bot, w, seed, trail);
        // Reading the bot's mailbox: the engine has been telling it which of its clicks nothing
        // answered, and until now nothing read it. See watchDeadInteraction.
        watchDeadInteraction(bot, w, seed, trail);
        // Every fourth tick, staggered by slot so the bots do not all scan on the same one. The
        // corpse check walks the nine zones around the bot, and with eight bots in a town that was
        // measurably the most expensive thing in the loop. A corpse is given ten ticks of grace
        // anyway, so looking every fourth misses nothing.
        if ((World.currentTick + bot.slot) % 4 === 0) {
            watchCorpses(bot, w, seed, trail);
        }
        watchImpossibleState(bot, seed, trail);
        // Every varp of every bot every tick would be a real cost for a check that can only change
        // when something writes one, so it is spread out: once every 50 ticks per bot.
        if (World.currentTick % 50 === 0) {
            watchVarps(bot, seed, trail);
        }
        watchItemAudit(bot, w, seed, trail, didThisTick, xpMoved);
    } catch (err) {
        printWarning(`fuzz: a watcher threw and was skipped this tick - ${String((err as { message?: unknown })?.message ?? err)}`);
    }
}

/** The findings file, under the data dir beside the script faults. */
export function findingsFile(): string {
    return Environment.NODE_BOTS_FUZZ_FILE;
}
