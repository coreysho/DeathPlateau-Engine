// The scroll box stack limit, lifted (owner: "drop the limit on the scroll box so you can get
// however many you want"). What must still hold afterwards:
//
//   * the FIRST clue of a tier is still a clue scroll, not a box, and it still clears that tier's
//     progress - the thing a cap was never protecting
//   * every clue after it is a box, for as long as you like, with no "sneaking suspicion" message
//   * a box still refuses to open while you are working on a clue of its tier
//   * picking boxes up off the floor is never refused
//
//   npx tsx tools/sim/cluestack.ts
import * as H from './harness.ts';
import * as A from './a1lib.ts';
import { World, check, R, player } from './a1lib.ts';
import ObjType from '#/cache/config/ObjType.js';

await H.boot();

const TIER = { easy: 0, medium: 1, hard: 2 };
const p = player('clue', 3250, 3250);
const floorAt = () => [...World.gameMap.getZone(p.x, p.z, p.level).getAllObjsUnsafe()]
    .filter((o: any) => o.x === p.x && o.z === p.z)
    .map((o: any) => [ObjType.get(o.type).debugname, o.count] as [string, number]);
const clear = () => { for (const o of floorAt()) void o; };

const packed = (x: number, z: number, level = 0) => (z & 0x3fff) | ((x & 0x3fff) << 14) | ((level & 0x3) << 28);

console.log('ROLLING TWENTY EASY CLUE DROPS IN A ROW');
let boxes = 0, scrolls = 0, suspicions = 0;
for (let i = 0; i < 20; i++) {
    const before = H.mesgs.length;
    const seen = new Set(floorAt().map(o => o[0]));
    // rarity 1 = always rolls
    A.runProcProtected(p, '[proc,trail_cluedrop]', [TIER.easy, 1, packed(p.x, p.z, p.level)]);
    const now = floorAt();
    for (const [name] of now) {
        if (seen.has(name)) continue;
        if (name === 'trail_scrollbox_easy') boxes++;
        else scrolls++;
        seen.add(name);
    }
    // a stacked box shows as one entry with a growing count, so count that too
    const box = now.find(o => o[0] === 'trail_scrollbox_easy');
    if (box) boxes = Math.max(boxes, box[1]);
    if (H.mesgs.slice(before).some(m => m.text.includes('sneaking suspicion'))) suspicions++;
    // take them so the next roll sees them held
    for (const [name, count] of now) H.give(p, name, count);
    for (const o of [...World.gameMap.getZone(p.x, p.z, p.level).getAllObjsUnsafe()]) World.removeObj(o as any, 0);
}
check('  the first drop was a clue scroll, not a box', scrolls, 1);
check('  the other nineteen were boxes', boxes, 19);
check('  no drop was ever thrown away', suspicions, 0);
check('  and they are one stacked slot', H.invCount(p, 'trail_scrollbox_easy'), 19);

console.log('WHAT THE CAP WAS NOT PROTECTING');
{
    // a box will not open while that tier's clue is still in hand
    const before = A.mark();
    H.opheld(p, 'trail_scrollbox_easy', 1);
    check('  a box refuses to open while a clue of its tier is held',
        A.said(p, before, 'you already have a clue'), true);
}
{
    // and picking up more boxes off the floor is never refused now
    const refused = H.runProc(p, '[proc,trail_take_refused]',
        [ObjType.getId('trail_scrollbox_easy'), 50])[0];
    check('  picking up fifty more boxes is allowed', refused, 0);
}

console.log(`\n${R.ok} ok, ${R.bad} FAIL`);
process.exit(R.bad ? 1 : 0);
