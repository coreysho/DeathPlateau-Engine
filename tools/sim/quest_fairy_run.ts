// A FAIRY TALE PART I - GROWING PAINS, played through on foot.
//
// Quest 19 of the full quest-by-quest pass and the first of the members' list. Martin in Draynor,
// the throne in Zanaris with the wrong person on it, Fairy Nuff and her symptoms list, the Queen's
// secateurs out of the one chest no fairy can look at, an ordinary pair enchanted off them, a skull
// dug out of Draynor graveyard, three dull growing things, the Tanglefoot, and the Queen awake.
//
//   npx tsx tools/sim/quest_fairy_run.ts
import * as H from './harness.js';
import { play, Manifest } from './questrun.js';

await H.boot();

const m: Manifest = {
    quest: 'A FAIRY TALE PART I',
    source: 'oldschool.runescape.wiki/w/Fairytale_I_-_Growing_Pains',
    stageVar: 'fairy_farmers_quest',
    done: 100,   // ^fairy_complete
    start: [3074, 3263, 0],
    steps: [
        { note: 'wiki: a spade, an ordinary pair of secateurs, and three things that grew on this' },
        { note: 'side of the door - logs, an onion and a potato' },
        { give: 'spade' },
        { give: 'secateurs' },
        { give: 'logs' },
        { give: 'onion' },
        { give: 'potato' },

        { note: 'wiki step 1: Martin the Master Farmer, whose allotments are all dying' },
        { talk: 'martin_the_master_farmer', picks: ['Where would you start'], why: 'the story says Zanaris' },
        { stage: 10 },
        { varis: 'fairy_queen_check', to: 1 },
        { varis: 'fairy_godfather_check', to: 1 },

        { note: 'wiki step 2: the throne room in Zanaris, which has somebody else on the throne' },
        { setpos: [2443, 4432, 0], why: 'through a fairy ring into Zanaris and into the throne room' },
        { talk: 'fairy_godfather_multi', want: 'the throne is the wrong shape', why: 'he will not say where she is' },
        { setpos: [2451, 4451, 0], why: 'out to the ring coordinator' },
        { talk: 'fairy_coordinator', want: 'Fairy Nuff', why: 'he points at Fairy Nuff' },

        { note: 'wiki step 3: Fairy Nuff, who has the Queen on her floor' },
        { setpos: [2391, 4471, 0], why: "west to Nuff's" },
        { talk: 'fairy_nuff', why: 'eleven days asleep and no wound' },
        { stage: 20 },
        { talk: 'fairy_nuff', why: 'and she hands over the symptoms list' },
        { has: 'fairy_symptoms_list' },
        { held: 'fairy_symptoms_list', op: 1, want: 'discorporation', why: 'read it' },
        { stage: 30 },
        { talk: 'fairy_nuff', want: 'secateurs', why: 'the diagnosis: her magic is in her secateurs, and they are gone' },
        { stage: 40 },

        { note: 'wiki step 4: the chest no fairy can look at' },
        { loc: 'fairy_chest_closed', at: [2381, 4455], want: 'four hundred years old', why: 'open it' },
        { has: 'fairy_queen_secateurs' },

        { note: 'wiki step 5: Nuff moves a little of the Queen into an ordinary pair' },
        { setpos: [2391, 4471, 0], why: 'back to Nuff' },
        { talk: 'fairy_nuff', want: 'Magic secateurs', why: 'she enchants the farmer pair' },
        { stage: 50 },
        { has: 'fairy_enchanted_secateurs' },
        { hasnt: 'secateurs' },

        { note: 'wiki step 6: she asks for the Tanglefoot, and for a skull from Draynor' },
        { talk: 'fairy_nuff', want: 'skull, from Draynor', why: 'the peculiar request' },
        { stage: 60 },

        { note: 'wiki step 6: the graveyard, with a spade. This used to be an op on the gravestone,' },
        { note: 'which carries no ops at all, so the skull could not be got.' },
        { setpos: [3106, 3384, 0], why: 'back out of Zanaris to Draynor graveyard' },
        { held: 'spade', op: 1, want: 'grave matter', why: 'dig' },
        { has: 'fairy_skull' },

        { note: 'wiki step 7: three dull growing things, and then the thing under the floor' },
        { setpos: [2391, 4471, 0], why: 'back to Nuff with the skull' },
        { talk: 'fairy_nuff', want: 'the other part', why: 'she takes the skull and asks for the three patches' },
        { stage: 70 },
        { note: 'one conversation takes all three - she asks for them together, not one at a time' },
        { talk: 'fairy_nuff', want: 'comes up through it', why: 'the logs, the onion and the potato, and then the Tanglefoot' },
        { stage: 80 },
        { has: 'fairy_enchanted_secateurs' },

        { note: 'wiki step 8: her secateurs and the skull, both, in that room' },
        { talk: 'fairy_nuff', want: 'the room is damp', why: 'and she wakes up' },
        { stage: 100 },
        { hasnt: 'fairy_queen_secateurs' },
        { hasnt: 'fairy_skull' },
        { varis: 'fairy_queen_check', to: 0 },
        { varis: 'fairy_godfather_check', to: 0 }
    ]
};

const p: any = H.makePlayer('fairyrun', m.start[0], m.start[1]);
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
