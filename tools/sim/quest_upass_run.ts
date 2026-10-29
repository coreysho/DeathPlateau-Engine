// UNDERGROUND PASS, played through on foot.
//
// Quest 100 of the quest-by-quest pass. Three cave systems, a bridge you shoot down with a burning
// arrow, a trap grid, four orbs of light, a unicorn, three paladins, a dwarf camp, a witch, three
// demons, a spider, a cage of half-soulless men and a temple full of Zamorak's monks.
//
// One thing about it is worth knowing before reading the steps: the quest leans harder on [zone,...]
// triggers than anything else in the game - forty-odd of them for Iban's voice alone, plus the ones
// that arm the grid's trap timer - and a harness player fires none of them, because triggerZone is
// NetworkPlayer-only. That makes the grid free to cross in a sim and it is NOT a test of the grid.
// Everything else here is a real click.
//
//   NODE_MEMBERS=true npx tsx tools/sim/quest_upass_run.ts
import * as H from './harness.js';
import { play, Manifest } from './questrun.js';

await H.boot();

// --- Ardougne and the way in
const LATHAS: [number, number, number] = [2578, 3294, 1];
const KOFTIK_OUT: [number, number, number] = [2436, 3316, 0];
const CAVE_IN: [number, number] = [2433, 3313]; // upass_caveentrance2 -> 2494,9716

// --- area one: the bridge, the orbs and the well
const KOFTIK_IN: [number, number, number] = [2449, 9717, 0];
const GUIDE_ROPE: [number, number] = [2443, 9718]; // oldbridge_guiderope, shot from x>2443 z>=9720
const ORB2: [number, number, number] = [2386, 9677, 0];
const ORB3: [number, number, number] = [2385, 9685, 0];
const ORB4: [number, number, number] = [2416, 9698, 0];
const LOG_TRAP: [number, number] = [2382, 9668]; // upass_logtrap_trigger, disarm for orb 1
const FURNACE: [number, number] = [2454, 9682]; // furnace_upass
const WELL: [number, number] = [2416, 9674]; // cave_well -> 2423,9660

// --- area two: the unicorn, the paladins and the blood well
const UNICORN_CAGE: [number, number] = [2371, 9603];
const RAILING: [number, number] = [2397, 9605]; // cave_railings3
const BOULDER: [number, number, number] = [2396, 9596, 0]; // boulder_upass, an npc
const _PALADINSPALADINS: [number, number, number] = [2424, 9720, 0];
const BLOOD_WELL: [number, number] = [2373, 9718]; // bloodwell_upass
const UNICORN_DOOR: [number, number] = [2368, 9717]; // cavetempledoor2l

// --- area three: the dwarves, the witch, the demons and Iban
const DWARF_TUNNEL: [number, number] = [2336, 9793]; // cavewalltunnel_upass_up
const NILOOF: [number, number, number] = [2315, 9807, 0];
const KLANK: [number, number, number] = [2323, 9805, 0];
const BREW_BARREL: [number, number] = [2327, 9799]; // upassdwarfbrewbarrel
const IBAN_TOMB: [number, number] = [2356, 9800]; // ibantomb_left
const WITCH_CAT: [number, number, number] = [2131, 4603, 1];
const WITCH_DOOR: [number, number] = [2158, 4566]; // cavewitch_door, L1
const WITCH_CHEST: [number, number] = [2157, 4564]; // cavewitchchest, L1
const _DEMONSDEMONS: [number, number, number] = [2128, 4560, 1];
const DEMON_CHEST: [number, number] = [2136, 4578]; // upassshutchest1, L1
const KALRAG: [number, number, number] = [2356, 9910, 0];
const DOVE_CAGE: [number, number] = [2134, 4702]; // upass_cage_dummy, L1
const DISCIPLES: [number, number, number] = [2025, 4711, 1];
const TEMPLE_DOOR: [number, number] = [2143, 4647]; // upass_templedoor_closed_left, L1
const IBAN_ALTAR: [number, number] = [2136, 4647]; // cave_temple_altar, L1
const KOFTIK_END: [number, number, number] = [2443, 9608, 0];
const LAST_OUT: [number, number] = [2438, 9607]; // upass_last_out

const m: Manifest = {
    quest: 'UNDERGROUND PASS',
    source: 'oldschool.runescape.wiki/w/Underground_Pass/Quick_guide',
    stageVar: 'upass',
    done: 10, // ^upass_complete
    start: LATHAS,
    steps: [
        { note: 'requirements: Biohazard (which carries Plague City) and 25 Ranged. Lathas checks' },
        { note: 'the Ranged himself and will not start the quest without it.' },
        { setvar: 'biohazard', to: 16, why: '^biohazard_complete' },
        { note: 'items: a bow and a few metal-tipped arrows for the bridge, two ropes, a spade, a' },
        { note: 'tinderbox, a bucket for the dwarf brew, a plank for the flat rocks and a lockpick.' },
        { give: 'shortbow' },
        { give: 'bronze_arrow', n: 5 },
        { give: 'rope', n: 2 },
        { give: 'spade' },
        { give: 'tinderbox' },
        { give: 'bucket_empty' },
        { give: 'woodplank', n: 2 },
        { give: 'lockpick', n: 5 },

        { note: 'wiki step 1: King Lathas, upstairs in Ardougne Castle' },
        { setpos: LATHAS, why: 'to King Lathas' },
        { talk: 'kinglathas', want: 'west side of West Ardougne', why: 'take the job' },
        { note: 'no varp assertion here: Lathas also calls ~setupassgrilltrap, which rolls the' },
        { note: 'grid’s three safe rows into bits 22-31 of the same varp, so its value is' },
        { note: 'different every run.' },

        { note: 'wiki step 2: Koftik, outside the cave on the west side of West Ardougne' },
        { setpos: KOFTIK_OUT, why: 'to Koftik' },
        { talk: 'caveguide1', picks: ["I'll take my chances."], why: 'he sends you in' },
        { stage: 1 },

        { note: 'wiki step 3: into the cave, and the Koftik inside gives you the damp cloth' },
        { loc: 'upass_caveentrance2', at: CAVE_IN, want: 'cautiously enter the cave', why: 'in' },
        { setpos: KOFTIK_IN, why: 'to Koftik inside' },
        { talk: 'caveguide2', picks: ['What does it say?'], want: 'damp cloth', why: 'take the cloth and read the journal' },
        { has: 'damp_cloth' },

        { note: 'wiki steps 4-5: cloth on an arrow, light it, equip bow and arrow, and shoot the' },
        { note: 'guide rope. The shot is refused from the wrong side and from too far south -' },
        { note: 'coordx must be past the rope and coordz at least 9720.' },
        { use: ['damp_cloth', 'bronze_arrow'], want: 'wrap the damp cloth', why: 'wrap the arrow' },
        { has: 'unlitarrow' },
        { use: ['unlitarrow', 'tinderbox'], want: 'light the cloth', why: 'light it' },
        { has: 'litarrow' },
        { held: 'shortbow', op: 2, why: 'the bow' },
        { held: 'litarrow', op: 2, why: 'and the lit arrow' },
        { worn: 'litarrow' },
        { setpos: [2447, 9721, 0], why: 'to the north-east bank' },
        { rng: 0, why: 'the shot is a Ranged roll - stat_random(ranged, 90, 300)' },
        { loc: 'oldbridge_guiderope', at: GUIDE_ROPE, hop: true, want: 'impales the rope', why: 'shoot the rope' },
        { rng: null, why: 'real rolls again' },
        { stage: 2 },
        { note: 'AND PUT REAL ARROWS IN THE QUIVER. The bridge is the only thing in this quest' },
        { note: 'that wants a bow, and the lit arrow is spent firing it - so every fight from here' },
        { note: 'on was being fought with an empty quiver and a shortbow. The paladins survived' },
        { note: '3,600 ticks of that before this line existed.' },
        { give: 'bronze_arrow', n: 500 },
        { held: 'bronze_arrow', op: 2, why: 'arrows in the quiver' },
        { worn: 'bronze_arrow' },

        { note: 'wiki step 6 (orbs): three of the four orbs of light lie on the ground; the fourth' },
        { note: 'is under a swinging log trap and has to be disarmed off it.' },
        { setpos: ORB2, why: 'to the second orb' },
        { take: 'caveorb2', r: 4, why: 'take it' },
        { setpos: ORB3, why: 'to the third orb' },
        { take: 'caveorb3', r: 4, why: 'take it' },
        { setpos: ORB4, why: 'to the fourth orb' },
        { take: 'caveorb4', r: 4, why: 'take it' },
        { rng: 0, why: 'the disarm is a Thieving roll - stat_random(thieving, 110, 320)' },
        { setpos: [LOG_TRAP[0] + 2, LOG_TRAP[1], 0], why: 'to the log trap' },
        { loc: 'upass_logtrap_trigger', at: LOG_TRAP, picks: ["Yes, I'll give it a go."], want: 'take the Orb', why: 'disarm it' },
        { rng: null, why: 'real rolls again' },
        { has: 'caveorb1' },

        { note: 'wiki step 7: all four orbs into the furnace by the zombie camp. The well will not' },
        { note: 'take you down until every one of them is out.' },
        { setpos: [FURNACE[0], FURNACE[1] - 2, 0], why: 'to the furnace' },
        { useLoc: 'furnace_upass', at: FURNACE, obj: 'caveorb1', want: 'light quickly dims', why: 'the first orb' },
        { useLoc: 'furnace_upass', at: FURNACE, obj: 'caveorb2', why: 'the second' },
        { useLoc: 'furnace_upass', at: FURNACE, obj: 'caveorb3', why: 'the third' },
        { useLoc: 'furnace_upass', at: FURNACE, obj: 'caveorb4', why: 'and the fourth' },

        { note: 'wiki step 8: down the well of voyage' },
        { setpos: [WELL[0], WELL[1] - 2, 0], why: 'to the well' },
        { loc: 'cave_well', at: WELL, want: 'icy hands', why: 'climb in' },
        { stage: 3 },

        { note: 'wiki steps on the unicorn: search the cage, take a piece of railing, drop the' },
        { note: 'boulder on the unicorn with it, then search the cage again for the horn.' },
        { setpos: [UNICORN_CAGE[0], UNICORN_CAGE[1] - 1, 0], why: 'to the unicorn cage' },
        { loc: 'unicorncage_destroyed_upass', at: UNICORN_CAGE, why: 'search it' },
        { close: true },
        { setpos: [RAILING[0], RAILING[1] - 1, 0], why: 'to the railings' },
        { loc: 'cave_railings3', at: RAILING, op: 2, want: 'railing', why: 'take a piece of railing' },
        { has: 'caverailing' },
        { setpos: BOULDER, why: 'to the boulder above the unicorn' },
        { useNpc: 'boulder_upass', obj: 'caverailing', want: 'something breaking', why: 'lever the boulder off' },
        { setpos: [UNICORN_CAGE[0], UNICORN_CAGE[1] - 1, 0], why: 'back to the cage' },
        { loc: 'unicorncage_destroyed_upass', at: UNICORN_CAGE, want: 'killed by the boulder', why: 'take the horn' },
        { has: 'cave_unicorn_horn' },
        { stage: 4 },

        { note: 'the three paladins, and their coats of arms' },
        { note: 'the walk lands ON each paladin’s own tile and lets the engine push it off:' },
        { note: 'they have op2=Attack and no huntmode, so they never come to you, and a fight step' },
        { note: 'that starts two tiles away spends its whole budget following one around the room.' },
        { setpos: [2424, 9721, 0], why: 'onto Sir Jerro' },
        { fight: 'upass_paladin1', op: 2, until: 'paladinbadge1', tries: 4, r: 14, why: 'Sir Jerro' },
        { take: 'paladinbadge1', r: 8, why: 'his badge' },
        { setpos: [2422, 9718, 0], why: 'onto Sir Carl' },
        { fight: 'upass_paladin2', op: 2, until: 'paladinbadge2', tries: 4, r: 14, why: 'Sir Carl' },
        { take: 'paladinbadge2', r: 8, why: 'his badge' },
        { setpos: [2426, 9718, 0], why: 'onto Sir Harry' },
        { fight: 'upass_paladin3', op: 2, until: 'paladinbadge3', tries: 4, r: 14, why: 'Sir Harry' },
        { take: 'paladinbadge3', r: 8, why: 'his badge' },

        { note: 'the three badges and the horn into the well of voyage, which unlocks the door' },
        { setpos: [BLOOD_WELL[0], BLOOD_WELL[1] - 2, 0], why: 'to the well' },
        { loc: 'bloodwell_upass', at: BLOOD_WELL, want: 'inscription', why: 'read the inscription' },
        { close: true },
        { useLoc: 'bloodwell_upass', at: BLOOD_WELL, obj: 'paladinbadge1', want: 'coat of arms', why: "Jerro's badge" },
        { useLoc: 'bloodwell_upass', at: BLOOD_WELL, obj: 'paladinbadge2', why: "Carl's badge" },
        { useLoc: 'bloodwell_upass', at: BLOOD_WELL, obj: 'paladinbadge3', why: "Harry's badge" },
        { useLoc: 'bloodwell_upass', at: BLOOD_WELL, obj: 'cave_unicorn_horn', want: 'click from nearby', why: 'and the horn' },
        { setpos: [UNICORN_DOOR[0] + 2, UNICORN_DOOR[1], 0], why: 'to the unlocked door' },
        { loc: 'cavetempledoor2l', at: UNICORN_DOOR, why: 'through it' },
        { stage: 5 },

        { note: 'the dwarf camp: Niloof, then Klank for his gauntlets, then a bucket of brew' },
        { setpos: [DWARF_TUNNEL[0], DWARF_TUNNEL[1] - 1, 0], why: 'to the tunnel down' },
        { loc: 'cavewalltunnel_upass_up', at: DWARF_TUNNEL, why: 'down to the dwarves' },
        { setpos: NILOOF, why: 'to Niloof' },
        { talk: 'upassdwarf1', want: 'human', why: 'he calms down' },
        { stage: 6 },
        { note: 'Klank has two conversations: at this stage he only talks and hands over a' },
        { note: 'tinderbox, and the gauntlets come from the one he has once you are carrying the' },
        { note: 'doll - [opnpc1,upassdwarf2] cases on ^upass_found_doll for them.' },
        { setpos: KLANK, why: 'to Klank' },
        { talk: 'upassdwarf2', picks: ['What happened to them?'], why: 'hear about Iban' },
        { note: 'the barrel is width 2 length 7 on an odd angle, so it spans x 2327-2333 - the tile' },
        { note: 'east of its origin is INSIDE it, and the click has to come from the west.' },
        { setpos: [BREW_BARREL[0] - 1, BREW_BARREL[1], 0], why: 'west of the brew barrel' },
        { useLoc: 'upassdwarfbrewbarrel', at: BREW_BARREL, obj: 'bucket_empty', want: 'fill the bucket with dwarf brew', why: 'fill the bucket' },
        { has: 'upassdwarfbrew' },

        { note: "the witch: her cat opens her door, and her chest holds Iban's doll" },
        { setpos: WITCH_CAT, why: "to the witch's cat" },
        { talk: 'cavewitchcat', why: 'pick the cat up' },
        { has: 'cavewitchcat' },
        { note: 'the cat is USED on the door, not dropped - [opheld5,cavewitchcat] is the ordinary' },
        { note: 'drop and loses it.' },
        { setpos: [WITCH_DOOR[0] + 2, WITCH_DOOR[1], 1], why: "to the witch's door" },
        { note: 'and the op walks you round the corner to hide, so the step is judged on what it' },
        { note: 'said rather than on still standing at the door.' },
        {
            useLoc: 'cavewitch_door',
            at: WITCH_DOOR,
            obj: 'cavewitchcat',
            hop: true,
            want: 'takes the cat inside',
            why: 'leave the cat at the door'
        },
        { loc: 'cavewitch_door', at: WITCH_DOOR, why: 'in through the open door' },
        { note: 'one click: [oploc1,cavewitchchest] opens it AND jumps straight to the search.' },
        { loc: 'cavewitchchest', at: WITCH_CHEST, want: 'wooden doll', why: 'open and search the chest' },
        { has: 'ibandoll' },
        { stage: 7 },
        { note: 'and now Klank will part with the gauntlets' },
        { setpos: KLANK, why: 'back to Klank' },
        { talk: 'upassdwarf2', want: 'gauntlets', why: 'ask for the gauntlets' },
        { has: 'klanks_gauntlets' },

        { note: 'the three demons west of her, and the chest their amulets open' },
        { note: 'each demon stands in its own alcove, so the walk lands on each one in turn - a' },
        { note: 'drop in one alcove cannot be walked to from another.' },
        { setpos: [2134, 4565, 1], why: 'onto Doomion' },
        { fight: 'doomion', op: 2, until: 'doomion_amulet', tries: 4, r: 16, why: 'Doomion' },
        { take: 'doomion_amulet', r: 8, why: 'his amulet' },
        { setpos: [2132, 4554, 1], why: 'onto Holthion' },
        { fight: 'holthion', op: 2, until: 'holthion_amulet', tries: 4, r: 16, why: 'Holthion' },
        { take: 'holthion_amulet', r: 8, why: 'his amulet' },
        { setpos: [2122, 4562, 1], why: 'onto Othainian' },
        { fight: 'othainian', op: 2, until: 'othainian_amulet', tries: 4, r: 16, why: 'Othainian' },
        { take: 'othainian_amulet', r: 8, why: 'his amulet' },
        { setpos: [DEMON_CHEST[0], DEMON_CHEST[1] - 1, 1], why: 'to the chest' },
        { loc: 'upassshutchest1', at: DEMON_CHEST, want: 'amulets glow red', why: 'open it' },
        { has: 'ibansshadow' },

        { note: "Iban's tomb: the dwarf brew, then the tinderbox, then the ashes" },
        { setpos: [IBAN_TOMB[0], IBAN_TOMB[1] - 1, 0], why: "to Iban's tomb" },
        { useLoc: 'ibantomb_left', at: IBAN_TOMB, obj: 'upassdwarfbrew', want: 'pour the strong alcohol', why: 'pour the brew' },
        { useLoc: 'ibantomb_left', at: IBAN_TOMB, obj: 'tinderbox', want: 'bursts into flames', why: 'light it' },
        { note: 'the burn itself searches the remains and hands over the ashes, so this is only the' },
        { note: 'second look at an empty tomb.' },
        { loc: 'ibantomb_left', at: IBAN_TOMB, soft: true, why: 'look at the remains' },
        { has: 'ibans_ashes' },

        { note: 'Kalrag, in the spider pit. The doll has to be on you when she dies - the blood' },
        { note: 'goes straight onto it.' },
        { setpos: KALRAG, why: 'to the spider pit' },
        { fight: 'kalrag', op: 2, tries: 4, r: 16, why: 'kill Kalrag' },
        { wait: 8, why: 'the poison flows over the soil' },

        { note: "the half-soulless cage. Klank's gauntlets have to be WORN or it bites you." },
        { held: 'klanks_gauntlets', op: 2, why: "Klank's gauntlets on" },
        { worn: 'klanks_gauntlets' },
        { setpos: [DOVE_CAGE[0], DOVE_CAGE[1] - 1, 1], why: 'to the cage' },
        { loc: 'upass_cage_dummy', at: DOVE_CAGE, want: "Iban's dove", why: 'search the cage' },
        { has: 'ibansdove' },

        { note: 'all four onto the doll, in whatever order' },
        { use: ['ibansdove', 'ibandoll'], want: 'rub it into the doll', why: 'the dove' },
        { use: ['ibansshadow', 'ibandoll'], want: 'seeps into the cloth', why: 'the shadow' },
        { use: ['ibans_ashes', 'ibandoll'], want: 'rub the ashes', why: 'and the ashes' },
        { held: 'ibandoll', op: 1, want: 'Blood has been smeared', why: 'check the doll' },
        { close: true },

        { note: 'a disciple of Iban for his robes, which are what gets you through the temple doors' },
        { setpos: DISCIPLES, why: 'to the disciples' },
        { fight: 'ibanmonk', op: 2, until: 'zamrobetop', tries: 6, r: 16, why: 'kill a disciple' },
        { take: 'zamrobetop', r: 8, why: 'the robe top' },
        { take: 'zamrobebottom', r: 8, why: 'and the bottom' },
        { held: 'zamrobetop', op: 2, why: 'the top on' },
        { held: 'zamrobebottom', op: 2, why: 'and the bottom' },
        { worn: 'zamrobetop' },
        { worn: 'zamrobebottom' },

        { note: "Iban's temple, and the doll into the pit of the damned" },
        { note: 'THE DOORS COUNT WHAT YOU ARE WEARING, not what you have on top: the check is' },
        { note: 'inv_freespace(worn) = inv_size(worn) - 2, which means the two robes and nothing' },
        { note: 'else. Full rune and a bow is refused however right the robes are.' },
        { strip: ['zamrobetop', 'zamrobebottom'], why: 'down to the robes' },
        { setpos: [TEMPLE_DOOR[0] + 2, TEMPLE_DOOR[1], 1], why: 'to the temple doors' },
        { loc: 'upass_templedoor_closed_left', at: TEMPLE_DOOR, hop: true, want: 'pull open the large doors', why: 'in' },
        { stage: 8 },
        { setpos: [IBAN_ALTAR[0], IBAN_ALTAR[1] - 2, 1], why: 'to the altar' },
        { useLoc: 'cave_temple_altar', at: IBAN_ALTAR, obj: 'ibandoll', want: 'gone to rest', why: 'throw the doll in' },
        { stage: 9 },

        { note: 'and out, to Koftik and then back to Lathas' },
        { setpos: KOFTIK_END, why: 'to Koftik' },
        { talk: 'caveguide5', why: 'he shows you the way out' },
        { close: true },
        { setpos: [LAST_OUT[0], LAST_OUT[1] - 1, 0], why: 'to the way out' },
        { loc: 'upass_last_out', at: LAST_OUT, soft: true, why: 'out of the pass' },
        { setpos: LATHAS, why: 'back to King Lathas' },
        { talk: 'kinglathas', want: 'loyalty is appreciated', why: 'report Iban dead' },
        { stage: 10 }
    ]
};

const p: any = H.makePlayer('upassrun', m.start[0], m.start[1]);
H.tick(2);
p.teleport(m.start[0], m.start[1], m.start[2]);
p.applyDamage = function () {};
H.setVar(p, 'macro_event', 1);
H.maxOut(p);
H.equip(p, { rhand: 'dragon_scimitar', torso: 'rune_platebody', legs: 'rune_platelegs', hat: 'rune_full_helm' });
H.tick(1);

const res = play(m, p);
const bad = res.filter(r => !r.ok);
console.log('');
if (bad.length) {
    console.log('WHAT WENT WRONG');
    for (const r of bad) console.log('  step ' + r.n + '  ' + r.what + (r.detail ? '  -- ' + r.detail : ''));
}
process.exit(bad.length ? 1 : 0);
