// WATERFALL QUEST, played through on foot.
//
// Quest 35 of the quest-by-quest pass. Almera's son is looking for treasure at the bottom of the
// falls; the treasure is real, and getting it needs a book from Hadley's bookcase, a pebble from a
// gnome locked in a cellar under the Tree Gnome Village, an amulet and an urn of ashes from
// Glarial's tomb - which turns away anybody carrying a weapon or a scrap of armour - a rope across
// the river and down to the ledge, and then eighteen runes on six pillars behind the waterfall.
//
//   npx tsx tools/sim/quest_waterfall_run.ts
import * as H from './harness.js';
import { play, Manifest, Step } from './questrun.js';

await H.boot();

const ROCK: [number, number] = [2512, 3468];
const TREE: [number, number] = [2512, 3465];
const LEDGEDOOR: [number, number] = [2511, 3464];
const INNERDOOR: [number, number] = [2566, 9901];
const STATUE: [number, number] = [2565, 9916];
const CHALICE: [number, number] = [2603, 9910];

// the six pillars, by the coordinates ~get_pillar_index knows
const PILLARS: [number, number][] = [
    [2562, 9910],
    [2562, 9912],
    [2562, 9914],
    [2569, 9910],
    [2569, 9912],
    [2569, 9914]
];

const m: Manifest = {
    quest: 'WATERFALL QUEST',
    source: 'oldschool.runescape.wiki/w/Waterfall_Quest',
    stageVar: 'waterfall_quest',
    done: 10,   // ^waterfall_complete
    start: [2523, 3497, 0],
    steps: [
        { note: 'two ropes, and six each of air, earth and water runes later on. The runes cannot be' },
        { note: 'carried past Glarial’s tombstone: its "only visitors with peaceful intent" check' },
        { note: 'turns away weapons, armour, arrows, logs, knives and runes alike, so the tomb has to' },
        { note: 'be emptied before the runes are picked up. Nothing in this run fights anything.' },
        { give: 'rope', n: 2 },

        { note: 'wiki step 1: Almera, in the house at the top of the falls' },
        { talk: 'almera_waterfall_quest', picks: ['How can I help'], want: 'small raft out back', why: 'she is worried about her son' },
        { stage: 1 },

        { note: 'wiki step 2: the raft downstream lands beside Hudon, which is the whole of that' },
        { note: 'step - the raft itself notices him' },
        { setpos: [2509, 3494, 0], why: 'out the back to the raft' },
        { loc: 'lograft_waterfall_quest', at: [2509, 3493], want: 'refusing to leave', why: 'ride it down' },
        { stage: 2 },

        { note: 'wiki step 3: the Book on Baxtorian, in the bookcase upstairs in Hadley’s house' },
        { setpos: [2519, 3426, 1], why: 'south to the house' },
        { loc: 'bookcase_waterfall_quest', at: [2520, 3426], want: 'Book on Baxtorian', why: 'search the books' },
        { has: 'baxtorian_book_waterfall_quest' },
        { held: 'baxtorian_book_waterfall_quest', want: 'Baxtorian', why: 'read it' },
        { stage: 3 },

        { note: 'wiki step 4: Golrie, locked in the cellar under the Tree Gnome Village, has' },
        { note: 'Glarial’s pebble among his grandfather’s junk. The key to his gate is in a crate' },
        { note: 'further along the same cellar.' },
        { setpos: [2548, 9566, 0], why: 'down the ladder in the village and along the cellar' },
        { loc: 'golrie_crate_waterfall_quest', at: [2548, 9565], want: 'large key', why: 'search the crate' },
        { has: 'golrie_key_waterfall_quest' },
        { setpos: [2515, 9574, 0], why: 'west to his gate' },
        { useLoc: 'golrie_gate_waterfall_quest', at: [2515, 9575], obj: 'golrie_key_waterfall_quest', want: 'key fits the gate', why: 'unlock it' },
        { talk: 'golrie_waterfall_quest', want: 'pebble', why: 'he hands over the pebble' },
        { has: 'glarials_pebble_waterfall_quest' },

        { note: 'wiki step 5: Glarial’s tombstone, west of the village. The pebble opens it, but' },
        { note: 'only for someone carrying no weapon and no armour.' },
        { setpos: [2559, 3444, 0], why: 'north-west to the tombstone' },
        { useLoc: 'glarials_tombstone_waterfall_quest', at: [2558, 3444], obj: 'glarials_pebble_waterfall_quest', want: 'stone slab slides back', why: 'the pebble' },
        { stage: 4 },

        { note: 'the coffin holds the urn of ashes and the chest holds the amulet' },
        { setpos: [2542, 9812, 0], why: 'along the tomb to the coffin' },
        { loc: 'glarials_tomb_waterfall_quest', at: [2542, 9811], want: 'urn full of ashes', why: 'search it' },
        { has: 'glarials_urn_full_waterfall_quest' },
        { setpos: [2530, 9845, 0], why: 'round to the chest' },
        { loc: 'glarials_chest_closed_waterfall_quest', at: [2530, 9844], why: 'open it' },
        { loc: 'glarials_chest_open_waterfall_quest', at: [2530, 9844], want: 'amulet', why: 'take the amulet' },
        { has: 'glarials_amulet_waterfall_quest' },

        { note: 'wiki step 6: a rope on the rock in the river, from the north bank, and then a rope' },
        { note: 'on the overhanging tree to get down to the ledge' },
        { setpos: [2512, 3476, 0], why: 'back to the river, north of the rock' },
        { useLoc: 'crossing_rock_waterfall_quest', at: ROCK, obj: 'rope', why: 'rope across to the rock' },
        { note: 'the tree drops you straight onto the ledge, two tiles away, so the step cannot' },
        { note: 'check that the player is still beside the tree afterwards - the ledge door below is' },
        { note: 'the proof that it worked' },
        { useLoc: 'overhanging_tree1_waterfall_quest', at: TREE, obj: 'rope', soft: true, want: 'down on to the ledge', why: 'and down to the ledge' },

        { note: 'wiki step 7: the door on the ledge only opens for someone carrying the amulet' },
        { loc: 'waterfall_ledge_door', at: LEDGEDOOR, want: 'walk through the door', why: 'into the waterfall' },
        { stage: 5 },

        { note: 'wiki step 8: a crate inside holds the key to the inner door' },
        { setpos: [2589, 9887, 0], why: 'through the caves to the crate' },
        { loc: 'baxtorian_crate_waterfall_quest', at: [2589, 9888], want: 'large key', why: 'search it' },
        { has: 'baxtorian_key_waterfall_quest' },
        { setpos: [2566, 9900, 0], why: 'west to the inner door' },
        { useLoc: 'baxtorian_door_2_waterfall_quest', at: INNERDOOR, obj: 'baxtorian_key_waterfall_quest', want: 'walk through', why: 'unlock it' },
        { stage: 6 },

        { note: 'wiki step 9: six pillars, three runes each - air, earth and water on every one of' },
        { note: 'them, eighteen placements in all. The runes come out of the bank now that the tomb' },
        { note: 'is behind us.' },
        { give: 'airrune', n: 6 },
        { give: 'earthrune', n: 6 },
        { give: 'waterrune', n: 6 }
    ]
};

for (const at of PILLARS) {
    for (const rune of ['airrune', 'earthrune', 'waterrune']) {
        m.steps.push({ useLoc: 'stonepillar_small_waterfall_quest', at, obj: rune, want: 'place the rune', why: rune.replace('rune', '') + ' on ' + at[0] + ',' + at[1] } as Step);
    }
}

m.steps.push(
    { note: 'wiki step 10: the amulet on the statue, which raises the room' },
    { setpos: [2565, 9915, 0], why: 'round to the statue' },
    { note: 'placing it raises the whole room and moves the player 38 tiles east into the raised' },
    { note: 'copy of it, so again the step cannot check where the player is afterwards' },
    { useLoc: 'statue_queen_waterfall_quest', at: STATUE, obj: 'glarials_amulet_waterfall_quest', soft: true, want: 'ground raises up', why: 'the amulet' },
    { stage: 8 },

    { note: 'wiki step 11: and the ashes into the chalice, which is the treasure' },
    { setpos: [2603, 9911, 0], why: 'to the chalice in the raised room' },
    { useLoc: 'baxtorian_chalice_waterfall_quest', at: CHALICE, obj: 'glarials_urn_full_waterfall_quest', want: 'Treasure of Baxtorian', why: 'pour the ashes' },
    { wait: 4, why: 'the completion is queued' },
    { stage: 10 },
    { has: 'diamond' }
);

const p: any = H.makePlayer('waterfallrun', m.start[0], m.start[1]);
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
