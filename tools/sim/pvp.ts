// PvP consumption and switching, against Old School's rules - run with `npx tsx tools/sim/pvp.ts`.
//
//   potions      one per 3 ticks, on their own timer; no attack delay
//   combo eat    shark, brew, karambwan in ONE tick; karambwan first blocks the shark; two
//                karambwans in a tick do not go; attack delay 3 + 2 = 5 for shark + karambwan
//   brew         +2 +15% base Hitpoints (99 -> 115), +2 +20% base Defence, -2 -10% current
//                Attack/Strength/Magic/Ranged (https://oldschool.runescape.wiki/w/Saradomin_brew)
//   equip slots  a replaced item takes the slot of the item that replaced it; a 2h knocks the
//                shield to the first free slot; a shield put on over a 2h puts the 2h where it was
//   switching    eight items equipped in one tick all go on
import * as H from './harness.ts';
import InvType from '#/cache/config/InvType.js';
import ObjType from '#/cache/config/ObjType.js';
import World from '#/engine/World.js';

await H.boot();
H.loginOrder();
let ok = 0, bad = 0, n = 0;
const check = (what: string, got: unknown, want: unknown) => {
    const pass = JSON.stringify(got) === JSON.stringify(want);
    pass ? ok++ : bad++;
    console.log(`  ${pass ? 'ok  ' : 'FAIL'} ${what}: ${JSON.stringify(got)}${pass ? '' : `   (want ${JSON.stringify(want)})`}`);
};
const fresh = () => {
    H.clearLogs();
    const p: any = H.makePlayer('pvp' + n, 3222 + n * 3, 3218, 40 + n); n++;
    H.tick(2); H.maxOut(p); H.clearInv(p); H.tick(1);
    return p;
};
const lvl = (p: any, stat: number) => p.levels[stat];
const HP = 3, ATT = 0, DEF = 1, STR = 2, RNG = 4, MAG = 6;
const invNames = (p: any) => {
    const inv = p.getInventory(InvType.INV)!;
    const out: string[] = [];
    for (let i = 0; i < 8; i++) out.push(inv.get(i) ? ObjType.get(inv.get(i)!.id).debugname! : '-');
    return out;
};
const worn = (p: any, slot: number) => { const o = p.getInventory(InvType.WORN)!.get(slot); return o ? ObjType.get(o.id).debugname : null; };
const actionDelay = (p: any) => H.getVar(p, 'action_delay') - World.currentTick;

console.log('POTIONS');
{
    const p = fresh();
    H.give(p, '4dose2strength'); H.give(p, '4dosestatrestore');
    H.opheld(p, '4dose2strength', 1);
    H.opheld(p, '4dosestatrestore', 1);
    check('two potions in one tick: only the first goes', [H.invCount(p, '3dose2strength'), H.invCount(p, '4dosestatrestore')], [1, 1]);
    H.tick(2);
    H.opheld(p, '4dosestatrestore', 1);
    check('  two ticks later, still refused', H.invCount(p, '4dosestatrestore'), 1);
    H.tick(1);
    H.opheld(p, '4dosestatrestore', 1);
    check('  three ticks later, it goes', H.invCount(p, '3dosestatrestore'), 1);
    check('  and a potion costs no attack delay', actionDelay(p) <= 0, true);
}

console.log('COMBO EATING');
{
    const p = fresh();
    p.levels[HP] = 40;
    H.give(p, 'shark'); H.give(p, '4dosepotionofsaradomin'); H.give(p, 'tbwt_cooked_karambwan');
    H.opheld(p, 'shark', 1);
    H.opheld(p, '4dosepotionofsaradomin', 1);
    H.opheld(p, 'tbwt_cooked_karambwan', 1);
    check('shark, brew and karambwan all in one tick', [H.invCount(p, 'shark'), H.invCount(p, '3dosepotionofsaradomin'), H.invCount(p, 'tbwt_cooked_karambwan')], [0, 1, 0]);
    check('  healed 20 (shark) + 16 (brew) + 18 (karambwan) from 40', lvl(p, HP), 40 + 20 + 16 + 18);
    check('  attack delay 3 + 2 = 5', actionDelay(p), 5);
}
{
    const p = fresh();
    p.levels[HP] = 40;
    H.give(p, 'tbwt_cooked_karambwan', 2); H.give(p, 'shark');
    H.opheld(p, 'tbwt_cooked_karambwan', 1);
    H.opheld(p, 'shark', 1);
    H.opheld(p, 'tbwt_cooked_karambwan', 1);
    check('karambwan first: the shark and a second karambwan wait', [H.invCount(p, 'tbwt_cooked_karambwan'), H.invCount(p, 'shark')], [1, 1]);
    check('  attack delay 2 for the karambwan alone', actionDelay(p), 2);
}
{
    const p = fresh();
    p.levels[HP] = 40;
    H.give(p, 'shark', 2);
    H.opheld(p, 'shark', 1); H.opheld(p, 'shark', 1);
    check('two sharks in one tick: one', H.invCount(p, 'shark'), 1);
}

console.log('SARADOMIN BREW at 99s');
{
    const p = fresh();
    H.give(p, '4dosepotionofsaradomin');
    H.opheld(p, '4dosepotionofsaradomin', 1);
    check('Hitpoints 99 -> 115', lvl(p, HP), 115);
    check('Defence 99 -> 120 (+2 +19)', lvl(p, DEF), 120);
    check('Attack, Strength, Ranged, Magic 99 -> 88 (-2 -9)', [lvl(p, ATT), lvl(p, STR), lvl(p, RNG), lvl(p, MAG)], [88, 88, 88, 88]);
    H.tick(3);
    H.opheld(p, '3dosepotionofsaradomin', 1);
    check('  a second sip: Hitpoints stays at 115, the cap', lvl(p, HP), 115);
}

console.log('EQUIP SLOTS');
{
    const p = fresh();
    H.equip(p, { rhand: 'rune_scimitar' });
    H.give(p, 'shark', 4); H.give(p, 'abyssal_whip');
    H.opheld(p, 'abyssal_whip', 2);
    check('whip from slot 4: the scimitar lands in slot 4', invNames(p)[4], 'rune_scimitar');
    check('  and the whip is worn', worn(p, 3), 'abyssal_whip');
}
{
    const p = fresh();
    H.equip(p, { rhand: 'rune_scimitar', lhand: 'rune_kiteshield' });
    H.give(p, 'shark', 2); H.give(p, 'rune_2h_sword'); H.give(p, 'shark');
    H.opheld(p, 'rune_2h_sword', 2);
    check('2h from slot 2: scimitar to slot 2, shield to the first free slot (4)', invNames(p).slice(0, 5), ['shark', 'shark', 'rune_scimitar', 'shark', 'rune_kiteshield']);
    H.opheld(p, 'rune_kiteshield', 2);
    check('  shield back on from slot 4: the 2h goes to slot 4', invNames(p)[4], 'rune_2h_sword');
    check('  hands: nothing in the right, the shield in the left', [worn(p, 3), worn(p, 5)], [null, 'rune_kiteshield']);
}

console.log('SWITCHING');
{
    const p = fresh();
    H.equip(p, { rhand: 'rune_scimitar', lhand: 'rune_kiteshield', torso: 'rune_platebody', legs: 'rune_platelegs', hat: 'rune_full_helm' });
    const kit = ['abyssal_whip', 'rune_dagger', 'mystic_robe_top', 'amulet_of_glory'];
    for (const k of kit) H.give(p, k);
    const before = World.currentTick;
    for (const k of kit) H.opheld(p, k, 2);
    const same = World.currentTick === before;
    check('four items clicked in one tick all go on in that tick', [same, worn(p, 3), worn(p, 4), worn(p, 2)], [true, 'rune_dagger', 'mystic_robe_top', 'amulet_of_glory']);
    check('  and everything taken off is in the slot it came from', invNames(p).slice(0, 4), ['rune_scimitar', 'abyssal_whip', 'rune_platebody', '-']);
}

console.log(`PVP  ${ok} ok, ${bad} failed`);
process.exit(0);
