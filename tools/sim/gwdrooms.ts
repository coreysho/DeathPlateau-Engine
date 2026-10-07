// Who garrisons each God Wars room, against what Old School puts there.
//
// All four boss rooms held exactly four npcs - the general and its three bodyguards - and nothing
// else, which is what "the npc spawns ... arent correct to osrs, same with the other rooms" was
// about. Old School garrisons every one of them with that god's rank and file, and puts a few of
// Zamorak's in all of them except Zamorak's own Fortress: "the only one of the four gods' chambers
// that contains only the minions of its god".
//
// THE ROOMS ARE FLOODED, NOT GUESSED, and flooded with canTravel rather than walkable. walkable
// only asks whether a TILE is blocked, so a flood built on it steps straight through walls and
// reports every room and the main chamber as one region of 3,143 tiles with the bosses loose in it.
//
//   npx tsx tools/sim/gwdrooms.ts
import * as H from './harness.ts';
import * as A from './a1lib.ts';
import { check, R } from './a1lib.ts';
import { canTravel } from '#/engine/GameMap.js';
import { CollisionType } from '#/engine/routefinder/index.js';
const { World, NpcType } = A;

await H.boot();

const ROOMS: [string, number, number, number][] = [
    ['main chamber',       2, 2880, 5310],   // ^gwd_entrance_inside, where the hole drops you
    ["Armadyl's Eyrie",    2, 2839, 5296],   // ^gwd_inside_armadyl
    ["Bandos' Stronghold", 2, 2864, 5354],   // ^gwd_inside_bandos
    ["Zamorak's Fortress", 2, 2925, 5331],   // ^gwd_inside_zamorak
    ["Saradomin's Encampment", 0, 2907, 5265], // ^gwd_inside_saradomin
];

function flood(level: number, sx: number, sz: number, limit = 4000) {
    const seen = new Set<string>([`${sx},${sz}`]);
    const q: [number, number][] = [[sx, sz]];
    while (q.length && seen.size < limit) {
        const [cx, cz] = q.pop()!;
        for (const [dx, dz] of [[1,0],[-1,0],[0,1],[0,-1]] as const) {
            const nx = cx + dx, nz = cz + dz, k = `${nx},${nz}`;
            if (seen.has(k) || Math.abs(nx - sx) > 90 || Math.abs(nz - sz) > 90) continue;
            // canTravel, not walkable: walkable only asks whether the TILE is blocked, so a flood
            // built on it walks straight through walls and merges every room into one.
            if (canTravel(level, cx, cz, dx, dz, 1, 0, CollisionType.NORMAL)) { seen.add(k); q.push([nx, nz]); }
        }
    }
    return seen;
}

// every npc in the dungeon's four squares
const all: { name: string; x: number; z: number; level: number }[] = [];
for (const npc of World.npcs) {
    if (!npc) continue;
    const t: any = NpcType.get(npc.type);
    const n = t.debugname ?? String(npc.type);
    if (npc.x < 2816 || npc.x > 2944 || npc.z < 5248 || npc.z > 5376) continue;
    all.push({ name: n, x: npc.x, z: npc.z, level: npc.level });
}
console.log(`npcs inside the dungeon's squares: ${all.length}`);

const god = (n: string) =>
    /armadyl|aviansie|kreearra|kilisa|geerin|skree/.test(n) ? 'armadyl' :
    /bandos|ork|goblin|hobgoblin|ogre|jogre|cyclops|graardor|strongstack|steelwill|grimspike/.test(n) ? 'bandos' :
    /saradomin|knight|priest|zilyana|starlight|growler|bree/.test(n) ? 'saradomin' :
    /zamorak|imp|icefiend|pyrefiend|bloodveld|werewolf|hellhound|gorak|vampyre|kril|balfrug|tstanon|zakln/.test(n) ? 'zamorak' : '?';

const claimed = new Set<string>();
for (const [label, lv, x, z] of ROOMS) {
    const tiles = flood(lv, x, z);
    const here = all.filter(n => n.level === lv && tiles.has(`${n.x},${n.z}`) && !claimed.has(`${n.name}@${n.x},${n.z}`));
    here.forEach(n => claimed.add(`${n.name}@${n.x},${n.z}`));
    const by: Record<string, number> = {};
    for (const n of here) by[god(n.name)] = (by[god(n.name)] ?? 0) + 1;
    console.log(`\n${label}  (${tiles.size} tiles, ${here.length} npcs)`);
    console.log('   by god: ' + Object.entries(by).map(([g, c]) => `${g} ${c}`).join('  '));
    const kinds: Record<string, number> = {};
    for (const n of here) kinds[n.name] = (kinds[n.name] ?? 0) + 1;
    console.log('   ' + Object.entries(kinds).sort((a, b) => b[1] - a[1]).map(([k, c]) => `${c}x ${k}`).join(', '));
}
const left = all.filter(n => !claimed.has(`${n.name}@${n.x},${n.z}`));
console.log(`\nin none of the five regions (corridors and antechambers): ${left.length}`);

console.log('\nEVERY ROOM IS GARRISONED, AND BY THE RIGHT GODS');
for (const [label, lv, x, z] of ROOMS) {
    const tiles = flood(lv, x, z);
    const here = all.filter(n => n.level === lv && tiles.has(`${n.x},${n.z}`));
    const by: Record<string, number> = {};
    for (const n of here) by[god(n.name)] = (by[god(n.name)] ?? 0) + 1;
    const own = label.startsWith('Armadyl') ? 'armadyl' : label.startsWith('Bandos') ? 'bandos'
              : label.startsWith('Zamorak') ? 'zamorak' : label.startsWith('Saradomin') ? 'saradomin' : null;
    if (!own) {
        check(`  ${label.padEnd(24)} has all four gods in it`,
            ['armadyl', 'bandos', 'saradomin', 'zamorak'].every(g => (by[g] ?? 0) > 0), true);
        continue;
    }
    check(`  ${label.padEnd(24)} is more than its boss and bodyguards`, here.length > 8, true);
    check(`  ${label.padEnd(24)} is mostly its own god`, (by[own] ?? 0) * 2 >= here.length, true);
    if (own === 'zamorak') {
        check("  the Fortress holds nothing but Zamorak's", Object.keys(by).filter(g => g !== 'zamorak'), []);
    } else {
        check(`  ${label.padEnd(24)} has Zamorak minions in it too`, (by.zamorak ?? 0) > 0, true);
    }
}
console.log(`\n${R.ok} ok, ${R.bad} FAIL`);
process.exit(0);
