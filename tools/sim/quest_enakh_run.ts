// ENAKHRA'S LAMENT, played through on foot.
//
// Quest 80 of the quest-by-quest pass. A mason in the desert has been paid four months up front to
// build a statue, and the statue is a door handle: it falls into a temple nobody has opened in four
// thousand years, where a Mahjarrat has another Mahjarrat built into a boneguard and a man built
// into a lamp.
//
// The ring under the statue is four quadrants joined at the corners by doors shaped like the fallen
// statue's own arms and legs, and each quadrant's way into the middle wants the sigil from a
// DIFFERENT quadrant. Mapped with tools/sim/_enakhring.ts:
//
//   NW  sigil K   door M into the middle   corners: left arm (3082,9287), left leg (3079,9334)
//   SW  sigil Z   door R                   corners: right arm (3126,9337), left leg
//   NE  sigil R   door Z                   corners: left arm, right leg (3129,9290)
//   SE  sigil M   door K                   corners: right arm, right leg   <- and the fallen statue
//
// so the short way is: drop into SE (the south boulder), prise all four limbs off the statue, take
// the M sigil, walk SE -> NE -> NW through two corner doors, and open the M door.
//
//   NODE_MEMBERS=true npx tsx tools/sim/quest_enakh_run.ts
import * as H from './harness.js';
import { play, Manifest } from './questrun.js';

await H.boot();

const LAZIM: [number, number, number] = [3191, 2927, 0];
const ROCK: [number, number] = [3173, 2918];
const STATUE: [number, number] = [3189, 2925];
const BOULDER_S: [number, number] = [3189, 2888];
const LAND_SE: [number, number, number] = [3127, 9330, 0];
const FALLEN: [number, number] = [3129, 9325];
const SIGIL_M: [number, number] = [3128, 9319];
const DOOR_RLEG: [number, number] = [3129, 9290];
const DOOR_LARM: [number, number] = [3082, 9287];
const DOOR_M: [number, number] = [3097, 9312];
const CENTRE_LADDER: [number, number] = [3104, 9309];
const PEDESTAL: [number, number] = [3104, 9312];
const FOUNTAIN: [number, number, number] = [3091, 9308, 1];
const FURNACE: [number, number, number] = [3115, 9324, 1];
const PRISON: [number, number, number] = [3091, 9325, 1];
const BRAZIERS: [number, number][] = [
    [3114, 9306],
    [3116, 9306],
    [3118, 9306],
    [3114, 9309],
    [3116, 9309],
    [3118, 9309]
];
const MAGIC_WALL: [number, number] = [3104, 9319];
const UP_TO_ALTAR: [number, number] = [3104, 9332];
const ALTAR: [number, number, number] = [3108, 9321, 2];
const AKTHANAKOS: [number, number, number] = [3105, 9298, 1];
const ENAKHRA: [number, number, number] = [3104, 9287, 1];

const brazier = (i: number): any[] => [
    { go: [BRAZIERS[i][0], BRAZIERS[i][1] - 1], exact: true, r: 24, why: 'to brazier ' + (i + 1) },
    {
        useLoc: 'enakh_brazier_' + (i + 1) + '_multiloc',
        at: BRAZIERS[i],
        obj: 'tinderbox',
        soft: true,
        why: 'light brazier ' + (i + 1)
    }
];

const m: Manifest = {
    quest: "ENAKHRA'S LAMENT",
    source: "oldschool.runescape.wiki/w/Enakhra's_Lament",
    stageVar: 'enakh_quest',
    done: 70, // ^enakh_complete
    start: LAZIM,
    steps: [
        { note: 'requirements: 50 Crafting, 45 Firemaking, 45 Mining, 43 Magic, 45 Prayer.' },
        { note: 'Items: a tinderbox. The pickaxe and the chisel are both found in the quest.' },
        { give: 'tinderbox' },

        { note: 'wiki step 1: Lazim has been building a statue for four months' },
        { setpos: LAZIM, why: 'to Lazim at the building site' },
        {
            talk: 'enakh_lazim_statue_east_multinpc',
            picks: ['What are you building?'],
            want: 'thirty-two kilo block',
            why: 'he takes you on as labour'
        },
        { stage: 10 },
        { has: 'enakh_chisel' },

        { note: 'wiki step 2: the pickaxe is in the rock, and so is everything else' },
        { go: [ROCK[0], ROCK[1] - 1], exact: true, r: 40, why: 'to the rock' },
        { loc: 'enakh_mining_stone', at: ROCK, want: 'work the pickaxe out', why: 'take the pickaxe' },
        { has: 'bronze_pickaxe' },
        { loc: 'enakh_mining_stone', at: ROCK, want: 'lever a block', why: 'the base and legs block' },
        { has: 'enakh_sandstone_huge_base+legs' },
        { loc: 'enakh_mining_stone', at: ROCK, want: 'lever a block', why: 'and the body block' },
        { has: 'enakh_sandstone_huge_body' },

        { note: 'wiki step 3: cut both square' },
        { use: ['enakh_chisel', 'enakh_sandstone_huge_base+legs'], want: 'base and a pair of legs', why: 'carve the base' },
        { use: ['enakh_chisel', 'enakh_sandstone_huge_body'], want: 'torso', why: 'and the body' },

        { note: 'wiki step 4: build it, and Lazim squares off the joins' },
        { go: [STATUE[0], STATUE[1] - 1], exact: true, r: 40, why: 'to the statue' },
        { useLoc: 'enakh_statue_east_multiloc', at: STATUE, obj: 'enakh_sandstone_crafted_base+legs', want: 'heave the base', why: 'the base' },
        { useLoc: 'enakh_statue_east_multiloc', at: STATUE, obj: 'enakh_sandstone_crafted_body', want: 'lift the torso', why: 'and the body' },
        { talk: 'enakh_lazim_statue_east_multinpc', want: 'Five kilos of granite', why: 'he rasps the joins square' },
        { stage: 20 },

        { note: 'wiki step 5: five kilos of granite, and the face is your choice' },
        { go: [ROCK[0], ROCK[1] - 1], exact: true, r: 40, why: 'back to the rock' },
        { loc: 'enakh_mining_stone', at: ROCK, want: 'lever a block', why: 'the granite' },
        { has: 'enakh_granite_medium' },
        { use: ['enakh_chisel', 'enakh_granite_medium'], picks: ['Zamorak.'], want: 'carved a stone head', why: 'carve a Zamorak head' },
        { has: 'enakh_statue_head_zamorak' },

        { note: 'and the statue goes down the moment the head is on it' },
        { go: [STATUE[0], STATUE[1] - 1], exact: true, r: 40, why: 'to the statue' },
        { useLoc: 'enakh_statue_east_multiloc', at: STATUE, obj: 'enakh_statue_head_zamorak', want: 'four boulders', why: 'put the head on' },
        { stage: 30 },
        { varis: 'enakh_statue_fallen', to: 3 },

        { note: 'wiki step 6: four boulders out in the desert have shifted. The southern one drops' },
        { note: 'into the quadrant with the fallen statue in it.' },
        { go: [BOULDER_S[0], BOULDER_S[1] - 1], exact: true, r: 60, why: 'to the southern boulder' },
        { loc: 'enakh_secret_boulder_multiloc_s', at: BOULDER_S, hop: true, soft: true, why: 'lower yourself in' },
        { stage: 40 },

        { note: 'wiki step 7: four limbs off the fallen statue, and they are the corner keys' },
        { go: [FALLEN[0] - 1, FALLEN[1]], exact: true, r: 40, why: 'to the fallen statue' },
        { useLoc: 'enakh_fallen_statue_east_multiloc', at: FALLEN, obj: 'enakh_chisel', want: 'left arm', why: 'the left arm' },
        { useLoc: 'enakh_fallen_statue_east_multiloc', at: FALLEN, obj: 'enakh_chisel', want: 'right arm', why: 'the right arm' },
        { useLoc: 'enakh_fallen_statue_east_multiloc', at: FALLEN, obj: 'enakh_chisel', want: 'left leg', why: 'the left leg' },
        { useLoc: 'enakh_fallen_statue_east_multiloc', at: FALLEN, obj: 'enakh_chisel', want: 'right leg', why: 'and the right leg' },
        { has: 'enakh_arm_left' },
        { has: 'enakh_arm_right' },
        { has: 'enakh_leg_left' },
        { has: 'enakh_leg_right' },

        { note: 'the M sigil is in this quadrant and its door is two quadrants round' },
        { go: [SIGIL_M[0] - 1, SIGIL_M[1]], exact: true, r: 40, why: 'to the M pedestal' },
        { loc: 'enakh_pedestal_sigil_m', at: SIGIL_M, want: 'other side of the ring', why: 'lift the sigil' },
        { has: 'enakh_sigil_m' },
        { go: [DOOR_RLEG[0], DOOR_RLEG[1] + 1], exact: true, r: 60, why: 'to the right-leg corner' },
        { loc: 'enakh_door_right_leg', at: DOOR_RLEG, hop: true, soft: true, why: 'SE into NE' },
        { go: [DOOR_LARM[0] + 1, DOOR_LARM[1]], exact: true, r: 90, why: 'round to the left-arm corner' },
        { loc: 'enakh_door_left_arm', at: DOOR_LARM, hop: true, soft: true, why: 'NE into NW' },
        { go: DOOR_M, exact: true, r: 90, why: 'to the M door' },
        { loc: 'enakh_door_m_sigil', at: DOOR_M, hop: true, soft: true, why: 'and the sigil slots home' },

        { note: 'the middle holds the only ladder up into the temple' },
        { go: [CENTRE_LADDER[0], CENTRE_LADDER[1] - 1], exact: true, r: 40, why: 'to the centre ladder' },
        { loc: 'enakh_temple_ladderup', at: CENTRE_LADDER, hop: true, soft: true, why: 'up into the temple' },

        { note: 'wiki step 8: the four elements. Ice is a fire against the crust on the fountain.' },
        { setpos: FOUNTAIN, why: 'to the frozen fountain' },
        { talk: 'enakh_dummy_fountain_multinpc', op: 2, want: 'fountain starts running', why: 'melt the crust' },
        { varis: 'enakh_ice_room', to: 1 },

        { note: 'smoke is the packed grate on the furnace, and a chisel' },
        { setpos: FURNACE, why: 'to the furnace' },
        { talk: 'enakh_dummy_furnace_multinpc', op: 2, want: 'hot enough to catch', why: 'clear the grate' },
        { varis: 'enakh_smoke_room', to: 1 },

        { note: 'shadow is all six braziers, which is what six separate bits are for' },
        ...brazier(0),
        ...brazier(1),
        ...brazier(2),
        ...brazier(3),
        ...brazier(4),
        ...brazier(5),
        { varis: 'enakh_shadow_room', to: 1 },

        { note: 'and blood is Pentyn, who has been running the ward for four thousand years' },
        { setpos: PRISON, why: 'to the light prison' },
        { talk: 'enakh_pentyn', want: 'anchored', why: 'he says where to hit it' },
        { useLoc: 'enakh_light_prison', at: [PRISON[0], PRISON[1] - 1], obj: 'enakh_chisel', want: 'light goes out', why: 'put the chisel through the anchor' },
        { varis: 'enakh_blood_room', to: 1 },
        { stage: 50 },

        { note: 'wiki step 9: the barrier gives once all four channels are running, and Lazim is' },
        { note: 'up at the altar with a head in his bag he has never looked at' },
        { go: [MAGIC_WALL[0], MAGIC_WALL[1] - 1], exact: true, r: 60, why: 'to the barrier' },
        { loc: 'enakh_magic_wall', at: MAGIC_WALL, hop: true, want: 'barrier thins', why: 'pass through' },
        { go: [UP_TO_ALTAR[0], UP_TO_ALTAR[1] - 1], exact: true, r: 40, why: 'to the altar ladder' },
        { loc: 'enakh_temple_ladderup', at: UP_TO_ALTAR, hop: true, soft: true, why: 'up to the altar' },
        { setpos: ALTAR, why: 'to the altar' },
        { talk: 'enakh_lazim_altar_multinpc', want: 'I want it out of my bag', why: 'he hands over the head' },
        { has: 'enakh_stone_head_akthanakos' },

        { note: 'wiki step 10: the head fits the pedestal exactly, and what comes out of the' },
        { note: 'boneguard is the other Mahjarrat' },
        { setpos: [PEDESTAL[0], PEDESTAL[1] - 1, 1], why: 'back down to the pedestal' },
        { useLoc: 'enakh_pedestal_multiloc', at: PEDESTAL, obj: 'enakh_stone_head_akthanakos', want: 'comes apart', why: 'put the head in the recess' },
        { stage: 60 },
        { varis: 'enakh_akthanakos_form', to: 1 },

        { note: 'wiki step 11: he walks at the wall Lazim spent three thousand bricks on' },
        { setpos: AKTHANAKOS, why: 'to Akthanakos' },
        { talk: 'enakh_akthanakos_multinpc', want: 'come down in one piece', why: 'stand further back' },
        { varis: 'enakh_largewall_multivar', to: 4 },

        { note: 'wiki step 12: and behind it she has been listening the whole time' },
        { setpos: ENAKHRA, why: 'to Enakhra' },
        { talk: 'enakh_enakhra_multinpc', want: 'not there any more', why: 'she puts the hood back' },
        { stage: 65 },
        { setpos: AKTHANAKOS, why: 'back to Akthanakos' },
        { talk: 'enakh_akthanakos_multinpc', want: 'door handle', why: 'what the statue was for' },
        { stage: 70 },
        { has: 'camulet' }
    ]
};

const p: any = H.makePlayer('enakhrun', m.start[0], m.start[1]);
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
