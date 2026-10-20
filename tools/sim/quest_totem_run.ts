// TRIBAL TOTEM, played through on foot.
//
// Quest 27 of the quest-by-quest pass. Kangai Mau in Brimhaven wants his tribe's totem back out of
// Lord Handelmort's private museum in Ardougne, and the way in is a delivery scam: peel the address
// label off the crate bound for the mansion, stick it on Wizard Cromperty's teleport block, get the
// R.P.D.T. to deliver that instead, and have Cromperty teleport you to his own block - which is now
// standing in Handelmort's hall. Then a four-dial combination door, a trapped staircase, and the
// chest upstairs.
//
//   npx tsx tools/sim/quest_totem_run.ts
import * as H from './harness.js';
import { play, Manifest, Step } from './questrun.js';

await H.boot();

// KURT, Handelmort's middle name, which Horacio the gardener nearly lets slip. The dials only step
// one letter at a time from A, so it is 10 + 20 + 17 + 19 presses.
const COMBO: [string, number][] = [
    ['tribal_door2:com_48', 10],
    ['tribal_door2:com_50', 20],
    ['tribal_door2:com_52', 17],
    ['tribal_door2:com_54', 19]
];

const m: Manifest = {
    quest: 'TRIBAL TOTEM',
    source: 'oldschool.runescape.wiki/w/Tribal_Totem',
    stageVar: 'totemquest',
    done: 5,   // ^totem_complete
    start: [2791, 3181, 0],
    steps: [
        { note: 'requirement: 21 Thieving, which is also what spots the trap on the stairs' },

        { note: 'wiki step 1: Kangai Mau, in the Shrimp and Parrot in Brimhaven' },
        { talk: 'kangai_mau', picks: ['And what are you doing in Brimhaven', 'Tell me of this mission', 'Ok, I will get it back'], want: 'Best of luck', why: 'he asks for the totem back' },
        { stage: 1 },

        { note: 'wiki step 2: Horacio, Handelmort’s gardener, on the lawn in front of the mansion.' },
        { note: 'He is the only source of the combination - "it’s his middle name" - and the option' },
        { note: 'does not exist until the quest is started.' },
        { setpos: [2636, 3310, 0], why: 'north-east by boat and road to Ardougne' },
        { talk: 'horacio', picks: ['who are you', 'do you garden round the back'], want: 'his middle name', why: 'the hint' },

        { note: 'wiki step 3: the R.P.D.T. depot. The label comes off the crate bound for the' },
        { note: 'mansion and goes onto Cromperty’s crate two tiles away.' },
        { setpos: [2649, 3273, 0], why: 'north to the depot' },
        { loc: 'horncrate', at: [2650, 3273], op: 2, want: 'Handelmort Mansion', why: 'peel the label off' },
        { has: 'tribal_totem_label' },
        { go: [2649, 3271], why: 'round to the other crate' },
        { useLoc: 'teleportcrate', at: [2650, 3271], obj: 'tribal_totem_label', want: 'covering it completely', why: 'stick it on the teleport block' },
        { stage: 2 },
        { hasnt: 'tribal_totem_label' },

        { note: 'wiki step 4: ask the R.P.D.T. to deliver it' },
        { talk: 'rpdt_employee', picks: ['when are you going to deliver'], want: 'do it now', why: 'send the crate' },
        { stage: 3 },

        { note: 'wiki step 5: Cromperty teleports you to his own block, which is now in the mansion' },
        { setpos: [2684, 3326, 0], why: 'east to Cromperty’s house' },
        { talk: 'ardounge_wizard', picks: ['So what have you invented', 'Can I be teleported please', 'Teleport me'], why: 'the teleport' },
        { stage: 4 },
        { go: [2638, 3321], why: 'arrive inside the mansion' },

        { note: 'wiki step 6: the hall the crate is in is sealed off; the way west is the door on' },
        { note: 'its west side, then the small hall, then the combination door. The front door' },
        { note: '(tribaltotemdoor) only opens from the north, so it is the way OUT, not in.' },
        { go: [2637, 3323], why: 'to the west door of the arrival hall' },
        { loc: 'loc_1533', at: [2636, 3323], why: 'open it' },
        { go: [2635, 3323], why: 'into the small hall' },
        { loc: 'combodoor', at: [2634, 3323], why: 'it opens the dials, not the door' }
    ]
};

// the four dials, then the button that checks them
for (const [com, n] of COMBO) m.steps.push({ press: com, n, why: 'dial it round' } as Step);
m.steps.push({ press: 'tribal_door2:com_57', want: 'combination seems correct', why: 'enter KURT' } as Step);

m.steps.push(
    { note: 'and now the same door opens' },
    { loc: 'combodoor', at: [2634, 3323], why: 'through it' },
    { go: [2632, 3323], why: 'into the back of the house' },

    { note: 'wiki step 7: the stairs are trapped, and the op walks you to their north end before' },
    { note: 'anything happens. Searching them first is what 21 Thieving is for; climbing them' },
    { note: 'unsearched drops you into the cellar for a fifth of your hitpoints.' },
    { loc: 'totemtrapstairs', at: [2631, 3322], op: 2, want: 'make a note of its location', why: 'search for the trap' },
    { loc: 'totemtrapstairs', at: [2631, 3322], want: 'climb up the stairs', why: 'climb them safely' },
    { level: 1 },

    { note: 'wiki step 8: upstairs is a ring of rooms off one corridor - two more doors between' },
    { note: 'the stairs and the museum room with the chest in it' },
    { go: [2632, 3320], why: 'to the corridor door' },
    { loc: 'loc_1533', at: [2632, 3319], why: 'open it' },
    { go: [2638, 3319], why: 'east along the corridor' },
    { loc: 'loc_1533', at: [2638, 3319], why: 'and the museum door' },
    { go: [2638, 3322], why: 'in to the chest' },
    { loc: 'totemshutchest', at: [2638, 3324], want: 'open the chest', why: 'open it' },
    { loc: 'totemopenchest', at: [2638, 3324], want: 'you find the tribal totem', why: 'take the totem' },
    { has: 'tribal_totem' },

    { note: 'wiki step 9: all the way back to Brimhaven' },
    { setpos: [2791, 3181, 0], why: 'out of the mansion and back by boat' },
    { talk: 'kangai_mau', want: 'Many thanks brave adventurer', why: 'hand it over' },
    { wait: 4, why: 'the completion is queued' },
    { stage: 5 },
    { hasnt: 'tribal_totem' },
    { has: 'swordfish', n: 5 }
);

const p: any = H.makePlayer('totemrun', m.start[0], m.start[1]);
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
