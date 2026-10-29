// ROVING ELVES, played through on foot.
//
// Quest 36 of the quest-by-quest pass. Islwyn will not speak to a human until he hears that one of
// them put his grandmother's ashes in the chalice at the waterfall; then he asks for her first
// grave to be consecrated. The seed for the rite is in that first grave - which is Glarial's tomb,
// which turns away anybody carrying a weapon or armour - and three moss giants have moved in since.
//
//   npx tsx tools/sim/quest_roving_run.ts
import * as H from './harness.js';
import { play, Manifest } from './questrun.js';

await H.boot();

const ISLWYN: [number, number, number] = [2294, 3145, 0];
const CHALICE: [number, number] = [2603, 9910];

const m: Manifest = {
    quest: 'ROVING ELVES',
    source: 'oldschool.runescape.wiki/w/Roving_Elves',
    stageVar: 'roving_elves_quest',
    done: 10,   // ^roving_elves_complete
    start: [2294, 3145, 0],
    steps: [
        { note: 'requirements: Regicide and Waterfall Quest, both finished. Waterfall is walked in' },
        { note: 'full by quest_waterfall_run.ts; both are declared here.' },
        { setvar: 'regicide_quest', to: 15, why: '^regicide_complete' },
        { setvar: 'waterfall_quest', to: 10, why: '^waterfall_complete' },
        { note: 'the pebble is kept from Waterfall Quest - the tombstone needs it every time - and a' },
        { note: 'spade to plant the seed. No weapon and no armour: the tomb bans both, which is why' },
        { note: 'the moss giants inside it get fought bare-handed.' },
        { give: 'glarials_pebble_waterfall_quest' },
        { give: 'spade' },

        { note: 'wiki step 1: Islwyn, at his campfire in Isafdar' },
        { talk: 'roving_islwyn', want: 'Speak to Eluned', why: 'Glarial was his grandmother' },
        { stage: 1 },

        { note: 'wiki step 2: Eluned, beside him, knows the rite and what it needs' },
        { talk: 'roving_female_woodelf', want: 'consecration seed', why: 'she names the seed' },
        { stage: 2 },

        { note: 'wiki step 3: Glarial’s tomb, and the three moss giants in it' },
        { setpos: [2559, 3444, 0], why: 'east to the tombstone' },
        { useLoc: 'glarials_tombstone_waterfall_quest', at: [2558, 3444], obj: 'glarials_pebble_waterfall_quest', want: 'stone slab slides back', why: 'the pebble again' },
        { setpos: [2530, 9845, 0], why: 'along the tomb to the chest' },
        { fight: 'roving_mossgiant', r: 16, tries: 3, why: 'bare-handed, because the tomb allows no weapon' },
        { loc: 'glarials_chest_closed_waterfall_quest', at: [2530, 9844], why: 'open the chest' },
        { loc: 'glarials_chest_open_waterfall_quest', at: [2530, 9844], why: 'and search it' },
        { has: 'roving_old_consecration_seed' },
        { stage: 3 },

        { note: 'wiki step 4: back to Eluned, who wakes the seed' },
        { setpos: [2290, 3145, 0], why: 'back west to Isafdar' },
        { talk: 'roving_female_woodelf', want: 'it is warm', why: 'she enchants it' },
        { stage: 4 },
        { has: 'roving_new_consecration_seed' },

        { note: 'wiki step 5: plant it beside the chalice at the bottom of the waterfall, where' },
        { note: 'Glarial lies now. Anywhere else and nothing happens.' },
        { setpos: [2603, 9911, 0], why: 'to the chalice' },
        { held: 'roving_new_consecration_seed', want: 'tree of crystal', why: 'plant it' },
        { stage: 5 },
        { hasnt: 'roving_new_consecration_seed' },

        { note: 'wiki step 6: tell Islwyn, and take the bow' },
        { setpos: ISLWYN, why: 'back to the campfire' },
        { talk: 'roving_islwyn', picks: ['A crystal bow, please.'], want: 'rather it went to you', why: 'the reward' },
        { wait: 4, why: 'the award is queued' },
        { stage: 10 },
        { has: 'roving_crystal_bow_new' }
    ]
};

const p: any = H.makePlayer('rovingrun', m.start[0], m.start[1]);
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
