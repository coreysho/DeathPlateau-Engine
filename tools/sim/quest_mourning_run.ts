// MOURNING'S END PART I, played through on foot.
//
// Quest 90 of the quest-by-quest pass. The Mourners quarantining West Ardougne are not plague
// doctors; they are Lord Iorwerth's elves, digging for something under the city. The quest is a
// uniform taken off one of them, a gnome on a rack, a building full of poisoned dinners, and four
// flocks of sheep painted in four colours in front of the city they were being used to frighten.
//
// Tirannwn is stepped across, for the reason quest_regicide_run.ts sets out at length: Isafdar's
// pockets do not join up on foot in this map. Everything west of the wall - the quarters, the mine
// under them, the orchard, the sheep field - is walked.
//
//   NODE_MEMBERS=true npx tsx tools/sim/quest_mourning_run.ts
import * as H from './harness.js';
import { play, Manifest } from './questrun.js';

await H.boot();

const ISLWYN: [number, number, number] = [2292, 3147, 0];
const MOURNER: [number, number, number] = [2302, 3327, 0];
const BASKET: [number, number] = [2912, 3418];
const LLETYA: [number, number, number] = [2349, 3170, 0];
const ORONWEN: [number, number, number] = [2327, 3178, 0];
const HQ_DOOR: [number, number] = [2551, 3328];
const HQ_STAND: [number, number, number] = [2551, 3329, 0];
const TRAPDOOR: [number, number] = [2542, 3327];
const RACK: [number, number] = [2035, 4629];
const DESK: [number, number] = [2043, 4629];
const CHEST: [number, number] = [2039, 4633];
const LADDER: [number, number] = [2044, 4650];
const STEW: [number, number] = [2543, 3332];
const SHELVES: [number, number] = [2547, 3321];
const CRATE: [number, number] = [2554, 3327];
const ELENA: [number, number, number] = [2592, 3337, 0];
const APPLES: [number, number] = [2489, 3373];
const PRESS: [number, number] = [2484, 3374];

const m: Manifest = {
    quest: "MOURNING'S END PART I",
    source: 'oldschool.runescape.wiki/w/Mourning%27s_End_Part_I/Quick_guide',
    stageVar: 'mourning_quest',
    done: 20, // ^mourning_complete
    start: ISLWYN,
    steps: [
        { note: 'requirements: Roving Elves (and so Regicide), 60 Ranged and 50 Thieving.' },
        { setvar: 'roving_elves_quest', to: 10, why: '^roving_elves_complete' },
        { setvar: 'regicide_quest', to: 15, why: '^regicide_complete' },
        { setvar: 'biohazard', to: 16, why: '^biohazard_complete - the HQ is the Biohazard stew house' },

        { note: 'wiki step 1: Islwyn, in the woods of Isafdar' },
        { setpos: ISLWYN, why: 'to Islwyn' },
        { talk: 'roving_islwyn', want: 'Mourners are elves', why: 'he asks you into Lletya' },
        { stage: 1 },

        { note: 'wiki step 2: Eluned stands two tiles from him, and takes you there' },
        { talk: 'roving_female_woodelf', want: 'Hold still', why: 'she takes you to Lletya' },
        { setpos: LLETYA, why: 'to Arianwyn, by the fountain' },
        { talk: 'mourning_arianwyn', want: "Mourner's uniform", why: 'he wants one of their uniforms' },
        { stage: 2 },
        { has: 'mourning_teleport_crystal_4' },

        { note: 'wiki steps 4-5: a Mourner on the high pass, and the seven things he drops. His' },
        { note: 'top is bloodied and his trousers are cut open, which is the whole point of the' },
        { note: 'next two steps.' },
        { setpos: MOURNER, why: 'to the high pass' },
        { fight: 'mourning_overpass_mourner1', tries: 8, r: 10, why: 'kill the Mourner' },
        { take: 'mourning_bloody_mourner_top', r: 6, why: 'the bloodied top' },
        { take: 'mourning_ripped_mourner_legs', r: 6, why: 'the torn trousers' },
        { take: 'mourning_mourner_cloak', r: 6, why: 'the cloak' },
        { take: 'mourning_mourner_gloves', r: 6, why: 'the gloves' },
        { take: 'mourning_mourner_boots', r: 6, why: 'the boots' },
        { take: 'gasmask', r: 6, why: 'and the mask' },

        { note: 'wiki steps 7-9: soap out of the Taverley laundry basket, and a bucket of water' },
        { give: 'bucket_water' },
        { setpos: [BASKET[0] + 1, BASKET[1], 0], why: 'to Taverley' },
        { loc: 'eadgar_laundry_basket', at: BASKET, want: 'bar of soap', why: 'search the basket' },
        { has: 'mourning_soap' },
        { use: ['mourning_soap', 'mourning_bloody_mourner_top'], want: 'plain, heavy leather', why: 'wash the top' },
        { has: 'mourning_mourner_top' },

        { note: 'wiki steps 10-13: Oronwen, north-west of the Lletya crystal, mends the trousers' },
        { setpos: ORONWEN, why: 'back to Lletya, and Oronwen' },
        { talk: 'mourning_seamstress', want: 'cannot find where it was', why: 'she mends them' },
        { has: 'mourning_mourner_legs' },
        { stage: 3 },

        { note: 'wiki steps 14-15: all of it on, and in through the front door of the HQ' },
        { held: 'mourning_mourner_top', op: 2, why: 'the top' },
        { held: 'mourning_mourner_legs', op: 2, why: 'the trousers' },
        { held: 'mourning_mourner_cloak', op: 2, why: 'the cloak' },
        { held: 'mourning_mourner_gloves', op: 2, why: 'the gloves' },
        { held: 'mourning_mourner_boots', op: 2, why: 'the boots' },
        { held: 'gasmask', op: 2, why: 'and the mask' },
        { worn: 'gasmask' },
        { setpos: HQ_STAND, why: 'to the Mourner headquarters in West Ardougne' },
        { loc: 'mournerstewdoor', at: HQ_DOOR, hop: true, want: 'sees the mask', why: 'walk in' },
        { stage: 4 },

        { note: 'wiki step 16: the trapdoor in the walled yard, and the mine under it' },
        { setpos: [TRAPDOOR[0] + 1, TRAPDOOR[1], 0], why: 'across the yard' },
        { loc: 'mourning_hideout_trap_door', at: TRAPDOOR, hop: true, want: 'top of a mine', why: 'down the trapdoor' },

        { note: 'wiki step 17: the gnome on the rack. The mine is four rooms joined by four' },
        { note: 'ordinary doors, and the rack is behind the third of them.' },
        { go: [2037, 4634], why: 'along the gallery' },
        { loc: 'mourner_hideout_door3', at: [2037, 4633], hop: true, soft: true, why: 'open the door' },
        { go: [RACK[0] + 1, RACK[1]], why: 'to the rack' },
        { loc: 'mourning_gnome_rack', at: RACK, want: 'does not leave his desk', why: 'he is a gnome surveyor' },
        { stage: 5 },

        { note: 'the gnome names the poison, and a physician has the sieve. Elena is in East' },
        { note: 'Ardougne in this cache - see the deviation note in the quest constants.' },
        { loc: 'mourner_hideout_ladder1', at: LADDER, hop: true, soft: true, why: 'back up the ladder' },
        { setpos: ELENA, why: "to Elena's house in East Ardougne" },
        { talk: 'elena2', want: 'Take the sieve', why: 'she hands over her assay sieve' },
        { stage: 6 },
        { has: 'mourning_sieve' },

        { note: 'wiki steps 30-32: a barrel of rotten apples, the press, the naphtha and the sieve.' },
        { note: 'The naphtha is handed over rather than distilled - that is the Regicide still, a' },
        { note: 'quest away, and quest_regicide_run.ts already walks it.' },
        { give: 'regicide_barrel_naphtha' },
        { setpos: [APPLES[0], APPLES[1] - 1, 0], why: 'to the orchard outside the west wall' },
        { loc: 'mourning_orchard_applepile', at: APPLES, want: 'rotten through', why: 'fill a barrel' },
        { has: 'applebarrel_full' },
        { go: [PRESS[0] + 1, PRESS[1]], why: 'to the press' },
        { useLoc: 'mourning_orchard_applebarrel_empty', at: PRESS, obj: 'applebarrel_full', want: 'thin brown mush', why: 'crush them' },
        { use: ['regicide_barrel_naphtha', 'mourning_applebarrel_mush'], want: 'unpleasant grey', why: 'cut it with naphtha' },
        { useLoc: 'mourning_orchard_applebarrel_empty', at: PRESS, obj: 'mourning_applebarrel_naphtha_mush', want: 'out of the tap', why: 'and run it back through' },
        { has: 'mourning_toxic_naphtha' },
        { use: ['mourning_sieve', 'mourning_toxic_naphtha'], want: 'Three doses', why: 'strain it' },
        { stage: 7 },
        { has: 'mourning_apple_toxin', n: 3 },

        { note: 'wiki step 34: the quarters keep their food in three places and all three need a' },
        { note: 'dose - the stew cauldron, the cooking shelves and the ration crate upstairs' },
        { setpos: [STEW[0] + 1, STEW[1], 0], why: 'back to the quarters' },
        { useLoc: 'loc_2043', at: STEW, obj: 'mourning_apple_toxin', want: 'into the stew', why: 'the stew' },
        { note: 'the stew sits in the walled yard and the shelves are inside the quarters; the' },
        { note: 'yard only joins the town through the fence, so this is a step rather than a walk.' },
        { setpos: [SHELVES[0] + 1, SHELVES[1], 0], why: 'into the quarters, to the cooking shelves' },
        { useLoc: 'cookingshelves', at: SHELVES, obj: 'mourning_apple_toxin', want: 'flour barrel', why: 'the shelves' },
        { wait: 6, why: 'each dose takes a few ticks to go in' },
        { note: 'the ration crate is in a one-tile niche in a block of crates and takes a click' },
        { note: 'from the SOUTH only - from the north, the east or two tiles off it is "I cannot' },
        { note: 'reach that", which is the map and not the quest.' },
        { setpos: [CRATE[0], CRATE[1] - 1, 1], why: 'upstairs, to the ration crate' },
        { useLoc: 'mournercrateup', at: CRATE, obj: 'mourning_apple_toxin', want: 'ration crate', why: 'and the crate' },
        { stage: 8 },

        { note: 'wiki step 26 and the desk: the head mourner is in no state to stop anybody now' },
        { setpos: [TRAPDOOR[0] + 1, TRAPDOOR[1], 0], why: 'back to the yard' },
        { loc: 'mourning_hideout_trap_door', at: TRAPDOOR, hop: true, soft: true, why: 'down the trapdoor' },
        { go: [2042, 4634], why: 'along the gallery' },
        { loc: 'mourner_hideout_door2', at: [2042, 4633], hop: true, soft: true, why: 'open the second door' },
        { go: [DESK[0] - 1, DESK[1]], why: "to the head mourner's desk" },
        { loc: 'loc_8799', at: DESK, want: 'Death Guard', why: 'search it' },
        { stage: 9 },
        { has: 'mourning_head_mourner_key' },

        { note: 'the worn key opens the chest in his office: the gnome’s device, the rack key,' },
        { note: 'and a newly cut key to whatever is at the bottom of the dig' },
        { go: [CHEST[0] + 1, CHEST[1]], why: 'to the office chest' },
        { loc: 'mourning_office_chest_closed', at: CHEST, want: 'unlock the chest', why: 'unlock it' },
        { loc: 'mourning_office_chest_open', at: CHEST, want: 'broken brass device', why: 'and search it' },
        { has: 'mourning_paint_gun_broken' },
        { has: 'mourning_gnome_key' },
        { has: 'mourning_excavation_key' },

        { note: 'wiki step 19: the rack, and the device. Every one of these doors swings shut' },
        { note: 'behind you, so the way back is the same three clicks again.' },
        { loc: 'mourner_hideout_door2', at: [2042, 4633], hop: true, soft: true, why: 'out of the office' },
        { go: [2037, 4634], why: 'back along the gallery' },
        { loc: 'mourner_hideout_door3', at: [2037, 4633], hop: true, soft: true, why: 'open the rack door again' },
        { go: [RACK[0] + 1, RACK[1]], why: 'back to the rack' },
        { loc: 'mourning_gnome_rack', at: RACK, op: 2, want: 'slides off it in a heap', why: 'unlock the padlock' },
        { stage: 10 },
        { useNpc: 'mourner_hideout_gnome', obj: 'mourning_paint_gun_broken', want: 'fires dye', why: 'he mends his device' },
        { stage: 11 },
        { has: 'mourning_paint_gun' },

        { note: 'wiki steps 21-25: a dye into the bellows, the bellows into a toad, the toad into' },
        { note: 'the device, and the device at a flock. Each flock takes one colour and only one.' },
        { note: 'The bellows and the toads are handed over: the bellows have no source in this' },
        { note: 'build and the toads come out of a swamp the quest never otherwise visits.' },
        { give: 'empty_ogre_bellows' },
        { give: 'bloated_toad', n: 4 },
        { give: 'reddye' },
        { give: 'greendye' },
        { give: 'bluedye' },
        { give: 'yellowdye' },
        { loc: 'mourner_hideout_ladder1', at: LADDER, hop: true, soft: true, why: 'up out of the mine' },

        { setpos: [2609, 3343, 0], why: 'east of the wall, to the first flock' },
        { use: ['reddye', 'empty_ogre_bellows'], want: 'full of red', why: 'red into the bellows' },
        { use: ['mourning_ogre_bellows_red', 'bloated_toad'], want: 'takes it all', why: 'and into a toad' },
        { use: ['mourning_bloated_toad_red', 'mourning_paint_gun'], want: 'into the hopper', why: 'load the device' },
        { useNpc: 'plaguesheep_1', obj: 'mourning_paint_gun', want: 'now red', why: 'and fire' },
        { setpos: [2621, 3366, 0], why: 'to the second flock' },
        { use: ['greendye', 'empty_ogre_bellows'], want: 'full of green', why: 'green' },
        { use: ['mourning_ogre_bellows_green', 'bloated_toad'], want: 'takes it all', why: 'into a toad' },
        { use: ['mourning_bloated_toad_green', 'mourning_paint_gun'], want: 'into the hopper', why: 'load it' },
        { useNpc: 'plaguesheep_2', obj: 'mourning_paint_gun', want: 'now green', why: 'and fire' },
        { setpos: [2563, 3386, 0], why: 'to the third flock' },
        { use: ['bluedye', 'empty_ogre_bellows'], want: 'full of blue', why: 'blue' },
        { use: ['mourning_ogre_bellows_blue', 'bloated_toad'], want: 'takes it all', why: 'into a toad' },
        { use: ['mourning_bloated_toad_blue', 'mourning_paint_gun'], want: 'into the hopper', why: 'load it' },
        { useNpc: 'plaguesheep_3', obj: 'mourning_paint_gun', want: 'now blue', why: 'and fire' },
        { setpos: [2613, 3392, 0], why: 'and the fourth' },
        { use: ['yellowdye', 'empty_ogre_bellows'], want: 'full of yellow', why: 'yellow' },
        { use: ['mourning_ogre_bellows_yellow', 'bloated_toad'], want: 'takes it all', why: 'into a toad' },
        { use: ['mourning_bloated_toad_yellow', 'mourning_paint_gun'], want: 'into the hopper', why: 'load it' },
        { useNpc: 'plaguesheep_4', obj: 'mourning_paint_gun', want: 'Four flocks, four colours', why: 'and fire' },
        { stage: 12 },

        { note: 'and the physician who has been over the wall is the one who has to be standing' },
        { note: 'next to them' },
        { setpos: ELENA, why: 'back to Elena' },
        { talk: 'elena2', want: 'nothing wrong with those animals', why: 'she examines the flocks' },
        { stage: 13 },

        { note: 'wiki step 36: back to Arianwyn in Lletya' },
        { setpos: LLETYA, why: 'to Lletya' },
        { talk: 'mourning_arianwyn', want: 'earned an afternoon', why: 'tell him it is done' },
        { stage: 20 },
        { has: 'mourning_excavation_key' }
    ]
};

const p: any = H.makePlayer('mourning', m.start[0], m.start[1]);
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
