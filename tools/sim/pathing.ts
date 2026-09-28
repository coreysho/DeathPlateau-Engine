// Walking up to a target and hitting it - run with `npx tsx tools/sim/pathing.ts [scenario] [-v]`.
//
// The owner's report: "attacking something, the player runs towards, then back, then back towards",
// and a video of a player swinging at a wall beside an open door with the hitsplat landing on
// someone on the other side. Every scenario prints the player's tile, route, target tile and
// interaction each tick (-v prints all of them, otherwise only the failing ones), and checks:
//
//   never under    a player never walks onto the tiles a big npc stands on (the 377 client routes to
//                  an npc as if it were 1x1 at its south-west tile, so its route ends INSIDE a cow or
//                  a demon, and the engine then random-walked the player out: in, back, in, out)
//   no doubling    in open ground the player never steps back the way it just came
//   reach          every melee swing is made from a tile that reaches the target (no diagonals, no
//                  fences, no corner of a wall by an open door); every shot has line of sight
//   fences         a fence between player and target is walked around, or given up on with "I can't
//                  reach that!" - never stared at forever, never swung through
//   npcs           an npc chasing a player ends beside it (a big one too) and never hits through a
//                  fence
//   bosses         the bosses that pick melee or a ranged/magic attack themselves (Kalphite Queen,
//                  skeletal wyvern, marble gargoyle, the Dagannoth mother, the Soulbane heads,
//                  Tok-Xil, Ket-Zek, Jad) melee only where the swing reaches (npc_canreach) - not
//                  from across a corner, not over a fence - and shoot or cast from there instead
//   still works    a bow still shoots over a fence, a moving target is caught, PvP fights close up,
//                  "Bank" on a banker behind the counter still opens the bank
//
// Before the fix: demon (on the demon's tiles for 3-6 ticks, stepping back and forth) and fence (stood
// at the fence for good, still "interacting") fail every run; under fails most runs (it is a random
// walk). The reach, door, wall and npc scenarios passed before too - they guard the rules that stop a
// hit landing through a wall, which the engine already kept.
import * as H from './harness.ts';
import World from '#/engine/World.js';
import Player from '#/engine/entity/Player.js';
import Npc from '#/engine/entity/Npc.js';
import ObjType from '#/cache/config/ObjType.js';
import NpcType from '#/cache/config/NpcType.js';
import ScriptProvider from '#/engine/script/ScriptProvider.js';
import VarPlayerType from '#/cache/config/VarPlayerType.js';
import { CoordGrid } from '#/engine/CoordGrid.js';
import { Interaction } from '#/engine/entity/Interaction.js';
import ServerTriggerType from '#/engine/script/ServerTriggerType.js';
import { findPathToEntity, isLineOfSight, reachedEntity } from '#/engine/GameMap.js';

await H.boot();
H.loginOrder();

const only = process.argv.slice(2).find(a => !a.startsWith('-'));
const verbose = process.argv.includes('-v');
let ok = 0,
    bad = 0;
let log: string[] = [];
let scenarioFailed = false;
const check = (what: string, got: unknown, want: unknown) => {
    const pass = JSON.stringify(got) === JSON.stringify(want);
    if (pass) ok++;
    else {
        bad++;
        scenarioFailed = true;
    }
    console.log(`  ${pass ? 'ok  ' : 'FAIL'} ${what}: ${JSON.stringify(got)}${pass ? '' : `   (want ${JSON.stringify(want)})`}`);
};

// ---- who swung at whom, from where: every attack animation, with the reach at that moment
type Swing = { tick: number; who: string; px: number; pz: number; tx: number; tz: number; reach: boolean; los: boolean };
const swings: Swing[] = [];
const DEFEND = new Set([424, 1156, 388, 403, 410, 397, 378, 1659]); // block anims: not a swing
const opponent = new Map<Player | Npc, Player | Npc>();
const origPlayerAnim = (Player.prototype as any).playAnimation;
(Player.prototype as any).playAnimation = function (seq: number, delay: number) {
    const t = opponent.get(this);
    if (t && seq !== -1 && !DEFEND.has(seq)) {
        swings.push({ tick: World.currentTick, who: this.username, px: this.x, pz: this.z, tx: t.x, tz: t.z, reach: reachedEntity(this.level, this.x, this.z, t.x, t.z, t.width, t.length, this.width), los: isLineOfSight(this.level, this.x, this.z, t.x, t.z) });
    }
    return origPlayerAnim.call(this, seq, delay);
};
// An npc's attack is its [ai_opplayerN] script running on its target: where both stand at that moment.
const origNpcExec = (Npc.prototype as any).executeScript;
(Npc.prototype as any).executeScript = function (state: any) {
    const t = opponent.get(this);
    const name: string = state?.script?.name ?? '';
    if (t && name.startsWith('[ai_opplayer')) {
        swings.push({ tick: World.currentTick, who: 'npc', px: this.x, pz: this.z, tx: t.x, tz: t.z, reach: reachedEntity(this.level, this.x, this.z, t.x, t.z, t.width, t.length, this.width), los: true });
    }
    const was = runningNpc;
    runningNpc = this;
    try {
        return origNpcExec.call(this, state);
    } finally {
        runningNpc = was;
    }
};
// A boss that picks its style in an [ai_applayerN] trigger swings in melee by calling
// ~npc_meleeattack: every call, with where the npc and its target stood at that moment.
type Melee = { tick: number; npc: string; nx: number; nz: number; px: number; pz: number; reach: boolean };
const melees: Melee[] = [];
let runningNpc: Npc | null = null;
const origGet = ScriptProvider.get.bind(ScriptProvider);
(ScriptProvider as any).get = (id: number) => {
    const script = origGet(id);
    const npc = runningNpc;
    const t = npc ? opponent.get(npc) : undefined;
    if (npc && t && script?.name === '[proc,npc_meleeattack]') {
        melees.push({ tick: World.currentTick, npc: NpcType.get(npc.type).debugname ?? '', nx: npc.x, nz: npc.z, px: t.x, pz: t.z, reach: reachedEntity(npc.level, npc.x, npc.z, t.x, t.z, t.width, t.length, npc.width) });
    }
    return script;
};

// ---- the clicks, as a 377 client makes them
let n = 0;
function player(x: number, z: number, run = false): Player {
    const p = H.makePlayer('path' + n, x, z, 90 + n);
    n++;
    H.tick(2);
    H.maxOut(p);
    H.clearInv(p);
    p.run = run ? 1 : 0;
    p.setVar(VarPlayerType.RUN, p.run);
    return p;
}
function npcAt(name: string, x: number, z: number, still = true): Npc {
    const npc = H.addNpc(name, x, z);
    if (still) (npc as any).targetOp = 0; // NpcMode.NONE: stands where it is put until it is fought
    return npc;
}
/**
 * "Attack" on an npc, as the 377 client sends it: MOVE_OPCLICK with the client's own route, then
 * OPNPC2. The client routes to an npc as a 1x1 square at its south-west tile (Client.java tryMove,
 * locWidth/locLength 1) and knows nothing of other npcs, so for a cow or a demon its route ends on
 * a tile the npc is standing on. OpNpcHandler then clears the interaction and sets APNPC2.
 */
function clickAttack(p: Player, npc: Npc) {
    p.clearPendingAction();
    p.queueWaypoints(findPathToEntity(p.level, p.x, p.z, npc.x, npc.z, 1, 1, 1));
    p.setInteraction(Interaction.ENGINE, npc, ServerTriggerType.APNPC2);
    (p as any).opcalled = true;
    opponent.set(p, npc);
}
function clickAttackPlayer(p: Player, other: Player) {
    p.clearPendingAction();
    p.queueWaypoints(findPathToEntity(p.level, p.x, p.z, other.x, other.z, 1, 1, 1));
    p.setInteraction(Interaction.ENGINE, other, ServerTriggerType.APPLAYER2);
    (p as any).opcalled = true;
    opponent.set(p, other);
}
function wield(p: Player, objName: string) {
    H.give(p, objName);
    const op = ObjType.get(ObjType.getId(objName)).iop?.findIndex(o => o === 'Wield' || o === 'Wear');
    H.opheld(p, objName, (op ?? 1) + 1);
}

const wps = (e: Player | Npc) => {
    const out: string[] = [];
    for (let i = e.waypointIndex; i >= 0; i--) {
        const c = CoordGrid.unpackCoord(e.waypoints[i]);
        out.push(`${c.x},${c.z}`);
    }
    return out.join('>');
};
const under = (p: Player, t: Npc | Player) => CoordGrid.intersects(p.x, p.z, 1, 1, t.x, t.z, t.width, t.length);

type Tick = { t: number; px: number; pz: number; tx: number; tz: number; under: boolean; target: boolean };
/** Tick the world, logging the player's tile, route and target each tick. */
function run(p: Player, target: Npc | Player, ticks: number, each?: (i: number) => void): Tick[] {
    const out: Tick[] = [];
    for (let i = 1; i <= ticks; i++) {
        const tk = World.currentTick;
        each?.(i);
        H.tick(1);
        const hitsOn = (target instanceof Npc ? H.npcHits : H.hits).filter(h => h.tick === tk && (target instanceof Npc || h.who === (target as Player).username));
        const sw = swings.filter(s => s.tick === tk && s.who === p.username);
        const hurt = H.hits.filter(h => h.tick === tk && h.who === p.username).map(h => h.damage);
        const mes = H.mesgs.filter(m => m.tick === tk && m.who === p.username).map(m => m.text);
        const u = under(p, target);
        out.push({ t: i, px: p.x, pz: p.z, tx: target.x, tz: target.z, under: u, target: p.target !== null });
        log.push(
            `    t${String(i).padStart(2)}  player ${p.x},${p.z}  route [${wps(p)}]  target ${target.x},${target.z}${target.width > 1 ? ` (${target.width}x${target.width})` : ''}  ${p.target ? 'interacting' : '-'}` +
                `${u ? '  UNDER' : ''}${sw.length ? `  SWING${sw.some(s => !s.reach) ? '(no reach)' : ''}` : ''}${hitsOn.length ? `  hit ${hitsOn.map(h => h.damage).join('+')}` : ''}${hurt.length ? `  hurt ${hurt.join('+')}` : ''}${mes.length ? `  "${mes.join('" "')}"` : ''}`
        );
    }
    return out;
}
/** Steps that go back the way the last one came (a dot product below zero). */
function doublings(ticks: Tick[], x0: number, z0: number): number {
    let n = 0;
    let lx = x0,
        lz = z0,
        ldx = 0,
        ldz = 0;
    for (const t of ticks) {
        const dx = Math.sign(t.px - lx),
            dz = Math.sign(t.pz - lz);
        if (dx !== 0 || dz !== 0) {
            if (dx * ldx + dz * ldz < 0) n++;
            ldx = dx;
            ldz = dz;
        }
        lx = t.px;
        lz = t.pz;
    }
    return n;
}
function scenario(name: string, fn: () => void) {
    const key = name.split(' ')[0];
    if (only && only !== key) return;
    console.log(`\n${name}`);
    log = [];
    scenarioFailed = false;
    swings.length = 0;
    opponent.clear();
    H.clearLogs();
    fn();
    if (verbose || scenarioFailed) for (const l of log) console.log(l);
}
function cleanup(...es: (Player | Npc)[]) {
    for (const e of es) {
        if (e instanceof Player) H.despawn(e);
        else World.removeNpc(e, -1);
    }
    H.tick(1);
}
const playerSwings = (p: Player) => swings.filter(s => s.who === p.username);

// ------------------------------------------------------------------------------------------------
// East of the Lumbridge cow field: open grass x 3267-3276, the field's fence between x 3265 and 3266.

scenario('demon  a greater demon (3x3), clicked from the north-east, running', () => {
    const p = player(3276, 3272, true);
    const npc = npcAt('greater_demon', 3270, 3264);
    clickAttack(p, npc);
    log.push(`    client route [${wps(p)}]  (ends on ${wps(p).split('>').pop()}, a tile of the demon)`);
    const ticks = run(p, npc, 10);
    check('never on a tile the demon stands on', ticks.filter(t => t.under).length, 0);
    check('never steps back the way it came', doublings(ticks, 3276, 3272), 0);
    check('swings from beside it', playerSwings(p).length > 0 && playerSwings(p).every(s => s.reach), true);
    check('  and gets there in 3 ticks (8 tiles, running)', ticks.findIndex(t => playerSwings(p).some(s => s.px === t.px && s.pz === t.pz)) + 1 <= 4, true);
    cleanup(p, npc);
});

scenario('cow  a cow (2x2) walking north, a player running at it from the north-east', () => {
    const p = player(3276, 3275, true);
    const npc = npcAt('cow', 3270, 3262);
    clickAttack(p, npc);
    const ticks = run(p, npc, 12, i => {
        if (i <= 8) npc.queueWaypoint(npc.x, npc.z + 1);
    });
    check('never on a tile the cow stands on', ticks.filter(t => t.under).length, 0);
    check('never steps back the way it came', doublings(ticks, 3276, 3275), 0);
    check('swings, and only from beside it', playerSwings(p).length > 0 && playerSwings(p).every(s => s.reach), true);
    cleanup(p, npc);
});

scenario('under  standing in the middle of a greater demon (3x3) and clicking it, walking', () => {
    const p = player(3271, 3265, false);
    const npc = npcAt('greater_demon', 3270, 3264);
    clickAttack(p, npc);
    const ticks = run(p, npc, 6);
    const out = ticks.findIndex(t => !t.under) + 1;
    check('walks straight out - two steps to the nearest side, out on tick 2', out, 2);
    check('  then stays out', ticks.slice(out).filter(t => t.under).length, 0);
    check('  and swings from beside it', playerSwings(p).length > 0 && playerSwings(p).every(s => s.reach), true);
    cleanup(p, npc);
});

scenario('chase  a man walking away east, the player walking after him', () => {
    const p = player(3268, 3262, false);
    const npc = npcAt('man', 3272, 3266);
    clickAttack(p, npc);
    const ticks = run(p, npc, 14, i => {
        if (i <= 7) npc.queueWaypoint(npc.x + 1, npc.z);
    });
    check('never steps back the way it came', doublings(ticks, 3268, 3262), 0);
    check('catches him and swings from beside him', playerSwings(p).length > 0 && playerSwings(p).every(s => s.reach), true);
    cleanup(p, npc);
});

scenario('demonchase  a greater demon walking east, the player running after it from the north-east', () => {
    const p = player(3278, 3272, true);
    const npc = npcAt('greater_demon', 3268, 3264);
    clickAttack(p, npc);
    const ticks = run(p, npc, 12, i => {
        if (i <= 6) npc.queueWaypoint(npc.x + 1, npc.z);
    });
    check('never on a tile the demon stands on', ticks.filter(t => t.under).length, 0);
    check('swings, and only from beside it', playerSwings(p).length > 0 && playerSwings(p).every(s => s.reach), true);
    cleanup(p, npc);
});

scenario('diagonal  a man one tile diagonally away (melee)', () => {
    const p = player(3270, 3260, false);
    const npc = npcAt('man', 3271, 3261);
    clickAttack(p, npc);
    run(p, npc, 6);
    const s = playerSwings(p);
    check('swings', s.length > 0, true);
    check('never from the diagonal - it steps beside him first', s.every(x => x.reach), true);
    cleanup(p, npc);
});

scenario('fence  a man two tiles the other side of the cow-field fence (melee)', () => {
    const p = player(3262, 3270, true);
    const npc = npcAt('man', 3267, 3270);
    clickAttack(p, npc);
    const ticks = run(p, npc, 30);
    const across = swings.filter(s => s.who === p.username && (s.px <= 3265) !== (s.tx <= 3265));
    check('no swing across the fence', across.length, 0);
    const gaveUp = H.mesgs.some(m => m.who === p.username && m.text === "I can't reach that!");
    const walkedRound = playerSwings(p).some(s => s.reach);
    check('walks round to him, or says it cannot reach - never stands at the fence for good', gaveUp || walkedRound, true);
    check('  and is not still standing at the fence trying at the end', ticks[ticks.length - 1].target && ticks[ticks.length - 1].px === 3265, false);
    cleanup(p, npc);
});

scenario('bow  a man over the cow-field fence, shot with a shortbow', () => {
    const p = player(3262, 3270, false);
    wield(p, 'shortbow');
    H.equip(p, { quiver: 'bronze_arrow' });
    const npc = npcAt('man', 3267, 3270);
    clickAttack(p, npc);
    run(p, npc, 8);
    const s = playerSwings(p);
    check('shoots over the fence without walking round (Old School and 2006 alike)', [s.length > 0, s.every(x => x.px <= 3265 && x.los)], [true, true]);
    cleanup(p, npc);
});

// ------------------------------------------------------------------------------------------------
// The shop east of Lumbridge's general store door: a stone building, its doorway at 3214,3245 opening
// east onto 3215,3245, the open door lying along the doorway's north edge. Outside at 3215,3246 is
// diagonally beside the doorway with the wall's end between them - the owner's video.

scenario('door  a man in a doorway, attacked from outside, diagonally, across the end of the wall', () => {
    const p = player(3215, 3246, false);
    const npc = npcAt('man', 3214, 3245);
    clickAttack(p, npc);
    run(p, npc, 8);
    const s = playerSwings(p);
    check('swings', s.length > 0, true);
    check('never from the diagonal across the wall - from the doorway step', s.every(x => x.reach), true);
    cleanup(p, npc);
});

scenario('wall  a man inside the stone building, shot at from outside its east wall', () => {
    const p = player(3218, 3247, false);
    wield(p, 'shortbow');
    H.equip(p, { quiver: 'bronze_arrow' });
    const npc = npcAt('man', 3211, 3247);
    clickAttack(p, npc);
    run(p, npc, 14);
    const s = playerSwings(p);
    check('every shot has line of sight (none through the wall)', s.every(x => x.los), true);
    check('  and it does get a shot, through the doorway', s.length > 0, true);
    cleanup(p, npc);
});

scenario('around  a man walking along the far side of the building, the player going round to him', () => {
    const p = player(3211, 3254, true);
    const npc = npcAt('man', 3211, 3239);
    clickAttack(p, npc);
    const ticks = run(p, npc, 24, i => {
        if (i <= 6) npc.queueWaypoint(npc.x + 1, npc.z);
    });
    check('gets round the building to him and swings from beside him', playerSwings(p).length > 0 && playerSwings(p).every(s => s.reach), true);
    check('  and never stands still short of him with a route it cannot walk', ticks.some((t, i) => i > 0 && t.target && !playerSwings(p).length && t.px === ticks[i - 1].px && t.pz === ticks[i - 1].pz && Math.max(Math.abs(t.px - t.tx), Math.abs(t.pz - t.tz)) > 1), false);
    cleanup(p, npc);
});

scenario('bank  "Bank" on a Draynor banker behind the counter, from across the room', () => {
    const banker = H.npcNear('banker1', 3092, 3243);
    if (!banker) throw new Error('no Draynor banker');
    const p = player(banker.x + 5, banker.z, false);
    // the 377 client sends no route for an npc it cannot reach (tryMove without "nearest"): just the op
    p.clearPendingAction();
    p.setInteraction(Interaction.ENGINE, banker, ServerTriggerType.APNPC3);
    const ticks = run(p, banker, 10);
    check('walks to the counter and the bank opens', (p as any).modalMain !== -1 || (p as any).modalState !== 0, true);
    check('  without a "cannot reach" on the way', H.mesgs.some(m => m.who === p.username && m.text === "I can't reach that!"), false);
    void ticks;
    H.despawn(p);
    H.tick(1);
});

// ------------------------------------------------------------------------------------------------
// Npcs chasing players.

scenario('npcchase  an aggressive man chasing a player who walks away, then stops', () => {
    const p = player(3270, 3262, false);
    const npc = npcAt('man', 3270, 3265, false);
    H.setNpcMode(npc, 'OPPLAYER2', p);
    opponent.set(npc, p);
    H.walkTo(p, 3273, 3259);
    run(p, npc, 14);
    check('it catches up and hits', H.hits.filter(h => h.who === p.username).length > 0, true);
    check('  only ever attacking from beside the player', swings.filter(x => x.who === 'npc').every(x => x.reach), true);
    cleanup(p, npc);
});

scenario('bignpc  a greater demon (3x3) chasing a player to its north-east, who then steps round it', () => {
    const p = player(3274, 3268, false);
    const npc = npcAt('greater_demon', 3268, 3262, false);
    H.setNpcMode(npc, 'OPPLAYER2', p);
    opponent.set(npc, p);
    const npcTiles: { x: number; z: number }[] = [];
    const ticks = run(p, npc, 16, i => {
        npcTiles.push({ x: npc.x, z: npc.z });
        if (i === 8) H.walkTo(p, p.x + 1, p.z - 3);
    });
    check('it closes in and hits', H.hits.filter(h => h.who === p.username).length > 0, true);
    check('  only ever attacking from beside the player', swings.filter(x => x.who === 'npc').every(x => x.reach), true);
    check('  and when the player walks under it, it steps out rather than hitting from on top', swings.filter(x => x.who === 'npc' && CoordGrid.intersects(x.tx, x.tz, 1, 1, x.px, x.pz, 3, 3)).length, 0);
    log.push(`    demon: ${npcTiles.map(t => `${t.x},${t.z}`).join(' ')}`);
    cleanup(p, npc);
});

scenario('demonfence  a greater demon hunting a player who stands behind the cow-field fence', () => {
    const p = player(3264, 3272, false);
    const npc = npcAt('greater_demon', 3267, 3271, false);
    H.setNpcMode(npc, 'OPPLAYER2', p);
    opponent.set(npc, p);
    run(p, npc, 12);
    check('never hits through the fence', H.hits.filter(h => h.who === p.username).length, 0);
    check('  and stays its own side of it', npc.x >= 3266, true);
    cleanup(p, npc);
});

// ------------------------------------------------------------------------------------------------
// PvP, in the wilderness north of Edgeville.

scenario('pvp  two players attacking each other, both running', () => {
    const a = player(3090, 3545, true);
    const b = player(3094, 3550, true);
    clickAttackPlayer(a, b);
    clickAttackPlayer(b, a);
    const ticks = run(a, b, 12);
    check('never on the same tile as the other', ticks.filter(t => t.under).length, 0);
    check('they close up and swing from beside each other', [playerSwings(a).length > 0 && playerSwings(a).every(s => s.reach), playerSwings(b).length > 0 && playerSwings(b).every(s => s.reach)], [true, true]);
    cleanup(a, b);
});

// ------------------------------------------------------------------------------------------------
// Bosses that choose melee or a ranged/magic attack in their [ai_applayer2] trigger. Melee is only
// where a swing reaches (npc_canreach, the same rule as an opplayer2 swing): never from across one of
// their corners, never over a fence. Anywhere else they shoot, breathe or cast instead.
//
// Each boss is put in ap mode on a player standing still, first diagonally off its north-east corner
// (npc_range 1, no reach), then straight against its east face (reach). Hitpoints are topped up every
// tick; the player never attacks (auto retaliate is off).

function bossRound(name: string, x: number, z: number, px: number, pz: number, ticks: number) {
    const p = player(px, pz, false);
    H.setVar(p, 'option_nodef', 1); // auto retaliate off: the player stays on its tile
    const npc = npcAt(name, x, z, false);
    H.setNpcMode(npc, 'APPLAYER2', p);
    opponent.set(npc, p);
    const m0 = melees.length;
    const h0 = H.hits.filter(h => h.who === p.username).length;
    run(p, npc, ticks, () => {
        p.levels[3] = 99;
        if (!npc.target) H.setNpcMode(npc, 'APPLAYER2', p);
    });
    const m = melees.slice(m0);
    const hits = H.hits.filter(h => h.who === p.username).length - h0;
    log.push(`    ${name} at ${x},${z} (${npc.width}x${npc.width}), player ${px},${pz}: ${hits} attacks landed, ${m.length} melee swings (${m.filter(x => !x.reach).length} without reach)`);
    cleanup(p, npc);
    return { melee: m, hits };
}

const BOSSES: { name: string; key: string; meleeAlways?: boolean }[] = [
    { name: 'kalphite_queen', key: 'kq' },
    { name: 'kalphite_flyingqueen', key: 'kq2' },
    { name: 'skeletal_wyvern1', key: 'wyvern' },
    { name: 'superior_marble_gargoyle', key: 'gargoyle' },
    { name: 'horror_dagganoth_melee', key: 'dagmother', meleeAlways: true },
    { name: 'soulbane_final_tolna1', key: 'tolna', meleeAlways: true },
    { name: 'tzhaar_fightcave_swarm_3a', key: 'tokxil', meleeAlways: true },
    { name: 'tzhaar_fightcave_swarm_5a', key: 'ketzek', meleeAlways: true },
    { name: 'tzhaar_fightcave_swarm_boss', key: 'jad' }
];
for (const b of BOSSES) {
    scenario(`${b.key}  ${b.name}: melee only where the swing reaches`, () => {
        const size = NpcType.get(NpcType.getId(b.name)).size;
        const x = 3268,
            z = 3278;
        // diagonal off the north-east corner: npc_range(coord) is 1 here, and no melee swing reaches
        const diag = bossRound(b.name, x, z, x + size, z + size, 16);
        check('from the diagonal: attacks, and never in melee', [diag.hits > 0, diag.melee.length], [true, 0]);
        // against the east face: melee reaches
        const face = bossRound(b.name, x, z, x + size, z, 16);
        check('against its face: every melee swing reaches', face.melee.every(m => m.reach), true);
        if (b.meleeAlways) check('  and it does swing in melee there', face.melee.length > 0, true);
    });
}

scenario('wyvernfence  a skeletal wyvern (3x3) against the cow-field fence, the player just the other side', () => {
    // the fence runs between x 3265 and 3266; the wyvern's west face is on it, the player across it
    const r = bossRound('skeletal_wyvern1', 3266, 3270, 3265, 3271, 20);
    check('never bites over the fence, and still attacks (ranged or breath)', [r.melee.length, r.hits > 0], [0, true]);
});

console.log(`\n${ok} ok, ${bad} failed`);
process.exit(bad === 0 ? 0 : 1);
