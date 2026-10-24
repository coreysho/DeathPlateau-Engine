// WATCH TOWER, played through on foot.
//
// Quest 96 of the quest-by-quest pass, and the second in a row with no sim of any kind behind it.
// 2,124 lines of content across eight scripts, three ogre tribes, a city with four gates, six
// skavid caves, a language to learn and an enclave under the Feldip Hills.
//
// Three things in it are dice rolls and are pinned:
//   the rock cake  the stall checks for the Ogre trader within three tiles, and he has
//                  wanderrange=2 - so whether you can steal it depends on where he happens to be
//   the mad skavid he recites one of four phrases at random and only one answer fits
//   the ogre chest shuttanoth chest 2 holds one of eight things, three of which are hostile
//
// The crystals are NOT placed on the four pillars the OSRS guide describes: this content follows
// RSC and 2006, where you SHOW each crystal to the wizard and then throw the lever. See
// [opnpcu,watchtower_wizard].
//
//   NODE_MEMBERS=true npx tsx tools/sim/quest_watchtower_run.ts
import * as H from './harness.js';
import { play, Manifest, Step } from './questrun.js';

await H.boot();

// --- the Watchtower, Yanille
const TOWER_FOOT: [number, number, number] = [2544, 3112, 0];
const TOWER_LADDER: [number, number] = [2544, 3111]; // towerladder, L0 -> L1 (quest started only)
// BEFORE THE QUEST STARTS the tower guard will not let you up the ladder - "That's private
// that is" - which is why the wiki's first step is the trellis on the north wall. Agility 18.
const TRELLIS: [number, number] = [2548, 3119]; // loc_2299 -> L1 2548,3117
const LADDER_UP: [number, number] = [2549, 3111]; // watchladderup, L1 -> L2
const LADDER_DOWN: [number, number] = [2549, 3111]; // watchladderdown, L2 -> L1
const LADDER_TOP: [number, number] = [2544, 3111]; // laddertop, L1 -> L0
const WIZARD: [number, number, number] = [2549, 3113, 2];
const LEVER: [number, number] = [2543, 3115]; // watchleverup, L2
const NAIL_BUSH: [number, number] = [2544, 3134]; // watchtowerbushnail

// --- the three ogre tribes
const OG: [number, number, number] = [2506, 3117, 0];
const ROPE_TREE: [number, number] = [2499, 3087]; // loc_2326, the long-branched tree
const GREW: [number, number, number] = [2513, 3085, 0];
const TOBAN_TUNNEL: [number, number] = [2499, 2989]; // tobancave -> 2576,3029
const TOBAN: [number, number, number] = [2576, 3029, 0];
const GORAD: [number, number, number] = [2577, 3023, 0];
const TOBAN_CHEST: [number, number] = [2575, 3031];

// --- Gu'Tanoth
const GUT_HILL: [number, number, number] = [2546, 3065, 0]; // ^gutanoth_hill
const GUARD2: [number, number, number] = [2505, 3063, 0]; // the north-west gate
const STALL: [number, number] = [2506, 3023]; // rockcounter_withcakes
const GUARD3: [number, number, number] = [2502, 3013, 0];
const JUMP: [number, number] = [2530, 3026]; // tanothjump1, plane 1 but LINK_BELOW
const CITY_GUARD: [number, number, number] = [2542, 3030, 0];
const ENCLAVE_GUARD: [number, number, number] = [2506, 3038, 0];

// --- the skavid caves (m39_147)
const CAVE5: [number, number] = [2553, 3033]; // -> 2504,9441, the scared skavid's cave
const SCARED: [number, number, number] = [2500, 9434, 0];
const CAVE2: [number, number] = [2522, 3068]; // -> 2532,9469
const TALKER1: [number, number, number] = [2530, 9464, 0];
const CAVE3: [number, number] = [2539, 3052]; // -> 2518,9455
const TALKER2: [number, number, number] = [2516, 9452, 0];
const CAVE4: [number, number] = [2552, 3052]; // -> 2498,9451
const TALKER3: [number, number, number] = [2501, 9451, 0];
const CAVE1: [number, number] = [2560, 3022]; // -> 2498,9418
const TALKER4: [number, number, number] = [2504, 9415, 0];
const CAVE6: [number, number] = [2527, 3011]; // -> 2522,9411, the mad skavid's cave
const MAD: [number, number, number] = [2523, 9412, 0];
const NIGHTSHADE: [number, number, number] = [2528, 9415, 0];

// --- the ogre enclave (m40_147)
const ENCLAVE_IN: [number, number, number] = [2588, 9410, 0]; // where the guard's nightshade lands you
const SHAMANS: [number, number, number][] = [
    [2577, 9451, 0],
    [2582, 9437, 0],
    [2592, 9436, 0],
    [2599, 9461, 0],
    [2606, 9438, 0],
    [2607, 9451, 0]
];
const DALGROTH: [number, number] = [2590, 9449]; // rock_of_dalgroth
const ENCLAVE_OUT: [number, number] = [2598, 9468]; // enclavecave -> 2540,3054

const m: Manifest = {
    quest: 'WATCH TOWER',
    source: 'oldschool.runescape.wiki/w/Watchtower/Quick_guide',
    stageVar: 'itwatchtower',
    done: 13, // ^itwatchtower_complete
    start: TOWER_FOOT,
    steps: [
        { note: 'no quest requirements. Skills: Magic 14, Thieving 15, Agility 25 (18 for the' },
        { note: 'trellis), Herblore 14, Mining 40, and enough to kill a level 68 ogre.' },
        { note: 'items: 20 coins for the bridge toll, a gold bar for the east gate, a death rune' },
        { note: 'for the city guard, dragon bones for Toban, two ropes, a pickaxe, a lit light' },
        { note: 'source for the caves, and the three potion ingredients.' },
        { give: 'coins', n: 100 },
        { give: 'gold_bar' },
        { give: 'deathrune' },
        { give: 'dragon_bones' },
        { give: 'rope', n: 2 },
        { give: 'rune_pickaxe' },
        { give: 'bullseye_lantern_lit' },
        { give: 'guam_leaf' },
        { give: 'vial_water' },
        { give: 'jangerberries' },
        { give: 'bat_bones' },
        { give: 'pestle_and_mortar' },

        { note: 'every roll is pinned at 0.3: the mad skavid recites phrase 1 ("Bidith ig...",' },
        { note: 'answer "Cur.") and the ogre chest gives the emerald rather than a spider.' },
        { rng: 0.3, why: 'the skavid and the chest' },

        { note: 'the potion is Herblore, and all Herblore wants Druidic Ritual behind it -' },
        { note: '~herblore_requires_druidic_ritual, which is why mixing the guam said nothing' },
        { note: 'at all on the first run.' },
        { setvar: 'druidquest', to: 4, why: '^druid_complete' },

        { note: 'wiki steps 1-2: up the Watchtower to the wizard on the top floor' },
        { note: 'the ladder is refused until the quest has started, so the way in is the trellis' },
        { setpos: [TRELLIS[0], TRELLIS[1] + 1, 0], why: 'to the trellis on the north wall' },
        { loc: 'loc_2299', at: TRELLIS, want: 'in through the window', why: 'climb the trellis' },
        { level: 1 },
        { loc: 'watchladderup', at: LADDER_UP, why: 'up to the top floor' },
        { level: 2 },
        {
            talk: 'watchtower_wizard',
            picks: ["What's the matter?", "So how come the spell doesn't work?", 'Can I be of help?'],
            want: 'searching the surrounding area',
            why: 'take the job'
        },
        { stage: 1 },

        { note: 'wiki step 3: the far north-west bush holds a skavid\'s fingernails' },
        { loc: 'watchladderdown', at: LADDER_DOWN, why: 'down to the middle floor' },
        { loc: 'laddertop', at: LADDER_TOP, why: 'and down to the ground' },
        { level: 0 },
        { setpos: [NAIL_BUSH[0], NAIL_BUSH[1] - 1, 0], why: 'to the north-west bushes' },
        { loc: 'watchtowerbushnail', at: NAIL_BUSH, want: 'fingernails', why: 'search the bush' },
        { has: 'fingernails' },

        { note: 'wiki step 4: the wizard reads the nails and names the ogre tribes' },
        { setpos: TOWER_FOOT, why: 'back to the tower' },
        { loc: 'towerladder', at: TOWER_LADDER, why: 'up' },
        { loc: 'watchladderup', at: LADDER_UP, why: 'and up again' },
        {
            talk: 'watchtower_wizard',
            picks: ['What do you suggest I do?', 'So what do I do?'],
            want: 'ogre settlements',
            why: 'hand over the nails'
        },
        { stage: 2 },
        { loc: 'watchladderdown', at: LADDER_DOWN, why: 'down' },
        { loc: 'laddertop', at: LADDER_TOP, why: 'and down' },

        { note: "wiki step 5: Og, north-west of Yanille, wants his gold back off Toban and gives" },
        { note: 'you the key to the chest it is in' },
        { setpos: OG, why: 'to Og' },
        { talk: 'og', picks: ['I seek entrance to the city of ogres.'], want: 'key to the chest', why: 'take the job' },
        { has: 'toban_key' },

        { note: "wiki steps 6-7: a rope on the long-branched tree swings you to Grew's island" },
        { setpos: [ROPE_TREE[0] + 2, ROPE_TREE[1], 0], why: 'to the long-branched tree' },
        { note: 'the swing lands you on the island, which is six tiles east of the tree - so the' },
        { note: 'step is soft: a player who ends up anywhere but beside the tree has worked.' },
        { useLoc: 'loc_2326', at: ROPE_TREE, obj: 'rope', want: 'swing across', soft: true, why: 'swing over' },
        { go: [GREW[0], GREW[1] - 1], why: "across Grew's island on foot" },
        { talk: 'grew', picks: ['Don\'t eat me; I can help you.'], want: 'knock one of his teeth out', why: 'take the job' },

        { note: 'wiki steps 8-9: the tunnel south of Gu\'Tanoth comes out in Toban\'s camp, where' },
        { note: 'Gorad is. Killing him knocks the tooth out.' },
        { setpos: [TOBAN_TUNNEL[0], TOBAN_TUNNEL[1] + 1, 0], why: 'to the tunnel to Toban' },
        { loc: 'tobancave', at: TOBAN_TUNNEL, want: 'tunnel went a long way', why: 'through the tunnel' },
        { setpos: GORAD, why: "to Gorad's hut" },
        { fight: 'gorad', until: 'ogretooth', tries: 2, r: 12, why: 'kill Gorad' },
        { has: 'ogretooth' },

        { note: 'wiki steps 10-11: Toban wants adult dragon bones, and his chest holds Og\'s gold' },
        { setpos: TOBAN, why: 'to Toban' },
        {
            talk: 'toban',
            picks: ['I seek entrance to the city of ogres.', 'I could do something for you...'],
            want: 'bones of an adult dragon',
            why: 'take the job'
        },
        { useNpc: 'toban', obj: 'dragon_bones', want: 'part of a statue', why: 'hand over the bones' },
        { has: 'relicpart3' },
        { setpos: [TOBAN_CHEST[0], TOBAN_CHEST[1] + 1, 0], why: "to Toban's chest" },
        { useLoc: 'tobanchest', at: TOBAN_CHEST, obj: 'toban_key', want: 'stash of gold', why: 'unlock it' },
        { has: 'stolen_gold' },

        { note: 'wiki step 12: Grew swaps the tooth for a relic part AND the first crystal' },
        { setpos: [ROPE_TREE[0] + 2, ROPE_TREE[1], 0], why: 'back to the tree' },
        { useLoc: 'loc_2326', at: ROPE_TREE, obj: 'rope', soft: true, why: 'swing over again' },
        { go: [GREW[0], GREW[1] - 1], why: 'back across the island' },
        { useNpc: 'grew', obj: 'ogretooth', want: 'one of the crystals', why: 'hand over the tooth' },
        { has: 'relicpart2' },
        { has: 'powering_crystal1' },

        { note: 'wiki step 13: Og swaps his gold for the third relic part' },
        { setpos: OG, why: 'back to Og' },
        { useNpc: 'og', obj: 'stolen_gold', want: 'friend to the ogres', why: 'hand over the gold' },
        { has: 'relicpart1' },

        { note: 'wiki step 14: the wizard assembles the three parts into the ogre relic' },
        { setpos: TOWER_FOOT, why: 'back to the tower' },
        { loc: 'towerladder', at: TOWER_LADDER, why: 'up' },
        { loc: 'watchladderup', at: LADDER_UP, why: 'and up' },
        { useNpc: 'watchtower_wizard', obj: 'relicpart1', why: 'the first part' },
        { useNpc: 'watchtower_wizard', obj: 'relicpart2', why: 'the second' },
        { useNpc: 'watchtower_wizard', obj: 'relicpart3', want: 'complete statue', why: 'and the third' },
        { stage: 3 },
        { has: 'ogrerelic' },
        { loc: 'watchladderdown', at: LADDER_DOWN, why: 'down' },
        { loc: 'laddertop', at: LADDER_TOP, why: 'and down' },

        { note: "wiki step 15: the north-west gate. The guard throws you down the hill the first" },
        { note: 'time whatever you are carrying, and only looks at the relic on the second.' },
        { setpos: GUARD2, why: "to Gu'Tanoth's north-west gate" },
        { talk: 'ogre_guard2', want: 'back to whence you came', why: 'he throws you down the hill' },
        { setpos: GUARD2, why: 'back up the hill' },
        { useNpc: 'ogre_guard2', obj: 'ogrerelic', want: 'friend of the ogres', why: 'show him the relic' },
        { stage: 4 },

        { note: 'wiki steps 16-17: a rock cake off the southern counter, and the battlement guards' },
        { note: 'want it. The stall refuses while the Ogre trader is within three tiles and he has' },
        { note: 'wanderrange=2, so this is a retry until he wanders off.' },
        { setpos: [STALL[0], STALL[1] + 1, 0], why: 'to the market' },
        { loc: 'rockcounter_withcakes', at: STALL, until: 'rockcake', tries: 10, why: 'steal a rock cake' },
        { has: 'rockcake' },
        { setpos: GUARD3, why: 'to the battlement' },
        { talk: 'ogre_guard3', picks: ['But I am a friend to ogres...'], want: 'something from the market', why: 'they want a gift' },
        { useNpc: 'ogre_guard3', obj: 'rockcake', want: 'rock cake', why: 'give them the cake' },

        { note: 'wiki step 18: the bridge north-east, and twenty coins. tanothjump1 sits on plane 1' },
        { note: 'of m39_47 with its tile flagged LINK_BELOW, so it is a plane-0 click at runtime.' },
        { setpos: [JUMP[0], JUMP[1] - 1, 0], why: 'to the broken bridge' },
        { loc: 'tanothjump1', at: JUMP, picks: ["Okay, I'll pay it."], want: 'jump across the chasm', why: 'pay the toll and jump' },

        { note: 'wiki steps 19-20: a city guard sets a riddle whose answer is a death rune' },
        { setpos: CITY_GUARD, why: 'to the city guards' },
        { talk: 'city_guard', picks: ['I seek passage into the skavid caves.'], want: 'how long I wonder', why: 'hear the riddle' },
        { stage: 5 },
        { useNpc: 'city_guard', obj: 'deathrune', want: 'gives you a map', why: 'answer it with a death rune' },
        { stage: 6 },
        { has: 'skavidmap' },

        { note: 'wiki step 22: the scared skavid teaches the five common words' },
        { setpos: [CAVE5[0], CAVE5[1] + 1, 0], why: 'to the fifth skavid cave' },
        { loc: 'skavid_cave5', at: CAVE5, want: 'enter the cave', why: 'in' },
        { setpos: SCARED, why: 'to the scared skavid' },
        { talk: 'scared_skavid', picks: ["Okay, okay, I'm not going to hurt you."], want: 'Ar, nod, gor, ig, cur', why: 'he teaches you skavid' },

        { note: 'wiki step 23: the four talking skavids, one word each, each in its own cave' },
        { setpos: [CAVE2[0], CAVE2[1] + 1, 0], why: 'to the second cave' },
        { loc: 'skavid_cave2', at: CAVE2, why: 'in' },
        { setpos: TALKER1, why: 'to the skavid' },
        { talk: 'skavidtalker1', picks: ['Ig.'], want: 'understood you', why: '"Cur bidith" wants "Ig"' },
        { setpos: [CAVE3[0], CAVE3[1] + 1, 0], why: 'to the third cave' },
        { loc: 'skavid_cave3', at: CAVE3, why: 'in' },
        { setpos: TALKER2, why: 'to the skavid' },
        { talk: 'skavidtalker2', picks: ['Ar.'], want: 'understood you', why: '"Gor cur" wants "Ar"' },
        { setpos: [CAVE4[0], CAVE4[1] + 1, 0], why: 'to the fourth cave' },
        { loc: 'skavid_cave4', at: CAVE4, why: 'in' },
        { setpos: TALKER3, why: 'to the skavid' },
        { talk: 'skavidtalker3', picks: ['Cur.'], want: 'understood you', why: '"Bidith tanath" wants "Cur"' },
        { setpos: [CAVE1[0], CAVE1[1] + 1, 0], why: 'to the first cave' },
        { loc: 'skavid_cave1', at: CAVE1, why: 'in' },
        { setpos: TALKER4, why: 'to the skavid' },
        { talk: 'skavidtalker4', picks: ['Nod.'], want: 'understood you', why: '"Tanath gor" wants "Nod"' },

        { note: 'wiki step 25: the mad skavid, in the cave inside the city, has the second crystal' },
        { setpos: [CAVE6[0], CAVE6[1] + 1, 0], why: "to the cave in Gu'Tanoth" },
        { loc: 'skavid_cave6', at: CAVE6, why: 'in' },
        { setpos: MAD, why: 'to the mad skavid' },
        { talk: 'mad_skavid', picks: ['Cur.'], want: 'take this prize', why: 'answer him' },
        { stage: 7 },
        { has: 'powering_crystal2' },

        { note: 'wiki step 26: two cave nightshade grow in this cave - they are ground spawns in' },
        { note: 'm39_147, at 2528,9415 beside him and at 2530,9462 - and the quest needs two.' },
        { setpos: NIGHTSHADE, why: 'to the nightshade' },
        { take: 'nightshade', r: 4, why: 'pick one' },
        { has: 'nightshade' },

        { note: 'wiki step 27: nightshade on an Enclave guard, back in the city' },
        { setpos: ENCLAVE_GUARD, why: 'to the enclave guard' },
        { useNpc: 'enclave_guard', obj: 'nightshade', want: 'It burns', why: 'the nightshade burns him' },
        { stage: 8 },

        { note: 'wiki step 29: out again, and the wizard explains the potion' },
        { setpos: [ENCLAVE_OUT[0], ENCLAVE_OUT[1] - 1, 0], why: 'to the way out of the enclave' },
        { loc: 'enclavecave', at: ENCLAVE_OUT, why: 'out' },
        { setpos: TOWER_FOOT, why: 'back to the tower' },
        { loc: 'towerladder', at: TOWER_LADDER, why: 'up' },
        { loc: 'watchladderup', at: LADDER_UP, why: 'and up' },
        { talk: 'watchtower_wizard', want: 'ground bat bones', why: 'he names the three ingredients' },
        { stage: 9 },

        { note: 'wiki step 30: guam into water, then jangerberries, then ground bat bones - in that' },
        { note: 'order, or it explodes' },
        { use: ['guam_leaf', 'vial_water'], why: 'guam into the vial' },
        { has: 'guamvial' },
        { use: ['guamvial', 'jangerberries'], want: 'jangerberries into your potion', why: 'then the jangerberries' },
        { has: 'guamjangervial' },
        { use: ['pestle_and_mortar', 'bat_bones'], why: 'grind the bat bones' },
        { has: 'ground_bat_bones' },
        { use: ['ground_bat_bones', 'guamjangervial'], want: 'strong potion', why: 'and the bones last' },
        { has: 'ogre_potion' },

        { note: 'wiki step 31: the wizard puts the magic in it' },
        { useNpc: 'watchtower_wizard', obj: 'ogre_potion', want: 'dangerous substance', why: 'have it enchanted' },
        { stage: 10 },
        { has: 'magic_ogre_potion' },
        { loc: 'watchladderdown', at: LADDER_DOWN, why: 'down' },
        { loc: 'laddertop', at: LADDER_TOP, why: 'and down' },

        { note: 'wiki step 33: the second nightshade gets you back into the enclave' },
        { setpos: [CAVE6[0], CAVE6[1] + 1, 0], why: 'back to the skavid cave' },
        { loc: 'skavid_cave6', at: CAVE6, why: 'in' },
        { setpos: [2530, 9461, 0], why: 'to the second nightshade' },
        { take: 'nightshade', r: 4, why: 'pick the second one' },
        { setpos: [CAVE6[0], CAVE6[1] + 1, 0], why: 'out and back to the city' },
        { setpos: ENCLAVE_GUARD, why: 'to the enclave guard' },
        { useNpc: 'enclave_guard', obj: 'nightshade', want: 'It burns', why: 'and past him again' },

        { note: 'wiki step 34: the potion on all six shamans. The sixth drops the third crystal.' },
        ...(SHAMANS.flatMap((at, i) => [
            { setpos: at, why: 'to shaman ' + (i + 1) },
            {
                useNpc: 'ogre_shaman',
                obj: 'magic_ogre_potion',
                want: i === 5 ? 'A crystal drops' : 'dissolves into spirit form',
                why: 'dissolve it'
            }
        ]) as Step[]),
        { has: 'powering_crystal3' },

        { note: 'wiki step 35: the Rock of Dalgroth, in the middle of the enclave, holds the last' },
        { note: 'one - and will not be touched until all six shamans are gone' },
        { setpos: [DALGROTH[0], DALGROTH[1] - 2, 0], why: 'to the Rock of Dalgroth' },
        { loc: 'rock_of_dalgroth', at: DALGROTH, op: 2, want: 'prise a crystal out', why: 'mine it' },
        { has: 'powering_crystal4' },

        { note: 'wiki step 36: show all four to the wizard' },
        { setpos: [ENCLAVE_OUT[0], ENCLAVE_OUT[1] - 1, 0], why: 'out of the enclave' },
        { loc: 'enclavecave', at: ENCLAVE_OUT, why: 'out' },
        { setpos: TOWER_FOOT, why: 'back to the tower' },
        { loc: 'towerladder', at: TOWER_LADDER, why: 'up' },
        { loc: 'watchladderup', at: LADDER_UP, why: 'and up' },
        { useNpc: 'watchtower_wizard', obj: 'powering_crystal1', why: 'the first crystal' },
        { useNpc: 'watchtower_wizard', obj: 'powering_crystal2', why: 'the second' },
        { useNpc: 'watchtower_wizard', obj: 'powering_crystal3', why: 'the third' },
        { note: 'the fourth one is judged on the stage: the all-crystals dialogue runs off the end of' },
        { note: 'the crystal branch and the use-on step does not see its lines.' },
        { useNpc: 'watchtower_wizard', obj: 'powering_crystal4', why: 'and the fourth' },
        { stage: 11 },

        { note: 'wiki step 37: the lever to the west' },
        { loc: 'watchleverup', at: LEVER, want: 'forcefield activates', why: 'throw the lever' },
        { stage: 13 },
        { has: 'watchtowerspell' },
        { has: 'coins', n: 5080 },
        { note: 'and the scroll teaches the Watchtower Teleport' },
        { held: 'watchtowerspell', op: 1, want: 'Watchtower Teleport', why: 'read the scroll' },
        { varis: 'itwatchtower', to: 14 }
    ]
};

const p: any = H.makePlayer('watchrun', m.start[0], m.start[1]);
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
