// PIRATE'S TREASURE, played through on foot.
//
// Quest 17 of the full quest-by-quest pass. Redbeard Frank in the Port Sarim pub, the banana
// plantation job on Karamja, a bottle of rum smuggled past the customs officer under ten bananas,
// Wydin's back room and the apron you cannot go in without, the chest upstairs in the Blue Moon,
// and a spade in the Falador park flowerbed.
//
// The boat fare, the rum and the apron are declared - they are a shop, a bar and a clothes shop.
//
//   npx tsx tools/sim/quest_hunt_run.ts
import * as H from './harness.js';
import { play, Manifest } from './questrun.js';

await H.boot();

const m: Manifest = {
    quest: "PIRATE'S TREASURE",
    source: 'oldschool.runescape.wiki/w/Pirate%27s_Treasure',
    stageVar: 'hunt',
    done: 4,   // ^hunt_complete
    start: [3054, 3249, 0],
    steps: [
        { note: 'wiki: 60 coins for the boat both ways, 30 for the rum, a white apron and a spade' },
        { give: 'coins', n: 100 },
        { give: 'karamja_rum' },
        { give: 'white_apron' },
        { give: 'spade' },

        { note: 'wiki step 1: Redbeard Frank, in the Port Sarim pub' },
        { talk: 'redbeard_frank', picks: ['in search of treasure'], why: 'he wants a bottle of Karamjan rum' },
        { stage: 1 },

        { note: 'wiki step 2: Luthas at the Karamja banana plantation gives you the crate job' },
        { setpos: [2938, 3156, 0], why: 'the ship from Port Sarim to Musa Point' },
        { talk: 'luthas', picks: ['offer me employment'], why: 'fill his crate and he pays 30 coins' },

        { note: 'wiki step 2: the rum goes in first, then ten bananas on top of it' },
        { setpos: [2943, 3152, 0], why: 'round to the crate' },
        { useLoc: 'bananacrate', at: [2943, 3151], obj: 'karamja_rum', want: 'rum', why: 'stash the rum' },
        { varis: 'crate_rum', to: 1 },
        { give: 'banana', n: 10 },
        { useLoc: 'bananacrate', at: [2943, 3151], obj: 'banana', why: 'banana 1' },
        { useLoc: 'bananacrate', at: [2943, 3151], obj: 'banana', why: '2' },
        { useLoc: 'bananacrate', at: [2943, 3151], obj: 'banana', why: '3' },
        { useLoc: 'bananacrate', at: [2943, 3151], obj: 'banana', why: '4' },
        { useLoc: 'bananacrate', at: [2943, 3151], obj: 'banana', why: '5' },
        { useLoc: 'bananacrate', at: [2943, 3151], obj: 'banana', why: '6' },
        { useLoc: 'bananacrate', at: [2943, 3151], obj: 'banana', why: '7' },
        { useLoc: 'bananacrate', at: [2943, 3151], obj: 'banana', why: '8' },
        { useLoc: 'bananacrate', at: [2943, 3151], obj: 'banana', why: '9' },
        { useLoc: 'bananacrate', at: [2943, 3151], obj: 'banana', why: 'and the tenth' },
        { varis: 'crate_bananas', to: 10 },

        { note: 'wiki step 2: tell Luthas it is full and he ships it - rum and all' },
        { setpos: [2938, 3156, 0], why: 'back to Luthas' },
        { talk: 'luthas', picks: ["Thank you, I'll be on my way"], want: '30 coins', why: 'he pays and the crate sails' },
        { varis: 'crate_rum', to: 2 },

        { note: "wiki step 3: Wydin's food shop in Port Sarim. The job needs the apron ON." },
        { setpos: [3015, 3205, 0], why: 'the ship home to Port Sarim' },
        { held: 'white_apron', op: 2, why: 'the apron goes on' },
        { worn: 'white_apron' },
        { talk: 'wydin', picks: ['Can I get a job here'], want: 'hired', why: 'he hires you' },
        { loc: 'wydindoor', at: [3012, 3204], why: 'through the staff door, which refuses anyone else' },
        { loc: 'grocerycrate', at: [3009, 3207], picks: ['No'], want: 'bottle of rum', why: 'and there is the rum' },
        { has: 'karamja_rum' },

        { note: 'wiki step 4: the rum to Frank, who hands over the chest key' },
        { setpos: [3054, 3249, 0], why: 'back east to the pub' },
        { talk: 'redbeard_frank', picks: ["Ok thanks, I'll go and get it"], why: 'he takes the rum' },
        { stage: 2 },
        { hasnt: 'karamja_rum' },
        { has: 'chest_key' },

        { note: "wiki step 5: the chest upstairs in Varrock's Blue Moon Inn" },
        { setpos: [3219, 3396, 1], why: 'north-east to Varrock and up the inn stairs. The chest has forceapproach and answers from its east side only - from the north or the west it does nothing at all' },
        { useLoc: 'piratechest', at: [3218, 3396], obj: 'chest_key', why: 'unlock it' },
        { wait: 14, why: 'the chest takes its time: a delay, then seven more ticks before the message is in your hand' },
        { has: 'piratemessage' },
        { hasnt: 'chest_key' },
        { held: 'piratemessage', op: 1, why: 'read it - it names the Falador park flowerbed' },
        { stage: 3 },

        { note: 'wiki step 6: dig the flowerbed in Falador park, which Wyson guards' },
        { setpos: [2999, 3383, 0], why: 'west to Falador park' },
        { held: 'spade', op: 1, want: 'bag of treasure', why: 'dig' },
        { stage: 4 },
        { has: 'emerald' },
        { has: 'gold_ring' }
    ]
};

const p: any = H.makePlayer('huntrun', m.start[0], m.start[1]);
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
