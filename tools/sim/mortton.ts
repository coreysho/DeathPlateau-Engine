// Shades of Mort'ton - the original (PlagueCityRS 349) quest, minigame and Mort Myre scripts, ported
// onto this server - start to finish on the real engine, plus the save migration from the version
// this server had before the port.
//
//   the diary (read to the last page), the table's herbs, Serum 207 brewed both ways, the
//   Apothecary, Razmire (the dose, the job, his two shops and when they open), Loar Shadows rising
//   into Loar Shades (attacked, and hunting) and sinking back, the five-kill tally, the catacombs'
//   shades not counting, the remains to Razmire and Ulsquire, the temple (resource pool, walls going
//   up a level at a time, the overlay's repair %, the stage), the altar, sacred oil, Serum 208,
//   pyre logs, the pyre (and the wrong remains), Ulsquire finishing it (quest points), the Shade
//   lair and a chest, the afflicted villagers, a Mort Myre snail, and the migration.
//
// Usage: BUILD_SRC_DIR=<content> npx tsx tools/sim/mortton.ts
import * as H from './harness.js';
import World from '#/engine/World.js';
import Npc from '#/engine/entity/Npc.js';
import Player from '#/engine/entity/Player.js';
import Component from '#/cache/config/Component.js';
import ObjType from '#/cache/config/ObjType.js';
import InvType from '#/cache/config/InvType.js';
import LocType from '#/cache/config/LocType.js';
import NpcType from '#/cache/config/NpcType.js';
import VarSharedType from '#/cache/config/VarSharedType.js';
import ScriptState from '#/engine/script/ScriptState.js';
import ScriptProvider from '#/engine/script/ScriptProvider.js';
import ScriptRunner from '#/engine/script/ScriptRunner.js';
import ServerTriggerType from '#/engine/script/ServerTriggerType.js';
import { Interaction } from '#/engine/entity/Interaction.js';
import { findPathToEntity, findPathToLoc } from '#/engine/GameMap.js';

// every runtime script error, from any script, anywhere
const errors: string[] = [];
const origErr = console.error;
console.error = (...a: unknown[]) => {
    const s = a.map(String).join(' ');
    if (/script error|error:/i.test(s)) errors.push(s);
    origErr(...a);
};

await H.boot();
H.loginOrder();

const R = { ok: 0, bad: 0 };
const check = (what: string, got: unknown, want: unknown) => {
    const pass = JSON.stringify(got) === JSON.stringify(want);
    if (pass) R.ok++;
    else R.bad++;
    console.log(`  ${pass ? 'ok  ' : 'FAIL'} ${what}: ${JSON.stringify(got)}${pass ? '' : `   (want ${JSON.stringify(want)})`}`);
};

// map square 54_51, and the catacombs under it (54_151)
const X = 3456, Z = 3264, CZ = 9664;
const at = (lx: number, lz: number) => [X + lx, Z + lz] as const;
const RAZMIRE = at(33, 32), ULSQUIRE = at(40, 25), SHELF = at(25, 15), TABLE = at(26, 14), ALTAR = at(50, 52), PYRE = at(6, 18), PYRE2 = at(6, 30);
const LAIR_DOOR = at(29, 56);
const RAZ = ['razmire_keelgan', 'razmire_keelgan_afflicted'], ULS = ['ulsquire_shauncy', 'ulsquire_shauncy_afflicted'];

// the original's stage numbers (quests/quest_mortton/configs/quest_mortton.constant)
const S = {
    not_started: 0, read_diary: 5, made_serum: 10, kill_shades: 15, killed_1: 20, killed_2: 25, killed_5: 40,
    shades_to_razmire: 45, shades_to_ulsquire: 47, ulsquire_temple: 50, rebuild_temple: 55, can_light_altar: 60,
    created_sacred_oil: 65, created_pyre_logs: 70, logs_on_pyre: 75, lit_pyre: 80, complete: 85
};
const BIT = { used_on_ulsquire: 0, ulsquire_visible: 1, used_on_razmire: 2, razmire_visible: 3, shadeattack: 4, razmire_perm: 6, made_perm: 7, table: 8, lair: 29, apothecary: 30, fullpool: 31 };
const stage = (p: Player) => H.getVar(p, 'morttonquest');
const bit = (p: Player, b: number) => (H.getVar(p, 'morttonmulti') >>> b) & 1;

let bucket = 1;
function player(name: string, st: number, x: number, z: number, level = 0) {
    const p = H.makePlayer(name, x, z, bucket++);
    if (level) p.teleport(x, z, level);
    H.tick(1);
    H.maxOut(p);
    H.clearInv(p);
    H.setVar(p, 'morttonquest', st);
    H.setVar(p, 'druidquest', 4); // Herblore
    return p;
}

function slotOf(p: Player, objName: string, not = -1) {
    const id = ObjType.getId(objName);
    const inv = p.getInventory(InvType.INV)!;
    for (let i = 0; i < inv.capacity; i++) if (inv.get(i)?.id === id && i !== not) return i;
    throw new Error(p.username + ' not carrying ' + objName);
}

/** Wait for whatever the player is doing, clicking through any dialogue, taking `picks` at menus. */
function settle(p: Player, picks: number[] = [], max = 200, waitQueue = true): string[] {
    const from = H.ifaces.length;
    let idle = 0;
    for (let guard = 0; guard < max; guard++) {
        const s = p.activeScript;
        if (s && s.execution === ScriptState.PAUSEBUTTON) {
            idle = 0;
            const names = p.resumeButtons.map((id: number) => Component.get(id).comName ?? '');
            const open = p.modalChat === -1 ? '' : Component.get(p.modalChat).comName ?? '';
            const multi = open.startsWith('multi') ? names.find((n: string) => n.startsWith(open + ':')) : null;
            if (multi) {
                const pick = picks.shift();
                if (pick === undefined) throw new Error('unexpected menu: ' + names.join(','));
                H.choose(p, `${multi.split(':')[0]}:com_${pick}`);
            } else {
                p.executeScript(s, true, true);
            }
            continue;
        }
        H.tick(1);
        if (!p.activeScript && !p.target && !p.delayed && (!waitQueue || p.queue.head() === null)) {
            if (++idle >= 3) break;
        } else idle = 0;
    }
    if (picks.length) throw new Error('menus not reached: ' + picks.join(','));
    return textSince(p, from);
}
const textSince = (p: Player, from: number) =>
    H.ifaces.slice(from).filter(i => i.who === p.username && i.kind === 'text' && i.text && i.text.length > 1).map(i => i.text!);

/** The nearest live npc of any of these types (Razmire and Ulsquire change type as the serum takes). */
function npcAny(names: string[], x: number, z: number, level = 0) {
    let best: Npc | null = null, bestD = Infinity;
    for (const name of names) {
        const n = H.npcNear(name, x, z, level);
        if (n) {
            const d = Math.max(Math.abs(n.x - x), Math.abs(n.z - z));
            if (d < bestD) (best = n), (bestD = d);
        }
    }
    if (!best) throw new Error('none of ' + names.join('/') + ' near ' + x + ',' + z);
    return best;
}
const typeName = (n: Npc) => NpcType.get(n.type).debugname;

function talk(p: Player, names: string[], x: number, z: number, picks: number[] = [], op = 1) {
    const npc = npcAny(names, x, z, p.level);
    p.teleport(npc.x + 1, npc.z, npc.level);
    H.tick(1);
    H.opNpc(p, npc, op);
    return settle(p, picks);
}

function useOnNpc(p: Player, objName: string, npc: Npc, picks: number[] = []) {
    p.teleport(npc.x + 1, npc.z, npc.level);
    H.tick(1);
    p.clearPendingAction();
    p.lastUseItem = ObjType.getId(objName);
    p.lastUseSlot = slotOf(p, objName);
    p.queueWaypoints(findPathToEntity(p.level, p.x, p.z, npc.x, npc.z, p.width, npc.width, npc.length));
    p.setInteraction(Interaction.ENGINE, npc, ServerTriggerType.APNPCU);
    (p as unknown as { opcalled: boolean }).opcalled = true;
    return settle(p, picks);
}

const locAt = (x: number, z: number, locName: string, level = 0) => World.getLoc(x, z, level, LocType.getId(locName));

function useOnLoc(p: Player, objName: string, x: number, z: number, locName: string, waitQueue = true) {
    const loc = locAt(x, z, locName, p.level);
    if (!loc) throw new Error(`no ${locName} at ${x},${z}`);
    p.clearPendingAction();
    p.lastUseItem = ObjType.getId(objName);
    p.lastUseSlot = slotOf(p, objName);
    p.queueWaypoints(findPathToLoc(p.level, p.x, p.z, loc.x, loc.z, p.width, loc.width, loc.length, loc.angle, loc.shape, LocType.get(loc.type).forceapproach));
    p.setInteraction(Interaction.ENGINE, loc, ServerTriggerType.APLOCU);
    (p as unknown as { opcalled: boolean }).opcalled = true;
    return settle(p, [], 200, waitQueue);
}

function opLoc(p: Player, x: number, z: number, locName: string, op: number, picks: number[] = [], max = 200) {
    H.opLoc(p, x, z, locName, op);
    return settle(p, picks, max);
}

/** OpHeldUHandler's lookup, in its order: [opheldu,b], [opheldu,a] (swapped), b's category, a's category (swapped). */
function useOnHeld(p: Player, used: string, target: string, picks: number[] = []) {
    const t = ObjType.getId(target), u = ObjType.getId(used);
    p.lastItem = t;
    p.lastSlot = slotOf(p, target);
    p.lastUseItem = u;
    p.lastUseSlot = slotOf(p, used, p.lastSlot);
    const swap = () => {
        [p.lastItem, p.lastUseItem] = [p.lastUseItem, p.lastItem];
        [p.lastSlot, p.lastUseSlot] = [p.lastUseSlot, p.lastSlot];
    };
    let script = ScriptProvider.getByTriggerSpecific(ServerTriggerType.OPHELDU, t, -1);
    if (!script) {
        script = ScriptProvider.getByTriggerSpecific(ServerTriggerType.OPHELDU, u, -1);
        swap();
    }
    const tc = ObjType.get(t).category, uc = ObjType.get(u).category;
    if (!script && tc !== -1) script = ScriptProvider.getByTriggerSpecific(ServerTriggerType.OPHELDU, -1, tc);
    if (!script && uc !== -1) {
        script = ScriptProvider.getByTriggerSpecific(ServerTriggerType.OPHELDU, -1, uc);
        swap();
    }
    if (!script) throw new Error(`no opheldu for ${used} on ${target}`);
    p.executeScript(ScriptRunner.init(script, p), true);
    return settle(p, picks);
}

const mesSince = (p: Player, from: number) => H.mesgs.slice(from).filter(m => m.who === p.username).map(m => m.text);
const qp = (p: Player) => H.runProc(p, '[proc,count_questpoints]')[0];
const setShared = (name: string, v: number) => (World.vars[VarSharedType.getId(name)] = v);
const getShared = (name: string) => World.vars[VarSharedType.getId(name)];

/** Attack the nearest shadow of a kind and fight it to the death. Returns the npc and every type it was. */
function killShade(p: Player, kind = 'shadeshadow_level1', tried = new Set<number>()): { npc: Npc; types: Set<string>; died: boolean; x: number; z: number } {
    // the nearest one of that kind still sliding about as a shadow, not one already in a fight
    let npc: Npc | null = null, bestD = Infinity;
    const id = NpcType.getId(kind);
    for (const n of World.npcs) {
        if (!n || !n.isActive || n.type !== id || n.level !== p.level || tried.has(n.nid)) continue;
        const d = Math.max(Math.abs(n.x - p.x), Math.abs(n.z - p.z));
        if (d < bestD) (npc = n), (bestD = d);
    }
    if (!npc) throw new Error('no ' + kind + ' near ' + p.x + ',' + p.z);
    tried.add(npc.nid);
    p.teleport(npc.x + 1, npc.z, npc.level);
    H.tick(1);
    const types = new Set<string>([typeName(npc)]);
    const h0 = H.npcHits.length;
    H.attackNpc(p, npc);
    let died = false, x = npc.x, z = npc.z;
    for (let t = 0; t < 400; t++) {
        H.tick(1);
        if (!npc.isActive) {
            died = true;
            break;
        }
        x = npc.x;
        z = npc.z;
        types.add(typeName(npc));
        if (!p.target && !p.delayed && t % 8 === 7) H.attackNpc(p, npc);
        if (p.levels[3] < 30) p.levels[3] = 99;
        // one the player cannot get at (walled in, or across the water): a different one
        if (t === 40 && H.npcHits.length === h0 && tried.size < 6) {
            p.clearPendingAction();
            settle(p);
            return killShade(p, kind, tried);
        }
    }
    settle(p);
    return { npc, types, died, x, z };
}

// ============================================================================================
console.log('MORT\'TON  Razmire\'s shops (closed until the five shades are shown to him)');
{
    const shopCom = Component.getId('shop_template');
    const e0 = errors.length;
    const early = player('mortshop0', S.made_serum, RAZMIRE[0] + 1, RAZMIRE[1]);
    H.setVar(early, 'morttonmulti', 1 << BIT.razmire_visible | 1 << BIT.used_on_razmire);
    talk(early, RAZ, ...RAZMIRE, [5, 2]); // lucid: his questions -> "Is there anything worth doing" -> "not right now"
    check('before the job: no shop, the questions menu instead', early.modalMain === shopCom, false);
    early.closeModal();
    H.despawn(early);

    const p = player('mortshop', S.shades_to_razmire, RAZMIRE[0] + 1, RAZMIRE[1]);
    H.setVar(p, 'morttonmulti', 1 << BIT.razmire_visible | 1 << BIT.used_on_razmire);
    talk(p, RAZ, ...RAZMIRE, [1]);
    check('lucid Razmire at shades_to_razmire: store menu -> general store', [p.modalMain === shopCom, H.getVar(p, 'shop')], [true, InvType.getId('razmiregeneralstore')]);
    p.closeModal();
    check('  he is Razmire Keelgan now, not the afflicted one', typeName(npcAny(RAZ, ...RAZMIRE)), 'razmire_keelgan');
    talk(p, RAZ, ...RAZMIRE, [], 4);
    check('Trade-Builders-Store op: builders\' store', [p.modalMain === shopCom, H.getVar(p, 'shop')], [true, InvType.getId('razmirebuildingstore')]);
    p.closeModal();
    talk(p, RAZ, ...RAZMIRE, [], 3);
    check('Trade-General-Store op: general store', H.getVar(p, 'shop'), InvType.getId('razmiregeneralstore'));
    p.closeModal();
    const k = player('mortshop2', S.killed_2, RAZMIRE[0] + 1, RAZMIRE[1]);
    H.setVar(k, 'morttonmulti', 1 << BIT.razmire_visible);
    const t = talk(k, RAZ, ...RAZMIRE, [], 3);
    check('  the store op at two shades down: "Have you killed those Shades yet?", no shop', [t.some(s => /killed those Shades yet/.test(s)), k.modalMain === shopCom], [true, false]);
    check('  no script errors', errors.slice(e0), []);
    H.despawn(p, k);
}

// ============================================================================================
console.log('The diary, the table and Serum 207');
const q = player('mortquest', S.not_started, SHELF[0] + 1, SHELF[1] + 1);
H.equip(q, { rhand: 'rune_scimitar' });
{
    const text = talk(q, RAZ, ...RAZMIRE);
    check('afflicted Razmire before the quest: gibberish, no stage change', [text.some(s => /doesn't make any sense/.test(s)), stage(q)], [true, S.not_started]);
    q.teleport(SHELF[0] + 1, SHELF[1] + 1, 0);
    H.tick(1);
    opLoc(q, ...SHELF, 'shades_experimentshelf', 1);
    check('the shelf gives the diary, no stage yet', [H.invCount(q, 'serum_book'), stage(q)], [1, S.not_started]);
    opLoc(q, ...SHELF, 'shades_experimentshelf', 1);
    check('  and only one', H.invCount(q, 'serum_book'), 1);

    opLoc(q, ...TABLE, 'shades_experimenttable', 5);
    check('the smashed table: two tarromin and a rogue\'s purse, once', [H.invCount(q, 'unidentified_tarromin'), H.invCount(q, 'unidentified_rogues_purse'), bit(q, BIT.table)], [2, 1, 1]);
    opLoc(q, ...TABLE, 'shades_experimenttable', 5);
    check('  searched again: nothing more', H.invCount(q, 'unidentified_tarromin'), 2);

    H.give(q, 'tarrominvial');
    H.give(q, 'ashes');
    const m0 = H.mesgs.length;
    useOnHeld(q, 'ashes', 'tarrominvial');
    check('before the diary is read: the serum is refused', [H.invCount(q, 'mort_serum3'), mesSince(q, m0).some(m => /not sure what effect/.test(m))], [0, true]);

    H.opheld(q, 'serum_book', 1);
    settle(q);
    check('reading the diary opens the book', H.getVar(q, 'open_book'), ObjType.getId('serum_book'));
    for (let i = 0; i < 11; i++) {
        H.ifButton(q, 'book:com_86');
        H.tick(1);
    }
    check('  eleven pages in: not started yet (it is the last page that does it)', stage(q), S.not_started);
    H.ifButton(q, 'book:com_86');
    H.tick(1);
    check('  page 25: stage read_diary', stage(q), S.read_diary);
    q.closeModal();

    useOnHeld(q, 'ashes', 'tarrominvial');
    check('ashes into the tarromin potion: Serum 207 (3), stage made_serum', [H.invCount(q, 'mort_serum3'), stage(q)], [1, S.made_serum]);
    H.give(q, 'tarrominvial');
    H.give(q, 'ashes');
    useOnHeld(q, 'tarrominvial', 'ashes');
    check('the potion onto the ashes: a second one', H.invCount(q, 'mort_serum3'), 2);
    H.give(q, 'vial_water');
    H.give(q, 'ashes');
    useOnHeld(q, 'vial_water', 'ashes');
    check('ashes and water: a vial of ashes', H.invCount(q, 'ashesvial'), 1);
    H.give(q, 'tarromin');
    useOnHeld(q, 'tarromin', 'ashesvial');
    check('tarromin into the ashes: a third serum', [H.invCount(q, 'mort_serum3'), H.invCount(q, 'ashesvial')], [3, 0]);
    useOnHeld(q, 'mort_serum3', 'mort_serum3');
    check('two serums decant like a potion (3+3 -> 4+2)', [H.invCount(q, 'mort_serum4'), H.invCount(q, 'mort_serum2'), H.invCount(q, 'mort_serum3')], [1, 1, 1]);
}

console.log('The Apothecary');
{
    const a = player('mortapo', S.read_diary, 3196, 3403);
    H.give(a, 'serum_book');
    const apo = npcAny(['apothecary'], 3196, 3403);
    const t = useOnNpc(a, 'serum_book', apo);
    check('before the serum: he explains it, keeps nothing', [t.some(s => /Herbi Flax/.test(s)), H.invCount(a, 'serum_book')], [true, 1]);
    H.setVar(a, 'morttonquest', S.made_serum);
    const xp = a.stats[15];
    useOnNpc(a, 'serum_book', apo, [1]);
    check('after it: the diary traded for Herblore training', [H.invCount(a, 'serum_book'), a.stats[15] - xp, bit(a, BIT.apothecary)], [0, 3350, 1]);
    H.despawn(a);
}

console.log('Razmire\'s dose and the job');
{
    const n = player('mortfresh', S.read_diary, RAZMIRE[0] + 1, RAZMIRE[1]);
    H.give(n, 'mort_serum3');
    const t = useOnNpc(n, 'mort_serum3', npcAny(RAZ, ...RAZMIRE));
    check('a serum he did not make himself: "not too fresh", no stage change', [t.some(s => /not too fresh/.test(s)), stage(n), H.invCount(n, 'mort_serum2')], [true, S.read_diary, 1]);
    H.despawn(n);
    for (let i = 0; i < 3; i++) H.tick(1); // his one-tick lucid spell wears off

    const e0 = errors.length;
    useOnNpc(q, 'mort_serum2', npcAny(RAZ, ...RAZMIRE), [4, 1]); // "What are all these shadow creatures?" -> "Yes, I'll dispatch..."
    check('dose taken, lucid, the job accepted: stage kill_shades', [H.invCount(q, 'mort_serum1'), bit(q, BIT.razmire_visible), stage(q)], [1, 1, S.kill_shades]);
    check('  no script errors', errors.slice(e0), []);
    const t2 = talk(q, RAZ, ...RAZMIRE);
    check('talking again: "have you killed the five shades yet?"', t2.some(s => /killed the five shades yet/.test(s)), true);
}

// ============================================================================================
console.log('Loar Shadows rise into Loar Shades');
{
    const e0 = errors.length;
    const m0 = H.mesgs.length;
    const first = killShade(q);
    check('the shadow attacked became a shade', [...first.types].sort(), ['shade_level1', 'shadeshadow_level1']);
    check('  and died', first.died, true);
    check('  tally advanced: stage killed_1, "That\'s one Shade!"', [stage(q), mesSince(q, m0).includes("That's one Shade!")], [S.killed_1, true]);
    const remains = World.getObj(first.x, first.z, 0, ObjType.getId('shade_bones1'), q.hash64);
    check('  Loar remains on the ground', !!remains, true);

    let back = false;
    for (let t = 0; t < 300 && !back; t++) {
        H.tick(1);
        back = first.npc.isActive && typeName(first.npc) === 'shadeshadow_level1';
    }
    check('  it respawns as a shadow', back, true);

    for (let i = 2; i <= 5; i++) {
        const k = killShade(q);
        check(`kill ${i}: rose, died`, [k.types.has('shade_level1'), k.died], [true, true]);
    }
    check('five down: stage killed_5_shades', stage(q), S.killed_5);
    const k6 = killShade(q);
    check('a sixth does not move it on', [k6.died, stage(q)], [true, S.killed_5]);
    check('  no script errors in the fighting', errors.slice(e0), []);
}

console.log('A shadow that hunts a player rises too, and sinks back when left alone');
{
    q.teleport(...RAZMIRE, 0); // out of the way: a shade already fighting q would not sink for v
    H.tick(3);
    const shadow = H.npcNear('shadeshadow_level1', X + 30, Z + 30)!;
    const v = player('mortbait', S.not_started, shadow.x + 1, shadow.z);
    check('the Loar Shadow hunts (huntmode shades)', NpcType.get(shadow.type).huntmode !== -1 && NpcType.get(shadow.type).huntrange > 0, true);
    // The hunt itself needs a client observing the npc, which a socketless sim player never is -
    // so this does what the hunt does: opplayer2 on the player it found, as its aggressive player.
    H.setNpcVar(shadow, 'npc_aggressive_player', v.uid);
    H.setNpcMode(shadow, 'OPPLAYER2', v);
    const h0 = H.hits.length;
    let rose = false;
    for (let t = 0; t < 40; t++) {
        H.tick(1);
        if (v.levels[3] < 30) v.levels[3] = 99;
        if (shadow.isActive && typeName(shadow) === 'shade_level1') rose = true;
        // a wandering npc can drop the mode before it reaches the player; hunt again, as the hunt would
        if (!rose && t % 5 === 4) {
            H.setNpcVar(shadow, 'npc_aggressive_player', v.uid);
            H.setNpcMode(shadow, 'OPPLAYER2', v);
        }
    }
    check('hunting a player: the shadow rises on its own', rose, true);
    check('  and the shade attacks them', H.hits.slice(h0).some(h => h.who === v.username), true);
    check('  shadeattack is set on the player', bit(v, BIT.shadeattack), 1);
    const nid = shadow.nid;
    H.despawn(v);
    let sank = false;
    for (let t = 0; t < 80 && !sank; t++) {
        H.tick(1);
        sank = shadow.isActive && typeName(shadow) === 'shadeshadow_level1';
    }
    check('  left alone, it sinks back into a shadow where it is', [sank, shadow.nid === nid], [true, true]);
}

console.log('The catacombs\' shadows rise the same way, and do not count for the quest');
{
    const c = player('mortcata', S.kill_shades, 3490, 9690);
    H.equip(c, { rhand: 'rune_scimitar' });
    const k = killShade(c, 'shadeshadow_level2');
    check('a Phrin Shadow rose into a Phrin Shade and died', [[...k.types].sort(), k.died], [['shade_level2', 'shadeshadow_level2'], true]);
    check('  Phrin remains dropped', !!World.getObj(k.x, k.z, 0, ObjType.getId('shade_bones2'), c.hash64), true);
    check('  the Loar tally did not move', stage(c), S.kill_shades);
    H.despawn(c);
}

// ============================================================================================
console.log('The remains to Razmire, then Ulsquire');
{
    // Ulsquire dosed early must not skip the shades
    const e = player('mortearly', S.killed_2, ULSQUIRE[0] + 1, ULSQUIRE[1]);
    H.give(e, 'mort_serum3');
    useOnNpc(e, 'mort_serum3', npcAny(ULS, ...ULSQUIRE), [5]);
    check('Ulsquire dosed at two shades down: talks, stage unchanged', [stage(e), bit(e, BIT.ulsquire_visible)], [S.killed_2, 1]);
    H.despawn(e);

    H.clearInv(q);
    H.give(q, 'mort_serum4', 2);
    H.give(q, 'shade_bones1', 3);
    const t = useOnNpc(q, 'mort_serum4', npcAny(RAZ, ...RAZMIRE));
    check('Razmire with only three remains: sent back for five', [t.some(s => /five shade remains/.test(s)), stage(q)], [true, S.killed_5]);
    H.give(q, 'shade_bones1', 2);
    talk(q, RAZ, ...RAZMIRE, [4]);
    check('with five: he takes two, stage shades_to_razmire', [H.invCount(q, 'shade_bones1'), stage(q)], [3, S.shades_to_razmire]);

    useOnNpc(q, 'mort_serum4', npcAny(ULS, ...ULSQUIRE));
    check('Ulsquire dosed and shown the remains: takes one, stage shades_to_ulsquire', [H.invCount(q, 'shade_bones1'), stage(q)], [2, S.shades_to_ulsquire]);
    talk(q, ULS, ...ULSQUIRE, [2, 5]); // "What can you tell me about that temple?", then "Ok thanks"
    check('asked about the temple: stage ulsquire_temple', stage(q), S.ulsquire_temple);
}

// ============================================================================================
console.log('Flamtaer temple');
const WALLS: [number, number][] = [];
{
    for (let lx = 36; lx <= 62; lx++)
        for (let lz = 44; lz <= 59; lz++)
            if (locAt(...at(lx, lz), 'templewall_base') || locAt(...at(lx, lz), 'templewallcorner_base')) WALLS.push([lx, lz]);
    check('fifteen wall segments, all at their base', WALLS.length, 15);
    const wallName = (lx: number, lz: number) => {
        for (const kind of ['templewall', 'templewallcorner'])
            for (const lvl of ['base', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10']) if (locAt(...at(lx, lz), `${kind}_${lvl}`)) return `${kind}_${lvl}`;
        return '?';
    };

    const early = player('mortwall0', S.shades_to_ulsquire, ...at(WALLS[0][0] - 1, WALLS[0][1]));
    const t0 = opLoc(early, ...at(...WALLS[0]), wallName(...WALLS[0]), 1);
    check('before Ulsquire\'s talk: "not sure how you would go about fixing this"', t0.some(s => /not sure how you would go about/.test(s)), true);
    H.despawn(early);

    q.teleport(...at(WALLS[0][0] - 1, WALLS[0][1]), 0);
    H.tick(1);
    q.setLevel(12, 25); // Crafting: a few resources a time
    const t1 = opLoc(q, ...at(...WALLS[0]), wallName(...WALLS[0]), 1);
    check('no hammer: refused', [t1.some(s => /need a hammer/.test(s)), stage(q)], [true, S.ulsquire_temple]);
    H.give(q, 'hammer');
    const t2 = opLoc(q, ...at(...WALLS[0]), wallName(...WALLS[0]), 1);
    check('no materials: the resources mesbox', [t2.some(s => /Resources needed/.test(s)), stage(q)], [true, S.ulsquire_temple]);

    H.clearInv(q);
    H.give(q, 'hammer');
    H.give(q, 'shade_bones1', 2);
    H.give(q, 'woodplank', 8);
    H.give(q, 'limestonebrick', 8);
    H.give(q, 'swamppaste', 60);
    // Every repair adds five times what it spends to the world's build; well past the top wall
    // threshold, one repair raises a wall one level and no shade can knock one down.
    setShared('current_temple_build', 17000);
    const xp0 = q.stats[12];
    for (const [lx, lz] of WALLS) {
        q.teleport(...at(lx - 1, lz), 0);
        H.tick(1);
        H.opLoc(q, ...at(lx, lz), wallName(lx, lz), 1);
        for (let t = 0; t < 120 && !wallName(lx, lz).endsWith('_10'); t++) H.tick(1);
        q.clearPendingAction();
        q.unsetMapFlag();
        H.tick(2);
    }
    check('every wall repaired to its tenth level', WALLS.map(w => wallName(...w)).every(n => n.endsWith('_10')), true);
    check('  stage rebuild_temple from the first repair', stage(q) >= S.rebuild_temple, true);
    check('  materials went into the resource pool', H.invCount(q, 'woodplank') < 8 && H.getVarBit(q, 'temple_resources') > 0, true);
    check('  Crafting xp for it', q.stats[12] > xp0, true);
    for (let t = 0; t < 8; t++) H.tick(1); // Razmire's timer updates the overlay for players in the temple
    check('  the overlay reads 100% repaired', H.getVar(q, 'temple_repaired_p'), 100);
    const [lx, lz] = WALLS[0];
    q.teleport(...at(lx - 1, lz), 0);
    H.tick(1);
    H.opLoc(q, ...at(lx, lz), wallName(lx, lz), 1);
    for (let t = 0; t < 12 && stage(q) < S.can_light_altar; t++) H.tick(1);
    q.clearPendingAction();
    H.tick(2);
    check('a repair of the whole temple: stage can_light_altar', stage(q), S.can_light_altar);
    check('  the altar is whole', !!locAt(...ALTAR, 'templefire_altar_nofire'), true);
    check('  the shades keep attacking a temple under repair (Razmire\'s timer draws them in)', getShared('current_temple_build') <= 17000, true);
}

console.log('The altar, sacred oil and Serum 208');
{
    H.give(q, 'tinderbox');
    H.setVar(q, 'temple_sanctity', 0);
    H.setVar(q, 'temple_sanctity_p', 0);
    const t0 = opLoc(q, ...ALTAR, 'templefire_altar_nofire', 1);
    check('no sanctity: the altar will not light', [t0.some(s => /sanctified enough/.test(s)), !!locAt(...ALTAR, 'templefire_altar')], [true, false]);
    H.setVar(q, 'temple_sanctity', 3000);
    H.setVar(q, 'temple_sanctity_p', 100);
    const fm = q.stats[11];
    opLoc(q, ...ALTAR, 'templefire_altar_nofire', 1, [], 60);
    check('lit, with Firemaking xp', [!!locAt(...ALTAR, 'templefire_altar'), q.stats[11] - fm], [true, 1600]);

    H.give(q, 'oliveoil3');
    useOnLoc(q, 'oliveoil3', ...ALTAR, 'templefire_altar');
    check('olive oil in the flame: sacred oil(3), stage created_sacred_oil, sanctity spent', [H.invCount(q, 'sacred_oil3'), stage(q), H.getVar(q, 'temple_sanctity')], [1, S.created_sacred_oil, 3000 - 81]);

    H.give(q, 'mort_serum2');
    useOnLoc(q, 'mort_serum2', ...ALTAR, 'templefire_altar');
    check('Serum 207 in the flame: Serum 208, 600 sanctity', [H.invCount(q, 'mort_serum_perm2'), bit(q, BIT.made_perm), H.getVar(q, 'temple_sanctity')], [1, 1, 3000 - 81 - 600]);
    const coins = H.invCount(q, 'coins');
    useOnNpc(q, 'mort_serum_perm2', npcAny(RAZ, ...RAZMIRE), [2]);
    const got = H.invCount(q, 'coins') - coins;
    check('Serum 208 on Razmire: 180-220 coins, once, and he stays lucid', [got >= 180 && got <= 220, bit(q, BIT.razmire_perm), H.invCount(q, 'mort_serum_perm1')], [true, 1, 1]);
}

console.log('Pyre logs');
{
    const n = player('mortoil0', S.can_light_altar, ...at(10, 20));
    H.give(n, 'sacred_oil4');
    H.give(n, 'logs');
    const m0 = H.mesgs.length;
    useOnHeld(n, 'sacred_oil4', 'logs');
    check('another\'s sacred oil before your own: "doesn\'t seem fresh"', [mesSince(n, m0).some(m => /seem fresh/.test(m)), H.invCount(n, 'logs_pyre')], [true, 0]);
    H.despawn(n);

    H.give(q, 'magic_logs');
    const m1 = H.mesgs.length;
    useOnHeld(q, 'sacred_oil3', 'magic_logs');
    check('magic logs want four doses: refused', [H.invCount(q, 'magic_logs_pyre'), mesSince(q, m1).some(m => /4 doses/.test(m))], [0, true]);
    H.give(q, 'logs');
    useOnHeld(q, 'sacred_oil3', 'logs');
    check('oil on logs: pyre logs, two doses used, stage created_pyre_logs', [H.invCount(q, 'logs_pyre'), H.invCount(q, 'sacred_oil1'), stage(q)], [1, 1, S.created_pyre_logs]);
    H.give(q, 'sacred_oil4');
    H.give(q, 'oak_logs');
    useOnHeld(q, 'oak_logs', 'sacred_oil4');
    check('logs on the oil works too (oak: two doses)', [H.invCount(q, 'oak_logs_pyre'), H.invCount(q, 'sacred_oil2')], [1, 1]);
    useOnHeld(q, 'sacred_oil1', 'sacred_oil2');
    check('sacred oil decants', H.invCount(q, 'sacred_oil3'), 1);
}

console.log('The funeral pyre');
{
    const w = player('mortwrong', S.created_pyre_logs, PYRE2[0] - 2, PYRE2[1]);
    H.give(w, 'logs_pyre');
    H.give(w, 'shade_bones3');
    H.give(w, 'tinderbox');
    const mw = H.mesgs.length;
    useOnLoc(w, 'logs_pyre', ...PYRE2, 'temple_pyre', false);
    check('wood on another pyre', [!!locAt(...PYRE2, 'temple_pyre_logs'), mesSince(w, mw)], [true, ['You put some logs on the pyre.']]);
    useOnLoc(w, 'shade_bones3', ...PYRE2, 'temple_pyre_logs', false);
    const m0 = H.mesgs.length;
    opLoc(w, ...PYRE2, 'temple_pyre_bones_logs', 1, [], 60);
    check('Riyl remains on plain pyre logs: fails, the pyre is emptied, stage unchanged', [mesSince(w, m0).some(m => /failed to light/.test(m)), !!locAt(...PYRE2, 'temple_pyre'), stage(w)], [true, true, S.logs_on_pyre]);
    H.despawn(w);

    q.teleport(PYRE[0] - 2, PYRE[1], 0);
    H.tick(1);
    const m1 = H.mesgs.length;
    H.give(q, 'logs');
    useOnLoc(q, 'logs', ...PYRE, 'temple_pyre');
    check('plain logs on the pyre: refused', [!!locAt(...PYRE, 'temple_pyre'), stage(q)], [true, S.created_pyre_logs]);
    void m1;
    useOnLoc(q, 'logs_pyre', ...PYRE, 'temple_pyre', false);
    check('pyre logs on the pyre: stage logs_on_pyre, it is your pyre', [!!locAt(...PYRE, 'temple_pyre_logs'), stage(q), H.getVarBit(q, 'pyre_loc')], [true, S.logs_on_pyre, 1]);
    useOnLoc(q, 'shade_bones1', ...PYRE, 'temple_pyre_logs', false);
    check('the remains on the logs', [!!locAt(...PYRE, 'temple_pyre_bones_logs'), H.getVar(q, 'mortton_current_shade')], [true, ObjType.getId('shade_bones1')]);
    const fm = q.stats[11], pr = q.stats[5];
    const e0 = errors.length;
    opLoc(q, ...PYRE, 'temple_pyre_bones_logs', 1, [], 60);
    for (let t = 0; t < 4; t++) H.tick(1);
    check('lit: stage lit_pyre, Firemaking and Prayer xp', [stage(q), q.stats[11] - fm, q.stats[5] - pr], [S.lit_pyre, 500, 250]);
    let reward = false;
    for (let dx = -3; dx <= 4; dx++)
        for (let dz = -3; dz <= 4; dz++)
            for (const o of ['coins', 'shadekey_bronze_bloodred', 'shadekey_bronze_brown', 'shadekey_bronze_crimson'])
                if (World.getObj(PYRE[0] + dx, PYRE[1] + dz, 0, ObjType.getId(o), q.hash64)) reward = true;
    check('  the spirit leaves coins or a key behind, and the pyre is empty again', [reward, !!locAt(...PYRE, 'temple_pyre'), H.getVarBit(q, 'pyre_loc')], [true, true, 0]);
    check('  no script errors', errors.slice(e0), []);
}

console.log('Ulsquire finishes it');
{
    const qp0 = qp(q);
    const cr = q.stats[12], he = q.stats[15];
    H.give(q, 'mort_serum4');
    useOnNpc(q, 'mort_serum4', npcAny(ULS, ...ULSQUIRE));
    for (let t = 0; t < 3; t++) H.tick(1);
    settle(q);
    check('"I\'ve put the Shade\'s spirit to rest!": QUEST COMPLETE', stage(q), S.complete);
    check('  three quest points', qp(q) - qp0, 3);
    check('  2,000 Crafting and 2,000 Herblore xp', [q.stats[12] - cr, q.stats[15] - he], [20000, 20000]);
    q.closeModal();
    const from = H.ifaces.length;
    H.ifButton(q, 'questlist:mortton');
    settle(q);
    check('  the journal says so', textSince(q, from).some(s => /QUEST COMPLETE/.test(s)), true);
    q.closeModal();
    talk(q, ULS, ...ULSQUIRE);
    check('  talking to him again changes nothing', [stage(q), qp(q) - qp0], [S.complete, 3]);
    const t = talk(q, RAZ, ...RAZMIRE, [3]);
    check('Razmire tells you where the Shade lair is', [t.some(s => /entrance to the Shade Lair/.test(s)), bit(q, BIT.lair)], [true, 1]);
}

console.log('The Shade catacombs');
{
    q.teleport(LAIR_DOOR[0], LAIR_DOOR[1] + 1, 0);
    H.tick(1);
    const t0 = opLoc(q, ...LAIR_DOOR, 'shadelairentrancel', 1);
    void t0;
    check('no key: the door stays shut', q.level === 0 && q.z < 9000, true);
    H.give(q, 'shadekey_bronze_bloodred');
    opLoc(q, ...LAIR_DOOR, 'shadelairentrancel', 1);
    check('with a key: down into the catacombs', [q.x, q.z], [X + 37, CZ + 61]);
    const CHEST = [X + 19, CZ + 62] as const;
    q.teleport(CHEST[0] + 1, CHEST[1] - 1, 0);
    H.tick(1);
    const paste = H.invCount(q, 'swamppaste');
    opLoc(q, ...CHEST, 'shadechest_bronze_bloodred', 1);
    check('the bronze chest with its red key: key gone, swamp paste found', [H.invCount(q, 'shadekey_bronze_bloodred'), H.invCount(q, 'swamppaste') - paste >= 5], [0, true]);
}

console.log('The afflicted');
{
    const v = npcAny(['mort_afflicted_man'], X + 20, Z + 20);
    const p = player('mortlocal', S.made_serum, v.x + 1, v.z);
    H.give(p, 'mort_serum3');
    const inv0 = p.getInventory(InvType.INV)!.itemsFiltered.length;
    useOnNpc(p, 'mort_serum3', v);
    check('Serum 207 on an afflicted villager: cured for a while, something for your trouble', [typeName(v), H.invCount(p, 'mort_serum2'), p.getInventory(InvType.INV)!.itemsFiltered.length > inv0 || World.getObj(p.x, p.z, 0, ObjType.getId('coins'), p.hash64) !== null], ['mort_man', 1, true]);
    const t = talk(p, ['mort_man'], v.x, v.z);
    check('  and talks sense', t.some(s => /feel much better/.test(s)), true);
    H.despawn(p);
}

console.log('Mort Myre: a Blamish snail spits');
{
    let snail: Npc | null = null;
    for (const kind of ['mmsnailround_swamp', 'mmsnailpoint_swamp', 'mmsnailround_yellow', 'mmsnailpoint_yellow', 'mmsnailround_blue']) {
        snail = H.npcNear(kind, 3440, 3400);
        if (snail) break;
    }
    if (!snail) {
        check('a snail is placed in Mort Myre', false, true);
    } else {
        const p = player('mortsnail', S.not_started, snail.x + 2, snail.z);
        H.setNpcVar(snail, 'npc_aggressive_player', p.uid);
        H.setNpcMode(snail, 'OPPLAYER2', p);
        const h0 = H.hits.length;
        for (let t = 0; t < 20; t++) H.tick(1);
        check(`the ${typeName(snail)} attacks from range (0-2 a spit)`, H.hits.slice(h0).filter(h => h.who === p.username).every(h => h.damage <= 2) && H.hits.slice(h0).some(h => h.who === p.username), true);
        H.despawn(p);
    }
}

// ============================================================================================
console.log('Migration: saves from this server\'s old version of the quest');
{
    const V = (name: string) => name;
    type Old = { stage: number; multi?: number; repaired?: number; sanctity?: number };
    type Want = { stage: number; multi: number; resources?: number };
    const cases: [string, Old, Want][] = [
        ['fresh (never started)', { stage: 0 }, { stage: 0, multi: 0 }],
        ['old: searched the table only', { stage: 0, multi: 1 << BIT.table }, { stage: 0, multi: 0 }],
        ['old: read the diary', { stage: 5 }, { stage: 5, multi: 0 }],
        ['old: Razmire dosed (permanent lucid bit)', { stage: 15, multi: 1 << BIT.razmire_visible | 1 << BIT.used_on_razmire }, { stage: 15, multi: 1 << BIT.used_on_razmire }],
        ['old: three shades down', { stage: 30, multi: 1 << BIT.razmire_visible | 1 << BIT.used_on_razmire }, { stage: 30, multi: 1 << BIT.used_on_razmire }],
        ['old: Ulsquire dosed', { stage: 47, multi: 0b1111 }, { stage: 47, multi: 0b0101 }],
        ['old: six courses laid', { stage: 55, multi: 0b1111, repaired: 6 }, { stage: 55, multi: 0b0101, resources: 2400 }],
        ['old: walls finished', { stage: 60, multi: 0b1111, repaired: 10 }, { stage: 60, multi: 0b0101, resources: 4000 }],
        ['old: sacred oil', { stage: 65, multi: 0b1111, repaired: 10, sanctity: 100 }, { stage: 65, multi: 0b0101 }],
        ['old: remains on the pyre', { stage: 75, multi: 0b1111, repaired: 10, sanctity: 100 }, { stage: 70, multi: 0b0101 }],
        ['old: complete (80)', { stage: 80, multi: 0b1111, repaired: 10, sanctity: 100 }, { stage: 85, multi: 0b0101 }]
    ];
    let i = 0;
    for (const [what, old, want] of cases) {
        const p = H.makePlayer('mortmig' + i++, 3200 + i, 3200, bucket++);
        H.setVar(p, 'morttonquest', old.stage);
        H.setVar(p, 'morttonmulti', old.multi ?? 0);
        H.setVar(p, 'temple_repaired_p', old.repaired ?? 0);
        H.setVar(p, 'temple_sanctity', old.sanctity ?? 0);
        const qp0 = old.stage >= 80 ? -1 : 0;
        H.tick(2); // logs in: [login,_] -> ~port349_login
        const got = { stage: stage(p), multi: H.getVar(p, 'morttonmulti') & ~(0b11111111111111 << 14), resources: H.getVarBit(p, 'temple_resources') };
        check(`${what}: stage ${old.stage} -> ${want.stage}`, [got.stage, got.multi, got.resources], [want.stage, want.multi, want.resources ?? 0]);
        check('  temp values cleared, migrated flag set', [H.getVar(p, 'temple_repaired_p'), H.getVar(p, 'temple_sanctity'), H.getVarBit(p, 'port349_mortton')], [0, 0, 1]);
        if (old.stage >= 80) {
            const before = qp(p);
            check('  counts in quest points', before >= 3, true);
            // Ulsquire's completion is at the original's 80 only: talking to him cannot pay again
            p.teleport(ULSQUIRE[0] + 1, ULSQUIRE[1], 0);
            H.tick(1);
            H.give(p, 'mort_serum4');
            const he = p.stats[15];
            useOnNpc(p, 'mort_serum4', npcAny(ULS, ...ULSQUIRE));
            check('  and Ulsquire cannot complete it a second time', [stage(p), p.stats[15] - he], [S.complete, 0]);
        }
        void qp0;
        // a second login changes nothing
        const snap = [stage(p), H.getVar(p, 'morttonmulti'), H.getVar(p, 'temple_repaired_p')];
        H.setVar(p, 'temple_repaired_p', 0);
        H.runProc(p, '[proc,port349_login]');
        check('  logging in again changes nothing', [stage(p), H.getVar(p, 'morttonmulti'), H.getVar(p, 'temple_repaired_p')], snap);
        H.despawn(p);
    }
    void V;
}

check('no script errors anywhere', errors, []);
console.log(`MORT'TON  ${R.ok} ok, ${R.bad} FAIL`);
process.exit(R.bad ? 1 : 0);
