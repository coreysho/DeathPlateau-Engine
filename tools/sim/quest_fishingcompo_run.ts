// FISHING CONTEST, played through on foot.
//
// Quest 31 of the quest-by-quest pass. The mountain dwarves want the gold trophy that is first
// prize at the Hemenster fishing competition and hand over their pass to anyone who can fish. The
// spot that wins is the one by the pipes, which the Sinister Stranger has taken - and he cannot
// stand the smell of garlic.
//
//   npx tsx tools/sim/quest_fishingcompo_run.ts
import * as H from './harness.js';
import { play, Manifest } from './questrun.js';

await H.boot();

const DWARF: [number, number, number] = [2878, 3485, 0];
const PIPE: [number, number] = [2637, 3446];

const m: Manifest = {
    quest: 'FISHING CONTEST',
    source: 'oldschool.runescape.wiki/w/Fishing_Contest',
    stageVar: 'fishingcompo',
    done: 5,   // ^fishingcompo_complete
    start: [2878, 3485, 0],
    steps: [
        { note: 'requirement: 10 Fishing. A rod, three red vine worms from McGrubor’s Wood, a' },
        { note: 'garlic and the 5gp entrance fee.' },
        { give: 'fishing_rod' },
        { give: 'red_vine_worm', n: 3 },
        { give: 'garlic' },
        { give: 'coins', n: 5 },

        { note: 'wiki step 1: the dwarf guarding the tunnel under White Wolf Mountain. He only' },
        { note: 'offers the pass after being talked all the way round to being friends.' },
        { talk: 'tunnel_dwarf', picks: ['what was down those stairs', 'Why not?', 'If you were my friend', "let's be friends", 'how am I meant to do that', "I'm alright at fishing"], want: 'entrust you with our competition pass', why: 'the pass' },
        { stage: 1 },
        { has: 'fishing_competition_pass' },

        { note: 'wiki step 2: the competition gate at Hemenster. Morris wants the pass, and the' },
        { note: 'enclosure is west of him - the op teleports you through.' },
        { setpos: [2643, 3441, 0], why: 'west to Hemenster' },
        { loc: 'fishinggateclosedr', at: [2642, 3441], want: 'Move on through', why: 'show Morris the pass' },

        { note: 'wiki step 3: Bonzo takes five coins and puts you by the willow tree' },
        { go: [2641, 3440], why: 'over to Bonzo' },
        { talk: 'bonzo', picks: ["I'll enter the competition please"], want: 'spot by the willow tree', why: 'pay the fee' },
        { stage: 2 },
        { varis: 'hemenster_comp_stage', to: 1 },

        { note: 'wiki step 4: the garlic goes in the pipe the Stranger is fishing beside, and he' },
        { note: 'swaps spots with you. It has to be used from the tile beside the pipe - from any' },
        { note: 'further away the engine answers "Nothing interesting happens".' },
        { go: [2638, 3446], exact: true, why: 'up to the pipes - the only open ground beside them' },
        { useLoc: 'garlicpipe', at: PIPE, obj: 'garlic', want: 'stash the garlic in the pipe', why: 'stash it' },
        { stage: 3 },
        { hasnt: 'garlic' },

        { note: 'wiki step 5: three fish from the pipe spot, with red vine worms - which is what' },
        { note: 'makes it a giant carp rather than a sardine' },
        { talk: '0_41_53_sinisterfishspot', want: 'giant carp', why: 'cast one' },
        { talk: '0_41_53_sinisterfishspot', want: 'giant carp', why: 'cast two' },
        { talk: '0_41_53_sinisterfishspot', want: 'new winner', why: 'cast three, and the weigh-in' },
        { stage: 4 },
        { has: 'hemenster_fishing_trophy' },

        { note: 'wiki step 6: the trophy back to the dwarf, who then lets anyone through his tunnel' },
        { setpos: DWARF, why: 'back east over the mountain' },
        { talk: 'tunnel_dwarf', want: 'give the trophy to the dwarf', why: 'hand over the trophy' },
        { wait: 4, why: 'the completion is queued' },
        { stage: 5 },
        { hasnt: 'hemenster_fishing_trophy' }
    ]
};

const p: any = H.makePlayer('fishcomporun', m.start[0], m.start[1]);
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
