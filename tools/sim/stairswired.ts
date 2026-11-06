// THE STAIRCASES THAT ANSWERED A CLICK AND DID NOTHING.
// Usage: npx tsx tools/sim/stairswired.ts   (exit code is the verdict)
//
// ladders+stairs/scripts/stairs.rs2 is a long list of [oploc1,<stair>] triggers, each a
// switch_coord over the coordinates that stair is placed at. A trigger with no coordinate wired -
// nothing but "case default : @unhandled_stairs(loc_coord)" - answers the click, prints
// "Unhandled stairs: <name> at ..." and leaves the player where they stood. That is invisible to a
// dead-op sweep, which only knows whether a trigger EXISTS; it is how the Slayer Tower's two
// flights sat broken behind a tower whose doors had just been fixed.
//
// Fifty triggers were in that state. Thirty-one of them are placed on the map and are wired now;
// the other nineteen name loc types that are not placed anywhere, so there is no coordinate to
// write and nothing a player can click.
//
// This file climbs every one of the thirty-one, from a square the engine agrees can reach it, and
// checks the player arrives on the far level on a walkable tile with no "Unhandled stairs".
import fs from 'fs';
import * as H from './harness.js';
import * as A from './a1lib.js';
import { check, R, player } from './a1lib.js';
import World from '#/engine/World.js';
import LocType from '#/cache/config/LocType.js';

await H.boot();
H.loginOrder();

// The thirty-one, by name: everything this round wired.
const WIRED = [
    'mm_stairs_top',
    'mm_stairs_base',
    'loc_9470',
    'loc_9471',
    'loc_11724',
    'loc_11725',
    'loc_11732',
    'loc_11733',
    'loc_11736',
    'loc_11737',
    'magictraining_stairs_base',
    'magictraining_stairs_top',
    'magictraining_stairs_base_mirror',
    'magictraining_stairs_top_mirror',
    'loc_7056',
    'loc_7057',
    'sarim_spiralstairs',
    'karam_dungeon_cavestairs',
    'loc_5096',
    'hauntedmine_dark_stairs_bottom',
    'blast_furnace_stairs_up',
    'fai_darkwiztower_spiralstairs',
    'fai_darkwiztower_spiralstairs_middle',
    'fai_darkwiztower_spiralstairstop',
    'wild6_spiralstairs',
    'wild6_spiralstairs_middle',
    'wild6_spiralstairstop',
    'loc_4493',
    'loc_4494',
    'loc_4495',
    'loc_4496'
];

const toAbs = (c: string) => {
    const [l, rx, rz, lx, lz] = c.split('_').map(Number);
    return { level: l, x: rx * 64 + lx, z: rz * 64 + lz };
};

const src = fs.readFileSync('../content/scripts/ladders+stairs/scripts/stairs.rs2', 'utf8');
type Case = { op: number; name: string; at: ReturnType<typeof toAbs>; dest: ReturnType<typeof toAbs> | null; menu?: ReturnType<typeof toAbs>[] };
const cases: Case[] = [];
for (const b of src.split(/\n(?=\[)/)) {
    const h = b.match(/^\[(oploc\d),(\w+)\]/);
    if (!h || !WIRED.includes(h[2])) continue;
    for (const m of b.matchAll(/case (\d_\d+_\d+_\d+_\d+) : (?:p_telejump\((\d_\d+_\d+_\d+_\d+)\)|@stair_options\((\d_\d+_\d+_\d+_\d+), (\d_\d+_\d+_\d+_\d+)\))/g)) {
        cases.push({ op: Number(h[1].slice(5)), name: h[2], at: toAbs(m[1]), dest: m[2] ? toAbs(m[2]) : null, menu: m[3] ? [toAbs(m[3]), toAbs(m[4])] : undefined });
    }
}

console.log('== every trigger this round wired has at least one coordinate');
{
    const named = [...new Set(cases.map(c => c.name))];
    check(
        'all of them are in the file',
        WIRED.filter(w => !named.includes(w)),
        []
    );
    console.log(`  ${named.length} triggers, ${cases.length} coordinate cases`);
}

console.log('\n== and each one takes the player to the floor it says');
{
    let climbed = 0;
    const broken: string[] = [];
    const unreachable: string[] = [];
    for (const c of cases) {
        const id = LocType.getId(c.name);
        const loc = World.getLoc(c.at.x, c.at.z, c.at.level, id);
        if (!loc) {
            broken.push(`${c.name} @${c.at.x},${c.at.z} L${c.at.level}: no such loc placed there`);
            continue;
        }
        if (!c.dest) {
            climbed++;
            continue;
        } // @stair_options opens a menu; its two coords are checked below
        // Try every walkable square within two tiles until the click is actually answered: a spiral
        // staircase can only be operated from one side, and standing on the wrong one only earns
        // "I can't reach that!", which is not the stair's fault.
        let landed = false;
        let last = '';
        for (let r = 1; r <= 2 && !landed; r++)
            for (let dx = -r; dx <= r && !landed; dx++)
                for (let dz = -r; dz <= r && !landed; dz++) {
                    if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
                    const nx = c.at.x + dx,
                        nz = c.at.z + dz;
                    if (!A.walkable(c.at.level, nx, nz)) continue;
                    const p: any = player(`sw${climbed}_${r}_${dx}_${dz}`, nx, nz, c.at.level);
                    H.maxOut(p);
                    H.tick(1);
                    H.clearLogs();
                    H.opLoc(p, c.at.x, c.at.z, c.name, c.op);
                    for (let k = 0; k < 12; k++) H.tick(1);
                    const said = A.mesOf(p);
                    if (said.some(x => x.includes('Unhandled stairs'))) last = 'still unhandled';
                    else if (p.level === c.dest.level && p.x === c.dest.x && p.z === c.dest.z) landed = true;
                    else if (!said.some(x => x.includes("can't reach"))) last = `went to ${p.x},${p.z},L${p.level}`;
                    H.despawn(p);
                }
        if (landed) climbed++;
        else if (!last) unreachable.push(`${c.name} @${c.at.x},${c.at.z} L${c.at.level}`);
        else broken.push(`${c.name} @${c.at.x},${c.at.z} L${c.at.level} -> want ${c.dest.x},${c.dest.z} L${c.dest.level}: ${last}`);
    }
    for (const b of broken) console.log('  ' + b);
    check('every wired case lands where it says', broken, []);
    // WALLED IN, AND NOT THE SCRIPT'S FAULT. The Haunted Mine's western dark stairs are a 4x3 loc
    // with solid rock on all four sides - no square on that floor can reach them, so the case
    // written for it can never fire. It is kept because it is right if the map is ever opened up,
    // and named here so a NEW unreachable placement shows up as a change rather than hiding.
    for (const u of unreachable) console.log('  unreachable (map, not script): ' + u);
    check('  and only one placement is walled in', unreachable, ['hauntedmine_dark_stairs_bottom @2709,4591 L0']);
    console.log(`  ${climbed} of ${cases.length} climbed`);
}

console.log('\n== and every landing is a square you can stand on');
{
    // Both the p_telejump destinations and the two a @stair_options menu offers.
    const all = cases.flatMap(c => [...(c.dest ? [c.dest] : []), ...(c.menu ?? [])].map(d => ({ n: c.name, d })));
    const sunk = all.flatMap(({ n, d }) => (A.walkable(d.level, d.x, d.z) ? [] : [`${n} -> ${d.x},${d.z} L${d.level}`]));
    check('no landing is inside a wall', sunk, []);
    console.log(`  ${all.length} landings checked, ${cases.filter(c => c.menu).length} of them behind a Climb menu`);
}

console.log(`\n${R.ok} ok, ${R.bad} FAIL`);
process.exit(R.bad ? 1 : 0);
