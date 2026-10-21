// SPIRITS OF THE ELID, played through on foot.
//
// Quest 56 of the quest-by-quest pass. The river Elid stopped in a week in the middle of the wet
// season, and Nardah has three days of water left. Three channels under the rock, three clay
// golems in front of them, and a genie who wants the soles off the mayor's shoes.
//
//   NODE_MEMBERS=true npx tsx tools/sim/quest_elid_run.ts
import * as H from './harness.js';
import { play, Manifest } from './questrun.js';

await H.boot();

const MAYOR: [number, number, number] = [3443, 2912, 0];
const GHASLOR: [number, number, number] = [3440, 2934, 0];
const SHIRATTI: [number, number, number] = [3427, 2924, 0];
const CUPBOARD: [number, number] = [3420, 2930];
const PLINTH: [number, number] = [3426, 2930];
const CREVICE: [number, number, number] = [3374, 2904, 0];
const SHRINE: [number, number, number] = [3349, 9537, 0];
const ROBE_DOOR: [number, number] = [3353, 9544];
const LAKE_DOOR: [number, number] = [3354, 9558];
const WHITE_DOOR: [number, number] = [3365, 9542];
const GREY_DOOR: [number, number] = [3374, 9547];
const BLACK_DOOR: [number, number] = [3372, 9556];
const CH_MINING: [number, number] = [3378, 9547];
const CH_THIEVING: [number, number] = [3365, 9538];
const SPIRITS: [number, number, number] = [3368, 9584, 0];
const GENIE: [number, number, number] = [3371, 9318, 0];

const m: Manifest = {
    quest: 'SPIRITS OF THE ELID',
    source: 'oldschool.runescape.wiki/w/Spirits_of_the_Elid',
    stageVar: 'elidquest',
    done: 60,
    start: [3443, 2912, 0],
    steps: [
        { note: '%elidquest is NOT free: two multilocs in Nardah switch on it and between them they' },
        { note: 'enumerate every legal value - 0, 10, 20, 25, 27, 30, 35, 40, 50, 55, 60 and nothing' },
        { note: 'else. Any other value and the fountain and the plinth stop rendering entirely.' },
        { note: 'requirements are four skill levels and no quests: Magic 33, Ranged 37, Mining 37' },
        { note: 'and Thieving 37.' },
        { give: 'needle' },
        { give: 'thread', n: 4 },
        { give: 'knife' },
        { give: 'bronze_pickaxe' },
        { give: 'bronze_arrow', n: 20 },

        { note: 'wiki step 1: Awusah the Mayor, looking at a dry fountain' },
        { talk: 'elid_mayor', picks: ['What happened to it?'], want: 'three days of water', why: 'he sets the quest' },
        { stage: 10 },

        { note: 'wiki step 2: Ghaslor the Elder, who blames the town rather than the spirits, and' },
        { note: 'who hands over the Ballad of Jareesh - an obj in this quest’s own block that' },
        { note: 'nothing gave out and nothing asked for' },
        { setpos: GHASLOR, why: 'north to Ghaslor' },
        { talk: 'elid_ghaslor', want: 'Ballad of Jareesh', why: 'the ballad and the robes' },
        { stage: 20 },
        { has: 'elid_ballad' },

        { note: 'wiki step 3: the cupboard, which holds two TORN robes - the finished ones were' },
        { note: 'being handed out instead, which skips the needle and thread entirely' },
        { setpos: [3420, 2929, 0], why: 'west to Shiratti’s building' },
        { loc: 'elid_cupboard_closed_withrobes', at: CUPBOARD, why: 'open it' },
        { loc: 'elid_cupboard_open_withrobes', at: CUPBOARD, op: 2, want: 'both of them are torn', why: 'search it' },
        { has: 'elid_robetop_torn' },
        { has: 'elid_robebottoms_torn' },
        { use: ['needle', 'elid_robetop_torn'], want: 'sew the robe', why: 'the top' },
        { use: ['needle', 'elid_robebottoms_torn'], want: 'Both pieces are whole', why: 'the bottoms' },
        { stage: 25 },
        { held: 'elid_robetop', op: 2, why: 'wear it' },
        { held: 'elid_robebottoms', op: 2, why: 'and the other half' },
        { worn: 'elid_robetop' },

        { note: 'wiki step 4: the crevice west of town, which only admits somebody dressed for the' },
        { note: 'shrine and carrying something anybody down there would recognise' },
        { setpos: CREVICE, why: 'west out of Nardah' },
        { loc: 'elid_crevice_clickzone', at: [3373, 2904], want: 'climb down', why: 'down' },
        { stage: 27 },

        { note: 'wiki step 5: the robe door, and then the spirits round the lake' },
        { setpos: SHRINE, why: 'to the foot of the corridor' },
        { loc: 'elid_underground_robe_door', at: ROBE_DOOR, why: 'through' },
        { loc: 'elid_underground_lake_door', at: LAKE_DOOR, why: 'and the lake door' },
        { setpos: SPIRITS, why: 'round the lake' },
        { talk: 'elid_waterspirit_male', want: 'three channels', why: 'what is actually wrong' },
        { stage: 30 },

        { note: 'Shiratti holds the key to the three doors, and she is back up in Nardah' },
        { setpos: SHIRATTI, why: 'back up and across town' },
        { talk: 'elid_shiratti', want: 'nine generations', why: 'the ancestral key' },
        { has: 'elid_key' },

        { note: 'wiki step 6: three doors, three golems, three channels. The doors used to walk you' },
        { note: 'straight past a golem that was still standing; the golems had a level, an Attack op' },
        { note: 'and no statblock, so there was nothing to fight either.' },
        { setpos: CREVICE, why: 'back to the crevice' },
        { loc: 'elid_crevice_clickzone', at: [3373, 2904], why: 'down again' },

        { note: 'the mining channel is behind the grey golem' },
        { note: 'all three golem doors are wall-straight, so the only tiles that can click one are' },
        { note: 'the two it separates - and each room is on the far side, which is what the golem\'s' },
        { note: 'own spawn coord says. opfrom.ts prints which tiles a loc will take a click from.' },
        { setpos: [3373, 9547, 0], why: 'to the grey golem’s door' },
        { loc: 'elid_greygolem_door', at: GREY_DOOR, want: 'door swings to behind you', why: 'open it' },
        { note: 'THE FIGHT IS OVER BEFORE THE NEXT STEP RUNS. The golem is spawned with huntmode' },
        { note: 'aggressive_melee inside the same drive that opens the door, so it is already on you' },
        { note: 'and a maxed player finishes it in a few ticks - a fight step after this one reports' },
        { note: 'no golem anywhere while its death trigger has already fired. The bit is the proof.' },
        { wait: 12, why: 'it is on you, and then it is not' },
        { varis: 'elid_greygolem', to: 1 },
        { note: 'the door steps you in with the golem, so there is no second click to get through' },
        { loc: 'elid_waterchannel_mining_multiloc', at: CH_MINING, want: 'rock comes away', why: '37 Mining and a pickaxe' },

        { note: 'the thieving channel is behind the white golem' },
        { setpos: [3365, 9543, 0], why: 'west to the white golem’s door' },
        { loc: 'elid_whitegolem_door', at: WHITE_DOOR, want: 'door swings to behind you', why: 'open it' },
        { wait: 12, why: 'and the second of the three' },
        { varis: 'elid_whitegolem', to: 1 },
        { loc: 'elid_waterchannel_thieving_multiloc', at: CH_THIEVING, want: 'spikes back out', why: '37 Thieving' },

        { note: 'and the ranging channel is a catch across the water that nobody can stand next to -' },
        { note: 'the target has no ops at all, so the shot is an approach trigger from the far side' },
        { setpos: [3371, 9556, 0], why: 'north to the black golem’s door' },
        { loc: 'elid_blackgolem_door', at: BLACK_DOOR, want: 'door swings to behind you', why: 'open it' },
        { wait: 12, why: 'and the last of the three' },
        { varis: 'elid_blackgolem', to: 1 },
        { note: 'the target is at 3379,9556 with the channel between it and the room, so the shot is' },
        { note: 'taken from the near bank rather than from wherever the golem fight left you' },
        { setpos: [3375, 9556, 0], why: 'to the near bank' },
        { useNpc: 'elid_ranging_target_multinpc', obj: 'bronze_arrow', want: 'catch clean off', why: '37 Ranged, across the channel' },
        { wait: 6, why: 'the sluice drops' },
        { stage: 35 },

        { note: 'wiki step 7-8: the spirits name the genie, and the mayor is standing by his own' },
        { note: 'fountain in his socks' },
        { setpos: SPIRITS, why: 'back round the lake' },
        { talk: 'elid_waterspirit_male', want: 'genie', why: 'where the statuette went' },
        { setpos: MAYOR, why: 'back up to Nardah' },
        { talk: 'elid_mayor', want: 'shoes are by the door', why: 'his shoes' },
        { has: 'elid_shoes' },
        { use: ['knife', 'elid_shoes'], want: 'pair of uppers', why: 'the soles' },
        { has: 'elid_sole' },

        { note: 'wiki step 9: the genie, under the same crevice, the other fork' },
        { setpos: CREVICE, why: 'back west' },
        { loc: 'elid_crevice_clickzone', at: [3373, 2904], picks: ["Climb down to the genie's cave."], why: 'the other fork' },
        { setpos: GENIE, why: 'through to the genie' },
        { talk: 'elid_genie', picks: ['The town is out of water.'], want: 'Soles', why: 'what he wants' },
        { useNpc: 'elid_genie', obj: 'elid_sole', want: 'Sixty years', why: 'the trade' },
        { stage: 40 },
        { has: 'elid_statuette' },

        { note: 'wiki step 10: Ghaslor confirms it, Awusah wants to have been told, and the plinth' },
        { note: 'is the only thing that reaches stage 60 - which is the one value where the fountain' },
        { note: 'flows and elid_statuette_placed exists at all' },
        { setpos: GHASLOR, why: 'back to Ghaslor' },
        { talk: 'elid_ghaslor', want: 'That is her', why: 'he confirms it' },
        { stage: 50 },
        { setpos: MAYOR, why: 'to Awusah' },
        { talk: 'elid_mayor', want: 'put it back', why: 'he wants it on the record' },
        { stage: 55 },
        { setpos: [3426, 2929, 0], why: 'to the shrine plinth' },
        { useLoc: 'elid_statuette_multiloc', at: PLINTH, obj: 'elid_statuette', want: 'back on its plinth', why: 'put her back' },
        { wait: 6, why: 'the completion is queued' },
        { stage: 60 }
    ]
};

const p: any = H.makePlayer('elidrun', m.start[0], m.start[1]);
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
