// THE DWARVEN MINE'S GOLD VEINS, MINED - 155 instances whose Mine option did nothing.
//
//   npx tsx tools/sim/dwarfgold.ts
//
// deadrocks.ts put these in its "no recolour at all - the description is the only evidence" bucket,
// which is where it stops and asks: no seam colour to learn an ore from, so the tool will not guess.
// The description has always said "A mineral vein that looks distinctly like gold", the owner
// confirmed gold and confirmed it depletes, and this checks the wiring that followed.
//
// WHAT WAS WIRED, on the shape skill_mining/configs/rimmington_rocks.loc works out at length: the
// dispatching category=mining_rock_normal, param=next_loc_stage_mining pointing at the spent
// partner, and three rows in mine.dbrow's gold_rock_table so the ore, level, xp and respawn are
// gold's own.
//
// THE SPENT PARTNER IS WHY THIS COULD NOT BE GUESSED AT. LOC_CHANGE runs
// check(id, LocTypeValid) and throws on a null type, so a vein wired without a partner fails loudly
// rather than quietly. dwarf_gold_depleted was already in the cache - same hillskew, a model named
// for exactly this - and it is a DIFFERENT model from the live veins, so rockspent.ts's rule (the
// same model with the seam repainted the body colour) does not reach it. That rule is for standard
// ore rocks with a seam; these have no seam at all, and the model name is the evidence instead.
//
// It also keeps active=no and gains nothing, unlike rimmington's spent rocks which carry
// param=mining_rock_empty,1 so a click explains itself. There is no click to explain: LOC_CHANGE's
// second argument is a duration and World.changeLoc reverts the loc itself, so rockspent's warning
// about "permanent scenery" does not apply - the vein comes back on the gold table's respawn rate.
//
// Three instances are checked, one per loc, because 155 of them are the same three types and a
// fourth would measure the same thing more slowly.
import * as H from './harness.js';
import { isFlagged } from '#/engine/GameMap.js';
import { CollisionFlag } from '#/engine/routefinder/index.js';

await H.boot();

let ok = 0;
let bad = 0;
const check = (what: string, good: boolean, detail = '') => {
    if (good) {
        ok++;
        console.log('  ok   ' + what);
    } else {
        bad++;
        console.log('  FAIL ' + what + (detail ? ' - ' + detail : ''));
    }
};

const p = H.makePlayer('prospector', 3222, 3218) as unknown as {
    teleport(x: number, z: number, level: number): void;
};
H.tick(2);
H.maxOut(p as never);

const walkable = (level: number, x: number, z: number): boolean => !isFlagged(x, z, level, CollisionFlag.WALK_BLOCKED);

// A seed coordinate per loc, from deadrocks.ts's own placement report.
const SEEDS: [string, number, number][] = [
    ['dwarf_gold_mine', 2819, 10159],
    ['dwarf_gold_mine_l', 2305, 4952],
    ['dwarf_gold_mine_r', 2305, 4953]
];

const offsets: [number, number][] = [];
for (let r = 0; r < 3; r++) {
    offsets.push([r + 1, 0], [-r, 0], [0, r + 1], [0, -r], [r + 1, r + 1], [-r, -r], [r + 1, -r], [-r, r + 1]);
}

for (const [name, sx, sz] of SEEDS) {
    const spots = H.locsNear(name, sx, sz, 0);
    if (!spots.length) {
        console.log(`  UNTESTED ${name} - no instance found near ${sx},${sz}, so this says nothing about it`);
        continue;
    }

    let reached = false;
    for (const { x, z, level } of spots.slice(0, 6)) {
        if (reached) break;
        for (const [dx, dz] of offsets) {
            if (reached) break;
            if (!walkable(level, x + dx, z + dz)) continue;
            p.teleport(x + dx, z + dz, level);
            H.clearInv(p as never);
            H.give(p as never, 'adamant_pickaxe', 1);
            H.tick(2);
            const mark = H.mesgs.length;
            H.opLoc(p as never, x, z, name, 1);

            // The same 400-tick budget choptrees.ts had to learn: a rock rolls its success chance
            // every few ticks and gold's is 7..75, so a short budget is a coin toss rather than a
            // measurement. Out early the moment it cannot work.
            let got: string | null = null;
            for (let t = 0; t < 400 && got === null; t++) {
                H.tick(1);
                const said = H.mesgs.slice(mark).map(m => m.text);
                got = said.find(s => /^You (get|manage to mine) some /.test(s)) ?? null;
                if (said.some(s => /interesting/i.test(s) || /can't reach/i.test(s))) break;
            }
            const said = H.mesgs.slice(mark).map(m => m.text);
            if (said.some(s => /can't reach/i.test(s))) continue;
            reached = true;

            check(`${name} gives ore when mined at ${x},${z},${level}`, got !== null, said.length ? JSON.stringify(said.slice(0, 2)) : 'said nothing at all');
            check('  and never says nothing interesting happens', !said.some(s => /interesting/i.test(s)));
            check('  and the ore is gold', H.invCount(p as never, 'gold_ore') > 0, `backpack has ${H.invCount(p as never, 'gold_ore')} gold_ore`);
            // The depletion the owner asked for, and the thing LOC_CHANGE would have thrown over.
            check('  and the vein depletes into dwarf_gold_depleted', H.locAt(level, x, z, 'dwarf_gold_depleted'), 'the loc did not change');
        }
    }
    if (!reached) {
        console.log(`  UNTESTED ${name} - no standable tile beside any of its instances`);
    }
}

console.log('');
console.log(`${ok} ok, ${bad} FAIL`);
process.exit(bad ? 1 : 0);
