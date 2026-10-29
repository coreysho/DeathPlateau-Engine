// SHEEP HERDER, played through on foot.
//
// Quest 24 of the quest-by-quest pass, and the first one that is mostly a physics problem: four
// plague sheep scattered across the fields north of Ardougne, a cattleprod, and an enclosure with
// one gate. A prod moves a sheep ONE tile directly away from the player, so the whole quest is
// pushing four animals twenty to forty tiles each, around a walled pen, without getting them
// wedged. questrun's `herd` step plans that over moves which are legal for both of them.
//
//   npx tsx tools/sim/quest_sheepherder_run.ts
import * as H from './harness.js';
import { play, Manifest } from './questrun.js';

await H.boot();

const GATE: [number, number, number, number] = [2592, 3360, 2594, 3363];   // sheepherder_pen_gate
const FURNACE: [number, number] = [2605, 3360];

const m: Manifest = {
    quest: 'SHEEP HERDER',
    source: 'oldschool.runescape.wiki/w/Sheep_Herder',
    stageVar: 'sheepherderquest',
    done: 3,   // ^sheepherder_complete
    start: [2618, 3299, 0],
    steps: [
        { note: 'wiki: 100 coins for the plague suit, which Halgrive pays back at the end' },
        { give: 'coins', n: 100 },

        { note: 'wiki step 1: Councillor Halgrive, in the graveyard south of the Ardougne church' },
        { talk: 'councillor_halgrive', picks: ["What's wrong?", 'I can do that for you.'], want: 'poisoned sheep feed', why: 'four diseased sheep to round up' },
        { stage: 1 },
        { has: 'poisoned_feed' },

        { note: 'wiki step 2: Doctor Orbon in the church sells his own plague suit for 100 coins' },
        { setpos: [2615, 3306, 0], why: 'north into the church' },
        { talk: 'doctor_orbon', picks: ["Ok, I'll take it."], want: 'hands over a protective suit', why: 'buy the suit' },
        { stage: 2 },
        { held: 'plague_jacket', op: 2, why: 'wear the jacket' },
        { worn: 'plague_jacket' },
        { held: 'plague_trousers', op: 2, why: 'and the trousers' },
        { worn: 'plague_trousers' },
        { hasnt: 'coins' },

        { note: 'wiki step 3: the enclosure north-west of the north bank. The gate turns away' },
        { note: 'anybody without the suit on, and the cattleprod is lying inside it.' },
        { setpos: [2593, 3362, 0], why: 'north out of the city to the pen gate' },
        { loc: 'plaguesheep_gatel', at: [2594, 3362], why: 'the suit gets you in' },
        { take: 'cattleprod', r: 12, why: 'a few steps south of the incinerator' },
        { held: 'cattleprod', op: 2, why: 'wield it - prodding a sheep by hand is refused' },
        { worn: 'cattleprod' },

        { note: 'wiki step 4, sheep one (red): north of the north bank' },
        { go: [2595, 3362], why: 'back to the gate' },
        { loc: 'plaguesheep_gatel', at: [2594, 3362], why: 'out again' },
        { go: [2606, 3344], why: 'east into the field' },
        { herd: 'plaguesheep_1', at: [2608, 3342], gate: GATE, untilvar: 'sheepherdervar', bit: 1, why: 'round the north side of the pen and in at the gate' },
        { go: [2593, 3362], why: 'to the gate after it' },
        { loc: 'plaguesheep_gatel', at: [2594, 3362], why: 'in after it' },
        { useNpc: 'plaguesheep_1', obj: 'poisoned_feed', want: 'collapses dead', why: 'the feed is humane, says the councillor' },
        { take: 'sheepbonesa', r: 6, why: 'the bones it leaves' },
        { go: [2604, 3360], why: 'over to the incinerator' },
        { useLoc: 'plaguesheep_furnace', at: FURNACE, obj: 'sheepbonesa', want: 'burn to dust', why: 'burn them' },
        { varis: 'sheepherdervar', to: 12 },

        { note: 'sheep two (green): north-east, past the fenced area with the fallen trees' },
        { go: [2595, 3362], why: 'back to the gate' },
        { loc: 'plaguesheep_gatel', at: [2594, 3362], why: 'out' },
        { go: [2614, 3366], why: 'north-east' },
        { herd: 'plaguesheep_2', at: [2616, 3366], gate: GATE, untilvar: 'sheepherdervar', bit: 4, why: 'west along the top of the pen' },
        { go: [2593, 3362], why: 'to the gate' },
        { loc: 'plaguesheep_gatel', at: [2594, 3362], why: 'in after it' },
        { useNpc: 'plaguesheep_2', obj: 'poisoned_feed', want: 'collapses dead', why: 'same feed, it is not used up' },
        { take: 'sheepbonesb', r: 6, why: 'bones (2)' },
        { go: [2604, 3360], why: 'to the incinerator' },
        { useLoc: 'plaguesheep_furnace', at: FURNACE, obj: 'sheepbonesb', want: 'burn to dust', why: 'burn them' },
        { varis: 'sheepherdervar', to: 108 },

        { note: 'sheep three (blue): north-west of the pen, out by the camp with the warriors' },
        { go: [2595, 3362], why: 'back to the gate' },
        { loc: 'plaguesheep_gatel', at: [2594, 3362], why: 'out' },
        { go: [2566, 3387], why: 'a long walk west' },
        { herd: 'plaguesheep_3', at: [2563, 3387], gate: GATE, untilvar: 'sheepherdervar', bit: 7, tries: 600, why: 'the furthest of the four - thirty-odd prods east and south' },
        { go: [2593, 3362], why: 'to the gate' },
        { loc: 'plaguesheep_gatel', at: [2594, 3362], why: 'in after it' },
        { useNpc: 'plaguesheep_3', obj: 'poisoned_feed', want: 'collapses dead', why: 'feed it' },
        { take: 'sheepbonesc', r: 6, why: 'bones (3)' },
        { go: [2604, 3360], why: 'to the incinerator' },
        { useLoc: 'plaguesheep_furnace', at: FURNACE, obj: 'sheepbonesc', want: 'burn to dust', why: 'burn them' },
        { varis: 'sheepherdervar', to: 876 },

        { note: 'sheep four (yellow): south of the Fishing Guild' },
        { go: [2595, 3362], why: 'back to the gate' },
        { loc: 'plaguesheep_gatel', at: [2594, 3362], why: 'out' },
        { go: [2608, 3387], why: 'north-east again' },
        { herd: 'plaguesheep_4', at: [2610, 3389], gate: GATE, untilvar: 'sheepherdervar', bit: 10, tries: 600, why: 'down the east side and in' },
        { go: [2593, 3362], why: 'to the gate' },
        { loc: 'plaguesheep_gatel', at: [2594, 3362], why: 'in after it' },
        { useNpc: 'plaguesheep_4', obj: 'poisoned_feed', want: 'collapses dead', why: 'the last one' },
        { take: 'sheepbonesd', r: 6, why: 'bones (4)' },
        { go: [2604, 3360], why: 'to the incinerator' },
        { useLoc: 'plaguesheep_furnace', at: FURNACE, obj: 'sheepbonesd', want: 'burn to dust', why: 'burn them' },
        { varis: 'sheepherdervar', to: 7020 },

        { note: 'wiki step 5: back to Halgrive, who refunds the suit and pays 3000 on top' },
        { go: [2595, 3362], why: 'out of the pen' },
        { loc: 'plaguesheep_gatel', at: [2594, 3362], why: 'out' },
        { setpos: [2618, 3299, 0], why: 'south through the city to the graveyard' },
        { talk: 'councillor_halgrive', want: 'Excellent work', why: 'collect the reward' },
        { wait: 4, why: 'the completion is queued' },
        { stage: 3 },
        { has: 'coins', n: 3100 }
    ]
};

const p: any = H.makePlayer('sheepherdrun', m.start[0], m.start[1]);
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
