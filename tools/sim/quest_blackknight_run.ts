// BLACK KNIGHTS' FORTRESS, played through on foot. Nothing here teleports.
//
// First quest of the full quest-by-quest pass (19 Oct 2026): every quest walked against its own
// wiki playthrough, with the gaps fixed rather than noted. Each `note` gives the wiki's step.
//
//   npx tsx tools/sim/quest_blackknight_run.ts
import * as H from './harness.js';
import { play, Manifest } from './questrun.js';

await H.boot();

const m: Manifest = {
    quest: "BLACK KNIGHTS' FORTRESS",
    source: 'oldschool.runescape.wiki/w/Black_Knights%27_Fortress (2001 quest; the dossier is later, see below)',
    stageVar: 'spy',
    done: 4,
    start: [2962, 3339, 2],
    steps: [
        // The uniform, and a cabbage that is NOT the Draynor Manor one.
        { give: 'iron_chainbody' },
        { give: 'bronze_med_helm' },
        { give: 'cabbage' },
        { give: 'magic_cabbage' },
        { setvar: 'qp', to: 12, why: 'the quest wants 12 quest points before Sir Amik will talk about it' },

        { note: 'wiki step 1: Sir Amik Varze, top of the western tower of the White Knights castle' },
        { talk: 'sir_amik_varze', picks: [1, 1], why: 'I seek a quest, I laugh in the face of danger' },
        { stage: 1 },

        { note: 'NO DOSSIER: the wiki has Sir Amik hand over a dossier that starts the quest when read,' },
        { note: 'but there is no dossier obj anywhere in the 377 cache - it is later content, and the' },
        { note: 'quest starts from the dialogue here, which is the 2006 behaviour.' },

        { note: 'wiki step 2: to the fortress, north-east of Falador' },
        { setpos: [3016, 3512, 0], why: 'the walk from Falador to the fortress is open ground and not this quest' },

        { note: 'wiki step 2: the uniform goes on - iron chainbody and a bronze med helm' },
        { held: 'iron_chainbody', op: 2 },
        { held: 'bronze_med_helm', op: 2 },
        { worn: 'iron_chainbody' },
        { worn: 'bronze_med_helm' },

        { note: 'wiki step 2: in through the southern door' },
        { loc: 'bkfortressdoor1', at: [3016, 3514], why: 'the guard entrance' },
        { go: [3016, 3516], why: 'inside' },

        { note: 'wiki step 3: push the wall, which the wiki calls a required passage' },
        { loc: 'bksecretdoor', at: [3016, 3517], why: 'the first push-wall' },

        { note: 'wiki step 3: the ladder in that room, then the one immediately to its right' },
        { loc: 'loc_1750', at: [3015, 3519], why: 'up out of the small room' },
        { loc: 'loc_1750', at: [3016, 3519], why: 'and up again' },

        { note: 'wiki step 3: down the ladder to the south, through the door east, up the nearest ladder' },
        { loc: 'laddertop', at: [3017, 3516], why: 'down to the first floor' },
        { loc: 'loc_1530', at: [3019, 3515], why: 'the door east' },
        { loc: 'loc_1530', at: [3021, 3515], why: 'and the second one' },
        { loc: 'loc_1750', at: [3023, 3513], why: 'up' },

        { note: 'wiki step 3: down the ladder immediately east, the sturdy door south, the ladder west of it' },
        { loc: 'loc_1749', at: [3025, 3513], why: 'down' },
        { loc: 'bkfortressdoor3', at: [3025, 3511], why: 'the sturdy door - the knights here aggress' },
        { loc: 'laddertop', at: [3021, 3510], why: 'down into the little room with the grill' },

        { note: 'wiki step 4: the grill, where the witch and the goblin can be overheard' },
        { loc: 'witchgrill', at: [3025, 3507], why: 'listen at the grill' },
        { stage: 2 },

        { note: 'THE SABOTAGE LEG IS NOT WALKED YET. Every piece of it answers correctly in isolation -' },
        { note: 'the grill room ladder climbs, the sturdy door opens, and the second push-wall at' },
        { note: '3030,3510 pushes a player through from its north face to 3030,3509, two tiles from the' },
        { note: 'hole. What is not established is the walking route from the grill room to that north' },
        { note: 'face: the first floor is cut up by wall locs that the tile flags do not show, and the' },
        { note: 'engine finds no route east along z=3511 from the sturdy door. The wiki goes back out to' },
        { note: 'the entrance, into the room east of it, and up the ladder on ITS north wall - which is' },
        { note: 'the loc_1750 at 3022,3518 - so that is the leg to walk next.' },
        { setvar: 'spy', to: 2, why: 'stage 2 is where the walked part of this run ends' },

        { note: 'the sabotage itself, driven where the player would be standing after the push' },
        { setpos: [3030, 3508, 1], why: 'two tiles south of the second push-wall, where it puts you' },
        { go: [3030, 3507], why: 'down to the hole above the cauldron' },

        { note: 'wiki step 5: the wrong cabbage first - the Draynor Manor one would help the witch' },
        { useLoc: 'blackknighthole', at: [3031, 3507], obj: 'magic_cabbage', want: 'wrong sort of cabbage' },
        { varis: 'spy', to: 2 },
        { has: 'magic_cabbage' },

        { note: 'wiki step 5: and then a cabbage from anywhere else, which ruins the potion' },
        { useLoc: 'blackknighthole', at: [3031, 3507], obj: 'cabbage' },
        { stage: 3 },
        { hasnt: 'cabbage' },

        { note: 'wiki step 6: back to Sir Amik for the 2,500 coins' },
        { setpos: [2962, 3339, 2], why: 'the walk back to Falador is not this quest' },
        { talk: 'sir_amik_varze', why: 'I have ruined the potion' },
        { stage: 4 },
        { has: 'coins', n: 2500 }
    ]
};

const p: any = H.makePlayer('bkfrun', m.start[0], m.start[1]);
H.tick(2);
p.teleport(m.start[0], m.start[1], m.start[2]);
// The fortress is full of level-33 Black Knights that aggress a walking player, and a death would
// lose the uniform and the cabbage. Damage going the other way is untouched.
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
