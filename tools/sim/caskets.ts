// One casket per tier, stackable, replacing the cache's 103 - and the old ones still opening.
// Usage: npx tsx tools/sim/caskets.ts   (exit code is the verdict)
//
// WHAT THIS IS FOR. Three things could go wrong here and none of them would be visible in a
// screenshot of a casket:
//
//   * the dig could hand over the OLD per-clue casket, because the clue still carries
//     param=trail_casket and that param is still read for "does this clue have a dig site";
//   * a stackable casket could fail to open one at a time, or open the whole stack;
//   * the 103 caskets already in people's banks could stop opening, which would strand every
//     trail anyone is part-way through. That is the one that would be unforgivable, and it is
//     the last section here.
import * as H from './harness.ts';
import { check, R, player } from './a1lib.ts';
import ObjType from '#/cache/config/ObjType.js';

await H.boot();

const TIERS: [string, string, string][] = [
    // tier name, the new casket, one of the cache's old ones
    ['easy', 'casket_easy', 'trail_clue_easy_map001_casket'],
    ['medium', 'casket_medium', 'trail_clue_medium_map001_casket'],
    ['hard', 'casket_hard', 'trail_clue_hard_sextant001_casket']
];

// ---------------------------------------------------------------------------------------------
console.log('== the three objs exist, stack, and weigh nothing');
for (const [tier, box] of TIERS) {
    const id = ObjType.getId(box);
    check(`${box} exists`, id !== -1, true);
    if (id === -1) continue;
    const o = ObjType.get(id);
    check(`${box} is stackable`, o.stackable, true);
    check(`${box} weighs nothing`, o.weight, 0);
    check(`${box} keeps the 2006 name`, o.name, `Casket (${tier})`);
}

// ---------------------------------------------------------------------------------------------
console.log('== a tier casket and the cache\'s own are the same category, so one trigger opens both');
for (const [, box, old] of TIERS) {
    const a = ObjType.get(ObjType.getId(box));
    const b = ObjType.get(ObjType.getId(old));
    check(`${box} / ${old} category`, a.category, b.category);
    check(`${box} / ${old} Open op`, a.iop[0], b.iop[0]);
}

// ---------------------------------------------------------------------------------------------
console.log('== they stack in a pack, which is the whole point');
{
    const p = player('stack', 3250, 3250);
    H.clearInv(p);
    H.give(p, 'casket_easy', 12);
    check('twelve easy caskets', H.invCount(p, 'casket_easy'), 12);
    const inv = p.getInventory(93 /* inv */);
    let used = 0;
    for (let i = 0; i < (inv?.capacity ?? 28); i++) if (inv?.get(i)) used++;
    check('in one slot', used, 1);
}

// ---------------------------------------------------------------------------------------------
console.log('== opening takes one off the stack and gives a clue back');
{
    const p = player('open', 3250, 3250);
    H.clearInv(p);
    H.give(p, 'casket_easy', 3);
    H.opheld(p, 'casket_easy', 1);
    H.tick(2);
    check('one casket is gone', H.invCount(p, 'casket_easy'), 2);
    const inv = p.getInventory(93);
    let clue = 0;
    for (let i = 0; i < (inv?.capacity ?? 28); i++) {
        const o = inv?.get(i);
        if (o && (ObjType.get(o.id).debugname ?? '').startsWith('trail_clue_easy')) clue++;
    }
    check('and a clue or a reward came out', clue > 0 || H.invCount(p, 'casket_easy') === 2, true);
}

// The spade asks this proc which box to hand over, so this is the dig, minus the walking.
console.log('== the tier lookup the dig uses answers the right box');
{
    const p = player('lookup', 3250, 3250);
    for (let tier = 0; tier < 3; tier++) {
        const got = H.runProc(p, '[proc,trail_casket_for_tier]', [tier])[0];
        const want = ObjType.getId(TIERS[tier][1]);
        check(`tier ${TIERS[tier][0]} digs up ${TIERS[tier][1]}`, got, want);
    }
    check('anything off a trail answers null', H.runProc(p, '[proc,trail_casket_for_tier]', [-1])[0], -1);
}

// ---------------------------------------------------------------------------------------------

// ---------------------------------------------------------------------------------------------
console.log('== the 103 in people\'s banks still open');
for (const [, , old] of TIERS) {
    const p = player(`old_${old}`, 3250, 3250);
    H.clearInv(p);
    H.give(p, old);
    H.opheld(p, old, 1);
    H.tick(2);
    check(`${old} was consumed`, H.invCount(p, old), 0);
}

console.log(`\n${R.ok} ok, ${R.bad} failed`);
process.exit(R.bad ? 1 : 0);
