// SHADOW OF THE STORM, played through on foot.
//
// Quest 48 of the quest-by-quest pass. Two priests have spent four months following a cult that
// cannot pronounce the name of the thing it is trying to summon, and they cannot get in, because
// nobody lets a priest into a demonic summoning. There is a man in a cellar in Edgeville who has
// been writing to the cult for two years and has never had a reply, and he knows what to wear.
//
//   npx tsx tools/sim/quest_agrith_run.ts
import * as H from './harness.js';
import { play, Manifest } from './questrun.js';

await H.boot();

const REEN_ALKHARID: [number, number, number] = [3272, 3158, 0];
const DAVE_CELLAR: [number, number, number] = [3080, 9890, 0];
const UZER_PRIESTS: [number, number, number] = [3483, 3092, 0];
const GOLEM: [number, number, number] = [3487, 3090, 0];
const KILN: [number, number] = [3467, 3123];

const m: Manifest = {
    quest: 'SHADOW OF THE STORM',
    source: 'oldschool.runescape.wiki/w/Shadow_of_the_Storm/Quick_guide',
    stageVar: 'agrith_quest',
    done: 125,   // ^agrith_complete
    start: [3272, 3158, 0],
    steps: [
        { note: 'requirements: Demon Slayer, which is where Silverlight comes from, and The Golem,' },
        { note: 'which is where the mushroom ink does. Neither was checked until now.' },
        { setvar: 'demonstart', to: 30, why: '^demon_complete' },
        { setvar: 'golem_a', to: 10, why: '^golem_complete' },
        { give: 'silverlight' },
        { give: 'desert_shirt' },
        { give: 'desert_robe' },
        { note: 'one vial of ink per item, which is why the walkthrough wants three black pieces' },
        { give: 'golem_ink', n: 3 },
        { give: 'silver_bar' },

        { note: 'wiki step 1: Father Reen, south of the Al Kharid bank. He renders there at the' },
        { note: 'first three stages of the quest and nowhere else.' },
        { talk: 'agrith_reen_alkharid', picks: ['What cult?'], want: 'man in a cellar', why: 'he sets the quest' },
        { stage: 10 },

        { note: 'wiki step 6: Evil Dave, in his mother’s cellar under Edgeville. agrith_dave is in' },
        { note: 'the cache and spawned nowhere, so Recipe for Disaster’s Dave hands the conversation' },
        { note: 'over - he is the same man in the same cellar.' },
        { setpos: DAVE_CELLAR, why: 'north to Edgeville and down' },
        { talk: 'hundred_evil_dave', want: 'Everything black', why: 'he explains the dress code' },
        { stage: 30 },

        { note: 'wiki step 4: "Use a black mushroom or black dye on Silverlight to dye it black."' },
        { note: 'Desert shirt and robe the same, and mushroom ink is the only thing that takes.' },
        { use: ['golem_ink', 'desert_shirt'], why: 'the shirt' },
        { use: ['golem_ink', 'desert_robe'], why: 'the robe' },
        { use: ['golem_ink', 'silverlight'], why: 'and the sword - the mesbox for this one is not captured, so the obj below is the check' },
        { has: 'agrith_silverlight_dyed' },
        { stage: 40 },

        { note: 'wiki step 8: the sigil mould. The clay golem at Uzer has the cult’s moulds in its' },
        { note: 'kilns, and it is louder about it than Jennifer ever was.' },
        { setpos: GOLEM, why: 'to the ruins of Uzer' },
        { talk: 'golem_golem', want: 'MOULDS', why: 'the mould' },
        { stage: 50 },
        { has: 'agrith_sigil_mould' },

        { note: 'wiki step 10: "use a silver bar on any furnace and select demonic sigil" - here it' },
        { note: 'is the one kiln of the four that still works, and 30 Crafting, which was not asked' },
        { note: 'for before.' },
        { setpos: [3467, 3124, 0], why: 'north-west to the working kiln' },
        { use: ['agrith_sigil_mould', 'silver_bar'], want: 'melt a silver bar', why: 'cast the sigil' },
        { stage: 60 },

        { note: 'and the kiln only carries Look-in at this one stage, which is how the sigil comes' },
        { note: 'out of it - with the cult’s tome under the ash behind it' },
        { loc: 'agrith_kiln_1', at: KILN, want: 'demonic sigil', why: 'take the sigil' },
        { has: 'agrith_sigil' },
        { has: 'agrith_book' },
        { stage: 70 },

        { note: 'wiki step 14: "Write down the incantation, as it is used twice." Five words,' },
        { note: 'shortest first, and where two are of a length the lower-numbered one first - which' },
        { note: 'makes it Tar, Naar, Rekt, Agrith, Secare.' },
        { held: 'agrith_book', want: 'SHORTEST FIRST', why: 'read the tome' },

        { note: 'wiki step 15: the chant. Denath gets to the fourth word and puts Rekt before Naar,' },
        { note: 'and the ceiling of a building that has not had one in four hundred years falls on' },
        { note: 'Eric.' },
        { setpos: [3475, 3100, 0], why: 'to the circle' },
        { held: 'agrith_sigil', picks: ['Tar', 'Naar', 'Rekt', 'Agrith', 'Secare'], want: 'blood of Agrith-Naar', why: 'the summoning and the demon' },
        { stage: 120 },
        { has: 'darklight' },
        { hasnt: 'agrith_silverlight_dyed' },

        { note: 'wiki step 27: "Choose your reward to finish the quest" - ten thousand experience in' },
        { note: 'a combat skill, which the quest used to pay as two thousand Crafting and one' },
        { note: 'thousand Magic instead.' },
        { setpos: UZER_PRIESTS, why: 'back to the priests' },
        { talk: 'agrith_reen_uzer', picks: ['Melee.', 'Strength.'], want: 'keep working', why: 'the reward' },
        { stage: 125 }
    ]
};

const p: any = H.makePlayer('agrithrun', m.start[0], m.start[1]);
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
