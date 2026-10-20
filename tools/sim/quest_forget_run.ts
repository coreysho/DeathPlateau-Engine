// FORGETTABLE TALE OF A DRUNKEN DWARF, played through on foot.
//
// Quest 49 of the quest-by-quest pass. A man in the Laughing Miner has been telling the same story
// for two years - a Red Axe director in a boarded-up tunnel, talking to something that was not a
// dwarf - and the Black Guard's supreme leader cannot be seen investigating a man who cannot stand
// up. The only person in Keldagrim who notices anything is the gardener, and he has been trying to
// post a letter out of the city for two years.
//
//   npx tsx tools/sim/quest_forget_run.ts
import * as H from './harness.js';
import { play, Manifest } from './questrun.js';

await H.boot();

// His office is a sixteen-tile pocket behind a desk, so there is exactly one side to stand on.
const VELDABAN: [number, number, number] = [2827, 10214, 1];
const RIND: [number, number, number] = [2858, 10192, 0];
const ELSTAN: [number, number, number] = [3053, 3305, 0];
const BOARDS: [number, number] = [2926, 10158];
// The Red Axe's own tunnels are m29_77, which is nowhere near Keldagrim: the boards are the only
// way in and the cart is the only way about.
const TRAIN: [number, number] = [1864, 4957];
const CRATE1: [number, number] = [1906, 4965];
const CRATE2: [number, number] = [1910, 4966];
const CRATE3: [number, number] = [1903, 4970];
const MOUTH_BASE: [number, number] = [1914, 4965];
const MOUTH_A: [number, number] = [1889, 4982];
const MOUTH_B: [number, number] = [1867, 4983];

const m: Manifest = {
    quest: 'FORGETTABLE TALE OF A DRUNKEN DWARF',
    source: 'oldschool.runescape.wiki/w/Forgettable_Tale...',
    stageVar: 'forget_quest',
    done: 70,   // ^forget_complete
    start: [2828, 10205, 1],
    steps: [
        { note: 'requirements: The Giant Dwarf, which was checked, and Fishing Contest, which was' },
        { note: 'not - it is what gets a human through the White Wolf Mountain pass, and it is on the' },
        { note: 'requirement list for that reason.' },
        { setvar: 'giantdwarf_quest', to: 60, why: '^gd_complete' },
        { setvar: 'fishingcompo', to: 5, why: '^fishingcompo_complete' },
        { give: 'beer' },
        { give: 'hammer' },

        { note: 'his office is on the first floor, and a start coord on another plane does not stick' },
        { note: 'through makePlayer - so the first thing this run does is put itself there again' },
        { setpos: VELDABAN, why: 'into the Black Guard HQ, upstairs' },

        { note: 'wiki step 1: Commander Veldaban, in the Black Guard HQ west of the Keldagrim bank.' },
        { note: 'The Giant Dwarf owns his trigger, so this quest hooks in ahead of it.' },
        { talk: 'dwarf_city_black_guard_supreme_leader', want: 'Buy me a drink', why: 'he will not discuss it sober' },
        { note: 'and the drink. He takes a beer or a dwarven stout.' },
        { talk: 'dwarf_city_black_guard_supreme_leader', want: 'Rind', why: 'the beer, and where to start' },
        { stage: 10 },
        { hasnt: 'beer' },

        { note: 'the drunk himself, who has been right for two years' },
        { note: 'inside the pub: 2910,10222 is the street, and the street is a different pocket' },
        { setpos: [2912, 10222, 0], why: 'east across the river and into the Laughing Miner' },
        { note: 'past the start he gives the short version - the full telling is what Veldaban has' },
        { note: 'been cutting off in that pub for two years' },
        { talk: 'dwarf_city_drunken_dwarf_multi', want: 'not going back down it', why: 'the story' },

        { note: 'wiki step 3: Rind the gardener, by the stone bench, and the letter nobody in' },
        { note: 'Keldagrim has ever carried out of the city' },
        { setpos: RIND, why: 'west to the hops patch' },
        { talk: 'dwarf_city_gardener_dwarf', want: 'Elstan', why: 'the letter' },
        { has: 'forget_gardener_letter' },

        { note: 'wiki step 3 (optional in the walkthrough, and the only way to the seeds here):' },
        { note: 'Elstan at the Falador allotment, who has been waiting two years to be written to' },
        { setpos: ELSTAN, why: 'up out of the city to Falador' },
        { talk: 'elstan', want: 'Nine letters', why: 'four packets of seed' },
        { hasnt: 'forget_gardener_letter' },

        { note: 'and back to Rind with them, which is what moves the quest on' },
        { setpos: RIND, why: 'back down to Keldagrim' },
        { talk: 'dwarf_city_gardener_dwarf', want: 'not rusty', why: 'the seeds, and the rails' },
        { stage: 20 },

        { note: 'wiki step 5: the boarded-up tunnel. It is a wall decoration on solid rock, so the' },
        { note: 'hammer goes on it from the tile in front rather than by walking to it.' },
        { setpos: [2925, 10158, 0], why: 'east to the boarding' },
        { useLoc: 'keldagrim_boardedupdoor_multi', at: BOARDS, obj: 'hammer', want: 'not rusted', why: 'prise the boards off' },
        { stage: 30 },

        { note: 'wiki step 5b: the cart, which starts moving before you have sat down' },
        { loc: 'forget_train_cart', at: TRAIN, want: 'not built by the Black Guard', why: 'ride it' },

        { note: 'wiki step 6, room 4: the archive. Three crates, and between them eleven years of a' },
        { note: 'company mining where the city voted it could not.' },
        { setpos: [1906, 4964, 2], why: 'to the first crate' },
        { loc: 'forget_metal_crate_withpapers1', at: CRATE1, want: 'Eleven years of orders', why: 'the orders' },
        { loc: 'forget_metal_crate_withpapers2', at: CRATE2, want: 'inventory', why: 'the inventory' },
        { loc: 'forget_metal_crate_withpapers3', at: CRATE3, want: 'names, and then dates', why: 'the names' },
        { stage: 40 },

        { note: 'wiki step 6, rooms 2 and 6: the chambers. Twelve panels on the walls, read by' },
        { note: 'walking from one cave mouth to the next, and the twelfth one is blank.' },
        { loc: 'forget_story_exit_next', at: MOUTH_BASE, why: 'into the first chamber, and the first panel' },
        { loc: 'forget_story_exit_next', at: MOUTH_A, why: 'panel 2' },
        { loc: 'forget_story_exit_prev', at: MOUTH_B, why: 'panel 3' },
        { loc: 'forget_story_exit_next', at: MOUTH_A, why: 'panel 4' },
        { loc: 'forget_story_exit_prev', at: MOUTH_B, why: 'panel 5' },
        { loc: 'forget_story_exit_next', at: MOUTH_A, why: 'panel 6' },
        { loc: 'forget_story_exit_prev', at: MOUTH_B, why: 'panel 7' },
        { loc: 'forget_story_exit_next', at: MOUTH_A, why: 'panel 8' },
        { loc: 'forget_story_exit_prev', at: MOUTH_B, why: 'panel 9' },
        { loc: 'forget_story_exit_next', at: MOUTH_A, why: 'panel 10' },
        { loc: 'forget_story_exit_prev', at: MOUTH_B, why: 'panel 11' },
        { loc: 'forget_story_exit_next', at: MOUTH_A, why: 'panel 12' },
        { stage: 50 },

        { note: 'wiki step 7: back to Veldaban, who has been drinking in the same room as that man' },
        { note: 'for two years and has never once let him finish' },
        { setpos: VELDABAN, why: 'back up to the Black Guard HQ' },
        { talk: 'dwarf_city_black_guard_supreme_leader', want: 'never once let him finish', why: 'the report' },
        { stage: 70 },
        { has: 'mature_dwarven_stout', n: 2 }
    ]
};

const p: any = H.makePlayer('forgetrun', m.start[0], m.start[1]);
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
