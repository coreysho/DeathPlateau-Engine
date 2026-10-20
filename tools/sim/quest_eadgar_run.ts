// EADGAR'S RUSE, played through on foot.
//
// Quest 50 of the quest-by-quest pass. Sanfew is out of goutweed, every scrap of it within a
// hundred miles is in a troll storeroom because trolls eat it, and there is a man living on
// Trollheim who has been trying to get at it for years and is not well. His plan is a dirty druid
// robe with a drunk parrot inside it.
//
//   npx tsx tools/sim/quest_eadgar_run.ts
import * as H from './harness.js';
import { play, Manifest } from './questrun.js';

await H.boot();

// Sanfew is upstairs in the Taverley herb shop, in a pocket of twenty-nine tiles.
const SANFEW: [number, number, number] = [2899, 3425, 1];
const EADGAR: [number, number, number] = [2895, 10086, 2];
const TEGID: [number, number, number] = [2912, 3417, 0];
const BASKET: [number, number] = [2912, 3418];
// 2615,3285 is inside a forty-two-tile enclosure; Pete walks the zoo grounds on the other side.
const PETE: [number, number, number] = [2613, 3285, 0];
const HATCH: [number, number] = [2611, 3287];
const THISTLE: [number, number, number] = [2892, 3680, 0];
const RACK: [number, number] = [2828, 10096];
const CAULDRON: [number, number] = [2844, 10055];
const BURNTMEAT: [number, number, number] = [2844, 10059, 1];
const STOREROOM_DOOR: [number, number] = [2869, 10085];
const GUARD: [number, number, number] = [2861, 10076, 0];
const CRATE: [number, number] = [2856, 10074];

const m: Manifest = {
    quest: "EADGAR'S RUSE",
    source: 'oldschool.runescape.wiki/w/Eadgar%27s_Ruse',
    stageVar: 'eadgar_quest',
    done: 70,   // ^eadgar_complete
    start: [2899, 3425, 1],
    steps: [
        { note: 'requirements: Druidic Ritual, Troll Stronghold and 31 Herblore, all three checked,' },
        { note: 'and Death Plateau, which was the one of the four nobody was asking for - it is what' },
        { note: 'gets anybody up onto the plateau at all.' },
        { setvar: 'druidquest', to: 4, why: '^druid_complete' },
        { setvar: 'troll_quest', to: 80, why: '^troll_complete' },
        { setvar: 'death_equiproom', to: 80, why: '^death_complete' },
        { give: 'karamja_rum' },
        { give: 'pestle_and_mortar' },
        { give: 'vial_water' },

        { note: 'his shop is upstairs, and a start coord on another plane does not survive makePlayer' },
        { setpos: SANFEW, why: 'up into the Taverley herb shop' },

        { note: 'wiki step 1: Sanfew, out of goutweed again' },
        { note: 'the walkthrough says to "ask general questions, then ask for more work" - his first' },
        { note: 'menu is Druidic Ritual’s, and the goutweed is behind the second option on it' },
        { talk: 'sanfew', picks: ['Have you any more work for me', "What's goutweed?"], want: 'troll storeroom', why: 'he sets the quest' },
        { stage: 10 },

        { note: 'wiki step 4: Mad Eadgar, who wants a parrot for his plan' },
        { setpos: EADGAR, why: 'to Trollheim' },
        { talk: 'troll_eadgar', want: 'dirty robes', why: 'the plan' },
        { stage: 20 },

        { note: 'wiki step 6c: Tegid at the lake in Taverley, and the basket by the line' },
        { setpos: TEGID, why: 'back down to Taverley' },
        { talk: 'eadgar_druid_washing', want: 'Help yourself', why: 'permission for a dirty robe' },
        { loc: 'eadgar_laundry_basket', at: BASKET, want: 'robe', why: 'the dirty robe' },
        { has: 'eadgar_dirty_druid_robe' },

        { note: 'wiki step 5: Parroty Pete at the Ardougne Zoo aviary. The walkthrough dips' },
        { note: 'pineapple chunks in vodka; this build has Pete do it with Karamja rum, which is the' },
        { note: 'drink the cache actually carries.' },
        { setpos: PETE, why: 'west to the Ardougne Zoo' },
        { talk: 'eadgar_zoo_keeper_aviary', want: 'not be able to get a sensible word', why: 'the alco-chunks' },
        { has: 'eadgar_alco_chunks' },

        { note: 'and the hatch in the aviary wall, because the two parrots sit in a cage nobody can' },
        { note: 'walk into - the birds themselves are a two-tile pocket' },
        { note: 'the hatch is a shape-0 wall on the west edge of its own tile, so its own tile is' },
        { note: 'where you stand to put anything through it' },
        { setpos: [2611, 3287, 0], why: 'round to the feeding hatch' },
        { useLoc: 'eadgar_aviary_wall_hatch', at: HATCH, obj: 'eadgar_alco_chunks', want: 'falls off its perch', why: 'feed the parrots' },
        { has: 'eadgar_drunk_parrot' },

        { note: 'wiki step 6: the robe and the parrot make something that will fool a troll' },
        { use: ['eadgar_dirty_druid_robe', 'eadgar_drunk_parrot'], want: 'person-shaped', why: 'the fake man' },
        { has: 'eadgar_fake_man' },

        { note: 'wiki step 7: a troll thistle out of the grass on Trollheim. It is an npc, not a' },
        { note: 'loc, which is why it has a Pick option and no Search.' },
        { setpos: THISTLE, why: 'back up to Trollheim' },
        { talk: 'eadgar_troll_thistle', want: 'unpleasant as it looks', why: 'pick the thistle' },
        { has: 'eadgar_troll_thistle' },

        { note: 'wiki step 8: dry it, grind it, mix it. The rack is in the troll kitchen and its own' },
        { note: 'op is Search, but using an item on a loc needs no op of its own.' },
        { setpos: [2828, 10097, 0], why: 'down to the troll kitchen' },
        { useLoc: 'eadgar_rack', at: RACK, obj: 'eadgar_troll_thistle', want: 'dries out in the heat', why: 'dry the thistle' },
        { use: ['pestle_and_mortar', 'eadgar_dried_troll_thistle'], want: 'coarse powder', why: 'grind it' },
        { use: ['vial_water', 'eadgar_ground_troll_thistle'], want: 'colour water should not be', why: 'mix the potion' },
        { stage: 30 },

        { note: 'wiki step 8b: and into Burntmeat’s stew, which he then eats himself' },
        { setpos: [2844, 10056, 1], why: 'up to the kitchen cauldron' },
        { useLoc: 'eadgar_troll_cauldron', at: CAULDRON, obj: 'eadgar_ground_troll_thistle_potion', want: 'Nobody notices', why: 'dose the stew' },
        { stage: 40 },

        { note: 'wiki step 9-10: Burntmeat, who is not well, and the storeroom key' },
        { setpos: BURNTMEAT, why: 'round to Burntmeat' },
        { talk: 'eadgar_troll_chief_cook', want: 'storeroom key', why: 'the key' },
        { stage: 50 },
        { has: 'eadgar_troll_storeroom_key' },

        { note: 'the storeroom door, which the key opens from the outside only' },
        { setpos: [2870, 10085, 0], why: 'down to the storeroom corridor' },
        { note: 'the unlock line is a plain mes that this step does not capture, so what proves the' },
        { note: 'door opened is the guard and the crates on the other side of it' },
        { loc: 'eadgar_storeroomdoor', at: STOREROOM_DOOR, why: 'in' },

        { note: 'wiki step 10: the guard has no ops at all, so he is not talked past - the decoy is' },
        { note: 'propped up where he can see it and he goes to argue with it' },
        { setpos: GUARD, why: 'across the storeroom' },
        { useNpc: 'eadgar_storeroom_guard', obj: 'eadgar_fake_man', want: 'uncomplimentary about trolls', why: 'the decoy' },
        { hasnt: 'eadgar_fake_man' },

        { note: 'and the goutweed, while he is busy' },
        { loc: 'eadgar_crate_goutweed', at: CRATE, want: 'help yourself to a handful', why: 'the goutweed' },
        { stage: 60 },
        { has: 'eadgar_goutweed_herb' },

        { note: 'wiki step 11: back to Sanfew, who did not expect it to work' },
        { setpos: SANFEW, why: 'back to Taverley' },
        { talk: 'sanfew', want: 'less mad than he looks', why: 'hand it over' },
        { wait: 4, why: 'the completion is queued' },
        { stage: 70 }
    ]
};

const p: any = H.makePlayer('eadgarrun', m.start[0], m.start[1]);
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
