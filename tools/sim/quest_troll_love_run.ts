// TROLL ROMANCE, played through on foot.
//
// Quest 66 of the quest-by-quest pass. Ug loves Aga, Aga is with Arrg, and Arrg promised her a
// Trollweiss flower he has no idea how to find. The flower grows on one plateau below the ice troll
// caves, the plateau is snowed over, and the only way down is a sled Dunstan builds out of yew logs,
// an iron bar and a rope and that you wax yourself with swamp tar and beeswax in a cake tin.
//
//   NODE_MEMBERS=true npx tsx tools/sim/quest_troll_love_run.ts
import * as H from './harness.js';
import { play, Manifest } from './questrun.js';

await H.boot();

// the stronghold's two rooms: Ug alone in the south, Aga and Arrg together in the north
const UG: [number, number, number] = [2827, 10065, 1];
const AGA: [number, number] = [2828, 10101];
const ARRG: [number, number] = [2828, 10098];
// the two rooms are one pocket each and the only way between them is this door, which the
// pathfinder will not open - every crossing clicks it first, and soft because a door already open
// is a different loc and no longer there to click
const DOOR: [number, number] = [2828, 10091];
const DOOR_S: [number, number] = [2828, 10090];
const _DOOR_NDOOR_N: [number, number] = [2828, 10092];
const TENZING: [number, number, number] = [2821, 3554, 0];
const DUNSTAN: [number, number, number] = [2919, 3574, 0];
// Trollheim, the mouth of the ice troll cave. The loc is 3x2 and stands on its own tiles; the only
// walkable ground beside it is to the east, which is also the chill zone.
const CAVE_MOUTH: [number, number] = [2820, 3743];
const CAVE_STAND: [number, number] = [2822, 3743];
const _CAVE_LANDINGCAVE_LANDING: [number, number, number] = [2803, 10187, 0];
const CREVASSE: [number, number] = [2772, 10233];
const SLOPE: [number, number] = [2772, 3835]; // the top slope, down to the Trollweiss plateau
const SLOPE_STAND: [number, number] = [2772, 3836];
const FLOWER: [number, number] = [2781, 3783];
// the way off the plateau: the second slope, which crashes you into the rocks above the tunnel out
// to the Rellekka side. 3x2 locs, both of them, standing on their own tiles.
const SLOPE2: [number, number] = [2785, 3771];
const SLOPE2_STAND: [number, number] = [2785, 3772];
const CRASH: [number, number] = [2793, 3725];
const EXIT_TUNNEL: [number, number] = [2795, 3717];
const _CAVE2_LANDINGCAVE2_LANDING: [number, number] = [2799, 10134];
const CAVE2_OUT: [number, number] = [2771, 10161];

const m: Manifest = {
    quest: 'TROLL ROMANCE',
    source: 'oldschool.runescape.wiki/w/Troll_Romance',
    stageVar: 'troll_love',
    done: 45,
    start: UG,
    steps: [
        { note: 'requirements: Troll Stronghold (so Death Plateau too) and Agility 28, which Ug asks' },
        { note: 'for himself. Items: maple or yew logs, an iron bar, a rope, swamp tar, a bucket of' },
        { note: 'wax and an empty cake tin.' },
        { setvar: 'troll_quest', to: 50, why: '^troll_complete - Troll Stronghold' },
        { setvar: 'death_equiproom', to: 80, why: '^death_complete - Death Plateau, which Tenzing wants' },
        { setpos: UG, why: "the stronghold's west room, where Ug is crying" },

        { note: 'wiki step 1: Ug, then Aga, then Arrg, then Ug again' },
        {
            talk: 'trollromance_ug',
            picks: ['Awww, you poor troll. What seems to be the problem?', "Don't worry now, I'll see what I can do."],
            want: 'maybe Ug not eat you',
            why: 'he is in love and Arrg would rip him apart'
        },
        { stage: 5 },
        { go: DOOR_S, exact: true, r: 40, why: 'north to the interior door' },
        { loc: 'troll_stronghold_interior_door', at: DOOR, soft: true, why: 'open it' },
        { go: AGA, r: 60, why: 'through to Aga' },
        {
            talk: 'trollromance_aga',
            picks: ["So... how's your... um... love life?", "Errr... I've got to go."],
            want: 'Trollweiss',
            why: 'the flower Arrg promised her'
        },
        { stage: 10 },
        { go: ARRG, r: 20, why: 'and Arrg, in the same room' },
        {
            talk: 'trollromance_arrg',
            picks: ['Your girlfriend said you know where to find Trollweiss?'],
            want: 'just say to make Aga shut up',
            why: 'he does not know and does not care'
        },
        { go: [2828, 10067], exact: true, r: 60, why: 'back through the open door to Ug' },
        { talk: 'trollromance_ug', want: 'live whole life in mountains', why: 'which is a sherpa' },

        { note: 'wiki step 2: Tenzing knows where it grows and that you will need a sled, and Dunstan' },
        { note: 'is the man who builds one' },
        { setpos: TENZING, why: "to Tenzing's hut above Burthorpe" },
        {
            talk: 'death_sherpa',
            picks: ['Do you know where I can find Trollweiss?', 'What would I need to make such a sled?'],
            want: 'ask Dunstan',
            why: 'the plateau below the ice trolls'
        },
        { stage: 15 },
        { setpos: DUNSTAN, why: "to Dunstan's forge" },
        {
            talk: 'death_smithy',
            picks: ['Talk about a quest.', 'I need a sled!!', 'Yes.'],
            want: 'yew or maple logs',
            why: 'he agrees to build one'
        },
        { stage: 20 },
        { give: 'yew_logs' },
        { give: 'iron_bar' },
        { give: 'rope' },
        {
            talk: 'death_smithy',
            picks: ['Talk about a quest.', 'Where can I get wax from?', 'See you!'],
            want: 'will need to be waxed',
            why: 'and builds it'
        },
        { stage: 22 },
        { has: 'trollromance_toboggon' },
        { hasnt: 'yew_logs' },

        { note: 'wiki step 3: swamp tar from the Lumbridge swamp and a bucket of wax off the Catherby' },
        { note: 'beehives, mixed in a cake tin. Tar on the wax, not the other way about.' },
        { give: 'swamp_tar' },
        { give: 'bucket_wax' },
        { give: 'cake_tin' },
        { use: ['swamp_tar', 'bucket_wax'], want: 'make some sled wax', why: 'in the tin' },
        { has: 'trollromance_wax' },
        { use: ['trollromance_toboggon', 'trollromance_wax'], want: 'ready to go', why: 'wax the sled' },
        { stage: 25 },
        { has: 'trollromance_toboggon_waxed' },
        { has: 'cake_tin', n: 1 },

        { note: 'wiki step 4: through the ice troll cave north-west of Trollheim, out of the crevasse' },
        { note: 'in the north-west corner, and down the slope on the sled' },
        { setpos: [CAVE_STAND[0], CAVE_STAND[1], 0], why: 'to Trollheim, at the mouth of the cave' },
        { loc: 'trollromance_caveentrance', at: CAVE_MOUTH, why: 'into the cave' },
        { go: [CREVASSE[0], CREVASSE[1] - 1], exact: true, r: 90, why: 'to the far north-west corner' },
        { loc: 'trollromance_snow_cavewall_crevis', at: CREVASSE, why: 'out through the crevasse' },
        { note: 'the sled can only be worn on the mountain itself - ~can_ride_sled checks the zone' },
        { held: 'trollromance_toboggon_waxed', op: 2, why: 'ride it' },
        { worn: 'trollromance_toboggon_waxed' },
        { go: SLOPE_STAND, exact: true, r: 90, why: 'south to the top of the slope' },
        { loc: 'trollromance_piste_walk_barrier_down', at: SLOPE, why: 'down to the plateau' },
        { note: 'the ride itself is the assertion: the plateau is only reachable down the slope, so a' },
        { note: 'short exact walk to the clearing it lands in fails if the ride did not happen' },
        { go: [2790, 3794], exact: true, r: 12, why: 'the clearing the ride ends in' },

        { note: 'wiki step 4 end: the flowers are in the clearing the ride lands in' },
        { go: FLOWER, exact: true, r: 40, why: 'to the rare flowers' },
        { loc: 'trollromance_rareflowers', at: FLOWER, op: 2, why: 'pick one' },
        { stage: 30 },
        { has: 'trollromance_rare_flower' },

        { note: 'wiki step 5, the way home: the plateau is a dead end going back - Tenzing says as' },
        { note: 'much - so you ride the second slope, crash into the rocks above the tunnel, and come' },
        { note: "out on Rellekka's side of the mountain. The tunnel takes the sled off your back." },
        { go: SLOPE2_STAND, exact: true, r: 90, why: 'to the top of the second slope' },
        { loc: 'trollromance_piste_walk_barrier_down', at: SLOPE2, why: 'and ride it down' },
        { go: CRASH, exact: true, r: 12, why: 'the rocks it crashes into' },
        { go: [EXIT_TUNNEL[0] - 1, EXIT_TUNNEL[1] + 1], exact: true, r: 40, why: 'to the tunnel mouth' },
        { loc: 'trollromance_piste_exit_tunnel_exit', at: EXIT_TUNNEL, want: 'remove the sled', why: 'in' },
        { has: 'trollromance_toboggon_waxed' }, // off your back and into the pack, not lost
        { go: [CAVE2_OUT[0] + 2, CAVE2_OUT[1] + 1], exact: true, r: 90, why: 'through the cave' },
        { loc: 'trollromance_piste_exit_tunnel_bottom', at: CAVE2_OUT, why: 'and out the far side' },

        { note: 'wiki step 5: Ug will not hand it over himself while Arrg is alive' },
        { setpos: UG, why: 'back to the stronghold' },
        { talk: 'trollromance_ug', want: 'eat Ug for breakfast', why: 'so Arrg has to go' },
        { stage: 35 },
        { hasnt: 'trollromance_rare_flower' },

        { note: 'wiki steps 5-6: the duel. Arrg is level 113, hits 38 in melee and throws rocks for' },
        { note: '30, and the talk teleports you both to the arena south of the mountain.' },
        { go: DOOR_S, exact: true, r: 40, why: 'north to the door' },
        { loc: 'troll_stronghold_interior_door', at: DOOR, soft: true, why: 'open it' },
        { go: ARRG, r: 60, why: 'through to Arrg' },
        {
            talk: 'trollromance_arrg',
            picks: ['Aga deserves better than you.'],
            want: 'take it outside',
            why: 'and he accepts'
        },
        { nearnpc: 'trollromance_arrg_attackable', r: 10, why: 'the arena' },
        { fight: 'trollromance_arrg_attackable', untilvar: 'troll_love', to: 40, tries: 4, why: 'kill him' },
        { stage: 40 },

        { note: 'wiki step 7: and then you walk out. The arena is a 614-tile pocket with no way out' },
        { note: 'on foot except its own doors, and those stay shut until Troll Stronghold is done -' },
        { note: 'which it is, since Troll Romance requires it. A player who could not open them would' },
        { note: 'be sealed in with the body.' },
        { go: [2916, 3628], exact: true, r: 40, why: 'north to the arena doors' },
        { loc: 'troll_stronghold_arena_exit_left', at: [2916, 3629], why: 'open them' },
        { go: [2916, 3632], exact: true, r: 20, why: 'and out' },

        { note: 'wiki step 7: pretty rocks, and then Ug needs insulting into asking her out' },
        { setpos: UG, why: 'back to Ug' },
        { talk: 'trollromance_ug', want: 'grandmother', why: 'the gems, and the shove' },
        { wait: 6, why: 'the completion is queued behind his last line' },
        { stage: 45 },
        { has: 'uncut_diamond' },
        { has: 'uncut_ruby', n: 2 },
        { has: 'uncut_emerald', n: 4 }
    ]
};

const p: any = H.makePlayer('trlrun', 3200, 3200);
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
