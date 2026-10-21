// GERTRUDE'S CAT, played through on foot.
//
// Quest 61 of the quest-by-quest pass. Gertrude has lost Fluffs; her two boys saw the cat last and
// will not say where without a hundred coins. The quest was already written in detail, from RSC
// dialogue breaks and 2004 screenshots - the one thing wrong with it was that the lone-boy half of
// the haggle was dead code, so a player who found Shilop and Wilough more than three tiles apart
// got no menu and could not pay anybody.
//
//   NODE_MEMBERS=true npx tsx tools/sim/quest_fluffs_run.ts
import * as H from './harness.js';
import { play, Manifest } from './questrun.js';

await H.boot();

const HOUSE_DOOR: [number, number] = [3150, 3412];
const GERTRUDE: [number, number] = [3151, 3411];
const DOOGLE: [number, number] = [3151, 3399];
const BOYS: [number, number] = [3222, 3433];
const FENCE: [number, number] = [3305, 3493];
const LADDER: [number, number] = [3310, 3509];
const FLUFFS: [number, number] = [3307, 3513];
const CRATE: [number, number] = [3305, 3500];

const m: Manifest = {
    quest: "GERTRUDE'S CAT",
    source: 'oldschool.runescape.wiki/w/Gertrude%27s_Cat',
    stageVar: 'fluffs',
    done: 6,
    start: [3150, 3414, 0],
    steps: [
        { note: 'no requirements. A bucket of milk, a hundred coins and a sardine seasoned with' },
        { note: 'doogle leaves, which grow in the woods behind her house.' },
        { give: 'bucket_milk' },
        { give: 'coins', n: 100 },
        { give: 'raw_sardine' },

        { note: 'wiki step 1: Gertrude, in the house west of Varrock south of the Cooks Guild' },
        { go: [HOUSE_DOOR[0], HOUSE_DOOR[1]], exact: true, why: 'her door; the room is a 16-tile pocket' },
        { loc: 'loc_1530', at: HOUSE_DOOR, soft: true, why: 'open it' },
        { go: [GERTRUDE[0], GERTRUDE[1]], exact: true, why: 'in, beside Gertrude' },
        { talk: 'gertrude', picks: ['Well, I suppose I could.'], want: 'Fluffs', why: 'she sets the quest' },
        { stage: 1 },

        { note: 'the doogle leaves are five ground spawns in the trees south of the house' },
        { go: [HOUSE_DOOR[0], HOUSE_DOOR[1]], exact: true, why: 'back to the door' },
        { loc: 'loc_1530', at: HOUSE_DOOR, soft: true, why: 'open it again' },
        { go: [DOOGLE[0], DOOGLE[1] + 1], r: 40, why: 'south into the trees' },
        { take: 'doogleleaves', r: 10, why: 'off the ground' },
        { use: ['doogleleaves', 'raw_sardine'], want: 'rub the doogle leaves', why: 'a doogle sardine' },
        { has: 'seasoned_sardine' },

        { note: 'wiki step 2: Shilop and Wilough in Varrock square want a hundred coins for the' },
        { note: 'location. The picks answer either version of the haggle - the two of them together' },
        { note: 'or one on his own - because the option wording is the same in both.' },
        { go: [BOYS[0], BOYS[1]], r: 120, why: 'east to Varrock square' },
        { talk: 'shilop', picks: ['What will make you tell me?', "Okay then, I'll pay."], want: 'lumber mill', why: 'the haggle' },
        { stage: 2 },
        { hasnt: 'coins' },

        { note: 'wiki step 3: the broken fence on the south side of the Lumber Yard, then the ladder' },
        { go: [FENCE[0], FENCE[1] - 1], exact: true, r: 120, why: 'south of the broken fence' },
        { loc: 'gertrudefence', at: FENCE, why: 'climb over it' },
        { go: [LADDER[0] - 1, LADDER[1]], r: 40, why: 'to the ladder in the middle of the yard' },
        { loc: 'ladder', at: LADDER, why: 'up to the loft' },

        { note: 'wiki steps 4-5: she hisses at you, takes the milk, takes the sardine, and still' },
        { note: 'will not leave - and then you can hear kittens' },
        { go: [FLUFFS[0] - 1, FLUFFS[1]], r: 40, why: 'beside Fluffs' },
        { talk: 'gertrudescat', want: 'thirsty', why: 'she hisses and scratches' },
        { useNpc: 'gertrudescat', obj: 'bucket_milk', why: 'the milk' },
        { stage: 3 },
        { note: 'which of the six crates holds the kitten is a roll, so it is pinned: case 0 is the' },
        { note: 'crate at 3305,3500' },
        { rng: 0, why: 'the kitten is in the first crate' },
        { useNpc: 'gertrudescat', obj: 'seasoned_sardine', why: 'the doogle sardine' },
        { stage: 4 },
        { rng: null, why: 'nothing else is a roll' },

        { note: 'wiki step 6: the crates below, the one with the kitten actually in it' },
        { loc: 'laddertop', at: LADDER, why: 'back down' },
        { go: [CRATE[0] + 1, CRATE[1]], r: 40, why: 'to the crate' },
        { talk: 'kittens_mew', want: 'find a kitten', why: 'search it' },
        { has: 'gertrudekittens' },

        { note: 'wiki step 9: the kitten on Fluffs, and both of them go home' },
        { go: [LADDER[0] - 1, LADDER[1]], r: 40, why: 'back to the ladder' },
        { loc: 'ladder', at: LADDER, why: 'up again' },
        { go: [FLUFFS[0] - 1, FLUFFS[1]], r: 40, why: 'beside Fluffs' },
        { useNpc: 'gertrudescat', obj: 'gertrudekittens', want: 'run off home', why: 'reunited' },
        { stage: 5 },

        { note: 'wiki step 10: back to Gertrude. Varrock is a hundred and fifty tiles west and the' },
        { note: 'road is not the quest, so this leg is a setpos.' },
        { setpos: [HOUSE_DOOR[0], HOUSE_DOOR[1] + 2, 0], why: 'back to her house' },
        { go: [HOUSE_DOOR[0], HOUSE_DOOR[1]], exact: true, why: 'her door' },
        { loc: 'loc_1530', at: HOUSE_DOOR, soft: true, why: 'open it' },
        { go: [GERTRUDE[0], GERTRUDE[1]], exact: true, why: 'in' },
        { talk: 'gertrude', want: 'gives you a kitten', why: 'the reward' },
        { wait: 10, why: 'the hug, the kitten, the food and the queue' },
        { stage: 6 },
        { has: 'chocolate_cake' },
        { has: 'stew' }
    ]
};

const p: any = H.makePlayer('catrun', m.start[0], m.start[1]);
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
