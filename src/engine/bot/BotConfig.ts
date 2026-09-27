import fs from 'fs';

import Environment from '#/util/Environment.js';
import { printInfo, printWarning } from '#/util/Logger.js';

// Everything a world can tune about its bots. Every field has a default, so NODE_BOTS=true alone is a
// working setup; NODE_BOTS_CONFIG (default data/config/bots.json, optional) overrides any of them -
// a partial file is fine, only the keys it has are taken. NODE_BOTS_ROAMERS / NODE_BOTS_PKERS override
// the two counts on top of that.
//
// Example data/config/bots.json:
//   { "roamers": 4, "pkers": 2, "botsAttackBots": true, "respawnTicks": [100, 200] }

export type BotBracket = 'low' | 'mid' | 'high';

export type BotHotspot = {
    name: string;
    x: number;
    z: number;
    level?: number;
    radius: number;
    /** Which level brackets use this spot. Omitted = all. */
    brackets?: BotBracket[];
};

export type BotDeathDrop = {
    /** Coins, a random amount in [min, max]. [0, 0] for none. */
    coins: [number, number];
    /** How many of the bot's own food it drops (at most what it has left). */
    food: number;
    /** Chance (0-1) of one cheap piece from its kit's extras list (BotKits: dropExtras). */
    extraChance: number;
};

export type BotConfigData = {
    /** How many of each kind to keep in the world. */
    roamers: number;
    pkers: number;
    /** Ticks between two spawns while filling up (so they arrive over time, not all at once). */
    spawnIntervalTicks: number;
    /** A dead (or restocking) bot comes back after a random number of ticks in this range. */
    respawnTicks: [number, number];
    /** false: bots fight monsters and real players, never each other. */
    botsAttackBots: boolean;
    /** Ticks between noticing something and acting on it, drawn per decision. Human-ish, not tick-perfect. */
    reactionTicks: [number, number];
    /** Chance (0-1) a decision is fumbled: a late eat, the wrong prayer, a missed switch. */
    mistakeChance: number;
    /** Eat below this % of max hitpoints (each bot jitters it by up to 10 either way). */
    eatPercent: number;
    /** With no food left, run for it below this % of max hitpoints. */
    fleePercent: number;
    /** How far a PKer looks for a target, and a roamer for a monster, in tiles. */
    pkerScanRadius: number;
    roamerScanRadius: number;
    /** A roamer picks up drops worth at least this much (ObjType cost, each). */
    lootMinValue: number;
    /** Hotspots, spread across Wilderness levels. */
    hotspots: BotHotspot[];
    /** First names; each bot is "Bot <name>" (12 characters at most, so names of up to 8). */
    names: string[];
    /** What a bot leaves for its killer, by bracket, on top of the bones every death leaves. */
    deathDrop: Record<BotBracket, BotDeathDrop>;
};

export const DEFAULT_BOT_CONFIG: BotConfigData = {
    roamers: 6,
    pkers: 4,
    spawnIntervalTicks: 5,
    respawnTicks: [60, 180],
    botsAttackBots: false,
    reactionTicks: [1, 3],
    mistakeChance: 0.1,
    eatPercent: 50,
    fleePercent: 30,
    pkerScanRadius: 14,
    roamerScanRadius: 10,
    lootMinValue: 50,
    hotspots: [
        // wilderness level in the comment is the spot's centre (level = (z - 3520) / 8 + 1)
        { name: 'edgeville ditch', x: 3094, z: 3532, radius: 10 }, // 2
        { name: 'edgeville north', x: 3100, z: 3565, radius: 10 }, // 6
        { name: 'varrock wilderness', x: 3240, z: 3548, radius: 12 }, // 4
        { name: 'chaos temple', x: 3236, z: 3620, radius: 8 }, // 13
        { name: 'dark warriors', x: 3032, z: 3614, radius: 8, brackets: ['mid', 'high'] }, // 12
        { name: 'graveyard', x: 3160, z: 3672, radius: 10, brackets: ['mid', 'high'] }, // 20
        { name: 'bandit camp', x: 3036, z: 3700, radius: 10, brackets: ['mid', 'high'] }, // 23
        { name: 'chaos altar', x: 2956, z: 3816, radius: 8, brackets: ['high'] }, // 38
        // outside the Mage Arena's fence (mage_arena.dbrow ends at z 3953), by the lever down to the bank
        { name: 'mage bank', x: 3092, z: 3960, radius: 6, brackets: ['high'] } // 56
    ],
    names: [
        'Grimlock',
        'Tharn',
        'Vex',
        'Mordant',
        'Keel',
        'Ashby',
        'Dunmore',
        'Rook',
        'Talon',
        'Brisk',
        'Corvin',
        'Hask',
        'Jarl',
        'Lurk',
        'Morrow',
        'Nettle',
        'Oakes',
        'Pike',
        'Quill',
        'Rasp',
        'Sable',
        'Thorne',
        'Umber',
        'Vane',
        'Wick',
        'Yarrow',
        'Zeal',
        'Barrow',
        'Cinder',
        'Dredge',
        'Ember',
        'Flint',
        'Gorse',
        'Hollow',
        'Ingot',
        'Jinx',
        'Knave',
        'Lichen',
        'Marl',
        'Notch',
        'Onyx',
        'Pyre',
        'Rune',
        'Slate',
        'Tallow',
        'Ulric',
        'Vesper',
        'Wolfe',
        'Brand',
        'Crag'
    ],
    deathDrop: {
        low: { coins: [200, 1000], food: 2, extraChance: 0.1 },
        mid: { coins: [1000, 4000], food: 3, extraChance: 0.15 },
        high: { coins: [3000, 10000], food: 3, extraChance: 0.2 }
    }
};

function isRange(v: unknown): v is [number, number] {
    return Array.isArray(v) && v.length === 2 && typeof v[0] === 'number' && typeof v[1] === 'number' && v[0] <= v[1];
}

export function loadBotConfig(path: string = Environment.NODE_BOTS_CONFIG): BotConfigData {
    const config: BotConfigData = structuredClone(DEFAULT_BOT_CONFIG);

    if (path && fs.existsSync(path)) {
        try {
            const file = JSON.parse(fs.readFileSync(path, 'utf8')) as Partial<BotConfigData>;
            for (const [key, value] of Object.entries(file)) {
                if (!(key in config)) {
                    printWarning(`bots: unknown key "${key}" in ${path} - ignored`);
                    continue;
                }
                const current = (config as Record<string, unknown>)[key];
                if (Array.isArray(current) && current.length === 2 && typeof current[0] === 'number') {
                    if (!isRange(value)) {
                        printWarning(`bots: "${key}" in ${path} must be [min, max] - kept the default`);
                        continue;
                    }
                } else if (typeof current !== typeof value) {
                    printWarning(`bots: "${key}" in ${path} has the wrong type - kept the default`);
                    continue;
                }
                (config as Record<string, unknown>)[key] = value;
            }
            printInfo(`bots: config read from ${path}`);
        } catch (err) {
            printWarning(`bots: could not read ${path} (${err instanceof Error ? err.message : err}) - using defaults`);
        }
    }

    if (Environment.NODE_BOTS_ROAMERS >= 0) {
        config.roamers = Environment.NODE_BOTS_ROAMERS;
    }
    if (Environment.NODE_BOTS_PKERS >= 0) {
        config.pkers = Environment.NODE_BOTS_PKERS;
    }

    // a name longer than 8 does not fit "Bot " + name in the 12 characters a name can have
    config.names = config.names.filter(n => /^[A-Za-z0-9 ]{1,8}$/.test(n));
    if (config.names.length === 0) {
        config.names = [...DEFAULT_BOT_CONFIG.names];
    }

    return config;
}
