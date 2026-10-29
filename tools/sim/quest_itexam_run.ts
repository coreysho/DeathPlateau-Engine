// THE DIGSITE, played through on foot.
//
// Quest 102 of the quest-by-quest pass, and it had no coverage at all - one line in audit3.ts that
// sets itexamlevel to 9 so Desert Treasure can start.
//
// It is the 2006 quest, not the OSRS rework, and the 377 cache settles that: the three students
// have each lost a ROCK SAMPLE (rock_sample1/2/3, plus cracked_sample for the wrong one), and
// there is no teddy, no special cup and no animal skull anywhere in the cache. So the errands are
// a pickpocket, a bush and a panning tray, and the quick guide's steps 5-12 read differently here.
//
// Three of the quest's own steps are random rolls, and the runner pins the engine's nextDouble
// around each one rather than grinding for them:
//   random(11) < 3  on a successful pickpocket    -> rock_sample1
//   random(40) < 3  on searching a full tray      -> rock_sample2   (and [3,6) is the opal)
//   random(20) = 2  on a level 3 dig              -> digtalisman
//   random(11) = 6  on searching a specimen tray  -> charcoal
//
//   NODE_MEMBERS=true npx tsx tools/sim/quest_itexam_run.ts
import * as H from './harness.js';
import { play, Manifest, Step } from './questrun.js';

await H.boot();

// --- the Exam Centre, south of the dig. ITS DOOR IS THE WHOLE TRICK: the centre is a 63-tile
// room and loc_1533 at 3357,3344 is the only way in or out of it, so every trip between the
// examiner and the dig is two clicks and not one walk. (tools/sim/questrun.ts will not open a door
// on the way past - the click has to be its own step, and ~open_door(500) means it swings shut
// again five minutes later, so every crossing is a soft click and then a walk.)
const CENTRE_DOOR: [number, number] = [3357, 3344];
const DOOR_IN: [number, number] = [3356, 3344];
const DOOR_OUT: [number, number] = [3358, 3344];
const EXAMINER: [number, number, number] = [3359, 3345, 0];
const EXPERT: [number, number, number] = [3358, 3336, 0];
const CUPBOARD_PICK: [number, number] = [3355, 3337]; // samplecupboardshut, the rock pick
const CUPBOARD_JAR: [number, number] = [3354, 3332]; // a plain cupboard, the specimen jar

// --- Varrock museum
const CURATOR: [number, number, number] = [3254, 3447, 0];

// --- the panning area and the tents, north of the centre
const PANNING_GUIDE: [number, number, number] = [3375, 3376, 0];
const TRAY: [number, number] = [3369, 3378]; // tray_empty, a ground obj on a table
const PAN_POINT: [number, number] = [3378, 3375];
const BUSH: [number, number] = [3357, 3372]; // digsitebushsample - rock_sample3
const CHEST: [number, number] = [3374, 3378]; // digchestclosed, the ammonium nitrate
const BARREL: [number, number] = [3365, 3379]; // digbarrelclosed, the nitroglycerin
const TRAY_SEARCH: [number, number] = [3367, 3387]; // specimen_tray, the charcoal

// --- the dig itself
const WORKMAN: [number, number, number] = [3356, 3383, 0]; // the one by the tents
const STUDENT1: [number, number, number] = [3354, 3407, 0];
const STUDENT2: [number, number, number] = [3347, 3423, 0];
const STUDENT3: [number, number, number] = [3351, 3412, 0];
const SOIL3: [number, number] = [3351, 3409]; // inside the western level 3 zone
const WINCH_W: [number, number] = [3352, 3417]; // digwinch1 - the bricks are down this one
const WINCH_N: [number, number] = [3370, 3428]; // digwinch2 - the private dig
const PERMIT_WORKMAN: [number, number, number] = [3350, 3401, 0]; // not the one by a winch

// --- underground, before the blast (m52_153)
const CAVE_E: [number, number, number] = [3370, 9828, 0]; // where the western winch drops you
const ARCENIA: [number, number] = [3369, 9835];
const BRICKS: [number, number] = [3379, 9825];
const LADDER_E: [number, number] = [3370, 9827]; // winchladder2, up to 3354,3417
const CAVE_W: [number, number, number] = [3353, 9818, 0]; // where the private winch drops you
const WORKMAN2: [number, number, number] = [3348, 9819, 0];
const LADDER_W: [number, number] = [3353, 9817]; // winchladder1, up to 3370,3427

// --- and after it (m52_152): the same cave, 64 squares north
const TABLET: [number, number] = [3374, 9747];

const TO_THE_EXAMINER: Step[] = [
    { go: [DOOR_IN[0], DOOR_IN[1]], why: 'to the Exam Centre door' },
    { loc: 'loc_1533', at: CENTRE_DOOR, hop: true, soft: true, why: 'open the door if it swung shut' },
    { go: [EXAMINER[0], EXAMINER[1]], why: 'to the examiner' }
];
const OUT_OF_THE_CENTRE: Step[] = [
    { go: [DOOR_OUT[0], DOOR_OUT[1]], why: 'back to the door' },
    { loc: 'loc_1533', at: CENTRE_DOOR, hop: true, soft: true, why: 'open the door if it swung shut' }
];

const m: Manifest = {
    quest: 'THE DIGSITE',
    source: 'oldschool.runescape.wiki/w/The_Digsite/Quick_guide',
    stageVar: 'itexamlevel',
    done: 9, // ^itexam_complete
    start: EXAMINER,
    steps: [
        { note: 'items: a pestle and mortar, an empty vial, a tinderbox, a cup of tea for the' },
        { note: 'panning guide, a chisel for the opal the third student wants cut, and two ropes' },
        { note: 'for the two winches. The ropes are a pickpocket drop in this content - random(11)' },
        { note: 'is 6 for rope and under 3 for the rock sample - and the walk takes the sample off' },
        { note: 'a real pickpocket below, so the ropes are handed over rather than ground for.' },
        { give: 'pestle_and_mortar' },
        { give: 'vial_empty' },
        { give: 'tinderbox' },
        { give: 'cup_of_tea' },
        { give: 'chisel' },
        { give: 'rope', n: 2 },

        { note: 'wiki step 1: ask an examiner in the Exam Centre about an exam' },
        { go: [EXAMINER[0], EXAMINER[1]], why: 'to the examiner' },
        { talk: 'examiner', picks: [1], want: 'stamped by the Curator', why: 'ask for an exam' },
        { stage: 1 },
        { has: 'digplainletter' },

        { note: "wiki step 2: the Curator of Varrock's museum stamps it" },
        { setpos: CURATOR, why: 'to Varrock museum' },
        { talk: 'curator', want: 'good luck student', why: 'get the letter stamped' },
        { has: 'recommendedletter' },
        { hasnt: 'digplainletter' },

        { note: 'wiki step 4: back to the examiner, who sits you down for the first exam straight' },
        { note: 'away - and it cannot be passed, because the correct answer to each question is only' },
        { note: 'OFFERED once the student who knows it has told you. That is the whole design.' },
        { setpos: [DOOR_IN[0], DOOR_IN[1], 0], why: 'back from Varrock to the Exam Centre door' },
        { loc: 'loc_1533', at: CENTRE_DOOR, hop: true, soft: true, why: 'open the door if it swung shut' },
        { go: [EXAMINER[0], EXAMINER[1]], why: 'to the examiner' },
        { talk: 'examiner', picks: [1, 1, 1], want: 'none correct at all', why: 'fail the first exam' },
        { stage: 2 },
        { hasnt: 'recommendedletter' },

        { note: 'wiki steps 5-12: the three errands. All three students have lost a rock sample -' },
        { note: 'the 377 cache has rock_sample1, 2 and 3 and no teddy, cup or skull - so talk to each' },
        { note: 'of them first to start the errand, then go and find the three samples.' },
        ...OUT_OF_THE_CENTRE,
        { go: [STUDENT1[0], STUDENT1[1]], why: 'to the first student' },
        { talk: 'student1', want: 'lost my rock sample', why: 'start errand 1' },
        { go: [STUDENT3[0], STUDENT3[1]], why: 'to the second' },
        { talk: 'student3', want: 'near the tents', why: 'start errand 2' },
        { go: [STUDENT2[0], STUDENT2[1]], why: 'to the third' },
        { talk: 'student2', want: 'lost my rock sample', why: 'start errand 3' },

        { note: "sample 1 is in a workman's pocket. 25 Thieving, and random(11) under 3." },
        { go: [WORKMAN[0], WORKMAN[1]], why: 'to a workman' },
        { rng: 0.1, why: 'random(11) = 1, the rock sample' },
        { talk: 'digworkman1', op: 3, want: 'rock sample', why: 'pick his pocket' },
        { has: 'rock_sample1' },

        { note: 'sample 3 is in a bush on the hilltop by the urn - one bush out of fifty-eight' },
        { go: [BUSH[0] + 1, BUSH[1]], why: 'to the hilltop bush' },
        { loc: 'digsitebushsample', at: BUSH, want: 'rock sample', why: 'search it' },
        { has: 'rock_sample3' },

        { note: 'sample 2 is in the river, and the panning guide will not let you pan until he has' },
        { note: 'had his cup of tea' },
        { go: [TRAY[0] - 1, TRAY[1]], why: 'to the tent table' },
        { take: 'tray_empty', why: 'the panning tray off the table' },
        { go: [PANNING_GUIDE[0], PANNING_GUIDE[1]], why: 'to the panning guide' },
        { talk: 'panning_guide', want: 'free to pan all you want', why: 'hand over the tea' },
        { varis: 'itexam_bits', to: 2 },
        { go: [PAN_POINT[0] - 1, PAN_POINT[1]], why: 'to a panning point' },
        { loc: 'panning_point', at: PAN_POINT, want: 'lift the full tray', why: 'pan' },
        { has: 'tray_mud' },
        { rng: 0.05, why: 'random(40) = 2, the rock sample' },
        { held: 'tray_mud', op: 2, want: 'covered in mud', why: 'search the tray' },
        { has: 'rock_sample2' },

        { note: 'and one more pan for the opal the third student will want at the last exam:' },
        { note: 'random(40) in [3,6) is an uncut opal' },
        { rng: null, why: 'back to the real engine for the pan itself' },
        { loc: 'panning_point', at: PAN_POINT, want: 'lift the full tray', why: 'pan again' },
        { rng: 0.1, why: 'random(40) = 4, the gem' },
        { held: 'tray_mud', op: 2, want: 'gem within the mud', why: 'search the tray' },
        { has: 'uncut_opal' },
        { rng: null },
        { use: ['chisel', 'uncut_opal'], why: 'cut it - the student wants a cut opal' },
        { has: 'opal' },

        { note: 'all three samples delivered - each one is USED on its own student, and the wrong' },
        { note: 'student says so' },
        { go: [STUDENT1[0], STUDENT1[1]], why: 'back to the first student' },
        { useNpc: 'student1', obj: 'rock_sample1', want: 'found it', why: 'deliver sample 1' },
        { go: [STUDENT3[0], STUDENT3[1]], why: 'to the second' },
        { useNpc: 'student3', obj: 'rock_sample2', want: 'so happy', why: 'deliver sample 2' },
        { go: [STUDENT2[0], STUDENT2[1]], why: 'to the third' },
        { useNpc: 'student2', obj: 'rock_sample3', want: 'My sample', why: 'deliver sample 3' },
        { varis: 'itexam_errands', to: 42 },

        { note: 'wiki step 13: the first exam, with all three answers now on the menu. 1, 3, 2.' },
        ...TO_THE_EXAMINER,
        { talk: 'examiner', picks: [1, 1, 3, 2], want: 'all the questions correct', why: 'pass level 1' },
        { stage: 3 },
        { has: 'level1certificate' },
        { has: 'trowel' },

        { note: 'wiki step 14: talk to all three again - at this stage each one simply tells you' },
        { note: 'what they have learned, and the errand bits go straight to answered' },
        ...OUT_OF_THE_CENTRE,
        { go: [STUDENT1[0], STUDENT1[1]], why: 'to the first student' },
        { talk: 'student1', want: 'rockpick usage', why: 'exam 2 tip 1' },
        { go: [STUDENT3[0], STUDENT3[1]], why: 'to the second' },
        { talk: 'student3', want: 'sample transportation', why: 'exam 2 tip 2' },
        { go: [STUDENT2[0], STUDENT2[1]], why: 'to the third' },
        { talk: 'student2', want: 'Finds handling', why: 'exam 2 tip 3' },

        { note: 'wiki step 15: the second exam. 3, 1, 2.' },
        ...TO_THE_EXAMINER,
        { talk: 'examiner', picks: [1, 3, 1, 2], want: 'all the questions correct', why: 'pass level 2' },
        { stage: 4 },
        { has: 'level2certificate' },

        { note: 'wiki step 16: and the third time round the third student wants paying - an opal,' },
        { note: 'which is why the walk panned for one above' },
        ...OUT_OF_THE_CENTRE,
        { go: [STUDENT1[0], STUDENT1[1]], why: 'to the first student' },
        { talk: 'student1', want: 'Specimen brush use', why: 'exam 3 tip 1' },
        { go: [STUDENT3[0], STUDENT3[1]], why: 'to the second' },
        { talk: 'student3', want: 'handling bones', why: 'exam 3 tip 2' },
        { go: [STUDENT2[0], STUDENT2[1]], why: 'to the third' },
        { talk: 'student2', want: 'a precious stone', why: 'she asks for the opal' },
        { talk: 'student2', want: 'Sample preparation', why: 'and takes it' },
        { hasnt: 'opal' },

        { note: 'wiki step 17: the last exam. 1, 1, 3.' },
        ...TO_THE_EXAMINER,
        { talk: 'examiner', picks: [1, 1, 1, 3], want: 'passed the Earth Sciences level 3', why: 'pass level 3' },
        { stage: 5 },
        { has: 'level3certificate' },

        { note: 'wiki step 19: the rock pick is in the cupboard in the west room of the centre, and' },
        { note: 'the specimen jar in another cupboard in the same building' },
        { go: [CUPBOARD_PICK[0] - 1, CUPBOARD_PICK[1]], why: 'to the sample cupboard' },
        { loc: 'samplecupboardshut', at: CUPBOARD_PICK, why: 'open it' },
        { loc: 'samplecupboardopen', at: CUPBOARD_PICK, want: 'rock pick', why: 'search it' },
        { has: 'rockpick' },
        { go: [CUPBOARD_JAR[0], CUPBOARD_JAR[1] + 1], why: 'to the other cupboard' },
        { loc: 'cupboard', at: CUPBOARD_JAR, why: 'open it' },
        { loc: 'cupboardopen', at: CUPBOARD_JAR, want: 'specimen jar', why: 'search it' },
        { has: 'specimen_jar' },

        { note: 'wiki step 20: and a specimen brush off a workman, which is the other pickpocket' },
        { note: 'drop - random(11) in [7,10)' },
        { go: [WORKMAN[0], WORKMAN[1]], why: 'to a workman' },
        { rng: 0.7, why: 'random(11) = 7, the specimen brush' },
        { talk: 'digworkman1', op: 3, want: 'specimen brush', why: 'pick his pocket again' },
        { has: 'specimen_brush' },
        { rng: null },

        { note: 'wiki step 21: a level 3 dig wants the trowel, the jar AND the brush, and one find' },
        { note: 'in twenty is the talisman' },
        { go: [SOIL3[0] + 1, SOIL3[1]], why: 'to the western level 3 dig' },
        { rng: 0.1, why: 'random(20) = 2, the strange talisman' },
        { useLoc: 'digdugupsoil3', at: SOIL3, obj: 'trowel', want: 'strange talisman', why: 'dig' },
        { has: 'digtalisman' },
        { rng: null },

        { note: 'wiki steps 22-23: Terry Balando reads the talisman and writes you an invitation to' },
        { note: 'the private shafts, which goes to any workman who is not standing on one' },
        { go: [DOOR_IN[0], DOOR_IN[1]], why: 'to the Exam Centre door' },
        { loc: 'loc_1533', at: CENTRE_DOOR, hop: true, soft: true, why: 'open the door if it swung shut' },
        { go: [EXPERT[0], EXPERT[1]], why: 'to Terry Balando' },
        { useNpc: 'archaeological_expert', obj: 'digtalisman', want: 'Zaros', why: 'show the talisman' },
        { has: 'digexpertscroll' },
        ...OUT_OF_THE_CENTRE,
        { go: [PERMIT_WORKMAN[0], PERMIT_WORKMAN[1]], why: 'to a workman away from the winches' },
        { useNpc: 'digworkman1', obj: 'digexpertscroll', want: 'may use the mineshaft', why: 'the permit' },
        { stage: 6 },

        { note: 'wiki steps 24-25: the western winch, roped, is the one with the bricks at the' },
        { note: 'bottom - and an arcenia root, which is the missing fourth ingredient in the' },
        { note: "chemistry book's recipe" },
        { go: [WINCH_W[0] - 1, WINCH_W[1]], why: 'to the western winch' },
        { useLoc: 'digwinch1', at: WINCH_W, obj: 'rope', why: 'tie the rope to the bucket' },
        { note: 'itexam_bits is one varp of flags: 2 the tea, 4 this winch, 8 the other one, 128' },
        { note: 'the talisman shown' },
        { varis: 'itexam_bits', to: 134 },
        { loc: 'digwinch1', at: WINCH_W, hop: true, why: 'climb down' },
        { level: 0 },
        { go: [ARCENIA[0], ARCENIA[1]], why: 'to the arcenia root' },
        { take: 'arcenia_root', why: 'pick it up' },
        { go: [BRICKS[0], BRICKS[1] + 1], why: 'east to the bricks' },
        { loc: 'digblastbrick', at: BRICKS, want: 'room past these bricks', why: 'look at them' },
        { go: [LADDER_E[0], LADDER_E[1] + 1], why: 'back to the rope' },
        { loc: 'winchladder2', at: LADDER_E, hop: true, why: 'climb out' },

        { note: 'wiki steps 26-27: the northern winch is the private dig, and the workman down it' },
        { note: 'has the chest key. He does not hand it over: he is begged four times for it, which' },
        { note: 'is the RSC chain and is what this content ships.' },
        { go: [WINCH_N[0] + 1, WINCH_N[1]], why: 'to the northern winch' },
        { useLoc: 'digwinch2', at: WINCH_N, obj: 'rope', why: 'tie the second rope on' },
        { varis: 'itexam_bits', to: 142 },
        { loc: 'digwinch2', at: WINCH_N, hop: true, why: 'climb down' },
        { go: [WORKMAN2[0] + 1, WORKMAN2[1]], why: 'to the private dig workman' },
        { talk: 'digworkman2', picks: [1, 2, 1, 1, 1, 1, 1], want: "Here's the key", why: 'beg for the chest key - four times' },
        { has: 'digchestkey' },
        { go: [LADDER_W[0], LADDER_W[1] + 1], why: 'back to the rope' },
        { loc: 'winchladder1', at: LADDER_W, hop: true, why: 'climb out' },

        { note: 'wiki steps 28-31: the three chemicals. The chest in the south tent has the powder,' },
        { note: 'the barrel west of it has the liquid - levered open with the trowel and drawn off' },
        { note: 'into a vial - and the charcoal comes out of a specimen tray.' },
        { go: [CHEST[0] - 1, CHEST[1]], why: 'to the chest in the tent' },
        { useLoc: 'digchestclosed', at: CHEST, obj: 'digchestkey', why: 'unlock it' },
        { loc: 'digchestopen', at: CHEST, want: 'unusual powder', why: 'search it' },
        { has: 'unidentified_powder' },
        { go: [BARREL[0] - 1, BARREL[1]], why: 'to the barrel' },
        { useLoc: 'digbarrelclosed', at: BARREL, obj: 'trowel', want: 'opened it', why: 'lever the lid off' },
        { varis: 'itexam_bits', to: 158 },
        { useLoc: 'digbarrelclosed', at: BARREL, obj: 'vial_empty', want: 'fill the vial', why: 'draw off the liquid' },
        { has: 'unidentified_liquid' },
        { go: [TRAY_SEARCH[0], TRAY_SEARCH[1] - 1], why: 'to the specimen tray' },
        { rng: 0.56, why: 'random(11) = 6, the charcoal' },
        { loc: 'specimen_tray', at: TRAY_SEARCH, op: 2, want: 'charcoal', why: 'sift the tray' },
        { has: 'charcoal' },
        { rng: null },

        { note: 'wiki step 32: neither chemical is identified until Terry looks at them' },
        { go: [DOOR_IN[0], DOOR_IN[1]], why: 'to the Exam Centre door' },
        { loc: 'loc_1533', at: CENTRE_DOOR, hop: true, soft: true, why: 'open the door if it swung shut' },
        { go: [EXPERT[0], EXPERT[1]], why: 'to Terry Balando' },
        { useNpc: 'archaeological_expert', obj: 'unidentified_liquid', want: 'nitroglycerin', why: 'identify the liquid' },
        { has: 'nitroglycerin' },
        { useNpc: 'archaeological_expert', obj: 'unidentified_powder', want: 'ammonium nitrate', why: 'identify the powder' },
        { has: 'ammonium_nitrate' },

        { note: 'wiki step 33: and the recipe out of the book - nitrate into the nitroglycerin,' },
        { note: 'ground charcoal into that, and the arcenia root last. 10 Herblore for all three.' },
        { use: ['charcoal', 'pestle_and_mortar'], why: 'grind the charcoal' },
        { has: 'ground_charcoal' },
        { use: ['ammonium_nitrate', 'nitroglycerin'], want: 'foul mixture', why: 'mix the chemicals' },
        { has: 'precharcoalmixture' },
        { use: ['ground_charcoal', 'precharcoalmixture'], want: 'even fouler', why: 'add the charcoal' },
        { has: 'postcharcoalmixture' },
        { use: ['arcenia_root', 'postcharcoalmixture'], want: 'explosive compound', why: 'add the root' },
        { has: 'digcompound' },

        { note: 'wiki steps 34-36: down the western winch again, the compound on the bricks and a' },
        { note: 'tinderbox to it. The run-away is scripted tile by tile and ends in the chamber.' },
        ...OUT_OF_THE_CENTRE,
        { go: [WINCH_W[0] - 1, WINCH_W[1]], why: 'back to the western winch' },
        { loc: 'digwinch1', at: WINCH_W, hop: true, why: 'climb down the rope already tied on' },
        { go: [BRICKS[0], BRICKS[1] + 1], why: 'to the bricks' },
        { useLoc: 'digblastbrick', at: BRICKS, obj: 'digcompound', want: 'mixture is all over', why: 'pour it on' },
        { stage: 7 },
        { useLoc: 'digblastbrick', at: BRICKS, obj: 'tinderbox', hop: true, want: 'going to blow', why: 'light it' },
        { stage: 8 },
        { note: 'the blast puts you in the cave one mapsquare north of the one you were in' },
        { go: [TABLET[0], TABLET[1]], why: 'into the chamber, to the tablet' },
        { take: 'zarosstonetablet', why: 'take the stone tablet' },
        { held: 'zarosstonetablet', op: 2, want: 'dread lord Zaros', why: 'read it' },

        { note: 'wiki step 37: and the way out of the new cave is the same rope, one mapsquare' },
        { note: 'north of where it was - then Terry Balando gets the tablet' },
        { loc: 'winchladder2', at: [LADDER_E[0], LADDER_E[1] - 64], hop: true, why: 'climb out' },
        { go: [DOOR_IN[0], DOOR_IN[1]], why: 'to the Exam Centre door' },
        { loc: 'loc_1533', at: CENTRE_DOOR, hop: true, soft: true, why: 'open the door if it swung shut' },
        { go: [EXPERT[0], EXPERT[1]], why: 'to Terry Balando' },
        { useNpc: 'archaeological_expert', obj: 'zarosstonetablet', want: 'amazing discovery', why: 'hand it over' },
        { stage: 9 },
        { has: 'gold_bar', n: 2 }
    ]
};

const p: any = H.makePlayer('digrun', m.start[0], m.start[1]);
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
