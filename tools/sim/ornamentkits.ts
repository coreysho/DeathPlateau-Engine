// The sixteen ornament kits, applied and taken back off on the real engine.
//
// The pairing lives on the items as params rather than in a table in the script, which is what
// makes a seventeenth kit a config change - and also what makes a wrong pair invisible: a kit that
// names the wrong result builds, packs and only goes wrong in somebody's hands. So this walks the
// configs for every pairing there is and puts each one through the real use-on, then the real
// Revert, and checks it comes back.
//
// TWO SLOTS, because the infinity robes take EITHER colour kit. Reading only the first is how the
// dark kit would go untested and stay a drop with nothing it fits, which is exactly what the first
// version of this file did.
//
//   npx tsx tools/sim/ornamentkits.ts
import * as H from './harness.ts';
import * as A from './a1lib.ts';
import { check, R, player } from './a1lib.ts';
import ObjType from '#/cache/config/ObjType.js';
import ParamType from '#/cache/config/ParamType.js';

await H.boot();

const P = (id: number, p: string) => (ObjType.get(id) as any).params?.get(ParamType.getId(p)) ?? null;
const name = (id: number) => ObjType.get(id).debugname ?? String(id);

const pairs: { base: number; kit: number; into: number }[] = [];
for (let i = 0; i < ObjType.count; i++) {
    if (!ObjType.get(i)) continue;
    for (const [k, v] of [['ornament_kit', 'ornament_into'], ['ornament_kit2', 'ornament_into2']]) {
        const kit = P(i, k), into = P(i, v);
        if (kit !== null && into !== null) pairs.push({ base: i, kit, into });
    }
}
const kits = new Set(pairs.map(p => p.kit));
console.log(`${pairs.length} pairings across ${kits.size} kits`);
check('  all sixteen kits are wired to something', kits.size, 16);

let applied = 0, reverted = 0;
const broken: string[] = [];
for (const { base, kit, into } of pairs) {
    const p: any = player(`orn${base}_${kit}`, 3200, 3200);
    H.clearInv(p);
    H.give(p, name(base), 1);
    H.give(p, name(kit), 1);

    A.runProcProtected(p, '[proc,ornament_kit_apply]', [kit, base]);
    if (H.invCount(p, name(into)) === 1 && H.invCount(p, name(base)) === 0 && H.invCount(p, name(kit)) === 0) applied++;
    else broken.push(`${name(base)} + ${name(kit)} did not make ${name(into)}`);

    A.runProcProtected(p, '[proc,ornament_kit_revert]', [into]);
    if (H.invCount(p, name(base)) === 1 && H.invCount(p, name(kit)) === 1 && H.invCount(p, name(into)) === 0) reverted++;
    else broken.push(`${name(into)} did not revert to ${name(base)} + ${name(kit)}`);
    H.despawn(p);
}
check(`  all ${pairs.length} take their kit`, applied, pairs.length);
check(`  and all ${pairs.length} give it back`, reverted, pairs.length);
if (broken.length) console.log('  ' + broken.join('\n  '));

// ---------------------------------------------------------------- a decoration is paint
// Every result must carry its base's bonuses exactly, or a gilded dragon scimitar is a different
// weapon from a dragon scimitar and nobody meant that.
console.log('\nA DECORATION IS PAINT');
const BONUS = ['stabattack', 'slashattack', 'crushattack', 'magicattack', 'rangeattack',
               'stabdefence', 'slashdefence', 'crushdefence', 'magicdefence', 'rangedefence',
               'strengthbonus', 'prayerbonus'];
let same = 0;
for (const { base, into } of pairs) {
    if (BONUS.every(k => P(base, k) === P(into, k))) same++;
    else console.log(`  ${name(into)} does not match ${name(base)}`);
}
check('  every decorated item has its base item\'s stats', same, pairs.length);

// ---------------------------------------------------------------- and the wrong kit is refused
console.log('\nTHE WRONG KIT DOES NOTHING');
{
    const base = pairs[0].base;
    const wrongKit = pairs.map(p => p.kit).find(k => k !== pairs[0].kit)!;
    const p: any = player('ornwrong', 3200, 3200);
    H.clearInv(p);
    H.give(p, name(base), 1);
    H.give(p, name(wrongKit), 1);
    A.runProcProtected(p, '[proc,ornament_kit_apply]', [wrongKit, base]);
    check('  nothing is consumed', [H.invCount(p, name(base)), H.invCount(p, name(wrongKit))], [1, 1]);
    check('  and it says so', A.lastMes(p).includes("doesn't fit on that"), true);
    H.despawn(p);
}

console.log(`\n${R.ok} ok, ${R.bad} FAIL`);
process.exit(R.bad ? 1 : 0);
