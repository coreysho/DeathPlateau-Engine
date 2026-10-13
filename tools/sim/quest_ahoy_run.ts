// GHOSTS AHOY, played through on foot. Nothing here teleports.
//
// The step list is THIS SERVER'S quest, not the real one - the two have very little in common, and
// that difference is the subject of its own report. Each `note` says which step of the real quest
// the stretch below it stands in for, so the trace doubles as the comparison.
//
// WHAT THE FIRST RUN TAUGHT THE MANIFEST. ahoy_town_barrier is placed TWICE, at 3652,3485 and at
// 3659,3508, and that is not redundancy: Velorina lives inside the walls while Necrovarus, the
// Ectofuntus, the wreck and the crone are all outside them. There is no open-ground route between
// the two halves, so every leg of this quest crosses a barrier, and a run that only knew about the
// south gate got as far as Velorina and stopped. The real quest has exactly this shape.
//
// Real requirements are Priest in Peril and The Restless Ghost. This server checks NEITHER, so the
// two setvars below are marked for what they are: the run satisfies the real requirement to keep
// the playthrough honest, and the audit records that the quest never asked.
//
//   npx tsx tools/sim/quest_ahoy_run.ts
import * as H from './harness.js';
import { play, Manifest, Step } from './questrun.js';

await H.boot();

// The two gates. The handler reads which side you are on and steps you two tiles through, so one
// pair of steps serves both directions.
const southGate: Step[] = [
    { go: [3651, 3485], r: 160, why: 'the south gate' },
    { loc: 'ahoy_town_barrier', at: [3652, 3485], why: 'pass the energy barrier' }
];
// ahoy_harbour_door is ONE loc type placed seven times, and three of those placements stand between
// the player and the quest: Robin's house, the temple's upper floor and the wreck's middle deck. The
// route finder will not open a door, so each is a step. Soft, because a door left open by an earlier
// leg has swapped itself for the _open variant and there is nothing on the tile to click.
const innDoor: Step[] = [
    { go: [3670, 3496], r: 160, why: "outside Robin's house" },
    { loc: 'ahoy_harbour_door', at: [3670, 3497], why: 'open the tatty door', soft: true }
];
const northGate: Step[] = [
    { go: [3659, 3506], r: 160, why: 'the north gate' },
    { loc: 'ahoy_town_barrier', at: [3659, 3508], why: 'pass the energy barrier' }
];

const m: Manifest = {
    quest: 'GHOSTS AHOY',
    source: 'oldschool.runescape.wiki/w/Ghosts_Ahoy/Quick_guide (2004 quest, unchanged in OSRS)',
    stageVar: 'ahoy_questvar',
    done: 10,
    start: [3648, 3485, 0],
    steps: [
        { give: 'amulet_of_ghostspeak' },
        { give: 'ectotoken', n: 30 },
        { give: 'silk' },
        { give: 'bowl_nettletea' },
        { give: 'magic_longbow' },
        { give: 'spade' },
        { setvar: 'priestperil', to: 60, why: 'real requirement - this quest never checks it' },
        { setvar: 'prieststart', to: 5, why: 'real requirement - not checked either' },

        { note: 'real step 2: into Port Phasmatys and talk to Velorina' },
        ...southGate,
        { go: [3677, 3510], why: "Velorina's house" },
        { talk: 'ahoy_velorina', picks: [1] },
        { stage: 1 },

        { note: 'real step 3: Necrovarus at the Ectofuntus - which is OUTSIDE the walls' },
        ...northGate,
        { go: [3658, 3516], why: 'the Ectofuntus' },
        { talk: 'ahoy_necrovarus' },
        { stage: 2 },

        { note: 'real step 4: back to Velorina. Here she hands out the petition herself' },
        ...northGate,
        { go: [3677, 3510] },
        { talk: 'ahoy_velorina' },
        { stage: 3 },
        { has: 'ahoy_petition' },

        { note: 'no real counterpart: three ghosts each want a favour before they will sign' },
        ...innDoor,
        { go: [3676, 3490], why: 'Robin, in the inn' },
        { talk: 'ahoy_robin', want: 'model ship' },
        { go: [3681, 3495], why: 'the ghost innkeeper, for the bedsheet' },
        { talk: 'ahoy_ghost_innkeeper' },
        { has: 'ahoy_bedsheet' },

        { note: 'real step 7: the wrecked ship. Ours holds the model ship, not the map' },
        ...northGate,
        { go: [3610, 3543], r: 160, why: 'the wreck, west along the shore' },
        { loc: 'ahoy_ghostship_ladder', at: [3609, 3543], why: 'climb to the deck' },
        { level: 1 },
        { loc: 'ahoy_harbour_door', at: [3615, 3543], why: 'open the deck door', soft: true },
        { go: [3621, 3543], why: 'along the deck to the skeleton' },
        { loc: 'ahoy_skull_captain', at: [3622, 3543], why: 'search him for the chest key' },
        { has: 'ahoy_chest_key' },
        // NOT the ladder at 3615,3545: it is unreachable from every side, and its mate on the
        // quarterdeck drops you inside the hull. See the report. This pair works.
        { go: [3615, 3542], why: 'the forward ladder' },
        { loc: 'ahoy_ghostship_ladder', at: [3615, 3541], why: 'up to the quarterdeck' },
        { level: 2 },
        { go: [3617, 3541] },
        { loc: 'ahoy_chest_locked', at: [3618, 3541], why: 'unlock the chest' },
        { has: 'ahoy_toy_boat' },

        { note: 'real step 7a: the model ship. Real = needle, silk AND thread, then dye the flag' },
        { held: 'ahoy_toy_boat' },
        { has: 'ahoy_toy_boat_repaired' },

        { note: 'the old man is on the wreck here, which the real quest also does' },
        { loc: 'ahoy_ghostship_laddertop', at: [3615, 3541], why: 'back down to the deck' },
        { level: 1 },
        { go: [3619, 3543], why: 'the old man' },
        { talk: 'ahoy_oldman', why: 'hand over the nettle tea' },
        { hasnt: 'bowl_nettletea' },
        { varis: 'ahoy_signaturecounter', to: 1 },
        { loc: 'ahoy_ghostship_laddertop', at: [3609, 3543], why: 'down off the wreck' },

        { note: 'real step 6: the crone east of the Slayer Tower. A real 200-tile walk' },
        { go: [3550, 3545], r: 200, why: 'west across the swamp' },
        { go: [3470, 3558], r: 200, why: "towards the crone's hut" },
        { go: [3460, 3554], r: 64, why: 'outside her hut' },
        // a FOURTH placement of the same tatty door, at m54_55 - the quest_ahoy.loc comment says
        // three of them are in the way and there are four.
        { loc: 'ahoy_harbour_door', at: [3461, 3555], why: 'open the hut door', soft: true },
        { go: [3463, 3556], r: 32 },
        { talk: 'ahoy_crone', why: 'hand over the bedsheet' },
        { hasnt: 'ahoy_bedsheet' },
        { varis: 'ahoy_signaturecounter', to: 2 },

        { note: 'back for the third signature' },
        { go: [3550, 3545], r: 200, why: 'east again' },
        { go: [3640, 3500], r: 200 },
        ...southGate,
        ...innDoor,
        { go: [3676, 3490] },
        { talk: 'ahoy_robin', why: 'hand over the mended ship' },
        { hasnt: 'ahoy_toy_boat_repaired' },
        { varis: 'ahoy_signaturecounter', to: 3 },
        { stage: 4 },

        { note: 'real step 11: show the full petition to Necrovarus' },
        ...northGate,
        { go: [3658, 3516], why: 'the Ectofuntus' },
        { talk: 'ahoy_necrovarus', why: 'show him three names' },
        { stage: 5 },

        { note: 'real step 10: Ak-Haranu. Real = beat Robin at Rune-Draw for a SIGNED OAK BOW' },
        ...northGate,
        { go: [3691, 3496], r: 160, why: 'the dock' },
        { talk: 'ahoy_akharanu_multi', why: 'trade the magic longbow for the manual' },
        { has: 'ahoy_translation_manual' },

        { note: 'real step 9: the Book of Haricanto is DUG UP on Dragontooth, not shelved' },
        ...northGate,
        { go: [3659, 3514], why: 'the disciple by the Ectofuntus' },
        { talk: 'ahoy_disciple' },
        { has: 'ahoy_book_of_haricanto' },
        { use: ['ahoy_translation_manual', 'ahoy_book_of_haricanto'] },
        { stage: 6 },

        { note: 'real step 7: all three scraps come off the wreck. Ours are scattered' },
        { go: [3665, 3518], why: 'the temple stairs' },
        { loc: 'ahoy_tower_stairs_lv1', at: [3666, 3518], why: 'up to the coffin' },
        { loc: 'ahoy_harbour_door', at: [3656, 3514], why: 'open the upstairs door', soft: true },
        { loc: 'ahoy_coffin', at: [3659, 3513], why: "Necrovarus's coffin" },
        { has: 'ahoy_map_scrap_2' },
        { loc: 'ahoy_tower_stairs_lv1_top', at: [3666, 3520], why: 'back down the temple stairs' },
        { level: 0 },
        ...northGate,
        { go: [3690, 3513], r: 160, why: 'the second ghost captain, inside the walls' },
        { talk: 'ahoy_ghost_captain_2' },
        { has: 'ahoy_map_scrap_3' },
        ...northGate,
        { go: [3610, 3543], r: 200, why: 'the wreck once more for the third scrap' },
        { loc: 'ahoy_ghostship_ladder', at: [3609, 3543] },
        { loc: 'ahoy_harbour_door', at: [3615, 3543], soft: true },
        { go: [3621, 3543] },
        { loc: 'ahoy_skull_captain', at: [3622, 3543] },
        { has: 'ahoy_map_scrap_1' },
        { use: ['ahoy_map_scrap_1', 'ahoy_map_scrap_2'] },
        { has: 'ahoy_map_complete' },
        { stage: 7 },

        { note: 'real step 8: the rowboat to Dragontooth Island' },
        { loc: 'ahoy_ghostship_laddertop', at: [3609, 3543] },
        { level: 0 },
        ...northGate,
        { go: [3701, 3487], r: 200, why: 'the pier, inside the walls' },
        { talk: 'ahoy_ghost_captain_1', why: 'sail to Dragontooth Island' },

        { note: 'real step 9: dig at the cross. Ours buries the ROBES here, not the book' },
        // ^ahoy_dig is 3803,3530 and the proc wants you within one tile of it, so this one is exact
        { go: [3803, 3530], r: 128, exact: true, why: 'where the map points' },
        { held: 'spade', want: 'Oilcloth' },
        { has: 'ahoy_robes_of_necrovarus' },
        { stage: 8 },

        { note: 'real steps 11-12: Necrovarus drops a KEY, then the crone, then Velorina' },
        { go: [3793, 3557], r: 128, why: 'back to the island dock' },
        { talk: 'ahoy_ghost_captain_1', why: 'sail back' },
        ...northGate,
        { go: [3658, 3516], r: 200, why: 'the Ectofuntus' },
        { talk: 'ahoy_necrovarus', why: 'hand over the robes - the quest ends here' },
        { stage: 10 }
    ]
};

const p: any = H.makePlayer('ahoyrun', m.start[0], m.start[1]);
H.tick(2);
p.teleport(m.start[0], m.start[1], m.start[2]);
H.equip(p, { front: 'amulet_of_ghostspeak' });
H.tick(1);

const prayerBefore = p.getStatXp ? p.getStatXp(5) : (p as any).stats[5];
const res = play(m, p);

// ---------------------------------------------------------------------------------------------
// THE THIRD PASS: what can be done twice. A quest that completes correctly can still pay out
// forever, and no amount of a correct playthrough finds that - you have to go back and try.
console.log('');
console.log('CAN ANY OF IT BE DONE AGAIN?');
const xp = () => ((p as any).stats ? (p as any).stats[5] : 0);
console.log('  Prayer xp from the whole quest: ' + (xp() - prayerBefore) / 10
    + '   (the wiki says 2,400 for completing it)');
console.log('  ectophial in the pack: ' + H.invCount(p, 'ectophial'));

// the translation manual, used on the book a second time
if (H.invCount(p, 'ahoy_translation_manual') > 0 && H.invCount(p, 'ahoy_book_of_haricanto') > 0) {
    const before = xp();
    for (let i = 0; i < 5; i++) {
        H.useHeldOn(p, 'ahoy_translation_manual', 'ahoy_book_of_haricanto');
        for (let k = 0; k < 10; k++) H.tick(1);
        if (p.activeScript) p.activeScript = null;
    }
    const gained = (xp() - before) / 10;
    console.log('  reading the manual onto the book five MORE times: ' + gained + ' Prayer xp'
        + (gained > 0 ? '   *** REPEATABLE ***' : '   (nothing, correctly)'));
} else {
    console.log('  the manual or the book was consumed, so it cannot be re-read');
}

// and the Ectofuntus, which pays per worship
console.log('  stage after talking to Necrovarus again: ');
H.clearLogs();
const bad = res.filter(r => !r.ok);
console.log('');
if (bad.length) {
    console.log('WHAT WENT WRONG');
    for (const r of bad) console.log('  step ' + r.n + '  ' + r.what + (r.detail ? '  -- ' + r.detail : ''));
}
process.exit(bad.length ? 1 : 0);
