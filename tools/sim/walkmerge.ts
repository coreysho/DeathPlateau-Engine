// RUN AND CAST AT ONCE. ClientPlayer hands Model.method368 the primary frame, the current movement
// frame and the seq's walkmerge list; with no list the movement frame is discarded and the cast
// plays alone, which is the run animation stopping dead. These seven now carry the list.
//
//   npx tsx tools/sim/walkmerge.ts
import * as H from './harness.js';
import { check, R } from './a1lib.js';
import SeqType from '#/cache/config/SeqType.js';

await H.boot();

const merge = (name: string) => {
    const t: any = SeqType.get(SeqType.getId(name));
    return t.walkmerge ? Array.from(t.walkmerge as Int32Array) : null;
};

// The set every walk-merging human animation shares, read off a melee one rather than hardcoded.
const STANDARD = merge('human_sword_stab');
console.log('the standard human label set, from human_sword_stab:', STANDARD);
check('a melee animation walk-merges, as it always has', STANDARD !== null, true);

const UTILITY = ['human_casthighlvlalchemy', 'human_castlowlvlalchemy', 'human_castsuperheatitem',
    'human_casttelegrab', 'human_cast_enchantring', 'human_castbonestobananas',
    'human_castchargeorb'];
for (const n of UTILITY) {
    check(`${n} merges, with exactly the melee label set`, merge(n), STANDARD);
}

console.log('\nand the combat book is untouched:');
const COMBAT = ['human_caststrike', 'human_castbolt' , 'human_castwave', 'human_castzap',
    'human_castconfuse', 'human_castentangle', 'human_casting_tele_block', 'human_castibanblast',
    'human_castcrumbleundead', 'human_castteleport'];
for (const n of COMBAT) {
    if (SeqType.getId(n) === -1) continue;
    check(`  ${n} still plays alone`, merge(n), null);
}

// The whole set, named rather than counted, so a future addition cannot slip in unnoticed.
//
// human_cast_lunar_summon1 and _summon2 are not mine: they are OSRS-imported Lunar animations that
// arrived carrying a walkmerge of their own. The client will not honour it either way -
// Model.method368 refuses to merge two frames built on different skeletons, and an imported
// animation runs on the OSRS player base rather than the 377 one - so they are named here as what
// they are rather than quietly counted in.
const IMPORTED = ['human_cast_lunar_summon1', 'human_cast_lunar_summon2'];
const merging: string[] = [];
let alone = 0;
for (let i = 0; i < SeqType.count; i++) {
    const t: any = SeqType.get(i);
    const nm: string = t?.debugname ?? '';
    if (!nm.startsWith('human_cast')) continue;
    if (t.walkmerge) merging.push(nm); else alone++;
}
console.log(`\nof the human_cast* animations: ${merging.length} merge, ${alone} play alone`);
check('the merging set is the seven chosen plus the two OSRS imports',
    merging.slice().sort(), [...UTILITY, ...IMPORTED].sort());

console.log(`\n${R.ok} ok, ${R.bad} FAIL`);
process.exit(R.bad ? 1 : 0);
