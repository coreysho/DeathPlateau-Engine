// SCORPION CATCHER, played through on foot.
//
// Quest 26 of the quest-by-quest pass. Thormac at the top of the Sorcerer's Tower has lost three
// lesser Kharid scorpions; a Seer in Seers' Village finds them one at a time, and they are in the
// three least convenient places on the map - a secret room in the Taverley dungeon past the
// spiders and the coffins, a locked hut on the Barbarian Outpost course, and the bedroom upstairs
// in the Edgeville monastery. The cage changes name as it fills, which is the real test here: catch
// them out of order and the chain of objs has to still end at scorpioncagefull.
//
//   npx tsx tools/sim/quest_scorpcatcher_run.ts
import * as H from './harness.js';
import { play, Manifest } from './questrun.js';

await H.boot();

const THORMAC: [number, number, number] = [2702, 3408, 3];

const m: Manifest = {
    quest: 'SCORPION CATCHER',
    source: 'oldschool.runescape.wiki/w/Scorpion_Catcher',
    stageVar: 'scorpcatcher',
    done: 6,   // ^scorpcatcher_complete
    start: [2702, 3408, 3],
    steps: [
        { note: 'requirements: 31 Prayer for the monastery, and Alfred Grimhand’s Barcrawl for' },
        { note: 'the Barbarian Outpost. Both are other quests, so the barcrawl is declared.' },
        { setvar: 'barcrawl', to: 2, why: '^barcrawl_complete - the outpost gate wants it' },

        { note: 'wiki step 1: Thormac, top floor of the Sorcerer’s Tower' },
        { talk: 'thormac', picks: ['What do you need assistance with', 'So how would I go about catching them', 'Ok, I will do it'], want: 'village of Seers', why: 'he hands over the cage' },
        { stage: 1 },
        { has: 'scorpioncageempty' },

        { note: 'wiki step 2: a Seer. Until he has looked in his glass the secret wall in the' },
        { note: 'Taverley dungeon is just a wall - the op says so and does nothing else.' },
        { note: 'the Seers are not out in the square - all four of them wander inside the house in' },
        { note: 'the middle of the village, which has one door on its north side. Standing outside' },
        { note: 'it and clicking a Seer gets "I can’t reach that!" and nothing else.' },
        { setpos: [2701, 3477, 0], why: 'north to Seers’ Village, at the house door' },
        { loc: 'loc_1530', at: [2701, 3477], why: 'the door' },
        { go: [2701, 3475], why: 'inside, where the Seers are' },
        { talk: 'seer', picks: ['Your friend Thormac sent me'], tries: 3, want: 'secret room', why: 'the first hint: spiders and two coffins' },
        { stage: 2 },

        { note: 'wiki step 3: the first scorpion, through the false wall south of the coffins in' },
        { note: 'the Taverley dungeon' },
        { setpos: [2875, 9800, 0], why: 'the long way round the dungeon - dragons, demons, spiders' },
        { loc: 'scorpionwall', at: [2875, 9799], want: 'found a secret door', why: 'search the wall' },
        { go: [2877, 9797], why: 'into the secret room' },
        { useNpc: 'questscorpiona', obj: 'scorpioncageempty', want: 'catch a scorpion', why: 'cage the first one' },
        { has: 'scorpioncagea' },

        { note: 'wiki: back to the Seer, who gives up the other two in one conversation' },
        { setpos: [2701, 3477, 0], why: 'back to Seers’ Village' },
        { note: 'the door is swapped for an open one that stays open for a while, so on the second' },
        { note: 'visit there may be nothing called loc_1530 to click - which is not a failure' },
        { loc: 'loc_1530', at: [2701, 3477], soft: true, why: 'the door again, if it has shut' },
        { go: [2701, 3475], why: 'back inside' },
        { talk: 'seer', tries: 3, want: 'brown clothing', why: 'hints two and three' },
        { stage: 3 },

        { note: 'Peksa in Barbarian Village is the rest of the second hint - he gave the scorpion' },
        { note: 'to his brother Ivor at the outpost. The option only exists at this stage.' },
        { setpos: [3074, 3429, 0], why: 'east to the Barbarian Village helmet shop' },
        { talk: 'peksa', picks: ['small scorpion in your possession'], want: 'brother Ivor', why: 'where it went' },

        { note: 'wiki step 4: the outpost hut. The gate wants the barcrawl done, the hut has its' },
        { note: 'own door, and the scorpion wanders just inside.' },
        { setpos: [2550, 3570, 0], why: 'north-west onto the agility course' },
        { loc: 'loc_1542', at: [2551, 3570], why: 'the hut door' },
        { go: [2552, 3571], why: 'inside' },
        { useNpc: 'questscorpionb', obj: 'scorpioncagea', want: 'catch a scorpion', why: 'cage the second one' },
        { has: 'scorpioncageab' },

        { note: 'wiki step 5: the monastery. 31 Prayer to get in, up the ladder in the south-east' },
        { note: 'corner, and through the bedroom door at the top.' },
        { setpos: [3058, 3484, 1], why: 'east to the monastery and up the ladder' },
        { loc: 'loc_1530', at: [3058, 3485], why: 'the bedroom door' },
        { go: [3058, 3486], why: 'into the bedroom' },
        { useNpc: 'questscorpionc', obj: 'scorpioncageab', want: 'catch a scorpion', why: 'cage the last one' },
        { has: 'scorpioncagefull' },

        { note: 'wiki step 6: all three back to Thormac' },
        { setpos: THORMAC, why: 'back west to the tower' },
        { talk: 'thormac', want: 'scorpions home at last', why: 'hand them over' },
        { wait: 4, why: 'the completion is queued' },
        { stage: 6 },
        { hasnt: 'scorpioncagefull' },
        { level: 3 }
    ]
};

const p: any = H.makePlayer('scorprun', m.start[0], m.start[1]);
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
