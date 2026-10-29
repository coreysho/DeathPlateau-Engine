// THE RESTLESS GHOST, played through on foot.
//
// Quest 7 of the full quest-by-quest pass. Father Aereck in Lumbridge church, Father Urhney's shack
// out in the swamp, the coffin in the churchyard, the skull two rooms into the Wizards' Tower
// basement, and back to the coffin. The overland legs are declared with setpos; every door, ladder
// and coffin lid in between is clicked.
//
//   npx tsx tools/sim/quest_restlessghost_run.ts
import * as H from './harness.js';
import { play, Manifest } from './questrun.js';

await H.boot();

const m: Manifest = {
    quest: 'THE RESTLESS GHOST',
    source: 'oldschool.runescape.wiki/w/The_Restless_Ghost',
    stageVar: 'prieststart',
    done: 5,   // ^priest_complete
    start: [3243, 3206, 0],
    steps: [
        { note: 'wiki: no requirements and no items.' },

        { note: 'wiki step 1: Father Aereck, in Lumbridge church' },
        { talk: 'father_aereck', picks: ['looking for a quest'], why: 'he asks you to get rid of the graveyard ghost' },
        { stage: 1 },

        { note: "wiki step 2: Father Urhney's shack, in the east of Lumbridge Swamp" },
        { setpos: [3234, 3157, 0], why: 'round the back of the castle, west through the wood, then east across the swamp' },
        { loc: 'loc_1530', at: [3234, 3156], why: 'the shack door' },
        { talk: 'father_urhney', picks: ['Aereck sent me', 'ghost haunting his graveyard'], why: 'he hands over the Ghostspeak amulet' },
        { stage: 2 },
        { has: 'amulet_of_ghostspeak' },

        { note: 'wiki step 3: the amulet goes ON - the ghost is unintelligible without it' },
        { held: 'amulet_of_ghostspeak', op: 2, why: 'wear it' },
        { worn: 'amulet_of_ghostspeak' },

        { note: 'wiki step 3: the churchyard, through the door on the east side of the church' },
        { setpos: [3246, 3193, 0], why: 'the walk back north out of the swamp' },
        { loc: 'loc_1530', at: [3247, 3193], why: 'the churchyard door' },
        { loc: 'shutghostcoffin', at: [3249, 3192], why: 'open the coffin - this is what summons the ghost' },
        { wait: 5, why: 'opening the lid is an animation and a delay; the Search lands on top of it otherwise' },
        { loc: 'restless_ghost_altar', at: [3249, 3192], op: 2, want: 'without a skull', why: 'and the corpse inside has no head' },
        { talk: 'ghostx', picks: ['now tell me what the problem is'], why: 'a warlock in the tower took his skull' },
        { stage: 3 },

        { note: 'wiki step 4: the skull, in the Wizards Tower basement. Two rooms in from the ladder,' },
        { note: 'through a door, and taking it spawns a skeleton.' },
        { setpos: [3109, 3171, 0], why: 'the road south-west to the tower island' },
        { loc: 'fai_wiztower_poor_door', at: [3109, 3167], why: "the tower's front door", soft: true },
        { go: [3108, 3163], why: 'across the entrance hall' },
        { loc: 'fai_wiztower_poor_door', at: [3107, 3162], why: 'the inner door to the west chamber', soft: true },
        { go: [3105, 3162], why: 'to the foot of the cellar ladder' },
        { loc: 'wizards_tower_laddertop', at: [3104, 3162], why: 'down into the basement' },
        { go: [3110, 9559], why: 'south through the basement passage' },
        { loc: 'loc_1530', at: [3111, 9559], why: 'the door into the east rooms', soft: true },
        { go: [3119, 9567], why: 'through to the room the skull is in' },
        { take: 'ghostskull', why: 'and a skeleton appears out of nowhere' },
        { stage: 4 },
        { has: 'ghostskull' },

        { note: 'wiki step 5: the skull goes in the coffin. The lid shuts itself after a few minutes,' },
        { note: 'so it is opened again rather than assumed open.' },
        { setpos: [3249, 3193, 0], why: 'the walk back to the churchyard' },
        { loc: 'shutghostcoffin', at: [3249, 3192], why: 'open the coffin again', soft: true },
        { useLoc: 'restless_ghost_altar', at: [3249, 3192], obj: 'ghostskull', why: 'put the skull in' },
        { stage: 5 },
        { hasnt: 'ghostskull' }
    ]
};

const p: any = H.makePlayer('ghostrun', m.start[0], m.start[1]);
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
