// "Destroy" DESTROYS THE ITEM NOW, instead of putting it on the floor.
//
//   npx tsx tools/sim/destroyop.ts
//
// There are exactly two global opheld triggers in the build - [opheld2,_] ~equip in equip.rs2 and
// [opheld5,_] ~dropslot in drop.rs2 - and the second one used to take every fifth-option click
// without looking at what the option said. ObjType seeds iop as [null,null,null,null,'Drop'], so
// for most items that is right. 286 objs override it, and for those it was not: 160 say "Destroy",
// 96 "Move", 24 "Dismantle", 6 "Release", and all of them went to inv_dropslot.
//
// The Destroy ones are the dangerous ones. They are untradeable quest items - lunar_*, enakh_*,
// handsand_*, mourning_*, burgh_*, chickenquest_* - and the whole point of the option is that the
// player cannot bank or sell the thing. A single misclick put it on the ground with no
// confirmation, and ^dropslot_duration then took it away for good.
//
// WHAT MADE THE FIX POSSIBLE. The label could not be read from a script: oc_iop has been in the
// engine's ScriptOpcode.ts since the enum was written, marked "official, see cs2", with no handler
// behind it. It is implemented now (ObjConfigOps, alongside oc_op for the ground menu) and
// declared in content's scripts/engine.rs2, so ~dropslot can ask what the option actually says.
//
// WHAT IS DELIBERATELY NOT FIXED. Move, Dismantle and Release still fall through to the drop.
// Each wants a feature and not a branch, and making them inert instead would be worse than the
// drop: "Dismantle" IS the fifth option on an ornamented godsword, so there is no Drop underneath
// it and the item would be stuck in the backpack for good. They stay in opsweep's report.
import * as H from './harness.js';
import * as A from './a1lib.js';
import { check, R } from './a1lib.js';
import ObjType from '#/cache/config/ObjType.js';
import World from '#/engine/World.js';
import { CoordGrid } from '#/engine/CoordGrid.js';

await H.boot();

/** Is there one of these lying on the floor where the player is standing? */
function onGround(p: { level: number; x: number; z: number }, objName: string): number {
    const id = ObjType.getId(objName);
    const zone = World.gameMap.getZone(p.x, p.z, p.level);
    let n = 0;
    for (const obj of zone.getObjsSafe(CoordGrid.packZoneCoord(p.x, p.z))) {
        if (obj.type === id) n += obj.count;
    }
    return n;
}

/** An untradeable quest item whose fifth option the cache spells "Destroy". */
const DESTROYABLE = 'handsand_rose_lens';
/** The ordinary case: nothing overrides iop5, so it reads "Drop" and must still drop. */
const DROPPABLE = 'bronze_sword';

console.log('THE CACHE STILL SAYS WHAT THIS TEST THINKS IT SAYS');
check(`${DESTROYABLE} iop5`, ObjType.get(ObjType.getId(DESTROYABLE)).iop[4], 'Destroy');
check(`${DROPPABLE} iop5`, ObjType.get(ObjType.getId(DROPPABLE)).iop[4], 'Drop');

console.log('AN ORDINARY ITEM STILL DROPS, WITH NO QUESTION ASKED');
{
    const p = A.player('destroy1', 3222, 3218);
    H.give(p, DROPPABLE);
    A.held(p, DROPPABLE, 5);
    check('gone from the backpack', H.invCount(p, DROPPABLE), 1 - 1);
    check('and lying at their feet', onGround(p, DROPPABLE), 1);
    H.despawn(p);
}

console.log('"Keep it." KEEPS IT, AND PUTS IT NOWHERE');
{
    const p = A.player('destroy2', 3222, 3218);
    H.give(p, DESTROYABLE);
    A.held(p, DESTROYABLE, 5, ['Keep it.']);
    check('still in the backpack', H.invCount(p, DESTROYABLE), 1);
    check('and NOT on the floor - the old behaviour', onGround(p, DESTROYABLE), 0);
    H.despawn(p);
}

console.log('"Destroy the ..." DESTROYS IT, AND PUTS IT NOWHERE');
{
    const p = A.player('destroy3', 3222, 3218);
    H.give(p, DESTROYABLE);
    const before = A.mark();
    A.held(p, DESTROYABLE, 5, ['Destroy the ']);
    check('gone from the backpack', H.invCount(p, DESTROYABLE), 0);
    check('and NOT on the floor', onGround(p, DESTROYABLE), 0);
    check(
        'and it said so',
        A.mesSince(p, before).some(m => m.startsWith('You destroy the ')),
        true
    );
    H.despawn(p);
}

console.log('EVERY "Destroy" IN THE CACHE REACHES THE SAME HANDLER');
{
    // Not 160 playthroughs. A per-item [opheld5,x] claims the click before the global ever sees
    // it, so the set that matters is the ones WITHOUT their own handler - and for those, one
    // worked example covers the lot, because they all arrive at the same four lines.
    const own: string[] = [];
    const generic: string[] = [];
    for (let id = 0; id < ObjType.count; id++) {
        const t = ObjType.get(id);
        if (!t?.debugname || t.certtemplate !== -1 || t.iop[4] !== 'Destroy') continue;
        (H.hasScript(`[opheld5,${t.debugname}]`) ? own : generic).push(t.debugname);
    }
    console.log(`  (${own.length} have their own [opheld5] handler, ${generic.length} rely on the global one)`);
    check('the sample item is one of the generic ones', generic.includes(DESTROYABLE), true);
    check('and the generic ones are the bulk of them', generic.length > own.length, true);
    // The six storage containers were doing this by hand long before the global could: they warn
    // about losing the contents first, which is why they keep their own handler.
    for (const bag of ['herb_sack', 'looting_bag', 'seed_box']) {
        check(`  ${bag} still answers for itself`, own.includes(bag), true);
    }
}

console.log(`\n${R.ok} ok, ${R.bad} FAIL`);
process.exit(R.bad ? 1 : 0);
