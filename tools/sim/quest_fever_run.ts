// CABIN FEVER, played through on foot.
//
// Quest 65 of the quest-by-quest pass. Bill Teach is short of crew because the last lot heard who
// he sails against, and the whole middle of the quest is one cannon drill out of chapter four of
// the Book o' piracy: clean her, charge her, pack her, shot her, fuse her, and light her from one
// side. Three hits and the other ship's gun comes off its mounting.
//
//   NODE_MEMBERS=true npx tsx tools/sim/quest_fever_run.ts
import * as H from './harness.js';
import { play, Manifest, Step } from './questrun.js';

await H.boot();

const TEACH: [number, number, number] = [3680, 3495, 0];
const GANGPLANK: [number, number] = [3710, 3496];
const PUB_DOOR: [number, number] = [3670, 3497]; // the only way out of the harbour building
const DECK: [number, number] = [1815, 4836]; // the ladder, both ends
const REPAIR_LOCKER: [number, number] = [1814, 4832];
const GUN_LOCKER: [number, number] = [1816, 4833];
const POWDER: [number, number] = [1817, 4832];
const CANNON: [number, number] = [1816, 4833];
const HOLES: [number, number][] = [
    [1816, 4834],
    [1816, 4832],
    [1816, 4830]
];

// One shot: the ramrod, the charge, the ramrod again, the shot, the fuse, and then the same op
// again lights it. The book's order, and the order the varbits are checked in.
const shot = (n: number): Step[] => [
    { go: [POWDER[0] - 1, POWDER[1]], exact: true, r: 20, why: 'to the powder barrel' },
    { loc: 'fever_your_gunpowder_barrel', at: POWDER, want: 'powder', why: 'a charge' },
    { go: [CANNON[0] - 1, CANNON[1]], exact: true, r: 20, why: 'to the gun' },
    { loc: 'fever_multi_cannon', at: CANNON, want: 'ramrod down the barrel', why: 'clean her' },
    { loc: 'fever_multi_cannon', at: CANNON, want: 'tip the charge in', why: 'charge her' },
    { loc: 'fever_multi_cannon', at: CANNON, want: 'pack the charge down', why: 'pack her' },
    { loc: 'fever_multi_cannon', at: CANNON, want: 'For timber', why: 'shot her' },
    { loc: 'fever_multi_cannon', at: CANNON, want: 'She is ready', why: 'fuse her' },
    { varis: 'fever_cannon', to: 3 },
    { loc: 'fever_multi_cannon', at: CANNON, want: 'light the fuse', why: 'shot ' + n },
    { varis: 'fever_cannon_accuracy', to: n }
];

const m: Manifest = {
    quest: 'CABIN FEVER',
    source: 'oldschool.runescape.wiki/w/Cabin_Fever',
    stageVar: 'fever_quest',
    done: 7,
    start: TEACH,
    steps: [
        { note: "requirements: Pirate's Treasure, Rum Deal, and Agility 42, Crafting 45, Smithing 50" },
        { note: 'and Ranged 40. Bill hands out everything the quest needs out of his own lockers.' },
        { setvar: 'hunt', to: 4, why: "^hunt_complete - Pirate's Treasure" },
        { setvar: 'deal_quest', to: 9, why: '^deal_complete - Rum Deal' },

        { note: 'wiki step 1: Bill Teach in the Green Ghost, and the book' },
        { talk: 'fever_teach', picks: ["I'll sail."], want: 'Book o', why: 'he signs you on' },
        { stage: 1 },
        { has: 'fever_piracy_book' },
        { held: 'fever_piracy_book', why: 'chapter four is the gun drill' },
        { stage: 2 },

        { note: 'wiki step 3: the gangplank at the end of the pier, and then cast off. Teach drinks' },
        { note: 'in the harbour building and its one door is at the far west end, so the walk out is' },
        { note: 'a door click first - the pathfinder will not open one.' },
        { go: [PUB_DOOR[0] + 1, PUB_DOOR[1]], exact: true, r: 20, why: 'to the door' },
        { loc: 'ahoy_harbour_door', at: PUB_DOOR, why: 'out onto the quay' },
        { go: [GANGPLANK[0] - 1, GANGPLANK[1]], exact: true, r: 60, why: 'to the gangplank' },
        { loc: 'fever_gangplank', at: GANGPLANK, why: 'aboard' },
        { stage: 3 },
        { talk: 'fever_port_ship_teach', want: 'takes the top off the mainmast', why: 'cast off, and the other ship finds you' },
        { stage: 4 },

        { note: 'wiki step 5: the lockers are aft and down a ladder - planks, paste and a hammer in' },
        { note: 'one, the ramrod, fuses, shot and a tinderbox in the other. Each locker opens first' },
        { note: 'and is searched second; the open one is a different loc with its own ops.' },
        { loc: 'fever_ship_laddertop', at: DECK, why: 'down to the lower deck' },
        { go: [REPAIR_LOCKER[0] + 1, REPAIR_LOCKER[1]], exact: true, r: 20, why: 'to the repair locker' },
        { loc: 'fever_repair_locker', at: REPAIR_LOCKER, want: 'open the locker', why: 'open it' },
        { loc: 'fever_repair_locker_open', at: REPAIR_LOCKER, why: 'and take what is in it' },
        { has: 'fever_repair_plank', n: 3 },
        { has: 'swamppaste', n: 3 },
        { has: 'hammer' },
        { go: [GUN_LOCKER[0] - 1, GUN_LOCKER[1]], exact: true, r: 20, why: 'to the gun locker' },
        { loc: 'fever_weapons_locker', at: GUN_LOCKER, want: 'open the locker', why: 'open it' },
        { loc: 'fever_weapons_locker_open', at: GUN_LOCKER, why: 'and take what is in it' },
        { has: 'fever_cannon_prod' },
        { has: 'fever_fuse', n: 3 },
        { has: 'fever_cannon_ball', n: 5 },
        { has: 'fever_tinderbox' },

        { note: 'wiki step 17: the drill, three times. She fires back after every hit and the hull' },
        { note: 'opens in three places.' },
        { loc: 'fever_ship_ladder', at: DECK, why: 'back up on deck' },
        ...shot(1),

        { note: 'wiki step 11: a plank in each hole and swamp paste over the plank. Three holes, and' },
        { note: 'they open again every time she hits back - the locker restocks.' },
        { loc: 'fever_ship_laddertop', at: DECK, why: 'down to the hull' },
        { go: [HOLES[0][0], HOLES[0][1]], exact: true, r: 20, why: 'to the hole forward' },
        { loc: 'fever_multi_hole_1', at: HOLES[0], want: 'plank', why: 'fill it' },
        { loc: 'fever_multi_hole_1', at: HOLES[0], want: 'paste', why: 'waterproof it' },
        { varis: 'fever_hole_1', to: 2 },
        { go: [HOLES[1][0], HOLES[1][1]], exact: true, r: 20, why: 'amidships' },
        { loc: 'fever_multi_hole_2', at: HOLES[1], want: 'plank', why: 'fill it' },
        { loc: 'fever_multi_hole_2', at: HOLES[1], want: 'paste', why: 'waterproof it' },
        { varis: 'fever_hole_2', to: 2 },
        { go: [HOLES[2][0], HOLES[2][1]], exact: true, r: 20, why: 'aft' },
        { loc: 'fever_multi_hole_3', at: HOLES[2], want: 'plank', why: 'fill it' },
        { loc: 'fever_multi_hole_3', at: HOLES[2], want: 'paste', why: 'waterproof it' },
        { varis: 'fever_hole_3', to: 2 },

        { note: 'and the last two shots' },
        { loc: 'fever_ship_ladder', at: DECK, why: 'back up on deck' },
        ...shot(2),
        ...shot(3),
        { stage: 5 },
        { varis: 'fever_enemy_cannon', to: 1 },

        { note: 'wiki step 22: two hours with a shortened mast, and then Mos Le\'Harmless' },
        { talk: 'fever_quest_ship_teach', want: 'off its mounting', why: 'she is done' },
        { stage: 6 },
        { talk: 'fever_harmless_teach', want: 'crew list', why: 'the crew list' },
        { wait: 8, why: 'he writes your name in it' },
        { stage: 7 },
        { has: 'coins', n: 10000 }
    ]
};

const p: any = H.makePlayer('fevrun', m.start[0], m.start[1]);
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
