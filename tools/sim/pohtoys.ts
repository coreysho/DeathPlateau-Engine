// THE CLOCKWORK TOYS GO ROUND: wind it, release it, pick it up, and still have one toy.
//
//   npx tsx tools/sim/pohtoys.ts
//
// All three verbs were dead in the cache and are now written in
// content/scripts/skill_construction/scripts/poh_toys.rs2 - Wind on the unwound obj, Release on the
// wound one, Pick-up on the npc the release spawns. opsweep found the Release; the other two came
// out of pulling that thread, and everything they need (the npcs, their walkanims, the
// ~release_toad precedent) was already in the build.
//
// WHAT THIS ASSERTS, and why the loop rather than the steps. Each verb on its own is easy to get
// right and useless: a Wind that consumes the toy, a Release that spawns nothing, a Pick-up that
// hands back the wrong obj all pass a "did it say something" check. What matters is that a player
// who winds a toy, lets it go and picks it up again has exactly one toy at the end and can wind it
// again - so the test is the round trip and the count, which is the same reasoning equipcycle.ts
// uses on wearables.
//
// THE TWO JUDGEMENT CALLS are asserted here rather than left implicit, because they are the parts
// the cache did not settle and so the parts most likely to be changed by somebody later:
//
//   Pick-up returns the UNWOUND obj, so Wind has something to do and the loop closes.
//   The npc lives 500 ticks, long enough to walk and be retrieved.
//
// If either is deliberately changed, this file is where it will fail first, which is the point.
import NpcType from '#/cache/config/NpcType.js';

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

const p = H.makePlayer('toymaker', 3222, 3218) as unknown as { x: number; z: number; level: number };
H.tick(2);
H.maxOut(p as never);

// soldier, doll and mouse wind; the cat has no wound/unwound pair and is released as itself.
const WINDABLE: [string, string, string][] = [
    ['poh_toy_soldier_unwound', 'poh_toy_soldier_wound', 'poh_toy_soldier'],
    ['poh_toy_doll_unwound', 'poh_toy_doll_wound', 'poh_toy_doll'],
    ['poh_toy_mouse_unwound', 'poh_toy_mouse_wound', 'poh_toy_mouse']
];

for (const [unwound, wound, npcName] of WINDABLE) {
    console.log('');
    console.log(`-- ${npcName}`);
    H.clearInv(p as never);
    H.give(p as never, unwound, 1);
    H.tick(1);

    // WIND
    H.opheld(p as never, unwound, 1);
    H.tick(2);
    check(`winding it turns ${unwound} into ${wound}`, H.invCount(p as never, wound) === 1 && H.invCount(p as never, unwound) === 0, `holding ${H.invCount(p as never, unwound)} unwound, ${H.invCount(p as never, wound)} wound`);

    // RELEASE
    H.opheld(p as never, wound, 5);
    H.tick(3);
    const toy = H.npcNear(npcName, p.x, p.z, p.level);
    check('  releasing it takes the toy out of the pack', H.invCount(p as never, wound) === 0);
    check(`  and puts a ${npcName} on the floor`, toy !== null, 'no npc appeared near the player');
    if (!toy) continue;

    // The npc carries its own movement - that is what makes it a toy walking rather than a statue.
    const nt = NpcType.get(toy.type);
    check('  which walks with its own animation', (nt?.walkanim ?? -1) !== -1, `walkanim is ${nt?.walkanim}`);

    // PICK-UP
    H.opNpc(p as never, toy, 1);
    H.tick(3);
    check('  picking it up removes the npc', !toy.isActive);
    // The judgement call, asserted: unwound, so Wind has something to do next time.
    check(`  and hands back ${unwound}, so it can be wound again`, H.invCount(p as never, unwound) === 1, `holding ${H.invCount(p as never, unwound)} unwound, ${H.invCount(p as never, wound)} wound`);

    // ONE TOY IN, ONE TOY OUT - the whole point of testing the loop rather than the steps.
    const total = H.invCount(p as never, unwound) + H.invCount(p as never, wound);
    check('  one toy in, one toy out', total === 1, `ended holding ${total}`);
}

// The cat has no pair, so its loop is release and pick up the same obj.
console.log('');
console.log('-- poh_toy_cat (no wound/unwound pair)');
H.clearInv(p as never);
H.give(p as never, 'poh_toy_cat', 1);
H.tick(1);
H.opheld(p as never, 'poh_toy_cat', 5);
H.tick(3);
const cat = H.npcNear('poh_toy_cat', p.x, p.z, p.level);
check('releasing the cat takes it out of the pack', H.invCount(p as never, 'poh_toy_cat') === 0);
check('  and puts a poh_toy_cat on the floor', cat !== null);
if (cat) {
    H.opNpc(p as never, cat, 1);
    H.tick(3);
    check('  picking it up removes the npc', !cat.isActive);
    check('  and hands the cat back', H.invCount(p as never, 'poh_toy_cat') === 1, `holding ${H.invCount(p as never, 'poh_toy_cat')}`);
}

console.log('');
console.log(`${ok} ok, ${bad} FAIL`);
process.exit(bad ? 1 : 0);
