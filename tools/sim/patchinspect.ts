// INSPECT ON EVERY MULTILOC PATCH THAT ANSWERED NOTHING, at every state it can be in.
//
//   npx tsx tools/sim/patchinspect.ts
//
// THE NAME IN THE BACKLOG IS NOT THE NAME TO HOOK, and that is the real content of this file.
// opsweep lists these dead options under garden_delphiniums_weeds_1, _weeds_2, _weeds_3 and
// _weeded, because that is where op2="Inspect" sits in the cache. Those four are multiloc CHILDREN.
// OpLocHandler resolves the multiloc only to decide whether the op is valid, then hands on the
// placed Loc, and the trigger is looked up with LocType.get(this.target.type) - the BASE. A trigger
// written on a child name is never reached, and would read as "fixed" to a sweep that only asks
// whether some script mentions the name.
//
// So the triggers are on garden_delphinium_patch and its eight siblings, and this file proves the
// dispatch empirically rather than from my reading of the handler: it drives the varbit through
// every state and checks the answer changes with it. If multiloc dispatch were on the child, every
// one of these would say nothing at all.
//
// It also covers the two shapes that are not beds, because getting those wrong is the obvious
// failure: the orchids are plant pots that skip states 2 and 3, so a bed's "more weed than bed"
// would be nonsense in an empty pot, and the white tree runs to thirteen states rather than eight.
//
// Rind's hop patch in Keldagrim is the same shape and the same mistake waiting to be made - opsweep
// lists it under kelda_hops_1, _2, _3, _seed and _fullygrown, and the trigger belongs on
// farming_hops_patch_keldagrim. Note what is NOT asserted there: Harvest. Nothing advances
// %forget_farming past the 4 the quest sets, so state 8 is unreachable in play and a Harvest
// handler would be code no player could run. The inspect is checked at state 8 anyway, because the
// varbit can be set here even though the content cannot set it yet, and because that is the state
// somebody will have to make reachable when the rest of that chain gets built.
import * as H from './harness.js';

await H.boot();

let ok = 0;
let bad = 0;
const check = (what: string, good: boolean, detail = ''): void => {
    if (good) {
        ok++;
        console.log('  ok   ' + what);
    } else {
        bad++;
        console.log('  FAIL ' + what + (detail ? ' - ' + detail : ''));
    }
};

// base multiloc, its varbit, and what each state should be answered with.
const BEDS: { loc: string; varbit: string; states: [number, RegExp][] }[] = [
    {
        loc: 'garden_delphinium_patch',
        varbit: 'garden_delphiniums_varbit',
        states: [
            [0, /weed/i],
            [3, /clear soil/i],
            [4, /sown/i],
            [5, /coming on/i],
            [7, /delphiniums are up/i]
        ]
    },
    {
        loc: 'garden_snowdrop_patch',
        varbit: 'garden_snowdrops_varbit',
        states: [
            [0, /weed/i],
            [3, /clear soil/i],
            [7, /snowdrops are up/i]
        ]
    },
    {
        loc: 'garden_rosebush_patch_red',
        varbit: 'garden_rosebush_red_varbit',
        states: [
            [0, /weed/i],
            [7, /red roses are up/i]
        ]
    },
    // A pot, not a bed: 0 is empty and 1 has compost in it. "More weed than bed" would be wrong.
    {
        loc: 'garden_orchid_pink_patch',
        varbit: 'garden_orchids_pink_varbit',
        states: [
            [0, /empty plant pot/i],
            [1, /compost/i],
            [7, /filled the pot/i]
        ]
    },
    // Thirteen states: seedling at 4, grown at 8, fruiting from 9.
    {
        loc: 'garden_white_tree_patch',
        varbit: 'garden_white_tree_varbit',
        states: [
            [0, /weed/i],
            [4, /seedling/i],
            [8, /full grown/i],
            [9, /fruiting/i]
        ]
    }
];

// Rind's patch, which is in Keldagrim rather than the palace garden and so needs its own seed.
const HOPS: { loc: string; varbit: string; x: number; z: number; states: [number, RegExp][] } = {
    loc: 'farming_hops_patch_keldagrim',
    varbit: 'forget_farming',
    x: 2856,
    z: 10204,
    states: [
        [0, /gone to weed/i],
        [3, /clear soil/i],
        [4, /nothing has come up/i],
        [5, /climbing/i],
        [8, /full grown/i]
    ]
};

const p = H.makePlayer('gardener', 3222, 3218) as unknown as { x: number; z: number; level: number; teleport: (x: number, z: number, l: number) => void };
H.tick(2);
H.maxOut(p as never);

for (const { loc, varbit, states } of BEDS) {
    console.log('');
    console.log(`-- ${loc}`);
    const spots = H.locsNear(loc, 3228, 3477, 0);
    if (!spots.length) {
        check(`${loc} is placed in the garden`, false, 'the map places none near 3228,3477');
        continue;
    }
    const { x, z, level } = spots[0];

    for (const [state, want] of states) {
        H.setVarBit(p as never, varbit, state);
        p.teleport(x, z + 1, level);
        H.tick(1);
        H.clearLogs();
        H.opLoc(p as never, x, z, loc, 2);
        for (let t = 0; t < 8; t++) H.tick(1);
        const said = [...H.mesgs.map(m => m.text), ...H.ifaces.filter(i => i.kind === 'text').map(i => i.text ?? '')];
        const joined = said.join(' / ');
        check(`state ${state} answers ${want}`, want.test(joined), joined || 'said nothing at all - if every state is silent, multiloc dispatch is on the CHILD and these triggers are on the wrong name');
    }
}

console.log('');
console.log(`-- ${HOPS.loc}`);
{
    const spots = H.locsNear(HOPS.loc, HOPS.x, HOPS.z, 0);
    if (!spots.length) {
        check(`${HOPS.loc} is placed in Keldagrim`, false, `the map places none near ${HOPS.x},${HOPS.z}`);
    } else {
        const { x, z, level } = spots[0];
        for (const [state, want] of HOPS.states) {
            H.setVarBit(p as never, HOPS.varbit, state);
            p.teleport(x, z + 1, level);
            H.tick(1);
            H.clearLogs();
            H.opLoc(p as never, x, z, HOPS.loc, 2);
            for (let t = 0; t < 8; t++) H.tick(1);
            const said = [...H.mesgs.map(m => m.text), ...H.ifaces.filter(i => i.kind === 'text').map(i => i.text ?? '')];
            const joined = said.join(' / ');
            check(`state ${state} answers ${want}`, want.test(joined), joined || 'said nothing at all');
        }
    }
}

console.log('');
console.log(`${ok} ok, ${bad} FAIL`);
process.exit(bad ? 1 : 0);
