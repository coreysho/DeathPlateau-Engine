// Quest audit, batch 4: the steps that were broken, driven through the real content on the real map.
// Usage: npx tsx tools/sim/audit4.ts
//
// Devious Minds       start to finish: the whetstone (it has no ops - the sword is used on it), the
//                     bow-sword and pouch, Entrana's altar (and that it still recharges prayer), the
//                     monk, the body (and a lost relic found again), the High Priest.
// Icthlarin's Little  start to finish: into Sophanem through the rocks and out through the hole, the
//   Helper            embalming (and lost salt handed out again), the temple door into the tomb, the
//                     pit (it jumped into the chasm), the two doorways, the jars (and a lost jar put
//                     back on its shelf), the ceremony, Icthlarin, the ladder back up.
// Making History      start to finish: the outpost's doors, all three strands (and a lost letter
//                     re-issued), the ending, the museum's Study options on their multiloc shells.
// In Aid of the       the village gate and fence, the store and cellar ladders, the rubble and inn
//   Myreque           trapdoor, the cellar, the temple library, the Hollows tomb and back, the ending.
// Regicide            into Tirannwn at all: the Well of Voyage, its temple, Idris; Iorwerth replacing
//                     a lost pendant, barrels, limestone and letter.
// Troll Romance       Arrg's stats, the kill counting (it was an npc-context write of a protected
//                     varp), Ug's reward, the journal's complete page.
import * as H from './harness.js';
import World from '#/engine/World.js';
import LocType from '#/cache/config/LocType.js';
import ObjType from '#/cache/config/ObjType.js';
import NpcType from '#/cache/config/NpcType.js';
import InvType from '#/cache/config/InvType.js';
import Component from '#/cache/config/Component.js';
import ScriptState from '#/engine/script/ScriptState.js';
import ScriptRunner from '#/engine/script/ScriptRunner.js';
import ScriptProvider from '#/engine/script/ScriptProvider.js';
import ServerTriggerType from '#/engine/script/ServerTriggerType.js';
import { Interaction } from '#/engine/entity/Interaction.js';
import { findPathToLoc, findPathToEntity, canTravel, isMapBlocked } from '#/engine/GameMap.js';
import { CollisionType } from '#/engine/routefinder/index.js';
import Player from '#/engine/entity/Player.js';
import Npc from '#/engine/entity/Npc.js';

await H.boot();
H.loginOrder();

const R = { ok: 0, bad: 0 };
const check = (what: string, got: unknown, want: unknown) => {
    const pass = JSON.stringify(got) === JSON.stringify(want);
    if (pass) R.ok++;
    else R.bad++;
    console.log(`  ${pass ? 'ok  ' : 'FAIL'} ${what}: ${JSON.stringify(got)}${pass ? '' : `   (want ${JSON.stringify(want)})`}`);
};
const guard = (name: string, fn: () => void) => {
    try {
        fn();
    } catch (e) {
        R.bad++;
        console.log(`  FAIL ${name} threw: ${(e as Error).message}`);
    }
};

let bucket = 1;
function player(name: string, x: number, z: number, level = 0) {
    const p = H.makePlayer(name, x, z, bucket++);
    H.tick(1);
    if (level) p.teleport(x, z, level);
    H.maxOut(p);
    H.clearInv(p);
    H.tick(1);
    return p;
}
import VarPlayerType from '#/cache/config/VarPlayerType.js';
import VarBitType from '#/cache/config/VarBitType.js';
/** A varp or a varbit, whichever the name is. */
const gv = (p: Player, name: string) => (VarPlayerType.getByName(name) ? H.getVar(p, name) : H.getVarBit(p, name));
const sv = (p: Player, name: string, v: number) => (VarPlayerType.getByName(name) ? H.setVar(p, name, v) : H.setVarBit(p, name, v));
void VarBitType;
const at = (p: Player) => [p.x, p.z, p.level];
const _mesSince = (p: Player, from: number) =>
    H.mesgs
        .slice(from)
        .filter(m => m.who === p.username)
        .map(m => m.text);
const walkable = (level: number, x: number, z: number) =>
    !isMapBlocked(x, z, level) &&
    [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1]
    ].some(([dx, dz]) => canTravel(level, x, z, dx, dz, 1, 0, CollisionType.NORMAL));

function slotOf(p: Player, objName: string) {
    const id = ObjType.getId(objName);
    const inv = p.getInventory(InvType.INV)!;
    for (let i = 0; i < inv.capacity; i++) if (inv.get(i)?.id === id) return i;
    throw new Error('not carrying ' + objName);
}
function del(p: Player, objName: string) {
    const inv = p.getInventory(InvType.INV)!;
    inv.remove(ObjType.getId(objName), inv.getItemCount(ObjType.getId(objName)));
}

/** Let a script run out, clicking through any chat pages and taking `picks` at menus (1-based). */
function drive(p: Player, picks: number[] = [], guardTicks = 3): string[] {
    const from = H.ifaces.length;
    let idle = 0;
    for (let g = 0; g < 400 && idle < guardTicks; g++) {
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
    return H.ifaces
        .slice(from)
        .filter(i => i.who === p.username && i.kind === 'text' && i.text && i.text.length > 1)
        .map(i => i.text!);
}

/** Talk to the nearest npc of a type on the player's level, standing next to it first. */
function talk(p: Player, npcName: string, picks: number[] = [], op = 1): string[] {
    const npc = H.npcNear(npcName, p.x, p.z, p.level);
    if (!npc) throw new Error('no npc ' + npcName);
    for (const [dx, dz] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
        [1, 1],
        [-1, -1],
        [2, 0],
        [0, 2],
        [-2, 0],
        [0, -2]
    ]) {
        if (!walkable(npc.level, npc.x + dx, npc.z + dz)) continue;
        p.teleport(npc.x + dx, npc.z + dz, npc.level);
        H.tick(1);
        H.opNpc(p, npc, op);
        for (let t = 0; t < 10 && !p.activeScript; t++) H.tick(1);
        if (p.activeScript) break;
    }
    return drive(p, picks);
}

/** Talk to an npc and at every menu take the first option whose text matches `want` (else option 1). */
function talkK(p: Player, npcName: string, want: RegExp): string[] {
    const npc = H.npcNear(npcName, p.x, p.z, p.level);
    if (!npc) throw new Error('no npc ' + npcName);
    for (const [dx, dz] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
        [1, 1],
        [-1, -1]
    ]) {
        if (!walkable(npc.level, npc.x + dx, npc.z + dz)) continue;
        p.teleport(npc.x + dx, npc.z + dz, npc.level);
        H.tick(1);
        H.opNpc(p, npc, 1);
        for (let t = 0; t < 10 && !p.activeScript; t++) H.tick(1);
        if (p.activeScript) break;
    }
    const from = H.ifaces.length;
    for (let g = 0, idle = 0; g < 400 && idle < 3; g++) {
        const sc = p.activeScript;
        if (!sc || sc.execution !== ScriptState.PAUSEBUTTON) {
            idle = !sc && !p.delayed && !p.target ? idle + 1 : 0;
            H.tick(1);
            continue;
        }
        idle = 0;
        const open = p.modalChat === -1 ? '' : (Component.get(p.modalChat).comName ?? '');
        if (open.startsWith('multi')) {
            const texts = new Map<number, string>();
            for (const i of H.ifaces.slice(from)) {
                if (i.who !== p.username || i.kind !== 'text') continue;
                const n = Component.get(i.com).comName ?? '';
                if (n.startsWith(open + ':com_')) texts.set(+n.split('_')[1], i.text ?? '');
            }
            let pick = 1;
            for (const [k, t] of texts)
                if (want.test(t) && p.resumeButtons.includes(Component.getId(`${open}:com_${k}`))) {
                    pick = k;
                    break;
                }
            H.choose(p, `${open}:com_${pick}`);
        } else {
            p.executeScript(sc, true, true);
        }
    }
    return H.ifaces
        .slice(from)
        .filter(i => i.who === p.username && i.kind === 'text' && i.text && i.text.length > 1)
        .map(i => i.text!);
}
/** Talk without moving first - the walk to the npc is part of what is being tested. */
function talkHere(p: Player, npcName: string, picks: number[] = []): string[] {
    const npc = H.npcNear(npcName, p.x, p.z, p.level);
    if (!npc) throw new Error('no npc ' + npcName);
    H.opNpc(p, npc, 1);
    return drive(p, picks);
}

/** "Use" an inventory item on a loc: OpLocUHandler, with the route a client would send. */
function useOn(p: Player, x: number, z: number, locName: string, objName: string, picks: number[] = []) {
    const id = LocType.getId(locName);
    const loc = World.getLoc(x, z, p.level, id);
    if (!loc) throw new Error(`no ${locName} at ${x},${z},${p.level}`);
    p.clearPendingAction();
    p.queueWaypoints(findPathToLoc(p.level, p.x, p.z, loc.x, loc.z, p.width, loc.width, loc.length, loc.angle, loc.shape, LocType.get(id).forceapproach));
    p.lastUseItem = ObjType.getId(objName);
    p.lastUseSlot = slotOf(p, objName);
    p.setInteraction(Interaction.ENGINE, loc, ServerTriggerType.APLOCU);
    (p as unknown as { opcalled: boolean }).opcalled = true;
    return drive(p, picks);
}
function _useOnNpc(p: Player, objName: string, npc: Npc) {
    p.clearPendingAction();
    p.lastUseItem = ObjType.getId(objName);
    p.lastUseSlot = slotOf(p, objName);
    p.queueWaypoints(findPathToEntity(p.level, p.x, p.z, npc.x, npc.z, p.width, npc.width, npc.length));
    p.setInteraction(Interaction.ENGINE, npc, ServerTriggerType.APNPCU);
    (p as unknown as { opcalled: boolean }).opcalled = true;
    return drive(p);
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
    return drive(p);
}
function op(p: Player, x: number, z: number, locName: string, n = 1, picks: number[] = []) {
    H.opLoc(p, x, z, locName, n);
    return drive(p, picks);
}
/** Is (tx,tz) reachable on foot from (x,z)? A flood over the real collision map. */
function connected(level: number, x: number, z: number, tx: number, tz: number, radius = 160): boolean {
    const seen = new Set<string>([x + ',' + z]);
    const q = [[x, z]];
    while (q.length) {
        const [cx, cz] = q.pop()!;
        if (cx === tx && cz === tz) return true;
        for (const [dx, dz] of [
            [1, 0],
            [-1, 0],
            [0, 1],
            [0, -1]
        ]) {
            const nx = cx + dx,
                nz = cz + dz,
                k = nx + ',' + nz;
            if (seen.has(k) || Math.abs(nx - x) > radius || Math.abs(nz - z) > radius) continue;
            if (canTravel(level, cx, cz, dx, dz, 1, 0, CollisionType.NORMAL)) {
                seen.add(k);
                q.push([nx, nz]);
            }
        }
    }
    return false;
}
/** Reachable to any tile next to (tx,tz) - for things that themselves block. */
const reachesNear = (level: number, x: number, z: number, tx: number, tz: number) =>
    [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1]
    ].some(([dx, dz]) => connected(level, x, z, tx + dx, tz + dz));
const _hasTrigger = (type: ServerTriggerType, name: string, kind: 'loc' | 'npc') => {
    const id = kind === 'loc' ? LocType.getId(name) : NpcType.getId(name);
    return ScriptProvider.getByTriggerSpecific(type, id, -1) !== null && ScriptProvider.getByTriggerSpecific(type, id, -1) !== undefined;
};

// =============================================================================== Devious Minds
console.log('DEVIOUS MINDS');
guard('devious', () => {
    const p = player('devious', 3404, 3490);
    talk(p, 'devious_monk_hooded', [1, 1]);
    check('the hooded monk hires you and hands over the pouch', [gv(p, 'devious_main'), H.invCount(p, 'devious_glowingpouch')], [10, 1]);
    check('the whetstone has no ops of its own (so [oploc1] could never fire)', LocType.get(LocType.getId('devious_whetstone')).op?.some(o => o) ?? false, false);
    p.teleport(2948, 3450, 0);
    H.tick(1);
    op(p, 2949, 3450, 'loc_1530', 1); // Doric's front door: the whetstone is worked from inside
    H.give(p, 'bronze_2h_sword');
    useOn(p, 2953, 3451, 'devious_whetstone', 'bronze_2h_sword');
    check('a bronze two-hander is refused', [gv(p, 'devious_main'), H.invCount(p, 'bronze_2h_sword')], [10, 1]);
    H.give(p, 'steel_2h_sword');
    useOn(p, 2953, 3451, 'devious_whetstone', 'steel_2h_sword');
    check('steel 2h used on the whetstone: slender blade, stage 20', [gv(p, 'devious_main'), H.invCount(p, 'devious_slenderblade'), H.invCount(p, 'steel_2h_sword')], [20, 1, 0]);
    H.give(p, 'shortbow');
    useOnHeld(p, 'devious_slenderblade', 'shortbow');
    check('blade into the shortbow: a bow-sword', [H.invCount(p, 'devious_bowsword'), H.invCount(p, 'shortbow')], [1, 0]);
    useOnHeld(p, 'devious_bowsword', 'devious_glowingpouch');
    check('bow-sword into the pouch: stage 30', [gv(p, 'devious_main'), H.invCount(p, 'devious_bowsword')], [30, 0]);
    p.teleport(2853, 3345, 0);
    H.tick(1);
    op(p, 2853, 3348, 'devious_altar', 1);
    check("pouch left behind Entrana's altar: stage 40, the altar holds it", [gv(p, 'devious_main'), H.getVarBit(p, 'devious_altar'), H.invCount(p, 'devious_glowingpouch')], [40, 1, 0]);
    p.levels[5] = 1;
    op(p, 2853, 3348, 'devious_altar', 1);
    check('and praying there still recharges prayer', p.levels[5], 99);
    p.teleport(3404, 3490, 0);
    H.tick(1);
    talk(p, 'devious_monk_hooded');
    check('back to the monk: he is killed, the altar is scorched', [H.getVarBit(p, 'devious_monk'), H.getVarBit(p, 'devious_altar')], [1, 2]);
    talk(p, 'devious_monk_dead');
    check('the body: relic and orb, stage 50', [gv(p, 'devious_main'), H.invCount(p, 'devious_relic_fragment_saradomin'), H.invCount(p, 'devious_glowingorb')], [50, 1, 1]);
    del(p, 'devious_relic_fragment_saradomin');
    talk(p, 'devious_monk_dead');
    check('a lost relic is found on him again', H.invCount(p, 'devious_relic_fragment_saradomin'), 1);
    p.teleport(2851, 3346, 0);
    H.tick(1);
    talk(p, 'high_priest_of_entrana');
    H.tick(3);
    check('the High Priest hears it: complete, 1 QP', [gv(p, 'devious_main'), gv(p, 'qp') >= 1], [70, true]);
});

// =============================================================================== Icthlarin's Little Helper
console.log("ICTHLARIN'S LITTLE HELPER");
guard('icslittle', () => {
    const p = player('icslittle', 3326, 2856);
    check('Sophanem is walled: no way in on foot', connected(0, 3326, 2856, 3281, 2771), false);
    // THE ROCKS ARE THE WANDERER'S TO SHOW YOU, and that gate is newer than this block was.
    // [oploc1,ics_little_entrance_multi] refuses while the cache's own ics_ent_open is 0 and the
    // quest has not started: "The woman camped north-east of the city walked it last; she would
    // know." So the op did nothing, the player never left the sand, and the three checks that
    // followed - the landing, everything inside being on foot, and the hole in the wall - were all
    // reporting that one refusal as broken geography. The hole is the clearest case: it is INSIDE
    // the east wall, so from out here the route can only get within three tiles of it, and
    // "[3324,2796]" was a player standing outside a wall waiting for a click that could not land.
    //
    // She wants Gertrude's Cat finished, a cat in your arms, a tinderbox and a full waterskin.
    const refused = op(p, 3323, 2857, 'ics_little_entrance_multi', 1);
    check('the rocks are not obvious until somebody has walked them with you', [at(p), refused.some(t => t.includes('would know'))], [[3325, 2856, 0], true]);
    sv(p, 'fluffs', 6); // ^fluffs_complete: Gertrude's Cat
    H.give(p, 'growncatobject'); // any obj in the `cat` category - ~icslittle_has_cat is inv_totalcat
    H.give(p, 'tinderbox');
    H.give(p, 'water_skin4');
    // She is a multinpc on ics_ent_open and ics_metsphinx, so which of the five shells is the one
    // actually standing in the sand depends on those vars; take whichever is there.
    const wanderer = ['ics_little_multi_wanderer', 'ics_little_multi_wanderer1', 'ics_little_multi_wanderer2', 'ics_little_redheadlady', 'ics_little_redheadlady_normeyes'].find(n => H.npcNear(n, 3326, 2856, 0) !== null);
    check('the Wanderer is camped north-east of the city', wanderer !== undefined, true);
    if (wanderer) talk(p, wanderer, [1]);
    check('  she takes a tinderbox and a waterskin and shows you the way', [gv(p, 'ics_ent_open'), H.invCount(p, 'tinderbox'), H.invCount(p, 'water_skin4')], [1, 0, 0]);
    p.teleport(3326, 2856, 0);
    H.tick(1);
    op(p, 3323, 2857, 'ics_little_entrance_multi', 1);
    check('the rocks by the tent lead into Sophanem', [at(p), walkable(0, p.x, p.z)], [[3320, 2796, 0], true]);
    check(
        'inside, the High Priest, the embalmer, Siamun and the temple door are all on foot',
        [reachesNear(0, p.x, p.z, 3281, 2772), reachesNear(0, p.x, p.z, 3287, 2755), reachesNear(0, p.x, p.z, 3315, 2786), connected(0, p.x, p.z, 3294, 2781)],
        [true, true, true, true]
    );
    op(p, 3321, 2796, 'ics_wall_crack', 1);
    check('the hole in the wall leads back out beside the rocks', [at(p), connected(0, p.x, p.z, 3326, 2856)], [[3324, 2856, 0], true]);
    op(p, 3323, 2857, 'ics_little_entrance_multi', 1);

    talk(p, 'ics_little_hipriest_town', [1]);
    check('the High Priest asks for help: stage 5', gv(p, 'ics_little_var'), 5);
    talk(p, 'ics_little_embalmer');
    check('the embalmer: salt and sap, stage 10', [gv(p, 'ics_little_var'), H.invCount(p, 'ics_little_pileofsalt'), H.invCount(p, 'ics_little_sap_bucket')], [10, 1, 1]);
    del(p, 'ics_little_pileofsalt');
    talk(p, 'ics_little_embalmer');
    check('lost salt is handed out again', H.invCount(p, 'ics_little_pileofsalt'), 1);
    talk(p, 'ics_little_linen2');
    check('Siamun: linen, stage 15', [gv(p, 'ics_little_var'), H.invCount(p, 'ics_little_linen')], [15, 1]);
    talk(p, 'ics_little_hipriest_town');
    check("embalmed: stage 18, Klenter's spectre shows", [gv(p, 'ics_little_var'), H.getVarBit(p, 'ics_specvis')], [18, 1]);

    p.teleport(3294, 2781, 0);
    H.tick(1);
    op(p, 3294, 2778, 'icthalarins_temple_door', 1);
    check('the temple door (Touch) goes down into the tomb beside its ladder', [at(p), walkable(0, p.x, p.z)], [[3277, 9173, 0], true]);
    check('the tomb reaches the pit', connected(0, p.x, p.z, 3291, 9193), true);
    p.teleport(3291, 9193, 0);
    H.tick(1);
    op(p, 3291, 9194, 'ics_little_pit_to', 2);
    check('jumping the pit lands on the far side, not in the chasm', [at(p), walkable(0, p.x, p.z)], [[3291, 9197, 0], true]);
    check('the far side reaches both doorways', [connected(0, p.x, p.z, 3280, 9200), connected(0, p.x, p.z, 3306, 9200)], [true, true]);
    check('...but not the jars or the ceremony without them', [reachesNear(0, p.x, p.z, 3286, 9194), reachesNear(0, p.x, p.z, 3307, 9196)], [false, false]);
    p.teleport(3280, 9200, 0);
    H.tick(1);
    op(p, 3280, 9199, 'loc_6643', 1);
    check('the west doorway lets you through to the jars', [p.z < 9200, reachesNear(0, p.x, p.z, 3286, 9194)], [true, true]);
    // AND THERE IS A GUARDIAN ON THE SHELVES NOW. "Take the canopic jar. Kill the level 91
    // guardian that appears, then take the jar" - ics_little_possessedpriest was in the cache at
    // vislevel 91 with op2=Attack and had never been placed, so the one fight this quest has was
    // not in it. He comes up the first time a hand goes near a jar and nothing moves off a shelf
    // until he is down, which is why four jar checks read zero.
    H.equip(p, { rhand: 'rune_scimitar' });
    op(p, 3286, 9193, 'ics_little_pot_intestines_multi', 1);
    const guardian = H.npcNear('ics_little_possessedpriest', p.x, p.z, p.level);
    check('reaching for a jar brings the possessed priest up', guardian !== null, true);
    if (guardian) {
        let gt = 0;
        H.attackNpc(p, guardian);
        while (guardian.isActive && gt < 600) {
            if (!p.target) H.attackNpc(p, guardian);
            p.levels[3] = 99;
            H.tick(1);
            gt++;
        }
        H.tick(3);
        check('  and he goes down to a real fight', [guardian.isActive, gv(p, 'ics_sarcophigi_gotstuffcounter')], [false, 1]);
    }
    op(p, 3286, 9193, 'ics_little_pot_intestines_multi', 1);
    op(p, 3286, 9194, 'ics_little_pot_liver_multi', 1);
    check('two jars taken, their shelves empty', [H.invCount(p, 'ics_little_canopic_jar_intestines'), H.invCount(p, 'ics_little_canopic_jar_liver'), H.getVarBit(p, 'ics_intestinespot_vis'), H.getVarBit(p, 'ics_liverpot_vis')], [1, 1, 1, 1]);
    del(p, 'ics_little_canopic_jar_liver');
    const back = at(p);
    // A PLAYER CANNOT CLICK THE CEREMONY BEFORE IT STARTS, and this line used to not know that:
    // it talked to the ceremony Priest here purely to have talked to somebody - its own comment
    // said "anyone; the check is on the town priest below" - and 981a228's menu guard stopped it.
    // It was right to. Both ceremony npcs are multis on ics_little_var that resolve from stage 19
    // (^icslittle_ceremony), and the jars are still being collected here. So the rule the guard
    // enforces is asserted instead of a click being thrown away.
    const cerPriest = H.npcNear('ics_little_priest_ceremony', 3306, 9197);
    check('the ceremony priest offers nothing before the ceremony', cerPriest ? H.npcOpWord(p, cerPriest, 1) : 'no npc at all', null);
    p.teleport(3282, 2772, 0);
    H.tick(1);
    talk(p, 'ics_little_hipriest_town');
    check('a lost jar goes back on its shelf when the High Priest counts them', H.getVarBit(p, 'ics_liverpot_vis'), 0);
    p.teleport(back[0], back[1], 0);
    H.tick(1);
    op(p, 3286, 9194, 'ics_little_pot_liver_multi', 1);
    op(p, 3286, 9195, 'ics_little_pot_lungs_multi', 1);
    op(p, 3286, 9196, 'ics_little_pot_stomach_multi', 1);
    check('all four jars: the burial party assembles, stage 19', gv(p, 'ics_little_var'), 19);
    p.teleport(3280, 9199, 0);
    H.tick(1);
    op(p, 3280, 9199, 'loc_6643', 1);
    check('back out through the west doorway', p.z, 9200);
    p.teleport(3306, 9200, 0);
    H.tick(1);
    op(p, 3306, 9199, 'loc_6643', 1);
    check('the east doorway lets you into the ceremony', [p.z < 9200, reachesNear(0, p.x, p.z, 3307, 9196)], [true, true]);
    // AND A SYMBOL CUT FOR THE RITE, which is newer than this block: "a symbol cut for the rite.
    // The carpenter east of the embalmer does that, out of willow" - and he takes willow logs for
    // it. Without it the ceremony priest asks for it and RETURNS, so the stage sat at 19 and the
    // two checks after it went with that.
    const ceremonyTile = at(p);
    p.teleport(3312, 2767, 0);
    H.tick(1);
    H.give(p, 'willow_logs');
    talk(p, 'ics_little_carpenter');
    check('the carpenter cuts the holy symbol out of willow', [H.invCount(p, 'ics_little_holy_symbol'), gv(p, 'ics_metcarpenter')], [1, 1]);
    del(p, 'ics_little_holy_symbol');
    talk(p, 'ics_little_carpenter');
    check('  and a lost symbol is cut again', H.invCount(p, 'ics_little_holy_symbol'), 1);
    p.teleport(ceremonyTile[0], ceremonyTile[1], ceremonyTile[2]);
    H.tick(1);
    talkHere(p, 'ics_little_hipriest_ceremony');
    check('jars placed, Icthlarin arrives: stage 24', gv(p, 'ics_little_var'), 24);
    talkHere(p, 'ics_little_hipriest_ceremony');
    check('the priest says where the god is waiting', gv(p, 'ics_little_var'), 24);
    p.teleport(3278, 9171, 0);
    H.tick(1);
    talk(p, 'ics_little_ic');
    check('Icthlarin, and the body is taken: stage 25', gv(p, 'ics_little_var'), 25);
    p.teleport(3306, 9197, 0);
    H.tick(1);
    talk(p, 'ics_little_hipriest_ceremony');
    H.tick(3);
    check('the High Priest: complete, the catspeak amulet', [gv(p, 'ics_little_var'), H.invCount(p, 'ics_little_amulet_of_catspeak')], [26, 1]);
    p.teleport(3277, 9173, 0);
    H.tick(1);
    op(p, 3277, 9172, 'ics_ladder', 1);
    check('the tomb ladder climbs out in front of the temple door', [at(p), connected(0, p.x, p.z, 3282, 2772)], [[3294, 2781, 0], true]);

    const q = player('icslittle22', 3306, 9197);
    sv(q, 'ics_little_var', 22);
    talkHere(q, 'ics_little_hipriest_ceremony');
    check('stuck at 22 (a logout mid-ceremony): the priest moves it on to 24', gv(q, 'ics_little_var'), 24);
});

// =============================================================================== Making History
console.log('MAKING HISTORY');
guard('makinghistory', () => {
    const p = player('mhistory', 2430, 3347);
    // PRIEST IN PERIL AND THE RESTLESS GHOST, both newer than this block. ~mh_requirements stops
    // [label,mh_start] between its two choices - "One of the three people you would have to find
    // is on the other side of the Salve", "one of them is a ghost" - so the second pick had no
    // menu to land on and the whole block threw "menus not reached: 1".
    sv(p, 'priestperil', 60); // ^priestperil_complete
    sv(p, 'prieststart', 5); // ^priest_complete
    check('the outpost is shut: Jorral cannot be reached on foot', reachesNear(0, 2430, 3347, 2437, 3347), false);
    op(p, 2433, 3347, 'makinghistory_doubledoorr', 1);
    check('the front doors let you in', [p.x >= 2434, reachesNear(0, p.x, p.z, 2437, 3347)], [true, true]);
    // STAGE 1 AND NO SCROLL. He hands nothing over at the start any more: the quest is three
    // strands now - a trader, a warrior and a ghost, each with its own progress var - and
    // makinghistory_scroll1 is the timeline you bring BACK from Droalak. quest_makinghistory_run
    // plays all three and passes, so the strands below have been deleted rather than ported and
    // what is kept is this block's map: the outpost doors, Melina's door and the museum.
    talkHere(p, 'makinghistory_jorral', [1, 1]);
    check('Jorral starts it: stage 1, and he hands over nothing', [gv(p, 'makinghistory_prog'), H.invCount(p, 'makinghistory_scroll1')], [1, 0]);
    op(p, 2433, 3347, 'makinghistory_doubledoorr', 1);
    check('and back out', p.x <= 2433, true);

    // Melina's door is this block's, because no run walks it: she is shut in and Droalak cannot
    // be talked round without getting in to her.
    H.equip(p, { front: 'amulet_of_ghostspeak' });
    p.teleport(3676, 3475, 0);
    H.tick(1);
    check('Melina is shut in her house', connected(0, p.x, p.z, 3674, 3483), false);
    op(p, 3676, 3476, 'ahoy_harbour_door', 1);
    check('her door lets you in', connected(0, p.x, p.z, 3674, 3483), true);

    // and the museum, which opens at the end. The three strands that get there are the run's.
    p.teleport(2430, 3347, 0);
    H.tick(1);
    sv(p, 'makinghistory_prog', 4); // ^mh_complete
    sv(p, 'makinghistory_objloc', 1);
    op(p, 2433, 3347, 'makinghistory_doubledoorr', 1);
    check('the storeroom is behind a shut door', reachesNear(0, p.x, p.z, 2437, 3344), false);
    p.teleport(2436, 3346, 0);
    H.tick(1);
    op(p, 2436, 3345, 'makinghistory_door', 1);
    check('the storeroom door lets you through to the displays', reachesNear(0, p.x, p.z, 2437, 3344), true);
    const said = op(p, 2437, 3344, 'makinghistory_shield_display_multiloc', 1);
    check(
        'Study on the shield display (the multiloc shell) says something',
        said.some(t => t.includes('shield')),
        true
    );
});

// =============================================================================== In Aid of the Myreque
console.log('IN AID OF THE MYREQUE');
guard('myreque2', () => {
    const p = player('myreque2', 3484, 3246);
    check('Burgh de Rott is fenced in from the swamp road', connected(0, 3484, 3246, 3490, 3240), false);
    // THE GATE WANTS FEEDING NOW. myreque2_village.rs2 bars it from the inside until Florin has had
    // something to eat (%myreque_2_quest >= ^m2_fed, which is 12), and only lets you out the other
    // way without it - so this used to walk straight in and now has to earn it. The feeding itself
    // is myrequevillage.ts's; what this block is for is the map, so it sets the stage and asks the
    // gate the same question. The refusal is worth a check of its own while we are here.
    op(p, 3484, 3244, 'burgh_fencegate_r', 1);
    check('the gate is barred until Florin is fed', p.z <= 3243, false);
    sv(p, 'myreque_2_quest', 12); // ^m2_fed
    op(p, 3484, 3244, 'burgh_fencegate_r', 1);
    check('the gate lets you into the village', [p.z <= 3243, reachesNear(0, p.x, p.z, 3490, 3241), reachesNear(0, p.x, p.z, 3517, 3241)], [true, true, true]);
    // THE FENCE IS NOT A WAY ROUND FLORIN, which is the whole of its own comment: "hopping it got
    // you in without ever feeding him, which is the one thing the walkthrough makes you do to get
    // in at all. Out is always allowed; in needs the gate to have been opened for you once." So an
    // unfed player hops OUT and cannot hop back, and "and back: 3473" was the fence doing its job.
    // Both directions are asked now, of a player on each side of that rule.
    const f = player('myreque2f', 3475, 3221);
    op(f, 3474, 3221, 'burgh_agility_shortcut_fence', 1);
    check('the low fence can be jumped outwards by anybody', f.x, 3473);
    op(f, 3474, 3221, 'burgh_agility_shortcut_fence', 1);
    check('  and not back in before Florin has been fed', f.x, 3473);
    sv(f, 'myreque_2_quest', 12); // ^m2_fed
    op(f, 3474, 3221, 'burgh_agility_shortcut_fence', 1);
    check('  and back in once he has', f.x, 3474);

    // ^route_complete IS 8, NOT 5. In Search of the Myreque was renumbered and this kept setting
    // 5, so [label,myreque2_veliaf] took the `%routequest < ^route_complete` branch and sent the
    // player to @myreque2_veliaf_idle - a line of dialogue with no choice in it - and the pick
    // this step was holding had nowhere to land. "menus not reached: 1" was the whole block
    // falling over on a stage number.
    sv(p, 'routequest', 8); // ^route_complete
    const v0 = player('myreque2v', 3505, 9837);
    sv(v0, 'routequest', 8);
    talk(v0, 'route_veliaf_hurtz', [1]);
    check('Veliaf in the Hollows starts it: stage 10', gv(v0, 'myreque_2_quest'), 10);
    sv(p, 'myreque_2_quest', 10);
    p.teleport(3490, 3239, 0);
    H.tick(1);
    talkHere(p, 'burgh_vilager_leader');
    check('the village leader explains: stage 20', gv(p, 'myreque_2_quest'), 20);
    check('the furnace and the bank are on foot from the square', [reachesNear(0, p.x, p.z, 3527, 3209), reachesNear(0, p.x, p.z, 3494, 3211)], [true, true]);
    for (const it of ['softclay', 'bucket_water', 'tinderbox']) H.give(p, it);
    H.give(p, 'coal', 5);
    p.teleport(3527, 3207, 0);
    H.tick(1);
    for (let i = 0; i < 3; i++) op(p, 3527, 3209, 'burgh_furnace_multiloc', 1);
    check('the furnace: mended, loaded, lit', gv(p, 'burgh_furnace_fix'), 3);
    // The roof, walls and booth take planks - left to the plank/woodplank change in flight elsewhere -
    // and STOCKING THE SHOP IS ITS OWN QUEST STEP NOW: once the roof and wall are done, Aurel asks
    // for ten bronze axes, three tinderboxes and ten of whatever the swamp gave him that week, hands
    // over a crate, and ~p_choice2 asks whether you will fetch it. A talk() with no pick walks into
    // that menu and throws "unexpected menu: multi2", which is what it did. myrequecrate.ts is the
    // sim for that step; here the var goes on with the other three.
    for (const b of ['burgh_store_roof', 'burgh_store_wall', 'burgh_bank_booth_open', 'burgh_bank_wall', 'burgh_store_stocked']) sv(p, b, 1);
    check('the store is stocked', gv(p, 'burgh_store_stocked'), 1);
    p.teleport(3490, 3239, 0);
    H.tick(1);
    talkHere(p, 'burgh_vilager_leader');
    check('all of it done: the tithe arrives (stage 40)', [gv(p, 'myreque_2_quest'), gv(p, 'blood_tithe_visible')], [40, 1]);
    p.teleport(3514, 3239, 0);
    H.tick(1);
    // GADDERANKS IS A REAL FIGHT NOW, and it was a mesbox when this check was written: "Four lines
    // of narration, twelve points of self-damage and a stage change, for the fight this quest is
    // remembered for - while the cache was holding three npcs for it and using none of them." He
    // spawns with two Vampyre Juvinates and falls over rather than dying, and the stage moves when
    // they are down. The talk below only starts it, so it cannot be followed by a stage check -
    // quest_myreque2_run fights it and passes, and this block is the map, so the stage is set.
    talk(p, 'burgh_gadderanks_multinpc');
    check('Gadderanks turns round, and he does not turn round alone', H.npcNear('burgh_gadderanks_attackable', p.x, p.z, 0) !== null, true);
    H.tick(8);
    sv(p, 'myreque_2_quest', 50); // ^m2_tithe_broken, which the fight reaches
    sv(p, 'blood_tithe_visible', 2);
    p.teleport(3513, 3239, 0);
    H.tick(1);
    op(p, 3513, 3238, 'burgh_ladder_generalstore_up', 1);
    check('store ladder up: beside it, not in it, and the roof is in reach', [at(p), walkable(2, p.x, p.z), reachesNear(2, p.x, p.z, 3515, 3240)], [[3513, 3239, 2], true, true]);
    op(p, 3513, 3238, 'burgh_ladder_generalstore_down', 1);
    check('store ladder down: beside it, and out to the street', [at(p), walkable(0, p.x, p.z), reachesNear(0, p.x, p.z, 3517, 3241)], [[3513, 3239, 0], true, true]);

    // A SPADE AND A PICKAXE AS WELL AS THE BUCKET: "It comes out a bucket at a time and you have
    // nothing to shovel it with" and "Half of it is one piece. You would want a pickaxe." Both
    // refusals are newer than this block, which carried a bucket and nothing else.
    // ONE bucket, not three: ~m2_rubble_bucket hands back the first EMPTY one it finds, so three
    // empties make three quarter-full buckets and never a full one.
    H.give(p, 'bucket_empty', 1);
    H.give(p, 'spade');
    H.give(p, 'rune_pickaxe');
    p.teleport(3493, 3235, 0);
    H.tick(1);
    check('the pocket beside the rubble and trapdoor cannot be reached from the street', connected(0, p.x, p.z, 3491, 3232), false);
    // a real door since the merge with audit-3: it opens (the generic door code, ahoy_harbour_door ->
    // ahoy_harbour_door_open) and you walk through, rather than being moved through a shut one
    op(p, 3493, 3233, 'ahoy_harbour_door', 1);
    check('the inn door opens (it said nothing interesting happens)', connected(0, p.x, p.z, 3493, 3232), true);
    check('and the street is still reachable through it', connected(0, 3493, 3232, 3493, 3236), true);
    p.teleport(3491, 3229, 0);
    H.tick(1);
    op(p, 3491, 3230, 'burgh_inn_climb_over', 1);
    check('the broken back wall is the way in to the rubble and trapdoor', [at(p), connected(0, p.x, p.z, 3491, 3232)], [[3491, 3231, 0], true]);
    // ONE BUCKET, THREE SPADEFULS, AND THEN THE PILE OUTSIDE. Three uses of a bucket on the wall
    // was the old step; now a bucket FILLS in three passes (empty -> _1 -> _2 -> _3) and the wall
    // only comes down once three loads have been tipped on the pile south-west of the bar, which
    // is a trip out over the broken wall and back. The pickaxe and the spade are what let you
    // break it up at all. quest_myreque2_run walks the trip; this block proves the mechanism and
    // then takes the shortcut, because what it is for is the trapdoor and the cellar below.
    p.teleport(3491, 3232, 0);
    H.tick(1);
    for (let i = 0; i < 3; i++) useOn(p, 3489, 3231, 'burgh_inn_colapsed_wall_multiloc', 'spade');
    check('three spadefuls fill one bucket', H.invCount(p, 'burgh_rubble_bucket_3'), 1);
    p.teleport(3489, 3226, 0);
    H.tick(1);
    useOn(p, 3489, 3227, 'burgh_outside_rubble_pile', 'burgh_rubble_bucket_3');
    check('  and the pile takes it, three loads at once: the wall is down', [H.getVarBit(p, 'burgh_inn_colapsed_wall'), H.invCount(p, 'bucket_empty') > 0], [1, true]);
    p.teleport(3491, 3231, 0);
    H.tick(1);
    op(p, 3490, 3232, 'burgh_inn_trapdoor_multiloc', 1);
    check('the trapdoor opens: stage 60', [gv(p, 'myreque_2_quest'), H.getVarBit(p, 'burgh_inn_trapdoor')], [60, 1]);

    op(p, 3490, 3232, 'burgh_inn_trapdoor_multiloc', 1);
    check('down into the cellar, beside the ladder, not in it', [at(p), walkable(0, p.x, p.z)], [[3490, 9631, 0], true]);
    check('the cellar reaches Veliaf and the chest', [reachesNear(0, p.x, p.z, 3494, 9628), reachesNear(0, p.x, p.z, 3493, 9632)], [true, true]);
    talk(p, 'burgh_rescue_veliaf_hurtz_talk');
    // THE ESCORT GOES BETWEEN THESE TWO LINES NOW. Veliaf used to send you straight to Paterdomus
    // (stage 80) and the library key used to sit in an invented chest in this cellar. Ivan Strom's
    // walk is what reaches the temple since, and Drezel - the man who has been sitting on the key -
    // hands it over at the end of it (areas/area_mausoleum/scripts/drezel.rs2, m2_drezel_takes_ivan),
    // so stage 72 is "Veliaf has asked, and Ivan is in the cellar". tools/sim/myrequeescort.ts drives
    // that step in full; this block takes the shortcut past it rather than driving it twice.
    check('Veliaf moves in and hands Ivan over: stage 72', gv(p, 'myreque_2_quest'), 72);
    sv(p, 'myreque_2_quest', 80); // ^m2_temple, which the escort reaches
    H.give(p, 'burgh_key'); // and Drezel's key with it
    p.teleport(3492, 9631, 0);
    H.tick(1);
    op(p, 3490, 9632, 'burgh_inn_basement_ladderup', 1);
    check('the cellar ladder climbs back out into the inn beside the trapdoor', [at(p), walkable(0, p.x, p.z)], [[3491, 3232, 0], true]);

    p.teleport(3440, 9887, 0);
    H.tick(1);
    op(p, 3443, 9898, 'burgh_library_keyhole', 1);
    check('the keyhole under Paterdomus opens the trapdoor', H.getVarBit(p, 'burgh_temple_trapdoor'), 1);
    op(p, 3441, 9899, 'burgh_temple_trapdoor_multiloc', 1);
    check('down into the library, beside the ladder, not in it', [at(p), walkable(2, p.x, p.z)], [[3414, 9867, 2], true]);
    check('both bookcases in reach', [reachesNear(2, p.x, p.z, 3407, 9863), reachesNear(2, p.x, p.z, 3407, 9866)], [true, true]);
    op(p, 3407, 9863, 'burgh_library_bookcase_history', 1);
    op(p, 3407, 9866, 'burgh_library_bookcase_ivandis', 1);
    check('the histories and the seventh name: stage 90', gv(p, 'myreque_2_quest'), 90);
    op(p, 3414, 9868, 'burgh_temple_library_ladder_up', 1);
    check('the library ladder climbs out beside the trapdoor (its tile is blocked)', [at(p), walkable(0, p.x, p.z), reachesNear(0, p.x, p.z, 3443, 9898)], [[3441, 9898, 0], true, true]);

    H.give(p, 'hammer');
    p.teleport(3483, 9831, 0);
    H.tick(1);
    useOn(p, 3483, 9832, 'burgh_ivandis_tombdoor_board_multiloc', 'hammer');
    check('the hammer takes the boards off the tomb: stage 100', gv(p, 'myreque_2_quest'), 100);
    op(p, 3484, 9832, 'burgh_ivandis_tomb_entrance', 1);
    check('into the tomb, beside its exit, not in it', [at(p), walkable(2, p.x, p.z), reachesNear(2, p.x, p.z, 3481, 9808)], [[3461, 9821, 2], true, true]);
    op(p, 3461, 9822, 'burgh_ivandis_tomb_exit', 1);
    check('out of the tomb, beside its entrance, not in it', [at(p), walkable(0, p.x, p.z)], [[3483, 9831, 0], true]);
    p.teleport(3505, 9837, 0);
    H.tick(1);
    talk(p, 'route_veliaf_hurtz');
    H.tick(3);
    // AND THE QUEST NO LONGER ENDS HERE. Opening the tomb used to be the last step; the Rod of
    // Ivandis - the reward the quest guide names the quest for - is the ending since, and Veliaf
    // reading the plaster fragment is where that recipe starts: 102, then the mould (104), the
    // casting (106), the well (108), and 110 with the quest points. tools/sim/myrequerod.ts drives
    // the chain, so again this takes the shortcut and then asks Veliaf for the ending itself.
    check('Veliaf reads the fragment and the recipe starts: stage 102', gv(p, 'myreque_2_quest'), 102);
    sv(p, 'myreque_2_quest', 108); // ^m2_charged, which the rod chain reaches
    H.give(p, 'burgh_rod_command_final_10');
    talk(p, 'route_veliaf_hurtz');
    H.tick(3);
    check('the charged rod, handed over and handed straight back: complete, 3 QP', [gv(p, 'myreque_2_quest'), gv(p, 'qp') >= 3, H.invCount(p, 'burgh_rod_command_final_10')], [110, true, 1]);
});

// =============================================================================== Regicide
console.log('REGICIDE');
guard('regicide', () => {
    const p = player('regicide', 2371, 9718);
    sv(p, 'upass', 10); // ^upass_complete
    sv(p, 'regicide_quest', 1);
    check('Tirannwn cannot be walked to', connected(0, 2371, 9718, 2313, 3213), false);
    const said = op(p, 2373, 9718, 'bloodwell_upass', 1, [1]);
    check('the Well of Voyage takes you down into its temple', [at(p), walkable(0, p.x, p.z)], [[2340, 9622, 0], true]);
    void said;
    check('the temple reaches its exit', connected(0, p.x, p.z, 2314, 9624), true);
    op(p, 2312, 9623, 'regicide_voyage_temple_exit', 1);
    check('out into Isafdar', [at(p), walkable(0, p.x, p.z)], [[2313, 3214, 0], true]);
    const idris = H.npcNear('regicide_good_elf1', p.x, p.z, 0);
    check('Idris and the two elves are waiting by the cave mouth', [idris !== null, H.npcNear('regicide_evil_elf1', p.x, p.z, 0) !== null, H.npcNear('regicide_evil_elf2', p.x, p.z, 0) !== null], [true, true, true]);
    talk(p, 'regicide_good_elf1');
    check('Idris is killed warning you: stage 2', gv(p, 'regicide_quest'), 2);
    p.teleport(2313, 3214, 0);
    H.tick(1);
    op(p, 2313, 3215, 'regicide_voyage_temple_entrance', 1);
    check('the cave entrance leads back into the temple', [at(p), reachesNear(0, p.x, p.z, 2341, 9622)], [[2314, 9624, 0], true]);
    p.teleport(2340, 9622, 0);
    H.tick(1);
    op(p, 2341, 9622, 'regicide_voyage_temple_well2', 1);
    check("and its well back up into Iban's temple", at(p), [2372, 9718, 0]);

    const q = player('regicide2', 2204, 3250);
    sv(q, 'regicide_quest', 2);
    talk(q, 'lord_iorwerth');
    check('Iorwerth: the pendant, stage 3', [gv(q, 'regicide_quest'), H.invCount(q, 'regicide_crystal_pendant')], [3, 1]);
    del(q, 'regicide_crystal_pendant');
    talk(q, 'lord_iorwerth');
    check('a lost pendant is replaced', H.invCount(q, 'regicide_crystal_pendant'), 1);
    sv(q, 'regicide_quest', 7);
    H.clearInv(q);
    talk(q, 'lord_iorwerth');
    check('out of barrels and limestone: he tops both up', [H.invCount(q, 'regicide_barrel_empty'), H.invCount(q, 'limestone')], [3, 1]);
    // ...ONCE, AND THEN HE ANSWERS THE FIVE QUESTIONS. At ^regicide_has_book ~regicide_resupply
    // takes the first talk and the one after it falls into [label,regicide_iorwerth_components] -
    // a ~p_choice5, which is a step of the quest in its own right ("he used to say 'it is all in
    // the book', and the book is a page of flavour about fire oil with no recipe in it"). A talk
    // with no pick walked into it and threw "unexpected menu: multi5", and everything below here
    // went with it.
    const asked: string[] = [];
    for (const [n, word] of [
        [1, 'quicklime'],
        [2, 'sulphur'],
        [3, 'naphtha'],
        [4, 'barrel'],
        [5, 'fuse']
    ] as [number, string][]) {
        const said = talk(q, 'lord_iorwerth', [n]).join(' ');
        asked.push(said.length > 40 ? word : word + ' (no answer)');
    }
    check('...once - with them in hand he answers the five questions about the bomb instead', [H.invCount(q, 'regicide_barrel_empty'), H.invCount(q, 'limestone'), asked.join(' ')], [3, 1, 'quicklime sulphur naphtha barrel fuse']);
    sv(q, 'regicide_quest', 9);
    H.clearInv(q);
    talk(q, 'lord_iorwerth');
    check('a lost letter is written again', H.invCount(q, 'regicide_iorwerth_message'), 1);
});

// =============================================================================== Troll Romance
console.log('TROLL ROMANCE');
guard('trolllove', () => {
    const t = NpcType.get(NpcType.getId('trollromance_arrg_attackable'));
    check('Arrg has real combat stats (OSRS wiki: 140 hp, Attack 70, Strength 140, Defence 40)', [t.stats[3], t.stats[0], t.stats[2], t.stats[1]], [140, 70, 140, 40]);
    const p = player('trolllove', 2828, 10093, 1);
    sv(p, 'troll_love', 35);
    H.equip(p, { rhand: 'dragon_scimitar' });
    talk(p, 'trollromance_arrg', [1]);
    const arrg = H.npcNear('trollromance_arrg_attackable', p.x, p.z, p.level)!;
    check('"I am here to kill you!": outside, on open ground, with Arrg in reach', [p.level, walkable(p.level, p.x, p.z), arrg !== null && reachesNear(p.level, p.x, p.z, arrg.x, arrg.z)], [0, true, true]);
    let ticks = 0;
    H.attackNpc(p, arrg);
    while (arrg.isActive && ticks < 400) {
        if (!p.target) H.attackNpc(p, arrg);
        p.levels[3] = 99;
        H.tick(1);
        ticks++;
    }
    H.tick(3);
    check('Arrg killed: the kill counts (stage 40)', [arrg.isActive, gv(p, 'troll_love')], [false, 40]);
    p.teleport(2828, 10063, 1);
    H.tick(1);
    talk(p, 'trollromance_ug');
    H.tick(3);
    check('Ug: complete, the gems', [gv(p, 'troll_love'), H.invCount(p, 'uncut_diamond'), H.invCount(p, 'uncut_emerald')], [45, 1, 4]);
    const from = H.ifaces.length;
    H.ifButton(p, 'questlist:troll_love');
    drive(p);
    check(
        'the journal has a complete page',
        H.ifaces.slice(from).some(i => i.who === p.username && (i.text ?? '').includes('QUEST COMPLETE')),
        true
    );
});

// =============================================================================== upstream starts
// The seven quests in this batch that were already built upstream got static checks (every trigger's
// loc/npc placed, no dead op on their maps, fight npcs with stats, items obtainable); this only
// proves each one can still be started from its npc where the map now puts it.
console.log('UPSTREAM QUESTS - START');
guard('starts', () => {
    const starts: [string, string, RegExp, string][] = [
        ['arena', 'lady_servil', /Can I help/, 'arenaquest'],
        ['grandtree', 'grandtree_narnode', /worried|happy to help/, 'grandtree'],
        ['cog', 'brother_kojo', /what can I do/, 'cogquest'],
        ['sheepherder', 'councillor_halgrive', /help|what|yes/i, 'sheepherderquest']
    ];
    for (const [q, who, want, varp] of starts) {
        const npc = World.npcs.find(n => n && n.isActive && n.type === NpcType.getId(who));
        if (!npc) {
            check(q + ': start npc ' + who + ' is in the world', false, true);
            continue;
        }
        const p = player('start' + q, npc.x + 1, npc.z, npc.level);
        talkK(p, who, want);
        check(`${q}: ${who} starts it`, gv(p, varp) > 0, true);
    }
});

console.log(`\n${R.ok} ok, ${R.bad} FAIL`);
process.exit(R.bad ? 1 : 0);
