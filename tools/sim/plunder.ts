// Pyramid Plunder: a run from the Sophanem sand to the eighth chamber.
// Usage: npx tsx tools/sim/plunder.ts   (exit code is the verdict)
//
// WHAT THIS IS FOR.
//
//   * THE ROOMS ARE A CHOICE, NOT A MAP FACT. Jalsavrah's eight rooms are sealed from each other -
//     every tomb door opens onto a one-tile dead end - so which room is room 1 is decided by the
//     content, and the only thing pinning it is Old School's note that room 3 has twelve urns
//     where the rest have thirteen. That count is asserted here, off the map, because if it ever
//     stops holding then the room order is wrong and every level gate and loot tier with it.
//
//   * THE CORRIDORS JOIN UP. They are one connected web, so without a gate a level 21 player could
//     walk round to room 8 and start there. The spear trap is that gate, and this walks a player
//     to the wrong room's trap to prove it is shut.
//
//   * A LANDING THAT IS NOT A TILE. Sixteen arrival and landing coordinates, two per room, plus
//     the lobby and the way out. Every one is asked of the engine rather than read off a picture.
//
//   * THE URN IS A FOUR-STATE MACHINE and three of the four states offer Search, so the states are
//     walked rather than spot-checked.
import { readFileSync } from 'fs';

import * as H from './harness.ts';
import { check, R, player } from './a1lib.ts';
import LocType from '#/cache/config/LocType.js';
import ObjType from '#/cache/config/ObjType.js';
import NpcType from '#/cache/config/NpcType.js';
import World from '#/engine/World.js';
import JavaRandom from '#/util/JavaRandom.js';
import { canTravel, reachedLoc } from '#/engine/GameMap.js';
import { CollisionType } from '#/engine/routefinder/index.js';
import { drawn, onLoc } from './mapfloor.ts';

await H.boot();

const THIEVING = 17,
    STRENGTH = 2,
    HITPOINTS = 3;
const BX = 30 * 64,
    BZ = 69 * 64;

const standable = (x: number, z: number, level = 0): boolean => {
    for (const [dx, dz] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1]
    ]) {
        if (canTravel(level, x + dx, z + dz, -dx, -dz, 1, 0, CollisionType.NORMAL)) return true;
    }
    return false;
};
const real = (x: number, z: number, level = 0): boolean => standable(x, z, level) && (drawn(x, z, level) || onLoc(x, z, level));

// Can you walk from one tile to the other? Used to prove the spear trap seals its room.
const reaches = (from: readonly [number, number], to: readonly [number, number]): boolean => {
    const key = (x: number, z: number) => (x << 16) | z;
    const seen = new Set<number>([key(from[0], from[1])]);
    const q: [number, number][] = [[from[0], from[1]]];
    while (q.length) {
        const [x, z] = q.shift()!;
        if (x === to[0] && z === to[1]) return true;
        for (const [dx, dz] of [
            [1, 0],
            [-1, 0],
            [0, 1],
            [0, -1]
        ]) {
            const nx = x + dx,
                nz = z + dz;
            if (nx < BX || nx > BX + 63 || nz < BZ || nz > BZ + 63) continue;
            if (seen.has(key(nx, nz))) continue;
            if (!canTravel(0, x, z, dx, dz, 1, 0, CollisionType.NORMAL)) continue;
            seen.add(key(nx, nz));
            q.push([nx, nz]);
        }
    }
    return false;
};

// Where can this loc be clicked from? A tomb door is a wall loc and the tile it takes a click
// from depends on its angle, so the sim asks rather than teleporting to a guess - a click from
// out of range just makes the player walk, and a walk is not what is being tested.
const beside = (name: string, x: number, z: number): [number, number] | null => {
    const id = LocType.getId(name);
    const loc = World.getLoc(x, z, 0, id);
    if (!loc) return null;
    const t = LocType.get(id) as unknown as { forceapproach: number };
    for (let dx = -2; dx <= 2; dx++) {
        for (let dz = -2; dz <= 2; dz++) {
            const cx = x + dx,
                cz = z + dz;
            if (!standable(cx, cz)) continue;
            if (reachedLoc(0, cx, cz, loc.x, loc.z, loc.width, loc.length, 1, loc.angle, loc.shape, t.forceapproach)) return [cx, cz];
        }
    }
    return null;
};

const origND = JavaRandom.nextDouble.bind(JavaRandom);
const pin = (v: number | null) => {
    (JavaRandom as unknown as { nextDouble: () => number }).nextDouble = v === null ? origND : () => v;
};

// Seed both squares so collision is measured rather than assumed.
for (const [sx, sz, lv] of [
    [BX + 32, BZ + 32, 0],
    [3290, 2787, 0]
] as const) {
    const p = H.makePlayer(`plunder_seed_${sx}`, sx, sz);
    p.teleport(sx, sz, lv);
    H.tick(2);
}

// The run, as the content orders it: room, Thieving level, the corridor tile outside its spear
// trap, the tile past the trap, and one of its spear-trap locs.
type Room = { n: number; level: number; arrive: [number, number]; inside: [number, number]; trap: [number, number] };
const ROOMS: Room[] = [
    // EACH TRAP IS FOUR LOCS, two on the corridor side and two on the room side, and the engine
    // only takes a Pass from the pair facing you. The corridor-side one is named here; clicking
    // the room-side one from the corridor is "I can't reach that".
    { n: 1, level: 21, arrive: [1926, 4427], inside: [1926, 4429], trap: [1925, 4427] },
    { n: 2, level: 31, arrive: [1944, 4424], inside: [1944, 4426], trap: [1943, 4424] },
    { n: 3, level: 41, arrive: [1976, 4466], inside: [1976, 4464], trap: [1975, 4466] },
    { n: 4, level: 51, arrive: [1974, 4423], inside: [1974, 4425], trap: [1973, 4423] },
    { n: 5, level: 61, arrive: [1963, 4445], inside: [1960, 4445], trap: [1962, 4445] },
    { n: 6, level: 71, arrive: [1929, 4453], inside: [1932, 4453], trap: [1930, 4453] },
    { n: 7, level: 81, arrive: [1927, 4473], inside: [1927, 4471], trap: [1926, 4473] },
    { n: 8, level: 91, arrive: [1954, 4474], inside: [1954, 4472], trap: [1953, 4474] }
];

// Everything the map places, read back so the room counts can be asserted off it.
type Row = { name: string; x: number; z: number };
const placed: Row[] = [];
{
    const text = readFileSync('../content/maps/m30_69.jm2', 'utf8');
    let section = '';
    for (const line of text.split(/\r?\n/)) {
        if (line.startsWith('====')) {
            section = line.replace(/=/g, '').trim();
            continue;
        }
        if (section !== 'LOC') continue;
        const m = /^(\d+) (\d+) (\d+): (\d+) (\d+)(?: (\d+))?\s*$/.exec(line);
        if (!m || m[1] !== '0') continue;
        const name = LocType.get(Number(m[4]))?.debugname ?? m[4];
        if (!/^plunder_/.test(name)) continue;
        placed.push({ name, x: BX + Number(m[2]), z: BZ + Number(m[3]) });
    }
}

// ---------------------------------------------------------------------------------------------
console.log('== the pyramid is placed, and the multilocs are varbits rather than loc_changes');
{
    for (const [nm, want] of [
        ['plunder_chest', 8],
        ['plunder_sarcophagus', 8],
        ['plunder_speartrap', 32],
        ['plunder_exit', 16]
    ] as const) {
        check(`${nm} x${want}`, placed.filter(r => r.name === nm).length, want);
    }
    const urns = placed.filter(r => /^plunder_urn_\d+$/.test(r.name));
    check('103 urns in all - eight rooms of thirteen, less the one room with twelve', urns.length, 103);
    for (let i = 1; i <= 4; i++) check(`plunder_door_${i} x8`, placed.filter(r => r.name === `plunder_door_${i}`).length, 8);

    // The state is per player, which is the whole reason these are multilocs.
    for (const nm of ['plunder_chest', 'plunder_sarcophagus', 'plunder_urn_1', 'plunder_door_1']) {
        const t = LocType.get(LocType.getId(nm)) as unknown as { multivarbit: number; multiloc: number[] };
        check(`${nm} switches on a varbit`, t.multivarbit !== -1, true);
        check(`${nm} has its states`, t.multiloc.filter(c => c !== -1).length >= 2, true);
    }
    // And the options are on the resolved children, where the 377 client reads a menu from.
    const urn0 = LocType.get((LocType.get(LocType.getId('plunder_urn_1')) as unknown as { multiloc: number[] }).multiloc[0]);
    check('an untouched urn offers Search and Check for Snakes', [urn0.op?.[0], urn0.op?.[1]], ['Search', 'Check for Snakes']);
    // THE TWO OPTIONS ARE ON DIFFERENT SLOTS, which is the cache's arrangement: an untouched urn
    // has Check for Snakes on op2 and one with a snake in it has Charm Snake on op3. A handler
    // written on the wrong slot does nothing and says nothing.
    const urn2 = LocType.get((LocType.get(LocType.getId('plunder_urn_1')) as unknown as { multiloc: number[] }).multiloc[2]);
    check('and one with a snake in it offers Charm Snake on op3', urn2.op?.[2], 'Charm Snake');
}

// ---------------------------------------------------------------------------------------------
console.log('== every tile a run stands on is a tile');
{
    for (const r of ROOMS) {
        check(`room ${r.n}: the corridor at ${r.arrive[0]},${r.arrive[1]}`, real(...r.arrive), true);
        check(`room ${r.n}: past the trap at ${r.inside[0]},${r.inside[1]}`, real(...r.inside), true);
        // And the trap really is between them: on foot, the corridor cannot reach the room.
        check(`room ${r.n}: the trap separates them`, reaches(r.arrive, r.inside), false);
    }
    check('the lobby at 1927,4425', real(1927, 4425), true);
    check('the mummy stands at 1926,4425', real(1926, 4425), true);
    check('and the sand outside at 3290,2787', real(3290, 2787), true);
}

// ---------------------------------------------------------------------------------------------
console.log('== the way in: four doors in Sophanem, one of them real, and it moves');
{
    for (const [x, z] of [
        [3290, 2789],
        [3283, 2794],
        [3290, 2799],
        [3297, 2794]
    ] as const) {
        const loc = World.getLoc(x, z, 0, LocType.getId('plunder_anon_door'));
        check(`a door at ${x},${z}`, loc !== null, true);
    }
    const t = LocType.get(LocType.getId('plunder_anon_door'));
    check('it can be opened', t.op?.[0], 'Open');

    // Which one is the way in is read off the world clock, so it is the same for everybody and
    // changes every twenty-five minutes. Ticking the world is too slow to test, so the proc is
    // asked directly with the clock moved under it.
    const clockOf = (ticks: number): number => {
        const orig = World.currentTick;
        (World as unknown as { currentTick: number }).currentTick = ticks;
        const p = player('plunder_clock', 3290, 2787);
        const out = H.runProc(p, '[proc,plunder_way_in]')[0];
        (World as unknown as { currentTick: number }).currentTick = orig;
        return out;
    };
    const a = clockOf(0),
        b = clockOf(2500),
        c = clockOf(5000),
        d = clockOf(7500),
        e = clockOf(10000);
    check('four different doors over four quarters of an hour and a half', new Set([a, b, c, d]).size, 4);
    check('and then it comes round again', e, a);
    check('two players at the same moment agree', clockOf(1234), clockOf(1234));
}

// ---------------------------------------------------------------------------------------------
console.log('== the Guardian mummy is in the lobby and starts the clock');
{
    const mummy = H.npcNear('plunder_guardian_mummy', 1926, 4425, 0);
    check('he is spawned at 1926,4425', mummy !== null, true);
    check('and he has a Start-minigame option', NpcType.get(NpcType.getId('plunder_guardian_mummy')).op?.[2], 'Start-minigame');
    if (mummy) {
        const p = player('plunder_start', 1927, 4425);
        p.teleport(1927, 4425, 0);
        p.setLevel(THIEVING, 99);
        H.tick(1);
        H.opNpc(p, mummy, 3);
        for (let i = 0; i < 8; i++) H.tick(1);
        check('the run starts in room 1', H.getVarBit(p, 'plunder_room'), 1);
        check('with five minutes on the clock', H.getVarBit(p, 'plunder_time_left'), 10);
        check('and puts you outside room 1', [p.x, p.z], [1926, 4427]);
    }
    // A level 20 thief is turned away.
    const q = player('plunder_toolow', 1927, 4425);
    q.teleport(1927, 4425, 0);
    q.setLevel(THIEVING, 20);
    H.tick(1);
    const m2 = H.npcNear('plunder_guardian_mummy', 1926, 4425, 0);
    if (m2) {
        const mark = H.ifaces.length;
        H.opNpc(q, m2, 3);
        for (let i = 0; i < 8; i++) H.tick(1);
        check('level 20 is not let in', H.getVarBit(q, 'plunder_room'), 0);
        check(
            'and is told the level',
            H.ifaces.slice(mark).some(i => (i.text ?? '').includes('Thieving level of 21')),
            true
        );
    }
}

// ---------------------------------------------------------------------------------------------
console.log('== a run through all eight rooms: the trap, the urns, the chest, the sarcophagus, the door');
{
    const p = player('plunder_run', 1927, 4425);
    p.teleport(1927, 4425, 0);
    p.setLevel(THIEVING, 99);
    p.setLevel(STRENGTH, 99);
    H.clearInv(p);
    H.tick(1);
    const mummy = H.npcNear('plunder_guardian_mummy', 1926, 4425, 0)!;
    H.opNpc(p, mummy, 3);
    for (let i = 0; i < 8; i++) H.tick(1);

    const URN_XP = [600, 900, 1500, 2150, 3000, 4500, 6750, 8250];
    const CHEST_XP = [400, 600, 1000, 1400, 2000, 3000, 4500, 5500];
    const SARC_XP = [200, 300, 500, 700, 1000, 1500, 2250, 2750];
    let artefacts = 0;

    // 0.9 RATHER THAN 0, and the difference is the whole run. A pinned 0 makes every stat_random
    // succeed - and also makes every random(n) return 0, so the one-in-four-thousand sceptre hits
    // on the first chest and throws the player out of the pyramid. 0.9 still beats every roll a
    // maxed thief makes and misses every drop.
    pin(0.9);
    try {
        for (const r of ROOMS) {
            check(`room ${r.n}: the run says so`, H.getVarBit(p, 'plunder_room'), r.n);
            // THE TRAP IS THE GATE. Pass it from the corridor.
            p.teleport(r.arrive[0], r.arrive[1], 0);
            H.tick(1);
            let xp = p.stats[THIEVING];
            H.opLoc(p, r.trap[0], r.trap[1], 'plunder_speartrap', 1);
            for (let i = 0; i < 8; i++) H.tick(1);
            check(`room ${r.n}: the trap lets you in`, [p.x, p.z], [r.inside[0], r.inside[1]]);
            check(`room ${r.n}: and pays ten`, p.stats[THIEVING] - xp, 100);

            // An urn: check it, then search it.
            const urn = placed.filter(u => /^plunder_urn_\d+$/.test(u.name)).filter(u => Math.abs(u.x - r.inside[0]) <= 12 && Math.abs(u.z - r.inside[1]) <= 12)[0];
            check(`room ${r.n}: has urns`, urn !== undefined, true);
            if (urn) {
                const slot = Number(urn.name.replace('plunder_urn_', ''));
                const uat = beside(urn.name, urn.x, urn.z);
                check(`room ${r.n}: the urn can be reached`, uat !== null, true);
                if (!uat) continue;
                p.teleport(uat[0], uat[1], 0);
                H.tick(1);
                H.opLoc(p, urn.x, urn.z, urn.name, 2);
                for (let i = 0; i < 6; i++) H.tick(1);
                check(`room ${r.n}: checking says no snake`, H.getVarBit(p, `plunder_urn_${slot}_state`), 1);
                xp = p.stats[THIEVING];
                const had =
                    H.invCount(p, 'plunder_stone_statuette') +
                    H.invCount(p, 'plunder_stone_seal') +
                    H.invCount(p, 'plunder_stone_scarab') +
                    H.invCount(p, 'plunder_gold_seal') +
                    H.invCount(p, 'plunder_golden_scarab') +
                    H.invCount(p, 'plunder_golden_statuette') +
                    H.invCount(p, 'plunder_ivory_comb') +
                    H.invCount(p, 'plunder_pottery_scarab') +
                    H.invCount(p, 'plunder_pottery_statuette');
                H.opLoc(p, urn.x, urn.z, urn.name, 1);
                for (let i = 0; i < 6; i++) H.tick(1);
                check(`room ${r.n}: the urn pays ${URN_XP[r.n - 1] / 10}`, p.stats[THIEVING] - xp, URN_XP[r.n - 1]);
                check(`room ${r.n}: and is emptied`, H.getVarBit(p, `plunder_urn_${slot}_state`), 3);
                const now =
                    H.invCount(p, 'plunder_stone_statuette') +
                    H.invCount(p, 'plunder_stone_seal') +
                    H.invCount(p, 'plunder_stone_scarab') +
                    H.invCount(p, 'plunder_gold_seal') +
                    H.invCount(p, 'plunder_golden_scarab') +
                    H.invCount(p, 'plunder_golden_statuette') +
                    H.invCount(p, 'plunder_ivory_comb') +
                    H.invCount(p, 'plunder_pottery_scarab') +
                    H.invCount(p, 'plunder_pottery_statuette');
                check(`room ${r.n}: and gives an artefact`, now - had, 1);
                artefacts += now - had;
            }

            // The chest.
            const chest = placed.filter(c => c.name === 'plunder_chest').filter(c => Math.abs(c.x - r.inside[0]) <= 12 && Math.abs(c.z - r.inside[1]) <= 12)[0];
            if (chest) {
                const cat = beside('plunder_chest', chest.x, chest.z)!;
                p.teleport(cat[0], cat[1], 0);
                H.tick(1);
                xp = p.stats[THIEVING];
                H.opLoc(p, chest.x, chest.z, 'plunder_chest', 1);
                for (let i = 0; i < 6; i++) H.tick(1);
                check(`room ${r.n}: the chest pays ${CHEST_XP[r.n - 1] / 10}`, p.stats[THIEVING] - xp, CHEST_XP[r.n - 1]);
                check(`room ${r.n}: and will not open twice`, H.getVarBit(p, 'plunder_chest_state'), 1);
            }

            // The sarcophagus, which pays STRENGTH rather than Thieving.
            const sarc = placed.filter(c => c.name === 'plunder_sarcophagus').filter(c => Math.abs(c.x - r.inside[0]) <= 12 && Math.abs(c.z - r.inside[1]) <= 12)[0];
            if (sarc) {
                const sat = beside('plunder_sarcophagus', sarc.x, sarc.z);
                check(`room ${r.n}: the sarcophagus can be reached`, sat !== null, true);
                if (!sat) continue;
                p.teleport(sat[0], sat[1], 0);
                H.tick(1);
                const str = p.stats[STRENGTH];
                const thf = p.stats[THIEVING];
                H.opLoc(p, sarc.x, sarc.z, 'plunder_sarcophagus', 1);
                for (let i = 0; i < 12; i++) H.tick(1);
                check(`room ${r.n}: the sarcophagus pays Strength ${SARC_XP[r.n - 1] / 10}`, p.stats[STRENGTH] - str, SARC_XP[r.n - 1]);
                check(`room ${r.n}: and no Thieving at all`, p.stats[THIEVING] - thf, 0);
                check(`room ${r.n}: it is open`, H.getVarBit(p, 'plunder_sarcophagus_state'), 1);
            }

            if (r.n === 8) break;

            // The way on. The run rolls which of the four it is, so ask the varbit rather than guess.
            const want = H.getVarBit(p, 'plunder_correct_door');
            const door = placed.filter(d => d.name === `plunder_door_${want}`).filter(d => Math.abs(d.x - r.inside[0]) <= 14 && Math.abs(d.z - r.inside[1]) <= 14)[0];
            check(`room ${r.n}: the right door is placed in it`, door !== undefined, true);
            if (!door) break;
            const at = beside(door.name, door.x, door.z);
            check(`room ${r.n}: the door can be reached`, at !== null, true);
            if (!at) break;
            p.teleport(at[0], at[1], 0);
            H.tick(1);
            xp = p.stats[THIEVING];
            H.opLoc(p, door.x, door.z, door.name, 1);
            for (let i = 0; i < 8; i++) H.tick(1);
            check(`room ${r.n}: the door opens`, H.getVarBit(p, `plunder_door_${want}_state`), 1);
            check(`room ${r.n}: and pays ${CHEST_XP[r.n - 1] / 10}`, p.stats[THIEVING] - xp, CHEST_XP[r.n - 1]);
            H.opLoc(p, door.x, door.z, door.name, 1);
            for (let i = 0; i < 8; i++) H.tick(1);
            check(`room ${r.n}: and puts you outside room ${r.n + 1}`, [p.x, p.z], ROOMS[r.n].arrive);
        }
    } finally {
        pin(null);
    }
    check('eight rooms, eight artefacts', artefacts, 8);
    check('and the run is in room 8', H.getVarBit(p, 'plunder_room'), 8);
}

// ---------------------------------------------------------------------------------------------
console.log('== the trap is a gate: the corridors join up, and it will not let you skip ahead');
{
    const p = player('plunder_skip', 1927, 4425);
    p.teleport(1927, 4425, 0);
    p.setLevel(THIEVING, 99);
    H.tick(1);
    const mummy = H.npcNear('plunder_guardian_mummy', 1926, 4425, 0)!;
    H.opNpc(p, mummy, 3);
    for (let i = 0; i < 8; i++) H.tick(1);
    // Room 8's corridor, reached on foot through the web of passages, with the run saying room 1.
    p.teleport(ROOMS[7].arrive[0], ROOMS[7].arrive[1], 0);
    H.tick(1);
    const mark = H.mesgs.length;
    H.opLoc(p, ROOMS[7].trap[0], ROOMS[7].trap[1], 'plunder_speartrap', 1);
    for (let i = 0; i < 8; i++) H.tick(1);
    check('room 8 stays shut', [p.x, p.z], [ROOMS[7].arrive[0], ROOMS[7].arrive[1]]);
    check(
        'and says why',
        H.mesgs.slice(mark).some(m => m.text.includes('no business')),
        true
    );

    // And the level is checked too: a level 21 thief sent to room 2 is refused on the level.
    const q = player('plunder_lowroom', 1927, 4425);
    q.teleport(1927, 4425, 0);
    q.setLevel(THIEVING, 21);
    H.tick(1);
    H.opNpc(q, H.npcNear('plunder_guardian_mummy', 1926, 4425, 0)!, 3);
    for (let i = 0; i < 8; i++) H.tick(1);
    H.setVarBit(q, 'plunder_room', 2);
    q.teleport(ROOMS[1].arrive[0], ROOMS[1].arrive[1], 0);
    H.tick(1);
    const mark2 = H.ifaces.length;
    H.opLoc(q, ROOMS[1].trap[0], ROOMS[1].trap[1], 'plunder_speartrap', 1);
    for (let i = 0; i < 8; i++) H.tick(1);
    check(
        'room 2 wants 31 Thieving',
        H.ifaces.slice(mark2).some(i => (i.text ?? '').includes('Thieving level of 31')),
        true
    );
}

// ---------------------------------------------------------------------------------------------
console.log('== the urn with a snake in it, and the charm that gets it out');
{
    // AT 99 THERE ARE NO SNAKES, by design: stat_random(thieving, 150, 256) is 257 at level 99
    // against a 0-255 roll, so no pin can put one in an urn. This is run at the course's own entry
    // level, where it is 172 and a pinned 255 beats it.
    const p = player('plunder_snake', 1927, 4425);
    p.teleport(1927, 4425, 0);
    p.setLevel(THIEVING, 21);
    H.clearInv(p);
    H.tick(1);
    H.opNpc(p, H.npcNear('plunder_guardian_mummy', 1926, 4425, 0)!, 3);
    for (let i = 0; i < 8; i++) H.tick(1);
    const urn = placed.filter(u => /^plunder_urn_\d+$/.test(u.name)).filter(u => Math.abs(u.x - 1926) <= 12 && Math.abs(u.z - 4429) <= 12)[0];
    const slot = Number(urn.name.replace('plunder_urn_', ''));
    const uat = beside(urn.name, urn.x, urn.z)!;
    p.teleport(uat[0], uat[1], 0);
    H.tick(1);

    pin(0.999); // a snake every time
    try {
        H.opLoc(p, urn.x, urn.z, urn.name, 2);
        for (let i = 0; i < 6; i++) H.tick(1);
    } finally {
        pin(null);
    }

    check('checking finds a snake', H.getVarBit(p, `plunder_urn_${slot}_state`), 2);

    // Searching it anyway gets you bitten, and the urn is still there to try again.
    const hp = p.levels[HITPOINTS];
    H.opLoc(p, urn.x, urn.z, urn.name, 1);
    for (let i = 0; i < 6; i++) H.tick(1);
    check('searching it bites', p.levels[HITPOINTS] < hp, true);
    check('and the snake is still in there', H.getVarBit(p, `plunder_urn_${slot}_state`), 2);

    // Charming wants the charm.
    const mark = H.mesgs.length;
    H.opLoc(p, urn.x, urn.z, urn.name, 3);
    for (let i = 0; i < 6; i++) H.tick(1);
    check(
        'no charm, no charming',
        H.mesgs.slice(mark).some(m => m.text.includes('snake charm')),
        true
    );
    H.give(p, 'plunder_snake_charm');
    H.opLoc(p, urn.x, urn.z, urn.name, 3);
    for (let i = 0; i < 6; i++) H.tick(1);
    check('with one, the snake comes out', H.getVarBit(p, `plunder_urn_${slot}_state`), 1);
    H.opLoc(p, urn.x, urn.z, urn.name, 1);
    for (let i = 0; i < 6; i++) H.tick(1);
    check('and the urn can then be emptied', H.getVarBit(p, `plunder_urn_${slot}_state`), 3);
    const mark2 = H.mesgs.length;
    H.opLoc(p, urn.x, urn.z, urn.name, 1);
    for (let i = 0; i < 6; i++) H.tick(1);
    check(
        'an emptied urn says so',
        H.mesgs.slice(mark2).some(m => m.text.includes('already emptied')),
        true
    );
}

// ---------------------------------------------------------------------------------------------
console.log('== three wrong doors and the fourth always opens');
{
    const p = player('plunder_doors', 1927, 4425);
    p.teleport(1927, 4425, 0);
    p.setLevel(THIEVING, 99);
    H.tick(1);
    H.opNpc(p, H.npcNear('plunder_guardian_mummy', 1926, 4425, 0)!, 3);
    for (let i = 0; i < 8; i++) H.tick(1);
    p.teleport(1926, 4429, 0);
    H.tick(1);
    const want = H.getVarBit(p, 'plunder_correct_door');
    const wrong = [1, 2, 3, 4].filter(d => d !== want);
    pin(0);
    try {
        // The same wrong door, three times over: the mask remembers doors, not attempts.
        const d = placed.filter(r => r.name === `plunder_door_${wrong[0]}`).filter(r => Math.abs(r.x - 1926) <= 14 && Math.abs(r.z - 4429) <= 14)[0];
        const standAt = beside(d.name, d.x, d.z)!;
        for (let i = 0; i < 3; i++) {
            p.teleport(standAt[0], standAt[1], 0);
            H.tick(1);
            H.opLoc(p, d.x, d.z, d.name, 1);
            for (let t = 0; t < 6; t++) H.tick(1);
        }
        check('spamming one wrong door remembers one door', H.getVarBit(p, 'plunder_doors_tried'), 1 << (wrong[0] - 1));
        check('and it is still shut', H.getVarBit(p, `plunder_door_${wrong[0]}_state`), 0);
        // Three DIFFERENT wrong doors, and the fourth opens whichever it is.
        for (const w of wrong.slice(1)) {
            const e = placed.filter(r => r.name === `plunder_door_${w}`).filter(r => Math.abs(r.x - 1926) <= 14 && Math.abs(r.z - 4429) <= 14)[0];
            const eat = beside(e.name, e.x, e.z)!;
            p.teleport(eat[0], eat[1], 0);
            H.tick(1);
            H.opLoc(p, e.x, e.z, e.name, 1);
            for (let t = 0; t < 6; t++) H.tick(1);
        }
        check(
            'three wrong doors are remembered',
            H.getVarBit(p, 'plunder_doors_tried'),
            wrong.reduce((m, w) => m | (1 << (w - 1)), 0)
        );
        // The right one was never touched, so it is the fourth - and it opens.
        const r4 = placed.filter(r => r.name === `plunder_door_${want}`).filter(r => Math.abs(r.x - 1926) <= 14 && Math.abs(r.z - 4429) <= 14)[0];
        const r4at = beside(r4.name, r4.x, r4.z)!;
        p.teleport(r4at[0], r4at[1], 0);
        H.tick(1);
        H.opLoc(p, r4.x, r4.z, r4.name, 1);
        for (let t = 0; t < 6; t++) H.tick(1);
        check('and the fourth opens', H.getVarBit(p, `plunder_door_${want}_state`), 1);
    } finally {
        pin(null);
    }
}

// ---------------------------------------------------------------------------------------------
console.log('== the sceptre ends the run, and the mummy fills it again');
{
    const p = player('plunder_sceptre', 1927, 4425);
    p.teleport(1927, 4425, 0);
    p.setLevel(THIEVING, 99);
    H.clearInv(p);
    H.tick(1);
    H.opNpc(p, H.npcNear('plunder_guardian_mummy', 1926, 4425, 0)!, 3);
    for (let i = 0; i < 8; i++) H.tick(1);
    p.teleport(1926, 4429, 0);
    H.tick(1);
    const sarc = placed.filter(c => c.name === 'plunder_sarcophagus').filter(c => Math.abs(c.x - 1926) <= 12 && Math.abs(c.z - 4429) <= 12)[0];
    const sat = beside('plunder_sarcophagus', sarc.x, sarc.z)!;
    p.teleport(sat[0], sat[1], 0);
    H.tick(1);
    pin(0);
    try {
        H.opLoc(p, sarc.x, sarc.z, 'plunder_sarcophagus', 1); // open it
        for (let i = 0; i < 12; i++) H.tick(1);
        H.opLoc(p, sarc.x, sarc.z, 'plunder_sarcophagus', 1); // and search it - the roll is pinned to hit
        for (let i = 0; i < 10; i++) H.tick(1);
    } finally {
        pin(null);
    }
    check('the sceptre is in the pack', H.invCount(p, 'pharaohs_sceptre'), 1);
    check('and it throws you out of the pyramid', [p.x, p.z], [3290, 2787]);
    check('the run is over', H.getVarBit(p, 'plunder_room'), 0);

    // Three charges, spent one at a time, and each one takes you back to the lobby.
    for (const [held, next, _leftleft] of [
        ['pharaohs_sceptre', 'pharaohs_sceptre_2', 2],
        ['pharaohs_sceptre_2', 'pharaohs_sceptre_1', 1],
        ['pharaohs_sceptre_1', 'pharaohs_sceptre_0', 0]
    ] as const) {
        H.opheld(p, held, 1);
        for (let i = 0; i < 10; i++) H.tick(1);
        check(`${held} -> ${next}`, H.invCount(p, next), 1);
        check('and lands in the lobby', [p.x, p.z], [1927, 4425]);
        p.teleport(1927, 4425, 0);
        H.tick(1);
    }
    const mark = H.mesgs.length;
    H.opheld(p, 'pharaohs_sceptre_0', 1);
    for (let i = 0; i < 6; i++) H.tick(1);
    check(
        'a spent sceptre takes you nowhere',
        H.mesgs.slice(mark).some(m => m.text.includes('spent')),
        true
    );

    // The mummy fills it, one artefact a charge, and takes the cheapest one.
    H.give(p, 'plunder_golden_statuette');
    H.give(p, 'plunder_ivory_comb');
    const mummy = H.npcNear('plunder_guardian_mummy', 1926, 4425, 0)!;
    const before = H.mesgs.length;
    H.opNpc(p, mummy, 1);
    H.tick(1);
    // "Can you recharge my sceptre?"
    const A = await import('./a1lib.ts');
    A.drive(p, [2]);
    check('a charge goes back in', H.invCount(p, 'pharaohs_sceptre_1'), 1);
    check('and it took the comb, not the statuette', H.invCount(p, 'plunder_golden_statuette'), 1);
    check('the comb is gone', H.invCount(p, 'plunder_ivory_comb'), 0);
    void before;
}

// ---------------------------------------------------------------------------------------------
console.log('== five minutes, and then the pyramid puts you out');
{
    const p = player('plunder_clockout', 1927, 4425);
    p.teleport(1927, 4425, 0);
    p.setLevel(THIEVING, 99);
    H.tick(1);
    H.opNpc(p, H.npcNear('plunder_guardian_mummy', 1926, 4425, 0)!, 3);
    for (let i = 0; i < 8; i++) H.tick(1);
    check('ten half-minutes', H.getVarBit(p, 'plunder_time_left'), 10);
    const mark = H.mesgs.length;
    // 500 ticks is five minutes; the timer fires every fifty.
    for (let i = 0; i < 510; i++) H.tick(1);
    check('the run has ended', H.getVarBit(p, 'plunder_room'), 0);
    check('and you are outside', [p.x, p.z], [3290, 2787]);
    check(
        'with a minute of warning on the way',
        H.mesgs.slice(mark).some(m => m.text.includes('minute left')),
        true
    );
}

// ---------------------------------------------------------------------------------------------
console.log('== the artefacts, and what they are worth');
{
    const VALUE: Record<string, number> = {
        plunder_ivory_comb: 50,
        plunder_pottery_scarab: 75,
        plunder_pottery_statuette: 100,
        plunder_stone_seal: 150,
        plunder_stone_scarab: 175,
        plunder_stone_statuette: 200,
        plunder_gold_seal: 750,
        plunder_golden_scarab: 1000,
        plunder_golden_statuette: 1250
    };
    for (const [nm, cost] of Object.entries(VALUE)) {
        const o = ObjType.get(ObjType.getId(nm));
        check(`${nm} exists`, ObjType.getId(nm) !== -1, true);
        check(`${nm} is worth ${cost}`, o.cost, cost);
        check(`${nm} is tradeable`, o.tradeable, true);
    }
    for (const nm of ['pharaohs_sceptre', 'pharaohs_sceptre_2', 'pharaohs_sceptre_1', 'pharaohs_sceptre_0']) {
        const o = ObjType.get(ObjType.getId(nm));
        check(`${nm} offers Teleport and Check`, [o.iop?.[0], o.iop?.[1]], ['Teleport', 'Check']);
        check(`${nm} is untradeable`, o.tradeable, false);
    }
}

console.log(`\n${R.ok} ok, ${R.bad} failed`);
process.exit(R.bad ? 1 : 0);
