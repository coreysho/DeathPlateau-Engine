// IMP CATCHER, played through on foot.
//
// Quest 4 of the full quest-by-quest pass. The four beads drop from imps at 5/128 each, which is a
// drop table rather than this quest, so they are handed over declared - everything else is walked.
//
//   npx tsx tools/sim/quest_imp_run.ts
import * as H from './harness.js';
import { play, Manifest } from './questrun.js';

await H.boot();

const m: Manifest = {
    quest: 'IMP CATCHER',
    source: 'oldschool.runescape.wiki/w/Imp_Catcher',
    stageVar: 'imp',
    done: 2,
    start: [3104, 3162, 2],
    steps: [
        { give: 'black_bead' },
        { give: 'white_bead' },
        { give: 'yellow_bead' },
        { give: 'red_bead' },

        { note: 'wiki: Wizard Mizgog, top floor of the Wizards Tower. He takes all four at once and' },
        { note: 'will not accept them one at a time.' },
        { talk: 'wizard_mizgog', picks: [1, 1], why: 'Give me a quest, then ask properly' },
        { stage: 1 },

        { note: 'wiki: and back with the lot - 875 Magic and the amulet of accuracy' },
        { talk: 'wizard_mizgog', why: "I've got all four beads - he takes them with no menu" },
        { stage: 2 },
        { has: 'amulet_of_accuracy' },
        { hasnt: 'black_bead' },
        { hasnt: 'red_bead' }
    ]
};

const p: any = H.makePlayer('imprun', m.start[0], m.start[1]);
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
