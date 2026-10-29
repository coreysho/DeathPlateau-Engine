// DEVIOUS MINDS, played through on foot.
//
// Quest 44 of the quest-by-quest pass. A hooded monk by the Paterdomus temple pays you to get a
// blade onto Entrana, which is the one island that searches everybody at the dock. The answer is to
// grind a two-hander down on Doric's wheel until it is nothing but edge, work it into a bow stave,
// and carry the result in an essence pouch, because nobody has ever searched one of those.
//
//   npx tsx tools/sim/quest_devious_run.ts
import * as H from './harness.js';
import { play, Manifest } from './questrun.js';

await H.boot();

const MONK: [number, number, number] = [3406, 3495, 0];
const WHETSTONE: [number, number] = [2953, 3451];
const ALTAR: [number, number] = [2853, 3348];

const m: Manifest = {
    quest: 'DEVIOUS MINDS',
    source: 'oldschool.runescape.wiki/w/Devious_Minds',
    stageVar: 'devious_main',
    done: 70,   // ^devious_complete
    start: [3406, 3495, 0],
    steps: [
        { note: 'the wiki lists Wanted!, Troll Stronghold and Doric’s Quest as requirements; the' },
        { note: 'monk here checks none of them, so the two that have varps are declared and the' },
        { note: 'gate itself is noted as missing rather than worked around.' },
        { setvar: 'wanted_main', to: 50, why: '^wanted_complete' },
        { setvar: 'doricquest', to: 100, why: '^doric_complete' },

        { note: 'a steel two-hander to ruin, and a shortbow to hide what is left of it in' },
        { give: 'steel_2h_sword' },
        { give: 'shortbow' },

        { note: 'wiki step 1: the hooded monk outside Paterdomus' },
        { talk: 'devious_monk_hooded', picks: ['Depends what it pays', "Fine. I'll do it"], want: 'essence pouch', why: 'he hires you' },
        { stage: 10 },
        { has: 'devious_glowingpouch' },

        { note: 'wiki step 2: Doric’s whetstone, which takes the sword down to a slender blade' },
        { setpos: [2952, 3451, 0], why: 'west to Doric’s hut' },
        { useLoc: 'devious_whetstone', at: WHETSTONE, obj: 'steel_2h_sword', want: 'grind the sword down', why: 'grind it down' },
        { stage: 20 },
        { has: 'devious_slenderblade' },

        { note: 'wiki step 3: the blade into the bow stave, and the bow into the pouch' },
        { use: ['devious_slenderblade', 'shortbow'], want: 'unstrung bow', why: 'hide the blade in the stave' },
        { has: 'devious_bowsword' },
        { use: ['devious_bowsword', 'devious_glowingpouch'], why: 'and the bow in the pouch' },
        { stage: 30 },
        { hasnt: 'devious_bowsword' },

        { note: 'wiki step 4: behind the altar in the Entrana church, and walk away' },
        { setpos: [2853, 3349, 0], why: 'the monks’ ship to Entrana - and nobody searches a pouch' },
        { loc: 'devious_altar', at: ALTAR, why: 'leave it behind the altar' },
        { stage: 40 },
        { hasnt: 'devious_glowingpouch' },

        { note: 'wiki step 5: tell the monk it is done, which is the last thing anybody tells him' },
        { setpos: MONK, why: 'back to Paterdomus' },
        { talk: 'devious_monk_hooded', want: 'not standing any more', why: 'somebody else was waiting for the blade' },
        { varis: 'devious_monk', to: 1 },

        { note: 'wiki step 6: search what is left of him. The map places the body one tile west of' },
        { note: 'where he stood, and both shells read the same varbit, so nothing had to be spawned.' },
        { talk: 'devious_monk_dead', want: 'piece of the relic', why: 'search him' },
        { stage: 50 },
        { has: 'devious_relic_fragment_saradomin' },
        { has: 'devious_glowingorb' },

        { note: 'wiki step 7: and the high priest of Entrana, with what was left in his hand' },
        { setpos: [2851, 3350, 0], why: 'back to Entrana' },
        { talk: 'high_priest_of_entrana', want: 'you did what', why: 'own up to it' },
        { wait: 4, why: 'the completion is queued' },
        { stage: 70 }
    ]
};

const p: any = H.makePlayer('deviousrun', m.start[0], m.start[1]);
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
