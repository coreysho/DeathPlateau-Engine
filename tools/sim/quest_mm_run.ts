// MONKEY MADNESS, played through on foot. Nothing here teleports except the quest's own transport -
// Daero's blindfolded walk down to the hangar, Waydar's glider, Lumdo's boat and Kruk - which is the
// quest working rather than the runner cheating.
//
// Each `note` says which step of the real quest the stretch below it stands in for. Where the real
// quest has a step and this server does not, the note says so and there are no steps under it: the
// Karamja shipyard leg, the hangar's sliding puzzle and the whole jail sequence are all missing, and
// a run cannot walk through what was never built.
//
// The player is maxed before the run. Monkey Madness has no skill requirements - it gates on combat
// ability - and the tunnel to Zooknock is full of level 98 monkey zombies and level 142 skeletons,
// so an unarmed level 3 would be measuring how fast it dies rather than whether the quest works.
//
//   npx tsx tools/sim/quest_mm_run.ts
import * as H from './harness.js';
import { play, Manifest, Step } from './questrun.js';

// The gate reads which side you are standing on and puts you through, so one pair of steps serves
// both directions. Ape Atoll's level 0 is two walkable regions - the beach and the tunnel mouth in
// one, Garkor and the temple in the other - and this is the only join between them, so every leg of
// stage two and three crosses it.
const marimGate = (from: [number, number]): Step[] => [
    { go: from, r: 250, why: 'the Marim gate' },
    { loc: 'mm_bamboo_largedoor', at: [2719, 2766], why: 'slip through' }
];

await H.boot();

const m: Manifest = {
    quest: 'MONKEY MADNESS',
    source: 'oldschool.runescape.wiki/w/Monkey_Madness_I/Quick_guide (2004 quest)',
    stageVar: 'mm_main',
    done: 20,
    start: [2465, 3498, 0],
    steps: [
        { give: 'gold_bar' },
        { give: 'ball_of_wool' },
        { give: 'mm_normal_monkey_bones' },
        { setvar: 'grandtree', to: 160, why: 'The Grand Tree, a real requirement, complete' },

        { note: 'real step 1: King Narnode at the Grand Tree' },
        { go: [2465, 3497], why: 'the King' },
        { talk: 'grandtree_narnode' },
        { stage: 1 },
        { has: 'mm_gnome_royal_seal' },
        { has: 'mm_narnode_orders' },

        { note: 'real steps 2-6 (glider to Gandius, monkey bones, the shipyard gate, G.L.O. Caranock, back to Narnode) ARE NOT BUILT' },

        { note: 'real step 7: Daero in the Blurberry bar, through every chat option' },
        { go: [2466, 3494], why: 'the ladder up the Grand Tree' },
        { loc: 'ladder', at: [2466, 3495], why: 'climb up to the bar' },
        { level: 1 },
        { go: [2482, 3490], r: 64, why: 'the bar' },
        { talk: 'mm_daero', picks: [1, 2, 3, 1], why: 'all three questions, then the trip down' },
        { stage: 3 },

        { note: 'real step 8: Daero in the hangar. Real step 9 (the sliding puzzle, or 200,000 to Glough) IS NOT BUILT' },
        { go: [2586, 4516], r: 64, why: 'Daero, in the hangar' },
        { talk: 'mm_daero' },

        { note: 'real step 10: Waydar, and the glider to Crash Island' },
        { go: [2585, 4518], why: 'Waydar' },
        { talk: 'mm_waydar', picks: [1] },
        { stage: 4 },

        { note: 'real steps 11-12: Lumdo. The real quest needs Waydar talked to TWICE to convince him' },
        { go: [2892, 2724], r: 64, why: 'Lumdo, on the Crash Island beach' },
        { talk: 'mm_lumdo', picks: [1] },
        { stage: 5 },

        { note: 'real steps 13-14 (shot by the gate, arrested, pick the cell lock, escape) ARE NOT BUILT' },

        { note: 'the Marim gate. Ape Atoll is TWO disconnected walkable regions and this gate is the only join' },
        ...marimGate([2720, 2764]),

        { note: 'real step 15: Garkor. Real steps 16-20 (the dentures and the mould from the crates in the U-shaped building) ARE NOT BUILT - he hands both over instead' },
        { go: [2804, 2761], r: 200, why: 'Garkor, by the temple' },
        { talk: 'mm_garkor' },
        { stage: 6 },
        { has: 'mm_monkey_amulet_mould' },
        { has: 'mm_monkey_dentures' },

        { note: 'real steps 23-26: the tunnel to Zooknock' },
        ...marimGate([2720, 2768]),
        { go: [2764, 2704], r: 250, why: 'the tunnel mouth on the west shore' },
        { loc: 'mm_bamboo_ladder_dungeon_entrance', at: [2763, 2703], why: 'climb down' },
        { go: [2800, 9144], r: 200, why: 'the far end of the tunnel' },
        { talk: 'mm_zooknock' },
        { stage: 7 },
        { talk: 'mm_zooknock', why: 'hand over the gold bar, the mould and the dentures' },
        { has: 'mm_amulet_of_monkey_speak_without_string' },

        { note: 'real step 30: the real quest gets an ENCHANTED BAR back and melts it at a wall of flames in the Temple of Marimbo. Here Zooknock makes the amulet himself' },
        { use: ['mm_amulet_of_monkey_speak_without_string', 'ball_of_wool'] },
        { has: 'mm_amulet_of_monkey_speak' },
        { stage: 8 },
        // "Equip the M'speak amulet and talk to the Monkey Child" - without it every monkey on the
        // island answers in gibberish, which is correct and is also easy to forget.
        { held: 'mm_amulet_of_monkey_speak', op: 2, why: 'wear the amulet' },
        { note: 'real steps 32-37: the monkey child, five bananas and the talisman' },
        { go: [2764, 9104], r: 250, why: 'back across the tunnel to the exit' },
        { loc: 'mm_bamboo_ladder_dungeon_exit', at: [2763, 9103], why: 'climb out' },
        ...marimGate([2720, 2764]),
        { go: [2744, 2794], r: 250, why: "the monkey child's garden" },
        // real step 34 is "pick five bananas from the garden trees". op1=Search, and no handler.
        { loc: 'mm_bananatreefull', at: [2741, 2795], why: 'search a banana tree', soft: true },
        { has: 'banana' },
        { give: 'banana', n: 5 },
        { go: [2740, 2793], r: 40, why: 'the child, with the aunt out of earshot' },
        // the aunt is out of earshot only 6% of the time, so one click is not a fair test
        { talk: 'mm_monkey_child', picks: [1], tries: 80, why: 'ask for the talisman' },
        { talk: 'mm_monkey_child', tries: 80, why: 'hand over five bananas' },
        { has: 'mm_monkey_talisman' },
        { stage: 9 },

        { note: 'real steps 39-41: back down the tunnel for the greegree' },
        ...marimGate([2720, 2768]),
        { go: [2764, 2704], r: 250, why: 'the tunnel mouth again' },
        { loc: 'mm_bamboo_ladder_dungeon_entrance', at: [2763, 2703] },
        { go: [2800, 9144], r: 200, why: 'Zooknock' },
        { talk: 'mm_zooknock', why: 'talisman and monkey bones' },
        { talk: 'mm_zooknock', why: 'and the carving' },
        { has: 'mm_monkey_greegree_for_normal_monkey' },
        { stage: 10 },

        { note: 'real steps 47-52: as a monkey, Kruk carries you to Awowogei' },
        { go: [2764, 9104], r: 200, why: 'the tunnel exit' },
        { loc: 'mm_bamboo_ladder_dungeon_exit', at: [2763, 9103], why: 'climb out' },
        { held: 'mm_monkey_greegree_for_normal_monkey', op: 2, why: 'wield the greegree and become a monkey' },
        // Kruk stands in the walled yard between the two halves of the gate and NO tile beside him
        // can be walked to from either side - which is why the content gives him an [apnpc1]. So the
        // walk stops short and the conversation happens across the palisade.
        { go: [2722, 2763], r: 250, why: 'as close to Kruk as the ground allows - four tiles' },
        { talk: 'mm_kruk', picks: [1], why: 'across the palisade' },
        { talk: 'mm_awowogei_cutscene', why: 'the first audience' },
        { stage: 11 },

        { note: 'real steps 43-46: the Ardougne Zoo, and the walk back with no teleports' },
        ...marimGate([2720, 2768]),
        { go: [2802, 2706], r: 250, why: "Lumdo's boat on the Ape Atoll shore" },
        { talk: 'mm_lumdo', picks: [1], why: 'back to Crash Island' },
        { go: [2893, 2729], r: 64, why: 'Waydar' },
        { talk: 'mm_waydar', picks: [1], why: 'back to the hangar' },
        { go: [2588, 4494], r: 160, why: 'the bunker teleport pad' },
        { loc: 'bunker_teleport', at: [2589, 4494], why: 'out of the hangar' },
        { go: [2596, 3275], r: 250, why: 'the Ardougne zoo' },
        { talk: 'mm_monkey_minder', why: 'as a monkey, get into the cage' },
        { talk: 'mm_zoo_monkey', why: 'into the backpack' },
        { has: 'mm_monkey_in_backpack' },
        { stage: 12 },

        { note: 'and back to Ape Atoll carrying him - the leg the quest says you must WALK' },
        { go: [2466, 3494], r: 250, why: 'the Grand Tree' },
        { loc: 'ladder', at: [2466, 3495] },
        { go: [2482, 3490], r: 64, why: 'Daero' },
        { talk: 'mm_daero', picks: [1], why: 'down to the hangar again' },
        { go: [2585, 4518], r: 64, why: 'Waydar' },
        { talk: 'mm_waydar', picks: [1], why: 'the glider, carrying the monkey' },
        { stage: 12 },

        { note: 'real steps 53-58: the sigil, the Jungle Demon and the King' },
        { go: [2892, 2724], r: 64 },
        { talk: 'mm_lumdo', picks: [1] },
        { go: [2727, 2768], r: 250, why: 'Kruk again' },
        { talk: 'mm_kruk', picks: [1] },
        { talk: 'mm_awowogei_cutscene', why: 'hand over the monkey' },
        { stage: 13 },
        ...marimGate([2720, 2764]),
        { go: [2804, 2761], r: 250, why: 'Garkor' },
        { talk: 'mm_garkor' },
        { has: 'mm_sigil' },
        { stage: 14 },
        { held: 'mm_sigil', op: 2, why: 'wear it - the arena' },
        { fight: 'mm_demon' },
        { stage: 15 },
        { go: [2465, 3497], r: 250, why: 'back to King Narnode' },
        { talk: 'grandtree_narnode' },
        { stage: 20 }
    ]
};

const p: any = H.makePlayer('mmrun', m.start[0], m.start[1]);
H.tick(2);
p.teleport(m.start[0], m.start[1], m.start[2]);
H.maxOut(p);
H.equip(p, { rhand: 'dragon_scimitar', torso: 'rune_platebody', legs: 'rune_platelegs', hat: 'rune_full_helm' });
H.tick(1);

const res = play(m, p);
const bad = res.filter(r => !r.ok);
console.log('');
if (bad.length) {
    console.log('WHAT WENT WRONG');
    for (const r of bad) console.log('  step ' + r.n + '  ' + r.what + (r.detail ? '  -- ' + r.detail : ''));
}
process.exit(bad.length ? 1 : 0);
