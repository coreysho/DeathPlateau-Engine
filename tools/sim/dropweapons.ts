// Four weapons off the drop tables, and the tarnished blade one of them starts as.
// Usage: npx tsx tools/sim/dropweapons.ts   (exit code is the verdict)
//
// WHAT THIS IS FOR, in the order of how badly it would hurt.
//
//   * THE DRAGON SWORD'S NUMBERS. fillosrsstats.py matched it to dragon_2h_sword as a repaint and
//     copied the two-hander's 92 slash, 93 strength and seven-tick swing onto a one-handed stab
//     sword. The config is right now; this is what stops it drifting back, and it is the reason
//     every bonus of all four is asserted against the cache's own number rather than spot-checked.
//   * THE DRAGON WARHAMMER WANTS STRENGTH, NOT ATTACK. The cache says so (param 434 names the
//     skill and 2 is Strength) and every other weapon in this file wants Attack, so it is exactly
//     the line somebody would "fix" later.
//   * SMASH COMPOUNDS. It takes 30% of the target's CURRENT Defence, so two specials leave 49%
//     rather than 40%. Writing it against the base level would look right in a single test.
//   * BELLE'S FOLLY IS TWO ITEMS. The polish has a Smithing requirement that is the only thing
//     standing between a 1/5,000 drop and the strongest melee weapon in the build.
import fs from 'fs';
import Environment from '#/util/Environment.js';
import * as H from './harness.ts';
import { check, R, player, useHeld, mesSince, mark } from './a1lib.ts';
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
const ATTACK = 0, STRENGTH = 2, SMITHING = 13, HITPOINTS = 3, DEFENCE = 1;

// ---------------------------------------------------------------------------------------------
// Every one of these is the OSRS item table's own number (objs 20756, 31248, 13576, 21009).
console.log('== the four weapons carry the cache\'s numbers, not a neighbour\'s');
{
    const WANT: Record<string, Record<string, number>> = {
        hill_giant_club: { stabattack: -4, slashattack: 50, crushattack: 65, magicattack: -4,
            rangedefence: -1, strengthbonus: 70, attackrate: 7 },
        belles_folly: { stabattack: 100, slashattack: 78, crushattack: -3, stabdefence: 20,
            slashdefence: 15, crushdefence: -9, strengthbonus: 102, attackrate: 5 },
        dragon_warhammer: { stabattack: -4, slashattack: -4, crushattack: 95, magicattack: -4,
            strengthbonus: 85, attackrate: 6 },
        dragon_sword: { stabattack: 65, slashattack: 55, crushattack: -2, slashdefence: 2,
            crushdefence: 1, strengthbonus: 63, attackrate: 4 }
    };
    for (const [obj, bonuses] of Object.entries(WANT)) {
        check(`${obj} exists`, ObjType.getId(obj) !== -1, true);
        for (const [p, v] of Object.entries(bonuses)) check(`${obj} ${p}`, param(obj, p), v);
    }
    // The club is the only two-hander of the four.
    check('the club is two-handed', ObjType.get(ObjType.getId('hill_giant_club')).wearpos2, 5);
    for (const obj of ['belles_folly', 'dragon_warhammer', 'dragon_sword']) {
        check(`${obj} is one-handed`, ObjType.get(ObjType.getId(obj)).wearpos2, -1);
    }
    // Belle's folly is the one with no special attack - Old School calls it the only one of its
    // family without one.
    check('Belle\'s folly claims no special', param('belles_folly', 'specwep'), undefined);
    check('the club claims no special', param('hill_giant_club', 'specwep'), undefined);
    check('the warhammer is a spec weapon', param('dragon_warhammer', 'specwep'), 1);
    check('Smash costs 50%', param('dragon_warhammer', 'sa_energy'), 500);
    check('the sword is a spec weapon', param('dragon_sword', 'specwep'), 1);
    check('Wild Stab costs 40%', param('dragon_sword', 'sa_energy'), 400);
}

// ---------------------------------------------------------------------------------------------
console.log('== the equip gates, and the one that is not Attack');
{
    const wields = (weapon: string, name: string, skill: number, level: number): boolean => {
        const p = player(name, 3250, 3250);
        H.clearInv(p);
        p.setLevel(skill, level);
        H.give(p, weapon);
        H.opheld(p, weapon, 2);
        H.tick(1);
        return H.invCount(p, weapon) === 0;
    };
    check('club: 39 Attack refused', wields('hill_giant_club', 'club39', ATTACK, 39), false);
    check('club: 40 Attack wields', wields('hill_giant_club', 'club40', ATTACK, 40), true);
    check('sword: 59 Attack refused', wields('dragon_sword', 'ds59', ATTACK, 59), false);
    check('sword: 60 Attack wields', wields('dragon_sword', 'ds60', ATTACK, 60), true);
    check('folly: 64 Attack refused', wields('belles_folly', 'bf64', ATTACK, 64), false);
    check('folly: 65 Attack wields', wields('belles_folly', 'bf65', ATTACK, 65), true);
    // STRENGTH, not Attack - and a maxed Attack must not let it through.
    check('warhammer: 59 Strength refused', wields('dragon_warhammer', 'dwh59', STRENGTH, 59), false);
    check('warhammer: 60 Strength wields', wields('dragon_warhammer', 'dwh60', STRENGTH, 60), true);
    {
        const p = player('dwh_attack_only', 3250, 3250);
        H.clearInv(p);
        p.setLevel(STRENGTH, 1);
        H.give(p, 'dragon_warhammer');
        H.opheld(p, 'dragon_warhammer', 2);
        H.tick(1);
        check('and 99 Attack with 1 Strength does not', H.invCount(p, 'dragon_warhammer'), 1);
    }
}

// ---------------------------------------------------------------------------------------------
console.log('== Smash takes 30% of what is left, and does it again');
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
    const p = player('dwh_smash', 3250, 3250);
    H.clearInv(p);
    H.give(p, 'dragon_warhammer');
    H.opheld(p, 'dragon_warhammer', 2);
    H.tick(1);
    // A gargoyle rather than a dragon: the King Black Dragon's 240 Defence beats a maxed
    // player's attack roll even with the roll pinned high, so the spec would always miss and
    // the test would pass for the wrong reason - a drain of nothing on a hit that never was.
    const npc = H.addNpc('slayer_gargoyle', p.x + 1, p.z);
    H.setVar(p, 'com_maxhit', 10);
    const before = npc.levels[DEFENCE];
    check('the target has a defence to drain', before > 10, true);
    pin(0.99);
    try {
        runSpec('[label,pvm_dragon_warhammer_sa]', npc, p);
        const once = npc.levels[DEFENCE];
        check('one Smash takes 30%', once, before - Math.floor(before * 0.3));
        runSpec('[label,pvm_dragon_warhammer_sa]', npc, p);
        const twice = npc.levels[DEFENCE];
        // 30% of what is LEFT, not another 30% of the base: compounding, not adding.
        check('a second takes 30% of the rest', twice, once - Math.floor(once * 0.3));
        check('which is not two flat thirties', twice !== before - 2 * Math.floor(before * 0.3), true);
    } finally {
        pin(null);
    }
    // A miss drains nothing - the drain is on damage DEALT, not on the swing.
    const q = player('dwh_miss', 3250, 3250);
    H.clearInv(q);
    H.give(q, 'dragon_warhammer');
    H.opheld(q, 'dragon_warhammer', 2);
    H.tick(1);
    const npc2 = H.addNpc('slayer_gargoyle', q.x + 1, q.z);
    H.setVar(q, 'com_maxhit', 10);
    const def2 = npc2.levels[DEFENCE];
    pin(0);
    try {
        runSpec('[label,pvm_dragon_warhammer_sa]', npc2, q);
    } finally {
        pin(null);
    }
    check('a missed Smash drains nothing', npc2.levels[DEFENCE], def2);
}

// ---------------------------------------------------------------------------------------------
console.log('== Belle\'s folly comes off the dragons tarnished, and a hammer finishes it');
{
    const t = ObjType.get(ObjType.getId('belles_folly_tarnished'));
    check('the tarnished blade cannot be worn', t.wearpos, -1);
    check('and has no combat bonuses', param('belles_folly_tarnished', 'strengthbonus'), undefined);

    const polish = (name: string, smithing: number): boolean => {
        const p = player(name, 3250, 3250);
        H.clearInv(p);
        p.setLevel(SMITHING, smithing);
        H.give(p, 'belles_folly_tarnished');
        H.give(p, 'hammer');
        useHeld(p, 'hammer', 'belles_folly_tarnished');
        H.tick(2);
        return H.invCount(p, 'belles_folly') === 1;
    };
    check('69 Smithing is refused', polish('bf_smith69', 69), false);
    check('70 Smithing polishes it', polish('bf_smith70', 70), true);
    {
        const p = player('bf_slot', 3250, 3250);
        H.clearInv(p);
        p.setLevel(SMITHING, 70);
        H.give(p, 'belles_folly_tarnished');
        H.give(p, 'hammer');
        useHeld(p, 'hammer', 'belles_folly_tarnished');
        H.tick(2);
        check('the tarnished blade is gone', H.invCount(p, 'belles_folly_tarnished'), 0);
        check('and the hammer is not', H.invCount(p, 'hammer'), 1);
    }
    {
        // Inspect answers rather than saying nothing, which is the whole reason it kept its op.
        const p = player('bf_inspect', 3250, 3250);
        H.clearInv(p);
        p.setLevel(SMITHING, 1);
        H.give(p, 'belles_folly_tarnished');
        const from = mark();
        H.opheld(p, 'belles_folly_tarnished', 1);
        H.tick(1);
        check('Inspect says what it needs', mesSince(p, from).some(m => m.includes('70')), true);
    }
}

// ---------------------------------------------------------------------------------------------
console.log('== and every drop is where it was asked for');
{
    const src = Environment.BUILD_SRC_DIR;
    const read = (f: string) => fs.readFileSync(`${src}/scripts/drop_tables/scripts/${f}.rs2`, 'ascii');
    const DRAGONS = ['black_dragon', 'blue_dragon', 'bronze_dragon', 'green_dragon', 'iron_dragon',
        'king_black_dragon', 'lava_dragon', 'red_dragon', 'steel_dragon'];
    for (const d of DRAGONS) {
        check(`${d} rolls the dragon sword`, read(d).includes('~dragon_sword_roll;'), true);
    }
    check('the hill giants drop the club', /random\(\^hill_giant_club_rate\) = 0\)[^}]*hill_giant_club/.test(read('giant')), true);
    check('the lava dragons drop the arkan blade', /random\(\^arkan_blade_rate\) = 0\)[^}]*arkan_blade/.test(read('lava_dragon')), true);
    for (const d of ['bronze_dragon', 'iron_dragon', 'steel_dragon']) {
        check(`${d} drops the tarnished blade`, read(d).includes('belles_folly_tarnished'), true);
    }
    check('the KBD drops the warhammer', read('king_black_dragon').includes('dragon_warhammer'), true);
    check('and the tarnished blade', read('king_black_dragon').includes('belles_folly_tarnished'), true);
    check('the Kalphite Queen drops the warhammer', read('kalphite_queen').includes('dragon_warhammer'), true);
    // The ladder has to be a ladder: harder dragon, better rate, no ties out of order.
    const consts = fs.readFileSync(`${src}/scripts/drop_tables/configs/drop_weapons.constant`, 'ascii');
    const rate = (n: string) => Number(consts.match(new RegExp(`\\^dsword_rate_${n} = (\\d+)`))![1]);
    const ladder = ['green', 'blue', 'bronze', 'red', 'black', 'iron', 'steel', 'lava', 'kbd'].map(rate);
    check('the ladder never gets worse as the dragon gets harder',
        ladder.every((v, i) => i === 0 || v <= ladder[i - 1]), true);
    check('and the top of it is Old School\'s own 1/2000', rate('kbd'), 2000);
}

console.log(`\n${R.ok} ok, ${R.bad} failed`);
process.exit(R.bad ? 1 : 0);
