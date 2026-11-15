// THE ROCKS THAT ARE NOT ORE ROCKS, handled two different ways on purpose.
//
//   npx tsx tools/sim/rockempty.ts
//
// deadrocks.ts found 452 reachable instances whose Mine option answered "Nothing interesting
// happens." 155 of them were the dwarven gold veins and are now real ore (tools/sim/dwarfgold.ts).
// The 182 here are not ore at all, by rules this project already wrote down, and the two groups get
// opposite treatment for a reason this file exists to pin down.
//
// THE HAUNTED MINE'S WALLS - 110 instances across 24 locs, all inside the quest dungeon, which the
// npcs placed around them settle (possessed_pickaxe_stationary, skeletal_miner_sitting,
// hauntedmine_boss_cart, crane_posessed_mine). rockore.ts states the rule: "A rock with no 6342
// slot at all is mine-wall scenery, not an ore rock." None of the 24 has one.
//
// Their Mine and Prospect are HIDDEN, so no client draws either. "There is no ore currently
// available in this rock" is a sentence about a rock that ran out; these never had any, and the
// original game puts no Mine on a decorative rock face.
//
// THE WILDERNESS ROCKS - 72 instances across loc_14850/51/52, by the Dark Warriors' Fortress.
// recol2d=0 paints the seam the body colour, and regional_rocks.loc's rule is that a rock with no
// ore colour is a rock with no ore in it, so there is no ore here either.
//
// These are marked EMPTY rather than hidden, because mapscene=12 draws a mine icon on the world
// map: a player has been told to come and look, and hiding the option would leave them hunting for
// a rock that offers nothing. mining.rs2 answers the param with a sentence that is both true and an
// explanation.
//
// So the assertion differs by group: for the walls, that no client could send the click at all; for
// the Wilderness, that the click arrives and is answered honestly.
import LocType from '#/cache/config/LocType.js';
import { isHiddenOp } from '#/cache/config/OpVisibility.js';

import * as H from './harness.js';
import { isFlagged } from '#/engine/GameMap.js';
import { CollisionFlag } from '#/engine/routefinder/index.js';

await H.boot();

let ok = 0;
let bad = 0;
const check = (what: string, good: boolean, detail = '') => {
    if (good) {
        ok++;
    } else {
        bad++;
        console.log('  FAIL ' + what + (detail ? ' - ' + detail : ''));
    }
};

const HAUNTED = [
    'loc_4976', 'loc_4977', 'loc_4978', 'loc_4979', 'loc_4980', 'loc_4981', 'loc_4982', 'loc_4983',
    'loc_4984', 'loc_4985', 'loc_4986', 'loc_4987', 'loc_4988', 'loc_4989', 'loc_4990', 'loc_4991',
    'loc_4992', 'loc_4993', 'loc_4994', 'loc_4995', 'loc_4996', 'loc_12941', 'loc_12942', 'loc_12943'
];

console.log(`-- the Haunted Mine's walls: ${HAUNTED.length} locs, no client may offer Mine or Prospect`);
for (const name of HAUNTED) {
    const id = LocType.getId(name);
    if (id === -1) {
        check(`${name} exists in the cache`, false, 'no such loc');
        continue;
    }
    const lt = LocType.get(id);
    // The engine's own visibility rule, not a string compare: isVisibleOp lowercases, so a capital
    // Hidden counts, and reusing it is what stops this drifting from what OpLocHandler enforces.
    check(`${name} Mine is hidden`, isHiddenOp(lt.op?.[0]), `op1 is ${JSON.stringify(lt.op?.[0])}`);
    check(`${name} Prospect is hidden`, isHiddenOp(lt.op?.[1]), `op2 is ${JSON.stringify(lt.op?.[1])}`);
}
console.log(`   ${ok} ok so far`);

console.log('');
console.log('-- the Wilderness rocks: the click arrives and says there is no ore');

const p = H.makePlayer('prospector2', 3222, 3218) as unknown as {
    teleport(x: number, z: number, level: number): void;
};
H.tick(2);
H.maxOut(p as never);

const walkable = (level: number, x: number, z: number): boolean => !isFlagged(x, z, level, CollisionFlag.WALK_BLOCKED);
const offsets: [number, number][] = [];
for (let r = 0; r < 3; r++) {
    offsets.push([r + 1, 0], [-r, 0], [0, r + 1], [0, -r], [r + 1, r + 1], [-r, -r], [r + 1, -r], [-r, r + 1]);
}

for (const [name, sx, sz] of [['loc_14850', 3011, 3595], ['loc_14851', 3013, 3596], ['loc_14852', 3011, 3593]] as [string, number, number][]) {
    const spots = H.locsNear(name, sx, sz, 0);
    if (!spots.length) {
        console.log(`  UNTESTED ${name} - no instance near ${sx},${sz}`);
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
            let said: string[] = [];
            for (let t = 0; t < 60; t++) {
                H.tick(1);
                said = H.mesgs.slice(mark).map(m => m.text);
                if (said.some(s => /no ore currently available|interesting|can't reach/i.test(s))) break;
            }
            if (said.some(s => /can't reach/i.test(s))) continue;
            reached = true;
            check(`${name} says there is no ore`, said.some(s => /no ore currently available/i.test(s)), said.length ? JSON.stringify(said.slice(0, 2)) : 'said nothing at all');
            check('  and never says nothing interesting happens', !said.some(s => /interesting/i.test(s)));
        }
    }
    if (!reached) console.log(`  UNTESTED ${name} - no standable tile beside any instance`);
}

console.log('');
console.log(`${ok} ok, ${bad} FAIL`);
process.exit(bad ? 1 : 0);
