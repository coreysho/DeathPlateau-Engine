// THE FREMENNIK TRIALS, played through on foot.
//
// Quest 104 of the quest-by-quest pass. Unlike the last three this one is already well covered -
// fremtrials.ts (58 checks) and fremtrials2.ts (75) drive every trial through its real triggers -
// but both of them teleport, and nobody had ever walked the seven trials end to end in one go.
//
// The order is not the wiki's. Thorvald's trial comes second, because the ladder down to Koschei
// refuses a weapon or a piece of armour CARRIED as well as worn, and from the moment this walk
// picks up a knife for the lyre it is carrying a weapon. Peer's comes last, because his trial
// starts by banking everything you own.
//
//   NODE_MEMBERS=true npx tsx tools/sim/quest_viking_run.ts
import * as H from './harness.js';
import { play, Manifest, Step } from './questrun.js';

await H.boot();

// --- Rellekka. Every one of these came off the live spawn list, not the constants file.
const BRUNDT: [number, number, number] = [2658, 3673, 0];
const MANNI: [number, number, number] = [2660, 3673, 0];
const SIGLI: [number, number, number] = [2660, 3657, 0];
const OLAF: [number, number, number] = [2670, 3679, 0];
const SIGMUND: [number, number, number] = [2637, 3679, 0];
const THORVALD: [number, number, number] = [2665, 3690, 0];
const PEER: [number, number, number] = [2635, 3667, 0];
const SWENSEN: [number, number, number] = [2644, 3658, 0];
const ASKELADDEN: [number, number, number] = [2662, 3657, 0];
const SAILOR: [number, number, number] = [2630, 3692, 0];
const YRSA: [number, number, number] = [2623, 3676, 0];
const SKULGRIMEN: [number, number, number] = [2663, 3695, 0];
const FISHERMAN: [number, number, number] = [2640, 3698, 0];
const THORA: [number, number, number] = [2662, 3671, 0];

// --- the longhall
const KEG: [number, number] = [2660, 3674]; // viking_keg, the one by the bar
const PIPE: [number, number] = [2663, 3674]; // viking_pipe_end_longhall
const BACKSTAGE: [number, number] = [2667, 3683]; // viking_bard_backstage_door
const STAGE: [number, number] = [2660, 3684];

// --- Thorvald's arena
const WARRIOR_LADDER: [number, number] = [2667, 3694];
const THORVALD_HUT: [number, number] = [2667, 3693];
const ARENA_LADDER: [number, number] = [2672, 10099]; // viking_warrior_ladder_up, plane 2

// --- Swensen's maze. Room N's correct portal is vt_mazeportal_N, which is the puzzle's whole
// bookkeeping; the player still has to pick the right one of four by direction, and the seven
// directions spell S-W-E-N-S-E-N.
const ABODE_DOOR: [number, number] = [2645, 3663];
const MAZE_LADDER: [number, number] = [2644, 3657];
const PORTALS: [number, number][] = [
    [2631, 10002],
    [2639, 10015],
    [2656, 10004],
    [2665, 10018],
    [2630, 10023],
    [2656, 10037],
    [2666, 10029]
];
const MAZE_EXIT: [number, number] = [2665, 10037];

// --- Peer's house
const SEER_DOOR1: [number, number] = [2631, 3667];
const SEER_DOOR2: [number, number] = [2636, 3667];
const SEER_UP: [number, number] = [2631, 3663];
const SEER_EAST_LADDER: [number, number] = [2636, 3663]; // viking_seer_down_ladder - it goes UP
const SEER_MURAL: [number, number] = [2634, 3663];
const SEER_TRAP_E: [number, number] = [2636, 3663]; // viking_seer_trapdoor_closed, on plane 2
const CUPBOARD: [number, number] = [2629, 3660];
const TAP: [number, number] = [2629, 3661];
const DRAIN: [number, number] = [2629, 3662];
const RANGE: [number, number] = [2629, 3663];
const SCALES: [number, number] = [2632, 3665];
const FROZEN_TABLE: [number, number] = [2638, 3665];
const BOOKCASE: [number, number] = [2634, 3665];
const BOXES: [number, number] = [2633, 3660]; // viking_seerboxes_1, the jug
// the crate at 2638,3660 has viking_seercrate_2 on its west side and the room's wall on its
// east, so the only one of the pair that can be reached is the northern copy
const CRATE: [number, number] = [2638, 3661]; // viking_seercrate, the red herring
const CRATE2: [number, number] = [2637, 3660]; // viking_seercrate_2, the old red disk

// --- out in the world
const TREE: [number, number] = [2738, 3638]; // viking_musical_tree
const LALLI: [number, number, number] = [2771, 3618, 0];
const CAULDRON: [number, number] = [2772, 3623];
const SPINNER: [number, number] = [2617, 3659]; // viking_spinningwheel, in Rellekka
const WORKMAN: [number, number, number] = [2660, 3593, 0]; // vt_council_workmen, at the bridge
const ALTAR: [number, number] = [2626, 3598]; // viking_lake_shrine_altar
const DRAUGEN: [number, number] = [2637, 3622]; // ^viking_draugen_spot_1, with the roll pinned
const SALESMAN: [number, number, number] = [2697, 3495, 0]; // the Poison Salesman, Seers' Village

// SWENSEN IS INDOORS. He stands at 2644,3658 in a 42-tile room whose only way in is
// viking_abode_door at 2645,3663, and a click on him from the street is thrown away without a
// word - which is what made his link of Sigmund's chain and his own trial both fail silently.
// doors.rs2's ~open_door(500) swings it shut again, so the click is soft and repeated.
const IN_TO_SWENSEN: Step[] = [
    { go: [2645, 3664], why: "to Swensen's front door" },
    { loc: 'viking_abode_door', at: ABODE_DOOR, soft: true, why: 'open it if it swung shut' },
    { go: [2645, 3659], why: 'inside, to Swensen' }
];

// YRSA IS INDOORS TOO, and she wanders. Her shop is a 20-tile room behind viking_fur_door at
// 2627,3675; from the street she is only ever reachable when she happens to stand on the tile
// nearest the wall, which is why her link of the chain passed one run and failed the next.
const IN_TO_YRSA: Step[] = [
    { go: [2628, 3675], r: 256, why: "to Yrsa's shop door" },
    { loc: 'viking_fur_door', at: [2627, 3675], soft: true, why: 'open it if it swung shut' },
    { go: [2625, 3675], why: 'inside, to Yrsa' }
];

// Sigmund's chain, in the order the content and the wiki both use
const CHAIN: [string, [number, number, number], Step[]?][] = [
    ['viking_sailor', SAILOR],
    ['viking_olaf', OLAF],
    ['viking_clothing_shopkeeper', YRSA, IN_TO_YRSA],
    ['viking_brundt', BRUNDT],
    ['viking_sigli', SIGLI],
    ['viking_weapons_salesman', SKULGRIMEN],
    ['viking_fisherman1', FISHERMAN],
    ['viking_hallifred', SWENSEN, IN_TO_SWENSEN],
    ['viking_peer', PEER],
    ['viking_thorvald', THORVALD],
    ['viking_reveller_3', MANNI],
    ['viking_longhall_barkeep', THORA]
];

const m: Manifest = {
    quest: 'THE FREMENNIK TRIALS',
    source: 'oldschool.runescape.wiki/w/The_Fremennik_Trials/Quick_guide',
    stageVar: 'viking',
    done: 10, // ^viking_complete
    start: BRUNDT,
    steps: [
        { note: 'NOTE ON ASSERTIONS: %viking_bits is one varp carrying the six council votes,' },
        { note: "Swensen's bit at 27, every trial's own sub-steps, the three-bit Draugen spot and" },
        { note: 'the two-bit Koschei count - so its value is never worth asserting as a whole. The' },
        { note: 'votes are asserted through what each councillor says instead, and the quest stage' },
        { note: 'at the end proves all seven landed.' },
        { note: 'items: a knife for the lyre, a tinderbox for the strange object, a beer for the' },
        { note: 'council workman, a raw shark for the lake shrine, 5,250 coins for Askeladden and' },
        { note: 'the low alcohol keg, and the three vegetables for Lalli - which grow in the patch' },
        { note: "in Rellekka's south-east corner and are Farming's business, not this quest's." },
        { give: 'coins', n: 5250 },

        { note: 'wiki step 1: Brundt the Chieftain, in the longhall' },
        { go: [BRUNDT[0], BRUNDT[1]], why: 'to Brundt' },
        { talk: 'viking_brundt', picks: [1], want: 'win them over', why: 'take the quest' },
        { stage: 1 },

        { note: 'wiki step 2: Manni, and a drinking contest you are meant to lose' },
        { go: [MANNI[0], MANNI[1]], why: 'to Manni the Reveller' },
        { talk: 'viking_reveller_3', picks: [1], want: 'Down he goes', why: 'lose the first contest' },

        { note: "wiki step 3: Sigli the Huntsman, outside, and the hunters' talisman" },
        { go: [SIGLI[0], SIGLI[1]], why: 'to Sigli' },
        { talk: 'viking_sigli', picks: [1], want: 'which way to go', why: 'take the hunt' },
        { has: 'viking_draugen_talisman_uncharged' },

        { note: "THORVALD'S TRIAL COMES SECOND, out of the wiki's order and on purpose: the ladder" },
        { note: 'down to Koschei refuses a weapon or a piece of armour CARRIED as well as worn, and' },
        { note: 'from the knife onwards this walk is carrying a weapon. Nothing is lost by doing it' },
        { note: 'now - the trial needs no items at all.' },
        { go: [THORVALD[0], THORVALD[1]], why: 'to Thorvald the Warrior' },
        { talk: 'viking_thorvald', why: 'ask for his vote' },
        { strip: [], why: 'everything off before the ladder' },
        { go: [WARRIOR_LADDER[0], WARRIOR_LADDER[1] - 1], why: 'to the ladder behind his hut' },
        { loc: 'viking_warrior_ladder', at: WARRIOR_LADDER, op: 2, hop: true, why: 'down into the arena' },
        { level: 2 },
        { note: '[queue,viking_koschei_felled] says "He falls, and the dark folds over him" and' },
        { note: 'THEN summons the next form - a mesbox first, so the queue is sitting on a continue' },
        { note: 'that nothing clicks. `close` aborts it and `wait` only ticks; `resume` clicks it.' },
        { fight: 'viking_enemy1', tries: 2000, why: 'Koschei, first form' },
        { resume: true, want: 'rises out of the dark', why: 'he falls, and the next form comes up' },
        { fight: 'viking_enemy2', tries: 2000, why: 'second form' },
        { resume: true, want: 'rises out of the dark', why: 'and again' },
        { fight: 'viking_enemy3', tries: 2000, why: 'third form' },
        { resume: true, want: 'much, much', why: 'three down, and something larger comes up' },
        { note: 'THE FOURTH FORM IS NOT PART OF THE TRIAL and is not meant to be killed: 255' },
        { note: 'hitpoints behind 255 defence, fought bare-handed. The wiki says to let it beat' },
        { note: 'you, and [label,viking_koschei_player_death] puts you in his hut with your food' },
        { note: 'and jewellery, which fremtrials.ts checks. A harness player cannot die (the' },
        { note: 'manifest stubs applyDamage so nothing incidental kills the walk), so this one' },
        { note: 'leaves by the ladder instead. Three forms is what Thorvald asked for.' },
        { loc: 'viking_warrior_ladder_up', at: ARENA_LADDER, hop: true, why: 'climb out of the arena' },
        { level: 0 },
        { go: [THORVALD_HUT[0], THORVALD_HUT[1]], r: 192, why: "to Thorvald's hut" },
        { talk: 'viking_thorvald', want: 'vote', why: 'claim the vote' },

        { note: 'wiki step 4: Olaf the Bard, twice - the second time is what sets his trial going' },
        { go: [OLAF[0], OLAF[1]], why: 'to Olaf' },
        { talk: 'viking_olaf', want: 'enchanted one', why: 'ask for his vote' },

        { note: 'wiki step 5: a branch off the swaying tree east of Rellekka, carved with a knife' },
        { give: 'knife' },
        { give: 'rune_axe' },
        { go: [TREE[0], TREE[1] - 2], r: 192, why: 'east to the swaying tree' },
        { loc: 'viking_musical_tree', at: TREE, want: 'branch', why: 'cut a branch' },
        { has: 'viking_musical_tree_branch' },
        { use: ['knife', 'viking_musical_tree_branch'], want: 'lyre', why: 'carve it' },
        { has: 'viking_unstrung_lyre' },

        { note: "and the golden fleece, which is Lalli's: he wants the pet rock Askeladden carries," },
        { note: 'and then three vegetables in his stew' },
        { go: [LALLI[0] + 1, LALLI[1]], r: 192, why: 'to Lalli' },
        { talk: 'viking_lalli_troll', want: 'Askeladden', why: 'he points at Askeladden' },
        { go: [ASKELADDEN[0], ASKELADDEN[1]], r: 256, why: 'back to Rellekka, to Askeladden' },
        { talk: 'viking_askelapen', want: 'rock', why: 'the pet rock' },
        { has: 'vt_useless_rock' },
        { give: 'potato' },
        { give: 'cabbage' },
        { give: 'onion' },
        { go: [CAULDRON[0] - 1, CAULDRON[1]], r: 256, why: "back to Lalli's cauldron" },
        { useLoc: 'viking_troll_cauldron', at: CAULDRON, obj: 'vt_useless_rock', why: 'the rock in the stew' },
        { useLoc: 'viking_troll_cauldron', at: CAULDRON, obj: 'potato', why: 'the potato' },
        { useLoc: 'viking_troll_cauldron', at: CAULDRON, obj: 'cabbage', why: 'the cabbage' },
        { useLoc: 'viking_troll_cauldron', at: CAULDRON, obj: 'onion', why: 'and the onion' },
        { go: [LALLI[0] + 1, LALLI[1]], why: 'to Lalli' },
        { talk: 'viking_lalli_troll', want: 'fleece', why: 'he tastes it' },
        { has: 'viking_golden_fleece' },

        { note: 'the fleece spins into golden wool, and the wool strings the lyre' },
        { go: [SPINNER[0] + 1, SPINNER[1]], r: 256, why: "back to Rellekka's spinning wheel" },
        { useLoc: 'viking_spinningwheel', at: SPINNER, obj: 'viking_golden_fleece', want: 'wool', why: 'spin it' },
        { has: 'viking_golden_wool' },
        { use: ['viking_golden_wool', 'viking_unstrung_lyre'], want: 'lyre', why: 'string the lyre' },
        { has: 'viking_strung_lyre' },

        { note: "wiki step 8: the Poison Salesman in Seers' Village sells the low alcohol keg" },
        { setpos: SALESMAN, why: "to Seers' Village - world travel, not the quest" },
        { talk: 'poison_salesman', picks: [1, 1], want: 'keg', why: 'buy a low alcohol keg' },
        { has: 'viking_low_alcahol_beerkeg' },

        { note: 'wiki step 9: the Draugen. The hunt picks one of eight spots with random(8), so the' },
        { note: 'roll is pinned and the butterfly settles on the first of them.' },
        { setpos: SIGLI, why: 'back north to Rellekka - world travel, not the quest' },
        { rng: 0.0, why: 'random(8) = 0, the first Draugen spot' },
        { held: 'viking_draugen_talisman_uncharged', op: 1, want: 'butterfly settles', why: 'start the hunt' },
        { rng: null },
        { note: 'the talisman only reveals the Draugen when you are within ONE tile of the spot,' },
        { note: 'so this walk has to be exact - two tiles of slack is two tiles too many' },
        { go: [DRAUGEN[0] - 1, DRAUGEN[1]], r: 192, exact: true, why: 'out onto the moors, right up to the butterfly' },
        { held: 'viking_draugen_talisman_uncharged', op: 1, why: 'press the talisman to it' },
        { fight: 'viking_draugen', tries: 2000, why: 'bind the Draugen' },
        { has: 'viking_draugen_talisman' },

        { note: 'wiki step 10: the council workman at the bridge trades a strange object for a beer' },
        { give: 'beer' },
        { go: [WORKMAN[0], WORKMAN[1] - 1], r: 192, why: 'to the bridge' },
        { useNpc: 'vt_council_workmen', obj: 'beer', want: 'paper parcel', why: 'buy him a drink' },
        { has: 'viking_firecracker' },

        { note: 'wiki step 11: the strange altar west of the bridge enchants the lyre' },
        { give: 'raw_shark' },
        { go: [ALTAR[0] + 1, ALTAR[1]], r: 192, why: 'west to the lake shrine' },
        { useLoc: 'viking_lake_shrine_altar', at: ALTAR, obj: 'raw_shark', want: 'lyre', why: 'make the offering' },
        { has: 'viking_enchanted_strung_lyre' },

        { note: 'wiki step 12: Sigli takes the charged talisman' },
        { go: [SIGLI[0], SIGLI[1]], r: 256, why: 'back to Sigli' },
        { talk: 'viking_sigli', want: 'my vote', why: 'the Draugen is bound' },

        { note: 'wiki step 13: the strange object, lit, goes in the longhall pipe' },
        { give: 'tinderbox' },
        { use: ['tinderbox', 'viking_firecracker'], want: 'hiss', why: 'light it' },
        { has: 'viking_firecracker_lit' },
        { go: [PIPE[0] - 1, PIPE[1]], why: 'to the pipe on the longhall wall' },
        { loc: 'viking_pipe_end_longhall', at: PIPE, why: 'put it inside' },
        { hasnt: 'viking_firecracker_lit' },

        { note: 'wiki step 14: the back door, the stage, and the enchanted lyre' },
        { go: [BACKSTAGE[0] + 1, BACKSTAGE[1]], why: 'round to the back door' },
        { loc: 'viking_bard_backstage_door', at: BACKSTAGE, hop: true, want: 'good to go through', why: 'the bouncer waves you in' },
        { go: [STAGE[0], STAGE[1]], why: 'out onto the stage' },
        { held: 'viking_enchanted_strung_lyre', op: 1, want: 'vote', why: 'play' },
        { loc: 'viking_bard_backstage_door', at: BACKSTAGE, hop: true, why: 'back out of the door' },

        { note: 'wiki step 15: a keg off the longhall table, and the rematch' },
        { go: [KEG[0], KEG[1] - 1], why: 'to the keg by the bar' },
        { loc: 'viking_keg', at: KEG, want: 'keg', why: 'take one' },
        { has: 'viking_beerkeg' },
        { go: [MANNI[0], MANNI[1]], why: 'to Manni' },
        { talk: 'viking_reveller_3', want: 'my vote', why: 'the rematch' },

        { note: "wiki step 17: Sigmund's chain. Thirteen people asked in order, Askeladden paid" },
        { note: '5,000 coins, and then the same thirteen again in reverse with what each one wants.' },
        { go: [SIGMUND[0], SIGMUND[1]], why: 'to Sigmund the Merchant' },
        { talk: 'viking_sigmund', picks: [1], why: 'ask about the merchant trial' },
        ...(CHAIN.flatMap(([npc, at, approach]) => [...(approach ?? [{ go: [at[0], at[1]], r: 256, why: 'to ' + npc }]), { talk: npc, picks: [1], tries: 6, why: 'ask' }]) as Step[]),
        { go: [ASKELADDEN[0], ASKELADDEN[1]], r: 256, why: 'to Askeladden' },
        { note: 'Askeladden asks twice: the merchant-trial option, and then Yes to the 5,000gp.' },
        { note: 'What he hands over is viking_promissary_note2, which is what THORA wants - the' },
        { note: 'plain viking_promissary_note is Brundt’s, further up the chain.' },
        { talk: 'viking_askelapen', picks: [1, 1], tries: 2, want: 'written promise', why: 'pay him 5,000 coins' },
        { has: 'viking_promissary_note2' },
        ...(CHAIN.slice()
            .reverse()
            .flatMap(([npc, at, approach]) => [...(approach ?? [{ go: [at[0], at[1]], r: 256, why: 'back to ' + npc }]), { talk: npc, picks: [1], tries: 6, why: 'deliver' }]) as Step[]),
        { go: [SIGMUND[0], SIGMUND[1]], r: 256, why: 'back to Sigmund' },
        { talk: 'viking_sigmund', want: 'vote', why: 'the chain is closed' },

        { note: 'wiki steps 18-19: Swensen, his house door, and the portal maze. Every room in the' },
        { note: 'maze is sealed from every other on foot, so the seven portals are the only route -' },
        { note: 'S, W, E, N, S, E, N.' },
        ...IN_TO_SWENSEN,
        { talk: 'viking_hallifred', picks: [2], why: 'ask about becoming a Fremennik' },
        { go: [MAZE_LADDER[0] + 1, MAZE_LADDER[1]], why: 'to the ladder inside' },
        { loc: 'vt_mazeladdertopentrance', at: MAZE_LADDER, hop: true, why: 'down into the maze' },
        ...(PORTALS.flatMap((at, i) => [{ loc: 'vt_mazeportal_' + (i + 1), at, hop: true, why: 'portal ' + (i + 1) + ': ' + 'SWENSEN'[i] }]) as Step[]),
        { loc: 'vt_mazeladderexit', at: MAZE_EXIT, hop: true, why: 'out the far side' },
        ...IN_TO_SWENSEN,
        { talk: 'viking_hallifred', picks: [2], want: 'vote', why: 'claim the vote' },

        { note: "wiki steps 30-36: Peer the Seer's trial, which is last because the first thing it" },
        { note: 'does is bank everything you own. One riddle out of four, picked with random(4).' },
        { go: [PEER[0], PEER[1]], why: 'to Peer the Seer' },
        { rng: 0.0, why: 'random(4) = 0, the Time riddle' },
        { note: "Peer's own menu still carries the merchant-trial option after the chain is done," },
        { note: 'so the first answer declines that and the second answers the riddle' },
        { talk: 'viking_peer', picks: [2, 2, 1], want: 'You do listen', why: 'answer the riddle, and let him bank everything' },
        { rng: null },

        { note: 'in the front door, up the west ladder, and the five searches' },
        { go: [SEER_DOOR1[0], SEER_DOOR1[1] + 1], why: 'to the front door' },
        { loc: 'viking_seers_door1', at: SEER_DOOR1, hop: true, why: 'in' },
        { loc: 'viking_seer_up_ladder', at: SEER_UP, hop: true, why: 'up the west ladder' },
        { level: 2 },
        { loc: 'viking_cupboardhigh', at: CUPBOARD, why: 'open the cupboard' },
        { loc: 'viking_cupboardopen_high', at: CUPBOARD, op: 2, want: 'bucket', why: 'the bucket' },
        { has: 'viking_bucket_empty' },
        { loc: 'viking_seerboxes_1', at: BOXES, want: 'jug', why: 'the jug' },
        { has: 'viking_jug_empty' },
        { loc: 'viking_seer_bookcase', at: BOOKCASE, want: 'wooden disk', why: 'the wooden disk' },
        { has: 'viking_uncoloured_wooden_coin' },
        { loc: 'viking_seercrate_2', at: CRATE2, want: 'red disk', why: 'the old red disk' },
        { has: 'viking_dummy_coin' },
        { loc: 'viking_seercrate', at: CRATE, want: 'herring', why: 'the red herring' },
        { has: 'viking_red_herring' },

        { note: 'the herring cooks down to red goop, and the goop paints the second disk' },
        { useLoc: 'viking_seer_range', at: RANGE, obj: 'viking_red_herring', want: 'sticky red goop', why: 'cook it' },
        { has: 'viking_red_splat' },
        { use: ['viking_red_splat', 'viking_uncoloured_wooden_coin'], want: 'red', why: 'paint the wooden disk' },
        { has: 'viking_red_wooden_coin' },

        { note: 'both red disks go on the mural, which is on the ground floor in the EAST room -' },
        { note: 'down the east trapdoor' },
        { note: 'the east trapdoor starts SHUT and takes two clicks: one to lift it, one to climb' },
        { loc: 'viking_seer_trapdoor_closed', at: SEER_TRAP_E, soft: true, why: 'lift the trapdoor' },
        { loc: 'viking_seer_trapdoor_open', at: SEER_TRAP_E, hop: true, why: 'down the east trapdoor' },
        { level: 0 },
        { note: 'ONE click does both disks: the handler takes the pair out of the pack together and' },
        { note: 'puts them in the two hollows, which is what the two mounted heads are a clue to.' },
        { note: 'One disk alone is refused and kept - fremtrials.ts checks that half.' },
        { useLoc: 'viking_seers_mural', at: SEER_MURAL, obj: 'viking_dummy_coin', want: 'lid', why: 'both red disks into the mural' },
        { has: 'viking_vase_lid' },
        { hasnt: 'viking_red_wooden_coin' },

        { note: 'back up, and the water puzzle: the scales want four fifths of a bucket, and a' },
        { note: 'bucket of 5 and a jug of 3 can only make 4 one way round' },
        { note: 'and back up the EAST ladder, not the west one: the mural is in the east room and' },
        { note: 'the two ground-floor rooms do not connect. viking_seer_down_ladder is its name' },
        { note: 'in the cache and it goes UP.' },
        { loc: 'viking_seer_down_ladder', at: SEER_EAST_LADDER, hop: true, why: 'up the east ladder' },
        { level: 2 },
        { useLoc: 'viking_seers_tap', at: TAP, obj: 'viking_bucket_empty', want: 'brim', why: 'fill the bucket: 5' },
        { use: ['viking_bucket_5', 'viking_jug_empty'], why: 'bucket into jug: jug 3, bucket 2' },
        { useLoc: 'viking_seers_drain', at: DRAIN, obj: 'viking_jug_3', why: 'empty the jug' },
        { use: ['viking_bucket_2', 'viking_jug_empty'], why: 'bucket into jug: jug 2, bucket 0' },
        { useLoc: 'viking_seers_tap', at: TAP, obj: 'viking_bucket_empty', why: 'fill the bucket again: 5' },
        { use: ['viking_bucket_5', 'viking_jug_2'], why: 'top the jug up: jug 3, bucket 4' },
        { has: 'viking_bucket_4' },
        { useLoc: 'viking_seer_chest_closed_scales', at: SCALES, obj: 'viking_bucket_4', want: 'vase', why: 'the scales give' },
        { has: 'viking_airtight_vase' },

        { note: 'the vase takes water, the lid seals it, the frozen table cracks it open, and the' },
        { note: 'range melts the ice off the key' },
        { note: 'the vase is not a container the tap understands - water goes in from the bucket,' },
        { note: 'which still holds the four fifths the scales were weighed with' },
        { use: ['viking_bucket_4', 'viking_airtight_vase'], want: 'pour the water into the vase', why: 'fill the vase' },
        { use: ['viking_vase_lid', 'viking_airtight_vase_water'], why: 'seal it' },
        { has: 'viking_airtight_vase_with_lid_water' },
        { useLoc: 'viking_small_table_frozen', at: FROZEN_TABLE, obj: 'viking_airtight_vase_with_lid_water', want: 'crack', why: 'freeze it' },
        { held: 'viking_airtight_vase_with_lid_frozen', op: 1, why: 'open the cracked vase' },
        { has: 'viking_key_in_ice' },
        { useLoc: 'viking_seer_range', at: RANGE, obj: 'viking_key_in_ice', want: 'brass key', why: 'melt the ice off it' },
        { has: 'viking_key' },

        { note: 'and out the far door, which is what "come out the other side" means' },
        { note: 'the east trapdoor starts SHUT and takes two clicks: one to lift it, one to climb' },
        { loc: 'viking_seer_trapdoor_closed', at: SEER_TRAP_E, soft: true, why: 'lift the trapdoor' },
        { loc: 'viking_seer_trapdoor_open', at: SEER_TRAP_E, hop: true, why: 'down the east trapdoor' },
        { level: 0 },
        { go: [SEER_DOOR2[0], SEER_DOOR2[1] - 1], why: 'to the far door' },
        { loc: 'viking_seers_door2', at: SEER_DOOR2, hop: true, want: 'vote', why: 'out the other side' },

        { note: 'wiki step 37: Brundt, with all seven votes' },
        { go: [BRUNDT[0], BRUNDT[1]], r: 256, why: 'back to Brundt' },
        { note: 'Brundt is link 4 of the chain as well, and his menu still offers it after the' },
        { note: 'chain is closed, so the first answer declines it' },
        { talk: 'viking_brundt', picks: [2], want: 'Fremennik', why: 'finish the quest' },
        { stage: 10 }
    ]
};

const p: any = H.makePlayer('vikrun', m.start[0], m.start[1]);
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
