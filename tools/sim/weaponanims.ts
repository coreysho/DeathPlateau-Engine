// EVERY WIELDABLE ITEM CAN ACTUALLY SWING.
//
// ~combat_swing_anim_and_synth reads the attack animation off the obj - stabattack_anim and its
// three siblings - and oc_param hands back NULL when the param is not there. A null animation is no
// animation: the player stands still and the hit lands out of nowhere. Nothing errors, nothing logs.
//
// The import is how they go missing. fillosrsstats either copies a base item's params, which brings
// the category, anims, sounds and speed along, or takes the cache's params 0-11 - and those are the
// TWELVE EQUIPMENT BONUSES and nothing else. So 27 imported weapons had bonuses and no way to use
// them, including a 3rd Age longsword with 72 slash attack.
//
// This asks the engine the question a player asks: with this in my hand and this style selected,
// what animation plays? Not whether the param file looks right - whether the proc returns a seq.
//
//   npx tsx tools/sim/weaponanims.ts
import * as H from './harness.ts';
import * as A from './a1lib.ts';
import { check, R, player } from './a1lib.ts';
import ObjType from '#/cache/config/ObjType.js';
import CategoryType from '#/cache/config/CategoryType.js';
import ParamType from '#/cache/config/ParamType.js';

await H.boot();

const P = (id: number, p: string) => (ObjType.get(id) as any).params?.get(ParamType.getId(p)) ?? null;
const MAGIC_STYLE = 4;   // ^magic_style, skill_combat/configs/combat_damagetypes.constant
const BONUSES = ['stabattack', 'slashattack', 'crushattack', 'magicattack', 'rangeattack', 'strengthbonus'];

// every right-hand item that claims a combat bonus: those are the ones meant to be swung
const armed: number[] = [];
for (let id = 0; id < ObjType.count; id++) {
    const o: any = ObjType.get(id);
    if (!o || o.wearpos !== 3) continue;
    if (!BONUSES.some(b => P(id, b) !== null)) continue;
    armed.push(id);
}
console.log(`${armed.length} items go in a hand and claim a combat bonus`);
check('  the cache was read at all', armed.length > 100, true);

const p: any = player('swing', 3222, 3222);
const noCat: string[] = [];
const noAnim: string[] = [];
for (const id of armed) {
    const o: any = ObjType.get(id);
    const name = o.debugname ?? String(id);
    const cat = CategoryType.get(o.category)?.debugname ?? '';
    // 'flowers' is 377's own joke category - a bunch of flowers is swung, has a crush bonus, and
    // shares the blunt tab (~attackstyle_memory_get names it). It is not a weapon_* and is not
    // meant to be. Anything else without a weapon_* category is an import that lost one.
    if (!cat.startsWith('weapon_') && cat !== 'flowers') { noCat.push(`${name} (${cat || 'none'})`); continue; }
    if (cat === 'flowers') continue;

    // Ask for every style the weapon's own table offers, the way a player switching tabs would.
    H.equip(p, { rhand: name });
    for (let mode = 0; mode < 4; mode++) {
        H.setVar(p, 'com_mode', mode);
        H.runProc(p, '[proc,player_combat_stat]');
        const dmg = H.getVar(p, 'damagetype');
        const style = H.getVar(p, 'damagestyle');
        if (dmg < 0) { noAnim.push(`${name} style ${mode}: damagetype ${dmg}`); continue; }
        // A MAGIC STYLE BRINGS ITS OWN ANIMATION. A powered staff's first style is the spell it
        // fires, and the spell animates the cast - the obj carries no magicattack_anim and should
        // not. Only a swing or a shot has to come from the weapon.
        if (dmg === MAGIC_STYLE) continue;
        const [seq] = H.runProc(p, '[proc,combat_swing_anim_and_synth]', [id, dmg, style, mode]);
        if (seq === -1 && mode === 0) noAnim.push(`${name} style ${mode}: no animation`);
    }
}
console.log('\nA WEAPON WITHOUT A WEAPON CATEGORY USES THE UNARMED TABLE');
for (const n of noCat) console.log('  ' + n);
check('  every armed item has a weapon_* category', noCat.length, 0);

console.log('\nAND EVERY ONE OF THEM PLAYS SOMETHING WHEN IT SWINGS');
for (const n of noAnim.slice(0, 20)) console.log('  ' + n);
check('  no wielded weapon swings with a null animation', noAnim.length, 0);

// The Ale of the gods is not a weapon and is the reason this file exists: its whole purpose is a
// stance, and the import could not carry one.
console.log('\nTHE ALE OF THE GODS SWAYS');
const ale = ObjType.getId('ale_of_the_gods');
for (const stance of ['ready_baseanim', 'walk_f_baseanim', 'walk_b_baseanim', 'walk_l_baseanim', 'walk_r_baseanim', 'running_baseanim']) {
    check(`  ${stance.padEnd(18)} is set`, P(ale, stance) !== null && P(ale, stance) !== -1, true);
}

console.log(`\n${R.ok} ok, ${R.bad} FAIL`);
process.exit(R.bad ? 1 : 0);
