// DEAD LADDERS WIRED ON A HINT, CLIMBED - every placed instance, checking where the player lands.
//
//   npx tsx tools/sim/ladderclimb.ts
//
// THE TEST THE LAST ATTEMPT AT THIS BUCKET DID NOT HAVE. 25 dead ladders were given
// category=ladder_up/ladder_down once and all 25 taken off again, because no sim could tell a real
// failure from its own: a ring of tiles around the loc gets "I can't reach that!" from tiles that
// are open but unroutable, and climbladders.ts's router-based rule calls a working ladder broken
// 7 times in 13. opsweep-backlog.md has the whole history.
//
// What makes a ladder safe to wire is somebody who knows the place saying where it goes. That
// leaves one question per instance - does the plain vertical link land somewhere a player can stand
// - and that is answerable by climbing and looking. Each area is added here as its hint arrives:
// Lletya goes up to the tree walkways, Port Sarim's jail down to the cells.
//
// ~climb_ladder DOES NOT VALIDATE. It p_telejumps, so a wrong destination puts the player inside a
// wall rather than refusing, which is why loc_11739 is the cautionary case: deadladders finds it a
// same-tile partner on 7 of 7 instances, the strongest evidence that tool has, and climbing it still
// lands at 3050,3356,2 which is solid. The handler jumps from the tile the PLAYER stands on, not the
// ladder's own tile, so the landing depends on the side they walked up from.
//
// So this asserts the two things that matter and nothing else: the player changed level in the right
// direction, and the tile they arrived on is one they can stand on. Per instance, so a single bad
// spot names itself instead of condemning the loc.
import LocType from '#/cache/config/LocType.js';

import * as H from './harness.js';
import { isFlagged } from '#/engine/GameMap.js';
import { CollisionFlag } from '#/engine/routefinder/index.js';

await H.boot();

let ok = 0;
let bad = 0;
let untested = 0;
const check = (what: string, good: boolean, detail = ''): void => {
    if (good) {
        ok++;
        console.log('  ok   ' + what);
    } else {
        bad++;
        console.log('  FAIL ' + what + (detail ? ' - ' + detail : ''));
    }
};

const p = H.makePlayer('elf', 3222, 3218) as unknown as {
    x: number; z: number; level: number;
    teleport(x: number, z: number, level: number): void;
};
H.tick(2);
H.maxOut(p as never);

const standable = (level: number, x: number, z: number): boolean => !isFlagged(x, z, level, CollisionFlag.WALK_BLOCKED);

// Seeds come from deadladders' own placement report; locsNear finds the rest from each.
// dz is for the ladders that are not vertical links at all: this build keeps the underground
// 6400 south of the surface, so a dungeon ladder changes z and not level. loc_1755 going up is
// movecoord(coord(), 0, 0, -6400), and the Wilderness one down is that mirrored.
const LADDERS: { name: string; x: number; z: number; dlevel: number; dz: number }[] = [
    // Lletya - up into the walkways between the trees.
    { name: 'elf_village_ladder', x: 2328, z: 3168, dlevel: +1, dz: 0 },
    { name: 'elf_village_ladder_top', x: 2335, z: 3160, dlevel: -1, dz: 0 },
    // Port Sarim jail - down to the cells.
    { name: 'prison_ladder_up', x: 3010, z: 3184, dlevel: +1, dz: 0 },
    { name: 'prison_laddertop', x: 3010, z: 3184, dlevel: -1, dz: 0 },
    // Wilderness - down to the dungeon, which is 6400 south rather than a level below.
    { name: 'wild_laddertop_dungeon', x: 3005, z: 3963, dlevel: 0, dz: +6400 }
];

const offsets: [number, number][] = [];
for (let r = 0; r < 3; r++) {
    offsets.push([r + 1, 0], [-r, 0], [0, r + 1], [0, -r], [r + 1, r + 1], [-r, -r], [r + 1, -r], [-r, r + 1]);
}

for (const { name, x: sx, z: sz, dlevel: dir, dz } of LADDERS) {
    console.log('');
    const id = LocType.getId(name);
    const lt = id === -1 ? null : LocType.get(id);
    // `!== undefined` was true for every loc, including the ones with no category at all, so this
    // line used to claim "category set" about the Wilderness ladder, which is wired by an explicit
    // trigger instead. -1 is the no-category value.
    const how = (lt?.category ?? -1) !== -1 ? 'category' : 'own trigger';
    const expect = dz !== 0 ? `z +${dz} (the dungeon)` : `level ${dir > 0 ? 'up' : 'down'}`;
    console.log(`-- ${name} (${how}), expecting ${expect}`);

    // Every instance, not a sample: a ladder that works in four places and drops you into a tree in
    // the fifth is still a ladder that needs fixing, and the sample would hide it.
    const spots = [
        ...H.locsNear(name, sx, sz, 0),
        ...H.locsNear(name, sx, sz, 1),
        ...H.locsNear(name, sx, sz, 2)
    ];
    if (!spots.length) {
        console.log(`   UNTESTED - no instance found near ${sx},${sz}`);
        untested++;
        continue;
    }

    for (const { x, z, level } of spots) {
        let climbed = false;
        for (const [dx, dz] of offsets) {
            if (climbed) continue;
            const fx = x + dx;
            const fz = z + dz;
            if (!standable(level, fx, fz)) continue;
            p.teleport(fx, fz, level);
            H.tick(1);
            const mark = H.mesgs.length;
            H.opLoc(p as never, x, z, name, 1);
            for (let t = 0; t < 12; t++) H.tick(1);
            const said = H.mesgs.slice(mark).map(m => m.text);
            if (said.some(s => /can't reach/i.test(s))) continue;
            climbed = true;

            const want = level + dir;
            if (dz !== 0) {
                // A dungeon ladder keeps its level and moves 6400 south, so the assertion is about z.
                check(`${x},${z},${level} climbs down to the dungeon`, p.level === want && Math.abs(p.z - (fz + dz)) <= 2, `ended at ${p.x},${p.z},${p.level}, wanted about ${fx},${fz + dz},${want}`);
            } else {
                check(`${x},${z},${level} climbs to level ${want}`, p.level === want, `ended on level ${p.level} at ${p.x},${p.z}${said.length ? ' saying ' + JSON.stringify(said.slice(0, 1)) : ''}`);
            }
            // The one that matters: a telejump does not check, so this does.
            check('  and lands somewhere a player can stand', standable(p.level, p.x, p.z), `${p.x},${p.z},${p.level} is solid`);
        }
        if (!climbed) {
            console.log(`   UNTESTED ${x},${z},${level} - no routable tile beside it`);
            untested++;
        }
    }
}

console.log('');
console.log(`${ok} ok, ${bad} FAIL, ${untested} untested`);
process.exit(bad ? 1 : 0);
