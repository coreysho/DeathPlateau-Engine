// Two requested conveniences, on the real engine:
//
//   ring of recoil   a Check option, from the pack and from the finger, counting down the damage it
//                    can still recoil before it shatters
//   Ava's device     Toggle-attract, which stops the 3.5-minute armful of iron/steel and LEAVES THE
//                    AMMO SAVING ALONE - saving your own ammunition is the whole point of the thing
//
//   npx tsx tools/sim/qol.ts
import * as H from './harness.ts';
import * as A from './a1lib.ts';
import { check, R, player } from './a1lib.ts';
import InvType from '#/cache/config/InvType.js';
import ObjType from '#/cache/config/ObjType.js';
import VarPlayerType from '#/cache/config/VarPlayerType.js';

await H.boot();

const v = (p: any, name: string) => p.getVar(VarPlayerType.getByName(name)!.id);
const setv = (p: any, name: string, n: number) => p.setVar(VarPlayerType.getByName(name)!.id, n);
const last = (p: any) => A.lastMes(p);

// ------------------------------------------------------------------ ring of recoil
console.log('RING OF RECOIL');
{
    const p = player('recoil', 3200, 3200);
    H.give(p, 'ring_of_recoil', 1);

    A.runProcProtected(p, '[proc,ring_of_recoil_check]');
    check('  a fresh ring can recoil 40', last(p), 'Your Ring of Recoil can recoil 40 more damage before it shatters.');

    A.runProcProtected(p, '[proc,ring_of_recoil_lose_charge]', [12]);
    A.runProcProtected(p, '[proc,ring_of_recoil_check]');
    check('  after 12 damage, 28 left', last(p), 'Your Ring of Recoil can recoil 28 more damage before it shatters.');

    // the Check op itself, not just the proc behind it
    H.opheld(p, 'ring_of_recoil', 3);
    check('  the Check op reaches it', last(p), 'Your Ring of Recoil can recoil 28 more damage before it shatters.');

    // and it still shatters on the same number it counts down to
    H.equip(p, { ring: 'ring_of_recoil' });
    A.runProcProtected(p, '[proc,ring_of_recoil_lose_charge]', [28]);
    check('  it shatters at 40 recoiled', [last(p), p.getInventory(InvType.WORN)!.get(12) ?? null],
        ['Your Ring of Recoil has shattered.', null]);
    check('  and the counter is reset for the next one', v(p, 'ring_of_recoil'), 0);
    H.despawn(p);
}

// ------------------------------------------------------------------ Ava's attract toggle
console.log("AVA'S DEVICE");
{
    const p = player('ava', 3200, 3210);
    H.give(p, 'avas_accumulator', 1);

    // an untouched varp reads -1 here, not 0; what matters is that it is not TRUE, because that
    // is what the gate compares against - so a player who never touches this still attracts
    check('  attraction is on to begin with', v(p, 'avas_attract_off') === 1, false);
    H.opheld(p, 'avas_accumulator', 3);
    check('  Toggle-attract turns it off', [v(p, 'avas_attract_off'), last(p)],
        [1, "Your Ava's device will no longer attract metal items. It still saves your ammunition."]);
    H.opheld(p, 'avas_accumulator', 3);
    check('  and back on again', [v(p, 'avas_attract_off'), last(p)],
        [0, "Your Ava's device will attract metal items again."]);

    // the thing that must NOT change: the ammo saving
    H.equip(p, { back: 'avas_accumulator' });
    const saved = () => H.runProc(p, '[proc,ranged_ammo_saved]')[0];
    const onSaves = saved();
    setv(p, 'avas_attract_off', 1);
    check('  switching attraction off does not switch ammo saving off', [onSaves, saved()], [1, 1]);

    // and the thing that must: no metal arrives while it is off
    H.clearInv(p);
    setv(p, 'animmag_attract_clock', 1);
    setv(p, 'avas_attract_off', 1);
    for (let i = 0; i < 3; i++) A.runProcProtected(p, '[proc,avas_attract]');
    check('  nothing is attracted while it is off', H.invCount(p, 'steel_arrow') + H.invCount(p, 'iron_arrow'), 0);
    H.despawn(p);
}

console.log(`\n${R.ok} ok, ${R.bad} FAIL`);
process.exit(R.bad ? 1 : 0);
