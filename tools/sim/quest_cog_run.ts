// CLOCK TOWER, played through on foot.
//
// Quest 23 of the full quest-by-quest pass. Brother Kojo south of the tower, four cogs scattered
// around the cellar under it, and one spindle each: black in the cellar itself, red on the ground
// floor, blue on the first and white on the second. One cog at a time - they are too heavy for two -
// and the black one is red hot, so it wants ice gloves.
//
//   npx tsx tools/sim/quest_cog_run.ts
import * as H from './harness.js';
import { play, Manifest } from './questrun.js';

await H.boot();

const m: Manifest = {
    quest: 'CLOCK TOWER',
    source: 'oldschool.runescape.wiki/w/Clock_Tower',
    stageVar: 'cogquest',
    done: 8,   // ^quest_cog_complete, read off bits 0-3
    start: [2568, 3252, 0],
    steps: [
        { note: 'wiki: ice gloves for the black cog, which is red hot from the flames' },
        { give: 'ice_gloves' },
        { held: 'ice_gloves', op: 2, why: 'wear them' },
        { worn: 'ice_gloves' },

        { note: 'wiki step 1: Brother Kojo, south of the tower' },
        { talk: 'brother_kojo', picks: ['what can I do'], why: 'four cogs in the cellar, one on each floor' },
        { varis: 'cogquest', to: 1 },

        { note: 'wiki step 2: the black cog, and the spindle in the cellar it goes on. One at a' },
        { note: 'time - the cogs are too heavy to carry two.' },
        { setpos: [2613, 9640, 0], why: 'down the ladder and east through the cellar' },
        { take: 'blackcog', r: 6, want: 'ice gloves cool down the cog', why: 'off the floor' },
        { has: 'blackcog' },
        { setpos: [2571, 9642, 0], why: 'west to the cellar spindle' },
        { useLoc: 'brokeclockpole_black', at: [2570, 9642], obj: 'blackcog', want: 'fits perfectly', why: 'the black one' },
        { varis: 'cogquest', to: 2 },

        { note: 'wiki step 3: the red cog, and the spindle on the ground floor' },
        { setpos: [2583, 9614, 0], why: 'back into the cellar for the next one' },
        { take: 'redcog', r: 6, why: 'off the floor' },
        { setpos: [2568, 3244, 0], why: 'up the ladder to the tower floor' },
        { useLoc: 'brokeclockpole_red', at: [2568, 3243], obj: 'redcog', want: 'fits perfectly', why: 'the red one' },
        { varis: 'cogquest', to: 3 },

        { note: 'wiki step 4: the blue cog, and the first floor. The blue cog sits in a sealed room' },
        { note: 'in the south of the dungeon - the only way in is the secret door on its east side,' },
        { note: 'so that one gets pushed for real rather than jumped over.' },
        { setpos: [2576, 9631, 0], why: 'back down and south to the secret door' },
        { loc: 'secretdoor2', at: [2575, 9631], op: 1, why: 'push it open' },
        { go: [2574, 9633], why: 'into the cog room' },
        { take: 'bluecog', r: 6, why: 'off the floor' },
        { note: 'the 2x2 in the middle of each clock floor is sealed off - the standing room is the' },
        { note: 'ring around it, so the blue spindle is used from its west side' },
        { setpos: [2570, 3240, 1], why: 'up the spiral staircase one floor' },
        { useLoc: 'brokeclockpole_blue', at: [2569, 3240], obj: 'bluecog', want: 'fits perfectly', why: 'the blue one' },
        { varis: 'cogquest', to: 4 },

        { note: 'wiki step 5: the white cog, and the second floor' },
        { setpos: [2577, 9656, 0], why: 'back down for the last one' },
        { take: 'whitecog', r: 6, why: 'off the floor' },
        { setpos: [2567, 3242, 2], why: 'up to the top floor' },
        { useLoc: 'brokeclockpole_white', at: [2567, 3241], obj: 'whitecog', want: 'fits perfectly', why: 'and the white one' },
        { varis: 'cogquest', to: 5 },

        { note: 'wiki step 6: back to Kojo' },
        { setpos: [2568, 3252, 0], why: 'out and round to the monk' },
        { talk: 'brother_kojo', why: 'the clock runs again' },
        { stage: 8 },
        { has: 'coins', n: 500 }
    ]
};

const p: any = H.makePlayer('cogrun', m.start[0], m.start[1]);
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
