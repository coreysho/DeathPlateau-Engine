// JAB, SWIPE AND FEND - the bladed staff weapon class.
// Usage: npx tsx tools/sim/bladedstaff.ts   (exit code is the verdict)
//
// WHAT THIS IS FOR. The staff of the dead and the staff of light were category=weapon_staff, whose
// table is three CRUSH rows - Bash, Pound, Focus - plus the two Spell boxes. So their 55 stab and
// 70 slash were bonuses on nothing: whatever style you picked, the hit rolled against crush.
//
// NOTHING COULD ERROR. The tab drew, a style selected, the weapon swung, the damage landed, every
// sim passed and rs2check was clean. The only symptom was that the number was computed against the
// wrong defence bonus, which no assertion in this directory was looking at - the same shape of
// defect as the dragon warhammer playing its ordinary swing.
//
// So this walks the five styles and asserts, for each, the damage TYPE the hit will roll against
// and the STYLE that decides the experience - because that pair is the whole content of a weapon
// class, and reading the dbrow back proves only that the dbrow says what it says.
import * as H from './harness.ts';
import { check, R, player } from './a1lib.ts';
import ObjType from '#/cache/config/ObjType.js';
import CategoryType from '#/cache/config/CategoryType.js';
import Component from '#/cache/config/Component.js';
import SeqType from '#/cache/config/SeqType.js';
import ScriptProvider from '#/engine/script/ScriptProvider.js';
import Player from '#/engine/entity/Player.js';

await H.boot();

// All four: the staff of the dead, the staff of light, and the toxic staff of the dead charged
// and uncharged - a fang on a staff of the dead takes neither its blade nor its special off it.
const STAVES = ['staff_of_the_dead', 'staff_of_light',
                'toxic_staff_of_the_dead', 'toxic_staff_uncharged'];
// combat_damagetypes.constant / combat_damagestyles.constant
const STAB = 0, SLASH = 1, CRUSH = 2, MAGIC = 4;
const ACCURATE = 0, AGGRESSIVE = 1, DEFENSIVE = 2, MAGIC_NORMAL = 7, MAGIC_DEFENSIVE = 8;

// Old School's five combat options for a bladed staff: Jab, Swipe, Fend and the two Spell boxes.
const STYLES: { mode: number; name: string; type: number; style: number; anim: string | null }[] = [
    // the animations are the beta-world dump's: stab 428, slash 440, crush 419. Reported from
    // play as the wrong swipe, and it was the one-handed sword's 390; the crush and the block were
    // 414 and 415, which the same dump names as the Kodai wand's.
    { mode: 0, name: 'Jab', type: STAB, style: ACCURATE, anim: 'human_spear_spike' },
    { mode: 1, name: 'Swipe', type: SLASH, style: AGGRESSIVE, anim: 'human_scythe_sweep' },
    { mode: 2, name: 'Fend', type: CRUSH, style: DEFENSIVE, anim: 'human_stafforb_pummel' },
    { mode: 3, name: 'Spell', type: MAGIC, style: MAGIC_NORMAL, anim: null },
    { mode: 4, name: 'Spell (defensive)', type: MAGIC, style: MAGIC_DEFENSIVE, anim: null }
];

const seqName = (id: number): string => (id >= 0 ? (SeqType.get(id)?.debugname ?? `seq_${id}`) : '-');

/** Put the player on a style and let the combat vars catch up, as the tab's buttons do. */
const onStyle = (p: Player, mode: number) => {
    H.setVar(p, 'com_mode', mode);
    H.runProc(p, '[proc,player_combat_stat]', [], undefined, true);
};

// ---------------------------------------------------------------------------------------------
console.log('== both staves are a bladed staff, not a plain one');
{
    const bladed = CategoryType.getId('weapon_bladed_staff');
    check('weapon_bladed_staff is a category', bladed !== -1, true);
    for (const s of STAVES) {
        const o = ObjType.get(ObjType.getId(s));
        check(`${s}: category`, o.category, bladed);
    }
    check('the class has a style table', ScriptProvider.getByName('[proc,combat_get_weapon_style_data]') !== null, true);
}

// ---------------------------------------------------------------------------------------------
console.log('\n== the five styles roll what Old School rolls');
{
    // THE HALF THAT CAUGHT NOTHING BEFORE. On weapon_staff_table every one of these was CRUSH, so
    // the only way to see the defect was to read %damagetype after picking a style.
    for (const s of STAVES) {
        const p = player(`bladed_${s}`, 3250, 3250);
        H.maxOut(p);
        H.clearInv(p);
        H.give(p, s);
        H.opheld(p, s, 2);
        H.tick(1);

        for (const st of STYLES) {
            onStyle(p, st.mode);
            check(`${s} / ${st.name}: damage type`, H.getVar(p, 'damagetype'), st.type);
            check(`${s} / ${st.name}: damage style`, H.getVar(p, 'damagestyle'), st.style);
            // and the swing: the two melee styles that were unreachable have their own animations
            // on the obj, which until now nothing could ever play
            if (st.anim !== null) {
                check(`${s} / ${st.name}: swings ${st.anim}`, seqName(H.getVar(p, 'com_attackanim')), st.anim);
            }
        }
    }
}

// ---------------------------------------------------------------------------------------------
console.log('\n== and not one of them is the old all-crush table');
{
    // Stated as its own check because this is the regression, not a detail of it: if the staves
    // ever fall back to weapon_staff, all three melee rows read crush again and every assertion
    // above about Jab and Swipe fails with a value that looks perfectly reasonable.
    const p = player('bladed_regress', 3251, 3251);
    H.maxOut(p);
    H.clearInv(p);
    H.give(p, 'staff_of_the_dead');
    H.opheld(p, 'staff_of_the_dead', 2);
    H.tick(1);
    const melee = [0, 1, 2].map(m => { onStyle(p, m); return H.getVar(p, 'damagetype'); });
    check('the three melee styles are stab, slash and crush', melee, [STAB, SLASH, CRUSH]);
    check('...and not three crushes', melee.every(t => t === CRUSH), false);

    // a plain staff is untouched and still Bash/Pound/Focus
    H.give(p, 'mystic_air_staff');
    H.opheld(p, 'mystic_air_staff', 2);
    H.tick(1);
    const plain = [0, 1, 2].map(m => { onStyle(p, m); return H.getVar(p, 'damagetype'); });
    check('a plain staff is still all crush', plain, [CRUSH, CRUSH, CRUSH]);
}

// ---------------------------------------------------------------------------------------------
console.log('\n== the tab says Jab, Swipe and Fend, and keeps both Spell boxes');
{
    // combat_bladed_staff.if is combat_staff_2.if relabelled, so the names are the staff tab's and
    // only the words differ. These are the words the player reads.
    const labels: [string, string][] = [
        ['combat_bladed_staff:com_101', 'Jab'],
        ['combat_bladed_staff:com_102', 'Swipe'],
        ['combat_bladed_staff:com_103', 'Fend']
    ];
    for (const [com, want] of labels) {
        const id = Component.getId(com);
        check(`${com} exists`, id !== -1, true);
        if (id !== -1) check(`${com} reads ${want}`, Component.get(id).text, want);
    }
    // the hover texts, which name the attack type - the thing that was wrong
    const hovers: [string, string][] = [
        ['combat_bladed_staff:com_218', '(Stab)'],
        ['combat_bladed_staff:com_180', '(Slash)'],
        ['combat_bladed_staff:com_181', '(Crush)']
    ];
    for (const [com, want] of hovers) {
        const id = Component.getId(com);
        if (id !== -1) check(`${com} mentions ${want}`, (Component.get(id).text ?? '').includes(want), true);
    }
    // every button the tab needs a handler for. A missing one is a dead box, not an error.
    for (const com of ['staff2a', 'staff2b', 'staff2c', 'auto_cast', 'auto_defensive',
                       'auto_retaliate', 'specbar']) {
        check(`combat_bladed_staff:${com} is wired`,
            ScriptProvider.getByName(`[if_button,combat_bladed_staff:${com}]`) !== null, true);
    }
}

// ---------------------------------------------------------------------------------------------
console.log('\n== and it is still a weapon where a staff is refused');
{
    // Entrana's monk and Glarial's tomb both turn a staff away. A new category is invisible to a
    // list of categories, so both lists had to learn this one - and a bladed staff being waved
    // onto Entrana is exactly the kind of thing nobody tests.
    // The two procs answer OPPOSITE questions: the monk's is "is anything restricted" and the
    // tomb's is "can you enter", so empty-handed is 0 for one and 1 for the other.
    const gates: { proc: string; label: string; empty: number; armed: number }[] = [
        { proc: '[proc,has_entrana_restricted_items]', label: 'the Entrana monk', empty: 0, armed: 1 },
        { proc: '[proc,waterfall_can_enter_glarials_tomb]', label: "Glarial's tomb", empty: 1, armed: 0 }
    ];
    for (const g of gates) {
        const p = player(`bladed_ban_${g.empty}`, 3250, 3250);
        H.clearInv(p);
        check(`${g.label}: empty-handed`, H.runProc(p, g.proc)[0], g.empty);
        H.give(p, 'staff_of_the_dead');
        check(`${g.label}: carrying a staff of the dead`, H.runProc(p, g.proc)[0], g.armed);
        // and worn, not just carried - both lists check inv and worn
        H.clearInv(p);
        H.equip(p, { rhand: 'staff_of_light' });
        check(`${g.label}: wearing a staff of light`, H.runProc(p, g.proc)[0], g.armed);
    }
}

console.log(`\n${R.ok} ok, ${R.bad} failed`);
process.exit(R.bad ? 1 : 0);
