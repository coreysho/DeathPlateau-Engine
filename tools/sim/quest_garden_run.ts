// GARDEN OF TRANQUILLITY, played through on foot.
//
// Quest 63 of the quest-by-quest pass. Queen Ellamaria wants a garden; King Roald has a kingdom, a
// treasury and no idea how to produce one. Nine beds in the palace garden, five gardeners spread
// across the map who each want a bucket of compost before they will part with seed, a diseased
// vinery in Burthorpe, and two statues that have to be stolen from Falador and Lumbridge on a
// trolley.
//
// The Ring of Charos half of the wiki's version is not here and cannot be: the ring is enchanted by
// the Wise Old Man, and neither he nor his Draynor spawn exists on this server (the same gap Swan
// Song ran into). The gardeners ask for compost instead of the grow-marigolds-for-me errands, which
// is the same shape without the twenty-minute timers.
//
//   NODE_MEMBERS=true npx tsx tools/sim/quest_garden_run.ts
import * as H from './harness.js';
import { play, Manifest, Step } from './questrun.js';

await H.boot();

const ROALD: [number, number, number] = [3222, 3476, 0];
const ELSTAN: [number, number, number] = [3053, 3308, 0];
const KRAGEN: [number, number, number] = [2668, 3374, 0];
const LYRA: [number, number, number] = [3601, 3527, 0];
const DANTAERA: [number, number, number] = [2808, 3464, 0];
const ALTHRIC: [number, number, number] = [3049, 3507, 0];
const BERNALD: [number, number, number] = [2918, 3534, 0];
const VINES: [number, number] = [2914, 3534];
const FAL_STATUE: [number, number] = [2965, 3381];
const LUM_STATUE: [number, number] = [3231, 3217];
const SAR_PLINTH: [number, number] = [3229, 3479];
const KING_PLINTH: [number, number] = [3233, 3487];

// Every bed: the patch loc, a tile to stand on, and whether it is a bed (raked three times) or one
// of the two orchid pots (a bucket of compost instead).
type Bed = { loc: string; at: [number, number]; stand: [number, number]; pot?: boolean; seeds: string; n: number; also?: [string, number] };
const BEDS: Bed[] = [
    { loc: 'garden_delphinium_patch', at: [3227, 3476], stand: [3228, 3476], seeds: 'garden_delphinium_seed', n: 4 },
    { loc: 'garden_rosebush_patch_white', at: [3232, 3472], stand: [3231, 3472], seeds: 'garden_rosebush_seed_white', n: 3 },
    { loc: 'garden_rosebush_patch_red', at: [3229, 3472], stand: [3228, 3472], seeds: 'garden_rosebush_seed_red', n: 3 },
    { loc: 'garden_rosebush_patch_pink', at: [3227, 3472], stand: [3228, 3472], seeds: 'garden_rosebush_seed_pink', n: 3 },
    { loc: 'garden_snowdrop_patch', at: [3232, 3481], stand: [3231, 3481], seeds: 'garden_snowdrop_seed', n: 4 },
    { loc: 'garden_vine_patch', at: [3227, 3484], stand: [3228, 3484], seeds: 'garden_vine_seed', n: 4 },
    { loc: 'garden_white_tree_patch', at: [3229, 3474], stand: [3228, 3474], seeds: 'garden_white_tree_shoot', n: 1 },
    { loc: 'garden_orchid_pink_patch', at: [3229, 3486], stand: [3230, 3486], pot: true, seeds: 'garden_orchid_pink_seed', n: 3 },
    { loc: 'garden_orchid_yellow_patch', at: [3231, 3486], stand: [3232, 3486], pot: true, seeds: 'garden_orchid_yellow_seed', n: 3 }
];

// A WATERING COSTS A DOSE AND THE CAN CHANGES ITS NAME. watering_can_8 becomes _7 becomes _6, so
// the ninth bed cannot be watered out of the same obj name as the first - two full cans cover the
// nine beds, eight doses out of the first and one out of the second.
const CANS = ['watering_can_8', 'watering_can_7', 'watering_can_6', 'watering_can_5', 'watering_can_4', 'watering_can_3', 'watering_can_2', 'watering_can_1'];

const bedSteps = (): Step[] => {
    const out: Step[] = [];
    let watered = 0;
    for (const b of BEDS) {
        out.push({ go: b.stand, exact: true, r: 40, why: 'to the ' + b.loc.replace('garden_', '').replace('_patch', '') + ' bed' });
        if (b.pot) {
            out.push({ useLoc: b.loc, at: b.at, obj: 'bucket_compost', want: 'fill the pot', why: 'compost in the pot' });
        } else {
            out.push({ useLoc: b.loc, at: b.at, obj: 'rake', want: 'rake the weeds out', why: 'first pass' });
            out.push({ useLoc: b.loc, at: b.at, obj: 'rake', why: 'second pass' });
            out.push({ useLoc: b.loc, at: b.at, obj: 'rake', want: 'wants sowing', why: 'and it is clear' });
        }
        out.push({ useLoc: b.loc, at: b.at, obj: b.seeds, want: 'sow the bed', why: b.n + ' x ' + b.seeds });
        out.push({ useLoc: b.loc, at: b.at, obj: CANS[watered++ % CANS.length], why: 'one watering takes it all the way up' });
    }
    return out;
};

const gardener = (who: string, at: [number, number, number], want: string): Step[] => [
    { setpos: at, why: 'to ' + who },
    { talk: who, want: 'ompost', why: 'what he wants first - a bucket of it' },
    { talk: who, want: 'came from me', why: 'the compost, and the seed' },
    { has: want }
];

const m: Manifest = {
    quest: 'GARDEN OF TRANQUILLITY',
    source: 'oldschool.runescape.wiki/w/Garden_of_Tranquillity',
    stageVar: 'garden_quest',
    done: 50,
    start: ROALD,
    steps: [
        { note: 'requirements: Farming 25, and Priest in Peril - not for the quest itself but' },
        { note: 'because King Roald only offers the garden once Priest in Peril is behind you. He is' },
        { note: 'the only person who offers that quest, and taking his conversation first is how new' },
        { note: 'players lost the way into Morytania; the hook guards against it.' },
        { setvar: 'priestperil', to: 60, why: '^priestperil_complete' },
        { give: 'rake' },
        { give: 'bucket_compost', n: 7 },
        { give: 'plant_cure' },
        { give: 'ring_of_charos' },
        { give: 'watering_can_8' },
        { give: 'watering_can_8' },

        { note: 'wiki step 1: the king, who has bought her four hats already' },
        { talk: 'king_roald', picks: ['I could do it.'], want: 'written out by somebody', why: 'he sets the quest' },
        { stage: 5 },
        { has: 'garden_list' },
        { held: 'garden_list', want: 'delphinium', why: 'the list names all nine' },

        { note: 'wiki step 2: the Wise Old Man unlocks the Ring of Charos. Seven questions and six' },
        { note: 'of them right, and the diplomatic answer is the conciliatory one every time. He was' },
        { note: 'placed nowhere at all until now, which is why this half of the quest did not exist.' },
        { setpos: [3089, 3251, 0], why: 'to Draynor' },
        { talk: 'wise_old_man', picks: ['Why not have a range?', 'Take it and thank him.', 'I love every minute of it.', 'Go on then.', 'PKMaster0036, obviously.', 'Could I ask you something in return?', 'No, but I will keep an eye out.'], want: 'ring is unlocked', why: 'all seven right' },
        { has: 'ring_of_charos_unlocked' },

        { note: 'wiki step 4: the five gardeners. Each wants a bucket of compost rather than the' },
        { note: "wiki's grow-this-for-me errand, which needs the twenty-minute farming clock." },
        ...gardener('elstan', ELSTAN, 'garden_delphinium_seed'),
        ...gardener('kragen', KRAGEN, 'garden_rosebush_seed_red'),
        ...gardener('lyra', LYRA, 'garden_snowdrop_seed'),
        ...gardener('dantaera', DANTAERA, 'garden_orchid_pink_seed'),
        ...gardener('brother_althric', ALTHRIC, 'garden_white_tree_shoot'),

        { note: "Bernald is the odd one out: his vinery is diseased and curing it is the favour" },
        { setpos: BERNALD, why: 'to the Toad and Chicken' },
        { go: [VINES[0], VINES[1] - 1], exact: true, r: 20, why: 'to the vines' },
        { useLoc: 'garden_burthorpe_vines', at: VINES, obj: 'plant_cure', want: 'work the cure into the roots', why: 'the cure' },
        { varis: 'garden_bernald_varbit', to: 4 },
        { go: [BERNALD[0], BERNALD[1]], exact: true, r: 20, why: 'back to Bernald' },
        { talk: 'bernald', want: 'vine', why: 'the vine seeds' },
        { has: 'garden_vine_seed', n: 4 },
        { stage: 10 },

        { note: 'wiki step 6: nine beds in the palace garden. Three rakes each, or a bucket of' },
        { note: 'compost for the two orchid pots, then the seed, then one watering - which takes a' },
        { note: 'bed through both of its growth models rather than skipping to the end.' },
        { setpos: [3228, 3478, 0], why: 'into the palace garden' },
        ...bedSteps(),
        { stage: 30 },

        { note: 'wiki step 5: the trolley, and two statues that do not belong to you' },
        { setpos: ROALD, why: 'back to the king' },
        { talk: 'king_roald', want: 'trolley', why: 'he produces one' },
        { has: 'garden_trolley_obj' },
        { setpos: [FAL_STATUE[0], FAL_STATUE[1] - 2, 0], why: 'to Falador square' },
        { useLoc: 'falador_statue_saradomin', at: FAL_STATUE, obj: 'garden_trolley_obj', want: 'lever the statue over', why: 'onto the trolley' },
        { setpos: [SAR_PLINTH[0] - 1, SAR_PLINTH[1], 0], why: 'back to the garden' },
        { useLoc: 'garden_saradomin_statue_multi', at: SAR_PLINTH, obj: 'garden_trolley_obj', want: 'plinth', why: 'onto the plinth' },
        { setpos: [LUM_STATUE[0], LUM_STATUE[1] - 2, 0], why: 'to Lumbridge' },
        { useLoc: 'garden_lumbridge_statue', at: LUM_STATUE, obj: 'garden_trolley_obj', want: 'lever the statue over', why: 'onto the trolley' },
        { setpos: [KING_PLINTH[0] - 1, KING_PLINTH[1], 0], why: 'back to the garden' },
        { useLoc: 'garden_king_statue_multi', at: KING_PLINTH, obj: 'garden_trolley_obj', want: 'plinth', why: 'onto the plinth' },
        { stage: 40 },

        { note: 'wiki step 7: the king, and then the queen' },
        { setpos: ROALD, why: 'to the king' },
        { talk: 'king_roald', want: 'garden', why: 'he comes to look at it' },
        { wait: 10, why: 'the tour' },
        { stage: 50 }
    ]
};

const p: any = H.makePlayer('gardrun', m.start[0], m.start[1]);
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
