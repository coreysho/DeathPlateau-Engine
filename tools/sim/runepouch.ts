// The rune pouch's store outliving the pouch (reported: "destroying/losing a runepouch doesn't
// remove runes from it when you get another"). The store is a PERM inv, so the three cases that
// matter are: destroyed, lost on death, and left safely in the bank while you die.
//
//   npx tsx tools/sim/runepouch.ts
import * as H from './harness.ts';
import * as A from './a1lib.ts';
import { World, check, R, player } from './a1lib.ts';
import InvType from '#/cache/config/InvType.js';
import ObjType from '#/cache/config/ObjType.js';

await H.boot();

const STORE = InvType.getId('rune_pouch_store');
const id = (n: string) => ObjType.getId(n);

let tile = 0;
function fresh(name: string) {
    // a tile each: these all drop on the floor and the floor is shared
    const p = player(name, 3200 + tile++ * 2, 3200);
    const store = p.getInventory(STORE)!;
    for (let i = 0; i < store.capacity; i++) if (store.get(i)) p.invDelSlot(STORE, i);
    return p;
}
const load = (p: any) => {
    p.invSet(STORE, id('firerune'), 500, 0);
    p.invSet(STORE, id('airrune'), 1500, 1);
};
const stored = (p: any) => {
    const s = p.getInventory(STORE)!;
    const out: [string, number][] = [];
    for (let i = 0; i < s.capacity; i++) { const o = s.get(i); if (o) out.push([ObjType.get(o.id).debugname, o.count]); }
    return out.sort();
};
const floorAt = (p: any) => [...World.gameMap.getZone(p.x, p.z, p.level).getAllObjsUnsafe()]
    .filter((o: any) => o.x === p.x && o.z === p.z)
    .map((o: any) => [ObjType.get(o.type).debugname, o.count] as [string, number]).sort();

console.log('DEATH CARRYING IT');
{
    const p = fresh('rp1');
    H.give(p, 'rune_pouch', 1);
    load(p);
    A.runProcProtected(p, '[proc,rune_pouch_death_spill]');
    check('  the store is emptied', stored(p), []);
    check('  the runes are on the floor', floorAt(p), [['airrune', 1500], ['firerune', 500]]);
    H.despawn(p);
}

console.log('DEATH WITH THE POUCH SAFE IN THE BANK');
{
    const p = fresh('rp2');
    load(p); // no pouch in the inventory - it is banked, which is a supported way to carry nothing
    A.runProcProtected(p, '[proc,rune_pouch_death_spill]');
    check('  the store is untouched', stored(p), [['airrune', 1500], ['firerune', 500]]);
    check('  nothing spilled', floorAt(p), []);
    H.despawn(p);
}

console.log('DEATH WITH THE POUCH PROTECTED');
{
    const p = fresh('rp3');
    load(p);
    // a protected pouch has already been moved to deathkeep by the time the spill runs
    p.invSet(InvType.getId('deathkeep'), id('rune_pouch'), 1, 0);
    A.runProcProtected(p, '[proc,rune_pouch_death_spill]');
    check('  a kept pouch keeps its runes', stored(p), [['airrune', 1500], ['firerune', 500]]);
    check('  nothing spilled', floorAt(p), []);
    H.despawn(p);
}

console.log('DESTROY');
{
    const p = fresh('rp4');
    H.give(p, 'rune_pouch', 1);
    load(p);
    H.opheld(p, 'rune_pouch', 5); // the Destroy option
    A.drive(p, [1]); // "Destroy the rune pouch."
    check('  destroying it empties the store', stored(p), []);
    check('  and the pouch is gone', H.invCount(p, 'rune_pouch'), 0);
    H.despawn(p);
}

console.log('A REPLACEMENT POUCH IS EMPTY');
{
    const p = fresh('rp5');
    H.give(p, 'rune_pouch', 1);
    load(p);
    A.runProcProtected(p, '[proc,rune_pouch_death_spill]');
    H.clearInv(p);
    H.give(p, 'rune_pouch', 1); // the one you buy afterwards
    check('  it holds nothing', stored(p), []);
    H.despawn(p);
}

console.log(`\n${R.ok} ok, ${R.bad} FAIL`);
process.exit(R.bad ? 1 : 0);
