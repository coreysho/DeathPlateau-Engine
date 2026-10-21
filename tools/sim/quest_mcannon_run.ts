// DWARF CANNON, played through on foot.
//
// Quest 59 of the quest-by-quest pass. This one was already built with care, and built to the
// PRE-REWORK shape on purpose: the quest was reworked on 13 June 2006 and this server's map and
// npcs are the older ones, so the cannon is repaired through its Inspect menu (pipe, barrel, axle,
// shaft) rather than the three-tool minigame the modern wiki describes. The cache agrees -
// broken_multicannon carries op1=Inspect and nothing else, mcannontoolkit has no item ops, and
// there is no safety switch, spring or gear anywhere in it.
//
// Two rolls are pinned for the run: replacing a railing is stat_random(crafting, 60, 150) and both
// halves of the cannon repair are stat_random on smithing and crafting.
//
//   NODE_MEMBERS=true npx tsx tools/sim/quest_mcannon_run.ts
import * as H from './harness.js';
import { play, Manifest } from './questrun.js';

await H.boot();

const LAWGOF: [number, number] = [2572, 3462];
const RAIL1: [number, number] = [2556, 3475];
const RAIL2: [number, number] = [2558, 3472];
const RAIL3: [number, number] = [2557, 3464];
const RAIL4: [number, number] = [2559, 3462];
const RAIL5: [number, number] = [2564, 3460];
const RAIL6: [number, number] = [2572, 3460];
const LADDER_L0: [number, number] = [2570, 3441];
const LADDER_L1: [number, number] = [2570, 3443];
const CAVE: [number, number] = [2622, 3392];
const CRATE: [number, number] = [2571, 9850];
const MUDPILE: [number, number] = [2621, 9796];
const SHED_DOOR: [number, number] = [2576, 3461];
const CANNON: [number, number] = [2577, 3461];
const NULODION_DOOR: [number, number] = [3015, 3453];
// The camp's south fence has a double gate in it - loc_1558 on 2567,3458 and loc_1557 beside it, "A wrought iron gate." - and
// it is the only thing joining Lawgof's 1294-tile pocket to the rest of Kandarin. It shuts itself
// after a few hundred ticks, so every crossing opens it again, and the click is soft because it is
// sometimes still standing open from the last one.
const GATE_IN: [number, number] = [2567, 3458];
const GATE_OUT: [number, number] = [2567, 3457];

const m: Manifest = {
    quest: 'DWARF CANNON',
    source: 'oldschool.runescape.wiki/w/Dwarf_Cannon',
    stageVar: 'mcannon',
    done: 11,
    start: [2572, 3462, 0],
    steps: [
        { note: 'no requirements at all, and no items: Captain Lawgof hands over the six railings' },
        { note: 'and the toolkit himself.' },

        { note: 'wiki step 1: Captain Lawgof, inside the fenced camp north of the Fishing Guild' },
        { talk: 'lawgof2', picks: ["Yeah, I'd love to help."], want: 'six railings', why: 'he sets the quest' },
        { stage: 1 },
        { has: 'mcannonrailing1_obj', n: 6 },

        { note: 'wiki step 2: six bent railings in the fence, every one of them a wall-straight loc' },
        { note: 'that takes a click from the two tiles it separates. Replacing one is a Crafting' },
        { note: 'roll that costs hitpoints when it fails, so the roll is pinned.' },
        { rng: 0, why: 'every railing goes in first time' },
        { go: [RAIL1[0], RAIL1[1]], exact: true, why: 'the first railing' },
        { loc: 'mcannonrailing1', at: RAIL1, picks: ['Try to replace the railing.'], want: 'with no problems', why: 'one' },
        { go: [RAIL2[0], RAIL2[1]], exact: true, why: 'the second' },
        { loc: 'mcannonrailing2', at: RAIL2, picks: ['Try to replace the railing.'], want: 'with no problems', why: 'two' },
        { go: [RAIL3[0], RAIL3[1]], exact: true, why: 'the third' },
        { loc: 'mcannonrailing3', at: RAIL3, picks: ['Try to replace the railing.'], want: 'with no problems', why: 'three' },
        { go: [RAIL4[0], RAIL4[1]], exact: true, why: 'the fourth' },
        { loc: 'mcannonrailing4', at: RAIL4, picks: ['Try to replace the railing.'], want: 'with no problems', why: 'four' },
        { go: [RAIL5[0], RAIL5[1]], exact: true, why: 'the fifth' },
        { loc: 'mcannonrailing5', at: RAIL5, picks: ['Try to replace the railing.'], want: 'with no problems', why: 'five' },
        { go: [RAIL6[0], RAIL6[1]], exact: true, why: 'the sixth' },
        { loc: 'mcannonrailing6', at: RAIL6, picks: ['Try to replace the railing.'], want: 'with no problems', why: 'six' },
        { varis: 'mcannonmulti', to: 2016, why: 'bits 5-10 all set, which is what Lawgof reads' },

        { note: 'wiki step 3: back to Lawgof, who has lost contact with the southern watchtower' },
        { go: [LAWGOF[0], LAWGOF[1]], why: 'back to Lawgof' },
        { talk: 'lawgof2', want: 'watch tower', why: 'the railings are done' },
        { stage: 2 },

        { note: 'wiki step 4: the tower is two ladders up, and the lower one refuses to open its' },
        { note: 'trap door until Lawgof has asked for the guard' },
        { go: [GATE_IN[0], GATE_IN[1]], exact: true, why: 'the camp gate' },
        { loc: 'loc_1558', at: GATE_IN, soft: true, why: 'open it' },
        { go: [LADDER_L0[0] + 1, LADDER_L0[1]], r: 120, why: 'south to the tower ladder' },
        { loc: 'ladder', at: LADDER_L0, why: 'up to the first floor' },
        { loc: 'ladder', at: LADDER_L1, why: 'and up to the top' },
        { take: 'mcannonremains', r: 8, why: "Gilob's remains, on the top floor" },
        { has: 'mcannonremains' },
        { loc: 'laddertop', at: LADDER_L1, why: 'back down' },
        { loc: 'laddertop', at: LADDER_L0, why: 'and down to the ground' },
        { go: [GATE_OUT[0], GATE_OUT[1]], exact: true, r: 120, why: 'back to the gate' },
        { loc: 'loc_1558', at: GATE_IN, soft: true, why: 'open it again' },
        { go: [LAWGOF[0], LAWGOF[1]], r: 120, why: 'back to Lawgof with them' },
        { talk: 'lawgof2', want: 'those animals', why: 'he takes the news badly' },
        { stage: 3 },
        { hasnt: 'mcannonremains' },

        { note: 'wiki step 6: the goblin cave outside the south-east corner of the Fishing Guild' },
        { go: [GATE_IN[0], GATE_IN[1]], exact: true, why: 'the camp gate' },
        { loc: 'loc_1558', at: GATE_IN, soft: true, why: 'open it' },
        { go: [CAVE[0], CAVE[1] + 1], r: 120, why: 'south-east to the cave mouth' },
        { loc: 'mcannoncave', at: CAVE, want: 'cautiously enter', why: 'in' },
        { stage: 4 },
        { go: [CRATE[0], CRATE[1] - 1], r: 120, why: 'north-west through the cave to the crates' },
        { loc: 'mcannoncrateboy', at: CRATE, want: 'dwarf child, tied up', why: 'the northernmost crate on the east wall' },
        { stage: 5 },

        { note: 'and back out of the cave over the mud pile' },
        { go: [MUDPILE[0], MUDPILE[1] + 1], r: 120, why: 'back to the mud pile' },
        { loc: 'mcanmudpile', at: MUDPILE, why: 'out' },
        { go: [GATE_OUT[0], GATE_OUT[1]], exact: true, r: 120, why: 'back to the gate' },
        { loc: 'loc_1558', at: GATE_IN, soft: true, why: 'open it again' },
        { go: [LAWGOF[0], LAWGOF[1]], r: 120, why: 'back to Lawgof' },
        { talk: 'lawgof2', picks: ["Ok, I'll see what I can do."], want: 'tool kit', why: 'Lollk is home and the cannon is sabotaged' },
        { stage: 6 },
        { has: 'mcannontoolkit' },

        { note: 'wiki step 7: the cannon in the shed. Pre-rework this is the Inspect menu - a pipe,' },
        { note: 'a barrel, an axle and a shaft - and both the inspection and each repair are rolls.' },
        { note: 'the shed door is a wall-straight loc on the west edge of its own tile, and that' },
        { note: 'tile is inside the shed - so the click comes from the one tile outside it' },
        { go: [SHED_DOOR[0] - 1, SHED_DOOR[1]], exact: true, why: 'outside the shed door' },
        { loc: 'mcannondoor1', at: SHED_DOOR, why: 'open it; locked until this stage' },
        { loc: 'broken_multicannon', at: CANNON, want: 'fix it with the toolkit', why: 'the first look' },
        { stage: 7 },
        { loc: 'broken_multicannon', at: CANNON, picks: ['Pipe'], want: 'manage to fix it', why: 'the pipe' },
        { loc: 'broken_multicannon', at: CANNON, picks: ['Barrel'], want: 'manage to fix it', why: 'the barrel' },
        { loc: 'broken_multicannon', at: CANNON, picks: ['Axle'], want: 'manage to fix it', why: 'the axle' },
        { loc: 'broken_multicannon', at: CANNON, picks: ['Shaft'], want: 'manage to fix it', why: 'the shaft' },
        { loc: 'broken_multicannon', at: CANNON, want: 'working order', why: 'and the look that confirms it' },
        { stage: 8 },

        { note: 'wiki step 8: Lawgof has no idea what it fires, so Nulodion at the Black Guard camp' },
        { note: 'the shed door shuts behind you while the cannon is being worked on, and the tile' },
        { note: 'the player is standing on is one of the two it takes a click from' },
        { loc: 'mcannondoor1', at: SHED_DOOR, soft: true, why: 'back out of the shed' },
        { go: [LAWGOF[0], LAWGOF[1]], r: 120, why: 'back to Lawgof' },
        { talk: 'lawgof2', picks: ['Ok then, just for you!'], want: 'Nulodion', why: 'he sends you south of Ice Mountain' },
        { stage: 9 },
        { rng: null, why: 'nothing else in the quest is a roll' },

        { note: 'the camp is four hundred tiles east of the fence and the road there is not the' },
        { note: 'quest, so this leg is a setpos rather than a walk' },
        { setpos: [3016, 3453, 0], why: 'to the Black Guard camp gate' },
        { loc: 'mcannondoor', at: NULODION_DOOR, why: 'his door, locked until Lawgof sends you' },
        { talk: 'nulodion', want: 'ammo mould', why: 'the notes and the mould' },
        { has: 'ammo_mould' },
        { has: 'nulodions_notes' },
        { stage: 10 },

        { note: 'wiki step 9: both of them back to Lawgof' },
        { setpos: [LAWGOF[0], LAWGOF[1], 0], why: 'back west to the fence' },
        { talk: 'lawgof2', want: 'make the ammo', why: 'the hand-over' },
        { wait: 6, why: 'the completion is queued' },
        { stage: 11 }
    ]
};

const p: any = H.makePlayer('canrun', m.start[0], m.start[1]);
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
