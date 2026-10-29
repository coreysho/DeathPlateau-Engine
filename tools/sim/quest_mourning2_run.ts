// MOURNING'S END PART II, played through on foot.
//
// Quest 100 of the quest-by-quest pass, and the first one where the walking was the whole question.
// Four tools already drive this quest's light: templesolve.ts finds the mirrors, templelight.ts
// drives the colours along them, templeverticals.ts proves the beam can be routed to every door in
// the building, and audit2.ts mourning2 places the five real mirrors and takes the stage to lit.
// templealtar.ts drives the second half - the corpses, the crystal, Thorgel, the altar. Every one of
// them teleports, and one of them teleports onto a tile inside a loc (1861,4638 is the middle of the
// ruins), which told nobody anything about whether a player can get to any of it.
//
// They can, and it is a long way. The Temple of Light is three floors of sixteen rooms, and the
// west end of the bottom floor - Thorgel, the ruins, the Death Altar, the hole the light leaves by -
// is its own 55-tile region with exactly one way in: up the east staircase to floor 2, up the wall
// ladder to floor 3, back down the WEST circle staircase twice, and then through two doors of light.
// tools/sim/templewalk.ts is the probe that found that route; this manifest walks it, four times,
// because the hole in the west wall is the only way out of the building.
//
// What is delegated: the beams. Setting the twelve mourning_door_* varbits is exactly what
// ~m2_doors does once the light is arranged, and templeverticals.ts proves each of those twelve can
// be lit in the colour its door wants - including mourning_door_1_b, which was missing from that
// list until today and is the only way to the Death Altar. Everything else here is a click.
//
//   NODE_MEMBERS=true npx tsx tools/sim/quest_mourning2_run.ts
import * as H from './harness.js';
import { play, Manifest, Step } from './questrun.js';

await H.boot();

// --- Lletya
const ARIANWYN: [number, number, number] = [2357, 3172, 0];

// --- the mourners' dig under West Ardougne, and the tunnel at the end of it
const DIG: [number, number, number] = [2311, 9797, 0]; // 9798 -> 9797 is walled; this is the first tile of the run down
const TUNNEL_STAND: [number, number] = [2311, 9793];
const TUNNEL: [number, number] = [2311, 9792];

// --- the temple. m29_72, so every tile is 1856+x, 4608+z of the generated graph's own numbering
const _ENTRYENTRY: [number, number] = [1916, 4639]; // ^mt_temple_entry, where the tunnel puts you
const CORPSE: [number, number] = [1925, 4642]; // mourning_dead_guard1, one of five in the east cave
const CORPSE_STAND: [number, number, number] = [1926, 4642, 0];

const STAIRS_E: [number, number] = [1902, 4638]; // circle stairs, bottom floor <-> middle
const STAIRS_E_UP: [number, number, number] = [1905, 4638, 0];
const STAIRS_E_DOWN: [number, number, number] = [1901, 4638, 1];
const COLLECTOR: [number, number] = [1914, 4639]; // the temple kit, on the middle floor
const COLLECTOR_STAND: [number, number, number] = [1913, 4639, 1];
const LADDER: [number, number] = [1898, 4610]; // wall ladder, middle floor <-> top
const LADDER_STAND: [number, number, number] = [1897, 4611, 1];
const CRYSTAL: [number, number] = [1908, 4638]; // the black crystal, top floor
const CRYSTAL_STAND: [number, number, number] = [1907, 4639, 2];

// the WEST circle staircase: two flights, and the only way down into the west end
const STAIRS_W2: [number, number] = [1890, 4635]; // top floor <-> middle
const STAIRS_W2_DOWN: [number, number, number] = [1890, 4634, 2];
const STAIRS_W2_UP: [number, number, number] = [1890, 4638, 1];
const STAIRS_W1: [number, number] = [1887, 4638]; // middle floor <-> bottom
const STAIRS_W1_DOWN: [number, number, number] = [1890, 4638, 1];
const _STAIRS_W1_UPSTAIRS_W1_UP: [number, number, number] = [1886, 4638, 0];

const DOOR_B: [number, number] = [1885, 4639]; // cyan; the three tiles east of it are a dead end
const _DOOR_B_WDOOR_B_W: [number, number, number] = [1886, 4638, 0];
const DOOR_B_E: [number, number, number] = [1884, 4639, 0];
const DOOR_C: [number, number] = [1865, 4639]; // the black door; any light opens it
const DOOR_C_W: [number, number, number] = [1866, 4639, 0];
const DOOR_C_E: [number, number, number] = [1864, 4639, 0];

const THORGEL: [number, number, number] = [1861, 4641, 0];
const RUINS: [number, number] = [1859, 4638];
const RUINS_STAND: [number, number, number] = [1862, 4638, 0];
const ALTAR: [number, number] = [2204, 4835];
const PORTAL: [number, number] = [2208, 4829];
const HOLE: [number, number] = [1856, 4638]; // the only way out of the building
const HOLE_STAND: [number, number, number] = [1857, 4638, 0];

// the twelve doors of light. ~m2_doors writes these off the beam colours; templeverticals.ts proves
// every one of them can be lit in the colour it asks for.
const DOORS = ['1_13_east', '1_13_north', '1_16_north', '1_16_west', '1_1_east', '1_1_south', '1_b', '1_c', '2_16_north', '2_16_west', '2_4_west'];

// Thorgel's list: the 2006 twenty-one, in the cache's own bit order (mourning2_altar.rs2)
const LIST = [
    'blankrune',
    'lobster_pot',
    'fishing_rod',
    'tinderbox',
    'lockpick',
    'bronze_med_helm',
    'white_apron',
    'jug_wine',
    'kebab',
    'leather_boots',
    'swamppaste',
    'redberries',
    'cheese',
    'vial_water',
    'flax',
    'gold_ring',
    'egg',
    'leather_gloves',
    'cake_tin',
    'necklace_mould',
    'rotten_tomato'
];

// --- the climb into the west end, and the climb back out of it. Four legs, because the hole in the
// west wall is the only exit and Arianwyn is three conversations.
const INTO_THE_WEST_END: Step[] = [
    { go: [STAIRS_E_UP[0], STAIRS_E_UP[1]], why: 'to the east circle staircase' },
    { loc: 'mourning_temple_circle_stairs_base', at: STAIRS_E, hop: true, why: 'up to the middle floor' },
    { level: 1 },
    { go: [LADDER_STAND[0], LADDER_STAND[1]], why: 'across the middle floor to the wall ladder' },
    { loc: 'mourning_temple_ladder_wall', at: LADDER, hop: true, why: 'up to the top floor' },
    { level: 2 },
    { go: [STAIRS_W2_DOWN[0], STAIRS_W2_DOWN[1]], why: 'west along the top floor to the west staircase' },
    { loc: 'mourning_temple_circle_stairs_top', at: STAIRS_W2, hop: true, why: 'down to the middle floor again' },
    { level: 1 },
    { go: [STAIRS_W1_DOWN[0], STAIRS_W1_DOWN[1]], why: 'round the nine-tile landing' },
    { loc: 'mourning_temple_circle_stairs_top', at: STAIRS_W1, hop: true, why: 'down to the bottom floor' },
    { level: 0 },
    { loc: 'mourning_door_1_b', at: DOOR_B, hop: true, why: 'through the cyan door' },
    { go: [DOOR_C_W[0], DOOR_C_W[1]], why: 'west along the bottom floor to the black door' },
    { loc: 'mourning_door_1_c', at: DOOR_C, hop: true, why: 'through the black door' }
];

const OUT_OF_THE_WEST_END: Step[] = [{ go: [HOLE_STAND[0], HOLE_STAND[1]], why: 'to the hole in the west wall' }, { loc: 'mourning_temple_light_wall_with_hole', at: HOLE, hop: true, why: 'squeeze out' }, { level: 0 }];

// from the west end back up to the top floor, for the crystal
const UP_FROM_THE_WEST_END: Step[] = [
    { go: [DOOR_C_E[0], DOOR_C_E[1]], why: 'back to the black door' },
    { loc: 'mourning_door_1_c', at: DOOR_C, hop: true, why: 'east through the black door' },
    { go: [DOOR_B_E[0], DOOR_B_E[1]], why: 'east along the bottom floor' },
    { loc: 'mourning_door_1_b', at: DOOR_B, hop: true, why: 'east through the cyan door' },
    { loc: 'mourning_temple_circle_stairs_base', at: STAIRS_W1, hop: true, why: 'up the west staircase' },
    { level: 1 },
    { go: [STAIRS_W2_UP[0], STAIRS_W2_UP[1]], why: 'round the landing to the next flight' },
    { loc: 'mourning_temple_circle_stairs_base', at: STAIRS_W2, hop: true, why: 'and up again' },
    { level: 2 }
];

const DOWN_TO_THE_WEST_END: Step[] = [
    { go: [STAIRS_W2_DOWN[0], STAIRS_W2_DOWN[1]], why: 'back to the west staircase' },
    { loc: 'mourning_temple_circle_stairs_top', at: STAIRS_W2, hop: true, why: 'down' },
    { level: 1 },
    { go: [STAIRS_W1_DOWN[0], STAIRS_W1_DOWN[1]], why: 'round the landing' },
    { loc: 'mourning_temple_circle_stairs_top', at: STAIRS_W1, hop: true, why: 'and down' },
    { level: 0 },
    { loc: 'mourning_door_1_b', at: DOOR_B, hop: true, why: 'west through the cyan door' },
    { go: [DOOR_C_W[0], DOOR_C_W[1]], why: 'west along the bottom floor' },
    { loc: 'mourning_door_1_c', at: DOOR_C, hop: true, why: 'west through the black door' }
];

const THE_TUNNEL_IN: Step[] = [
    { setpos: DIG, why: "to the mourners' dig under West Ardougne - Mourning's End Part I walks this" },
    { go: [TUNNEL_STAND[0], TUNNEL_STAND[1]], why: 'along the dig to the tunnel mouth' },
    { loc: 'cavewalltunnel_to_temple', at: TUNNEL, hop: true, why: 'crawl through into the temple' },
    { level: 0 },
    // THE WAY IN RELIGHTS THE BUILDING. ~mt_tunnel calls ~mt_relight, which redraws every beam
    // from the mirrors actually in the pillars and then runs ~m2_doors off the result - so a
    // delegated arrangement is wiped by the crawl through, and every door in the temple is shut
    // again on the far side of it. That cost an hour: the first pass through the cyan door worked
    // and the second, nineteen steps later, silently did nothing at all.
    { note: 'crawling in relights the temple from the mirrors, so the arrangement goes back on' },
    ...(DOORS.map(d => ({ setvar: 'mourning_door_' + d, to: 1, why: 'lit in its own colour' })) as Step[])
];

const m: Manifest = {
    quest: "MOURNING'S END PART II",
    source: 'oldschool.runescape.wiki/w/Mourning%27s_End_Part_II/Quick_guide',
    stageVar: 'mourning_quest_main',
    done: 50, // ^mt_complete
    start: ARIANWYN,
    steps: [
        { note: "items: a chisel for the black crystal, and the twenty-one on Thorgel's list. The" },
        { note: 'list does not fit in one inventory beside the temple kit, so it goes over the' },
        { note: 'counter in two batches - which is what the handin script is written for: it takes' },
        { note: 'whatever you are carrying and tells you how many are left.' },
        { setvar: 'mourning_quest', to: 20, why: "^mourning_complete - Mourning's End Part I" },
        { give: 'chisel' },

        { note: "wiki step 1: Arianwyn in Lletya has read the mourners' list and knows what it is for" },
        { go: [ARIANWYN[0], ARIANWYN[1]], why: 'to Arianwyn' },
        { talk: 'mourning_arianwyn', want: 'sealed six hundred years ago', why: 'take the quest' },
        { stage: 10 },
        { varis: 'mourning_light_door_1_c_first_time', to: 1 },

        { note: "wiki step 2: in through the mourners' own dig, west along the cave, and in at the" },
        { note: 'east wall of the temple' },
        ...THE_TUNNEL_IN,
        { stage: 20 },

        { note: 'wiki step 3: five bodies in the cave east of the temple, and one of them is Nissyen' },
        { note: 'Edern. Which one does not matter - the first one searched gives up the journal.' },
        { go: [CORPSE_STAND[0], CORPSE_STAND[1]], why: 'back east into the cave' },
        { loc: 'mourning_dead_guard1', at: CORPSE, want: 'journal', why: 'search the guard' },
        { stage: 24 },
        { has: 'mourning_ederns_journal' },
        { held: 'mourning_ederns_journal', op: 1, why: 'read it' },

        { note: 'wiki step 4: the temple kit comes out of the collector on the middle floor - four' },
        { note: 'mirrors, a crystal and the colour wheel. Every chest in the building is behind a' },
        { note: 'door of light, so the first mirrors cannot be chest mirrors.' },
        { go: [STAIRS_E_UP[0], STAIRS_E_UP[1]], why: 'to the east circle staircase' },
        { loc: 'mourning_temple_circle_stairs_base', at: STAIRS_E, hop: true, why: 'up to the middle floor' },
        { level: 1 },
        { go: [COLLECTOR_STAND[0], COLLECTOR_STAND[1]], why: 'to the collector' },
        { loc: 'mourning_temple_light_wall_collector', at: COLLECTOR, why: 'collect the kit' },
        { has: 'mourning_mirror', n: 4 },
        { has: 'mourning_crystal_yellow' },
        { has: 'mourning_colour_wheel' },
        { go: [STAIRS_E_DOWN[0], STAIRS_E_DOWN[1]], why: 'back to the staircase' },
        { loc: 'mourning_temple_circle_stairs_top', at: STAIRS_E, hop: true, why: 'down to the bottom floor' },
        { level: 0 },

        { note: 'wiki step 5: the black crystal is on the top floor, and Arianwyn wants a piece of it' },
        { go: [STAIRS_E_UP[0], STAIRS_E_UP[1]], why: 'to the east circle staircase' },
        { loc: 'mourning_temple_circle_stairs_base', at: STAIRS_E, hop: true, why: 'up' },
        { level: 1 },
        { go: [LADDER_STAND[0], LADDER_STAND[1]], why: 'to the wall ladder' },
        { loc: 'mourning_temple_ladder_wall', at: LADDER, hop: true, why: 'up to the top floor' },
        { level: 2 },
        { go: [CRYSTAL_STAND[0], CRYSTAL_STAND[1]], why: 'to the black crystal' },
        { loc: 'mourning_temple_obsidian_crystal', at: CRYSTAL, op: 1, want: 'cracked across twice', why: 'look at it' },
        { useLoc: 'mourning_temple_obsidian_crystal', at: CRYSTAL, obj: 'chisel', want: 'comes away', why: 'take a sliver' },
        { stage: 26 },
        { has: 'mourning_crystal_sample' },
        { note: 'THE STAGES ARE A HIGH-WATER MARK, not a sequence: every one of them is written' },
        { note: 'behind an if (%mourning_quest_main < x), so a player who lights the temple before' },
        { note: 'cutting the sliver never records 26 at all. That is why the lit stage is set below,' },
        { note: 'where the quest itself puts it, and not earlier where it would eat 26 and 34.' },

        { note: 'wiki step 6: and now out, which is the long way round - the hole in the west wall is' },
        { note: 'the only way out of this building, and it is behind two doors of light at the far' },
        { note: 'end of the bottom floor. Down the WEST staircase twice (tools/sim/templewalk.ts).' },
        { go: [STAIRS_W2_DOWN[0], STAIRS_W2_DOWN[1]], why: 'west along the top floor' },
        { loc: 'mourning_temple_circle_stairs_top', at: STAIRS_W2, hop: true, why: 'down to the middle floor' },
        { level: 1 },
        { go: [STAIRS_W1_DOWN[0], STAIRS_W1_DOWN[1]], why: 'round the nine-tile landing' },
        { loc: 'mourning_temple_circle_stairs_top', at: STAIRS_W1, hop: true, why: 'down to the bottom floor' },
        { level: 0 },
        { loc: 'mourning_door_1_b', at: DOOR_B, hop: true, why: 'through the cyan door' },
        { go: [DOOR_C_W[0], DOOR_C_W[1]], why: 'west along the bottom floor' },
        { loc: 'mourning_door_1_c', at: DOOR_C, hop: true, why: 'through the black door' },
        ...OUT_OF_THE_WEST_END,

        { note: 'wiki step 7: Arianwyn sings over the sliver, and what comes back is his crystal with' },
        { note: 'the old one inside it - empty, and wanting an altar' },
        { setpos: ARIANWYN, why: 'to Lletya' },
        { talk: 'mourning_arianwyn', want: 'sings over it', why: 'hand over the sliver' },
        { stage: 34 },
        { has: 'mourning_crystal_new_sample' },
        { hasnt: 'mourning_crystal_sample' },

        { note: 'THE LIGHT ITSELF IS DELEGATED, and it is the only thing that is. Five mirrors, two' },
        { note: 'of them tilted, send the beam from the top-floor entry pillar out of the hole in the' },
        { note: 'west wall: templesolve.ts finds the route, templelight.ts drives the colours along' },
        { note: 'it, audit2.ts mourning2 places the real mirrors and takes the stage to lit, and' },
        { note: 'templeverticals.ts proves the beam can be routed to each of the twelve doors in the' },
        { note: 'colour that door asks for - mourning_door_1_b included, which was missing from that' },
        { note: 'list until today and is the only way to the Death Altar. Setting the door varbits is' },
        { note: 'what ~m2_doors does once the beams are drawn.' },
        { setvar: 'mourning_quest_main', to: 40, why: '^mt_lit - light out of the west wall' },

        { note: 'wiki step 8: back in, and all the way down to the west end again - Thorgel the dwarf' },
        { note: 'has been sitting by the Death Altar for eleven years with a list instead of a' },
        { note: 'talisman' },
        ...THE_TUNNEL_IN,
        ...INTO_THE_WEST_END,
        { go: [THORGEL[0], THORGEL[1]], why: 'to Thorgel' },
        { talk: 'mourning_deathalter_dwarf', want: 'Six hundred years', why: 'take the list' },
        { stage: 42 },
        { has: 'mourning_deathalter_list' },
        { held: 'mourning_deathalter_list', op: 1, why: 'read the list' },

        { note: 'the twenty-one, in two batches, because they do not fit in one inventory beside the' },
        { note: 'temple kit - and the handin script counts what is left out loud' },
        ...(LIST.slice(0, 10).map(o => ({ give: o })) as Step[]),
        { talk: 'mourning_deathalter_dwarf', want: 'off the list', why: 'the first ten' },
        { varis: 'mourning_dwarf_startedtask', to: 1 },
        ...(LIST.slice(10).map(o => ({ give: o })) as Step[]),
        { talk: 'mourning_deathalter_dwarf', want: 'death talisman', why: 'the other eleven' },
        { stage: 44 },
        { has: 'death_talisman' },
        { hasnt: 'mourning_deathalter_list' },
        { varis: 'mourning_dwarf_startedtask', to: 2 },

        { note: 'wiki step 9: the ruins are four tiles west of him, and the talisman opens them. They' },
        { note: 'are a three-by-three block, so the only approach is from outside the footprint.' },
        { go: [RUINS_STAND[0], RUINS_STAND[1]], why: 'to the ruins' },
        { useLoc: 'deathtemple_ruined', at: RUINS, obj: 'death_talisman', hop: true, why: 'into the altar chamber' },
        { go: [ALTAR[0] + 2, ALTAR[1]], why: 'to the Death Altar' },
        { useLoc: 'death_altar', at: ALTAR, obj: 'mourning_crystal_new_sample', want: 'cold to warm', why: 'charge the crystal' },
        { stage: 46 },
        { has: 'mourning_crystal_new_powered' },
        { go: [PORTAL[0] + 1, PORTAL[1]], why: 'to the exit portal' },
        { loc: 'deathtemple_exit_portal', at: PORTAL, hop: true, why: 'back out to the ruins' },

        { note: 'wiki step 10: the charged crystal goes back into the one it was cut from - which is' },
        { note: 'on the TOP floor, so the whole climb again in reverse' },
        ...UP_FROM_THE_WEST_END,
        { go: [CRYSTAL_STAND[0], CRYSTAL_STAND[1]], why: 'to the black crystal' },
        { useLoc: 'mourning_temple_obsidian_crystal', at: CRYSTAL, obj: 'mourning_crystal_new_powered', want: 'goes back into the crack', why: 'repower it' },
        { stage: 48 },
        { varis: 'mourning_light_temple_safe_guards', to: 1 },
        { hasnt: 'mourning_crystal_new_powered' },

        { note: 'wiki step 11: and out one last time, to tell Arianwyn in person' },
        ...DOWN_TO_THE_WEST_END,
        ...OUT_OF_THE_WEST_END,
        { setpos: ARIANWYN, why: 'to Lletya' },
        { talk: 'mourning_arianwyn', want: 'Six hundred years', why: 'the last conversation' },
        { stage: 50 },
        { has: 'mourning_crystal_trinket' }
    ]
};

const p: any = H.makePlayer('mep2run', m.start[0], m.start[1]);
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
