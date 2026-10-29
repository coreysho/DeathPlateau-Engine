// TROLL STRONGHOLD, played through on foot.
//
// Quest 73 of the quest-by-quest pass. The trolls took Dunstan's son Godric during the Imperial
// Guard's night attack, and he is in a cell inside their stronghold. Dad blocks the arena, a Troll
// General carries the prison key, and the two sleeping guards outside the cells carry one cell key
// each.
//
//   NODE_MEMBERS=true npx tsx tools/sim/quest_trollstronghold_run.ts
import * as H from './harness.js';
import { play, Manifest } from './questrun.js';

await H.boot();

const DENULTH: [number, number, number] = [2899, 3528, 0];
const ARENA_OUT: [number, number, number] = [2896, 3618, 0];
const ARENA_IN: [number, number] = [2897, 3618];
const ARENA_EXIT: [number, number] = [2916, 3629];
const STRONGHOLD_DOOR: [number, number] = [2839, 3689];
const STRONGHOLD_OUT: [number, number, number] = [2840, 3689, 0];
const INTERIOR_DOOR: [number, number] = [2838, 10057]; // L2
const STAIRS_DOWN: [number, number] = [2843, 10108]; // L2, to the prison level
const PRISON_DOOR: [number, number] = [2848, 10107]; // L1
const PRISON_STAIRS: [number, number] = [2852, 10107]; // L1, down to the cells
const CELL_GODRIC: [number, number] = [2832, 10078];
const CELL_EADGAR: [number, number] = [2832, 10082];
const DUNSTAN: [number, number, number] = [2918, 3576, 0];

const m: Manifest = {
    quest: 'TROLL STRONGHOLD',
    source: 'oldschool.runescape.wiki/w/Troll_Stronghold',
    stageVar: 'troll_quest',
    done: 50, // ^troll_complete
    start: DENULTH,
    steps: [
        { note: 'requirements: Death Plateau, 15 Agility. Items: climbing boots.' },
        { setvar: 'death_equiproom', to: 80, why: '^death_complete - Death Plateau' },
        { setpos: DENULTH, why: 'to Denulth at the Imperial Guard camp' },

        { note: 'wiki step 1: the attack went wrong and the trolls took Godric' },
        {
            talk: 'death_ig_commander',
            picks: ['How goes your fight with the trolls?', 'Is there anything I can do to help?', "I'll get Godric back!"],
            want: 'God speed',
            why: 'and you volunteer to fetch him back'
        },
        { stage: 10 },

        { note: 'wiki step 3: Dad holds the arena, and the gate wakes him up' },
        { setpos: ARENA_OUT, why: 'to the arena gate on the west side' },
        { loc: 'troll_stronghold_arena_entrance_left', at: ARENA_IN, want: 'defeating Dad', why: 'through the gate' },
        { note: 'the fight stops itself at 20 hitpoints - Dad gives up rather than dying.' },
        {
            fight: 'troll_champion',
            untilvar: 'troll_quest',
            to: 20,
            tries: 6,
            r: 24,
            picks: ["I'll be going now."],
            why: 'until he yields'
        },
        { stage: 20 },

        { note: 'wiki step 4: out through the north gate' },
        { loc: 'troll_stronghold_arena_exit_left', at: ARENA_EXIT, soft: true, why: 'leave the arena' },

        { note: 'wiki step 6: across Trollheim to the stronghold entrance' },
        { setpos: STRONGHOLD_OUT, why: 'to the cave entrance on Trollheim' },
        { loc: 'troll_stronghold_door', at: STRONGHOLD_DOOR, hop: true, soft: true, why: 'into the stronghold' },

        { note: 'wiki step 7: a Troll General carries the prison key. The generals are in their own' },
        { note: '336-tile half of the cave, and the ONE thing joining it to the entrance is the' },
        { note: 'interior door at 2838,10057 - a door_closed, so handled generically.' },
        { go: [INTERIOR_DOOR[0] + 1, INTERIOR_DOOR[1]], exact: true, r: 96, why: 'south down the corridor' },
        { loc: 'troll_stronghold_interior_door', at: INTERIOR_DOOR, soft: true, why: 'through the interior door' },
        { fight: 'troll_general', until: 'troll_key_prison', tries: 4, r: 40, why: 'for the prison key' },
        { take: 'troll_key_prison', r: 12, why: 'and pick it up' },
        { has: 'troll_key_prison' },

        { note: 'wiki step 8: down to the prison level and through the locked door' },
        { loc: 'troll_stronghold_stairstop', at: STAIRS_DOWN, hop: true, soft: true, why: 'down the stairs' },
        { go: [PRISON_DOOR[0] - 1, PRISON_DOOR[1]], exact: true, r: 40, why: 'to the prison door' },
        { useLoc: 'troll_stronghold_prison_door_closed', at: PRISON_DOOR, obj: 'troll_key_prison', want: 'unlock', why: 'unlock it' },
        { stage: 30 },
        { loc: 'troll_stronghold_stairstop', at: PRISON_STAIRS, hop: true, soft: true, why: 'down to the cells' },

        { note: 'wiki step 9: the two guards are asleep, one cell key each' },
        { talk: 'troll_prison_guard1', op: 3, tries: 6, until: 'troll_key_godric', want: 'find a key', why: 'pick the first pocket' },
        { has: 'troll_key_godric' },
        { talk: 'troll_prison_guard2', op: 3, tries: 6, until: 'troll_key_eadgar', want: 'find a key', why: 'and the second' },
        { has: 'troll_key_eadgar' },

        { note: 'and both cells open' },
        { useLoc: 'troll_celldoor_godric', at: CELL_GODRIC, obj: 'troll_key_godric', want: 'unlock the cell door', why: 'free Godric' },
        { stage: 40 },
        { useLoc: 'troll_celldoor_eadgar', at: CELL_EADGAR, obj: 'troll_key_eadgar', want: 'unlock the cell door', why: 'and free Eadgar too' },
        { varis: 'troll_freed_eadgar', to: 1 },

        { note: 'wiki step 11: Dunstan the smith is Godric’s father' },
        { setpos: DUNSTAN, why: 'to Dunstan in Burthorpe' },
        { talk: 'death_smithy', want: 'safe and sound', why: 'his son is home' },
        { stage: 50 },
        { has: 'law_talisman' }
    ]
};

const p: any = H.makePlayer('trollrun', m.start[0], m.start[1]);
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
