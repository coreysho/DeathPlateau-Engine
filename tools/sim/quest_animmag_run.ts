// ANIMAL MAGNETISM, played through on foot.
//
// Quest 87 of the quest-by-quest pass. Ava cannot sleep on Draynor Manor's beds, wants two undead
// chickens' worth of feathers to fix one, and builds the first Ava's device out of what is left.
//
// The long middle of it is a married couple who cannot hear each other - Alice is alive, her husband
// Malcolm is not, and a ghostspeak amulet only works one way round - so the walk goes back and
// forth between them six times before the Old Crone makes the amulet that lets them talk. Every one
// of those exchanges is its own state in %animmag_farm and every one is driven here.
//
// Two randomised steps are pinned: the research notes pick one of five marks per line and want
// three lines in a row, and the undead trees fail one cut in three.
//
//   NODE_MEMBERS=true npx tsx tools/sim/quest_animmag_run.ts
import * as H from './harness.js';
import { play, Manifest } from './questrun.js';

await H.boot();

const AVA: [number, number, number] = [3093, 3358, 0];
const WITCH: [number, number, number] = [3091, 3366, 0];
const ALICE: [number, number, number] = [3627, 3526, 0];
const MALCOLM: [number, number, number] = [3615, 3529, 0];
const CRONE: [number, number, number] = [3460, 3557, 0];
const TURAEL: [number, number, number] = [2929, 3535, 0];
const TREE: [number, number, number] = [3098, 3348, 0];
const MINE: [number, number, number] = [2975, 3245, 0]; // inside ^animmag_mine_*

const m: Manifest = {
    quest: 'ANIMAL MAGNETISM',
    source: 'oldschool.runescape.wiki/w/Animal_Magnetism/Quick_guide',
    stageVar: 'animmag',
    done: 13, // ^animmag_complete
    start: AVA,
    steps: [
        { note: 'requirements: The Restless Ghost, Ernest the Chicken and Priest in Peril, and' },
        { note: '18 Slayer, 19 Crafting, 30 Ranged, 35 Woodcutting - none of them boostable.' },
        { setvar: 'prieststart', to: 5, why: '^priest_complete' },
        { setvar: 'haunted', to: 3, why: '^haunted_complete' },
        { setvar: 'priestperil', to: 60, why: '^priestperil_complete' },

        { note: 'items: a ghostspeak amulet, twenty ecto-tokens, five iron bars, a hammer, a' },
        { note: 'mithril axe, a holy symbol, hard leather and a pair of unpolished buttons.' },
        { give: 'amulet_of_ghostspeak' },
        { give: 'ectotoken', n: 20 },
        { give: 'iron_bar', n: 5 },
        { give: 'hammer' },
        { give: 'mithril_axe' },
        { give: 'blessedstar' },
        { give: 'hard_leather' },
        { give: 'digsitebuttons' },
        { held: 'amulet_of_ghostspeak', op: 2, why: 'wear the amulet - the dead will not talk without it' },
        { worn: 'amulet_of_ghostspeak' },

        { note: 'wiki step 1: Ava, in the west wing of Draynor Manor' },
        { setpos: AVA, why: 'to Ava' },
        {
            talk: 'animmag_ava',
            picks: ['I would be happy to make your home a better place.'],
            want: 'couple of undead chickens',
            why: 'take the job'
        },
        { stage: 1 },

        { note: 'wiki steps 2-3: the undead farm west of the Ectofuntus. Alice and Malcolm each' },
        { note: 'need the other’s last answer, six times over.' },
        { setpos: ALICE, why: 'to the farm, and Alice' },
        { talk: 'farming_shopkeeper_4', picks: ["I'm here about a quest."], want: 'useless, undead chickens', why: 'ask about the birds' },
        { varis: 'animmag_farm', to: 1 },
        { setpos: MALCOLM, why: 'to her husband in the cow pen' },
        { talk: 'ahoy_ghost_farmer', picks: ['What use are zombie animals?'], want: 'still loves her', why: 'he has a message for her' },
        { varis: 'animmag_farm', to: 2 },
        { setpos: ALICE, why: 'back to Alice' },
        { talk: 'farming_shopkeeper_4', picks: ["I'm here about a quest."], want: "can't find our savings", why: 'pass it on' },
        { varis: 'animmag_farm', to: 3 },
        { setpos: MALCOLM, why: 'back to Malcolm' },
        { talk: 'ahoy_ghost_farmer', want: 'putted the cash in the bank', why: 'and his answer' },
        { varis: 'animmag_farm', to: 4 },
        { setpos: ALICE, why: 'back to Alice' },
        { talk: 'farming_shopkeeper_4', picks: ["I'm here about a quest."], want: 'bank pass', why: 'she wants his pass' },
        { varis: 'animmag_farm', to: 5 },
        { setpos: MALCOLM, why: 'back to Malcolm' },
        { talk: 'ahoy_ghost_farmer', want: 'pass numbers', why: 'which he will not give' },
        { varis: 'animmag_farm', to: 6 },
        { setpos: ALICE, why: 'back to Alice' },
        { talk: 'farming_shopkeeper_4', picks: ["I'm here about a quest."], want: 'some witch near here', why: 'she names the crone' },
        { varis: 'animmag_farm', to: 7 },

        { note: 'wiki steps 4-5: the Old Crone, east of the Slayer Tower, mirrors the unused half' },
        { note: 'of the ghostspeak amulet and binds it with one of Alice’s hairs' },
        { setpos: CRONE, why: 'west to the Old Crone' },
        { talk: 'ahoy_crone', want: 'second amulet', why: 'she makes the amulet' },
        { varis: 'animmag_farm', to: 8 },
        { has: 'animmag_crone_amulet' },

        { note: 'wiki steps 6-7: the amulet to Malcolm, and the two of them can talk again' },
        { setpos: MALCOLM, why: 'back to Malcolm' },
        { talk: 'ahoy_ghost_farmer', want: 'Ta, mate', why: 'give him the amulet' },
        { varis: 'animmag_farm', to: 9 },
        { talk: 'ahoy_ghost_farmer', picks: ['Can I buy an undead chicken?'], want: 'undead bed to kip in', why: 'ten ecto-tokens' },
        { talk: 'ahoy_ghost_farmer', picks: ['Can I buy an undead chicken?'], want: 'undead bed to kip in', why: 'and ten more' },
        { has: 'animmag_undead_chicken', n: 2 },
        { hasnt: 'ectotoken' },

        { note: 'wiki step 8: both birds to Ava' },
        { setpos: AVA, why: 'back to Draynor Manor' },
        { talk: 'animmag_ava', want: 'Amazing! Success', why: 'hand them over' },
        { stage: 2 },

        { note: 'wiki steps 9-10: the Witch in the north-west corner wants five iron bars' },
        { setpos: WITCH, why: 'to the Witch next door' },
        { talk: 'animmag_witch', picks: ['Just tell me what you need.'], want: 'iron bars', why: 'she names her price' },
        { stage: 3 },
        { talk: 'animmag_witch', picks: ['Here are the bars.'], want: 'north-east of Rimmington', why: 'hand the bars over' },
        { stage: 4 },
        { has: 'animmag_selected_iron' },
        { hasnt: 'iron_bar' },

        { note: 'wiki step 11: the iron mine north-east of Rimmington, and a hammer. The engine' },
        { note: 'has no way to read which way a player is facing, so the place is what is checked' },
        { note: 'and the blow itself turns you north.' },
        { setpos: MINE, why: 'to the Rimmington mine' },
        { use: ['hammer', 'animmag_selected_iron'], want: 'create a magnet', why: 'hammer the bar' },
        { stage: 5 },
        { has: 'animmag_bar_magnet' },

        { note: 'wiki step 12: the magnet to Ava' },
        { setpos: AVA, why: 'back to Ava' },
        { talk: 'animmag_ava', want: 'Great stuff', why: 'hand over the magnet' },
        { stage: 6 },

        { note: 'wiki steps 13-14: the undead trees in the garden, which an ordinary axe bounces' },
        { note: 'off - and that is the step Ava wants reported' },
        { setpos: TREE, why: 'out into the manor grounds' },
        { talk: 'animmag_undead_tree', want: 'bounces off the undead wood', why: 'try the mithril axe' },
        { stage: 7 },
        { setpos: AVA, why: 'back to Ava' },
        { talk: 'animmag_ava', want: 'Slayer Master near Burthorpe', why: 'she names Turael' },
        { stage: 8 },

        { note: 'wiki steps 15-16: Turael swaps his blessed axe for a mithril axe and a holy' },
        { note: 'symbol. His line is only on the Slayer menu while this quest wants it.' },
        { setpos: TURAEL, why: 'to Burthorpe' },
        { note: 'which of his two conversations you get depends on whether you are carrying the' },
        { note: 'price: without it he explains what he wants, with it he offers the swap outright.' },
        { note: 'This run arrives with both, so it is the offer.' },
        {
            talk: 'slayer_master_1',
            picks: ["I'm here about those trees near Draynor Manor.", "I'd love one, thanks."],
            want: 'may it serve you well',
            why: 'trade the axe and the symbol for his'
        },
        { stage: 9 },
        { has: 'animmag_blessed_axe' },
        { hasnt: 'mithril_axe' },
        { hasnt: 'blessedstar' },

        { note: 'wiki step 17: the trees again, with the right axe. One cut in three fails, so the' },
        { note: 'rng is pinned off zero for this one step.' },
        { setpos: TREE, why: 'back to the manor grounds' },
        { rng: 0.5, why: 'random(3) is not 0, so the twig comes away' },
        { talk: 'animmag_undead_tree', want: 'cut some undead twigs', why: 'cut the undead wood' },
        { rng: null },
        { has: 'animmag_undead_twigs' },

        { note: 'wiki steps 18-19: the twigs to Ava, then ask her for the research notes' },
        { setpos: AVA, why: 'back to Ava' },
        { talk: 'animmag_ava', want: 'research notes', why: 'hand over the twigs' },
        { stage: 10 },
        { talk: 'animmag_ava', want: 'Here are the notes', why: 'ask for a copy' },
        { has: 'animmag_research_notes' },

        { note: 'wiki step 20: the notes. Three lines, each a row of five marks with a note in the' },
        { note: 'margin saying which one she meant; get one wrong and the line starts again. With' },
        { note: 'the rng pinned the answer is the first mark all three times.' },
        { rng: 0, why: 'random(5) is 0, so the circle is the mark' },
        {
            held: 'animmag_research_notes',
            op: 1,
            picks: ['A circle.', 'A circle.', 'A circle.'],
            want: 'suddenly all makes sense',
            why: 'translate the notes'
        },
        { rng: null },
        { stage: 11 },
        { has: 'animmag_translated_notes' },

        { note: 'wiki steps 21-22: the translation back to Ava for the pattern, then the container' },
        { talk: 'animmag_ava', want: 'pattern for the container', why: 'she hands over the pattern' },
        { stage: 12 },
        { has: 'animmag_pattern' },
        { note: 'polishing the buttons is its own Crafting action, and it had no source at all' },
        { note: 'before this build - the container has always wanted polished buttons and nothing' },
        { note: 'in the game made any.' },
        { held: 'digsitebuttons', op: 1, want: 'more shiny', why: 'polish the buttons' },
        { has: 'polished_buttons' },
        { use: ['polished_buttons', 'animmag_pattern'], want: 'stitch the leather', why: 'make the container' },
        { has: 'animmag_container' },

        { note: 'wiki step 23: the container to Ava' },
        { talk: 'animmag_ava', want: 'arrow manufacturer is ready', why: 'hand it over' },
        { stage: 13 },
        { note: 'Ranged 50 or over is the accumulator rather than the attractor, and the run is' },
        { note: 'maxed, so it is the accumulator.' },
        { has: 'avas_accumulator' }
    ]
};

const p: any = H.makePlayer('animmag', m.start[0], m.start[1]);
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
