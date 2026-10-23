// FAMILY CREST, played through on foot.
//
// Quest 77 of the quest-by-quest pass. Dimintheis Fitzharmon's three sons fell out over who should
// inherit, broke the family crest into three and went their separate ways. One wants fish, one
// wants jewellery made of gold that does not exist anywhere else, and the third lost his piece to
// a demon who cannot be killed until he has been hit by all four Blast spells.
//
//   NODE_MEMBERS=true npx tsx tools/sim/quest_crest_run.ts
import * as H from './harness.js';
import { play, Manifest } from './questrun.js';

await H.boot();

const DIMINTHEIS: [number, number, number] = [3280, 3405, 0];
const CALEB: [number, number, number] = [2818, 3451, 0];
const GEM_TRADER: [number, number, number] = [3287, 3212, 0];
const AVAN: [number, number, number] = [3294, 3284, 0];
const BOOT: [number, number, number] = [2988, 9814, 0];
// The Witchaven dungeon. The ladder down is the generic loc_1754 at 2696,3282.
const DUNGEON_LADDER: [number, number] = [2696, 3282];
const LEVER_N: [number, number] = [2722, 9710]; // leverg - the "north" lever
const LEVER_S: [number, number] = [2724, 9669]; // leverh - the "south" lever
const LEVER_R: [number, number] = [2722, 9718]; // leveri - the north ROOM lever
const DOOR_NupSdown: [number, number] = [2722, 9671]; // famcrest_doorg2h1
const DOOR_NupSup: [number, number] = [2719, 9671]; // famcrest_doorh2
const DOOR_NdownSup: [number, number] = [2723, 9711]; // famcrest_doorh2g1
const GOLD_DOOR: [number, number] = [2727, 9690]; // famcrest_doori2h1
const GOLD_ROCK_A: [number, number] = [2737, 9689];
const GOLD_ROCK_B: [number, number] = [2738, 9693];
const FURNACE: [number, number] = [3272, 3185];
const FURNACE_STAND: [number, number, number] = [3272, 3186, 0];
const JOHNATHON: [number, number, number] = [3279, 3501, 1];
const CHRONOZON: [number, number, number] = [3089, 9936, 0];

const m: Manifest = {
    quest: 'FAMILY CREST',
    source: 'oldschool.runescape.wiki/w/Family_Crest',
    stageVar: 'crestquest',
    done: 11, // ^crest_complete
    start: DIMINTHEIS,
    steps: [
        { note: 'requirements: 40 Mining, 40 Smithing, 40 Crafting, 59 Magic, and a level 170 demon.' },
        { note: 'Items: the five cooked fish, a pickaxe, two cut rubies, a ring and necklace mould,' },
        { note: 'an antipoison, and the runes for all four Blast spells.' },
        { give: 'swordfish' },
        { give: 'bass' },
        { give: 'tuna' },
        { give: 'salmon' },
        { give: 'shrimp' },
        { give: 'rune_pickaxe' },
        { give: 'ruby', n: 2 },
        { give: 'ring_mould' },
        { give: 'necklace_mould' },
        { give: '4doseantipoison' },
        { give: 'airrune', n: 100 },
        { give: 'waterrune', n: 100 },
        { give: 'earthrune', n: 100 },
        { give: 'firerune', n: 100 },
        { give: 'deathrune', n: 100 },

        { note: 'wiki step 1: Dimintheis wants the crest back' },
        {
            talk: 'dimintheis',
            picks: ['Why would a nobleman live in a dump like this?', 'So where is this crest?', 'Ok, I will help you.'],
            want: 'still loves him',
            why: 'his three sons each hold a piece'
        },
        { stage: 1 },

        { note: 'wiki step 2: Caleb in Catherby wants five cooked fish for his salad' },
        { setpos: CALEB, why: 'to Caleb in Catherby' },
        {
            talk: 'caleb_fitzharmon',
            picks: ['Are you Caleb Fitzharmon?', 'So can I have your bit?', 'Ok, I will get those.'],
            want: 'Swordfish, Bass, Tuna, Salmon',
            why: 'the fish salad'
        },
        { stage: 2 },
        { talk: 'caleb_fitzharmon', picks: ['Uh... what happened to the rest of it?'], want: 'exchange the fish', why: 'hand the fish over' },
        { stage: 4 },
        { has: 'avan_crest' },

        { note: 'wiki step 3: the gem trader in Al Kharid knows where Avan went' },
        { setpos: GEM_TRADER, why: 'to the gem trader' },
        { talk: 'gem_trader', picks: ["I'm in search of a man named Avan Fitzharmon."], want: 'yellow cape', why: 'he sent him to the desert' },
        { stage: 5 },

        { note: 'wiki step 4: Avan wants a ring and a necklace of perfect gold' },
        { setpos: AVAN, why: 'north to the scorpion mining pit' },
        { talk: 'avan', picks: ["I'm looking for a man named Avan Fitzharmon."], want: 'perfect gold', why: 'and only perfect gold will do' },
        { stage: 6 },

        { note: 'wiki step 5: Boot, at the far west end of the Dwarven Mine, knows where it is' },
        { setpos: BOOT, why: 'to Boot under Ice Mountain' },
        { talk: 'boot_the_dwarf', picks: ["Hello. I'm in search of very high quality gold."], want: 'East of the large city Ardougne', why: 'the dwarf expert' },
        { stage: 7 },

        { note: 'wiki step 6: the Witchaven dungeon, and its three-lever door puzzle.' },
        { note: 'N = leverg (2722,9710), S = leverh (2724,9669), R = leveri (2722,9718), all down.' },
        { note: '  2722,9671 opens on N up, S down     2719,9671 opens on N up, S up' },
        { note: '  2723,9711 opens on N down, S up     2727,9690 - the gold room - on N up, S down, R up' },
        { note: 'so: N up -> south room, S up -> back out, N down -> north room, R up -> out,' },
        { note: 'N up -> south room, S down -> out, and the gold door is open.' },
        { setpos: [DUNGEON_LADDER[0], DUNGEON_LADDER[1] + 1, 0], why: 'to the old ruin entrance east of Ardougne' },
        { loc: 'loc_1754', at: DUNGEON_LADDER, hop: true, soft: true, why: 'down into the dungeon' },

        { go: LEVER_N, exact: true, r: 96, why: 'to the north lever' },
        { loc: 'leverg', at: LEVER_N, want: 'now up', why: 'N up' },
        { go: [DOOR_NupSdown[0], DOOR_NupSdown[1] + 1], exact: true, r: 96, why: 'to the south doors' },
        { loc: 'famcrest_doorg2h1', at: DOOR_NupSdown, soft: true, why: 'through on N up, S down' },
        { go: LEVER_S, exact: true, r: 24, why: 'to the south lever' },
        { loc: 'leverh', at: LEVER_S, want: 'now up', why: 'S up' },
        { go: DOOR_NupSup, exact: true, r: 24, why: 'to the other south door, from inside' },
        { loc: 'famcrest_doorh2', at: DOOR_NupSup, soft: true, why: 'back out on N up, S up' },
        { go: LEVER_N, exact: true, r: 96, why: 'back to the north lever' },
        { loc: 'leverg2', at: LEVER_N, want: 'now down', why: 'N down' },
        { go: [DOOR_NdownSup[0], DOOR_NdownSup[1] - 1], exact: true, r: 24, why: 'to the north room door' },
        { loc: 'famcrest_doorh2g1', at: DOOR_NdownSup, soft: true, why: 'through on N down, S up' },
        { go: LEVER_R, exact: true, r: 24, why: 'to the lever in the north room' },
        { loc: 'leveri', at: LEVER_R, want: 'now up', why: 'R up' },
        { go: [DOOR_NdownSup[0], DOOR_NdownSup[1]], exact: true, r: 24, why: 'back to the door' },
        { loc: 'famcrest_doorh2g1', at: DOOR_NdownSup, soft: true, why: 'out again' },
        { go: LEVER_N, exact: true, r: 96, why: 'to the north lever' },
        { loc: 'leverg', at: LEVER_N, want: 'now up', why: 'N up' },
        { go: [DOOR_NupSup[0], DOOR_NupSup[1] + 1], exact: true, r: 96, why: 'to the south door' },
        { loc: 'famcrest_doorh2', at: DOOR_NupSup, soft: true, why: 'in on N up, S up' },
        { go: LEVER_S, exact: true, r: 24, why: 'to the south lever' },
        { loc: 'leverh2', at: LEVER_S, want: 'now down', why: 'S down' },
        { go: DOOR_NupSdown, exact: true, r: 24, why: 'to the other south door, from inside' },
        { loc: 'famcrest_doorg2h1', at: DOOR_NupSdown, soft: true, why: 'out on N up, S down' },
        { varis: 'crest_spells_levers_gauntlets', to: 48 },

        { note: 'and the gold room door is open' },
        { go: GOLD_DOOR, exact: true, r: 96, why: 'to the gold room door' },
        { loc: 'famcrest_doori2h1', at: GOLD_DOOR, soft: true, why: 'into the hellhound room' },

        { note: 'the perfect gold rocks are ordinary goldrock2 - the ore is decided by the zone' },
        { note: '2736,9684 to 2740,9693, so only the rocks inside it give perfect gold ore.' },
        { go: [GOLD_ROCK_A[0] - 1, GOLD_ROCK_A[1]], exact: true, r: 40, why: 'to the first rock' },
        { note: 'the message says "gold ore" either way - the ore name comes from the rock table,' },
        { note: 'so what proves it is the ore in the pack, not what the chatbox said.' },
        { loc: 'goldrock2', at: GOLD_ROCK_A, soft: true, why: 'mine it' },
        { has: 'perfect_gold_ore' },
        { go: [GOLD_ROCK_B[0] - 1, GOLD_ROCK_B[1]], exact: true, r: 24, why: 'to the second rock' },
        { loc: 'goldrock2', at: GOLD_ROCK_B, soft: true, why: 'and mine that too' },
        { has: 'perfect_gold_ore', n: 2 },

        { note: 'smelt both, then cast a ring and a necklace with the rubies' },
        { setpos: FURNACE_STAND, why: 'to a furnace' },
        { useLoc: 'furnace1', at: FURNACE, obj: 'perfect_gold_ore', soft: true, why: 'smelt one' },
        { wait: 8, why: 'smelting is a p_delay too' },
        { useLoc: 'furnace1', at: FURNACE, obj: 'perfect_gold_ore', soft: true, why: 'and the other' },
        { wait: 8, why: 'and again' },
        { has: 'perfect_gold_bar', n: 2 },
        { useLoc: 'furnace1', at: FURNACE, obj: 'perfect_gold_bar', soft: true, why: 'open the casting panel' },
        { wait: 6, why: 'the panel is populated when it opens, so let it open first' },
        { note: 'the panel rows are one inv each, and the ruby row is slot 3' },
        { press: 'crafting_jewelry:rings_inv', slot: 3, why: 'a ruby ring' },
        { wait: 8, why: 'the cast has its own p_delay' },
        { has: 'perfect_ruby_ring' },
        { useLoc: 'furnace1', at: FURNACE, obj: 'perfect_gold_bar', soft: true, why: 'and again' },
        { wait: 6, why: 'same again' },
        { press: 'crafting_jewelry:necklaces_inv', slot: 3, why: 'a ruby necklace' },
        { wait: 8, why: 'and so does this one' },
        { has: 'perfect_ruby_necklace' },

        { note: 'back to Avan for the second piece' },
        { setpos: AVAN, why: 'to Avan' },
        { talk: 'avan', want: 'exquisite', why: 'hand over the jewellery' },
        { stage: 8 },
        { has: 'caleb_crest' },

        { note: 'wiki step 7: Johnathon is upstairs in the Jolly Boar Inn, poisoned' },
        { setpos: JOHNATHON, why: 'to the Jolly Boar Inn' },
        { talk: 'johnathon_fitzharmon', want: 'poison', why: 'a spider got him' },
        { stage: 9 },
        {
            useNpc: 'johnathon_fitzharmon',
            obj: '4doseantipoison',
            picks: ['Where can I find Chronozon?', 'So is this Chronozon hard to defeat?', 'I will be on my way now.'],
            want: 'Obelisk of Air',
            why: 'cure him, and ask where the demon is'
        },
        { stage: 10 },

        { note: 'wiki step 8: Chronozon has the last piece, and heals to full unless he has been' },
        { note: 'hit by every one of the four Blast spells first.' },
        { setpos: CHRONOZON, why: 'to the Edgeville dungeon' },
        { cast: 'magic:wind_blast', on: 'chronozon', want: 'Chronozon weakens', tries: 8, why: 'wind' },
        { cast: 'magic:water_blast', on: 'chronozon', want: 'Chronozon weakens', tries: 8, why: 'water' },
        { cast: 'magic:earth_blast', on: 'chronozon', want: 'Chronozon weakens', tries: 8, why: 'earth' },
        { cast: 'magic:fire_blast', on: 'chronozon', want: 'Chronozon weakens', tries: 8, why: 'fire' },
        { varis: 'crest_spells_levers_gauntlets', to: 63 },
        { fight: 'chronozon', until: 'johnathon_crest', tries: 6, r: 16, why: 'now he can be killed' },
        { take: 'johnathon_crest', r: 8, why: 'the last piece' },
        { has: 'johnathon_crest' },

        { note: 'wiki step 9: put the three together and take it to their father' },
        { note: 'any two pieces together is enough of a click: the handler looks for all three in' },
        { note: 'the pack and assembles the whole crest in one go.' },
        { use: ['avan_crest', 'caleb_crest'], want: 'restored the Family Crest', why: 'put them together' },
        { has: 'family_crest' },
        { setpos: DIMINTHEIS, why: 'back to Dimintheis in Varrock' },
        { talk: 'dimintheis', want: 'gauntlets', why: 'the crest is whole' },
        { stage: 11 },
        { has: 'steel_gauntlets' }
    ]
};

const p: any = H.makePlayer('crestrun', m.start[0], m.start[1]);
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
