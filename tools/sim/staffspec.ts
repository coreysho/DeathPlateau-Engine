// POWER OF DEATH and POWER OF LIGHT - the staff of the dead's and the staff of light's special.
// Usage: npx tsx tools/sim/staffspec.ts   (exit code is the verdict)
//
// WHAT THIS IS FOR. The owner reported that neither staff shows a special attack at all. Two
// separate things were missing and NEITHER of them could error:
//
//   * combat_staff_2.if had no special attack bar - 474's interface 90 draws one, but
//     portcombat474.py deleted it because no 2008 staff had a special - and
//     ~update_weapon_category passed `null` where every other weapon category passes its own
//     specbar_layer. There was nothing to unhide and nothing to click.
//   * the staves carried no specwep and no sa_energy, and nothing implemented the effect.
//
// So this sim asserts the three things a reader cannot check by eye: that the bar EXISTS on the
// tab the staves use, that clicking it spends the energy and starts the minute, and that the
// minute actually halves a melee hit - in both the PvM funnel and the PvP path.
//
// The reduction is the half that matters. A special that reports "you feel protected" and then
// changes no incoming damage is exactly the failure the dragon warhammer's animation was: right
// name, right message, right energy bar, and nothing happening where it counts.
import * as H from './harness.ts';
import { check, R, player } from './a1lib.ts';
import ObjType from '#/cache/config/ObjType.js';
import ParamType from '#/cache/config/ParamType.js';
import Component from '#/cache/config/Component.js';
import SeqType from '#/cache/config/SeqType.js';
import SpotanimType from '#/cache/config/SpotanimType.js';
import ScriptProvider from '#/engine/script/ScriptProvider.js';
import ScriptRunner from '#/engine/script/ScriptRunner.js';
import ScriptPointer from '#/engine/script/ScriptPointer.js';
import World from '#/engine/World.js';
import Npc from '#/engine/entity/Npc.js';
import Player from '#/engine/entity/Player.js';
import Model from '#/cache/graphics/Model.js';
import { readFileSync, readdirSync } from 'fs';

await H.boot();

// What the content constant says, so a change there has to come through here too.
const GFX_HEIGHT = 96;

/** model.pack id -> name, for turning a spotanim's model id back into a file on disk. */
const MODEL_NAMES = new Map<number, string>(
    readFileSync('../content/pack/model.pack', 'utf8')
        .split('\n')
        .filter(l => l.includes('='))
        .map(l => [Number(l.slice(0, l.indexOf('='))), l.slice(l.indexOf('=') + 1).trim()] as [number, string])
);

/**
 * The vertical span of the model a spotanim draws, read with the engine's own .ob2 reader. y is
 * NEGATIVE UPWARD, so min is the highest point and max the lowest: a max above zero is a mesh that
 * hangs below the point it is drawn from, and is the whole reason a height exists.
 */
function modelSpan(gfx: string): { min: number; max: number } {
    const id = SpotanimType.get(SpotanimType.getId(gfx)).model;
    const name = MODEL_NAMES.get(id);
    if (!name) throw new Error(`model.pack has no name for model ${id} (${gfx})`);
    const dirs = readdirSync('../content/models', { withFileTypes: true }).filter(d => d.isDirectory());
    for (const d of dirs) {
        let raw;
        try {
            raw = readFileSync(`../content/models/${d.name}/${name}.ob2`);
        } catch {
            continue;
        }
        // id 0 is a scratch slot: nothing in a sim draws, so nothing else reads it back
        Model.unpack(0, new Uint8Array(raw));
        const m = Model.fromId(0);
        const ys = m.vertexY!;
        return { min: Math.min(...ys), max: Math.max(...ys) };
    }
    throw new Error(`no ${name}.ob2 under content/models`);
}

const param = (obj: string, key: string): unknown => (ObjType.get(ObjType.getId(obj)) as unknown as { params?: Map<number, unknown> }).params?.get(ParamType.getId(key));
// All four: the staff of the dead, the staff of light, and the toxic staff of the dead charged
// and uncharged - a fang on a staff of the dead takes neither its blade nor its special off it.
const STAVES = ['staff_of_the_dead', 'staff_of_light', 'toxic_staff_of_the_dead', 'toxic_staff_uncharged'];

/** The npc->player melee funnel, with the protected pointer it needs to write %npc_action_delay. */
const hitPlayer = (npc: Npc, p: Player, damage: number, maxhit: number) => {
    const script = ScriptProvider.getByName('[proc,playerhit_n_melee_max]')!;
    const state = ScriptRunner.init(script, npc, p, [damage, maxhit, 4]);
    state.pointerAdd(ScriptPointer.ProtectedActivePlayer);
    ScriptRunner.execute(state);
};
/** What a melee hit of `damage` actually lands on the player, after everything in the funnel. */
const landed = (npc: Npc, p: Player, damage: number): number => {
    const mark = H.hits.length;
    hitPlayer(npc, p, damage, damage);
    H.tick(2);
    const mine = H.hits.slice(mark).filter(h => h.who === p.username);
    return mine.reduce((a, h) => a + h.damage, 0);
};

// ---------------------------------------------------------------------------------------------
console.log('== both staves are special attack weapons');
{
    for (const s of STAVES) {
        check(`${s}: exists`, ObjType.getId(s) !== -1, true);
        check(`${s}: carries specwep`, param(s, 'specwep'), 1);
        // 100% of the bar: "uses 100% of the player's special attack energy"
        check(`${s}: costs the whole bar`, param(s, 'sa_energy'), 1000);
    }
}

// ---------------------------------------------------------------------------------------------
console.log("\n== the staves' tab has a bar, and it is the same one every other tab has");
{
    // THE DEFECT: no staff tab had either of these, so there was nothing to show and nothing to
    // click. combat_bladed_staff is the tab the two staves are shown now (they moved to
    // weapon_bladed_staff for Jab/Swipe/Fend - see bladedstaff.ts); combat_staff_2 keeps a bar of
    // its own, wired to the same handler, for the day a plain staff gets a special.
    for (const com of ['combat_bladed_staff:specbar_layer', 'combat_bladed_staff:specbar', 'combat_staff_2:specbar_layer', 'combat_staff_2:specbar']) {
        check(`${com} is on the tab`, Component.getId(com) !== -1, true);
    }
    const mine = Component.getId('combat_bladed_staff:specbar_layer');
    const theirs = Component.getId('combat_blunt:specbar_layer');
    if (mine !== -1 && theirs !== -1) {
        const a = Component.get(mine);
        const b = Component.get(theirs);
        // transplanted from combat_blunt.if, so it is the blunt tab's bar to the pixel (x and y
        // do not survive Component's parse, so its size is as close as this can get)
        check("the blunt tab's size", [a.width, a.height], [b.width, b.height]);
        // hidden by default: ~weapon_category_tab_attack unhides it only for a specwep weapon
        check('hidden until a special weapon is held', a.hide, true);
    }
    // and both clicks have a handler, which ifButton will not find if a trigger is missing
    for (const tab of ['combat_bladed_staff', 'combat_staff_2']) {
        check(`${tab}'s bar has an if_button`, ScriptProvider.getByName(`[if_button,${tab}:specbar]`) !== null, true);
    }
}

// ---------------------------------------------------------------------------------------------
console.log('\n== clicking it spends the whole bar and starts the minute');
{
    for (const s of STAVES) {
        const p = player(`spec_${s}`, 3250, 3250);
        H.clearInv(p);
        H.give(p, s);
        H.opheld(p, s, 2); // wield
        H.tick(1);
        check(`${s}: wielded`, H.invCount(p, s), 0);

        H.setVar(p, 'sa_energy', 1000);
        H.setVar(p, 'sotd_spec', 0);
        const mark = H.mesgs.length;
        const at = World.currentTick;
        H.ifButton(p, 'combat_bladed_staff:specbar');
        H.tick(1);

        check(`${s}: the bar is empty`, H.getVar(p, 'sa_energy'), 0);
        // one minute, measured the way %action_delay is
        check(`${s}: the minute is running`, H.getVar(p, 'sotd_spec') > at, true);
        check(`${s}: ...and it is 100 ticks`, H.getVar(p, 'sotd_spec') - at, 100);
        const said = H.mesgs
            .slice(mark)
            .filter(m => m.who === p.username)
            .map(m => m.text);
        check(
            `${s}: says so`,
            said.some(t => t.includes('Spirits of deceased evildoers')),
            true
        );
    }
}

// ---------------------------------------------------------------------------------------------
console.log('\n== each staff plays ITS OWN special, on itself, standing clear of the floor');
{
    // THE HALF THAT WAS REPORTED. Everything below this was already asserted - the energy, the
    // clock, the halving - and none of it says what the special looks like, which is the only
    // thing a player sees. From the beta-world dump (rune-server 697435):
    //
    //     staff of the dead / toxic staff   special attack anim: 7083  gfx: 1228
    //     staff of light                    special attack anim: 7967  gfx: 1516
    //
    // The staff of light having its OWN pair is the part worth a test: one shared animation is the
    // plausible reading, it is wrong, and "it plays something" would pass on it. Before this the
    // special played Excalibur's blue glow on every one of them.
    const seqName = (id: number): string => (id >= 0 ? (SeqType.get(id)?.debugname ?? `seq_${id}`) : '-');
    const want: Record<string, [string, string]> = {
        staff_of_the_dead: ['osrs_sotd_spec', 'sotd_spec_gfx'],
        toxic_staff_of_the_dead: ['osrs_sotd_spec', 'sotd_spec_gfx'],
        toxic_staff_uncharged: ['osrs_sotd_spec', 'sotd_spec_gfx'],
        staff_of_light: ['osrs_sol_spec', 'sol_spec_gfx']
    };
    for (const s of STAVES) {
        const [anim, gfx] = want[s];
        const p = player(`gfx_${s}`, 3254, 3254);
        H.setVar(p, 'tutorial', 1000);
        H.clearInv(p);
        H.give(p, s);
        H.opheld(p, s, 2);
        H.tick(1);
        H.setVar(p, 'sa_energy', 1000);
        H.setVar(p, 'sotd_spec', 0);

        const mark = H.anims.length;
        H.ifButton(p, 'combat_bladed_staff:specbar');
        // read before the tick: PathingEntity clears spotanimId at the end of one
        const onPlayer = { id: p.spotanimId, height: p.spotanimHeight };
        H.tick(1);

        const played = H.anims
            .slice(mark)
            .filter(a => a.who === p.username)
            .map(a => seqName(a.seq));
        check(`${s}: plays ${anim}`, played.includes(anim), true);
        // on the player: the dump says plain "gfx", not "enemy entity gfx", and this is a self-buff
        check(`${s}: throws ${gfx}`, onPlayer.id, SpotanimType.getId(gfx));
        check(`${s}: at ${GFX_HEIGHT}`, onPlayer.height, GFX_HEIGHT);

        // AND THE HEIGHT IS CHECKED AGAINST THE MODEL, not just against itself. "Height 0" was a
        // number too, and it sat in this file passing for as long as the special existed: what
        // makes a height right is where the MESH is, and model 6737 hangs from its origin. Below
        // is how much of it ends up under the floor; above is what a player can see. More under
        // than over is the bug the owner photographed - a smudge around the shins and nothing else.
        const span = modelSpan(gfx);
        const above = onPlayer.height - span.min; // y is negative upward, so this is the visible part
        const below = span.max - onPlayer.height;
        check(`${s}: ${gfx} hangs below its origin`, span.max > 0, true);
        check(`${s}: more of it is above the floor than below`, above > below, true);
    }
    // ...and the two are genuinely different animations, not one name twice
    check("the staff of light's special is not the dead's", SeqType.getId('osrs_sol_spec') === SeqType.getId('osrs_sotd_spec'), false);
}

// ---------------------------------------------------------------------------------------------
console.log('\n== and it says so when the minute runs out');
{
    // "when special fades green game msg: Your protection fades away." Nothing was watching the
    // minute end before - the halving just stopped reading true - so there was nothing that could
    // have said it.
    const p = player('sotd_fade', 3256, 3256);
    H.setVar(p, 'tutorial', 1000);
    H.clearInv(p);
    H.give(p, 'staff_of_the_dead');
    H.opheld(p, 'staff_of_the_dead', 2);
    H.tick(1);
    H.setVar(p, 'sa_energy', 1000);
    H.setVar(p, 'sotd_spec', 0);

    const mark = H.mesgs.length;
    H.ifButton(p, 'combat_bladed_staff:specbar');
    H.tick(5);
    const early = H.mesgs
        .slice(mark)
        .filter(m => m.who === p.username)
        .map(m => m.text);
    check(
        'nothing fades five ticks in',
        early.some(t => t.includes('fades away')),
        false
    );

    H.tick(100);
    const late = H.mesgs
        .slice(mark)
        .filter(m => m.who === p.username)
        .map(m => m.text);
    check('it fades at the minute', late.filter(t => t.includes('fades away')).length, 1);
    check('and the clock is cleared', H.getVar(p, 'sotd_spec'), 0);
}

// ---------------------------------------------------------------------------------------------
console.log('\n== and the minute halves a melee hit: npc -> player');
{
    // THE HALF THAT MATTERS. Every melee hit on a player comes through this proc - Barrows, the
    // Fight Cave and the quest bosses all reach it through ~playerhit_n_melee - so a 20 going in
    // is a 10 coming out while the spec is up, and a 20 when it is not.
    const p = player('sotd_halve', 3252, 3252);
    H.maxOut(p);
    // PAST THE TUTORIAL, which a sim player is not by default. appearance.rs2's ~update_all only
    // calls ~update_weapon_category when %tutorial is past 400, so without this a wield changes
    // the worn slot and the bonuses but never touches the combat tab - and ~sotd_spec_drop, which
    // hangs off that proc, would read as broken on a build where it works.
    H.setVar(p, 'tutorial', 1000);
    H.clearInv(p);
    H.give(p, 'staff_of_the_dead');
    H.opheld(p, 'staff_of_the_dead', 2);
    H.tick(1);
    const npc = H.addNpc('slayer_gargoyle', p.x + 1, p.z);

    H.setVar(p, 'sotd_spec', 0);
    check('without it, a 20 lands as 20', landed(npc, p, 20), 20);

    H.setVar(p, 'sotd_spec', World.currentTick + 100);
    check('with it, a 20 lands as 10', landed(npc, p, 20), 10);
    // rounded down, as every other reduction in this build is
    check('and a 7 lands as 3', landed(npc, p, 7), 3);

    // THE STAFF HAS TO BE IN YOUR HAND: "the effect is immediately lost if players unequip the
    // staff". ~sotd_spec_drop is what zeroes the clock on a weapon change, and ~sotd_spec_active
    // checks the hand as well, so a staff that left by some other road also stops it.
    //
    // A REAL WIELD, not H.equip: that writes the worn inventory straight and never runs the equip
    // path, so ~update_weapon_category - which is where the drop hangs - would not be called and
    // this would pass on a build where nothing dropped anything.
    H.setVar(p, 'sotd_spec', World.currentTick + 100);
    H.give(p, 'rune_scimitar');
    H.opheld(p, 'rune_scimitar', 2);
    H.tick(1);
    check('the staff is back in the pack', H.invCount(p, 'staff_of_the_dead'), 1);
    check('swapping the staff out drops the minute', H.getVar(p, 'sotd_spec'), 0);
    check('...so a 20 lands as 20 again', landed(npc, p, 20), 20);

    // an expired clock is not a live one
    H.opheld(p, 'staff_of_the_dead', 2);
    H.tick(1);
    H.setVar(p, 'sotd_spec', World.currentTick);
    check('an expired minute does nothing', landed(npc, p, 20), 20);
}

// ---------------------------------------------------------------------------------------------
console.log('\n== and the PvP half reads it off the DEFENDER');
{
    // In PvP the attacker's script rolls the damage, so the reduction belongs to the other player
    // and is read with the `.` prefix - the same shape ~.check_protect_prayer already has in
    // pvp_melee.rs2. Getting the prefix wrong would read the ATTACKER's clock, which is the kind
    // of mistake that works perfectly in every test where both players have the staff.
    const atk = player('sotd_atk', 3260, 3260);
    const def = player('sotd_def', 3261, 3260);
    for (const q of [atk, def]) {
        H.clearInv(q);
    }
    H.equip(def, { rhand: 'staff_of_the_dead' });
    H.tick(1);

    H.setVar(def, 'sotd_spec', 0);
    H.setVar(atk, 'sotd_spec', World.currentTick + 100);
    check("the attacker's own minute does not protect the defender", H.runProc(atk, '[proc,.sotd_spec_active]', [], def)[0], 0);

    H.setVar(def, 'sotd_spec', World.currentTick + 100);
    check("the defender's does", H.runProc(atk, '[proc,.sotd_spec_active]', [], def)[0], 1);

    // and it wants the staff in the defender's hand, not the attacker's
    H.equip(def, { rhand: 'rune_scimitar' });
    H.equip(atk, { rhand: 'staff_of_the_dead' });
    H.tick(1);
    check('...and only while the defender holds the staff', H.runProc(atk, '[proc,.sotd_spec_active]', [], def)[0], 0);
}

console.log(`\n${R.ok} ok, ${R.bad} failed`);
process.exit(R.bad ? 1 : 0);
