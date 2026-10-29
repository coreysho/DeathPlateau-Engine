// IN SEARCH OF THE MYREQUE, played through on foot.
//
// Quest 52 of the quest-by-quest pass, and the first one in the pass that had to be taken apart and
// built again. It was written once from the varbit names alone - three questions from Veliaf, a
// ladder with three rungs out of it, a boatman who needed talking round - and every one of those
// pieces belongs to somebody else: the questions are Curpile Fyod's, the three missing pieces are
// sections of a rope bridge, and the boatman is the one person in Morytania nobody has ever asked.
// The cache had the whole 2005 quest in it, down to five bodies for Vanstrom Klause and a Skeleton
// Hellhound, and none of it was being used.
//
//   NODE_MEMBERS=true npx tsx tools/sim/quest_routequest_run.ts
import * as H from './harness.js';
import { play, Manifest } from './questrun.js';

await H.boot();

// The chair in the north-east corner of the Hair of the Dog. Vanstrom Klause has been in it since
// the world booted, under multi_vanstrom_stranger_entity, with no Talk-to trigger of his own.
const TAVERN: [number, number, number] = [3504, 3478, 0];
const CYREG: [number, number, number] = [3521, 3287, 0];
const MORTTON_BOAT: [number, number] = [3523, 3284];
const BRIDGE_SOUTH: [number, number] = [3502, 3426];

const CURPILE: [number, number, number] = [3504, 3437, 0];
const EARTH_DOORS: [number, number] = [3509, 3447];
const MYREQUE_DOORS: [number, number] = [3500, 9812];
const CHAMBER_MOUTH: [number, number] = [3505, 9831];
const FALSE_WALL: [number, number] = [3480, 9837];
const CELLAR_LADDER: [number, number] = [3477, 9846];

const m: Manifest = {
    quest: 'IN SEARCH OF THE MYREQUE',
    source: 'oldschool.runescape.wiki/w/In_Search_of_the_Myreque',
    stageVar: 'routequest',
    done: 8,   // ^route_complete
    start: [3504, 3478, 0],
    steps: [
        { note: 'requirements: Nature Spirit, Priest in Peril, The Restless Ghost and 25 Agility.' },
        { note: 'Nature Spirit is the one that matters - the druid pouch is what Cyreg asks to see.' },
        { setvar: 'druidspirit', to: 110, why: '^druidspirit_complete' },
        { setvar: 'priestperil', to: 60, why: '^priestperil_complete' },
        { setvar: 'prieststart', to: 5, why: '^priest_complete' },
        { give: 'steel_longsword' },
        { give: 'steel_sword', n: 2 },
        { give: 'steel_dagger' },
        { give: 'steel_mace' },
        { give: 'steel_warhammer' },
        { note: 'the druid pouch stacks its charges as the obj itself, so five of them IS five charges' },
        { give: 'druid_pouch', n: 5 },
        { give: 'woodplank', n: 6 },
        { give: 'nails', n: 225 },
        { give: 'hammer' },
        { give: 'coins', n: 100 },

        { note: 'wiki step 1: Vanstrom Klause, in the chair in the north-east corner of the pub' },
        { talk: 'multi_vanstrom_stranger_entity', picks: ['What friends?'], want: 'Myreque', why: 'he sets the quest' },
        { stage: 1 },

        { note: 'wiki step 3: Cyreg Paddlehorn, by his boat on the east side of Mort’ton. Four' },
        { note: 'replies in order get anywhere; anything else and he closes up. The pouch and the' },
        { note: 'six planks follow in the same conversation.' },
        { setpos: CYREG, why: 'to the boat at the Barrows bridge' },
        { talk: 'route_cyreg_paddlehorn', picks: [
            'just die without weapons',
            'Resourceful enough',
            'deaths are on your head',
            'What kind of man are you'
        ], want: 'wrong shape', why: 'talk him round, show the pouch, hand over the planks' },
        { stage: 2 },
        { note: 'three of the six went into his boat and three are for the bridge' },
        { has: 'woodplank', n: 3 },

        { note: 'wiki step 4: the boat, north as far as it goes' },
        { loc: 'route_rowboat_mortton', at: MORTTON_BOAT, why: 'board' },

        { note: 'wiki step 5: north on foot to the rope bridge. Three of its four sections are' },
        { note: 'missing and the four tiles under them are impassable swamp, so this is the only' },
        { note: 'way from the southern half of the Hollows to the northern half.' },
        { go: [3502, 3425], why: 'north through the swamp to the south tree' },
        { note: 'the sections themselves cannot be clicked: shape 22 reaches by rectangle, and every' },
        { note: 'tile next to a section is swamp or a tree tile blocked towards the gap. The first' },
        { note: 'pass asserted the Repair op on 3502,3427 and got three silent passes and no planks' },
        { note: 'spent, which is what an op the engine refused to deliver looks like from here.' },
        { loc: 'harmless_dead_palm_mid', at: BRIDGE_SOUTH, want: 'One section', why: 'one section' },
        { loc: 'harmless_dead_palm_mid', at: BRIDGE_SOUTH, want: 'Two sections', why: 'two sections' },
        { loc: 'harmless_dead_palm_mid', at: BRIDGE_SOUTH, want: 'Three sections', why: 'three sections' },
        { stage: 3 },
        { hasnt: 'woodplank' },

        { note: 'and now the same click crosses it' },
        { loc: 'harmless_dead_palm_mid', at: BRIDGE_SOUTH, why: 'climb the tree and cross' },

        { note: 'wiki step 6: Curpile Fyod, by the tree that is the wrong shape. Three questions out' },
        { note: 'of six at random, all three have to be right, and a wrong answer puts you back in' },
        { note: 'Mort’ton - so the roll is pinned for the length of this step and put back after.' },
        { go: CURPILE, why: 'north to the hollow tree' },
        { rng: 0, why: 'random(6) = 0, which is questions 1, 2 and 3' },
        { talk: 'route_curpile_fyod', picks: ['Sani Piliu.', 'Ivan Strom.', 'Veliaf Hurtz.'], want: 'Doors in the earth', why: 'the three questions' },
        { rng: null, why: 'the hellhound still has to be hit' },

        { note: 'wiki step 7: the doors in the earth, round the back of the tree' },
        { go: [3509, 3446], why: 'round the tree to the doors' },
        { loc: 'freedomfighterentrancer', at: EARTH_DOORS, why: 'open them' },

        { note: 'and the Myreque’s own door at the other end of the corridor' },
        { loc: 'freedomfighterundergroundentrancel', at: MYREQUE_DOORS, why: 'into the chamber' },
        { note: 'plane 3 is the chamber with six people in it. Plane 0 is the same chamber without' },
        { note: 'Sani Piliu and Harold Evans, and it is where this run ends up.' },
        { level: 3 },

        { note: 'wiki step 8: Veliaf first, then the other five' },
        { talk: 'route_veliaf_hurtz', want: 'Introduce yourself', why: 'who are you' },
        { stage: 4 },
        { talk: 'route_harold_evans', want: 'Harold Evans', why: 'introduce yourself' },
        { talk: 'route_radigad_ponfit', want: 'Radigad Ponfit', why: 'introduce yourself' },
        { talk: 'route_polmafi_ferdygris', want: 'Polmafi Ferdygris', why: 'introduce yourself' },
        { talk: 'route_sani_piliu', want: 'Sani Piliu', why: 'introduce yourself' },
        { talk: 'route_ivan_strom', want: 'Ivan Strom', why: 'introduce yourself' },
        { stage: 5 },

        { note: 'wiki step 9: the weapons, and the man from the tavern coming through the door' },
        { note: 'behind you. He goes through four of his five bodies here and the fifth is the chair' },
        { note: 'upstairs, which is empty from this point on.' },
        { talk: 'route_veliaf_hurtz', want: 'weapons look great', why: 'hand them over' },
        { stage: 6 },
        { hasnt: 'steel_longsword' },

        { note: 'wiki step 10: the Skeleton Hellhound. The cache gives it a level, a size and three' },
        { note: 'animations and no statblock at all, so it had nothing to fight with until now.' },
        { fight: 'skeleton_hellhound', r: 14, tries: 4, why: 'the hellhound' },
        { wait: 6, why: 'the death is queued, and the queue moves you down to plane 0' },
        { note: 'the same chamber, three planes down, with four of them left in it' },
        { level: 0 },

        { note: 'wiki step 11: Veliaf again, and the way out' },
        { talk: 'route_veliaf_hurtz', picks: ['How do I get out of here?'], want: 'cellar of the Hair of the Dog', why: 'how to leave' },
        { stage: 7 },

        { note: 'wiki step 12: out through the chamber’s own mouth, north up the corridor, and the' },
        { note: 'wall at the end of it is the back of the Hair of the Dog’s cellar' },
        { loc: 'route_cavewalltunnel', at: CHAMBER_MOUTH, why: 'out of the chamber' },
        { go: [3480, 9836], why: 'north-west up the corridor to the wall' },
        { loc: 'thrttavernbasementfalsewall', at: FALSE_WALL, why: 'search it' },
        { loc: 'thrttavernbasementladder', at: CELLAR_LADDER, why: 'up into Canifis' },

        { note: 'wiki step 13: the chair is empty and there is somebody else in it' },
        { go: TAVERN, why: 'back into the pub' },
        { talk: 'multi_vanstrom_stranger_entity', want: 'score to settle', why: 'the stranger' },
        { stage: 8 }
    ]
};

const p: any = H.makePlayer('myrequerun', m.start[0], m.start[1]);
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
