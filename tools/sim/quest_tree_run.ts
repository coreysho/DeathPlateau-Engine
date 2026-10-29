// TREE GNOME VILLAGE, played through on foot.
//
// Quest 33 of the quest-by-quest pass. King Bolren's orb of protection is in Khazard hands north of
// the maze; the battlefield wants six loads of logs, three tracker gnomes have one stronghold
// coordinate each, and the ballista only breaches the wall when all three are entered. Then the
// crumbled wall, the chest upstairs, and a warlord in the valley beyond who has the other two orbs.
//
//   npx tsx tools/sim/quest_tree_run.ts
import * as H from './harness.js';
import { play, Manifest } from './questrun.js';

await H.boot();

const BALLISTA: [number, number] = [2508, 3210];
const WALL: [number, number] = [2509, 3253];

const m: Manifest = {
    quest: 'TREE GNOME VILLAGE',
    source: 'oldschool.runescape.wiki/w/Tree_Gnome_Village',
    stageVar: 'treequest',
    done: 9,   // ^tree_complete
    start: [2503, 3189, 0],
    steps: [
        { note: 'six loads of logs for the battlements, and a weapon for the warlord' },
        { give: 'logs', n: 6 },
        { give: 'rune_scimitar' },
        { held: 'rune_scimitar', op: 2, why: 'wield it' },

        { note: 'wiki step 1: the maze. Elkoy only offers to guide you once the quest is live, so' },
        { note: 'the first trip in is on foot - which is what Bolren means by "I’m surprised you' },
        { note: 'made it in".' },
        { note: 'the maze has one way in from outside: 215 tiles round its south side to the loose' },
        { note: 'railing at 2515,3161, squeeze through that, and the village is 34 tiles further.' },
        { go: [2515, 3160], r: 200, exact: true, why: 'round the outside to the railing' },
        { loc: 'treegnomelooserailing', at: [2515, 3161], why: 'squeeze through it' },
        { go: [2541, 3170], r: 120, why: 'through the maze to the king' },
        { talk: 'king_bolren', picks: ['Can I help at all', 'I would be glad to help'], want: 'battlefield is to the north', why: 'he asks for the orb back' },
        { stage: 1 },

        { note: 'wiki step 2: Commander Montai on the battlefield wants six loads of logs' },
        { setpos: [2525, 3207, 0], why: 'north out of the maze to the battlefield' },
        { talk: 'commander_montai', picks: ["Ok, I'll gather some wood"], want: 'Six loads of normal logs', why: 'he names the price' },
        { stage: 2 },
        { talk: 'commander_montai', want: 'give six loads of logs', why: 'hand them over' },
        { stage: 3 },
        { hasnt: 'logs' },

        { note: 'wiki step 3: and then he sends you after the three tracker gnomes' },
        { talk: 'commander_montai', picks: ["I'll try my best"], want: 'find the trackers', why: 'take the job' },
        { stage: 4 },

        { note: 'wiki step 4: one coordinate each. Height 4 from the first, x 3 from the second -' },
        { note: 'who is a prisoner and answers from two tiles away - and y 5 from the third.' },
        { setpos: [2503, 3263, 0], why: 'north into the heart of the battlefield' },
        { talk: 'tracker1', want: 'height coordinate is 4', why: 'the height' },
        { setpos: [2523, 3257, 0], why: 'east to the second tracker' },
        { talk: 'tracker2', want: 'y coordinate is 5', why: 'the second one has the y' },
        { setpos: [2496, 3233, 0], why: 'south-west to the third' },
        { talk: 'tracker3', want: 'coordinate', why: 'and the last' },

        { note: 'wiki step 5: the ballista, with 4, 3 and 5 in that order. A wrong set flies over' },
        { note: 'the stronghold and the shot is wasted.' },
        { setpos: [2509, 3211, 0], why: 'back to the ballista' },
        { loc: 'catabow', at: BALLISTA, op: 2, picks: [4, 3, 5], want: 'reduced to rubble', why: 'fire it' },
        { stage: 5 },

        { note: 'wiki step 6: the wall can only be climbed from the south, and the commander' },
        { note: 'inside objects to both the climb and the chest' },
        { setpos: [2509, 3252, 0], why: 'north to the breached wall' },
        { loc: 'khazzacklowwall', at: WALL, want: 'climb over the remains', why: 'over it' },
        { fight: 'khazard_commander', r: 12, why: 'he attacks on sight' },

        { note: 'the chest is upstairs, and the two halves of the stronghold are joined by one' },
        { note: 'diagonal door at 2505,3256' },
        { go: [2506, 3256], why: 'west to the inner door' },
        { loc: 'loc_1530', at: [2505, 3256], why: 'open it' },
        { go: [2503, 3253], why: 'through to the ladder' },
        { loc: 'ladder', at: [2503, 3252], why: 'up' },
        { level: 1 },
        { go: [2506, 3258], why: 'round to the chest' },
        { loc: 'chestclosed_khazard', at: [2506, 3259], why: 'open it' },
        { loc: 'chestopen_khazard', at: [2506, 3259], want: 'stolen orb of protection', why: 'take the orb' },
        { stage: 6 },
        { has: 'orb_of_protection' },

        { note: 'wiki step 7: back to Bolren with it - and the village has been raided in the' },
        { note: 'meantime, so the other two orbs are gone as well' },
        { setpos: [2503, 3189, 0], why: 'south to the maze entrance' },
        { talk: 'elkoy', picks: ['Yes please'], why: 'Elkoy walks you back in - straight to the village now' },
        { go: [2541, 3170], why: 'to the king' },
        { talk: 'king_bolren', picks: ['I will find the warlord'], want: 'headed north of the stronghold', why: 'hand over the orb' },
        { stage: 7 },
        { hasnt: 'orb_of_protection' },

        { note: 'wiki step 8: the warlord in the valley north-west of the stronghold' },
        { setpos: [2459, 3296, 0], why: 'the long walk north-west' },
        { fight: 'khazard_warlord', untilvar: 'treequest', to: 8, tries: 4, why: 'he has both orbs' },
        { stage: 8 },
        { note: 'the orbs come straight out of his satchel - there is nothing to pick up' },
        { has: 'orbs_of_protection' },

        { note: 'wiki step 9: and home, for the ceremony at the spirit tree' },
        { setpos: [2503, 3189, 0], why: 'all the way back' },
        { talk: 'elkoy', picks: ['Yes please'], why: 'in one more time' },
        { go: [2541, 3170], why: 'to the king' },
        { talk: 'king_bolren', want: 'begin the ceremony', why: 'hand over the orbs' },
        { wait: 30, why: 'the chanting runs through a dozen delays' },
        { stage: 9 },
        { has: 'gnome_amulet' }
    ]
};

const p: any = H.makePlayer('treerun', m.start[0], m.start[1]);
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
