// Lunar Isle, on the real engine.
//
//   npx tsx tools/sim/lunarisle.ts          the doors, opened and closed for real
//   npx tsx tools/sim/lunarisle.ts dead     everything clickable there that answers to nothing
//
// The island came across with import474map.py and almost nothing on it was wired. The doors are
// done; the rest is listed by the `dead` mode so it can be worked through rather than rediscovered.
import World from '#/engine/World.js';
import * as H from './harness.ts';
import LocType from '#/cache/config/LocType.js';
import NpcType from '#/cache/config/NpcType.js';
import ScriptProvider from '#/engine/script/ScriptProvider.js';
import ServerTriggerType from '#/engine/script/ServerTriggerType.js';
import { isFlagged, canTravel, isZoneAllocated } from '#/engine/GameMap.js';
import { CollisionFlag, CollisionType } from '#/engine/routefinder/index.js';

await H.boot();
const X1 = 2040, Z1 = 3870, X2 = 2180, Z2 = 3970;
let ok = 0, fail = 0;
const check = (what: string, got: unknown, want: unknown, note?: string) => {
    const good = JSON.stringify(got) === JSON.stringify(want);
    console.log(`  ${good ? 'ok  ' : 'FAIL'} ${what}${good ? '' : `  got ${JSON.stringify(got)} want ${JSON.stringify(want)}${note ? ' - ' + note : ''}`}`);
    good ? ok++ : fail++;
};

type P = { id: number; x: number; z: number; level: number };
function placed(): P[] {
    const out: P[] = [];
    for (const zone of ((World.gameMap as any).zonemap.zones as Map<number, any>).values())
        for (const loc of zone.getAllLocsUnsafe())
            if (loc.x >= X1 && loc.x <= X2 && loc.z >= Z1 && loc.z <= Z2)
                out.push({ id: loc.type, x: loc.x, z: loc.z, level: loc.level });
    return out;
}
const nameOf = (id: number) => LocType.get(id).debugname ?? String(id);

// HOW MUCH OF THE WORLD IS JOINED TO THIS TILE. Landing somewhere "not blocked" is not enough:
// a one-tile ledge passes that and still strands you. This is the same flood fill npcspawns.ts
// uses, and it takes CollisionFlag.WALK_BLOCKED - which is 0x240100. A bare 0x1, which this
// file used to pass, is a bit nothing sets, so every tile on the map came back walkable and
// the check was answering nothing.
function reach(level: number, x: number, z: number, cap = 200): number {
    if (!isZoneAllocated(level, x, z) || isFlagged(x, z, level, CollisionFlag.WALK_BLOCKED)) return 0;
    const seen = new Set([`${x},${z}`]);
    const q: [number, number][] = [[x, z]];
    while (q.length && seen.size < cap) {
        const [cx, cz] = q.pop()!;
        for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            const k = `${cx + dx},${cz + dz}`;
            if (!seen.has(k) && canTravel(level, cx, cz, dx, dz, 1, 0, CollisionType.NORMAL)) {
                seen.add(k);
                q.push([cx + dx, cz + dz]);
            }
        }
    }
    return seen.size;
}

if (process.argv[2] === 'dead') {
    const seen = new Map<string, { n: number; ops: string; sample: string }>();
    for (const p of placed()) {
        const t = LocType.get(p.id);
        const ops = (t.op ?? []).filter(Boolean);
        if (!ops.length) continue;
        const answered = ops.some((_, i) =>
            ScriptProvider.getByTriggerSpecific(ServerTriggerType.OPLOC1 + i, t.id, -1) ||
            ScriptProvider.getByTrigger(ServerTriggerType.OPLOC1 + i, t.id, t.category));
        if (answered) continue;
        const k = nameOf(p.id);
        const e = seen.get(k) ?? { n: 0, ops: ops.join(','), sample: `${p.x},${p.z},${p.level}` };
        e.n++; seen.set(k, e);
    }
    console.log('LOCS ON LUNAR ISLE THAT ANSWER TO NOTHING');
    for (const [k, e] of [...seen].sort((a, b) => b[1].n - a[1].n))
        console.log(`  ${k.padEnd(20)} x${String(e.n).padEnd(3)} [${e.ops}]  e.g.(${e.sample})`);
    const npcs: string[] = [];
    for (const n of World.npcs) {
        if (n.x < X1 || n.x > X2 || n.z < Z1 || n.z > Z2) continue;
        const t = NpcType.get(n.type);
        (t.op ?? []).forEach((o, i) => {
            if (!o) return;
            if (ScriptProvider.getByTriggerSpecific(ServerTriggerType.OPNPC1 + i, t.id, -1) ||
                ScriptProvider.getByTrigger(ServerTriggerType.OPNPC1 + i, t.id, t.category)) return;
            npcs.push(`  ${(t.debugname ?? '').padEnd(24)} op${i + 1}=${o}  (${n.x},${n.z},${n.level})`);
        });
    }
    console.log('\nNPC OPS ON LUNAR ISLE THAT ANSWER TO NOTHING');
    npcs.sort().forEach(x => console.log(x));
    process.exit(0);
}

console.log('THE DOORS, OPENED AND CLOSED FOR REAL');
const DOORS = ['loc474_16776', 'loc474_16778', 'loc474_16902'];
const all = placed();
for (const door of DOORS) {
    const id = LocType.getId(door);
    const spot = all.find(p => p.id === id);
    if (!spot) { check(`${door}: is placed on the island`, false, true); continue; }

    // Stand beside it. A door is a wall loc, so the tile it sits on is the one you walk to.
    const p = H.makePlayer('lunar' + door, spot.x + 1, spot.z, 300 + DOORS.indexOf(door));
    H.tick(1); H.maxOut(p); p.teleport(spot.x + 1, spot.z, spot.level); H.tick(1);

    H.opLoc(p, spot.x, spot.z, door, 1);
    H.tick(3);
    // ~open_door deletes the closed loc and adds the open one a tile over, turned a quarter.
    const openId = LocType.getId(door + '_open');
    const nowOpen = placed().some(q => q.id === openId);
    check(`${door}: clicking Open actually opens it`, nowOpen, true);
    check(`  and the closed one is gone from ${spot.x},${spot.z}`,
        !!World.getLoc(spot.x, spot.z, spot.level, id), false);

    if (nowOpen) {
        const o = placed().find(q => q.id === openId)!;
        H.opLoc(p, o.x, o.z, door + '_open', 1);
        H.tick(3);
        check('  and clicking Close shuts it again', placed().some(q => q.id === id), true);
    }
    H.despawn(p);
    H.tick(1);
}


console.log('\nEVERY LADDER, CLIMBED - and it is the landing that matters');
// The two new categories say "same tile, one level". That is only true if the tile you arrive
// on is somewhere a player can stand, so this climbs every placement and checks where it put
// you rather than just that the script ran.
// Only the same-tile pair. loc474_16734/16732/16733 are deliberately unwired - their halves
// sit a tile apart, in a direction that varies by placement, so they need an angle-aware
// trigger rather than the "same tile, one level" categories. See lunar_isle.loc.
const LADDERS: [string, number][] = [['loc474_16735', 1], ['loc474_16736', -1]];
let climbed = 0;
for (const [name, dir] of LADDERS) {
    const id = LocType.getId(name);
    const spots = all.filter(q => q.id === id);
    check(`${name}: is placed`, spots.length > 0, true);
    for (const spot of spots) {
        const p = H.makePlayer(`lad${climbed++}`, spot.x, spot.z, 400 + climbed);
        H.tick(1); H.maxOut(p);
        // stand ON the ladder tile, which is where the route ends for a climbable loc
        p.teleport(spot.x, spot.z, spot.level);
        H.tick(1);
        const from = p.level;
        H.opLoc(p, spot.x, spot.z, name, 1);
        H.tick(4);
        const moved = p.level - from;
        check(`  ${name} @(${spot.x},${spot.z},${spot.level}) goes ${dir > 0 ? "up" : "down"} one level`,
            moved, dir);
        // WHERE YOU LAND, and the rule is narrower than "is the tile clear".
        //
        // A ladder blocks its own tile, and ~climb_ladder puts you on the matching tile one
        // level away - which normally holds the OTHER half of the pair. So the landing tile
        // being blocked is the ordinary case, not a fault: you stand on ladders in this game
        // as in the real one. What is a fault is landing on a tile blocked by something that
        // is not a ladder, because that is a wall.
        //
        // (An earlier version of this test asked isFlagged(..., 0x1). 0x1 is not WALK_BLOCKED,
        // which is 0x240100, and nothing sets it - so every landing came back clear and the
        // two "map defects" recorded here were the wrong bit talking. Both are withdrawn.)
        const blocked = isFlagged(p.x, p.z, p.level, CollisionFlag.WALK_BLOCKED);
        let ladderHere = false;
        for (const q of placed()) {
            if (q.x !== p.x || q.z !== p.z || q.level !== p.level) continue;
            if ((LocType.get(q.id).op ?? []).some(o => o && o.startsWith('Climb'))) ladderHere = true;
        }
        check(`    lands on the other half of the pair, not in a wall`, !blocked || ladderHere, true,
            blocked ? 'blocked, and no ladder on that tile' : undefined);
        H.despawn(p);
        H.tick(1);
    }
}


console.log('\nWHERE THE PEOPLE STAND');
// Every coordinate here came off that npc's own OSRS wiki page, out of the {{Map|x=|y=}} in its
// wikitext. They were all in a row at z=3930 before, which is what hand-placement looks like.
//
// Four are a tile or four off the wiki's number, and deliberately: a {{Map}} marker carries a
// radius and names a place rather than a tile, and those four land on a wall. Each is the
// nearest tile inside the marker that a player can stand on. They are spelled out rather than
// rounded silently.
const PEOPLE: [string, number, number, string][] = [
    ['baba_yaga', 2088, 3931, ''],
    ['selene', 2085, 3915, ''],
    ['meteora', 2081, 3896, ''],
    ['pauline_polaris', 2073, 3921, ''],
    ['melana_moonlander', 2096, 3907, ''],
    ['sirsal_banker', 2100, 3919, ''],
    ['rimae_sirsalis', 2104, 3907, 'wiki 2105,3908 is a wall'],
    ['bouquet_mac_hyacinth', 2102, 3919, 'wiki 2102,3920 is a wall'],
    ['birdseye_jack', 2100, 3922, 'wiki 2100,3921 is a wall'],
];
for (const [name, x, z, why] of PEOPLE) {
    const id = NpcType.getId(name);
    const found = [...World.npcs].filter(n => n.type === id && n.x >= X1 && n.x <= X2);
    check(`${name} spawns at ${x},${z}${why ? ` (${why})` : ''}`,
        found.map(n => `${n.startX},${n.startZ}`), [`${x},${z}`]);
}

// LOKAR IS NOT ON LUNAR ISLE, but he is how you get there and he was on the wrong dock -
// ten tiles east of the wiki's marker. His Pirates' Cove spawn was always right and is
// untouched, so there are two of him and only one moved.
{
    const id = NpcType.getId('lokar_searunner');
    const all = [...World.npcs].filter(n => n.type === id);
    check('two Lokar spawns, Rellekka and the Cove',
        all.map(n => `${n.startX},${n.startZ}`).sort(), ['2204,3806', '2625,3694'].sort());
}

console.log(`\n${ok + fail} checks: ${ok} ok, ${fail} FAILED`);
process.exit(0);
