// Quest audit, batch 2: every quest fixed in it driven through its real triggers on the real engine.
//   Shadow of the Storm, The Golem (and the Uzer map squares it lost), The Feud, Rat Catchers and
//   Mourning's End Part II - start to finish where the quest allows, with each new landing, door and
//   staircase held to the collision map.
// Usage: npx tsx tools/sim/audit2.ts
import * as H from './harness.js';
import World from '#/engine/World.js';
import Npc from '#/engine/entity/Npc.js';
import Player from '#/engine/entity/Player.js';
import Component from '#/cache/config/Component.js';
import ObjType from '#/cache/config/ObjType.js';
import InvType from '#/cache/config/InvType.js';
import LocType from '#/cache/config/LocType.js';
import NpcType from '#/cache/config/NpcType.js';
import VarBitType from '#/cache/config/VarBitType.js';
import VarPlayerType from '#/cache/config/VarPlayerType.js';
import ScriptState from '#/engine/script/ScriptState.js';
import ScriptProvider from '#/engine/script/ScriptProvider.js';
import ScriptRunner from '#/engine/script/ScriptRunner.js';
import ServerTriggerType from '#/engine/script/ServerTriggerType.js';
import { Interaction } from '#/engine/entity/Interaction.js';
import { findPathToEntity, findPathToLoc, isFlagged } from '#/engine/GameMap.js';
import { CollisionFlag } from '#/engine/routefinder/index.js';

const errors: string[] = [];
const origErr = console.error;
console.error = (...a: unknown[]) => {
    const s = a.map(String).join(' ');
    if (/script error|requires protected/i.test(s)) errors.push(s);
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

// ------------------------------------------------------------------------------------ helpers
const blocked = (l: number, x: number, z: number) => isFlagged(x, z, l, CollisionFlag.WALK_BLOCKED);
const at = (p: Player) => [p.x, p.z, p.level];
const standing = (p: Player) => !blocked(p.level, p.x, p.z);

function v(p: Player, name: string): number {
    if (VarBitType.getByName(name)) return H.getVarBit(p, name);
    return H.getVar(p, name);
}
function set(p: Player, name: string, value: number) {
    if (VarBitType.getByName(name)) H.setVarBit(p, name, value);
    else if (VarPlayerType.getByName(name)) H.setVar(p, name, value);
    else throw new Error('no var ' + name);
}

let bucket = 1;
function player(name: string, x: number, z: number, level = 0) {
    const p = H.makePlayer(name, x, z, bucket++);
    H.tick(1);
    p.teleport(x, z, level);
    H.tick(1);
    H.maxOut(p);
    H.clearInv(p);
    H.tick(3);
    p.closeModal();
    return p;
}

function slotOf(p: Player, objName: string) {
    const id = ObjType.getId(objName);
    const inv = p.getInventory(InvType.INV)!;
    for (let i = 0; i < inv.capacity; i++) if (inv.get(i)?.id === id) return i;
    throw new Error('not carrying ' + objName);
}

/** Wait for whatever the player is doing, clicking through dialogue, taking `picks` at menus. */
function settle(p: Player, picks: number[] = [], max = 300): void {
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
        if (!p.activeScript && !p.target && !p.delayed && p.queue.head() === null) {
            if (++idle >= 3) break;
        } else idle = 0;
    }
    if (picks.length) throw new Error('menus not reached: ' + picks.join(','));
    p.closeModal();
}

function findNpc(name: string, x: number, z: number, level = 0): Npc {
    const n = H.npcNear(name, x, z, level);
    if (!n) throw new Error(`no ${name} near ${x},${z},${level}`);
    return n;
}

/** Walk to an npc from where the player stands and talk (no teleport: the route has to exist). */
function talk(p: Player, npc: Npc, picks: number[] = []) {
    H.opNpc(p, npc, 1);
    settle(p, picks);
}
/** Stand beside the npc (any open side it can be talked to from) and talk. */
function talkNear(p: Player, name: string, x: number, z: number, picks: number[] = [], level = 0) {
    const npc = findNpc(name, x, z, level);
    const sides = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]];
    for (const [dx, dz] of [...sides, ...sides]) {
        if (blocked(level, npc.x + dx, npc.z + dz)) continue;
        p.teleport(npc.x + dx, npc.z + dz, level);
        H.tick(1);
        const f = H.ifaces.length;
        const m = H.mesgs.length;
        H.opNpc(p, npc, 1);
        H.tick(1);
        const spoke = () => p.modalChat !== -1;
        let fired = spoke();
        for (let t = 0; t < 12 && !fired; t++) { H.tick(1); fired = spoke(); }
        if (!fired) { p.clearPendingAction(); continue; }
        try {
            settle(p, picks);
        } catch (e) {
            console.log('   dialogue was:', H.ifaces.slice(f).filter(i => i.who === p.username && i.kind === 'text' && i.text && i.text.length > 1).map(i => i.text).slice(-6), 'inv pole', H.invCount(p, 'vc_rat_pole'));
            throw e;
        }
        return;
    }
    throw new Error(`could not talk to ${name} at ${npc.x},${npc.z}`);
}

function useOnNpc(p: Player, objName: string, npc: Npc, ticks = 0) {
    p.clearPendingAction();
    p.lastUseItem = ObjType.getId(objName);
    p.lastUseSlot = slotOf(p, objName);
    p.queueWaypoints(findPathToEntity(p.level, p.x, p.z, npc.x, npc.z, p.width, npc.width, npc.length));
    p.setInteraction(Interaction.ENGINE, npc, ServerTriggerType.APNPCU);
    (p as unknown as { opcalled: boolean }).opcalled = true;
    if (ticks) H.tick(ticks);
    else settle(p);
}

function locAt(x: number, z: number, level: number, locName: string) {
    const loc = World.getLoc(x, z, level, LocType.getId(locName));
    if (!loc) throw new Error(`no ${locName} at ${x},${z},${level}`);
    return loc;
}

function useOnLoc(p: Player, objName: string, x: number, z: number, locName: string) {
    const loc = locAt(x, z, p.level, locName);
    p.clearPendingAction();
    p.lastUseItem = ObjType.getId(objName);
    p.lastUseSlot = slotOf(p, objName);
    p.queueWaypoints(findPathToLoc(p.level, p.x, p.z, loc.x, loc.z, p.width, loc.width, loc.length, loc.angle, loc.shape, LocType.get(loc.type).forceapproach));
    p.setInteraction(Interaction.ENGINE, loc, ServerTriggerType.APLOCU);
    (p as unknown as { opcalled: boolean }).opcalled = true;
    settle(p);
}

function opLoc(p: Player, x: number, z: number, locName: string, op = 1, picks: number[] = []) {
    H.opLoc(p, x, z, locName, op);
    settle(p, picks);
}

/** OpHeldUHandler's lookup: [opheldu,target], else [opheldu,used] with the two swapped. */
function useOnHeld(p: Player, used: string, target: string) {
    p.lastItem = ObjType.getId(target);
    p.lastSlot = slotOf(p, target);
    p.lastUseItem = ObjType.getId(used);
    p.lastUseSlot = slotOf(p, used);
    let script = ScriptProvider.getByTriggerSpecific(ServerTriggerType.OPHELDU, p.lastItem, -1);
    if (!script) {
        script = ScriptProvider.getByTriggerSpecific(ServerTriggerType.OPHELDU, p.lastUseItem, -1);
        [p.lastItem, p.lastUseItem] = [p.lastUseItem, p.lastItem];
        [p.lastSlot, p.lastUseSlot] = [p.lastUseSlot, p.lastSlot];
    }
    if (!script) throw new Error(`no opheldu for ${used} on ${target}`);
    p.executeScript(ScriptRunner.init(script, p), true);
    settle(p);
}

function held(p: Player, objName: string, op: number, picks: number[] = []) {
    H.opheld(p, objName, op);
    settle(p, picks);
}

/** Put the player on the nearest open tile to (x, z). */
function place(p: Player, x: number, z: number, level = 0) {
    for (let r = 0; r < 6; r++) {
        for (let dx = -r; dx <= r; dx++) for (let dz = -r; dz <= r; dz++) {
            if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
            if (!blocked(level, x + dx, z + dz)) {
                p.teleport(x + dx, z + dz, level);
                H.tick(1);
                return;
            }
        }
    }
    throw new Error(`nowhere open near ${x},${z},${level}`);
}

const errorsSince = (n: number) => errors.slice(n);
const only = process.argv[2];
const run = (name: string) => !only || name.toLowerCase().includes(only.toLowerCase());

// =============================================================================================
if (run('golem')) {
console.log('The Golem - the Uzer locs lost from m54_48, m53_49 and m42_76 are back');
    const locs: [string, number, number, number][] = [
        ['golem_insidestairs_top', 3492, 3090, 0], ['golem_black_mushrooms', 3495, 3088, 0], ['agrith_kiln_1', 3467, 3123, 0],
        ['agrith_kiln_2', 3478, 3082, 0], ['golem_insidestairs_base', 2721, 4884, 0], ['golem_statuettea', 2718, 4899, 0],
        ['golem_statuetted', 2725, 4896, 0], ['golem_portal', 2720, 4912, 0], ['golem_demon_portal', 2719, 4883, 2],
        ['golem_demon_throne', 2719, 4913, 2], ['agrith_wizard_rubble', 2724, 4897, 0]
    ];
    for (const [n, x, z, l] of locs) check(`${n} at ${x},${z},${l}`, World.getLoc(x, z, l, LocType.getId(n)) !== null, true);

    const p = player('golemq', 3491, 3091);
    set(p, 'golem_a', 3); // finished_b: the statuette is back from the museum
    H.give(p, 'golem_statuette');
    const e0 = errors.length;
    place(p, 3491, 3090);
    opLoc(p, 3492, 3090, 'golem_insidestairs_top');
    check('down the temple stairs, onto an open tile', [p.level, standing(p), Math.abs(p.x - 2721) < 3 && Math.abs(p.z - 4886) < 3], [0, true, true]);
    useOnLoc(p, 'golem_statuette', 2725, 4896, 'golem_statuetted');
    check('statuette into the empty alcove: stage statuette_inserted', v(p, 'golem_a'), 4);
    opLoc(p, 2718, 4899, 'golem_statuettea');
    opLoc(p, 2718, 4896, 'golem_statuetteb');
    opLoc(p, 2725, 4896, 'golem_statuetted');
    check('the four statuettes turned: the door opens (doors_open)', v(p, 'golem_a'), 5);
    opLoc(p, 2720, 4912, 'golem_portal');
    check('through the portal: the demon room, open floor, stage entered_portal', [p.level, standing(p), v(p, 'golem_a')], [2, true, 6]);
    opLoc(p, 2719, 4883, 'golem_demon_portal');
    check('back through the demon portal onto an open tile', [p.level, standing(p)], [0, true]);
    opLoc(p, 2721, 4884, 'golem_insidestairs_base');
    check('up the temple stairs onto an open tile', [p.level, standing(p), p.x > 3400], [0, true, true]);
    talkNear(p, 'golem_golem', 3488, 3090);
    check('told the golem the demon is dead: informed_golem', v(p, 'golem_a'), 7);
    H.give(p, 'golem_phoenixfeather');
    H.give(p, 'golem_ink');
    H.give(p, 'papyrus');
    H.give(p, 'golem_golemkey');
    useOnHeld(p, 'golem_ink', 'golem_phoenixfeather');
    useOnHeld(p, 'golem_pen', 'papyrus');
    check('phoenix pen and papyrus: the program', H.invCount(p, 'golem_program'), 1);
    const golem = findNpc('golem_golem', 3488, 3090);
    // the key opens the skull for ten ticks (golem_head_queue), so the program goes straight in
    useOnNpc(p, 'golem_golemkey', golem, 1);
    for (let t = 0; t < 20 && v(p, 'golem_head_open') === 0; t++) H.tick(1);
    check('the key opens the golem skull', v(p, 'golem_head_open'), 1);
    useOnNpc(p, 'golem_program', golem);
    check('program in the skull: The Golem complete', v(p, 'golem_a'), 10);
    check('  no script errors', errorsSince(e0), []);
    H.despawn(p);
}

// =============================================================================================
if (run('agrith')) {
console.log('Shadow of the Storm');
    const p = player('agrithq', 3272, 3158);
    const e0 = errors.length;
    const Q = () => v(p, 'agrith_quest');
    talkNear(p, 'agrith_reen_alkharid', 3271, 3158, [1]);
    check('Father Reen starts it', Q(), 10);
    const dave = World.npcs ? [...World.npcs].find(n => n && n.isActive && NpcType.get(n.type).debugname === 'hundred_evil_dave') : null;
    if (!dave) throw new Error('no Evil Dave');
    talkNear(p, 'hundred_evil_dave', dave.x, dave.z, [], dave.level);
    check('Evil Dave explains: stage uzer, priests at the ruins', [Q(), v(p, 'agrith_reen_uzer'), v(p, 'agrith_badden_uzer')], [30, 1, 1]);
    for (const n of ['agrith_reen_uzer', 'agrith_badden_uzer', 'golem_golem']) {
        const npc = findNpc(n, 3485, 3091);
        check(`${n} stands on an open tile`, !blocked(0, npc.x, npc.z), true);
    }
    H.give(p, 'desert_shirt');
    H.give(p, 'desert_robe');
    H.give(p, 'silverlight');
    H.give(p, 'golem_ink', 3);
    useOnHeld(p, 'golem_ink', 'desert_shirt');
    useOnHeld(p, 'desert_robe', 'golem_ink');
    check('shirt and robe stained: stage black', Q(), 40);
    // stained early - before the sigil. This used to leave the quest waiting at 60 for ever.
    useOnHeld(p, 'golem_ink', 'silverlight');
    check('Silverlight stained before the sigil', H.invCount(p, 'agrith_silverlight_dyed'), 1);
    talkNear(p, 'golem_golem', 3488, 3090);
    check('the golem hands over the sigil mould: stage mould', [Q(), H.invCount(p, 'agrith_sigil_mould')], [50, 1]);
    H.give(p, 'silver_bar');
    place(p, 3467, 3121);
    useOnHeld(p, 'agrith_sigil_mould', 'silver_bar'); // the mould ON the bar: lands on Fenkenstrain's [opheldu,silver_bar]
    check('mould on the bar, beside the kiln: cast (stage sigil)', [Q(), H.invCount(p, 'silver_bar')], [60, 0]);
    check('  the kiln at 3467,3123 is the cache\'s agrith_kiln_1', World.getLoc(3467, 3123, 0, LocType.getId('agrith_kiln_1')) !== null, true);
    opLoc(p, 3467, 3123, 'agrith_kiln_1');
    check('Look-in on the kiln: sigil and the tome, and the early-stained sword counts (stage sword)', [H.invCount(p, 'agrith_sigil'), H.invCount(p, 'agrith_book'), Q()], [1, 1, 70]);
    held(p, 'agrith_sigil', 1, [1, 3, 4, 2, 5]); // Tar Naar Rekt Agrith Secare
    check('the chant in the tome\'s order: Darklight (stage darklight)', [H.invCount(p, 'darklight'), Q()], [1, 120]);
    p.levels[3] = 99;
    talkNear(p, 'agrith_reen_uzer', 3483, 3093);
    check('Father Reen at the ruins: complete', Q(), 125);
    check('  no script errors', errorsSince(e0), []);

    // the mould used the other way round, and the tome from a lost copy
    const q = player('agrithq2', 3466, 3121);
    set(q, 'agrith_quest', 50);
    set(q, 'agrith_convinced_golem', 1);
    H.give(q, 'agrith_sigil_mould');
    H.give(q, 'silver_bar');
    place(q, 3467, 3121);
    useOnHeld(q, 'silver_bar', 'agrith_sigil_mould');
    check('bar on the mould also casts', v(q, 'agrith_quest'), 60);
    set(q, 'agrith_quest', 70);
    talkNear(q, 'golem_golem', 3488, 3090);
    check('a lost tome: the golem has another', H.invCount(q, 'agrith_book'), 1);
    H.despawn(p, q);
}

// =============================================================================================
if (run('feud')) {
console.log('The Feud');
    const p = player('feudq', 3305, 3211);
    const e0 = errors.length;
    const Q = () => v(p, 'feud_var');
    talkNear(p, 'feud_ali_m', 3304, 3211, [1]);
    check('Ali Morrisane sends the player south; both leaders now visible', [Q(), v(p, 'feud_boss_vis'), v(p, 'feud_bandit_boss_vis')], [5, 1, 1]);
    talkNear(p, 'feud_egyptian_doorman_multi', 3333, 2952);
    talkNear(p, 'feud_menap_boss', 3334, 2956);
    talkNear(p, 'feud_bandit_boss', 3353, 3002);
    check('both gang leaders spoken to: stage both_gangs', Q(), 10);
    talkNear(p, 'feud_mayor', 3360, 2970);
    talkNear(p, 'feud_mayor', 3360, 2970);
    talkNear(p, 'feud_mayor', 3360, 2970, [2]); // Eight
    check('the Mayor: notes, then the safe (eight): stage safe, keys', [Q(), H.invCount(p, 'feud_mayors_house_keys')], [25, 1]);
    place(p, 3369, 2970);
    opLoc(p, 3370, 2970, 'feud_closed_door_right');
    check('the keys open the Mayor\'s door and the player goes through it (stage blackjack)', [Q(), p.x, standing(p)], [28, 3371, true]);
    opLoc(p, 3370, 2970, 'feud_closed_door_right');
    check('  and back out again', p.x, 3370);
    H.give(p, 'coins', 100);
    talkNear(p, 'feud_black_jack_seller_multi', 3351, 2971, [2]);
    check('a blackjack from the seller', H.invCount(p, 'blackjack_oak'), 1);
    const vill = findNpc('feud_villager_multi_1', 3355, 2949);
    for (let i = 0; i < 40 && Q() === 28; i++) {
        p.levels[3] = 99;
        p.teleport(vill.x + 1, vill.z, 0);
        H.tick(1);
        useOnNpc(p, 'blackjack_oak', vill);
    }
    check('blackjacked a villager: turban and beard (stage traits)', [Q(), H.invCount(p, 'feud_karidian_turban'), H.invCount(p, 'feud_karidian_fakebeard')], [32, 1, 1]);
    useOnHeld(p, 'feud_karidian_fakebeard', 'feud_karidian_turban');
    check('beard on headpiece: a wearable desert disguise (stage disguise)', [Q(), H.invCount(p, 'feud_desert_disguise'), ObjType.get(ObjType.getId('feud_desert_disguise')).wearpos], [36, 1, 0]);
    H.clearInv(p);
    H.equip(p, { hat: 'feud_desert_disguise', rhand: 'rune_scimitar' });
    talkNear(p, 'feud_arabian_guard_multi', 3354, 3000);
    check('the camp guard lets the disguised player in: stage camp', Q(), 40);
    talkNear(p, 'feud_bandit_boss', 3353, 3002);
    const champ = findNpc('feud_bandit_toughguy', p.x, p.z);
    check('the Bandit champion steps up, with real hitpoints', NpcType.get(champ.type).stats[3], 50);
    let died = false;
    H.attackNpc(p, champ);
    for (let t = 0; t < 400; t++) {
        H.tick(1);
        if (!champ.isActive) { died = true; break; }
        if (p.levels[3] < 40) p.levels[3] = 99;
        if (!p.target && !p.delayed && t % 6 === 5) H.attackNpc(p, champ);
    }
    settle(p);
    check('champion killed: the jewels, stage jewels (queued, not written from the npc)', [died, H.invCount(p, 'feud_mayors_jewels'), Q()], [true, 1, 45]);
    talkNear(p, 'feud_ali_m', 3304, 3211);
    check('Ali Morrisane: The Feud complete', Q(), 50);
    check('  no script errors (and no protected-access errors)', errorsSince(e0), []);

    // Pollnivneach's stairs and ladders, walked: up from the ground, then back down from the landing
    const w = player('feudwalk', 3353, 2957);
    const hops: [string, string, number, number, number, number, number][] = [
        ['feud_outsidestairs_base', 'feud_outsidestairs_top', 3353, 2958, 0, 3353, 2961],
        ['feud_insidestairs_base', 'feud_insidestairs_top', 3373, 2978, 0, 3371, 2970], // walked from inside the Mayor's door
        ['feud_ladder', 'feud_laddertop_norim', 3350, 2963, 0, 3349, 2963],
        ['feud_ladder', 'feud_laddertop_norim', 3364, 3003, 0, 3364, 3002],
        ['feud_ladder', 'feud_laddertop_norim', 3369, 2991, 0, 3368, 2991],
        ['feud_ladder', 'feud_laddertop_norim', 3356, 2981, 1, 3356, 2982]
    ];
    for (const [up, down, x, z, l, sx, sz] of hops) {
        place(w, sx, sz, l);
        opLoc(w, x, z, up);
        const went = [w.level, standing(w)];
        if (w.level === l + 1) opLoc(w, x, z, down);
        check(`${up} at ${x},${z},${l}: up onto an open tile, and back down`, [went, [w.level, standing(w)]], [[l + 1, true], [l, true]]);
    }
    H.despawn(p, w);
}

// =============================================================================================
if (run('ratcatch')) {
console.log('Rat Catchers');
    const p = player('ratq', 2563, 3320);
    const e0 = errors.length;
    const Q = () => v(p, 'ratcatch_var');
    talkNear(p, 'vc_jimmy_dazzler', 2562, 3320, [1]);
    check('Jimmy Dazzler hires the player', [Q(), H.invCount(p, 'vc_rat_pole')], [10, 1]);
    talkNear(p, 'gertrude', 3151, 3410);
    check('Gertrude: weed pot and music (stage equipped)', [Q(), H.invCount(p, 'ratcatchers_weedpot')], [20, 1]);
    H.give(p, 'tinderbox');
    useOnHeld(p, 'tinderbox', 'ratcatchers_weedpot');
    place(p, 3268, 3378);
    opLoc(p, 3268, 3379, 'vc_ladder');
    check('up the ladder in the rat house (it had no trigger)', [p.level, standing(p)], [1, true]);
    for (const [n, x, z] of [['ratcatchers_rathole1', 3264, 3378], ['ratcatchers_rathole2', 3273, 3377], ['ratcatchers_rathole3', 3274, 3381], ['ratcatchers_rathole4', 3271, 3384]] as [string, number, number][]) {
        const m0 = H.mesgs.length;
        useOnLoc(p, 'ratcatchers_smokey_weedpot', x, z, n);
        if (process.env.A2DEBUG) console.log('   ', n, at(p), H.mesgs.slice(m0).filter(m => m.who === p.username).map(m => m.text));
    }
    check('four holes smoked out on foot from the ladder: stage trained', Q(), 30);
    opLoc(p, 3268, 3379, 'vc_laddertop');
    check('  and back down', [p.level, standing(p)], [0, true]);
    talkNear(p, 'vc_jimmy_dazzler', 2562, 3320, [1]);
    check('Jimmy takes the player to the party, inside the gates', [p.level, standing(p), p.x - 2816, p.z - 5056], [0, true, 31, 10]);
    // the rats, walked to - trellis up, rats 3 and 2, the doors to rat 1, ladder down, 5 and 6, the door to 4
    const rats: Record<number, [number, number, number]> = { 1: [2832, 5098, 1], 2: [2861, 5093, 1], 3: [2858, 5087, 1], 4: [2863, 5101, 0], 5: [2857, 5091, 0], 6: [2863, 5086, 0] };
    const pole = (i: number) => {
        const [x, z, l] = rats[i];
        const npc = findNpc(`vc_partyrat_multi${i}`, x, z, l);
        for (let t = 0; t < 40 && v(p, `vc_raton_off${i}`) === 0; t++) {
            const polename = ['vc_rat_pole', 'vc_rat_pole_1', 'vc_rat_pole_2', 'vc_rat_pole_3', 'vc_rat_pole_4', 'vc_rat_pole_5'].find(n => H.invCount(p, n) > 0)!;
            useOnNpc(p, polename, npc);
        }
        return v(p, `vc_raton_off${i}`);
    };
    opLoc(p, 2844, 5105, 'vc_trellis_base');
    check('up the trellis onto the upper floor', [p.level, standing(p)], [1, true]);
    check('rat 3 poled (walked to)', pole(3), 1);
    check('rat 2 poled', pole(2), 1);
    opLoc(p, 2838, 5099, 'vc_elfdoor');
    check('through the upstairs west door', standing(p), true);
    check('rat 1 poled', pole(1), 1);
    opLoc(p, 2838, 5099, 'vc_elfdoor');
    opLoc(p, 2862, 5092, 'laddertop');
    check('down the mansion ladder', [p.level, standing(p)], [0, true]);
    check('rat 5 poled', pole(5), 1);
    check('rat 6 poled', pole(6), 1);
    opLoc(p, 2860, 5093, 'vc_elfdoor');
    check('rat 4 poled (through the east door)', pole(4), 1);
    check('six on the pole: stage poled', [Q(), H.invCount(p, 'vc_rat_pole_6')], [50, 1]);
    held(p, 'vc_rat_pole_6', 1);
    check('Remove-rat puts one back at the party (and the stage back to party)', [H.invCount(p, 'vc_rat_pole_5'), Q(), [1, 2, 3, 4, 5, 6].filter(i => v(p, `vc_raton_off${i}`) === 0).length], [1, 40, 1]);
    const back = [1, 2, 3, 4, 5, 6].find(i => v(p, `vc_raton_off${i}`) === 0)!;
    const [bx, bz, bl] = rats[back];
    place(p, bx + 1, bz, bl);
    check('  and it can be caught again', pole(back), 1);
    place(p, 2847, 5065);
    opLoc(p, 2847, 5064, 'vc_ornaterailing');
    check('out of the front gate, back to Ardougne', [p.level, standing(p), Math.abs(p.x - 2562) < 4 && Math.abs(p.z - 3320) < 4], [0, true, true]);
    talkNear(p, 'vc_jimmy_dazzler', 2562, 3320);
    check('Jimmy counts six: Rat Catchers complete', Q(), 60);
    check('  no script errors', errorsSince(e0), []);
    H.despawn(p);
}

// =============================================================================================
if (run('mourning2')) {
console.log('Mourning\'s End Part II');
    const B = [1856, 4608];
    const T = (x: number, z: number) => [B[0] + x, B[1] + z] as const;
    const p = player('mtq', 2311, 9794);
    const e0 = errors.length;
    const Q = () => v(p, 'mourning_quest_main');
    set(p, 'mourning_quest', 20);
    const ari = [...World.npcs].find(n => n && n.isActive && NpcType.get(n.type).debugname === 'mourning_arianwyn');
    if (!ari) throw new Error('no Arianwyn');
    talkNear(p, 'mourning_arianwyn', ari.x, ari.z, [], ari.level);
    check('Arianwyn starts it, and the tunnel into the temple opens', [Q(), v(p, 'mourning_light_door_1_c_first_time')], [10, 1]);
    check('  the tunnel bit is saved (its varp is scope=perm now)', VarPlayerType.get(VarPlayerType.getId('mourning_part2_basevar2')).scope, 1);
    place(p, 2311, 9793);
    opLoc(p, 2311, 9792, 'cavewalltunnel_to_temple');
    check('through the tunnel: pillar 13\'s chamber, on an open tile (not the pillar), stage inside', [p.x, p.z, p.level, standing(p), Q()], [...T(5, 5), 0, true, 20]);
    opLoc(p, ...T(2, 5), 'mourning_temple_light_parts_4_closed');
    check('the cupboard opens (the loc swaps)', World.getLoc(...T(2, 5), 0, LocType.getId('mourning_temple_light_parts_4_open')) !== null, true);
    opLoc(p, ...T(2, 5), 'mourning_temple_light_parts_4_open');
    check('and it can be searched: the hand mirror', [H.invCount(p, 'mourning_mirror'), Q()], [1, 30]);
    opLoc(p, ...T(7, 5), 'mourning_door_1_13_east');
    check('through the door of light out of the chamber', [p.x - B[0], standing(p)], [8, true]);
    opLoc(p, ...T(46, 30), 'mourning_temple_circle_stairs_base');
    check('up the circle stairs to floor 2', [p.level, standing(p)], [1, true]);
    opLoc(p, ...T(37, 12), 'mourning_temple_stairs_base');
    check('up the stairs to floor 3', [p.level, standing(p)], [2, true]);
    const mirror = (x: number, z: number, n: string, times: number) => {
        for (let i = 0; i < times; i++) useOnLoc(p, 'mourning_mirror', ...T(x, z), n);
    };
    mirror(59, 5, 'mourning_temple_pillar_3_16', 1); // rotation 0: south -> west
    opLoc(p, ...T(42, 5), 'mourning_temple_pillar_3_15'); // Search, holding the mirror: place it (rotation 0)
    opLoc(p, ...T(42, 5), 'mourning_temple_pillar_3_15'); // and a quarter turn: rotation 1, west -> north
    mirror(42, 20, 'mourning_temple_pillar_3_11', 4); // rotation 3: north -> west, and on to the shaft
    check('three mirrors send the light down the shaft and out of the west wall: stage lit', Q(), 40);
    check('  the lit path is drawn (3_16_north, 3_15_16, 3_11_15, 3_10_11, 3_10_west, 1_b_west)', ['mourning_light_temple_3_15_16', 'mourning_light_temple_3_11_15', 'mourning_light_temple_3_10_11', 'mourning_light_temple_3_10_west', 'mourning_light_temple_1_b_west'].map(n => v(p, n)), [1, 1, 1, 1, 1]);
    // every staircase and ladder in the temple: down from the top, then straight back up from where
    // that put the player (so each landing is on the side its partner is climbed from)
    const pairs: [string, string, number, number, number, number, number][] = [
        // [top, base, top x, top z, top level, base x, base z]
        ['mourning_temple_stairs_top', 'mourning_temple_stairs_base', 37, 12, 2, 37, 12],
        ['mourning_temple_stairs_top', 'mourning_temple_stairs_base', 37, 50, 2, 37, 50],
        ['mourning_temple_circle_stairs_top', 'mourning_temple_circle_stairs_base', 34, 27, 2, 34, 27],
        ['mourning_temple_circle_stairs_top', 'mourning_temple_circle_stairs_base', 34, 33, 2, 34, 33],
        ['mourning_temple_circle_stairs_top', 'mourning_temple_circle_stairs_base', 46, 30, 1, 46, 30],
        ['mourning_temple_circle_stairs_top', 'mourning_temple_circle_stairs_base', 31, 30, 1, 31, 30],
        ['mourning_temple_ladder_wall_top', 'mourning_temple_ladder_wall', 42, 2, 2, 42, 2],
        ['mourning_temple_ladder_wall_top', 'mourning_temple_ladder_wall', 42, 59, 2, 42, 60],
        ['mourning_temple_way_down', 'mourning_temple_way_ropemulti', 20, 12, 1, 21, 12]
    ];
    for (const [top, base, tx, tz, tl, bx, bz] of pairs) {
        const [X, Z] = T(tx, tz);
        const loc = locAt(X, Z, tl, top);
        const t = LocType.get(loc.type);
        let tried = 0, down: number[] = [], up: number[] = [];
        // any open tile beside the top that it can actually be used from
        for (let dx = -1; dx <= Math.max(t.width, t.length) && !down.length; dx++) for (let dz = -1; dz <= Math.max(t.width, t.length) && !down.length; dz++) {
            if (blocked(tl, X + dx, Z + dz)) continue;
            p.teleport(X + dx, Z + dz, tl);
            H.tick(1);
            tried++;
            opLoc(p, X, Z, top);
            if (p.level !== tl) down = [p.level, standing(p) ? 1 : 0];
        }
        if (down.length) {
            const [BX, BZ] = T(bx, bz);
            opLoc(p, BX, BZ, base);
            up = [p.level, standing(p) ? 1 : 0];
        }
        check(`${top} at ${tx},${tz},${tl}: down onto an open tile, and ${base} straight back up from there`, [down, up], [[tl - 1, 1], [tl, 1]]);
    }
    // the doors of light, both ways
    for (const [n, x, z, l] of [['mourning_door_1_13_north', 4, 8, 0], ['mourning_door_1_c', 9, 31, 0], ['mourning_door_1_b', 29, 31, 0], ['mourning_door_2_16_west', 56, 5, 1], ['mourning_door_1_1_east', 7, 57, 0]] as [string, number, number, number][]) {
        const [X, Z] = T(x, z);
        const loc = locAt(X, Z, l, n);
        const side = loc.angle % 2 === 0 ? [X, Z - 1] : [X - 1, Z];
        p.teleport(side[0], side[1], l);
        H.tick(1);
        opLoc(p, X, Z, n);
        const a = [p.x, p.z];
        opLoc(p, X, Z, n);
        check(`${n}: through and back, open tiles`, [a[0] !== side[0] || a[1] !== side[1], p.x === side[0] && p.z === side[1], standing(p)], [true, true, true]);
    }
    // the reset lever puts the mirrors back
    place(p, ...T(56, 31), 1);
    opLoc(p, ...T(57, 31), 'mourning_temple_light_wall_lever');
    check('the lever drops every mirror (the stage stays lit)', [v(p, 'mourning_temple_mirrors_a'), Q()], [0, 40]);
    place(p, ...T(1, 31), 0);
    opLoc(p, ...T(0, 30), 'mourning_temple_light_wall_with_hole');
    check('out through the hole in the west wall, back at the tunnel', [p.x, p.z, p.level, standing(p)], [2311, 9793, 0, true]);
    talkNear(p, 'mourning_arianwyn', ari.x, ari.z, [], ari.level);
    check('Arianwyn: Mourning\'s End Part II complete', Q(), 50);
    check('  no script errors', errorsSince(e0), []);
    H.despawn(p);
}

// =============================================================================================
if (run('dwarfrock')) {
console.log('Between a Rock... (not changed - checked start to finish)');
    const p = player('rockq', 2825, 10168);
    const e0 = errors.length;
    const Q = () => v(p, 'dwarfrock_quest');
    talkNear(p, 'dwarfrock_multi_dondakan', 2824, 10168, [1]);
    talkNear(p, 'dwarfrock_multi_dondakan', 2824, 10168);
    check('Dondakan: asked, then looking', Q(), 20);
    talkNear(p, 'dwarfrock_rolad', 3022, 3452);
    talkNear(p, 'dwarfrock_rolad', 3022, 3452);
    check('Rolad: the carts (stage searching)', Q(), 40);
    place(p, 3016, 9845);
    for (let i = 0; i < 4; i++) opLoc(p, 3017, 9845, 'dwarfrock_book_cart');
    check('four searches of the book cart: base and three overlays (stage overlays)', [Q(), H.invCount(p, 'dwarf_rock_base_schematic')], [50, 1]);
    held(p, 'dwarf_rock_schematic1', 1);
    check('assembled (stage assembled)', [Q(), H.invCount(p, 'dwarf_rock_schematic_assembled')], [60, 1]);
    talkNear(p, 'dwarfrock_multi_dondakan', 2824, 10168);
    check('Dondakan reads it (stage engineers)', Q(), 70);
    talkNear(p, 'dwarfrock_engineer1', 2871, 10198);
    talkNear(p, 'dwarfrock_engineer2', 2864, 9876);
    check('both engineers: the gold helmet (stage cannonball)', [Q(), H.invCount(p, 'dwarf_goldrock_helmet')], [80, 1]);
    H.clearInv(p);
    H.equip(p, { hat: 'dwarf_goldrock_helmet' });
    talkNear(p, 'dwarfrock_multi_dondakan', 2824, 10168);
    talkNear(p, 'dwarfrock_multi_dondakan', 2824, 10168);
    check('fired into the rock and back to Dondakan: complete', Q(), 110);
    check('  no script errors', errorsSince(e0), []);
    H.despawn(p);
}

console.log(`\n${R.ok} ok, ${R.bad} FAIL`);
process.exit(R.bad ? 1 : 0);
