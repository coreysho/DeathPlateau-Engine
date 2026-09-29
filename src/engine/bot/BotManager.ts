import InvType from '#/cache/config/InvType.js';
import VarBitType from '#/cache/config/VarBitType.js';
import ObjType from '#/cache/config/ObjType.js';
import { BotBrain, BotState, getVarp, resetBrainCaches, setVarp, surfaceWildernessLevel, wildernessLevel } from '#/engine/bot/BotBrain.js';
import { FuzzBrain } from '#/engine/bot/BotFuzzer.js';
import { findings } from '#/engine/bot/BotFuzzWatch.js';
import ScriptFaults from '#/engine/script/ScriptFaults.js';
import { BOT_BRACKETS, type BotBracket, type BotConfigData, type BotHotspot, areaFor, loadBotConfig } from '#/engine/bot/BotConfig.js';
import type { BotHooks } from '#/engine/bot/BotHooks.js';
import { type BotKind, type BotKit, BOT_KITS, kitById, kitsFor } from '#/engine/bot/BotKits.js';
import BotPlayer from '#/engine/bot/BotPlayer.js';
import { isMapBlocked } from '#/engine/GameMap.js';
import Player from '#/engine/entity/Player.js';
import { PlayerStat } from '#/engine/entity/PlayerStat.js';
import World from '#/engine/World.js';
import Environment from '#/util/Environment.js';
import { printInfo, printWarning } from '#/util/Logger.js';

// Keeps the configured number of bots in the world, gives each its kit on every (re)spawn, handles
// their deaths (the small drop, never the kit) and their trips out to restock, and takes them away
// again. Started by app.ts only when NODE_BOTS=true; World.bots points here while it runs.

type Entry = { state: BotState; brain: BotBrain | FuzzBrain; removeBy: number; respawn: boolean; loggedIn: boolean };
type Respawn = { kind: BotKind; bracket: BotBracket; name: string; kitId: string | null; at: number; manual: boolean; fuzzSeed?: number };

const NAME_PREFIX = 'bot_'; // base37 of "Bot " - the display name reads "Bot Grimlock"

function rand(min: number, max: number): number {
    return min + Math.floor(Math.random() * (max - min + 1));
}

function pick<T>(list: T[]): T {
    return list[Math.floor(Math.random() * list.length)];
}

class BotManager implements BotHooks {
    config: BotConfigData = loadBotConfig('');
    running = false;
    /** Paused by ::bots off: none kept in the world until ::bots on. */
    paused = false;

    private readonly entries: Map<BotPlayer, Entry> = new Map();
    private readonly respawns: Respawn[] = [];
    private nextSpawnTick = 0;

    // ------------------------------------------------------------------ lifecycle

    start(config?: BotConfigData): void {
        this.config = config ?? loadBotConfig();
        this.running = true;
        this.paused = false;
        this.nextSpawnTick = World.currentTick + 10;
        resetBrainCaches();
        const broken = this.checkKits();
        for (const line of broken) {
            printWarning(`bots: ${line}`);
        }
        World.bots = this;
        const total = (c: Record<BotBracket, number>) => BOT_BRACKETS.reduce((n, b) => n + c[b], 0);
        const per = (c: Record<BotBracket, number>) => BOT_BRACKETS.map(b => `${c[b]} ${b}`).join(', ');
        printInfo(
            `bots: on - ${total(this.config.roamers)} roamers (${per(this.config.roamers)}), ${total(this.config.pkers)} PKers (${per(this.config.pkers)}), bots fight bots: ${this.config.botsAttackBots}, ${this.config.hotspots.length} hotspots`
        );
    }

    stop(): void {
        for (const bot of [...this.entries.keys()]) {
            World.removePlayer(bot);
        }
        this.entries.clear();
        this.respawns.length = 0;
        this.running = false;
        if (World.bots === this) {
            World.bots = null;
        }
    }

    /** Kits naming an obj that does not exist (a content change renamed it). Those kits are skipped. */
    checkKits(): string[] {
        const out: string[] = [];
        for (const kit of BOT_KITS) {
            const missing = this.missingObjs(kit);
            if (missing.length) out.push(`kit ${kit.id} names objs that do not exist: ${missing.join(', ')} - not used`);
        }
        return out;
    }

    private missingObjs(kit: BotKit): string[] {
        const names = [...kit.worn, kit.food, ...kit.inv.map(i => i[0]), ...kit.dropExtras.map(i => i[0])];
        if (kit.wornAmmo) names.push(kit.wornAmmo[0]);
        return names.filter(n => ObjType.getId(n) === -1);
    }

    // ------------------------------------------------------------------ BotHooks

    isReservedName(username: string): boolean {
        return username.startsWith(NAME_PREFIX);
    }

    input(player: Player): void {
        const bot = player as BotPlayer;
        // what a connected client's decodeIn does every tick: fresh input, and "still here"
        bot.userPath = [];
        bot.opcalled = false;
        bot.lastConnected = World.currentTick;
        bot.lastResponse = World.currentTick;

        const entry = this.entries.get(bot);
        if (!entry || !bot.isActive) {
            return;
        }
        entry.brain.tick();
    }

    cycle(): void {
        if (!this.running) {
            return;
        }
        const now = World.currentTick;

        for (const [bot, entry] of this.entries) {
            const s = entry.state;
            if (!entry.loggedIn) {
                if (bot.slot === -1) {
                    continue; // logs in at the end of this tick
                }
                entry.loggedIn = true;
            }

            // gone from the world (a removal finished, or something else took it out)
            if (s.phase === 'removing' || bot.slot === -1) {
                if (bot.slot === -1 || !bot.isActive) {
                    this.entries.delete(bot);
                    if (entry.respawn && !this.paused) {
                        // A fuzzer that died comes back a fuzzer, with the seed it had. Without this
                        // it would come back as an ordinary roamer and the run would quietly stop
                        // fuzzing without anyone noticing.
                        const fuzzSeed = entry.brain instanceof FuzzBrain ? (this.fuzzRunning ? entry.brain.seed : undefined) : undefined;
                        this.queueRespawn(s.kind, s.kit.bracket, bot.username.slice(NAME_PREFIX.length), s.manual ? s.kit.id : null, s.manual, fuzzSeed);
                    }
                } else if (now >= entry.removeBy) {
                    World.removePlayer(bot); // it had its chance to log out properly
                }
                continue;
            }

            // dying: swap the kit for the small drop before the death script drops what it carries
            if (getVarp(bot, 'death') === 1 && s.phase !== 'dead') {
                s.phase = 'dead';
                s.deaths++;
                this.applyDeathDrop(s);
                continue;
            }
            // dead and respawned in Lumbridge: out, and back later with a fresh kit
            if (s.phase === 'dead' && getVarp(bot, 'death') === 0 && bot.levels[PlayerStat.HITPOINTS] > 0) {
                this.remove(entry, true);
                continue;
            }
            // made it out to restock
            if (s.phase === 'leaving' && s.restocked) {
                this.remove(entry, true);
                continue;
            }
        }

        if (World.shutdownSoon) {
            return; // nobody new is let in now, bots included
        }

        // due respawns
        for (let i = 0; i < this.respawns.length; i++) {
            const r = this.respawns[i];
            if (r.at > now || this.paused) continue;
            if (World.getPlayerByUsername(NAME_PREFIX + r.name.toLowerCase()) !== undefined) {
                r.at = now + 5; // the old one has not quite gone
                continue;
            }
            this.respawns.splice(i--, 1);
            this.spawn(r.kind, { name: r.name, kitId: r.kitId ?? undefined, bracket: r.bracket, manual: r.manual, fuzzSeed: r.fuzzSeed, at: r.fuzzSeed === undefined ? undefined : this.fuzzStart() });
        }

        if (Environment.NODE_BOTS_TRACE > 0 && now % Environment.NODE_BOTS_TRACE === 0) {
            for (const s of this.all()) {
                const b = s.bot;
                const heard = b.messages.length ? b.messages[b.messages.length - 1].text : '';
                const dest = s.dest ? `${s.dest.why}@${s.dest.x},${s.dest.z}${s.destArrived ? '(there)' : ''}` : '-';
                printInfo(`bot t${now} ${this.describe(s)} @${b.x},${b.z} ${b.run ? 'run' : 'walk'} ${(b.runenergy / 100) | 0}% dest:${dest} last:${s.lastAction} heard:${heard}`);
            }
        }

        // top up to the configured counts, one at a time
        if (!this.paused && now >= this.nextSpawnTick) {
            top: for (const kind of ['roamer', 'pker'] as BotKind[]) {
                for (const bracket of BOT_BRACKETS) {
                    const want = (kind === 'roamer' ? this.config.roamers : this.config.pkers)[bracket] ?? 0;
                    if (this.count(kind, bracket) < want) {
                        this.spawn(kind, { bracket });
                        this.nextSpawnTick = now + this.config.spawnIntervalTicks;
                        break top;
                    }
                }
            }
        }
    }

    /** Automatic bots of a kind and bracket in the world or on their way back (manual ones do not count). */
    private count(kind: BotKind, bracket: BotBracket): number {
        let n = 0;
        for (const e of this.entries.values()) {
            if (e.state.kind === kind && e.state.kit.bracket === bracket && !e.state.manual && (e.state.phase !== 'removing' || e.respawn)) n++;
        }
        for (const r of this.respawns) {
            if (r.kind === kind && r.bracket === bracket && !r.manual) n++;
        }
        return n;
    }

    private queueRespawn(kind: BotKind, bracket: BotBracket, name: string, kitId: string | null, manual: boolean, fuzzSeed?: number): void {
        const [min, max] = this.config.respawnTicks;
        this.respawns.push({ kind, bracket, name, kitId, manual, fuzzSeed, at: World.currentTick + rand(min, max) });
    }

    // ------------------------------------------------------------------ spawning

    private usedNames(): Set<string> {
        const used = new Set<string>();
        for (const bot of this.entries.keys()) used.add(bot.username);
        for (const r of this.respawns) used.add(NAME_PREFIX + r.name.toLowerCase());
        return used;
    }

    private pickName(): string {
        const used = this.usedNames();
        const free = this.config.names.filter(n => !used.has(NAME_PREFIX + n.toLowerCase().replaceAll(' ', '_')));
        if (free.length) return pick(free);
        for (let i = 2; i < 100; i++) {
            const name = pick(this.config.names).slice(0, 6) + i;
            if (!used.has(NAME_PREFIX + name.toLowerCase())) return name;
        }
        return 'X' + rand(1000, 9999);
    }

    /** A spawn point: a hotspot the kit's bracket may be at (its brackets list, else its depth). */
    private hotspotFor(kit: BotKit): BotHotspot {
        const area = areaFor(kit, this.config);
        const inside = (h: BotHotspot) => surfaceWildernessLevel(h.x, h.z) <= area.maxLevel && h.x >= area.minX && h.x <= area.maxX;
        const ok = this.config.hotspots.filter(h => (h.brackets ? h.brackets.includes(kit.bracket) && inside(h) : inside(h)));
        if (ok.length) return pick(ok);
        // none configured in its area (a melee area with no hotspot of its own): its middle, shallow end
        const z = 3520 + Math.min(area.maxLevel, 3) * 8 - 4;
        return { name: 'its area', x: Math.floor((area.minX + area.maxX) / 2), z, radius: 10 };
    }

    /**
     * Put a bot in the world. It logs in next tick like anyone (the login script sets its tabs up
     * around the kit it is wearing). Returns the bot, or why it could not.
     */
    spawn(kind: BotKind, opts: { name?: string; kitId?: string; bracket?: BotBracket; at?: { x: number; z: number; level: number }; manual?: boolean; fuzzSeed?: number } = {}): BotPlayer | string {
        let kit: BotKit | undefined;
        if (opts.kitId) {
            kit = kitById(opts.kitId);
            if (!kit) return `no kit "${opts.kitId}"`;
            if (this.missingObjs(kit).length) return `kit ${kit.id} names objs that do not exist`;
        } else {
            let usable = kitsFor(kind, opts.bracket).filter(k => this.missingObjs(k).length === 0);
            if (!usable.length) usable = kitsFor(kind).filter(k => this.missingObjs(k).length === 0);
            if (!usable.length) return `no usable kit for ${kind}s`;
            kit = pick(usable);
        }
        if (this.config.hotspots.length === 0) return 'no hotspots configured';

        const name = (opts.name ?? this.pickName()).slice(0, 8);
        const username = NAME_PREFIX + name.toLowerCase().replaceAll(' ', '_');
        if (World.getPlayerByUsername(username)) return `${username} is already in the world`;

        const hotspot = opts.at ? { name: 'here', x: opts.at.x, z: opts.at.z, level: opts.at.level, radius: 6 } : this.hotspotFor(kit);
        const level = hotspot.level ?? 0;
        let x = hotspot.x;
        let z = hotspot.z;
        for (let i = 0; i < 30; i++) {
            const tx = hotspot.x + rand(-hotspot.radius, hotspot.radius);
            const tz = hotspot.z + rand(-hotspot.radius, hotspot.radius);
            if (!isMapBlocked(tx, tz, level)) {
                x = tx;
                z = tz;
                break;
            }
        }

        const bot = new BotPlayer(username);
        bot.teleport(x, z, level);
        this.outfit(bot, kit);

        const state = new BotState(bot, kind, kit, hotspot);
        state.manual = opts.manual ?? false;
        const brain = opts.fuzzSeed === undefined ? new BotBrain(state, this.config) : new FuzzBrain(state, opts.fuzzSeed);
        this.entries.set(bot, { state, brain, removeBy: 0, respawn: false, loggedIn: false });
        World.newPlayers.add(bot);
        return bot;
    }

    /** Stats, kit, the settings a new account would have chosen, a random look. */
    private outfit(bot: BotPlayer, kit: BotKit): void {
        for (let stat = 0; stat < bot.stats.length; stat++) {
            bot.setLevel(stat, stat === PlayerStat.HITPOINTS ? 10 : 1);
        }
        for (const [stat, level] of Object.entries(kit.stats)) {
            bot.setLevel(Number(stat), level as number);
        }
        // Agility for run energy: a bot crosses the whole Wilderness, and at Agility 1 it would spend
        // most of the way walking while its energy crawled back (Player.updateEnergy: level / 6 + 8 a tick)
        bot.setLevel(PlayerStat.AGILITY, { low: 30, mid: 50, high: 70, max: 85 }[kit.bracket]);
        bot.combatLevel = bot.getCombatLevel();

        const worn = bot.getInventory(InvType.WORN)!;
        const inv = bot.getInventory(InvType.INV)!;
        worn.removeAll();
        inv.removeAll();
        for (const name of kit.worn) {
            const id = ObjType.getId(name);
            const type = ObjType.get(id);
            if (type.wearpos !== -1) bot.invSet(InvType.WORN, id, 1, type.wearpos);
        }
        if (kit.wornAmmo) {
            const id = ObjType.getId(kit.wornAmmo[0]);
            bot.invSet(InvType.WORN, id, kit.wornAmmo[1], ObjType.get(id).wearpos);
        }
        for (const [name, count] of kit.inv) {
            bot.invAdd(InvType.INV, ObjType.getId(name), count);
        }
        const food = ObjType.getId(kit.food);
        for (let i = 0; i < kit.foodCount && inv.freeSlotCount > 0; i++) {
            bot.invAdd(InvType.INV, food, 1);
        }

        setVarp(bot, 'tutorial', 1000); // ^tutorial_complete
        // the quests its kit's switches ask for (levelrequire.rs2): dragon weapons, rune platebody
        setVarp(bot, 'zanaris', 6); // ^zanaris_complete - dragon dagger, dragon longsword
        setVarp(bot, 'mm_main', 20); // ^mm_complete - dragon scimitar
        setVarp(bot, 'dragonquest', 10); // ^dragon_complete - rune platebody
        const dt = VarBitType.getByName('deserttreasure');
        if (dt) bot.setVarBit(dt.id, 15); // ^deserttreasure_complete - the ancient staff
        setVarp(bot, 'sa_energy', 1000); // ^sa_max_energy
        setVarp(bot, 'option_nodef', 0); // auto retaliate on
        setVarp(bot, 'option_run', 1);
        setVarp(bot, 'spellbook', kit.spellbook === 'ancient' ? 1 : 0);
        bot.runenergy = 10000;

        bot.gender = 0;
        for (let i = 0; i < bot.colors.length; i++) {
            bot.colors[i] = rand(0, (Player.DESIGN_BODY_COLORS[i]?.length ?? 1) - 1);
        }
        bot.buildAppearance(InvType.WORN);
    }

    /**
     * The drop: its bracket's coins, a little of its own food, sometimes one cheap piece - and the
     * content's death script adds the bones and hands it all to the killer. The kit itself is taken
     * away here, before that script drops what the bot carries. Skulled, so no "kept on death" items.
     */
    private applyDeathDrop(s: BotState): void {
        const bot = s.bot;
        const drop = this.config.deathDrop[s.kit.bracket];
        const foodId = ObjType.getId(s.kit.food);
        const foodLeft = foodId === -1 ? 0 : bot.invTotal(InvType.INV, foodId);

        for (const inv of [InvType.INV, InvType.WORN]) {
            bot.getInventory(inv)?.removeAll();
        }
        for (const name of ['looting_bag_store']) {
            const id = InvType.getId(name);
            if (id !== -1) bot.getInventory(id)?.removeAll();
        }

        const coins = rand(drop.coins[0], drop.coins[1]);
        if (coins > 0) bot.invAdd(InvType.INV, ObjType.getId('coins'), coins);
        const food = Math.min(drop.food, foodLeft);
        for (let i = 0; i < food; i++) bot.invAdd(InvType.INV, foodId, 1);
        if (s.kit.dropExtras.length && Math.random() < drop.extraChance) {
            const [name, count] = pick(s.kit.dropExtras);
            bot.invAdd(InvType.INV, ObjType.getId(name), count);
        }

        setVarp(bot, 'pk_skull', 1); // nothing kept
        setVarp(bot, 'prayer8', 0); // not even with Protect Item
    }

    /** Take a bot out through the normal logout (so the logout script runs), forced if it dawdles. */
    private remove(entry: Entry, respawn: boolean): void {
        entry.state.phase = 'removing';
        entry.respawn = respawn;
        entry.removeBy = World.currentTick + 20;
        entry.state.bot.loggingOut = true;
    }

    // ------------------------------------------------------------------ fuzzers
    //
    // custom (2026-09-29) - see BotFuzzer.ts for what these do. Everything about them is the same as
    // an ordinary bot except the brain: same login, same kit, same death, same removal.

    /** The seed the run was started with, so a finding can name it and ::bot fuzz can print it. */
    fuzzSeed = 0;
    fuzzRunning = false;

    /**
     * THE GUARD. A fuzzer clicks everything in reach: it drops items, fires quest triggers, pulls
     * every monster it can see and answers dialogue at random, all under an account nobody is
     * holding. On a live world that is not a test, it is griefing, and there is no way to tell the
     * difference from the inside. So it refuses to start anywhere but a development world, and it is
     * STRICTER than the ordinary bots, which ask only for NODE_BOTS:
     *
     *   - NODE_BOTS_FUZZ must be set, deliberately, on top of NODE_BOTS;
     *   - NODE_PRODUCTION must be false. The live world sets it true, and that is the one flag the
     *     deploy always sets;
     *   - no real player may be in the world who is not staff. A dev world with a visitor on it is
     *     somebody's world for the moment they are on it.
     *
     * Returns an empty string on success, or why it refused.
     */
    startFuzzers(count: number, seed: number, at?: { x: number; z: number; level: number }): string {
        if (!Environment.NODE_BOTS_FUZZ) {
            return 'fuzzers are off on this world (NODE_BOTS_FUZZ).';
        }
        if (Environment.NODE_PRODUCTION) {
            return 'refusing: NODE_PRODUCTION is true. The fuzzer only runs on a development world.';
        }
        if (!this.running) {
            return 'bots are not running (NODE_BOTS).';
        }
        for (const player of World.playerLoop.all()) {
            if (!player.isBot && player.staffModLevel < 3) {
                return `refusing: ${player.displayName} is in the world and is not staff. The fuzzer is not run around players.`;
            }
        }

        this.fuzzSeed = seed || (Date.now() & 0x7fffffff);
        this.fuzzRunning = true;
        findings.setFile(Environment.NODE_BOTS_FUZZ_FILE);
        // The fuzzer's whole point is to find script errors, so it turns the reporter on for itself
        // if the world has not. Same file, same signatures, same ::faults.
        if (!ScriptFaults.enabled) {
            ScriptFaults.enableForTesting(Environment.NODE_SCRIPT_FAULTS_FILE);
        }

        const start = at ?? this.fuzzStart();
        let made = 0;
        for (let i = 0; i < count; i++) {
            const result = this.spawn('roamer', { at: start, manual: true, fuzzSeed: this.fuzzSeed + i });
            if (typeof result === 'string') {
                return `only ${made} of ${count} started: ${result}`;
            }
            made++;
        }
        printInfo(`bots: ${made} fuzzers at ${start.x},${start.z},${start.level}, seed ${this.fuzzSeed} - findings to ${Environment.NODE_BOTS_FUZZ_FILE}`);
        return '';
    }

    /** NODE_BOTS_FUZZ_AT as "x,z,level", or Lumbridge - the most content per tile in the game. */
    private fuzzStart(): { x: number; z: number; level: number } {
        const parts = Environment.NODE_BOTS_FUZZ_AT.split(',').map(n => parseInt(n.trim()));
        if (parts.length >= 2 && parts.every(n => Number.isFinite(n))) {
            return { x: parts[0], z: parts[1], level: parts[2] ?? 0 };
        }
        return { x: 3222, z: 3218, level: 0 };
    }

    stopFuzzers(): number {
        this.fuzzRunning = false;
        let n = 0;
        for (const entry of this.entries.values()) {
            if (entry.brain instanceof FuzzBrain) {
                this.remove(entry, false);
                entry.removeBy = World.currentTick;
                n++;
            }
        }
        return n;
    }

    isFuzzer(bot: BotPlayer): boolean {
        return this.entries.get(bot)?.brain instanceof FuzzBrain;
    }

    // ------------------------------------------------------------------ staff commands

    despawn(bot: BotPlayer): void {
        const entry = this.entries.get(bot);
        if (entry) {
            this.remove(entry, false);
            entry.removeBy = World.currentTick; // now
        }
    }

    despawnAll(): number {
        let n = 0;
        for (const entry of this.entries.values()) {
            this.remove(entry, false);
            entry.removeBy = World.currentTick;
            n++;
        }
        this.respawns.length = 0;
        return n;
    }

    find(name: string): BotPlayer | undefined {
        const want = name.toLowerCase().replaceAll(' ', '_');
        for (const bot of this.entries.keys()) {
            if (bot.username === want || bot.username === NAME_PREFIX + want) return bot;
        }
        return undefined;
    }

    stateOf(bot: BotPlayer): BotState | undefined {
        return this.entries.get(bot)?.state;
    }

    all(): BotState[] {
        return [...this.entries.values()].map(e => e.state);
    }

    describe(s: BotState): string {
        const b = s.bot;
        const hp = `${b.levels[PlayerStat.HITPOINTS]}/${b.baseLevels[PlayerStat.HITPOINTS]}`;
        const wl = b.slot === -1 ? 0 : wildernessLevel(b, b.x, b.z, b.level);
        const target = s.pvpTarget ? s.pvpTarget.displayName : s.npcTarget ? 'npc' : '-';
        const kind = this.isFuzzer(b) ? 'fuzzer' : s.kind;
        return `${b.displayName} ${kind} ${s.kit.id} cb${b.combatLevel} hp${hp} wl${wl} ${s.phase} tgt:${target} k${s.kills}/d${s.deaths}${s.manual ? ' manual' : ''}`;
    }

    pendingRespawns(): number {
        return this.respawns.length;
    }
}

export default new BotManager();
