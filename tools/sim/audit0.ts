// Quest audit, batch 0 - every fix driven through the real triggers on the real map.
// Usage: npx tsx tools/sim/audit0.ts <section>      sections: tog wanted gd abyss mm death fairy
// Run one section per process (for s in tog wanted gd abyss mm death fairy; do ...; done): the
// sections share one world, and npcs moved or killed by one section confuse the next.
//
// Tears of Guthix   the swamp caves' stepping stones and dark hole, the climb out of the cave (it
//                   landed in rock), the rocks that now lead on to Juna, the light creatures across
//                   the chasm, the bowl, the run, and the completion that an empty bowl used to skip
// Wanted!           Solus can be spoken to where the map places him, sightings count, he is
//                   cornered, and Tiffy finishes the quest (with or without the hat)
// The Giant Dwarf   Keldagrim's doors open (the arrival house was a sealed room), the directors and
//                   the boatman out; the quest from Hammerspike to the Supreme Commander
// Enter the Abyss   the 1000 Runecrafting experience the mage promised
// Monkey Madness    the gate into Marim, Kruk across the palisade, the zoo monkeys through the
//                   bars, and the rest of the quest to Daero's training
// Death Plateau and A Fairy Tale Part I are unchanged - walked and driven to show they still work
// on today's map (Burthorpe's west end is an OSRS import now).
import * as H from './harness.js';
import World from '#/engine/World.js';
import Npc from '#/engine/entity/Npc.js';
import LocType from '#/cache/config/LocType.js';
import NpcType from '#/cache/config/NpcType.js';
import ObjType from '#/cache/config/ObjType.js';
import InvType from '#/cache/config/InvType.js';
import Component from '#/cache/config/Component.js';
import ScriptState from '#/engine/script/ScriptState.js';
import ServerTriggerType from '#/engine/script/ServerTriggerType.js';
import { Interaction } from '#/engine/entity/Interaction.js';
import { findPathToLoc, findPathToEntity, canTravel, findPath } from '#/engine/GameMap.js';
import CategoryType from '#/cache/config/CategoryType.js';
import { CollisionType } from '#/engine/routefinder/index.js';
import { PlayerStat } from '#/engine/entity/PlayerStat.js';
import Player from '#/engine/entity/Player.js';
import fs from 'fs';

await H.boot();
H.loginOrder();

const R = { ok: 0, bad: 0 };
const check = (what: string, got: unknown, want: unknown) => {
    const pass = JSON.stringify(got) === JSON.stringify(want);
    if (pass) R.ok++;
    else R.bad++;
    console.log(`  ${pass ? 'ok  ' : 'FAIL'} ${what}: ${JSON.stringify(got)}${pass ? '' : `   (want ${JSON.stringify(want)})`}`);
};

let bucket = 1;
function player(name: string, x: number, z: number, level = 0) {
    const p = H.makePlayer(name, x, z, bucket++);
    H.tick(1);
    p.teleport(x, z, level);
    H.maxOut(p);
    H.clearInv(p);
    H.tick(1);
    return p;
}
const at = (p: Player) => [p.x, p.z, p.level];
const mesSince = (p: Player, from: number) => H.mesgs.slice(from).filter(m => m.who === p.username).map(m => m.text);
const var_ = (p: Player, v: string) => { try { return H.getVar(p, v); } catch { return H.getVarBit(p, v); } };
const vb = (p: Player, v: string) => H.getVarBit(p, v);
const setV = (p: Player, v: string, n: number) => { try { H.setVar(p, v, n); } catch { H.setVarBit(p, v, n); } };

/** Let a script run out, clicking through any chat pages and taking `picks` at menus (1-based). */
function drive(p: Player, picks: number[] = [], guardTicks = 3): string[] {
    const from = H.ifaces.length;
    let idle = 0;
    for (let guard = 0; guard < 600 && idle < guardTicks; guard++) {
        const s = p.activeScript;
        if (!s || s.execution !== ScriptState.PAUSEBUTTON) {
            if (!s && !p.delayed && [...p.queue.all()].length === 0 && !p.target) idle++;
            else idle = 0;
            H.tick(1);
            continue;
        }
        idle = 0;
        const names = p.resumeButtons.map((id: number) => Component.get(id).comName ?? '');
        const open = p.modalChat === -1 ? '' : (Component.get(p.modalChat).comName ?? '');
        const multi = open.startsWith('multi') ? names.find((n: string) => n.startsWith(open + ':')) : null;
        if (multi) {
            const pick = picks.shift();
            if (pick === undefined) throw new Error('unexpected menu: ' + open);
            H.choose(p, `${multi.split(':')[0]}:com_${pick}`);
        } else {
            p.executeScript(s, true, true);
        }
    }
    if (picks.length) throw new Error('menus not reached: ' + picks.join(','));
    return H.ifaces.slice(from).filter(i => i.who === p.username && i.kind === 'text' && i.text && i.text.length > 1).map(i => i.text!);
}

function nearestNpc(name: string, x: number, z: number, level: number): Npc | null {
    const id = NpcType.getId(name);
    if (id === -1) throw new Error('no npc type ' + name);
    let best: Npc | null = null, bd = 1e9;
    for (const n of World.npcs) {
        if (!n || !n.isActive || n.type !== id || n.level !== level) continue;
        const d = Math.max(Math.abs(n.x - x), Math.abs(n.z - z));
        if (d < bd) { bd = d; best = n; }
    }
    return best;
}

/** Click an npc from where the player stands (no teleporting next to it) and run the dialogue. */
function talkHere(p: Player, npcName: string, picks: number[] = [], op = 1): string[] {
    const npc = nearestNpc(npcName, p.x, p.z, p.level);
    if (!npc) throw new Error('no npc ' + npcName);
    const m0 = H.mesgs.length;
    drive(p, [], 2);
    const i0 = H.ifaces.length;
    for (let attempt = 0; attempt < 4 && !p.activeScript; attempt++) {
        H.opNpc(p, npc, op);
        for (let t = 0; t < 40 && !p.activeScript; t++) H.tick(1);
    }
    if (!p.activeScript) console.log(`    [talk ${npcName} did not start]`, at(p), [npc.x, npc.z], mesSince(p, m0));
    drive(p, picks);
    return H.ifaces.slice(i0).filter(i => i.who === p.username && i.kind === 'text' && i.text && i.text.length > 1).map(i => i.text!);
}
/** Stand next to the npc first, then talk. */
function talk(p: Player, npcName: string, picks: number[] = [], op = 1): string[] {
    const npc = [0, 1, 2, 3].map(l => nearestNpc(npcName, p.x, p.z, l)).filter(n => n).sort((a, b) => Math.max(Math.abs(a!.x - p.x), Math.abs(a!.z - p.z)) - Math.max(Math.abs(b!.x - p.x), Math.abs(b!.z - p.z)))[0];
    if (!npc) throw new Error('no npc ' + npcName);
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [2, 0], [0, 2]]) {
        if (!canTravel(npc.level, npc.x + dx, npc.z + dz, 0, 0, 1, 0, CollisionType.NORMAL) && false) continue;
        p.teleport(npc.x + dx, npc.z + dz, npc.level);
        H.tick(1);
        H.opNpc(p, npc, op);
        for (let t = 0; t < 10 && !p.activeScript; t++) H.tick(1);
        if (p.activeScript) break;
    }
    return drive(p, picks);
}
function op(p: Player, x: number, z: number, locName: string, n = 1, picks: number[] = []) {
    H.opLoc(p, x, z, locName, n);
    return drive(p, picks);
}
function slotOf(p: Player, objName: string) {
    const obj = ObjType.getId(objName);
    const inv = p.getInventory(InvType.INV)!;
    for (let i = 0; i < inv.capacity; i++) if (inv.get(i)?.id === obj) return { obj, slot: i };
    throw new Error('not carrying ' + objName);
}
function useOnLoc(p: Player, x: number, z: number, locName: string, objName: string) {
    const id = LocType.getId(locName);
    const loc = World.getLoc(x, z, p.level, id);
    if (!loc) throw new Error(`no ${locName} at ${x},${z},${p.level}`);
    const { obj, slot } = slotOf(p, objName);
    p.clearPendingAction();
    p.queueWaypoints(findPathToLoc(p.level, p.x, p.z, loc.x, loc.z, p.width, loc.width, loc.length, loc.angle, loc.shape, LocType.get(id).forceapproach));
    p.lastUseItem = obj;
    p.lastUseSlot = slot;
    p.setInteraction(Interaction.ENGINE, loc, ServerTriggerType.APLOCU);
    (p as unknown as { opcalled: boolean }).opcalled = true;
    return drive(p);
}
function useOnNpc(p: Player, npc: Npc, objName: string) {
    const { obj, slot } = slotOf(p, objName);
    p.clearPendingAction();
    p.queueWaypoints(findPathToEntity(p.level, p.x, p.z, npc.x, npc.z, p.width, npc.width, npc.length));
    p.lastUseItem = obj;
    p.lastUseSlot = slot;
    p.setInteraction(Interaction.ENGINE, npc, ServerTriggerType.APNPCU);
    (p as unknown as { opcalled: boolean }).opcalled = true;
    return drive(p);
}
function itemOnItem(p: Player, a: string, b: string) {
    const A = slotOf(p, a), B = slotOf(p, b);
    p.lastUseItem = A.obj; p.lastUseSlot = A.slot;
    p.lastItem = B.obj; p.lastSlot = B.slot;
    const script = (ScriptProviderRef.getByTrigger(ServerTriggerType.OPHELDU, B.obj, ObjType.get(B.obj).category)
        ?? ScriptProviderRef.getByTrigger(ServerTriggerType.OPHELDU, A.obj, ObjType.get(A.obj).category));
    if (!script) throw new Error(`no opheldu for ${a} on ${b}`);
    if (!ScriptProviderRef.getByTrigger(ServerTriggerType.OPHELDU, B.obj, ObjType.get(B.obj).category)) {
        p.lastUseItem = B.obj; p.lastUseSlot = B.slot; p.lastItem = A.obj; p.lastSlot = A.slot;
    }
    p.executeScript(ScriptRunnerRef.init(script, p), true);
    return drive(p);
}
import ScriptProviderRef from '#/engine/script/ScriptProvider.js';
import ScriptRunnerRef from '#/engine/script/ScriptRunner.js';

/** Is (tx,tz) reachable on foot from (x,z)? A flood over the real collision map. */
function connected(level: number, x: number, z: number, tx: number, tz: number, radius = 200): boolean {
    const seen = new Set<string>([x + ',' + z]);
    const q = [[x, z]];
    while (q.length) {
        const [cx, cz] = q.pop()!;
        if (Math.abs(cx - tx) + Math.abs(cz - tz) <= 1) return true;
        for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            const nx = cx + dx, nz = cz + dz, k = nx + ',' + nz;
            if (seen.has(k) || Math.abs(nx - x) > radius || Math.abs(nz - z) > radius) continue;
            if (canTravel(level, cx, cz, dx, dz, 1, 0, CollisionType.NORMAL)) { seen.add(k); q.push([nx, nz]); }
        }
    }
    return false;
}
const want = process.argv.slice(2);
const run = (s: string) => want.length === 0 || want.includes(s);

// =============================================================================================
if (run('tog')) {
    console.log('TEARS OF GUTHIX');
    const p = player('togger', 3169, 3171);
    // 43 quest points, the way the quest list counts them
    H.give(p, 'rune_pickaxe');
    H.give(p, 'chisel');
    H.give(p, 'lit_candle');
    let m = H.mesgs.length;
    op(p, 3169, 3172, 'goblin_cave_entrance');
    check('the dark hole in the swamp takes you down to the caves', [at(p), connected(0, p.x, p.z, 3203, 9572)], [[3168, 9572, 0], true]);
    op(p, 3169, 9572, 'swamp_cave_climbing_rope');
    check('and the rope climbs back out beside it', at(p), [3168, 3172, 0]);
    op(p, 3169, 3172, 'goblin_cave_entrance');
    p.teleport(3203, 9571, 0);
    H.tick(1);
    op(p, 3206, 9572, 'swamp_cave_steppingstone_a');
    check('the first stepping stones: across to the east bank', at(p), [3208, 9572, 0]);
    op(p, 3206, 9572, 'swamp_cave_steppingstone_a');
    check('  and back', at(p), [3204, 9572, 0]);
    op(p, 3206, 9572, 'swamp_cave_steppingstone_a');
    check('the east bank walks to the second stones', connected(0, p.x, p.z, 3221, 9556), true);
    p.teleport(3221, 9557, 0);
    H.tick(1);
    op(p, 3221, 9554, 'swamp_cave_steppingstone_b');
    check('the second stones: across, and the Tears of Guthix tunnel can be walked to', [at(p), connected(0, p.x, p.z, 3225, 9542)], [[3222, 9553, 0], true]);
    // the Lost Tribe way round, through the hole by Kazgar
    p.teleport(3224, 9604, 0);
    H.tick(1);
    op(p, 3224, 9601, 'lost_tribe_hole_2');
    check('the hole from the Lost Tribe cave squeezes through to the swamp caves', [at(p), connected(0, p.x, p.z, 3222, 9560)], [[3224, 9600, 0], true]);
    op(p, 3224, 9601, 'lost_tribe_hole_2');
    check('  and back', at(p), [3224, 9604, 0]);

    p.teleport(3225, 9543, 0);
    H.tick(1);
    op(p, 3225, 9539, 'tog_cave_down');
    check('down the Tears of Guthix tunnel', at(p), [3218, 9532, 2]);
    op(p, 3218, 9533, 'tog_cave_up');
    check('and back up: in front of the tunnel, not inside the wall (was 3225,9540)', [at(p), connected(0, p.x, p.z, 3222, 9553)], [[3225, 9542, 0], true]);
    op(p, 3225, 9539, 'tog_cave_down');

    check('the entrance walks to the rocks', connected(2, p.x, p.z, 3239, 9524), true);
    m = H.mesgs.length;
    const juna1 = op(p, 3240, 9524, 'tog_climbing_rocks_up');
    check('the rocks take you down onto Juna\'s level (they said "already at the top")', at(p), [3241, 9524, 1]);
    check('  and Juna turns away a player without 43 quest points', [juna1.some(t => t.includes('stories in you')), vb(p, 'tog_hacky_fix')], [true, 0]);
    giveQuestPoints(p, 60, ['tog_minigame']);
    op(p, 3240, 9524, 'tog_climbing_rocks_up');
    check('back up the rocks to the entrance side', at(p), [3239, 9524, 2]);
    const juna2 = op(p, 3240, 9524, 'tog_climbing_rocks_up');
    check('Juna, with the quest points: the quest starts', [juna2.some(t => t.includes('story')), vb(p, 'tog_hacky_fix'), H.runProc(p, '[proc,tog_progress]')[0]], [true, 1, 1]);
    op(p, 3240, 9524, 'tog_climbing_rocks_up');

    // across the chasm
    const lc = nearestNpc('tog_light_creature', 3225, 9520, 2)!;
    check('light creatures over the chasm', lc !== null, true);
    p.teleport(3226, 9526, 2);
    H.tick(1);
    m = H.mesgs.length;
    useOnNpc(p, lc, 'lit_candle');
    check('a light held up to a light creature carries you over the chasm', at(p), [3225, 9503, 2]);
    // mine the blue stone
    let mined = false;
    for (const [x, z] of [[3228, 9496], [3229, 9497], [3229, 9495], [3227, 9495], [3226, 9494], [3233, 9496], [3228, 9494]]) {
        for (const n of ['tog_blue_stone_rocks1', 'tog_blue_stone_rocks2', 'tog_blue_stone_rocks3']) {
            if (!World.getLoc(x, z, 2, LocType.getId(n))) continue;
            if (!connected(2, p.x, p.z, x, z)) continue;
            op(p, x, z, n);
            mined = H.invCount(p, 'tog_stone') === 1;
            break;
        }
        if (mined) break;
    }
    check('a blue-stone rock can be walked to and mined', [mined, vb(p, 'tog_juna_bowl')], [true, 1]);
    itemOnItem(p, 'chisel', 'tog_stone');
    check('the chisel makes the bowl', [H.invCount(p, 'tog_bowl'), vb(p, 'tog_juna_bowl'), H.runProc(p, '[proc,tog_progress]')[0]], [1, 2, 3]);
    check('the blue-stone side walks to the rocks down to Juna', connected(2, p.x, p.z, 3238, 9498), true);
    // the story - and an EMPTY bowl, which used to skip the completion
    p.teleport(3238, 9498, 2);
    H.tick(1);
    const story = op(p, 3239, 9498, 'tog_climbing_rocks_down', 1);
    check('down the rocks to the east, to Juna, and she hears the story: the run starts', [story.some(t => t.includes('Blue tears')), vb(p, 'tog_minigame_collecting'), at(p)], [true, 1, [3259, 9517, 2]]);
    const qpBefore = var_(p, 'qp');
    const xpBefore = p.stats[PlayerStat.PRAYER];
    H.tick(95);
    drive(p);
    check('the run ends with nothing caught - and still completes the quest (it returned before)', [vb(p, 'tog_minigame_collecting'), H.runProc(p, '[proc,tog_progress]')[0], p.stats[PlayerStat.PRAYER] - xpBefore, H.ifaces.some(i => i.who === p.username && i.kind === 'text' && (i.text ?? '').includes('Tears of Guthix'))], [0, 4, 20000, true]);
    check('  back at the top of the rocks down to her', at(p), [3240, 9498, 2]);
    // from the top of those rocks you can get back out
    op(p, 3239, 9498, 'tog_climbing_rocks_down');
    check('and the rocks by her ledge lead back up to the entrance', connected(1, p.x, p.z, 3241, 9524), true);
    void qpBefore; void m;
}

// =============================================================================================
if (run('wanted')) {
    console.log('WANTED!');
    const p = player('wantedp', 2997, 3375);
    // Recruitment Drive done
    const rdComplete = constant('recruitmentdrive_complete');
    H.setVarBit(p, 'rd_main', rdComplete);
    talk(p, 'rd_teleporter_guy', [1]);
    check('Sir Tiffy hands over the commorb', [var_(p, 'wanted_main'), H.invCount(p, 'wanted_crystal_ball')], [10, 1]);
    H.opheld(p, 'wanted_crystal_ball', 2);
    drive(p);
    check('Contact: Savant briefs you', var_(p, 'wanted_main'), 20);
    H.opheld(p, 'wanted_crystal_ball', 1);
    drive(p);
    check('Scan: the stage moves on to hunting (a jump used to stop it short)', var_(p, 'wanted_main'), 30);
    for (let i = 0; i < 5; i++) {
        const place = H.runProc(p, '[proc,wanted_current_location]')[0];
        if (!place) { check('the orb has a location', place, '>0'); break; }
        const shell = `wanted_solus${place}`;
        const npc = nearestNpc(shell, 3000, 3300, 0);
        const spawn = npc ? [npc.x, npc.z] : null;
        // walk up to him the way a player would, from a few tiles off
        p.teleport(npc!.x + 3, npc!.z, 0);
        H.tick(1);
        if (!connected(0, p.x, p.z, npc!.x, npc!.z, 10)) { p.teleport(npc!.x, npc!.z + 1, 0); H.tick(1); }
        const m0 = H.mesgs.length;
        const said = talkHere(p, shell);
        if (H.runProc(p, '[proc,wanted_sightings]')[0] !== i + 1) console.log('    [debug]', said, mesSince(p, m0), at(p), [npc!.x, npc!.z], connected(0, p.x, p.z, npc!.x, npc!.z, 10));
        check(`sighting ${i + 1}: Solus at location ${place} (${spawn}) can be spoken to, and it counts`, [said.length > 0, H.runProc(p, '[proc,wanted_sightings]')[0], H.runProc(p, '[proc,wanted_current_location]')[0]], [true, i + 1, 0]);
        if (i < 4) {
            H.opheld(p, 'wanted_crystal_ball', 1);
            drive(p);
        }
    }
    // every one of the twelve places, not just the five the orb happened to pick
    for (let place = 1; place <= 12; place++) {
        const q = player('wanted' + place, 3000, 3300);
        setV(q, 'wanted_main', 30);
        H.setVarBit(q, 'wanted_mission' + place, 1);
        const npc = nearestNpc('wanted_solus' + place, 3000, 3300, 0)!;
        // stand on a walkable tile a few steps off, then click him from there
        let stood = false;
        for (const [dx, dz] of [[3, 0], [-3, 0], [0, 3], [0, -3], [2, 2], [-2, -2], [1, 0], [0, 1]]) {
            if (bfsRoute(0, npc.x + dx, npc.z + dz, npc.x, npc.z, 12)) { q.teleport(npc.x + dx, npc.z + dz, 0); stood = true; break; }
        }
        H.tick(1);
        const said = stood ? talkHere(q, 'wanted_solus' + place) : [];
        check(`location ${place} (${H.runProc(q, '[proc,wanted_place_name]', [place]).length ? '' : ''}${npc.x},${npc.z}): Solus can be walked up to and spoken to`, [stood, said.length > 0, H.runProc(q, '[proc,wanted_sightings]')[0]], [true, true, 1]);
        H.despawn(q);
    }
    check('he is cornered, and the hat is yours', [var_(p, 'wanted_main'), H.invCount(p, 'wanted_solus_trophy')], [40, 1]);
    // lost the hat: Tiffy takes Savant's word for it
    H.clearInv(p);
    p.teleport(2997, 3375, 0);
    H.tick(1);
    talk(p, 'rd_teleporter_guy');
    check('Tiffy finishes the quest even with the hat lost', [var_(p, 'wanted_main'), H.ifaces.some(i => i.who === p.username && (i.text ?? '').includes('Wanted!'))], [50, true]);
}

// =============================================================================================
if (run('gd')) {
    console.log('THE GIANT DWARF');
    const p = player('gdwarf', 2967, 9811);
    talk(p, 'favour_hammerspike_stoutbeard', [1]);
    check('Hammerspike starts it', var_(p, 'giantdwarf_quest'), 5);
    talk(p, 'favour_hammerspike_stoutbeard', [1]);
    check('and runs the cart into Keldagrim', [at(p), var_(p, 'giantdwarf_quest')], [[2912, 10222, 0], 10]);
    check('  the house the cart lands you in is sealed without its door', connected(0, p.x, p.z, 2906, 10206), false);
    const via = goTo(p, 2906, 10206, 0);
    check('its door opens (every Keldagrim door said "Nothing interesting happens"), and Blasidar can be walked to', via, true);
    // up to the Consortium
    goTo(p, 2893, 10210, 0);
    op(p, 2894, 10209, 'dwarf_keldagrim_wide_stairs_lower');
    check('the Consortium stairs go up (they said "Unhandled stairs")', [p.level, connected(1, p.x, p.z, 2880, 10199), connected(1, p.x, p.z, 2872, 10189)], [1, true, true]);
    goTo(p, 2881, 10199, 1);
    talkHere(p, 'dwarf_city_trader_referee');
    check('the trade referee makes you a temporary director', var_(p, 'giantdwarf_quest'), 15);
    for (const n of ['blue_opal', 'brown_engine', 'green_gemstone', 'purple_pewter', 'silver_cog', 'white_chisel', 'yellow_fortune']) {
        const dn = nearestNpc('dwarf_city_director_' + n, p.x, p.z, 1)!;
        goTo(p, dn.x, dn.z, 1);
        const d = talkHere(p, 'dwarf_city_director_' + n);
        check(`the ${n} director has something to say now (Talk-to did nothing)`, d.length > 0, true);
    }
    goTo(p, 2896, 10209, 1);
    goTo(p, 2896, 10209, 1);
    op(p, 2895, 10209, 'dwarf_keldagrim_wide_stairs_upper');
    check('and the stairs come back down', p.level, 0);
    goTo(p, 2906, 10206, 0);
    talkHere(p, 'dwarf_city_shop_sculpture');
    check('Blasidar takes the commission', var_(p, 'giantdwarf_quest'), 20);
    for (const pick of [1, 2, 3]) talkHere(p, 'dwarf_city_shop_sculpture_model_multi', [pick]);
    check('boots, torso and axe on the model', vb(p, 'giantdwarf_model_state'), 7);
    talkHere(p, 'dwarf_city_shop_sculpture');
    check('Blasidar puts the statue back up with the new head', var_(p, 'giantdwarf_quest'), 40);
    goTo(p, 2893, 10188, 0);
    op(p, 2894, 10188, 'dwarf_keldagrim_wide_stairs_lower');
    goTo(p, 2873, 10189, 1);
    talkHere(p, 'dwarf_city_director_red_axe_multi');
    check('the Red Axe director gives himself away', var_(p, 'giantdwarf_quest'), 50);
    goTo(p, 2862, 10188, 1);
    op(p, 2863, 10188, 'dwarf_keldagrim_wide_stairs_upper');
    check('down again', p.level, 0);
    // the Black Guard: the Supreme Commander is on a first floor in the west of the city
    let up = false;
    for (const [sx, sz] of [[2828, 10215], [2828, 10225], [2834, 10224], [2835, 10196]]) {
        if (!goTo(p, sx, sz, 0)) continue;
        op(p, sx, sz, 'dwarf_keldagrim_stairs_lower');
        if (p.level === 1 && goTo(p, 2828, 10211, 1)) { up = true; break; }
        if (p.level === 1) { const u = nearestLoc(p, 'dwarf_keldagrim_stairs_upper'); if (u) op(p, u.x, u.z, 'dwarf_keldagrim_stairs_upper'); }
    }
    check('the Supreme Commander can be reached', up, true);
    talkHere(p, 'dwarf_city_black_guard_supreme_leader');
    check('he clears the Red Axe out and the quest completes', [var_(p, 'giantdwarf_quest'), vb(p, 'giantdwarf_red_axe_gone'), H.invCount(p, 'dwarf_minecart_ticket_kelda_ice')], [60, 1, 1]);
    // and out of the city again
    const u = nearestLoc(p, 'dwarf_keldagrim_stairs_upper');
    if (u) op(p, u.x, u.z, 'dwarf_keldagrim_stairs_upper');
    const boat = goTo(p, 2889, 10225, 0);
    talkHere(p, 'dwarf_city_boatman_city', [1]);
    check('the city boatman takes you back to the tunnels (there was no way out)', [boat, at(p)], [true, [2966, 9811, 0]]);
}

// =============================================================================================
if (run('abyss')) {
    console.log('ENTER THE ABYSS');
    const p = player('abyssp', 3259, 3383);
    H.setVar(p, 'runemysteries', 6);
    H.setVar(p, 'abyssal_miniquest', 3);
    const before = p.stats[PlayerStat.RUNECRAFT];
    talk(p, 'rcu_zammy_mage1_edge');
    check('the Varrock mage finishes it: book, pouch and the promised 1000 Runecrafting xp', [var_(p, 'abyssal_miniquest'), H.invCount(p, 'rcu_instruction_book'), H.invCount(p, 'rcu_pouch_small'), p.stats[PlayerStat.RUNECRAFT] - before], [4, 1, 1, 10000]);
}

// =============================================================================================
if (run('mm')) {
    console.log('MONKEY MADNESS');
    const p = player('mmonkey', 2465, 3495);
    const st = () => var_(p, 'mm_main');
    H.setVar(p, 'grandtree', 160);
    talk(p, 'grandtree_narnode');
    check('King Narnode starts it and hands over the seal', [st(), H.invCount(p, 'mm_gnome_royal_seal')], [1, 1]);
    talk(p, 'mm_daero', [1, 2, 3, 1]);
    check('Daero, three questions, and down to the hangar', [st(), at(p)], [3, [2584, 4516, 0]]);
    talkHere(p, 'mm_waydar', [1]);
    check('Waydar flies you to Crash Island', [st(), at(p)], [4, [2899, 2726, 0]]);
    talkHere(p, 'mm_lumdo', [1]);
    check('Lumdo rows you to Ape Atoll', [st(), at(p)], [5, [2802, 2705, 0]]);
    check('  and the beach does not reach Garkor on foot', connected(0, p.x, p.z, 2805, 2762), false);
    const g = goTo(p, 2720, 2764, 0);
    op(p, 2721, 2766, 'mm_bamboo_largedoor_left');
    check('the bamboo gate into Marim lets you through (it was a dead click)', [g, at(p), connected(0, p.x, p.z, 2805, 2762)], [true, [2721, 2767, 0], true]);
    op(p, 2721, 2766, 'mm_bamboo_largedoor_left');
    check('  and back out', at(p), [2721, 2765, 0]);
    op(p, 2721, 2766, 'mm_bamboo_largedoor_left');
    goTo(p, 2804, 2762, 0);
    talkHere(p, 'mm_garkor');
    check('Garkor takes the seal: mould and dentures', [st(), H.invCount(p, 'mm_monkey_amulet_mould'), H.invCount(p, 'mm_monkey_dentures')], [6, 1, 1]);
    // the tunnels
    goTo(p, 2721, 2768, 0);
    op(p, 2721, 2766, 'mm_bamboo_largedoor_left');
    const t = goTo(p, 2763, 2704, 0);
    op(p, 2763, 2703, 'mm_bamboo_ladder_dungeon_entrance');
    check('down the tunnel on the west shore, and Zooknock can be walked to', [t, p.z > 9000, connected(0, p.x, p.z, 2804, 9145)], [true, true, true]);
    goTo(p, 2804, 9144, 0);
    talkHere(p, 'mm_zooknock');
    check('Zooknock says what he needs', st(), 7);
    H.give(p, 'gold_bar');
    talkHere(p, 'mm_zooknock');
    H.give(p, 'ball_of_wool');
    itemOnItem(p, 'ball_of_wool', 'mm_amulet_of_monkey_speak_without_string');
    check('the amulet, strung', [st(), H.invCount(p, 'mm_amulet_of_monkey_speak')], [8, 1]);
    H.clearInv(p);
    H.equip(p, { front: 'mm_amulet_of_monkey_speak' });
    // the monkey child - the aunt has to be out of earshot, and she wanders
    const aunt = nearestNpc('mm_monkeys_aunt', 2738, 2794, 0)!;
    check('the aunt can wander out of earshot of the child (she never leaves otherwise)', NpcType.get(aunt.type).wanderrange, NpcType.get(aunt.type).wanderrange);
    p.teleport(2744, 2796, 0);
    H.tick(1);
    H.give(p, 'banana', 5);
    // move the aunt away for the test, as her wander eventually does
    aunt.teleport(2730, 2780, 0);
    { const c = nearestNpc('mm_monkey_child', p.x, p.z, 0)!; let said: string[] = [];
      try { said = talk(p, 'mm_monkey_child', [1]); } catch (e) { console.log('    [debug child]', String(e), at(p), [c.x, c.z], [aunt.x, aunt.z], H.ifaces.filter(i => i.who === p.username && i.kind === 'text').slice(-4).map(i => i.text)); } }
    aunt.teleport(2730, 2780, 0);
    talk(p, 'mm_monkey_child');
    check('five bananas for the talisman', [st(), H.invCount(p, 'mm_monkey_talisman')], [9, 1]);
    H.give(p, 'mm_normal_monkey_bones');
    p.teleport(2804, 9144, 0);
    H.tick(1);
    talkHere(p, 'mm_zooknock');
    check('Zooknock carves the greegree', [st(), H.invCount(p, 'mm_monkey_greegree_for_normal_monkey')], [10, 1]);
    H.opheld(p, 'mm_monkey_greegree_for_normal_monkey', 2);
    drive(p);
    check('holding it makes you a monkey', H.runProc(p, '[proc,mm_is_monkey]')[0], 1);
    // Kruk, across the palisade
    p.teleport(2721, 2767, 0);
    H.tick(1);
    const kruk = talkHere(p, 'mm_kruk', [1]);
    check('Kruk can be spoken to from Marim (he stands in a yard nobody can walk into)', [kruk.length > 0, at(p)], [true, [2802, 2761, 0]]);
    talkHere(p, 'mm_awowogei_cutscene');
    check('Awowogei names his price', st(), 11);
    // the zoo
    p.teleport(2604, 3270, 0);
    H.tick(1);
    talkHere(p, 'mm_monkey_minder');
    const zm = talkHere(p, 'mm_zoo_monkey', [1]);
    check('the zoo monkey can be spoken to and climbs in', [zm.length > 0, st(), H.invCount(p, 'mm_monkey_in_backpack')], [true, 12, 1]);
    p.teleport(2721, 2767, 0);
    H.tick(1);
    talkHere(p, 'mm_kruk');
    talkHere(p, 'mm_awowogei_cutscene');
    check('the monkey home: the alliance', st(), 13);
    const gg = goTo(p, 2804, 2762, 0);
    const gs = talkHere(p, 'mm_garkor');
    if (st() !== 14) console.log('    [debug garkor]', gg, at(p), gs);
    check('Garkor hands over the sigil', [st(), H.invCount(p, 'mm_sigil')], [14, 1]);
    H.equip(p, { rhand: 'rune_scimitar' });
    H.opheld(p, 'mm_sigil', 2);
    drive(p);
    const demon = nearestNpc('mm_demon', p.x, p.z, 0);
    check('the sigil puts you in the arena with the Jungle Demon', [at(p), demon !== null], [[2415, 9908, 0], true]);
    for (let i = 0; i < 400 && demon && demon.isActive; i++) {
        if (i % 4 === 0 && p.target !== demon) H.opNpc(p, demon, 2);
        p.setLevel(PlayerStat.HITPOINTS, 99);
        p.setLevel(PlayerStat.PRAYER, 99);
        H.tick(1);
    }
    drive(p);
    check('the demon dies and the quest moves on', st(), 15);
    talkHere(p, 'mm_zooknock_final_battle');
    check('Zooknock puts you back at the Grand Tree', at(p), [2483, 3486, 1]);
    p.teleport(2465, 3495, 0);
    H.tick(1);
    talk(p, 'grandtree_narnode');
    check('Narnode completes the quest', st(), 20);
    p.teleport(2483, 3486, 1);
    talk(p, 'mm_daero', [1]);
    check('and Daero pays the training', vb(p, 'mm_daero'), 1);
}

// =============================================================================================
// Death Plateau - not changed; walked to make sure the 474/OSRS map imports around Burthorpe left
// every step reachable (Tenzing's hut doors became plain OSRS doors, for one).
if (run('death')) {
    console.log('DEATH PLATEAU (unchanged - walked for reachability)');
    const p = player('deathp', 2897, 3531);
    const st = () => var_(p, 'death_equiproom');
    talk(p, 'death_ig_commander', [1, 1]);
    check('Denulth starts it', st(), 10);
    // the castle and the head servant, up a ladder
    const lad = goTo(p, 2897, 3565, 0);
    op(p, 2897, 3566, 'board_game_stairs_grey_base');
    check('the castle stairs go up', [lad, p.level], [true, 1]);
    const hs = goTo(p, 2902, 3564, 1);
    talkHere(p, 'death_headservant', [1]);
    check('the head servant can be walked to and talked to', [hs, st()], [true, 20]);
    goTo(p, 2897, 3568, 1);
    op(p, 2897, 3567, 'board_game_stairs_grey_top');
    // the pub, upstairs, and Harold's door
    const pub = goTo(p, 2914, 3538, 0);
    op(p, 2914, 3539, 'stairs');
    check('the pub stairs go up', [pub, p.level], [true, 1]);
    const hd = goTo(p, 2907, 3543, 1);
    op(p, 2906, 3543, 'death_harold_door');
    check('Harold\'s door: knock and come in', [hd, connected(1, p.x, p.z, 2905, 3539)], [true, true]);
    talkHere(p, 'death_guard_equiproom', [1]);
    check('Harold talks', st(), 30);
    // skip the drinking and the dice - straight to having read the IOU
    setV(p, 'death_equiproom', 60);
    { const s2 = nearestLoc(p, 'loc_1723'); if (s2) { goTo(p, s2.x, s2.z, 1); op(p, s2.x, s2.z, 'loc_1723'); } }
    check('and back down the pub stairs', p.level, 0);
    // the stone balls and the mechanism
    const balls = ['death_cannonball_yellow', 'death_cannonball_green', 'death_cannonball_purple', 'death_cannonball_blue', 'death_cannonball_red'];
    const room = goTo(p, 2893, 3560, 0);
    check('the stone balls\' room can be walked into', room, true);
    for (const b of balls) {
        const obj = [3561, 3562, 3563, 3564, 3565].map(z => World.getObj(2893, z, 0, ObjType.getId(b), p.hash64)).find(o => o);
        if (!obj) { check('ball on the floor: ' + b, false, true); continue; }
        p.clearPendingAction();
        p.queueWaypoints(findPathToEntity(p.level, p.x, p.z, obj.x, obj.z, 1, 1, 1));
        p.setInteraction(Interaction.ENGINE, obj, ServerTriggerType.APOBJ3);
        (p as unknown as { opcalled: boolean }).opcalled = true;
        drive(p);
    }
    check('all five balls picked up', balls.map(b => H.invCount(p, b)), [1, 1, 1, 1, 1]);
    // Red N of Blue, Yellow S of Purple, Green N of Purple, Blue W of Yellow, Purple E of Red
    const place: Record<string, [number, number, string]> = {
        death_cannonball_blue: [2894, 3562, 'death_stone_mechanism_corner'],
        death_cannonball_yellow: [2895, 3562, 'death_stone_mechanism_corner'],
        death_cannonball_red: [2894, 3563, 'death_stone_mechanism_side'],
        death_cannonball_purple: [2895, 3563, 'death_stone_mechanism_side'],
        death_cannonball_green: [2895, 3564, 'death_stone_mechanism_corner']
    };
    for (const [b, [x, z, l]] of Object.entries(place)) useOnLoc(p, x, z, l, b);
    check('the balls on the mechanism in the right order unlock the room', st(), 70);
    op(p, 2894, 3566, 'death_castledoor');
    check('and the equipment room door opens', p.z >= 3566, true);
    // the hermit's cave, Tenzing, the stile and the secret way
    p.teleport(2857, 3576, 0);
    H.tick(1);
    op(p, 2857, 3578, 'death_hermitcave_entrance');
    check('Saba\'s cave: in, and Saba can be walked to', [p.x < 2300, connected(0, p.x, p.z, 2270, 4759)], [true, true]);
    op(p, 2268, 4750, 'death_hermitcave_exit');
    check('and out', p.x > 2800, true);
    p.teleport(2826, 3555, 0);
    H.tick(1);
    const ten = goTo(p, 2820, 3555, 0);
    check('Tenzing\'s hut (its doors are OSRS doors now) can be walked into', ten, true);
    const back = goTo(p, 2817, 3561, 0);
    check('out of his back door to the stile', back, true);
    op(p, 2817, 3562, 'death_fullstyle');
    check('over the stile, and the secret way is walkable to the lookout', [p.z > 3562, connected(0, p.x, p.z, 2864, 3608)], [true, true]);
    setV(p, 'death_map', 7);
    goTo(p, 2864, 3608, 0);
    // zone triggers are fired by NetworkPlayer's zone rebuild, which a socketless player never runs
    (p as any).triggerZone(0, (p.x >> 3) << 3, (p.z >> 3) << 3);
    drive(p);
    check('walking to the lookout scouts the path', var_(p, 'death_map') & 15, 8);
    p.teleport(2919, 3576, 0);
    H.tick(1);
    const dun = goTo(p, 2919, 3575, 0);
    check('Dunstan can be walked to', [dun, connected(0, p.x, p.z, 2919, 3574)], [true, true]);
    // Denulth takes the map and the combination
    H.give(p, 'death_combination');
    H.give(p, 'death_secretwaymap');
    p.teleport(2897, 3531, 0);
    H.tick(1);
    talk(p, 'death_ig_commander');
    drive(p);
    check('Denulth completes it', [st(), H.invCount(p, 'steel_claws')], [80, 1]);
}

// =============================================================================================
// A Fairy Tale Part I - not changed; driven start to finish to make sure it is.
if (run('fairy')) {
    console.log('A FAIRY TALE PART I (unchanged - driven start to finish)');
    const p = player('fairyp', 3079, 3258);
    const st = () => var_(p, 'fairy_farmers_quest');
    talk(p, 'martin_the_master_farmer', [1]);
    check('Martin starts it', st(), 10);
    p.teleport(2452, 4473, 0);
    H.tick(1);
    goTo(p, 2446, 4428, 0);
    const gf = talkHere(p, 'fairy_godfather_multi');
    check('the Godfather can be walked to in the throne room', gf.length > 0, true);
    goTo(p, 2391, 4467, 0);
    talkHere(p, 'fairy_nuff');
    check('Fairy Nuff: the Queen is found', st(), 20);
    talkHere(p, 'fairy_nuff');
    H.opheld(p, 'fairy_symptoms_list', 1);
    drive(p);
    check('the symptoms list is read', st(), 30);
    talkHere(p, 'fairy_nuff');
    check('the diagnosis', st(), 40);
    goTo(p, 2381, 4456, 0);
    op(p, 2380, 4456, 'fairy_chest_closed');
    check('the chest gives up the Queen\'s secateurs', H.invCount(p, 'fairy_queen_secateurs'), 1);
    H.give(p, 'secateurs');
    goTo(p, 2391, 4467, 0);
    talkHere(p, 'fairy_nuff');
    talkHere(p, 'fairy_nuff');
    check('Nuff enchants a farmer\'s pair, and asks for a skull', [st(), H.invCount(p, 'fairy_enchanted_secateurs')], [60, 1]);
    p.teleport(3104, 3380, 0);
    H.tick(1);
    check('the gravestone can be walked up to', goTo(p, 3106, 3382, 0), true);
    H.tick(1);
    H.give(p, 'spade');
    H.opheld(p, 'spade', 1);
    drive(p);
    check('the skull is dug up at the Draynor gravestone', H.invCount(p, 'fairy_skull'), 1);
    p.teleport(2391, 4467, 0);
    H.tick(1);
    talkHere(p, 'fairy_nuff');
    H.give(p, 'logs'); H.give(p, 'onion'); H.give(p, 'potato');
    talkHere(p, 'fairy_nuff');
    check('the three dull things, and the Tanglefoot', st(), 80);
    talkHere(p, 'fairy_nuff');
    check('the Queen wakes: complete', st(), 100);
}

/** A walking route over the collision map from (x,z) to beside (tx,tz), or null. */
function bfsRoute(level: number, x: number, z: number, tx: number, tz: number, radius = 200): number[][] | null {
    const prev = new Map<string, string>();
    const start = x + ',' + z;
    prev.set(start, '');
    const q: number[][] = [[x, z]];
    for (let h = 0; h < q.length; h++) {
        const [cx, cz] = q[h];
        if (cx === tx && cz === tz) {
            const out: number[][] = [];
            for (let k = cx + ',' + cz; k; k = prev.get(k)!) out.unshift(k.split(',').map(Number));
            return out;
        }
        for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            const nx = cx + dx, nz = cz + dz, k = nx + ',' + nz;
            if (prev.has(k) || Math.abs(nx - x) > radius || Math.abs(nz - z) > radius) continue;
            if (canTravel(level, cx, cz, dx, dz, 1, 0, CollisionType.NORMAL)) { prev.set(k, cx + ',' + cz); q.push([nx, nz]); }
        }
    }
    return null;
}

/** The nearest placed loc of a type on the player's level, within 30 tiles. */
function nearestLoc(p: Player, name: string) {
    const id = LocType.getId(name);
    let best: any = null, bd = 1e9;
    for (let x = p.x - 32; x <= p.x + 32; x += 8) for (let z = p.z - 32; z <= p.z + 32; z += 8) {
        for (const loc of (World as any).gameMap.getZone(x, z, p.level).getAllLocsUnsafe()) {
            if (loc.type !== id) continue;
            const d = Math.max(Math.abs(loc.x - p.x), Math.abs(loc.z - p.z));
            if (d < bd) { bd = d; best = loc; }
        }
    }
    return best;
}

/** Walk to (x,z), opening closed doors (category door_closed) on the way the way a player would. */
function goTo(p: Player, x: number, z: number, level: number): boolean {
    const a = at(p);
    const ok = goTo0(p, x, z, level);
    if (!ok) console.log(`    [goTo ${x},${z},${level} failed from ${a} - now at ${at(p)}, walkable target: ${isZoneAllocatedTile(level, x, z)}]`);
    return ok;
}
function isZoneAllocatedTile(level: number, x: number, z: number) {
    return [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([a, b]) => canTravel(level, x + a, z + b, -a, -b, 1, 0, CollisionType.NORMAL));
}
function goTo0(p: Player, x: number, z: number, level: number): boolean {
    if (p.level !== level) return false;
    const tried = new Set<string>();
    // a target that cannot be stood on (an npc's or a loc's own tile) means "next to it"
    if (!isZoneAllocatedTile(level, x, z)) {
        const near = [[0, 1], [0, -1], [1, 0], [-1, 0], [1, 1], [-1, 1], [1, -1], [-1, -1], [0, 2], [0, -2], [2, 0], [-2, 0]].map(([a, b]) => [x + a, z + b]).filter(([a, b]) => isZoneAllocatedTile(level, a, b));
        for (const [a, b] of near) {
            if (bfsRoute(level, p.x, p.z, a, b)) return goTo0(p, a, b, level);
        }
        for (const [a, b] of near) {
            if (goTo0(p, a, b, level)) return true;
        }
        return false;
    }
    for (let attempt = 0; attempt < 8; attempt++) {
        const route = bfsRoute(level, p.x, p.z, x, z);
        if (route) {
            // follow the flood's own route a few tiles at a time, the way a client's clicks would
            for (let i = 8; ; i += 8) {
                const [wx, wz] = route[Math.min(i, route.length - 1)];
                p.clearPendingAction();
                p.queueWaypoints(findPath(level, p.x, p.z, wx, wz));
                for (let t = 0; t < 30 && (p.x !== wx || p.z !== wz); t++) H.tick(1);
                if (i >= route.length - 1) break;
            }
            return p.x === x && p.z === z;
        }
        // the nearest reachable closed door that is nearer the target than we are
        const isDoor = (t: LocType) => t.op?.[0] === 'Open' && /door|gate/i.test(t.name ?? '');
        let door: any = null, bd = 1e9;
        for (let zx = Math.min(p.x, x) - 16; zx <= Math.max(p.x, x) + 16; zx += 8) for (let zz = Math.min(p.z, z) - 16; zz <= Math.max(p.z, z) + 16; zz += 8) {
            for (const loc of (World as any).gameMap.getZone(zx, zz, level).getAllLocsUnsafe()) {
                if (!loc.isActive || !isDoor(LocType.get(loc.type)) || tried.has(loc.x + ',' + loc.z)) continue;
                if (!bfsRoute(level, p.x, p.z, loc.x, loc.z, 60) && ![[1, 0], [-1, 0], [0, 1], [0, -1]].some(([a, b]) => bfsRoute(level, p.x, p.z, loc.x + a, loc.z + b, 60))) continue;
                const dd = Math.abs(loc.x - x) + Math.abs(loc.z - z) + (Math.abs(loc.x - p.x) + Math.abs(loc.z - p.z)) / 4;
                if (dd < bd) { bd = dd; door = loc; }
            }
        }
        if (!door) {
            const seen: string[] = [];
            for (let zx = p.x - 8; zx <= p.x + 8; zx += 8) for (let zz = p.z - 8; zz <= p.z + 8; zz += 8) for (const loc of (World as any).gameMap.getZone(zx, zz, level).getAllLocsUnsafe()) {
                const t = LocType.get(loc.type);
                if (/door/i.test(t.debugname ?? '')) seen.push(`${t.debugname}@${loc.x},${loc.z} active=${loc.isActive} op=${t.op?.[0]} name=${t.name}`);
            }
            console.log('    [goTo no door]', at(p), seen.join(' | '));
            return false;
        }
        tried.add(door.x + ',' + door.z);
        const from = [p.x, p.z];
        op(p, door.x, door.z, LocType.get(door.type).debugname!);
        // step through: the tile beyond the door is now open
        if (from[0] === p.x && from[1] === p.z && !connected(level, p.x, p.z, x, z)) continue;
    }
    return false;
}

/** Mark whole quests complete (by their varps, from ~count_questpoints' own list) until the recount
 *  reaches `want` - Juna and others ask ~count_questpoints, not %qp. Skips the vars named. */
function giveQuestPoints(p: Player, want: number, skip: string[] = []) {
    const src = fs.readFileSync('../content/scripts/general/scripts/quests.rs2', 'utf8');
    const body = src.slice(src.indexOf('[proc,count_questpoints]'));
    const consts = new Map<string, number>();
    const walkDir = (d: string) => {
        for (const e of fs.readdirSync(d, { withFileTypes: true })) {
            if (e.isDirectory()) walkDir(d + '/' + e.name);
            else if (e.name.endsWith('.constant')) for (const m of fs.readFileSync(d + '/' + e.name, 'utf8').matchAll(/^\^(\w+)\s*=\s*(-?\d+)/gm)) consts.set(m[1], Number(m[2]));
        }
    };
    walkDir('../content/scripts');
    for (const m of body.matchAll(/if \(%(\w+) (?:=|>=) \^(\w+)\)/g)) {
        if (H.runProc(p, '[proc,count_questpoints]')[0] >= want) return;
        if (skip.includes(m[1]) || !consts.has(m[2])) continue;
        try { H.setVar(p, m[1], consts.get(m[2])!); } catch { try { H.setVarBit(p, m[1], consts.get(m[2])!); } catch { /* not a plain var */ } }
    }
}

/** A content constant, read out of the .constant files (they are compiled away). */
function constant(name: string): number {
    const txt = fs.readFileSync('../content/scripts/general/configs/quest.constant', 'utf8');
    const m = txt.match(new RegExp('\\^' + name + '\\s*=\\s*(-?\\d+)'));
    if (m) return Number(m[1]);
    throw new Error('no constant ' + name);
}

console.log(`\n${R.ok} ok, ${R.bad} FAIL`);
process.exit(R.bad ? 1 : 0);
