// GHOSTS AHOY, played through on foot.
//
// Quest 79 of the quest-by-quest pass. Necrovarus has held the dead of Port Phasmatys for two
// hundred years with a book he buried on an island, and the way to prove it is a cup of tea, a
// model ship, a card game, a bedsheet and ten signatures.
//
// The wreck's ladders are not re-walked here: tools/sim/ahoyladders.ts already asserts that
// configs/ahoy_ladders.enum covers every placement on both ships with a landing tile, which is a
// better check than one route through it. This walk jumps between the wreck's decks and spends its
// steps on the quest.
//
//   NODE_MEMBERS=true npx tsx tools/sim/quest_ahoy_run.ts
import * as H from './harness.js';
import { play, Manifest } from './questrun.js';

await H.boot();

const VELORINA: [number, number, number] = [3678, 3510, 0];
const NECROVARUS: [number, number, number] = [3663, 3517, 0];
const CRONE: [number, number, number] = [3461, 3556, 0];
const OLDMAN: [number, number, number] = [3617, 3545, 1];
const BOAT_IN_CHEST: [number, number] = [3619, 3544]; // L0, the hold
const MAST: [number, number] = [3619, 3543]; // L2, the quarterdeck
const CAPTAIN_CHEST: [number, number] = [3618, 3541]; // L2
const LOBSTER_CHEST: [number, number] = [3621, 3543]; // L0
const ROCK_CHEST: [number, number] = [3602, 3543]; // L0, across the rocks
const PIER: [number, number, number] = [3703, 3488, 0];
const DIG: [number, number, number] = [3803, 3530, 0];
const AKHARANU: [number, number, number] = [3690, 3496, 0];
const ROBIN: [number, number, number] = [3675, 3491, 0];
const INNKEEPER: [number, number, number] = [3681, 3496, 0];
const GRAVINGAS: [number, number, number] = [3662, 3496, 0];
const TEMPLE_DOOR: [number, number] = [3656, 3514]; // L1
const COFFIN: [number, number] = [3659, 3513]; // L1

// The ghost villagers, in the order they stand round the town. Twelve are placed and the petition
// wants ten names, so the counter at the end is the real check and each individual talk is soft: a
// villager the walk cannot stand next to is worth reporting but is not a failure while ten others
// signed. All twelve are walked, because they wander and a given one is not always reachable; the
// ones after the tenth name only say the sheet is full, which costs nothing.
const VILLAGERS: [number, number][] = [
    [3656, 3466],
    [3664, 3491],
    [3663, 3498],
    [3662, 3463],
    [3663, 3501],
    [3663, 3490],
    [3666, 3474],
    [3667, 3502],
    [3676, 3480],
    [3673, 3499],
    [3678, 3475],
    [3684, 3482]
];

const sign = (i: number): any[] => [
    { setpos: [VILLAGERS[i][0], VILLAGERS[i][1] + 1, 0], why: 'to ghost villager ' + (i + 1) },
    { talk: 'ahoy_ghost_villager', tries: 8, soft: true, why: 'signature ' + (i + 1) }
];

const m: Manifest = {
    quest: 'GHOSTS AHOY',
    source: 'oldschool.runescape.wiki/w/Ghosts_Ahoy',
    stageVar: 'ahoy_questvar',
    done: 15, // ^ahoy_complete
    start: VELORINA,
    steps: [
        { note: 'requirements: Priest in Peril and The Restless Ghost. Items: a ghostspeak amulet,' },
        { note: 'nettle tea in a china cup with milk, a needle, silk, thread, red/blue/yellow dye,' },
        { note: 'an oak longbow, a bucket of ectoplasm and a spade.' },
        { setvar: 'priestperil', to: 60, why: '^priestperil_complete' },
        { setvar: 'prieststart', to: 5, why: '^priest_complete' },
        { give: 'amulet_of_ghostspeak' },
        { held: 'amulet_of_ghostspeak', op: 2, why: 'without it no ghost in the town can be heard' },
        { worn: 'amulet_of_ghostspeak' },
        { give: 'chinacup_of_nettletea_milky' },
        { give: 'needle' },
        { give: 'silk' },
        { give: 'thread' },
        { give: 'reddye' },
        { give: 'bluedye' },
        { give: 'yellowdye' },
        { give: 'oak_longbow' },
        { give: 'bucket_ectoplasm' },
        { give: 'spade' },

        { note: 'wiki step 1: Velorina cannot say goodbye to her husband' },
        { setpos: VELORINA, why: 'to Velorina' },
        { talk: 'ahoy_velorina', picks: ["What's wrong with this town?"], want: 'He will say no', why: 'Necrovarus holds the town' },
        { stage: 1 },

        { note: 'wiki step 2: and he does say no' },
        { setpos: NECROVARUS, why: 'to Necrovarus at the Ectofuntus' },
        { talk: 'ahoy_necrovarus', want: 'has not stopped being the answer', why: 'ask him to let them go' },
        { stage: 2 },
        { setpos: VELORINA, why: 'back to Velorina' },
        { talk: 'ahoy_velorina', want: 'slayer tower', why: 'she names the old crone' },
        { stage: 3 },

        { note: 'wiki step 3: the crone wants nettle tea in a china cup, with milk' },
        { setpos: CRONE, why: 'to the crone east of the slayer tower' },
        { note: 'carrying the tea already, the first click hands it straight over' },
        { talk: 'ahoy_crone', want: 'Dragontooth Island', why: 'the tea, and then the book' },
        { stage: 4 },

        { note: 'wiki step 4: the wreck west of the town. The old man wants his son ship back.' },
        { setpos: OLDMAN, why: 'to the old man on the deck' },
        { talk: 'ahoy_oldman', want: 'in pieces', why: 'his son never got it' },
        { setpos: [BOAT_IN_CHEST[0], BOAT_IN_CHEST[1] - 1, 0], why: 'down into the hold' },
        { loc: 'ahoy_chest_locked', at: BOAT_IN_CHEST, want: 'nine pieces', why: 'the chest at the aft end' },
        { has: 'ahoy_toy_boat' },

        { note: 'the mast only shows its colours when the wind drops, which is a coin flip each' },
        { note: 'time - so this is one step with a lot of tries rather than a pinned roll.' },
        { setpos: [MAST[0] + 1, MAST[1], 2], why: 'up to the quarterdeck' },
        { loc: 'ahoy_mast', at: MAST, tries: 12, want: 'red, then blue, then yellow', why: 'read the flag' },
        { varis: 'ahoy_windspeed', to: 1 },

        { note: 'mend her with a needle, silk and thread, then dye the flag to match' },
        { use: ['needle', 'ahoy_toy_boat'], want: 'silk sail', why: 'mend the hull' },
        { has: 'ahoy_toy_boat_repaired' },
        { use: ['reddye', 'ahoy_toy_boat_repaired'], want: 'three bands', why: 'and dye the flag' },
        { varis: 'ahoy_subquest_toyboat', to: 3 },
        { setpos: OLDMAN, why: 'back to the old man' },
        { talk: 'ahoy_oldman', want: 'bone-handled key', why: 'hand the ship over' },
        { has: 'ahoy_chest_key' },

        { note: 'wiki step 5: three map scraps, one in each of three chests' },
        { setpos: [CAPTAIN_CHEST[0] + 1, CAPTAIN_CHEST[1], 2], why: 'to the captain’s chest' },
        { loc: 'ahoy_chest_locked', at: CAPTAIN_CHEST, want: 'third of a map', why: 'the key turns' },
        { has: 'ahoy_map_scrap_1' },
        { setpos: [LOBSTER_CHEST[0] + 1, LOBSTER_CHEST[1], 0], why: 'to the chest in the hold' },
        { loc: 'ahoy_chest_locked', at: LOBSTER_CHEST, want: 'lobster the size of a dog', why: 'something inside it moves' },
        { fight: 'giant_lobster', tries: 4, r: 12, why: 'and it comes out sideways' },
        { loc: 'ahoy_chest_locked', at: LOBSTER_CHEST, want: 'third of a map', why: 'now search it' },
        { has: 'ahoy_map_scrap_2' },
        { setpos: [ROCK_CHEST[0] + 1, ROCK_CHEST[1], 0], why: 'across the rocks past the gangplank' },
        { loc: 'ahoy_chest_locked', at: ROCK_CHEST, want: 'third of a map', why: 'the one nobody reached' },
        { has: 'ahoy_map_scrap_3' },
        { use: ['ahoy_map_scrap_1', 'ahoy_map_scrap_2'], want: 'make one map', why: 'three scraps, one map' },
        { has: 'ahoy_map_complete' },
        { stage: 5 },

        { note: 'wiki step 6: the ghost captain sails to Dragontooth Island, and the figures on the' },
        { note: 'map point somewhere other than the cross' },
        { setpos: PIER, why: 'to the ghost captain on the pier' },
        { talk: 'ahoy_ghost_captain_1', want: 'Dragontooth Island', why: 'take me out there' },
        { setpos: DIG, why: 'to where the figures point' },
        { held: 'spade', op: 1, want: 'Book of Haricanto', why: 'dig' },
        { has: 'ahoy_book_of_haricanto' },
        { stage: 6 },

        { note: 'wiki step 7: Ak-Haranu has the manual and wants a bow with Robin’s name on it' },
        { setpos: AKHARANU, why: 'back to the dock' },
        { talk: 'ahoy_akharanu_multi', want: 'bow with his name on it', why: 'he names his price' },
        { varis: 'ahoy_subquest_bow', to: 1 },

        { note: 'Robin will not sign one until he owes money, and he owes money by losing four' },
        { note: 'games of Rune-Draw. Both draws are random(13)+1, so pinning the rng makes every' },
        { note: 'hand a tie - this has to be played out.' },
        { setpos: ROBIN, why: 'to Robin in the inn' },
        { talk: 'ahoy_robin', want: 'Beat me four times', why: 'he offers a game' },
        { note: 'the talk step retries on `until`, not on `want`, and the fourth win chains' },
        { note: 'straight into him signing the bow - so the signed bow IS the stop condition.' },
        { talk: 'ahoy_robin', picks: ['Draw.'], tries: 40, until: 'oak_longbow_signed', why: 'and loses four of them' },
        { has: 'oak_longbow_signed' },
        { setpos: AKHARANU, why: 'back to Ak-Haranu' },
        { talk: 'ahoy_akharanu_multi', want: 'Take the manual', why: 'one bow, signed by Robin' },
        { has: 'ahoy_translation_manual' },
        { stage: 7 },
        { use: ['ahoy_translation_manual', 'ahoy_book_of_haricanto'], want: 'robes are on the list', why: 'read the book' },
        { stage: 8 },

        { note: 'wiki step 8: the innkeeper has nineteen beds and no guests' },
        { setpos: INNKEEPER, why: 'to the ghost innkeeper' },
        { talk: 'ahoy_ghost_innkeeper', want: 'strip the beds', why: 'ask for work' },
        { has: 'ahoy_bedsheet' },
        { use: ['bucket_ectoplasm', 'ahoy_bedsheet'], want: 'will not stop moving', why: 'dye it in ectoplasm' },
        { has: 'ahoy_bedsheetgreen' },
        { held: 'ahoy_bedsheetgreen', op: 2, want: 'over your head', why: 'and wear it' },
        { worn: 'ahoy_bedsheetgreen' },

        { note: 'wiki step 9: Gravingas hands out the petition and the town signs it for a ghost' },
        { setpos: GRAVINGAS, why: 'to Gravingas in the square' },
        { talk: 'ahoy_ghost_protestor', want: 'Ten names', why: 'he hands over the petition' },
        { has: 'ahoy_petition' },
        ...sign(0),
        ...sign(1),
        ...sign(2),
        ...sign(3),
        ...sign(4),
        ...sign(5),
        ...sign(6),
        ...sign(7),
        ...sign(8),
        ...sign(9),
        ...sign(10),
        ...sign(11),
        { varis: 'ahoy_signaturecounter', to: 10 },
        { setpos: GRAVINGAS, why: 'back to Gravingas' },
        { talk: 'ahoy_ghost_protestor', want: 'Take it to him', why: 'ten names' },
        { stage: 9 },

        { note: 'wiki step 10: shown ten names, Necrovarus drops a key out of his robes' },
        { setpos: NECROVARUS, why: 'to Necrovarus' },
        { talk: 'ahoy_necrovarus', want: 'key of yellowed bone', why: 'show him the petition' },
        { stage: 10 },
        { take: 'ahoy_bone_key', r: 8, why: 'and pick the key up' },
        { has: 'ahoy_bone_key' },

        { note: 'wiki step 11: the bone key opens one door, and his coffin is through it' },
        { setpos: [TEMPLE_DOOR[0] + 1, TEMPLE_DOOR[1], 1], why: 'to the temple’s upper floor' },
        { useLoc: 'ahoy_harbour_door', at: TEMPLE_DOOR, obj: 'ahoy_bone_key', want: 'bone lock', why: 'unlock it' },
        { loc: 'ahoy_coffin', at: COFFIN, want: 'robes of Necrovarus', why: 'open the coffin' },
        { has: 'ahoy_robes_of_necrovarus' },

        { note: 'wiki step 12: the crone knows what the robes are, and then he has to be told' },
        { setpos: CRONE, why: 'to the crone' },
        { talk: 'ahoy_crone', want: 'let him see you holding them', why: 'she explains' },
        { stage: 11 },
        { setpos: NECROVARUS, why: 'back to Necrovarus' },
        { talk: 'ahoy_necrovarus', want: 'barrier over the town thins', why: 'and he lets the town go' },
        { stage: 12 },

        { note: 'and Velorina has waited two hundred years for this' },
        { setpos: VELORINA, why: 'to Velorina' },
        { talk: 'ahoy_velorina', want: 'crowd looks back', why: 'tell her' },
        { stage: 15 },
        { has: 'ectophial' }
    ]
};

const p: any = H.makePlayer('ahoyrun', m.start[0], m.start[1]);
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
