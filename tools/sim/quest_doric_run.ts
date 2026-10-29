// DORIC'S QUEST, played through on foot.
//
// Quest 3 of the full quest-by-quest pass.
//
//   npx tsx tools/sim/quest_doric_run.ts
import * as H from './harness.js';
import { play, Manifest } from './questrun.js';

await H.boot();

const m: Manifest = {
    quest: "DORIC'S QUEST",
    source: 'oldschool.runescape.wiki/w/Doric%27s_Quest',
    stageVar: 'doricquest',
    done: 100,   // ^doric_complete
    start: [2952, 3451, 0],
    steps: [
        { note: 'wiki: 6 clay, 4 copper ore and 2 iron ore, all at once. Mining them is the Dwarven Mine' },
        { note: 'and Rimmington rather than this quest, so they are handed over declared.' },
        { give: 'clay', n: 6 },
        { give: 'copper_ore', n: 4 },
        { give: 'iron_ore', n: 2 },

        { note: 'wiki step 1: Doric, at the crossroads north of Falador' },
        { talk: 'doric', picks: [1, 1], why: 'I wanted to use your anvils, and yes I will fetch them' },
        { stage: 10 },

        { note: 'wiki step 2: back with the lot' },
        { talk: 'doric', why: 'I have everything you need' },
        { stage: 100 },
        { hasnt: 'clay' },
        { hasnt: 'copper_ore' },
        { hasnt: 'iron_ore' },
        { has: 'coins', n: 180 },

        { note: 'wiki: and the anvils, which he refuses before the quest is done' },
        { give: 'bronze_bar' },
        { useLoc: 'doric_anvil', at: [2950, 3451], obj: 'bronze_bar', why: 'his anvil, now that he allows it' }
    ]
};

const p: any = H.makePlayer('doricrun', m.start[0], m.start[1]);
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
