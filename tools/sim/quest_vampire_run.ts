// VAMPIRE SLAYER, played through on foot.
//
// Quest 9 of the full quest-by-quest pass. Morgan's house in Draynor, the garlic out of his upstairs
// cupboard, Dr Harlow in the Blue Moon Inn and the beer he will not talk without, then the coffin in
// the Draynor Manor basement and the Count himself. The overland legs are declared with setpos.
//
//   npx tsx tools/sim/quest_vampire_run.ts
import * as H from './harness.js';
import { play, Manifest } from './questrun.js';

await H.boot();

const m: Manifest = {
    quest: 'VAMPIRE SLAYER',
    source: 'oldschool.runescape.wiki/w/Vampyre_Slayer',
    stageVar: 'vampire',
    done: 3,   // ^vampire_complete
    start: [3098, 3271, 0],
    steps: [
        { note: 'wiki: a hammer (1 coin in the Varrock general store) and 2 coins for the beer.' },
        { note: 'The garlic and the stake are both got during the quest.' },
        { give: 'hammer' },
        { give: 'coins', n: 2 },

        { note: "wiki step 1: Morgan, in his house in Draynor Village" },
        { loc: 'loc_1530', at: [3098, 3270], why: "Morgan's front door" },
        { talk: 'morgan', picks: ['up for an adventure'], why: 'he sends you to Dr Harlow' },
        { stage: 1 },

        { note: 'wiki step 1: "If you do not have garlic, search the upstairs cupboard in his house"' },
        { loc: 'stairs', at: [3099, 3266], why: 'up to his first floor' },
        { loc: 'garliccupboardshut', at: [3096, 3269], why: 'open the cupboard' },
        { wait: 4, why: 'opening it is its own action; the search lands on top of it otherwise' },
        { loc: 'garliccupboardopen', at: [3096, 3269], want: 'garlic', why: 'and search it' },
        { has: 'garlic' },

        { note: 'wiki step 2: Dr Harlow, in the BLUE MOON INN south of Varrock square - which is' },
        { note: 'where Morgan now says he is. His line used to name the Jolly Boar, across the city.' },
        { setpos: [3222, 3399, 0], why: 'the road east out of Draynor and up into Varrock' },
        { talk: 'dr_harlow', picks: ['Morgan needs your help'], why: 'he will not say a word without a drink' },
        { stage: 2 },

        { note: 'wiki step 2: "buy it from the bartender for 2 coins"' },
        { talk: 'bluemoon_bartender', picks: ['finest ale'], why: 'a pint of beer, 2 coins' },
        { has: 'beer' },

        { note: 'wiki step 2: back to Harlow, who takes the beer and hands over the stake' },
        { talk: 'dr_harlow', why: 'he sobers up and gives you a stake' },
        { hasnt: 'beer' },
        { has: 'stake' },

        { note: 'wiki step 4: Draynor Manor, and the big stairs on its east side down to the basement' },
        { setpos: [3115, 3358, 0], why: 'north up the road to the manor and round to the east door' },
        { loc: 'cryptstairsdown', at: [3115, 3357], why: 'down into the basement' },

        { note: 'wiki step 5: the coffin in the middle of the room wakes him up' },
        { go: [3078, 9775], why: 'west along the basement to the coffin' },
        { loc: 'loc_2614', at: [3077, 9775], why: 'open the coffin' },
        { fight: 'count_draynor', why: 'garlic weakens him; the stake and hammer finish him' },
        { stage: 3 },
        { hasnt: 'stake' }
    ]
};

const p: any = H.makePlayer('vamprun', m.start[0], m.start[1]);
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
