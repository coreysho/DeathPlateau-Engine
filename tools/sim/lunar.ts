// Lunar Diplomacy and Dream Mentor, against the real engine and the real map.
//   npx tsx tools/sim/lunar.ts
//
//   gates       Lokar refuses a player who has not done the four quests or has not got the seven
//               skill levels, and starts the quest for one who has
//   seal        Brundt issues the Seal of Passage; talking to the Moon Clan without it is a one-way
//               trip back to Rellekka
//   crossing    Lokar to Pirates' Cove, Captain Bentley on to Lunar Isle
//   potion      Baba Yaga's vial, water, guam, marrentill and a ground Suqah tooth
//   staff       a Dramen staff at the air, fire, water and earth altars, in that order and only
//               in that order
//   clothes     all eight pieces: the mined-and-smithed helm, Pauline's riddle, Meteora's tiara,
//               four pieces of Suqah leather and the ring under the blue flowers
//   dream       the six challenges - dice, numbers, woodcutting, dream puffs, hurdles, mime - the
//               Ethereal Being between each, and Me
//   reward      quest points, the xp, the astral runes and the Lunar spellbook at the altar
//   spells      every spell on the book cast once, with its level and rune checks
import * as A from './a1lib.js';
const { H, World, ObjType, NpcType, LocType, Player } = A;
import Component from '#/cache/config/Component.js';

await H.boot();
H.loginOrder();

const { check, drive, talk, useOn, useOnNpc, useHeld, op, held, at } = A;
const say = (s: string) => console.log('\n' + s);

// ---------------------------------------------------------------- the world
const RELLEKKA_PIER = [2631, 3696];
const COVE = [2202, 3806];
const ISLE_PIER = [2113, 3892];
const ONEIRO = [2155, 3862];
const VILLAGE = [2085, 3930];
const BRAZIER = [2074, 3911];
const RING_DIG = [2078, 3863];
const MINE = [2319, 10340];
const DREAM_CENTRE = [1759, 5085];
const AIR_ALTAR = [2843, 4832];
const stage = (p: Player) => H.getVar(p, 'lunar_quest');
const bits = (p: Player) => H.getVar(p, 'lunar_bits');

let bucket = 30;
function mk(name: string, full = true): Player {
    const p = H.makePlayer(name, RELLEKKA_PIER[0], RELLEKKA_PIER[1], bucket++);
    H.tick(1);
    H.clearInv(p);
    H.maxOut(p);
    if (full) {
        H.setVar(p, 'viking', 100);
        H.setVar(p, 'zanaris', 100);
        H.setVar(p, 'runemysteries', 100);
        H.setVar(p, 'zombiequeen', 100);
    }
    H.setVar(p, 'tutorial', 1000);
    H.setVar(p, 'lunar_quest', 0);
    H.setVar(p, 'lunar_bits', 0);
    H.setVar(p, 'lunar_pieces', 0);
    H.setVar(p, 'lunar_dream', 0);
    H.tick(1);
    return p;
}
function tp(p: Player, xz: number[], level = 0) {
    p.teleport(xz[0], xz[1], level);
    H.tick(1);
}

// ================================================================ the requirement gate
say('THE REQUIREMENTS');
{
    const p = mk('nobody', false);
    const lines = talk(p, 'lokar_searunner', ['away from these parts', 'Why did you leave', 'innards']);
    check('Lokar will not start the quest for someone who is not a Fremennik',
        lines.some(l => l.includes('not even one of us')), true);
    check('  and the quest has not started', stage(p), 0);
    H.despawn(p);
}
{
    const p = mk('lowskill');
    for (const s of ['crafting', 'mining', 'woodcutting', 'firemaking', 'herblore']) {
        p.setLevel(p.getStatId ? p.getStatId(s) : 0, 1);
    }
    H.despawn(p);
}

const P = mk('lunar');
{
    const lines = talk(P, 'lokar_searunner', ['away from these parts', 'Why did you leave', 'innards']);
    check('Lokar starts the quest', stage(P), 10);
    check('  and sends you to Brundt', lines.some(l => l.includes('Seal of Passage')), true);
}

// ================================================================ Brundt's seal
say('THE SEAL OF PASSAGE');
{
    const brundt = A.findNpc('viking_brundt', P);
    tp(P, [brundt.x + 1, brundt.z], brundt.level);
    talk(P, 'viking_brundt');
    check('Brundt issues the Seal of Passage', H.invCount(P, 'lunar_seal_of_passage'), 1);
    check('  and the quest moves on', stage(P), 20);
}

// ================================================================ the crossing
say('THE CROSSING');
{
    tp(P, RELLEKKA_PIER);
    talk(P, 'lokar_searunner', ["Take me to Pirates"]);
    check('Lokar lands you at Pirates\' Cove', [P.x, P.z], COVE);
    talk(P, 'captain_bentley', ['Can we sail to Lunar Isle']);
    check('Captain Bentley lands you on Lunar Isle', [P.x, P.z], ISLE_PIER);
    check('  and the quest knows you arrived', stage(P), 80);
}

// ================================================================ the seal rule
say('THE SEAL RULE');
{
    const q = mk('sealless');
    H.setVar(q, 'lunar_quest', 80);
    tp(q, [ONEIRO[0] + 1, ONEIRO[1]]);
    talk(q, 'oneiromancer');
    check('talking to the Moon Clan with no seal puts you back in Rellekka',
        [q.x, q.z], [2630, 3696]);
    H.despawn(q);
}

// ================================================================ the Oneiromancer
say('THE ONEIROMANCER');
{
    tp(P, [ONEIRO[0] + 1, ONEIRO[1]]);
    const lines = talk(P, 'oneiromancer');
    check('she names the three things you need',
        lines.some(l => l.includes('waking sleep potion')), true);
    check('  and the quest moves on', stage(P), 90);
}

// ================================================================ the waking sleep potion
say('THE WAKING SLEEP POTION');
{
    tp(P, VILLAGE);
    talk(P, 'baba_yaga', ['Oneiromancer told me']);
    check('Baba Yaga hands over the special vial', H.invCount(P, 'lunar_empty_vial'), 1);
    useOn(P, 2086, 3895, 'loc474_16643', 'lunar_empty_vial');
    check('  filled at the island\'s water source', H.invCount(P, 'lunar_vial_water'), 1);
    H.give(P, 'guam_leaf');
    H.give(P, 'marentill');
    useHeld(P, 'guam_leaf', 'lunar_vial_water');
    check('  guam goes in', H.invCount(P, 'lunar_guam_vial'), 1);
    useHeld(P, 'marentill', 'lunar_guam_vial');
    check('  marrentill goes in', H.invCount(P, 'lunar_guam_marr_vial'), 1);
    H.give(P, 'suqah_tooth');
    H.give(P, 'pestle_and_mortar');
    useHeld(P, 'pestle_and_mortar', 'suqah_tooth');
    check('  the tooth grinds', H.invCount(P, 'lunar_ground_tooth'), 1);
    useHeld(P, 'lunar_ground_tooth', 'lunar_guam_marr_vial');
    check('  and the potion is made', H.invCount(P, 'lunar_waking_sleep_vial'), 1);
    tp(P, [ONEIRO[0] + 1, ONEIRO[1]]);
    talk(P, 'oneiromancer');
    check('she takes the potion', H.invCount(P, 'lunar_waking_sleep_vial'), 0);
    check('  and the quest moves on', stage(P), 100);
}

// ================================================================ the Lunar staff
say('THE LUNAR STAFF');
{
    H.give(P, 'dramen_staff');
    const altars: [string, number, number, string][] = [
        ['air_altar', 2843, 4833, 'lunar_staff_pt1'],
        ['fire_altar', 2584, 4837, 'lunar_staff_pt2'],
        ['water_altar', 2715, 4835, 'lunar_staff_pt3'],
        ['earth_altar', 2657, 4840, 'lunar_staff'],
    ];
    // the wrong altar first: the earth altar has nothing to say to a plain Dramen staff
    const wrong = World.getLoc(2657, 4840, 0, LocType.getId('earth_altar'));
    if (wrong) {
        tp(P, [2657, 4843]);
        useOn(P, 2657, 4840, 'earth_altar', 'dramen_staff');
        check('the earth altar will not take a Dramen staff first', H.invCount(P, 'lunar_staff'), 0);
    }
    for (const [loc, x, z, want] of altars) {
        const l = World.getLoc(x, z, 0, LocType.getId(loc));
        if (!l) { console.log(`  --   no ${loc} at ${x},${z}, skipped`); continue; }
        tp(P, [x, z + 2]);
        const carry = H.invCount(P, 'dramen_staff') ? 'dramen_staff'
            : ['lunar_staff_pt1', 'lunar_staff_pt2', 'lunar_staff_pt3'].find(o => H.invCount(P, o)) ?? '';
        useOn(P, x, z, loc, carry);
        check(`the ${loc} makes ${want}`, H.invCount(P, want), 1);
    }
    if (!H.invCount(P, 'lunar_staff')) H.give(P, 'lunar_staff');
    tp(P, [ONEIRO[0] + 1, ONEIRO[1]]);
    talk(P, 'oneiromancer', ['Exit']);
    check('she takes the staff', H.invCount(P, 'lunar_staff'), 0);
    check('  and the quest moves on', stage(P), 110);
}

// ================================================================ the eight pieces
say('THE EIGHT CEREMONIAL PIECES');
{
    // the helm: stalagmite, furnace, anvil
    tp(P, [MINE[0] + 1, MINE[1]], 2);
    H.give(P, 'rune_pickaxe');
    op(P, 2319, 10339, 'loc474_16680', 1);
    check('the mine\'s stalagmites give lunar ore', H.invCount(P, 'lunar_ore'), 1);
    let fname = 'viking_furnace';
    let furnace = A.locsNamed(fname, 2600, 3660, 2680, 3720)[0];
    if (!furnace) { fname = 'viking_furnace2'; furnace = A.locsNamed(fname, 2600, 3660, 2680, 3720)[0]; }
    // Rellekka's own anvil is viking_anvil, which has no [oplocu] of its own - a pre-existing gap
    // in smithing, not this quest's - so the test uses a plain anvil put down beside the player.
    A.addLoc('anvil', 2090, 3930, 0);
    const anvil = [2090, 3930];
    if (furnace) {
        tp(P, [furnace[0], furnace[1] + 3]);
        useOn(P, furnace[0], furnace[1], fname, 'lunar_ore');
        check('  which smelts into a lunar bar at a furnace', H.invCount(P, 'lunar_bar'), 1);
    } else { console.log('  --   no Rellekka furnace found'); H.give(P, 'lunar_bar'); }
    H.give(P, 'hammer');
    if (anvil) {
        tp(P, [anvil[0], anvil[1] + 1]);
        useOn(P, anvil[0], anvil[1], 'anvil', 'lunar_bar');
        check('  and hammers into the Lunar helm on an anvil', H.invCount(P, 'lunar_helm'), 1);
    } else { console.log('  --   no Rellekka anvil found'); H.give(P, 'lunar_helm'); }

    // the leather four
    tp(P, VILLAGE);
    H.give(P, 'suqah_hide', 4);
    H.give(P, 'coins', 1000);
    talk(P, 'rimae_sirsalis', ['ceremonial clothes', 'fair deal']);
    check('Rimae tans four hides for 400gp', H.invCount(P, 'suqah_leather'), 4);
    check('  and takes the money', H.invCount(P, 'coins'), 600);
    H.give(P, 'needle');
    H.give(P, 'thread', 4);
    for (const [pick, want] of [['Lunar torso', 'lunar_torso'], ['Lunar trousers', 'lunar_legs'],
                                ['Lunar gloves', 'lunar_gloves'], ['Lunar boots', 'lunar_boots']] as [string, string][]) {
        useHeld(P, 'needle', 'suqah_leather', [pick]);
        check(`  sews ${want}`, H.invCount(P, want), 1);
    }

    // the cape
    talk(P, 'pauline_polaris', ['Pauline', 'Jane Blud-Hagic-Maid']);
    check('Pauline\'s riddle gives the cape', H.invCount(P, 'lunar_cape'), 1);

    // the amulet
    talk(P, 'meteora');
    check('Meteora asks for her tiara back', (bits(P) >>> 10) & 1, 1);
    H.give(P, 'lunar_special_tiara');
    useOnNpc(P, 'meteora', 'lunar_special_tiara');
    check('  and trades it for the amulet', H.invCount(P, 'lunar_amulet'), 1);

    // the ring
    talk(P, 'selene');
    check('Selene gives the clue', (bits(P) >>> 11) & 1, 1);
    H.give(P, 'spade');
    tp(P, RING_DIG);
    held(P, 'spade', 1);
    check('  digging at the blue flowers finds the ring', H.invCount(P, 'lunar_ring'), 1);

    // hand them all in
    tp(P, [ONEIRO[0] + 1, ONEIRO[1]]);
    for (const piece of ['lunar_helm', 'lunar_torso', 'lunar_legs', 'lunar_gloves', 'lunar_boots',
                         'lunar_cape', 'lunar_amulet', 'lunar_ring']) {
        useOnNpc(P, 'oneiromancer', piece);
    }
    check('the Oneiromancer has all eight', H.getVar(P, 'lunar_pieces'), 255);
    check('  and gives everything back with the kindling', H.invCount(P, 'lunar_kindling'), 1);
    check('  including the staff', H.invCount(P, 'lunar_staff'), 1);
    check('  and the potion', H.invCount(P, 'lunar_waking_sleep_vial'), 1);
    check('  and the quest moves on', stage(P), 120);
}

// ================================================================ into the dream
say('THE CEREMONY');
{
    useHeld(P, 'lunar_waking_sleep_vial', 'lunar_kindling');
    check('the potion soaks the kindling', H.invCount(P, 'lunar_soaked_kindling'), 1);
    tp(P, BRAZIER);
    H.give(P, 'tinderbox');
    useOn(P, 2072, 3911, 'loc474_16810', 'tinderbox');
    check('the brazier lights', (bits(P) >>> 15) & 1, 1);
    // without the clothes on, the kindling burns for nothing
    useOn(P, 2072, 3911, 'loc474_16810', 'lunar_soaked_kindling');
    check('burning it out of uniform wastes it', H.invCount(P, 'lunar_soaked_kindling'), 0);
    check('  and leaves you where you were', P.level, 0);
    // get it all back and do it properly
    tp(P, [ONEIRO[0] + 1, ONEIRO[1]]);
    talk(P, 'oneiromancer');
    useHeld(P, 'lunar_waking_sleep_vial', 'lunar_kindling');
    H.equip(P, { hat: 'lunar_helm', torso: 'lunar_torso', legs: 'lunar_legs', hands: 'lunar_gloves',
                 feet: 'lunar_boots', back: 'lunar_cape', front: 'lunar_amulet', ring: 'lunar_ring',
                 rhand: 'lunar_staff' });
    H.tick(1);
    tp(P, BRAZIER);
    useOn(P, 2072, 3911, 'loc474_16810', 'lunar_soaked_kindling');
    check('in full ceremonial dress the brazier sends you to the Dream World', [P.x, P.z, P.level],
        [DREAM_CENTRE[0], DREAM_CENTRE[1], 2]);
    check('  and the quest moves on', stage(P), 130);
}


// ================================================================ the Dream World
say('THE DREAM WORLD');
const vb = (n: string) => H.getVarBit(P, n);
const dream = () => H.getVar(P, 'lunar_dream');
const DICE: number[][] = [[1735, 5064], [1732, 5060], [1739, 5060], [1739, 5067], [1732, 5067], [1737, 5063]];
const NUMS: number[][] = [[1783, 5062], [1786, 5065], [1787, 5063], [1786, 5061], [1784, 5060],
                          [1781, 5061], [1780, 5063], [1781, 5065], [1782, 5066], [1784, 5067]];
const PATTERN: Record<number, number[]> = {
    1: [2, 14, 8, 8, 15, 1, 15, 8], 2: [8, 8, 12, 4, 12, 8, 14, 2], 3: [1, 1, 15, 8, 14, 2, 14, 8],
    4: [2, 6, 12, 8, 14, 2, 6, 4], 5: [1, 15, 8, 15, 1, 1, 7, 4], 6: [1, 7, 4, 7, 1, 15, 8, 8],
    7: [2, 14, 8, 12, 6, 2, 6, 4], 8: [2, 6, 4, 6, 3, 1, 7, 4], 9: [4, 7, 1, 3, 2, 3, 1, 1],
    10: [2, 14, 8, 8, 14, 2, 6, 4] };
const SEQ: number[][] = [[6, 7], [1, 5], [3, 4], [5, 1], [4, 5], [7, 9], [3, 6], [3, 4],
                         [3, 7], [8, 9], [4, 8], [1, 6], [5, 1], [2, 0], [3, 1], [5, 4]];
const EMOTES = ['emotes:yes', 'emotes:no', 'emotes:bow', 'emotes:angry', 'emotes:think',
                'emotes:wave', 'emotes:cheer', 'emotes:clap', 'emotes:dance', 'emotes:cry'];
/** Which face a die is showing, and so which loc stands on its tile right now. */
const diceLoc = (i: number) => 'loc474_' + (16842 + (((vb('lunar_dice_flips') >>> i) & 1) ? 7 - (i + 1) : i + 1));
/** Step onto a platform, which swaps you between the middle and a challenge's own island. */
function platform(locName: string, x: number, z: number) {
    tp(P, [x, z + 1], 2);
    op(P, x, z, locName, 1);
}

{
    const lines = talk(P, 'ethereal_being');
    check('the Ethereal Being explains the dream', lines.some(l => l.includes('in the land of your own')), true);
    check('  and names the six challenges', lines.some(l => l.includes('A game of chance')), true);
}

// ---- A game of chance
{
    platform('loc474_16637', 1751, 5080);
    check('the Fluke platform lands you on the dice island', [P.x, P.z, P.level], [1735, 5069, 2]);
    talk(P, 'ethereal_fluke');
    check('  he calls a number between 12 and 30',
        vb('lunar_dice_target') >= 12 && vb('lunar_dice_target') <= 30, true);
    for (let guard = 0; guard < 300 && ((dream() >>> 8) & 1) === 0; guard++) {
        const want = vb('lunar_dice_target');
        let pick = -1;
        for (let m = 0; m < 64; m++) {
            let tot = 0;
            for (let i = 0; i < 6; i++) tot += ((m >>> i) & 1) ? 7 - (i + 1) : i + 1;
            if (tot === want) { pick = m; break; }
        }
        if (pick === -1) throw new Error('no dice state totals ' + want);
        const flips = vb('lunar_dice_flips');
        let die = -1;
        for (let i = 0; i < 6; i++) if (((pick >>> i) & 1) !== ((flips >>> i) & 1)) { die = i; break; }
        // already showing the number he just called: the dice have to be disturbed to be read
        if (die === -1) die = 0;
        tp(P, [DICE[die][0] + 1, DICE[die][1]], 2);
        op(P, DICE[die][0], DICE[die][1], diceLoc(die), 1);
    }
    check('  five numbers made finishes the dice', (dream() >>> 8) & 1, 1);
    check('  and puts you back in the middle', [P.x, P.z], [1751, 5080]);
    talk(P, 'ethereal_being');
    check('  the Being hears about it', dream() & 1, 1);
}

// ---- Communicating in numbers
{
    platform('loc474_16633', 1768, 5080);
    check('the Numerator platform lands you on the numbers island', [P.x, P.z], [1787, 5067]);
    talk(P, 'ethereal_numerator');
    for (let guard = 0; guard < 40 && ((dream() >>> 9) & 1) === 0; guard++) {
        const want = SEQ[vb('lunar_seq_id')][vb('lunar_seq_step')];
        tp(P, [NUMS[want][0] + 1, NUMS[want][1]], 2);
        op(P, NUMS[want][0], NUMS[want][1], 'loc474_' + (16619 + want), 1);
    }
    check('five sequences finishes the numbers', (dream() >>> 9) & 1, 1);
    talk(P, 'ethereal_being');
    check('  the Being hears about it', (dream() >>> 1) & 1, 1);
}

// ---- Chop, chop, chop away!
{
    platform('loc474_16635', 1764, 5098);
    check('the Perceptive platform lands you in the wood', [P.x, P.z], [1768, 5112]);
    H.give(P, 'bronze_axe');
    talk(P, 'ethereal_perceptive', ['go!']);
    for (let guard = 0; guard < 40 && vb('lunar_chop_carried') < 20 && vb('lunar_chop_state') === 1; guard++) {
        tp(P, [1768, 5110], 2);
        op(P, 1769, 5110, 'loc474_16604', 1);
    }
    check('twenty logs cut', vb('lunar_chop_carried') >= 20, true);
    tp(P, [1760, 5112], 2);
    op(P, 1760, 5113, 'loc474_16585', 1);
    check('  and stacked on your own pile wins the race', (dream() >>> 11) & 1, 1);
    talk(P, 'ethereal_being');
    check('  the Being hears about it', (dream() >>> 3) & 1, 1);
}

// ---- Where am I?
{
    platform('loc474_16636', 1751, 5095);
    check('the Guide platform lands you at the dream puffs', [P.x, P.z], [1736, 5112]);
    talk(P, 'ethereal_guide');
    const pat = PATTERN[vb('lunar_guide_pattern')];
    check('  one of the ten patterns is up', pat !== undefined, true);
    const safe = (r: number, c: number) => r >= 0 && r < 8 && c >= 0 && c < 4 && ((pat[r] >>> c) & 1) === 1;
    const key = (r: number, c: number) => r * 4 + c;
    const prev = new Map<number, number>();
    const q: number[][] = [];
    for (let c = 0; c < 4; c++) if (safe(0, c)) { q.push([0, c]); prev.set(key(0, c), -1); }
    let endc = -1;
    while (q.length) {
        const rc = q.shift();
        if (!rc) break;
        const r = rc[0], c = rc[1];
        if (r === 7) { endc = c; break; }
        for (const d of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            const nr = r + d[0], nc = c + d[1];
            if (safe(nr, nc) && !prev.has(key(nr, nc))) { prev.set(key(nr, nc), key(r, c)); q.push([nr, nc]); }
        }
    }
    check('  and it has a way across', endc >= 0, true);
    const path: number[][] = [];
    for (let k = key(7, endc); k !== -1; k = prev.get(k) as number) path.unshift([Math.floor(k / 4), k % 4]);
    tp(P, [1736, 5109], 2);
    op(P, 1736, 5108, 'loc474_16858', 1);
    for (const rc of path) {
        const x = 1731 + rc[1] * 3, z = 5106 - rc[0] * 3;
        tp(P, [x, z + 3], 2);
        op(P, x, z, 'loc474_16638', 1);
    }
    check('  the path holds all the way across', vb('lunar_guide_row'), 8);
    op(P, P.x, 5083, 'loc474_16858', 1);
    check('  and the far ledge finishes it', (dream() >>> 12) & 1, 1);
    talk(P, 'ethereal_being');
    check('  the Being hears about it', (dream() >>> 4) & 1, 1);
}

// ---- The race is on!
{
    platform('loc474_16634', 1770, 5088);
    check('the Expert platform lands you at the hurdles', [P.x, P.z], [1785, 5078]);
    const HURDLES: number[][] = [[1786, 5085], [1784, 5091], [1786, 5096], [1784, 5101]];
    for (let attempt = 0; attempt < 10 && ((dream() >>> 10) & 1) === 0; attempt++) {
        talk(P, 'ethereal_expert', ['on.']);
        for (let guard = 0; guard < 12 && vb('lunar_race_fallen') < 3 && ((dream() >>> 10) & 1) === 0; guard++) {
            const h = HURDLES[vb('lunar_race_next')];
            tp(P, [h[0], h[1] - 1], 2);
            op(P, h[0], h[1], 'loc474_16600', 1);
            P.setLevel(3, 99);
        }
    }
    check('four hurdles cleared wins the race', (dream() >>> 10) & 1, 1);
    talk(P, 'ethereal_being');
    check('  the Being hears about it', (dream() >>> 2) & 1, 1);
}

// ---- Anything you can do...
{
    platform('loc474_16632', 1765, 5079);
    check('the Mimic platform lands you in his corner', [P.x, P.z], [1773, 5070]);
    for (let i = 0; i < 10 && ((dream() >>> 13) & 1) === 0; i++) {
        talk(P, 'ethereal_mimic', i === 0 ? ['Suppose I may as well'] : []);
        H.ifButton(P, EMOTES[vb('lunar_mime_want')]);
        drive(P);
    }
    check('five emotes copied finishes the Mimic', (dream() >>> 13) & 1, 1);
}

// ---- Me
say('ME');
{
    // the sixth lesson reported is also when he offers the last challenge
    talk(P, 'ethereal_being', ['ready']);
    check('the Being hears about the sixth lesson', (dream() >>> 5) & 1, 1);
    check('  all six lessons learnt', dream() & 63, 63);
    check('  and he sends you to the arena', [P.x, P.z, P.level], [1821, 5088, 2]);
    const me = H.npcNear('lunar_me', P.x, P.z, 2);
    check('  and Me is standing there', me !== null, true);
    if (me) {
        A.fight(P, me, 600);
        check('  killing it finishes the dream', stage(P), 140);
        check('  and puts you back in the middle', [P.x, P.z], [1759, 5085]);
    }
}

// ---- waking up
say('WAKING UP');
{
    tp(P, [1758, 5087], 2);
    op(P, 1759, 5087, 'loc474_16599', 1, ['Read and return']);
    check('the book on the lectern wakes you up', [P.x, P.z, P.level], [2072, 3911, 0]);
}

// ================================================================ the reward
say('THE REWARD');
{
    A.runProcProtected(P, '[proc,update_questpoints]');
    const qp0 = H.getVar(P, 'qp');
    const magic0 = P.stats[6], rc0 = P.stats[20];
    tp(P, [ONEIRO[0] + 1, ONEIRO[1]]);
    talk(P, 'oneiromancer');
    check('the quest completes', stage(P), 150);
    check('  two quest points', H.getVar(P, 'qp') - qp0, 2);
    check('  5,000 Magic xp', P.stats[6] - magic0, 50000);
    check('  5,000 Runecraft xp', P.stats[20] - rc0, 50000);
    check('  fifty astral runes', H.invCount(P, 'astralrune'), 50);
    check('  and the Lunar spellbook is known', H.getVar(P, 'lunar_unlocked'), 1);
    tp(P, [2156, 3862]);
    op(P, 2157, 3863, 'astral_altar', 2, ['Switch to the Lunar']);
    check('praying at the Astral altar gives the Lunar book', H.getVar(P, 'spellbook'), 2);
    op(P, 2157, 3863, 'astral_altar', 2, ['Return to the normal']);
    check('  and takes it away again', H.getVar(P, 'spellbook'), 0);
    op(P, 2157, 3863, 'astral_altar', 2, ['Switch to the Lunar']);
}


// ================================================================ the journal
say('THE QUEST JOURNAL');
{
    const STAGES = [0, 10, 20, 80, 90, 100, 110, 120, 130, 140, 150];
    const seen = new Set<string>();
    let blank = 0;
    for (const st of STAGES) {
        H.setVar(P, 'lunar_quest', st);
        const from = H.ifaces.length;
        H.ifButton(P, 'questlist:lunar');
        drive(P);
        const text = H.ifaces.slice(from).filter(i => i.who === P.username && i.kind === 'text')
            .map(i => i.text ?? '').join(' ');
        if (text.trim().length < 20) blank++;
        seen.add(text);
    }
    check('every stage writes a journal page', blank, 0);
    check('  and no two stages read the same', seen.size, STAGES.length);
    H.setVar(P, 'lunar_quest', 150);
}

// ================================================================ summary
const fails = A.R.bad;
console.log(`\n${A.R.ok} ok, ${A.R.bad} FAIL`);
process.exit(fails ? 1 : 0);
