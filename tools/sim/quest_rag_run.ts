// RAG AND BONE MAN, played through on foot.
//
// Quest 30 of the quest-by-quest pass. The Odd Old Man wants five bones for his collection, each
// off a different beast, each boiled clean in vinegar. The bones are a one-in-four drop, so every
// one of the five legs is "kill them until one leaves a bone" rather than one kill - which is what
// the fight step's `until` is for.
//
//   npx tsx tools/sim/quest_rag_run.ts
import * as H from './harness.js';
import { play, Manifest, Step } from './questrun.js';

await H.boot();

const OLDMAN: [number, number, number] = [3359, 3506, 0];
const FIRE: [number, number] = [3360, 3507];   // clear ground beside the bone pile - the pile itself blocks

// beast, a tile beside a cluster of them, the bone it drops, the pot it steeps in, the clean bone
const BEASTS: [string, [number, number], string, string, string][] = [
    ['goblin', [2460, 3182], 'rag_goblin_bone', 'rag_pot_goblin_bone', 'rag_polished_goblin_bone'],
    ['brownbear', [2693, 3340], 'rag_bear_bone', 'rag_pot_bear_bone', 'rag_polished_bear_bone'],
    ['ramunsheered', [3195, 3272], 'rag_ram_bone', 'rag_pot_ram_bone', 'rag_polished_ram_bone'],
    ['unicorn', [3280, 3355], 'rag_unicorn_bone', 'rag_pot_unicorn_bone', 'rag_polished_unicorn_bone'],
    ['giantrat', [2971, 3693], 'rag_giant_rat_bone', 'rag_pot_giant_rat_bone', 'rag_polished_giant_rat_bone']
];

const m: Manifest = {
    quest: 'RAG AND BONE MAN',
    source: 'oldschool.runescape.wiki/w/Rag_and_Bone_Man',
    stageVar: 'rag_quest',
    done: 2,   // ^rag_complete
    start: [3359, 3507, 0],
    steps: [
        { note: 'five pots and five jugs of vinegar - Fortunato’s stall in Draynor sells the' },
        { note: 'vinegar, and each bone uses up a pot of it. A weapon, and a log and tinderbox for' },
        { note: 'the fire to boil them over.' },
        { give: 'rag_vinegar', n: 5 },
        { give: 'pot_empty', n: 5 },
        { give: 'logs' },
        { give: 'tinderbox' },
        { give: 'rune_scimitar' },
        { held: 'rune_scimitar', op: 2, why: 'wield it - five beasts to get through' },

        { note: 'wiki step 1: the Odd Old Man, by his bone pile north-east of Varrock' },
        { talk: 'rag_odd_old_man', picks: ['What are all those bones for', 'I could collect them for you'], want: 'goblin skull', why: 'he lists the five' },
        { stage: 1 }
    ]
};

// the five legs: kill until one drops the bone, then pick it up
for (const [npc, at, bone] of BEASTS) {
    m.steps.push(
        { setpos: [at[0], at[1], at[1] > 9000 ? 0 : 0], why: 'to the ' + npc + 's' } as Step,
        { fight: npc, until: bone, tries: 30, why: 'one in four of them leaves a bone' } as Step,
        { take: bone, r: 14, why: 'off the floor' } as Step,
        { has: bone } as Step
    );
}

m.steps.push(
    { note: 'wiki step 3: back to the bone pile, and a fire to boil them over. Each bone goes' },
    { note: 'into a pot of vinegar of its own and then onto the fire.' },
    { setpos: [FIRE[0], FIRE[1], 0], why: 'back to the Odd Old Man' },
    { use: ['tinderbox', 'logs'], why: 'light a fire' },
    { wait: 12, why: 'lighting a fire takes a few attempts' }
);

for (const [, , bone, pot, clean] of BEASTS) {
    m.steps.push(
        { use: ['rag_vinegar', 'pot_empty'], want: 'pour the vinegar into the pot', why: 'a pot of vinegar' } as Step,
        { use: [bone, 'rag_pot_vinegar'], want: 'needs boiling', why: 'steep the ' + bone } as Step,
        { useLoc: 'fire', at: FIRE, obj: pot, want: 'up clean', why: 'boil it' } as Step,
        { has: clean } as Step
    );
}

m.steps.push(
    { note: 'wiki step 4: all five, polished, back to the old man' },
    { go: [OLDMAN[0], OLDMAN[1]], why: 'round to him' },
    { talk: 'rag_odd_old_man', want: 'All five', why: 'hand them over' },
    { wait: 4, why: 'the completion is queued' },
    { stage: 2 },
    { hasnt: 'rag_polished_goblin_bone' }
);

const p: any = H.makePlayer('ragrun', m.start[0], m.start[1]);
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
