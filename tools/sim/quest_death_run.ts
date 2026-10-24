// DEATH PLATEAU, played through on foot. The quest this server is named after.
//
// Quest 92 of the quest-by-quest pass. Two threads run side by side and both have to finish: the
// combination to the Imperial Guard's equipment room, which is on the back of an IOU in a drunk
// guard's pocket, and a secret way up the plateau that costs a hermit's patience, a sherpa's
// winter supplies and a blacksmith's son's commission in the Guard.
//
// The dice game is the interesting part. Harold starts with a hundred gold; a Blurberry Special
// makes him too drunk to count, so the player wins whatever they roll, and one bet over a hundred
// bankrupts him in a single hand - which is what produces the IOU. questrun gained a `count` step
// for it: p_countdialog is the "type an amount" box and neither a menu pick nor a button can
// answer one.
//
//   NODE_MEMBERS=true npx tsx tools/sim/quest_death_run.ts
import * as H from './harness.js';
import { play, Manifest } from './questrun.js';

await H.boot();

const DENULTH: [number, number, number] = [2898, 3528, 0];
const EOHRIC: [number, number, number] = [2904, 3563, 1];
const HAROLD_DOOR: [number, number] = [2906, 3543]; // his room is knocked on, not walked into
const HAROLD: [number, number, number] = [2907, 3543, 1];
const SABA: [number, number, number] = [2270, 4758, 0];
const TENZING: [number, number, number] = [2822, 3557, 0];
const DUNSTAN: [number, number, number] = [2919, 3575, 0];
const BALLS: [number, number, number] = [2893, 3563, 0]; // the five stone balls, in a column
const MECH_STAND: [number, number, number] = [2893, 3563, 0];
const BLUE: [number, number] = [2894, 3562];
const YELLOW: [number, number] = [2895, 3562];
const RED: [number, number] = [2894, 3563];
const PURPLE: [number, number] = [2895, 3563];
const GREEN: [number, number] = [2895, 3564];
const CASTLE_DOOR: [number, number] = [2894, 3566];
const STILE: [number, number] = [2817, 3562];
const SCOUT: [number, number] = [2864, 3608]; // the zone that ends the scouting

const m: Manifest = {
    quest: 'DEATH PLATEAU',
    source: 'oldschool.runescape.wiki/w/Death_Plateau/Quick_guide',
    stageVar: 'death_equiproom',
    done: 80, // ^death_complete
    start: DENULTH,
    steps: [
        { note: 'no requirements. Items: an Asgarnian ale and a Blurberry Special for Harold, a' },
        { note: 'few hundred coins to gamble with, an iron bar for the spikes, and ten loaves of' },
        { note: 'bread and ten cooked trout for the sherpa.' },
        { give: 'asgarnian_ale' },
        { give: 'blurberry_special' },
        { give: 'coins', n: 300 },
        { give: 'iron_bar' },
        { give: 'bread', n: 10 },
        { give: 'trout', n: 10 },

        { note: 'wiki step 1: Denulth, in his tent in the Burthorpe camp' },
        { setpos: DENULTH, why: 'to Denulth' },
        {
            talk: 'death_ig_commander',
            picks: ['Do you have any quests for me?', 'No but perhaps I could try and find one?'],
            want: 'stone balls',
            why: 'take the job'
        },
        { stage: 10 },

        { note: 'wiki step 2: Eohric, on the castle floor above, names the guard' },
        { setpos: EOHRIC, why: 'to Eohric in the castle' },
        { talk: 'death_headservant', picks: ["I'm looking for the guard that was on last night."], want: 'Toad and Chicken', why: 'he names Harold' },
        { stage: 20 },

        { note: 'wiki step 3: Harold, upstairs in the Toad and Chicken, will not talk about it' },
        { setpos: HAROLD, why: 'to the inn, outside his room' },
        { note: 'his door is knocked on rather than opened - he has to say come in.' },
        { loc: 'death_harold_door', at: HAROLD_DOOR, hop: true, soft: true, why: 'knock' },
        { talk: 'death_guard_equiproom', picks: ["You're the guard that was on duty last night?"], want: "don't want to talk about it", why: 'he is not keen' },
        { stage: 30 },

        { note: 'wiki step 4: Eohric knows what Harold is keen on' },
        { setpos: EOHRIC, why: 'back to Eohric' },
        { talk: 'death_headservant', want: 'drinking and gambling', why: 'he names the weakness' },
        { stage: 40 },

        { note: 'wiki steps 5-7: an Asgarnian ale loosens him up, and a Blurberry Special makes' },
        { note: 'him too drunk to count his dice' },
        { setpos: HAROLD, why: 'back to the inn' },
        { loc: 'death_harold_door', at: HAROLD_DOOR, hop: true, soft: true, why: 'knock again' },
        { talk: 'death_guard_equiproom', picks: ['Can I buy you a drink?'], want: 'hit the spot', why: 'the ale' },
        { stage: 50 },
        { talk: 'death_guard_equiproom', picks: ['Can I buy you a drink?'], soft: true, why: 'and the Blurberry Special' },
        { hasnt: 'blurberry_special' },

        { note: 'wiki steps 8-9: he has a hundred gold, so one bet of a hundred and one bankrupts' },
        { note: 'him - and a bankrupt Harold writes an IOU' },
        { talk: 'death_guard_equiproom', picks: ['Would you like to gamble?'], soft: true, why: 'offer him a game' },
        { count: 101, why: 'more than he has in his purse' },
        { press: 'inter_156:com_28', why: 'roll the dice' },
        { note: 'the window waits on a continue button and the end-of-hand queue cannot run' },
        { note: 'while it is open - closing it is what lets Harold count his purse.' },
        { close: true, why: 'close the dice window' },
        { wait: 3, why: 'the end-of-hand queue runs' },
        { say: [], want: 'IOU', why: 'he counts his purse and writes an IOU' },
        { stage: 55 },
        { has: 'death_iou' },

        { note: 'wiki step 9: the IOU is written on the back of the combination' },
        { held: 'death_iou', op: 1, want: 'found the combination', why: 'read it' },
        { stage: 60 },
        { has: 'death_combination' },
        { held: 'death_combination', op: 1, why: 'and read the combination itself' },
        { close: true },

        { note: 'wiki step 10: five stone balls on six stone plinths outside the equipment room.' },
        { note: 'Red north of blue, yellow south of purple, green north of purple, blue west of' },
        { note: 'yellow, purple east of red - which leaves the north-west plinth empty.' },
        { setpos: BALLS, why: 'to the castle, and the stone balls' },
        { take: 'death_cannonball_blue', r: 4, why: 'the blue ball' },
        { take: 'death_cannonball_yellow', r: 4, why: 'the yellow one' },
        { take: 'death_cannonball_red', r: 4, why: 'the red one' },
        { take: 'death_cannonball_purple', r: 4, why: 'the purple one' },
        { take: 'death_cannonball_green', r: 4, why: 'and the green one' },
        { setpos: MECH_STAND, why: 'to the mechanism' },
        { useLoc: 'death_stone_mechanism_corner', at: BLUE, obj: 'death_cannonball_blue', soft: true, why: 'blue, south-west' },
        { useLoc: 'death_stone_mechanism_corner', at: YELLOW, obj: 'death_cannonball_yellow', soft: true, why: 'yellow, south-east' },
        { useLoc: 'death_stone_mechanism_side', at: RED, obj: 'death_cannonball_red', soft: true, why: 'red, west' },
        { useLoc: 'death_stone_mechanism_side', at: PURPLE, obj: 'death_cannonball_purple', soft: true, why: 'purple, east' },
        { useLoc: 'death_stone_mechanism_corner', at: GREEN, obj: 'death_cannonball_green', want: 'has unlocked', why: 'and green, north-east' },
        { stage: 70 },
        { loc: 'death_castledoor', at: CASTLE_DOOR, hop: true, soft: true, why: 'the equipment room opens' },

        { note: 'wiki steps 11-12: Saba the hermit, in the cave north-west of Burthorpe' },
        { setpos: SABA, why: 'to the hermit cave' },
        { talk: 'death_hermit', picks: ['Do you know of another way up Death Plateau?'], want: 'Sherpa', why: 'he remembers a sherpa' },
        { varis: 'death_map', to: 1 },

        { note: 'wiki step 14: Tenzing, in the hut west of Burthorpe, wants his winter supplies' },
        { note: 'and his climbing boots re-spiked' },
        { setpos: TENZING, why: 'to Tenzing' },
        { talk: 'death_sherpa', picks: ["OK, I'll get those for you."], want: 'climbing boots', why: 'take the job' },
        { varis: 'death_map', to: 2 },
        { has: 'death_climbingboots' },

        { note: 'wiki step 15: Dunstan will only do it if his son gets into the Imperial Guard' },
        { setpos: DUNSTAN, why: 'to Dunstan at the anvil' },
        { talk: 'death_smithy', want: 'Imperial Guard', why: 'he names his condition' },
        { varis: 'death_map', to: 3 },

        { note: 'wiki step 16: Denulth signs the boy up' },
        { setpos: DENULTH, why: 'back to Denulth' },
        { talk: 'death_ig_commander', want: 'certificate', why: 'he writes a certificate' },
        { varis: 'death_map', to: 4 },
        { has: 'death_entrancecert' },

        { note: 'wiki step 17: the certificate, the boots and an iron bar for spiked boots' },
        { setpos: DUNSTAN, why: 'back to Dunstan' },
        { talk: 'death_smithy', want: 'Spiked boots', why: 'he keeps his end of the bargain' },
        { has: 'death_spikedboots' },
        { hasnt: 'iron_bar' },

        { note: 'wiki step 18: the boots, ten loaves and ten trout, all at once' },
        { setpos: TENZING, why: 'back to Tenzing' },
        { talk: 'death_sherpa', want: 'map of the secret way', why: 'hand it all over' },
        { varis: 'death_map', to: 7 },
        { has: 'death_secretwaymap' },

        { note: 'wiki step 19: out of the back door, over the stile, and up the path until the' },
        { note: 'plateau is in sight' },
        { setpos: [STILE[0], STILE[1] - 1, 0], why: 'to the stile behind the hut' },
        { loc: 'death_fullstyle', at: STILE, hop: true, soft: true, why: 'climb over it' },
        { note: 'the end of the scout is a [zone,...] trigger. Player.triggerZone is only called' },
        { note: 'from NetworkPlayer, so a harness player can stand in the zone all day and nothing' },
        { note: 'fires - the walk goes there on foot and then fires the trigger for the tile it is' },
        { note: 'standing on, which is what a client does on arrival.' },
        { setpos: [SCOUT[0] - 2, SCOUT[1] + 1, 0], why: 'north and east along the path' },
        { go: [SCOUT[0] + 2, SCOUT[1] + 1], why: 'on until the plateau is in sight' },
        { zone: true, why: 'and the path is clear' },
        { varis: 'death_map', to: 8 },

        { note: 'wiki step 20: back to Denulth with the combination and the path' },
        { setpos: DENULTH, why: 'back to Denulth' },
        { talk: 'death_ig_commander', want: 'claws', why: 'tell him both' },
        { stage: 80 },
        { has: 'steel_claws' }
    ]
};

const p: any = H.makePlayer('deathrun', m.start[0], m.start[1]);
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
