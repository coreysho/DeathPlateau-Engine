// WHERE "combat style of -1" COMES FROM.
//
// player_attack_roll_specific errors with a damagetype of -1, which is db_getfield saying the
// style index it was handed is not in the weapon's table. %damagetype is written by
// ~player_combat_stat from %com_mode, so this drives that proc directly: every weapon category
// the game can put in your hand, against every style index its three-bit memory slot can hold.
//
//   npx tsx tools/sim/combatstyle.ts
import * as H from './harness.ts';
import { check, R, player } from './a1lib.ts';
import ObjType from '#/cache/config/ObjType.js';

await H.boot();

// one representative weapon per category, found in the cache rather than hardcoded
const byCategory = new Map<number, number>();
for (let id = 0; id < ObjType.count; id++) {
    const o = ObjType.get(id);
    if (!o || o.category < 0) continue;
    if (o.wearpos !== 3) continue;               // right hand
    if (!byCategory.has(o.category)) byCategory.set(o.category, id);
}
console.log(`${byCategory.size} right-hand categories in the cache`);

const p: any = player('styles', 3222, 3222);
const bad: string[] = [];
let tested = 0;

for (const [cat, objId] of [...byCategory].sort((a, b) => a[0] - b[0])) {
    const o = ObjType.get(objId);
    H.equip(p, { rhand: o.debugname ?? String(objId) });
    for (let mode = 0; mode <= 7; mode++) {      // the memory varbit is three bits: 0..7
        H.setVar(p, 'com_mode', mode);
        H.runProc(p, '[proc,player_combat_stat]');
        const dt = H.getVar(p, 'damagetype');
        const after = H.getVar(p, 'com_mode');
        tested++;
        if (dt < 0) bad.push(`category ${cat} (${o.debugname}) com_mode ${mode} -> damagetype ${dt}, com_mode left at ${after}`);
    }
}
console.log(`\n${tested} (category, style) pairs driven through ~player_combat_stat`);
for (const b of bad) console.log('  ' + b);
check('  no weapon and style produces a damagetype of -1', bad.length, 0);

console.log(`\n${R.ok} ok, ${R.bad} FAIL`);
process.exit(R.bad ? 1 : 0);
