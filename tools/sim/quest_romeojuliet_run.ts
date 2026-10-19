// ROMEO & JULIET, played through on foot.
//
// Quest 8 of the full quest-by-quest pass. Romeo in Varrock Square, Juliet on the balcony of the
// Leptoc mansion outside the west wall, Father Lawrence in the church, the Apothecary in the
// south-west, the cadava bushes by the south-east mine, and back round the lot of them. The
// overland legs are declared with setpos; every door and staircase between a street and an npc is
// clicked, which for Juliet is three doors and a flight of stairs.
//
//   npx tsx tools/sim/quest_romeojuliet_run.ts
import * as H from './harness.js';
import { play, Manifest } from './questrun.js';

await H.boot();

// Up to Juliet's balcony, which is done twice: in through the mansion's south door, up the stairs,
// through the diagonal door off the landing and then the balcony door.
const toJuliet = (): any[] => [
    { setpos: [3160, 3431, 0], why: 'the road out of the west gate to the Leptoc mansion' },
    { loc: 'loc_1533', at: [3160, 3432], why: "the mansion's front door", soft: true },
    { go: [3157, 3434], why: 'across the hall to the stairs' },
    { loc: 'stairs', at: [3156, 3435], why: 'up to the first floor' },
    { go: [3157, 3431, 1], why: 'south along the landing' },
    { loc: 'loc_1533', at: [3158, 3431], why: 'the diagonal door off the landing', soft: true },
    { go: [3158, 3428, 1], why: 'round to the balcony door' },
    { loc: 'loc_1533', at: [3158, 3427], why: 'the balcony door', soft: true }
];

const m: Manifest = {
    quest: 'ROMEO & JULIET',
    source: 'oldschool.runescape.wiki/w/Romeo_%26_Juliet',
    stageVar: 'rjquest',
    done: 100,   // ^romeojuliet_complete
    start: [3210, 3428, 0],
    steps: [
        { note: 'wiki: no requirements. The cadava berries are picked during the quest.' },

        { note: 'wiki step 1: Romeo, in Varrock Square' },
        { talk: 'romeo', picks: ['Can I help find her'], why: 'he asks you to find Juliet - offering to look goes straight to the yes' },
        { stage: 10 },

        { note: 'wiki step 2: Juliet, upstairs in the mansion west of the west bank' },
        ...toJuliet(),
        { talk: 'juliet_multi_visible', why: 'she writes a message for Romeo' },
        { stage: 20 },
        { has: 'julietmessage' },

        { note: 'wiki step 2: the message back to Romeo' },
        { setpos: [3210, 3428, 0], why: 'back east through the gate to the square' },
        { talk: 'romeo', why: 'he reads it and sends you to Father Lawrence' },
        { stage: 30 },
        { hasnt: 'julietmessage' },

        { note: 'wiki step 3: Father Lawrence, in Varrock church' },
        { setpos: [3254, 3485, 0], why: 'north-east across the city to the church' },
        { talk: 'father_lawrence', why: 'his plan is a potion that makes Juliet appear dead' },
        { stage: 40 },

        { note: 'wiki step 4: the Apothecary, south-west of the square' },
        { setpos: [3197, 3403, 0], why: 'back down through the city' },
        { talk: 'apothecary', why: 'he needs cadava berries before he can mix it' },
        { stage: 50 },

        { note: 'wiki step 5: the cadava bushes, by the south-east Varrock mine. Both of them had' },
        { note: 'no option on them at all until this run; the berries were imp-drop only.' },
        { setpos: [3273, 3375, 0], why: 'out of the south-east gate to the mine' },
        { loc: 'cadava_bush', at: [3272, 3375], op: 3, want: 'pick some berries', why: 'Pick-from' },
        { has: 'cadavaberries' },

        { note: 'wiki step 5: the berries back to the Apothecary' },
        { setpos: [3197, 3403, 0], why: 'back west across the city' },
        { talk: 'apothecary', why: 'he shakes them up into the Cadava potion' },
        { hasnt: 'cadavaberries' },
        { has: 'cadava' },

        { note: 'wiki step 6: the potion to Juliet' },
        ...toJuliet(),
        { talk: 'juliet_multi_visible', why: 'she drinks it and plays dead' },
        { stage: 60 },
        { hasnt: 'cadava' },

        { note: 'wiki step 7: and Romeo is told. In 2006 that is where it ends - he goes off to the' },
        { note: 'crypt on his own, and Juliet afterwards says he never turned up. Walking him there' },
        { note: 'to meet Phillipa is the much later Old School rework.' },
        { setpos: [3210, 3428, 0], why: 'back to the square one last time' },
        { talk: 'romeo', why: 'and that completes it' },
        { stage: 100 }
    ]
};

const p: any = H.makePlayer('rjrun', m.start[0], m.start[1]);
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
