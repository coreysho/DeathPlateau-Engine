// The Lost Tribe's caves, against the real engine - run with `npx tsx tools/sim/soultribe.ts`.
// (A Soul's Bane's last room is in soulsbane.ts.)
//
//   squeeze    the hole in the cellar wall is crawled through - human_longcrawl, the anim that came
//              in with the quest - across the two tiles, both ways; the swamp-cave hole the same
//   darkness   the tunnels, the goblin maze, the Dorgeshuun mine and the Lumbridge Swamp Caves are
//              dark: the overlay by how much light you carry, the insects' warning at 15 ticks and
//              their bites from 30 with no light, none with one; the castle cellar stays lit; the
//              swarm by the swamp caves' rope sends you up it
//   maze       a floor trap drops you into the swamp caves by the pool and puts your light out; a
//              ceiling trap brings the rocks down and puts you back where you came from; the safe
//              side of the one "pass" trap does nothing; the symbols' way through touches no trap
//
// A sim player has no client, so the engine never runs its map-square update (NetworkPlayer
// .updateMap) and the [mapzone] triggers would never fire. tick() below does that part of it by
// hand - the same comparison, the same Player.triggerMapzone/-Exit calls - so the content's own
// triggers start and stop the darkness.
import * as H from './harness.js';
import World from '#/engine/World.js';
import Player from '#/engine/entity/Player.js';
import Component from '#/cache/config/Component.js';
import SeqType from '#/cache/config/SeqType.js';
import LocType from '#/cache/config/LocType.js';
import ScriptProvider from '#/engine/script/ScriptProvider.js';
import ScriptState from '#/engine/script/ScriptState.js';
import { CoordGrid } from '#/engine/CoordGrid.js';
import { canTravel } from '#/engine/GameMap.js';
import { CollisionType } from '#/engine/routefinder/index.js';

await H.boot();
H.loginOrder();

let ok = 0, bad = 0;
const check = (what: string, got: unknown, want: unknown) => {
    const pass = JSON.stringify(got) === JSON.stringify(want);
    pass ? ok++ : bad++;
    console.log(`  ${pass ? 'ok  ' : 'FAIL'} ${what}: ${JSON.stringify(got)}${pass ? '' : `   (want ${JSON.stringify(want)})`}`);
};
const truthy = (what: string, pass: boolean, got: unknown) => {
    pass ? ok++ : bad++;
    console.log(`  ${pass ? 'ok  ' : 'FAIL'} ${what}: ${JSON.stringify(got)}`);
};

const players: Player[] = [];
function tick(n = 1) {
    for (let i = 0; i < n; i++) {
        H.tick(1);
        for (const p of players) {
            const mapZone = CoordGrid.packCoord(0, (p.x >> 6) << 6, (p.z >> 6) << 6);
            if (p.lastMapZone !== mapZone) {
                if (p.lastMapZone !== -1) {
                    const { x, z } = CoordGrid.unpackCoord(p.lastMapZone);
                    p.triggerMapzoneExit(x, z);
                }
                p.triggerMapzone((p.x >> 6) << 6, (p.z >> 6) << 6);
                p.lastMapZone = mapZone;
            }
        }
    }
}
function player(name: string, x: number, z: number, ip: number) {
    const p = H.makePlayer(name, x, z, ip);
    players.push(p);
    tick(2);
    H.maxOut(p);
    H.clearInv(p);
    tick(1);
    return p;
}
const at = (p: Player) => [p.x, p.z, p.level];
const mesSince = (p: Player, from: number) => H.mesgs.slice(from).filter(m => m.who === p.username).map(m => m.text);
const hitsSince = (p: Player, from: number) => H.hits.slice(from).filter(h => h.who === p.username).map(h => h.damage);
const overlayName = (p: Player) => (p.overlay === -1 ? 'none' : Component.get(p.overlay).comName);
const heal = (p: Player) => p.setLevel(3, 99);

/** Let a script run out, clicking through chat. */
function drive(p: Player) {
    for (let guard = 0; guard < 100; guard++) {
        const s = p.activeScript;
        if (!s || s.execution !== ScriptState.PAUSEBUTTON) {
            if (!s && guard > 3) break;
            tick(1);
            continue;
        }
        p.executeScript(s, true, true);
    }
}
function op(p: Player, x: number, z: number, locName: string, n = 1) {
    H.opLoc(p, x, z, locName, n);
    drive(p);
}

// Every exactmove the engine is asked for.
const moves: { tick: number; who: string; from: number[]; to: number[]; start: number; end: number; dir: number }[] = [];
const origExact = (Player.prototype as any).exactMove;
(Player.prototype as any).exactMove = function (sx: number, sz: number, ex: number, ez: number, start: number, end: number, dir: number) {
    moves.push({ tick: World.currentTick, who: this.username, from: [sx, sz], to: [ex, ez], start, end, dir });
    return origExact.call(this, sx, sz, ex, ez, start, end, dir);
};
const LONGCRAWL = SeqType.getId('human_longcrawl');

// =============================================================================================
console.log('SQUEEZE');
const s = player('tribe_squeeze', 3218, 9618, 81);
H.setVarBit(s, 'lost_tribe_quest', 4);
H.give(s, 'torch_lit');
let a0 = H.anims.length;
op(s, 3219, 9618, 'lost_tribe_cellar_wall');
check('cellar -> cave: through to the cave side', at(s), [3221, 9618, 0]);
check('  crawling: human_longcrawl (seq 2796)', H.anims.slice(a0).filter(x => x.who === s.username).map(x => x.seq), [LONGCRAWL]);
check('  and an exactmove across the wall, 0-96 client cycles, facing east', moves.filter(m => m.who === s.username).slice(-1).map(m => [m.from, m.to, m.start, m.end]), [[[3219, 9618], [3221, 9618], 0, 96]]);
a0 = H.anims.length;
op(s, 3221, 9618, 'lost_tribe_cellar_wall_back');
check('cave -> cellar: back the same way', [at(s), H.anims.slice(a0).filter(x => x.who === s.username).map(x => x.seq), moves.slice(-1).map(m => [m.from, m.to])], [[3219, 9618, 0], [LONGCRAWL], [[[3221, 9618], [3219, 9618]]]]);
s.teleport(3224, 9604, 0);
tick(2);
a0 = H.anims.length;
op(s, 3224, 9601, 'lost_tribe_hole_2');
check('the hole down to the swamp caves is crawled through too', [at(s), H.anims.slice(a0).filter(x => x.who === s.username).map(x => x.seq)], [[3224, 9600, 0], [LONGCRAWL]]);

// =============================================================================================
console.log('DARKNESS');
const d = player('tribe_dark', 3222, 3218, 82);
H.setVarBit(d, 'lost_tribe_quest', 4);
d.teleport(3218, 9618, 0); // the castle cellar
tick(3);
check('the castle cellar is lit (no overlay)', overlayName(d), 'none');
let m0 = H.mesgs.length;
let h0 = H.hits.length;
op(d, 3219, 9618, 'lost_tribe_cellar_wall');
const arrived = moves.filter(m => m.who === d.username).slice(-1)[0].tick;
tick(1);
check('through the hole with no light: the darkest overlay', [at(d), overlayName(d)], [[3221, 9618, 0], 'inter_248']);
tick(45);
const warnAt = H.mesgs.slice(m0).find(m => m.who === d.username && m.text.startsWith('You hear tiny insects'))?.tick ?? -1;
const swarmAt = H.mesgs.slice(m0).find(m => m.who === d.username && m.text.includes('Tiny biting insects swarm all over you!'))?.tick ?? -1;
const biteTicks = H.hits.slice(h0).filter(h => h.who === d.username).map(h => h.tick);
const bites = hitsSince(d, h0);
truthy('  "You hear tiny insects skittering over the ground..." 9 s in, the swarm 9 s after that', warnAt - arrived >= 14 && warnAt - arrived <= 16 && swarmAt - warnAt === 15, { warn: warnAt - arrived, swarm: swarmAt - arrived });
check('  no bite before the swarm, the first with it', biteTicks[0] - swarmAt, 0);
truthy('  and then a 1 every tick', bites.length >= 10 && bites.every(x => x === 1) && biteTicks.every((t, i) => i === 0 || t - biteTicks[i - 1] === 1), bites);
heal(d);
H.give(d, 'torch_lit');
tick(2);
m0 = H.mesgs.length;
h0 = H.hits.length;
tick(40);
check('a lit torch: dimmer (inter_250), and the insects keep away', [overlayName(d), hitsSince(d, h0), mesSince(d, m0)], ['inter_250', [], []]);
H.give(d, 'oil_lantern_lit');
tick(2);
check('  a torch and an oil lantern (1 + 2): as good as daylight', overlayName(d), 'none');
H.clearInv(d);
H.give(d, 'oil_lamp_lit');
tick(2);
check('  an oil lamp alone (2): the lightest overlay (inter_249)', overlayName(d), 'inter_249');
H.clearInv(d);
H.give(d, 'bullseye_lantern_lit');
tick(2);
check('  a bullseye lantern (3): no overlay', overlayName(d), 'none');
H.clearInv(d);
d.teleport(3300, 9620, 0); // the Dorgeshuun mine end of the maze
tick(3);
check('the Dorgeshuun mine is dark too', overlayName(d), 'inter_248');
d.teleport(3180, 9560, 0); // the Lumbridge Swamp Caves
tick(3);
check('and the Lumbridge Swamp Caves', overlayName(d), 'inter_248');
d.teleport(3222, 3218, 0);
tick(3);
check('back on the surface: the overlay goes, and the timer stops', [overlayName(d), d.timers.has(ScriptProvider.getByName('[softtimer,cave_darkness]')!.id)], ['none', false]);
// the swamp caves' rope: the swarm drives you back up it
d.teleport(3171, 9572, 0);
tick(3);
m0 = H.mesgs.length;
h0 = H.hits.length;
tick(34);
check('with no light by the swamp caves\' rope, the swarm sends you up it ("You manage to find your way to the exit.")', [at(d), mesSince(d, m0).slice(-1), hitsSince(d, h0)], [[3168, 3172, 0], ['You manage to find your way to the exit.'], []]);

// =============================================================================================
console.log('MAZE');
const t = player('tribe_maze', 3222, 3218, 83);
H.setVarBit(t, 'lost_tribe_quest', 4);
H.give(t, 'torch_lit');
H.give(t, 'lit_candle');
t.teleport(3237, 9622, 0); // the dead end west of the floor trap at 3238|3239,9622
tick(3);
m0 = H.mesgs.length;
H.walkTo(t, 3238, 9622);
tick(6);
check('a wrong turn onto a floor trap: down into the swamp caves, by the pool', at(t), [3229, 9582, 0]);
check('  "The floor collapses beneath you!", "You are swept into an underground river.", and the lights go out', mesSince(t, m0), ['The floor collapses beneath you!', 'You are swept into an underground river.', 'Your lit candle goes out!', 'Your torch goes out!']);
check('  a torch and a candle, both unlit now', [H.invCount(t, 'torch_lit'), H.invCount(t, 'torch_unlit'), H.invCount(t, 'lit_candle'), H.invCount(t, 'unlit_candle')], [0, 1, 0, 1]);
tick(2);
check('  and it is dark down there', overlayName(t), 'inter_248');
// the other side of the same trap drops you just the same
H.clearInv(t);
H.give(t, 'bullseye_lantern_lit');
t.teleport(3240, 9622, 0);
tick(3);
H.walkTo(t, 3239, 9622);
tick(6);
check('  from its other end too, and a bullseye lantern stays lit', [at(t), H.invCount(t, 'bullseye_lantern_lit')], [[3229, 9582, 0], 1]);
// a ceiling trap
t.teleport(3248, 9646, 0);
tick(3);
m0 = H.mesgs.length;
h0 = H.hits.length;
heal(t);
H.walkTo(t, 3249, 9646);
tick(6);
const ceil = mesSince(t, m0);
const rocks = hitsSince(t, h0);
truthy('a ceiling trap: "The ceiling suddenly collapses!", then the rocks miss you or hit (1-3)', ceil[0] === 'The ceiling suddenly collapses!' && ((ceil[1] === 'You manage to evade the falling rocks.' && rocks.length === 0) || (rocks.length === 1 && rocks[0] >= 1 && rocks[0] <= 3)), { ceil, rocks });
check('  and you are back where you came from', at(t), [3248, 9646, 0]);
// the "pass" side of the ceiling trap at 3255|3256,9616
t.teleport(3257, 9616, 0);
tick(3);
m0 = H.mesgs.length;
H.walkTo(t, 3256, 9616);
tick(5);
check('the safe side of the one "pass" trap: nothing happens', [at(t), mesSince(t, m0)], [[3256, 9616, 0], []]);
t.teleport(3254, 9616, 0);
tick(3);
m0 = H.mesgs.length;
H.walkTo(t, 3255, 9616);
tick(6);
check('  its other side is a ceiling trap', [mesSince(t, m0)[0], at(t)], ['The ceiling suddenly collapses!', [3254, 9616, 0]]);

// the way the symbols point touches no trap: from the cellar hole to Mistag without stepping on one
const trapTiles = new Set<string>();
for (const [name] of [['lost_tribe_trap_floor'], ['lost_tribe_trap_ceiling']]) {
    for (let x = 3221; x < 3328; x++) for (let z = 9600; z < 9664; z++) {
        if (World.getLoc(x, z, 0, LocType.getId(name))) trapTiles.add(`${x},${z}`);
    }
}
check('ten traps\' worth of trap tiles (19 - one pass side)', trapTiles.size, 19);
function flood(x: number, z: number, avoid: Set<string>) {
    const seen = new Set<string>([`${x},${z}`]);
    const q: [number, number][] = [[x, z]];
    while (q.length) {
        const [cx, cz] = q.pop()!;
        for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            const k = `${cx + dx},${cz + dz}`;
            if (seen.has(k) || avoid.has(k)) continue;
            if (canTravel(0, cx, cz, dx, dz, 1, 0, CollisionType.NORMAL)) { seen.add(k); q.push([cx + dx, cz + dz]); }
        }
    }
    return seen;
}
check('the cellar hole to Mistag, never standing on a trap', flood(3221, 9618, trapTiles).has('3318,9615'), true);

console.log(`\n${ok} ok, ${bad} FAIL`);
process.exit(bad ? 1 : 0);

