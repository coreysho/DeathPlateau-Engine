// A WIELDED WEAPON WITH NO CATEGORY IS AN UNARMED FIST.
// Usage: npx tsx tools/sim/weaponcategory.ts   (exit code is the verdict)
//
// combat_get_weapon_style_data switches on oc_category and falls through to weapon_unarmed_table
// when a weapon has none, so the combat tab offers Punch, Kick and Block - and the swing matches,
// because stabattack_anim and slashattack_anim default to human_unarmedpunch and crushattack_anim
// to human_unarmedkick. That is one missing line showing up as two bugs, and it is invisible unless
// something looks: the item wields, the fight works, the numbers are right.
//
// The bow-sword was reported that way. The sweep at the end is the rest of the question - every
// other item you can wield in a hand that still has no category - printed rather than failed,
// because deciding which of those are really weapons is not this file's to make.
import * as H from './harness.js';
import { check, R } from './a1lib.js';
import ObjType from '#/cache/config/ObjType.js';
import ParamType from '#/cache/config/ParamType.js';
import SeqType from '#/cache/config/SeqType.js';
import CategoryType from '#/cache/config/CategoryType.js';

await H.boot();

const param = (obj: string, key: string): unknown => (ObjType.get(ObjType.getId(obj)) as unknown as { params?: Map<number, unknown> }).params?.get(ParamType.getId(key));
const seqName = (v: unknown): string => (typeof v === 'number' && v >= 0 ? (SeqType.get(v)?.debugname ?? `seq_${v}`) : String(v));
const catName = (o: ObjType): string => (o.category >= 0 ? (CategoryType.get(o.category)?.debugname ?? `cat_${o.category}`) : 'NONE');

console.log('== the bow-sword is a two-handed sword, not a fist');
{
    const o = ObjType.get(ObjType.getId('devious_bowsword'));
    check('its category', catName(o), 'weapon_2h_sword');
    // A 2h sword's four styles are Chop, Slash, Smash and Block, so slash and crush are the two
    // animations it can actually reach. Neither may be an unarmed one.
    check('  slash swings with a sword', seqName(param('devious_bowsword', 'slashattack_anim')), 'human_dhsword_slash');
    check('  smash swings with a sword', seqName(param('devious_bowsword', 'crushattack_anim')), 'human_dhsword_chop');
    check('  and it blocks two-handed', seqName(param('devious_bowsword', 'defend_anim')), 'human_dhsword_block');
    // Without this the param default of 4 would make a quest trinket the fastest 2h in the game.
    check('  at the 2h sword speed, not the param default of 4', param('devious_bowsword', 'attackrate'), 7);
    // It is made from a mithril 2h sword and wears like one.
    const rune = ObjType.get(ObjType.getId('rune_2h_sword'));
    check('  and wears in both hands, as a 2h sword does', [o.wearpos, o.wearpos2], [rune.wearpos, rune.wearpos2]);
}

console.log('\n== and nothing it swings with is an unarmed animation');
{
    const UNARMED = ['human_unarmedpunch', 'human_unarmedkick'].map(n => SeqType.getId(n));
    for (const k of ['stabattack_anim', 'slashattack_anim', 'crushattack_anim']) {
        const v = param('devious_bowsword', k);
        check(`  ${k} is not a fist`, UNARMED.includes(v as number), false);
    }
}

// ---------------------------------------------------------------------------------------------
// Everything else you can wield that still has none. Printed, not asserted: some of these are
// novelties that SHOULD punch (a rubber chicken is not a weapon) and telling those apart is a
// judgement call for whoever owns the item list.
console.log('\n== still category-less, for someone to rule on');
{
    const hand = new Set([ObjType.get(ObjType.getId('rune_2h_sword')).wearpos, ObjType.get(ObjType.getId('rune_dagger')).wearpos]);
    const out: string[] = [];
    for (let i = 0; i < ObjType.count; i++) {
        const o = ObjType.get(i);
        if (!o || o.category >= 0) continue;
        if (!hand.has(o.wearpos)) continue;
        if (o.certlink >= 0) continue; // noted copies carry the same gap and are not separate items
        out.push(`${o.debugname ?? i} ("${o.name}")`);
    }
    out.sort();
    console.log(`${out.length} wieldable items have no category:`);
    for (const line of out) console.log('   ' + line);
    check(
        'the bow-sword is no longer among them',
        out.some(s => s.startsWith('devious_bowsword')),
        false
    );
}

console.log(`\n${R.ok} ok, ${R.bad} FAIL`);
process.exit(R.bad ? 1 : 0);
