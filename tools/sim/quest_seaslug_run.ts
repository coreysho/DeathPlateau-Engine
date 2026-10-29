// SEA SLUG, played through on foot.
//
// Quest 28 of the quest-by-quest pass. Caroline's husband and son have gone quiet on the fishing
// platform; the only boat is full of holes, so the quest opens with swamp paste (tar, flour, and a
// fire), and the rest is three boat trips, a torch nobody can light because everything on the
// platform is damp, and a small boy who will not walk past a sea slug.
//
//   npx tsx tools/sim/quest_seaslug_run.ts
import * as H from './harness.js';
import { play, Manifest } from './questrun.js';

await H.boot();

const FIRE: [number, number] = [2719, 3306];   // a clear tile by Holgart's boat to cook the paste on

const m: Manifest = {
    quest: 'SEA SLUG',
    source: 'oldschool.runescape.wiki/w/Sea_Slug',
    stageVar: 'seaslugquest',
    done: 12,   // ^seaslug_complete
    start: [2717, 3302, 0],
    steps: [
        { note: 'requirement: 30 Firemaking, to rub the sticks together. The tar comes from the' },
        { note: 'Lumbridge swamp and the flour from a mill, so both are declared, with a tinderbox' },
        { note: 'and a log for the fire the paste has to be warmed over.' },
        { give: 'swamp_tar' },
        { give: 'pot_flour' },
        { give: 'logs' },
        { give: 'tinderbox' },

        { note: 'wiki step 1: Caroline, on the north Ardougne shore' },
        { talk: 'caroline', picks: ['how do I get there'], want: 'Holgart will take you', why: 'she asks you to go and look' },
        { stage: 1 },

        { note: 'wiki step 2: Holgart, whose boat is full of holes' },
        { setpos: [2723, 3306, 0], why: 'a few steps east to the boat' },
        { talk: 'holgartland', want: 'swamp paste', why: 'he wants paste before he will sail' },
        { stage: 2 },

        { note: 'wiki step 3: the paste. Tar and flour make it raw, and it has to be warmed over a' },
        { note: 'FIRE - a range answers "You need to warm that over a fire."' },
        { use: ['swamp_tar', 'pot_flour'], want: 'mixes into a paste', why: 'mix them' },
        { has: 'rawswamppaste' },
        { go: FIRE, exact: true, why: 'onto a clear tile' },
        { use: ['tinderbox', 'logs'], why: 'light a fire' },
        { wait: 12, why: 'lighting a fire is a few attempts' },
        { useLoc: 'fire', at: FIRE, obj: 'rawswamppaste', want: 'thickens into a sticky goo', why: 'warm the paste' },
        { has: 'swamppaste' },

        { note: 'wiki step 4: Holgart patches the boat and sails you out' },
        { talk: 'holgartland', picks: ['lets do it'], want: 'smears the paste', why: 'hand it over and sail' },
        { stage: 3 },
        { hasnt: 'swamppaste' },

        { note: 'wiki step 5: Kennith is hiding in a sealed room on the upper deck, and you shout' },
        { note: 'across to him through the wall. At this stage the ladder is unguarded.' },
        { setpos: [2784, 3287, 0], why: 'across the platform to the ladder' },
        { loc: 'slugladder', at: [2784, 3286], why: 'up to the upper deck' },
        { level: 1 },
        { note: 'the wall can only be shouted at from the cabin on the WEST side of his room, which' },
        { note: 'is behind a door of its own. Every tile on the deck side answers "I can’t reach' },
        { note: 'that!" - the crate at 2765,3287 takes the one tile that would have worked.' },
        { go: [2765, 3285], why: 'along the deck to the cabin door' },
        { loc: 'loc_1530', at: [2764, 3285], why: 'open it' },
        { go: [2764, 3286], why: 'into the cabin, beside his wall' },
        { loc: 'kennithwall', at: [2764, 3287], want: 'find your father', why: 'shout across' },
        { stage: 4 },

        { note: 'wiki step 6: tell Holgart, who sails off to look for Kent' },
        { setpos: [2783, 3274, 0], why: 'back down to the boat' },
        { talk: 'holgartplatform', want: 'better go look for him', why: 'he takes you to the island' },
        { stage: 5 },

        { note: 'wiki step 7: Kent, washed up on the island, and he pulls a slug off your neck' },
        { go: [2792, 3320], why: 'along the island to Kent' },
        { talk: 'kent', want: 'pulls a sea slug', why: 'what happened on the platform' },
        { stage: 6 },

        { note: 'wiki step 8: back to the platform, and Bailey the cook hands over a torch' },
        { talk: 'holgartsunkboat', want: 'better get back to the platform', why: 'sail back' },
        { setpos: [2763, 3275, 0], why: 'into the galley' },
        { talk: 'bailey', want: 'gives you a torch', why: 'the torch' },
        { has: 'torch_unlit' },

        { note: 'wiki step 9: the sticks on the deck are damp, and the broken glass is a lens.' },
        { note: 'Rubbing them together is a firemaking roll, so it takes a few goes.' },
        { setpos: [2784, 3289, 0], why: 'out to the sticks' },
        { take: 'damp_sticks', r: 6, why: 'off the deck' },
        { setpos: [2765, 3278, 0], why: 'and the broken glass' },
        { take: 'broken_glass', r: 6, why: 'off the floor' },
        { use: ['broken_glass', 'damp_sticks'], want: 'drys the sticks out', why: 'dry them in the sun' },
        { has: 'dry_sticks' },
        { held: 'dry_sticks', tries: 8, until: 'torch_lit', why: 'rub them together' },
        { has: 'torch_lit' },
        { stage: 7 },

        { note: 'wiki step 10: now the fishermen are afraid of the torch, so the ladder is safe' },
        { setpos: [2784, 3287, 0], why: 'back to the ladder' },
        { loc: 'slugladder', at: [2784, 3286], want: 'afraid of your torch', why: 'up again' },
        { level: 1 },
        { go: [2765, 3285], why: 'along to the cabin door' },
        { loc: 'loc_1530', at: [2764, 3285], soft: true, why: 'open it if it has shut' },
        { go: [2764, 3286], why: 'into the cabin' },
        { loc: 'kennithwall', at: [2764, 3287], want: 'scared of those nasty sea slugs', why: 'he will not walk out' },
        { stage: 8 },

        { note: 'wiki step 11: kick the loose panel in the east wall of his room' },
        { go: [2766, 3288], why: 'beside the panel' },
        { loc: 'loosepanel', at: [2765, 3288], want: 'big enough for Kennith', why: 'kick it in' },
        { stage: 9 },
        { go: [2765, 3285], why: 'back round to the cabin' },
        { loc: 'loc_1530', at: [2764, 3285], soft: true, why: 'open it if it has shut' },
        { go: [2764, 3286], why: 'in' },
        { loc: 'kennithwall', at: [2764, 3287], want: 'How will I get downstairs', why: 'tell him' },
        { stage: 10 },

        { note: 'wiki step 12: swing the crane round so he can ride the net down to the boat. The' },
        { note: 'op refuses from anywhere south of the crane’s north edge.' },
        { go: [2769, 3290], exact: true, why: 'round to the north side of the crane - two tiles short is "I need to get closer"' },
        { loc: 'fishingcrane', at: [2768, 3286], want: 'lower Kennith to the row boat', why: 'rotate it' },
        { stage: 11 },

        { note: 'wiki step 13: Holgart takes the boy home, then you, then Caroline pays' },
        { setpos: [2783, 3274, 0], why: 'down to the boat' },
        { talk: 'holgartplatform', want: 'safe and sound', why: 'sail back to Ardougne' },
        { setpos: [2717, 3302, 0], why: 'up the shore to Caroline' },
        { talk: 'caroline', want: 'Oyster pearls', why: 'the reward' },
        { wait: 4, why: 'the completion is queued' },
        { stage: 12 },
        { has: 'bigoysterpearls' }
    ]
};

const p: any = H.makePlayer('seaslugrun', m.start[0], m.start[1]);
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
