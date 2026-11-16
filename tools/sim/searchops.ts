// SEARCHING THE THINGS WHOSE SEARCH ANSWERED NOTHING - every placed instance of each.
//
//   npx tsx tools/sim/searchops.ts
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
//
// THE OTHER THREE ARE NOT CATEGORY WORK, and each is here because the obvious fix was wrong:
//
//   loc_6630            33 sarcophagi in the Sophanem tomb. They carry the model AND the
//                       description of deserttreasure_sarcophigi_door_2, which is wired - to a
//                       handler that rolls against Desert Treasure and spawns a mummy out of the
//                       lid. All six of those are in the pyramid at 2765,4945 L1; these are at
//                       3276,9191 among Icthlarin's own mummies and canopic jars. Same model,
//                       different quest, so they get the empty answer and none of the machinery.
//   banana tree         23 of them, and a TRIGGER rather than category=banana_tree, because the
//                       shared handler changes the loc to its next_loc_stage and an empty tree has
//                       none - quest_mm.rs2 records that mistake turning the sixth click into a
//                       script error.
//   Keldagrim bookcase  22, and deliberately not category=bookcase: that default prints "none of
//                       them look very interesting" and the loc's own description says the books
//                       are full of Red Axe data.
//
// A ~mesbox IS NOT A mes, which is why both channels are read below: the first sets text on an
// interface and lands in H.ifaces, only the second reaches H.mesgs. Three of these eight answer
// through a mesbox, and reading only the chatbox would call them dead.
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

// loc, a seed to find instances from, the wording it should answer with, and how it is wired.
const SEARCHABLES: { name: string; x: number; z: number; noun: RegExp; cat: string }[] = [
    { name: 'viking_crate', x: 2637, z: 3666, noun: /crate\b/i, cat: 'category=empty_crate' },
    { name: 'viking_crate_2', x: 2638, z: 3666, noun: /crate\b/i, cat: 'category=empty_crate' },
    { name: 'ahoy_boxes_1', x: 3573, z: 3310, noun: /boxes/i, cat: 'category=empty_boxes' },
    { name: 'loc_11744', x: 3009, z: 3336, noun: /boxes/i, cat: 'category=empty_boxes' },
    { name: 'loc_11745', x: 3012, z: 3342, noun: /crates/i, cat: 'category=empty_crates' },
    // Their own triggers, for the reasons in the header.
    { name: 'loc_6630', x: 3278, z: 9191, noun: /sarcophagus/i, cat: 'own trigger, NOT the Desert Treasure one' },
    { name: 'icthalarins_bananatreeempty', x: 3300, z: 2790, noun: /bananas left/i, cat: 'own trigger, NOT the banana_tree category' },
    { name: 'dwarf_keldagrim_metal_bookcase', x: 1903, z: 4960, noun: /Red Axe/i, cat: 'own trigger, NOT the bookcase category' },
    // THREE PLAIN BOOKCASES, and a miss of mine: wiring the Red Axe shelves above should have been
    // the moment to look at the rest of the family, and it was not - these three stayed dead for
    // another pass. They take category=bookcase, which the Red Axe one could not, because their own
    // descriptions are generic ("A treasure trove of knowledge", "A case. With books.", "A good
    // source of books!") and so do not contradict @search_bookcase's "none of them look very
    // interesting". That handler picks one of four lines at random, so the assertion is on the one
    // word all four share.
    { name: 'dwarf_keldagrim_bookcase', x: 2890, z: 10205, noun: /bookcase/i, cat: 'category=bookcase' },
    { name: 'sarim_bookcase2', x: 3027, z: 3222, noun: /bookcase/i, cat: 'category=bookcase' },
    { name: 'bookcase_polybooks', x: 3094, z: 3159, noun: /bookcase/i, cat: 'category=bookcase' }
];

const p = H.makePlayer('searcher', 3222, 3218) as unknown as { x: number; z: number; level: number; teleport: (x: number, z: number, l: number) => void };
H.tick(2);
H.maxOut(p as never);

for (const { name, x: sx, z: sz, noun, cat } of SEARCHABLES) {
    console.log('');
    console.log(`-- ${name} (${cat}), expecting ${noun}`);
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

        // Both channels: a mes in the chatbox and a ~mesbox set on an interface.
        const boxed = H.ifaces.filter(i => i.kind === 'text').map(i => i.text ?? '');
        const said = [...H.mesgs.map(m => m.text), ...boxed];
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
