// BIOHAZARD, played through on foot.
//
// Quest 71 of the quest-by-quest pass. Elena's distillator is in the mourners' quarters, and the
// only way in is over a watchtower whose guards are watching - so you feed Jerico's pigeons onto
// the tower, let them go, and climb while everybody is looking at the birds.
//
//   NODE_MEMBERS=true npx tsx tools/sim/quest_biohazard_run.ts
import * as H from './harness.js';
import { play, Manifest } from './questrun.js';

await H.boot();

const ELENA: [number, number, number] = [2592, 3337, 0];
const JERICO: [number, number, number] = [2612, 3325, 0];
const JERICO_CUPBOARD: [number, number] = [2611, 3326];
const WATCHTOWER: [number, number] = [2560, 3301];
const STEW: [number, number] = [2543, 3332];
const HOSPITAL_CUPBOARD: [number, number] = [2517, 3276];
const CHEMIST: [number, number, number] = [2934, 3211, 0];
const HOPS: [number, number, number] = [2930, 3219, 0];
const GUIDOR_DOOR: [number, number] = [3282, 3382];
const GUIDOR: [number, number, number] = [3285, 3382, 0];

const m: Manifest = {
    quest: 'BIOHAZARD',
    source: 'oldschool.runescape.wiki/w/Biohazard',
    stageVar: 'biohazard',
    done: 2, // WIP: see the notes at the end
    start: ELENA,
    steps: [
        { note: 'requirements: Plague City. Items: rotten apples for the mourners\' stew, and a' },
        { note: "priest's gown and robe to get past Guidor's wife." },
        { setvar: 'elenaquest', to: 29, why: '^elena_complete - Plague City' },
        { setpos: ELENA, why: 'to Elena in West Ardougne' },

        { note: 'wiki step 1: the mourners took her distillator' },
        { talk: 'elena2', picks: ["I'll try to retrieve it for you."], want: 'distillator', why: 'she wants it back' },
        { stage: 1 },

        { note: 'wiki step 2: Jerico keeps pigeons, and the mourners watch the tower' },
        { setpos: JERICO, why: 'to Jerico' },
        { talk: 'jerico', want: 'cross the wall', why: 'Elena has told him you are coming' },
        { stage: 2 },
        {
            talk: 'jerico',
            picks: ['Maybe I could use your messenger pigeons to distract them?'],
            want: 'around the back of my house',
            why: 'and the pigeons are his idea of a distraction'
        },
        { note: 'the jump lands south of the cupboard, which is as close as it needs to be' },
        { loc: 'jericoscupboardshut', at: JERICO_CUPBOARD, soft: true, why: 'open it' },
        { loc: 'jericoscupboardopen', at: JERICO_CUPBOARD, want: 'birdfeed', why: 'and take the birdfeed' },
        { has: 'birdfeed' },

        { note: 'WIP FROM HERE. What is left, in order:' },
        { note: '  - the pigeons are in a cage behind Jerico\'s house; take them' },
        { note: '  - throw the birdfeed on the watchtower (loc_2067, 2559-2560 x 3301 - the use-on' },
        { note: '    above found nothing, so the stand tile wants checking with reachsides)' },
        { note: '  - release the pigeons ([opheld1,pigeons]) -> stage 4' },
        { note: '  - climb the mourner HQ (mournerquaters_gate at 2551,3326 L1, mournercrateup at' },
        { note: '    2554,3327 L1) -> stage 5' },
        { note: '  - rotten apples in the stew (loc_2043 at 2543,3332) -> stage 6' },
        { note: "  - the doctor's gown from the hospital cupboard (2517,3276)" },
        { note: '  - find the distillator -> 7, give it to Elena -> 10' },
        { note: '  - the chemist in Rimmington (2934,3210) -> 12, then one of Hops (2930,3218),' },
        { note: '    Chancy (2929,3222) or Da Vinci (2927,3218) to carry the sample' },
        { note: "  - Guidor in Varrock (3285,3381) behind guidordoor at 3282,3382, in a priest's" },
        { note: '    gown and robe -> 14, and back to Elena -> 15' }
    ]
};

const p: any = H.makePlayer('biorun', m.start[0], m.start[1]);
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
