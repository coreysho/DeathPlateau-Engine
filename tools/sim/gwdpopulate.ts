// Fill the four boss rooms, which hold nothing but the boss and its three bodyguards.
//
// Old School puts a garrison in each: its own god's rank and file, plus a few of Zamorak's in all
// of them except Zamorak's own Fortress, which the wiki calls "the only one of the four gods'
// chambers that contains only the minions of its god".
//
// Tiles come out of the running engine, not off the map picture: a drawn tile can still be blocked
// by a loc standing on it, and a size-2 npc needs all four of its squares or the spawn is silently
// dropped and the room is emptier than the file says.
import { writeFileSync } from 'fs';
import * as H from './harness.ts';
import * as A from './a1lib.ts';
import { canTravel } from '#/engine/GameMap.js';
import { CollisionType } from '#/engine/routefinder/index.js';
const { World, NpcType } = A;

await H.boot();

type Room = { label: string; level: number; x: number; z: number; roster: [string, number][] };
const ROOMS: Room[] = [
    { label: "Armadyl's Eyrie", level: 2, x: 2839, z: 5296, roster: [
        ['gwd_aviansie_2', 1], ['gwd_aviansie_6', 1], ['gwd_aviansie_9', 1], ['gwd_aviansie_12', 1],
        ['gwd_aviansie_14', 1], ['gwd_aviansie_5', 1],
        ['gwd_spiritual_warrior_armadyl', 2], ['gwd_spiritual_mage_armadyl', 2], ['gwd_spiritual_ranger_armadyl', 2],
        ['gwd_bloodveld', 1], ['gwd_werewolf_1', 1], ['gwd_spiritual_ranger_zamorak', 1] ] },
    { label: "Bandos' Stronghold", level: 2, x: 2864, z: 5354, roster: [
        ['gwd_ork_1', 1], ['gwd_ork_2', 1], ['gwd_ork_3', 1], ['gwd_ork_4', 1],
        ['gwd_cyclops', 2], ['gwd_jogre', 2],
        ['gwd_spiritual_warrior_bandos', 2], ['gwd_spiritual_mage_bandos', 2], ['gwd_spiritual_ranger_bandos', 2],
        ['gwd_bloodveld', 1], ['gwd_hellhound', 1], ['gwd_imp', 1], ['gwd_werewolf_2', 1] ] },
    { label: "Saradomin's Encampment", level: 0, x: 2907, z: 5265, roster: [
        ['gwd_saradomin_knight_1', 2], ['gwd_saradomin_knight_2', 2], ['gwd_saradomin_priest', 2],
        ['gwd_spiritual_warrior_saradomin', 2], ['gwd_spiritual_mage_saradomin', 2], ['gwd_spiritual_ranger_saradomin', 2],
        ['gwd_werewolf_1', 1], ['gwd_icefiend', 1], ['gwd_gorak', 1] ] },
    { label: "Zamorak's Fortress", level: 2, x: 2925, z: 5331, roster: [
        ['gwd_spiritual_warrior_zamorak', 3], ['gwd_spiritual_mage_zamorak', 3], ['gwd_spiritual_ranger_zamorak', 3],
        ['gwd_imp', 2], ['gwd_bloodveld', 2], ['gwd_gorak', 1], ['gwd_hellhound', 2] ] },
];

function room(level: number, sx: number, sz: number) {
    const seen = new Set<string>([`${sx},${sz}`]);
    const q: [number, number][] = [[sx, sz]];
    while (q.length) {
        const [cx, cz] = q.pop()!;
        for (const [dx, dz] of [[1,0],[-1,0],[0,1],[0,-1]] as const) {
            const k = `${cx + dx},${cz + dz}`;
            if (seen.has(k) || Math.abs(cx + dx - sx) > 60 || Math.abs(cz + dz - sz) > 60) continue;
            if (canTravel(level, cx, cz, dx, dz, 1, 0, CollisionType.NORMAL)) { seen.add(k); q.push([cx + dx, cz + dz]); }
        }
    }
    return seen;
}

// every square an npc already standing in the dungeon occupies, footprint included
const taken = new Set<string>();
for (const npc of World.npcs) {
    if (!npc) continue;
    const t: any = NpcType.get(npc.type);
    const s = t.size ?? 1;
    for (let dx = 0; dx < s; dx++) for (let dz = 0; dz < s; dz++) taken.add(`${npc.level}:${npc.x + dx},${npc.z + dz}`);
}

const out: { room: string; name: string; x: number; z: number; level: number }[] = [];
for (const r of ROOMS) {
    const tiles = room(r.level, r.x, r.z);
    const free = [...tiles].map(s => s.split(',').map(Number) as [number, number])
        .sort((a, b) => a[1] - b[1] || a[0] - b[0]);
    let placed = 0, skipped = 0;
    for (const [name, n] of r.roster) {
        const id = NpcType.getId(name);
        const size = (NpcType.get(id) as any).size ?? 1;
        for (let i = 0; i < n; i++) {
            const spot = free.find(([x, z]) => {
                for (let dx = 0; dx < size; dx++) for (let dz = 0; dz < size; dz++) {
                    if (!tiles.has(`${x + dx},${z + dz}`)) return false;
                    if (taken.has(`${r.level}:${x + dx},${z + dz}`)) return false;
                }
                // elbow room, so the garrison is spread rather than piled by the door
                return !out.some(o => o.level === r.level && Math.abs(o.x - x) < 3 && Math.abs(o.z - z) < 3)
                    && !(Math.abs(x - r.x) < 2 && Math.abs(z - r.z) < 2);
            });
            if (!spot) { skipped++; continue; }
            for (let dx = 0; dx < size; dx++) for (let dz = 0; dz < size; dz++) taken.add(`${r.level}:${spot[0] + dx},${spot[1] + dz}`);
            out.push({ room: r.label, name, x: spot[0], z: spot[1], level: r.level });
            placed++;
        }
    }
    console.log(`${r.label}: ${tiles.size} tiles, placed ${placed}${skipped ? `, no room for ${skipped}` : ''}`);
}
writeFileSync('../gwdspawns.json', JSON.stringify(out, null, 1));
console.log(`\n${out.length} spawns written`);
process.exit(0);
