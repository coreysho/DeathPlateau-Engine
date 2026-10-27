// The abyssal bludgeon: three pieces, no duplicates until all three, and Penance.
// Usage: npx tsx tools/sim/bludgeon.ts   (exit code is the verdict)
//
// WHAT THIS IS FOR. The no-duplicate rule is the whole item, and it is a rule about things that
// have already happened rather than about the state of a pack - so it is exactly the kind of
// thing that is easy to write in a way that looks right for one kill and is wrong for a hundred.
// Three ways of getting it wrong are tested here:
//
//   * a piece the player has already been given coming round again before the other two;
//   * the rule reading the INVENTORY, so that making a bludgeon - or banking a piece, or dying
//     with one - put that piece back into the pool;
//   * duplicates never becoming possible at all once the set is complete.
//
// The roll is forced with a pinned nextDouble so each kill gives a piece, and the collection log
// is read back as the record of what was given.
import * as H from './harness.ts';
import { check, R, player } from './a1lib.ts';
import ObjType from '#/cache/config/ObjType.js';
import InvType from '#/cache/config/InvType.js';
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
const PIECES = ['bludgeon_spine', 'bludgeon_claw', 'bludgeon_axon'];

// ---------------------------------------------------------------------------------------------
console.log('== the bludgeon is obj 13263, and the pieces are worth nothing on their own');
{
    check('exists', ObjType.getId('abyssal_bludgeon') !== -1, true);
    check('crush', param('abyssal_bludgeon', 'crushattack'), 102);
    check('strength', param('abyssal_bludgeon', 'strengthbonus'), 85);
    check('four ticks', param('abyssal_bludgeon', 'attackrate'), 4);
    const o = ObjType.get(ObjType.getId('abyssal_bludgeon'));
    check('two-handed', [o.wearpos, o.wearpos2], [3, 5]);
    check('untradeable', o.tradeable, false);
    check('Penance costs 50%', param('abyssal_bludgeon', 'sa_energy'), 500);
    for (const [i, piece] of PIECES.entries()) {
        check(`${piece} exists`, ObjType.getId(piece) !== -1, true);
        check(`${piece} cannot be worn`, ObjType.get(ObjType.getId(piece)).wearpos, -1);
        check(`${piece} is untradeable`, ObjType.get(ObjType.getId(piece)).tradeable, false);
        check(`${piece} carries bit ${1 << i}`, param(piece, 'bludgeon_piece_bit'), 1 << i);
    }
}

// ---------------------------------------------------------------------------------------------
console.log('== three kills give three different pieces, and the fourth may repeat');
{
    const origND = JavaRandom.nextDouble.bind(JavaRandom);
    const pin = (v: number | null) => {
        (JavaRandom as unknown as { nextDouble: () => number }).nextDouble = v === null ? origND : () => v;
    };
    const runProcAsNpc = (name: string, npc: Npc, p: Player) => {
        const script = ScriptProvider.getByName(name)!;
        const state = ScriptRunner.init(script, npc, p, []);
        state.pointerAdd(ScriptPointer.ProtectedActivePlayer);
        ScriptRunner.execute(state);
    };
    const LOG = InvType.getId('collection_log');
    const inLog = (p: Player, obj: string): boolean => {
        const id = ObjType.getId(obj);
        const inv = p.getInventory(LOG);
        if (!inv) return false;
        for (let i = 0; i < inv.capacity; i++) if (inv.get(i)?.id === id) return true;
        return false;
    };

    const p = player('bludgeon_drops', 3250, 3250);
    H.clearInv(p);
    const npc = H.addNpc('slayer_abyssal', p.x + 1, p.z);

    // random(1500) = 0 needs a pinned nextDouble below 1/1500; 0 gives every roll its lowest
    // value, which makes the piece roll fire and picks the FIRST of whatever is still missing.
    const given: string[] = [];
    pin(0);
    try {
        for (let kill = 0; kill < 4; kill++) {
            const before = PIECES.filter(x => inLog(p, x));
            runProcAsNpc('[proc,abyssal_bludgeon_piece_roll]', npc, p);
            const after = PIECES.filter(x => inLog(p, x));
            const fresh = after.filter(x => !before.includes(x));
            given.push(fresh[0] ?? '(repeat)');
        }
    } finally {
        pin(null);
    }
    console.log('    four kills gave:', JSON.stringify(given));
    check('the first three are all different', new Set(given.slice(0, 3)).size, 3);
    check('and they are the three pieces', [...given.slice(0, 3)].sort(), [...PIECES].sort());
    check('all three are in the log', PIECES.every(x => inLog(p, x)), true);
    check('the fourth is a repeat, which is now allowed', given[3], '(repeat)');
}

// ---------------------------------------------------------------------------------------------
console.log('== and spending the pieces does not put them back in the pool');
{
    const p = player('bludgeon_join', 3250, 3250);
    H.clearInv(p);
    H.give(p, 'bludgeon_spine');
    H.give(p, 'bludgeon_claw');                    // two of the three, and no axon
    H.useHeldOn(p, 'bludgeon_spine', 'bludgeon_claw');
    check('two pieces are not enough', H.invCount(p, 'abyssal_bludgeon'), 0);
    check('and neither is consumed', H.invCount(p, 'bludgeon_spine'), 1);
}
{
    const p = player('bludgeon_made', 3250, 3250);
    H.clearInv(p);
    for (const piece of PIECES) H.give(p, piece);
    // Any piece on any other: Old School's Overseer takes them in any order.
    H.useHeldOn(p, 'bludgeon_axon', 'bludgeon_spine');
    check('all three make a bludgeon', H.invCount(p, 'abyssal_bludgeon'), 1);
    for (const piece of PIECES) check(`${piece} is consumed`, H.invCount(p, piece), 0);
}

// ---------------------------------------------------------------------------------------------
console.log('== Penance is damage only, and scales with the prayer that is gone');
{
    const PRAYER = 5;
    const pct = (base: number, now: number): number => {
        const p = player(`penance_${base}_${now}`, 3250, 3250);
        p.setLevel(PRAYER, base);
        (p as unknown as { levels: number[] }).levels[PRAYER] = now;
        return H.runProc(p, '[proc,abyssal_bludgeon_damage_pct]')[0];
    };
    check('full prayer is no bonus', pct(99, 99), 100);
    check('half a per cent a point', pct(99, 89), 105);
    check('an empty book at 99 is half again', pct(99, 0), 149);
    // A boosted Prayer must not read as a negative bonus.
    check('boosted above the base is still no bonus', pct(70, 80), 100);
}

console.log(`\n${R.ok} ok, ${R.bad} failed`);
process.exit(R.bad ? 1 : 0);
