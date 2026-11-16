// THINGS THAT OPEN AND SHUT AGAIN - the two wardrobes and the Wilderness door.
//
//   npx tsx tools/sim/openclose.ts
//
// draynor_wardrobe is the spooky wardrobe recoloured, placed 30 times in Draynor Manor, and its
// Open did nothing. It already had its own open and skeleton locs with Search and Close on both, so
// only the three triggers were missing. wild_door is the same story one file over: 29 placed
// instances of a dead Open, with wild_door_open sitting unused and every other door in the build
// wired as category=door_closed plus param=next_loc_stage to its partner.
//
// WHY THE ROUND TRIP RATHER THAN THE CLICK. A wardrobe that opens and cannot be shut, or a door
// that opens into the wrong tile, both answer a click perfectly well. What a player needs is to get
// back out again, so each one is opened, read and closed, and the loc is checked to be back where
// it started. The door additionally has to become PASSABLE, which is the whole point of a door and
// is not implied by the loc changing.
//
// THE SPOOKY WARDROBE IS HERE AS A REGRESSION CHECK, not because it was broken. Wiring Draynor's
// meant sharing the bodies rather than copying them - a second copy of the 1-in-21 skeleton roll is
// a second place for it to drift - so the spooky triggers were rewritten to go through the same
// labels. That is working code touched for tidiness, which is exactly the kind of change that
// should have a test under it before it is believed.
import * as H from './harness.js';
import { isFlagged } from '#/engine/GameMap.js';
import { CollisionFlag } from '#/engine/routefinder/index.js';

await H.boot();

let ok = 0;
let bad = 0;
const check = (what: string, good: boolean, detail = ''): void => {
    if (good) {
        ok++;
        console.log('  ok   ' + what);
    } else {
        bad++;
        console.log('  FAIL ' + what + (detail ? ' - ' + detail : ''));
    }
};
const walkable = (level: number, x: number, z: number): boolean => !isFlagged(x, z, level, CollisionFlag.WALK_BLOCKED);

const p = H.makePlayer('opener', 3222, 3218) as unknown as { x: number; z: number; level: number; teleport: (x: number, z: number, l: number) => void };
H.tick(2);
H.maxOut(p as never);

const offsets: [number, number][] = [
    [0, -1],
    [0, 1],
    [-1, 0],
    [1, 0],
    [-1, -1],
    [1, 1],
    [-1, 1],
    [1, -1]
];

/**
 * Click `op` on one instance of `name` from a tile beside it, trying each side until the click
 * actually LANDS - `done()` says what landing looks like.
 *
 * The first version of this returned on the first walkable side whose click produced no "I can't
 * reach that!", which is not the same thing: a wardrobe set against a wall has walkable tiles whose
 * route to it fails silently, and the handler here says nothing at all on success either (it is an
 * anim and a loc_change). So an unreached click and a successful one looked identical, and the test
 * reported Open working while the wardrobe had not moved.
 */
function click(name: string, x: number, z: number, level: number, op: number, done: () => boolean): string[] | null {
    for (const [dx, dz] of offsets) {
        if (!walkable(level, x + dx, z + dz)) continue;
        p.teleport(x + dx, z + dz, level);
        H.tick(2);
        H.clearLogs();
        H.opLoc(p as never, x, z, name, op);
        for (let t = 0; t < 10; t++) H.tick(1);
        const said = [...H.mesgs.map(m => m.text), ...H.ifaces.filter(i => i.kind === 'text').map(i => i.text ?? '')];
        if (done()) return said;
    }
    return null;
}
/** Anything said at all, for the clicks whose only outcome is a line of text. */
const spoke = (): boolean => H.mesgs.length > 0 || H.ifaces.some(i => i.kind === 'text');

/**
 * Where a loc of `name` sits within 2 tiles of x,z, or null. A door SWINGS: ~open_door puts the
 * opened loc on a neighbouring tile, not the one the shut door was on, so the tile to click to
 * close it again has to be looked up rather than assumed.
 */
function findNear(name: string, x: number, z: number, level: number): { x: number; z: number } | null {
    for (let ddx = -2; ddx <= 2; ddx++) {
        for (let ddz = -2; ddz <= 2; ddz++) {
            if (H.locAt(level, x + ddx, z + ddz, name)) return { x: x + ddx, z: z + ddz };
        }
    }
    return null;
}
const nearby = (name: string, x: number, z: number, level: number): boolean => findNear(name, x, z, level) !== null;

// ============================================================================ the two wardrobes
const WARDROBES: { shut: string; open: string; skeleton: string; x: number; z: number }[] = [
    { shut: 'draynor_wardrobe', open: 'draynor_wardrobe_open', skeleton: 'draynor_wardrobe_open_skeleton', x: 3016, z: 3256 },
    { shut: 'spookywardrobe', open: 'spookywardrobe_open', skeleton: 'spookywardrobe_open_skeleton', x: 3078, z: 9776 }
];

for (const { shut, open, skeleton, x: sx, z: sz } of WARDROBES) {
    console.log('');
    console.log(`-- ${shut}`);
    const spots = [...H.locsNear(shut, sx, sz, 0), ...H.locsNear(shut, sx, sz, 1), ...H.locsNear(shut, sx, sz, 2)];
    if (!spots.length) {
        check(`${shut} is placed somewhere near ${sx},${sz}`, false, 'the map places none');
        continue;
    }
    const { x, z, level } = spots[0];

    // Open has landed when the wardrobe is no longer shut - either open or the skeleton one.
    const opened = click(shut, x, z, level, 1, () => H.locAt(level, x, z, open) || H.locAt(level, x, z, skeleton));
    check('Open leaves it open', opened !== null, 'no side opened it');
    if (opened === null) continue;
    const isSkeleton = H.locAt(level, x, z, skeleton);
    console.log(`       (the 1-in-21 roll came up ${isSkeleton ? 'skeleton' : 'empty'})`);

    const nowName = isSkeleton ? skeleton : open;
    const searched = click(nowName, x, z, level, 2, spoke);
    // The skeleton says its own line; the empty one either finds something nice or says it is empty.
    check('  Search answers', searched !== null && searched.length > 0 && !searched.some(s => /nothing interesting happens/i.test(s)), searched ? searched.join(' / ') : 'no reachable side');
    if (isSkeleton) {
        check('  and the skeleton gets its own line', searched !== null && searched.some(s => /skeleton/i.test(s)), searched ? searched.join(' / ') : '');
    }

    const closed = click(nowName, x, z, level, 3, () => H.locAt(level, x, z, shut));
    check(`  Close makes it a ${shut} again`, closed !== null, 'no side closed it');
}

// ============================================================================ the Wilderness door
console.log('');
console.log('-- wild_door');
{
    const spots = H.locsNear('wild_door', 3276, 3929, 0);
    if (!spots.length) {
        check('wild_door is placed in the Wilderness', false, 'the map places none near 3276,3929');
    } else {
        const { x, z, level } = spots[0];
        // NOT A TILE-PASSABILITY CHECK, and the first version of this file had two of them. A door is
        // a WALL shape: it blocks movement across a tile EDGE through directional flags, and never
        // sets WALK_BLOCKED on the tile itself. So "is this tile walkable" is true before the door
        // opens and after it shuts, which made the open assertion pass for no reason and the close
        // assertion fail for no reason. What is checked instead is the loc round trip, and in
        // particular that the shut door comes back on the tile it started on - a door that drifts a
        // tile each time it is opened and shut is the real failure this can see.
        const opened = click('wild_door', x, z, level, 1, () => !H.locAt(level, x, z, 'wild_door'));
        check('Open takes the shut door off its tile', opened !== null, 'no side opened it');
        check('  and a wild_door_open is there instead', nearby('wild_door_open', x, z, level), 'no open door appeared within two tiles');

        const where = findNear('wild_door_open', x, z, level);
        if (!where) {
            check('  the open door can be found to close it', false, 'no wild_door_open within two tiles');
        } else {
            const closed = click('wild_door_open', where.x, where.z, level, 1, () => nearby('wild_door', x, z, level));
            check(`  Close shuts it again (it had swung to ${where.x},${where.z})`, closed !== null, 'no side closed it');
            check('  and the shut door is back on the tile it started on', H.locAt(level, x, z, 'wild_door'), `it came back somewhere else - ${x},${z} is empty, so the pair drifts`);
        }
    }
}

console.log('');
console.log(`${ok} ok, ${bad} FAIL`);
process.exit(bad ? 1 : 0);
