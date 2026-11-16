// EVERYTHING WITH A "PICK" ON IT, picked - every placed instance of every pickable loc.
//
//   npx tsx tools/sim/pickables.ts
//
// WHY THE WHOLE FAMILY AND NOT THE TWO THAT WERE BROKEN. pickables.rs2 is a list: a label per crop
// and a line per loc that uses it. The failure mode of a list is omission, not logic - wheat_tall
// and Harmony Island's loc474_22300 were both name=Wheat sitting beside three wired siblings, and
// between them they were 101 placed instances where Pick did nothing. Nothing in the file was
// wrong; two lines were missing from it. A test that only covered the two would not have caught
// them being missing in the first place, so this walks the whole list and will fail the same way
// for the next crop somebody adds a loc for and forgets to wire.
//
// WHAT IT ASSERTS, per instance: the click yields the right obj, and the loc is gone afterwards.
// The second half matters because ~pickup_loc_floor works by loc_del and a timed respawn rather
// than by swapping in a picked variant - a crop that hands you an onion and stays standing there
// is an infinite onion, and that passes a "did you get the item" check.
import * as H from './harness.js';

await H.boot();

let ok = 0;
let bad = 0;
let untested = 0;
const check = (what: string, good: boolean, detail = ''): void => {
    if (good) {
        ok++;
        console.log('  ok   ' + what);
    } else {
        bad++;
        console.log('  FAIL ' + what + (detail ? ' - ' + detail : ''));
    }
};

// loc, the op it answers, the obj it should hand over, and a seed to find instances from.
const CROPS: { name: string; op: number; gives: string; x: number; z: number }[] = [
    { name: 'wheat', op: 2, gives: 'grain', x: 3160, z: 3300 },
    { name: 'wheat_small', op: 2, gives: 'grain', x: 3160, z: 3300 },
    { name: 'wheat_smallest', op: 2, gives: 'grain', x: 3160, z: 3300 },
    // The two that were dead.
    { name: 'wheat_tall', op: 2, gives: 'grain', x: 3155, z: 3304 },
    { name: 'loc474_22300', op: 2, gives: 'grain', x: 3805, z: 2850 },
    { name: 'potato', op: 2, gives: 'potato', x: 3230, z: 3310 },
    { name: 'onion', op: 2, gives: 'onion', x: 3190, z: 3277 },
    { name: 'cabbage', op: 2, gives: 'cabbage', x: 3053, z: 3290 }
];

const p = H.makePlayer('picker', 3222, 3218) as unknown as { x: number; z: number; level: number; teleport: (x: number, z: number, l: number) => void };
H.tick(2);
H.maxOut(p as never);

for (const { name, op, gives, x: sx, z: sz } of CROPS) {
    console.log('');
    console.log(`-- ${name} op${op}, should give ${gives}`);
    const spots = [...H.locsNear(name, sx, sz, 0), ...H.locsNear(name, sx, sz, 1)];
    if (!spots.length) {
        console.log(`   UNTESTED - no instance found near ${sx},${sz}`);
        untested++;
        continue;
    }

    // Every instance the seed finds, capped so one enormous field does not dominate the run.
    let done = 0;
    for (const { x, z, level } of spots) {
        if (done >= 6) break;
        done++;
        H.clearInv(p as never);
        p.teleport(x, z + 1, level);
        H.tick(1);
        H.clearLogs();
        H.opLoc(p as never, x, z, name, op);
        for (let t = 0; t < 8; t++) H.tick(1);

        const got = H.invCount(p as never, gives);
        const said = H.mesgs.map(m => m.text);
        check(`${x},${z},${level} hands over a ${gives}`, got === 1, `holding ${got}${said.length ? ', saying ' + JSON.stringify(said.slice(0, 1)) : ', and said nothing'}`);
        // loc_del, not a swap: a crop still standing after you picked it is an infinite crop.
        check('  and the crop is gone afterwards', !H.locAt(level, x, z, name), 'it is still standing');
    }
}

console.log('');
console.log(`${ok} ok, ${bad} FAIL, ${untested} untested`);
process.exit(bad ? 1 : 0);
