import type { BotBracket } from '#/engine/bot/BotConfig.js';
import { PlayerStat } from '#/engine/entity/PlayerStat.js';

// Builds and gear, by level bracket. Every item here is an obj that exists in this content (the bot
// manager refuses to spawn a kit naming one that does not, and says which). Kits are what a bot is
// GIVEN on every (re)spawn; none of it reaches the economy - a dead bot drops bones and its bracket's
// small deathDrop set (BotConfig), never this.

export type BotKind = 'roamer' | 'pker';
export type BotBuild = 'pure' | 'main' | 'tank';
export type BotStyle = 'melee' | 'ranged' | 'mage' | 'hybrid';

export type BotKit = {
    id: string;
    build: BotBuild;
    style: BotStyle;
    bracket: BotBracket;
    kinds: BotKind[];
    /** Base levels. Anything not listed is 1 (hitpoints 10). */
    stats: Partial<Record<PlayerStat, number>>;
    /** Obj names, each put in the slot its wearpos says. Ammo is [name, count] via wornAmmo. */
    worn: string[];
    wornAmmo?: [string, number];
    /** Carried, apart from food: spec weapons, switches, potions, runes. */
    inv: [string, number][];
    food: string;
    foodCount: number;
    /** A weapon in the pack switched to for a special attack (worn weapon specs itself if it can). */
    specWeapon?: string;
    /** Energy (percent) the spec costs - so the bot only switches when it can fire. */
    specEnergy?: number;
    /** Melee weapon a hybrid switches to when its target is frozen next to it. */
    meleeSwitch?: string;
    spellbook?: 'normal' | 'ancient';
    /** Spells, as component names: a freeze to open with, and a damage spell. */
    freezeSpell?: string;
    damageSpell?: string;
    /** Cheap things one of which it may drop (deathDrop.extraChance). */
    dropExtras: [string, number][];
};

const A = PlayerStat.ATTACK;
const S = PlayerStat.STRENGTH;
const D = PlayerStat.DEFENCE;
const H = PlayerStat.HITPOINTS;
const R = PlayerStat.RANGED;
const P = PlayerStat.PRAYER;
const M = PlayerStat.MAGIC;

export const BOT_KITS: BotKit[] = [
    // ---- low: combat ~35-50
    {
        id: 'low-main-melee',
        build: 'main',
        style: 'melee',
        bracket: 'low',
        kinds: ['roamer', 'pker'],
        stats: { [A]: 40, [S]: 40, [D]: 40, [H]: 42, [P]: 25 },
        worn: ['adamant_full_helm', 'adamant_platebody', 'adamant_platelegs', 'adamant_kiteshield', 'rune_scimitar', 'amulet_of_power', 'leather_boots', 'red_cape'],
        inv: [],
        food: 'lobster',
        foodCount: 8,
        dropExtras: [
            ['steel_scimitar', 1],
            ['mithril_full_helm', 1],
            ['iron_arrow', 30]
        ]
    },
    {
        id: 'low-pure-melee',
        build: 'pure',
        style: 'melee',
        bracket: 'low',
        kinds: ['roamer', 'pker'],
        stats: { [A]: 40, [S]: 55, [D]: 1, [H]: 45, [P]: 1 },
        worn: ['rune_scimitar', 'amulet_of_strength', 'black_cape', 'leather_boots', 'leather_vambraces', 'monkrobetop', 'leather_chaps'],
        inv: [],
        food: 'lobster',
        foodCount: 8,
        dropExtras: [
            ['steel_scimitar', 1],
            ['leather_vambraces', 1],
            ['iron_arrow', 30]
        ]
    },
    {
        id: 'low-pure-ranged',
        build: 'pure',
        style: 'ranged',
        bracket: 'low',
        kinds: ['roamer', 'pker'],
        stats: { [R]: 50, [D]: 1, [H]: 40, [P]: 1 },
        worn: ['coif', 'studded_body', 'leather_chaps', 'leather_vambraces', 'maple_shortbow', 'amulet_of_power', 'leather_boots'],
        wornAmmo: ['mithril_arrow', 200],
        inv: [],
        food: 'lobster',
        foodCount: 6,
        dropExtras: [
            ['mithril_arrow', 25],
            ['coif', 1],
            ['iron_arrow', 50]
        ]
    },
    {
        id: 'low-tank',
        build: 'tank',
        style: 'melee',
        bracket: 'low',
        kinds: ['roamer'],
        stats: { [A]: 30, [S]: 30, [D]: 45, [H]: 40, [P]: 20 },
        worn: ['mithril_full_helm', 'mithril_platebody', 'mithril_platelegs', 'mithril_kiteshield', 'adamant_scimitar', 'amulet_of_strength', 'leather_boots'],
        inv: [],
        food: 'lobster',
        foodCount: 8,
        dropExtras: [
            ['steel_scimitar', 1],
            ['iron_full_helm', 1]
        ]
    },

    // ---- mid: combat ~60-85
    {
        id: 'mid-pure-melee',
        build: 'pure',
        style: 'melee',
        bracket: 'mid',
        kinds: ['pker'],
        stats: { [A]: 60, [S]: 80, [D]: 1, [H]: 75, [P]: 31 },
        worn: ['dragon_scimitar', 'amulet_of_glory', 'black_cape', 'death_climbingboots', 'leather_vambraces', 'monkrobetop', 'zamrobebottom'],
        inv: [
            ['dragon_dagger_p++', 1],
            ['4dose2strength', 1]
        ],
        food: 'swordfish',
        foodCount: 10,
        specWeapon: 'dragon_dagger_p++',
        specEnergy: 25,
        dropExtras: [
            ['amulet_of_strength', 1],
            ['adamant_scimitar', 1],
            ['adamant_arrow', 30]
        ]
    },
    {
        id: 'mid-main-melee',
        build: 'main',
        style: 'melee',
        bracket: 'mid',
        kinds: ['roamer', 'pker'],
        stats: { [A]: 70, [S]: 70, [D]: 70, [H]: 70, [P]: 43 },
        worn: ['rune_full_helm', 'rune_platebody', 'rune_platelegs', 'rune_kiteshield', 'dragon_scimitar', 'amulet_of_glory', 'death_climbingboots', 'red_cape'],
        inv: [['dragon_dagger_p++', 1]],
        food: 'swordfish',
        foodCount: 10,
        specWeapon: 'dragon_dagger_p++',
        specEnergy: 25,
        dropExtras: [
            ['adamant_full_helm', 1],
            ['adamant_scimitar', 1],
            ['amulet_of_strength', 1]
        ]
    },
    {
        id: 'mid-pure-ranged',
        build: 'pure',
        style: 'ranged',
        bracket: 'mid',
        kinds: ['roamer', 'pker'],
        stats: { [R]: 85, [D]: 1, [H]: 70, [P]: 1 },
        worn: ['coif', 'studded_body', 'black_dragonhide_chaps', 'black_dragon_vambraces', 'magic_shortbow', 'amulet_of_power', 'leather_boots', 'black_cape'],
        wornAmmo: ['rune_arrow', 150],
        inv: [],
        food: 'swordfish',
        foodCount: 8,
        specEnergy: 55,
        dropExtras: [
            ['rune_arrow', 20],
            ['maple_shortbow', 1],
            ['adamant_arrow', 40]
        ]
    },
    {
        id: 'mid-mage',
        build: 'main',
        style: 'mage',
        bracket: 'mid',
        kinds: ['pker'],
        stats: { [M]: 75, [D]: 40, [H]: 60, [P]: 37 },
        worn: ['mystic_hat', 'mystic_robe_top', 'mystic_robe_bottom', 'staff_of_air', 'amulet_of_magic', 'boots_wizard', 'zamorak_cape'],
        inv: [
            ['firerune', 400],
            ['deathrune', 80],
            ['earthrune', 200],
            ['waterrune', 200],
            ['naturerune', 40]
        ],
        food: 'swordfish',
        foodCount: 8,
        spellbook: 'normal',
        freezeSpell: 'magic:snare',
        damageSpell: 'magic:fire_blast',
        dropExtras: [
            ['firerune', 50],
            ['deathrune', 10],
            ['staff_of_air', 1]
        ]
    },
    {
        id: 'mid-tank',
        build: 'tank',
        style: 'melee',
        bracket: 'mid',
        kinds: ['roamer', 'pker'],
        stats: { [A]: 60, [S]: 60, [D]: 70, [H]: 65, [P]: 43 },
        worn: ['rune_full_helm', 'rune_platebody', 'rune_platelegs', 'rune_kiteshield', 'rune_scimitar', 'amulet_of_strength', 'leather_boots'],
        inv: [],
        food: 'lobster',
        foodCount: 10,
        dropExtras: [
            ['adamant_full_helm', 1],
            ['mithril_scimitar', 1]
        ]
    },

    // ---- high: combat ~100-120
    {
        id: 'high-main-melee',
        build: 'main',
        style: 'melee',
        bracket: 'high',
        kinds: ['roamer', 'pker'],
        stats: { [A]: 99, [S]: 99, [D]: 85, [H]: 95, [P]: 70 },
        worn: ['dragon_med_helm', 'rune_platebody', 'rune_platelegs', 'rune_kiteshield', 'abyssal_whip', 'amulet_of_glory', 'death_climbingboots', 'red_cape'],
        inv: [
            ['dragon_dagger_p++', 1],
            ['4dose2strength', 1],
            ['4doseprayerrestore', 1]
        ],
        food: 'shark',
        foodCount: 12,
        specWeapon: 'dragon_dagger_p++',
        specEnergy: 25,
        dropExtras: [
            ['rune_full_helm', 1],
            ['amulet_of_strength', 1],
            ['rune_arrow', 25]
        ]
    },
    {
        id: 'high-tank',
        build: 'tank',
        style: 'melee',
        bracket: 'high',
        kinds: ['roamer', 'pker'],
        stats: { [A]: 80, [S]: 85, [D]: 99, [H]: 95, [P]: 70 },
        worn: ['rune_full_helm', 'rune_platebody', 'rune_platelegs', 'rune_kiteshield', 'dragon_scimitar', 'amulet_of_glory', 'rune_armoured_boots', 'black_cape'],
        inv: [
            ['dragon_longsword', 1],
            ['4dosepotionofsaradomin', 1]
        ],
        food: 'shark',
        foodCount: 12,
        specWeapon: 'dragon_longsword',
        specEnergy: 25,
        dropExtras: [
            ['rune_full_helm', 1],
            ['rune_scimitar', 1]
        ]
    },
    {
        id: 'high-hybrid',
        build: 'main',
        style: 'hybrid',
        bracket: 'high',
        kinds: ['pker'],
        stats: { [M]: 94, [A]: 80, [S]: 90, [D]: 70, [H]: 90, [P]: 52 },
        worn: ['mystic_hat', 'mystic_robe_top', 'mystic_robe_bottom', 'staff_of_zaros', 'amulet_of_glory', 'boots_wizard', 'zamorak_cape'],
        inv: [
            ['waterrune', 600],
            ['bloodrune', 100],
            ['deathrune', 200],
            ['dragon_scimitar', 1]
        ],
        food: 'shark',
        foodCount: 10,
        spellbook: 'ancient',
        freezeSpell: 'ancient_magic:ice_barrage',
        damageSpell: 'ancient_magic:ice_blitz',
        meleeSwitch: 'dragon_scimitar',
        dropExtras: [
            ['deathrune', 20],
            ['bloodrune', 10],
            ['mystic_hat', 1]
        ]
    }
];

export function kitsFor(kind: BotKind): BotKit[] {
    return BOT_KITS.filter(k => k.kinds.includes(kind));
}

export function kitById(id: string): BotKit | undefined {
    return BOT_KITS.find(k => k.id === id);
}
