// MAKING HISTORY, played through on foot.
//
// Quest 55 of the quest-by-quest pass. A historian with a timeline that has four dates on it and
// nothing in between them, and three threads: a silver merchant whose family have been handed a
// key for four hundred years, two brothers in Rellekka one of whom asks fourteen questions, and a
// ghost who will not trade until somebody fixes his marriage.
//
// The first build of this quest had the four documents the wrong way round - the cache's own
// descriptions settle it - and the whole King Lathas chapter was missing.
//
//   NODE_MEMBERS=true npx tsx tools/sim/quest_makinghistory_run.ts
import * as H from './harness.js';
import { play, Manifest } from './questrun.js';

await H.boot();

const JORRAL: [number, number, number] = [2435, 3349, 0];
const ERIN: [number, number, number] = [2658, 3317, 0];
const DIG_CHEST: [number, number, number] = [2460, 3115, 0];
const BLANIN: [number, number, number] = [2676, 3672, 0];
const DRON: [number, number, number] = [2661, 3701, 0];
const DROALAK: [number, number, number] = [3653, 3471, 0];
const MELINA: [number, number, number] = [3671, 3480, 0];
const LATHAS: [number, number, number] = [2577, 3293, 1];
const DIG_TRADER: [number, number, number] = [2435, 3337, 0];

const m: Manifest = {
    quest: 'MAKING HISTORY',
    source: 'oldschool.runescape.wiki/w/Making_History',
    stageVar: 'makinghistory_prog',
    done: 4,   // ^mh_complete
    start: [2435, 3349, 0],
    steps: [
        { note: 'requirements: Priest in Peril, for the Salve, and The Restless Ghost, for the' },
        { note: 'amulet. Neither was being checked.' },
        { setvar: 'priestperil', to: 60, why: '^priestperil_complete' },
        { setvar: 'prieststart', to: 5, why: '^priest_complete' },
        { give: 'spade' },
        { give: 'amulet_of_ghostspeak' },
        { held: 'amulet_of_ghostspeak', op: 2, why: 'neither ghost can be heard without it' },
        { worn: 'amulet_of_ghostspeak' },

        { note: 'wiki step 1: Jorral, in the outpost on the road north of Ardougne. Its own front' },
        { note: 'doors had no handler, so he was shut inside a building nobody could enter.' },
        { talk: 'makinghistory_jorral', picks: ['What is this place?', "I'll find them."], want: 'amulet of ghostspeak', why: 'he sets the quest' },
        { stage: 1 },

        { note: 'wiki step 2: Erin, the silver stall in the Ardougne market. The Equal Trade Market' },
        { note: 'came out of the outpost, and her family have been handed the key and told it is' },
        { note: 'important for four hundred years.' },
        { setpos: ERIN, why: 'south to the Ardougne market' },
        { talk: 'silver_merchant', want: 'Take a spade', why: 'borrow the key' },
        { has: 'makinghistory_key' },

        { note: 'and the key is a hot-and-cold hunt, which was one line of placeholder saying "The' },
        { note: 'key is warm." wherever you stood' },
        { held: 'makinghistory_key', want: 'The key is cold', why: 'feel it in Ardougne - two hundred tiles off' },
        { setpos: DIG_CHEST, why: 'north of the Castle Wars bridges' },
        { held: 'makinghistory_key', want: 'too hot to hold', why: 'feel it here' },
        { held: 'spade', want: 'dirty chest', why: 'dig' },
        { has: 'makinghistory_chest' },
        { use: ['makinghistory_key', 'makinghistory_chest'], want: 'Bennath', why: 'the key turns' },
        { has: 'makinghistory_journal' },

        { note: 'wiki step 4: Blanin, who knows the story is in the family and not in him' },
        { setpos: BLANIN, why: 'to Rellekka' },
        { talk: 'makinghistory_blanin', want: 'Dron', why: 'who to ask' },

        { note: 'and Dron, who says no first, because what he does after the no is the test' },
        { setpos: DRON, why: 'north to the dock' },
        { talk: 'makinghistory_dron', want: 'Ask me again', why: 'the no' },

        { note: 'fourteen questions, and one wrong answer ends the conversation. The answers are the' },
        { note: 'walkthrough’s own sequence: 3, 2, 2, 1, 2, 1, 2, 2, 1, 3, 3, 1, 1, 1.' },
        { talk: 'makinghistory_dron', picks: [3, 2, 2, 1, 2, 1, 2, 2, 1, 3, 3, 1, 1, 1], want: 'Nobody has ever got past six', why: 'the quiz' },

        { note: 'wiki step 3: Droalak, who has one thing left to trade with' },
        { setpos: DROALAK, why: 'to Port Phasmatys' },
        { talk: 'makinghistory_droalak_multi', want: 'Melina', why: 'what he wants' },
        { setpos: MELINA, why: 'east to Melina' },
        { talk: 'makinghistory_melina_multi', want: 'aware of the distance', why: 'she refuses' },
        { setpos: DROALAK, why: 'back to Droalak' },
        { talk: 'makinghistory_droalak_multi', want: 'garden', why: 'something only he could know' },
        { setpos: MELINA, why: 'back to Melina' },
        { talk: 'makinghistory_melina_multi', want: 'wanted him to not go', why: 'tell her' },

        { note: 'and the amulet he offered her the morning he left and never brought back. The' },
        { note: 'walkthrough is specific that it has to be a strung one.' },
        { give: 'strung_sapphire_amulet' },
        { useNpc: 'makinghistory_melina_multi', obj: 'strung_sapphire_amulet', want: 'remembered what it was', why: 'give it to her' },
        { talk: 'makinghistory_melina_multi', want: 'Tell him I will speak to him', why: 'she relents' },
        { setpos: DROALAK, why: 'back down the road he has not walked in two hundred years' },
        { talk: 'makinghistory_droalak_multi', want: 'timeline', why: 'the scroll' },
        { has: 'makinghistory_scroll1' },

        { note: 'wiki step 5: Jorral takes all three, and then has a problem - the outpost has been' },
        { note: 'marked for demolition for six years' },
        { setpos: JORRAL, why: 'back up the north road' },
        { talk: 'makinghistory_jorral', want: 'marked for demolition', why: 'report everything' },
        { stage: 2 },
        { has: 'makinghistory_letter1' },

        { note: 'and King Lathas, who has never replied to him and is upstairs in the castle' },
        { setpos: LATHAS, why: 'to the castle in Ardougne' },
        { talk: 'kinglathas', want: 'road can go round', why: 'deliver the letter' },
        { stage: 3 },
        { has: 'makinghistory_letter2' },
        { hasnt: 'makinghistory_letter1' },

        { setpos: JORRAL, why: 'back to the outpost' },
        { note: 'what he says about six years is a delayed mesbox this step does not capture, so' },
        { note: 'what proves the reply landed is the stage and the 750 coins' },
        { talk: 'makinghistory_jorral', want: 'He what', why: 'the reply' },
        { wait: 4, why: 'the completion is queued' },
        { stage: 4 },
        { has: 'coins', n: 750 },

        { note: 'and the key is still warm, because there are three graves nobody marked. This is' },
        { note: 'what the three mjolnirs in the cache are for and the only thing they can be for -' },
        { note: 'and Erin said to keep it, so Jorral only has to point it somewhere.' },
        { talk: 'makinghistory_jorral', want: 'warmer nearer', why: 'he points the key at the graves' },
        { has: 'makinghistory_key' },
        { setpos: DIG_TRADER, why: 'down into the woods below the outpost' },
        { held: 'makinghistory_key', want: 'too hot to hold', why: 'feel it' },
        { held: 'spade', want: 'Guthix mjolnir', why: 'dig' },
        { has: 'makinghistory_guthix_polestaff' },

        { note: 'the storeroom is a museum now - five multilocs on one bit, all of them crates at 0' },
        { note: 'and an exhibit at 1, and none of them had a handler for their own Study op' },
        { varis: 'makinghistory_objloc', to: 1 }
    ]
};

const p: any = H.makePlayer('mhrun', m.start[0], m.start[1]);
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
