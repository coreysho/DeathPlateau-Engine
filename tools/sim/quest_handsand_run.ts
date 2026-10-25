// THE HAND IN THE SAND, played through on foot.
//
// Quest 69 of the quest-by-quest pass. Bert dug a hand out of his own sand pit and cannot remember
// the night it came from, because his employer has been dosing the night shift's coffee for years.
//
// The quest was built with the right shape and the wrong sources: the serum came out of Rarve's
// pocket rather than out of Betty's doorway, the rose lens went into the scrying orb rather than
// into the light, the dead wizard was called Coop, the rest of him was buried in the Yanille pit
// rather than shipped to Entrana with the week's sacks, the handful of sand out of Sandy's pocket
// had no use at all, there was no sand pit to refill, and the Thieving reward was nine times what
// the scroll says.
//
//   NODE_MEMBERS=true npx tsx tools/sim/quest_handsand_run.ts
import * as H from './harness.js';
import { play, Manifest } from './questrun.js';

await H.boot();

const BERT: [number, number, number] = [2550, 3101, 0];
const CAPTAIN: [number, number, number] = [2551, 3079, 0];
const RARVE: [number, number, number] = [2591, 3089, 0];
const SANDY: [number, number, number] = [2787, 3177, 0];
const DESK: [number, number] = [2788, 3174];
const MUG: [number, number] = [2789, 3176];
const BETTY: [number, number, number] = [3011, 3258, 0];
const COUNTER: [number, number] = [3013, 3258];
const SANDPIT: [number, number] = [2542, 3103];
const MAZION: [number, number, number] = [2817, 3345, 0];

const m: Manifest = {
    quest: 'THE HAND IN THE SAND',
    source: 'oldschool.runescape.wiki/w/The_Hand_in_the_Sand',
    stageVar: 'handsand_quest',
    done: 80,
    start: BERT,
    steps: [
        { note: 'requirements: Thieving 17 for Sandy\'s pocket and Crafting 49 for the lantern lens.' },
        { note: 'Items: a beer, redberries, white berries, a lantern lens, two empty vials, five' },
        { note: 'earth runes, a bucket and about 150 coins.' },
        { setpos: BERT, why: "Bert's house by the Yanille sand pit" },

        { note: 'wiki step 1: Bert has a hand in his house and no memory of the night it came from' },
        { talk: 'handsand_bert', picks: ['What is it?'], want: 'packed solid with sand', why: 'he hands it over' },
        { stage: 10 },
        { has: 'handsand_sandyhand' },
        { has: 'handsand_rota_bert' },

        { note: 'wiki step 1: the Guard Captain is drunk and puts his tankard on it' },
        { give: 'beer' },
        { setpos: CAPTAIN, why: 'down the road to the Guard Captain' },
        { talk: 'handsand_guard_captain', want: 'Could be a glove', why: 'no use at all' },
        { stage: 20 },
        { has: 'handsand_beerhand' },
        { setpos: BERT, why: 'back to Bert' },
        { talk: 'handsand_bert', want: 'Zavistic Rarve', why: 'who to try next' },
        { stage: 30 },

        { note: 'wiki step 1: Rarve has a wizard six weeks overdue off sabbatical' },
        { setpos: RARVE, why: "to the Wizards' Guild" },
        { talk: 'zogre_human_zavistic_rarve', want: 'both of them in writing', why: 'he wants the lie on paper' },

        { note: 'wiki step 2: Sandy keeps the original rota in his office, and will only look away' },
        { note: 'once per distraction - so the desk and the mug are two separate trips to the window' },
        { setpos: SANDY, why: "to Sandy's office in Brimhaven" },
        { talk: 'handsand_sandy', picks: ["There's someone outside taking your sand."], want: 'at the window', why: 'get him off the desk' },
        { varis: 'handsand_sandy_multi', to: 1 },
        { loc: 'handsand_desk', at: DESK, want: 'not the hours on Bert', why: 'search the towers' },
        { has: 'handsand_rota_sandy' },
        { stage: 40 },
        { note: 'wiki step 2: and a handful of what is in his pockets, which the serum needs' },
        { note: 'the pocket is a stat_random roll, so the run pins the engine nextDouble rather' },
        { note: 'than asserting a dice throw - the sim re-rolls the same value otherwise' },
        { rng: 0, why: 'make the pocket land' },
        { talk: 'handsand_sandy', op: 3, tries: 4, until: 'handsand_sand', why: 'pick his pocket' },
        { rng: null },
        { has: 'handsand_sand' },

        { note: 'wiki step 3: the two rotas go back to Bert, who has been holding the charm that' },
        { note: 'took his memory off him for a year without knowing what it was' },
        { setpos: BERT, why: 'back to Bert' },
        { talk: 'handsand_bert', want: 'never wrote it', why: 'he trades them for the scroll' },
        { has: 'handsand_scroll_magic' },
        { hasnt: 'handsand_rota_bert' },
        { setpos: RARVE, why: 'and the scroll to Rarve' },
        { talk: 'zogre_human_zavistic_rarve', want: 'mind-altering charm', why: 'he gives up the orb' },
        { stage: 50 },
        { has: 'handsand_orb_storage' },

        { note: 'wiki step 3: Betty. Bottled water for an empty vial, then redberries, then white' },
        { note: 'berries, then a lantern lens dipped in the dye.' },
        { give: 'vial_empty', n: 2 },
        { give: 'redberries' },
        { give: 'white_berries' },
        { give: 'bullseye_lantern_lens' },
        { setpos: BETTY, why: 'to the magic shop in Port Sarim' },
        { talk: 'betty', want: 'gives you a bottle of water', why: 'she takes an empty vial for it' },
        { has: 'handsand_bottle_water' },
        { use: ['redberries', 'handsand_bottle_water'], want: 'crush the redberries', why: 'juice' },
        { use: ['white_berries', 'handsand_redberry_juice'], want: 'flat pink', why: 'dye' },
        { use: ['handsand_pink_dye', 'bullseye_lantern_lens'], want: 'pinkish tinge', why: 'the lens' },
        { has: 'handsand_rose_lens' },

        { note: 'wiki step 3: the counter multiloc\'s other state is a counter "with a vial standing' },
        { note: 'on it", which is how this works - the lens goes between her propped door and the vial' },
        { talk: 'betty', want: 'daylight through the lens', why: 'she stands one out' },
        { varis: 'handsand_counter_multi', to: 1 },
        { note: 'and the counter is approached from the WEST or the south - 3013,3259, the tile' },
        { note: 'between it and where Betty leaves you standing, is furniture, so the use sent from' },
        { note: 'there never gets adjacent and the step reports the player stuck' },
        { go: [COUNTER[0] - 1, COUNTER[1]], r: 32, why: 'round to the west end of the counter' },
        { useLoc: 'handsand_counter_multiloc', at: COUNTER, obj: 'handsand_rose_lens', want: 'cracks across', why: 'focus it' },
        { has: 'handsand_truthserum' },
        { hasnt: 'handsand_rose_lens' },
        { stage: 60 },

        { note: 'wiki step 4: distract him again, dose the mug, and ask all three questions' },
        { setpos: SANDY, why: 'back to Brimhaven' },
        { talk: 'handsand_sandy', picks: ["There's someone outside taking your sand."], want: 'at the window', why: 'the second trip' },
        { useLoc: 'handsand_coffee_multiloc', at: MUG, obj: 'handsand_truthserum', want: 'tip the vial into the coffee', why: 'dose it' },
        { varis: 'handsand_coffee_multi', to: 1 },
        { talk: 'handsand_sandy', picks: ['Who else worked the night shift with Bert?'], want: 'One of Rarve', why: 'question one' },
        { talk: 'handsand_sandy', picks: ['What happened to him?'], want: 'He is in the pit', why: 'question two' },
        { talk: 'handsand_sandy', picks: ['Why did you change the rota?'], why: 'question three' },
        { stage: 70 },
        { has: 'handsand_orb_recording' },

        { note: 'wiki step 5: Rarve plays it, and then does something for Bert that nobody asked' },
        { note: 'him to - five earth runes and a bucket of the sand itself' },
        { setpos: RARVE, why: 'to Rarve with the orb' },
        { talk: 'zogre_human_zavistic_rarve', want: 'working practice', why: 'he hears it' },
        { give: 'earthrune', n: 5 },
        { give: 'bucket_empty' },
        { setpos: [SANDPIT[0] + 1, SANDPIT[1], 0], why: 'to the pit for a bucket of sand' },
        { useLoc: 'handsand_sandpit_anim', at: SANDPIT, obj: 'bucket_empty', want: 'bucket of sand', why: 'fill it' },
        { has: 'bucket_sand' },
        { setpos: RARVE, why: 'back to Rarve' },
        { talk: 'zogre_human_zavistic_rarve', want: 'full to the brim', why: 'he fills the pit' },
        { stage: 75 },

        { note: 'wiki step 5: everything out of that pit that week went to the Entrana furnaces' },
        { setpos: MAZION, why: 'to the sand heap on Entrana' },
        { talk: 'handsand_naziom', want: 'behind the furnace', why: 'Mazion has the rest of him' },
        { has: 'handsand_wizhead' },
        { setpos: RARVE, why: 'and back to Rarve with it' },
        { talk: 'zogre_human_zavistic_rarve', want: 'That is Clarence', why: 'a name at last' },
        { stage: 80 },
        { setpos: BERT, why: 'and tell Bert' },
        { talk: 'handsand_bert', want: 'Eighty-four buckets', why: 'he remembers them all now' }
    ]
};

const p: any = H.makePlayer('hsrun', m.start[0], m.start[1]);
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
