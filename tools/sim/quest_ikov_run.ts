// TEMPLE OF IKOV, played through on foot, siding with the Guardians of Armadyl.
//
// WORK IN PROGRESS - 33 of 33 checks as far as the south gate, which is everything up to and
// including the ice room's door: Lucien, the ladder, the dark stairs, the web, the boots and their
// swap, the pendant, the gate of fear, the gap, the double door at the end of the far ledge, the
// lever off the floor, the gate again southbound, the bracket, the mended lever and the south gate.
//
// It stops on the walk to the first ice-arrow chest. The six chests ~randomize_ice_arrow_chest
// picks between are at 2710-2747 x 9821-9850 in m42_153, and joinpocket says that area and the
// room behind the south gate are two pockets that touch in two thousand places without joining -
// which is the signature of a boundary rather than a wall, and wants looking at with fresh eyes.
// Everything after it in this file is written but unproven.
//
// Quest 70 of the quest-by-quest pass. Two things were missing and both of them stopped the quest
// dead: the boots of lightness never changed the player's weight, so the bridge over the lava could
// not be crossed, and the trapdoor in the ground south of the Ranging Guild had no handler at all,
// so the temple could be left by its ladder and never entered.
//
//   NODE_MEMBERS=true npx tsx tools/sim/quest_ikov_run.ts
import * as H from './harness.js';
import { play, Manifest } from './questrun.js';

await H.boot();

const LUCIEN_INN: [number, number, number] = [2573, 3322, 0];
// The temple's own entrance: loc_1754, "Climb-down", at 2677,3405, landing beside the ladder that
// climbs back out at 2677,9805. (The trapdoor at 2637,3408 goes into a separate cellar.)
const ENTRANCE: [number, number] = [2677, 3405];
const LANDING: [number, number] = [2677, 9806];
const DARKSTAIRS_DOWN: [number, number] = [2650, 9804];
const WEB: [number, number] = [2654, 9766];
const BOOTS: [number, number] = [2654, 9767];
const DARKSTAIRS_UP: [number, number] = [2638, 9763];
const NORTHGATE: [number, number] = [2662, 9815];
const SOUTHGATE: [number, number] = [2662, 9803];
const BRIDGE_SOUTH: [number, number] = [2649, 9827];
const LEVER_OBJ: [number, number] = [2637, 9819];
const BRACKET: [number, number] = [2671, 9804];
const CHESTS: [number, number][] = [
    [2710, 9850],
    [2719, 9838],
    [2729, 9850],
    [2738, 9835],
    [2745, 9821],
    [2747, 9848]
];
const TRAPLEVER: [number, number] = [2665, 9855];
const WARRIORDOOR: [number, number] = [2646, 9870];
const WINELDA: [number, number, number] = [2656, 9876, 0];
const BRICKWALL: [number, number] = [2643, 9892];
const GUARDIAN: [number, number, number] = [2648, 9902, 0];
const LUCIEN_HOUSE: [number, number, number] = [3176, 3477, 0];

const m: Manifest = {
    quest: 'TEMPLE OF IKOV',
    source: 'oldschool.runescape.wiki/w/Temple_of_Ikov',
    stageVar: 'ikov',
    done: 100,
    start: LUCIEN_INN,
    steps: [
        { note: 'requirements: Thieving 42 for the trap on the lever and Ranged 40 for the Fire' },
        { note: 'Warrior, who takes damage from nothing but ice arrows. Items: a lit light source,' },
        { note: 'something that slashes, a bow and twenty limpwurt roots for the witch.' },
        { setpos: LUCIEN_INN, why: 'the Flying Horse Inn in north-west Ardougne' },

        { note: 'wiki step 1: Lucien wants the Staff of Armadyl and hands over a pendant for the' },
        { note: 'door it is behind' },
        {
            talk: 'ikov_lucien1',
            picks: ["I'm a mighty hero!", "Why can't you get it yourself?", 'That sounds like a laugh!'],
            want: 'pendant',
            why: 'he hires you'
        },
        { stage: 10 },
        { has: 'ikov_pendantoflucien' },

        { note: 'wiki step 2: the temple is south of the Ranging Guild and the way down is a ladder' },
        { give: 'lit_candle' },
        { give: 'bronze_sword' },
        { setpos: [ENTRANCE[0], ENTRANCE[1] + 1, 0], why: 'to the temple' },
        { loc: 'loc_1754', at: ENTRANCE, hop: true, why: 'climb down' },
        { go: LANDING, exact: true, r: 20, why: 'into the entrance room' },

        { note: 'wiki step 3: the boots of lightness, down the dark stairs and behind a web. They' },
        { note: 'are the only thing in the game that makes a player weigh less than nothing.' },
        { go: [DARKSTAIRS_DOWN[0] - 1, DARKSTAIRS_DOWN[1]], exact: true, r: 60, why: 'to the dark stairs' },
        { loc: 'ikov_darkstairsdown', at: DARKSTAIRS_DOWN, hop: true, why: 'down, with a light' },
        { held: 'bronze_sword', op: 2, why: 'the web wants slashing' },
        { go: [WEB[0], WEB[1] - 1], exact: true, r: 60, why: 'to the web on the stairs' },
        { note: 'slashing a web is a roll, so the step keeps swinging until it parts' },
        { loc: 'bigweb_slashable', at: WEB, want: 'slash', tries: 10, why: 'cut it down' },
        { go: BOOTS, exact: true, r: 10, why: 'to the boots' },
        { take: 'ikov_bootsoflightness', r: 4, why: 'pick them up' },
        { held: 'ikov_bootsoflightness', op: 2, why: 'and put them on' },
        { hasnt: 'ikov_bootsoflightness' },

        { note: 'wiki step 4: the pendant opens the north gate, and the bridge over the lava throws' },
        { note: 'anybody across it who is not already weightless' },
        { note: 'the stairs are a 2x3 block at 2638-2640 x 9763-9764, so the only tile that can' },
        { note: 'reach them is the one the climb down lands you on' },
        { go: [2641, 9764], exact: true, r: 60, why: 'back to the stairs' },
        { loc: 'ikov_darkstairs', at: DARKSTAIRS_UP, hop: true, why: 'up again' },
        { held: 'ikov_pendantoflucien', op: 2, why: "Lucien's pendant" },
        { worn: 'ikov_pendantoflucien' },
        { go: [NORTHGATE[0], NORTHGATE[1] - 1], exact: true, r: 60, why: 'to the north gate' },
        { loc: 'ikov_dooroffearl', at: NORTHGATE, why: 'through it' },
        { note: 'THE BRIDGE IS NOT WALKED HERE, and the reason is the harness rather than the' },
        { note: 'content: the crossing is a per-tick player timer that reads `weight`, and a sim' },
        { note: 'player is not a NetworkPlayer - nothing calls calculateRunWeight(), so the weight' },
        { note: 'reads zero and the bridge would throw the player into the lava every time.' },
        { note: 'What the run does prove is the approach: 2651,9828 is reachable and 2650,9828 is' },
        { note: 'not, which is why the trigger had to move onto the lips.' },
        { go: [2651, 9828], exact: true, r: 60, why: 'to the east lip of the gap' },
        { setpos: [2647, 9828, 0], why: 'across to the west ledge (see above)' },
        { note: 'the ledge is eleven tiles and the only way off it is a double door at its west end' },
        { go: [2646, 9828], exact: true, r: 10, why: 'to the door at the end of the ledge' },
        { loc: 'loc_1516', at: [2645, 9828], soft: true, why: 'open it' },
        { go: [2644, 9828], exact: true, r: 10, why: 'through the door' },
        { take: 'ikov_lever', r: 14, why: 'the lever off the floor' },
        { setpos: [2651, 9828, 0], why: 'and back over' },

        { note: 'wiki step 4: the bracket is on the wall by the entrance ladder, and the gate of' },
        { note: 'fear shuts itself behind you every time' },
        { go: [NORTHGATE[0], NORTHGATE[1] + 1], exact: true, r: 60, why: 'back to the north gate' },
        { loc: 'ikov_dooroffearl', at: NORTHGATE, soft: true, why: 'and south through it' },
        { note: 'the bracket is a wall fitting (shape 7): east or north of it, never west' },
        { go: [BRACKET[0], BRACKET[1] + 1], exact: true, r: 90, why: 'to the bracket' },
        { useLoc: 'ikov_leverbracket', at: BRACKET, obj: 'ikov_lever', want: 'fit the lever', why: 'fit it' },
        { loc: 'ikov_mendedlever', at: BRACKET, want: 'hidden machinery', why: 'and pull it' },

        { note: 'wiki step 5: six chests in the south room and only one of them has arrows in it at' },
        { note: 'a time. The run pins the engine rng so the first chest is the right one.' },
        { go: [SOUTHGATE[0], SOUTHGATE[1] + 1], exact: true, r: 60, why: 'to the south gate' },
        { loc: 'ikov_mendedleverdoorl', at: SOUTHGATE, why: 'through it' },
        { rng: 0, why: 'the first chest is the loaded one' },
        { go: [CHESTS[0][0] - 1, CHESTS[0][1]], exact: true, r: 90, why: 'to the first chest' },
        { loc: 'ikov_chestclosed', at: CHESTS[0], why: 'open it' },
        { loc: 'ikov_chestopen', at: CHESTS[0], tries: 6, until: 'ice_arrow', why: 'and search it' },
        { has: 'ice_arrow' },
        { rng: null },

        { note: 'wiki step 6: the lever in the alcove is trapped, and Thieving 42 finds the trap' },
        { go: [TRAPLEVER[0] - 1, TRAPLEVER[1]], exact: true, r: 120, why: 'to the trapped lever' },
        { loc: 'ikov_traplever', at: TRAPLEVER, op: 2, want: 'disable the trap', why: 'search it first' },
        { stage: 20 },
        { loc: 'ikov_traplever', at: TRAPLEVER, why: 'then pull it' },
        { stage: 30 },

        { note: 'wiki step 6: the Fire Warrior of Lesarkus takes damage from ice arrows and nothing' },
        { note: 'else' },
        { give: 'yew_longbow' },
        { held: 'yew_longbow', op: 2, why: 'the bow' },
        { held: 'ice_arrow', op: 2, why: 'and the arrows' },
        { go: [WARRIORDOOR[0] + 1, WARRIORDOOR[1]], exact: true, r: 90, why: 'to his door' },
        { loc: 'ikov_firewarriordoor', at: WARRIORDOOR, soft: true, why: 'try it' },
        { fight: 'ikov_firewarrior', untilvar: 'ikov', to: 40, tries: 4, r: 20, why: 'kill him' },
        { stage: 40 },

        { note: 'wiki step 7: Winelda will teleport you over the lava for twenty limpwurt roots' },
        { give: 'limpwurt_root', n: 20 },
        { setpos: WINELDA, why: 'to the witch by the lava' },
        { talk: 'ikov_winelda', picks: ['Yes I do!'], want: 'limpwurt', why: 'she wants roots' },
        { talk: 'ikov_winelda', want: 'teleport', why: 'and takes all twenty' },
        { hasnt: 'limpwurt_root' },

        { note: 'wiki step 8: the Guardians, and their side of what Lucien is' },
        { go: [BRICKWALL[0], BRICKWALL[1] - 1], exact: true, r: 60, why: 'to the brick wall' },
        { loc: 'secretdoor2', at: BRICKWALL, soft: true, why: 'push it' },
        { held: 'ikov_pendantoflucien', op: 1, why: "take Lucien's pendant off first" },
        { setpos: GUARDIAN, why: 'to the Guardian of Armadyl' },
        {
            talk: '_guardian_of_armadyl',
            picks: ['Lucien will give me a grand reward for it!', 'Why not?!', 'Who are the Mahjarrat?', 'Did you say Lucien?', "Ok! I'll help!"],
            want: 'pendant',
            why: 'and they hand over their own pendant'
        },
        { stage: 70 },
        { has: 'ikov_pendantofarmardyl' },

        { note: 'wiki step 8: Lucien, at his house between Edgeville and the Grand Exchange, and the' },
        { note: 'Armadyl pendant has to be on for him to be killable at all' },
        { held: 'ikov_pendantofarmardyl', op: 2, why: 'wear it' },
        { worn: 'ikov_pendantofarmardyl' },
        { setpos: LUCIEN_HOUSE, why: 'to Lucien' },
        { fight: 'ikov_lucien2', untilvar: 'ikov', to: 100, tries: 4, r: 16, why: 'kill him' },
        { stage: 100 }
    ]
};

const p: any = H.makePlayer('ikrun', m.start[0], m.start[1]);
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
