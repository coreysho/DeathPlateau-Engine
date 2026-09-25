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
const mesSince = (p: Player, from: number) => H.mesgs.slice(from).filter(m => m.who === p.username).map(m => m.text);
const walkable = (level: number, x: number, z: number) => !isMapBlocked(x, z, level) && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dz]) => canTravel(level, x, z, dx, dz, 1, 0, CollisionType.NORMAL));

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
    return H.ifaces.slice(from).filter(i => i.who === p.username && i.kind === 'text' && i.text && i.text.length > 1).map(i => i.text!);
}

/** Talk to the nearest npc of a type on the player's level, standing next to it first. */
function talk(p: Player, npcName: string, picks: number[] = [], op = 1): string[] {
    const npc = H.npcNear(npcName, p.x, p.z, p.level);
    if (!npc) throw new Error('no npc ' + npcName);
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [2, 0], [0, 2], [-2, 0], [0, -2]]) {
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
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1]]) {
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
            for (const [k, t] of texts) if (want.test(t) && p.resumeButtons.includes(Component.getId(`${open}:com_${k}`))) { pick = k; break; }
            H.choose(p, `${open}:com_${pick}`);
        } else {
            p.executeScript(sc, true, true);
        }
    }
    return H.ifaces.slice(from).filter(i => i.who === p.username && i.kind === 'text' && i.text && i.text.length > 1).map(i => i.text!);
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
function useOnNpc(p: Player, objName: string, npc: Npc) {
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
        for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            const nx = cx + dx, nz = cz + dz, k = nx + ',' + nz;
            if (seen.has(k) || Math.abs(nx - x) > radius || Math.abs(nz - z) > radius) continue;
            if (canTravel(level, cx, cz, dx, dz, 1, 0, CollisionType.NORMAL)) { seen.add(k); q.push([nx, nz]); }
        }
    }
    return false;
}
/** Reachable to any tile next to (tx,tz) - for things that themselves block. */
const reachesNear = (level: number, x: number, z: number, tx: number, tz: number) =>
    [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dz]) => connected(level, x, z, tx + dx, tz + dz));
const hasTrigger = (type: ServerTriggerType, name: string, kind: 'loc' | 'npc') => {
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
    check('pouch left behind Entrana\'s altar: stage 40, the altar holds it', [gv(p, 'devious_main'), H.getVarBit(p, 'devious_altar'), H.invCount(p, 'devious_glowingpouch')], [40, 1, 0]);
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
    op(p, 3323, 2857, 'ics_little_entrance_multi', 1);
    check('the rocks by the tent lead into Sophanem', [at(p), walkable(0, p.x, p.z)], [[3320, 2796, 0], true]);
    check('inside, the High Priest, the embalmer, Siamun and the temple door are all on foot', [
        reachesNear(0, p.x, p.z, 3281, 2772), reachesNear(0, p.x, p.z, 3287, 2755), reachesNear(0, p.x, p.z, 3315, 2786), connected(0, p.x, p.z, 3294, 2781)], [true, true, true, true]);
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
    check('embalmed: stage 18, Klenter\'s spectre shows', [gv(p, 'ics_little_var'), H.getVarBit(p, 'ics_specvis')], [18, 1]);

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
    op(p, 3286, 9193, 'ics_little_pot_intestines_multi', 1);
    op(p, 3286, 9194, 'ics_little_pot_liver_multi', 1);
    check('two jars taken, their shelves empty', [H.invCount(p, 'ics_little_canopic_jar_intestines'), H.invCount(p, 'ics_little_canopic_jar_liver'), H.getVarBit(p, 'ics_intestinespot_vis'), H.getVarBit(p, 'ics_liverpot_vis')], [1, 1, 1, 1]);
    del(p, 'ics_little_canopic_jar_liver');
    const back = at(p);
    talk(p, 'ics_little_priest_ceremony'); // anyone; the check is on the town priest below
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
    check('the outpost is shut: Jorral cannot be reached on foot', reachesNear(0, 2430, 3347, 2437, 3347), false);
    op(p, 2433, 3347, 'makinghistory_doubledoorr', 1);
    check('the front doors let you in', [p.x >= 2434, reachesNear(0, p.x, p.z, 2437, 3347)], [true, true]);
    talkHere(p, 'makinghistory_jorral', [1, 1]);
    check('Jorral: started, the timeline', [gv(p, 'makinghistory_prog'), H.invCount(p, 'makinghistory_scroll1')], [1, 1]);
    op(p, 2433, 3347, 'makinghistory_doubledoorr', 1);
    check('and back out', p.x <= 2433, true);

    p.teleport(2641, 3673, 0);
    H.tick(1);
    talk(p, 'viking_fur_monger');
    check('the fur trader: the sealed letter', [gv(p, 'makinghistory_trader_prog'), H.invCount(p, 'makinghistory_letter2')], [4, 1]);
    del(p, 'makinghistory_letter2');
    talk(p, 'viking_fur_monger');
    check('a lost letter is copied out again', H.invCount(p, 'makinghistory_letter2'), 1);
    p.teleport(2675, 3673, 0);
    H.tick(1);
    talk(p, 'makinghistory_blanin');
    p.teleport(2658, 3702, 0);
    H.tick(1);
    talk(p, 'makinghistory_dron');
    p.teleport(2675, 3673, 0);
    H.tick(1);
    talk(p, 'makinghistory_blanin');
    check('Blanin, Dron, Blanin: the letter to the king', [gv(p, 'makinghistory_warr_prog'), H.invCount(p, 'makinghistory_letter1')], [4, 1]);

    H.equip(p, { front: 'amulet_of_ghostspeak' });
    p.teleport(3676, 3475, 0);
    H.tick(1);
    check('Melina is shut in her house', connected(0, p.x, p.z, 3674, 3483), false);
    op(p, 3676, 3476, 'ahoy_harbour_door', 1);
    check('her door lets you in', connected(0, p.x, p.z, 3674, 3483), true);
    for (const who of ['makinghistory_droalak_multi', 'makinghistory_melina_multi', 'makinghistory_droalak_multi', 'makinghistory_melina_multi', 'makinghistory_droalak_multi']) {
        p.teleport(who.includes('droalak') ? 3659 : 3674, who.includes('droalak') ? 3469 : 3482, 0);
        H.tick(1);
        talk(p, who);
    }
    check('Droalak and Melina, reconciled: Bennath\'s journal', [gv(p, 'makinghistory_ghost_prog'), H.invCount(p, 'makinghistory_journal')], [5, 1]);

    p.teleport(2430, 3347, 0);
    H.tick(1);
    op(p, 2433, 3347, 'makinghistory_doubledoorr', 1);
    talkHere(p, 'makinghistory_jorral');
    H.tick(3);
    check('Jorral: complete, 3 QP, the museum opens', [gv(p, 'makinghistory_prog'), gv(p, 'qp') >= 3, H.getVarBit(p, 'makinghistory_objloc')], [3, true, 1]);
    check('the storeroom is behind a shut door', reachesNear(0, p.x, p.z, 2437, 3344), false);
    p.teleport(2436, 3346, 0);
    H.tick(1);
    op(p, 2436, 3345, 'makinghistory_door', 1);
    check('the storeroom door lets you through to the displays', reachesNear(0, p.x, p.z, 2437, 3344), true);
    const said = op(p, 2437, 3344, 'makinghistory_shield_display_multiloc', 1);
    check('Study on the shield display (the multiloc shell) says something', said.some(t => t.includes('shield')), true);
});

// =============================================================================== In Aid of the Myreque
console.log('IN AID OF THE MYREQUE');
guard('myreque2', () => {
    const p = player('myreque2', 3484, 3246);
    check('Burgh de Rott is fenced in from the swamp road', connected(0, 3484, 3246, 3490, 3240), false);
    op(p, 3484, 3244, 'burgh_fencegate_r', 1);
    check('the gate lets you into the village', [p.z <= 3243, reachesNear(0, p.x, p.z, 3490, 3241), reachesNear(0, p.x, p.z, 3517, 3241)], [true, true, true]);
    const f = player('myreque2f', 3475, 3221);
    op(f, 3474, 3221, 'burgh_agility_shortcut_fence', 1);
    check('the low fence can be jumped', f.x, 3473);
    op(f, 3474, 3221, 'burgh_agility_shortcut_fence', 1);
    check('and back', f.x, 3474);

    sv(p, 'routequest', 105); // ^routequest_complete (the original's stage numbers)
    const v0 = player('myreque2v', 3505, 9837);
    sv(v0, 'routequest', 105);
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
    // The roof, walls and booth take planks - left to the plank/woodplank change in flight elsewhere.
    for (const b of ['burgh_store_roof', 'burgh_store_wall', 'burgh_bank_booth_open', 'burgh_bank_wall']) sv(p, b, 1);
    p.teleport(3517, 3239, 0);
    H.tick(1);
    talk(p, 'burgh_general_store_owner');
    check('the store is stocked', gv(p, 'burgh_store_stocked'), 1);
    p.teleport(3490, 3239, 0);
    H.tick(1);
    talkHere(p, 'burgh_vilager_leader');
    check('all of it done: the tithe arrives (stage 40)', [gv(p, 'myreque_2_quest'), gv(p, 'blood_tithe_visible')], [40, 1]);
    p.teleport(3514, 3239, 0);
    H.tick(1);
    talk(p, 'burgh_gadderanks_multinpc');
    check('Gadderanks beaten: stage 50, Veliaf where the villager was', [gv(p, 'myreque_2_quest'), gv(p, 'blood_tithe_visible')], [50, 2]);
    p.teleport(3513, 3239, 0);
    H.tick(1);
    op(p, 3513, 3238, 'burgh_ladder_generalstore_up', 1);
    check('store ladder up: beside it, not in it, and the roof is in reach', [at(p), walkable(2, p.x, p.z), reachesNear(2, p.x, p.z, 3515, 3240)], [[3513, 3239, 2], true, true]);
    op(p, 3513, 3238, 'burgh_ladder_generalstore_down', 1);
    check('store ladder down: beside it, and out to the street', [at(p), walkable(0, p.x, p.z), reachesNear(0, p.x, p.z, 3517, 3241)], [[3513, 3239, 0], true, true]);

    H.give(p, 'bucket_empty');
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
    for (let i = 0; i < 3; i++) useOn(p, 3489, 3231, 'burgh_inn_colapsed_wall_multiloc', 'bucket_empty');
    check('three buckets of rubble clear the inn wall', H.getVarBit(p, 'burgh_inn_colapsed_wall'), 1);
    op(p, 3490, 3232, 'burgh_inn_trapdoor_multiloc', 1);
    check('the trapdoor opens: stage 60', [gv(p, 'myreque_2_quest'), H.getVarBit(p, 'burgh_inn_trapdoor')], [60, 1]);
    op(p, 3490, 3232, 'burgh_inn_trapdoor_multiloc', 1);
    check('down into the cellar, beside the ladder, not in it', [at(p), walkable(0, p.x, p.z)], [[3490, 9631, 0], true]);
    check('the cellar reaches Veliaf and the chest', [reachesNear(0, p.x, p.z, 3494, 9628), reachesNear(0, p.x, p.z, 3493, 9632)], [true, true]);
    talk(p, 'burgh_rescue_veliaf_hurtz_talk');
    check('Veliaf moves in and sends you to Paterdomus: stage 80', gv(p, 'myreque_2_quest'), 80);
    p.teleport(3492, 9631, 0);
    H.tick(1);
    op(p, 3493, 9632, 'burgh_chest_closed', 1);
    check('the cellar chest: the library key', H.invCount(p, 'burgh_key'), 1);
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
    check('Veliaf: complete, 3 QP', [gv(p, 'myreque_2_quest'), gv(p, 'qp') >= 3], [110, true]);
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
    check('and its well back up into Iban\'s temple', at(p), [2372, 9718, 0]);

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
    talk(q, 'lord_iorwerth');
    check('...once - with them in hand he just points at the book', [H.invCount(q, 'regicide_barrel_empty'), H.invCount(q, 'limestone')], [3, 1]);
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
    check('the journal has a complete page', H.ifaces.slice(from).some(i => i.who === p.username && (i.text ?? '').includes('QUEST COMPLETE')), true);
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
