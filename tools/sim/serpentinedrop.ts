// AN UNCHARGED SERPENTINE HELM CAN BE DROPPED, AND A CHARGED ONE STILL UNCHARGES.
//
//   npx tsx tools/sim/serpentinedrop.ts
//
// All six helms are category serpentine_helm, and serpentine_helm.rs2 answers [opheld5] on the
// CATEGORY. The three charged ones have iop5="Uncharge" and carry param=serpentine_uncharged
// naming their bare twin; the three bare ones have iop5="Drop" and carry no such param. A
// category trigger claims the click for all six and beats the global [opheld5,_] ~dropslot, so
// clicking Drop on a bare helm reached the uncharge handler, oc_param gave null, and inv_setslot
// threw on it: "An input for a Obj type was not valid to use. Input was -1." The helm could not
// be dropped at all.
//
// WHY THIS IS THE FUZZER'S KIND OF BUG AND NOT A CROSS-REFERENCE'S. opsweep asks whether a script
// answers the option and orphans asks whether the option exists; both say yes here, and so does
// ifselect. The option is declared, the handler is reachable, the dispatch is correct - and the
// handler then throws on the data. Only running it finds that. tools/sim/fuzz.ts reported it
// under SCRIPT FAULTS with the file and line.
import * as H from './harness.js';
import * as A from './a1lib.js';
import { check, R } from './a1lib.js';
import ObjType from '#/cache/config/ObjType.js';
import CategoryType from '#/cache/config/CategoryType.js';
import ParamType from '#/cache/config/ParamType.js';
import World from '#/engine/World.js';
import { CoordGrid } from '#/engine/CoordGrid.js';

await H.boot();

function onGround(p: { level: number; x: number; z: number }, objName: string): number {
    const id = ObjType.getId(objName);
    const zone = World.gameMap.getZone(p.x, p.z, p.level);
    let n = 0;
    for (const obj of zone.getObjsSafe(CoordGrid.packZoneCoord(p.x, p.z))) {
        if (obj.type === id) n += obj.count;
    }
    return n;
}

const CAT = CategoryType.getId('serpentine_helm');
const BARE = ParamType.getId('serpentine_uncharged');

console.log('THE CATEGORY HOLDS BOTH KINDS, WHICH IS WHY ONE HANDLER SEES BOTH');
{
    const charged: string[] = [];
    const bare: string[] = [];
    for (let i = 0; i < ObjType.count; i++) {
        const t = ObjType.get(i);
        if (!t?.debugname || t.category !== CAT) continue;
        ((t as unknown as { params?: Map<number, unknown> }).params?.get(BARE) == null ? bare : charged).push(t.debugname);
    }
    check('three charged helms, each naming its bare twin', charged.sort(), ['magma_helm', 'serpentine_helm', 'tanzanite_helm']);
    check('three bare ones, naming nothing', bare.sort(), ['magma_helm_uncharged', 'serpentine_helm_uncharged', 'tanzanite_helm_uncharged']);
    for (const n of bare) {
        check(`  ${n} iop5 is Drop`, ObjType.get(ObjType.getId(n)).iop[4], 'Drop');
    }
    for (const n of charged) {
        check(`  ${n} iop5 is Uncharge`, ObjType.get(ObjType.getId(n)).iop[4], 'Uncharge');
    }
}

// A TILE EACH, and the reason is the first version of this file: every case stood on 3222,3218, so
// the charged block's "nothing on the floor" check saw the bare helms the block above had just
// dropped there and read three content failures that were the test's own litter.
let tile = 0;
const spot = (): [number, number] => [3222 + (tile % 6), 3218 + Math.floor(tile++ / 6)];

console.log('A BARE HELM DROPS, RATHER THAN THROWING');
for (const n of ['serpentine_helm_uncharged', 'tanzanite_helm_uncharged', 'magma_helm_uncharged']) {
    const p = A.player(`bare_${n}`, ...spot());
    H.clearInv(p);
    H.give(p, n);
    A.held(p, n, 5);
    check(`${n} leaves the backpack`, H.invCount(p, n), 0);
    check('  and lands at their feet', onGround(p, n), 1);
    H.despawn(p);
}

console.log('AND A CHARGED ONE STILL UNCHARGES, WHICH IS WHAT THE HANDLER IS FOR');
for (const [charged, uncharged] of [
    ['serpentine_helm', 'serpentine_helm_uncharged'],
    ['tanzanite_helm', 'tanzanite_helm_uncharged'],
    ['magma_helm', 'magma_helm_uncharged']
]) {
    const p = A.player(`chg_${charged}`, ...spot());
    H.clearInv(p);
    H.give(p, charged);
    H.setVar(p, 'serpentine_helm_charges', 500);
    A.held(p, charged, 5);
    check(`${charged} becomes ${uncharged}`, [H.invCount(p, charged), H.invCount(p, uncharged)], [0, 1]);
    check('  and the 500 scales come back', H.invCount(p, 'zulrahs_scales'), 500);
    check('  with the charge counter cleared', H.getVar(p, 'serpentine_helm_charges'), 0);
    check('  and nothing on the floor', onGround(p, charged) + onGround(p, uncharged), 0);
    H.despawn(p);
}

console.log(`\n${R.ok} ok, ${R.bad} FAIL`);
process.exit(R.bad ? 1 : 0);
