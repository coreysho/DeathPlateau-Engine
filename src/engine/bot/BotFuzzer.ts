import Component from '#/cache/config/Component.js';
import InvType from '#/cache/config/InvType.js';
import NpcType from '#/cache/config/NpcType.js';
import ObjType from '#/cache/config/ObjType.js';
import LocType from '#/cache/config/LocType.js';
import type { BotState } from '#/engine/bot/BotBrain.js';
import * as Input from '#/engine/bot/BotInput.js';
import { runWatchers, WatchState } from '#/engine/bot/BotFuzzWatch.js';
import type BotPlayer from '#/engine/bot/BotPlayer.js';
import Loc from '#/engine/entity/Loc.js';
import Npc from '#/engine/entity/Npc.js';
import Obj from '#/engine/entity/Obj.js';
import { isMapBlocked } from '#/engine/GameMap.js';
import ScriptCoverage from '#/engine/script/ScriptCoverage.js';
import type ScriptFile from '#/engine/script/ScriptFile.js';
import ScriptProvider from '#/engine/script/ScriptProvider.js';
import ServerTriggerType from '#/engine/script/ServerTriggerType.js';
import World from '#/engine/World.js';
import { printWarning } from '#/util/Logger.js';

// custom (2026-09-29) - the fuzzing bot's brain.
//
// WHAT IT IS FOR. The content has several thousand triggers and almost none of them are covered by a
// sim. The bots in BotBrain fight, eat and pray - they exercise combat and nothing else. This one
// wanders and then clicks whatever is in reach: every op on every loc, npc and ground obj, every
// inventory op, item on item, every button on whatever interface is open, banking, equipping,
// dropping, dialogue options. It has no idea what any of it is supposed to do. The watchers
// (BotFuzzWatch.ts) decide that something went wrong without knowing what was meant.
//
// SEEDED, ALWAYS. Every choice comes from this brain's own generator, seeded per bot, and the last
// actions are kept as text. A finding names the seed and the trail, so it replays. A fuzzer whose
// findings cannot be reproduced is a random number generator that wastes people's afternoons.
//
// THE SAFETY GUARD IS NOT HERE - it is in BotManager.startFuzzers, which refuses to run any of this
// on a world that is not a development world. See the comment there for why.

/** mulberry32: small, fast, and the same sequence for the same seed on every machine and version. */
class Rng {
    constructor(private state: number) {
        this.state = state >>> 0;
    }

    next(): number {
        this.state = (this.state + 0x6d2b79f5) >>> 0;
        let t = this.state;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }

    /** An integer in [min, max]. */
    int(min: number, max: number): number {
        return min + Math.floor(this.next() * (max - min + 1));
    }

    pick<T>(list: T[]): T | undefined {
        return list.length ? list[Math.floor(this.next() * list.length)] : undefined;
    }
}

/**
 * Knobs a run can turn, kept here rather than in Environment because they exist to be A/B'd:
 * tools/sim/fuzz.ts runs the same seed with coverageGuided on and off to show what the guidance is
 * actually worth. Nothing in the server changes them.
 */
export const fuzzTuning = { coverageGuided: true };

/** How far it looks for something to click. A client's own view is 15; this is inside it. */
const REACH = 10;
/** How many actions it takes in one tick. More than one, because a player clicks faster than 0.6s. */
const ACTIONS_PER_TICK = 2;
/** How many actions are kept for a replay trail. Enough to see the run-up to a finding. */
const TRAIL = 24;
/** How long a bot goes without running a script nothing had run before, before it walks somewhere else. */
const BORED_TICKS = 150;

/**
 * The one op index a loc, npc or obj actually has at `op` (1-based), or 0 - the same check
 * OpLocHandler and friends make, so the fuzzer never sends a click the server would throw away as
 * "bad client". It is a FUZZER, not an exploit scanner: everything it does is something a real
 * client could legitimately send.
 */
function validOps(ops: (string | null)[] | null): number[] {
    const out: number[] = [];
    if (!ops) {
        return out;
    }
    for (let i = 0; i < ops.length; i++) {
        if (ops[i] && ops[i] !== 'hidden') {
            out.push(i + 1);
        }
    }
    return out;
}

export class FuzzBrain {
    private readonly rng: Rng;
    private readonly watch = new WatchState();
    /** The last TRAIL actions, in words, so a finding can be replayed by hand. */
    private readonly trail: string[] = [];
    /** What it did on THIS tick, which is what the conservation watcher reads. */
    private did: string[] = [];
    /** Where it is heading while it has nothing better to do. */
    private dest: { x: number; z: number } | null = null;
    private destUntil = 0;
    /** Coverage boredom: the last time anything new ran, and what the count was then. See wander(). */
    private boredSince = 0;
    private lastSeenCount = -1;

    constructor(
        readonly s: BotState,
        readonly seed: number
    ) {
        this.rng = new Rng(seed);
    }

    get bot(): BotPlayer {
        return this.s.bot;
    }

    private note(what: string, kind: string): void {
        this.did.push(kind);
        this.trail.push(`t${World.currentTick} ${what}`);
        if (this.trail.length > TRAIL) {
            this.trail.shift();
        }
        this.s.lastAction = what;
    }

    /**
     * A bot's tick is called from World.processClientsIn, so a throw in here is a throw in the
     * server's own loop. The fuzzer is the thing most likely to find an engine state nothing else
     * reaches, so it is also the thing most likely to trip over one - and a crashed world reports
     * nothing at all. It logs and carries on instead; the first run of this found a real one (a
     * recipe consuming the slots whose names the trail was about to read).
     */
    tick(): void {
        try {
            this.tickInner();
        } catch (err) {
            printWarning(`fuzz: ${this.bot.username} threw and skipped a tick (seed ${this.seed}, last: ${this.s.lastAction}) - ${String((err as { message?: unknown })?.message ?? err)}`);
        }
    }

    private tickInner(): void {
        const bot = this.bot;
        this.did = [];

        if (this.s.phase === 'dead' || this.s.phase === 'removing') {
            return;
        }

        // Every tick it is in a modal it tries to get out of one: answer the options, click through,
        // press one of its buttons, or close it. So the "a modal that will not close" watcher means
        // what it says - over a hundred ticks the bot has asked many times and it is still there.
        if (bot.containsModalInterface()) {
            const before = bot.modalState;
            // A dialogue with options is answered rather than shut, because shutting it tests
            // nothing and answering it is how the content behind it gets reached at all.
            if (bot.resumeButtons.length) {
                const com = this.rng.pick([...bot.resumeButtons]);
                if (com !== undefined && Input.chooseDialogue(bot, com)) {
                    this.note(`dialogue option ${Component.get(com)?.comName ?? com}`, 'dialogue');
                    this.finish();
                    return;
                }
            }
            if (this.rng.next() < 0.5 && Input.resumeDialogue(bot)) {
                this.note('dialogue continue', 'dialogue');
                this.finish();
                return;
            }
            // Before giving up on it, click one of its own buttons - this is the only way anything
            // inside a quest or shop interface ever gets exercised.
            if (this.rng.next() < 0.6 && this.clickOpenInterface()) {
                this.finish();
                return;
            }
            bot.closeModal();
            this.note(`close modal (state ${before})`, 'closemodal');
            this.finish();
            return;
        }

        if (bot.delayed) {
            this.note('waiting (delayed)', 'idle');
            this.finish();
            return;
        }

        for (let i = 0; i < ACTIONS_PER_TICK; i++) {
            this.act();
        }
        this.finish();
    }

    private finish(): void {
        if (this.did.length === 0) {
            this.did.push('idle');
        }
        runWatchers(this.bot, this.watch, this.seed, this.trail, this.did);
    }

    // ---------------------------------------------------------------- choosing something to do

    private act(): void {
        // The weights are not tuned for realism, they are tuned for coverage: the things there are
        // thousands of (locs, npcs, items, buttons) get most of the clicks, and walking gets enough
        // to keep the bot from testing one street corner all night.
        const roll = this.rng.int(1, 100);
        if (roll <= 22 && this.opLoc()) return;
        if (roll <= 40 && this.opNpc()) return;
        if (roll <= 50 && this.opObj()) return;
        if (roll <= 66 && this.opHeld()) return;
        if (roll <= 74 && this.heldUse()) return;
        if (roll <= 84 && this.invOp()) return;
        if (roll <= 90 && this.clickOpenInterface()) return;
        this.wander();
    }

    /**
     * COVERAGE GUIDANCE. Given some candidates and the trigger each would fire, prefer the ones
     * nothing in this process has ever run. Without it a fuzzer spends the night re-testing the
     * Lumbridge cows, because that is where the density is; with it, it goes looking for the content
     * nobody has touched. Not ALL the time - a fifth of the picks stay uniform, so it still reaches
     * the second and third op on a loc it has already opened once, and so a build with no coverage
     * turned on behaves exactly as before.
     */
    private preferUncovered<T>(candidates: T[], triggerFor: (c: T) => ScriptFile | undefined): T[] {
        if (!fuzzTuning.coverageGuided || !ScriptCoverage.enabled || candidates.length === 0 || this.rng.next() < 0.2) {
            return candidates;
        }
        const fresh = candidates.filter(c => !ScriptCoverage.covered(triggerFor(c)));
        return fresh.length ? fresh : candidates;
    }

    /** Everything of a kind within REACH, from the nine zones around the bot. */
    private nearby<T>(collect: (zoneX: number, zoneZ: number) => Iterable<T>, at: (t: T) => { x: number; z: number }): T[] {
        const bot = this.bot;
        const out: T[] = [];
        for (let dx = -1; dx <= 1; dx++) {
            for (let dz = -1; dz <= 1; dz++) {
                for (const item of collect(bot.x + dx * 8, bot.z + dz * 8)) {
                    const c = at(item);
                    if (Math.abs(c.x - bot.x) <= REACH && Math.abs(c.z - bot.z) <= REACH) {
                        out.push(item);
                    }
                }
            }
        }
        return out;
    }

    private opLoc(): boolean {
        const bot = this.bot;
        const locs = this.nearby<Loc>(
            (x, z) => World.gameMap.getZone(x, z, bot.level).getAllLocsSafe(),
            l => l
        );
        const choices: { loc: Loc; op: number }[] = [];
        for (const loc of locs) {
            for (const op of validOps(LocType.get(loc.type)?.op ?? null)) {
                choices.push({ loc, op });
            }
        }
        const chosen = this.preferUncovered(choices, c => {
            const type = LocType.get(c.loc.type);
            return ScriptProvider.getByTrigger(ServerTriggerType.OPLOC1 + (c.op - 1), type.id, type.category);
        });
        for (let tries = 0; tries < 4; tries++) {
            const pick = this.rng.pick(chosen);
            if (!pick) {
                return false;
            }
            if (Input.opLoc(bot, pick.loc, pick.op)) {
                this.note(`oploc ${LocType.get(pick.loc.type).debugname ?? pick.loc.type} op${pick.op} @${pick.loc.x},${pick.loc.z},${pick.loc.level}`, 'oploc');
                return true;
            }
        }
        return false;
    }

    private opNpc(): boolean {
        const bot = this.bot;
        const npcs = this.nearby<Npc>(
            (x, z) => World.gameMap.getZone(x, z, bot.level).getAllNpcsSafe(),
            n => n
        );
        const choices: { npc: Npc; op: number }[] = [];
        for (const npc of npcs) {
            for (const op of validOps(NpcType.get(npc.type)?.op ?? null)) {
                choices.push({ npc, op });
            }
        }
        const chosen = this.preferUncovered(choices, c => {
            const type = NpcType.get(c.npc.type);
            return ScriptProvider.getByTrigger(ServerTriggerType.OPNPC1 + (c.op - 1), type.id, type.category);
        });
        for (let tries = 0; tries < 4; tries++) {
            const pick = this.rng.pick(chosen);
            if (!pick) {
                return false;
            }
            if (Input.opNpc(bot, pick.npc, pick.op)) {
                this.note(`opnpc ${NpcType.get(pick.npc.type).debugname ?? pick.npc.type} op${pick.op} @${pick.npc.x},${pick.npc.z}`, 'opnpc');
                return true;
            }
        }
        return false;
    }

    private opObj(): boolean {
        const bot = this.bot;
        const objs = this.nearby<Obj>(
            (x, z) => World.gameMap.getZone(x, z, bot.level).getAllObjsSafe(),
            o => o
        );
        for (let tries = 0; tries < 4; tries++) {
            const obj = this.rng.pick(objs);
            if (!obj) {
                return false;
            }
            const type = ObjType.get(obj.type);
            const ops = validOps(type?.op ?? null);
            const op = this.rng.pick(ops);
            if (op === undefined) {
                continue;
            }
            if (Input.opObjAt(bot, obj, op)) {
                // Picking up what it dropped itself moves an item; picking up anything else brings
                // one in from outside, which the conservation watcher must not read as a dupe.
                const own = obj.receiver64 === bot.hash64;
                this.note(`opobj ${type.debugname ?? obj.type} op${op} @${obj.x},${obj.z}${own ? ' (its own)' : ''}`, own ? 'takeobj' : 'take_other');
                return true;
            }
        }
        return false;
    }

    private opHeld(): boolean {
        const bot = this.bot;
        const inv = bot.getInventory(InvType.INV);
        if (!inv) {
            return false;
        }
        const slots: number[] = [];
        for (let i = 0; i < inv.capacity; i++) {
            if (inv.get(i)) {
                slots.push(i);
            }
        }
        const choices: { slot: number; op: number }[] = [];
        for (const slot of slots) {
            for (const op of validOps(ObjType.get(inv.get(slot)!.id)?.iop ?? null)) {
                choices.push({ slot, op });
            }
        }
        const chosen = this.preferUncovered(choices, c => {
            const type = ObjType.get(inv.get(c.slot)!.id);
            return ScriptProvider.getByTrigger(ServerTriggerType.OPHELD1 + (c.op - 1), type.id, type.category);
        });
        for (let tries = 0; tries < 4; tries++) {
            const choice = this.rng.pick(chosen);
            if (choice === undefined) {
                return false;
            }
            const { slot, op } = choice;
            const item = inv.get(slot);
            if (!item) {
                continue;
            }
            const type = ObjType.get(item.id);
            if (Input.heldOpSlot(bot, slot, op)) {
                const name = type.iop?.[op - 1] ?? '';
                // Wielding and wearing only move an item between two of its own inventories, so
                // those windows still have to conserve. Eating and the rest do not.
                const moves = name === 'Wield' || name === 'Wear' || name === 'Remove';
                this.note(`opheld ${type.debugname ?? item.id} op${op} (${name})`, moves ? 'equip' : 'opheld');
                return true;
            }
        }
        return false;
    }

    private heldUse(): boolean {
        const bot = this.bot;
        const inv = bot.getInventory(InvType.INV);
        if (!inv) {
            return false;
        }
        const slots: number[] = [];
        for (let i = 0; i < inv.capacity; i++) {
            if (inv.get(i)) {
                slots.push(i);
            }
        }
        if (slots.length < 2) {
            return false;
        }
        const a = this.rng.pick(slots)!;
        const b = this.rng.pick(slots)!;
        if (a === b) {
            return false;
        }
        // Read the names BEFORE the click. A recipe consumes both slots, so reading them afterwards
        // for the trail is reading an empty slot - which is how the first long run crashed.
        const what = `use ${ObjType.get(inv.get(a)!.id)?.debugname} on ${ObjType.get(inv.get(b)!.id)?.debugname}`;
        if (!Input.heldUse(bot, a, b)) {
            return false;
        }
        this.note(what, 'heldu');
        return true;
    }

    /**
     * An op on an item in any inventory the client has been sent: the backpack's own menu, the bank,
     * a shop, a trade. This is where deposit and withdraw live, so it is where a dupe lives.
     */
    private invOp(): boolean {
        const bot = this.bot;
        const listeners = bot.invListeners.filter(l => {
            const com = Component.get(l.com);
            return com && bot.isComponentVisible(com);
        });
        for (let tries = 0; tries < 4; tries++) {
            const listener = this.rng.pick(listeners);
            if (!listener) {
                return false;
            }
            const inv = bot.getInventoryFromListener(listener);
            if (!inv) {
                continue;
            }
            const slots: number[] = [];
            for (let i = 0; i < inv.capacity; i++) {
                if (inv.get(i)) {
                    slots.push(i);
                }
            }
            const slot = this.rng.pick(slots);
            const com = Component.get(listener.com);
            const ops = validOps(com?.iop ?? null);
            const op = this.rng.pick(ops);
            if (slot === undefined || op === undefined) {
                continue;
            }
            if (Input.invOp(bot, listener.com, slot, op)) {
                // Only the bot's OWN inventories conserve. A shop or a trade window moves wealth in
                // and out of the world, and the conservation watcher must retake its baseline.
                const own = listener.source === bot.uid;
                this.note(`invop ${com?.comName ?? listener.com} slot${slot} op${op} (${com?.iop?.[op - 1] ?? ''})`, own ? 'invop' : 'shopop');
                return true;
            }
        }
        return false;
    }

    /**
     * Any button on whatever interface happens to be open. Walks the component tree of the open
     * main, chat and side modals and clicks one that has an [if_button] behind it - which is the
     * only way a quest interface, a shop's buttons or a minigame's panel is ever reached.
     */
    private clickOpenInterface(): boolean {
        const bot = this.bot;
        const roots = [bot.modalMain, bot.modalChat, bot.modalSide, bot.modalTutorial].filter(r => r !== -1);
        const root = this.rng.pick(roots);
        if (root === undefined) {
            return false;
        }
        const buttons: number[] = [];
        const walk = (id: number, depth: number) => {
            if (depth > 6 || buttons.length > 200) {
                return;
            }
            const com = Component.get(id);
            if (!com) {
                return;
            }
            if (com.buttonType !== Component.NO_BUTTON && ScriptProvider.getByTriggerSpecific(ServerTriggerType.IF_BUTTON, id, -1)) {
                buttons.push(id);
            }
            if (com.childId) {
                for (const child of com.childId) {
                    walk(child, depth + 1);
                }
            }
        };
        walk(root, 0);
        const comId = this.rng.pick(buttons);
        if (comId === undefined) {
            return false;
        }
        if (!Input.buttonById(bot, comId)) {
            return false;
        }
        this.note(`button ${Component.get(comId)?.comName ?? comId}`, 'button');
        return true;
    }

    /**
     * Walk somewhere. It picks a destination a few dozen tiles off and keeps it for a while, so it
     * actually leaves the square it started on - a fuzzer that re-rolls a destination every tick
     * never gets anywhere and only ever tests one street.
     */
    private wander(): void {
        const bot = this.bot;
        // BOREDOM. A fuzzer left alone spends the night on one street, because there is always
        // something in reach to click and clicking it is cheap. So: if nothing this bot has done for
        // BORED_TICKS has run a script that had not run before, it stops poking at what is here and
        // walks a long way - which is the only legal way a player gets to new content. This is what
        // turns "re-tests Lumbridge all night" into "goes and finds the next town".
        const seen = ScriptCoverage.enabled ? ScriptCoverage.seenCount() : 0;
        if (seen !== this.lastSeenCount) {
            this.lastSeenCount = seen;
            this.boredSince = World.currentTick;
        }
        const bored = ScriptCoverage.enabled && World.currentTick - this.boredSince > BORED_TICKS;

        if (!this.dest || World.currentTick > this.destUntil || (bot.x === this.dest.x && bot.z === this.dest.z)) {
            const radius = bored ? 160 : 24;
            for (let i = 0; i < 30; i++) {
                const x = bot.x + this.rng.int(-radius, radius);
                const z = bot.z + this.rng.int(-radius, radius);
                if (!isMapBlocked(x, z, bot.level)) {
                    this.dest = { x, z };
                    this.destUntil = World.currentTick + (bored ? 300 : 60);
                    if (bored) {
                        // Give it a fresh chance before it decides it is bored again, or one long
                        // walk through empty ground would keep it in boredom mode for good.
                        this.boredSince = World.currentTick;
                    }
                    break;
                }
            }
        }
        if (this.dest && Input.walk(bot, this.dest.x, this.dest.z)) {
            this.note(`walk to ${this.dest.x},${this.dest.z}`, 'walk');
        } else {
            this.note('nothing to do', 'idle');
        }
    }
}
