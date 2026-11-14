import { isHiddenOp } from '#/cache/config/OpVisibility.js';
import Component, { ComActionTarget } from '#/cache/config/Component.js';
import InvType from '#/cache/config/InvType.js';
import NpcType from '#/cache/config/NpcType.js';
import ObjType from '#/cache/config/ObjType.js';
import LocType from '#/cache/config/LocType.js';
import { isVisibleOp } from '#/cache/config/OpVisibility.js';
import type { BotState } from '#/engine/bot/BotBrain.js';
import * as Input from '#/engine/bot/BotInput.js';
import * as Watch from '#/engine/bot/BotFuzzWatch.js';
import { runWatchers, WatchState } from '#/engine/bot/BotFuzzWatch.js';
import type BotPlayer from '#/engine/bot/BotPlayer.js';
import Loc from '#/engine/entity/Loc.js';
import Npc from '#/engine/entity/Npc.js';
import Obj from '#/engine/entity/Obj.js';
import Player from '#/engine/entity/Player.js';
import { isMapBlocked, isZoneAllocated } from '#/engine/GameMap.js';
import ScriptCoverage from '#/engine/script/ScriptCoverage.js';
import type ScriptFile from '#/engine/script/ScriptFile.js';
import ScriptProvider from '#/engine/script/ScriptProvider.js';
import ServerTriggerType from '#/engine/script/ServerTriggerType.js';
import World from '#/engine/World.js';
import ScriptState from '#/engine/script/ScriptState.js';
import Environment from '#/util/Environment.js';
import { printInfo, printWarning } from '#/util/Logger.js';

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
 * How many loc and npc ops a relocation destination must have within reach to be worth going to.
 * Measured: with no minimum at all, relocating made coverage worse than not relocating, because
 * most of the map is field. Twelve is about "a hamlet" - low enough that the fuzzer still visits
 * quiet places, high enough that it does not spend its stay in a wheat field.
 */
const RELOCATE_MIN_OPS = 12;
/** Ticks allowed for walking to a banker and getting the interface open before auditing in place. */
const BANK_OPEN_TRIES = 25;
/**
 * How long the bot works a modal before closing it. A shop needs several clicks to be tested at all
 * (open, pick a row, Buy, pick another), and the soft-lock watcher allows a modal 100 ticks before
 * it calls it stuck, so twenty is well inside what the watchers tolerate.
 */
const MODAL_DWELL = 20;
/**
 * Ticks between loiter stretches, and how long one lasts.
 *
 * THESE WERE MEASURED, and they came out the opposite way round from the guess. The reasoning was
 * "a fuzzer that does not walk does not find anything", so the first budget was 12 ticks in every
 * 220 - about 5%. That run reached 529 triggers. The accidental version before it, where loitering
 * leaked into act()'s cascade and took 9,950 of 48,000 bot-ticks while walking collapsed to 350,
 * reached 624.
 *
 * Standing still is worth more than walking, and in hindsight it is obvious why: walking reaches
 * locs and npcs the bot can click, which it is already saturating, whereas standing still is the
 * only way anything in the world gets a turn to act on IT - [ai_queue1..20] (769 for queue 3
 * alone), [ai_opplayer2] (175), [ai_applayer2] (132), [ai_timer] (113). A click cannot reach those
 * at any weighting.
 *
 * So the budget is about a fifth of the ticks, which is near where the accident landed, but as a
 * stretch with a start and an end rather than a cascade fallthrough that can run away.
 */
const LOITER_EVERY = 110;
const LOITER_TICKS = 24;

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
        if (!isHiddenOp(ops[i])) {
            out.push(i + 1);
        }
    }
    return out;
}

/**
 * Every tile on the map from which something offering a "Bank" option is in reach, worked out once
 * on first use and shared by every fuzzer.
 *
 * Found by the option LABEL, not by a list of banker names: the label is in the cache and is what
 * the player reads, so a banker the content adds tomorrow is in here without a code change. A list
 * of debugnames would be a list of the bankers somebody remembered.
 */
let bankSpotCache: { x: number; z: number; level: number }[] | null = null;
let contentSpotCache: { x: number; z: number; level: number }[] | null = null;
/**
 * ONE START TILE PER MAP SQUARE THAT HAS CLICKABLE CONTENT, densest square first.
 *
 * bankSpots() is 99 places and every one is a bank, which means towns, which means 31 of this
 * build's 702 map squares. Measured: 99 bots at those 99 spots reach 10.4% of triggers in 3,000
 * ticks, and no number of bots standing in towns reaches the other 95% of the map. The ceiling is
 * where they can be PUT, not how many there are.
 *
 * So this derives a spot from the content itself. Every loc carrying an option a client would draw
 * is a vote for its map square; the square's spot is a standable tile beside one of them. Sorted by
 * how much such content the square holds, so the first N spots are the N densest places in the game
 * rather than N arbitrary ones - which matters because a fuzzer dropped in empty moorland walks for
 * a thousand ticks and clicks nothing.
 *
 * NPCS ARE DELIBERATELY NOT COUNTED. An npc is a vote for wherever it happens to be standing when
 * the list is built, and this build spawns 12,666 of them - wandering ones would make the list
 * different on every run and unreproducible from a seed. Locs do not move.
 */
export function contentSpots(): { x: number; z: number; level: number }[] {
    if (contentSpotCache) {
        return contentSpotCache;
    }
    type Square = { count: number; spot: { x: number; z: number; level: number } | null };
    const squares = new Map<string, Square>();
    const standableBeside = (x: number, z: number, level: number): { x: number; z: number; level: number } | null => {
        for (const [dx, dz] of [
            [1, 0],
            [-1, 0],
            [0, 1],
            [0, -1]
        ]) {
            if (!isMapBlocked(x + dx, z + dz, level)) {
                return { x: x + dx, z: z + dz, level };
            }
        }
        return null;
    };
    for (const zone of World.gameMap.existingZones()) {
        for (const loc of zone.getAllLocsUnsafe()) {
            const type = LocType.get(loc.type);
            if (!type?.op?.some(label => isVisibleOp(label))) {
                continue;
            }
            // Level in the key as well as x and z: the upper floors of a city are their own places
            // and a bot put on the ground floor will not climb to them on its own.
            const key = `${loc.x >> 6}_${loc.z >> 6}_${loc.level}`;
            let square = squares.get(key);
            if (!square) {
                square = { count: 0, spot: null };
                squares.set(key, square);
            }
            square.count++;
            if (!square.spot) {
                square.spot = standableBeside(loc.x, loc.z, loc.level);
            }
        }
    }
    const spots = [...squares.values()]
        .filter((sq): sq is { count: number; spot: { x: number; z: number; level: number } } => sq.spot !== null)
        .sort((a, b) => b.count - a.count)
        .map(sq => sq.spot);
    printInfo(`fuzz: ${spots.length} map squares with clickable content, densest first`);
    contentSpotCache = spots;
    return contentSpotCache;
}

/**
 * Exported so BotManager can start a run's bots at DIFFERENT places. It is a derived list, not
 * hand-written coordinates: every entry is a tile beside a real bank booth or teller that the
 * collision map says is standable, which makes it the only list of "somewhere a player would be"
 * in this build that is checked rather than asserted.
 */
export function bankSpots(): { x: number; z: number; level: number }[] {
    if (bankSpotCache) {
        return bankSpotCache;
    }
    const spots: { x: number; z: number; level: number }[] = [];
    const seen = new Set<string>();
    const keep = (x: number, z: number, level: number) => {
        // Beside it, not on it: a banker's own tile is occupied and a booth is solid.
        for (const [dx, dz] of [
            [1, 0],
            [-1, 0],
            [0, 1],
            [0, -1]
        ]) {
            if (!isMapBlocked(x + dx, z + dz, level)) {
                const key = `${x + dx},${z + dz},${level}`;
                if (!seen.has(key)) {
                    seen.add(key);
                    spots.push({ x: x + dx, z: z + dz, level });
                }
                return;
            }
        }
    };
    for (const npc of World.npcs) {
        if (npc && (NpcType.get(npc.type)?.op ?? []).includes('Bank')) {
            keep(npc.x, npc.z, npc.level);
        }
    }
    for (const zone of World.gameMap.existingZones()) {
        for (const loc of zone.getAllLocsUnsafe()) {
            if ((LocType.get(loc.type)?.op ?? []).includes('Bank')) {
                keep(loc.x, loc.z, loc.level);
            }
        }
    }
    printInfo(`fuzz: ${spots.length} places on the map with a bank in reach`);
    bankSpotCache = spots;
    return bankSpotCache;
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
    /** The tick it was last picked up and put down somewhere else. See tickInner. */
    private lastRoam = 0;
    /** The tick the last item audit window opened. */
    private lastAudit = 0;
    /** Ticks left to spend getting a bank open before an audit gives up and audits in place. */
    private openingBank = 0;
    /** The tick the current modal was first seen, and which modal it was. See tickInner. */
    private modalSince = -1;
    private modalWas = -1;
    /** The loiter stretch: when the last one started, and the tick the current one ends. */
    private lastLoiter = 0;
    private loiterUntil = 0;

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

        // A CHATBOX PROMPT IS ANSWERED BEFORE ANYTHING ELSE, because nothing else can get through.
        // While a script sits on p_countdialog or p_namedialog, Player.awaitingChatboxInput is true
        // and the engine swallows every input the bot sends - so a bot that reaches one and cannot
        // answer it is wedged for the whole rest of the run, clicking into a void.
        //
        // THAT IS NOT HYPOTHETICAL. The first 99-bot nightly reported `a queued script that never
        // resumes: [oploc3,poh_house_portal]@7` - execution state NAMEDIALOG - from clicking
        // Friend's house on a house portal and never typing a name. It was the only one of that
        // run's eighteen softlocks that was neither an artefact nor a bot idling at a bank, and
        // what it found was this gap rather than anything wrong with the portal.
        //
        // It also opens a surface the fuzzer could not reach at all: every Withdraw-X, Buy-X,
        // Offer-X and Make-X in the game ends in a p_countdialog, and the bot used to wedge on the
        // first one it clicked.
        if (bot.awaitingChatboxInput()) {
            this.answerPrompt();
            this.finish();
            return;
        }

        // custom (2026-11-02) - SOMEWHERE ELSE. A fuzzer that only walks tests the town it was
        // dropped in and nothing else: measured, eight bots over 3,545 ticks never left Lumbridge
        // and reached 1.5% of the build's triggers. Every so often it is picked up and put down in
        // another allocated zone, which is also the only way the 875 [mapzone]/[zone]/[zoneexit]
        // triggers ever fire. The cost is written down in BotManager.relocateFuzzer: a teleported
        // bot never discovers that the door it would have needed is sealed. NODE_BOTS_FUZZ_ROAM=0
        // turns it off for a run that is about reachability.
        const roam = Environment.NODE_BOTS_FUZZ_ROAM;
        if (roam > 0 && World.currentTick - this.lastRoam >= roam && !Watch.inItemAudit(this.watch) && !bot.containsModalInterface() && !bot.delayed) {
            this.lastRoam = World.currentTick;
            if (this.relocate()) {
                this.dest = null;
                this.boredSince = World.currentTick;
                this.note(`relocated to ${bot.x},${bot.z},${bot.level}`, 'walk');
                this.finish();
                return;
            }
        }

        // A LOITER STRETCH, on a budget rather than on a dice roll. See loiter() for what standing
        // still buys. It is scheduled like the audit and for the same reason the audit is: the first
        // version made it one more branch in act()'s cascade at 2% of the rolls, and because it
        // almost always succeeds it absorbed every other action's failures and came out at 9,950 of
        // 48,000 bot-ticks - while walking collapsed from 10,276 to 350. A fuzzer that does not walk
        // does not find anything. A stretch with a start and an end cannot run away like that.
        if (World.currentTick < this.loiterUntil) {
            if (this.loiter()) {
                this.finish();
                return;
            }
            this.loiterUntil = 0; // it got busy; nothing would hunt it, so stop wasting the ticks
        } else if (World.currentTick - this.lastLoiter >= LOITER_EVERY && !Watch.inItemAudit(this.watch) && !bot.containsModalInterface()) {
            this.lastLoiter = World.currentTick;
            this.loiterUntil = World.currentTick + LOITER_TICKS;
        }

        // An item audit, every AUDIT_EVERY ticks: the only way the conservation watcher gets a
        // window it can assert over. See the note above watchItemAudit in BotFuzzWatch.ts for why
        // waiting for one to happen by chance does not work.
        if (!Watch.inItemAudit(this.watch) && !bot.delayed) {
            const since = World.currentTick - this.lastAudit;
            // OPPORTUNISTIC, not purely on a timer. The audit's best moves are deposit and withdraw,
            // and those need a bank interface; a timer fires wherever the bot happens to be, which is
            // usually nowhere near one. Measured with the timer alone: 711 audit ticks produced 22
            // moves. So an audit starts EARLY if there is a bank in reach, and the timer is only the
            // floor - a bot that never passes a bank still audits its equipment and its own tile.
            //
            // THE BANK IS OPENED BEFORE THE WINDOW, not inside it, because the window is pinned to
            // one tile (watchItemAudit) and clicking a banker makes the engine walk you to them.
            // Opening it inside would abandon every window it opened.
            if (this.openingBank > 0) {
                this.openingBank--;
                if (this.hasForeignInv()) {
                    this.openingBank = 0;
                    this.lastAudit = World.currentTick;
                    Watch.beginItemAudit(bot, this.watch);
                } else if (!bot.containsModalInterface() && this.openBank()) {
                    this.finish();
                    return;
                } else if (this.openingBank === 0) {
                    // It would not open. Audit what can be audited where we stand.
                    this.lastAudit = World.currentTick;
                    Watch.beginItemAudit(bot, this.watch);
                } else {
                    this.note('walking to a bank for an item audit', 'walk');
                    this.finish();
                    return;
                }
            } else if (since >= Watch.AUDIT_EVERY / 3 && this.bankInReach()) {
                // Start the walk to it; the branch above takes over from here.
                this.openingBank = BANK_OPEN_TRIES;
                this.note('heading for a bank for an item audit', 'walk');
                this.finish();
                return;
            } else if (since >= Watch.AUDIT_EVERY && !bot.containsModalInterface()) {
                this.lastAudit = World.currentTick;
                Watch.beginItemAudit(bot, this.watch);
            }
        }

        // Every tick it is in a modal it tries to get out of one: answer the options, click through,
        // press one of its buttons, or close it. So the "a modal that will not close" watcher means
        // what it says - over a hundred ticks the bot has asked many times and it is still there.
        if (bot.containsModalInterface()) {
            // NOT DURING AN AUDIT. A bank is a modal, and this block exists to get OUT of modals -
            // so without this the audit opened a bank on one tick and shut it on the next, forever.
            // Inside the window the bot stays in whatever it opened and moves items through it.
            if (Watch.auditIsMoving(this.watch)) {
                for (let i = 0; i < ACTIONS_PER_TICK; i++) {
                    this.act();
                }
                this.finish();
                return;
            }
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
            // custom (2026-11-02) - WORK THE WINDOW BEFORE SHUTTING IT.
            //
            // This branch returns before act() ever runs, which means invOp() - the op on an item in
            // a grid the server has sent, which is Buy, Sell, Deposit and Withdraw - could only ever
            // fire on a grid that is NOT a modal. Every shop and every bank in the game is a modal.
            // So the whole buy/sell/deposit/withdraw surface was unreachable outside the item audit
            // window, and the 240 npcs in this build with a "Trade" option opened a shop on one tick
            // and had it shut on the next without a single item being clicked.
            //
            // A window is now DWELT in: up to MODAL_DWELL ticks of clicking its buttons and its
            // grids before the bot gives up and closes it. The soft-lock watcher allows a modal 100
            // ticks before it calls it stuck, so this is comfortably inside what it tolerates - and
            // a window the bot is working is not a window that will not close.
            if (this.modalSince === -1 || before !== this.modalWas) {
                this.modalSince = World.currentTick;
                this.modalWas = before;
            }
            if (World.currentTick - this.modalSince < MODAL_DWELL) {
                // The grid first: its ops are where the wealth moves, and they are what nothing had
                // ever reached. Then a button, which is how a quest or minigame panel is driven.
                if (this.rng.next() < 0.5 && this.invOp()) {
                    this.finish();
                    return;
                }
                if (this.clickOpenInterface()) {
                    this.finish();
                    return;
                }
                if (this.invOp()) {
                    this.finish();
                    return;
                }
                // Nothing in it to click. Fall through and close it rather than dwelling in an
                // empty window for twenty ticks.
            }
            this.modalSince = -1;
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
        // DURING AN ITEM AUDIT the bot moves items and does nothing else, because that is the only
        // way the conservation watcher ever gets a window to assert over - see the long note above
        // watchItemAudit in BotFuzzWatch.ts. Equipping, banking, dropping, taking back and dragging
        // one slot onto another: the whole surface a dupe lives on, and nothing that could create or
        // destroy anything.
        if (Watch.auditIsMoving(this.watch)) {
            // No dropping and no taking: the window's totals are the bot's own inventories and do
            // not include the ground, because the ground cannot be counted reliably (see
            // ownedInvItems in BotFuzzWatch.ts - two rounds of false `potato_seed +3` findings came
            // out of trying to). Deposit, withdraw, equip, unequip and drag are the surface a dupe
            // actually lives on, and they are all here.
            const roll = this.rng.int(1, 100);
            if (roll <= 45 && this.auditInvOp()) return;
            if (roll <= 80 && this.equipOrUnequip()) return;
            if (this.invDrag()) return;
            if (this.equipOrUnequip() || this.auditInvOp()) return;
            this.note('audit: nothing to move', 'idle');
            return;
        }
        // Past the moving half of the window it stands still, so a script with a delay in it has
        // landed before the totals are compared.
        if (Watch.inItemAudit(this.watch)) {
            this.note('audit: settling', 'idle');
            return;
        }

        // The weights are not tuned for realism, they are tuned for coverage: the things there are
        // thousands of (locs, npcs, items, buttons) get most of the clicks, and walking gets enough
        // to keep the bot from testing one street corner all night.
        //
        // custom (2026-11-02) - the use-on and cast-on clicks were added here, and they are not a
        // garnish: [oplocu] is 505 triggers, [opnpcu] 208, and the targeted-spell triggers another
        // 130-odd. No bot could send any of those packets at all before BotInput grew the hands for
        // them, so around 870 triggers in this build were unreachable by construction.
        //
        // The cast weight is deliberately small for the number of triggers behind it. A cast delays
        // the player for the spell's animation, so measured, 6% of the rolls became 20% of the
        // BOT-TICKS and cost more coverage elsewhere than the 130 targeted-spell triggers are
        // worth. Three percent still reaches them over a run.
        //
        // THE ORDER MATTERS AS MUCH AS THE WEIGHTS, which was not obvious and was measured the hard
        // way. These are `roll <= N && method()`, so a low roll that fails CASCADES into every
        // later branch - a branch late in the chain is tried whenever everything before it had
        // nothing to do. Casting was put in the middle at 3% of the rolls and came out as 20% of
        // the bot-ticks, because a bot with 99 Magic and a thousand runes can always cast something
        // at something, so it absorbed every other action's failures. And a cast costs the spell's
        // animation delay, so those were the most expensive ticks in the run.
        //
        // So the catch-alls go LAST, cheapest first: an interface button, then a spell, then
        // walking. Everything with a big trigger population in front of them.
        const roll = this.rng.int(1, 100);
        if (roll <= 22 && this.opLoc()) return;
        if (roll <= 38 && this.opNpc()) return;
        if (roll <= 45 && this.opObj()) return;
        if (roll <= 57 && this.opHeld()) return;
        if (roll <= 63 && this.heldUse()) return;
        if (roll <= 73 && this.useOnLoc()) return;
        if (roll <= 79 && this.useOnNpc()) return;
        if (roll <= 82 && this.useOnObj()) return;
        if (roll <= 86 && this.invOp()) return;
        if (roll <= 91 && this.clickOpenInterface()) return;
        if (roll <= 94 && this.castOnSomething()) return;
        if (roll <= 97 && this.opOtherPlayer()) return;
        this.wander();
    }

    // ------------------------------------------------------------------ use an item on the world

    /** An inventory slot worth using on something: any of them, preferring ones nothing has used. */
    private someSlot(): number | undefined {
        const inv = this.bot.getInventory(InvType.INV);
        if (!inv) {
            return undefined;
        }
        const slots: number[] = [];
        for (let i = 0; i < inv.capacity; i++) {
            if (inv.get(i)) {
                slots.push(i);
            }
        }
        return this.rng.pick(slots);
    }

    /** Item on loc: [oplocu] / [aplocu]. 509 triggers in this build, none of them reachable before. */
    private useOnLoc(): boolean {
        const bot = this.bot;
        const locs = this.nearby<Loc>(
            (x, z) => World.gameMap.getZone(x, z, bot.level).getAllLocsSafe(),
            l => l
        );
        // Coverage guidance works here exactly as it does for a plain op: prefer the (loc, item)
        // pair whose trigger nothing has run. The trigger is keyed on the LOC, not the item, so a
        // loc nothing has been used on at all is the one worth the click.
        const chosen = this.preferUncovered(locs, loc => {
            const type = LocType.get(loc.type);
            return ScriptProvider.getByTrigger(ServerTriggerType.OPLOCU, type.id, type.category) ?? ScriptProvider.getByTrigger(ServerTriggerType.APLOCU, type.id, type.category);
        });
        for (let tries = 0; tries < 4; tries++) {
            const loc = this.rng.pick(chosen);
            const slot = this.someSlot();
            if (!loc || slot === undefined) {
                return false;
            }
            const item = bot.getInventory(InvType.INV)?.get(slot);
            if (!item) {
                continue;
            }
            // Read the name before the click: a recipe consumes the slot. Same lesson as heldUse.
            const what = `use ${ObjType.get(item.id)?.debugname ?? item.id} on loc ${LocType.get(loc.type).debugname ?? loc.type} @${loc.x},${loc.z},${loc.level}`;
            if (Input.heldUseOnLoc(bot, loc, slot)) {
                this.note(what, 'uselocu');
                return true;
            }
        }
        return false;
    }

    /** Item on npc: [opnpcu] / [apnpcu]. 214 triggers, and most of the era's quests are solved here. */
    private useOnNpc(): boolean {
        const bot = this.bot;
        const npcs = this.nearby<Npc>(
            (x, z) => World.gameMap.getZone(x, z, bot.level).getAllNpcsSafe(),
            n => n
        );
        const chosen = this.preferUncovered(npcs, npc => {
            const type = NpcType.get(npc.type);
            return ScriptProvider.getByTrigger(ServerTriggerType.OPNPCU, type.id, type.category) ?? ScriptProvider.getByTrigger(ServerTriggerType.APNPCU, type.id, type.category);
        });
        for (let tries = 0; tries < 4; tries++) {
            const npc = this.rng.pick(chosen);
            const slot = this.someSlot();
            if (!npc || slot === undefined) {
                return false;
            }
            const item = bot.getInventory(InvType.INV)?.get(slot);
            if (!item) {
                continue;
            }
            const what = `use ${ObjType.get(item.id)?.debugname ?? item.id} on npc ${NpcType.get(npc.type).debugname ?? npc.type} @${npc.x},${npc.z}`;
            if (Input.heldUseOnNpc(bot, npc, slot)) {
                this.note(what, 'usenpcu');
                return true;
            }
        }
        return false;
    }

    /** Item on a ground obj: [opobju] / [apobju]. */
    private useOnObj(): boolean {
        const bot = this.bot;
        const objs = this.nearby<Obj>(
            (x, z) => World.gameMap.getZone(x, z, bot.level).getAllObjsSafe(),
            o => o
        );
        for (let tries = 0; tries < 3; tries++) {
            const obj = this.rng.pick(objs);
            const slot = this.someSlot();
            if (!obj || slot === undefined) {
                return false;
            }
            const item = bot.getInventory(InvType.INV)?.get(slot);
            if (!item) {
                continue;
            }
            const what = `use ${ObjType.get(item.id)?.debugname ?? item.id} on obj ${ObjType.get(obj.type)?.debugname ?? obj.type} @${obj.x},${obj.z}`;
            if (Input.heldUseOnObj(bot, obj, slot)) {
                this.note(what, 'useobju');
                return true;
            }
        }
        return false;
    }

    /**
     * A targeted spell on whatever is to hand: [apnpct] 51, [applayert] 54, [oploct] 6, [opnpct] 9,
     * [opheldt] 12, [apobjt] 1. Which components are castable is read off the spellbook's own
     * actionTarget flags rather than a list, so a new spell is picked up without a code change.
     */
    private castOnSomething(): boolean {
        const bot = this.bot;
        const kind = this.rng.int(1, 4);
        if (kind === 1) {
            const coms = Input.castableComs(bot, ComActionTarget.NPC);
            const com = this.rng.pick(coms);
            const npcs = this.nearby<Npc>(
                (x, z) => World.gameMap.getZone(x, z, bot.level).getAllNpcsSafe(),
                n => n
            );
            const npc = this.rng.pick(npcs);
            if (com === undefined || !npc) {
                return false;
            }
            if (Input.castOnNpc(bot, npc, com)) {
                this.note(`cast ${Component.get(com)?.comName ?? com} on npc ${NpcType.get(npc.type).debugname ?? npc.type}`, 'castnpc');
                return true;
            }
            return false;
        }
        if (kind === 2) {
            const coms = Input.castableComs(bot, ComActionTarget.LOC);
            const com = this.rng.pick(coms);
            const locs = this.nearby<Loc>(
                (x, z) => World.gameMap.getZone(x, z, bot.level).getAllLocsSafe(),
                l => l
            );
            const loc = this.rng.pick(locs);
            if (com === undefined || !loc) {
                return false;
            }
            if (Input.castOnLoc(bot, loc, com)) {
                this.note(`cast ${Component.get(com)?.comName ?? com} on loc ${LocType.get(loc.type).debugname ?? loc.type}`, 'castloc');
                return true;
            }
            return false;
        }
        if (kind === 3) {
            const coms = Input.castableComs(bot, ComActionTarget.OBJ);
            const com = this.rng.pick(coms);
            const objs = this.nearby<Obj>(
                (x, z) => World.gameMap.getZone(x, z, bot.level).getAllObjsSafe(),
                o => o
            );
            const obj = this.rng.pick(objs);
            if (com === undefined || !obj) {
                return false;
            }
            if (Input.castOnObj(bot, obj, com)) {
                this.note(`cast ${Component.get(com)?.comName ?? com} on obj ${ObjType.get(obj.type)?.debugname ?? obj.type}`, 'castobj');
                return true;
            }
            return false;
        }
        // On an item in its own backpack: enchanting, superheat, the alchemies.
        const coms = Input.castableComs(bot, ComActionTarget.HELD);
        const com = this.rng.pick(coms);
        const slot = this.someSlot();
        if (com === undefined || slot === undefined) {
            return false;
        }
        const item = bot.getInventory(InvType.INV)?.get(slot);
        if (!item) {
            return false;
        }
        const what = `cast ${Component.get(com)?.comName ?? com} on ${ObjType.get(item.id)?.debugname ?? item.id}`;
        if (Input.castOnHeld(bot, slot, com)) {
            this.note(what, 'castheld');
            return true;
        }
        return false;
    }

    // ------------------------------------------------------------------ the item audit's own moves

    /** Is there anything within reach offering a "Bank" option? See openBank for why the label. */
    private bankInReach(): boolean {
        const bot = this.bot;
        for (const npc of this.nearby<Npc>(
            (x, z) => World.gameMap.getZone(x, z, bot.level).getAllNpcsSafe(),
            n => n
        )) {
            if ((NpcType.get(npc.type)?.op ?? []).includes('Bank')) {
                return true;
            }
        }
        for (const loc of this.nearby<Loc>(
            (x, z) => World.gameMap.getZone(x, z, bot.level).getAllLocsSafe(),
            l => l
        )) {
            if ((LocType.get(loc.type)?.op ?? []).includes('Bank')) {
                return true;
            }
        }
        return false;
    }

    /** Is the bank open? That is what the pre-audit walk to a banker is trying to achieve. */
    private hasForeignInv(): boolean {
        const bank = InvType.getId('bank');
        return this.bot.invListeners.some(l => {
            const com = Component.get(l.com);
            return l.type === bank && !!com && this.bot.isComponentVisible(com) && validOps(com.iop ?? null).length > 0;
        });
    }

    /**
     * Click the nearest thing offering a "Bank" option.
     *
     * The option LABEL, not a list of booth names: the label is in the cache, it is what the player
     * reads, and this build has 27 npcs and 3 locs offering it. A list of debugnames would be a list
     * of the bankers somebody remembered, and would rot the first time the content added one.
     */
    private openBank(): boolean {
        const bot = this.bot;
        const npcs = this.nearby<Npc>(
            (x, z) => World.gameMap.getZone(x, z, bot.level).getAllNpcsSafe(),
            n => n
        );
        for (const npc of npcs) {
            const ops = NpcType.get(npc.type)?.op ?? null;
            const op = (ops ?? []).findIndex(o => o === 'Bank') + 1;
            if (op !== 0 && Input.opNpc(bot, npc, op)) {
                this.note(`audit open bank at ${NpcType.get(npc.type).debugname ?? npc.type}`, 'closemodal');
                return true;
            }
        }
        const locs = this.nearby<Loc>(
            (x, z) => World.gameMap.getZone(x, z, bot.level).getAllLocsSafe(),
            l => l
        );
        for (const loc of locs) {
            const ops = LocType.get(loc.type)?.op ?? null;
            const op = (ops ?? []).findIndex(o => o === 'Bank') + 1;
            if (op !== 0 && Input.opLoc(bot, loc, op)) {
                this.note(`audit open bank at ${LocType.get(loc.type).debugname ?? loc.type}`, 'closemodal');
                return true;
            }
        }
        return false;
    }

    /** Wield, wear or remove: a move between two of the bot's own inventories, so it must conserve. */
    private equipOrUnequip(): boolean {
        const bot = this.bot;
        const inv = bot.getInventory(InvType.INV);
        if (!inv) {
            return false;
        }
        for (let tries = 0; tries < 6; tries++) {
            const slot = this.someSlot();
            if (slot === undefined) {
                return false;
            }
            const item = inv.get(slot);
            if (!item) {
                continue;
            }
            const type = ObjType.get(item.id);
            const op = (type.iop ?? []).findIndex(o => o === 'Wield' || o === 'Wear') + 1;
            if (op === 0) {
                continue;
            }
            if (Input.heldOpSlot(bot, slot, op)) {
                this.note(`audit equip ${type.debugname ?? item.id}`, 'equip');
                return true;
            }
        }
        // Nothing wieldable left in the backpack: take something off instead, which is the other
        // half of the same move and the half a dupe is likelier to live in.
        const worn = bot.getInventory(InvType.WORN);
        if (!worn) {
            return false;
        }
        for (let i = 0; i < worn.capacity; i++) {
            const item = worn.get(i);
            if (!item) {
                continue;
            }
            const com = bot.invListeners.find(l => l.type === InvType.WORN && l.source === bot.uid)?.com;
            if (com === undefined) {
                return false;
            }
            if (Input.wornOp(bot, com, i, 1)) {
                this.note(`audit remove ${ObjType.get(item.id)?.debugname ?? item.id}`, 'wornop');
                return true;
            }
        }
        return false;
    }

    /**
     * The grids an AUDIT may move items through: the backpack, what it is wearing, and its bank.
     *
     * WHY NOT ANY GRID THE SERVER HAS SENT. invOp() runs whatever [inv_button1..5] script the content
     * put behind that component, and a script can do anything - a shop's Buy legitimately creates an
     * item in your backpack in exchange for coins, and the stock it came out of is a SHARED
     * inventory that ownedInvItems does not and should not count. An audit that called that a move
     * would call every purchase a dupe.
     *
     * These three are different in kind: the scripts behind them move an obj from one inventory of
     * the player's to another and nothing else, which is exactly what the audit asserts about. It is
     * also where a dupe actually lives - deposit, withdraw, wear, remove.
     *
     * This was arrived at the hard way. The audit reported `abyssal_bludgeon +1` off a trail of
     * nothing but equip and Remove; two targeted sims (equip/remove, and a two-hander displacing a
     * shield) both conserved, which meant the finding was the oracle's and not the content's.
     */
    private auditGrids(): { com: number; type: number }[] {
        const bank = InvType.getId('bank');
        return this.bot.invListeners
            .filter(l => {
                if (l.source !== this.bot.uid) {
                    return false;
                }
                if (l.type !== InvType.INV && l.type !== InvType.WORN && l.type !== bank) {
                    return false;
                }
                const com = Component.get(l.com);
                return !!com && this.bot.isComponentVisible(com);
            })
            .map(l => ({ com: l.com, type: l.type }));
    }

    /** invOp, restricted to the grids above. The audit uses this; ordinary fuzzing uses invOp(). */
    private auditInvOp(): boolean {
        const bot = this.bot;
        const grids = this.auditGrids();
        for (let tries = 0; tries < 4; tries++) {
            const grid = this.rng.pick(grids);
            if (!grid) {
                return false;
            }
            const listener = bot.invListeners.find(l => l.com === grid.com);
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
            const com = Component.get(grid.com);
            const op = this.rng.pick(validOps(com?.iop ?? null));
            if (slot === undefined || op === undefined) {
                continue;
            }
            if (Input.invOp(bot, grid.com, slot, op)) {
                this.note(`audit invop ${com?.comName ?? grid.com} slot${slot} op${op} (${com?.iop?.[op - 1] ?? ''})`, 'invop');
                return true;
            }
        }
        return false;
    }

    /** One slot dragged onto another: [inv_buttond], and the place two stacks meet. */
    private invDrag(): boolean {
        const bot = this.bot;
        const listeners = bot.invListeners.filter(l => {
            const com = Component.get(l.com);
            return com && bot.isComponentVisible(com) && l.source === bot.uid;
        });
        const listener = this.rng.pick(listeners);
        if (!listener) {
            return false;
        }
        const inv = bot.getInventoryFromListener(listener);
        if (!inv || inv.capacity < 2) {
            return false;
        }
        const a = this.rng.int(0, inv.capacity - 1);
        const b = this.rng.int(0, inv.capacity - 1);
        if (a === b) {
            return false;
        }
        if (Input.invDrag(bot, listener.com, a, b)) {
            this.note(`audit drag ${Component.get(listener.com)?.comName ?? listener.com} ${a}->${b}`, 'invop');
            return true;
        }
        return false;
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
     * Pick the bot up and put it down in another allocated zone.
     *
     * THE COST, WRITTEN DOWN. A teleported bot never finds out that the gate it would have had to
     * open is sealed on all four sides, which is the bug class tools/sim/questrun.ts exists to
     * catch and the reason that runner has no teleport in it. Walking finds reachability bugs.
     * Teleporting finds the other fifteen thousand triggers. They are different jobs, and this one
     * needs the whole map: measured, eight fuzzers walking for 3,545 ticks never left Lumbridge.
     *
     * The destination is rolled rather than taken from a list of towns, because a list of towns is a
     * list of the places somebody already thought of - and the content nobody has tested is, by
     * definition, somewhere nobody thought of.
     */
    private relocate(): boolean {
        const bot = this.bot;
        // ONE RELOCATION IN FOUR GOES TO A BANK. The item audit's best moves are deposit and
        // withdraw - "where a dupe lives", in the words of the watcher that tests for one - and they
        // need a bank interface open. Left to chance a fuzzer almost never stands next to a banker:
        // measured, 228 audit ticks in a 3,000-tick run produced 36 moves and almost none of them
        // through a bank. Sending it to one on purpose is the difference between a conservation
        // test of a backpack and a conservation test of the bank.
        if (this.rng.int(1, 4) === 1) {
            const bank = this.rng.pick(bankSpots());
            if (bank) {
                bot.teleport(bank.x, bank.z, bank.level);
                return true;
            }
        }

        let fallback: { x: number; z: number; level: number } | null = null;
        for (let tries = 0; tries < 400; tries++) {
            // Most of the map's standable ground is on level 0; the upper storeys and dungeons are
            // worth visiting and get the rest.
            const level = this.rng.int(0, 7) < 6 ? 0 : this.rng.int(1, 3);
            const x = this.rng.int(1152, 3967);
            const z = this.rng.int(2496, 4159);
            if (!isZoneAllocated(level, x, z) || isMapBlocked(x, z, level)) {
                continue;
            }
            if (!fallback) {
                fallback = { x, z, level };
            }
            // DENSITY, OR THIS MAKES THINGS WORSE. The first cut of this rolled a walkable tile and
            // took it, and coverage went DOWN - 148 triggers against 159 for the bot that never
            // left Lumbridge. Most of a 3,000-tile-square map is empty field and open water, and a
            // fuzzer put down in one spends its whole stay walking to the edge of it. Lumbridge at
            // least has things in it.
            //
            // So a destination has to have something to click. The count is of ops in reach, not
            // locs: a field of trees with one op each is not the same as a town.
            if (this.opsInReach(x, z, level) >= RELOCATE_MIN_OPS) {
                bot.teleport(x, z, level);
                return true;
            }
        }
        // Nothing dense turned up in 400 rolls. Go somewhere walkable anyway rather than staying -
        // a run that never relocates is the behaviour this exists to replace.
        if (fallback) {
            bot.teleport(fallback.x, fallback.z, fallback.level);
            return true;
        }
        return false;
    }

    /**
     * How many loc and npc ops a bot standing here would have to choose from. The same nine zones
     * and the same validOps the brain itself uses, so "dense" means dense for the fuzzer rather
     * than dense on a map viewer.
     */
    private opsInReach(x: number, z: number, level: number): number {
        let n = 0;
        for (let dx = -1; dx <= 1; dx++) {
            for (let dz = -1; dz <= 1; dz++) {
                const zone = World.gameMap.getZone(x + dx * 8, z + dz * 8, level);
                for (const loc of zone.getAllLocsSafe()) {
                    n += validOps(LocType.get(loc.type)?.op ?? null).length;
                }
                for (const npc of zone.getAllNpcsSafe()) {
                    n += validOps(NpcType.get(npc.type)?.op ?? null).length;
                }
                if (n >= RELOCATE_MIN_OPS) {
                    return n; // enough is enough; no need to count a whole town
                }
            }
        }
        return n;
    }

    /**
     * Something aimed at another fuzzer. [applayert] is 54 triggers and [opplayert] 12 - the god
     * spells and the rest of the targeted PvP magic - and no fuzzer had ever aimed anything at
     * another one.
     *
     * WHAT IS DELIBERATELY NOT HERE. The engine refuses most of this against a bot on purpose:
     * OpPlayerHandler allows only op 2 (Attack) and op 3 (Follow) when the target is a bot, and
     * OpPlayerUHandler refuses outright with "it doesn't take items". So trading a bot and using an
     * item on one are not oversights to be worked around - [opplayeru] and [applayeru], ten triggers
     * between them, are out of a fuzzer's reach by design and a sim with two real players is what
     * would cover them.
     */
    private opOtherPlayer(): boolean {
        const bot = this.bot;
        const others: Player[] = [];
        for (const other of World.playerLoop.all()) {
            if (other !== bot && other.isBot && other.level === bot.level && Math.abs(other.x - bot.x) <= REACH && Math.abs(other.z - bot.z) <= REACH) {
                others.push(other);
            }
        }
        const other = this.rng.pick(others);
        if (!other) {
            return false;
        }
        if (this.rng.next() < 0.6) {
            const coms = Input.castableComs(bot, ComActionTarget.PLAYER);
            const com = this.rng.pick(coms);
            if (com !== undefined && Input.castOnPlayer(bot, other, Component.get(com)?.comName ?? '')) {
                this.note(`cast ${Component.get(com)?.comName ?? com} on ${other.username}`, 'castplayer');
                return true;
            }
            return false;
        }
        // op 2 is Attack, op 3 is Follow - the only two the engine lets anyone aim at a bot.
        const op = this.rng.next() < 0.5 ? 2 : 3;
        if (Input.opPlayer(bot, other, op)) {
            this.note(`opplayer ${other.username} op${op}`, 'opplayer');
            return true;
        }
        return false;
    }

    /**
     * Stand still and let the world act on it.
     *
     * A fuzzer has never once done nothing, and that is a coverage gap rather than a virtue. Whole
     * families of trigger only fire while a player is standing there being available:
     *
     *   [ai_queue1..20]   769 for queue 3 alone. Npc.consumeHuntTarget runs these when a hunt FINDS
     *                     a player - the npc decides to engage, the player does not click anything.
     *   [ai_opplayer2]    175, and [ai_applayer2] 132: an npc attacking a player, and following it up.
     *   [ai_timer]        113. A clock on the npc, which needs the bot to still be there when it
     *                     comes round.
     *
     * None of that happens to a bot that clicks something and immediately walks twenty tiles away.
     * Npc.huntPlayers also skips a player who is `busy()` - delayed or in a modal - so this stays
     * out of both: it is the one action that does nothing at all.
     *
     * It is weighted low because an idle tick tests nothing by itself. What it buys is the ticks
     * AFTER it, when something else has decided to act.
     */
    /**
     * Answer whichever chatbox prompt is open. See the note in tickInner for why it must be
     * answered rather than ignored.
     *
     * THE AMOUNTS ARE PLAUSIBLE ONES, deliberately. The decoder is g4s, so a real client can send
     * any signed 32-bit value and nothing bounds it, and a fuzzer that sent 0, -1 and 2^31-1 would
     * be testing a genuinely interesting surface - item counts that go negative are how
     * duplication bugs happen. That is a run of its own and wants measuring before it goes near a
     * nightly gate, so it is written down here and not done here.
     *
     * THE NAME IS SOMETIMES ANOTHER BOT'S, which is the only way the prompt's real path gets
     * walked: p_namedialog in this build is "whose house", "who to add", "who to message", and a
     * name nobody holds only ever reaches the rejection branch.
     */
    private answerPrompt(): void {
        const bot = this.bot;
        if (bot.activeScript?.execution === ScriptState.NAMEDIALOG) {
            const others = [...World.playerLoop.all()].filter(p => p.isBot && p !== bot);
            const other = this.rng.next() < 0.75 ? this.rng.pick(others) : undefined;
            const who = other?.username ?? 'nobody' + this.rng.int(1, 999);
            if (Input.typeName(bot, who)) {
                this.note(`typed the name ${who}`, 'dialogue');
                return;
            }
        }
        if (Input.typeCount(bot, this.rng.pick([1, 5, 10, 28, 100, 1000]) ?? 1)) {
            this.note('typed an amount', 'dialogue');
            return;
        }
        // Neither handler took it - the script moved on between the check and here. Nothing to do,
        // and saying so keeps it out of the action histogram's `idle` bucket.
        this.note('prompt closed itself', 'dialogue');
    }

    private loiter(): boolean {
        const bot = this.bot;
        if (bot.containsModalInterface() || bot.delayed) {
            return false; // busy() is true, so nothing would hunt it anyway
        }
        // Drop the walk destination, or the engine keeps walking the route it was already given and
        // the bot is not standing still at all.
        this.dest = null;
        bot.clearWaypoints();
        bot.unsetMapFlag();
        this.note('loitering', 'idle');
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
