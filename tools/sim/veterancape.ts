// The Veteran cape: that it packed, and that the server hands it out and takes it back correctly.
//
// The config half is worth asserting because a cape that fails to pack does not fail loudly - the
// obj id simply does not resolve, World.veteranCape returns early, and nobody is ever given
// anything. That would look exactly like "the rank works but no cape appeared".
//
// The behaviour half is the reclaim: it runs at every login, so the thing to pin down is that it
// gives exactly one cape and then stops, whatever the player has done with the first.
//
//   npx tsx tools/sim/veterancape.ts
import * as H from './harness.ts';
import { check, R, player } from './a1lib.ts';
import World from '#/engine/World.js';
import ObjType from '#/cache/config/ObjType.js';
import InvType from '#/cache/config/InvType.js';
import ParamType from '#/cache/config/ParamType.js';

await H.boot();

const CAPE = 'veteran_cape';

console.log('\nIT PACKED');
const obj = ObjType.getId(CAPE);
check('  the obj exists', obj !== -1, true);
if (obj === -1) {
    console.log(`\n${R.ok} ok, ${R.bad} FAIL`);
    process.exit(1);
}
const type = ObjType.get(obj);
check('  it is named', type.name, 'Veteran cape');
// Measured against a plain cape rather than against numbers typed out here, because the design
// is literally "the same as an ordinary cape": a badge, not an upgrade. A Cape of
// Accomplishment's +9 defence would pull against the launch wipe, which exists to put everyone
// back on level footing.
const plain = ObjType.get(ObjType.getId('red_cape'));
check('  worn where a cape is worn', type.wearpos, plain.wearpos);
check('  it has a worn model for men', type.manwear !== -1 && type.manwear !== undefined, true);
check('  and for women', type.womanwear !== -1 && type.womanwear !== undefined, true);
check('  not tradeable', type.tradeable, false);
// The five defence params only. Comparing every param instead failed on the red cape's
// crafting_capes_struct, which is how it is made and nothing to do with what it is worth wearing.
const DEFENCE = ['stabdefence', 'slashdefence', 'crushdefence', 'magicdefence', 'rangedefence'];
const defence = (o: ObjType) => DEFENCE.map(n => `${n}=${o.params.get(ParamType.getId(n)) ?? 0}`).join(' ');
check("  exactly a plain cape's defence", defence(type), defence(plain));

const bank = InvType.getId('bank');
check('  the bank inventory exists', bank !== -1, true);

const held = (p: ReturnType<typeof player>) => [InvType.INV, InvType.WORN, bank].filter(i => i !== -1).reduce((n, i) => n + p.invTotal(i, obj), 0);

console.log('\nA VETERAN IS GIVEN ONE');
const vet = player('vetcape_a', 3222, 3222);
vet.buildAppearance(InvType.WORN);
check('  starts with none', held(vet), 0);
World.veteranCape(vet, true);
check('  gets exactly one', held(vet), 1);
check('  and it is in the bank, not the backpack', vet.invTotal(bank, obj), 1);

console.log('\nAND NOT A SECOND ONE');
// This runs at every login, so the duplicate guard is the whole of it.
World.veteranCape(vet, true);
World.veteranCape(vet, true);
check('  still one after two more logins', held(vet), 1);

console.log('\nONE THEY ARE WEARING STILL COUNTS');
const worn = player('vetcape_b', 3224, 3222);
worn.buildAppearance(InvType.WORN);
worn.invAdd(InvType.WORN, obj, 1);
World.veteranCape(worn, true);
check('  no second copy for a cape on their back', held(worn), 1);

console.log('\nLOSE IT AND RELOG');
const lost = player('vetcape_c', 3226, 3222);
lost.buildAppearance(InvType.WORN);
World.veteranCape(lost, true);
lost.invDel(bank, obj, 1);
check('  dropped it', held(lost), 0);
World.veteranCape(lost, true);
check('  the next login hands another back', held(lost), 1);

console.log('\nA FULL BANK DOES NOT DROP IT ON THE FLOOR');
// inv_add with nowhere to put the item is how quest items have been lost here before.
const full = player('vetcape_d', 3228, 3222);
full.buildAppearance(InvType.WORN);
// DISTINCT OBJS, one per slot. The first attempt filled with coins, which stack: the bank went
// on accepting them for ever, still reported 1360 free slots, and the test proved nothing.
let id = 0;
while (full.invFreeSpace(bank) > 0 && id < ObjType.count) {
    if (id !== obj && ObjType.get(id)) {
        full.invAdd(bank, id, 1);
    }
    id++;
}
const before = full.invFreeSpace(bank);
World.veteranCape(full, true);
check('  the bank really was full', before, 0);
check('  nothing was forced in', full.invTotal(bank, obj), 0);
check('  it went to the inventory instead', full.invTotal(InvType.INV, obj), 1);

console.log('\nTAKING THE RANK BACK TAKES THE CAPE');
World.veteranCape(vet, false);
check('  gone from the bank', held(vet), 0);
World.veteranCape(worn, false);
check('  and off their back', held(worn), 0);
// Taking it from somebody who has none must not throw or message them.
World.veteranCape(worn, false);
check('  taking it twice is harmless', held(worn), 0);

H.despawn(vet, worn, lost, full);
console.log(`\n${R.ok} ok, ${R.bad} FAIL`);
process.exit(R.bad ? 1 : 0);
