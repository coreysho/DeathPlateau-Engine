// DEMON SLAYER, played through on foot.
//
// Quest 16 of the full quest-by-quest pass. Gypsy Aris in her Varrock tent, Sir Prysin in the
// palace, his three keys - his own, Captain Rovin's up in the north-west tower, and the one he
// dropped down the kitchen drain, which a bucket of water washes into the sewer - Traiborn's
// twenty-five bones, Silverlight, and Delrith in the stone circle with the one incantation of four
// that works.
//
//   npx tsx tools/sim/quest_demon_run.ts
import * as H from './harness.js';
import { play, Manifest } from './questrun.js';

await H.boot();

const m: Manifest = {
    quest: 'DEMON SLAYER',
    source: 'oldschool.runescape.wiki/w/Demon_Slayer',
    stageVar: 'demonstart',
    done: 30,   // ^demon_complete
    start: [3203, 3423, 0],
    steps: [
        { note: 'wiki: 25 bones for Traiborn and a bucket of water for the drain. The bones come' },
        { note: 'later on purpose - twenty-five of them fill an inventory, and a full inventory' },
        { note: 'cannot pick the key out of the sewer.' },
        { give: 'bucket_water' },
        { note: 'and one coin, because Aris will not read a palm that has not been crossed with silver' },
        { give: 'coins', n: 1 },

        { note: 'wiki step 1: Gypsy Aris, in the tent in Varrock square' },
        { talk: 'aris', picks: ['Ok, here you go', 'Aaargh bit mean', "Who's Delrith", "I'll kill him for you", 'Where can I find Silverlight', "I'll do my best"], tries: 3, why: 'her crystal ball, Delrith, and where to find Silverlight' },
        { stage: 1 },

        { note: 'wiki step 2: Sir Prysin, in Varrock palace. Three keys, three different places.' },
        { setpos: [3203, 3473, 0], why: 'north through the city into the palace' },
        { talk: 'sir_prysin', picks: ['Gypsy Aris said I should come', 'I need to find Silverlight', 'crystal ball seems to think otherwise', 'So give me the keys', 'Can you give me your key', 'Where can I find Captain Rovin', "Well I'd better go key hunting"], tries: 3, why: 'the box needs three keys - and he dropped his own down the kitchen drain' },
        { stage: 2 },

        { note: "wiki step 3: Captain Rovin, top floor of the palace's north-west tower" },
        { setpos: [3205, 3496, 2], why: 'up the tower stairs' },
        { talk: 'captain_rovin', picks: ['this is important', 'demon who wants to invade'], tries: 3, why: 'he gives up his key' },
        { has: 'silverlight_key_2' },

        { note: 'wiki step 4: the drain by the palace kitchen, and a bucket of water down it' },
        { setpos: [3225, 3496, 0], why: 'back down and round to the kitchen' },
        { loc: 'questdrain', at: [3225, 3495], want: 'key Sir Prysin dropped', why: 'look down it' },
        { useLoc: 'questdrain', at: [3225, 3495], obj: 'bucket_water', want: 'washed the key down', why: 'and flush it through' },

        { note: 'wiki step 4: down in the sewer, where it landed' },
        { setpos: [3225, 9896, 0], why: 'into the sewer under the palace' },
        { wait: 6, why: 'let the zone the key landed in come into view' },
        { take: 'silverlight_key_3', r: 10, why: 'off the sewer floor' },
        { has: 'silverlight_key_3' },

        { note: 'wiki step 5: Traiborn in the Wizards Tower wants 25 bones for his key, and takes' },
        { note: 'them one conversation at a time' },
        { note: 'the bones arrive now and not at the start, because twenty-five of them plus the' },
        { note: 'keys fills the inventory - and a full inventory cannot pick the sewer key up.' },
        { give: 'bones', n: 25 },
        { setpos: [3111, 3161, 1], why: 'south-west to the tower and up a floor' },
        { talk: 'traiborn', picks: ['key given to you by Sir Prysin', 'He told me you were looking after it', 'any keys knocking around', "I'll get the bones for you"], why: 'he agrees, for bones' },
        { stage: 3 },
        { talk: 'traiborn', until: 'silverlight_key_1', tries: 30, why: 'twenty-five bones, one conversation each' },
        { has: 'silverlight_key_1' },

        { note: 'wiki step 6: back to Prysin, who opens the box' },
        { setpos: [3203, 3473, 0], why: 'back to the palace' },
        { talk: 'sir_prysin', tries: 3, why: 'he hands over Silverlight' },
        { stage: 29 },
        { has: 'silverlight' },

        { note: 'wiki step 7: Silverlight in hand, Delrith in the stone circle south-west of Varrock' },
        { held: 'silverlight', op: 2, why: 'wield it - he cannot be hurt without it' },
        { worn: 'silverlight' },
        { setpos: [3228, 3371, 0], why: 'south-west out of the city to the circle' },
        { fight: 'delrith', why: 'beaten down to nothing, at which point he changes rather than dies' },

        { note: 'wiki step 7: and then the incantation - four of them and only one works' },
        { say: ['Carlem Aber Camerinthum Purchai Gabindo'], why: 'the right words' },
        { stage: 30 }
    ]
};

const p: any = H.makePlayer('demonrun', m.start[0], m.start[1]);
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
