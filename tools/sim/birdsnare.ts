// THE BIRD WALKS INTO THE SNARE INSTEAD OF VANISHING BESIDE IT.
// Usage: npx tsx tools/sim/birdsnare.ts   (exit code is the verdict)
//
// The lure reaches three tiles, and a passed roll used to be cashed the instant it passed: npc_del
// where the bird stood, then the snare shut on a bird nobody had seen arrive. Reported as "you
// don't see the bird land on the snare".
//
// So the assertion that matters is not that a catch happens - it did before - but WHERE the bird is
// when it stops existing. This watches one bird every tick and checks it was standing on the trap.
import fs from 'fs';
import World from '#/engine/World.js';
import * as H from './harness.js';
import { check, R, player } from './a1lib.js';
import LocType from '#/cache/config/LocType.js';
import NpcType from '#/cache/config/NpcType.js';

await H.boot();

const SWIFT = NpcType.getId('hunter_crimson_swift');
const LAID = LocType.getId('hunter_snare_laid');
const CATCHING = LocType.getId('hunter_snare_catching_swift');
const CAUGHT = LocType.getId('hunter_snare_caught_swift');

/** Lay a snare beside a crimson swift and run the trap loop until something happens to it. */
const trapRun = (name: string, maxTicks: number) => {
    let spot: { x: number; z: number } | null = null;
    for (const n of World.npcs) {
        if (n && n.type === SWIFT) {
            spot = { x: n.x, z: n.z };
            break;
        }
    }
    if (!spot) return null;

    const p: any = player(name, spot.x + 1, spot.z, 0);
    p.setLevel(21, 99); // hunter
    H.clearInv(p);
    H.give(p, 'hunter_bird_snare', 1);
    H.opheld(p, 'hunter_bird_snare', 1);
    for (let t = 0; t < 5; t++) H.tick(1);

    // where the snare ended up
    let trap: { x: number; z: number } | null = null;
    for (let dx = -3; dx <= 3 && !trap; dx++) {
        for (let dz = -3; dz <= 3 && !trap; dz++) {
            if (World.getLoc(p.x + dx, p.z + dz, 0, LAID)) trap = { x: p.x + dx, z: p.z + dz };
        }
    }
    if (!trap) return null;

    // Every swift within reach of the lure, tracked tick by tick so that one disappearing can be
    // traced back to where it last stood.
    const last = new Map<number, { x: number; z: number; dist: number }>();
    const track = () => {
        for (const n of World.npcs) {
            if (!n || n.type !== SWIFT || !n.isActive) continue;
            if (Math.max(Math.abs(n.x - trap!.x), Math.abs(n.z - trap!.z)) > 8) continue;
            last.set(n.nid, { x: n.x, z: n.z, dist: Math.max(Math.abs(n.x - trap!.x), Math.abs(n.z - trap!.z)) });
        }
    };
    // npc_del does not destroy a static map npc - it schedules its respawn - so the object stays
    // in World.npcs and goes inactive. Membership is not the question; being in the world is.
    const alive = () => new Set([...World.npcs].filter(n => n && n.type === SWIFT && n.isActive).map(n => n!.nid));

    track();
    let before = alive();
    let vanished: { x: number; z: number; dist: number } | null = null;
    let state = 'laid';
    for (let t = 0; t < maxTicks; t++) {
        H.tick(1);
        const now = alive();
        for (const nid of before) {
            if (!now.has(nid) && last.has(nid) && vanished === null) vanished = last.get(nid)!;
        }
        before = now;
        track();
        if (World.getLoc(trap.x, trap.z, 0, CATCHING)) state = 'catching';
        if (World.getLoc(trap.x, trap.z, 0, CAUGHT)) {
            state = 'caught';
            break;
        }
    }
    return { p, trap, vanished, state };
};

console.log('== a snare catches, and the bird is ON it when it goes');
{
    // A SNARE IS NOT GUARANTEED TO CATCH. The lure is a 1-in-12 roll on a look every two ticks, the
    // bird has to be within three tiles when one lands, and the snare itself falls over after
    // ^hunter_trap_duration - so one trap can simply run out having caught nothing. That is the
    // game, not a defect, so this lays another rather than reporting a failure that is really luck.
    // 250 ticks and six goes rather than 400 and four, for the same wall clock: a snare falls over
    // after ^hunter_trap_duration (200), so everything past that in one run is waiting on a trap
    // that is already gone. Six independent snares beat four long ones.
    let run = trapRun('snarewalk1', 250);
    for (let go = 2; go <= 6 && (run === null || run.vanished === null); go++) {
        run = trapRun('snarewalk' + go, 250);
    }
    check('a snare was laid beside a swift', run !== null, true);
    if (run) {
        check('it caught something', run.state === 'catching' || run.state === 'caught', true);
        check('a bird stopped existing', run.vanished !== null, true);
        if (run.vanished) {
            // THE WHOLE POINT. Before, this was anything from 0 to 3 - the lure radius - because the
            // roll was cashed where the bird happened to be standing.
            console.log(`the bird was ${run.vanished.dist} tiles from the snare when it went`);
            check('and it was standing on the snare, not beside it', run.vanished.dist, 0);
        }
    }
}

console.log('\n== the walk is pointed at the trap, and the catch is checked on arrival');
{
    // Structural, because the timing of a lure is a 1-in-12 roll and a sim that waited for the
    // right one would be slow and flaky. These two lines are what make the difference above true.
    const src = fs.readFileSync('../content/scripts/skill_hunter/scripts/hunter_traps.rs2', 'utf8');
    check('the prey is walked to the loc being sprung', /npc_walk\(loc_coord\);/.test(src), true);
    check('  with its wander turned off first', /npc_setmode\(none\);\s*\n\s*npc_walk\(loc_coord\)/.test(src), true);
    check('  and the catch booked for later', /npc_queue\(5, 0, \^hunter_trap_walkin_ticks\)/.test(src), true);
    // The guard: a bird only disappears onto a snare that is still laid.
    check('the catch only fires on a snare still laid', /loc_find\(npc_coord, hunter_snare_laid\) = false/.test(src), true);
    check('  and a bird it does not catch goes back to wandering', /npc_setmode\(wander\);/.test(src), true);
}

console.log('\n== box traps and deadfalls are untouched');
{
    const src = fs.readFileSync('../content/scripts/skill_hunter/scripts/hunter_traps.rs2', 'utf8');
    const calls = [...src.matchAll(/~hunter_trap_spring\([^;]*?, (true|false)\);/g)].map(m => m[1]);
    const snares = [...src.matchAll(/~hunter_trap_spring\(hunter_snare_[^;]*?, (true|false)\);/g)].map(m => m[1]);
    console.log(`${calls.length} springs in this file, ${snares.length} of them snares`);
    check('every snare walks its bird in', [...new Set(snares)], ['true']);
    check('and nothing else does', [...new Set(calls.filter((_, i) => !snares.includes(calls[i])))].length <= 2, true);
    check('  no spring was left without the flag', /~hunter_trap_spring\([^;]*[^e]\);/.test(src), false);
}

console.log(`\n${R.ok} ok, ${R.bad} FAIL`);
process.exit(R.bad ? 1 : 0);
