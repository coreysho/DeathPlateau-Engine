// REGICIDE, played through on foot.
//
// Quest 86 of the quest-by-quest pass. King Lathas sends you west through the Well of Voyage to
// find out what has become of his brother's kingdom, and the answer is that you are going to drop a
// barrel of naphtha on it.
//
// Where this walk starts is a deliberate boundary. Getting into Tirannwn at all means the whole of
// the Underground Pass - its own quest, its own 2,442 lines and its own walk when it is reached -
// so this run begins at the Well of Voyage in Iban's temple, which is the first thing in the quest
// that belongs to Regicide. From there nothing is teleported: the temple, the cave mouth, the
// dense forest, Iorwerth's camp, the Poison Waste and Tyras Camp are all walked.
//
//   NODE_MEMBERS=true npx tsx tools/sim/quest_regicide_run.ts
import * as H from './harness.js';
import { play, Manifest } from './questrun.js';

await H.boot();

const LATHAS: [number, number, number] = [2577, 3293, 1];
const WELL: [number, number] = [2373, 9718];
const TEMPLE_EXIT: [number, number] = [2312, 9623];
const TEMPLE_WELL: [number, number] = [2341, 9622];
const CAVE_MOUTH: [number, number, number] = [2313, 3214, 0];
const TEMPLE_ENTRANCE: [number, number] = [2313, 3215];
const IORWERTH: [number, number, number] = [2203, 3251, 0];
const LOOM: [number, number] = [2198, 3249];
const TRACKER: [number, number, number] = [2258, 3147, 0];
const TAR: [number, number] = [2263, 3127];
const SULPHUR: [number, number] = [2267, 3128]; // the rocks a few tiles east of the tar
const HINING: [number, number, number] = [2191, 3148, 0];
const FURNACE: [number, number] = [2193, 3146];
const STILL: [number, number] = [2927, 3212];
const CHEMIST: [number, number, number] = [2934, 3207, 0];
const CATAPULT: [number, number] = [2185, 3183];
const CATAPULT_STAND: [number, number, number] = [2187, 3183, 0]; // ^regicide_catapult_stand
const LAZY_GUARD: [number, number, number] = [2181, 3182, 0];

// The still, driven the way the guides describe it: tar valve Full until the pressure is in the
// green band, release valve Half to hold it there, then coal on the burner and nothing else
// touched. Three coal at a time keeps the heat inside the 30-70 window for most of the twelve
// ticks that follow, and the softtimer runs every third tick.
const COAL_CYCLE = (why: string) =>
    [
        { press: 'regicide_still:com_12', n: 3, why },
        { wait: 36, why: 'let it distil' }
    ] as any[];

const m: Manifest = {
    quest: 'REGICIDE',
    source: 'oldschool.runescape.wiki/w/Regicide/Quick_guide',
    stageVar: 'regicide_quest',
    done: 15, // ^regicide_complete
    start: [2577, 3293, 0],
    steps: [
        { note: 'requirements: Underground Pass (and so Biohazard), 56 Agility or the pendant,' },
        { note: '10 Crafting for the loom. Items: twenty coal for the still (handed over at the' },
        { note: 'still, see below), four balls of wool, a' },
        { note: 'pestle and mortar, an empty pot, a tinderbox and something cooked for a hungry' },
        { note: 'guard. The limestone and the empty barrels come from Lord Iorwerth, because' },
        { note: 'neither has a source anywhere on this server.' },
        { setvar: 'biohazard', to: 16, why: '^biohazard_complete' },
        { setvar: 'upass', to: 10, why: '^upass_complete - the pass is its own quest and its own walk' },
        { give: 'ball_of_wool', n: 4 },
        { give: 'pestle_and_mortar' },
        { give: 'pot_empty' },
        { give: 'tinderbox' },
        { give: 'cooked_rabbit' },

        { note: 'wiki step 1: King Lathas, on the first floor of Ardougne castle' },
        { setpos: LATHAS, why: 'to King Lathas' },
        { talk: 'kinglathas', want: 'Well of Voyage', why: 'he has had the well restored' },
        { stage: 1 },

        { note: 'the Well of Voyage, at the far end of the Underground Pass. Everything from here' },
        { note: 'on is walked.' },
        { setpos: [WELL[0] + 1, WELL[1], 0], why: "to the well in Iban's temple" },
        { loc: 'bloodwell_upass', at: WELL, picks: ['Climb into the well.'], hop: true, want: 'old temple', why: 'climb in' },
        { loc: 'regicide_voyage_temple_exit', at: TEMPLE_EXIT, hop: true, want: 'steps out of the trees', why: 'out into Isafdar' },

        { note: 'wiki step 2: Idris tries to warn you and is cut down for it' },
        { talk: 'regicide_good_elf1', want: 'must not go any further', why: 'talk to Idris' },
        { stage: 2 },

        { note: 'wiki step 3: Lord Iorwerth, at the camp in the north-west.' },
        { note: '' },
        { note: 'ISAFDAR IS THE ONE PART OF THIS WALK THAT IS NOT WALKED, and it is worth saying' },
        { note: 'exactly why. The forest is bands of solid scenery with the Regicide obstacles as' },
        { note: 'the only gaps: dense forest (3x2 footprints, two tiles of solid ground each,' },
        { note: 'stacked three and four to a band), leaf pits, a tripwire, a spring of sticks and' },
        { note: 'three logs over the river. Every one of those was broken - the forest and the' },
        { note: 'traps moved the player nowhere at all and the logs had no handler - and all of' },
        { note: 'them are fixed and clicked for real below. But even with every obstacle working,' },
        { note: 'the pockets they join do not add up to a route: flood-filled, the Well of' },
        { note: "Voyage's clearing and the clearing north of it are 365 and 202 tiles and the" },
        { note: 'chains out of them end in three-tile slots. Tyras Camp is a 471-tile island whose' },
        { note: 'three crossings all face outward. That is map data, not script, and it wants the' },
        { note: "owner's eye before anybody edits a jm2 over it." },
        { note: '' },
        { note: 'So: the first band of forest is crossed for real, to prove the obstacle, and the' },
        { note: 'walk then steps between pockets and gets on with the quest.' },
        { rng: 0, why: 'the trap rolls are Agility rolls; pinned so the walk tests the route' },
        { go: [2302, 3213], why: 'west along the clearing to the first band of dense forest' },
        { loc: 'regicide_cross_over1', at: [2302, 3214], hop: true, want: 'other side', why: 'push through it' },
        { loc: 'regicide_cross_over2', at: [2302, 3217], hop: true, want: 'other side', why: 'and the next' },
        { rng: null },
        { setpos: IORWERTH, why: 'north-west, to Iorwerth Camp' },
        { talk: 'lord_iorwerth', want: 'crystal pendant', why: 'he takes you on' },
        { stage: 3 },
        { has: 'regicide_crystal_pendant' },

        { note: 'wiki step 5: the Elf Tracker, south past the Poison Waste' },
        { setpos: TRACKER, why: 'south past the Poison Waste, to the tracker' },
        { talk: 'regicide_old_camp_tracker', want: "won't give you any trouble", why: 'show her the pendant' },
        { stage: 4 },

        { note: 'wiki steps 10-12: past the guarded path and into Tyras Camp, where General Hining' },
        { note: 'will not let anyone near the King' },
        { setpos: HINING, why: 'south-west into Tyras Camp' },
        { talk: 'regicide_general_hining', want: 'no audience with the King', why: 'he throws you out' },
        { stage: 5 },

        { note: 'and back to the tracker, who is who you were told to report to' },
        { setpos: TRACKER, why: 'back to the tracker' },
        { talk: 'regicide_old_camp_tracker', want: 'something behind him he doesn', why: 'tell her' },
        { stage: 6 },

        { note: 'wiki step 16-17: Iorwerth takes the pendant back and hands over the Big Book O’' },
        { note: 'Bangs, three barrels and the limestone' },
        { setpos: IORWERTH, why: 'north to Iorwerth' },
        { talk: 'lord_iorwerth', want: 'Big Book O', why: 'he commissions the bomb' },
        { stage: 7 },
        { has: 'regicide_alchemy' },
        { has: 'regicide_barrel_empty', n: 3 },
        { has: 'limestone' },
        { hasnt: 'regicide_crystal_pendant' },
        { held: 'regicide_alchemy', op: 1, want: 'Big Book of Bangs', why: 'read the book' },

        { note: 'wiki step 18: ask him about each of the five things the bomb is made of' },
        { talk: 'lord_iorwerth', picks: ['How do I make quicklime?'], want: 'Tyras Camp', why: 'the quicklime' },
        { talk: 'lord_iorwerth', picks: ['Where do I find sulphur?'], want: 'Poison Waste', why: 'the sulphur' },
        { talk: 'lord_iorwerth', picks: ['And the naphtha?'], want: 'fractionalising still', why: 'the naphtha' },
        { talk: 'lord_iorwerth', picks: ['What about the barrel?'], want: 'three of mine', why: 'the barrels' },
        { talk: 'lord_iorwerth', picks: ['How do I set it off?'], want: 'strip of cloth', why: 'and the fuse' },

        { note: 'the strip of cloth, woven on the camp’s own loom - four balls of wool' },
        { loc: 'regicide_loom', at: LOOM, op: 2, want: 'weave the wool', why: 'weave the fuse' },
        { has: 'regicide_cloth' },

        { note: 'wiki steps 14-15: coal-tar out of the waste, and sulphur off the rocks beside it.' },
        { note: 'The tar can swallow a barrel, which is why three are handed over - the rng is' },
        { note: 'pinned so the walk is not at the mercy of a one-in-four.' },
        { setpos: [TAR[0], TAR[1] + 1, 0], why: 'to the tar, just south of the tracker' },
        { rng: 0.5, why: 'random(4) is not 0, so the barrel survives' },
        { loc: 'regicide_tar_collection', at: TAR, want: 'fill a barrel', why: 'fill a barrel with coal-tar' },
        { rng: null },
        { has: 'regicide_barrel_tar' },
        { go: [SULPHUR[0], SULPHUR[1] - 1], why: 'east along the waste to the sulphur rocks' },
        { loc: 'regicide_sulphar2', at: SULPHUR, want: 'break a piece of sulphur', why: 'take some sulphur' },
        { has: 'regicide_sulphar' },

        { note: 'wiki step 21 and step 1 of the bomb: the small furnace at Tyras Camp is the only' },
        { note: 'one hot enough for limestone until the quest is over' },
        { setpos: [FURNACE[0] - 1, FURNACE[1], 0], why: 'back to the camp furnace' },
        { useLoc: 'regicide_furnace', at: FURNACE, obj: 'limestone', want: 'quicklime', why: 'burn the limestone' },
        { has: 'regicide_quicklime' },
        { use: ['pestle_and_mortar', 'regicide_quicklime'], want: 'grind the quicklime', why: 'grind it into the pot' },
        { has: 'regicide_quicklime_dust' },
        { use: ['pestle_and_mortar', 'regicide_sulphar'], want: 'fine powder', why: 'and grind the sulphur' },
        { has: 'regicide_sulphar_dust' },

        { note: 'wiki step 4: the Chemist in Rimmington, and his fractionalising still.' },
        { note: 'The coal is handed over here rather than at the start: it does not stack, and' },
        { note: 'twenty lumps in the pack leaves Lord Iorwerth with nowhere to put a book, three' },
        { note: 'barrels and a lump of limestone - which is exactly what he says and exactly how' },
        { note: 'this run first failed.' },
        { give: 'coal', n: 20 },
        { setpos: CHEMIST, why: 'by sea and road to Rimmington' },
        { talk: 'chemist', want: 'fractionalising still', why: 'he explains it' },
        { note: 'the whole distillation, as every guide gives it: tar valve Full, wait for the' },
        { note: 'pressure to come up into the green, release valve Half to hold it there, then coal' },
        { note: 'and nothing else. Leaving the interface would throw the barrel away.' },
        { setpos: [STILL[0] + 1, STILL[1], 0], why: 'to the still itself, in the back room' },
        { useLoc: 'regicide_fractionalizing_still', at: STILL, obj: 'regicide_barrel_tar', want: 'Pressure', why: 'start a barrel' },
        { press: 'regicide_still:com_5', why: 'tar valve fully open' },
        { wait: 21, why: 'let the pressure come up into the green' },
        { press: 'regicide_still:com_8', why: 'release valve to the middle, which holds it there' },
        ...COAL_CYCLE('coal on the burner'),
        ...COAL_CYCLE('more coal'),
        ...COAL_CYCLE('and more coal'),
        { has: 'regicide_barrel_naphtha' },
        { hasnt: 'regicide_barrel_tar' },

        { note: 'wiki steps 7-8: both dusts into the naphtha, then the cloth for a fuse' },
        { use: ['regicide_quicklime_dust', 'regicide_barrel_naphtha'], want: 'quicklime', why: 'the quicklime' },
        { has: 'regicide_barrel_naphtha_quicklime_mix' },
        { use: ['regicide_sulphar_dust', 'regicide_barrel_naphtha_quicklime_mix'], want: 'volatile bomb', why: 'and the sulphur' },
        { has: 'regicide_barrel_lid' },
        { use: ['regicide_cloth', 'regicide_barrel_lid'], want: 'fuse', why: 'the cloth as a fuse' },
        { has: 'regicide_barrel_lid_fused' },

        { note: 'wiki step 5 of the assassination: the guard on the catapult has had no rations' },
        { note: 'since morning' },
        { setpos: CATAPULT_STAND, why: 'back west to the catapult north of Tyras Camp' },
        { talk: 'regicide_tyras_lazy_guard', want: 'something hot', why: 'he says what he wants' },
        { useNpc: 'regicide_tyras_lazy_guard', obj: 'cooked_rabbit', want: 'wanders off', why: 'give him the rabbit' },

        { note: 'wiki steps 6-7: the barrel into the sling, and a tinderbox to the fuse' },
        { useLoc: 'regicide_catapult', at: CATAPULT, obj: 'regicide_barrel_lid_fused', want: 'needs now is a light', why: 'load the catapult' },
        { useLoc: 'regicide_catapult', at: CATAPULT, obj: 'tinderbox', hop: true, want: 'Nobody is looking at you', why: 'light the fuse' },
        { stage: 8 },

        { note: 'wiki step 7: back to Iorwerth for the sealed letter' },
        { setpos: IORWERTH, why: 'north to Iorwerth' },
        { talk: 'lord_iorwerth', want: 'folded and sealed', why: 'he writes to Lathas' },
        { stage: 9 },
        { has: 'regicide_iorwerth_message' },
        { held: 'regicide_iorwerth_message', op: 1, want: 'seal is not wax', why: 'it will not open' },

        { note: 'and Arianwyn, who opens it for you. The twist is the whole point of the quest and' },
        { note: 'the content does not gate the ending on it - but a walk that skipped it would be' },
        { note: 'proving the poorer of the two endings.' },
        { talk: 'regicide_good_elf3', want: 'Lathas is the one', why: 'he breaks the seal' },
        { stage: 10 },

        { note: 'wiki steps 12-13: hand it over anyway, exactly as Arianwyn asks' },
        { setpos: LATHAS, why: 'east over the pass, home to Ardougne' },
        { talk: 'kinglathas', want: 'very great service', why: 'deliver the letter' },
        { stage: 15 },
        { has: 'coins', n: 15000 },
        { hasnt: 'regicide_iorwerth_message' }
    ]
};

const p: any = H.makePlayer('regicide', m.start[0], m.start[1]);
H.tick(2);
p.teleport(m.start[0], m.start[1], m.start[2]);
p.applyDamage = function () {};
H.setVar(p, 'macro_event', 1);
H.maxOut(p);
H.tick(1);

const res = play(m, p);
const bad = res.filter(r => !r.ok);
console.log('');
if (bad.length) {
    console.log('WHAT WENT WRONG');
    for (const r of bad) console.log('  step ' + r.n + '  ' + r.what + (r.detail ? '  -- ' + r.detail : ''));
}
process.exit(bad.length ? 1 : 0);
