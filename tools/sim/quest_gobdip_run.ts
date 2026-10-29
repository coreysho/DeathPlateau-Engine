// GOBLIN DIPLOMACY, played through on foot.
//
// Quest 15 of the full quest-by-quest pass. The Rusty Anchor's barman in Port Sarim starts it, and
// the whole quest is three bits of goblin mail shown to two generals in the goblin village: orange,
// then blue, then the plain brown it started as. The mail and the dyes are declared - they come off
// goblins and out of Aggie's cauldron, which is not this quest.
//
//   npx tsx tools/sim/quest_gobdip_run.ts
import * as H from './harness.js';
import { play, Manifest } from './questrun.js';

await H.boot();

const m: Manifest = {
    quest: 'GOBLIN DIPLOMACY',
    source: 'oldschool.runescape.wiki/w/Goblin_Diplomacy',
    stageVar: 'goblinquest',
    done: 6, // ^gobdip_complete
    start: [3045, 3256, 0],
    steps: [
        { note: 'wiki: three goblin mails, orange dye and blue dye. Goblin mail is a goblin drop and' },
        { note: 'the dyes are Aggie, so all five are declared.' },
        { give: 'goblin_armour', n: 3 },
        { give: 'orangedye' },
        { give: 'bluedye' },

        { note: 'wiki step 1: the barman in the Rusty Anchor, Port Sarim' },
        { talk: 'rustyanchor_bartender', picks: ['Not very busy in here today'], why: 'he has heard the goblins are arguing' },
        { stage: 1 },

        { note: 'wiki step 2: the two generals in the goblin village, north of Falador' },
        { setpos: [2959, 3511, 0], why: 'north across Asgarnia to the village' },
        { talk: 'general_wartface', picks: ['Why are you arguing', "Wouldn't you prefer peace", 'pick an armour colour'], why: 'they will try a colour that is neither green nor red' },
        { stage: 2 },

        { note: 'wiki step 3: orange first - orange dye on a goblin mail' },
        { use: ['orangedye', 'goblin_armour'], want: 'dye the goblin armour orange', why: 'dye it' },
        { has: 'goblin_armour_orange' },
        { talk: 'general_wartface', why: 'they do not like orange' },
        { stage: 3 },
        { hasnt: 'goblin_armour_orange' },

        { note: 'wiki step 4: then blue' },
        { use: ['bluedye', 'goblin_armour'], want: 'dye the goblin armour blue', why: 'dye the second one' },
        { has: 'goblin_armour_darkblue' },
        { talk: 'general_wartface', why: 'they do not like blue either' },
        { stage: 4 },
        { hasnt: 'goblin_armour_darkblue' },

        { note: 'wiki step 5: and then the brown they started with, which they settle on' },
        { has: 'goblin_armour' },
        { note: 'and the reward lands in the same breath - the completion is queued at zero delay,' },
        { note: 'so the quest never sits at stage 5 for a tick' },
        { talk: 'general_wartface', why: 'brown it is, and that completes it' },
        { stage: 6 },
        { hasnt: 'goblin_armour' },
        { has: 'gold_bar' }
    ]
};

const p: any = H.makePlayer('gobdiprun', m.start[0], m.start[1]);
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
