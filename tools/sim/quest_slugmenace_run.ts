// THE SLUG MENACE, played through on foot.
//
// A commorb, a village where most of the people are no longer anybody, a sealed door under a
// shrine, and whatever has been waiting behind it.
//
// Three things make this run harder than most:
//
//   THE DUNGEON IS TWO SQUARES. The entrance chamber is under the Witchaven ruins and the temple
//   is m42_161, a square of its own, because 474 keeps it in m36_79 and that square is Zulrah's
//   shrine in this build. The false wall and the passage are teleports, so `go` cannot cross
//   them and the run clicks them like a player does.
//
//   WITCHAVEN IS A MEMBERS AREA. canTravel refuses every tile of it unless NODE_MEMBERS is set,
//   so the run is started with it on - see the usage line. Without it the village reads as solid
//   rock and the first `go` fails with no route.
//
//   BOTH HALVES OF EVERY RUNE CAN FAIL, on purpose - 59% each at the quest's own requirement.
//   Ten rolls at 59% succeed about half a percent of the time, so the rng is pinned around them
//   and released again: what is being tested is that the right rune comes out of the right altar,
//   not that the dice work.
//
//   NODE_MEMBERS=true npx tsx tools/sim/quest_slugmenace_run.ts
import * as H from './harness.js';
import { play, Manifest } from './questrun.js';

await H.boot();

const m: Manifest = {
    quest: 'THE SLUG MENACE',
    source: 'oldschool.runescape.wiki/w/The_Slug_Menace/Quick_guide',
    stageVar: 'slugmenace_stage',
    done: 90, // ^slugmenace_complete
    start: [2998, 3373, 0], // Falador Park, Tiffy's bench
    steps: [
        { note: 'the requirements: Wanted! and Sea Slug, plus Runecraft and Slayer 30 to start' },
        { setvar: 'rd_main', to: 2, why: '^recruitmentdrive_complete - Tiffy will not talk otherwise' },
        { setvar: 'wanted_main', to: 50, why: '^wanted_complete' },
        { setvar: 'seaslugquest', to: 12, why: '^seaslug_complete' },
        { note: 'and the commorb Wanted! leaves you with, which this quest upgrades' },
        { give: 'wanted_crystal_ball' },

        { note: 'quick guide step 1: Sir Tiffy Cashien in Falador Park hands over a Commorb v2' },
        { talk: 'rd_teleporter_guy', picks: ['Do you have any jobs for me yet?', "Yes, I'll go."], want: 'update your CommOrb', why: 'he takes the old orb and upgrades it' },
        { stage: 10 },
        { has: 'slug_commorb' },
        { hasnt: 'wanted_crystal_ball' },

        { note: "quick guide step 2: Col. O'Niall on the Witchaven dock" },
        { setpos: [2722, 3306, 0], why: 'Ardougne teleport and east to the Witchaven dock' },
        { talk: 'witchaven_oniall', picks: ["What's the mission?", "That's enough for now."], soft: true, why: 'the code phrase, and the three names' },
        { stage: 20 },

        { note: 'quick guide step 3: Mayor Hobb in the most north-west building. One door to open.' },
        { go: [2712, 3290], why: 'west through the village' },
        { loc: 'osrsloc_1521', at: [2713, 3291], why: "the mayor's front door" },
        { go: [2708, 3292], why: 'into the study' },
        { talk: 'witchaven_hobb', picks: ['Nothing at the moment, thanks.'], want: 'villagers must have mentioned', why: 'he knows your name and should not' },
        { varis: 'slugmenace_met_hobb', to: 1 },

        { note: 'and Savant wants a reading of him, which is the orb scan the colonel waits on' },
        { held: 'slug_commorb', op: 1, want: 'something inside that man', why: 'Scan' },
        { varis: 'slugmenace_mayor_scanned', to: 1 },

        { note: 'Brother Maledict, in the church' },
        { go: [2713, 3291], why: 'back out of the house' },
        { loc: 'osrsloc_1521', at: [2713, 3291], why: 'and through the door' },
        { go: [2726, 3284], why: 'east to the church' },
        { talk: 'witchaven_maledict', picks: ["What's worrying you?", "That's enough for now."], want: 'nobody behind their eyes', why: 'his congregation has stopped listening' },
        { varis: 'slugmenace_met_maledict', to: 1 },

        { note: 'Holgart, by the boat. The Mayor has taken it off him.' },
        { go: [2720, 3305], why: 'north to the dock' },
        { talk: 'holgartland', want: 'Mayor has given it to Jeb', why: 'the boat is the third thing wrong' },
        { varis: 'slugmenace_met_holgart', to: 1 },

        { note: 'quick guide step 4: back to the colonel, who sends you to the shrine' },
        { talk: 'witchaven_oniall', want: 'The shrine, west of town', why: 'the report' },
        { stage: 30 },
        { varis: 'slugmenace_jeb_turned', to: 1, nomark: true },

        { note: 'quick guide step 5: the Old Ruin Entrance west of Witchaven' },
        { go: [2696, 3283], why: 'west out of the village to the ruins' },
        { loc: 'loc_1754', at: [2696, 3282], why: 'climb down - the 377 ladder already lands in the chamber' },
        { level: 0 },

        { note: 'quick guide step 6: push the false wall on the east side of the chamber' },
        { go: [2700, 9688], why: 'across the chamber to the east wall' },
        { loc: 'slugmenace_false_wall', at: [2701, 9688], want: 'creaks open', why: 'it is not a wall' },
        { varis: 'slugmenace_false_wall', to: 1 },
        { loc: 'slugmenace_false_wall', at: [2701, 9688], why: 'and through it, which needs the orb' },

        { note: 'quick guide step 7: follow the path to the imposing door and try to open it' },
        { go: [2712, 10344], why: 'east along the first corridor' },
        { loc: 'slugmenace_shortcut', at: [2715, 10344], why: 'the hole in the rock - Agility 30' },
        { go: [2733, 10342], why: 'on to the doors' },
        { loc: 'slugmenace_doors', at: [2732, 10341], want: 'burning your hand', why: 'it will not open for a hand' },

        { note: 'quick guide step 8: scan the door for the transcription' },
        { held: 'slug_commorb', op: 1, want: 'transcript of the runes', why: 'Scan' },
        { stage: 40 },
        { has: 'slug_door_transcription' },

        { note: 'quick guide step 9: the dead sea slug on the floor beside the door' },
        { take: 'slug_dead_sea_slug', r: 6, why: 'it is lying in the sanctum - Savant notices on the pickup' },
        { has: 'slug_dead_sea_slug' },
        { varis: 'slugmenace_slug_scanned', to: 1, nomark: true },

        { note: 'quick guide step 10: Jorral at the Outpost, north-west of Ardougne' },
        { go: [2707, 10352], why: 'back west to the passage' },
        { loc: 'slugmenace_passage', at: [2706, 10352], why: 'out to the chamber' },
        { go: [2696, 9682], why: 'to the ladder' },
        { loc: 'slugmenace_temple_exit', at: [2696, 9682], why: 'climb up to the ruins' },
        { setpos: [2437, 3347, 0], why: 'the long way round to the Outpost' },
        { talk: 'makinghistory_jorral', want: 'Mother Mallum', why: 'he reads the glyphs - the hook needs the copy in hand, so Making History keeps its own quest giver' },
        { stage: 50 },
        { varis: 'slugmenace_villagers_turned', to: 1, nomark: true },

        { note: 'quick guide step 11: tell the colonel, then Brother Maledict' },
        { setpos: [2722, 3306, 0], why: 'back to the Witchaven dock' },
        { talk: 'witchaven_oniall', want: 'Brother Maledict has a book', why: 'the name means nothing to him' },
        { stage: 60 },
        { go: [2726, 3284], why: 'to the church' },
        { talk: 'witchaven_maledict', want: 'nothing in that book for you', why: 'and whatever is in the Mayor takes him mid-sentence' },
        { varis: 'slugmenace_maledict_turned', to: 1, nomark: true },

        { note: "quick guide step 12: the mayor's study desk" },
        { go: [2712, 3290], why: 'west again' },
        { loc: 'osrsloc_1521', at: [2713, 3291], why: 'his front door' },
        { go: [2708, 3293], why: 'to the desk' },
        { loc: 'witchaven_study_desk', at: [2708, 3294], want: 'page of Maledict', why: 'the locked drawer' },
        { has: 'slug_page1' },

        { note: 'quick guide step 13: Ezekial Lovecraft in the fishing store' },
        { go: [2713, 3291], why: 'out of the house' },
        { loc: 'osrsloc_1521', at: [2713, 3291], why: 'through the door' },
        { go: [2729, 3291], why: 'east to the shop' },
        { loc: 'osrsloc_18168', at: [2730, 3292], why: "the shop's own door" },
        { go: [2733, 3292], why: 'up to the counter' },
        { talk: 'witchaven_lovecraft', want: 'no good to me', why: 'he kept the page because nobody asked for it' },
        { has: 'slug_page2' },

        { note: 'quick guide step 14: the colonel has the last page, in three pieces' },
        { setpos: [2722, 3306, 0], why: 'back to the dock' },
        { talk: 'witchaven_oniall', want: 'three pieces', why: 'he has been sitting on it' },
        { has: 'slug_fragment1' },
        { has: 'slug_fragment3' },
        { varis: 'slugmenace_oniall_turned', to: 0, nomark: true },

        { note: 'quick guide step 15: the obvious glue is the wrong glue, and Savant says so' },
        { give: 'swamppaste' },
        { use: ['slug_fragment1', 'swamppaste'], want: "don't use oil-rich swamp paste", why: 'she stops you' },
        { varis: 'slugmenace_paste_refused', to: 1, nomark: true },

        { note: 'quick guide step 16: Jeb runs the boat to the Fishing Platform now' },
        { go: [2721, 3305], why: 'along the dock to Jeb' },
        { talk: 'witchaven_jeb', picks: ['Will you take me, please?'], want: 'arrive at the Fishing Platform', why: 'the crossing' },

        { note: 'quick guide step 17: Bailey renders the slug down for glue' },
        { note: 'he is shut in a twelve-tile room with one door, and an opnpc through a wall says' },
        { note: 'nothing at all - which is what the run reported before this door step existed.' },
        { go: [2767, 3277], why: 'south-west across the platform' },
        { loc: 'loc_1533', at: [2765, 3277], why: "the door to Bailey's room" },
        { go: [2764, 3276], why: 'inside' },
        { talk: 'bailey', want: 'That should do the trick', why: 'his gumbo has been on too long' },
        { has: 'slug_sea_slug_glue' },
        { hasnt: 'slug_dead_sea_slug' },

        { note: 'quick guide step 18: glue the three pieces together' },
        { use: ['slug_fragment1', 'slug_sea_slug_glue'], want: 'dries clear', why: 'the page is whole' },
        { has: 'slug_page3' },
        { stage: 70 },
        { varis: 'slugmenace_oniall_turned', to: 1, nomark: true },

        { note: 'quick guide step 19: shape five runes from the pages. Both halves can fail, so the' },
        { note: 'dice are pinned here and released afterwards - the test is which rune comes out.' },
        { give: 'chisel' },
        { give: 'blankrune', n: 20 },
        { rng: 0, why: 'every shaping and every empowering succeeds' },
        { held: 'slug_page1', op: 3, want: 'desired shape', why: 'Shape-Air' },
        { has: 'slug_blank_air_rune' },
        { held: 'slug_page2', op: 3, why: 'Shape-Water' },
        { held: 'slug_page1', op: 2, why: 'Shape-Earth' },
        { held: 'slug_page2', op: 2, why: 'Shape-Fire' },
        { held: 'slug_page3', op: 2, why: 'Shape-Mind' },
        { has: 'slug_blank_mind_rune' },

        { note: 'quick guide step 20: each carving at its own altar. A rune at the wrong one is refused.' },
        { note: 'the altars are INSIDE the rune temples, not on the surface - the mysterious ruins' },
        { note: 'and a talisman are existing runecrafting content, so the run steps straight in.' },
        { setpos: [2842, 4833, 0], why: 'the Air temple' },
        { useLoc: 'air_altar', at: [2843, 4833], obj: 'slug_blank_mind_rune', want: 'glows faintly', why: 'the pairing is checked, not assumed' },
        { useLoc: 'air_altar', at: [2843, 4833], obj: 'slug_blank_air_rune', want: 'empower the required rune', why: 'air' },
        { has: 'slug_air_rune' },
        { varis: 'slugmenace_rune_air', to: 1, nomark: true },
        { setpos: [2714, 4835, 0], why: 'the Water temple' },
        { useLoc: 'water_altar', at: [2715, 4835], obj: 'slug_blank_water_rune', why: 'water' },
        { setpos: [2656, 4840, 0], why: 'the Earth temple' },
        { useLoc: 'earth_altar', at: [2657, 4840], obj: 'slug_blank_earth_rune', why: 'earth' },
        { setpos: [2583, 4837, 0], why: 'the Fire temple' },
        { useLoc: 'fire_altar', at: [2584, 4837], obj: 'slug_blank_fire_rune', why: 'fire' },
        { setpos: [2784, 4840, 0], why: 'the Mind temple' },
        { useLoc: 'mind_altar', at: [2785, 4840], obj: 'slug_blank_mind_rune', why: 'mind - this altar has no [oplocu] of its own and falls through the category handler' },
        { has: 'slug_mind_rune' },
        { rng: null, why: 'dice back to normal for the fight' },

        { note: 'quick guide step 21: the runes open the door, and the Mayor is behind it' },
        { setpos: [2696, 3283, 0], why: 'back to the ruins' },
        { loc: 'loc_1754', at: [2696, 3282], why: 'down' },
        { go: [2700, 9688], why: 'to the false wall' },
        { loc: 'slugmenace_false_wall', at: [2701, 9688], why: 'through' },
        { go: [2733, 10342], why: 'to the doors' },
        { loc: 'slugmenace_doors', at: [2732, 10341], want: 'played for a fool', why: 'the enchantment only opened for a Temple Knight' },
        { hasnt: 'slug_air_rune' },
        { varis: 'slugmenace_hobb_turned', to: 1, nomark: true },

        { note: 'quick guide step 22: the Slug Prince, level 62, melee only' },
        { fight: 'slug_prince', untilvar: 'slugmenace_stage', to: 80, r: 10, why: 'he drains prayer and nothing but melee touches him' },
        { stage: 80 },

        { note: 'quick guide step 23: Sir Tiffy, and the promotion' },
        { setpos: [2998, 3373, 0], why: 'Falador Park' },
        { talk: 'rd_teleporter_guy', want: 'Proselyte', why: 'the quest ends where it started' },
        { wait: 4, why: 'the completion is queued' },
        { stage: 90 }
    ]
};

const p: any = H.makePlayer('slugmenacerun', m.start[0], m.start[1]);
H.tick(2);
p.teleport(m.start[0], m.start[1], m.start[2]);
p.applyDamage = function () {};
// A SIM PLAYER IS MID-TUTORIAL: %tutorial is 0, so a wield never runs update_weapon_category and
// the fight would be bare-handed. Past 400 is "finished".
H.setVar(p, 'tutorial', 1000);
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
