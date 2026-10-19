// WITCH'S POTION, played through on foot.
//
// Quest 5 of the full quest-by-quest pass. The four ingredients are a rat kill, a cow kill and two
// shop purchases, none of which is this quest, so they are handed over declared. The quest itself -
// Hetty's dialogue, the hand-in and the drink from the cauldron - is all walked.
//
//   npx tsx tools/sim/quest_hetty_run.ts
import * as H from './harness.js';
import { play, Manifest } from './questrun.js';

await H.boot();

const m: Manifest = {
    quest: "WITCH'S POTION",
    source: 'oldschool.runescape.wiki/w/Witch%27s_Potion',
    stageVar: 'hetty',
    done: 3,
    start: [2969, 3206, 0],
    steps: [
        { give: 'burnt_meat' },
        { give: 'rats_tail' },
        { give: 'eye_of_newt' },
        { give: 'onion' },

        { note: 'wiki: Hetty, in her house in Rimmington' },
        { talk: 'hetty', picks: [1, 1], why: 'a quest, and yes to the darker side' },
        { stage: 1 },

        { note: 'wiki: all four ingredients to her - she puts them in the cauldron herself' },
        { talk: 'hetty', why: 'yes I have everything' },
        { stage: 2 },
        { hasnt: 'burnt_meat' },
        { hasnt: 'rats_tail' },
        { hasnt: 'eye_of_newt' },
        { hasnt: 'onion' },

        { note: 'wiki: and the last step is to drink from the cauldron, which is what completes it' },
        { loc: 'hettycauldron', at: [2967, 3205], why: 'drink from it' },
        { stage: 3 }
    ]
};

const p: any = H.makePlayer('hettyrun', m.start[0], m.start[1]);
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
