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
const FIREWALL_W: [number, number] = [2787, 9328]; // lqfirewall_diagonal, the west face of the octagram
const CAVE_EXIT: [number, number] = [2772, 9342]; // shaman_entrance_cavel
const REEDS: [number, number] = [2836, 2916];
const POOL: [number, number] = [2837, 2915]; // sacred_water

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

        { note: 'wiki step 10: Ungadulu is inside a flaming octagram and the only way to speak to' },
        { note: 'him is to INVESTIGATE the fire wall (op2) from within ten tiles of him - there is' },
        { note: 'no zone trigger and no way to reach him, and a plain click on him only gets "run' },
        { note: 'for your life" and a curse.' },
        { go: [FIREWALL_W[0] + 1, FIREWALL_W[1]], r: 192, why: 'to the west face of the octagram' },
        { note: 'and "Who are you?" is the answer that matters: it sets BOTH asked_ungadulu_where' },
        { note: 'and asked_ungadulu_who, and Gujuo will not talk about pure water without the' },
        { note: 'second one. Then "Where do I get pure water from?" sets called_vacu, which is what' },
        { note: 'puts the pure-water line on his menu at all.' },
        { loc: 'lqfirewall_diagonal', at: FIREWALL_W, op: 2, picks: ['Who are you', 'Where do I get pure water'], want: 'heat kills me', why: 'investigate the flames' },
        { stage: 7 },

        { note: 'wiki step 11: out of the cave and swing the bullroarer again' },
        { go: [CAVE_EXIT[0] + 1, CAVE_EXIT[1]], r: 192, why: 'back to the cave mouth' },
        { loc: 'shaman_entrance_cavel', at: CAVE_EXIT, hop: true, soft: true, why: 'out' },
        { setpos: [TOTEM[0] + 1, TOTEM[1], 0], why: 'to a totem pole in the jungle' },
        { rng: 0.3, why: 'random(6) = 1 again: no animal, and the summon lands' },
        { held: 'bullroarer', op: 1, soft: true, why: 'swing it' },
        { rng: null },
        { talk: 'gujuo', tries: 3, picks: ['pure water to douse', 'Ok, thanks'], want: 'metal of the sun', why: 'ask about pure water' },
        { stage: 8 },

        { note: 'wiki step 12: two gold bars and a hammer make the golden bowl on any ordinary' },
        { note: 'anvil. That is the generic Smithing panel rather than quest logic, so the bowl is' },
        { note: 'handed over here the way the papyrus and the axe were.' },
        { give: 'goldbowl_empty' },

        { note: 'wiki step 13: and Gujuo blesses it - 42 Prayer, and he asks before he does it.' },
        { note: 'He is npc_add-ed with a 500-tick life and wanders off, so every conversation with' },
        { note: 'him after the first needs the bullroarer again.' },
        { has: 'goldbowl_empty' },
        { note: 'and with a bowl in the pack his conversation OPENS with the blessing offer, before' },
        { note: 'any menu - so the answer goes on a resume of what the bullroarer queue opened, not' },
        { note: 'on a talk after it' },
        { rng: 0.3, why: 'the summon' },
        { held: 'bullroarer', op: 1, soft: true, why: 'swing it again' },
        { note: 'and the blessing itself is a stat_random(prayer, 80, 250) whose TRUE branch is the' },
        { note: 'failure - "you were not able to go into a deep enough trance" - so the pin here has' },
        { note: 'to be high, the opposite way round from every other roll in this walk' },
        { rng: 0.99, why: 'stat_random false: the trance holds first time' },
        { note: 'and once the bowl is blessed gujuo_start no longer sees a plain golden bowl, so the' },
        { note: 'same conversation runs straight on into the how-goes-Ungadulu menu behind it' },
        { resume: true, picks: ['like you to bless my gold bowl', 'Ok thanks for your help'], want: 'bowl is blessed', why: 'have the bowl blessed' },
        { rng: null },
        { has: 'goldbowlbless_empty' },

        { note: 'wiki step 14: a reed cut with the machete, and the reed used on the pool to syphon' },
        { note: 'the water out - the gap in the rocks is too narrow for the bowl itself' },
        { setpos: [REEDS[0] + 1, REEDS[1], 0], why: 'to the water pool' },
        { useLoc: 'tall_reeds', at: REEDS, obj: 'machette', want: 'cut down a reed', why: 'cut a reed' },
        { has: 'reed_hollow' },
        { useLoc: 'sacred_water', at: POOL, obj: 'reed_hollow', want: 'syphon', why: 'fill the bowl' },
        { has: 'goldbowlbless_pure' },
        { stage: 10 }
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
