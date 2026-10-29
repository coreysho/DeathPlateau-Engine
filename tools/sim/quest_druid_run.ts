// DRUIDIC RITUAL, played through on foot.
//
// Quest 22 of the full quest-by-quest pass. Kaqemeex at the Taverley stone circle, Sanfew upstairs
// in the village, four raw meats dipped one at a time in the Cauldron of Thunder down in the
// Taverley dungeon, and back to Sanfew. The four meats are declared - they are four different
// animals, which is four other fights.
//
//   npx tsx tools/sim/quest_druid_run.ts
import * as H from './harness.js';
import { play, Manifest } from './questrun.js';

await H.boot();

const CAULDRON: [number, number] = [2893, 9831];

const m: Manifest = {
    quest: 'DRUIDIC RITUAL',
    source: 'oldschool.runescape.wiki/w/Druidic_Ritual',
    stageVar: 'druidquest',
    done: 4,   // ^druid_complete
    start: [2923, 3489, 0],
    steps: [
        { note: 'wiki: raw beef, raw rat meat, raw bear meat and raw chicken' },
        { give: 'raw_beef' },
        { give: 'raw_rat_meat' },
        { give: 'raw_bear_meat' },
        { give: 'raw_chicken' },

        { note: 'wiki step 1: Kaqemeex, at the stone circle north of Taverley' },
        { talk: 'kaqemeex', picks: ['Something else', 'in search of a quest', 'I will try and help'], why: 'the Varrock circle needs purifying' },
        { stage: 1 },

        { note: 'wiki step 2: Sanfew, upstairs in Taverley, who needs four enchanted meats' },
        { setpos: [2899, 3427, 1], why: 'south into the village and up the ladder' },
        { talk: 'sanfew', picks: ['purify the Varrock stone circle', "Ok, I'll do that then"], why: 'four meats, each dipped on its own' },
        { stage: 2 },

        { note: 'wiki step 3: the Cauldron of Thunder, in the Taverley dungeon' },
        { setpos: [2894, 9831, 0], why: 'down the ladder in the woods and through the dungeon' },
        { useLoc: 'cauldron_of_thunder', at: CAULDRON, obj: 'raw_beef', want: 'dip the raw beef', why: 'the beef' },
        { useLoc: 'cauldron_of_thunder', at: CAULDRON, obj: 'raw_rat_meat', want: 'dip the raw rat meat', why: 'the rat' },
        { useLoc: 'cauldron_of_thunder', at: CAULDRON, obj: 'raw_bear_meat', want: 'dip the raw bear meat', why: 'the bear' },
        { useLoc: 'cauldron_of_thunder', at: CAULDRON, obj: 'raw_chicken', want: 'dip the raw chicken', why: 'and the chicken' },
        { has: 'enchanted_beef' },
        { has: 'enchanted_rat_meat' },
        { has: 'enchanted_bear_meat' },
        { has: 'enchanted_chicken' },

        { note: 'wiki step 4: all four back to Sanfew' },
        { setpos: [2899, 3427, 1], why: 'back up to Taverley' },
        { talk: 'sanfew', want: 'all four', why: 'hand them over' },
        { stage: 3 },
        { hasnt: 'enchanted_beef' },

        { note: 'wiki step 5: and Kaqemeex, who teaches Herblore' },
        { setpos: [2923, 3489, 0], why: 'back north to the circle' },
        { talk: 'kaqemeex', picks: ['Something else'], why: 'the fundamentals of Herblore - he is the Herblore skillcape seller too' },
        { stage: 4 }
    ]
};

const p: any = H.makePlayer('druidrun', m.start[0], m.start[1]);
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
