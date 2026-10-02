// Charter ships, reported only as "charter ships very buggy" with no repro. This audits the data
// and the two procs that decide where you are and what it costs, on the real engine:
//
//   * every port has a name, a map layer, a button and a landing coord
//   * the landing coord is somewhere you can stand
//   * fares are the same in both directions, and a route exists in both or neither
//   * standing where a charter ship lands you, ~charter_port_here names THAT port - get this wrong
//     and you are charged the wrong fare and sail from the wrong origin
//   * a crewmember is actually within reach of each pier
//
//   npx tsx tools/sim/charter.ts
import * as H from './harness.ts';
import * as A from './a1lib.ts';
import { World, NpcType, LocType, check, R, player } from './a1lib.ts';
import ScriptProvider from '#/engine/script/ScriptProvider.js';
import { CollisionFlag } from '#/engine/routefinder/index.js';
import { isFlagged } from '#/engine/GameMap.js';

await H.boot();

const PORTS = [0, 1, 2, 4, 5, 6, 7, 8];
const NAME: Record<number, string> = { 0: 'Port Sarim', 1: 'Brimhaven', 2: 'Catherby', 4: 'Musa Point',
    5: 'Port Khazard', 6: 'Port Phasmatys', 7: 'the Shipyard', 8: 'Port Tyras' };

const p = player('charter', 3200, 3200);
const callProc = (name: string, args: unknown[] = []) => H.runProc(p, `[proc,${name}]`, args as any)[0];

// ---------------------------------------------------------------- landing coords
console.log('LANDING COORDS');
const arrive = new Map<number, { level: number; x: number; z: number }>();
for (const port of PORTS) {
    const packed = callProc('charter_arrive', [port]) as number;
    if (packed === -1 || packed === null) { check(`  ${NAME[port]} has a landing coord`, packed, 'a coord'); continue; }
    const level = (packed >> 28) & 0x3, x = (packed >> 14) & 0x3fff, z = packed & 0x3fff;
    arrive.set(port, { level, x, z });
    // isFlagged takes (x, z, level) - NOT (level, x, z). Passed the wrong way round it reads a tile
    // nobody asked about, which here answered "not blocked" for every landing and made this assert
    // nothing at all.
    const blocked = isFlagged(x, z, level, CollisionFlag.WALK_BLOCKED);
    check(`  ${NAME[port].padEnd(14)} ${level}_${x >> 6}_${z >> 6}_${x & 63}_${z & 63} is standable`, blocked, false);
}

// ---------------------------------------------------------------- fares
console.log('FARES');
const fare = (a: number, b: number) => callProc('charter_fare', [a, b]) as number;
let asym = 0;
for (const a of PORTS) for (const b of PORTS) {
    if (a === b) continue;
    if (fare(a, b) !== fare(b, a)) { console.log(`  ${NAME[a]} -> ${NAME[b]} is ${fare(a, b)} but back is ${fare(b, a)}`); asym++; }
}
check('  every route costs the same in both directions', asym, 0);
let unreachable = 0;
for (const b of PORTS) if (!PORTS.some(a => a !== b && fare(a, b) !== -1)) { console.log(`  nothing sails to ${NAME[b]}`); unreachable++; }
check('  every port can be sailed to from somewhere', unreachable, 0);

// ---------------------------------------------------------------- where am I
console.log('WHICH PORT AM I AT');
for (const port of PORTS) {
    const c = arrive.get(port);
    if (!c) continue;
    p.teleport(c.x, c.z, c.level);
    H.tick(1);
    const here = callProc('charter_port_here') as number;
    check(`  landed at ${NAME[port].padEnd(14)} -> charter_port_here says`, NAME[here] ?? here, NAME[port]);
}

// ---------------------------------------------------------------- is there a crew
console.log('A CREWMEMBER AT EACH PIER');
const crew = new Set(['trader_stan', 'trader_crewmember_1', 'trader_crewmember_2', 'trader_crewmember_3',
    'trader_crewmember_4', 'trader_crewmember_5', 'trader_crewmember_6'].map(n => NpcType.getId(n)));
for (const port of PORTS) {
    const c = arrive.get(port);
    if (!c) continue;
    let best = 999;
    for (const npc of World.npcs) {
        if (!npc || !crew.has(npc.type)) continue;
        if (npc.level !== c.level && npc.level !== 0) continue;
        best = Math.min(best, Math.max(Math.abs(npc.x - c.x), Math.abs(npc.z - c.z)));
    }
    check(`  ${NAME[port].padEnd(14)} has crew within 12 tiles (nearest ${best})`, best <= 12, true);
}

// ---------------------------------------------------------------- can you get off the ship
// You land on a ship's deck on level 1. If the gangplank beside you is not a loc with a working
// op, the voyage ends with the player stranded on a boat - which would feel like "very buggy"
// more than any wrong fare would.
console.log('GETTING OFF THE SHIP');
for (const port of PORTS) {
    const c = arrive.get(port);
    if (!c) continue;
    const near: string[] = [];
    for (let dx = -3; dx <= 3; dx++) for (let dz = -3; dz <= 3; dz++) {
        for (const lvl of [0, 1]) {
            const zone = World.gameMap.getZone(c.x + dx, c.z + dz, lvl);
            for (const loc of zone.getAllLocsUnsafe()) {
                if (loc.x !== c.x + dx || loc.z !== c.z + dz) continue;
                const t = LocType.get(loc.type);
                const ops = (t.op ?? []).filter(Boolean);
                if (ops.length) near.push(`${t.debugname}[${ops.join('/')}]@${lvl}`);
            }
        }
    }
    const planks = near.filter(n => /plank|gangplank|cross|climb|ladder|stair/i.test(n));
    check(`  ${NAME[port].padEnd(14)} has a way off (${planks.join(' ') || near.slice(0, 4).join(' ') || 'NOTHING'})`, planks.length > 0, true);
}

console.log(`\n${R.ok} ok, ${R.bad} FAIL`);
process.exit(R.bad ? 1 : 0);
