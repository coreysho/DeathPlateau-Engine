// PRIEST IN PERIL, played through on foot.
//
// Quest 34 of the quest-by-quest pass, and the gateway to Morytania. King Roald sends you to check
// on Drezel; the Zamorakians squatting in his temple trick you into killing the guard dog that was
// holding the border, and the rest of the quest is putting that right: free Drezel from the cell
// upstairs with a key hidden in one of seven monuments, trap the vampire in his coffin with blessed
// water, and carry fifty rune essences down to the well so the Salve can be blessed again.
//
//   npx tsx tools/sim/quest_priestperil_run.ts
import * as H from './harness.js';
import { play, Manifest, Step } from './questrun.js';

await H.boot();

const ROALD: [number, number, number] = [3222, 3473, 0];
const DOORS: [number, number] = [3408, 3489];
const CELLDOOR: [number, number] = [3415, 3489];
const COFFIN: [number, number] = [3413, 3486];
const WELL: [number, number] = [3423, 9890];

// the seven monuments. One of them holds the iron key, and which one is seeded per player, so the
// run tries the golden key on every one of them.
const GRAVES: [string, [number, number]][] = [
    ['priestperil_grave_base1', [3416, 9890]],
    ['priestperil_grave_base2', [3423, 9895]],
    ['priestperil_grave_base3', [3428, 9890]],
    ['priestperil_grave_base4', [3423, 9884]],
    ['priestperil_grave_base5', [3427, 9894]],
    ['priestperil_grave_base6', [3427, 9885]],
    ['priestperil_grave_base7', [3418, 9894]]
];

const m: Manifest = {
    quest: 'PRIEST IN PERIL',
    source: 'oldschool.runescape.wiki/w/Priest_in_Peril',
    stageVar: 'priestperil',
    done: 60,   // ^priestperil_complete
    start: [3222, 3473, 0],
    steps: [
        { note: 'a bucket for the well water and a weapon. The fifty rune essences come later and' },
        { note: 'in two loads - essences do not stack, so twenty-eight slots will not hold fifty,' },
        { note: 'which is why the wiki tells you to expect more than one trip.' },
        { give: 'bucket_empty' },
        { give: 'rune_scimitar' },
        { held: 'rune_scimitar', op: 2, why: 'wield it' },

        { note: 'wiki step 1: King Roald, in Varrock palace' },
        { talk: 'king_roald', picks: ['Sure.'], want: 'Many thanks', why: 'he sends you to the temple' },
        { stage: 1 },

        { note: 'wiki step 2: knock at the temple doors. Whoever is inside is not Drezel, cannot' },
        { note: 'remember the name he has just made up, and wants the guard dog killed.' },
        { setpos: [3409, 3489, 0], why: 'east to the temple on the Salve' },
        { loc: 'priestperiltempledoorl', at: DOORS, op: 2, picks: ['Roald sent me to check on Drezel', 'Sure.'], want: 'one dead dog', why: 'knock' },
        { stage: 2 },

        { note: 'wiki step 3: the mausoleum trapdoor is east of the temple, and the dog is at the' },
        { note: 'far west end of the passages below it' },
        { setpos: [3422, 3486, 0], why: 'round to the trapdoor' },
        { loc: 'pipeastsidetrapdoor', at: [3422, 3485], want: 'trapdoor opens', why: 'open it' },
        { loc: 'pipeastsidetrapdoor_open', at: [3422, 3485], want: 'climb down', why: 'down' },
        { setpos: [3405, 9901, 0], why: 'west through the passages to the dog' },
        { fight: 'priestperilguarddog', untilvar: 'priestperil', to: 3, tries: 3, why: 'the dog the king was relying on' },
        { stage: 3 },

        { note: 'wiki step 4: tell the king, who explains what you have just done' },
        { setpos: ROALD, why: 'back to Varrock' },
        { talk: 'king_roald', want: 'beheaded for high treason', why: 'he is not pleased' },
        { stage: 4 },

        { note: 'wiki step 5: the temple doors open now. Drezel is in the cell on the top floor,' },
        { note: 'two staircases up.' },
        { setpos: [3409, 3489, 0], why: 'back to the temple' },
        { loc: 'priestperiltempledoorl', at: DOORS, why: 'in through the doors' },
        { setpos: [3416, 3488, 2], why: 'up both staircases to the cell' },
        { loc: 'pip_prisondoor', at: CELLDOOR, op: 2, picks: ['Tell me anyway', 'Yes.'], want: 'find the key', why: 'talk to him through the door' },
        { stage: 5 },

        { note: 'wiki step 6: one of the Zamorakian monks downstairs has the golden key' },
        { setpos: [3410, 3489, 0], why: 'back down to the monks' },
        { fight: 'priestperilevilmonk3', until: 'pipkey_gold', tries: 6, why: 'he drops the golden key' },
        { take: 'pipkey_gold', r: 10, why: 'off the floor' },
        { has: 'pipkey_gold' },

        { note: 'wiki step 7: the golden key swaps for the iron one in whichever monument holds it.' },
        { note: 'Which monument that is is seeded per player, so every one gets tried.' },
        { setpos: [3422, 9890, 0], why: 'down to the monuments' }
    ]
};

for (const [name, at] of GRAVES) {
    m.steps.push({ useLoc: name, at, obj: 'pipkey_gold', soft: true, why: 'try the golden key' } as Step);
}

m.steps.push(
    { has: 'pipkey_iron' },

    { note: 'wiki step 8: the iron key opens the cell' },
    { setpos: [3416, 3488, 2], why: 'back up to the cell' },
    { useLoc: 'pip_prisondoor', at: CELLDOOR, obj: 'pipkey_iron', want: 'unlock the cell door', why: 'unlock it' },
    { stage: 6 },

    { note: 'wiki step 9: a bucket of water from the well below, blessed by Drezel, poured over' },
    { note: 'the vampire’s coffin' },
    { setpos: [3423, 9891, 0], why: 'down to the well' },
    { useLoc: 'priestperil_well', at: WELL, obj: 'bucket_empty', want: 'fill the bucket', why: 'fill it' },
    { has: 'bucket_murkywater' },
    { setpos: [3416, 3487, 2], why: 'back up to Drezel' },
    { useNpc: 'priestperiltrappedmonk', obj: 'bucket_murkywater', want: 'bless', why: 'he blesses it' },
    { has: 'bucket_blessedwater' },
    { note: 'the coffin is not in the cell with Drezel - it is in the corridor outside it, so the' },
    { note: 'now-unlocked cell door has to be opened to get at it' },
    { loc: 'pip_prisondoor', at: CELLDOOR, why: 'out of the cell block' },
    { loc: 'pip_prisondoor', at: CELLDOOR, soft: true, why: 'and through - the shared door proc takes two clicks' },
    { setpos: [3414, 3487, 2], why: 'out past the gate, which shuts itself behind you' },
    { useLoc: 'priestperil_coffin_noanim', at: COFFIN, obj: 'bucket_blessedwater', want: 'coffin', why: 'douse it' },
    { stage: 7 },

    { note: 'wiki step 10: tell Drezel he is free, and he goes down to the monuments' },
    { setpos: [3416, 3489, 2], why: 'back through the gate to him' },
    { talk: 'priestperiltrappedmonk', tries: 2, want: 'free at last', why: 'he leaves the cell' },
    { stage: 8 },

    { note: 'wiki step 11: and the repair - fifty rune essences for the blessing of the Salve' },
    { setpos: [3439, 9894, 0], why: 'down and east to the monument' },
    { talk: 'priestperiltrappedmonk2', want: 'around fifty should be sufficient', why: 'he explains the damage and asks for essences' },
    { stage: 10 },
    { give: 'blankrune', n: 25 },
    { useNpc: 'priestperiltrappedmonk2', obj: 'blankrune', want: 'blank runes', why: 'the first load of twenty-five' },
    { varis: 'priestperil', to: 35 },
    { give: 'blankrune', n: 25 },
    { useNpc: 'priestperiltrappedmonk2', obj: 'blankrune', want: 'blank runes', why: 'and the second' },
    { stage: 60 },
    { has: 'dagger_wolfbane' },

    { note: 'and afterwards he explains the barrier, which is the route into Morytania' },
    { talk: 'priestperiltrappedmonk2', want: 'Wolfbane', why: 'the warning about werewolves' },
    { varis: 'priestperil', to: 61 },
    { loc: 'pip_underground_wall_side_withportal', at: [3440, 9886], want: 'pass through the holy barrier', why: 'through it' }
);

const p: any = H.makePlayer('pipperilrun', m.start[0], m.start[1]);
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
