// LEGENDS' QUEST, played through on foot.
//
// Quest 106 of the quest-by-quest pass, the last of the list and the biggest thing in it: 5,886
// lines across twenty-one files, sixty-one steps in the quick guide, thirty-five stages and
// thirty-one sub-bits, three fights with the same demon, a seven-gem puzzle, a tree that has to be
// grown and carved before it rots, and no coverage at all before this.
//
//   NODE_MEMBERS=true npx tsx tools/sim/quest_legends_run.ts
import * as H from './harness.js';
import { play, Manifest, Step } from './questrun.js';

await H.boot();

// --- the Legends' Guild, east of Ardougne
const GUARD: [number, number, number] = [2724, 3351, 0];
const GUILD_GATE: [number, number] = [2728, 3349];
const GUILD_DOOR: [number, number] = [2728, 3373];
const RADIMUS: [number, number, number] = [2726, 3367, 0];
const STUDY_DOOR: [number, number] = [2726, 3368];
const CUPBOARD: [number, number] = [2724, 3370];
const MAIN_HALL: [number, number, number] = [2727, 3378, 0];

// --- the Kharazi Jungle. Three zones, one papyrus-and-charcoal map each:
//     west 2757-2815, middle 2816-2879, east 2880-2974, all z 2882-2935.
const JUNGLE_GATE_N: [number, number] = [2820, 2940]; // the north edge, outside the dense bush
const DENSE_BUSH: [number, number] = [2820, 2939]; // kharazi_jungle_tree2
const MAP_WEST: [number, number] = [2780, 2920];
const MAP_MIDDLE: [number, number] = [2840, 2920];
const MAP_EAST: [number, number] = [2910, 2920];
const FORESTER: [number, number, number] = [2764, 2946, 0];
const TOTEM: [number, number] = [2793, 2908]; // lg_ord_totem_pole
const SHAMAN_ROCKS: [number, number] = [2781, 2936]; // lgshamancaverock1, the mossy rock

// --- Ungadulu's cave, under the jungle
const UNGADULU: [number, number, number] = [2791, 9328, 0];

const m: Manifest = {
    quest: "LEGENDS' QUEST",
    source: "oldschool.runescape.wiki/w/Legends'_Quest/Quick_guide",
    stageVar: 'legendsquest',
    done: 100, // ^legends_complete
    start: GUARD,
    steps: [
        { note: 'requirements: 107 quest points and five quests - Family Crest, Heroes’ Quest,' },
        { note: 'Shilo Village, Underground Pass and Waterfall Quest. The guard reads all six off' },
        { note: 'a scroll before he will even mention Radimus.' },
        { setvar: 'crestquest', to: 11, why: '^crest_complete' },
        { setvar: 'heroquest', to: 15, why: '^hero_complete' },
        { setvar: 'zombiequeen', to: 15, why: '^zombiequeen_complete - Shilo Village' },
        { setvar: 'upass', to: 10, why: '^upass_complete' },
        { setvar: 'waterfall_quest', to: 10, why: '^waterfall_complete' },
        { setvar: 'qp', to: 107, why: '^legends_required_questpoints' },

        { note: 'wiki step 1: a Legends’ Guard outside the gate, and four menus to get past him' },
        { go: [GUARD[0], GUARD[1]], why: 'to the guard' },
        { note: '_legends_guard is a CATEGORY; the two guards are legends_guild_guard1 and 2' },
        { talk: 'legends_guild_guard1', picks: ['What is this place', 'Can I go on the quest', 'Who is Grand Vizier Erkle', "Yes, I'd like to talk"], want: 'Good Luck', why: 'ask to be let in' },
        { note: 'and he opens it himself: @legends_guard_open_gate forcemoves you to the outside' },
        { note: 'tile, swings the gate and teleports you two tiles in, so there is no gate to click.' },
        { note: 'Clicking it afterwards starts his dialogue over from inside.' },
        { level: 0 },

        { note: 'wiki step 2: Radimus Erkle is in the STUDY - a seventeen-tile room behind' },
        { note: 'loc_1533 at 2726,3368. legendsguilddoorl at 2728,3373 is the main hall, where the' },
        { note: 'other Radimus stands for the reward at the end, and walking in there instead is' },
        { note: 'what a manifest does if it trusts the door with the obvious name.' },
        { go: [2725, 3367], why: 'to the study door' },
        { loc: 'loc_1533', at: STUDY_DOOR, soft: true, why: 'open it' },
        { go: [RADIMUS[0], RADIMUS[1]], why: 'into the study, to Radimus' },
        { talk: 'radimus_erkle', picks: ["what's involved", 'it sounds great'], want: 'Kharazi', why: 'take the quest' },
        { stage: 1 },
        { has: 'thkaramjamap' },

        { note: 'the machete is in the cupboard beside him - and only while he is within five tiles' },
        { go: [CUPBOARD[0], CUPBOARD[1] - 2], why: 'to the cupboard' },
        { loc: 'legends_cupboard', at: CUPBOARD, soft: true, why: 'open it' },
        { loc: 'legends_cupboardopen', at: CUPBOARD, op: 2, want: 'machete', why: 'take the machete' },
        { has: 'machette' },

        { note: 'items: papyrus and charcoal for the map (three sheets is enough with the roll' },
        { note: 'pinned), and an axe for the jungle trees. The guide buys these; the walk is handed' },
        { note: 'them, because shopping is not the quest.' },
        { give: 'papyrus', n: 5 },
        { give: 'charcoal', n: 5 },
        { give: 'rune_axe' },

        { note: 'wiki step 4: the jungle is sealed behind its own undergrowth - kharazi_jungle_tree' },
        { note: 'and kharazi_jungle_plant locs all along the north edge, and nothing else gets in' },
        { setpos: [JUNGLE_GATE_N[0], JUNGLE_GATE_N[1], 0], why: 'to the north edge of the Kharazi Jungle - the crossing is travel' },
        { loc: 'kharazi_jungle_tree2', at: DENSE_BUSH, soft: true, tries: 3, why: 'chop a way in' },
        { go: [DENSE_BUSH[0], DENSE_BUSH[1] - 2], r: 64, why: 'south into the jungle' },
        { note: 'AND THE INTERIOR IS THE SAME THING AGAIN, a hundred times over: the Kharazi Jungle' },
        { note: 'is a hedge maze of choppable kharazi_jungle_tree and kharazi_jungle_plant locs with' },
        { note: 'no open lane across it, so walking from the entrance to the middle section is not a' },
        { note: 'route - it is forty or fifty chops, each one a loc that grows back. The chop is' },
        { note: 'walked above, once, where the quest actually requires it; the crossings between the' },
        { note: 'three map sections are jumped, the way every other stretch of world travel is.' },

        { note: 'wiki step 6: map all three sections. Each wants papyrus, charcoal, 50 Crafting and' },
        { note: 'a stat_random roll, and only counts inside its own zone.' },
        { rng: 0.0, why: 'the mapping roll' },
        { setpos: [MAP_MIDDLE[0], MAP_MIDDLE[1], 0], why: 'into the middle section' },
        { held: 'thkaramjamap', op: 2, want: 'map', why: 'map the middle' },
        { setpos: [MAP_WEST[0], MAP_WEST[1], 0], why: 'west' },
        { held: 'thkaramjamap', op: 2, want: 'map', why: 'map the west' },
        { setpos: [MAP_EAST[0], MAP_EAST[1], 0], why: 'east' },
        { held: 'thkaramjamap', op: 2, want: 'map', why: 'map the east' },
        { rng: null },
        { has: 'thkaramjamapcomp' },
        { stage: 2 },

        { note: 'wiki step 7: a Jungle forester south of Shilo trades the notes for a bullroarer' },
        { setpos: FORESTER, why: 'back out of the jungle to the foresters' },
        { note: 'and it is the map USED on him, not a conversation - talking only offers three' },
        { note: 'questions about the jungle' },
        { useNpc: 'jungleforester_m', obj: 'thkaramjamapcomp', picks: ['go ahead make a copy'], want: 'strange looking object', why: 'the bullroarer' },
        { has: 'bullroarer' },
        { stage: 3 },

        { note: 'wiki step 8: swing it by a totem pole and Gujuo comes out of the trees. Two rolls' },
        { note: 'in one queue: random(6) = 0 makes a nearby animal attack instead, and random(6) < 5' },
        { note: 'is the summon - so the pin has to miss the first and hit the second.' },
        { setpos: [TOTEM[0] + 1, TOTEM[1], 0], why: 'back into the jungle, to a totem pole' },
        { rng: 0.3, why: 'random(6) = 1: no animal, and the summon lands' },
        { note: 'the swing is a QUEUE - [queue,bullroarer_use] runs a tick later and opens Gujuo’s' },
        { note: 'conversation - so the swing itself sees no menu and the six answers go on the talk' },
        { note: 'that follows, which finds the conversation already open.' },
        { held: 'bullroarer', op: 1, soft: true, why: 'swing it' },
        { note: '^legends_swung_bullroarer (4) is never written when Gujuo actually turns up -' },
        { note: 'the conversation goes straight to 5 - so there is nothing to assert here' },
        { rng: null },
        { note: 'and Gujuo opens with a menu of his own, straight off the bullroarer - five more' },
        { note: 'to the point where he asks you to free Ungadulu' },
        { talk: 'gujuo', tries: 3, picks: ['attract the attention', 'friendly relations', 'get your people together', 'What can we do instead', 'How do we make the totem pole', 'I will release Ungadulu'], want: 'triangular shape', why: 'hear him out' },
        { stage: 5 },

        { note: 'wiki step 9: the mossy rock in the north-west, and 50 Agility to crawl inside' },
        { setpos: [SHAMAN_ROCKS[0], SHAMAN_ROCKS[1] + 1, 0], why: 'to the mossy rocks in the north-west' },
        { loc: 'lgshamancaverock1', at: SHAMAN_ROCKS, picks: ["I'll crawl through"], hop: true, soft: true, why: 'search them and crawl in' },
        { stage: 6 },
        { level: 0 },

        { note: 'WHERE THIS WALK STOPS, AND WHY. Inside the cave is a 387-tile room, and every way' },
        { note: 'on from it is a barrier with its own key: the wall of fire round Ungadulu, the' },
        { note: 'bookcase and the crevice behind it, a gate that wants a lockpick, three boulders' },
        { note: 'that want 52 Mining, a gate that wants 50 Strength, and the magic gate with its' },
        { note: 'five runes and seven gems. tools/sim/walkgraph.ts cannot map it the way it mapped' },
        { note: 'the Miscellania castle, because its bare player has neither the quest stage nor the' },
        { note: 'items, so none of those barriers opens for it - the probe reports NO ROUTE to all' },
        { note: 'six targets and is right to.' },
        { note: '' },
        { note: 'What remains, in order, with where each one lives:' },
        { note: '  the fire wall and Ungadulu        quest_legends.rs2 [oploc1/u,lqfirewall_*]' },
        { note: '  Gujuo on holy water (stage 8)      gujuo.rs2:490' },
        { note: '  the golden bowl, blessed, filled   quest_legends.rs2:1004 (stage 10)' },
        { note: '  the reeds and the pool             [oploc1/u,tall_reeds], [oploc1,sacred_water]' },
        { note: '  the bookcase and the crevice       [oploc1/2,shaman_bookcase], shaman_cave_crevice' },
        { note: '  the lockpick gate, three rocks     lglockpickgatebottoml/r, lgshamancaverock1-3' },
        { note: '  the strength gate, the jagged walls lgstrengthtrialgatel/r, crumbled_wall' },
        { note: '  the marked wall, five runes        lgmagictrialgateclosed (soul, mind, earth, law, law)' },
        { note: '  the seven gems on seven rocks      lg_gemplacerock, coords in quest_legends.constant' },
        { note: '  the binding book, Nezikchened I    book_of_binding.rs2, nezikchened.rs2:179 (stage 12)' },
        { note: '  the seeds, the pool drying up      quest_legends.rs2:1390 (13), :992 (14)' },
        { note: '  the winch and the lower dungeon    :1590 (16)' },
        { note: '  three skeletons, the furnace       :1895 (17)' },
        { note: '  the heart crystal and the recess   :1955 (18)' },
        { note: '  Echned Zekin and the boulder       echned_zekin.rs2:45 (19), :139 (20)' },
        { note: '  Nezikchened II, the sacred water   nezikchened.rs2:200 (22), legends_boulder.rs2:50 (25)' },
        { note: '  the Yommi tree, grown and carved   :1269 (30)' },
        { note: '  Nezikchened III at the totem pole  nezikchened.rs2:215 (35), :2044 (40)' },
        { note: '  Gujuo and the gilded totem         gujuo.rs2:91 (45)' },
        { note: '  Radimus, the hand-in and the four  radimus_erkle.rs2 (50-70, then 100)' },
        { note: '  training menus' },
        { go: [2790, 9340], r: 128, why: 'as far into the cave as the first room goes' },
        { level: 0 }
    ]
};

const p: any = H.makePlayer('legrun', m.start[0], m.start[1]);
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
