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

export type FindingKind = 'softlock' | 'corpse' | 'coord' | 'stat' | 'varp' | 'items';

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
    /** An action this window that is a known source or sink, so the window does not count. */
    tainted = true;
    lastXpTotal = 0;

    /** Npcs seen at zero hitpoints, and the tick each was first seen that way. */
    readonly dying: Map<number, number> = new Map();
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
// A conservation window has to be long enough that a slow script has finished moving items about.
const CONSERVE_WINDOW = 25;

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
                } else if (now - since === CORPSE_TICKS) {
                    findings.add('corpse', `${NpcType.get(npc.type)?.debugname ?? npc.type} was still in the world ${CORPSE_TICKS} ticks after its hitpoints reached 0 (npc_del never ran)`, bot, seed, trail);
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

/** Every obj the bot owns, across every inventory of its own, plus what it has dropped nearby. */
function ownedItems(bot: BotPlayer): Map<number, number> {
    const total = new Map<number, number>();
    const bump = (id: number, count: number) => total.set(id, (total.get(id) ?? 0) + count);
    for (const inv of bot.invs.values()) {
        for (let i = 0; i < inv.capacity; i++) {
            const item = inv.get(i);
            if (item) {
                // A noted item and its unnoted twin are the same wealth, so they count as one obj.
                // Without this a bank withdraw-as-note reads as a dupe and an unnote as a loss.
                const type = ObjType.get(item.id);
                bump(type && type.certlink !== -1 && type.certtemplate !== -1 ? type.certlink : item.id, item.count);
            }
        }
    }
    // The ground it can see. Its own drops are still its property until they go public, and a drop
    // that never lands (or lands twice) is exactly the kind of thing worth catching.
    //
    // KNOWN WAY TO GET A FALSE POSITIVE, so it does not have to be rediscovered: a drop goes public
    // on the lootdrop timer, and if another player takes it the total goes down through nobody's
    // action. The timer is around a hundred ticks against a twenty-five tick window, so it is rare -
    // but a finding that is only a LOSS, with somebody else standing there, is worth checking before
    // it is believed. A GAIN never has that excuse.
    for (let dx = -1; dx <= 1; dx++) {
        for (let dz = -1; dz <= 1; dz++) {
            const zone = World.gameMap.getZone(bot.x + dx * 8, bot.z + dz * 8, bot.level);
            for (const obj of zone.getAllObjsSafe()) {
                if (obj.receiver64 === bot.hash64) {
                    const type = ObjType.get(obj.type);
                    bump(type && type.certlink !== -1 && type.certtemplate !== -1 ? type.certlink : obj.type, obj.count);
                }
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

/**
 * Called once a tick. `didThisTick` is what the brain actually did; an action outside
 * CONSERVING_ACTIONS, or any xp at all, retakes the baseline instead of asserting against it.
 */
export function watchItemConservation(bot: BotPlayer, w: WatchState, seed: number, trail: string[], didThisTick: string[]): void {
    const now = World.currentTick;
    const xp = totalXp(bot);

    let taint = xp !== w.lastXpTotal;
    for (const action of didThisTick) {
        if (!CONSERVING_ACTIONS.has(action)) {
            taint = true;
        }
    }
    w.lastXpTotal = xp;

    if (taint || w.baseline === null) {
        w.baseline = ownedItems(bot);
        w.baselineTick = now;
        return;
    }
    if (now - w.baselineTick < CONSERVE_WINDOW) {
        return;
    }

    const after = ownedItems(bot);
    const ids = new Set<number>([...w.baseline.keys(), ...after.keys()]);
    const drifts: string[] = [];
    for (const id of ids) {
        const delta = (after.get(id) ?? 0) - (w.baseline.get(id) ?? 0);
        if (delta !== 0) {
            drifts.push(`${ObjType.get(id)?.debugname ?? id} ${delta > 0 ? '+' : ''}${delta}`);
        }
    }
    if (drifts.length) {
        findings.add('items', `items changed over ${CONSERVE_WINDOW} ticks of moving things about and nothing else: ${drifts.join(', ')}`, bot, seed, trail);
    }
    w.baseline = after;
    w.baselineTick = now;
}

/** Everything, once a tick. Wrapped: a watcher must never be why the world went down. */
export function runWatchers(bot: BotPlayer, w: WatchState, seed: number, trail: string[], didThisTick: string[]): void {
    try {
        watchSoftLock(bot, w, seed, trail);
        watchCorpses(bot, w, seed, trail);
        watchImpossibleState(bot, seed, trail);
        // Every varp of every bot every tick would be a real cost for a check that can only change
        // when something writes one, so it is spread out: once every 50 ticks per bot.
        if (World.currentTick % 50 === 0) {
            watchVarps(bot, seed, trail);
        }
        watchItemConservation(bot, w, seed, trail, didThisTick);
    } catch (err) {
        printWarning(`fuzz: a watcher threw and was skipped this tick - ${String((err as { message?: unknown })?.message ?? err)}`);
    }
}

/** The findings file, under the data dir beside the script faults. */
export function findingsFile(): string {
    return Environment.NODE_BOTS_FUZZ_FILE;
}
