// BIOHAZARD, played through on foot.
//
// Quest 71 of the quest-by-quest pass. Elena's distillator is in the mourners' quarters, and the
// only way in is over a watchtower whose guards are watching - so you feed Jerico's pigeons onto
// the tower, let them go, and climb while everybody is looking at the birds. Then a rotten apple
// in the mourners' stew, a doctor's gown from the nurse's cupboard, and the key off the one
// mourner too sick to see through the disguise.
//
//   NODE_MEMBERS=true npx tsx tools/sim/quest_biohazard_run.ts
import * as H from './harness.js';
import { play, Manifest } from './questrun.js';

await H.boot();

const ELENA: [number, number, number] = [2592, 3337, 0];
const JERICO: [number, number, number] = [2612, 3325, 0];
const JERICO_CUPBOARD: [number, number] = [2611, 3326];
const HOUSE_DOOR: [number, number] = [2610, 3324];
const PIGEON_CAGE: [number, number] = [2618, 3324];
const WATCHTOWER: [number, number] = [2562, 3301]; // the east-west fence, clickable from the corner
const TOWER_CORNER: [number, number, number] = [2563, 3301, 0]; // where the two spiked fences meet
const OMART: [number, number, number] = [2560, 3267, 0];
const FENCE: [number, number] = [2541, 3331];
const APPLES: [number, number] = [2549, 3332];
const STEW: [number, number] = [2543, 3332];
const NURSE: [number, number, number] = [2517, 3275, 0]; // the one tile the cupboard takes a click from
const NURSE_CUPBOARD: [number, number] = [2517, 3276];
const HQ_DOOR: [number, number] = [2551, 3320]; // the SOUTH door - the only way in from the street
const NURSE_DOOR: [number, number] = [2519, 3275];
const HQ_STAIRS: [number, number] = [2542, 3324];
const HQ_UP: [number, number, number] = [2543, 3325, 1];
const HQ_UPDOOR: [number, number] = [2547, 3325];
const HQ_GATE: [number, number] = [2551, 3326];
const HQ_CRATE: [number, number] = [2554, 3327];
const CHEMIST: [number, number, number] = [2932, 3214, 0]; // outside his door
const CHEMIST_DOOR: [number, number] = [2932, 3213];
const RIMMINGTON_FIRE: [number, number, number] = [2929, 3219, 0];
const DANCING_DONKEY: [number, number, number] = [3272, 3390, 0];
const GUIDOR_HOUSE_DOOR: [number, number] = [3278, 3382];
const GUIDOR_DOOR: [number, number] = [3282, 3382];
const LATHAS: [number, number, number] = [2578, 3293, 1];

const m: Manifest = {
    quest: 'BIOHAZARD',
    source: 'oldschool.runescape.wiki/w/Biohazard',
    stageVar: 'biohazard',
    done: 16, // ^biohazard_complete
    start: ELENA,
    steps: [
        { note: 'requirements: Plague City. Items: a rotten apple for the mourners stew (one lies in' },
        { note: 'their own yard) and a priest gown and robe to get past Guidor wife.' },
        { setvar: 'elenaquest', to: 29, why: '^elena_complete - Plague City' },
        { setpos: ELENA, why: 'to Elena in East Ardougne' },

        { note: 'wiki step 1: the mourners took her distillator' },
        { talk: 'elena2', picks: ["I'll try to retrieve it for you."], want: 'distillator', why: 'she wants it back' },
        { stage: 1 },

        { note: 'wiki step 2: Jerico keeps pigeons, and the mourners watch the tower' },
        { setpos: JERICO, why: 'to Jerico' },
        { talk: 'jerico', want: 'cross the wall', why: 'Elena has told him you are coming' },
        { stage: 2 },
        {
            talk: 'jerico',
            picks: ['Maybe I could use your messenger pigeons to distract them?'],
            want: 'around the back of my house',
            why: 'and the pigeons are his idea of a distraction'
        },
        { note: 'the jump lands south of the cupboard, which is as close as it needs to be' },
        { loc: 'jericoscupboardshut', at: JERICO_CUPBOARD, soft: true, why: 'open it' },
        { loc: 'jericoscupboardopen', at: JERICO_CUPBOARD, want: 'birdfeed', why: 'and take the birdfeed' },
        { has: 'birdfeed' },

        { note: 'three pigeon cages lie in his back yard' },
        { loc: 'loc_1530', at: HOUSE_DOOR, soft: true, why: 'out of the house' },
        { go: PIGEON_CAGE, exact: true, r: 40, why: 'round the back of the house' },
        { take: 'pigeons', r: 4, why: 'one cage of pigeons' },
        { has: 'pigeons' },

        { note: 'wiki step 3: seed on the tower, then open the cage' },
        { note: 'loc_2067 is a WALL, and the only clear tile that reaches any of it is the inside' },
        { note: 'corner at 2563,3301 - which is exactly what the guide means by standing in the' },
        { note: 'corner where the two fences meet. Every other side of every section is blocked.' },
        { go: [TOWER_CORNER[0], TOWER_CORNER[1]], exact: true, r: 60, why: 'to the corner where the two spiked fences meet' },
        { useLoc: 'loc_2067', at: WATCHTOWER, obj: 'birdfeed', want: 'throw', why: 'scatter the seed' },
        { stage: 3 },
        { held: 'pigeons', op: 1, want: 'fly towards the watch tower', why: 'and let them out' },
        { stage: 4 },
        { has: 'pigeoncage' },

        { note: 'wiki step 4: Omart and Kilron have a rope ladder, and the guards are busy with birds' },
        { go: OMART, exact: true, r: 48, why: 'south-west of Ardougne Castle' },
        { talk: 'omart', picks: ['Ok, lets do it.'], want: 'other side', why: 'over the wall' },
        { stage: 5 },

        { note: 'wiki step 5: a rotten apple from the mourners own yard, into their stew.' },
        { note: 'The yard is a 69-tile pocket and the ONE thing that joins it to the rest of West' },
        { note: 'Ardougne is the fence at 2541,3331 - Squeeze-through, handled in general_use.' },
        { go: [FENCE[0] - 1, FENCE[1]], exact: true, r: 90, why: 'to the fence on the west side of the yard' },
        { loc: 'mournerstewfence', at: FENCE, hop: true, soft: true, why: 'squeeze through' },
        { go: APPLES, exact: true, r: 24, why: 'to the apple on the ground' },
        { take: 'rottenapples', r: 4, why: 'one rotten apple' },
        { useLoc: 'loc_2043', at: STEW, obj: 'rottenapples', want: 'dissolves into the stew', why: 'spoil it' },
        { stage: 6 },

        { note: 'wiki step 6: the nurse keeps a medical gown in her cupboard' },
        { setpos: NURSE, why: 'to the nurse hut, south-west of the church' },
        { loc: 'bionursescupboardshut', at: NURSE_CUPBOARD, soft: true, why: 'open it' },
        { loc: 'bionursescupboardopen', at: NURSE_CUPBOARD, want: 'gown', why: 'and find the gown' },
        { has: 'doctor_gown' },
        { held: 'doctor_gown', op: 2, why: 'wear it' },
        { worn: 'doctor_gown' },

        { note: 'wiki step 7: in you go, doc. The quarters have two doors and only the southern one' },
        { note: 'reaches the street: 2551,3328 opens into the same walled yard as the stew.' },
        { loc: 'loc_1530', at: NURSE_DOOR, soft: true, why: 'out of the hut' },
        { go: [HQ_DOOR[0], HQ_DOOR[1] - 1], exact: true, r: 90, why: 'round to the south door of the quarters' },
        { loc: 'mournerstewdoor', at: HQ_DOOR, want: 'In you go doc', why: 'the guard on the door' },
        { talk: 'mournerstew1', want: 'resting upstairs', why: 'one of them is worse than the rest' },

        { note: 'the sick one is upstairs, and he works out you are no doctor' },
        { loc: 'loc_1738', at: HQ_STAIRS, soft: true, why: 'up the staircase' },
        { setpos: HQ_UP, why: 'the top of the staircase' },
        { loc: 'mournerstewdoorup', at: HQ_UPDOOR, soft: true, why: 'through the upstairs door' },
        { talk: 'mournerstew2', picks: ["There's nothing I can do, it's fatal."], want: 'no doctor', why: 'he takes offence' },
        { fight: 'mournerstew2', tries: 4, r: 12, why: 'and attacks' },
        { has: 'mournerkeytw' },

        { note: 'wiki step 8: the key opens the caged room, and the distillator is in a crate' },
        { useLoc: 'mournerquaters_gatel', at: HQ_GATE, obj: 'mournerkeytw', want: 'key fits', why: 'unlock the gate' },
        { loc: 'mournercrateup', at: HQ_CRATE, want: 'distillator', why: 'search the crates' },
        { stage: 7 },
        { has: 'distillator' },

        { note: 'wiki step 9: back to Elena, who hands over the three agents and a sample' },
        { setpos: ELENA, why: 'to Elena' },
        { talk: 'elena2', want: 'Guidor', why: 'the touch paper does not change colour' },
        { stage: 10 },
        { has: 'liquid_honey' },
        { has: 'ethenea' },
        { has: 'sulphuric_broline' },
        { has: 'plaguesample' },

        { note: 'wiki step 10: the chemist in Rimmington for touch paper' },
        { setpos: CHEMIST, why: 'to the chemist in south-west Rimmington' },
        { loc: 'loc_1533', at: CHEMIST_DOOR, soft: true, why: 'his door is the only way into the house' },
        {
            talk: 'chemist',
            picks: ["It's ok, I'm Elena's friend.", 'I just need some touch paper for a guy called Guidor.'],
            want: 'touch paper',
            why: 'and keep the sample by not waving it about'
        },
        { stage: 12 },
        { has: 'touch_paper' },

        { note: 'wiki step 11: a vial each to the three errand boys round the fire outside' },
        { go: RIMMINGTON_FIRE, exact: true, r: 24, why: 'to the fire' },
        { talk: 'drunk1', picks: ['You give him the vial of sulphuric broline...'], want: 'Dancing Donkey', why: 'Hops takes the broline' },
        { hasnt: 'sulphuric_broline' },
        { talk: 'gambler1', picks: ['You give him the vial of liquid honey...'], want: 'Varrock', why: 'Chancy takes the honey' },
        { hasnt: 'liquid_honey' },
        { talk: 'artist1', picks: ['You give him the vial of ethenea...'], want: 'Varrock', why: 'Da Vinci takes the ethenea' },
        { hasnt: 'ethenea' },

        { note: 'wiki step 12: collect the vials again in the Dancing Donkey Inn' },
        { setpos: DANCING_DONKEY, why: 'to the inn in Varrock' },
        { talk: 'drunk2', want: 'vial', why: 'Hops kept his' },
        { has: 'sulphuric_broline' },
        { talk: 'gambler2', want: 'vial', why: 'Chancy kept his' },
        { has: 'liquid_honey' },
        { talk: 'artist2', want: 'vial', why: 'Da Vinci kept his' },
        { has: 'ethenea' },

        { note: 'wiki step 13: Guidor wife only lets priests in' },
        { give: 'priest_gown' },
        { give: 'priest_robe' },
        { held: 'priest_gown', op: 2, why: 'the top' },
        { held: 'priest_robe', op: 2, why: 'and the bottom' },
        { worn: 'priest_gown' },
        { worn: 'priest_robe' },
        { go: GUIDOR_HOUSE_DOOR, exact: true, r: 40, why: 'to his front door' },
        { loc: 'loc_1533', at: GUIDOR_HOUSE_DOOR, soft: true, why: 'into the house' },
        { loc: 'guidordoor', at: GUIDOR_DOOR, want: 'allows you to go in', why: 'and his wife lets a priest into the bedroom' },
        {
            talk: 'guidor',
            picks: [
                "I've come to ask your assistance in stopping a plague.",
                "I've been sent by your old pupil Elena.",
                'So what does that mean exactly?'
            ],
            want: 'no Plague',
            why: 'and the touch paper stays white'
        },
        { stage: 14 },

        { note: 'wiki step 14: Elena, then the king who built the wall' },
        { setpos: ELENA, why: 'back to Elena' },
        { talk: 'elena2', want: 'King of East Ardougne', why: 'this is bigger than both of us' },
        { stage: 15 },
        { setpos: LATHAS, why: 'to King Lathas on the castle first floor' },
        { talk: 'kinglathas', picks: ["I don't understand..."], want: 'brother', why: 'Tyras drank from the Chalice of Eternity' },
        { stage: 16 }
    ]
};

const p: any = H.makePlayer('biorun', m.start[0], m.start[1]);
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
