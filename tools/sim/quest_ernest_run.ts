// ERNEST THE CHICKEN, played through on foot.
//
// Quest 10 of the full quest-by-quest pass, and the biggest so far: Veronica at the gate, Oddenstein
// on the top floor, three machine parts scattered over the house and its grounds, and the lever maze
// in the basement.
//
// The maze is solved separately, by tools/sim/ernestmaze.ts, which feeds all 64 lever states through
// the content's own [proc,recalculate_ernest_doors] and searches (room, lever state) for a way to the
// oil can. Its answer is the 23 moves below, and they are the wiki's walkthrough move for move. Each
// door passage is preceded by a check that the door's varbit really is open, because the [aploc1]
// handler walks you through without looking - a closed door is unclickable in a client, so a sim that
// just clicked every door would "solve" the maze with the levers untouched.
//
//   npx tsx tools/sim/quest_ernest_run.ts
import * as H from './harness.js';
import { play, Manifest, Step } from './questrun.js';

await H.boot();

const LEVER: Record<string, [number, number]> = {
    A: [3108, 9745],
    B: [3118, 9752],
    C: [3112, 9760],
    D: [3108, 9767],
    E: [3097, 9767],
    F: [3096, 9765]
};
const DOOR: Record<string, [number, number]> = {
    '1to2': [3105, 9765],
    '2to3': [3100, 9765],
    '4to5': [3105, 9760],
    '5to6': [3100, 9760],
    '8to9': [3100, 9755],
    '2to5': [3102, 9763],
    '3to6': [3097, 9763],
    '4to7': [3108, 9758],
    '5to8': [3102, 9758]
};

const pull = (name: string, dir: string): Step[] => [{ loc: 'lever' + name.toLowerCase(), at: LEVER[name], want: 'lever ' + name + ' ' + dir, why: 'pull it ' + dir }];
const through = (name: string): Step[] => [
    { varis: 'ernestdoor_' + name, to: 1 },
    { loc: name, at: DOOR[name], why: 'through it' }
];

// The 23 moves ernestmaze.ts found, which are the wiki's own sequence.
const maze: Step[] = [
    ...pull('A', 'down'),
    ...pull('B', 'down'),
    ...through('4to7'),
    ...pull('D', 'down'),
    ...through('4to5'),
    ...through('5to8'),
    ...pull('A', 'up'),
    ...pull('B', 'up'),
    ...through('5to8'),
    ...through('5to6'),
    ...through('3to6'),
    ...pull('E', 'down'),
    ...pull('F', 'down'),
    ...through('2to3'),
    ...through('1to2'),
    ...pull('C', 'down'),
    ...through('1to2'),
    ...through('2to3'),
    ...pull('E', 'up'),
    ...through('2to3'),
    ...through('2to5'),
    ...through('5to8'),
    ...through('8to9')
];

const m: Manifest = {
    quest: 'ERNEST THE CHICKEN',
    source: 'oldschool.runescape.wiki/w/Ernest_the_Chicken',
    stageVar: 'haunted',
    done: 3, // ^haunted_complete
    start: [3111, 3330, 0],
    steps: [
        { note: 'wiki: no requirements and no items - the spade is on the floor of the manor.' },

        { note: 'wiki step 1: Veronica, by the manor gate' },
        { talk: 'veronica', picks: ['sounds like a quest'], why: 'her fiance went in and never came out' },
        { stage: 1 },

        { note: 'wiki step 1: in the front doors, up the centre staircase, then the spiral stairs west' },
        { loc: 'haunteddoorl', at: [3108, 3353], why: "the manor's front doors" },
        { go: [3109, 3357], why: 'across the entrance room' },
        { loc: 'draynor_panelled_door', at: [3109, 3358], why: 'the door into the hall', soft: true },
        { go: [3108, 3361], why: 'north to the staircase' },
        { loc: 'draynor_manor_stairs_up', at: [3108, 3362], why: 'up to the first floor' },
        { go: [3105, 3362, 1], why: 'west to the spiral stairs' },
        { loc: 'draynor_spiralstairs', at: [3104, 3362], why: 'up to the top floor' },
        { loc: 'draynor_panelled_door', at: [3108, 3364], why: "the door into Oddenstein's lab", soft: true },
        { talk: 'professor_oddenstein', picks: ['looking for a guy called Ernest', 'Change him back this instant'], why: 'Ernest is the chicken, and the machine is missing three parts' },
        { stage: 2 },

        { note: 'wiki step 2: the fish food, in the first-floor room south of the main staircase' },
        { loc: 'sarim_spiralstairstop', at: [3105, 3363], why: 'back down to the first floor' },
        { setpos: [3108, 3356, 1], why: 'round the first floor to the room south of the main staircase - the two wings only join at the north end, and that corridor is not this quest' },
        { take: 'fish_food', why: 'off the floor' },
        { has: 'fish_food' },

        { note: 'wiki step 2: the poison, in the small north-west room on the ground floor' },
        { setpos: [3098, 3366, 0], why: 'back down to the ground floor and across it to the north-west room' },
        { take: 'poison', why: 'off the floor' },
        { use: ['poison', 'fish_food'], want: 'poison the fish food', why: 'and poison it' },
        { has: 'poisoned_fish_food' },

        { note: 'wiki step 2: a spade, off the floor of the south-east room by the outside door' },
        { setpos: [3120, 3360, 0], why: 'across the ground floor to the south-east room' },
        { take: 'spade', why: 'off the floor' },
        { has: 'spade' },

        { note: 'wiki step 2: the fountain in the south-west of the grounds' },
        { setpos: [3088, 3335, 0], why: 'out of the south-east door and round the grounds' },
        { useLoc: 'hauntedfountain', at: [3087, 3334], obj: 'poisoned_fish_food', want: 'float to the surface', why: 'kill the piranhas' },
        { loc: 'hauntedfountain', at: [3087, 3334], want: 'pressure gauge from the fountain', why: 'and search it' },
        { has: 'pressure_gauge' },

        { note: 'wiki step 3: the compost heap on the west side of the grounds, dug with the spade' },
        { setpos: [3085, 3360, 0], why: 'north up the west side of the grounds' },
        { useLoc: 'hauntedcompostheap', at: [3084, 3360], obj: 'spade', want: 'find a small key', why: 'dig it' },
        { has: 'closet_key' },

        { note: 'wiki step 3: the closet behind the stairs, which that key opens' },
        { setpos: [3107, 3366, 0], why: 'back in through the front door' },
        { useLoc: 'closet_door', at: [3107, 3367], obj: 'closet_key', want: 'unlock the door', why: 'unlock it' },
        { go: [3110, 3367], why: 'into the closet' },
        { take: 'rubber_tube', why: 'off the floor, with a skeleton for company' },
        { has: 'rubber_tube' },

        { note: 'wiki step 4: the bookcase on the west wall, which is a secret door' },
        { setpos: [3098, 3358, 0], why: 'west across the ground floor' },
        { loc: 'hauntedbookcasel', at: [3097, 3358], want: 'secret door', why: 'search it' },
        { loc: 'puzzle_ladder_top', at: [3092, 3362], why: 'down into the basement' },

        { note: 'wiki step 4: the lever maze - 23 moves, and every door checked open first' },
        ...maze,
        { go: [3093, 9755], why: 'across the last room', exact: true },
        { take: 'oil_can', why: 'the oil can, at last' },
        { has: 'oil_can' },

        { note: 'wiki step 5: back up to Oddenstein with all three parts' },
        { setpos: [3110, 3367, 2], why: 'back up the ladder and the two staircases' },
        { talk: 'professor_oddenstein', why: 'he fixes the machine and un-chickens Ernest' },
        { stage: 3 },
        { wait: 4, why: 'npc_changetype_keepall lands on a later tick than the varp it sits beside' },
        { nearnpc: 'ernest', r: 12, why: 'the chicken is meant to BECOME him in front of you, and it did not' },
        { hasnt: 'oil_can' },
        { hasnt: 'pressure_gauge' },
        { hasnt: 'rubber_tube' },
        { has: 'coins', n: 300 }
    ]
};

const p: any = H.makePlayer('ernestrun', m.start[0], m.start[1]);
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
