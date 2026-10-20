// A SOUL'S BANE, played through on foot.
//
// Quest 20 of the full quest-by-quest pass. Launa by the rift east of Varrock, a rope on the edge,
// and then four rooms that are each their own mechanic: Anger (the rack, and the right weapon for
// each creature until the rage bar fills), Fear (six holes, five reapers), Confusion (five doors
// that vanish one real creature at a time), Hopelessness (five creatures, three forms each), and
// then Tolna's three heads.
//
// The rooms are not joined by walking - every way between them is a loc op that teleports - so the
// run clicks each one rather than pretending to walk a wall it cannot cross.
//
//   npx tsx tools/sim/quest_soulbane_run.ts
import * as H from './harness.js';
import { play, Manifest } from './questrun.js';

await H.boot();


// The six holes in the Fear room's walls, and the reaper hides in a different one every time - so a
// round is all six, five of which say "there's nothing in there", and then whatever leapt out.
// Each hole, and the tile beside it to stand on. The room is wide and the walk between opposite
// walls is long enough that routing to one of six in turn is not something to leave to chance -
// miss the hole the reaper is actually in and the round produces nothing at all.
const FEAR_HOLES: [string, [number, number], [number, number]][] = [
    ['soul_bane_fwall_void', [3065, 5245], [3064, 5244]],
    ['soul_bane_fwall_void2', [3068, 5227], [3067, 5228]],
    ['soul_bane_fwall_void3', [3063, 5219], [3063, 5220]],
    ['soul_bane_fwall_void4', [3052, 5219], [3052, 5220]],
    ['soul_bane_fwall_void5', [3046, 5229], [3047, 5229]],
    ['soul_bane_fwall_void6', [3046, 5239], [3047, 5239]]
];

const fearRounds = (): any[] => {
    const places: [string, number, number][] = FEAR_HOLES.map(([name, at]) => [name, at[0], at[1]]);
    return [
        {
            hunt: places,
            untilnpc: 'soulbane_fear_reaper',
            untilvar: 'soulbane_fear_killedtally',
            to: 5,
            tries: 12,
            why: 'five reapers, each hiding in a different one of the six'
        }
    ];
};

const m: Manifest = {
    quest: "A SOUL'S BANE",
    source: 'oldschool.runescape.wiki/w/A_Soul%27s_Bane',
    stageVar: 'soulbane_prog',
    done: 7,   // ^soulbane_complete
    start: [3310, 3453, 0],
    steps: [
        { note: 'wiki: a rope, and something to fight with' },
        { give: 'rope' },
        { give: 'rune_scimitar' },
        { held: 'rune_scimitar', op: 2, why: 'wield it' },

        { note: 'wiki step 1: Launa, beside the rift' },
        { talk: 'soulbane_launa_multi', picks: ['go down to look for your husband and son'], why: 'her husband and son are both down there' },
        { stage: 1 },
        { varis: 'soulbane_warning_pres', to: 1 },

        { note: 'wiki step 2: a rope on the edge, and down' },
        { useLoc: 'soulbane_falloff2_rope_multi', at: [3310, 3452], obj: 'rope', want: 'tie the rope', why: 'tie it on' },
        { varis: 'soulbane_riftrope_pres', to: 1 },
        { loc: 'soulbane_falloff2_rope_multi', at: [3310, 3452], want: 'climb down', why: 'climb in' },
        { stage: 2 },
        { level: 0 },

        { note: 'wiki step 3 - ANGER: a rack of four weapons, and each creature only takes damage' },
        { note: 'from its own. The sword is the unicorn. The rage bar needs 1,500.' },
        { loc: 'soulbane_rack_multi', at: [3012, 5243], picks: ['The sword'], why: 'the sword off the rack' },
        { has: 'soulbane_anger_swordq' },
        { held: 'soulbane_anger_swordq', op: 2, why: 'wield it - the damage only counts while it is worn' },
        { worn: 'soulbane_anger_swordq' },
        { fight: 'soulbane_anger_unicorn', untilvar: 'soulbane_prog', to: 3, tries: 20, why: 'unicorns until the rage boils over' },
        { stage: 3 },

        { note: 'wiki step 3: and the fire in the doorway has gone out' },
        { loc: 'soul_bane_awall_void_exit', at: [3038, 5228], want: 'next cave', why: 'through where the fire was' },

        { note: 'wiki step 4 - FEAR: six holes and one reaper hiding in one of them, which moves' },
        { note: 'after every kill - so every round is "look in all six, then kill what came out".' },
        ...fearRounds(),
        { stage: 4 },

        { note: 'wiki step 4: the black hole to the west is lit now' },
        { loc: 'soulbane_fwall_exit_multi', at: [3046, 5235], want: 'black hole', why: 'step into it' },

        { note: 'wiki step 5 - CONFUSION: five doors, and among five creatures only one is real.' },
        { note: 'Each real one taken down makes a door vanish; five doors gone and the sixth is the' },
        { note: 'way on. The four illusions take no damage - eight hits and they fade.' },
        { fight: 'soulbane_confu_creeper', untilvar: 'soulbane_prog', to: 5, tries: 20, why: 'the real one, five times over' },
        { stage: 5 },
        { varis: 'soulbane_confu_door6open', to: 1 },

        { note: 'wiki step 5: through the door that was really there all along' },
        { loc: 'soulbane_door_multi6', at: [3051, 5200], want: 'step through the door', why: 'the sixth door' },

        { note: 'wiki step 6 - HOPELESSNESS: five creatures, three forms each, fifteen kills' },
        { wait: 4, why: 'the room stocks itself as you arrive' },
        { setpos: [3017, 5201, 0], why: 'over to where the first of them is standing - the room is wide and findNpc does not reach across it' },
        { note: 'each one killed comes back smaller, so which of the three forms is in front of you' },
        { note: 'is not something the run can plan - it takes whichever one is there' },
        { fight: ['soulbane_hope_monst3', 'soulbane_hope_monst2', 'soulbane_hope_monst1'], untilvar: 'soulbane_prog', to: 6, tries: 40, why: 'fifteen forms' },
        { stage: 6 },

        { note: 'wiki step 6: across the Bridge of Hope and into the passage' },
        { loc: 'soul_bane_hwall_void_exit', at: [3020, 5188], want: 'into the passage', why: 'the way on' },

        { note: 'wiki step 7 - TOLNA: three heads out of the chasm, on the floor above' },
        { wait: 6, why: 'Brana and Tolna have their scene before the heads turn on you' },
        { setpos: [2973, 5213, 1], why: 'in among the heads' },
        { fight: 'soulbane_final_tolna1', untilvar: 'soulbane_final_tol1dead', to: 1, tries: 6, why: 'the first head' },
        { fight: 'soulbane_final_tolna2', untilvar: 'soulbane_final_tol2dead', to: 1, tries: 6, why: 'the second' },
        { fight: 'soulbane_final_tolna3', untilvar: 'soulbane_final_tol3dead', to: 1, tries: 6, why: 'and the third' },

        { note: 'wiki step 7: Tolna himself, on the narrow path, and then the surface' },
        { talk: 'soulbane_tolna_top', want: 'glad my wife and I never gave up hope', why: 'he is himself again' },
        { varis: 'soulbane_tolna_pres', to: 1 },

        { note: 'wiki step 8: and Tolna by the rift, which is what completes it' },
        { talk: 'soulbane_tolna_multi', why: 'on the surface' },
        { stage: 7 },
        { varis: 'soulbane_warning_pres', to: 0 },
        { has: 'coins', n: 500 }
    ]
};

const p: any = H.makePlayer('soulrun', m.start[0], m.start[1]);
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
