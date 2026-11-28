// HEROES' QUEST, played through on foot - as far as one player can take it.
//
// Quest 37 of the quest-by-quest pass. Achietties wants three things: an Entranan firebird's
// feather, a cooked lava eel, and a master thief's armband. The first two are solo work and this
// run does them in full. The third is not, and that is not a bug:
//
// Heroes' Quest in 2006 was a TWO-PLAYER quest, and this content implements it that way on
// purpose. [proc,grip_attack] refuses to let a Black Arm member lift a finger against Grip
// ("Perhaps you need another player's help...?"), and [oplocu,pete_treasuredoor] refuses Grip's
// keys from anybody who has not handed over the ID papers - which only the Black Arm member does.
// So the candlestick needs one player of each gang: the Black Arm deputy opens the side door and
// later the treasure room, the Phoenix member kills Grip, and the chest holds two candlesticks,
// "one for you, and one for the person who killed Grip for you". That heist is driven by
// tools/sim/heroes_candlestick.ts, which runs both players at once; this run takes the Black Arm
// side as far as the deputy's post and stops there.
//
//   npx tsx tools/sim/quest_hero_run.ts
import * as H from './harness.js';
import { play, Manifest } from './questrun.js';

await H.boot();

const _ACHIETTIESACHIETTIES: [number, number, number] = [2904, 3510, 0];
const FIRE: [number, number] = [2890, 9768];

const m: Manifest = {
    // RENAMED from "(solo part)", which it no longer is: with the candlestick heist drivable from
    // a manifest this route plays Heroes' Quest to ^hero_complete. The pair now read as the two
    // gangs they are - "(Black Arm side)" and "(Phoenix side)" - rather than one of them being
    // named after where it used to give up. The row's id is still `hero`, so a player following it
    // keeps following it. DeathPlateau-Bugs#16.
    quest: "HEROES' QUEST (Black Arm side)",
    source: 'oldschool.runescape.wiki/w/Heroes%27_Quest',
    stageVar: 'heroquest',
    // ^hero_complete. This run stops at 11 (^hero_blackarm_id_papers_given), which is as far as one
    // player can take it, so the last stage it asserts is NOT the end of the quest - `done` is the
    // quest's own completion, because that is what the helper reads as finished.
    done: 15,
    start: [2904, 3510, 0],
    steps: [
        { note: 'requirements: 55 quest points, Shield of Arrav, Lost City, Merlin’s Crystal and' },
        { note: 'Dragon Slayer. Shield of Arrav is walked by quest_arrav_run.ts, Lost City by' },
        { note: 'quest_zanaris_run.ts and Dragon Slayer by quest_dragon_run.ts; all four are' },
        { note: 'declared here, as Black Arm, which is the gang this run continues with.' },
        { setvar: 'qp', to: 55 },
        { setvar: 'zanaris', to: 6, why: '^zanaris_complete' },
        { setvar: 'dragonquest', to: 10, why: '^dragon_complete' },
        { setvar: 'arthur', to: 7, why: '^arthur_complete' },
        { setvar: 'blackarmgang', to: 4, why: '^blackarmgang_complete' },

        { note: 'black armour for the mansion gate, a rod and oil for the eel, and a tinderbox and' },
        { note: 'log to cook it on. No weapon: the firebird is on Entrana, where the monks allow' },
        { note: 'none, so it gets punched.' },
        { give: 'black_platebody' },
        { give: 'black_platelegs' },
        { give: 'black_full_helm' },
        { give: 'fishing_rod' },
        { give: 'blamish_oil' },
        { give: 'fishing_bait', n: 20 },
        { give: 'tinderbox' },
        { give: 'logs' },

        { note: 'wiki step 1: Achietties, outside the Heroes’ Guild' },
        { talk: 'achietties', picks: ['may I apply to join', "I'll start looking for all those things"], want: 'Firebird', why: 'she lists the three items' },
        { stage: 1 },

        { note: 'wiki step 2: the Ice Queen, deep under White Wolf Mountain. Her ice gloves are the' },
        { note: 'only thing that can pick up a firebird’s feather - it burns bare hands for an' },
        { note: 'eighth of your hitpoints - so she comes first.' },
        { give: 'rune_scimitar' },
        { held: 'rune_scimitar', op: 2, why: 'wield it for her' },
        { setpos: [2867, 9956, 0], why: 'through the dwarven tunnel and down to her lair' },
        { fight: 'ice_queen', until: 'ice_gloves', tries: 4, why: 'she drops the gloves' },
        { take: 'ice_gloves', r: 10, why: 'off the ice' },
        { held: 'ice_gloves', op: 2, why: 'wear them' },
        { worn: 'ice_gloves' },

        { note: 'wiki step 3: the firebird on Entrana. A player leaves the scimitar on the mainland' },
        { note: 'and punches the bird, because the monks search you at the gangplank; this run jumps' },
        { note: 'to the island and keeps it, which is the one thing here a player could not do.' },
        { setpos: [2850, 3385, 0], why: 'the monks’ ship to Entrana' },
        { fight: 'fire_bird', until: 'hot_feather', tries: 4, why: 'it leaves a feather' },
        { take: 'hot_feather', r: 10, why: 'off the ground' },
        { has: 'hot_feather' },

        { note: 'wiki step 4: the lava eel. Oil on the rod, fish the lava in the Taverley dungeon,' },
        { note: 'and cook it - 53 Fishing and 53 Cooking.' },
        { use: ['blamish_oil', 'fishing_rod'], want: 'rub the oil into the fishing rod', why: 'make the oily rod' },
        { has: 'oily_fishing_rod' },
        { setpos: [2890, 9767, 0], why: 'down into the Taverley dungeon, to the lava' },
        { talk: '0_45_152_lavafish', op: 1, tries: 12, until: 'raw_lava_eel', want: 'lava eel', why: 'fish it out' },
        { has: 'raw_lava_eel' },
        { go: FIRE, exact: true, why: 'onto clear ground' },
        { use: ['tinderbox', 'logs'], why: 'light a fire' },
        { wait: 12, why: 'lighting a fire takes a few attempts' },
        { useLoc: 'fire', at: FIRE, obj: 'raw_lava_eel', want: 'lava eel', why: 'cook it' },
        { has: 'lava_eel' },

        { note: 'wiki step 5: Katrine, in the Black Arm hideout in Varrock, sends you to Brimhaven' },
        { setpos: [3188, 3386, 0], why: 'north to Varrock' },
        { talk: 'katrine', picks: ['way I can get the rank of master thief'], want: 'four leafed clover', why: 'the password and the target' },
        { stage: 7 },

        { note: 'wiki step 6: the Brimhaven hideout, and the password through the door' },
        { setpos: [2810, 3170, 0], why: 'by ship to Brimhaven, into the alley' },
        { loc: 'grubordoor', at: [2811, 3170], picks: ['Four leaved clover'], want: 'let you in', why: 'the password' },
        { stage: 8 },
        { loc: 'grubordoor', at: [2811, 3170], why: 'and in' },

        { note: 'wiki step 7: Trobert hands over the stolen ID papers of Hartigen the Black Knight' },
        { setpos: [2807, 3176, 0], why: 'inside, to Trobert' },
        { talk: 'trobert', picks: ['can you help me get Scarface Pete', 'I volunteer'], want: 'introduce yourself to the guards', why: 'the papers' },
        { stage: 9 },
        { has: 'id_papers' },

        { note: 'wiki step 8: Garv on the mansion gate wants Hartigen - who is a Black Knight, so' },
        { note: 'the black armour has to be WORN, not carried' },
        { held: 'black_platebody', op: 2, why: 'wear the body' },
        { held: 'black_platelegs', op: 2, why: 'the legs' },
        { held: 'black_full_helm', op: 2, why: 'and the helm' },
        { worn: 'black_full_helm' },
        { setpos: [2774, 3186, 0], why: 'round to the mansion gate' },
        { loc: 'garvdoor', at: [2774, 3187], want: 'better come in then', why: 'introduce yourself' },
        { stage: 10 },

        { note: 'wiki step 9: report to Grip as his new deputy, ask what the duties are - which is' },
        { note: 'how you learn the treasure room keys live in his jacket - and take the odd key he' },
        { note: 'hands you, which is the one that opens the side door for your Phoenix partner.' },
        { setpos: [2774, 3192, 0], why: 'in to Grip' },
        { talk: 'grip', picks: ['what do my duties involve', 'Anything I can do now?'], want: 'inside my jacket', why: 'hand over the papers and take the post' },
        { stage: 11 },
        { has: 'misc_key' },

        { note: 'wiki step 10: the candlestick takes one player of each gang. Let a Phoenix member' },
        { note: 'into the mansion through the old side entrance - the odd key Grip just gave you is' },
        { note: 'the only thing that opens it - and have them kill Grip, which you are refused' },
        { note: '("Perhaps you need another player’s help...?").' },
        { setpos: [2781, 3198, 0], why: 'back through the mansion to the blocked side entrance' },
        { useLoc: 'pete_sidedoor', at: [2781, 3197], obj: 'misc_key', why: 'unlock it from the inside' },

        { actor: 'helper', why: 'the Phoenix partner comes in through the door you just opened' },
        { note: 'THE PARTNER, and none of this span reaches the table - these are their clicks, not' },
        { note: 'instructions for a Black Arm panel. Shield of Arrav with the PHOENIX gang and' },
        { note: 'Heroes’ as far as Charlie, which is what [proc,grip_attack] checks before it lets' },
        { note: 'anybody touch Grip at all.' },
        { setvar: 'phoenixgang', to: 10 },
        { setvar: 'heroquest', to: 4, why: '^hero_phoenix_talked_charlie' },
        { give: 'rune_scimitar' },
        { held: 'rune_scimitar', op: 2, why: 'wield it' },
        { setpos: [2776, 3194, 0], why: 'in through the side door to Grip’s room' },
        { fight: 'grip', untilvar: 'heroquest', to: 5, tries: 8, r: 16, why: 'kill the head guard, which only a Phoenix member may' },
        { actor: 'player', why: 'and the deputy goes through his jacket' },

        { note: 'wiki step 11: the treasure room keys were in Grip’s jacket all along, which is what' },
        { note: 'asking about your duties told you. [oplocu,pete_treasuredoor] takes them only from' },
        { note: 'somebody who handed the ID papers over, so this half is yours and not the partner’s.' },
        { setpos: [2774, 3192, 0], why: 'over to where Grip fell' },
        { take: 'grip_keys', r: 6, why: 'the keys out of his jacket' },
        { setpos: [2765, 3197, 0], why: 'to the treasure room door' },
        { useLoc: 'pete_treasuredoor', at: [2764, 3197], obj: 'grip_keys', want: 'unlocks the door', why: 'open it' },
        { setpos: [2766, 3198, 0], why: 'in to the chest' },
        { loc: 'shutcandlechest', at: [2766, 3199], why: 'open the chest' },
        { loc: 'opencandlechest', at: [2766, 3199], why: 'and empty it - there are two candlesticks, one each' },
        { stage: 12 },
        { has: 'petecandlestick', n: 2 },

        { note: 'wiki step 12: your own gang leader swaps a candlestick for the armband - Katrine for' },
        { note: 'the Black Arm, while the partner takes their half to Straven.' },
        { setpos: [3187, 3387, 0], why: 'back to Varrock and down into the Black Arm hideout' },
        { talk: 'katrine', picks: ['I have a candlestick now!'], why: 'hand it over' },
        { stage: 13 },
        { has: 'master_thief_armband' },

        { note: 'wiki step 13: back to Achietties with all three - the Entranan firebird’s feather,' },
        { note: 'the cooked lava eel and the master thief’s armband. She takes all three and opens the' },
        { note: 'guild door. THIS RUN NOW FINISHES THE QUEST: until the heist was drivable it could' },
        { note: 'not, which is why the row was called "the solo part" and stopped at 11.' },
        { setpos: [2904, 3510, 0], why: 'back to the Heroes’ Guild' },
        { talk: 'achietties', want: 'Congratulations', why: 'hand all three in' },
        { stage: 15 },
        { hasnt: 'master_thief_armband' }
    ]
};

const p: any = H.makePlayer('herorun', m.start[0], m.start[1]);
// THE PHOENIX PARTNER. Everything about them that the steps cannot say - damage off, macro_event,
// maxed stats - is set here exactly as it is for the quest player; what they DO is in the manifest,
// inside the `actor: 'helper'` span. Their gang and quest stage are set there too, so the manifest
// reads as the heist rather than leaving half of it up here.
const partner: any = H.makePlayer('herophoenixpartner', 2781, 3195);
H.tick(2);
p.teleport(m.start[0], m.start[1], m.start[2]);
for (const who of [p, partner]) {
    who.applyDamage = function () {};
    H.setVar(who, 'macro_event', 1);
    H.maxOut(who);
}
H.tick(1);

const res = play(m, p, partner);
const bad = res.filter(r => !r.ok);
console.log('');
if (bad.length) {
    console.log('WHAT WENT WRONG');
    for (const r of bad) console.log('  step ' + r.n + '  ' + r.what + (r.detail ? '  -- ' + r.detail : ''));
}
process.exit(bad.length ? 1 : 0);
