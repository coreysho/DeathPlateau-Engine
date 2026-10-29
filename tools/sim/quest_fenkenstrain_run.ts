// CREATURE OF FENKENSTRAIN, played through on foot.
//
// Quest 68 of the quest-by-quest pass, and the second one in a row that had to be rebuilt rather
// than fixed. The shape was right and most of the sources were not: the doctor used to hand over the
// brain, the cavern key and the conductor mould; the amulet halves came off a bench and a ghost
// instead of out of the two books upstairs; the head was in a coffin; the extended brush hooked the
// shed key off a ledge, which the quest's own comment admitted was impossible since the brush is
// inside the shed the key opens; the player sewed the body themselves; and the quest ended with a
// journal and an argument instead of the Ring of Charos - which is obj 4202, in the middle of this
// quest's own obj block, and which Garden of Tranquillity needs.
//
//   NODE_MEMBERS=true npx tsx tools/sim/quest_fenkenstrain_run.ts
import * as H from './harness.js';
import { play, Manifest } from './questrun.js';

await H.boot();

const SIGNPOST: [number, number] = [3494, 3490];
const PUB: [number, number, number] = [3493, 3473, 0];
const ROAVAR: [number, number] = [3493, 3472];
const DOCTOR: [number, number, number] = [3551, 3551, 0];
const BOOKCASE_W: [number, number] = [3542, 3558];
const BOOKCASE_E: [number, number] = [3555, 3558];
const WOODS_GRAVE: [number, number] = [3629, 3483];
const MEMORIAL: [number, number] = [3505, 3571];
const MEMORIAL_OUT: [number, number, number] = [3505, 3572, 0];
// the three graves and the one side of each that forceapproach leaves open
const PLOT_GRAVES: [number, number][] = [
    [3502, 3576],
    [3504, 3577],
    [3506, 3576]
];
const PLOT_STANDS: [number, number][] = [
    [3503, 3576],
    [3504, 3576],
    [3505, 3576]
];
const GARDENER: [number, number, number] = [3551, 3562, 0];
const SHED_DOOR: [number, number] = [3548, 3565];
const CUPBOARD: [number, number] = [3546, 3563];
const CANES: [number, number] = [3551, 3564];
const FIREPLACE: [number, number] = [3544, 3555]; // upstairs west room
const ROOF: [number, number] = [3548, 3536];
const TOWER_DOOR: [number, number] = [3548, 3551];
const CREATURE: [number, number] = [3547, 3555];

const m: Manifest = {
    quest: 'CREATURE OF FENKENSTRAIN',
    source: 'oldschool.runescape.wiki/w/Creature_of_Fenkenstrain',
    stageVar: 'fenk_quest',
    done: 8,
    start: [SIGNPOST[0], SIGNPOST[1] + 1, 0],
    steps: [
        { note: 'requirements: Priest in Peril, Crafting 20 for the brush and the casting, Thieving' },
        { note: '25 for the pocket the ring is in. Items: a ghostspeak amulet, a spade, a needle and' },
        { note: 'five thread, three bronze wire, a silver bar and fifty coins for the brain.' },
        { setpos: [SIGNPOST[0], SIGNPOST[1] + 1, 0], why: 'the middle of Canifis' },

        { note: 'wiki step 1: the signpost advertises the job' },
        { loc: 'fenk_signpost', at: SIGNPOST, want: 'braindead butler', why: 'read the note' },
        { varis: 'fenk_read_signpost', to: 1 },

        { note: 'wiki step 3: the doctor is just inside the castle' },
        { setpos: DOCTOR, why: "to Fenkenstrain's castle" },
        {
            talk: 'fenk_fenkenstrain',
            picks: ["I'm here about the job.", 'Braindead.', 'Grave-digging.'],
            want: 'You are hired',
            why: 'the interview'
        },
        { stage: 1 },

        { note: 'wiki step 2: the two halves of the old lord\'s amulet are pressed in the two books' },
        { note: 'in the library upstairs - The Joy of Grave Digging and Handy Maggot Avoidance' },
        { note: 'Techniques - and they lock together into the star the memorials are cut for.' },
        { setpos: [BOOKCASE_W[0], BOOKCASE_W[1] - 1, 1], why: 'upstairs, west room' },
        { loc: 'fenk_bookcase', at: BOOKCASE_W, want: 'Joy of Grave Digging', why: 'search it' },
        { has: 'fenk_marble_amulet' },
        { setpos: [BOOKCASE_E[0], BOOKCASE_E[1] - 1, 1], why: 'and the east room' },
        { loc: 'fenk_bookcase', at: BOOKCASE_E, want: 'Maggot Avoidance', why: 'search it' },
        { has: 'fenk_obsidian_amulet' },
        { use: ['fenk_marble_amulet', 'fenk_obsidian_amulet'], want: 'six-pointed star', why: 'join them' },
        { has: 'fenk_star_amulet' },

        { note: 'wiki step 2: the pickled brain is in the tavern. The jar on the floor by the bar was' },
        { note: 'already spawned and nothing in the quest mentioned it; Roavar sells one as well.' },
        { give: 'coins', n: 50 },
        { setpos: PUB, why: 'to the Hair of the Dog in Canifis' },
        {
            talk: 'werewolfinnkeeper',
            picks: ['Is that a brain in a jar?', "Here's fifty gold."],
            want: 'pushes it across the bar',
            why: 'fifty gold'
        },
        { has: 'fenk_brain' },
        { note: 'the jar that was already in the map sits on the table tile itself, which is blocked -' },
        { note: 'so it cannot be walked up to and taken, which is exactly why the wiki offers' },
        { note: 'Telekinetic Grab as the free route. Fifty gold is the other one.' },

        { note: 'wiki step 3: the head is in the paupers\' field south-east of Canifis' },
        { give: 'spade' },
        { setpos: [WOODS_GRAVE[0] + 1, WOODS_GRAVE[1], 0], why: "to the paupers' field" },
        { loc: 'fenk_grave_poor', at: WOODS_GRAVE, want: 'ED LESTWIT', why: 'read it' },
        { loc: 'fenk_grave_poor', at: WOODS_GRAVE, op: 2, want: 'skull with the jaw still on it', why: 'dig it' },
        { has: 'fenk_head_empty' },
        { use: ['fenk_brain', 'fenk_head_empty'], want: 'into the head', why: 'the brain goes in first' },
        { has: 'fenk_head_full' },

        { note: 'wiki step 4: arms, legs and a torso. The three graves are behind railings that' },
        { note: 'touch nothing else on foot - the memorial below them is the only way in, and it' },
        { note: 'takes the star amulet.' },
        { setpos: MEMORIAL_OUT, why: 'to the memorial below the railings' },
        { loc: 'fenk_coffin', at: MEMORIAL, want: 'come up inside the railings', hop: true, why: 'push it' },
        { note: 'all three graves carry forceapproach, and at their angles that leaves one side' },
        { note: 'each - all three on the walkway the memorial comes up on' },
        { go: PLOT_STANDS[0], exact: true, r: 10, why: 'to the west grave' },
        { loc: 'fenk_grave', at: PLOT_GRAVES[0], op: 2, want: 'lift out a set of', why: 'dig' },
        { go: PLOT_STANDS[1], exact: true, r: 10, why: 'the middle one' },
        { loc: 'fenk_grave', at: PLOT_GRAVES[1], op: 2, want: 'lift out a set of', why: 'dig' },
        { go: PLOT_STANDS[2], exact: true, r: 10, why: 'and the east one' },
        { loc: 'fenk_grave', at: PLOT_GRAVES[2], op: 2, want: 'lift out a set of', why: 'dig' },
        { has: 'fenk_arms' },
        { has: 'fenk_legs' },
        { has: 'fenk_torso' },
        { loc: 'fenk_coffin', at: MEMORIAL, want: 'back out below the railings', hop: true, why: 'and out again' },

        { note: 'wiki step 5: he cannot sew, so he wants a needle and five thread and does it' },
        { note: 'himself - which is what %fenk_needle and %fenk_threads_given are for.' },
        { setpos: DOCTOR, why: 'back to the doctor' },
        { talk: 'fenk_fenkenstrain', want: 'cannot sew', why: 'he takes the parts' },
        { stage: 2 },
        { give: 'needle' },
        { give: 'thread', n: 5 },
        { talk: 'fenk_fenkenstrain', want: 'shape that a person would fit into', why: 'and sews it' },
        { stage: 3 },
        { varis: 'fenk_needle', to: 1 },
        { varis: 'fenk_threads_given', to: 1 },

        { note: 'wiki step 5: the gardener has the shed key, and knows where everything in that' },
        { note: 'house ends up' },
        { give: 'amulet_of_ghostspeak' },
        { held: 'amulet_of_ghostspeak', op: 2, why: 'he is a ghost' },
        { worn: 'amulet_of_ghostspeak' },
        { setpos: GARDENER, why: 'round the back to the gardener' },
        { talk: 'fenk_gardener_multi_2', want: 'up the chimney', why: 'the key and the chimney' },
        { has: 'fenk_shed_key' },

        { note: 'wiki step 17-18: the brush out of the cupboard, three canes off the pile, and a' },
        { note: 'wire to bind each one on' },
        { go: [SHED_DOOR[0], SHED_DOOR[1] + 1], exact: true, r: 20, why: 'to the shed' },
        { loc: 'fenk_shed_door', at: SHED_DOOR, want: 'unlock the shed', why: 'unlock it' },
        { go: [CUPBOARD[0] + 1, CUPBOARD[1]], exact: true, r: 20, why: 'to the cupboard' },
        { loc: 'fenk_broomcupboard', at: CUPBOARD, why: 'open it' },
        { loc: 'fenk_broomcupboard_open', at: CUPBOARD, op: 2, want: 'garden brush', why: 'and search it' },
        { has: 'fenk_brush0' },
        { give: 'bronzecraftwire', n: 3 },
        { note: 'the shed door shuts itself behind you, so it wants clicking again on the way out' },
        { loc: 'fenk_shed_door', at: SHED_DOOR, soft: true, why: 'back out of the shed' },
        { go: [CANES[0] - 1, CANES[1]], exact: true, r: 20, why: 'to the cane pile' },
        { loc: 'fenk_canepile', at: CANES, want: 'garden cane', why: 'one' },
        { loc: 'fenk_canepile', at: CANES, want: 'garden cane', why: 'two' },
        { loc: 'fenk_canepile', at: CANES, want: 'garden cane', why: 'three' },
        { has: 'fenk_cane', n: 3 },
        { use: ['fenk_cane', 'fenk_brush0'], want: 'bind another cane', why: 'lash one on' },
        { use: ['fenk_cane', 'fenk_brush1'], want: 'bind another cane', why: 'and another' },
        { use: ['fenk_cane', 'fenk_brush2'], want: 'bind another cane', why: 'and the third' },
        { has: 'fenk_brush3' },
        { hasnt: 'bronzecraftwire' },

        { note: 'wiki step 19: the centre of the fireplace, not the surround - which is the cache\'s' },
        { note: 'own distinction: fenk_fireplace has no ops and the two surrounds beside it are' },
        { note: '"Mmm.. scented candles".' },
        { setpos: [FIREPLACE[0] - 1, FIREPLACE[1], 1], why: 'upstairs to the west room' },
        { useLoc: 'fenk_fireplace_left', at: [FIREPLACE[0], FIREPLACE[1] - 1], obj: 'fenk_brush3', want: 'It was the chimney itself', why: 'the surround gets you nothing' },
        { useLoc: 'fenk_fireplace', at: FIREPLACE, obj: 'fenk_brush3', want: 'two dead birds', why: 'sweep the chimney' },
        { has: 'fenk_lightning_mould' },

        { note: 'wiki step 20-21: cast it in silver and get it onto the roof' },
        { give: 'silver_bar' },
        { use: ['silver_bar', 'fenk_lightning_mould'], want: 'cast the silver', why: 'the conductor' },
        { has: 'fenk_conductor' },
        { setpos: [ROOF[0], ROOF[1] + 1, 2], why: 'up to the roof' },
        { loc: 'fenk_conductor_broken', at: ROOF, want: 'fit the new conductor', why: 'fit it' },
        { stage: 4 },
        { varis: 'fenk_conductor_repaired', to: 1 },

        { note: 'wiki step 21-22: the storm, and then it goes for him and he locks it in the tower' },
        { setpos: DOCTOR, why: 'back to the doctor' },
        { talk: 'fenk_fenkenstrain', want: 'IT LIVES', why: 'he throws the switch' },
        { stage: 5 },
        { talk: 'fenk_fenkenstrain', want: 'tried to kill me', why: 'and hands over the tower key' },
        { has: 'fenk_tower_key' },

        { note: 'wiki step 23: Lord Rologarth, who owned the place' },
        { setpos: [TOWER_DOOR[0], TOWER_DOOR[1] - 1, 1], why: 'upstairs to the tower door' },
        { loc: 'fenk_tower_door', at: TOWER_DOOR, want: 'swings open', why: 'unlock it' },
        { varis: 'fenk_unlocked_tower', to: 1 },
        { setpos: [CREATURE[0] + 1, CREATURE[1], 2], why: 'up the tower' },
        { talk: 'fenk_creature', want: 'Lord Rologarth', why: 'what Fenkenstrain did' },
        { stage: 6 },

        { note: 'wiki step 24: the ring is on the doctor\'s finger, and 25 Thieving gets it off' },
        { setpos: DOCTOR, why: 'back down to the doctor' },
        { talk: 'fenk_fenkenstrain', op: 3, want: 'off the doctor', why: 'pick his pocket' },
        { has: 'ring_of_charos' },
        { wait: 6, why: 'the completion is queued behind the tower door slamming' },
        { stage: 8 },
        { talk: 'fenk_creature_released', want: 'estate is mine again', why: 'and he has his hall back' }
    ]
};

const p: any = H.makePlayer('fenkrun', m.start[0], m.start[1]);
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
