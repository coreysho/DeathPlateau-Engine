// SEARCHING THE CRATES AND BOXES THAT ANSWERED NOTHING - every placed instance of each.
//
//   npx tsx tools/sim/emptycrates.ts
//
// Five storage locs carried op1="Search" and no handler: Rellekka's two crate types, the Rum Deal
// boxes and crates, and the pile ahoy_boxes_1. 83 placed instances between them, every one of which
// answered a click with nothing at all.
//
// THE FIX IS A CATEGORY, and this is the bucket where that is actually safe. crates.rs2 already has
// [oploc1,_empty_crate], [oploc1,_empty_crates] and [oploc1,_empty_boxes] - generic handlers with
// the treasure-trail hooks, the ~findsomethingnice roll and a "you find nothing" line - and dozens
// of locs dispatch through them. Unlike a ladder or a well there is no destination to get wrong, so
// the only judgement here is singular/plural/boxes, which is settled by each loc's own name and
// description rather than by its model.
//
// WHICH IS WHY THE ASSERTION IS ABOUT THE WORDING. Checking only that a click produces a message
// would pass if all five were pointed at the same handler, and a loc named "Boxes" answering "You
// search the crate..." is the mistake this bucket invites. So each one is checked for the noun its
// own category prints, and separately for not falling through to the global default.
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

// loc, a seed to find instances from, and the noun its category's handler prints.
const SEARCHABLES: { name: string; x: number; z: number; noun: RegExp; cat: string }[] = [
    { name: 'viking_crate', x: 2637, z: 3666, noun: /crate\b/i, cat: 'empty_crate' },
    { name: 'viking_crate_2', x: 2638, z: 3666, noun: /crate\b/i, cat: 'empty_crate' },
    { name: 'ahoy_boxes_1', x: 3573, z: 3310, noun: /boxes/i, cat: 'empty_boxes' },
    { name: 'loc_11744', x: 3009, z: 3336, noun: /boxes/i, cat: 'empty_boxes' },
    { name: 'loc_11745', x: 3012, z: 3342, noun: /crates/i, cat: 'empty_crates' }
];

const p = H.makePlayer('searcher', 3222, 3218) as unknown as { x: number; z: number; level: number; teleport: (x: number, z: number, l: number) => void };
H.tick(2);
H.maxOut(p as never);

for (const { name, x: sx, z: sz, noun, cat } of SEARCHABLES) {
    console.log('');
    console.log(`-- ${name} (category=${cat}), expecting ${noun}`);
    const spots = [...H.locsNear(name, sx, sz, 0), ...H.locsNear(name, sx, sz, 1), ...H.locsNear(name, sx, sz, 2)];
    if (!spots.length) {
        console.log(`   UNTESTED - no instance found near ${sx},${sz}`);
        untested++;
        continue;
    }

    let done = 0;
    for (const { x, z, level } of spots) {
        if (done >= 5) break;
        done++;
        H.clearInv(p as never);
        // Beside it, not on it: these block walking.
        let placed = false;
        for (const [dx, dz] of [
            [0, -1],
            [0, 1],
            [-1, 0],
            [1, 0],
            [-1, -1],
            [1, 1]
        ]) {
            p.teleport(x + dx, z + dz, level);
            H.tick(1);
            placed = true;
            H.clearLogs();
            H.opLoc(p as never, x, z, name, 1);
            for (let t = 0; t < 8; t++) H.tick(1);
            if (!H.mesgs.some(m => /can't reach/i.test(m.text))) break;
        }
        if (!placed) continue;

        const said = H.mesgs.map(m => m.text);
        const joined = said.join(' / ');
        if (said.some(s => /can't reach/i.test(s))) {
            console.log(`   UNTESTED ${x},${z},${level} - no reachable side`);
            untested++;
            continue;
        }
        // The global fallback is the thing this whole sweep exists to remove.
        check(`${x},${z},${level} says something other than the default`, said.length > 0 && !said.some(s => /nothing interesting happens/i.test(s)), joined || 'said nothing at all');
        // ~findsomethingnice can fire instead of the plain line, and that is a pass - it is the
        // same handler, just the lucky branch of it.
        const lucky = said.some(s => /you find|you search/i.test(s)) && !noun.test(joined);
        check('  and in the right words', noun.test(joined) || lucky, joined);
    }
}

console.log('');
console.log(`${ok} ok, ${bad} FAIL, ${untested} untested`);
process.exit(bad ? 1 : 0);
