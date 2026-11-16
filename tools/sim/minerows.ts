// ROCKS THAT DISPATCH AND THEN DIE - a mining category with no row behind it.
//
//   npx tsx tools/sim/minerows.ts
//
// THE BUG THIS EXISTS FOR IS INVISIBLE TO opsweep. mining.rs2 answers Mine through
// category=mining_rock_*, then immediately does db_find(mining_table:rock, loc_type) and, on null,
// calls ~displaymessage(^dm_default) - "Nothing interesting happens." So a rock with a category but
// no dbrow row LOOKS wired from the outside: the option dispatches, a handler runs, and opsweep,
// which asks whether any script answers the option, is satisfied. The player still gets nothing.
//
// Four locs were in that state - loc_9715 in rimmington_rocks.loc, and loc_11193/11194/11195 in
// all.loc - each with a category and a next_loc_stage_mining, each missing from mine.dbrow.
//
// NONE OF THE FOUR IS PLACED ON THE MAP, which is checked below rather than assumed, and which is
// the honest size of that find: three rows were added to mine.dbrow and no player could ever have
// reached the bug they fix. What they buy is the invariant. The sweep in Part A can now be clean,
// and a clean sweep is what makes it useful against the next rock - one that might well be placed.
// loc_11193 has no row added, deliberately: its ore is unidentifiable, and the next section says
// why that is a question rather than a guess.
//
// IDENTIFYING AN ORE FROM A ROCK, which is what made three of the four safe. Across every rock that
// has a dbrow row, recol2s is always 6342 and recol2d is the ORE: 6242 iron, 4226 coal, 22025 and
// 18854 clay, 14798 and 13741 tin, 26981 and 14596 copper, 31393 and 23108 gold, 19026 silver, 6346
// mithril, 6438 adamantite, 8721 runite, 382 blurite. recol1d is the rock's regional body colour and
// recol1s only says which of the two rock models it is. So a dead rock whose whole four-value
// recolour matches a rock already in a row is that rock's ore, and loc_9715's is byte-identical to
// loc_9716 sitting directly above it in the same file.
//
// loc_11193's ore colour is 18821, which appears on no rock in any row, as does 16706 on loc_10946
// and loc_11192; loc_10947 is 18821 again. Those four are Enakhra's quarry - 58 placed instances of
// the two that the map places, in one pit at about 3172,2912, with two rocks already working in it
// (loc_10948 coal and loc_10949 clay, which is why Part C mines those two).
//
// THEY ARE NOT IN THIS TABLE AND SHOULD NOT BE, and the reason is not the one I first wrote down. I
// reported that this build had no sandstone or granite obj and that the quarry therefore could not
// be wired at all. That was wrong - I searched for objs whose names START with sandstone or granite
// and the build's are enakh_sandstone_tiny through _huge_base+legs and enakh_granite_tiny through
// _medium. The same mistake, made from the other side, is in quest_enakh.rs2's own history: it
// concluded "this cache has no Desert Quarry at all" from there being no LOC with those words in
// its name, and made one rock stand in for the whole pit.
//
// So the quarry is wired now, by quest_enakh rather than by a row here: ~enakh_next_block hands
// over whichever block the statue still needs, which means nothing has to decide which of the two
// rocks is the sandstone and which the granite - a question the recolours cannot answer.
// tools/sim/enakhquarry.ts covers it. A mining_table row would have forced that decision, and a
// direct trigger beats a category in the lookup order, so this sweep no longer sees them at all.
//
// THREE PARTS. Part A is the static sweep and the one that lasts: every loc with a mining category
// and a clickable Mine must be in the table or flagged empty, so it fails for the next rock
// somebody gives a category and forgets a row for - which is exactly how these four happened.
// Part B checks each added loc landed in the row its recolours say it should, and records that the
// map places none of them. Part C mines a PLACED rock out of each of those three tables, because a
// row nobody can reach proves nothing about whether the table behind it works.
import CategoryType from '#/cache/config/CategoryType.js';
import DbRowType from '#/cache/config/DbRowType.js';
import DbTableType from '#/cache/config/DbTableType.js';
import LocType from '#/cache/config/LocType.js';
import ParamType from '#/cache/config/ParamType.js';
import { isHiddenOp } from '#/cache/config/OpVisibility.js';
import World from '#/engine/World.js';

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
const walkable = (level: number, x: number, z: number): boolean => !isFlagged(x, z, level, CollisionFlag.WALK_BLOCKED);

// ======================================================================= Part A: the static sweep
console.log('-- every loc with a mining category must have a row in mining_table');

const tableId = DbTableType.getId('mining_table');
const inTable = new Set<number>();
for (const row of DbRowType.getInTable(tableId)) {
    // column 0 is `rock`, a LIST of loc - the flat value array is exactly the locs the row covers.
    for (const v of row.columnValues[0] ?? []) inTable.add(Number(v));
}

const emptyParam = ParamType.getId('mining_rock_empty');
// No exclusions. There was a list here of four locs whose ore could not be identified - Enakhra's
// quarry - and it is gone because they no longer carry a mining category at all: loc_11193's was
// dropped when quest_enakh took the rock on directly, and the other three never had one. An empty
// exclusion list is the point of this sweep, so if one ever comes back it should come back loudly.

let swept = 0;
const orphans: string[] = [];
for (let id = 0; id < LocType.count; id++) {
    const lt = LocType.get(id);
    if (!lt || lt.category === -1) continue;
    const cat = CategoryType.get(lt.category)?.debugname ?? '';
    if (!cat.startsWith('mining_rock')) continue;
    // Only rocks a player can actually click Mine on.
    const mineable = (lt.op ?? []).some(o => o !== null && /^mine$/i.test(o) && !isHiddenOp(o));
    if (!mineable) continue;
    // A rock flagged empty is meant to have no ore - that is the other half of this feature.
    if (emptyParam !== -1 && lt.params?.get(emptyParam) !== undefined) continue;
    swept++;
    if (!inTable.has(id)) orphans.push(lt.debugname ?? `loc_${id}`);
}

console.log(`   swept ${swept} rocks carrying a mining category with a clickable Mine`);
check('no rock dispatches Mine and then finds no row', orphans.length === 0, orphans.length ? orphans.join(', ') + ' - each will print "Nothing interesting happens"' : '');

// ======================================================================= Part B: the added rows
console.log('');
console.log('-- the three rows added, and whether anything places them');

const ADDED: { name: string; ore: string }[] = [
    { name: 'loc_9715', ore: 'tin' },
    { name: 'loc_11194', ore: 'coal' },
    { name: 'loc_11195', ore: 'clay' }
];

// Column 1 of mining_table is ore_name; column 0 is the rock list read above.
const oreOf = (locId: number): string | null => {
    for (const row of DbRowType.getInTable(tableId)) {
        if (!(row.columnValues[0] ?? []).some(v => Number(v) === locId)) continue;
        return String(row.getValue(1, 0)[0]);
    }
    return null;
};

const placedCount = new Map<string, number>();
for (const zone of World.gameMap.existingZones()) {
    for (const loc of zone.getAllLocsUnsafe()) {
        const n = LocType.get(loc.type)?.debugname ?? '';
        placedCount.set(n, (placedCount.get(n) ?? 0) + 1);
    }
}

for (const { name, ore } of ADDED) {
    const id = LocType.getId(name);
    check(`${name} is in mining_table as ${ore}`, id !== -1 && oreOf(id) === ore, id === -1 ? 'no such loc' : `the table says ${oreOf(id)}`);
    // Stated as an assertion so that it is loud if one of these is ever placed: at that point the
    // row stops being bookkeeping and starts being load-bearing, and somebody should re-read it.
    check('  and nothing on the map places it (so this row fixed no live click)', (placedCount.get(name) ?? 0) === 0, `${placedCount.get(name)} placed - this row is now load-bearing, re-read it`);
}

// ======================================================================= Part C: mine a real rock
// One placed rock per affected table. If tin, coal and clay mine correctly then the rows the three
// unplaced locs joined are rows that work, which is as much as their own unreachability allows.
console.log('');
console.log('-- a placed rock from each table the additions joined');

const SAMPLES: { name: string; ore: string }[] = [
    { name: 'loc_9716', ore: 'tin_ore' },
    { name: 'loc_10948', ore: 'coal' },
    { name: 'loc_10949', ore: 'clay' }
];

const placed = new Map<string, { x: number; z: number; level: number }[]>();
for (const zone of World.gameMap.existingZones()) {
    for (const loc of zone.getAllLocsUnsafe()) {
        const n = LocType.get(loc.type)?.debugname ?? '';
        if (!SAMPLES.some(f => f.name === n)) continue;
        if (!placed.has(n)) placed.set(n, []);
        placed.get(n)!.push({ x: loc.x, z: loc.z, level: loc.level });
    }
}

const p = H.makePlayer('miner', 3222, 3218) as unknown as { x: number; z: number; level: number; teleport: (x: number, z: number, l: number) => void };
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

for (const { name, ore } of SAMPLES) {
    console.log('');
    console.log(`-- ${name}, should give ${ore}`);
    const spots = placed.get(name) ?? [];
    if (!spots.length) {
        console.log(`   UNTESTED - the map places no ${name}`);
        untested++;
        continue;
    }

    let reached = false;
    for (const { x, z, level } of spots.slice(0, 4)) {
        if (reached) break;
        for (const [dx, dz] of offsets) {
            if (reached) break;
            if (!walkable(level, x + dx, z + dz)) continue;
            p.teleport(x + dx, z + dz, level);
            H.clearInv(p as never);
            H.give(p as never, 'adamant_pickaxe', 1);
            H.tick(2);
            const mark = H.mesgs.length;
            H.opLoc(p as never, x, z, name, 1);

            // Same 400-tick budget dwarfgold.ts uses: a rock rolls its chance every few ticks, so a
            // short budget measures the dice rather than the rock.
            let got = false;
            for (let t = 0; t < 400 && !got; t++) {
                H.tick(1);
                const line = H.mesgs.slice(mark).map(m => m.text);
                got = line.some(s => /^You (get|manage to mine) some /.test(s));
                if (line.some(s => /interesting/i.test(s) || /can't reach/i.test(s))) break;
            }
            const said = H.mesgs.slice(mark).map(m => m.text);
            if (said.some(s => /can't reach/i.test(s))) continue;
            reached = true;

            check(`${x},${z},${level} gives ore when mined`, got, said.length ? JSON.stringify(said.slice(0, 2)) : 'said nothing at all');
            // The exact failure a missing row causes, named so a regression is unmistakable.
            check('  and never says nothing interesting happens', !said.some(s => /interesting/i.test(s)));
            check(`  and the ore is ${ore}`, H.invCount(p as never, ore) > 0, `backpack has ${H.invCount(p as never, ore)} ${ore}`);
        }
    }
    if (!reached) {
        console.log(`   UNTESTED ${name} - no standable tile beside any instance`);
        untested++;
    }
}

console.log('');
console.log(`${ok} ok, ${bad} FAIL, ${untested} untested`);
process.exit(bad ? 1 : 0);
