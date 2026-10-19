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
import VarPlayerType from '#/cache/config/VarPlayerType.js';

await H.boot();

const P = (id: number, p: string) => (ObjType.get(id) as any).params?.get(ParamType.getId(p)) ?? null;
const oid = (n: string) => ObjType.getId(n);
const charges = (p: any) => p.getVar(VarPlayerType.getByName('serpentine_helm_charges')!.id);
const setCharges = (p: any, n: number) => p.setVar(VarPlayerType.getByName('serpentine_helm_charges')!.id, n);

// ---------------------------------------------------------------- the family
console.log('THE HELM FAMILY');
const FAMILY = ['serpentine_helm', 'serpentine_helm_uncharged', 'tanzanite_helm', 'tanzanite_helm_uncharged', 'magma_helm', 'magma_helm_uncharged'];
for (const n of FAMILY) {
    check(`  ${n.padEnd(26)} is in the category`, (ObjType.get(oid(n)) as any).category, (ObjType.get(oid('serpentine_helm')) as any).category);
}
// Every charged one knows its bare record and back again, which is what the rewritten script reads
// instead of naming serpentine_helm_uncharged in six places.
for (const [charged, bare] of [
    ['serpentine_helm', 'serpentine_helm_uncharged'],
    ['tanzanite_helm', 'tanzanite_helm_uncharged'],
    ['magma_helm', 'magma_helm_uncharged']
] as [string, string][]) {
    check(`  ${charged.padEnd(26)} <-> ${bare}`, [P(oid(charged), 'serpentine_uncharged'), P(oid(bare), 'serpentine_charged')], [oid(bare), oid(charged)]);
}

// ---------------------------------------------------------------- a mutagen is paint
console.log('\nA MUTAGEN IS PAINT');
const BONUS = ['stabattack', 'slashattack', 'crushattack', 'magicattack', 'rangeattack', 'stabdefence', 'slashdefence', 'crushdefence', 'magicdefence', 'rangedefence', 'strengthbonus', 'prayerbonus'];
for (const n of ['tanzanite_helm', 'magma_helm']) {
    check(
        `  ${n} has the serpentine helm's numbers`,
        BONUS.every(k => P(oid(n), k) === P(oid('serpentine_helm'), k)),
        true
    );
}

// ---------------------------------------------------------------- using one
console.log('\nUSING ONE');
for (const [mutagen, charged, bare] of [
    ['tanzanite_mutagen', 'tanzanite_helm', 'tanzanite_helm_uncharged'],
    ['magma_mutagen', 'magma_helm', 'magma_helm_uncharged']
] as [string, string, string][]) {
    // on a CHARGED helm, with scales in it
    const p: any = player(`mut_${mutagen}`, 3200, 3200);
    H.clearInv(p);
    H.give(p, 'serpentine_helm', 1);
    H.give(p, mutagen, 1);
    setCharges(p, 900);
    // the real click, through the helm's own opheldu - the dialogue only works that way
    A.useHeld(p, mutagen, 'serpentine_helm', [1]);
    check(`  ${mutagen} makes a ${charged}`, [H.invCount(p, charged), H.invCount(p, 'serpentine_helm'), H.invCount(p, mutagen)], [1, 0, 0]);
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

// ---------------------------------------------------------------- a mutagen cannot be swapped
console.log('\nONE MUTAGEN CANNOT BE PAINTED OVER WITH ANOTHER');
{
    const p: any = player('mutagain', 3200, 3200);
    H.clearInv(p);
    H.give(p, 'tanzanite_helm', 1);
    H.give(p, 'magma_mutagen', 1);
    A.useHeld(p, 'magma_mutagen', 'tanzanite_helm');
    check('  a second mutagen does nothing', [H.invCount(p, 'tanzanite_helm'), H.invCount(p, 'magma_mutagen')], [1, 1]);
    check('  and says why', A.lastMes(p).includes('already been mutated'), true);
    // not an ornament kit: that one gives its kit back on Revert, and a mutagen never does
    check('  it is not an ornament kit', P(oid('tanzanite_helm'), 'ornament_from'), null);
    H.despawn(p);
}

// ---------------------------------------------------------------- Restore
console.log('\nRESTORE PUTS THE HELM BACK, AND THE MUTAGEN DOES NOT COME WITH IT');
// iop4=Restore has been in all four mutated records since they were imported - it is Old School's
// own menu, "Wear, Check, Restore, Uncharge" charged and "Restore, Drop" uncharged - and nothing
// answered it until tools/silentobjops.py listed it. The mutagen is spent on use, so Restore
// returns the helm and nothing else, which is why it asks first.
{
    const p: any = player('mutrestore', 3200, 3200);
    H.clearInv(p);
    H.give(p, 'tanzanite_helm', 1);
    setCharges(p, 900);
    A.held(p, 'tanzanite_helm', 4, [1]);
    check('  a charged tanzanite helm goes back to a charged serpentine helm', [H.invCount(p, 'serpentine_helm'), H.invCount(p, 'tanzanite_helm')], [1, 0]);
    check('  with its scales untouched', charges(p), 900);
    check('  and no mutagen handed back', [H.invCount(p, 'tanzanite_mutagen'), H.invCount(p, 'magma_mutagen')], [0, 0]);
    H.despawn(p);

    // the uncharged pair restores to the uncharged record, which is the whole reason for one param
    // per record rather than one for the family
    const q: any = player('mutrestoreb', 3200, 3200);
    H.clearInv(q);
    H.give(q, 'magma_helm_uncharged', 1);
    setCharges(q, 0);
    A.held(q, 'magma_helm_uncharged', 4, [1]);
    check('  an uncharged magma helm goes back to an uncharged serpentine helm', [H.invCount(q, 'serpentine_helm_uncharged'), H.invCount(q, 'magma_helm_uncharged')], [1, 0]);
    H.despawn(q);

    // ...and saying no leaves it exactly as it was, which is what the warning is for
    const r: any = player('mutrestoreno', 3200, 3200);
    H.clearInv(r);
    H.give(r, 'tanzanite_helm', 1);
    setCharges(r, 50);
    A.held(r, 'tanzanite_helm', 4, [2]);
    check('  and answering no leaves the helm alone', [H.invCount(r, 'tanzanite_helm'), H.invCount(r, 'serpentine_helm'), charges(r)], [1, 0, 50]);
    H.despawn(r);

    // the plain helm is in the same category and so reaches the same trigger; it has no
    // mutagen_restore and must come out of it untouched
    const t: any = player('mutrestorebase', 3200, 3200);
    H.clearInv(t);
    H.give(t, 'serpentine_helm', 1);
    setCharges(t, 100);
    A.held(t, 'serpentine_helm', 4);
    check('  the plain serpentine helm has nothing to restore and is left alone', [H.invCount(t, 'serpentine_helm'), charges(t)], [1, 100]);
    check(
        '  and only the mutated four carry a way back',
        FAMILY.filter(n => P(oid(n), 'mutagen_restore') !== null),
        ['tanzanite_helm', 'tanzanite_helm_uncharged', 'magma_helm', 'magma_helm_uncharged']
    );
    H.despawn(t);
}

// ---------------------------------------------------------------- the passives, on the family
console.log('\nAND A MUTATED HELM VENOMS AND PROTECTS LIKE THE PLAIN ONE');
// THE BUG THIS CATCHES: ~serpentine_helm_charged compared the worn hat against serpentine_helm by
// NAME, so every passive the helm has - poison and venom immunity, and envenoming what you hit -
// was switched off the moment a mutagen went in. "These variants do not apply any stat changes and
// are purely cosmetic", so a tanzanite helm that cannot envenom is not cosmetic at all.
{
    for (const helm of ['serpentine_helm', 'tanzanite_helm', 'magma_helm']) {
        const p: any = player(`mutpass_${helm}`, 3200, 3200);
        H.clearInv(p);
        H.equip(p, { hat: helm });
        setCharges(p, 100);
        check(`  ${helm.padEnd(16)} worn with scales is charged, and immune`, [A.runProcProtected(p, '[proc,serpentine_helm_charged]')[0], A.runProcProtected(p, '[proc,serpentine_helm_immune]')[0]], [1, 1]);
        setCharges(p, 0);
        check('    ...and out of scales it is neither', [A.runProcProtected(p, '[proc,serpentine_helm_charged]')[0], A.runProcProtected(p, '[proc,serpentine_helm_immune]')[0]], [0, 0]);
        H.despawn(p);
    }
    // an uncharged record is not a charged helm however many scales the varp claims, and a hat
    // from outside the family is not one either - the empty head is guarded in the proc itself
    for (const hat of ['tanzanite_helm_uncharged', 'rune_full_helm']) {
        const p: any = player(`mutpassno_${hat}`, 3200, 3200);
        H.clearInv(p);
        H.equip(p, { hat });
        setCharges(p, 100);
        check(`  ${hat.padEnd(26)} is not a charged serpentine helm`, A.runProcProtected(p, '[proc,serpentine_helm_charged]')[0], 0);
        H.despawn(p);
    }
    const bare: any = player('mutpassbare', 3200, 3200);
    H.clearInv(bare);
    setCharges(bare, 100);
    check('  and nothing on the head does not throw', A.runProcProtected(bare, '[proc,serpentine_helm_charged]')[0], 0);
    H.despawn(bare);
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
    check('  and Uncharge gives the scales back', [H.invCount(p, 'tanzanite_helm_uncharged'), H.invCount(p, 'zulrahs_scales'), charges(p)], [1, 50, 0]);
    H.despawn(p);
}

console.log(`\n${R.ok} ok, ${R.bad} FAIL`);
process.exit(R.bad ? 1 : 0);
