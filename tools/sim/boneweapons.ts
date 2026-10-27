// The five Dorgeshuun bone weapons, Backstab and Snipe.
// Usage: npx tsx tools/sim/boneweapons.ts   (exit code is the verdict)
//
// WHAT THIS IS FOR.
//
//   * TWO OF THE FIVE WERE ALREADY IN THE GAME WITH NO STATS. The bone spear and the bone club
//     have been in the 377 cache since the mines were built, carried by the guards, with a model
//     and a name and not one bonus - so wielding the spear was worse than wielding nothing. A
//     weapon with no bonuses does not error and does not look broken.
//   * THE BONE DAGGER NEARLY SHIPPED AS A BRONZE DAGGER. fillosrsstats.py matched it as a repaint
//     and copied bronze's bonuses AND its poison chain, so poisoning a bone dagger would have
//     handed back a bronze dagger (p). The poison params are asserted absent here, not just the
//     numbers.
//   * BACKSTAB AND SNIPE CANNOT MISS against a monster at full health, and drain its Defence by
//     the damage dealt - ONCE. Both halves are forced: the roll is pinned to a certain miss and
//     the hit has to land anyway, and the drain is run twice to prove the second does nothing.
import fs from 'fs';
import Environment from '#/util/Environment.js';
import * as H from './harness.ts';
import { check, R, player } from './a1lib.ts';
import ObjType from '#/cache/config/ObjType.js';
import ParamType from '#/cache/config/ParamType.js';
import JavaRandom from '#/util/JavaRandom.js';
import ScriptProvider from '#/engine/script/ScriptProvider.js';
import ScriptRunner from '#/engine/script/ScriptRunner.js';
import ScriptPointer from '#/engine/script/ScriptPointer.js';
import Npc from '#/engine/entity/Npc.js';
import Player from '#/engine/entity/Player.js';

await H.boot();

const param = (objName: string, paramName: string): unknown => {
    const o = ObjType.get(ObjType.getId(objName)) as unknown as { params?: Map<number, unknown> };
    return o.params?.get(ParamType.getId(paramName));
};
const HITPOINTS = 3, DEFENCE = 1;

// ---------------------------------------------------------------------------------------------
console.log('== all five exist, and the two old ones finally have numbers');
{
    const WANT: Record<string, Record<string, number>> = {
        // OSRS objs 5016 and 5018: in the 377 cache all along, with nothing on them.
        cave_goblin_bone_spear: { stabattack: 11, slashattack: 11, crushattack: 11,
            stabdefence: 1, slashdefence: 1, strengthbonus: 13, attackrate: 6 },
        cave_goblin_bone_club: { stabattack: -4, slashattack: -4, crushattack: 16,
            magicattack: -4, strengthbonus: 15, attackrate: 6 },
        // OSRS obj 8872, and NOT bronze_dagger's 4/2/-4.
        bone_dagger: { stabattack: 5, slashattack: 3, crushattack: -4, magicattack: 1,
            magicdefence: 1, strengthbonus: 4, attackrate: 4 },
        dorgeshuun_crossbow: { rangeattack: 42, levelrequire: 28, attackrate: 5, attackrange: 7 },
        bone_bolts: { rangebonus: 49, levelrequire: 28 }
    };
    for (const [obj, bonuses] of Object.entries(WANT)) {
        check(`${obj} exists`, ObjType.getId(obj) !== -1, true);
        for (const [p, v] of Object.entries(bonuses)) check(`${obj} ${p}`, param(obj, p), v);
    }
    check('the spear is a spear', ObjType.get(ObjType.getId('cave_goblin_bone_spear')).category,
        ObjType.get(ObjType.getId('zamorakian_spear')).category);
    check('the crossbow is a crossbow', ObjType.get(ObjType.getId('dorgeshuun_crossbow')).category,
        ObjType.get(ObjType.getId('bronze_crossbow')).category);
    check('the bolts are bolts', ObjType.get(ObjType.getId('bone_bolts')).category,
        ObjType.get(ObjType.getId('mithril_bolts')).category);
    check('the bolts stack', ObjType.get(ObjType.getId('bone_bolts')).stackable, true);
}

// ---------------------------------------------------------------------------------------------
// The bone dagger is not a bronze dagger wearing a hat.
console.log('== and the dagger is not carrying bronze\'s poison chain');
{
    for (const p of ['weapon_poisoned', 'weapon_poisoned_plus', 'weapon_poisoned_plusplus',
        'weapon_poisoned_message']) {
        check(`bone_dagger has no ${p}`, param('bone_dagger', p), undefined);
    }
    check('and its bonuses are not bronze\'s',
        param('bone_dagger', 'stabattack') !== param('bronze_dagger', 'stabattack'), true);
}

// ---------------------------------------------------------------------------------------------
console.log('== Backstab and Snipe cost 75% and belong to those two alone');
{
    check('the dagger is a spec weapon', param('bone_dagger', 'specwep'), 1);
    check('at 75%', param('bone_dagger', 'sa_energy'), 750);
    check('the crossbow is a spec weapon', param('dorgeshuun_crossbow', 'specwep'), 1);
    check('at 75%', param('dorgeshuun_crossbow', 'sa_energy'), 750);
    check('the spear claims none', param('cave_goblin_bone_spear', 'specwep'), undefined);
    check('the club claims none', param('cave_goblin_bone_club', 'specwep'), undefined);
}

// ---------------------------------------------------------------------------------------------
console.log('== they cannot miss on a monster nobody has hurt, and drain it once');
{
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
    const armed = (name: string, weapon: string, target: string): [Player, Npc] => {
        const p = player(name, 3250, 3250);
        H.clearInv(p);
        H.give(p, weapon);
        H.opheld(p, weapon, 2);
        H.tick(1);
        const npc = H.addNpc(target, p.x + 1, p.z);
        H.setVar(p, 'com_maxhit', 12);
        return [p, npc];
    };

    const SPECS = [['bone_dagger', '[label,pvm_bone_dagger_sa]'],
        ['dorgeshuun_crossbow', '[label,pvm_dorgeshuun_crossbow_sa]']] as const;

    // CANNOT MISS is tested against the King Black Dragon on purpose. Its 240 Defence beats a
    // maxed player's attack roll even with the roll pinned as high as it goes - the dragon
    // warhammer's sim had to move off it for exactly that reason - so an ordinary special would
    // deal nothing here. Damage at all is the proof.
    for (const [weapon, label] of SPECS) {
        const [p, npc] = armed(`unhurt_${weapon}`, weapon, 'king_dragon');
        const hp = npc.levels[HITPOINTS];
        const def = npc.levels[DEFENCE];
        pin(0.99);
        try {
            runSpec(label, npc, p);
        } finally {
            pin(null);
        }
        // The drain happens inside the special; the damage is queued and lands a tick later. So
        // the Defence is read BEFORE ticking - a monster regenerates a drained stat, and three
        // ticks of that is enough to put a point back and make this look off by one.
        const drained = def - npc.levels[DEFENCE];
        H.tick(3);
        const dealt = hp - npc.levels[HITPOINTS];
        check(`${weapon}: lands on a target nothing else could hit`, dealt > 0, true);
        check(`${weapon}: and takes that much defence off`, drained, dealt);
    }

    // DRAINED ONCE. A gargoyle this time, so the ordinary roll connects and the only thing being
    // tested is Old School's "only if the target's Defence isn't already lowered".
    for (const [weapon, label] of SPECS) {
        const [p, npc] = armed(`twice_${weapon}`, weapon, 'slayer_gargoyle');
        const def = npc.levels[DEFENCE];
        pin(0.99);
        try {
            runSpec(label, npc, p);
            H.tick(3);
            const once = npc.levels[DEFENCE];
            check(`${weapon}: the first special drains`, once < def, true);
            runSpec(label, npc, p);
            H.tick(3);
            check(`${weapon}: the second does not`, npc.levels[DEFENCE], once);
        } finally {
            pin(null);
        }
    }
}

// ---------------------------------------------------------------------------------------------
console.log('== and the guards drop all five, which they never dropped anything before');
{
    const src = Environment.BUILD_SRC_DIR;
    const rs2 = fs.readFileSync(`${src}/scripts/drop_tables/scripts/cave_goblin_guard.rs2`, 'ascii');
    for (const npc of ['cave_goblin_guard1', 'cave_goblin_guard2']) {
        check(`${npc} has a table`, rs2.includes(`[ai_queue3,${npc}]`), true);
    }
    for (const obj of ['cave_goblin_bone_spear', 'cave_goblin_bone_club', 'bone_bolts',
        'bone_dagger', 'dorgeshuun_crossbow']) {
        check(`the table gives ${obj}`, rs2.includes(obj), true);
    }
    // The bolts come in a handful. Ammunition that drops one at a time is not ammunition.
    check('the bolts drop in a stack', /bone_bolts, ~random_range\(\d+, \d+\)/.test(rs2), true);
}

console.log(`\n${R.ok} ok, ${R.bad} failed`);
process.exit(R.bad ? 1 : 0);
