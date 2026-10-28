// EVERY SPECIAL PLAYS ITS OWN ANIMATION, not the weapon's ordinary swing.
// Usage: npx tsx tools/sim/specanims.ts   (exit code is the verdict)
//
// WHAT THIS IS FOR. The dragon warhammer's Smash played human_blunt_pound - the animation the
// hammer uses for a NORMAL attack - with the granite maul's graphic over it. Nothing errored,
// rs2check was clean, the damage and the Defence drain were both right, and every sim passed:
// the only symptom was that the special looked like a normal hit, which no assertion in this
// directory was looking at. The owner spotted it in game.
//
// So this fires each special and asserts two things no other sim does:
//
//   * the animation played is the special's own, and
//   * it is NOT the animation that weapon swings with ordinarily.
//
// The second half is the one that matters. A special that plays the right-NAMED animation is easy
// to assert; a special that plays the weapon's own attack animation is what actually shipped, and
// only a comparison against the ordinary swing catches it.
//
// The 2006 specials are checked too, so that the cache's own puncture/cleave/shatter set stays
// where it belongs - this is not an argument for importing a newer animation over a weapon that
// already has one.
import * as H from './harness.ts';
import { check, R, player } from './a1lib.ts';
import ObjType from '#/cache/config/ObjType.js';
import ParamType from '#/cache/config/ParamType.js';
import SeqType from '#/cache/config/SeqType.js';
import SpotanimType from '#/cache/config/SpotanimType.js';
import JavaRandom from '#/util/JavaRandom.js';
import ScriptProvider from '#/engine/script/ScriptProvider.js';
import ScriptRunner from '#/engine/script/ScriptRunner.js';
import ScriptPointer from '#/engine/script/ScriptPointer.js';
import Npc from '#/engine/entity/Npc.js';
import Player from '#/engine/entity/Player.js';

await H.boot();

const DEFENCE = 1;
const param = (obj: string, key: string): unknown =>
    (ObjType.get(ObjType.getId(obj)) as unknown as { params?: Map<number, unknown> }).params?.get(ParamType.getId(key));
const seqName = (id: number | undefined): string =>
    (typeof id === 'number' && id >= 0 ? (SeqType.get(id)?.debugname ?? `seq_${id}`) : '-');

const origND = JavaRandom.nextDouble.bind(JavaRandom);
const pin = (v: number | null) => {
    (JavaRandom as unknown as { nextDouble: () => number }).nextDouble = v === null ? origND : () => v;
};
const runSpec = (label: string, npc: Npc, p: Player) => {
    const script = ScriptProvider.getByName(label)!;
    const state = ScriptRunner.init(script, npc, p, []);
    state.pointerAdd(ScriptPointer.ProtectedActivePlayer);
    ScriptRunner.execute(state);
};

// weapon, its spec label, the animation the special should play, the graphic it should throw, and
// the params holding the weapon's ORDINARY attack animations - the thing it must not play.
type Row = { weapon: string; label: string; anim: string; spot: string | null; ordinary: string[] };
const SPECS: Row[] = [
    // Post-2006, imported: see content/scripts/skill_combat/configs/melee/osrs_spec_anims.seq
    { weapon: 'dragon_warhammer', label: '[label,pvm_dragon_warhammer_sa]', anim: 'osrs_dwh_spec', spot: 'dwh_spec', ordinary: ['crushattack_anim'] },
    { weapon: 'granite_hammer', label: '[label,pvm_granite_hammer_sa]', anim: 'osrs_dwh_spec', spot: 'granite_hammer_spec', ordinary: ['crushattack_anim'] },
    { weapon: 'abyssal_bludgeon', label: '[label,pvm_abyssal_bludgeon_sa]', anim: 'osrs_bludgeon_spec', spot: 'bludgeon_spec', ordinary: ['crushattack_anim'] },
    { weapon: 'dragon_sword', label: '[label,pvm_dragon_sword_sa]', anim: 'osrs_dsword_spec', spot: 'dsword_spec', ordinary: ['stabattack_anim', 'slashattack_anim'] },
    // 2006, and staying on the cache's own special animations.
    { weapon: 'bone_dagger', label: '[label,pvm_bone_dagger_sa]', anim: 'puncture', spot: 'sp_attack_puncture_spotanim', ordinary: ['stabattack_anim', 'slashattack_anim'] }
];

// ---------------------------------------------------------------------------------------------
console.log('== the four imported animations exist and look like player specials');
{
    for (const nm of ['osrs_dwh_spec', 'osrs_bludgeon_spec', 'osrs_dsword_spec']) {
        const id = SeqType.getId(nm);
        check(`${nm} is in the build`, id !== -1, true);
        if (id === -1) continue;
        const s = SeqType.get(id) as unknown as { frames: unknown[]; priority: number; walkmerge: unknown };
        check(`${nm} has frames`, (s.frames?.length ?? 0) > 0, true);
        // The shape every imported player special in this build carries, osrs_ags_spec included.
        check(`${nm} has special priority`, s.priority, 6);
        check(`${nm} walk-merges`, s.walkmerge !== null && s.walkmerge !== undefined, true);
    }
    for (const nm of ['dwh_spec', 'granite_hammer_spec', 'bludgeon_spec', 'dsword_spec']) {
        check(`spotanim ${nm} is in the build`, SpotanimType.getId(nm) !== -1, true);
    }
}

// ---------------------------------------------------------------------------------------------
console.log('\n== each special plays its own animation, and not the weapon\'s ordinary swing');
{
    for (const r of SPECS) {
        if (ObjType.getId(r.weapon) === -1) { check(`${r.weapon} exists`, false, true); continue; }
        const p = player(`spec_${r.weapon}`, 3250, 3250);
        H.clearInv(p);
        H.give(p, r.weapon);
        H.opheld(p, r.weapon, 2);
        H.tick(1);
        const npc = H.addNpc('slayer_gargoyle', p.x + 1, p.z);
        H.setVar(p, 'com_maxhit', 10);

        const mark = H.anims.length;
        pin(0.99);
        try {
            runSpec(r.label, npc, p);
            H.tick(1);
        } finally {
            pin(null);
        }
        const played = H.anims.slice(mark).filter(a => a.who === p.username).map(a => seqName(a.seq));
        check(`${r.weapon}: plays ${r.anim}`, played.includes(r.anim), true);

        // THE HALF THAT CAUGHT NOTHING BEFORE: the ordinary swing must not be what ran.
        const swings = r.ordinary.map(k => seqName(param(r.weapon, k) as number)).filter(s => s !== '-');
        const clash = swings.filter(s => played.includes(s));
        check(`${r.weapon}: does not play its ordinary swing (${swings.join('/')})`, clash, []);
        if (played.length === 0) console.log(`      (nothing played at all for ${r.weapon})`);
    }
}

// ---------------------------------------------------------------------------------------------
console.log('\n== and the dragon warhammer still takes 30% of the target\'s current Defence');
{
    // The animation change must not have disturbed the drain, which is the whole point of Smash.
    const p = player('dwh_drain', 3250, 3250);
    H.clearInv(p);
    H.give(p, 'dragon_warhammer');
    H.opheld(p, 'dragon_warhammer', 2);
    H.tick(1);
    const npc = H.addNpc('slayer_gargoyle', p.x + 1, p.z);
    H.setVar(p, 'com_maxhit', 20);

    const before = npc.levels[DEFENCE];
    pin(0.99);                                   // the accuracy roll lands on a HIGH pin
    try {
        runSpec('[label,pvm_dragon_warhammer_sa]', npc, p);
    } finally {
        pin(null);
    }
    const after = npc.levels[DEFENCE];
    check('defence is drained', after < before, true);
    check('by 30%, rounded down', before - after, Math.floor(before * 0.3));

    // Compounding: the second takes 30% of what is LEFT, not of the base.
    const mid = npc.levels[DEFENCE];
    pin(0.99);
    try {
        runSpec('[label,pvm_dragon_warhammer_sa]', npc, p);
    } finally {
        pin(null);
    }
    check('a second Smash compounds off the current level', mid - npc.levels[DEFENCE], Math.floor(mid * 0.3));
}

console.log(`\n${R.ok} ok, ${R.bad} failed`);
process.exit(R.bad ? 1 : 0);
