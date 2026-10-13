// HOW LONG A PEST CONTROL PORTAL TAKES TO KILL, for a range of players.
//
// Usage: npx tsx tools/sim/pestttk.ts
//
// A MEASUREMENT, NOT A CHECK - it prints a table and always exits 0. tools/sim/pestsolo.ts is the
// pass/fail suite and it pins the portals' hitpoints and defence; this is what those two numbers
// were chosen from, and what to re-run if anybody changes them.
//
// WHY IT EXISTS. Old School's novice portal has 250 hitpoints and 120 defence, tuned for five to
// twenty-five players hitting it at once. This build's Pest Control is solo. The first version
// shipped with Old School's numbers and a maxed account with an abyssal whip needed 203 ticks to
// drop ONE portal - 812 for four, against what was then a 500-tick clock, before walking between
// portals 37 tiles apart and before the pests got a say. It was not hard, it was arithmetically
// impossible, and nothing in the pass/fail suite could see it: every check passed.
//
// THREE THINGS THIS HAD TO GET RIGHT BEFORE ITS NUMBERS MEANT ANYTHING, each of which produced a
// confidently wrong table first:
//
//   * STOP THE GAME'S CLOCK. With it running the Void Knight drains to zero and the cleanup
//     deletes the portal, which an "is it dead yet" loop reads as a kill - three different
//     loadouts all reported 390 ticks, which was the game ending, not the portal dying.
//   * STAND SOMEWHERE THAT WORKS. A size-3 npc anchored at (x,z) occupies x..x+2 / z..z+2.
//     Teleporting the player to (x+1,z+1) puts them INSIDE it, where the target sets and no damage
//     is ever dealt - that table had a maxed whip doing nothing and a mithril scimitar at combat 40
//     killing in 84 ticks. It now tries the four mid-edge tiles and keeps the first that draws
//     blood.
//   * AVERAGE. One run is noise: the same maxed account read 76 ticks with an abyssal whip and 20
//     with a rune scimitar, the wrong way round. Five runs, median.
import * as H from './harness.js';
import World from '#/engine/World.js';
import NpcType from '#/cache/config/NpcType.js';
import ScriptProvider from '#/engine/script/ScriptProvider.js';
import ScriptRunner from '#/engine/script/ScriptRunner.js';
import ScriptState from '#/engine/script/ScriptState.js';
import Component from '#/cache/config/Component.js';
import Player from '#/engine/entity/Player.js';
import { PlayerStat } from '#/engine/entity/PlayerStat.js';
import { ProtectedActivePlayer } from '#/engine/script/ScriptPointer.js';
await H.boot();
H.loginOrder();
function runP(p: Player, name: string) {
    const sc = ScriptProvider.getByName(name)!;
    const was = p.protect;
    p.protect = true;
    const st = ScriptRunner.init(sc, p, null, []);
    for (const ptr of ProtectedActivePlayer) st.pointerAdd(ptr);
    ScriptRunner.execute(st);
    p.protect = was;
}
function dismiss(p: Player) {
    for (let t = 0; t < 8; t++) {
        const st = p.activeScript;
        if (st && st.execution === ScriptState.PAUSEBUTTON) {
            const names = p.resumeButtons.map((id: number) => Component.get(id).comName ?? '');
            if (names.length) {
                p.lastCom = Component.getId(names[0]);
                p.executeScript(st, true, true);
                continue;
            }
            if (p.modalChat !== -1) {
                p.lastCom = p.modalChat;
                p.executeScript(st, true, true);
                continue;
            }
        }
        if (!p.containsModalInterface()) return;
        p.closeModal();
        H.tick(1);
    }
}
let bucket = 1;
function measureOnce(levels: number, weapon: string | null): number {
    const p = H.makePlayer('ttk' + bucket, 3222, 3222, bucket++);
    H.tick(2);
    for (const [, st] of [
        ['A', PlayerStat.ATTACK],
        ['S', PlayerStat.STRENGTH],
        ['D', PlayerStat.DEFENCE],
        ['H', PlayerStat.HITPOINTS],
        ['R', PlayerStat.RANGED],
        ['M', PlayerStat.MAGIC]
    ] as [string, number][]) {
        p.setLevel(st, levels);
    }
    p.setLevel(PlayerStat.HITPOINTS, Math.max(levels, 10));
    H.clearInv(p);
    if (weapon) H.equip(p, { rhand: weapon });
    H.tick(1);
    runP(p, '[proc,pest_solo_start]');
    H.tick(1);
    dismiss(p);
    H.tick(2);
    const portal = [...World.npcs].filter(n => n && n.isActive && (NpcType.get(n.type).debugname ?? '').startsWith('pest_portal') && Math.max(Math.abs(n.x - p.x), Math.abs(n.z - p.z)) < 90)[0];
    if (!portal) return -1;
    // STOP THE GAME'S OWN CLOCK FIRST. With it running the knight drains to zero around tick 400
    // and the cleanup deletes the portal, which an "is it dead yet" loop reads as a kill - the first
    // version of this measurement reported 390 ticks for three different loadouts, which was the
    // game ending, not the portal dying.
    for (const [id, t] of (p as unknown as { timers: Map<number, { script?: { name?: string } }> }).timers) {
        if (t.script?.name === '[timer,pest_solo_tick]') {
            (p as unknown as { timers: Map<number, unknown> }).timers.delete(id);
        }
    }
    const hp0 = portal.levels[3];
    // STAND SOMEWHERE THAT ACTUALLY WORKS. A size-3 npc anchored at (x,z) occupies x..x+2 / z..z+2,
    // and the first version of this teleported the player to (x+1,z+1) - the CENTRE, inside the
    // footprint - where p.target sets but no damage is ever dealt. That produced a table where a
    // maxed whip did nothing and a mithril scimitar at combat 40 killed in 84 ticks, which is
    // impossible and was entirely the measurement. So try the four mid-edge tiles and keep the first
    // one that draws blood.
    const spots: [number, number][] = [
        [portal.x - 1, portal.z + 1],
        [portal.x + 3, portal.z + 1],
        [portal.x + 1, portal.z - 1],
        [portal.x + 1, portal.z + 3]
    ];
    let working = false;
    for (const [sx, sz] of spots) {
        p.teleport(sx, sz, portal.level);
        H.tick(2);
        H.attackNpc(p, portal);
        const before = portal.levels[3];
        for (let t = 0; t < 30; t++) {
            H.tick(1);
            if (!p.target && portal.isActive) H.attackNpc(p, portal);
        }
        if (portal.levels[3] < before) {
            working = true;
            break;
        }
    }
    if (!working) return -1;
    H.attackNpc(p, portal);
    // A FIXED WINDOW, then extrapolate. Measuring "ticks until dead" is noisy when a run of misses
    // can double it; damage over a fixed 200 ticks is the dps, and the time to kill follows.
    const WINDOW = 200;
    const start = portal.levels[3]; // after the probing swings above
    let ticks = -1;
    for (let t = 1; t <= WINDOW; t++) {
        H.tick(1);
        if (!portal.isActive || portal.levels[3] <= 0) {
            ticks = t;
            break;
        }
        if (!p.target) H.attackNpc(p, portal);
    }
    const dealt = start - Math.max(0, portal.isActive ? portal.levels[3] : 0);
    if (ticks < 0) {
        ticks = dealt > 0 ? Math.round(hp0 / (dealt / WINDOW)) : -1;
    }
    const def = portal.levels[1];
    runP(p, '[proc,pest_solo_end]');
    H.tick(1);
    dismiss(p);
    void hp0;
    void def;
    return ticks;
}

// AVERAGED OVER REPEATS, because one run is noise: a short window plus a run of misses had the
// same maxed account reading 76 ticks with an abyssal whip and 20 with a rune scimitar, which is
// the wrong way round. Five runs and the median is stable enough to tune on.
function measure(label: string, levels: number, weapon: string | null): void {
    const runs: number[] = [];
    for (let i = 0; i < 5; i++) {
        const t = measureOnce(levels, weapon);
        if (t > 0) runs.push(t);
    }
    if (!runs.length) {
        console.log(`${label.padEnd(26)} no usable runs`);
        return;
    }
    runs.sort((a, b) => a - b);
    const median = runs[Math.floor(runs.length / 2)];
    console.log(`${label.padEnd(26)} median ${String(median).padStart(4)} ticks   ` + `x4 = ${String(median * 4).padStart(4)} of an 800-tick clock   runs: ${runs.join(',')}`);
}
measure('maxed + abyssal whip', 99, 'abyssal_whip');
measure('maxed + rune scimitar', 99, 'rune_scimitar');
measure('70s + rune scimitar', 70, 'rune_scimitar');
measure('cb~40 + mithril scimitar', 40, 'mithril_scimitar');
process.exit(0);
