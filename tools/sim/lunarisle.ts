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
import * as GameMap from '#/engine/GameMap.js';

await H.boot();
const X1 = 2040, Z1 = 3870, X2 = 2180, Z2 = 3970;
let ok = 0, fail = 0;
const check = (what: string, got: unknown, want: unknown) => {
    const good = JSON.stringify(got) === JSON.stringify(want);
    console.log(`  ${good ? 'ok  ' : 'FAIL'} ${what}${good ? '' : `  got ${JSON.stringify(got)} want ${JSON.stringify(want)}`}`);
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
const LADDERS: [string, number][] = [['loc474_16734', 1], ['loc474_16735', 1],
    ['loc474_16732', -1], ['loc474_16733', -1], ['loc474_16736', -1]];
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
        // AND YOU ARE NOT STANDING INSIDE A WALL WHEN YOU GET THERE, which is the half that
        // matters: "same tile, one level" is only a rule if the tile is somewhere you can be.
        //
        // Two placements out of ten land badly, and both are defects in the imported map rather
        // than in the wiring, so they are written down here instead of being quietly tolerated:
        //
        //   2104,3905  the up ladder is a tile west of the down ladder it pairs with at
        //              2105,3905, so climbing it lands you in the wall between them.
        //   2082,3922  the ground-floor tile is blocked where the same pair is clear at its
        //              other three placements, so climbing down arrives inside it.
        //
        // WHEN ONE OF THESE STARTS FAILING THE MAP WAS FIXED, and the expectation should flip.
        const KNOWN_BAD = new Set(['2104,3905,0', '2082,3922,1']);
        const bad = KNOWN_BAD.has(`${spot.x},${spot.z},${spot.level}`);
        check(`    ${bad ? "KNOWN MAP DEFECT: does NOT land" : "lands"} on a tile you can stand on`,
            GameMap.isZoneAllocated(p.level, p.x, p.z) && !GameMap.isFlagged(p.x, p.z, p.level, 0x1), !bad);
        H.despawn(p);
        H.tick(1);
    }
}

console.log(`\n${ok + fail} checks: ${ok} ok, ${fail} FAILED`);
process.exit(0);
