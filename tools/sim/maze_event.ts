// THE MAZE, the Mysterious Old Man's other random event, ported from PlagueCityRS 349 in
// DeathPlateau-Content (macro events/scripts/general/macro_event_maze.rs2).
//   npx tsx tools/sim/maze_event.ts
// The old man sends you to a corner of map square 45_71, the overlay counts down from 100%, a chest
// on the way gives a little, and touching the shrine sends you back where he found you with a reward
// scaled by what is left of the counter. A login inside the maze sends you home and does not bring
// him back (tools/sim/macrologout.ts covers the room side of that).
import * as H from './harness.js';
import Component from '#/cache/config/Component.js';
import LocType from '#/cache/config/LocType.js';
import NpcType from '#/cache/config/NpcType.js';
import World from '#/engine/World.js';
import Player from '#/engine/entity/Player.js';
import { CoordGrid } from '#/engine/CoordGrid.js';
import { isMapBlocked } from '#/engine/GameMap.js';
import ScriptState from '#/engine/script/ScriptState.js';

const errors: string[] = [];
const origErr = console.error;
console.error = (...a: unknown[]) => {
    const s = a.map(String).join(' ');
    if (/script error/i.test(s)) errors.push(s);
    origErr(...a);
};

await H.boot();
H.loginOrder();

const R = { ok: 0, bad: 0 };
const check = (what: string, got: unknown, want: unknown) => {
    const pass = JSON.stringify(got) === JSON.stringify(want);
    if (pass) R.ok++;
    else R.bad++;
    console.log(`${pass ? '  ok  ' : 'FAIL  '}${what}: ${JSON.stringify(got)}${pass ? '' : `   (want ${JSON.stringify(want)})`}`);
};

const MAZE = 22; // ^macro_maze
const HOME: [number, number] = [3222, 3218];
const CORNERS = [
    [2891, 4597],
    [2933, 4597],
    [2933, 4555],
    [2891, 4555]
].map(([x, z]) => `${x},${z}`);
const OVERLAY = Component.getId('mazetimer');
const inMaze = (p: Player) => p.level === 0 && p.x >> 6 === 45 && p.z >> 6 === 71;
const invTotal = (p: Player) => {
    const inv = p.getInventory(93)!;
    let n = 0;
    for (let i = 0; i < inv.capacity; i++) if (inv.get(i)) n++;
    return n;
};

// [mapzone]/[mapzoneexit] fire from NetworkPlayer's map-square check, which a sim player does not
// run, so this does the same whenever the player's map square changes.
const lastSquare = new Map<Player, number>();
const step = (p: Player, n = 1) => {
    for (let i = 0; i < n; i++) {
        H.tick(1);
        const sq = CoordGrid.packCoord(0, (p.x >> 6) << 6, (p.z >> 6) << 6);
        const was = lastSquare.get(p);
        if (was !== undefined && was !== sq) {
            const { x, z } = CoordGrid.unpackCoord(was);
            p.triggerMapzoneExit(x, z);
        }
        lastSquare.set(p, sq);
    }
};

/** Click through whatever chat box is up, as a player would, and close what is left. */
const talkThrough = (p: Player) => {
    for (let i = 0; i < 20; i++) {
        const sc = p.activeScript;
        if (sc && sc.execution === ScriptState.PAUSEBUTTON) p.executeScript(sc, true, true);
        step(p, 1);
    }
    if (p.modalChat !== -1) p.closeModal();
};

/**
 * Click a loc from a tile beside it that can actually reach it: the maze's walls sit on tile edges,
 * so an open tile beside a chest can still be the wrong side of one. Tries each in turn, and keeps
 * the first that does not end in "I can't reach that!".
 */
const useLoc = (p: Player, name: string, nearX: number, nearZ: number, ticks: number) => {
    const l = H.locsNear(name, nearX, nearZ, 0)[0];
    if (!l) throw new Error('no ' + name);
    const t = LocType.get(LocType.getId(name));
    for (let dx = -1; dx <= t.width; dx++) {
        for (let dz = -1; dz <= t.length; dz++) {
            const inside = dx >= 0 && dx < t.width && dz >= 0 && dz < t.length;
            if (inside || isMapBlocked(l.x + dx, l.z + dz, 0)) continue;
            p.teleport(l.x + dx, l.z + dz, 0);
            step(p, 2);
            const m = H.mesgs.length;
            H.opLoc(p, l.x, l.z, name, 1);
            step(p, ticks);
            if (!H.mesgs.slice(m).some(x => x.who === p.username && /can't reach/.test(x.text))) return l;
        }
    }
    throw new Error('could not reach ' + name);
};

const LOW_WALLS = ['macro_maze_walllow', 'macro_maze_walllow_safe1', 'macro_maze_walllow_safe2', 'macro_maze_walllow_safe3', 'macor_maze_walllow_safe4'];

/**
 * Open one of the low walls next to the shrine, from whichever side it opens: try each low wall
 * within two tiles of it from each open tile around the wall, until one turns into the open wall
 * (macro_maze_wallinactive). Returns what the wrong side said along the way.
 */
const openShrineWall = (p: Player): { opened: boolean; refused: boolean } => {
    let refused = false;
    const sh = H.locsNear('macro_maze_complete', 2912, 4576, 0)[0];
    for (const name of LOW_WALLS) {
        for (const w of H.locsNear(name, sh.x + 1, sh.z + 1, 0).filter(w => Math.abs(w.x - (sh.x + 1)) <= 3 && Math.abs(w.z - (sh.z + 1)) <= 3)) {
            for (const [dx, dz] of [
                [-1, 0],
                [1, 0],
                [0, -1],
                [0, 1],
                [0, 0]
            ]) {
                const x = w.x + dx;
                const z = w.z + dz;
                if (isMapBlocked(x, z, 0) || (x >= sh.x && x < sh.x + 3 && z >= sh.z && z < sh.z + 3)) continue;
                p.teleport(x, z, 0);
                step(p, 2);
                const m = H.ifaces.length;
                const from = [p.x, p.z];
                H.opLoc(p, w.x, w.z, name, 1);
                // the wall opens and shuts again within the tick, so what shows it worked is that you
                // ended up on the far side of it
                step(p, 6);
                const wrongWay = H.ifaces.slice(m).some(f => f.who === p.username && /right way/.test(f.text ?? ''));
                if (wrongWay) refused = true;
                if (p.modalChat !== -1) p.closeModal();
                const crossed = from[0] <= w.x !== p.x <= w.x || from[1] <= w.z !== p.z <= w.z;
                if (!wrongWay && crossed) return { opened: true, refused };
            }
        }
    }
    return { opened: false, refused };
};

console.log('MAZE  the old man sends you in');
const p = H.makePlayer('mazerunner', HOME[0], HOME[1], 1);
H.maxOut(p);
step(p, 2);
H.runProc(p, '[proc,macro_event_general_spawn]', [MAZE]);
step(p, 4);
check(
    'he says his maze line',
    H.saysFor('macro_mage').some(s => /you'll do/.test(s.text)),
    true
);
check('you are in the maze, at one of its four corners', [inMaze(p), CORNERS.includes(`${p.x},${p.z}`)], [true, true]);
check('the event is the maze, and the way home is where he found you', [H.getVar(p, 'macro_event'), H.getVar(p, 'macro_event_target_coord')], [MAZE, CoordGrid.packCoord(0, HOME[0], HOME[1])]);
check('the counter starts at 100% and its overlay is up', [H.getVar(p, 'macro_maze_percent'), p.overlay], [100, OVERLAY]);
talkThrough(p);
const oldMen = () => World.npcs.filter(n => n && NpcType.get(n.type).debugname === 'macro_mage' && Math.abs(n.x - HOME[0]) < 20 && Math.abs(n.z - HOME[1]) < 20).length;
step(p, 4);
check('...and he has gone', oldMen(), 0);

console.log('MAZE  the counter');
step(p, 26);
const pct = H.getVar(p, 'macro_maze_percent');
console.log(`    at ${pct}%`);
check('it runs down while you look', pct < 100 && pct >= 88, true);

console.log('MAZE  a chest on the way');
{
    const before = invTotal(p);
    const c = useLoc(p, 'macro_maze_chest', p.x, p.z, 6);
    talkThrough(p);
    check('opening one gives you something', invTotal(p) > before, true);
    check('...and it is empty for a while', H.locAt(0, c.x, c.z, 'macro_maze_chestempty'), true);
    p.closeModal();
}

console.log('MAZE  the shrine');
{
    const before = invTotal(p);
    const wall = openShrineWall(p);
    check('a low wall beside the shrine opens, and you go through it', wall.opened, true);
    console.log(`    (a one-sided wall refused on the way: ${wall.refused})`);
    const sh = H.locsNear('macro_maze_complete', 2912, 4576, 0)[0];
    H.opLoc(p, sh.x, sh.z, 'macro_maze_complete', 1);
    step(p, 14);
    check('touching it sends you home', [p.x, p.z, p.level], [HOME[0], HOME[1], 0]);
    check('the event is over, the counter cleared and the overlay down', [H.getVar(p, 'macro_event'), H.getVar(p, 'macro_maze_percent'), p.overlay], [0, 0, -1]);
    check('and there is a reward', invTotal(p) > before, true);
}

console.log('MAZE  the shrine, outside the event');
{
    const q = H.makePlayer('tourist', HOME[0], HOME[1] + 2, 2);
    H.maxOut(q);
    step(q, 2);
    openShrineWall(q);
    const sh = H.locsNear('macro_maze_complete', 2912, 4576, 0)[0];
    const m = H.mesgs.length;
    H.opLoc(q, sh.x, sh.z, 'macro_maze_complete', 1);
    step(q, 6);
    check('does nothing for somebody the old man did not send', [inMaze(q), H.mesgs.slice(m).some(x => x.who === q.username && /Nothing interesting/.test(x.text))], [true, true]);
}

console.log('MAZE  logging out inside it');
{
    const q = H.makePlayer('mazelogout', 2891, 4597, 3);
    q.teleport(2891, 4597, 0);
    H.maxOut(q);
    H.setVar(q, 'macro_event', MAZE);
    H.setVar(q, 'macro_event_target_coord', CoordGrid.packCoord(0, HOME[0], HOME[1] - 4));
    const men = oldMen();
    step(q, 8);
    check('the login sends you home', [q.x, q.z], [HOME[0], HOME[1] - 4]);
    check('...and does not bring the old man back to send you in again', oldMen(), men);
    check('...and the event is let go of', H.getVar(q, 'macro_event'), 0);
}

check('no script errors', errors, []);

console.log(`\n${R.ok} ok, ${R.bad} FAIL`);
process.exit(R.bad ? 1 : 0);
