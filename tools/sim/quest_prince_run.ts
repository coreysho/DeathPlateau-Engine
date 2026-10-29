// PRINCE ALI RESCUE, played through on foot.
//
// Quest 13 of the full quest-by-quest pass. The first half of this quest is a shopping list - shear
// sheep, spin wool, mill flour, mine clay, burn logs, buy a skirt - which is skill content rather
// than quest content, so the raw materials are declared. Everything that is the QUEST is walked:
// Hassan, Osman, Leela, Ned's wig, Aggie's paste and her yellow dye, the dye on the wig, the key
// print off Lady Keli's own key, Osman casting the key, Joe and his three beers, the rope on Keli,
// the key in the cell door and the Prince himself.
//
// In 2006 Osman casts the key from the print and Leela hands it over; the modern wiki has you smelt
// it yourself at a furnace, which is the later rework.
//
//   npx tsx tools/sim/quest_prince_run.ts
import * as H from './harness.js';
import { play, Manifest } from './questrun.js';

await H.boot();

const m: Manifest = {
    quest: 'PRINCE ALI RESCUE',
    source: 'oldschool.runescape.wiki/w/Prince_Ali_Rescue',
    stageVar: 'princequest',
    done: 110, // ^prince_complete
    start: [3299, 3163, 0],
    steps: [
        { note: 'wiki part 1 is a shopping list and a tour of five skills. Declared, not walked:' },
        { note: '3 balls of wool for the wig, redberries + ashes + flour + water for the paste,' },
        { note: '2 onions for the dye, soft clay for the key print, a bronze bar for the key,' },
        { note: 'a pink skirt, three beers and a rope.' },
        { give: 'ball_of_wool', n: 3 },
        { give: 'redberries', n: 3 },
        { give: 'ashes' },
        { give: 'pot_flour' },
        { give: 'jug_water' },
        { give: 'onion', n: 2 },
        { give: 'softclay' },
        { give: 'bronze_bar' },
        { give: 'pink_skirt' },
        { give: 'beer', n: 3 },
        { give: 'rope' },
        { give: 'coins', n: 100 },

        { note: 'wiki part 2 step 1: Chancellor Hassan, in the Al Kharid palace' },
        { talk: 'hassan', picks: ['Can I help you'], why: 'he sends you to Osman' },
        { stage: 10 },

        { note: 'wiki part 2 step 2: Spymaster Osman, outside the palace to the north' },
        { setpos: [3288, 3180, 0], why: 'round to the north side of the palace' },
        { talk: 'osman', picks: ['first thing I must do', 'better go find some things'], why: 'the plan, and his daughter Leela' },
        { stage: 20 },

        { note: 'wiki part 2 step 3: Leela, east of Draynor' },
        { setpos: [3110, 3262, 0], why: 'west across the river and past Lumbridge to Draynor' },
        { talk: 'leela', picks: ['make a disguise', 'get the key made', 'do with the guards', 'rest of the escape equipment'], why: 'she explains the disguise, the key and the guard' },

        { note: 'wiki part 2 step 4: Ned makes the wig out of three balls of wool' },
        { setpos: [3101, 3257, 0], why: "west to Ned's house" },
        { talk: 'ned', picks: ['other things from wool', 'sort of wig', 'Please, make me a wig'], want: 'pretty good wig', why: 'he knits it' },
        { has: 'plainwig' },

        { note: 'wiki part 2 step 5: Aggie makes the skin paste, and the yellow dye out of two onions' },
        { setpos: [3086, 3258, 0], why: "west again to Aggie's" },
        { talk: 'aggie', picks: ['make skin paste', 'Mix me some skin paste'], why: 'the paste' },
        { has: 'skinpaste' },
        { talk: 'aggie', picks: ['make dyes for me', 'yellow dye', 'make me some yellow dye'], why: 'and the dye' },
        { has: 'yellowdye' },

        { note: 'wiki part 2 step 6: the dye on the wig' },
        { use: ['yellowdye', 'plainwig'], want: 'dye the wig blonde', why: 'blonde' },
        { has: 'blondwig' },

        { note: 'wiki part 3 step 2: Lady Keli, in the jail east of Draynor, and her key' },
        { setpos: [3127, 3244, 0], why: 'east to the jail' },
        { talk: 'lady_keli', picks: ['famous in Gielinor', 'latest plan then', 'not try to get him out', 'see the key please', 'touch the key'], want: 'imprint', why: 'the soft clay takes an imprint of it' },
        { has: 'keyprint' },
        { hasnt: 'softclay' },

        { note: 'wiki part 3 step 4: in 2006 Osman casts the key from the print and the bronze bar' },
        { setpos: [3288, 3180, 0], why: 'back east to Al Kharid' },
        { talk: 'osman', picks: ['Thank you. I will try to find the other items'], why: 'he takes the print and the bar' },
        { hasnt: 'keyprint' },
        { varis: 'prince_keystatus', to: 1 },

        { note: 'wiki part 3 step 5: Leela hands the key over, and the disguise is complete' },
        { setpos: [3110, 3262, 0], why: 'back west to Leela' },
        { talk: 'leela', why: 'she gives you the key' },
        { has: 'princeskey' },
        { talk: 'leela', picks: ['get him drunk'], why: 'and with the whole disguise in hand, the guard is next' },
        { stage: 30 },

        { note: 'wiki part 3 step 6: Joe, and all three beers' },
        { setpos: [3125, 3245, 0], why: 'back east to the jail' },
        { note: 'one offer is all three: he takes the first and then helps himself to the other two' },
        { talk: 'joe', picks: ['some beer here'], why: 'all three beers' },
        { stage: 40 },
        { hasnt: 'beer' },

        { note: 'wiki part 3 step 7: the rope on Keli' },
        { useNpc: 'lady_keli', obj: 'rope', want: 'tie her up', why: 'into a cupboard with her' },
        { stage: 50 },
        { hasnt: 'rope' },

        { note: 'wiki part 3 step 8: the key in the cell door' },
        { useLoc: 'alidoor', at: [3123, 3243], obj: 'princeskey', want: 'unlock the door', why: 'unlock it' },

        { note: 'wiki part 3 step 9: the Prince puts the disguise on and walks out' },
        { talk: 'prince_ali_prison', why: 'he escapes' },
        { stage: 100 },
        { hasnt: 'blondwig' },
        { hasnt: 'pink_skirt' },
        { hasnt: 'skinpaste' },

        { note: 'wiki part 3 step 10: and Hassan pays' },
        { setpos: [3299, 3163, 0], why: 'all the way back to the Al Kharid palace' },
        { talk: 'hassan', why: 'the reward' },
        { stage: 110 },
        { has: 'coins', n: 700 }
    ]
};

const p: any = H.makePlayer('princerun', m.start[0], m.start[1]);
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
