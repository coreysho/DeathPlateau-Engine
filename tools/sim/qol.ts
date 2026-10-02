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
// ------------------------------------------------------------------ Break
console.log('BREAKING THE RING');
{
    const p = player('recoil2', 3202, 3200);
    H.give(p, 'ring_of_recoil', 2);
    A.runProcProtected(p, '[proc,ring_of_recoil_lose_charge]', [33]);
    // The warning is a ~mesbox: an interface, not a chat line, so A.said cannot see it. drive() reads
    // interface text but only from where IT starts, and opheld has already put the box up by then -
    // so take the mark before the click.
    const from = H.ifaces.length;
    H.opheld(p, 'ring_of_recoil', 4);   // Break
    A.drive(p, [2]);                    // "Keep it."
    const shown = H.ifaces.slice(from).filter(i => i.who === p.username && i.kind === 'text' && i.text).map(i => i.text!);
    check('  keeping it changes nothing', [H.invCount(p, 'ring_of_recoil'), v(p, 'ring_of_recoil')], [2, 33]);
    check('  and it says what you would lose first', A.saw(shown, 'recoil 7 more damage'), true);

    H.opheld(p, 'ring_of_recoil', 4);
    A.drive(p, [1]);                    // "Break the ring of recoil."
    check('  breaking one takes exactly one ring', H.invCount(p, 'ring_of_recoil'), 1);
    check('  and the charge is reset to full', v(p, 'ring_of_recoil'), 0);
    A.runProcProtected(p, '[proc,ring_of_recoil_check]');
    check('  the one left reads 40 again', last(p), 'Your Ring of Recoil can recoil 40 more damage before it shatters.');
    H.despawn(p);
}

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
    // ~ranged_ammo_saved is a ROLL, not a state - an accumulator keeps about 72% of shots. Comparing
    // two single calls compares two coin flips, which is what the first version of this did and why
    // it passed by luck. Measure the rate on both sides of the toggle instead.
    const rate = () => {
        let kept = 0;
        for (let i = 0; i < 2000; i++) kept += H.runProc(p, '[proc,ranged_ammo_saved]')[0];
        return kept / 2000;
    };
    setv(p, 'avas_attract_off', 0);
    const on = rate();
    setv(p, 'avas_attract_off', 1);
    const off = rate();
    check(`  the device saves ammo either way (${(on * 100).toFixed(0)}% on, ${(off * 100).toFixed(0)}% off)`,
        on > 0.6 && off > 0.6 && Math.abs(on - off) < 0.08, true);

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
