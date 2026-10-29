// THE LOST TRIBE, played through on foot.
//
// Quest 74 of the quest-by-quest pass. The Duke's cellar wall has fallen in and his silverware is
// gone, and the creature somebody saw in the rubble turns out to be a Dorgeshuun goblin who has
// been living under Lumbridge since the god wars. The thief is the Duke's own advisor.
//
//   NODE_MEMBERS=true npx tsx tools/sim/quest_losttribe_run.ts
import * as H from './harness.js';
import { play, Manifest } from './questrun.js';

await H.boot();

const CASTLE_UP: [number, number, number] = [3211, 3220, 1]; // beside Sigmund
const DUKE: [number, number, number] = [3212, 3219, 1];
const COOK: [number, number, number] = [3211, 3214, 0];
const TRAPDOOR: [number, number] = [3209, 3216];
const CELLAR_WALL: [number, number] = [3219, 9618];
const _CAVE_WALL_BACKCAVE_WALL_BACK: [number, number] = [3221, 9618];
const BROOCH: [number, number] = [3228, 9614];
const LIBRARY: [number, number, number] = [3210, 3496, 0]; // inside the library, beside Reldo
const BOOKCASE_STAND: [number, number] = [3208, 3496];
const BOOKCASE: [number, number] = [3207, 3496];
const GOBLIN_VILLAGE: [number, number, number] = [2958, 3510, 0];
const CAVE_SIDE: [number, number, number] = [3221, 9618, 0];
const MISTAG_SIDE: [number, number, number] = [3318, 9615, 0];
const SIGMUND_CHEST: [number, number] = [3209, 3217];
const HAM_TRAPDOOR: [number, number] = [3166, 3252];
const HAM_OUTSIDE: [number, number, number] = [3167, 3252, 0];
const HAM_CRATE: [number, number] = [3152, 9645];

const m: Manifest = {
    quest: 'THE LOST TRIBE',
    source: 'oldschool.runescape.wiki/w/The_Lost_Tribe',
    stageVar: 'lost_tribe_quest',
    done: 11, // ^lost_tribe_complete
    start: [3211, 3222, 0],
    steps: [
        { note: 'requirements: Goblin Diplomacy, Rune Mysteries, 13 Agility, 13 Thieving, 17 Mining.' },
        { note: 'Items: a pickaxe and a light source - the tunnels are a level 3 dark area.' },
        { setvar: 'goblinquest', to: 6, why: '^gobdip_complete' },
        { setvar: 'runemysteries', to: 6, why: '^runemysteries_complete' },
        { give: 'bronze_pickaxe' },
        { note: 'the lantern is a level 3 light, so the dark never bites' },
        { give: 'bullseye_lantern_lit' },

        { note: 'wiki step 1: Sigmund, the Duke’s advisor, hands out the quest' },
        { setpos: CASTLE_UP, why: 'to Sigmund on the castle first floor' },
        {
            talk: 'lost_tribe_sigmund',
            picks: ['Do you have any quests for me?', "Yes, I'll find out what happened."],
            want: 'Ask around',
            why: 'the cellar wall is down and the silverware is gone'
        },
        { stage: 1 },

        { note: 'wiki step 2: one of four Lumbridge residents saw the creature, picked at random' },
        { note: 'when the quest starts. Pinned to the cook so the walk has somebody to ask.' },
        { setvar: 'lost_tribe_contact', to: 0, why: '^lost_tribe_contact_cook' },
        { setpos: COOK, why: 'down to the kitchen' },
        {
            talk: 'cook',
            picks: ['Do you know what happened in the castle cellar?'],
            want: 'bulging eyes',
            why: 'he saw a grey creature with huge eyes'
        },
        { stage: 2 },

        { note: 'wiki step 3: tell the Duke' },
        { setpos: DUKE, why: 'back up to Duke Horacio' },
        {
            talk: 'duke_of_lumbridge',
            picks: ['The cook says he saw something in the cellar.'],
            want: 'dig through',
            why: 'and he sets you digging'
        },
        { stage: 3 },

        { note: 'wiki steps 4-6: the kitchen trapdoor, a pickaxe on the rubble, and the brooch' },
        { setpos: [TRAPDOOR[0] + 1, TRAPDOOR[1], 0], why: 'to the kitchen trapdoor' },
        { loc: 'loc_14879', at: TRAPDOOR, hop: true, soft: true, why: 'down into the cellar' },
        { go: [CELLAR_WALL[0] - 1, CELLAR_WALL[1]], exact: true, r: 40, why: 'to the fallen wall' },
        { useLoc: 'lost_tribe_cellar_wall', at: CELLAR_WALL, obj: 'bronze_pickaxe', want: 'hole in the wall', why: 'dig through' },
        { stage: 4 },
        { loc: 'lost_tribe_cellar_wall', at: CELLAR_WALL, hop: true, soft: true, why: 'squeeze through' },
        { go: BROOCH, exact: true, r: 24, why: 'ten steps into the cave' },
        { take: 'lost_tribe_brooch', r: 6, why: 'the stone brooch' },
        { has: 'lost_tribe_brooch' },

        { note: 'wiki step 7: show the Duke the brooch' },
        { setpos: DUKE, why: 'back to the Duke' },
        { talk: 'duke_of_lumbridge', picks: ['I dug through the rubble...'], want: 'Reldo', why: 'he has never seen the symbol' },
        { stage: 5 },

        { note: 'wiki steps 8-9: Reldo, then the northernmost bookcase on the west wall' },
        { note: 'the library is a sealed 42-tile room - the tiles north of z 3497 are a map wall' },
        { note: 'with no door loc on it, so the jump has to land inside.' },
        { setpos: LIBRARY, why: 'to the Varrock palace library' },
        { talk: 'reldo', want: 'northernmost bookcase', why: 'it is a goblin tribe symbol' },
        { note: 'the bookcases on the west wall are a solid column at x 3207, z 3495-3497, so the' },
        { note: 'only tile that touches the northernmost one is 3208,3496.' },
        { go: BOOKCASE_STAND, exact: true, r: 24, why: 'to the bookcase' },
        { loc: 'lost_tribe_bookcase', at: BOOKCASE, want: 'book on goblins', why: 'search it' },
        { has: 'lost_tribe_book' },
        { held: 'lost_tribe_book', op: 1, want: 'Dorgeshuun', why: 'and read it' },
        { stage: 6 },

        { note: 'wiki step 10: the goblin generals know the old greeting' },
        { setpos: GOBLIN_VILLAGE, why: 'to the Goblin Village' },
        { talk: 'general_bentnoze', want: 'Goblin Bow', why: 'and they teach you the two emotes' },
        { stage: 7 },

        { note: 'wiki step 12: bow to Mistag at the far end of the mine' },
        { setpos: CAVE_SIDE, why: 'back through the hole in the cellar wall' },
        { go: [MISTAG_SIDE[0], MISTAG_SIDE[1]], exact: true, r: 128, why: 'along the tunnels to the mine' },
        { note: 'the emote is an interface button, and the reply is queued three ticks later.' },
        { press: 'emotes:goblin_bow', why: 'the Goblin Bow, in front of Mistag' },
        { wait: 6, why: 'his answer is a queue' },
        { stage: 8 },

        { note: 'wiki step 13: and he explains what brought the wall down' },
        {
            talk: 'lost_tribe_mistag',
            picks: ["I'll find my own way."],
            want: 'only peace',
            why: 'their mining brought the wall down, but they took nothing'
        },
        { stage: 9 },
        { has: 'cave_goblin_mining_helmet_unlit' },

        { note: 'wiki step 14: the Duke takes his advisor’s word over yours' },
        { setpos: DUKE, why: 'back to the Duke' },
        { talk: 'duke_of_lumbridge', picks: ["I've made contact with the cave goblins..."], want: 'bring me proof', why: 'he will not listen' },
        { varis: 'lost_tribe_sigmund_accused', to: 1 },

        { note: 'wiki step 15: Sigmund keeps H.A.M. robes in a chest, and the key in his pocket' },
        { setpos: CASTLE_UP, why: 'to Sigmund' },
        { talk: 'lost_tribe_sigmund', op: 3, tries: 8, until: 'lost_tribe_chest_key', want: 'small key', why: 'pick his pocket' },
        { has: 'lost_tribe_chest_key' },
        { note: 'the chest is in the NEXT room, and the first floor rooms do not join: each has one' },
        { note: 'door onto the landing at x 3206-3207. Out of Sigmund’s room, along, and in again.' },
        { go: [3208, 3222], exact: true, r: 24, why: 'to the door of his room' },
        { loc: 'loc_1536', at: [3207, 3222], soft: true, why: 'out onto the landing' },
        { go: [3207, 3215], exact: true, r: 32, why: 'along the landing' },
        { loc: 'loc_1536', at: [3207, 3214], soft: true, why: 'into the room with the chest' },
        { go: [SIGMUND_CHEST[0] + 1, SIGMUND_CHEST[1]], exact: true, r: 24, why: 'round to the chest' },
        { loc: 'lost_tribe_chest', at: SIGMUND_CHEST, want: 'H.A.M.', why: 'and open his chest' },
        { has: 'ham_shirt' },

        { note: 'wiki steps 16-17: the H.A.M. hideout, and the silverware in a crate' },
        { setpos: HAM_OUTSIDE, why: 'to the H.A.M. trapdoor north-west of the castle' },
        { loc: 'ham_multi_trapdoor', at: HAM_TRAPDOOR, op: 5, tries: 8, want: 'You pick the lock', why: 'pick the lock' },
        { loc: 'ham_multi_trapdoor', at: HAM_TRAPDOOR, hop: true, soft: true, why: 'climb down' },
        { go: [HAM_CRATE[0], HAM_CRATE[1] + 1], exact: true, r: 40, why: 'to the crate south of the ladder' },
        { loc: 'lost_tribe_crate', at: HAM_CRATE, want: 'silverware', why: 'search it' },
        { has: 'lost_tribe_silverware' },

        { note: 'wiki step 18: the Duke dismisses Sigmund and signs a treaty' },
        { setpos: DUKE, why: 'back to the Duke' },
        { talk: 'duke_of_lumbridge', picks: ['I found the missing silverware in the H.A.M. cave!'], want: 'peace treaty', why: 'and he signs' },
        { stage: 10 },
        { has: 'lost_tribe_treaty' },

        { note: 'wiki step 20: Mistag takes the treaty' },
        { setpos: MISTAG_SIDE, why: 'back to Mistag' },
        { talk: 'lost_tribe_mistag', want: 'there will be peace', why: 'and Ur-tag will set his mark on it' },
        { stage: 11 },
        { has: 'ring_of_life' }
    ]
};

const p: any = H.makePlayer('ltriberun', m.start[0], m.start[1]);
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
