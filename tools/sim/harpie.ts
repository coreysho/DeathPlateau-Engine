// HARPIE BUG SWARMS, AND THE LANTERN YOU ARE SUPPOSED TO NEED.
//
//   npx tsx tools/sim/harpie.ts
//
// Reported from the game as "dont need bug lantern to kill". You did not: nothing anywhere asked
// about the lantern, so a swarm died to bare hands like anything else.
//
// "A lit bug lantern, which requires a Firemaking level of 33 to light, is required to damage these
// monsters (the lantern must be lit and equipped)." (/w/Harpie_Bug_Swarm)
//
// REQUIRED TO DAMAGE, NOT TO ATTACK, which is what this has to measure: the swarm is attackable
// either way and a sim that only checked for a refusal would pass on the broken build. So it
// fights one for a while and looks at its hitpoints.
import * as H from './harness.js';
import * as A from './a1lib.js';
import { check, R, player } from './a1lib.js';
import NpcType from '#/cache/config/NpcType.js';
import ParamType from '#/cache/config/ParamType.js';
import ObjType from '#/cache/config/ObjType.js';
import { NpcStat } from '#/engine/entity/NpcStat.js';
import { PlayerStat } from '#/engine/entity/PlayerStat.js';

await H.boot();
H.loginOrder();

const SWARM = 'slayer_harpiebugswarm';
const HP = 400; // more than it has, so a whole fight fits inside one npc
const HARPIE_CATEGORY = 70; // ^slayer_harpiebugswarm

/** Fight a swarm for `ticks` with the given kit, and report how much damage landed. */
function fight(name: string, kit: Record<string, string>, ticks = 120) {
    const p: any = player(name, 2870, 3110);
    H.maxOut(p);
    H.clearInv(p);
    H.equip(p, kit);
    H.tick(2);
    const npc: any = H.addNpcAt(SWARM, p.x + 1, p.z, 0);
    npc.baseLevels[NpcStat.HITPOINTS] = HP;
    npc.levels[NpcStat.HITPOINTS] = HP;
    A.fight(p, npc, ticks);
    const dealt = HP - npc.levels[NpcStat.HITPOINTS];
    H.despawn(p);
    return dealt;
}

console.log('A SWARM TAKES NOTHING FROM ANYBODY WITHOUT A LIT BUG LANTERN');
{
    // Three styles, because the rule lives in three separate scripts and a fix that reached two of
    // them would leave the third as the way round it.
    check('  bare fists do nothing', fight('hp_fist', {}), 0);
    check('  nor does a whip', fight('hp_whip', { rhand: 'abyssal_whip' }), 0);
    check('  nor a bow', fight('hp_bow', { rhand: 'magic_shortbow', quiver: 'rune_arrow' }), 0);
    check('  nor thrown knives', fight('hp_knife', { rhand: 'rune_knife' }), 0);

    // ...and the UNLIT lantern is not the lantern. "The lantern must be lit and equipped."
    check('  an unlit lantern is no help', fight('hp_unlit', { rhand: 'abyssal_whip', lhand: 'slayer_buglan_off' }), 0);
    // ...nor one sitting in the pack rather than in your hand
    const packed: any = player('hp_packed', 2870, 3110);
    H.maxOut(packed);
    H.clearInv(packed);
    H.equip(packed, { rhand: 'abyssal_whip' });
    H.give(packed, 'slayer_buglan_on');
    H.tick(2);
    const npc: any = H.addNpcAt(SWARM, packed.x + 1, packed.z, 0);
    npc.baseLevels[NpcStat.HITPOINTS] = HP;
    npc.levels[NpcStat.HITPOINTS] = HP;
    A.fight(packed, npc, 120);
    check('  and one carried rather than held is no help either', HP - npc.levels[NpcStat.HITPOINTS], 0);
    H.despawn(packed);
}

console.log('\nWITH ONE LIT AND IN HAND, IT DIES like anything else');
{
    const whip = fight('hp_lit_whip', { rhand: 'abyssal_whip', lhand: 'slayer_buglan_on' });
    check('  a whip hurts it', whip > 0, true);
    // The lantern is a shield-slot item, so a bow works with it and a two-hander does not - which
    // is the live constraint rather than anything this build invented.
    // RANGED MEANS ONE-HANDED HERE. The lantern is a shield-slot item (wearpos=lefthand) and a bow
    // is two-handed (wearpos2=lefthand), so a bow and a lit lantern cannot be worn at once - which
    // is the live game's own constraint and not anything this build invented. Thrown knives can.
    const knives = fight('hp_lit_knife', { rhand: 'rune_knife', lhand: 'slayer_buglan_on' });
    check('  so do thrown knives, which leave a hand free', knives > 0, true);
    check('  and a two-handed bow cannot hold the lantern at all', [(ObjType.get(ObjType.getId('magic_shortbow')) as any).wearpos2, (ObjType.get(ObjType.getId('slayer_buglan_on')) as any).wearpos], [5, 5]);
}

console.log('\nAND MAGIC OBEYS THE SAME RULE, which is the third script it had to reach');
{
    /** Cast fire bolt at a swarm for a while and report the damage that landed. */
    function spell(name: string, lantern: boolean) {
        const p: any = player(name, 2870, 3110);
        H.maxOut(p);
        H.clearInv(p);
        H.equip(p, lantern ? { rhand: 'staff_of_fire', lhand: 'slayer_buglan_on' } : { rhand: 'staff_of_fire' });
        for (const r of ['airrune', 'chaosrune', 'deathrune', 'bloodrune', 'mindrune']) H.give(p, r, 1000);
        H.tick(2);
        const npc: any = H.addNpcAt(SWARM, p.x + 3, p.z, 0);
        npc.baseLevels[NpcStat.HITPOINTS] = HP;
        npc.levels[NpcStat.HITPOINTS] = HP;
        for (let i = 0; i < 20; i++) {
            H.castOnNpc(p, npc, 'magic:fire_bolt');
            H.tick(6);
        }
        const dealt = HP - npc.levels[NpcStat.HITPOINTS];
        H.despawn(p);
        return dealt;
    }
    check('  fire bolt does nothing without the lantern', spell('hp_mage_bare', false), 0);
    check('  and hurts it with one', spell('hp_mage_lit', true) > 0, true);
}

console.log('\nTHE LANTERN CAN BE LIT, AND WANTS 33 FIREMAKING');
{
    /** Tinderbox on an unlit bug lantern. */
    function light(name: string, fm: number) {
        const p: any = player(name, 2870, 3110);
        H.clearInv(p);
        p.setLevel(PlayerStat.FIREMAKING, fm);
        H.give(p, 'slayer_buglan_off');
        H.give(p, 'tinderbox');
        const m = A.mark();
        A.useHeld(p, 'tinderbox', 'slayer_buglan_off');
        H.tick(2);
        const out = { lit: H.invCount(p, 'slayer_buglan_on'), unlit: H.invCount(p, 'slayer_buglan_off'), said: A.mesSince(p, m) };
        H.despawn(p);
        return out;
    }
    const ok = light('hp_fm33', 33);
    check('  at 33 it lights', [ok.lit, ok.unlit], [1, 0]);
    const low = light('hp_fm32', 32);
    check('  at 32 it does not', [low.lit, low.unlit], [0, 1]);
    check(
        '    and says why',
        low.said.some(s => s.includes('Firemaking level of 33')),
        true
    );
}

console.log('\nAND IT CAN BE PUT OUT AGAIN, which was a dead click');
{
    // Extinguish sits on op3 for this one rather than op2, which is why the op2 sweep that found
    // the five lanterns in light_source.rs2 walked straight past it.
    const t: any = ObjType.get(ObjType.getId('slayer_buglan_on'));
    check('  the cache puts Extinguish on op3', t.iop?.[2], 'Extinguish');
    const p: any = player('hp_douse', 2870, 3110);
    H.clearInv(p);
    H.give(p, 'slayer_buglan_on');
    const m = A.mark();
    A.held(p, 'slayer_buglan_on', 3);
    H.tick(2);
    check('  and clicking it puts the lantern out', [H.invCount(p, 'slayer_buglan_off'), H.invCount(p, 'slayer_buglan_on')], [1, 0]);
    check(
        '    rather than the no-wearpos debug line',
        A.mesSince(p, m).some(s => s.includes('No wearpos')),
        false
    );
    H.despawn(p);
}

console.log('\nAND THE RULE IS HUNG ON THE RIGHT HOOK');
{
    // ~harpie_lantern_missing keys off param=slayer_category, so if that moved the rule would
    // quietly stop applying while every check above still passed - by fighting something that is
    // no longer a harpie bug swarm as far as the rule is concerned.
    const t: any = NpcType.get(NpcType.getId(SWARM));
    check('  the swarm is attackable', !!t.op?.some((o: string | null) => o && /attack/i.test(o)), true);
    check('  and still carries the slayer category the rule reads', t.params?.get(ParamType.getId('slayer_category')), HARPIE_CATEGORY);
    // ...and the rule says so itself, which is the one call the three combat scripts make
    const p: any = player('hp_hook', 2870, 3110);
    H.clearInv(p);
    const npc = H.addNpcAt(SWARM, p.x + 1, p.z, 0);
    check('  with no lantern, the rule fires', H.runNpcProc(npc, '[proc,harpie_lantern_missing]', p), [1]);
    H.equip(p, { lhand: 'slayer_buglan_on' });
    check('  with one in hand, it does not', H.runNpcProc(npc, '[proc,harpie_lantern_missing]', p), [0]);
    H.despawn(p);
}

console.log(`\n${R.ok} ok, ${R.bad} FAIL`);
process.exit(R.bad ? 1 : 0);
