// RUM DEAL, played through on foot.
//
// Quest 58 of the quest-by-quest pass, and the fifth one in it that turned out to be a different
// quest rather than a broken one. What was there fixed the vat with the holy wrench, faked the
// level-150 Evil Spirit with two mesboxes and ~damage_self, bought the sluglings off Captain Donnie
// as though he were a bait merchant, never drew a bucket off the output tap, never let Donnie drink
// anything, and paid out Cooking and Slayer XP and a pair of Slayer gloves the Slayer shop sells
// for fifty points.
//
// The cache said all of it: deal_multicontrol is a multiloc with no op in any state, so the holy
// wrench is USED on it and the Evil Spirit comes out of the controls; deal_multi_lever is dead
// until deal_barrel reaches five, so the five sea creatures go in the barrel; and the cellar
// cupboard's own description is "Probably where the farming kit is stored."
//
//   NODE_MEMBERS=true npx tsx tools/sim/quest_deal_run.ts
import * as H from './harness.js';
import { play, Manifest } from './questrun.js';

await H.boot();

const PHASMATYS: [number, number, number] = [3681, 3537, 0];
const BRAINDEATH: [number, number] = [2145, 5105];
const DAVEY: [number, number] = [2133, 5098];
const DONNIE: [number, number] = [2147, 5079];
const CELLAR_LADDER_DOWN: [number, number] = [2139, 5105]; // L1 -> L0, the cellar
const CELLAR_LADDER_UP: [number, number] = [2139, 5105]; // L0 -> L1
const UP_LADDER: [number, number] = [2163, 5092]; // L1 <-> L2, the hopper floor
const STAIRS: [number, number] = [2149, 5088]; // L1 <-> L0, out of the brewery
const CUPBOARD: [number, number] = [2157, 5093];
const PATCH: [number, number] = [2162, 5069];
const GATE: [number, number] = [2120, 5098];
const LAKE: [number, number] = [2133, 5161];
const SPOT: [number, number, number] = [2162, 5062, 0];
const HOPPER: [number, number] = [2142, 5102];
const BARREL: [number, number] = [2141, 5102];
const LEVER: [number, number] = [2141, 5103];
const CONTROLS: [number, number] = [2143, 5100];
const TAP: [number, number] = [2142, 5093];

const m: Manifest = {
    quest: 'RUM DEAL',
    source: 'oldschool.runescape.wiki/w/Rum_Deal',
    stageVar: 'deal_quest',
    done: 9,
    start: PHASMATYS,
    steps: [
        { note: 'requirements: Zogre Flesh Eaters, and Slayer 42 to start. Farming 40, Prayer 47 and' },
        { note: 'Fishing 50 are spent later. Crafting 42 is on the quest scroll and the walkthrough' },
        { note: 'never says where it goes, so it is listed in the journal and gated nowhere.' },
        { setvar: 'zogre', to: 16, why: 'Zogre Flesh Eaters complete' },

        { note: 'wiki step 1: Pirate Pete, at the boat inside the Port Phasmatys wall' },
        { talk: 'deal_pete', want: 'Braindeath Island', why: 'he rows; deal_boat itself has no ops' },
        { wait: 6, why: 'the crossing' },

        { note: 'wiki step 2: Captain Braindeath, in the brewery, who hands over the blindweed seed' },
        { go: [BRAINDEATH[0] + 1, BRAINDEATH[1]], why: 'to Braindeath on the brewery floor' },
        { talk: 'deal_captian_braindeath', picks: ['Everyone here is dead.'], want: 'blindweed seed', why: 'the brief' },
        { stage: 1 },
        { has: 'deal_blindweed_seed' },

        { note: 'wiki step 3: down the ladder in the north-west corner, south-east past the spiders,' },
        { note: 'and the cupboard with the rake and the seed dibber in it. Open, then Search - the' },
        { note: 'open cupboard carries op2=Search and op3=Shut and no op1 at all.' },
        { loc: 'deal_laddertop', at: CELLAR_LADDER_DOWN, why: 'down into the cellar' },
        { go: [CUPBOARD[0] + 1, CUPBOARD[1]], why: 'east of the cupboard; forceapproach=east' },
        { loc: 'deal_broomcupboard', at: CUPBOARD, want: 'open the cupboard', why: 'open it' },
        { loc: 'deal_broomcupboard_open', at: CUPBOARD, op: 2, want: 'rake, a seed dibber', why: 'search it' },
        { has: 'rake' },
        { has: 'dibber' },

        { note: 'wiki step 5: the south-eastern patch, the only one of the twelve that grows' },
        { note: 'anything. Three rakes, the dibber, and it comes up on its own.' },
        { loc: 'deal_ladder_up', at: CELLAR_LADDER_UP, why: 'back up out of the cellar' },
        { go: [STAIRS[0], STAIRS[1] + 1], why: 'to the southern stairway' },
        { loc: 'deal_stairs_top', at: STAIRS, why: 'down to the island' },
        { go: [PATCH[0] - 1, PATCH[1]], why: 'to the blindweed patch' },
        { useLoc: 'deal_blindweed', at: PATCH, obj: 'rake', want: 'clear some of the weeds', why: 'first pass' },
        { useLoc: 'deal_blindweed', at: PATCH, obj: 'rake', want: 'weeds', why: 'second pass' },
        { useLoc: 'deal_blindweed', at: PATCH, obj: 'rake', want: 'last of the weeds', why: 'third pass' },
        { varis: 'deal_farming', to: 3 },
        { useLoc: 'deal_blindweed', at: PATCH, obj: 'deal_blindweed_seed', want: 'dib the seed', why: 'plant it' },
        { note: 'no assertion that the patch is SEEDED here: drive() can spend more than the fifty' },
        { note: 'ticks the queue waits on, so the blindweed is sometimes already up by the time the' },
        { note: 'step that planted it returns. What matters is that the queue fired at all.' },
        { wait: 56, why: 'it comes up on its own after fifty ticks and says so' },
        { varis: 'deal_farming', to: 5 },
        { loc: 'deal_blindweed', at: PATCH, want: 'Blindweed', why: 'pick it' },
        { has: 'deal_blindweed' },

        { note: 'wiki step 6: the hopper, two floors up from the brewery floor' },
        { go: [STAIRS[0], STAIRS[1] - 1], why: 'back to the stairway' },
        { loc: 'deal_stairs_bottom', at: STAIRS, why: 'up into the brewery' },
        { go: [UP_LADDER[0] - 1, UP_LADDER[1]], why: 'to the ladder up' },
        { loc: 'deal_ladder_up', at: UP_LADDER, why: 'up to the hopper floor' },
        { go: [HOPPER[0], HOPPER[1] - 1], why: 'to the hopper' },
        { useLoc: 'deal_hopper', at: HOPPER, obj: 'deal_blindweed', want: 'In it goes', why: 'first of the five' },
        { stage: 2 },

        { note: 'wiki step 7: back to Braindeath for a bucket, then 50% Luke\'s gate and the lake' },
        { loc: 'deal_laddertop', at: UP_LADDER, why: 'back down to the brewery floor' },
        { go: [BRAINDEATH[0] + 1, BRAINDEATH[1]], why: 'to Braindeath' },
        { talk: 'deal_captian_braindeath', want: 'stagnant lake', why: 'he hands over a bucket' },
        { has: 'bucket_empty' },
        { go: [STAIRS[0], STAIRS[1] + 1], why: 'to the stairway' },
        { loc: 'deal_stairs_top', at: STAIRS, why: 'down to the island' },
        { go: [GATE[0] + 1, GATE[1]], why: 'east of 50% Luke and his gate' },
        { loc: 'deal_gate_closed', at: GATE, want: 'through the gate', why: 'he does half his job and the half is keeping it shut' },
        { go: [LAKE[0] + 1, LAKE[1]], why: 'north to the stagnant lake' },
        { useLoc: 'deal_stagnant', at: LAKE, obj: 'bucket_empty', want: 'bucket of... water', why: 'fill it' },
        { has: 'deal_stagnant_bucket' },

        { note: 'and back out through the gate, which is shut again behind you - it teleports you' },
        { note: 'across rather than opening, so it is the only way back off the lake shore' },
        { go: [GATE[0], GATE[1] + 1], exact: true, why: 'the north side of the gate' },
        { loc: 'deal_gate_closed', at: GATE, want: 'through the gate', why: 'back through' },
        { go: [STAIRS[0], STAIRS[1] - 1], why: 'back to the stairway' },
        { loc: 'deal_stairs_bottom', at: STAIRS, why: 'up into the brewery' },
        { go: [UP_LADDER[0] - 1, UP_LADDER[1]], why: 'to the ladder up' },
        { loc: 'deal_ladder_up', at: UP_LADDER, why: 'up to the hopper floor' },
        { useLoc: 'deal_hopper', at: HOPPER, obj: 'deal_stagnant_bucket', want: 'In it goes', why: 'second of the five' },
        { stage: 3 },

        { note: 'wiki step 8: the fishbowl and net off Braindeath, five sea creatures into the' },
        { note: 'PRESSURE BARREL - not the hopper - and then the lever, which is dead until the' },
        { note: 'barrel has all five.' },
        { loc: 'deal_laddertop', at: UP_LADDER, why: 'down to the brewery floor' },
        { go: [BRAINDEATH[0] + 1, BRAINDEATH[1]], why: 'to Braindeath' },
        { talk: 'deal_captian_braindeath', want: 'fishbowl', why: 'he hands over the fishbowl and net' },
        { has: 'fishbowl_net' },
        { held: 'fishbowl_net', op: 2, want: 'untangle the net', why: 'the net is the half that fishes' },
        { has: 'net' },
        { go: [STAIRS[0], STAIRS[1] + 1], why: 'to the stairway' },
        { loc: 'deal_stairs_top', at: STAIRS, why: 'down to the island' },
        { note: 'the spot gives a slugling or a karamthulhu as it feels like it, so the roll is' },
        { note: 'pinned for the five casts and let go again before anything has to be fought' },
        { rng: 0, why: 'every cast lands a karamthulhu' },
        { go: [SPOT[0], SPOT[1]], why: 'to the fishing spot on the south shore' },
        { talk: 'deal_squid', want: 'karamthulhu', why: 'Fishing 50, with a net' },
        { talk: 'deal_squid', want: 'karamthulhu', why: 'two' },
        { talk: 'deal_squid', want: 'karamthulhu', why: 'three' },
        { talk: 'deal_squid', want: 'karamthulhu', why: 'four' },
        { talk: 'deal_squid', want: 'karamthulhu', why: 'five' },
        { rng: null, why: 'back to a real roll' },
        { has: 'deal_karamthulhu', n: 5 },

        { go: [STAIRS[0], STAIRS[1] - 1], why: 'back to the stairway' },
        { loc: 'deal_stairs_bottom', at: STAIRS, why: 'up into the brewery' },
        { go: [UP_LADDER[0] - 1, UP_LADDER[1]], why: 'to the ladder up' },
        { loc: 'deal_ladder_up', at: UP_LADDER, why: 'up to the barrel' },
        { go: [BARREL[0], BARREL[1] - 1], why: 'to the pressure barrel' },
        { useLoc: 'deal_hopper', at: HOPPER, obj: 'deal_karamthulhu', want: 'Not the hopper', why: 'the hopper refuses sea creatures and says where they go' },
        { useLoc: 'deal_pressure', at: BARREL, obj: 'deal_karamthulhu', want: '1 of 5', why: 'one' },
        { useLoc: 'deal_pressure', at: BARREL, obj: 'deal_karamthulhu', want: '2 of 5', why: 'two' },
        { useLoc: 'deal_pressure', at: BARREL, obj: 'deal_karamthulhu', want: '3 of 5', why: 'three' },
        { useLoc: 'deal_pressure', at: BARREL, obj: 'deal_karamthulhu', want: '4 of 5', why: 'four' },
        { useLoc: 'deal_pressure', at: BARREL, obj: 'deal_karamthulhu', want: 'lever beside it has come up', why: 'five, and the lever comes up' },
        { varis: 'deal_barrel', to: 5 },
        { loc: 'deal_multi_lever', at: LEVER, want: 'spinning on their own', why: 'the one pull' },
        { stage: 4 },
        { varis: 'deal_multi_hopper', to: 1 },

        { note: 'wiki step 9: the wrench off Braindeath, blessed by Davey, and then the controls' },
        { loc: 'deal_laddertop', at: UP_LADDER, why: 'down to the brewery floor' },
        { go: [BRAINDEATH[0] + 1, BRAINDEATH[1]], why: 'to Braindeath' },
        { talk: 'deal_captian_braindeath', want: 'Wrench', why: 'he hands over the wrench' },
        { has: 'deal_wrench' },
        { go: [DAVEY[0] + 1, DAVEY[1]], why: 'west along the brewery floor to Davey' },
        { talk: 'deal_davey', want: 'wrenchly virtue', why: 'the blessing, with 47 prayer points about you' },
        { has: 'deal_wrench_blessed' },

        { note: 'the Evil Spirit is level 150, aggressive, and had no statblock at all until now -' },
        { note: 'the sixth npc in this pass with a level, an Attack op and nothing behind it.' },
        { note: 'THE FIGHT HAPPENS INSIDE THIS CLICK and there is no honest way to catch it in' },
        { note: 'between: useOn drives the script itself, drive() counts a player with a combat' },
        { note: 'target as busy, and a sim player cannot be hurt - so the click returns only once' },
        { note: 'the spirit is dead, and a nearnpc or a fight step after it finds an empty room.' },
        { note: 'What proves it was there is the stage: ^deal_spirit and controls=working are set' },
        { note: 'by [queue,deal_spirit_down], and nothing reaches that but [ai_queue3] on its death.' },
        { go: [CONTROLS[0], CONTROLS[1] - 1], why: 'south of the controls; forceapproach=south' },
        { useLoc: 'deal_multicontrol', at: CONTROLS, obj: 'deal_wrench_blessed', want: 'comes out to see who did that', why: 'the exorcism, and the fight it starts' },
        { wait: 6, why: 'the death trigger is queued' },
        { stage: 5 },
        { varis: 'deal_multi_hopper', to: 2 },

        { note: 'wiki step 10: Braindeath first, or the carcass does not drop, then a fever spider' },
        { go: [BRAINDEATH[0] + 1, BRAINDEATH[1]], why: 'to Braindeath' },
        { talk: 'deal_captian_braindeath', want: 'fever spider', why: 'the last ingredient' },
        { loc: 'deal_laddertop', at: CELLAR_LADDER_DOWN, why: 'down into the cellar' },
        { fight: 'deal_fever_spiders1', until: 'deal_spider_body', r: 20, tries: 8, why: 'a whole one' },
        { take: 'deal_spider_body', r: 12, why: 'off the floor' },
        { loc: 'deal_ladder_up', at: CELLAR_LADDER_UP, why: 'back up out of the cellar' },
        { go: [UP_LADDER[0] - 1, UP_LADDER[1]], why: 'to the ladder up' },
        { loc: 'deal_ladder_up', at: UP_LADDER, why: 'up to the hopper' },
        { useLoc: 'deal_hopper', at: HOPPER, obj: 'deal_spider_body', want: 'legs and all', why: 'the fifth of the five' },
        { stage: 6 },

        { note: 'wiki step 11: a bucket off the output tap, which nothing in the old version ever did' },
        { loc: 'deal_laddertop', at: UP_LADDER, why: 'down to the brewery floor' },
        { go: [TAP[0], TAP[1] + 1], why: 'to the output tap' },
        { loc: 'deal_brewvat_tap', at: TAP, want: 'bucketful off the tap', why: 'draw it off' },
        { has: 'deal_bucket_swill' },
        { stage: 7 },

        { note: 'wiki step 12: Captain Donnie, out by the patches with a placard, who drinks it and' },
        { note: 'names Rabid Jack' },
        { go: [STAIRS[0], STAIRS[1] + 1], why: 'to the stairway' },
        { loc: 'deal_stairs_top', at: STAIRS, why: 'down to the island' },
        { go: [DONNIE[0] + 1, DONNIE[1]], why: 'out to the protest' },
        { useNpc: 'deal_captian_donnie', obj: 'deal_bucket_swill', want: 'Rabid Jack', why: 'he drinks it' },
        { stage: 8 },

        { note: 'and back to Braindeath, who draws one off himself' },
        { go: [STAIRS[0], STAIRS[1] - 1], why: 'back to the stairway' },
        { loc: 'deal_stairs_bottom', at: STAIRS, why: 'up into the brewery' },
        { go: [BRAINDEATH[0] + 1, BRAINDEATH[1]], why: 'to Braindeath' },
        { talk: 'deal_captian_braindeath', want: 'Rabid Jack', why: 'the report' },
        { wait: 8, why: 'he looks at the bucket for a long time' },
        { stage: 9 },
        { has: 'deal_wrench_blessed' }
    ]
};

const p: any = H.makePlayer('dealrun', m.start[0], m.start[1]);
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
