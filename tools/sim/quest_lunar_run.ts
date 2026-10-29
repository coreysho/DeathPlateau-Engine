// LUNAR DIPLOMACY, played through on foot.
//
// Quest 95 of the quest-by-quest pass. tools/sim/lunar.ts already drives every mechanism in this
// quest and in Dream Mentor and the whole Lunar spellbook - 139 checks, all passing - but it
// teleports to each one in turn, so nothing had ever asked whether a player can actually GET to
// them. Lunar Isle came across with import474map.py and is the biggest imported area in the game,
// which makes it exactly the sort of place a walk is for.
//
// Two things are not walked here, and both are deliberate:
//
//   THE DREAM WORLD'S SIX CHALLENGES. The dice island wants a search over 64 die states for one
//   that totals the number the Ethereal Fluke called; the Numerator recites one of sixteen stored
//   sequences; the hurdles have a per-race pattern table. Those are algorithms, not step lists,
//   and lunar.ts solves all six for real. The walk takes the player into the Dream World on foot,
//   proves the platforms and the lectern, fights Me, and sets the six "lesson learnt" bits rather
//   than pretending to solve puzzles a manifest cannot express.
//
//   THE FOUR RUNE ALTARS and the hops between Rellekka, Pirates' Cove, Lunar Isle and the mine.
//   Those are teleports in the real game too, so they are setpos here, and the walking is done at
//   each end.
//
// One thing the survey for this walk turned up and did NOT fix: the Lady Zay's jinx is missing.
// See the long note at the Pirates' Cove crossing below.
//
//   NODE_MEMBERS=true npx tsx tools/sim/quest_lunar_run.ts
import * as H from './harness.js';
import { play, Manifest } from './questrun.js';

await H.boot();

// --- Rellekka
const LOKAR: [number, number, number] = [2625, 3694, 0];
const BRUNDT: [number, number, number] = [2659, 3669, 0];
const FURNACE: [number, number] = [2616, 3666]; // viking_furnace
const ANVIL: [number, number, number] = [2613, 3078, 0]; // Falador - see the note at the helm

// --- Pirates' Cove and the crossing
const COVE: [number, number, number] = [2202, 3806, 0];
// Bentley has moved aboard, onto the main deck beside the gangplank.
const BENTLEY: [number, number, number] = [2224, 3800, 2];
// --- the Lady Zay: two ladders and a gangplank to get aboard, then her own stairs
const SHORE_LADDER: [number, number] = [2212, 3809]; // L0, the shore
const PIER_LADDER: [number, number] = [2214, 3801]; // L1, the pier walkway
const WSTAIR_UP: [number, number] = [2222, 3792]; // L1 -> L2, the west stairs
const WSTAIR_DOWN: [number, number] = [2221, 3792]; // L2 -> L1
const HOLD_UP: [number, number] = [2225, 3808]; // L0 -> L1, out of the hold
const HOLD_DOWN: [number, number] = [2225, 3807]; // L1 -> L0
const SHULTZ: [number, number] = [2224, 3811]; // L2, the bow
const LEE: [number, number] = [2226, 3787]; // L2, aft
const DAVEY: [number, number] = [2223, 3789]; // L2, the aft room - 2222,3787 is the head of the
// wooden table, hemmed in by three chairs, and beside.ts says a player can stand NOWHERE beside it
const BOY: [number, number] = [2222, 3788]; // L1, the gun deck
const JACK: [number, number] = [2225, 3790]; // L1, by the stairs
const BURNS: [number, number] = [2224, 3792]; // L0, the hold
const SYM_CANNON: [number, number] = [2224, 3802]; // L1
const SYM_WALLCHART: [number, number] = [2222, 3790]; // L2
const SYM_CHEST: [number, number] = [2223, 3811]; // L0 - the one at 3813 is walled in by cargo
const SYM_SUPPORT: [number, number] = [2224, 3793]; // L0
const SYM_CRATE: [number, number] = [2226, 3790]; // L0

// --- Lunar Isle
const ISLE_PIER: [number, number, number] = [2113, 3892, 0];
const ONEIRO: [number, number, number] = [2155, 3862, 0];
const WATER_SOURCE: [number, number] = [2086, 3895]; // loc474_16643
const BABA: [number, number, number] = [2088, 3931, 0];
const RIMAE: [number, number, number] = [2104, 3907, 0];
const PAULINE: [number, number, number] = [2073, 3921, 0];
const METEORA: [number, number, number] = [2081, 3896, 0];
const SELENE: [number, number, number] = [2085, 3915, 0];
const SUQAH: [number, number, number] = [2101, 3871, 0];
const RING_DIG: [number, number, number] = [2078, 3863, 0];
const BRAZIER: [number, number] = [2072, 3911]; // loc474_16810
const BRAZIER_STAND: [number, number, number] = [2072, 3912, 0];

// --- the mine under the island
const MINE: [number, number, number] = [2320, 10339, 2];
const STALAGMITE: [number, number] = [2319, 10339]; // loc474_16680

// --- the Dream World
const DREAM_CENTRE: [number, number, number] = [1759, 5085, 2];
const LECTERN: [number, number] = [1759, 5087]; // loc474_16599

const m: Manifest = {
    quest: 'LUNAR DIPLOMACY',
    source: 'oldschool.runescape.wiki/w/Lunar_Diplomacy/Quick_guide',
    stageVar: 'lunar_quest',
    done: 150, // ^lunar_complete
    start: LOKAR,
    steps: [
        { note: 'requirements, all seven unboostable and all checked before Lokar will start it:' },
        { note: 'The Fremennik Trials, Lost City, Rune Mysteries and Shilo Village, plus Crafting' },
        { note: '61, Defence 40, Firemaking 49, Magic 65, Mining 60, Woodcutting 55, Herblore 5.' },
        { setvar: 'viking', to: 100, why: 'The Fremennik Trials' },
        { setvar: 'zanaris', to: 100, why: 'Lost City' },
        { setvar: 'runemysteries', to: 100, why: 'Rune Mysteries' },
        { setvar: 'zombiequeen', to: 100, why: 'Shilo Village' },
        { setvar: 'tutorial', to: 1000 },

        { note: 'items the walk is handed rather than farmed: the two clean herbs for the potion' },
        { note: '(the Suqah drop them unidentified and cleaning them is Herblore, not this quest),' },
        { note: 'a Dramen staff, a pickaxe, a hammer, a needle and thread, a spade, a tinderbox' },
        { note: 'and the 400gp Rimae charges for the tanning.' },
        { give: 'guam_leaf' },
        { give: 'marentill' },
        { give: 'pestle_and_mortar' },
        { give: 'dramen_staff' },
        { give: 'rune_pickaxe' },
        { give: 'hammer' },
        { give: 'needle' },
        { give: 'thread', n: 4 },
        { give: 'spade' },
        { give: 'tinderbox' },
        { give: 'coins', n: 1000 },

        { note: "the Suqah drops are rolled: a tooth is 69/129 and Meteora's tiara a flat half" },
        { note: 'once she has asked for it, so the rolls are pinned for the hunting.' },
        { rng: 0.3, why: 'a hide and a tooth off every Suqah' },

        { note: 'wiki step 1: Lokar Searunner, on the Rellekka pier' },
        { setpos: LOKAR, why: 'to Lokar' },
        {
            talk: 'lokar_searunner',
            picks: ['away from these parts', 'Why did you leave', 'innards'],
            want: 'Seal of Passage',
            why: 'start the quest'
        },
        { stage: 10 },

        { note: 'wiki step 2: Brundt the Chieftain, in the Rellekka longhall, issues the seal' },
        { setpos: BRUNDT, why: 'to Brundt' },
        { talk: 'viking_brundt', want: 'Seal of Passage', why: 'ask for the seal' },
        { has: 'lunar_seal_of_passage' },
        { stage: 20 },

        { note: "wiki step 3: Lokar takes you to Pirates' Cove" },
        { setpos: LOKAR, why: 'back to Lokar' },
        { talk: 'lokar_searunner', picks: ['Take me to Pirates'], why: 'sail west' },
        { level: 0 },

        { note: 'wiki step 4: the Lady Zay is jinxed. Two ladders and a gangplank to get aboard,' },
        { note: 'then Bentley sails a circle, Jack names the jinx, five crew are questioned IN' },
        { note: 'ORDER, the cabin boy confesses and hands over the lens, and five marks come off' },
        { note: 'the ship. Built 25 Oct in quests/quest_lunar/scripts/lunar_ladyzay.rs2 - before' },
        { note: 'that, stages 30 to 70 had no writer and Bentley sailed straight from 20 to 80.' },
        { loc: 'loc474_16959', at: SHORE_LADDER, hop: true, why: 'up the shore ladder' },
        { level: 1 },
        { loc: 'loc474_16959', at: PIER_LADDER, hop: true, why: 'up the pier ladder' },
        { level: 2 },
        { go: [BENTLEY[0], BENTLEY[1]], r: 48, why: 'over the gangplank to Captain Bentley' },
        { talk: 'captain_bentley', picks: ['Can we sail to Lunar Isle'], want: 'sailed a circle', why: 'ask him to sail' },
        { stage: 30 },
        { talk: 'captain_bentley', want: 'Ask my navigator', why: 'and ask what happened' },

        { note: 'down the south stairs to the gun deck, which is where the navigator is' },
        { loc: 'loc474_16902', at: [2224, 3793], soft: true, why: 'through the door if it is shut' },
        { loc: 'loc474_16947', at: WSTAIR_DOWN, hop: true, why: 'down the west stairs' },
        { level: 1 },
        { go: JACK, r: 32, why: 'to the navigator' },
        { talk: 'birdseye_jack', want: 'jinxed', why: 'he names the jinx' },
        { stage: 40 },

        { loc: 'loc474_16945', at: WSTAIR_UP, hop: true, why: 'back up to the main deck' },
        { level: 2 },
        { go: [BENTLEY[0], BENTLEY[1]], r: 32, why: 'back to Bentley' },
        { talk: 'captain_bentley', picks: ['He says the ship is jinxed'], want: 'close ranks', why: 'tell him, and he sets you to the crew' },
        { stage: 50 },

        { note: 'the five in order: Shultz, the boy, Burns, Lee, Davey-boy. Out of turn counts' },
        { note: 'for nothing, which is the rule Old School has for this bit.' },
        { note: 'the main deck is three rooms behind bulkhead doors - walkgraph named all three' },
        { loc: 'loc474_16902', at: [2224, 3807], why: 'through the forward bulkhead door' },
        { go: SHULTZ, r: 32, why: 'to the lookout at the bow' },
        { talk: 'eagleeye_shultz', want: 'Only the boy', why: 'one' },
        { varis: 'lunar_crew_asked', to: 1 },
        { loc: 'loc474_16947', at: WSTAIR_DOWN, hop: true, why: 'down to the gun deck' },
        { level: 1 },
        { go: BOY, r: 32, why: 'to the cabin boy' },
        { talk: 'cabin_boy', want: 'work to do', why: 'two' },
        { varis: 'lunar_crew_asked', to: 2 },
        { loc: 'loc474_16947', at: HOLD_DOWN, hop: true, why: 'down into the hold' },
        { level: 0 },
        { go: BURNS, r: 32, why: 'to the one shifting barrels' },
        { talk: 'beefy_burns', want: 'hands black', why: 'three' },
        { varis: 'lunar_crew_asked', to: 3 },
        { loc: 'loc474_16945', at: HOLD_UP, hop: true, why: 'up out of the hold' },
        { level: 1 },
        { loc: 'loc474_16945', at: WSTAIR_UP, hop: true, why: 'and up to the main deck' },
        { level: 2 },
        { loc: 'loc474_16902', at: [2224, 3793], soft: true, why: 'aft through the first door' },
        { loc: 'loc474_16902', at: [2224, 3790], soft: true, why: 'and the second, into the aft room' },
        { go: LEE, r: 32, why: 'to Lee, aft' },
        { talk: 'lecherous_lee', want: 'letter home', why: 'four' },
        { varis: 'lunar_crew_asked', to: 4 },
        { go: DAVEY, r: 32, why: 'to the first mate' },
        { talk: 'first_mate_daveyboy', want: 'sick twice', why: 'five' },
        { varis: 'lunar_crew_asked', to: 5 },

        { note: 'and back to the boy, who breaks. Two free spaces for the lens and the lantern.' },
        { loc: 'loc474_16947', at: WSTAIR_DOWN, hop: true, why: 'down to the gun deck' },
        { level: 1 },
        { go: BOY, r: 32, why: 'back to the cabin boy' },
        { talk: 'cabin_boy', want: 'not tell the captain', why: 'he confesses' },
        { stage: 60 },
        { has: 'lunar_emerald_lens' },
        { has: 'bullseye_lantern_nolens' },

        { use: ['lunar_emerald_lens', 'bullseye_lantern_nolens'], want: 'fit the emerald lens', why: 'the lens into the lantern' },
        { has: 'lunar_emerald_lantern' },
        { give: 'tinderbox' },
        { use: ['tinderbox', 'lunar_emerald_lantern'], want: 'light the emerald lantern', why: 'and light it' },
        { has: 'lunar_emerald_lantern_lit' },

        { note: 'five marks, none of which can be seen without the lit lantern' },
        { useLoc: 'loc474_16939', at: SYM_CANNON, obj: 'lunar_emerald_lantern_lit', want: 'rub it away', why: 'the cannon' },
        { loc: 'loc474_16947', at: HOLD_DOWN, hop: true, why: 'down into the hold' },
        { level: 0 },
        { go: [SYM_CHEST[0], SYM_CHEST[1] - 1], r: 48, why: 'to the northern chest' },
        { useLoc: 'loc474_16891', at: SYM_CHEST, obj: 'lunar_emerald_lantern_lit', want: 'rub it away', why: 'the chest' },
        { useLoc: 'loc474_16951', at: SYM_SUPPORT, obj: 'lunar_emerald_lantern_lit', want: 'rub it away', why: 'the support' },
        { useLoc: 'loc474_16862', at: SYM_CRATE, obj: 'lunar_emerald_lantern_lit', want: 'rub it away', why: 'the crate by the range' },
        { loc: 'loc474_16945', at: HOLD_UP, hop: true, why: 'up out of the hold' },
        { level: 1 },
        { loc: 'loc474_16945', at: WSTAIR_UP, hop: true, why: 'up to the main deck' },
        { level: 2 },
        { loc: 'loc474_16902', at: [2224, 3793], soft: true, why: 'aft again for the wallchart' },
        { loc: 'loc474_16902', at: [2224, 3790], soft: true, why: 'and the second door' },
        { go: [SYM_WALLCHART[0], SYM_WALLCHART[1] - 1], r: 48, why: 'to the chart in the aft room' },
        { useLoc: 'loc474_16975', at: SYM_WALLCHART, obj: 'lunar_emerald_lantern_lit', want: 'last of the five', why: 'the wallchart, and the last of them' },
        { stage: 70 },

        { go: [BENTLEY[0], BENTLEY[1]], r: 32, why: 'back to Bentley with a clean ship' },
        { talk: 'captain_bentley', picks: ['Can we sail to Lunar Isle'], want: 'Lunar Isle', why: 'sail north' },
        { stage: 80 },

        { note: 'wiki step 5: the Oneiromancer, in her hut south of the village' },
        { setpos: ONEIRO, why: 'to the Oneiromancer' },
        { talk: 'oneiromancer', want: 'waking sleep potion', why: 'she names the three things' },
        { stage: 90 },

        { note: "wiki steps 6-8: the waking sleep potion. Baba Yaga's own vial, filled at the" },
        { note: "island's water source, then guam, marrentill and a ground Suqah tooth." },
        { setpos: BABA, why: "to Baba Yaga's house" },
        { talk: 'baba_yaga', picks: ['Oneiromancer told me'], want: 'vial', why: 'ask for the vial' },
        { has: 'lunar_empty_vial' },
        { setpos: [WATER_SOURCE[0], WATER_SOURCE[1] - 1, 0], why: 'to the water source' },
        { useLoc: 'loc474_16643', at: WATER_SOURCE, obj: 'lunar_empty_vial', why: 'fill it' },
        { has: 'lunar_vial_water' },
        { use: ['guam_leaf', 'lunar_vial_water'], why: 'guam in' },
        { has: 'lunar_guam_vial' },
        { use: ['marentill', 'lunar_guam_vial'], why: 'and marrentill' },
        { has: 'lunar_guam_marr_vial' },

        { note: "the tooth comes off a Suqah, and so do the four hides and Meteora's tiara" },
        { setpos: SUQAH, why: 'to the Suqah on the east of the island' },
        { fight: 'suqah', until: 'suqah_tooth', tries: 4, r: 24, why: 'kill a Suqah for a tooth' },
        { take: 'suqah_tooth', r: 8, why: 'take the tooth' },
        { take: 'suqah_hide', r: 8, why: 'and the hide' },
        { use: ['pestle_and_mortar', 'suqah_tooth'], why: 'grind the tooth' },
        { has: 'lunar_ground_tooth' },
        { use: ['lunar_ground_tooth', 'lunar_guam_marr_vial'], why: 'and the potion is made' },
        { has: 'lunar_waking_sleep_vial' },
        { setpos: ONEIRO, why: 'back to the Oneiromancer' },
        { talk: 'oneiromancer', why: 'hand the potion over' },
        { hasnt: 'lunar_waking_sleep_vial' },
        { stage: 100 },

        { note: 'wiki step 9: the Lunar staff - a Dramen staff at the air, fire, water and earth' },
        { note: 'altars, in that order and only in that order. Those four are their own regions and' },
        { note: 'a ruin or a talisman is the only way in, in the real game as here.' },
        { setpos: [2843, 4835, 0], why: 'to the air altar' },
        { useLoc: 'air_altar', at: [2843, 4833], obj: 'dramen_staff', why: 'air first' },
        { has: 'lunar_staff_pt1' },
        { setpos: [2584, 4839, 0], why: 'to the fire altar' },
        { useLoc: 'fire_altar', at: [2584, 4837], obj: 'lunar_staff_pt1', why: 'then fire' },
        { has: 'lunar_staff_pt2' },
        { setpos: [2715, 4837, 0], why: 'to the water altar' },
        { useLoc: 'water_altar', at: [2715, 4835], obj: 'lunar_staff_pt2', why: 'then water' },
        { has: 'lunar_staff_pt3' },
        { setpos: [2657, 4842, 0], why: 'to the earth altar' },
        { useLoc: 'earth_altar', at: [2657, 4840], obj: 'lunar_staff_pt3', why: 'and earth last' },
        { has: 'lunar_staff' },
        { setpos: ONEIRO, why: 'back to the Oneiromancer' },
        { talk: 'oneiromancer', picks: ['Exit'], why: 'hand the staff over' },
        { hasnt: 'lunar_staff' },
        { stage: 110 },

        { note: 'wiki step 10a: the helm. Lunar ore out of the stalagmites in the mine under the' },
        { note: "island, smelted in Rellekka and hammered on an anvil. Rellekka's own three" },
        { note: 'viking_anvil locs are scenery in the 377 cache - no ops, no category - so the' },
        { note: 'nearest anvil that smithing actually owns is the Falador one.' },
        { setpos: MINE, why: 'to the mine under the island' },
        { loc: 'loc474_16680', at: STALAGMITE, want: 'lunar ore', why: 'mine a stalagmite' },
        { has: 'lunar_ore' },
        { setpos: [FURNACE[0], FURNACE[1] + 3, 0], why: 'to the Rellekka furnace' },
        { useLoc: 'viking_furnace', at: FURNACE, obj: 'lunar_ore', why: 'smelt the ore' },
        { has: 'lunar_bar' },
        { setpos: ANVIL, why: 'to an anvil' },
        { useLoc: 'anvil', at: [ANVIL[0], ANVIL[1]], obj: 'lunar_bar', why: 'hammer out the helm' },
        { has: 'lunar_helm' },

        { note: 'wiki step 10b: four Suqah hides, tanned by Rimae for 100gp each, then sewn' },
        { setpos: SUQAH, why: 'back to the Suqah' },
        { fight: 'suqah', until: 'suqah_hide', tries: 4, r: 24, why: 'another Suqah' },
        { take: 'suqah_hide', r: 8, why: 'its hide' },
        { fight: 'suqah', until: 'suqah_hide', tries: 4, r: 24, why: 'a third' },
        { take: 'suqah_hide', r: 8, why: 'its hide' },
        { fight: 'suqah', until: 'suqah_hide', tries: 4, r: 24, why: 'and a fourth' },
        { take: 'suqah_hide', r: 8, why: 'its hide' },
        { has: 'suqah_hide', n: 4 },
        { setpos: RIMAE, why: 'to Rimae Sirsalis' },
        { talk: 'rimae_sirsalis', picks: ['ceremonial clothes', 'fair deal'], want: 'pleasure doing business', why: 'have them tanned at 100gp a hide' },
        { has: 'suqah_leather', n: 4 },
        { use: ['needle', 'suqah_leather'], picks: ['Lunar torso'], why: 'sew the torso' },
        { use: ['needle', 'suqah_leather'], picks: ['Lunar trousers'], why: 'the trousers' },
        { use: ['needle', 'suqah_leather'], picks: ['Lunar gloves'], why: 'the gloves' },
        { use: ['needle', 'suqah_leather'], picks: ['Lunar boots'], why: 'and the boots' },
        { has: 'lunar_torso' },
        { has: 'lunar_legs' },
        { has: 'lunar_gloves' },
        { has: 'lunar_boots' },

        { note: "wiki step 10c: Pauline Polaris's riddle, for the cape" },
        { setpos: PAULINE, why: 'to Pauline Polaris' },
        { talk: 'pauline_polaris', picks: ['Pauline', 'Jane Blud-Hagic-Maid'], want: 'cape', why: 'answer the riddle' },
        { has: 'lunar_cape' },

        { note: 'wiki step 10d: Meteora wants her tiara back, and a Suqah has it' },
        { setpos: METEORA, why: 'to Meteora' },
        { talk: 'meteora', want: 'tiara', why: 'she asks for it' },
        { setpos: SUQAH, why: 'back to the Suqah' },
        { fight: 'suqah', until: 'lunar_special_tiara', tries: 6, r: 24, why: 'the Suqah that took it' },
        { take: 'lunar_special_tiara', r: 8, why: 'take the tiara' },
        { setpos: METEORA, why: 'back to Meteora' },
        { useNpc: 'meteora', obj: 'lunar_special_tiara', want: 'amulet', why: 'trade it for the amulet' },
        { has: 'lunar_amulet' },

        { note: "wiki step 10e: Selene's clue, and the ring under the blue flowers" },
        { setpos: SELENE, why: 'to Selene' },
        { talk: 'selene', why: 'ask about the ring' },
        { setpos: RING_DIG, why: 'to the blue flowers' },
        { held: 'spade', op: 1, want: 'ring', why: 'dig' },
        { has: 'lunar_ring' },

        { note: 'wiki step 11: all eight pieces to the Oneiromancer, who gives them back with the' },
        { note: 'kindling and the staff and the potion' },
        { setpos: ONEIRO, why: 'back to the Oneiromancer' },
        { useNpc: 'oneiromancer', obj: 'lunar_helm', why: 'the helm' },
        { useNpc: 'oneiromancer', obj: 'lunar_torso', why: 'the torso' },
        { useNpc: 'oneiromancer', obj: 'lunar_legs', why: 'the trousers' },
        { useNpc: 'oneiromancer', obj: 'lunar_gloves', why: 'the gloves' },
        { useNpc: 'oneiromancer', obj: 'lunar_boots', why: 'the boots' },
        { useNpc: 'oneiromancer', obj: 'lunar_cape', why: 'the cape' },
        { useNpc: 'oneiromancer', obj: 'lunar_amulet', why: 'the amulet' },
        { useNpc: 'oneiromancer', obj: 'lunar_ring', why: 'and the ring' },
        { varis: 'lunar_pieces', to: 255 },
        { has: 'lunar_kindling' },
        { has: 'lunar_staff' },
        { has: 'lunar_waking_sleep_vial' },
        { stage: 120 },

        { note: 'wiki step 12: soak the kindling, put the whole outfit on, light the brazier and' },
        { note: 'burn the kindling on it. Out of uniform it burns for nothing.' },
        { use: ['lunar_waking_sleep_vial', 'lunar_kindling'], why: 'soak the kindling' },
        { has: 'lunar_soaked_kindling' },
        { held: 'lunar_helm', op: 2, why: 'the helm on' },
        { held: 'lunar_torso', op: 2, why: 'the torso' },
        { held: 'lunar_legs', op: 2, why: 'the trousers' },
        { held: 'lunar_gloves', op: 2, why: 'the gloves' },
        { held: 'lunar_boots', op: 2, why: 'the boots' },
        { held: 'lunar_cape', op: 2, why: 'the cape' },
        { held: 'lunar_amulet', op: 2, why: 'the amulet' },
        { held: 'lunar_ring', op: 2, why: 'the ring' },
        { held: 'lunar_staff', op: 2, why: 'and the staff' },
        { worn: 'lunar_helm' },
        { worn: 'lunar_staff' },
        { setpos: BRAZIER_STAND, why: 'to the ceremonial brazier' },
        { useLoc: 'loc474_16810', at: BRAZIER, obj: 'tinderbox', why: 'light the brazier' },
        { useLoc: 'loc474_16810', at: BRAZIER, obj: 'lunar_soaked_kindling', why: 'and burn the kindling' },
        { stage: 130 },
        { level: 2 },

        { note: 'THE DREAM WORLD. The six challenges are solved for real in tools/sim/lunar.ts -' },
        { note: "a search over the dice states, the Numerator's sixteen sequences, the hurdle" },
        { note: 'pattern table - which is not something a step list can hold. What the walk tests' },
        { note: 'here is that the player arrives on the central platform on their own feet, that' },
        { note: 'the Ethereal Being is standing on it, that Me can be fought, and that the lectern' },
        { note: 'is the way out.' },
        { talk: 'ethereal_being', want: 'land of your own', why: 'he explains the dream' },
        { setvar: 'lunar_dream', to: 63, why: '^lunar_dream_all - the six lessons, per lunar.ts' },
        { rng: null, why: 'real rolls for the fight' },
        { talk: 'ethereal_being', picks: ["Of course. I'm ready."], want: 'wearing your clothes', why: 'face the last challenge' },
        { nearnpc: 'lunar_me', r: 20, why: 'Me is standing there' },
        { fight: 'lunar_me', untilvar: 'lunar_quest', to: 140, tries: 6, r: 20, why: 'beat yourself' },
        { stage: 140 },

        { note: 'wiki step 14: the book of your life, on the lectern, is the only way out' },
        { setpos: DREAM_CENTRE, why: 'back to the middle' },
        { loc: 'loc474_16599', at: LECTERN, picks: ['Read and return to reality.'], why: 'read the book' },
        { level: 0 },

        { note: 'wiki step 15: back to the Oneiromancer' },
        { setpos: ONEIRO, why: 'to the Oneiromancer' },
        { talk: 'oneiromancer', why: 'tell her it is done' },
        { stage: 150 },
        { has: 'astralrune', n: 50 },
        { varis: 'lunar_unlocked', to: 1 }
    ]
};

const p: any = H.makePlayer('lunarrun', m.start[0], m.start[1]);
H.tick(2);
p.teleport(m.start[0], m.start[1], m.start[2]);
p.applyDamage = function () {};
H.setVar(p, 'macro_event', 1);
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
