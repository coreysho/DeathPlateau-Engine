// ENAKHRA'S QUARRY, which the quest said did not exist.
//
//   npx tsx tools/sim/enakhquarry.ts
//
// 58 placed instances of loc_10946 and loc_10947, Mine and Prospect on every one, and nothing
// answered either. They are the Desert Quarry: one pit at about 3172,2912 with enakh_scaffold,
// enakh_wheel_barrow and enakh_secret_boulder standing round it, and two rocks already working in
// it - loc_10948 coal and loc_10949 clay.
//
// WHAT WENT WRONG FIRST, because it is the same mistake twice and worth a test that pins the answer
// down. quest_enakh.rs2 carried a comment saying "this cache has no Desert Quarry at all - there is
// not one loc in loc.pack with sandstone or granite in its name - so the rock has to be both the
// pickaxe and the quarry", and enakh_mining_stone was made to stand in for a whole quarry. The
// second half of that sentence is true. The conclusion is not: the quarry is there and simply does
// not have those words in its names. I then repeated the mistake from the other end, reported that
// this build had no sandstone obj at all, and was wrong for the same reason - they are
// enakh_sandstone_tiny through _huge_base+legs and enakh_granite_tiny through _medium.
//
// WHAT IS DELIBERATELY NOT DECIDED HERE. Which of the two rocks is the sandstone and which the
// granite cannot be settled from the build: their ore recolours are 16706 and 18821, and those
// appear on no rock in mining_table, while across every rock that does have a row recol2d is the
// ore. So both run through the quest's own ~enakh_next_block, which hands over whatever the statue
// still needs - exactly what enakh_mining_stone already does - and Prospect names both stones. That
// is why the assertions below are about the BUILD ORDER rather than about one rock giving one ore:
// the order is what the quest actually specifies, and it is what a player needs to get out of here.
import * as H from './harness.js';
import World from '#/engine/World.js';
import LocType from '#/cache/config/LocType.js';
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

const ROCKS = ['loc_10946', 'loc_10947'];
const placed = new Map<string, { x: number; z: number; level: number }[]>();
for (const zone of World.gameMap.existingZones()) {
    for (const loc of zone.getAllLocsUnsafe()) {
        const n = LocType.get(loc.type)?.debugname ?? '';
        if (!ROCKS.includes(n)) continue;
        if (!placed.has(n)) placed.set(n, []);
        placed.get(n)!.push({ x: loc.x, z: loc.z, level: loc.level });
    }
}

const p = H.makePlayer('quarryman', 3222, 3218) as unknown as { x: number; z: number; level: number; teleport: (x: number, z: number, l: number) => void };
H.tick(2);
H.maxOut(p as never);

const offsets: [number, number][] = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
    [1, 1],
    [-1, -1],
    [1, -1],
    [-1, 1]
];

/** Stand next to one instance of `name` and click `op`; returns what was said. */
function clickOne(name: string, op: number): string[] | null {
    for (const { x, z, level } of (placed.get(name) ?? []).slice(0, 6)) {
        for (const [dx, dz] of offsets) {
            if (!walkable(level, x + dx, z + dz)) continue;
            p.teleport(x + dx, z + dz, level);
            H.tick(2);
            H.clearLogs();
            H.opLoc(p as never, x, z, name, op);
            for (let t = 0; t < 14; t++) H.tick(1);
            const said = [...H.mesgs.map(m => m.text), ...H.ifaces.filter(i => i.kind === 'text').map(i => i.text ?? '')];
            if (said.some(s => /can't reach/i.test(s))) continue;
            return said;
        }
    }
    return null;
}

for (const name of ROCKS) {
    console.log('');
    console.log(`-- ${name} (${(placed.get(name) ?? []).length} placed)`);
    if (!(placed.get(name) ?? []).length) {
        check(`${name} is placed in the quarry`, false, 'the map places none');
        continue;
    }

    H.clearInv(p as never);
    const mined = clickOne(name, 1);
    check('Mine answers at all', mined !== null && mined.length > 0, mined === null ? 'no reachable side' : 'said nothing');
    if (mined) {
        check('  and never says nothing interesting happens', !mined.some(s => /interesting/i.test(s)), mined.join(' / '));
        check(
            '  and levers a block out of the face',
            mined.some(s => /lever a block/i.test(s)),
            mined.join(' / ')
        );
    }

    const prospected = clickOne(name, 2);
    check('Prospect names both stones', prospected !== null && prospected.some(s => /sandstone and granite/i.test(s)), prospected ? prospected.join(' / ') : 'no reachable side');
}

// ===================================================================== the order the quest wants
// The 32kg base first, then the 20kg body, then a 5kg lump of granite for the head, then spoil.
// This is the part that matters to a player: whichever rock they pick, the quarry gives them the
// piece they are missing rather than rolling for it.
console.log('');
console.log('-- the build order, mining the same rock four times');
H.clearInv(p as never);
const want = ['enakh_sandstone_huge_base+legs', 'enakh_sandstone_huge_body', 'enakh_granite_medium', 'enakh_sandstone_large'];
for (let i = 0; i < want.length; i++) {
    const said = clickOne('loc_10946', 1);
    if (!said) {
        check(`swing ${i + 1} reached the rock`, false, 'no reachable side');
        break;
    }
    check(`swing ${i + 1} gives ${want[i]}`, H.invCount(p as never, want[i]) > 0, `holding ${H.invCount(p as never, want[i])}; it said ${JSON.stringify(said.slice(-1))}`);
}

console.log('');
console.log(`${ok} ok, ${bad} FAIL`);
process.exit(bad ? 1 : 0);
