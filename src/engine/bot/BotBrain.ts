import Component from '#/cache/config/Component.js';
import InvType from '#/cache/config/InvType.js';
import NpcType from '#/cache/config/NpcType.js';
import ObjType from '#/cache/config/ObjType.js';
import ParamType from '#/cache/config/ParamType.js';
import VarPlayerType from '#/cache/config/VarPlayerType.js';
import type { BotConfigData, BotHotspot } from '#/engine/bot/BotConfig.js';
import * as Input from '#/engine/bot/BotInput.js';
import type { BotKind, BotKit } from '#/engine/bot/BotKits.js';
import BotPlayer from '#/engine/bot/BotPlayer.js';
import { CoordGrid } from '#/engine/CoordGrid.js';
import { isMapBlocked } from '#/engine/GameMap.js';
import Npc from '#/engine/entity/Npc.js';
import Obj from '#/engine/entity/Obj.js';
import Player from '#/engine/entity/Player.js';
import { PlayerStat } from '#/engine/entity/PlayerStat.js';
import ScriptProvider from '#/engine/script/ScriptProvider.js';
import ScriptRunner from '#/engine/script/ScriptRunner.js';
import ServerTriggerType from '#/engine/script/ServerTriggerType.js';
import World from '#/engine/World.js';
import { Visibility } from '#/network/rsbuf/index.js';

// What a bot decides, tick by tick. It only ever acts through BotInput (the client's own entry
// points), and it acts like a player at a keyboard: each decision waits a reaction delay of a tick or
// few before the click lands, a few are fumbled (eat late, wrong prayer), and it clicks at most twice a
// tick. Easy-to-medium on purpose - it is there to be fought, not to be a wall.

// ---- varps, looked up by name once per boot (a reload can renumber them; names are what content uses)
const varpIds = new Map<string, number>();
function varp(name: string): number {
    let id = varpIds.get(name);
    if (id === undefined) {
        id = VarPlayerType.getId(name);
        varpIds.set(name, id);
    }
    return id;
}
export function getVarp(p: Player, name: string): number {
    const id = varp(name);
    return id === -1 ? 0 : (p.getVar(id) as number);
}
export function setVarp(p: Player, name: string, value: number): void {
    const id = varp(name);
    if (id !== -1) {
        p.setVar(id, value);
    }
}
export function resetBrainCaches(): void {
    varpIds.clear();
    wildyCache.clear();
}

// ---- wilderness level, from the content's own proc so a bot reads the map exactly as combat does
const wildyCache = new Map<number, number>();
/** A tile's surface Wilderness level by the client's rule - for planning a route; fights use the proc. */
export function surfaceWildernessLevel(x: number, z: number): number {
    if (x < 2944 || x >= 3392 || z < 3520 || z >= 3968) return 0;
    return ((z - 3520) >> 3) + 1;
}

export function wildernessLevel(p: Player, x: number, z: number, level: number): number {
    const coord = CoordGrid.packCoord(level, x, z);
    const cached = wildyCache.get(coord);
    if (cached !== undefined) {
        return cached;
    }
    const script = ScriptProvider.getByName('[proc,wilderness_level]');
    if (!script) {
        return 0;
    }
    const state = ScriptRunner.init(script, p, null, [coord]);
    ScriptRunner.execute(state);
    const result = state.popInt();
    if (wildyCache.size > 100000) {
        wildyCache.clear();
    }
    wildyCache.set(coord, result);
    return result;
}

/** Dragons breathe fire, and no kit carries an anti-dragon shield: a roamer leaves them be. */
function noAntifire(type: NpcType): boolean {
    return (type.debugname ?? '').includes('dragon');
}

function dist(a: { x: number; z: number }, b: { x: number; z: number }): number {
    return Math.max(Math.abs(a.x - b.x), Math.abs(a.z - b.z));
}

function rand(min: number, max: number): number {
    return min + Math.floor(Math.random() * (max - min + 1));
}

const PROTECT = {
    melee: { com: 'prayer:prayer_protectfrommelee', varp: 'prayer14', level: 43 },
    ranged: { com: 'prayer:prayer_protectfrommissiles', varp: 'prayer13', level: 40 },
    magic: { com: 'prayer:prayer_protectfrommagic', varp: 'prayer12', level: 37 }
} as const;
type CombatStyle = keyof typeof PROTECT;

/** What a player is fighting with, as a watcher would tell: the weapon's combat tab. */
export function styleOf(p: Player): CombatStyle {
    const root = p.tabs[0] === -1 ? null : Component.get(p.tabs[0])?.comName;
    if (root) {
        if (/^combat_(bow|crossbow|thrown|chinchompa|salamander)/.test(root)) return 'ranged';
        if (/^combat_(staff|powered_staff)/.test(root)) return 'magic';
    }
    return 'melee';
}

export type BotPhase = 'active' | 'leaving' | 'dead' | 'removing';

export class BotState {
    readonly spawnedAt = World.currentTick;
    phase: BotPhase = 'active';
    manual = false;
    kills = 0;
    deaths = 0;
    lastAction = '';

    // targets
    pvpTarget: Player | null = null;
    npcTarget: Npc | null = null;
    blacklist = new Map<number, number>(); // uid -> until tick

    // loot
    lootSpot: { x: number; z: number; until: number } | null = null;

    // movement: where it is heading across the Wilderness, and when it got there
    dest: { x: number; z: number; why: string } | null = null;
    destArrived = 0;
    destUntil = 0;
    stuckCount = 0;
    wanderAt = 0;
    lastPos = { x: 0, z: 0, since: 0 };
    runAgainAt = 3000;
    lastSwing = 0;
    npcSince = 0;
    npcHp = 0;
    legFights = 0;
    // where it was a while ago, to notice a bot that has got itself walled in
    anchor = { x: 0, z: 0, since: 0 };

    // reactions
    pending = new Map<string, { at: number; fn: () => void }>();
    clicks = 0;
    eatBelow = 0;
    lastCombatTick = 0;
    leavingSince = 0;
    restocked = false;
    noSpec = false;
    noFreeze = false;
    engageAt = 0;
    lastSpell: string | undefined;

    constructor(
        readonly bot: BotPlayer,
        readonly kind: BotKind,
        readonly kit: BotKit,
        readonly hotspot: BotHotspot
    ) {}
}

export class BotBrain {
    constructor(
        readonly s: BotState,
        readonly config: BotConfigData
    ) {
        const jitter = rand(-10, 10);
        s.eatBelow = Math.max(20, Math.min(80, (s.kit.eatPercent ?? config.eatPercent) + jitter));
    }

    get bot(): BotPlayer {
        return this.s.bot;
    }

    get kit(): BotKit {
        return this.s.kit;
    }

    // ---------------------------------------------------------------- reactions

    /** Do this after a human reaction delay, unless the same kind of thing is already on its way. */
    private later(label: string, fn: () => void, extra = 0): void {
        if (this.s.pending.has(label)) {
            return;
        }
        const [min, max] = this.config.reactionTicks;
        let delay = rand(min, max) + extra;
        if (Math.random() < this.config.mistakeChance) {
            delay += rand(2, 4); // looked away
        }
        this.s.pending.set(label, { at: World.currentTick + delay, fn });
    }

    private runPending(): void {
        for (const [label, p] of this.s.pending) {
            if (p.at > World.currentTick) {
                continue;
            }
            if (this.s.clicks >= 2) {
                break; // two clicks a tick is as fast as anyone clicks
            }
            this.s.pending.delete(label);
            this.s.clicks++;
            this.s.lastAction = label;
            try {
                p.fn();
            } catch (err) {
                console.error(err);
            }
        }
    }

    // ---------------------------------------------------------------- facts

    private hp(p: Player = this.bot): number {
        return p.levels[PlayerStat.HITPOINTS];
    }

    private hpPercent(p: Player = this.bot): number {
        return (100 * p.levels[PlayerStat.HITPOINTS]) / Math.max(1, p.baseLevels[PlayerStat.HITPOINTS]);
    }

    private invCount(name: string): number {
        const id = ObjType.getId(name);
        return id === -1 ? 0 : this.bot.invTotal(InvType.INV, id);
    }

    private invFind(re: RegExp): string | null {
        const inv = this.bot.getInventory(InvType.INV);
        if (!inv) return null;
        for (let i = 0; i < inv.capacity; i++) {
            const item = inv.get(i);
            if (item) {
                const name = ObjType.get(item.id).debugname;
                if (name && re.test(name)) return name;
            }
        }
        return null;
    }

    private wornWeapon(): string | null {
        const worn = this.bot.getInventory(InvType.WORN);
        const item = worn?.get(3);
        return item ? ObjType.get(item.id).debugname : null;
    }

    private mainWeapon(): string | null {
        for (const name of this.kit.worn) {
            const id = ObjType.getId(name);
            if (id !== -1 && ObjType.get(id).wearpos === 3) return name;
        }
        return null;
    }

    private wildy(p: Player = this.bot): number {
        return wildernessLevel(this.bot, p.x, p.z, p.level);
    }

    private isDead(p: Player): boolean {
        return p.levels[PlayerStat.HITPOINTS] <= 0 || getVarp(p, 'death') === 1;
    }

    private inCombatRecently(ticks = 8): boolean {
        return getVarp(this.bot, 'lastcombat') + ticks > World.currentTick;
    }

    /** The player who hit this bot last, if it was recent and they are still here. */
    private attacker(): Player | null {
        if (!this.inCombatRecently()) return null;
        const uid = getVarp(this.bot, 'pk_predator1');
        if (uid === -1 || uid === 0) return null;
        const p = World.getPlayerByUid(uid);
        if (!p || !p.isActive || this.isDead(p)) return null;
        return p;
    }

    private isFrozen(p: Player): boolean {
        return getVarp(p, 'frozen') > World.currentTick;
    }

    private freezeImmune(p: Player): boolean {
        return getVarp(p, 'frozen') + 5 > World.currentTick;
    }

    /** pvp_level_check and pvp_in_combat_check, read from outside. */
    canAttack(other: Player): boolean {
        const bot = this.bot;
        if (other === bot || !other.isActive || other.slot === -1 || other.level !== bot.level) return false;
        if (other.visibility !== Visibility.DEFAULT || other.loggingOut) return false;
        if (other.isBot && !this.config.botsAttackBots) return false;
        if (this.isDead(other)) return false;
        const until = this.s.blacklist.get(other.uid);
        if (until !== undefined && until > World.currentTick) return false;
        const wl = Math.min(this.wildy(), this.wildy(other));
        if (wl < 1 || Math.abs(bot.combatLevel - other.combatLevel) > wl) return false;
        if (!World.gameMap.isMulti(CoordGrid.packCoord(other.level, other.x, other.z))) {
            const now = World.currentTick;
            if (getVarp(bot, 'lastcombat') + 8 > now) {
                const mine = getVarp(bot, 'pk_predator1');
                if (mine !== other.uid && mine !== -1 && mine !== 0) return false;
                if (World.getNpcByUid(getVarp(bot, 'aggressive_npc'))) return false;
            }
            if (getVarp(other, 'lastcombat') + 8 > now) {
                const theirs = getVarp(other, 'pk_predator1');
                if (theirs !== bot.uid && theirs !== -1 && theirs !== 0) return false;
                if (World.getNpcByUid(getVarp(other, 'aggressive_npc'))) return false;
            }
        }
        return true;
    }

    // ---------------------------------------------------------------- the tick

    tick(): void {
        const bot = this.bot;
        this.s.clicks = 0;

        if (this.s.phase === 'dead' || this.s.phase === 'removing') {
            this.s.pending.clear();
            return;
        }
        if (this.isDead(bot)) {
            return; // BotManager sees the death
        }
        if (bot.containsModalInterface()) {
            bot.closeModal(); // the welcome screen, a level-up box
        }

        this.runPending();

        if (bot.delayed) {
            return;
        }

        this.survive();
        this.manageRun();

        if (this.s.phase === 'leaving') {
            this.leave();
            return;
        }

        // walled in somewhere (a building it walked into, a spawn it cannot leave): out, and back fresh
        const a = this.s.anchor;
        if (dist(bot, a) > 10 || this.inCombatRecently(16)) {
            this.s.anchor = { x: bot.x, z: bot.z, since: World.currentTick };
        } else if (World.currentTick - a.since > 400) {
            this.startLeaving('stuck');
            this.s.restocked = true;
            return;
        }

        if (!bot.isInWilderness() && this.wildy() < 1) {
            // pushed out somehow (a teleport, a respawn) - go and restock
            this.startLeaving('left the wilderness');
            return;
        }

        if (this.s.kind === 'pker') {
            this.pker();
        } else {
            this.roamer();
        }
    }

    // ---------------------------------------------------------------- staying alive

    private foodLeft(): number {
        return this.invCount(this.kit.food);
    }

    private survive(): void {
        const bot = this.bot;
        const fighting = this.inCombatRecently(16);
        if (fighting) {
            this.s.lastCombatTick = World.currentTick;
        }

        // eat
        if (this.hpPercent() < this.s.eatBelow && this.foodLeft() > 0) {
            const food = this.kit.food;
            this.later('eat', () => {
                if (this.hpPercent() < this.s.eatBelow + 10) {
                    Input.heldOp(bot, food, Input.heldOpNamed(food, 'Eat') || 1);
                }
            });
        }

        // prayer: restore when low, protection against whoever is hitting it, off once it is over
        if (bot.levels[PlayerStat.PRAYER] < 12) {
            const pot = this.invFind(/^[1-4]doseprayerrestore$/);
            if (pot && fighting) {
                this.later('restore', () => Input.heldOp(bot, pot, Input.heldOpNamed(pot, 'Drink') || 1));
            }
        }
        const foe = this.s.pvpTarget ?? this.attacker();
        if (foe && fighting) {
            this.prayAgainst(foe);
        } else if (World.currentTick - this.s.lastCombatTick > 15) {
            for (const style of Object.keys(PROTECT) as CombatStyle[]) {
                if (getVarp(bot, PROTECT[style].varp) === 1) {
                    this.later('pray-off-' + style, () => {
                        if (getVarp(bot, PROTECT[style].varp) === 1) Input.button(bot, PROTECT[style].com);
                    });
                }
            }
        }

        // a ranger out of arrows (or bolt racks) goes and gets more, as a mage out of runes does
        if (this.s.phase === 'active' && bot.heard('no ammo left')) {
            this.startLeaving('out of ammo');
        }

        // flee: nothing left to eat and going down
        if (this.s.phase === 'active' && this.foodLeft() === 0 && this.hpPercent() < this.config.fleePercent) {
            this.startLeaving('out of food');
        }
    }

    private prayAgainst(foe: Player): void {
        const bot = this.bot;
        if (bot.levels[PlayerStat.PRAYER] <= 0) return;
        let style = styleOf(foe);
        if (bot.baseLevels[PlayerStat.PRAYER] < PROTECT[style].level) return;
        if (getVarp(bot, PROTECT[style].varp) === 1) return;
        if (Math.random() < this.config.mistakeChance / 4) {
            // the wrong one - it happens
            const styles = (Object.keys(PROTECT) as CombatStyle[]).filter(s => bot.baseLevels[PlayerStat.PRAYER] >= PROTECT[s].level);
            style = styles[rand(0, styles.length - 1)];
        }
        this.later(
            'pray',
            () => {
                if (getVarp(bot, PROTECT[style].varp) !== 1) Input.button(bot, PROTECT[style].com);
            },
            1
        );
    }

    // ---------------------------------------------------------------- leaving to restock

    startLeaving(why: string): void {
        if (this.s.phase !== 'active') return;
        this.s.phase = 'leaving';
        this.s.leavingSince = World.currentTick;
        this.s.pvpTarget = null;
        this.s.npcTarget = null;
        this.s.lastAction = 'leaving: ' + why;
    }

    private leave(): void {
        const bot = this.bot;
        // out of the wilderness, or shallow enough to teleport and nobody on it: gone (BotManager)
        const wl = this.wildy();
        if (wl < 1 || (wl <= 20 && !this.inCombatRecently(16))) {
            this.s.restocked = true;
            return;
        }
        if (World.currentTick - this.s.leavingSince > 500) {
            this.s.restocked = true; // it would have got there by now
            return;
        }
        // run south, away from the wilderness levels
        if (!bot.hasWaypoints() || this.stuck()) {
            const side = this.stuck() ? rand(-12, 12) : rand(-3, 3);
            const dz = Math.min(20, Math.max(4, bot.z - 3515));
            this.later('flee', () => Input.walk(bot, bot.x + side, bot.z - dz, true), -1);
        }
    }

    private stuck(): boolean {
        const s = this.s;
        const bot = this.bot;
        if (s.lastPos.x !== bot.x || s.lastPos.z !== bot.z) {
            s.lastPos = { x: bot.x, z: bot.z, since: World.currentTick };
            return false;
        }
        return World.currentTick - s.lastPos.since > 6;
    }

    // ---------------------------------------------------------------- travelling the Wilderness

    /** The deepest Wilderness level this bot's bracket goes to. */
    private depth(): number {
        return this.config.depth[this.kit.bracket] ?? 56;
    }

    /**
     * Pick where to go next. Hotspots are waypoints, not leashes: a roamer heads for monsters its level
     * can take, a PKer drifts toward where the players (and, on a bots world, the other bots) are, and
     * either sometimes just picks a spot - all within its bracket's depth.
     */
    private pickDestination(): void {
        const s = this.s;
        const bot = this.bot;
        const depth = this.depth();
        const inBand = (x: number, z: number) => {
            const wl = surfaceWildernessLevel(x, z);
            return wl >= 1 && wl <= depth && x >= 2946 && x <= 3390;
        };
        let dest: { x: number; z: number; why: string } | null = null;
        const roll = Math.random();

        if (s.kind === 'pker' && roll < 0.55) {
            // where the people are - a real player counts twice
            const people: Player[] = [];
            for (const p of World.playerLoop.all()) {
                if (p === bot || p.level !== 0 || !inBand(p.x, p.z)) continue;
                if (p.isBot && !this.config.botsAttackBots) continue;
                // only someone it could fight where they are
                if (Math.abs(bot.combatLevel - p.combatLevel) > surfaceWildernessLevel(p.x, p.z)) continue;
                people.push(p);
                if (!p.isBot) people.push(p);
            }
            if (people.length) {
                const p = people[rand(0, people.length - 1)];
                dest = { x: p.x + rand(-4, 4), z: p.z + rand(-4, 4), why: 'towards ' + p.displayName };
            }
        } else if (s.kind === 'roamer' && roll < 0.6) {
            // monsters it can take
            const min = Math.max(1, Math.floor(bot.combatLevel / 5));
            const max = bot.combatLevel + 5;
            const found: Npc[] = [];
            for (const npc of World.npcs) {
                if (!npc.isActive || npc.level !== 0 || !inBand(npc.x, npc.z)) continue;
                const type = NpcType.get(npc.type);
                if (type.vislevel < min || type.vislevel > max || noAntifire(type) || !this.attackOp(npc)) continue;
                found.push(npc);
            }
            if (found.length) {
                const npc = found[rand(0, found.length - 1)];
                dest = { x: npc.x, z: npc.z, why: 'monsters (' + (NpcType.get(npc.type).name ?? 'npc') + ')' };
            }
        }

        if (!dest && Math.random() < 0.7) {
            const spots = this.config.hotspots.filter(h => inBand(h.x, h.z) && dist(h, bot) > 12);
            if (spots.length) {
                const h = spots[rand(0, spots.length - 1)];
                dest = { x: h.x + rand(-h.radius, h.radius), z: h.z + rand(-h.radius, h.radius), why: h.name };
            }
        }
        for (let i = 0; !dest && i < 20; i++) {
            const x = rand(2950, 3385);
            const z = rand(3525, Math.min(3965, 3520 + depth * 8 - 1));
            if (inBand(x, z) && !isMapBlocked(x, z, 0)) dest = { x, z, why: 'somewhere' };
        }
        if (!dest) dest = { x: s.hotspot.x, z: s.hotspot.z, why: s.hotspot.name };

        s.dest = dest;
        s.destArrived = 0;
        s.destUntil = World.currentTick + 900; // give up on a place it cannot reach in nine minutes
        s.stuckCount = 0;
        s.legFights = 0;
        s.lastAction = 'heading for ' + dest.why;
    }

    /** Walk the long way to the destination, a screen's worth at a time, then look around a while. */
    private travel(): void {
        const s = this.s;
        const bot = this.bot;
        const now = World.currentTick;
        if (!s.dest || now >= s.destUntil) {
            this.pickDestination();
        }
        const dest = s.dest!;
        const d = dist(bot, dest);

        if (d <= 6 || s.destArrived) {
            // there: potter about the spot until it is time to move on
            if (!s.destArrived) {
                s.destArrived = now;
                const [min, max] = this.config.lingerTicks;
                s.destUntil = now + rand(min, max);
            }
            if (bot.hasWaypoints() || now < s.wanderAt) return;
            s.wanderAt = now + rand(8, 25);
            for (let i = 0; i < 10; i++) {
                const x = dest.x + rand(-6, 6);
                const z = dest.z + rand(-6, 6);
                if (!isMapBlocked(x, z, bot.level)) {
                    this.later('wander', () => Input.walk(bot, x, z));
                    return;
                }
            }
            return;
        }

        const stuck = this.stuck();
        if (bot.hasWaypoints() && !stuck) return;
        if (stuck) {
            s.stuckCount++;
            s.lastPos.since = now; // one detour per stall
            if (s.stuckCount > 8) {
                s.dest = null; // it cannot get there from here
                return;
            }
        }
        // the next click: up to 15 tiles along the way, and off to the side to get round what is in it
        const step = Math.min(d, 15);
        const side = stuck ? 6 + 2 * s.stuckCount : 2;
        const depthZ = 3520 + this.depth() * 8 - 1;
        for (let i = 0; i < 12; i++) {
            const x = bot.x + Math.round(((dest.x - bot.x) * step) / d) + rand(-side, side);
            const z = Math.min(depthZ, bot.z + Math.round(((dest.z - bot.z) * step) / d) + rand(-side, side));
            if (!isMapBlocked(x, z, bot.level)) {
                this.later('travel', () => Input.walk(bot, x, z), -1);
                return;
            }
        }
    }

    /** The run orb: back on once it has its breath back, as a player would click it. */
    private manageRun(): void {
        const bot = this.bot;
        // (the button drops what it is doing, so not in the middle of a fight with a player - against a
        // monster it just clicks it again afterwards)
        if (bot.run === 0 && bot.runenergy >= this.s.runAgainAt && !(bot.target instanceof Player) && !bot.delayed) {
            this.later('run', () => {
                if (bot.run === 0 && !(bot.target instanceof Player)) Input.button(bot, 'options:run');
            });
            this.s.runAgainAt = rand(2000, 5000); // 20-50% next time
        }
    }

    // ---------------------------------------------------------------- fighting a player

    /**
     * The obj in an inventory that IS this piece - itself, or a worn-down copy of it: Barrows armour
     * turns into barrows_verac_body_100, _75 and so on as it is used.
     */
    private pieceIn(inv: number, name: string): string | null {
        const c = this.bot.getInventory(inv);
        if (!c) return null;
        for (let i = 0; i < c.capacity; i++) {
            const o = c.get(i);
            const n = o ? ObjType.get(o.id).debugname : null;
            if (n && (n === name || (n.startsWith(name + '_') && /_\d+$/.test(n)))) return n;
        }
        return null;
    }

    /** Wear every piece of a set; true once it is all on (the clicks go out two a tick at most). */
    private wearSet(set: string[]): boolean {
        let all = true;
        for (const name of set) {
            if (this.pieceIn(InvType.WORN, name)) continue;
            all = false;
            const held = this.pieceIn(InvType.INV, name);
            if (held) {
                this.later('wear-' + name, () => Input.heldOp(this.bot, held, Input.heldOpNamed(held, 'Wield', 'Wear') || 2));
            }
        }
        return all;
    }

    /**
     * A caster's fight, the whole of it, not just the opening freeze: freeze whenever the target is
     * free and past its immunity, damage spells in between, and - for a hybrid - a rush in its melee
     * set while the target is held long enough to reach, with a spell mixed in between the hits, and
     * back into its casting set once the hold has worn off.
     */
    private fightWithMagic(t: Player, d: number): void {
        const s = this.s;
        const bot = this.bot;
        const kit = this.kit;
        const now = World.currentTick;
        const frozenUntil = getVarp(t, 'frozen');
        const frozen = frozenUntil > now;
        const canFreeze = !!kit.freezeSpell && !s.noFreeze && frozenUntil + 5 <= now;

        if (bot.heard('You do not have enough')) {
            // out of runes for what it last cast: the hold first, then everything
            bot.messages.length = 0;
            if (s.lastSpell === kit.freezeSpell) s.noFreeze = true;
            else {
                this.startLeaving('out of runes');
                return;
            }
        }

        const hybrid = kit.style === 'hybrid' && !!kit.mageSet && !!kit.meleeSet;
        const rush = hybrid && !canFreeze && frozen && frozenUntil - now > d + 2;

        if (rush) {
            if (!this.wearSet(kit.meleeSet!)) return;
            // once per swing, sometimes a spell instead of the next hit
            const swing = getVarp(bot, 'action_delay');
            if (swing !== s.lastSwing) {
                s.lastSwing = swing;
                if (kit.damageSpell && Math.random() < 0.35) {
                    const spell = kit.damageSpell;
                    this.later('cast', () => {
                        s.lastSpell = spell;
                        Input.castOnPlayer(bot, t, spell);
                    });
                    return;
                }
            }
            if (!this.casting(t) && bot.target !== t) this.later('attack', () => Input.opPlayer(bot, t, 2));
            return;
        }

        if (hybrid && !this.wearSet(kit.mageSet!)) return;
        if (kit.style === 'mage' && frozen && d <= 1) {
            // it cannot follow: step back and cast from range
            this.later('kite', () => Input.walk(bot, bot.x + (bot.x - t.x) * 3, bot.z + (bot.z - t.z) * 3));
            return;
        }
        if (this.casting(t)) return; // a cast is on its way
        const spell = canFreeze ? kit.freezeSpell : kit.damageSpell;
        if (spell) {
            this.later('cast', () => {
                s.lastSpell = spell;
                Input.castOnPlayer(bot, t, spell);
            });
        }
    }

    /** Is a spell on its way to this target (rather than a melee or ranged attack)? */
    private casting(t: Player): boolean {
        const op = this.bot.targetOp;
        return this.bot.target === t && (op === ServerTriggerType.APPLAYERT || op === ServerTriggerType.OPPLAYERT);
    }

    /** One step of a fight with a player: prayer is handled by survive(); this is weapons and spells. */
    private fightPlayer(t: Player): void {
        const bot = this.bot;
        const kit = this.kit;
        const d = dist(bot, t);

        this.manageSpec(t, d);

        if (kit.style === 'mage' || kit.style === 'hybrid') {
            this.fightWithMagic(t, d);
            return;
        }

        if (bot.target !== t) {
            this.later('attack', () => Input.opPlayer(bot, t, 2));
        }
    }

    /**
     * Special attacks: switch to the spec weapon when the target is hurt and there is energy for it,
     * press the bar, and switch back once the energy is spent. Switching does not stop the fight (an
     * equip keeps the target), so this only ever adds clicks.
     */
    private manageSpec(t: Player, d: number): void {
        const bot = this.bot;
        const kit = this.kit;
        if (kit.style !== 'melee' && kit.style !== 'ranged') return;
        if (this.s.noSpec) return;
        if (bot.heard('not earned the right') || bot.heard('not a high enough level')) {
            this.s.noSpec = true; // the switch was refused: fight on with what it has
            return;
        }
        const main = this.mainWeapon();
        const specWep = kit.specWeapon ?? main;
        if (!specWep) return;
        const specId = ObjType.getId(specWep);
        if (specId === -1) return;
        const specParam = ParamType.getId('specwep');
        const costParam = ParamType.getId('sa_energy');
        const specType = ObjType.get(specId);
        if (specParam === -1 || specType.params.get(specParam) !== 1) return;
        const cost = (specType.params.get(costParam) as number | undefined) ?? 250;
        const energy = getVarp(bot, 'sa_energy');
        const weapon = this.wornWeapon();
        const range = kit.style === 'ranged' ? 7 : 1;

        if (weapon === specWep) {
            if (energy >= cost) {
                if (getVarp(bot, 'sa_attack') !== 1) {
                    const root = bot.tabs[0] === -1 ? null : Component.get(bot.tabs[0]).comName;
                    if (root) this.later('spec', () => Input.button(bot, `${root}:specbar`));
                }
                return;
            }
            const held = kit.specWeapon && main ? this.pieceIn(InvType.INV, main) : null;
            if (held) {
                this.later('unspec', () => Input.heldOp(bot, held, Input.heldOpNamed(held, 'Wield', 'Wear') || 2));
            }
            return;
        }

        const want = energy >= cost && this.hpPercent(t) <= 65 && d <= range + 1 && this.invCount(specWep) > 0;
        if (want && Math.random() < 0.5) {
            this.later('spec-switch', () => Input.heldOp(bot, specWep, Input.heldOpNamed(specWep, 'Wield', 'Wear') || 2));
        }
    }

    // ---------------------------------------------------------------- PKer

    private pker(): void {
        const s = this.s;
        const bot = this.bot;

        // whoever is hitting it takes priority over whoever it was hunting
        const foe = this.attacker();
        if (foe && foe !== s.pvpTarget && (s.pvpTarget === null || !this.inCombatWith(s.pvpTarget))) {
            s.pvpTarget = foe;
        }

        const t = s.pvpTarget;
        if (t) {
            if (this.isDead(t)) {
                if (getVarp(t, 'death') === 1) {
                    s.kills++;
                    s.lootSpot = { x: t.x, z: t.z, until: World.currentTick + 15 };
                }
                s.pvpTarget = null;
            } else if (!t.isActive || t.slot === -1 || dist(bot, t) > 20 || this.wildy(t) < 1) {
                s.pvpTarget = null; // got away
            } else if (bot.heard('already under attack') || bot.heard('Someone else is already fighting') || bot.heard('level difference is too great')) {
                s.blacklist.set(t.uid, World.currentTick + 50);
                s.pvpTarget = null;
            } else {
                if (World.currentTick >= s.engageAt || foe === t) this.fightPlayer(t);
                return;
            }
        }

        if (this.loot()) return;

        // hunt
        let best: Player | null = null;
        let bestD = Infinity;
        for (const other of World.playerLoop.all()) {
            const d = dist(bot, other);
            if (d > this.config.pkerScanRadius || d >= bestD) continue;
            if (!this.canAttack(other)) continue;
            best = other;
            bestD = d;
        }
        if (best) {
            // a moment to size them up before the first click
            s.pvpTarget = best;
            s.engageAt = World.currentTick + rand(2, 5);
            return;
        }

        // top up the spec weapon swap if a fight left it wielded
        const main = this.mainWeapon();
        const held = main && !this.pieceIn(InvType.WORN, main) ? this.pieceIn(InvType.INV, main) : null;
        if (held && !this.inCombatRecently(16)) {
            this.later('rewield', () => Input.heldOp(bot, held, Input.heldOpNamed(held, 'Wield', 'Wear') || 2));
            return;
        }

        this.travel();
    }

    private inCombatWith(p: Player): boolean {
        return this.bot.target === p || getVarp(p, 'pk_predator1') === this.bot.uid;
    }

    // ---------------------------------------------------------------- roamer

    private roamer(): void {
        const s = this.s;
        const bot = this.bot;

        // attacked by a player: fight back if it can, or run
        const foe = this.attacker();
        if (foe && s.pvpTarget !== foe) {
            const outclassed = foe.combatLevel > bot.combatLevel + 10 || this.hpPercent() < 40;
            if (outclassed && Math.random() < 0.7) {
                this.startLeaving('outclassed by ' + foe.displayName);
                return;
            }
            s.pvpTarget = foe;
            s.npcTarget = null;
        }
        if (s.pvpTarget) {
            const t = s.pvpTarget;
            if (this.isDead(t)) {
                if (getVarp(t, 'death') === 1) s.kills++;
                s.pvpTarget = null;
            } else if (!t.isActive || dist(bot, t) > 15 || (!this.inCombatRecently(16) && bot.target !== t)) {
                s.pvpTarget = null;
            } else {
                this.fightPlayer(t);
                return;
            }
        }

        // full pack: off to the bank
        const inv = bot.getInventory(InvType.INV);
        if (inv && inv.freeSlotCount === 0) {
            this.startLeaving('bank run');
            return;
        }
        // out of food and not topped up: restock
        if (this.foodLeft() === 0 && this.hpPercent() < 60) {
            this.startLeaving('restock');
            return;
        }

        // a monster
        const npc = s.npcTarget;
        if (npc) {
            if (!npc.isActive || npc.levels[3] <= 0 || World.getNpc(npc.nid) !== npc) {
                s.kills++;
                s.lootSpot = { x: npc.x, z: npc.z, until: World.currentTick + 12 };
                s.npcTarget = null;
            } else if (
                dist(bot, npc) > 16 ||
                bot.heard('already under attack') ||
                bot.heard('Someone else is fighting') ||
                bot.heard("can't reach") ||
                // no hit on it in half a minute: behind a fence, across water, out of reach - give it up
                (World.currentTick - s.npcSince > 50 && npc.levels[3] >= s.npcHp)
            ) {
                s.blacklist.set(npc.uid, World.currentTick + 200);
                s.npcTarget = null;
            } else {
                if (npc.levels[3] < s.npcHp) {
                    s.npcHp = npc.levels[3];
                    s.npcSince = World.currentTick;
                }
                if (bot.target !== npc) {
                    const op = this.attackOp(npc);
                    if (op) this.later('attack-npc', () => Input.opNpc(bot, npc, op));
                }
                return;
            }
        }

        if (this.loot()) return;

        // something is already chewing on it: fight that
        const aggressor = World.getNpcByUid(getVarp(bot, 'aggressive_npc'));
        if (aggressor && this.inCombatRecently(8) && aggressor.isActive && this.attackOp(aggressor)) {
            this.engageNpc(aggressor);
            return;
        }

        // on the way somewhere it stops for a couple of fights at most; once there, for as many as it likes
        const lingering = s.destArrived && World.currentTick < s.destUntil;
        const found = lingering || s.legFights < 2 ? this.findMonster() : null;
        if (found) {
            s.legFights++;
            this.engageNpc(found);
            const op = this.attackOp(found);
            if (op) this.later('attack-npc', () => Input.opNpc(bot, found, op));
            return;
        }

        this.travel();
    }

    private engageNpc(npc: Npc): void {
        this.s.npcTarget = npc;
        this.s.npcHp = npc.levels[3];
        this.s.npcSince = World.currentTick;
    }

    private attackOp(npc: Npc): number {
        const type = NpcType.get(npc.type);
        if (!type.op) return 0;
        const i = type.op.findIndex(o => o === 'Attack');
        return i === -1 ? 0 : i + 1;
    }

    private findMonster(): Npc | null {
        const bot = this.bot;
        const r = this.config.roamerScanRadius;
        const minLevel = Math.max(1, Math.floor(bot.combatLevel / 5));
        const maxLevel = bot.combatLevel + 5;
        let best: Npc | null = null;
        let bestD = Infinity;
        for (let zx = (bot.x - r) >> 3; zx <= (bot.x + r) >> 3; zx++) {
            for (let zz = (bot.z - r) >> 3; zz <= (bot.z + r) >> 3; zz++) {
                for (const npc of World.gameMap.getZone(zx << 3, zz << 3, bot.level).getAllNpcsSafe()) {
                    const d = dist(bot, npc);
                    if (d > r || d >= bestD) continue;
                    if (!npc.isActive || npc.delayed || npc.levels[3] <= 0) continue;
                    const type = NpcType.get(npc.type);
                    if (type.vislevel < minLevel || type.vislevel > maxLevel || noAntifire(type)) continue;
                    if (!this.attackOp(npc)) continue;
                    const until = this.s.blacklist.get(npc.uid);
                    if (until !== undefined && until > World.currentTick) continue;
                    // someone else's fight
                    if (npc.target instanceof Player && npc.target !== bot) continue;
                    if (wildernessLevel(bot, npc.x, npc.z, npc.level) < 1) continue; // stay in the wilderness
                    best = npc;
                    bestD = d;
                }
            }
        }
        return best;
    }

    // ---------------------------------------------------------------- loot

    /** Pick up what is worth having where its last kill fell. True while busy with it. */
    private loot(): boolean {
        const s = this.s;
        const bot = this.bot;
        const spot = s.lootSpot;
        if (!spot) return false;
        if (World.currentTick > spot.until) {
            s.lootSpot = null;
            return false;
        }
        if (bot.target instanceof Obj || bot.hasWaypoints()) return true;
        const inv = bot.getInventory(InvType.INV);
        if (!inv) return false;
        let best: Obj | null = null;
        let bestValue = 0;
        for (let zx = (spot.x - 3) >> 3; zx <= (spot.x + 3) >> 3; zx++) {
            for (let zz = (spot.z - 3) >> 3; zz <= (spot.z + 3) >> 3; zz++) {
                for (const obj of World.gameMap.getZone(zx << 3, zz << 3, bot.level).getAllObjsSafe()) {
                    if (dist(obj, spot) > 3 || !obj.isValid(bot.hash64)) continue;
                    if (obj.receiver64 !== -1n && obj.receiver64 !== bot.hash64) continue;
                    const type = ObjType.get(obj.type);
                    const value = type.cost * obj.count;
                    if (value < this.config.lootMinValue || value <= bestValue) continue;
                    if (inv.freeSlotCount === 0 && !(type.stackable && inv.getItemIndex(obj.type) !== -1)) continue;
                    best = obj;
                    bestValue = value;
                }
            }
        }
        if (!best) {
            s.lootSpot = null;
            return false;
        }
        const obj = best;
        this.later('loot', () => Input.takeObj(bot, obj));
        return true;
    }
}
