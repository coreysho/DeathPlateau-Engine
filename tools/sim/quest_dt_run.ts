// DESERT TREASURE, played through on foot.
//
// Quest 99 of the quest-by-quest pass, and the longest spine in it: a translator, a bandit camp, an
// old man who has waited thirty years, six mirrors, four diamonds in four corners of the world
// behind four bosses, four obelisks, a three-level pyramid maze and a Mahjarrat in a box.
//
// tools/sim/audit3.ts's `dt` section already drives all of it as set pieces - 62 checks, and it is
// the only audit in the directory that walkability-checks every single ladder landing - but nothing
// had ever run it as one continuous go. That is what this is.
//
// Two npc names are the opposite way round from the obvious reading and cost half an hour:
// fourdiamonds_vampire_lord is MALAK, the vampire in Canifis, and `malak` is RUANTUN, the
// silversmith in the Draynor sewers.
//
//   NODE_MEMBERS=true npx tsx tools/sim/quest_dt_run.ts
import * as H from './harness.js';
import { play, Manifest, Step } from './questrun.js';

await H.boot();

// --- the spine
const INDIANA: [number, number, number] = [3178, 3044, 0];
const EXPERT: [number, number, number] = [3355, 3334, 0]; // Terry Balando, the Digsite Exam Centre
const BARTENDER: [number, number, number] = [3159, 2982, 0];
const EBLIS_VILLAGE: [number, number, number] = [3185, 2984, 0];
const EBLIS_MIRRORS: [number, number, number] = [3213, 2957, 0];
const MIRROR1: [number, number] = [3214, 2951];

// --- blood: Malak in Canifis, Ruantun in the Draynor sewers, Dessous north of Castle Drakan
const MALAK: [number, number, number] = [3497, 3479, 0];
const RUANTUN: [number, number, number] = [3112, 9691, 0];
const ENTRANA_PRIEST: [number, number, number] = [2851, 3350, 0];
const DESSOUS_TOMB: [number, number] = [3568, 3401];

// --- ice: the troll child at the ice gate on Trollheim's north-west edge
const TROLL_CHILD: [number, number, number] = [2836, 3741, 0];
const ICE_GATE: [number, number] = [2838, 3739]; // icegate_left
const KAMIL_ARENA: [number, number, number] = [2852, 3732, 0];

// --- smoke: the well west of Pollnivneach, four torches, a chest and Fareed's gate
const SMOKE_WELL: [number, number] = [3310, 2962];
const SMOKE_BOTTOM: [number, number, number] = [3206, 9379, 0];
const TORCHES: [string, [number, number]][] = [
    ['4d_standing_torch1', [3323, 9398]],
    ['4d_standing_torch2', [3321, 9355]],
    ['4d_standing_torch3', [3204, 9350]],
    ['4d_standing_torch4', [3207, 9395]]
];
const FIRE_CHEST: [number, number] = [3248, 9364];
const FAREED_GATE: [number, number] = [3305, 9375];
const FAREED_ARENA: [number, number, number] = [3309, 9375, 0];

// --- shadow: Rasolo by the waterfall, the bandits' locked chest, the ladder you cannot see
const RASOLO: [number, number, number] = [2535, 3433, 0];
const BANDIT_CHEST: [number, number] = [3169, 2967];
const SHADOW_LADDER: [number, number] = [2547, 3421];
const SHADOW_DUNGEON: [number, number, number] = [2629, 5071, 0];
const DAMIS_LAIR: [number, number, number] = [2626, 5065, 0];

// --- the obelisks, the pyramid and the temple
const OBELISKS: [string, string, [number, number]][] = [
    ['desert_treasure_oblix1', 'fd_blood_diamond', [3220, 2909]],
    ['desert_treasure_oblix2', 'fd_diamond_fire', [3244, 2909]],
    ['desert_treasure_oblix3', 'fd_icediamond', [3244, 2885]],
    ['desert_treasure_oblix4', 'fd_dark_diamond', [3220, 2885]]
];
const PYRAMID_DOOR: [number, number] = [3233, 2899];
const PYRAMID_LADDER: [number, number] = [3233, 2897];
const LADDER_3_2: [number, number] = [2909, 4964];
const LADDER_2_1: [number, number] = [2846, 4973];
const LADDER_1_0: [number, number] = [2784, 4941];
const TEMPLE_DOOR: [number, number] = [3234, 9324];
const ALTAR: [number, number] = [3232, 9311];
const AZZANADRA: [number, number, number] = [3233, 9318, 0];
const PORTAL: [number, number] = [3233, 9312];

const m: Manifest = {
    quest: 'DESERT TREASURE',
    source: 'oldschool.runescape.wiki/w/Desert_Treasure/Quick_guide',
    stageVar: 'deserttreasure',
    done: 15, // ^deserttreasure_complete
    start: INDIANA,
    steps: [
        { note: 'six quests gate the start, and Indiana checks every one of them before he will' },
        { note: 'hand over the etchings' },
        { setvar: 'itexamlevel', to: 9, why: '^itexam_complete' },
        { setvar: 'ikov', to: 80, why: '^ikov_completed_armadyl' },
        { setvar: 'troll_quest', to: 50, why: '^troll_complete' },
        { setvar: 'priestperil', to: 60, why: '^priestperil_complete' },
        { setvar: 'waterfall_quest', to: 10, why: '^waterfall_complete' },
        { setvar: 'desertrescue', to: 30, why: '^desertrescue_complete' },
        { note: 'skills: Magic 50 for the obelisks, Firemaking 50 for the smoke torches,' },
        { note: 'Thieving 53 for the bandits\' three-lock chest. maxOut covers all three.' },

        { note: 'THE KIT DOES NOT FIT IN ONE INVENTORY. Six molten glass, six steel bars and the' },
        { note: 'lockpicks are unstackable, so handing the whole quest out at the start left' },
        { note: 'inv_freespace at 0 - and Indiana will not pass over the etchings to a player with' },
        { note: 'no room, which is a real check and not a harness problem. Each leg is handed what' },
        { note: 'it needs when it needs it.' },
        { give: 'coins', n: 1000 },


        { note: 'wiki step 1: Indiana, digging in the desert north of the bandit camp' },
        { setpos: INDIANA, why: 'to Indiana' },
        { talk: 'fourdiamonds_indiana', picks: ['What are you doing out here?'], want: 'Archaeological Expert', why: 'take the etchings' },
        { stage: 1 },
        { has: 'four_diamonds_etchings' },

        { note: 'wiki step 2: the Archaeological Expert at the Digsite translates them. He already' },
        { note: 'has Dig Site dialogue of his own, so this is a use-item and not a talk-to.' },
        { setpos: EXPERT, why: 'to the Digsite Exam Centre' },
        { useNpc: 'archaeological_expert', obj: 'four_diamonds_etchings', want: 'sealed tomb', why: 'have them translated' },
        { stage: 2 },
        { has: 'four_diamonds_translation_primer' },

        { note: 'wiki step 3: Indiana reads it and sends you to the bandit camp' },
        { setpos: INDIANA, why: 'back to Indiana' },
        { talk: 'fourdiamonds_indiana', want: 'bandit camp', why: 'he names the camp' },
        { stage: 3 },

        { note: 'wiki step 4: the bartender will not talk to a stranger who has not bought a drink' },
        { setpos: BARTENDER, why: 'to the bandit camp bar' },
        { talk: 'fourdiamonds_bartender', picks: ["A bandit's brew, please."], want: 'for an outsider', why: 'buy the brew' },
        { stage: 4 },
        { talk: 'fourdiamonds_bartender', picks: ["I'm looking for four diamonds."], want: 'talk to Eblis', why: 'ask about the diamonds' },

        { note: 'wiki step 5: Eblis, on the east side of the camp, wants a scrying glass built' },
        { setpos: EBLIS_VILLAGE, why: 'to Eblis' },
        { talk: 'fourdiamonds_elder', want: 'scrying glass', why: 'hear the story' },
        { stage: 5 },

        { note: 'twelve magic logs, six glass and six bars are twenty-four unstackable slots on' },
        { note: 'their own, so the four single items come after those three are handed over.' },
        { give: 'magic_logs', n: 12 },
        { give: 'molten_glass', n: 6 },
        { give: 'steel_bar', n: 6 },
        { note: 'wiki step 6: twelve magic logs, six molten glass, six steel bars, ashes, charcoal,' },
        { note: 'bones and a blood rune. One use-on per kind - he takes as many as you carry.' },
        { useNpc: 'fourdiamonds_elder', obj: 'magic_logs', why: 'the frames' },
        { useNpc: 'fourdiamonds_elder', obj: 'molten_glass', why: 'the glass' },
        { useNpc: 'fourdiamonds_elder', obj: 'steel_bar', why: 'the bars' },
        { give: 'ashes' },
        { give: 'charcoal' },
        { give: 'bones' },
        { give: 'bloodrune' },
        { useNpc: 'fourdiamonds_elder', obj: 'ashes', why: 'ashes' },
        { useNpc: 'fourdiamonds_elder', obj: 'charcoal', why: 'charcoal' },
        { useNpc: 'fourdiamonds_elder', obj: 'bones', why: 'bones' },
        { useNpc: 'fourdiamonds_elder', obj: 'bloodrune', want: 'Give me a day and a night', why: 'and the blood rune' },
        { stage: 10 },

        { note: 'wiki step 7: the six mirrors south-east of the camp. Two of the visions are false -' },
        { note: 'the camp itself and the pyramid - and the mirrors do not exist at all until Eblis' },
        { note: 'builds them: sword_mirrorN resolves to a cactus while fd_mirror_present is 0.' },
        { setpos: EBLIS_MIRRORS, why: 'to the mirrors' },
        { talk: 'fourdiamonds_elder2', want: 'two of the visions are false', why: 'he explains them' },
        { stage: 11 },
        { loc: 'sword_mirror1', at: MIRROR1, want: 'Morytania', why: 'look into the first mirror' },
        { close: true },

        { note: '================ THE DIAMOND OF BLOOD' },
        { note: 'wiki step 8: Malak in Canifis wants Dessous dead, and Dessous will not rise for' },
        { note: 'anything less than fresh blood, blessed and spiced.' },
        { give: 'silver_bar' },
        { give: 'garlic' },
        { give: 'pestle_and_mortar' },
        { give: 'spicespot' },
        { setpos: MALAK, why: 'to Malak' },
        { talk: 'fourdiamonds_vampire_lord', picks: ['Because you want Dessous dead.'], want: 'silver pot', why: 'take the job' },
        { varis: 'fdvw_subquest', to: 1 },
        { note: 'Ruantun is the npc called `malak`, which is the wrong way round and is the content' },
        { note: 'as it stands - he is the silversmith in the Draynor sewers.' },
        { setpos: RUANTUN, why: 'to Ruantun in the sewers' },
        { useNpc: 'malak', obj: 'silver_bar', want: 'silver pot', why: 'have the pot made' },
        { varis: 'fdvw_subquest', to: 2 },
        { has: 'fd_silver_pot' },
        { setpos: ENTRANA_PRIEST, why: 'to the High Priest on Entrana' },
        { useNpc: 'high_priest_of_entrana', obj: 'fd_silver_pot', want: 'blesses the silver pot', why: 'have it blessed' },
        { varis: 'fdvw_subquest', to: 3 },
        { has: 'fd_silver_pot_blessed' },
        { setpos: MALAK, why: 'back to Malak' },
        { talk: 'fourdiamonds_vampire_lord', want: 'fills the blessed pot', why: 'he fills it with your blood' },
        { varis: 'fdvw_subquest', to: 4 },
        { has: 'fd_silver_pot_blood_blessed' },
        { use: ['pestle_and_mortar', 'garlic'], want: 'fine powder', why: 'grind the garlic' },
        { has: 'fd_crushed_garlic' },
        { use: ['fd_crushed_garlic', 'fd_silver_pot_blood_blessed'], why: 'garlic into the pot' },
        { has: 'fd_silver_pot_blood_garlic_blessed' },
        { use: ['spicespot', 'fd_silver_pot_blood_garlic_blessed'], why: 'and the spice' },
        { has: 'fd_silver_pot_blood_garlic_spiced_blessed' },
        { note: 'wiki step 9: pour it on the tomb north of Castle Drakan' },
        { note: 'the tomb is a 5x3 loc and the rock it is cut into blocks everything south, east' },
        { note: 'and west of it - the only tiles beside it are z=3404, x 3568-3571, to the NORTH.' },
        { setpos: [3569, 3405, 0], why: "to Dessous's tomb, from the north" },
        { loc: 'vampire_big_grave_noblood', at: DESSOUS_TOMB, want: 'shallow basin', why: 'look at it' },
        { close: true },
        {
            useLoc: 'vampire_big_grave_noblood',
            at: DESSOUS_TOMB,
            obj: 'fd_silver_pot_blood_garlic_spiced_blessed',
            want: 'pour the pot',
            why: 'pour it over the tomb'
        },
        { varis: 'fdvw_subquest', to: 5 },
        { nearnpc: 'blooddiamond_vampirewarrior', r: 12, why: 'Dessous rises' },
        { fight: 'blooddiamond_vampirewarrior', untilvar: 'fdvw_subquest', to: 6, tries: 6, r: 14, why: 'kill Dessous' },
        { setpos: MALAK, why: 'back to Malak' },
        { talk: 'fourdiamonds_vampire_lord', want: 'Diamond of Blood', why: 'collect the diamond' },
        { varis: 'fdvw_subquest', to: 7 },
        { has: 'fd_blood_diamond' },

        { note: '================ THE DIAMOND OF ICE' },
        { note: "wiki step 10: the troll child at the ice gate. A sweet buys the way past, and" },
        { note: 'giving it is what puts Kamil in his arena.' },
        { give: 'cake' },
        { setpos: TROLL_CHILD, why: 'to the troll child' },
        { talk: 'fourdiamonds_troll_child', want: 'want sweet', why: 'hear what happened' },
        { useNpc: 'fourdiamonds_troll_child', obj: 'cake', want: 'go past gate', why: 'give him the cake' },
        { varis: 'fd_icewarrior_subquest', to: 1 },
        { loc: 'icegate_left', at: ICE_GATE, want: 'squeeze through the ice gate', why: 'through the gate' },
        { note: 'wiki step 11: Kamil. His death is what thaws both parents.' },
        { setpos: KAMIL_ARENA, why: "to Kamil's arena" },
        { fight: 'icediamond_icewarrior', untilvar: 'fd_icewarrior_subquest', to: 4, tries: 6, r: 20, why: 'kill Kamil' },
        { setpos: TROLL_CHILD, why: 'back to the troll child' },
        { talk: 'fourdiamonds_troll_child', want: 'Diamond of Ice', why: 'collect the diamond' },
        { varis: 'fd_icewarrior_subquest', to: 5 },
        { has: 'fd_icediamond' },

        { note: '================ THE DIAMOND OF SMOKE' },
        { note: 'wiki step 12: the well west of Pollnivneach. The smoke needs a mask - a gasmask, a' },
        { note: "slayer facemask or a slayer helmet - and a lap of four torches has four minutes in" },
        { note: 'it before the first one burns out, which is about 510 tiles of running.' },
        { give: 'gasmask' },
        { give: 'tinderbox' },
        { give: 'ice_gloves' },
        { held: 'gasmask', op: 2, why: 'wear the gasmask' },
        { worn: 'gasmask' },
        { setpos: [SMOKE_WELL[0], SMOKE_WELL[1] - 1, 0], why: 'to the smokey well' },
        { loc: 'sword_haunted_well', at: SMOKE_WELL, want: 'climb down into the smoke', why: 'down the well' },
        ...(TORCHES.flatMap(([name, at], i) => [
            { setpos: [at[0], at[1] - 1, 0], why: 'to torch ' + (i + 1) },
            { loc: name, at, want: i === 3 ? 'torch catches' : 'torch catches', why: 'light it' }
        ]) as Step[]),
        { note: 'wiki step 13: with all four burning the chest opens, and the key it holds is the' },
        { note: "only thing that gets through Fareed's gate" },
        { setpos: [FIRE_CHEST[0], FIRE_CHEST[1] - 1, 0], why: 'to the chest' },
        { loc: 'fd_firedungeon_shutchest', at: FIRE_CHEST, want: 'chest swings open', why: 'open it' },
        { has: 'fd_firekey' },
        { note: 'wiki step 14: Fareed. Ice gloves make him bearable, and they go on BEFORE the gate:' },
        { note: 'the gate script ends in p_delay, p_telejump and then ~dt_spawn_fareed, and anything' },
        { note: 'that closes an interface in between - which opheld does - aborts the rest of it and' },
        { note: 'Fareed is never summoned.' },
        { held: 'ice_gloves', op: 2, why: 'the ice gloves on' },
        { setpos: [FAREED_GATE[0] - 2, FAREED_GATE[1], 0], why: "to Fareed's gate" },
        { loc: 'fd_fw_metalgateclosed_l', at: FAREED_GATE, want: 'warm key into the lock', why: 'unlock it' },
        { hasnt: 'fd_firekey' },
        { wait: 12, why: 'he comes out of the heat' },
        { nearnpc: 'firediamond_firewarrior', r: 20, why: 'Fareed is waiting' },
        { fight: 'firediamond_firewarrior', until: 'fd_diamond_fire', tries: 6, r: 20, why: 'kill Fareed' },
        { take: 'fd_diamond_fire', r: 8, why: 'take the Diamond of Smoke' },

        { note: '================ THE DIAMOND OF SHADOW' },
        { note: 'wiki step 15: Rasolo wants his gilded cross back off the bandits before he will' },
        { note: 'part with the ring that makes the ladder visible' },
        { setpos: RASOLO, why: 'to Rasolo by the waterfall' },
        { talk: 'shadow_warrior_rasool', want: 'Bring me back the cross', why: 'take the job' },
        { varis: 'fd_shadowwarrior_quest', to: 1 },
        { note: 'wiki step 16: three locks, Thieving 53, and a poisoned needle on every failure' },
        { note: 'three locks, and every failure snaps the pick and poisons you - stat_random(thieving,' },
        { note: '30, 200) per lock, so even at 99 a run can get through its picks. Pinned, and with' },
        { note: 'spares.' },
        { give: 'lockpick', n: 10 },
        { rng: 0, why: 'every lock turns first time' },
        { setpos: [BANDIT_CHEST[0], BANDIT_CHEST[1] - 1, 0], why: "to the bandits' chest" },
        { loc: 'fd_bandit_shutchest', at: BANDIT_CHEST, until: 'fd_sword_cross', tries: 6, why: 'pick all three locks' },
        { rng: null, why: 'real rolls again' },
        { has: 'fd_sword_cross' },
        { setpos: RASOLO, why: 'back to Rasolo' },
        { talk: 'shadow_warrior_rasool', want: 'ring of visibility', why: 'collect the ring' },
        { varis: 'fd_shadowwarrior_quest', to: 2 },
        { has: 'fd_ring_visibility' },
        { note: 'wiki step 17: the ring has to be WORN - the ladder is "barely there at all"' },
        { held: 'fd_ring_visibility', op: 2, why: 'wear the ring' },
        { worn: 'fd_ring_visibility' },
        { setpos: [SHADOW_LADDER[0], SHADOW_LADDER[1] - 1, 0], why: 'to the invisible ladder' },
        { loc: 'fd_shadowladder1', at: SHADOW_LADDER, want: 'climb down into the dark', why: 'down it' },
        { note: 'wiki step 18: Damis, twice - the first form falls and the second steps out of it' },
        { setpos: DAMIS_LAIR, why: "to Damis's lair" },
        { fight: 'fd_damis_normal', tries: 4, r: 20, why: 'the first form' },
        { fight: 'fd_damis_tougher', until: 'fd_dark_diamond', tries: 6, r: 20, why: 'and the second' },
        { take: 'fd_dark_diamond', r: 8, why: 'take the Diamond of Shadow' },
        { varis: 'fd_shadowwarrior_quest', to: 3 },

        { note: '================ THE PYRAMID' },
        { note: "wiki step 19: a diamond in each of the pyramid's four obelisks, each carved with" },
        { note: 'its own element. Magic 50 to place one.' },
        ...(OBELISKS.flatMap(([name, diamond, at], i) => [
            { setpos: [at[0], at[1] - 2, 0], why: 'to obelisk ' + (i + 1) },
            { loc: name, at, want: i === 3 ? 'pyramid has opened' : 'obelisk hums', why: 'place the diamond' }
        ]) as Step[]),
        { stage: 12 },

        { note: 'wiki step 20: the pyramid door opens now, and the maze is three levels of ladder' },
        { note: 'down to the Ancient Temple. Every one of those landings was a bug once - each used' },
        { note: "to be the destination ladder's own tile, which is solid." },
        { setpos: [PYRAMID_DOOR[0], PYRAMID_DOOR[1] + 1, 0], why: 'to the pyramid door' },
        { loc: 'four_diamonds_door_1', at: PYRAMID_DOOR, want: 'door grinds open', why: 'in' },
        { loc: 'desert_laddertop', at: PYRAMID_LADDER, why: 'down into the maze' },
        { level: 3 },
        { note: 'each level is a maze, and the engine’s own pathfinder gives up over that' },
        { note: 'distance - so the walk crosses each floor with a `go` first and then clicks.' },
        { note: 'the `go` targets are the ladders’ walkable NEIGHBOURS, not the ladders - a' },
        { note: 'ladder blocks its own tile, and regionmap.ts says which side is open on each.' },
        { go: [2909, 4963], why: 'across the third level' },
        { loc: 'desert_laddertop3_2', at: LADDER_3_2, why: 'down a level' },
        { level: 2 },
        { go: [2845, 4973], why: 'across the second level' },
        { loc: 'desert_laddertop2_1', at: LADDER_2_1, why: 'down again' },
        { level: 1 },
        { go: [2784, 4942], why: 'across the first level' },
        { loc: 'desert_laddertop1_0', at: LADDER_1_0, want: 'cold and very still', why: 'and into the temple' },
        { level: 0 },

        { note: 'wiki step 21: through the doorway, pray at the altar, and talk to what turns up' },
        { note: 'the altar room is its own region of 130 tiles and the doorway is the only way in -' },
        { note: 'region 0 on its north side, region 1 on its south - so the walk crosses the temple' },
        { note: 'to the north face of it first.' },
        { go: [3234, 9325], why: 'across the temple to the doorway' },
        { loc: 'dt_ancient_temple_door_open', at: TEMPLE_DOOR, why: 'through the temple doorway' },
        { go: [3232, 9310], why: 'to the altar' },
        { loc: 'dt_zaros_altar', at: ALTAR, want: 'A figure is standing', why: 'pray at the altar' },
        { stage: 13 },
        { setpos: AZZANADRA, why: 'to Azzanadra' },
        { talk: 'azzanadra', want: 'rather longer than I thought', why: 'tell him how long it has been' },
        { stage: 14 },
        { talk: 'azzanadra', want: 'magic of the old empire', why: 'and take the Ancient Magicks' },
        { stage: 15 },
        { varis: 'spellbook', to: 1 },

        { note: 'wiki step 22: the portal only exists at all once the quest is done - dia_down is a' },
        { note: 'multiloc on deserttreasure with multiloc=15 only' },
        { setpos: [PORTAL[0], PORTAL[1] - 1, 0], why: 'to the portal' },
        { note: 'clicked as dia_down, not dt_portal: dia_down is what m50_145 places and' },
        { note: 'dt_portal is only what its multivar resolves to at stage 15, so a lookup by the' },
        { note: 'child name finds nothing. The handler is declared on both names for the same' },
        { note: 'reason - getOpTrigger does not resolve multis either.' },
        { loc: 'dia_down', at: PORTAL, want: 'step into the portal', why: 'out of the temple' }
    ]
};

const p: any = H.makePlayer('dtrun', m.start[0], m.start[1]);
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
