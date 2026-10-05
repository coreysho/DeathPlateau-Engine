// Zulrah's two mutagens, and the helm family they make.
//
// A mutagen is paint: the tanzanite and magma helms have to BE serpentine helms in every way that
// matters - same numbers, same scales, same degrade, same Check - or the recolour is a downgrade
// nobody asked for. serpentine_helm.rs2 was rewritten to work off a category and two params so
// that the mutated pairs get all of that instead of a copy of it, and this is what says the rewrite
// did not leave the original behind.
//
//   npx tsx tools/sim/mutagens.ts
import * as H from './harness.ts';
import * as A from './a1lib.ts';
import { check, R, player } from './a1lib.ts';
import ObjType from '#/cache/config/ObjType.js';
import ParamType from '#/cache/config/ParamType.js';
import InvType from '#/cache/config/InvType.js';
import VarPlayerType from '#/cache/config/VarPlayerType.js';

await H.boot();

const P = (id: number, p: string) => (ObjType.get(id) as any).params?.get(ParamType.getId(p)) ?? null;
const oid = (n: string) => ObjType.getId(n);
const charges = (p: any) => p.getVar(VarPlayerType.getByName('serpentine_helm_charges')!.id);
const setCharges = (p: any, n: number) => p.setVar(VarPlayerType.getByName('serpentine_helm_charges')!.id, n);

// ---------------------------------------------------------------- the family
console.log('THE HELM FAMILY');
const FAMILY = ['serpentine_helm', 'serpentine_helm_uncharged', 'tanzanite_helm',
                'tanzanite_helm_uncharged', 'magma_helm', 'magma_helm_uncharged'];
for (const n of FAMILY) {
    check(`  ${n.padEnd(26)} is in the category`, (ObjType.get(oid(n)) as any).category,
        (ObjType.get(oid('serpentine_helm')) as any).category);
}
// Every charged one knows its bare record and back again, which is what the rewritten script reads
// instead of naming serpentine_helm_uncharged in six places.
for (const [charged, bare] of [['serpentine_helm', 'serpentine_helm_uncharged'],
                               ['tanzanite_helm', 'tanzanite_helm_uncharged'],
                               ['magma_helm', 'magma_helm_uncharged']] as [string, string][]) {
    check(`  ${charged.padEnd(26)} <-> ${bare}`,
        [P(oid(charged), 'serpentine_uncharged'), P(oid(bare), 'serpentine_charged')],
        [oid(bare), oid(charged)]);
}

// ---------------------------------------------------------------- a mutagen is paint
console.log('\nA MUTAGEN IS PAINT');
const BONUS = ['stabattack', 'slashattack', 'crushattack', 'magicattack', 'rangeattack',
               'stabdefence', 'slashdefence', 'crushdefence', 'magicdefence', 'rangedefence',
               'strengthbonus', 'prayerbonus'];
for (const n of ['tanzanite_helm', 'magma_helm']) {
    check(`  ${n} has the serpentine helm's numbers`,
        BONUS.every(k => P(oid(n), k) === P(oid('serpentine_helm'), k)), true);
}

// ---------------------------------------------------------------- using one
console.log('\nUSING ONE');
for (const [mutagen, charged, bare] of [['tanzanite_mutagen', 'tanzanite_helm', 'tanzanite_helm_uncharged'],
                                        ['magma_mutagen', 'magma_helm', 'magma_helm_uncharged']] as [string, string, string][]) {
    // on a CHARGED helm, with scales in it
    const p: any = player(`mut_${mutagen}`, 3200, 3200);
    H.clearInv(p);
    H.give(p, 'serpentine_helm', 1);
    H.give(p, mutagen, 1);
    setCharges(p, 900);
    // the real click, through the helm's own opheldu - the dialogue only works that way
    A.useHeld(p, mutagen, 'serpentine_helm', [1]);
    check(`  ${mutagen} makes a ${charged}`,
        [H.invCount(p, charged), H.invCount(p, 'serpentine_helm'), H.invCount(p, mutagen)], [1, 0, 0]);
    check('  and the scales are untouched', charges(p), 900);
    H.despawn(p);

    // and on an UNCHARGED one, which has to come out uncharged
    const q: any = player(`mutb_${mutagen}`, 3200, 3200);
    H.clearInv(q);
    H.give(q, 'serpentine_helm_uncharged', 1);
    H.give(q, mutagen, 1);
    A.useHeld(q, mutagen, 'serpentine_helm_uncharged', [1]);
    check(`  on a bare helm it makes a ${bare}`, H.invCount(q, bare), 1);
    H.despawn(q);
}

// ---------------------------------------------------------------- and it is permanent
console.log('\nIT CANNOT BE TAKEN BACK OFF');
{
    const p: any = player('mutagain', 3200, 3200);
    H.clearInv(p);
    H.give(p, 'tanzanite_helm', 1);
    H.give(p, 'magma_mutagen', 1);
    A.useHeld(p, 'magma_mutagen', 'tanzanite_helm');
    check('  a second mutagen does nothing',
        [H.invCount(p, 'tanzanite_helm'), H.invCount(p, 'magma_mutagen')], [1, 1]);
    check('  and says why', A.lastMes(p).includes('already been mutated'), true);
    // no Revert: an ornament kit has one, a mutagen must not
    check('  there is no way back', P(oid('tanzanite_helm'), 'ornament_from'), null);
    H.despawn(p);
}

// ---------------------------------------------------------------- a mutated helm still works
console.log('\nAND A MUTATED HELM IS STILL A SERPENTINE HELM');
{
    const p: any = player('mutuse', 3200, 3200);
    H.clearInv(p);
    H.give(p, 'tanzanite_helm_uncharged', 1);
    H.give(p, 'zulrahs_scales', 50);
    setCharges(p, 0);
    A.useHeld(p, 'zulrahs_scales', 'tanzanite_helm_uncharged');
    check('  scales go into it', [H.invCount(p, 'tanzanite_helm'), charges(p)], [1, 50]);

    A.runProcProtected(p, '[proc,serpentine_helm_check]', [oid('tanzanite_helm')]);
    check('  Check names the helm you are holding', A.lastMes(p).includes('tanzanite helm'), true);

    H.opheld(p, 'tanzanite_helm', 5);
    check('  and Uncharge gives the scales back',
        [H.invCount(p, 'tanzanite_helm_uncharged'), H.invCount(p, 'zulrahs_scales'), charges(p)], [1, 50, 0]);
    H.despawn(p);
}

console.log(`\n${R.ok} ok, ${R.bad} FAIL`);
process.exit(R.bad ? 1 : 0);
