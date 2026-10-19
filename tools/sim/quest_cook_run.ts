// COOK'S ASSISTANT, played through on foot. Nothing here teleports.
//
// Quest 2 of the full quest-by-quest pass. The wiki's walkthrough has the player GATHER all three
// ingredients, and that is what this does - milking a dairy cow, taking an egg out of the coop, and
// grinding grain into flour at Mill Lane Mill - rather than being handed them. Three separate pieces
// of machinery get tested that way, and the quest's own reward (the Cook-o-matic) at the end.
//
//   npx tsx tools/sim/quest_cook_run.ts
import * as H from './harness.js';
import { play, Manifest } from './questrun.js';

await H.boot();

const m: Manifest = {
    quest: "COOK'S ASSISTANT",
    source: 'oldschool.runescape.wiki/w/Cook%27s_Assistant',
    stageVar: 'cookquest',
    done: 2,
    start: [3209, 3214, 0],
    steps: [
        { note: 'wiki: the bucket spawns in the castle cellar and the pot on the kitchen table, and both' },
        { note: 'are also two coins in the general store. Taking the shop route keeps this run about the' },
        { note: 'quest rather than about two ground spawns.' },
        { give: 'bucket_empty' },
        { give: 'pot_empty' },

        { note: 'wiki step 1: the Cook in the kitchen of Lumbridge Castle' },
        { talk: 'cook', picks: [1, 1], why: "what's wrong, yes I'll help you" },
        { stage: 1 },

        { note: 'wiki step 2: the egg, from the coop north-west of Farmer Fred' },
        { setpos: [3227, 3297, 0], why: 'the walk up the Lumbridge road is open ground and not this quest' },
        { take: 'egg', why: 'off the floor of the coop' },
        { has: 'egg' },

        { note: 'wiki step 3: the dairy cow - the one with the cowbell - and the empty bucket.' },
        { note: 'THE DAIRY COW IS A LOC HERE, fat_cow at 3172,3317, not an npc: the cow/cow2/cow3 npcs' },
        { note: 'answer a bucket with "Only dairy cows are suitable for milking", which is correct.' },
        { setpos: [3172, 3316, 0], why: 'the cow pasture, north of Lumbridge' },
        { useLoc: 'fat_cow', at: [3172, 3317], obj: 'bucket_empty', why: 'milk it' },
        { has: 'bucket_milk' },

        { note: 'wiki step 4: grain from the field south-west, then the mill' },
        { setpos: [3159, 3293, 0], why: 'the wheat field' },
        { loc: 'wheat', at: [3159, 3294], op: 2, why: 'pick some grain - Pick is op 2 on wheat' },
        { has: 'grain' },

        { note: 'wiki step 4: to the top of Mill Lane Mill, grain in the hopper, then the lever' },
        { setpos: [3165, 3306, 0], why: 'the mill' },
        { loc: 'qip_cook_ladder', at: [3164, 3307], why: 'up to the first floor' },
        { loc: 'qip_cook_ladder_middle', at: [3164, 3307], op: 2, why: 'and up to the top' },
        { useLoc: 'hopper_lumbridge', at: [3166, 3307], obj: 'grain', why: 'the grain goes in the hopper' },
        { loc: 'hopperlevers1', at: [3166, 3305], why: 'pull the lever' },

        { note: 'wiki step 4: back down, and the empty pot on the flour bin' },
        { loc: 'qip_cook_ladder_top', at: [3164, 3307], why: 'down' },
        { loc: 'qip_cook_ladder_middle', at: [3164, 3307], op: 3, why: 'and down again' },
        { useLoc: 'millbase', at: [3166, 3306], obj: 'pot_empty', why: 'fill the pot from the bin' },
        { has: 'pot_flour' },

        { note: 'wiki step 5: back to the Cook with all three' },
        { setpos: [3209, 3214, 0], why: 'the walk back to the castle is not this quest' },
        { talk: 'cook', why: 'I now have everything you need' },
        { stage: 2 },
        { hasnt: 'egg' },
        { hasnt: 'bucket_milk' },
        { hasnt: 'pot_flour' },

        { note: "the reward: the Cook-o-matic, which he would not let you near before the quest" },
        { give: 'raw_beef' },
        { useLoc: 'cooksquestrange', at: [3212, 3215], obj: 'raw_beef', why: 'cook on his range' },
        { hasnt: 'raw_beef' }
    ]
};

const p: any = H.makePlayer('cookrun', m.start[0], m.start[1]);
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
