// The gargoyles' two granite weapons: the hammer and the longsword.
// Usage: npx tsx tools/sim/granite.ts   (exit code is the verdict)
//
// WHAT THIS IS FOR. Three things, in order of how badly they would hurt.
//
//   * HAMMER BLOW'S FIVE LANDS ON A MISS. Every other special in this build adds its damage
//     inside the roll, so the natural way to write this one is the wrong way, and the difference
//     is invisible in play without counting hundreds of specs. The roll is pinned both ways here
//     and the target's hitpoints are read back.
//   * A WEAPON WITH NO EQUIP REQUIREMENT. The generic [opheld2,_] checks no stats at all, so an
//     imported weapon is wieldable at level 1 until something gates it, and nothing errors.
//   * THE DROP RATES. They are read out of the script and out of the generated table, because a
//     1/750 roll cannot be measured by killing things in a test - and because the two numbers
//     have to agree with each other.
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

// ---------------------------------------------------------------------------------------------
// Both records are the OSRS cache's own (objs 21742 and 21646), read by fillosrsstats.py.
console.log('== the hammer is the cache\'s hammer');
{
    check('exists', ObjType.getId('granite_hammer') !== -1, true);
    check('crush attack', param('granite_hammer', 'crushattack'), 57);
    check('strength', param('granite_hammer', 'strengthbonus'), 56);
    check('magic attack', param('granite_hammer', 'magicattack'), -3);
    check('range attack', param('granite_hammer', 'rangeattack'), -1);
    // Four ticks is the whole reason to carry it over a rune warhammer at six.
    check('four ticks', param('granite_hammer', 'attackrate'), 4);
    check('no defensive bonus', param('granite_hammer', 'stabdefence'), undefined);
    const o = ObjType.get(ObjType.getId('granite_hammer'));
    check('one-handed', [o.wearpos, o.wearpos2], [3 /* righthand */, -1]);
    check('blunt', o.category, ObjType.get(ObjType.getId('rune_warhammer')).category);
    check('tradeable', o.tradeable, true);
}

console.log('== and the longsword is the cache\'s longsword');
{
    check('exists', ObjType.getId('granite_longsword') !== -1, true);
    check('stab attack', param('granite_longsword', 'stabattack'), 56);
    check('slash attack', param('granite_longsword', 'slashattack'), 65);
    check('crush attack', param('granite_longsword', 'crushattack'), -2);
    check('strength', param('granite_longsword', 'strengthbonus'), 62);
    check('five ticks, as every longsword', param('granite_longsword', 'attackrate'), 5);
    const o = ObjType.get(ObjType.getId('granite_longsword'));
    check('one-handed', [o.wearpos, o.wearpos2], [3, -1]);
    check('slash', o.category, ObjType.get(ObjType.getId('rune_longsword')).category);
    // Old School calls it the only granite weapon without a special attack.
    check('claims no special attack', param('granite_longsword', 'specwep'), undefined);
}

// ---------------------------------------------------------------------------------------------
console.log('== 50 Attack and 50 Strength, and both halves are checked, for both weapons');
{
    const ATTACK = 0, STRENGTH = 2;
    // a1lib's player() maxes every stat, so each of these is a maxed player turned back DOWN -
    // which is also the only way to be sure the gate reads the base level and not a boosted one.
    const wields = (weapon: string, name: string, att: number, str: number): boolean => {
        const p = player(name, 3250, 3250);
        H.clearInv(p);
        p.setLevel(ATTACK, att);
        p.setLevel(STRENGTH, str);
        H.give(p, weapon);
        H.opheld(p, weapon, 2);
        H.tick(1);
        return H.invCount(p, weapon) === 0;        // it left the pack, so it went on
    };
    for (const w of ['granite_hammer', 'granite_longsword']) {
        check(`${w}: 49 Attack is refused`, wields(w, `${w}_a49`, 49, 99), false);
        check(`${w}: 49 Strength is refused`, wields(w, `${w}_s49`, 99, 49), false);
        check(`${w}: 50 and 50 wields it`, wields(w, `${w}_both`, 50, 50), true);
    }
}

// ---------------------------------------------------------------------------------------------
console.log('== Hammer Blow costs 60% and is wired to the hammer alone');
{
    check('the hammer is a spec weapon', param('granite_hammer', 'specwep'), 1);
    check('60% of the bar', param('granite_hammer', 'sa_energy'), 600);
    check('the pvm label exists', H.hasScript('[label,pvm_granite_hammer_sa]'), true);
    check('and the pvp one', H.hasScript('[label,pvp_granite_hammer_sa]'), true);
}

// ---------------------------------------------------------------------------------------------
// random(n) is floor(nextDouble() * n) and randominc(n) is floor(nextDouble() * (n + 1)), so one
// pinned nextDouble decides the whole special: 0 makes the attack roll tie the defence roll,
// which ~pvm_spec_roll counts as a miss, and 0.99 makes it beat it.
console.log('== the five lands whether the roll connects or not');
{
    const origND = JavaRandom.nextDouble.bind(JavaRandom);
    const pin = (v: number | null) => {
        (JavaRandom as unknown as { nextDouble: () => number }).nextDouble = v === null ? origND : () => v;
    };
    const MAXHIT = 20;
    const HITPOINTS = 3;

    // The spec writes %sa_energy, which the engine will not let an unprotected script touch, and
    // it needs the npc active at the same time - so neither runProc nor runNpcProc will do.
    const runSpec = (npc: Npc, p: Player) => {
        const script = ScriptProvider.getByName('[label,pvm_granite_hammer_sa]')!;
        const state = ScriptRunner.init(script, npc, p, []);
        state.pointerAdd(ScriptPointer.ProtectedActivePlayer);
        ScriptRunner.execute(state);
    };

    const spec = (name: string, roll: number, npcName = 'slayer_gargoyle'): number => {
        const p = player(name, 3250, 3250);
        H.clearInv(p);
        H.give(p, 'granite_hammer');
        H.opheld(p, 'granite_hammer', 2);
        H.tick(1);
        const npc = H.addNpc(npcName, p.x + 1, p.z);
        H.setVar(p, 'com_maxhit', MAXHIT);
        // Read the level back rather than setting one: a monster above its base regenerates
        // DOWNWARDS a point at a time, which reads as damage the spec never dealt.
        const before = npc.levels[HITPOINTS];
        pin(roll);
        try {
            runSpec(npc, p);
        } finally {
            pin(null);
        }
        H.tick(3);                                  // npc_queue(2, damage, 0) lands on a later tick
        return before - npc.levels[HITPOINTS];
    };

    check('a missed Hammer Blow still takes five', spec('gh_miss', 0), 5);
    check('a landed one takes the roll and five', spec('gh_hit', 0.99), MAXHIT + 5);

    // The one exception. A kurask takes nothing from anything but a leaf-bladed weapon, and
    // ~pvm_spec_roll zeroes the damage for it - so the five has to be withheld too, or Hammer
    // Blow would be the only way in the game to kill one with the wrong weapon.
    check('a kurask takes nothing, not even the five', spec('gh_kurask', 0.99, 'slayer_kursk_1'), 0);
}

// ---------------------------------------------------------------------------------------------
console.log('== and the two drops are on the gargoyle, at the rates Old School gives them');
{
    const src = Environment.BUILD_SRC_DIR;
    const rs2 = fs.readFileSync(`${src}/scripts/drop_tables/scripts/gargoyle.rs2`, 'ascii');
    // 1/750 is the Grotesque Guardians' rate for the hammer; 1/512 the Wyvern Cave's for the
    // longsword. Neither source exists in a 377 cache, so both hang off the gargoyle.
    check('the hammer rolls 1/750', /random\(750\) = 0\) \{\s*obj_add\(npc_coord, granite_hammer,/.test(rs2), true);
    check('the longsword rolls 1/512', /random\(512\) = 0\) \{\s*obj_add\(npc_coord, granite_longsword,/.test(rs2), true);
    check('both are logged', (rs2.match(/collection_log_add\(granite_(hammer|longsword)/g) ?? []).length, 2);

    // The generated table is what the npc browser shows; its rarities are the whole table's, after
    // the two new early returns have taken their share, so they are not 1/750 and 1/512 exactly.
    const rows = fs.readFileSync(`${src}/scripts/drop_tables/configs/npc_drops.dbrow`, 'ascii').split(/\r?\n/);
    const i = rows.indexOf('[npc_drops_slayer_gargoyle]');
    const block = rows.slice(i, rows.indexOf('', i + 60) + 1);
    check('the browser lists the hammer', block.some(l => l.startsWith('data=drop,granite_hammer,')), true);
    check('and the longsword', block.some(l => l.startsWith('data=drop,granite_longsword,')), true);
}

console.log(`\n${R.ok} ok, ${R.bad} failed`);
process.exit(R.bad ? 1 : 0);
