// Implings and Puro-Puro, against the real engine - `npx tsx tools/sim/implings.ts`
// (content skill_hunter/scripts/hunter_implings.rs2, hunter_puro.rs2, hunter_implings_loot.rs2):
//
//   the realm     Puro-Puro's square and its npcs where the OSRS wiki puts them: 35 invisible spawns,
//                 51 fixed implings, 28 imp defenders, Elnock, Immenizz; the invisible spawns turn
//                 into implings after two minutes
//   crop circles  the roaming circle is in its field; Hunter 16 is turned away, 17 goes in, arrives
//                 at the heart of the maze with Farmer's Affinity; Zanaris's circle gives none; the
//                 portal sends each back to the field it came from
//   the wheat     Push-through carries you across a row, in the Strength roll's 6/8/10 ticks (3 fewer
//                 with the affinity); Strength xp only once Elnock is asked; a shifting section grows
//                 (and blocks) and wilts (and opens)
//   catching      every impling, Puro-Puro and Gielinor: refused a level short, caught at its level
//                 with a net and ten above bare-handed, for the wiki's Puro-Puro / Gielinor xp; in
//                 Puro-Puro only with a jar; in Gielinor looted on the spot without one
//   jars          Loot pays from the table (every item seen is one the wiki lists) and gives the jar
//                 back nine times in ten; a clue from the tertiary
//   Elnock        his exchange's four trades; the jar generator's charge; a jar used on him; ten jars
//                 a day for 2,000 coins; the spare equipment once
//   imp defenders one beside you frees your lowest impling and knocks the jar away
//   Gielinor      the thirty-minute cycle adds 4 + N + 2N invisible spawns, which become implings;
//                 the fixed low-tier spawns stand where the wiki puts them
//   jars by hand  anchovies -> paste -> oil -> imp repellent -> the lamp oil still -> an impling jar
import * as H from './harness.ts';
import World from '#/engine/World.js';
import Player from '#/engine/entity/Player.js';
import Npc from '#/engine/entity/Npc.js';
import NpcType from '#/cache/config/NpcType.js';
import LocType from '#/cache/config/LocType.js';
import ObjType from '#/cache/config/ObjType.js';
import ParamType from '#/cache/config/ParamType.js';
import InvType from '#/cache/config/InvType.js';
import Component from '#/cache/config/Component.js';
import ScriptState from '#/engine/script/ScriptState.js';
import ScriptProvider from '#/engine/script/ScriptProvider.js';
import ScriptRunner from '#/engine/script/ScriptRunner.js';
import ServerTriggerType from '#/engine/script/ServerTriggerType.js';
import { Interaction } from '#/engine/entity/Interaction.js';
import { findPathToLoc, isFlagged } from '#/engine/GameMap.js';
import { CollisionFlag } from '#/engine/routefinder/index.js';
import { EntityLifeCycle } from '#/engine/entity/EntityLifeCycle.js';

await H.boot();
H.loginOrder();

let ok = 0, bad = 0, n = 0;
const check = (what: string, got: unknown, want: unknown) => {
    const pass = JSON.stringify(got) === JSON.stringify(want);
    pass ? ok++ : bad++;
    console.log(`  ${pass ? 'ok  ' : 'FAIL'} ${what}: ${JSON.stringify(got)}${pass ? '' : `   (want ${JSON.stringify(want)})`}`);
};
const truthy = (what: string, pass: boolean, got: unknown) => {
    pass ? ok++ : bad++;
    console.log(`  ${pass ? 'ok  ' : 'FAIL'} ${what}: ${JSON.stringify(got)}`);
};
const HUNT = 22, STR = 2, THIEV = 17, HERB = 15;
const PX = 2560, PZ = 4288;
const fresh = (x: number, z: number): any => {
    const p: any = H.makePlayer('imp' + n, x, z, 90 + n); n++;
    H.tick(2); H.maxOut(p); H.clearInv(p); H.setVar(p, 'tutorial', 1000); H.tick(1);
    return p;
};
const mesOf = (p: Player) => H.mesgs.filter(m => m.who === p.username).map(m => m.text);
const lastMes = (p: Player) => mesOf(p).slice(-1)[0];
const shown = (p: Player, from: number) => H.ifaces.slice(from).filter(i => i.who === p.username && i.kind === 'text' && !!i.text && i.text.length > 1).map(i => i.text!).join(' ');
const npcsOf = (name: string, inPuro = true) => {
    const id = NpcType.getId(name); const out: Npc[] = [];
    for (const npc of World.npcs) {
        if (!npc || npc.type !== id || !npc.isActive) continue;
        const puro = npc.x >= PX && npc.x < PX + 64 && npc.z >= PZ && npc.z < PZ + 64;
        if (puro === inPuro) out.push(npc);
    }
    return out;
};
const staticOf = (name: string) => { const id = NpcType.getId(name); const out: Npc[] = []; for (const npc of World.npcs) if (npc && npc.baseType === id && npc.lifecycle === EntityLifeCycle.RESPAWN) out.push(npc); return out; };
const worldMinute = () => Math.floor((Date.now() - Date.UTC(2025, 0, 1)) / 60000);
const npcSays: string[] = [];
{ const orig = (Npc.prototype as any).say; (Npc.prototype as any).say = function (t: string) { npcSays.push(t); return orig.call(this, t); }; }
const blocked = (x: number, z: number) => isFlagged(x, z, 0, CollisionFlag.WALK_BLOCKED);
const param = (npc: string, p: string) => NpcType.get(NpcType.getId(npc)).params.get(ParamType.getId(p));

function drain(p: Player, picks: number[] = [], count?: number) {
    for (let guard = 0; guard < 300; guard++) {
        const s = p.activeScript;
        if (!s || (s.execution !== ScriptState.PAUSEBUTTON && s.execution !== ScriptState.COUNTDIALOG)) {
            if (!s && guard > 2) break;
            H.tick(1);
            continue;
        }
        if (s.execution === ScriptState.COUNTDIALOG) {
            s.lastInt = count ?? 0; p.executeScript(s, true, true); continue;
        }
        const names = p.resumeButtons.map((id: number) => Component.get(id).comName ?? '');
        const open = p.modalChat === -1 ? '' : Component.get(p.modalChat).comName ?? '';
        const multi = open.startsWith('multi') ? names.find((nm: string) => nm.startsWith(open + ':')) : null;
        if (multi) {
            const pick = picks.shift();
            if (pick === undefined) throw new Error('unexpected menu: ' + names.join(','));
            H.choose(p, `${multi.split(':')[0]}:com_${pick}`);
        } else {
            p.executeScript(s, true, true);
        }
    }
    H.tick(2);
    if (picks.length) throw new Error('menus not reached: ' + picks.join(','));
}
function talk(p: Player, npc: Npc, op: number, picks: number[] = [], count?: number) {
    p.teleport(npc.x + 1, npc.z, npc.level); H.tick(1);
    H.opNpc(p, npc, op);
    for (let t = 0; t < 10 && !p.activeScript; t++) H.tick(1);
    drain(p, picks, count);
}
function slotOf(p: Player, obj: string) {
    const id = ObjType.getId(obj); const inv = p.getInventory(InvType.INV)!;
    for (let i = 0; i < inv.capacity; i++) if (inv.get(i)?.id === id) return i;
    throw new Error('not carrying ' + obj);
}
/** OpHeldUHandler: `use` used on `on`. */
function useOn(p: any, use: string, on: string) {
    const a = ObjType.get(ObjType.getId(use)), b = ObjType.get(ObjType.getId(on));
    p.lastUseItem = a.id; p.lastUseSlot = slotOf(p, use); p.lastItem = b.id; p.lastSlot = slotOf(p, on);
    let script = ScriptProvider.getByTriggerSpecific(ServerTriggerType.OPHELDU, b.id, -1);
    if (!script) {
        script = ScriptProvider.getByTriggerSpecific(ServerTriggerType.OPHELDU, a.id, -1);
        [p.lastItem, p.lastUseItem] = [p.lastUseItem, p.lastItem]; [p.lastSlot, p.lastUseSlot] = [p.lastUseSlot, p.lastSlot];
    }
    if (!script) throw new Error(`no opheldu for ${use} on ${on}`);
    p.executeScript(ScriptRunner.init(script, p), true);
    H.tick(1); drain(p);
}
function itemOnLoc(p: any, obj: string, x: number, z: number, locName: string) {
    const id = LocType.getId(locName); const loc = World.getLoc(x, z, p.level, id)!;
    p.clearPendingAction();
    p.queueWaypoints(findPathToLoc(p.level, p.x, p.z, loc.x, loc.z, p.width, loc.width, loc.length, loc.angle, loc.shape, LocType.get(id).forceapproach));
    p.lastUseItem = ObjType.getId(obj); p.lastUseSlot = slotOf(p, obj);
    p.setInteraction(Interaction.ENGINE, loc, ServerTriggerType.APLOCU); p.opcalled = true;
    H.tick(10); drain(p);
}
function itemOnNpc(p: any, obj: string, npc: Npc) {
    p.teleport(npc.x + 1, npc.z, npc.level); H.tick(1);
    p.clearPendingAction(); p.lastUseItem = ObjType.getId(obj); p.lastUseSlot = slotOf(p, obj);
    p.setInteraction(Interaction.ENGINE, npc, ServerTriggerType.APNPCU); p.opcalled = true;
    H.tick(3); drain(p);
}
const locAt = (x: number, z: number, name: string) => World.getLoc(x, z, 0, LocType.getId(name));

const SITES: [number, number, string][] = [[2953, 3444, 'doric'], [3115, 3273, 'draynor'], [2978, 3216, 'rimmington'], [3160, 3299, 'lumbridge'], [2647, 3348, 'ardougne'], [3212, 3345, 'varrock'], [2538, 3845, 'miscellania']];
const ZANARIS = [2427, 4446];
const ARRIVE = [2591, 4318];

// ------------------------------------------------------------------------------------------ the realm
console.log('PURO-PURO');
check('the invisible spawns the wiki map pins: 10 low, 12 mid, 2 high', [staticOf('impling_spawner_low').length, staticOf('impling_spawner_mid').length, staticOf('impling_spawner_high').length], [10, 12, 2]);
check('the fixed implings: 13 baby, 10 young, 11 gourmet, 8 earth, 5 essence, 4 eclectic', ['baby', 'young', 'gourmet', 'earth', 'essence', 'eclectic'].map(k => staticOf(`impling_${k}_puro`).length), [13, 10, 11, 8, 5, 4]);
check('28 imp defenders, Elnock, Immenizz, the controller', [staticOf('imp_defender').length, staticOf('elnock_inquisitor').length, staticOf('immenizz').length, staticOf('impling_controller').length], [28, 1, 1, 1]);
{
    const all = ['impling_spawner_low', 'impling_spawner_mid', 'impling_spawner_high', 'impling_baby_puro', 'impling_young_puro', 'impling_gourmet_puro', 'impling_earth_puro', 'impling_essence_puro', 'impling_eclectic_puro', 'imp_defender', 'elnock_inquisitor', 'immenizz'].flatMap(staticOf);
    check('every one of them spawned on a walkable tile', all.filter(npc => blocked(npc.startX, npc.startZ)).map(npc => `${NpcType.get(npc.baseType).debugname}@${npc.startX},${npc.startZ}`), []);
    check('the 10 fixed low-tier Gielinor spawns (9 of the wiki\'s 10 + Zanaris market)', staticOf('impling_spawner_world_low').length, 10);
}
const elnock = staticOf('elnock_inquisitor')[0];
check('Elnock at the wiki\'s 2586,4314', [elnock.startX, elnock.startZ], [2586, 4314]);

// ------------------------------------------------------------------------------------------ crop circles
console.log('CROP CIRCLES');
H.tick(3);
const circleSites = SITES.filter(([x, z]) => locAt(x, z, 'crop_circle_centre'));
check('the roaming circle is in exactly one field, the rotation\'s', circleSites.map(s => s[2]), [SITES[Math.floor(World.currentTick / 1500) % 7][2]]);
const [cx, cz, site] = circleSites[0];
{
    const ring: [number, number, string][] = [[-1, -1, 'crop_circle_a'], [1, 1, 'crop_circle_a'], [0, -1, 'crop_circle_b'], [0, 1, 'crop_circle_b'], [-1, 1, 'crop_circle_c'], [1, -1, 'crop_circle_c'], [-1, 0, 'crop_circle_d'], [1, 0, 'crop_circle_d'], [0, 0, 'crop_circle_centre']];
    check('  nine locs round its centre, as in Zanaris', ring.filter(([dx, dz, nm]) => locAt(cx + dx, cz + dz, nm)).length, 9);
}
check('Zanaris\'s circle is there, for good', !!locAt(ZANARIS[0], ZANARIS[1], 'crop_circle_centre'), true);
{
    const p = fresh(cx + 2, cz);
    p.setLevel(HUNT, 16);
    H.opLoc(p, cx, cz, 'crop_circle_centre', 1); H.tick(8);
    check('Hunter 16: turned away', [p.x >= PX && p.x < PX + 64, lastMes(p)], [false, 'You need a Hunter level of 17 to enter the crop circle.']);
    p.setLevel(HUNT, 17);
    H.opLoc(p, cx, cz, 'crop_circle_centre', 1); H.tick(8);
    check('Hunter 17: in Puro-Puro, at the heart of the maze', [p.x, p.z], ARRIVE);
    check('  with Farmer\'s Affinity, thirty minutes', [lastMes(p), H.getVar(p, 'puro_affinity_until') - worldMinute() >= 29], ['You feel an affinity with the wheat.', true]);
    check('  and the way home is this field', H.getVarBit(p, 'puro_return_site'), SITES.findIndex(s => s[2] === site) + 1);
    const portal = [2591, 4319];
    H.opLoc(p, portal[0], portal[1], 'puro_portal', 1); H.tick(8);
    check('the portal sends you back to that field', Math.max(Math.abs(p.x - cx), Math.abs(p.z - cz)) <= 1, true);
    p.teleport(ZANARIS[0] + 2, ZANARIS[1], 0); H.tick(1);
    H.setVar(p, 'puro_affinity_until', 0);
    H.opLoc(p, ZANARIS[0], ZANARIS[1], 'crop_circle_centre', 1); H.tick(8);
    check('Zanaris\'s circle: in, with no affinity', [p.x, p.z, H.getVar(p, 'puro_affinity_until'), H.getVarBit(p, 'puro_return_site')], [...ARRIVE, 0, 0]);
    H.opLoc(p, portal[0], portal[1], 'puro_portal', 1); H.tick(8);
    check('  and the portal takes you back to Zanaris', Math.max(Math.abs(p.x - ZANARIS[0]), Math.abs(p.z - ZANARIS[1])) <= 1, true);
    H.despawn(p);
}

// ------------------------------------------------------------------------------------------ the wheat
console.log('THE WHEAT');
{
    const p = fresh(2590, 4312);
    const push = () => {
        p.teleport(2590, 4312, 0); H.tick(1);
        const from = World.currentTick;
        H.opLoc(p, 2590, 4311, 'puro_wheat_inner', 5);
        let moved = -1, free = -1;
        for (let t = 0; t < 20; t++) { H.tick(1); if (moved < 0 && p.z === 4310) moved = World.currentTick; if (moved >= 0 && !p.delayed && free < 0) free = World.currentTick; }
        return { at: [p.x, p.z], ticks: free - moved, mes: lastMes(p) };
    };
    const strXp = () => p.stats[STR];
    check('the inner ring is wheat you cannot walk through', blocked(2590, 4311), true);
    const xp0 = strXp();
    const seen = new Map<string, number>();
    for (let i = 0; i < 12; i++) { const r = push(); check(`push ${i}: across, ${r.ticks} ticks`, [r.at, [6, 8, 10].includes(r.ticks)], [[2590, 4310], true]); seen.set(r.mes, r.ticks); }
    check('each message goes with its time (99 Strength: fast or medium)', [...seen.entries()].every(([m, t]) => (m.includes('most efficient') && t === 6) || (m === 'You use your strength to push through the wheat.' && t === 8)), true);
    check('no Strength xp until Elnock is asked', strXp() - xp0, 0);
    H.setVarBit(p, 'puro_wheat_strength_xp', 1);
    const xp1 = strXp(); const r = push();
    check('  and then 4 or 2 a push', strXp() - xp1, r.ticks === 6 ? 40 : 20);
    H.setVar(p, 'puro_affinity_until', 2 ** 30);
    const r2 = push();
    check('Farmer\'s Affinity: three ticks quicker', [3, 5].includes(r2.ticks), true);
    p.setLevel(STR, 1);
    const slow = new Set<number>(); for (let i = 0; i < 25; i++) slow.add(push().ticks);
    check('at Strength 1 (with the affinity) the slow push is 7 ticks, and it happens', slow.has(7), true);
    H.despawn(p);

    // a shifting section, grown and wilted by hand (the controller does one every ten ticks): section 0
    // is the two tiles 2583,4296 and 2584,4296
    const q = fresh(2570, 4300);
    const A = [2583, 4296], B = [2584, 4296];
    const grown = () => !!locAt(A[0], A[1], 'puro_wheat_shifting') && !!locAt(B[0], B[1], 'puro_wheat_shifting');
    if (grown()) { H.runProc(q, '[proc,puro_shift]', [0]); H.tick(4); }
    check('section 0 open: walkable', [grown(), blocked(A[0], A[1]), blocked(B[0], B[1])], [false, false, false]);
    // the wheat will not grow over anything standing in the gap (checked below), so a roaming impling in
    // it is moved on first
    const clearGap = () => { for (const npc of World.npcs) if (npc && npc.isActive && npc.z === A[1] && (npc.x === A[0] || npc.x === B[0])) npc.teleport(2570, 4300, 0); };
    clearGap();
    H.runProc(q, '[proc,puro_shift]', [0]); H.tick(1);
    check('it grows: wheat you push through, not walk through', [grown(), blocked(A[0], A[1]), blocked(B[0], B[1])], [true, true, true]);
    H.runProc(q, '[proc,puro_shift]', [0]); H.tick(1);
    check('it wilts: wilting wheat for a moment, and open', [!!locAt(A[0], A[1], 'puro_wheat_wilting'), grown(), blocked(A[0], A[1])], [true, false, false]);
    H.tick(5);
    check('  then nothing', !!locAt(A[0], A[1], 'puro_wheat_wilting'), false);
    // an impling standing in the gap: the wheat does not grow over it
    const imp: any = H.addNpc('impling_baby_puro', A[0], A[1]); imp.timerInterval = 0; imp.targetOp = 0;
    H.runProc(q, '[proc,puro_shift]', [0]); H.tick(1);
    check('  it does not grow over an impling standing in the gap', [grown(), imp.x === A[0] && imp.z === A[1]], [false, true]);
    World.removeNpc(imp, -1);
    // every section tile, and every Puro-Puro spawn point: never the same square
    const shiftTiles = new Set<string>();
    for (const [x, z] of [[23, 8], [24, 8], [27, 18], [27, 19], [5, 22], [5, 23], [8, 41], [8, 42], [11, 27], [11, 28], [14, 22], [14, 23], [16, 50], [16, 51], [17, 39], [17, 40], [20, 37], [20, 38], [21, 49], [22, 49], [22, 58], [23, 58], [22, 44], [22, 45], [26, 14], [27, 14], [26, 46], [27, 46], [23, 15], [23, 16], [24, 41], [24, 42], [24, 47], [24, 48], [25, 21], [25, 22], [30, 11], [31, 11], [34, 41], [34, 42], [35, 20], [36, 20], [35, 55], [36, 55], [36, 43], [37, 43], [38, 21], [38, 22], [38, 47], [38, 48], [39, 17], [40, 17], [40, 5], [41, 5], [41, 44], [41, 45], [41, 52], [42, 52], [42, 18], [42, 19], [43, 15], [43, 16], [43, 25], [43, 26], [44, 50], [44, 51], [46, 40], [46, 41], [49, 21], [49, 22], [52, 35], [52, 36], [55, 26], [55, 27], [58, 16], [58, 17]]) shiftTiles.add(`${PX + x},${PZ + z}`);
    const onShift: string[] = [];
    for (const npc of World.npcs) if (npc && npc.lifecycle === EntityLifeCycle.RESPAWN && shiftTiles.has(`${npc.startX},${npc.startZ}`)) onShift.push(`${NpcType.get(npc.baseType).debugname}@${npc.startX},${npc.startZ}`);
    check('  no Puro-Puro spawn point is on a square of shifting wheat', onShift, []);
    H.despawn(q);
}

// ------------------------------------------------------------------------------------------ catching
console.log('CATCHING');
const KINDS = ['baby', 'young', 'gourmet', 'earth', 'essence', 'eclectic', 'nature', 'magpie', 'ninja', 'dragon', 'lucky'];
const LEVEL = [17, 22, 28, 36, 42, 50, 58, 65, 74, 83, 89];
const XP_PURO = [18, 20, 22, 25, 27, 30, 34, 44, 50, 65, 80];
const XP_WORLD = [20, 22, 24, 27, 29, 32, 36, 216, 240, 300, 380];
/** Click Catch until the impling is caught or the try runs out; returns the ticks it took, or -1. */
function catchIt(p: any, npc: Npc, max = 80) {
    const t0 = World.currentTick;
    for (let t = 0; t < max; t++) {
        if (!npc.isActive) return World.currentTick - t0;
        if (!p.delayed && !p.target) H.opNpc(p, npc, 1);
        H.tick(1);
        if (!npc.isActive) return World.currentTick - t0;
    }
    return -1;
}
// kept from blinking away by stopping their timer
const spawnImp = (name: string, x: number, z: number) => { const npc: any = H.addNpc(name, x, z); npc.timerInterval = 0; return npc; };
/** One Catch click: the first message it brings (implings wander, so the walk can take a while). */
function tryOnce(p: any, npc: Npc) {
    for (let t = 0; t < 10 && p.delayed; t++) H.tick(1);
    p.clearPendingAction(); p.clearInteraction();
    const mark = mesOf(p).length;
    H.opNpc(p, npc, 1);
    for (let t = 0; t < 40 && mesOf(p).length === mark; t++) H.tick(1);
    return mesOf(p)[mark];
}
for (let i = 0; i < KINDS.length; i++) {
    const k = KINDS[i];
    const p = fresh(2589, 4320);
    H.equip(p, { rhand: 'butterfly_net' });
    p.setLevel(HUNT, LEVEL[i] - 1);
    H.give(p, 'impling_jar', 2);
    let imp = spawnImp(`impling_${k}_puro`, 2590, 4320);
    const refused = tryOnce(p, imp);
    p.setLevel(HUNT, LEVEL[i]);
    const xp0 = p.stats[HUNT];
    const took = catchIt(p, imp);
    const gained = p.stats[HUNT] - xp0;
    check(`${k}: refused at ${LEVEL[i] - 1}, netted at ${LEVEL[i]} into a jar for ${XP_PURO[i]} xp`, [refused, took > 0, H.invCount(p, `${k}_impling_jar`), H.invCount(p, 'impling_jar'), gained >= XP_PURO[i] * 10 && gained < XP_PURO[i] * 10 + 40],
        ['You need a Hunter level of ' + LEVEL[i] + ' to catch this impling.', true, 1, 1, true]);
    H.clearInv(p); H.tick(3);
    imp = spawnImp(`impling_${k}_puro`, 2590, 4320);
    const nojar = tryOnce(p, imp);
    check(`  no jar in Puro-Puro: no catch`, [imp.isActive, nojar], [true, 'You need an empty impling jar to catch implings in Puro-Puro.']);
    H.equip(p, { rhand: 'bronze_sword' });
    H.give(p, 'impling_jar', 1);
    const bare = tryOnce(p, imp);
    p.setLevel(HUNT, Math.min(99, LEVEL[i] + 10));
    const bareOk = catchIt(p, imp) > 0;
    check(`  bare-handed: refused below ${LEVEL[i] + 10}, caught at it (into the jar)`, [bare, bareOk, H.invCount(p, `${k}_impling_jar`)], ['You need a Hunter level of ' + (LEVEL[i] + 10) + ' to catch this impling with your bare hands.', true, 1]);
    p.teleport(3222, 3218, 0); H.clearInv(p); H.tick(3);
    H.equip(p, { rhand: 'magic_butterfly_net' });
    p.setLevel(HUNT, LEVEL[i]);
    imp = spawnImp(`impling_${k}`, 3223, 3219);
    const w0 = p.stats[HUNT];
    const took2 = catchIt(p, imp);
    const wg = p.stats[HUNT] - w0;
    check(`  Gielinor, magic net, no jar: looted on the spot for ${XP_WORLD[i]} xp`, [took2 > 0, mesOf(p).includes('You manage to catch the impling and acquire some loot.'), wg >= XP_WORLD[i] * 10 && wg < XP_WORLD[i] * 10 + 60], [true, true, true]);
    check(`  the Check totals counters`, [H.getVarBit(p, `impling_caught_${k}_puro`), H.getVarBit(p, `impling_caught_${k}_world`)], [2, 1]);
    H.despawn(p);
}
{
    const p = fresh(2589, 4320);
    H.equip(p, { rhand: 'butterfly_net' }); p.setLevel(HUNT, 17); H.give(p, 'impling_jar', 28);
    let tries = 0, got = 0;
    for (let r = 0; r < 60; r++) {
        const imp = spawnImp('impling_baby_puro', 2590, 4320);
        const before = mesOf(p).length;
        catchIt(p, imp, 200);
        tries += mesOf(p).slice(before).filter(x => x === 'You fail to catch the impling.').length + 1; got++;
        if (H.invCount(p, 'impling_jar') === 0) { H.clearInv(p); H.give(p, 'impling_jar', 28); }
    }
    const rate = got / tries;
    truthy(`a baby impling at 17 with a net: caught ${got} in ${tries} swings (the wiki: ~52%)`, rate > 0.38 && rate < 0.66, rate.toFixed(2));
    H.despawn(p);
}

// ------------------------------------------------------------------------------------------ jars
console.log('JARS');
const TABLE: Record<string, string[]> = {
    baby: ['chisel', 'thread', 'needle', 'knife', 'cheese', 'hammer', 'ball_of_wool', 'anchovies', 'spicespot', 'flax', 'mud_pie', 'seaweed', 'air_talisman', 'silver_bar', 'sapphire', 'hard_leather', 'lobster', 'softclay'],
    dragon: ['mystic_robe_bottom', 'cert_amulet_of_glory', 'cert_strung_dragonstone_amulet', 'dragon_longsword', 'cert_dragon_dagger_p++', 'cert_dragonstone', 'cert_babydragon_bones', 'cert_dragon_bones', 'magic_tree_seed', 'snapdragon_seed', 'cert_summer_pie']
};
for (const k of ['baby', 'dragon']) {
    const p = fresh(3222, 3218);
    const seen = new Set<string>(); let jars = 0, opened = 0;
    for (let r = 0; r < 300; r++) {
        H.clearInv(p); H.give(p, `${k}_impling_jar`, 1);
        H.opheld(p, `${k}_impling_jar`, 3); H.tick(1); opened++;
        const inv = p.getInventory(InvType.INV)!;
        for (let i = 0; i < inv.capacity; i++) { const o = inv.get(i); if (!o) continue; const nm = ObjType.get(o.id).debugname!; if (nm === 'impling_jar') jars++; else if (!nm.startsWith('trail_')) seen.add(nm); }
    }
    const extra = [...seen].filter(x => !TABLE[k].includes(x));
    check(`${k} impling jars x300: nothing outside the wiki's table`, extra, []);
    truthy(`  most of the table seen (${seen.size} of ${TABLE[k].length})`, seen.size >= TABLE[k].length - (k === 'baby' ? 8 : 1), seen.size);
    truthy(`  the jar back nine times in ten (${jars}/${opened})`, jars / opened > 0.84 && jars / opened < 0.96, jars);
    H.despawn(p);
}
{
    const p = fresh(3222, 3218);
    let clue = false;
    for (let r = 0; r < 400 && !clue; r++) {
        H.clearInv(p); H.give(p, 'gourmet_impling_jar', 1); H.opheld(p, 'gourmet_impling_jar', 3); H.tick(1);
        const inv = p.getInventory(InvType.INV)!;
        for (let i = 0; i < inv.capacity; i++) { const o = inv.get(i); if (o && ObjType.get(o.id).debugname!.startsWith('trail_clue_easy')) clue = true; }
    }
    check('a gourmet impling jar\'s 1/25 easy clue turns up', clue, true);
    H.clearInv(p); H.give(p, 'lucky_impling_jar', 1); H.opheld(p, 'lucky_impling_jar', 3); H.tick(2);
    const got: string[] = []; const inv = p.getInventory(InvType.INV)!;
    for (let i = 0; i < inv.capacity; i++) { const o = inv.get(i); if (o) got.push(ObjType.get(o.id).debugname!); }
    truthy('a lucky impling jar pays a Treasure Trail reward roll', got.filter(x => x !== 'impling_jar').length >= 1, got);
    H.despawn(p);
}

// ------------------------------------------------------------------------------------------ Elnock
console.log('ELNOCK');
{
    const p = fresh(2587, 4314);
    const from = H.ifaces.length;
    talk(p, elnock, 1, [3, 4]);
    check('first talk: how to catch them, and the spare equipment', [shown(p, from).includes('Firstly you will need a butterfly net'), H.invCount(p, 'butterfly_net'), H.invCount(p, 'impling_jar')], [true, 1, 7]);
    talk(p, elnock, 1, [3]);
    check('  only once', H.invCount(p, 'impling_jar'), 7);
    H.clearInv(p);
    for (const [j, c] of [['baby', 3], ['young', 2], ['gourmet', 1]] as [string, number][]) H.give(p, `${j}_impling_jar`, c);
    talk(p, elnock, 3, [1]);
    check('3 baby, 2 young, 1 gourmet: imp repellent', [H.invCount(p, 'imp_repellent'), H.invCount(p, 'baby_impling_jar')], [1, 0]);
    for (const [j, c] of [['gourmet', 3], ['earth', 2], ['essence', 1]] as [string, number][]) H.give(p, `${j}_impling_jar`, c);
    talk(p, elnock, 3, [2]);
    check('3 gourmet, 2 earth, 1 essence: a magic butterfly net', H.invCount(p, 'magic_butterfly_net'), 1);
    for (const [j, c] of [['essence', 3], ['eclectic', 2], ['nature', 1]] as [string, number][]) H.give(p, `${j}_impling_jar`, c);
    talk(p, elnock, 3, [3]);
    check('3 essence, 2 eclectic, 1 nature: a jar generator, charged', [H.invCount(p, 'jar_generator'), H.getVar(p, 'jar_generator_charge')], [1, 100]);
    H.setVar(p, 'jar_generator_charge', 40);
    H.give(p, 'essence_impling_jar', 3); H.give(p, 'eclectic_impling_jar', 2); H.give(p, 'nature_impling_jar', 1);
    talk(p, elnock, 3, [3, 1]);
    check('  the trade again recharges it rather than making a second', [H.invCount(p, 'jar_generator'), H.invCount(p, 'nature_impling_jar'), H.getVar(p, 'jar_generator_charge')], [1, 0, 100]);
    H.clearInv(p); H.give(p, 'jar_generator'); H.setVar(p, 'jar_generator_charge', 100);
    H.opheld(p, 'jar_generator', 1); H.tick(1);
    H.opheld(p, 'jar_generator', 3); H.tick(1);
    check('the generator: an impling jar (3%), a butterfly jar (1%)', [H.invCount(p, 'impling_jar'), H.invCount(p, 'hunter_butterfly_jar'), H.getVar(p, 'jar_generator_charge')], [1, 1, 96]);
    H.setVar(p, 'jar_generator_charge', 3);
    H.opheld(p, 'jar_generator', 1); H.tick(1);
    check('  and it crumbles on its last charge', [H.invCount(p, 'jar_generator'), H.invCount(p, 'impling_jar')], [0, 2]);
    H.clearInv(p); H.give(p, 'young_impling_jar', 1); H.give(p, 'ninja_impling_jar', 1);
    talk(p, elnock, 3, [4]);
    check('one jarred impling for three jars: the lowest goes first', [H.invCount(p, 'young_impling_jar'), H.invCount(p, 'ninja_impling_jar'), H.invCount(p, 'impling_jar')], [0, 1, 3]);
    itemOnNpc(p, 'ninja_impling_jar', elnock);
    check('  or the one you use on him', [H.invCount(p, 'ninja_impling_jar'), H.invCount(p, 'impling_jar')], [0, 6]);
    H.clearInv(p); H.give(p, 'coins', 30000);
    talk(p, elnock, 1, [5, 1], 4);
    check('four jars bought for 8,000', [H.invCount(p, 'impling_jar'), H.invCount(p, 'coins')], [4, 22000]);
    talk(p, elnock, 1, [5], 7);
    check('  seven is more than the six left today', H.invCount(p, 'impling_jar'), 4);
    talk(p, elnock, 1, [5, 1], 6);
    talk(p, elnock, 1, [5]);
    check('  six, and then none', [H.invCount(p, 'impling_jar'), H.invCount(p, 'coins')], [10, 10000]);
    talk(p, elnock, 1, [4, 1]);
    check('the wheat: Strength xp switched on', H.getVarBit(p, 'puro_wheat_strength_xp'), 1);
    H.despawn(p);
}

// ------------------------------------------------------------------------------------------ imp defenders
console.log('IMP DEFENDERS');
{
    const def: any = staticOf('imp_defender')[0];
    const p = fresh(def.x + 1, def.z);
    p.setLevel(THIEV, 1);
    H.give(p, 'baby_impling_jar'); H.give(p, 'dragon_impling_jar');
    const babies0 = npcsOf('impling_baby_puro').length;
    let freed = false;
    for (let t = 0; t < 400 && !freed; t++) {
        if (Math.max(Math.abs(p.x - def.x), Math.abs(p.z - def.z)) > 1) p.teleport(def.x + 1, def.z, 0);
        H.tick(1);
        freed = H.invCount(p, 'baby_impling_jar') === 0;
    }
    H.tick(1);
    check('an imp defender beside you frees the lowest impling', [freed, H.invCount(p, 'dragon_impling_jar')], [true, 1]);
    check('  shouting "Be free!"', npcSays.includes('Be free!'), true);
    truthy('  the baby impling out again', npcsOf('impling_baby_puro').length > babies0, npcsOf('impling_baby_puro').length - babies0);
    H.despawn(p);
}

// ------------------------------------------------------------------------------------------ spawning
console.log('SPAWNING');
{
    while (World.currentTick < 260) H.tick(10);
    const puro = KINDS.reduce((a, k) => a + npcsOf(`impling_${k}_puro`).length, 0);
    const spawnersLeft = ['impling_spawner_low', 'impling_spawner_mid', 'impling_spawner_high'].reduce((a, k) => a + npcsOf(k).length, 0);
    check('after two minutes Puro-Puro\'s invisible spawns are implings', [spawnersLeft, puro >= 51 + 24 - 3], [0, true]);
    const stuck = KINDS.flatMap(k => npcsOf(`impling_${k}_puro`)).filter(npc => blocked(npc.x, npc.z)).map(npc => `${npc.x},${npc.z}`);
    check('  and not one of them is inside the wheat', stuck, []);
    const p = fresh(3222, 3218);
    const count = () => ['impling_spawner_world_low', 'impling_spawner_world_mid', 'impling_spawner_world_high'].reduce((a, k) => a + npcsOf(k, false).length, 0);
    const before = count();
    H.runProc(p, '[proc,impling_world_cycle]');
    H.tick(1);
    const added = count() - before;
    truthy('a Gielinor cycle adds 4 + N + 2N (N 5-10) invisible spawns', added >= 19 && added <= 34 && (added - 4) % 3 === 0, added);
    H.tick(205);
    const worldImps = KINDS.reduce((a, k) => a + npcsOf(`impling_${k}`, false).length, 0);
    truthy('  two minutes on, they are implings', worldImps >= added, worldImps);
    H.despawn(p);
}

// ------------------------------------------------------------------------------------------ jars by hand
console.log('JARS BY HAND');
{
    const p = fresh(2937, 3209);
    H.give(p, 'pestle_and_mortar'); H.give(p, 'anchovies', 1); H.give(p, 'vial_empty'); H.give(p, 'mourning_sieve'); H.give(p, 'marigold'); H.give(p, 'hunter_butterfly_jar');
    useOn(p, 'pestle_and_mortar', 'anchovies');
    check('pestle and mortar on anchovies: anchovy paste', H.invCount(p, 'anchovy_paste'), 1);
    H.give(p, 'anchovies', 1); useOn(p, 'anchovies', 'pestle_and_mortar');
    check('  either way round', H.invCount(p, 'anchovy_paste'), 2);
    useOn(p, 'anchovy_paste', 'vial_empty');
    check('two pastes are not eight', H.invCount(p, 'anchovy_oil'), 0);
    H.give(p, 'anchovy_paste', 6); useOn(p, 'vial_empty', 'anchovy_paste');
    check('eight, a vial and a sieve: anchovy oil', [H.invCount(p, 'anchovy_oil'), H.invCount(p, 'anchovy_paste')], [1, 0]);
    const h0 = p.stats[HERB];
    useOn(p, 'marigold', 'anchovy_oil');
    check('the oil and marigolds: imp repellent, 5 Herblore xp', [H.invCount(p, 'imp_repellent'), p.stats[HERB] - h0], [1, 50]);
    itemOnLoc(p, 'imp_repellent', 2937, 3210, 'lamp_oil_still');
    itemOnLoc(p, 'hunter_butterfly_jar', 2937, 3210, 'lamp_oil_still');
    check('the repellent in the lamp oil still, a butterfly jar on it: an impling jar', [H.invCount(p, 'impling_jar'), H.invCount(p, 'hunter_butterfly_jar'), H.invCount(p, 'vial_empty')], [1, 0, 1]);
    H.despawn(p);
}

console.log(`\n${ok} ok, ${bad} FAIL`);
process.exit(bad ? 1 : 0);
