// HAUNTED MINE, played through on foot.
//
// Quest 46 of the quest-by-quest pass. A Saradominist stands in a swamp telling everybody there is
// no mine; there is, and the way down it is a glowing fungus that cannot be carried out of the
// cave, eleven point levers with three of them under water, an ore cart used as a counterweight,
// and the mine's last foreman, who has been dead for eighty years and is still doing the job.
//
//   npx tsx tools/sim/quest_hauntedmine_run.ts
import * as H from './harness.js';
import { play, Manifest } from './questrun.js';

await H.boot();

const ZEALOT: [number, number, number] = [3444, 3259, 0];
// One of eighteen, and one of the six a player standing in the loading bay can actually reach:
// most of them are wall decorations with their only open side facing a different chamber.
const FUNGUS: [number, number] = [2782, 4494];
const LOADCART: [number, number] = [2778, 4506];
const BOARD: [number, number] = [2769, 4522];
const DROPCART: [number, number] = [2774, 4537];
const CRATE: [number, number] = [2800, 4500];
const VALVE: [number, number] = [2808, 4496];
const LIFT: [number, number] = [2807, 4494];
const STAIRS_E: [number, number] = [2746, 4436];
const STAIRS_W: [number, number] = [2692, 4436];
const BACK_UP_E: [number, number] = [2812, 4452];
const BOSSDOOR: [number, number] = [2799, 4453];
const REWARDDOOR: [number, number] = [2773, 4450];

const m: Manifest = {
    quest: 'HAUNTED MINE',
    source: 'oldschool.runescape.wiki/w/Haunted_Mine/Quick_guide',
    stageVar: 'hauntedmine',
    done: 6,   // ^hm_complete
    start: [3444, 3259, 0],
    steps: [
        { note: 'requirement: Priest in Peril, which quest_priestperil_run.ts walks in full. The' },
        { note: 'zealot would not have talked at all without it until now.' },
        { setvar: 'priestperil', to: 60, why: '^priestperil_complete' },

        { note: 'wiki step 1: the Zealot, in the swamp south of Mort’ton. He is a map spawn at' },
        { note: '3444,3258 and he answers four things: the quest, the massacre, the other ways in,' },
        { note: 'and the key on his belt.' },
        { talk: 'saradominist_zealot', want: 'There is no mine', why: 'he refuses, at length' },
        { stage: 1 },
        { note: 'and the second word with him is the three questions, which are a menu now' },
        { talk: 'saradominist_zealot', picks: ['What is the key on your belt for?'], want: 'hand went to his belt', why: 'he says the key is for nothing' },

        { note: 'wiki step 1b: pickpocket him. No Thieving level - the walkthrough has none on it -' },
        { note: 'and no roll, because it is a quest step.' },
        { talk: 'saradominist_zealot', op: 3, want: 'heavy iron key', why: 'the Zealot’s key' },
        { stage: 2 },
        { has: 'hauntedmine_lift_key' },

        { note: 'wiki step 2-5: inside, and down to the level the points are on. The three crawl' },
        { note: 'holes and the cart all work; the ladders between squares are walked by the legs' },
        { note: 'below rather than all six times over.' },
        { setpos: [2783, 4494, 0], why: 'down to the pool level (m43_70)' },

        { note: 'wiki step 5a: a glowing fungus off the pool. Eighteen of these locs carry op1=Pick' },
        { note: 'and none of them had a trigger, so there was no light source in the game at all.' },
        { loc: 'glowing_mushroom', at: FUNGUS, want: 'glowing fungus', why: 'pick one' },
        { has: 'glowing_fungus' },

        { note: 'wiki step 5b: the fungus goes in the loading cart. It burns to ash in the open air,' },
        { note: 'which is why it cannot simply be carried.' },
        { setpos: [2778, 4505, 0], why: 'north to the loading bay' },
        { useLoc: 'hauntedmine_puzzle_cart', at: LOADCART, obj: 'glowing_fungus', want: 'stays lit in there', why: 'load it' },
        { hasnt: 'glowing_fungus' },

        { note: 'wiki step 5c: the points. Eleven of them, 9, 10 and 11 under water with no ops at' },
        { note: 'all, and the board says throw 1, 3, 4, 6 and 8.' },
        { loc: 'hauntedmine_point_lever1', at: [2785, 4517], want: 'Point 1 throws over', why: 'throw 1' },
        { loc: 'hauntedmine_point_lever3', at: [2786, 4517], want: 'Point 3 throws over', why: 'throw 3' },
        { loc: 'hauntedmine_point_lever4', at: [2786, 4515], want: 'Point 4 throws over', why: 'throw 4' },
        { note: 'and 6, 7 and 8 are round the corner to the north, in sight of the three that are' },
        { note: 'under water and have no ops at all. It is one walk from here in the same chamber,' },
        { note: 'but a long twisting one, so the legs are jumped rather than paced out.' },
        { setpos: [2771, 4533, 0], why: 'round the corner north to levers 6-8' },
        { loc: 'hauntedmine_point_lever6', at: [2768, 4533], want: 'Point 6 throws over', why: 'throw 6' },
        { loc: 'hauntedmine_point_lever8', at: [2770, 4533], want: 'Point 8 throws over', why: 'throw 8' },

        { note: 'wiki step 5d: and the start lever on the board, which is what sends the cart' },
        { setpos: [2770, 4523, 0], why: 'back south to the points board' },
        { loc: 'hauntedmine_points_info', at: BOARD, picks: ['Start the cart.'], want: 'crimson arrow', why: 'run the cart' },
        { stage: 3 },

        { note: 'wiki step 6: the cart is at the far side with the fungus still in it' },
        { setpos: [2775, 4537, 0], why: 'north-west to where the cart stopped' },
        { loc: 'hauntedmine_puzzle_cart', at: DROPCART, want: 'out of the cart', why: 'take the fungus back' },
        { has: 'glowing_fungus' },

        { note: 'wiki step 7: a chisel out of the crate by the lift - the walkthrough says to take' },
        { note: 'one now, because the only thing it is for is eighty feet further down' },
        { setpos: [2799, 4500, 0], why: 'east to the tool crate' },
        { loc: 'hauntedmine_chisel_crate', at: CRATE, want: 'take a chisel', why: 'the chisel' },
        { has: 'chisel' },

        { note: 'wiki step 7b: the Zealot’s key ON the valve. It wanted the key in your pocket' },
        { note: 'before; the walkthrough uses it on the valve, so it is an oplocu now.' },
        { setpos: [2807, 4496, 0], why: 'round the pipe to the valve' },
        { useLoc: 'hauntedmine_lift_valve', at: VALVE, obj: 'hauntedmine_lift_key', want: 'tank is filling', why: 'open the water' },

        { note: 'and then the lift, before the mischievous ghost shuts it again' },
        { setpos: [2806, 4493, 0], why: 'three tiles to the lift' },
        { loc: 'lift_side_l', at: LIFT, want: 'only light in it is in your hand', why: 'ride it down' },
        { stage: 4 },

        { note: 'wiki step 7c: east along the track and down the dark stairs' },
        { setpos: [2746, 4437, 0], why: 'east along the level-5 track' },
        { loc: 'hauntedmine_dark_stairs_top', at: STAIRS_E, why: 'down to the boss level' },
        { loc: 'hauntedmine_boss_door', at: BOSSDOOR, want: 'open the door', why: 'through into the chamber' },

        { note: 'wiki step 8: the innocent looking key is an npc on a rock at 2788,4455, with four' },
        { note: 'possessed cranes and seven mine carts round it. Reaching for it is what starts' },
        { note: 'the fight - he was a mesbox before, and he is a level-95 npc now.' },
        { setpos: [2788, 4454, 0], why: 'through the chamber to the crate the key is on' },
        { nearnpc: 'hauntedmine_boss_key', r: 20, why: 'the key on the rock' },
        { talk: 'hauntedmine_boss_key', want: 'walks out of the wall', why: 'reach for it' },
        { note: 'he fades out of reach and back every thirty-odd ticks, which is what the' },
        { note: 'walkthrough warns about. Only the visible form is named here: the faded one carries' },
        { note: 'no Attack option, so the step waits out each fade instead of swinging at a ghost' },
        { note: 'that is not there, and every change of type costs it a round.' },
        { fight: 'hauntedmine_boss_ghost', untilvar: 'hauntedmine', to: 5, tries: 20, r: 24, why: 'Treus Dayth' },
        { stage: 5 },
        { note: 'and the key comes off the rock without a fight now' },
        { talk: 'hauntedmine_boss_key', want: 'without a fight', why: 'take the Crystal-mine key' },
        { has: 'hauntedmine_reward_key' },

        { note: 'wiki step 9: back up the eastern stairs, west along the track, down the other' },
        { note: 'stairs, and through the large doors' },
        { setpos: [2811, 4453, 0], why: 'back east across the chamber to the stairs' },
        { loc: 'hauntedmine_light_stairs_bottom', at: BACK_UP_E, why: 'back up to the track' },
        { setpos: [2692, 4437, 0], why: 'west along the track' },
        { loc: 'hauntedmine_dark_stairs_top', at: STAIRS_W, why: 'down the western stairs' },
        { setpos: [2772, 4451, 0], why: 'east to the large doors' },
        { loc: 'hauntedmine_rewarddoor_l', at: REWARDDOOR, want: 'one crystal', why: 'the key opens them' },

        { note: 'wiki step 9b: cut a shard off the outcrop with the chisel. This is where the' },
        { note: 'quest’s 35 Crafting is actually needed, and it is what finishes it - the shard' },
        { note: 'used to come out of the door itself.' },
        { setpos: [2798, 4436, 0], why: 'south-east in the crystal room' },
        { loc: 'crystalcorner', at: [2797, 4437], want: 'chip a shard', why: 'cut the outcrop' },
        { has: 'crystalshard_necklace_unstrung' },
        { wait: 4, why: 'the completion is queued' },
        { stage: 6 },

        { note: 'and a ball of wool strings it. A chisel was wanted for this too before, which is' },
        { note: 'not what the wiki says.' },
        { give: 'ball_of_wool' },
        { use: ['ball_of_wool', 'crystalshard_necklace_unstrung'], want: 'Salve amulet', why: 'string the shard' },
        { has: 'crystalshard_necklace' }
    ]
};

const p: any = H.makePlayer('hmrun', m.start[0], m.start[1]);
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
