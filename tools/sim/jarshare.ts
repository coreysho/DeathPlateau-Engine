// SHARING AN IMPLING JAR WITH ANOTHER PLAYER - the one thing a fuzzer is not allowed to test.
//
//   npx tsx tools/sim/jarshare.ts
//
// [opplayeru] is eight triggers in this build and [applayeru] two, and no fuzzing bot can reach any
// of them, on purpose: OpPlayerUHandler refuses outright when the target is a bot -
//
//     if (other.isBot) { player.messageGame(`${other.displayName} is a bot - it doesn't take
//                        items.`); return false; }
//
// - so players cannot lose items into a bot. That is a deliberate rule and not a gap to work
// around, which leaves these ten triggers needing a sim with two real players. This is it, for the
// four butterfly jars in hunter_butterfly_share.rs2.
//
// WHY ALL THREE BRANCHES. ~hunter_jar_share refuses twice before it does anything, and both
// refusals are the kind that rot silently: one reads the MULTIWAY flag of both coords and one reads
// the target's own accept-aid option. A test that only proved the happy path would still pass if
// either guard were deleted.
//
// AND THE FOURTH THING IT DOES, which is the easiest to get wrong: the jar is consumed and an EMPTY
// butterfly jar takes its place. A share that gave the effect and kept the jar would be an infinite
// strength boost.
import * as H from './harness.js';
import { check, R } from './a1lib.js';
import InvType from '#/cache/config/InvType.js';
import ObjType from '#/cache/config/ObjType.js';
import VarPlayerType from '#/cache/config/VarPlayerType.js';
import World from '#/engine/World.js';
import { CoordGrid } from '#/engine/CoordGrid.js';
import { isMapBlocked, isZoneAllocated } from '#/engine/GameMap.js';
import { PlayerStat } from '#/engine/entity/PlayerStat.js';

await H.boot();

/** A tile the engine itself calls multi-combat, found rather than hardcoded. */
function findMulti(): [number, number] | null {
    // The Wilderness north of the ditch is the biggest multi area; scan a band of it.
    for (let x = 3100; x < 3300; x += 2) {
        for (let z = 3700; z < 3900; z += 2) {
            if (World.gameMap.isMulti(CoordGrid.packCoord(0, x, z)) && isZoneAllocated(0, x, z) && !isMapBlocked(x, z, 0)) {
                return [x, z];
            }
        }
    }
    return null;
}

const multi = findMulti();
if (!multi) {
    console.log('no multi-combat tile found in the band scanned - nothing to test');
    process.exit(1);
}
console.log(`multi-combat tile: ${multi[0]},${multi[1]}`);

const AID = VarPlayerType.getId('option_aid');
const JAR = 'black_warlock';
const jarId = ObjType.getId(JAR);
const emptyId = ObjType.getId('hunter_butterfly_jar');

function share(giver: ReturnType<typeof H.makePlayer>, taker: ReturnType<typeof H.makePlayer>): string[] {
    const from = H.mesgs.length;
    // H.useOnPlayer, not OpPlayerUHandler directly: its rsbuf.hasPlayer check is filled only for a
    // connected client, so the real handler refuses every one of these before the content runs.
    // See the note on useOnPlayer in harness.ts.
    const sent = H.useOnPlayer(giver, taker, JAR);
    check(`the click was accepted (${giver.username} -> ${taker.username})`, sent, true);
    H.tick(3);
    return H.mesgs.slice(from).map(m => m.text);
}

// ------------------------------------------------------------------- the share, in a multi area
{
    const a = H.makePlayer('jargiver', multi[0], multi[1]);
    const b = H.makePlayer('jartaker', multi[0] + 1, multi[1]);
    H.tick(3);
    b.setVar(AID, 1); // ^aid_yes
    a.invAdd(InvType.INV, jarId, 1);
    const strBefore = b.levels[PlayerStat.STRENGTH];
    const said = share(a, b);
    check('share: the jar is gone', a.getInventory(InvType.INV)!.getItemCount(jarId), 0);
    check('share: an empty jar took its place', a.getInventory(InvType.INV)!.getItemCount(emptyId), 1);
    check(
        'share: the giver is told',
        said.some(t => t.includes('black warlock')),
        true
    );
    check("share: the taker's Strength went up", b.levels[PlayerStat.STRENGTH] > strBefore, true);
    H.despawn(a);
    H.despawn(b);
    H.tick(2);
}

// --------------------------------------------------------------- refused: not accepting aid
{
    const a = H.makePlayer('jargiver2', multi[0], multi[1]);
    const b = H.makePlayer('jartaker2', multi[0] + 1, multi[1]);
    H.tick(3);
    b.setVar(AID, 2); // ^aid_no
    a.invAdd(InvType.INV, jarId, 1);
    const said = share(a, b);
    check('no aid: the jar is kept', a.getInventory(InvType.INV)!.getItemCount(jarId), 1);
    check(
        'no aid: and the giver is told why',
        said.some(t => t.includes('not accepting aid')),
        true
    );
    H.despawn(a);
    H.despawn(b);
    H.tick(2);
}

// --------------------------------------------------------------- refused: outside multi-combat
{
    const a = H.makePlayer('jargiver3', 3222, 3218);
    const b = H.makePlayer('jartaker3', 3223, 3218);
    H.tick(3);
    check('the control tile really is single-combat', World.gameMap.isMulti(CoordGrid.packCoord(0, 3222, 3218)), false);
    b.setVar(AID, 1);
    a.invAdd(InvType.INV, jarId, 1);
    const said = share(a, b);
    check('single: the jar is kept', a.getInventory(InvType.INV)!.getItemCount(jarId), 1);
    check('single: and nothing was shared', b.getInventory(InvType.INV)!.getItemCount(emptyId), 0);
    check(
        'single: "Nothing interesting happens."',
        said.some(t => t.includes('Nothing interesting')),
        true
    );
    H.despawn(a);
    H.despawn(b);
    H.tick(2);
}

console.log(`\n${R.ok} ok, ${R.bad} FAIL`);
process.exit(R.bad ? 1 : 0);
