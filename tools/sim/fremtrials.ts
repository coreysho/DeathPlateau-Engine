// The Fremennik Trials, the breaks reported in playtesting, against the real engine and the real
// map. Usage: npx tsx tools/sim/fremtrials.ts
//
//   swensen    the house door opens (it said "Nothing interesting happens"), the maze ladder is
//              reachable through it, the seven portals and the exit, and Swensen's vote - the
//              seventh, which Brundt now needs
//   peer       Study only looks; the two red disks USED on the mural give the lid
//   thorvald   the ladder refuses weapons/armour carried as well as worn, and runes; food and
//              jewellery may go; each Koschei form attacks faster; three kills; a safe death
//   olaf       knife and branch both ways round, the skill levels, Askeladden's rock, Lalli's stew
//              and the golden fleece, the wool on the lyre
//   manni      the pipe's Put-inside with the lit strange object, the use-item route still, the keg
//              off the table
import * as H from './harness.js';
import Component from '#/cache/config/Component.js';
import ScriptState from '#/engine/script/ScriptState.js';
import ScriptProvider from '#/engine/script/ScriptProvider.js';
import ScriptRunner from '#/engine/script/ScriptRunner.js';
import ServerTriggerType from '#/engine/script/ServerTriggerType.js';
import ObjType from '#/cache/config/ObjType.js';
import LocType from '#/cache/config/LocType.js';
import InvType from '#/cache/config/InvType.js';
import World from '#/engine/World.js';
import Player from '#/engine/entity/Player.js';
import { Interaction } from '#/engine/entity/Interaction.js';
import { findPathToLoc, findPathToEntity, findPath } from '#/engine/GameMap.js';
import { CoordGrid } from '#/engine/CoordGrid.js';

await H.boot();
H.loginOrder();

const R = { ok: 0, bad: 0 };
const check = (what: string, got: unknown, want: unknown) => {
    const pass = JSON.stringify(got) === JSON.stringify(want);
    if (pass) R.ok++;
    else R.bad++;
    console.log(`  ${pass ? 'ok  ' : 'FAIL'} ${what}: ${JSON.stringify(got)}${pass ? '' : `   (want ${JSON.stringify(want)})`}`);
};

// %viking_bits layout (quest_viking.constant)
const B = {
    manni: 0, sigli: 1, olaf: 2, sigmund: 3, thorvald: 4, peer: 5,
    manniBeaten: 12, planted: 13, olafAsked: 14, thorvaldAsked: 15, kLo: 16,
    mazeDone: 18, askRock: 25, lalliRock: 26, swensen: 27, potato: 28, cabbage: 29, onion: 30
};
const bits = (p: Player) => H.getVar(p, 'viking_bits');
const bit = (p: Player, n: number) => (bits(p) >>> n) & 1;
const setBits = (p: Player, ...ns: number[]) => H.setVar(p, 'viking_bits', ns.reduce((v, n) => v | (1 << n), bits(p)));
const koschei = (p: Player) => (bits(p) >>> B.kLo) & 3;
const at = (p: Player) => [p.x, p.z, p.level];

// region origins
const M41_57 = [2624, 3648];
const M41_156 = [2624, 9984];
const M43_56 = [2752, 3584];
const g = (m: number[], x: number, z: number) => [m[0] + x, m[1] + z];

let bucket = 10;
function player(name: string, x: number, z: number, level = 0): Player {
    const p = H.makePlayer(name, x, z, bucket++);
    H.tick(1);
    if (level) p.teleport(x, z, level);
    H.clearInv(p);
    H.setVar(p, 'viking', 1);
    H.setVar(p, 'viking_bits', 0);
    H.tick(1);
    return p;
}

/** Click through whatever the player has open: continue on every page, `picks` at menus. */
function drain(p: Player, picks: number[] = [], maxTicks = 60) {
    let idle = 0;
    for (let guard = 0; guard < 300 && idle < maxTicks; guard++) {
        const s = p.activeScript as any;
        if (!s || s.execution !== ScriptState.PAUSEBUTTON) {
            if (!s && !p.delayed && idle > 3 && !p.target && !p.hasWaypoints()) break;
            H.tick(1);
            idle++;
            continue;
        }
        idle = 0;
        const names = (p as any).resumeButtons.map((id: number) => Component.get(id).comName ?? '');
        const open = (p as any).modalChat === -1 ? '' : Component.get((p as any).modalChat).comName ?? '';
        const multi = open.startsWith('multi') ? names.find((n: string) => n.startsWith(open + ':')) : null;
        if (multi) {
            const pick = picks.shift();
            if (pick === undefined) throw new Error('unexpected menu: ' + names.join(','));
            H.choose(p, `${multi.split(':')[0]}:com_${pick}`);
        } else {
            p.executeScript(s, true, true);
        }
    }
    H.tick(1);
}

function talk(p: Player, npcName: string, picks: number[] = []) {
    const npc = [0, 1, 2, 3].map(l => H.npcNear(npcName, p.x, p.z, l)).find(n => n);
    if (!npc) throw new Error('no npc ' + npcName);
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1]]) {
        p.teleport(npc.x + dx, npc.z + dz, npc.level);
        H.tick(1);
        H.opNpc(p, npc, 1);
        for (let t = 0; t < 12 && !p.activeScript; t++) H.tick(1);
        if (p.activeScript) break;
    }
    drain(p, picks);
}

function slotOf(p: Player, objName: string) {
    const id = ObjType.getId(objName);
    const inv = p.getInventory(InvType.INV)!;
    for (let i = 0; i < inv.capacity; i++) if (inv.get(i)?.id === id) return i;
    throw new Error('not carrying ' + objName);
}

/** OpLocUHandler: use an item on a loc, with the route a client would send. */
function useOnLoc(p: Player, x: number, z: number, locName: string, objName: string) {
    const id = LocType.getId(locName);
    const loc = World.getLoc(x, z, p.level, id);
    if (!loc) throw new Error(`no ${locName} at ${x},${z}`);
    p.clearPendingAction();
    p.lastUseItem = ObjType.getId(objName);
    p.lastUseSlot = slotOf(p, objName);
    p.queueWaypoints(findPathToLoc(p.level, p.x, p.z, loc.x, loc.z, p.width, loc.width, loc.length, loc.angle, loc.shape, LocType.get(id).forceapproach));
    p.setInteraction(Interaction.ENGINE, loc, ServerTriggerType.APLOCU);
    (p as any).opcalled = true;
    drain(p);
}

/** OpNpcUHandler. */
function useOnNpc(p: Player, npcName: string, objName: string) {
    const npc = H.npcNear(npcName, p.x, p.z, p.level)!;
    p.clearPendingAction();
    p.lastUseItem = ObjType.getId(objName);
    p.lastUseSlot = slotOf(p, objName);
    p.queueWaypoints(findPathToEntity(p.level, p.x, p.z, npc.x, npc.z, p.width, npc.width, npc.length));
    p.setInteraction(Interaction.ENGINE, npc, ServerTriggerType.APNPCU);
    (p as any).opcalled = true;
    drain(p);
}

/** OpHeldUHandler: `used` is the item picked with Use, `target` the one it was clicked on. The
 *  handler's own lookup order - the target's trigger first, then the used item's, swapping. */
function useHeld(p: Player, usedName: string, targetName: string) {
    const target = ObjType.getId(targetName);
    const used = ObjType.getId(usedName);
    p.lastItem = target;
    p.lastSlot = slotOf(p, targetName);
    p.lastUseItem = used;
    p.lastUseSlot = slotOf(p, usedName);
    p.clearPendingAction();
    let script = ScriptProvider.getByTriggerSpecific(ServerTriggerType.OPHELDU, target, -1);
    if (!script) {
        script = ScriptProvider.getByTriggerSpecific(ServerTriggerType.OPHELDU, used, -1);
        [p.lastItem, p.lastUseItem] = [p.lastUseItem, p.lastItem];
        [p.lastSlot, p.lastUseSlot] = [p.lastUseSlot, p.lastSlot];
    }
    if (!script) {
        p.messageGame('Nothing interesting happens.');
        return;
    }
    p.executeScript(ScriptRunner.init(script, p), true);
    drain(p);
}

function clickLoc(p: Player, x: number, z: number, locName: string, op: number) {
    H.opLoc(p, x, z, locName, op);
    drain(p);
}

const locAt = (x: number, z: number, level: number, name: string) => World.getLoc(x, z, level, LocType.getId(name)) !== null;
const lastMes = (p: Player) => H.mesgs.filter(m => m.who === p.username).at(-1)?.text;
const said = (p: Player, s: string) => H.mesgs.some(m => m.who === p.username && m.text.includes(s));
const allText = (p: Player, from: number) => H.ifaces.slice(from).filter(i => i.who === p.username && i.kind === 'text').map(i => i.text ?? '').join(' | ');

// =====================================================================================
console.log('SWENSEN  the house door, the maze, and the seventh vote');
{
    const [dx, dz] = g(M41_57, 21, 15);
    const [lx, lz] = g(M41_57, 20, 9);
    const p = player('frem_swensen', dx, dz + 2);
    check('the door is there, shut', locAt(dx, dz, 0, 'viking_abode_door'), true);
    H.opLoc(p, lx, lz, 'vt_mazeladdertopentrance', 1);
    drain(p);
    check('with the door shut, the ladder inside cannot be reached', p.level === 0 && p.z > 9000, false);
    H.clearLogs();
    clickLoc(p, dx, dz, 'viking_abode_door', 1);
    check('Open does something now (no "Nothing interesting happens")', said(p, 'Nothing interesting'), false);
    check('  the closed door is gone from its tile', locAt(dx, dz, 0, 'viking_abode_door'), false);
    let open = false;
    for (let ox = -1; ox <= 1; ox++) for (let oz = -1; oz <= 1; oz++) open ||= locAt(dx + ox, dz + oz, 0, 'viking_abode_door_open');
    check('  and an open door stands beside it', open, true);
    H.opLoc(p, lx, lz, 'vt_mazeladdertopentrance', 1);
    drain(p);
    const [ex, ez] = g(M41_156, 7, 22);
    check('through the open door, down the ladder into the maze', at(p), [ex, ez, 0]);

    // Every landing is in its own sealed room: no tile of the maze can be walked to from another.
    const landings: Record<string, [number, number]> = {
        enter: [7, 22], room2: [18, 32], room3: [29, 21], room4: [41, 32], room5: [6, 43], room6: [29, 54], room7: [42, 43], end: [41, 54], deadend: [7, 32]
    };
    const reach = (a: [number, number], b: [number, number]) => {
        const [ax, az] = g(M41_156, a[0], a[1]);
        const [bx, bz] = g(M41_156, b[0], b[1]);
        return Array.from(findPath(0, ax, az, bx, bz)).some(c => {
            const u = CoordGrid.unpackCoord(c);
            return u.x === bx && u.z === bz;
        });
    };
    const leaks: string[] = [];
    for (const [na, a] of Object.entries(landings)) for (const [nb, b] of Object.entries(landings)) if (na !== nb && reach(a, b)) leaks.push(`${na}->${nb}`);
    check('every maze room is sealed off from the others on foot', leaks, []);
    check('  (and the path check does find a walk inside one room)', [reach(landings.enter, [8, 22]), reach(landings.room4, [39, 30])], [true, true]);
    // a wrong portal: the dead end, and its rope back to the start
    const [w1x, w1z] = g(M41_156, 4, 21);
    clickLoc(p, w1x, w1z, 'vt_mazeportal_wrong', 1);
    const [dex, dez] = g(M41_156, 7, 32);
    check('a wrong portal (west, in room 1) drops you in the dead end', at(p), [dex, dez, 0]);
    const [rx, rz] = g(M41_156, 7, 31);
    clickLoc(p, rx, rz, 'vt_mazeladderescapeladder', 1);
    check('  and its rope puts you back at the start', at(p), [ex, ez, 0]);

    // the seven correct portals, one room after another
    const portals: [number, number][] = [[7, 18], [15, 31], [32, 20], [41, 34], [6, 39], [32, 53], [42, 45]];
    let n = 0;
    const route: string[] = [];
    for (const [px, pz] of portals) {
        n++;
        const [ax, az] = g(M41_156, px, pz);
        const from = at(p);
        clickLoc(p, ax, az, `vt_mazeportal_${n}`, 1);
        const [lx2, lz2] = n < 7 ? g(M41_156, ...(Object.values(landings)[n] as [number, number])) : g(M41_156, 41, 54);
        route.push(`${n}:${p.x === lx2 && p.z === lz2 ? 'ok' : 'stuck at ' + from.join(',')}`);
    }
    check('each correct portal leads to the centre of the next room', route, ['1:ok', '2:ok', '3:ok', '4:ok', '5:ok', '6:ok', '7:ok']);
    const [endx, endz] = g(M41_156, 41, 54);
    check('the seven portals S-W-E-N-S-E-N reach the far side', at(p), [endx, endz, 0]);
    const [xx, xz] = g(M41_156, 41, 53);
    clickLoc(p, xx, xz, 'vt_mazeladderexit', 1);
    check('the exit ladder marks the maze done and puts you back in the house', [bit(p, B.mazeDone), p.level, p.z < 9000], [1, 0, true]);
    check('  no vote until you talk to him', bit(p, B.swensen), 0);
    talk(p, 'viking_hallifred');
    check('Swensen gives his vote (bit 27)', bit(p, B.swensen), 1);
    check('  and it counts: 1 vote won', H.runProc(p, '[proc,viking_votes_won]')[0], 1);

    // Brundt: the six old votes are no longer enough
    setBits(p, B.manni, B.sigli, B.olaf, B.sigmund, B.thorvald, B.peer);
    H.setVar(p, 'viking_bits', bits(p) & ~(1 << B.swensen));
    check('six votes without Swensen: not all votes', H.runProc(p, '[proc,viking_has_all_votes]')[0], 0);
    talk(p, 'viking_brundt');
    check("Brundt with six votes and not Swensen's: still started", H.getVar(p, 'viking'), 1);
    setBits(p, B.swensen);
    check('all seven: Brundt will finish the quest', H.runProc(p, '[proc,viking_has_all_votes]')[0], 1);
    talk(p, 'viking_brundt');
    check('  and does: The Fremennik Trials complete', H.getVar(p, 'viking'), 10);
    H.despawn(p);
}

// =====================================================================================
console.log('PEER  the mural');
{
    const [mx, mz] = g(M41_57, 10, 15);
    const [sx, sz] = g(M41_57, 12, 14);
    const p = player('frem_peer', sx, sz);
    setBits(p, 24);
    H.give(p, 'viking_dummy_coin');
    H.give(p, 'viking_red_wooden_coin');
    clickLoc(p, mx, mz, 'viking_seers_mural', 1);
    check('Study with both disks only looks - no lid, disks kept', [H.invCount(p, 'viking_vase_lid'), H.invCount(p, 'viking_dummy_coin'), H.invCount(p, 'viking_red_wooden_coin')], [0, 1, 1]);
    const q = player('frem_peer1', sx, sz);
    H.give(q, 'viking_dummy_coin');
    useOnLoc(q, mx, mz, 'viking_seers_mural', 'viking_dummy_coin');
    check('one red disk alone on the mural: no lid, disk kept', [H.invCount(q, 'viking_vase_lid'), H.invCount(q, 'viking_dummy_coin')], [0, 1]);
    H.clearLogs();
    useOnLoc(p, mx, mz, 'viking_seers_mural', 'viking_red_wooden_coin');
    check('both red disks used on the mural: the lid, the disks go into the hollows', [H.invCount(p, 'viking_vase_lid'), H.invCount(p, 'viking_dummy_coin'), H.invCount(p, 'viking_red_wooden_coin')], [1, 0, 0]);
    check('  no "Nothing interesting happens"', said(p, 'Nothing interesting'), false);
    H.despawn(p, q);
}

// =====================================================================================
console.log('THORVALD  the ladder, Koschei\'s speed, three kills and a safe death');
{
    const [lx, lz] = g(M41_57, 43, 46);
    const down = (p: Player) => {
        p.teleport(lx, lz - 1, 0);
        H.tick(1);
        H.opLoc(p, lx, lz, 'viking_warrior_ladder', 2);
        drain(p);
        return p.level === 2;
    };
    const p = player('frem_thorvald', lx, lz - 1);
    setBits(p, B.thorvaldAsked);
    H.give(p, 'bronze_sword');
    check('a sword carried in the pack: refused', down(p), false);
    H.clearInv(p);
    H.give(p, 'bronze_platebody');
    check('a platebody carried in the pack: refused', down(p), false);
    H.clearInv(p);
    H.equip(p, { rhand: 'bronze_sword' });
    check('a sword worn: refused', down(p), false);
    p.invDelSlot(InvType.WORN, 3);
    H.give(p, 'airrune', 10);
    check('runes: refused', down(p), false);
    H.clearInv(p);
    H.give(p, 'lobster', 5);
    H.give(p, 'ring_of_recoil');
    H.equip(p, { front: 'amulet_of_strength', ring: 'ring_of_recoil' });
    check('food, an amulet and a ring (worn and carried): allowed down', down(p), true);

    // attack speed of each form, measured off the hits it lands
    const gaps: number[] = [];
    for (const form of ['viking_enemy1', 'viking_enemy2', 'viking_enemy3', 'viking_enemy4']) {
        const t = player('frem_k_' + form.slice(-1), 2624 + 30, 10048 + 30, 2);
        H.maxOut(t);
        const npc = H.addNpcAt(form, t.x + 1, t.z, 2);
        H.tick(1);
        H.setNpcMode(npc, 'OPPLAYER2', t);
        H.clearLogs();
        for (let i = 0; i < 40; i++) {
            t.levels[3] = 99;
            H.tick(1);
        }
        const ts = H.hitsFor(t.username).map(h => h.tick);
        const d = ts.slice(1).map((v, i) => v - ts[i]);
        gaps.push(d.length ? Math.min(...d) : -1);
        npc.isActive && World.removeNpc(npc, -1);
        H.despawn(t);
    }
    check('Koschei attacks faster each form (ticks between hits, forms 1-4)', gaps, [5, 4, 3, 1]);

    // kill three forms with bare hands
    H.maxOut(p);
    const killNext = (name: string) => {
        const npc = H.npcNear(name, p.x, p.z, 2);
        if (!npc) return false;
        for (let i = 0; i < 300 && npc.isActive && (npc as any).levels[3] > 0; i++) {
            p.levels[3] = 99;
            if (i % 5 === 0 && !(p as any).target) H.attackNpc(p, npc);
            H.tick(1);
        }
        drain(p);
        return true;
    };
    check('form 1 was summoned on arrival', killNext('viking_enemy1'), true);
    check('  one down, form 2 up', [koschei(p), !!H.npcNear('viking_enemy2', p.x, p.z, 2)], [1, true]);
    killNext('viking_enemy2');
    check('  two down, form 3 up', [koschei(p), !!H.npcNear('viking_enemy3', p.x, p.z, 2)], [2, true]);
    killNext('viking_enemy3');
    check('  three down, form 4 turns up', [koschei(p), !!H.npcNear('viking_enemy4', p.x, p.z, 2)], [3, true]);

    // a safe death to form 4
    const f4 = H.npcNear('viking_enemy4', p.x, p.z, 2)!;
    H.setNpcMode(f4, 'OPPLAYER2', p);
    p.levels[3] = 1;
    for (let i = 0; i < 30 && p.level === 2; i++) H.tick(1);
    drain(p);
    const [hx, hz] = g(M41_57, 43, 45);
    check('dying down there: Thorvald\'s hut, food and jewellery kept', [at(p), H.invCount(p, 'lobster'), H.invCount(p, 'ring_of_recoil'), p.getInventory(InvType.WORN)!.get(12)?.id === ObjType.getId('ring_of_recoil')], [[hx, hz, 0], 5, 1, true]);
    talk(p, 'viking_thorvald');
    check('Thorvald gives his vote', bit(p, B.thorvald), 1);
    H.despawn(p);
}

// =====================================================================================
console.log('OLAF  the branch, Lalli\'s stew, the wool');
{
    const p = player('frem_olaf', 2660, 3670);
    setBits(p, B.olafAsked);
    p.setLevel(12, 40); // crafting
    p.setLevel(9, 25); // fletching
    H.give(p, 'knife');
    H.give(p, 'viking_musical_tree_branch', 2);
    H.clearLogs();
    useHeld(p, 'knife', 'viking_musical_tree_branch');
    check('knife used on the branch: an unstrung lyre', [H.invCount(p, 'viking_unstrung_lyre'), H.invCount(p, 'viking_musical_tree_branch')], [1, 1]);
    useHeld(p, 'viking_musical_tree_branch', 'knife');
    check('branch used on the knife: another', [H.invCount(p, 'viking_unstrung_lyre'), H.invCount(p, 'viking_musical_tree_branch')], [2, 0]);
    check('  never "Nothing interesting happens"', said(p, 'Nothing interesting'), false);
    const low = player('frem_olaf_low', 2662, 3670);
    setBits(low, B.olafAsked);
    low.setLevel(12, 39);
    H.give(low, 'knife');
    H.give(low, 'viking_musical_tree_branch');
    useHeld(low, 'knife', 'viking_musical_tree_branch');
    check('39 Crafting cannot carve it (wiki: Crafting 40)', [H.invCount(low, 'viking_unstrung_lyre'), said(low, 'Crafting level of 40')], [0, true]);
    H.despawn(low);
    H.clearInv(p);

    // Lalli first: he points at Askeladden
    const from = H.ifaces.length;
    talk(p, 'viking_lalli_troll');
    check('Lalli, before anything: will not give wool, points at Askeladden', allText(p, from).includes('Askeladden'), true);
    talk(p, 'viking_askelapen');
    check('Askeladden hands over the pet rock and the recipe', [H.invCount(p, 'vt_useless_rock'), bit(p, B.askRock)], [1, 1]);
    talk(p, 'viking_lalli_troll');
    check('  Lalli with the rock in the pack: nothing handed over yet', H.invCount(p, 'viking_golden_fleece'), 0);
    const [sx, sz] = g(M43_56, 20, 39);
    H.give(p, 'potato');
    H.give(p, 'cabbage');
    H.give(p, 'onion');
    for (const item of ['vt_useless_rock', 'potato', 'cabbage']) useOnLoc(p, sx, sz, 'viking_troll_cauldron', item);
    check('three of four in the stew', [bit(p, B.lalliRock), bit(p, B.potato), bit(p, B.cabbage), bit(p, B.onion)], [1, 1, 1, 0]);
    check('  the stew says what it still needs', lastMes(p), 'The stew still needs an onion.');
    talk(p, 'viking_lalli_troll');
    check('Lalli with the onion missing: no fleece', H.invCount(p, 'viking_golden_fleece'), 0);
    useOnLoc(p, sx, sz, 'viking_troll_cauldron', 'onion');
    check('the onion in: the stew is ready, ingredients spent', [bit(p, B.onion), H.invCount(p, 'onion'), H.invCount(p, 'potato'), H.invCount(p, 'vt_useless_rock')], [1, 0, 0, 0]);
    talk(p, 'viking_lalli_troll');
    check('Lalli tastes it and gives the golden fleece', H.invCount(p, 'viking_golden_fleece'), 1);
    talk(p, 'viking_lalli_troll');
    check('  not a second while you still hold the first', H.invCount(p, 'viking_golden_fleece'), 1);

    // an old-version player: rock already handed to Lalli, so only the vegetables are needed
    const old = player('frem_olaf_old', sx - 2, sz);
    setBits(old, B.olafAsked, B.askRock, B.lalliRock);
    H.give(old, 'potato');
    H.give(old, 'cabbage');
    H.give(old, 'onion');
    for (const item of ['potato', 'cabbage', 'onion']) useOnLoc(old, sx, sz, 'viking_troll_cauldron', item);
    talk(old, 'viking_lalli_troll');
    check('a player who gave Lalli the rock before this fix only needs the vegetables', H.invCount(old, 'viking_golden_fleece'), 1);
    H.despawn(old);

    // the wool on the lyre: Fletching 25
    H.clearInv(p);
    H.give(p, 'viking_golden_wool');
    H.give(p, 'viking_unstrung_lyre');
    useHeld(p, 'viking_golden_wool', 'viking_unstrung_lyre');
    check('golden wool on the unstrung lyre, Fletching 25: a lyre', H.invCount(p, 'viking_strung_lyre'), 1);
    H.despawn(p);
}

// =====================================================================================
console.log('MANNI  the pipe and the keg');
{
    const [px, pz] = g(M41_57, 39, 26);
    const p = player('frem_manni', px + 1, pz);
    setBits(p, B.manniBeaten);
    H.clearLogs();
    clickLoc(p, px, pz, 'viking_pipe_end_longhall', 1);
    check('Put-inside with nothing to put in: says so', lastMes(p), 'You have nothing you want to put in the pipe.');
    H.give(p, 'viking_firecracker');
    clickLoc(p, px, pz, 'viking_pipe_end_longhall', 1);
    check('Put-inside with it unlit: tells you to light it', [bit(p, B.planted), said(p, 'lighting first')], [0, true]);
    H.clearInv(p);
    H.give(p, 'viking_firecracker_lit');
    clickLoc(p, px, pz, 'viking_pipe_end_longhall', 1);
    check('Put-inside with the lit strange object: it goes in the pipe', [bit(p, B.planted), H.invCount(p, 'viking_firecracker_lit')], [1, 0]);
    check('  no "Nothing interesting happens"', said(p, 'Nothing interesting'), false);
    const q = player('frem_manni2', px + 1, pz);
    setBits(q, B.manniBeaten);
    H.give(q, 'viking_firecracker_lit');
    useOnLoc(q, px, pz, 'viking_pipe_end_longhall', 'viking_firecracker_lit');
    check('the use-item route still works', [bit(q, B.planted), H.invCount(q, 'viking_firecracker_lit')], [1, 0]);
    H.despawn(q);

    const [kx, kz] = g(M41_57, 36, 26);
    p.teleport(kx, kz - 1, 0);
    H.tick(1);
    clickLoc(p, kx, kz, 'viking_keg', 1);
    check('Take-from on the keg by the bar: a keg of beer', H.invCount(p, 'viking_beerkeg'), 1);
    H.give(p, 'viking_low_alcahol_beerkeg');
    talk(p, 'viking_reveller_3');
    check('the rematch with both kegs and the pipe primed: Manni\'s vote', [bit(p, B.manni), H.invCount(p, 'viking_beerkeg'), H.invCount(p, 'viking_low_alcahol_beerkeg')], [1, 0, 0]);
    H.despawn(p);
}

console.log(`\n${R.ok} ok, ${R.bad} FAIL`);
process.exit(R.bad ? 1 : 0);
