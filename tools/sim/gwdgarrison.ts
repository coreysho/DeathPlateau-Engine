// WHO GARRISONS EACH GOD'S ENCAMPMENT, against the one rule Old School states outright.
//
//   npx tsx tools/sim/gwdgarrison.ts            # report
//   npx tsx tools/sim/gwdgarrison.ts --edits     # and the jm2 lines that would fix it
//
// Reported from the game as "gwd followers in wrong locations still". The rule is on the dungeon's
// own wiki page twice - in prose, "Each chamber contains many minions of the chamber's god. Some
// Zamorak minions also appear in the Armadyl, Bandos, and Saradomin chambers", and in the table of
// which god item you must wear where, which gives Armadyl's Eyrie a yes under Armadyl and Zamorak
// and a no under Bandos and Saradomin, and Zamorak's Fortress a yes under Zamorak alone.
//
// So: an npc belongs in a chamber if it follows that chamber's god, or if it follows Zamorak and
// the chamber is not Zamorak's. Everything else is in the wrong place. The test is the npc's own
// gwd_god param - the same one the killcount and the aggression read - rather than a list of names.
//
// THE MAIN CHAMBER IS NOT IN THIS. "This is where the majority of the fighting takes place, with a
// free-for-all between each god's forces", so all four gods belong there and it is only reported.
//
// THE REGIONS ARE FLOODED WITH canTravel, not read off a box: the four chambers are shut off from
// the main chamber by the four obstacles, and Saradomin's is two rope-climbs down, so it is on
// levels 1 and 0 of m45_82 and no rectangle finds it.
import { writeFileSync } from 'fs';
import * as H from './harness.ts';
import * as A from './a1lib.ts';
import ParamType from '#/cache/config/ParamType.js';
import { canTravel } from '#/engine/GameMap.js';
import { CollisionType } from '#/engine/routefinder/index.js';
import Npc from '#/engine/entity/Npc.js';
const { World, NpcType } = A;

await H.boot();

const GOD = ParamType.getId('gwd_god');
const NAME: Record<number, string> = { 0: 'none', 1: 'armadyl', 2: 'bandos', 3: 'saradomin', 4: 'zamorak' };
const godOf = (n: Npc) => NAME[(NpcType.get(n.type) as never as { params?: Map<number, number> }).params?.get(GOD) ?? 0] ?? '?';

function flood(level: number, seeds: [number, number][], limit = 4000) {
    const seen = new Set<string>(seeds.map(([x, z]) => `${x},${z}`));
    const q: [number, number][] = [...seeds];
    while (q.length && seen.size < limit) {
        const [cx, cz] = q.pop()!;
        for (const [dx, dz] of [
            [1, 0],
            [-1, 0],
            [0, 1],
            [0, -1]
        ] as const) {
            const k = `${cx + dx},${cz + dz}`;
            if (seen.has(k)) continue;
            if (canTravel(level, cx, cz, dx, dz, 1, 0, CollisionType.NORMAL)) {
                seen.add(k);
                q.push([cx + dx, cz + dz]);
            }
        }
    }
    return seen;
}

// Each chamber, and where to start flooding it from: the landing side of its obstacle and the
// corridor side of its boss door, so a chamber split by its own furniture is still one region.
// Saradomin's is two planes, which is why this is a list of (level, seeds) rather than one pair.
type Camp = { label: string; god: string; parts: [number, [number, number][]][] };
const CAMPS: Camp[] = [
    {
        label: "Armadyl's Eyrie",
        god: 'armadyl',
        parts: [
            [
                2,
                [
                    [2871, 5269],
                    [2839, 5294]
                ]
            ]
        ]
    },
    {
        label: "Bandos' Stronghold",
        god: 'bandos',
        parts: [
            [
                2,
                [
                    [2850, 5333],
                    [2862, 5354]
                ]
            ]
        ]
    },
    {
        label: "Zamorak's Fortress",
        god: 'zamorak',
        parts: [
            [
                2,
                [
                    [2885, 5345],
                    [2925, 5333]
                ]
            ]
        ]
    },
    {
        label: "Saradomin's Encampment",
        god: 'saradomin',
        parts: [
            [1, [[2915, 5300]]],
            [
                0,
                [
                    [2919, 5274],
                    [2909, 5265]
                ]
            ]
        ]
    }
];
const BOSSROOMS: [number, number, number][] = [
    [2, 2839, 5296],
    [2, 2864, 5354],
    [2, 2925, 5331],
    [0, 2907, 5265]
];

// SPAWN TILE, NOT WHERE IT IS STANDING. An npc with a wanderrange has already moved by the time
// the world is a tick old, so n.x is where it happens to be and startX is the line in the map file.
// Writing edits against the live position looks right in the report and matches nothing on disk.
const home = (n: Npc) => [n.startX, n.startZ, n.startLevel] as [number, number, number];
const inDungeon = (n: Npc) => n.startX >= 2816 && n.startX <= 2943 && n.startZ >= 5248 && n.startZ <= 5375;
const all = [...World.npcs].filter((n): n is Npc => !!n && inDungeon(n));

// the boss rooms are their own thing - a general, three bodyguards and an altar - and are excluded
const bossTiles = new Set<string>();
for (const [lvl, x, z] of BOSSROOMS) for (const t of flood(lvl, [[x, z]])) bossTiles.add(`${lvl}:${t}`);

const wrong: { camp: string; npc: Npc; god: string }[] = [];
for (const c of CAMPS) {
    const tiles = new Set<string>();
    for (const [lvl, seeds] of c.parts) for (const t of flood(lvl, seeds)) tiles.add(`${lvl}:${t}`);
    const here = all.filter(n => tiles.has(`${n.startLevel}:${n.startX},${n.startZ}`) && !bossTiles.has(`${n.startLevel}:${n.startX},${n.startZ}`));
    const byGod: Record<string, number> = {};
    for (const n of here) {
        const g = godOf(n);
        byGod[g] = (byGod[g] ?? 0) + 1;
    }
    const allowed = c.god === 'zamorak' ? ['zamorak'] : [c.god, 'zamorak'];
    const bad = here.filter(n => !allowed.includes(godOf(n)));
    bad.forEach(n => wrong.push({ camp: c.label, npc: n, god: godOf(n) }));
    console.log(`\n${c.label}  (${tiles.size} tiles, ${here.length} npcs, may hold ${allowed.join(' + ')})`);
    console.log('   by god:', JSON.stringify(byGod));
    if (bad.length) {
        const k: Record<string, number> = {};
        for (const n of bad) {
            const d = `${NpcType.get(n.type).debugname} (${godOf(n)})`;
            k[d] = (k[d] ?? 0) + 1;
        }
        console.log(
            `   IN THE WRONG CHAMBER: ${bad.length} - ${Object.entries(k)
                .sort()
                .map(([a, b]) => `${b}x ${a}`)
                .join(', ')}`
        );
    } else {
        console.log('   every one of them follows a god that belongs here');
    }
}
console.log(`\n${wrong.length} npcs are standing in a chamber whose god they do not follow`);

// ---------------------------------------------------------------- what to do about it
// TWO EDITS, AND NEITHER ADDS AN NPC TO THE DUNGEON.
//
// A misplaced follower is RE-GODDED where it stands rather than deleted. Every one of the 48 is a
// spiritual warrior, ranger or mage, and all twelve rank-and-god combinations exist, so the fix is
// the same rank under the chamber's own god on the same tile: somebody chose those tiles, the
// density is right, and only the allegiance was wrong.
//
// AND SARADOMIN'S KNIGHTS AND PRIESTS MOVE INTO SARADOMIN'S ENCAMPMENT, because that is the other
// half of "followers in wrong locations": the wiki says "all of Saradomin's forces can be found
// here: Knights, priests, and spiritual mages, rangers, and warriors", and this build had every
// one of them in the main chamber and none in the chamber. Half of each kind moves and half stays,
// since the main chamber holds all four gods' forces too ("like the main area").
const SPIRITUAL = /^gwd_spiritual_(warrior|ranger|mage)_(armadyl|bandos|saradomin|zamorak)$/;
type Edit = { map: string; from: string; to: string | null; why: string };
const edits: Edit[] = [];
const jm2 = (lvl: number, x: number, z: number, type: number) => `${lvl} ${x & 63} ${z & 63}: ${type}`;
const mapOf = (x: number, z: number) => `m${x >> 6}_${z >> 6}`;

for (const w of wrong) {
    const dbg = NpcType.get(w.npc.type).debugname ?? '';
    const m = SPIRITUAL.exec(dbg);
    const camp = CAMPS.find(c => c.label === w.camp)!;
    if (!m) {
        console.log(`  ! ${dbg} in ${w.camp} is not a spiritual - left alone, needs a decision`);
        continue;
    }
    const want = `gwd_spiritual_${m[1]}_${camp.god}`;
    const id = NpcType.getId(want);
    if (id === -1) {
        console.log(`  ! no ${want} exists`);
        continue;
    }
    const [hx, hz, hl] = home(w.npc);
    edits.push({
        map: mapOf(hx, hz),
        from: jm2(hl, hx, hz, w.npc.type),
        to: jm2(hl, hx, hz, id),
        why: `${dbg} -> ${want} in ${w.camp}`
    });
}

// the move: half the main chamber's Saradomin knights and priests go down the ropes
{
    const mainTiles = flood(2, [[2880, 5310]]);
    const campTiles = new Set<string>();
    const sara = CAMPS.find(c => c.god === 'saradomin')!;
    for (const [lvl, seeds] of sara.parts) for (const t of flood(lvl, seeds)) campTiles.add(`${lvl}:${t}`);
    const occupied = new Set<string>();
    for (const n of all) {
        const sz = (NpcType.get(n.type) as never as { size?: number }).size ?? 1;
        for (let dx = 0; dx < sz; dx++) for (let dz = 0; dz < sz; dz++) occupied.add(`${n.startLevel}:${n.startX + dx},${n.startZ + dz}`);
    }
    const free = [...campTiles]
        .map(k => {
            const [l, xz] = k.split(':');
            const [x, z] = xz.split(',').map(Number);
            return [Number(l), x, z] as [number, number, number];
        })
        .filter(([l, x, z]) => !occupied.has(`${l}:${x},${z}`) && !bossTiles.has(`${l}:${x},${z}`))
        .sort((a, b) => a[0] - b[0] || a[2] - b[2] || a[1] - b[1]);
    for (const kind of ['gwd_saradomin_priest', 'gwd_saradomin_knight_1', 'gwd_saradomin_knight_2']) {
        const id = NpcType.getId(kind);
        const inMain = all.filter(n => n.type === id && n.startLevel === 2 && mainTiles.has(`${n.startX},${n.startZ}`));
        const inCamp = all.filter(n => n.type === id && campTiles.has(`${n.startLevel}:${n.startX},${n.startZ}`));
        // HALF OF THE TOTAL, not half of what is left in the main chamber. Written the second way
        // this tool moves another half every time it is run, so it never settles and can never be
        // used as a check - it would keep draining the main chamber one halving at a time.
        const want = Math.floor((inMain.length + inCamp.length) / 2);
        const take = Math.max(0, Math.min(inMain.length, want - inCamp.length));
        for (let i = 0; i < take; i++) {
            const n = inMain[i];
            const size = (NpcType.get(id) as never as { size?: number }).size ?? 1;
            const spotIdx = free.findIndex(([l, x, z]) => {
                for (let dx = 0; dx < size; dx++)
                    for (let dz = 0; dz < size; dz++) {
                        if (!campTiles.has(`${l}:${x + dx},${z + dz}`)) return false;
                        if (occupied.has(`${l}:${x + dx},${z + dz}`)) return false;
                    }
                return !edits.some(e => e.to && e.to.startsWith(`${l} `) && Math.abs(Number(e.to.split(' ')[1]) - (x & 63)) < 3 && Math.abs(Number(e.to.split(' ')[2].replace(':', '')) - (z & 63)) < 3);
            });
            if (spotIdx < 0) {
                console.log(`  ! no room in the encampment for a ${kind}`);
                continue;
            }
            const [l, x, z] = free.splice(spotIdx, 1)[0];
            for (let dx = 0; dx < size; dx++) for (let dz = 0; dz < size; dz++) occupied.add(`${l}:${x + dx},${z + dz}`);
            const [nx, nz, nl] = home(n);
            edits.push({ map: mapOf(nx, nz), from: jm2(nl, nx, nz, id), to: null, why: `${kind} leaves the main chamber` });
            edits.push({ map: mapOf(x, z), from: '', to: jm2(l, x, z, id), why: `${kind} joins Saradomin's Encampment at ${l},${x},${z}` });
        }
    }
}

console.log(`\n${edits.length} map edits`);
for (const e of edits) console.log(`  ${e.map.padEnd(8)} ${e.from || '(new)'} -> ${e.to ?? '(removed)'}   ${e.why}`);
if (process.argv.includes('--edits')) {
    writeFileSync('../gwdgarrison.json', JSON.stringify(edits, null, 1));
    console.log('\nwrote ../gwdgarrison.json');
}
process.exit(0);
