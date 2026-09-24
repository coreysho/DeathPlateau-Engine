// Quest audit, batch 5 - the quests that needed fixing, driven through the real content on the real
// map. Usage: npx tsx tools/sim/audit5.ts
//
//   The Hand in the Sand - start to finish, the low-Magic way (the guild bell brings Zavistic Rarve
//     out), the mug that never registered as drunk, both orders of the dye combines, and the lost
//     items the quest had no way to replace.
//   One Small Favour - start to finish: the ladder up to the weathervane platform (and back down),
//     the landing lights' eight bits, and the glider pilot who takes the report.
//   A Tail of Two Cats - start to finish (it was wired; this proves it).
//   Cook's Assistant - the Lumbridge range cooks once the quest is done.
//   Gertrude's Cat - the reward kitten no longer takes over a follower that is already out.
//   Plague City - Edmond goes back up to his garden once you are through the pipe.
import * as H from './harness.js';
import World from '#/engine/World.js';
import LocType from '#/cache/config/LocType.js';
import NpcType from '#/cache/config/NpcType.js';
import ObjType from '#/cache/config/ObjType.js';
import InvType from '#/cache/config/InvType.js';
import Component from '#/cache/config/Component.js';
import VarPlayerType from '#/cache/config/VarPlayerType.js';
import VarBitType from '#/cache/config/VarBitType.js';
import ScriptState from '#/engine/script/ScriptState.js';
import ScriptRunner from '#/engine/script/ScriptRunner.js';
import ScriptProvider from '#/engine/script/ScriptProvider.js';
import ServerTriggerType from '#/engine/script/ServerTriggerType.js';
import { Interaction } from '#/engine/entity/Interaction.js';
import { findPathToLoc, findPathToEntity, canTravel } from '#/engine/GameMap.js';
import { CollisionType } from '#/engine/routefinder/index.js';
import Player from '#/engine/entity/Player.js';
import Npc from '#/engine/entity/Npc.js';
import Loc from '#/engine/entity/Loc.js';

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
    if (level) p.teleport(x, z, level);
    H.maxOut(p);
    H.clearInv(p);
    H.tick(1);
    return p;
}
const at = (p: Player) => [p.x, p.z, p.level];
const lastMes = (p: Player) => H.mesgs.filter(m => m.who === p.username).map(m => m.text).slice(-1)[0] ?? '';

// a varp or a varbit, whichever the name is
function gv(p: Player, name: string): number {
    if (VarPlayerType.getByName(name)) return H.getVar(p, name);
    return H.getVarBit(p, name);
}
function sv(p: Player, name: string, v: number) {
    if (VarPlayerType.getByName(name)) H.setVar(p, name, v);
    else H.setVarBit(p, name, v);
}

// What OpLocHandler / OpNpcHandler check before a click is accepted: the op must exist on the type
// the player actually sees, i.e. the multi child their var resolves to.
function resolved<T extends { multivarp: number; multivarbit: number; multiloc?: number[]; multinpc?: number[] }>(p: Player, t: T, get: (id: number) => T, list: number[]): T | null {
    let state = -1;
    if (t.multivarp !== -1) state = p.getVar(t.multivarp) as number;
    else if (t.multivarbit !== -1) state = p.getVarBit(t.multivarbit);
    else return t;
    if (state >= 0 && state < list.length && list[state] !== -1) return get(list[state]);
    return t;
}
function locOpOk(p: Player, loc: Loc, op: number) {
    const t = LocType.get(loc.type);
    const r = resolved(p, t as any, (id: number) => LocType.get(id) as any, t.multiloc ?? []) as any;
    const o = r?.op?.[op - 1];
    return !!o && o !== 'hidden';
}
function npcOpOk(p: Player, npc: Npc, op: number) {
    const t = NpcType.get(npc.type);
    const r = resolved(p, t as any, (id: number) => NpcType.get(id) as any, t.multinpc ?? []) as any;
    const o = r?.op?.[op - 1];
    return !!o && o !== 'hidden';
}

/** Let a script run out, clicking through any chat pages and taking `picks` at menus (1-based). */
function drive(p: Player, picks: number[] = [], guardTicks = 3): string[] {
    const from = H.ifaces.length;
    let idle = 0;
    for (let guard = 0; guard < 400 && idle < guardTicks; guard++) {
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

/** Talk to the nearest npc of a type on the player's floor, standing next to it first. */
function talk(p: Player, npcName: string, picks: number[] = [], op = 1): string[] {
    const npc = H.npcNear(npcName, p.x, p.z, p.level);
    if (!npc) throw new Error('no npc ' + npcName);
    if (!npcOpOk(p, npc, op)) throw new Error(`${npcName} shows no op${op} to this player`);
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [2, 0], [0, 2], [-2, 0], [0, -2]]) {
        p.teleport(npc.x + dx, npc.z + dz, npc.level);
        H.tick(1);
        H.opNpc(p, npc, op);
        for (let t = 0; t < 10 && !p.activeScript; t++) H.tick(1);
        if (p.activeScript) break;
    }
    return drive(p, picks);
}
function slotOf(p: Player, objName: string) {
    const obj = ObjType.getId(objName);
    const inv = p.getInventory(InvType.INV)!;
    for (let i = 0; i < inv.capacity; i++) if (inv.get(i)?.id === obj) return i;
    throw new Error('not carrying ' + objName);
}
/** "Use" an inventory item on a loc: OpLocUHandler, with the route a client would send. */
function useOn(p: Player, x: number, z: number, locName: string, objName: string) {
    const loc = World.getLoc(x, z, p.level, LocType.getId(locName));
    if (!loc) throw new Error(`no ${locName} at ${x},${z},${p.level}`);
    p.clearPendingAction();
    p.queueWaypoints(findPathToLoc(p.level, p.x, p.z, loc.x, loc.z, p.width, loc.width, loc.length, loc.angle, loc.shape, LocType.get(loc.type).forceapproach));
    p.lastUseItem = ObjType.getId(objName);
    p.lastUseSlot = slotOf(p, objName);
    p.setInteraction(Interaction.ENGINE, loc, ServerTriggerType.APLOCU);
    (p as unknown as { opcalled: boolean }).opcalled = true;
    return drive(p);
}
function useOnNpc(p: Player, npcName: string, objName: string) {
    const npc = H.npcNear(npcName, p.x, p.z, p.level)!;
    // stand on a side of it the route can actually reach (an npc by a wall has sides that cannot)
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        if (!connected(npc.level, npc.x + dx, npc.z + dz, npc.x, npc.z, 2)) continue;
        p.teleport(npc.x + dx, npc.z + dz, npc.level);
        break;
    }
    H.tick(1);
    p.clearPendingAction();
    p.queueWaypoints(findPathToEntity(p.level, p.x, p.z, npc.x, npc.z, p.width, npc.width, npc.length));
    p.lastUseItem = ObjType.getId(objName);
    p.lastUseSlot = slotOf(p, objName);
    p.setInteraction(Interaction.ENGINE, npc, ServerTriggerType.APNPCU);
    (p as unknown as { opcalled: boolean }).opcalled = true;
    return drive(p);
}
/** Use `used` on `target` in the pack - OpHeldUHandler, including its fall back to [opheldu,used]. */
function useHeld(p: Player, used: string, target: string) {
    p.lastItem = ObjType.getId(target);
    p.lastSlot = slotOf(p, target);
    p.lastUseItem = ObjType.getId(used);
    p.lastUseSlot = slotOf(p, used);
    p.clearPendingAction();
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
    const loc = World.getLoc(x, z, p.level, LocType.getId(locName));
    if (!loc) throw new Error(`no ${locName} at ${x},${z},${p.level}`);
    if (!locOpOk(p, loc, n)) throw new Error(`${locName} shows no op${n} to this player`);
    H.opLoc(p, x, z, locName, n);
    return drive(p, picks);
}
function connected(level: number, x: number, z: number, tx: number, tz: number, radius = 60): boolean {
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
/** Every placed loc of a type, anywhere. */
function locsOf(name: string): Loc[] {
    const id = LocType.getId(name);
    const out: Loc[] = [];
    for (const zone of ((World.gameMap as any).zonemap.zones as Map<number, any>).values()) {
        for (const loc of zone.getAllLocsSafe()) if (loc.type === id) out.push(loc);
    }
    return out;
}
const qp = (p: Player) => H.getVar(p, 'qp');
// the points every quest varp already set is worth - %qp itself is only recounted on a completion
const qpCounted = (p: Player) => H.runProc(p, '[proc,count_questpoints]')[0];

// =============================================================================== The Hand in the Sand
console.log('THE HAND IN THE SAND');
{
    const p = player('audit5_hits', 2550, 3100);
    p.setLevel(6, 1); // Magic 1 - the guild door is shut to this player; the quest must not need it
    const qp0 = qp(p);
    talk(p, 'handsand_bert', [1]);
    check('Bert: stage 10, the hand and his rota', [gv(p, 'handsand_quest'), H.invCount(p, 'handsand_sandyhand'), H.invCount(p, 'handsand_rota_bert')], [10, 1, 1]);
    // lost the hand: Bert has another
    p.invDel(InvType.INV, ObjType.getId('handsand_sandyhand'), 1);
    talk(p, 'handsand_bert');
    check('lost the hand: Bert hands over another', H.invCount(p, 'handsand_sandyhand'), 1);
    talk(p, 'handsand_guard_captain');
    check('Guard Captain: stage 20, the beer-soaked hand', [gv(p, 'handsand_quest'), H.invCount(p, 'handsand_beerhand')], [20, 1]);
    talk(p, 'handsand_bert');
    check('Bert again: stage 30 (Rarve)', gv(p, 'handsand_quest'), 30);

    // Rarve is inside the Wizards' Guild behind its 66 Magic door
    check('Rarve\'s own spot is not reachable from outside the guild', connected(0, 2605, 3090, 2588, 3087), false);
    p.teleport(2599, 3084, 0);
    H.tick(1);
    op(p, 2598, 3085, 'zogre_outdoor_bell', 1);
    const out = H.npcNear('zogre_human_zavistic_rarve', 2599, 3087, 0)!;
    check('the bell brings Rarve out to a tile you can walk to', [out.x >= 2598, connected(0, 2605, 3090, out.x, out.z)], [true, true]);
    const n0 = World.npcs.filter(n => n && n.isActive && n.type === out.type).length;
    op(p, 2598, 3085, 'zogre_outdoor_bell', 1);
    check('ringing again does not bring a second one', World.npcs.filter(n => n && n.isActive && n.type === out.type).length, n0);
    p.teleport(2600, 3087, 0);
    talk(p, 'zogre_human_zavistic_rarve');
    check('Rarve (outside) wants a name and proof - stage stays 30', gv(p, 'handsand_quest'), 30);

    // Sandy's desk, Brimhaven: take the original rota while he is at the window
    p.teleport(2788, 3172, 0);
    H.tick(1);
    // (drop Bert's rota first: the rotas used to be compared only at the desk, so taking the
    // original without Bert's copy in hand stranded the stage)
    p.invDel(InvType.INV, ObjType.getId('handsand_rota_bert'), 1);
    talk(p, 'handsand_sandy', [2]);
    check('Sandy distracted: at the window', gv(p, 'handsand_sandy_multi'), 1);
    op(p, 2788, 3174, 'handsand_desk', 1);
    check('desk searched: Sandy\'s rota, Sandy back at his desk, no rota of Bert\'s so stage 30', [H.invCount(p, 'handsand_rota_sandy'), gv(p, 'handsand_sandy_multi'), gv(p, 'handsand_quest')], [1, 0, 30]);
    talk(p, 'handsand_bert');
    check('lost Bert\'s rota: he gives another copy', H.invCount(p, 'handsand_rota_bert'), 1);
    // the sand pit
    H.give(p, 'spade');
    p.teleport(2543, 3102, 0);
    H.tick(1);
    useOn(p, 2542, 3103, 'handsand_sandpit_anim', 'spade');
    check('spade in the sand pit: the wizard\'s head', H.invCount(p, 'handsand_wizhead'), 1);
    // Rarve compares the rotas now, then takes the head
    p.teleport(2599, 3084, 0);
    H.tick(1);
    op(p, 2598, 3085, 'zogre_outdoor_bell', 1);
    p.teleport(2600, 3087, 0);
    talk(p, 'zogre_human_zavistic_rarve');
    check('Rarve: rotas compared, head taken, kit given (stage 50)', [gv(p, 'handsand_quest'), H.invCount(p, 'handsand_wizhead'), H.invCount(p, 'handsand_orb_storage'), H.invCount(p, 'handsand_truthserum'), H.invCount(p, 'handsand_scroll_magic')], [50, 0, 1, 1, 1]);

    // Betty and the lens
    p.teleport(3014, 3256, 0);
    H.tick(1);
    talk(p, 'betty');
    check('Betty stands the bottle out: counter multi 1', gv(p, 'handsand_counter_multi'), 1);
    talk(p, 'betty');
    check('Betty again: bottled water and a lens', [H.invCount(p, 'handsand_bottle_water'), H.invCount(p, 'lens')], [1, 1]);
    H.give(p, 'redberries');
    H.give(p, 'white_berries');
    useHeld(p, 'handsand_bottle_water', 'redberries');
    check('bottle used ON the redberries (the pie handler\'s side) makes the juice', [H.invCount(p, 'handsand_redberry_juice'), H.invCount(p, 'redberries')], [1, 0]);
    // lose the juice: Betty starts the chain again
    p.invDel(InvType.INV, ObjType.getId('handsand_redberry_juice'), 1);
    talk(p, 'betty');
    talk(p, 'betty');
    check('juice lost: Betty hands out another bottle', H.invCount(p, 'handsand_bottle_water'), 1);
    H.give(p, 'redberries');
    useHeld(p, 'redberries', 'handsand_bottle_water');
    check('redberries used on the bottle also works', H.invCount(p, 'handsand_redberry_juice'), 1);
    useHeld(p, 'handsand_redberry_juice', 'white_berries');
    check('juice used ON the white berries (the herblore handler\'s side) makes the dye', [H.invCount(p, 'handsand_pink_dye'), H.invCount(p, 'white_berries')], [1, 0]);
    useHeld(p, 'lens', 'handsand_pink_dye');
    check('lens in the dye: rose tinted lens', H.invCount(p, 'handsand_rose_lens'), 1);
    useHeld(p, 'handsand_orb_storage', 'handsand_rose_lens');
    check('lens into the orb: stage 60', [gv(p, 'handsand_quest'), gv(p, 'handsand_serum')], [60, 5]);

    // the coffee
    p.teleport(2788, 3178, 0);
    H.tick(1);
    talk(p, 'handsand_sandy', [2]);
    check('Sandy at the window again', gv(p, 'handsand_sandy_multi'), 1);
    p.teleport(2789, 3177, 0);
    H.tick(1);
    useOn(p, 2789, 3176, 'handsand_coffee_multiloc', 'handsand_truthserum');
    check('serum in the mug: the mug is drunk (multi 1), serum gone, Sandy back', [gv(p, 'handsand_coffee_multi'), H.invCount(p, 'handsand_truthserum'), gv(p, 'handsand_sandy_multi')], [1, 0, 0]);
    talk(p, 'handsand_sandy', [1]);
    talk(p, 'handsand_sandy', [2]);
    check('two questions: still stage 60', gv(p, 'handsand_quest'), 60);
    talk(p, 'handsand_sandy', [3]);
    check('three questions: stage 70 and the orb is recording', [gv(p, 'handsand_quest'), H.invCount(p, 'handsand_orb_recording')], [70, 1]);
    // lose the recording: Rarve resets the interrogation
    p.invDel(InvType.INV, ObjType.getId('handsand_orb_recording'), 1);
    p.teleport(2599, 3084, 0);
    H.tick(1);
    op(p, 2598, 3085, 'zogre_outdoor_bell', 1);
    p.teleport(2600, 3087, 0);
    talk(p, 'zogre_human_zavistic_rarve');
    check('recording lost: Rarve gives a new orb and serum, back to stage 60', [gv(p, 'handsand_quest'), H.invCount(p, 'handsand_orb_storage'), H.invCount(p, 'handsand_truthserum'), gv(p, 'handsand_coffee_multi')], [60, 1, 1, 0]);
    p.teleport(2788, 3178, 0);
    H.tick(1);
    talk(p, 'handsand_sandy', [2]);
    p.teleport(2789, 3177, 0);
    H.tick(1);
    useOn(p, 2789, 3176, 'handsand_coffee_multiloc', 'handsand_truthserum');
    talk(p, 'handsand_sandy', [1]);
    talk(p, 'handsand_sandy', [2]);
    talk(p, 'handsand_sandy', [3]);
    check('re-recorded: stage 70', gv(p, 'handsand_quest'), 70);
    p.teleport(2599, 3084, 0);
    H.tick(1);
    op(p, 2598, 3085, 'zogre_outdoor_bell', 1);
    p.teleport(2600, 3087, 0);
    talk(p, 'zogre_human_zavistic_rarve');
    check('Rarve takes the orb: complete (80), +1 quest point', [gv(p, 'handsand_quest'), qp(p) - qp0], [80, 1]);
    // the journal has text at the end
    H.ifButton(p, 'questlist:handsand');
    H.tick(1);
    check('journal says QUEST COMPLETE', H.ifaces.filter(i => i.who === p.username && i.kind === 'text').some(i => (i.text ?? '').includes('QUEST COMPLETE')), true);
    H.despawn(p);
}

// =============================================================================== One Small Favour
console.log('ONE SMALL FAVOUR');
{
    const p = player('audit5_osf', 2705, 3473);
    const qp0 = qp(p);
    H.fillInv(p);
    talk(p, 'favour_phantuwti_farsight', [1]);
    check('Phantuwti: stage 5 - with a full pack, no scroll', [gv(p, 'onesmallfavour'), H.invCount(p, 'favour_animate_rock')], [5, 0]);
    H.clearInv(p);
    talk(p, 'favour_phantuwti_farsight');
    check('asked again with room: he hands the scroll over', H.invCount(p, 'favour_animate_rock'), 1);

    // up to the weathervane: ground floor ladder, then the first floor one
    p.teleport(2700, 3476, 0);
    H.tick(1);
    op(p, 2699, 3476, 'loc_1750', 1);
    check('ground floor ladder: first floor', p.level, 1);
    op(p, 2699, 3476, 'laddermiddle', 2);
    check('first floor ladder, Climb-up: the weathervane platform on level 3', at(p), [2700, 3476, 3]);
    check('  and the vane is reachable from there', connected(3, p.x, p.z, 2702, 3475) || connected(3, p.x, p.z, 2701, 3476), true);
    op(p, 2702, 3476, 'osf_weathervane', 5);
    check('Search the vane: three broken parts, stage 10', [gv(p, 'onesmallfavour'), H.invCount(p, 'favour_directionals_broken'), H.invCount(p, 'favour_ornament_broken'), H.invCount(p, 'favour_pillar_broken')], [10, 1, 1, 1]);
    // lose one: the vane still has it
    p.invDel(InvType.INV, ObjType.getId('favour_ornament_broken'), 1);
    op(p, 2702, 3476, 'osf_weathervane', 5);
    check('lost the ornament: Search the vane again finds it', H.invCount(p, 'favour_ornament_broken'), 1);
    op(p, 2699, 3476, 'favour_seer_laddertop', 1);
    check('back down the roof ladder: first floor, inside the room', [at(p), connected(1, p.x, p.z, 2701, 3474)], [[2700, 3476, 1], true]);
    op(p, 2699, 3476, 'laddermiddle', 3);
    check('first floor ladder, Climb-down: ground floor', p.level, 0);
    op(p, 2699, 3476, 'loc_1750', 1);
    op(p, 2699, 3476, 'laddermiddle', 1, [1]);
    check('first floor ladder, Climb (menu) -> up: the platform too', at(p), [2700, 3476, 3]);

    // the three craftspeople
    // Jimmy is in the H.A.M. hideout's cell
    check('Jimmy cannot be walked to past the shut door', connected(0, 3149, 9652, 3186, 9608), false);
    p.teleport(3182, 9611, 0);
    H.tick(1);
    op(p, 3183, 9611, 'favour_prisondoor', 1);
    H.tick(2);
    check('Open from outside the cell: in (the door "stops people getting out")', [p.x >= 3183, connected(0, p.x, p.z, 3186, 9608)], [true, true]);
    talk(p, 'favour_jimmy');
    check('Jimmy: pillar mended, stage 20', [H.invCount(p, 'favour_pillar_fixed'), gv(p, 'onesmallfavour')], [1, 20]);
    p.teleport(3183, 9611, 0);
    H.tick(5);
    op(p, 3183, 9611, 'favour_prisondoor', 1);
    H.tick(2);
    check('Open from inside: locked', [p.x >= 3183, lastMes(p)], [true, 'This door is locked.']);
    for (let i = 0; i < 20 && p.x >= 3183; i++) {
        op(p, 3183, 9611, 'favour_prisondoor', 5);
        H.tick(2);
    }
    check('Pick-lock from inside: out again', p.x <= 3182, true);
    H.give(p, 'softclay', 10);
    p.teleport(3087, 3406, 0);
    H.tick(1);
    talk(p, 'favour_tassie_slipcast');
    check('Tassie: ornament mended, stage 30', [H.invCount(p, 'favour_ornament_fixed'), gv(p, 'onesmallfavour')], [1, 30]);
    talk(p, 'favour_tassie_slipcast');
    check('Tassie again: the airtight pot', H.invCount(p, 'favour_airtight_pot'), 1);
    p.teleport(2965, 9812, 0);
    H.tick(1);
    talk(p, 'favour_hammerspike_stoutbeard');
    check('Hammerspike: directionals mended, stage 40', [H.invCount(p, 'favour_directionals_fixed'), gv(p, 'onesmallfavour')], [1, 40]);
    p.teleport(2700, 3476, 3);
    H.tick(1);
    op(p, 2702, 3476, 'osf_weathervane', 5);
    check('all three back on: vane fixed, stage 50', [gv(p, 'weathervanefixed'), gv(p, 'onesmallfavour')], [1, 50]);
    p.teleport(2705, 3473, 0);
    H.tick(1);
    talk(p, 'favour_phantuwti_farsight');
    check('Phantuwti: weather report, stage 60', [H.invCount(p, 'favour_weather_report'), gv(p, 'onesmallfavour')], [1, 60]);

    // the landing lights - eight placements, two of each gem
    for (const g of ['jade', 'opal', 'red_topaz', 'sapphire']) H.give(p, g, 2);
    const lights = ['jade', 'opal', 'redtopaz', 'sapphire'].flatMap(c => locsOf(`osf_multi_landinglight_${c}_1`));
    check('eight light placements on the map', lights.length, 8);
    for (const l of lights) {
        p.teleport(l.x, l.z - 1, 0);
        H.tick(1);
        op(p, l.x, l.z, LocType.get(l.type).debugname!, 5);
    }
    check('all eight gems in: every light bit, the strip lit', [gv(p, 'checklandinglights'), gv(p, 'all_lights_fixed')], [255, 1]);
    p.teleport(2544, 2970, 0);
    H.tick(1);
    talk(p, 'gnormadium_avlafrim');
    check('the pilot takes the report: complete (70), +2 quest points', [gv(p, 'onesmallfavour'), qp(p) - qp0, H.invCount(p, 'favour_weather_report')], [70, 2, 0]);
    H.despawn(p);
}

// =============================================================================== A Tail of Two Cats
console.log('A TAIL OF TWO CATS');
{
    const p = player('audit5_cats', 2918, 3560);
    sv(p, 'fluffs', 6);
    sv(p, 'ics_little_var', 26);
    const qp0 = qpCounted(p);
    talk(p, 'twocats_unferth', [1]);
    check('Unferth: stage 10, his hair long', [gv(p, 'twocats_quest'), gv(p, 'twocats_chores_tidyhuman')], [10, 4]);
    H.equip(p, { front: 'ics_little_amulet_of_catspeak' });
    p.teleport(3230, 3202, 0);
    H.tick(1);
    talk(p, 'twocats_bob_bow_tie');
    check('Bob: stage 20, the chores and a toy mouse', [gv(p, 'twocats_quest'), H.invCount(p, 'twocats_chores'), H.invCount(p, 'twocats_mouse_toy')], [20, 1, 1]);
    p.teleport(2918, 3557, 0);
    H.tick(1);
    op(p, 2917, 3556, 'twocats_bed', 1);
    H.give(p, 'logs');
    H.give(p, 'tinderbox');
    useOn(p, 2919, 3557, 'twocats_fireplace', 'logs');
    useOn(p, 2919, 3557, 'twocats_fireplace', 'tinderbox');
    op(p, 2920, 3556, 'twocats_table', 1);
    H.give(p, 'bucket_milk');
    H.give(p, 'chocolate_cake');
    useOn(p, 2920, 3556, 'twocats_table', 'bucket_milk');
    useOn(p, 2920, 3556, 'twocats_table', 'chocolate_cake');
    talk(p, 'twocats_unferth');
    H.give(p, 'shears');
    for (let i = 0; i < 4; i++) useOnNpc(p, 'twocats_unferth', 'shears');
    H.give(p, 'rake');
    H.give(p, 'potato_seed');
    // the garden is through the back door
    p.teleport(2920, 3560, 0);
    H.tick(1);
    op(p, 2920, 3561, 'loc_1530', 1);
    check('the back door opens onto the garden', connected(0, 2920, 3560, 2920, 3563), true);
    p.teleport(2920, 3563, 0);
    H.tick(1);
    for (let i = 0; i < 3; i++) useOn(p, 2919, 3563, 'twocats_patch', 'rake');
    useOn(p, 2919, 3563, 'twocats_patch', 'potato_seed');
    check('five chores: bed, fire, meal, hair, garden -> stage 30', [gv(p, 'twocats_chores_tidyhouse'), gv(p, 'twocats_chores_warmhuman'), gv(p, 'twocats_chores_feedhuman'), gv(p, 'twocats_chores_tidyhuman'), gv(p, 'twocats_chores_tidygarden'), gv(p, 'twocats_quest')], [1, 2, 5, 0, 4, 30]);
    p.teleport(3230, 3202, 0);
    H.tick(1);
    talk(p, 'twocats_bob_bow_tie');
    check('Bob remembers Robert: stage 40', gv(p, 'twocats_quest'), 40);
    p.teleport(3210, 3494, 0);
    H.tick(1);
    talk(p, 'reldo');
    check('Reldo tells the story', gv(p, 'twocats_reldo'), 1);
    p.teleport(3230, 3202, 0);
    H.tick(1);
    talk(p, 'twocats_bob_bow_tie');
    check('Bob goes home: stage 60', gv(p, 'twocats_quest'), 60);
    p.teleport(2922, 3565, 0);
    H.tick(1);
    talk(p, 'twocats_niete');
    talk(p, 'twocats_unferth');
    check('Unferth says the name: stage 65', gv(p, 'twocats_quest'), 65);
    talk(p, 'twocats_niete');
    check('Neite lifts the curse: stage 70', gv(p, 'twocats_quest'), 70);
    talk(p, 'twocats_niete');
    check('Neite\'s reward: complete (80), +2 quest points, present and amulet', [gv(p, 'twocats_quest'), qp(p) - qp0, H.invCount(p, 'twocats_present'), H.invCount(p, 'twocats_amuletofcatspeak')], [80, 2, 1, 1]);
    H.despawn(p);
}

// =============================================================================== Cook's Assistant
console.log('COOK\'S ASSISTANT - the range');
{
    const range = locsOf('cooksquestrange')[0];
    const cook = H.npcNear('cook', range.x, range.z, 0)!;
    const p = player('audit5_cook', cook.x, cook.z); // in the kitchen; the route finds the range's side
    H.give(p, 'raw_shrimp', 1);
    useOn(p, range.x, range.z, 'cooksquestrange', 'raw_shrimp');
    check('quest not done: the Cook\'s range does not cook', H.invCount(p, 'raw_shrimp'), 1);
    sv(p, 'cookquest', 2);
    useOn(p, range.x, range.z, 'cooksquestrange', 'raw_shrimp');
    for (let t = 0; t < 10; t++) H.tick(1);
    check('quest done: it cooks (the reward)', [H.invCount(p, 'raw_shrimp'), H.invCount(p, 'shrimp') + H.invCount(p, 'burntfish1')], [0, 1]);
    H.despawn(p);
}

// =============================================================================== Gertrude's Cat
console.log('GERTRUDE\'S CAT - the reward kitten and a follower that is already out');
{
    const p = player('audit5_cat1', 3150, 3410);
    H.runProc(p, '[proc,pet_receive_later]', [ObjType.getId('bosspet_kbd_item'), 0]);
    H.tick(2);
    check('a boss pet follows', ObjType.get(H.getVar(p, 'follower_obj')).debugname, 'bosspet_kbd_item');
    sv(p, 'fluffs', 5);
    talk(p, 'gertrude');
    const kittens = ['kittenobject', 'kitten_light', 'kitten_brown', 'kitten_black', 'kitten_browngrey', 'kitten_bluegrey'].filter(n => ObjType.getId(n) !== -1);
    const inPack = [...Array(28).keys()].map(s => p.getInventory(InvType.INV)!.get(s)).filter(o => o && ObjType.get(o.id).category !== -1 && ObjType.get(o.id).debugname?.includes('kitten')).length;
    check('quest complete', gv(p, 'fluffs'), 6);
    check('the boss pet keeps its slot', ObjType.get(H.getVar(p, 'follower_obj')).debugname, 'bosspet_kbd_item');
    check('the kitten went in the pack instead', inPack, 1);
    void kittens;
    H.despawn(p);
    const q = player('audit5_cat2', 3150, 3410);
    sv(q, 'fluffs', 5);
    talk(q, 'gertrude');
    const f = H.getVar(q, 'follower_obj');
    check('with nothing following: complete, and the kitten follows', [gv(q, 'fluffs'), f !== -1 && (ObjType.get(f).debugname ?? '').includes('kitten')], [6, true]);
    H.despawn(q);
}

// =============================================================================== Plague City
console.log('PLAGUE CITY - Edmond after the pipe');
{
    const p = player('audit5_plague', 2514, 9739);
    sv(p, 'elenaquest', 10);
    sv(p, 'plaguecity_can_see_edmond_up_top', 1);
    H.equip(p, { hat: 'gasmask' });
    const e = H.npcNear('edmond_top', 2566, 3331, 0)!;
    check('in the sewer Edmond shows down there, not in the garden', npcOpOk(p, e, 1), false);
    op(p, 2514, 9737, 'plaguesewerpipe_open', 1);
    check('through the pipe: West Ardougne', p.z < 6400, true);
    check('Edmond has gone back up: talkable in his garden again', [gv(p, 'plaguecity_can_see_edmond_up_top'), npcOpOk(p, e, 1)], [0, true]);
    H.despawn(p);
}

console.log(`\n${R.ok} ok, ${R.bad} FAIL`);
process.exit(R.bad ? 1 : 0);
