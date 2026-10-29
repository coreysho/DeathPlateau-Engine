// MURDER MYSTERY, played through on foot.
//
// Quest 82 of the quest-by-quest pass. Lord Sinclair has been stabbed in a study locked from the
// inside, and which of his six children did it is picked at random when the guard takes you on -
// %murdersus = ~random_range(1,6). That decides the thread's colour, which two barrels hold the
// silver, whose fingerprints match, and which of six places in the garden has NOT been poisoned.
//
// This run pins it to Anna, so the trail is: green thread, her silver necklace in the first barrel,
// her prints on the dagger, and the compost heap she said she poisoned and plainly did not.
//
//   NODE_MEMBERS=true npx tsx tools/sim/quest_murder_run.ts
import * as H from './harness.js';
import { play, Manifest } from './questrun.js';

await H.boot();

const GUARD: [number, number, number] = [2739, 3578, 0];
const SACKS: [number, number] = [2731, 3582];
const WINDOW: [number, number] = [2747, 3577];
const BARREL_ANNA: [number, number] = [2733, 3575];
const FLOUR: [number, number] = [2735, 3582];
const COMPOST: [number, number] = [2730, 3572];
const ANNA: [number, number, number] = [2734, 3575, 0]; // her room, which is its own small pocket
const DAGGER: [number, number, number] = [2746, 3578, 0];
const SALESMAN: [number, number, number] = [2735, 3496, 0];

const m: Manifest = {
    quest: 'MURDER MYSTERY',
    source: 'oldschool.runescape.wiki/w/Murder_Mystery',
    stageVar: 'murderquest',
    done: 2, // ^murder_complete
    start: GUARD,
    steps: [
        { note: 'no requirements. Items: an empty pot for the flour.' },
        { give: 'pot_empty' },

        { note: 'wiki step 1: any guard round the mansion will take you on' },
        { setpos: GUARD, why: 'to the guard outside the mansion' },
        { talk: 'murderguard', picks: ["Sure, I'll help."], want: 'investigate who might be responsible', why: 'Lord Sinclair is dead' },
        { stage: 1 },

        { note: 'the culprit is random. Pinned to Anna so the trail can be written down - every' },
        { note: 'other branch of this quest is the same shape with different coordinates.' },
        { setvar: 'murdersus', to: 1, why: '^murderer_anna' },

        { note: 'wiki step 2: flypaper in the sacks in the shed, two pieces - one for each print' },
        { note: 'Sinclair Mansion is two dozen small rooms joined by ordinary doors - the guard by' },
        { note: 'the front step stands in a 37-tile pocket and the shed is a 4-tile one - so this' },
        { note: 'walk steps between rooms rather than clicking two dozen generic doors. The quest is' },
        { note: 'the evidence, and every piece of it is clicked for real.' },
        { setpos: [SACKS[0], SACKS[1] - 1, 0], why: 'north-west to the shed' },
        { loc: 'murdersacks', at: SACKS, op: 2, picks: ['Yes, it might be useful.'], want: 'take a piece of fly paper', why: 'one' },
        { loc: 'murdersacks', at: SACKS, op: 2, picks: ['Yes, it might be useful.'], want: 'take a piece of fly paper', why: 'and two' },
        { has: 'murderpaper', n: 2 },

        { note: 'wiki step 3: the dagger is on the study floor beside the body' },
        { setpos: DAGGER, why: 'to the study' },
        { take: 'murderweapon', r: 6, why: 'the flimsy dagger' },
        { has: 'murderweapon' },

        { note: 'wiki step 4: the smashed window on the east side caught a thread' },
        { note: 'the window is a wall decoration, so it is clicked from its own tile - the tile' },
        { note: 'south of it is the house wall.' },
        { setpos: [WINDOW[0], WINDOW[1], 0], why: 'to the window' },
        { loc: 'loc_2666', at: WINDOW, op: 2, want: 'take the thread', why: 'green, which is Anna or David' },
        { has: 'murderthreadg' },

        { note: 'wiki step 5: green means Anna and David, and her barrel has her necklace in it' },
        { setpos: [BARREL_ANNA[0] + 1, BARREL_ANNA[1], 0], why: 'to the first barrel' },
        { loc: 'murderbarrela', at: BARREL_ANNA, op: 2, want: "Anna's Silver Necklace", why: 'the silver' },
        { has: 'murdernecklace' },

        { note: 'wiki steps 6-8: flour from the kitchen barrel, flour on the silver, flypaper on' },
        { note: 'the flour, and the same again for the dagger' },
        { setpos: [FLOUR[0] - 1, FLOUR[1], 0], why: 'to the flour barrel' },
        { loc: 'flourbarrel', at: FLOUR, op: 2, want: 'take some flour', why: 'fill the pot' },
        { has: 'pot_flour' },
        { use: ['pot_flour', 'murdernecklace'], want: 'flour', why: 'dust the necklace' },
        { has: 'murdernecklacedust' },
        { use: ['murdernecklacedust', 'murderpaper'], want: 'finger prints', why: 'lift her print' },
        { has: 'murderfingerprinta' },
        { setpos: [FLOUR[0] - 1, FLOUR[1], 0], why: 'back to the flour barrel' },
        { loc: 'flourbarrel', at: FLOUR, op: 2, want: 'take some flour', why: 'refill the pot' },
        { use: ['pot_flour', 'murderweapon'], want: 'flour', why: 'dust the dagger' },
        { has: 'murderweapondust' },
        { use: ['murderweapondust', 'murderpaper'], want: 'finger prints', why: 'and lift the one on it' },
        { has: 'murderfingerprint1' },
        { use: ['murderfingerprinta', 'murderfingerprint1'], want: 'exact match', why: 'compare them' },
        { has: 'murderfingerprint' },

        { note: 'wiki step 10: the poison salesman in the Seers’ Village pub sold to the family' },
        { setpos: SALESMAN, why: "to the Seers' Village pub" },
        { talk: 'poison_salesman', picks: ['Who did you sell Poison to at the house?'], want: 'all bought a bottle', why: 'he sold one to every Sinclair' },
        { varis: 'murder_poisonproof_progress', to: 1 },

        { note: 'wiki step 11: and she says she bought it for the compost heap' },
        { setpos: ANNA, why: 'to Anna' },
        { talk: 'anna_sinclair', picks: ["Why'd you buy poison the other day?"], tries: 4, want: 'compost heap', why: 'ask her about it' },
        { varis: 'murder_poisonproof_progress', to: 2 },

        { note: 'wiki step 12: the heap is teeming, so nothing was poisoned there' },
        { setpos: [COMPOST[0] - 1, COMPOST[1], 0], why: 'to the compost heap' },
        { loc: 'loc_2650', at: COMPOST, op: 2, want: 'teeming with maggots', why: 'search it' },
        { varis: 'murder_poisonproof_progress', to: 3 },

        { note: 'wiki step 14: thread, prints and poison together is conclusive' },
        { setpos: GUARD, why: 'back to the guard' },
        { talk: 'murderguard', picks: ['I know who did it!'], want: 'congratulate you', why: 'name her' },
        { stage: 2 },
        { has: 'coins', n: 2000 }
    ]
};

const p: any = H.makePlayer('murderrun', m.start[0], m.start[1]);
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
