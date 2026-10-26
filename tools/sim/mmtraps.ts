// DOES THE APE ATOLL DUNGEON HURT YOU NOW, AND ONLY WHERE IT SHOULD?
//
// The cache places ninety-one traps across the dungeon's four mapsquares and none of them had a
// script, so the whole walk to Zooknock was free. scripts/quests/quest_mm/scripts/mm_dungeon.rs2
// hangs a one-tick timer off the forty-five 8x8 zones that hold a trap tile.
//
// Three claims worth checking, and the third is the one that is easy to get wrong:
//
//   1. standing on a trap hits you;
//   2. standing one tile off a trap does not;
//   3. A TRAP WIDER THAN ONE TILE HITS YOU ON ITS SECOND TILE TOO. loc_find only ever matches a
//      loc's origin, so the obvious script catches mm_speartrap on half its footprint and misses
//      the other half - and half of fifteen traps silently not working is exactly the sort of thing
//      that reads as "the cave does nothing".
//
// A SIM NEVER FIRES A ZONE TRIGGER BY ITSELF. Player.triggerZone exists on every player, but the
// code that calls it lives in NetworkPlayer.updateZones, in the client-output half of the tick - so
// a socketless harness player walks across a [zone] boundary and nothing happens. The walk below is
// real and so is the trigger lookup; what this file does by hand is the one line NetworkPlayer
// would have run. That still tests the thing most likely to be wrong, which is whether the
// generated zone names match the coordinates the engine computes from a tile.
//
//   npx tsx tools/sim/mmtraps.ts
import * as H from './harness.ts';
import { check, R, player, op, useOn, mark, said } from './a1lib.ts';
import ScriptProvider from '#/engine/script/ScriptProvider.js';

await H.boot();

const HP = 3; // PlayerStat.HITPOINTS

/** What NetworkPlayer.updateZones does when a player crosses into a new 8x8 zone. */
function enterZone(p: any) {
    p.triggerZone(p.level, (p.x >> 3) << 3, (p.z >> 3) << 3);
}
function leaveZone(p: any, level: number, x: number, z: number) {
    p.triggerZoneExit(level, (x >> 3) << 3, (z >> 3) << 3);
}

// ---------------------------------------------------------------- the generated zone list resolves
// mm_dungeon.rs2's forty-five [zone] declarations are generated from the maps, so the one thing a
// typo would break is silently: a name that no tile ever produces simply never fires. This asks the
// engine to name the zone of every trap tile and checks a script answers to it.
console.log('EVERY TRAP TILE LANDS IN A DECLARED ZONE');
{
    const TRAPS: [number, number, number][] = [
        // one tile out of each of the four trap types, plus the two upper-level rows
        [0, 2703, 9108], [0, 2697, 9115], [0, 2701, 9141], [0, 2693, 9109],
        [0, 2691, 9115], [0, 2746, 9101], [0, 2809, 9111], [0, 2785, 9204],
        [1, 2705, 9158], [1, 2744, 9195], [1, 2697, 9213]
    ];
    let missing = 0;
    for (const [level, x, z] of TRAPS) {
        const name = `[zone,${level}_${x >> 6}_${z >> 6}_${((x & 0x3f) >> 3) << 3}_${((z & 0x3f) >> 3) << 3}]`;
        if (!ScriptProvider.getByName(name)) {
            console.log(`  --   ${level},${x},${z} is in ${name}, which nothing declares`);
            missing++;
        }
    }
    check(`  all ${TRAPS.length} sampled trap tiles are covered`, missing, 0);
}

type Case = { what: string; x: number; z: number; from: [number, number]; hit: boolean };

// Every coordinate here is read out of content/maps, not chosen: the trap rows of m42_142 and
// m43_142 at plane 0. The "second tile" cases are derived - mm_speartrap is width 2 and length 1,
// so an even angle puts its other tile one EAST of the origin and an odd angle one NORTH.
const CASES: Case[] = [
    // mm_floorspikes, one tile each, drawn and animating
    { what: 'floor spikes 2703,9108', x: 2703, z: 9108, from: [2703, 9107], hit: true },
    { what: 'floor spikes 2706,9106', x: 2706, z: 9106, from: [2706, 9105], hit: true },

    // mm_speartrap at an even angle: origin 2697,9115 angle 0, so it also covers 2698,9115
    { what: 'spear trap 2697,9115 (origin)', x: 2697, z: 9115, from: [2697, 9114], hit: true },
    { what: 'spear trap 2698,9115 (2nd tile)', x: 2698, z: 9115, from: [2698, 9114], hit: true },

    // mm_speartrap at an odd angle: origin 2701,9141 angle 1, so it also covers 2701,9142
    { what: 'spear trap 2701,9141 (origin)', x: 2701, z: 9141, from: [2700, 9141], hit: true },
    { what: 'spear trap 2701,9142 (2nd tile)', x: 2701, z: 9142, from: [2700, 9142], hit: true },

    // mm_double_springtrap_trigger, on the middle tile of its own stalagmites
    { what: 'spring trap 2693,9109', x: 2693, z: 9109, from: [2693, 9108], hit: true },

    // AND THE FLOOR THAT IS JUST FLOOR. These are inside trap-bearing zones and are not traps,
    // which is what proves the timer is reading the tile rather than the zone.
    { what: 'bare floor 2700,9108', x: 2700, z: 9108, from: [2700, 9107], hit: false },
    { what: 'bare floor 2701,9108', x: 2701, z: 9108, from: [2702, 9108], hit: false }
];

console.log('\nWHAT IS UNDERFOOT');
for (const c of CASES) {
    const p: any = player('trap_' + c.x + '_' + c.z, c.from[0], c.from[1], 0);
    H.maxOut(p);
    H.setVar(p, 'tutorial', 1000);
    H.tick(2);
    const before = H.hits.filter(h => h.who === p.username).length;
    const hpBefore = p.levels[HP];

    H.walkTo(p, c.x, c.z);
    H.tick(4);
    if (p.x !== c.x || p.z !== c.z) {
        // NOT A PASS AND NOT A FAILURE OF THE SCRIPT. A tile nobody can stand on tells us nothing
        // about the trap on it, and calling that a pass would be the worse mistake.
        check(`  ${c.what.padEnd(34)} could not be stood on (${p.x},${p.z})`, false, true);
        H.despawn(p);
        continue;
    }
    enterZone(p);
    H.tick(6);

    const took = H.hits.filter(h => h.who === p.username).length - before;
    const lost = hpBefore - p.levels[HP];
    check(`  ${c.what.padEnd(34)} ${c.hit ? 'hits' : 'leaves you alone'}`, took > 0, c.hit);
    if (c.hit) {
        check(`  ${''.padEnd(34)}   and costs hitpoints (${lost})`, lost > 0, true);
    }
    H.despawn(p);
}

// ---------------------------------------------------------------- the floor spikes keep going
// Old School: the floor spikes "hit 4 if stood on" and "will continuously hit you until you move or
// die". A trap that fires once and stops is a different trap.
console.log('\nAND THE SPIKES DO NOT STOP WHILE YOU STAND ON THEM');
{
    const p: any = player('trap_stander', 2703, 9107, 0);
    H.maxOut(p);
    H.setVar(p, 'tutorial', 1000);
    H.tick(2);
    H.walkTo(p, 2703, 9108);
    H.tick(4);
    enterZone(p);
    const hpBefore = p.levels[HP];
    H.tick(20);
    const lost = hpBefore - p.levels[HP];
    check(`    twenty ticks on the spikes costs more than one hit (${lost})`, lost > 4, true);
    H.despawn(p);
}

// ---------------------------------------------------------------- and it stops when you leave
// cleartimer on [zoneexit] is the half that is easy to forget, and forgetting it means a player who
// walked through the dungeon keeps being hit by its floor for the rest of the session.
console.log('\nAND IT STOPS AT THE DOOR');
{
    const p: any = player('trap_leaver', 2703, 9107, 0);
    H.maxOut(p);
    H.setVar(p, 'tutorial', 1000);
    H.tick(2);
    H.walkTo(p, 2703, 9108);
    H.tick(4);
    enterZone(p);
    H.tick(6);
    check('    the spikes hit at all', H.hits.filter(h => h.who === p.username).length > 0, true);

    // Garkor's clearing on the surface, a hundred and twenty tiles and three mapsquares away
    leaveZone(p, 0, 2703, 9108);
    p.teleport(0, 2755, 2798, 0);
    H.tick(6);
    const after = H.hits.filter(h => h.who === p.username).length;
    const hpAfter = p.levels[HP];
    H.tick(20);
    check('    and nothing follows you out of the cave',
          [H.hits.filter(h => h.who === p.username).length, p.levels[HP]], [after, hpAfter]);
    H.despawn(p);
}

// ---------------------------------------------------------------- the rock, and the plank over it
// mm_double_springtrap_trigger carried no op at all, and mm_crossing_plank - "Plank", in the cache
// for this and nothing else - was referenced nowhere. Old School says the two rock traps in this
// dungeon work like the Underground Pass ones and that a plank crosses them safely.
console.log('\nTHE ROCK TELLS YOU WHAT IT IS, AND A PLANK CROSSES IT');
{
    const p: any = player('trap_planker', 2693, 9108, 0);
    H.maxOut(p);
    H.setVar(p, 'tutorial', 1000);
    H.tick(2);
    // ~mesbox is an interface, not a mes, so the words land in H.ifaces rather than H.mesgs
    const i0 = H.ifaces.length;
    op(p, 2693, 9109, 'mm_double_springtrap_trigger', 1);
    H.tick(8);
    const box = H.ifaces.slice(i0).filter(i => i.kind === 'text').map(i => i.text ?? '');
    check('    searching it says it is a trap with nothing to disarm',
          box.some(t => t.includes('It is a trap')), true);

    H.give(p, 'woodplank', 1);
    const m1 = mark();
    useOn(p, 2693, 9109, 'mm_double_springtrap_trigger', 'woodplank');
    H.tick(12);
    check('    the plank goes down', said(p, m1, 'lay the plank'), true);
    // the crossing carries you to the far side of the rock, which is the whole point of it
    check(`    and carries you across (${p.x},${p.z})`, p.z > 9109, true);
    H.despawn(p);
}

console.log(`\n${R.ok} ok, ${R.bad} FAIL`);
process.exit(R.bad ? 1 : 0);
