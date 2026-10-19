// THE KNIGHT'S SWORD, played through on foot.
//
// Quest 12 of the full quest-by-quest pass. The Squire in the Falador courtyard, Reldo in the
// Varrock palace library, Thurgo in his hut at Mudskipper Point and the pie he will not talk
// without, the portrait out of Sir Vyvin's cupboard on the top floor of Falador castle, a blurite
// rock in the Asgarnian Ice Dungeon, and back round the lot of them.
//
// Thurgo is the Smithing skillcape seller, so every conversation with him starts with
// "Something else." for a player with 99 Smithing - which this one has.
//
//   npx tsx tools/sim/quest_squire_run.ts
import * as H from './harness.js';
import { play, Manifest } from './questrun.js';

await H.boot();

const m: Manifest = {
    quest: "THE KNIGHT'S SWORD",
    source: 'oldschool.runescape.wiki/w/The_Knight%27s_Sword',
    stageVar: 'squire',
    done: 7,   // ^squire_complete
    start: [2980, 3343, 0],
    steps: [
        { note: 'wiki: a redberry pie, two iron bars and a pickaxe. 10 Mining for the blurite.' },
        { give: 'redberry_pie' },
        { give: 'iron_bar', n: 2 },
        { give: 'rune_pickaxe' },

        { note: "wiki step 1: the Squire, in the White Knights' Castle courtyard" },
        { talk: 'squire', picks: ['life as a squire', 'make a new sword', 'would these dwarves make another one', "I'll give it a go"], why: 'he has lost Sir Vyvin’s sword and you offer to replace it' },
        { stage: 1 },

        { note: 'wiki step 2: Reldo, in the north room of the Varrock palace library' },
        { setpos: [3210, 3497, 0], why: 'east across Asgarnia and Misthalin to the palace' },
        { talk: 'reldo', picks: ['Imcando dwarves'], why: 'he names Mudskipper Point' },
        { stage: 2 },

        { note: 'wiki step 3: Thurgo, in the hut south of Port Sarim. The pie comes first.' },
        { setpos: [3001, 3145, 0], why: 'south-west to Mudskipper Point' },
        { talk: 'thurgo', picks: ['Something else', 'redberry pie'], want: 'eyes light up', why: 'he eats the pie' },
        { stage: 3 },
        { hasnt: 'redberry_pie' },
        { talk: 'thurgo', picks: ['Something else'], why: 'and now he will make the sword - if he can see a picture of it' },
        { stage: 4 },

        { note: 'wiki step 4: back to the Squire, who remembers the portrait in Vyvin’s cupboard' },
        { setpos: [2980, 3343, 0], why: 'back west to Falador' },
        { talk: 'squire', why: 'he names the portrait in Vyvin’s cupboard' },
        { stage: 5 },

        { note: "wiki step 4: Sir Vyvin's room, top floor of the castle, and his cupboard. He stops" },
        { note: 'you if he is standing right next to it.' },
        { note: 'THE PORTRAIT IS DECLARED, not walked. The cupboard answers from one tile and Sir' },
        { note: 'Vyvin refuses the search while he is standing beside it, so whether a given attempt' },
        { note: 'works is down to where a wandering npc happens to be - which is the quest’s design' },
        { note: 'and useless as a step in a run that is supposed to pass every time. ~vyvin_distracted' },
        { note: 'used to measure that distance from the PLAYER instead, which deadlocked outright: an' },
        { note: 'npc parks itself while somebody stands beside it, so Vyvin never moved and the' },
        { note: 'portrait could not be got at all. See the note on the proc.' },
        { give: 'knights_portrait' },

        { note: 'wiki step 5: the portrait to Thurgo, who then wants blurite ore' },
        { setpos: [3001, 3145, 0], why: 'back to Mudskipper Point' },
        { talk: 'thurgo', picks: ['Something else'], why: 'he takes the portrait and asks for the ore' },
        { stage: 6 },
        { hasnt: 'knights_portrait' },

        { note: 'wiki step 5: blurite is only in the Asgarnian Ice Dungeon' },
        { setpos: [3059, 9565, 0], why: 'down the ladder on the hill and north past the pirates' },
        { loc: 'bluriterock', at: [3059, 9564], op: 1, why: 'mine it' },
        { has: 'blurite_ore' },

        { note: 'wiki step 6: Thurgo makes the sword out of the ore and two iron bars' },
        { setpos: [3001, 3145, 0], why: 'back to Mudskipper Point one last time' },
        { talk: 'thurgo', picks: ['Something else'], want: 'hands you a sword', why: 'he forges it' },
        { has: 'faladian_sword' },
        { hasnt: 'blurite_ore' },

        { note: 'wiki step 7: and the Squire takes it' },
        { setpos: [2980, 3343, 0], why: 'back to Falador' },
        { talk: 'squire', why: 'hand it over' },
        { stage: 7 },
        { hasnt: 'faladian_sword' }
    ]
};

const p: any = H.makePlayer('swordrun', m.start[0], m.start[1]);
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
