// BETWEEN A ROCK..., played through on foot.
//
// Quest 39 of the quest-by-quest pass. Dondakan has been hitting a rock of solid gold with an axe
// for eighteen years. The answer is written down in a mine cart full of forty-year-old paperwork,
// in four pieces, and it does not fire a cannonball at the rock - it fires a person.
//
//   npx tsx tools/sim/quest_dwarfrock_run.ts
import * as H from './harness.js';
import { play, Manifest } from './questrun.js';

await H.boot();

const DONDAKAN: [number, number, number] = [2825, 10168, 0];
const CART: [number, number] = [3017, 9845];

const m: Manifest = {
    quest: 'BETWEEN A ROCK...',
    source: 'oldschool.runescape.wiki/w/Between_a_Rock...',
    stageVar: 'dwarfrock_quest',
    done: 110,   // ^dwarfrock_complete
    start: [2825, 10168, 0],
    steps: [
        { note: 'wiki step 1: Dondakan, at the gold rock south of Keldagrim. He is placed as a' },
        { note: 'multinpc, so the npc to click is the parent - dwarfrock_multi_dondakan - and which' },
        { note: 'Dondakan you get depends on the stage.' },
        { talk: 'dwarfrock_multi_dondakan', picks: ["What's so special about it?"], want: 'Find me that', why: 'he asks for anything written down' },
        { stage: 10 },
        { talk: 'dwarfrock_multi_dondakan', want: 'librarian', why: 'he points east' },
        { stage: 20 },

        { note: 'wiki step 2: Rolad, the librarian in the Varrock palace library annexe' },
        { setpos: [3022, 3452, 0], why: 'east to Varrock' },
        { talk: 'dwarfrock_rolad', tries: 2, want: 'schematic', why: 'he has heard of the schematics' },
        { stage: 30 },
        { talk: 'dwarfrock_rolad', tries: 2, want: 'cart', why: 'and says which mine the carts are in' },
        { stage: 40 },

        { note: 'wiki step 3: the book carts in the dwarven mine - the base drawing and three' },
        { note: 'overlays, one search each' },
        { setpos: [3017, 9846, 0], why: 'down into the dwarven mine' },
        { loc: 'dwarfrock_book_cart', at: CART, want: 'schematic', why: 'the base drawing' },
        { has: 'dwarf_rock_base_schematic' },
        { loc: 'dwarfrock_book_cart', at: CART, why: 'overlay one' },
        { loc: 'dwarfrock_book_cart', at: CART, why: 'overlay two' },
        { loc: 'dwarfrock_book_cart', at: CART, why: 'overlay three' },
        { has: 'dwarf_rock_schematic1' },
        { has: 'dwarf_rock_schematic2' },
        { has: 'dwarf_rock_schematic3' },
        { stage: 50 },

        { note: 'wiki step 4: lay the overlays over the base and turn them until the lines meet' },
        { held: 'dwarf_rock_base_schematic', want: 'lines meet', why: 'assemble it' },
        { has: 'dwarf_rock_schematic_assembled' },
        { stage: 60 },

        { note: 'wiki step 5: back to Dondakan, who reads what it actually says' },
        { setpos: DONDAKAN, why: 'back to the rock' },
        { talk: 'dwarfrock_multi_dondakan', want: 'fires a PERSON', why: 'hand it over' },
        { stage: 70 },

        { note: 'wiki step 6: the two engineers - one in Keldagrim and one who drinks near the' },
        { note: 'mine. The first has to be met before the second will build anything.' },
        { setpos: [2871, 10197, 0], why: 'north into Keldagrim' },
        { talk: 'dwarfrock_engineer1', why: 'the first engineer' },
        { setpos: [2867, 9877, 0], why: 'and down to Khorvak, by the mine' },
        { talk: 'dwarfrock_engineer2', want: 'Wear it', why: 'he makes the gold helmet' },
        { stage: 80 },
        { has: 'dwarf_goldrock_helmet' },

        { note: 'wiki step 7: the helmet has to be WORN, not carried - Dondakan says so' },
        { held: 'dwarf_goldrock_helmet', op: 2, why: 'put it on' },
        { worn: 'dwarf_goldrock_helmet' },
        { setpos: DONDAKAN, why: 'back to the cannon' },
        { talk: 'dwarfrock_multi_dondakan', want: 'inside the rock', why: 'be fired into it' },
        { stage: 100 },

        { note: 'wiki step 8: and tell him what is in there' },
        { talk: 'dwarfrock_multi_dondakan', want: 'Hollow', why: 'eighteen years of hitting the outside' },
        { stage: 110 }
    ]
};

const p: any = H.makePlayer('dwarfrockrun', m.start[0], m.start[1]);
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
