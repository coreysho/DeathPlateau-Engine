// A TAIL OF TWO CATS, played through on foot.
//
// Quest 21 of the full quest-by-quest pass. Unferth in his cottage north of Taverley with no hair
// and no cat, Bob on the counter of Bob's Axes, a list of five chores, Reldo on who Robert the
// Strong was, Neite in the garden, and the curse off a cat who has been sitting on a man for eleven
// years.
//
// It needs two other quests finished before anyone will say anything: Gertrude's Cat (to understand
// a cat at all) and Icthlarin's Little Helper (for the amulet that lets you). Both are declared.
//
//   npx tsx tools/sim/quest_twocats_run.ts
import * as H from './harness.js';
import { play, Manifest } from './questrun.js';

await H.boot();

const PATCH: [number, number] = [2919, 3562];   // the one patch tile with open garden beside it

const m: Manifest = {
    quest: 'A TAIL OF TWO CATS',
    source: 'oldschool.runescape.wiki/w/A_Tail_of_Two_Cats',
    stageVar: 'twocats_quest',
    done: 80,   // ^twocats_complete
    start: [2920, 3558, 0],
    steps: [
        { note: 'requirements: Gertrude’s Cat and Icthlarin’s Little Helper, both finished,' },
        { note: 'and the catspeak amulet from the second of them, worn' },
        { setvar: 'fluffs', to: 6, why: "Gertrude's Cat, which is a different quest" },
        { setvar: 'ics_little_var', to: 26, why: "Icthlarin's Little Helper, likewise" },
        { give: 'ics_little_amulet_of_catspeak' },
        { held: 'ics_little_amulet_of_catspeak', op: 2, why: 'wear it - nobody can hear a cat without one' },
        { worn: 'ics_little_amulet_of_catspeak' },

        { note: 'and the chores: logs and a tinderbox, milk, a chocolate cake, shears, a rake and' },
        { note: 'seed potatoes' },
        { give: 'logs' },
        { give: 'tinderbox' },
        { give: 'bucket_milk' },
        { give: 'chocolate_cake' },
        { give: 'shears' },
        { give: 'rake' },
        { give: 'potato_seed', n: 3 },

        { note: 'wiki step 1: Unferth, bald, in a chair' },
        { talk: 'twocats_unferth', picks: ['you look bald'], why: 'his cat walked to Lumbridge and his hair fell out' },
        { stage: 10 },
        { varis: 'twocats_chores_tidyhuman', to: 4 },

        { note: "wiki step 2: Bob, on the counter of Bob's Axes in Lumbridge" },
        { setpos: [3228, 3203, 0], why: 'south-east across Asgarnia and Misthalin to Lumbridge' },
        { talk: 'twocats_bob_bow_tie', want: 'list of what he needs', why: 'he hands over the chore list and a toy mouse' },
        { stage: 20 },
        { has: 'twocats_chores' },

        { note: 'wiki step 3 - the five chores. House: make the bed.' },
        { setpos: [2918, 3557, 0], why: 'back to the cottage' },
        { loc: 'twocats_bed', at: [2917, 3556], want: 'plump what is left of the pillow', why: 'make it' },
        { varis: 'twocats_chores_tidyhouse', to: 1 },

        { note: 'chore 2 - fire: logs in the grate, then the tinderbox. Neither child loc has an op,' },
        { note: 'so an item is the only way in.' },
        { useLoc: 'twocats_fireplace', at: [2919, 3557], obj: 'logs', want: 'stack the logs', why: 'the logs' },
        { useLoc: 'twocats_fireplace', at: [2919, 3557], obj: 'tinderbox', want: 'fire catches', why: 'and light it' },
        { varis: 'twocats_chores_warmhuman', to: 2 },

        { note: 'chore 3 - food: lay the table, milk, cake, and then TELL him. Laying a meal out is' },
        { note: 'not feeding anybody.' },
        { loc: 'twocats_table', at: [2920, 3556], want: 'lay the table', why: 'lay it' },
        { useLoc: 'twocats_table', at: [2920, 3556], obj: 'bucket_milk', want: 'glass of milk', why: 'the milk' },
        { useLoc: 'twocats_table', at: [2920, 3556], obj: 'chocolate_cake', want: 'chocolate cake down', why: 'and the cake' },
        { varis: 'twocats_chores_feedhuman', to: 4 },

        { note: 'chore 4 - hair: shears on the man, one snip at a time, counting down from wild to' },
        { note: 'bald. Four of them, and the chore only counts at bald.' },
        { useNpc: 'twocats_unferth', obj: 'shears', why: 'snip 1' },
        { useNpc: 'twocats_unferth', obj: 'shears', why: 'snip 2' },
        { useNpc: 'twocats_unferth', obj: 'shears', why: 'snip 3' },
        { useNpc: 'twocats_unferth', obj: 'shears', want: "That's all of it", why: 'snip 4' },
        { varis: 'twocats_chores_tidyhuman', to: 0 },

        { note: 'chore 5 - garden. The patch is a block of twelve blocking locs with a fence along' },
        { note: 'its south side, so it can only be reached from INSIDE the garden - through the gate.' },
        { loc: 'loc_1530', at: [2920, 3561], why: 'the garden gate', soft: true },
        { go: [2920, 3562], why: 'into the garden' },
        { useLoc: 'twocats_patch', at: PATCH, obj: 'rake', why: 'weeds 1' },
        { useLoc: 'twocats_patch', at: PATCH, obj: 'rake', why: 'weeds 2' },
        { useLoc: 'twocats_patch', at: PATCH, obj: 'rake', want: 'patch is clear', why: 'weeds 3' },
        { useLoc: 'twocats_patch', at: PATCH, obj: 'potato_seed', want: 'dib the seed potatoes', why: 'plant them' },
        { varis: 'twocats_chores_tidygarden', to: 4 },

        { note: 'and the meal, which only counts once he has eaten it - that is what finishes the five' },
        { talk: 'twocats_unferth', want: 'eats the lot', why: 'tell him there is food on the table' },
        { stage: 30 },

        { note: 'wiki step 4: Bob half-remembers being someone called Robert' },
        { setpos: [3228, 3203, 0], why: 'back to Lumbridge' },
        { talk: 'twocats_bob_bow_tie', want: 'panther called Odysseus', why: 'Robert, and a panther' },
        { stage: 40 },

        { note: 'wiki step 5: Reldo, who has Robert the Strong on a shelf' },
        { setpos: [3210, 3497, 0], why: 'north to the Varrock palace library' },
        { talk: 'reldo', want: 'Robert the Strong', why: 'the dragonkin and the curse - he jumps straight to it, no menu' },
        { varis: 'twocats_reldo', to: 1 },

        { note: 'wiki step 6: back to Bob with the name, and he sends you home' },
        { setpos: [3228, 3203, 0], why: 'back to Lumbridge again' },
        { talk: 'twocats_bob_bow_tie', want: 'Go back to the house', why: 'somebody can take the curse off him' },
        { stage: 60 },

        { note: 'wiki step 7: Neite is in the garden, and will not come for a cat with no name' },
        { setpos: [2925, 3563, 0], why: 'back to the cottage garden' },
        { talk: 'twocats_niete', tries: 3, why: 'she needs the name said out loud by the man who kept him' },

        { note: 'wiki step 7: Unferth says it' },
        { setpos: [2920, 3558, 0], why: 'inside' },
        { talk: 'twocats_unferth', want: 'Robert the Strong', why: 'and he says it' },
        { stage: 65 },

        { note: 'wiki step 8: Neite lifts the curse' },
        { setpos: [2925, 3563, 0], why: 'back out to the garden' },
        { talk: 'twocats_niete', tries: 3, why: 'the curse comes off' },
        { stage: 70 },

        { note: 'wiki step 8: and the reward' },
        { talk: 'twocats_niete', tries: 3, why: 'she pays' },
        { stage: 80 },
        { has: 'twocats_present' }
    ]
};

const p: any = H.makePlayer('twocatsrun', m.start[0], m.start[1]);
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
