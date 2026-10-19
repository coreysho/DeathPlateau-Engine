// SHEEP SHEARER, played through on foot.
//
// Quest 14 of the full quest-by-quest pass. Fred the Farmer wants twenty balls of wool. The run
// shears a sheep and spins the wool on the Lumbridge castle wheel for real - that is the whole
// quest, repeated twenty times - and then declares the other nineteen rather than walking the same
// three steps nineteen more times.
//
//   npx tsx tools/sim/quest_sheep_run.ts
import * as H from './harness.js';
import { play, Manifest } from './questrun.js';

await H.boot();

const m: Manifest = {
    quest: 'SHEEP SHEARER',
    source: 'oldschool.runescape.wiki/w/Sheep_Shearer',
    stageVar: 'sheep',
    done: 22,   // ^sheep_complete
    start: [3190, 3273, 0],
    steps: [
        { note: 'wiki: shears, and twenty balls of wool by the end' },
        { give: 'shears' },

        { note: 'wiki step 1: Fred the Farmer, in his house north of Lumbridge' },
        { talk: 'fred_the_farmer', picks: ['quest', 'Yes okay. I can do that', 'Of course!', 'something of an expert'], why: 'he wants twenty balls of wool' },
        { stage: 1 },

        { note: 'wiki step 2: shear a sheep. Shears used ON the sheep, which is its own packet.' },
        { setpos: [3197, 3266, 0], why: 'out to his pen' },
        { useNpc: 'sheepunsheered', obj: 'shears', until: 'wool', tries: 12, why: 'shear it - it gets away one time in four' },
        { has: 'wool' },

        { note: "wiki step 3: spin it on the wheel upstairs in Lumbridge Castle" },
        { setpos: [3209, 3213, 1], why: 'south to the castle and up the staircase' },
        { useLoc: 'spinningwheel', at: [3209, 3212], obj: 'wool', picks: [6], why: 'the wheel, and Make 1 on the panel it opens' },
        { has: 'ball_of_wool' },

        { note: 'the other nineteen are nineteen more of exactly that, so they are declared' },
        { give: 'ball_of_wool', n: 19 },
        { has: 'ball_of_wool', n: 20 },

        { note: 'wiki step 4: twenty balls to Fred, one conversation at a time' },
        { setpos: [3190, 3273, 0], why: 'back north to Fred' },
        { talk: 'fred_the_farmer', why: 'hand them over - one conversation takes the lot' },
        { stage: 22 },
        { hasnt: 'ball_of_wool' },
        { note: '60 coins and 150 Crafting XP, which is the 2006 reward. The modern wiki says 150' },
        { note: 'coins - that is a later rebalance, not this quest.' },
        { has: 'coins', n: 60 }
    ]
};

const p: any = H.makePlayer('sheeprun', m.start[0], m.start[1]);
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
