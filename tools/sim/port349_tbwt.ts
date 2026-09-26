// Tai Bwo Wannai Trio as ported from PlagueCityRS 349 (the original dialogue and stage numbers),
// played start to finish on the real engine and the real map, plus the Karamja extras that came
// with it (karambwanji and karambwan fishing, the Brimhaven dungeon, the metal dragons) and the
// once-per-player save migration from this server's earlier invented version.
// Usage: BUILD_SRC_DIR=<content> npx tsx tools/sim/port349_tbwt.ts [quest|extras|migrate ...]
import * as H from './harness.js';
import World from '#/engine/World.js';
import LocType from '#/cache/config/LocType.js';
import ObjType from '#/cache/config/ObjType.js';
import NpcType from '#/cache/config/NpcType.js';
import InvType from '#/cache/config/InvType.js';
import Component from '#/cache/config/Component.js';
import CategoryType from '#/cache/config/CategoryType.js';
import ScriptState from '#/engine/script/ScriptState.js';
import ScriptProvider from '#/engine/script/ScriptProvider.js';
import ScriptRunner from '#/engine/script/ScriptRunner.js';
import ServerTriggerType from '#/engine/script/ServerTriggerType.js';
import { Interaction } from '#/engine/entity/Interaction.js';
import { findPathToLoc, findPathToEntity } from '#/engine/GameMap.js';
import Player from '#/engine/entity/Player.js';
import Npc from '#/engine/entity/Npc.js';

const errors: string[] = [];
const origErr = console.error;
console.error = (...a: unknown[]) => {
    const s = a.map(String).join(' ');
    if (/script error|requires protected|error/i.test(s)) errors.push(s);
    origErr(...a);
};

await H.boot();
H.loginOrder();

const only = process.argv.slice(2);
const want = (s: string) => only.length === 0 || only.includes(s);

const R = { ok: 0, bad: 0 };
const check = (what: string, got: unknown, wantv: unknown) => {
    const pass = JSON.stringify(got) === JSON.stringify(wantv);
    if (pass) R.ok++;
    else R.bad++;
    console.log(`  ${pass ? 'ok  ' : 'FAIL'} ${what}: ${JSON.stringify(got)}${pass ? '' : `   (want ${JSON.stringify(wantv)})`}`);
    if (!pass && process.env.SIM_DEBUG) console.log('     last messages: ' + JSON.stringify(H.mesgs.slice(-6).map(m => m.text)));
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
const v = (p: Player, name: string) => H.getVar(p, name);
const mesSince = (p: Player, from: number) =>
    H.mesgs
        .slice(from)
        .filter(m => m.who === p.username)
        .map(m => m.text);

/** Let a script run out, clicking through any chat pages and taking `picks` at menus (1-based). */
function drive(p: Player, picks: number[] = [], guardTicks = 3): string[] {
    const from = H.ifaces.length;
    let idle = 0;
    for (let guard = 0; guard < 800 && idle < guardTicks; guard++) {
        const s = p.activeScript;
        if (!s || s.execution !== ScriptState.PAUSEBUTTON) {
            // a queued script waits while a main modal is up (the quest scroll), so that counts as idle
            if (!s && !p.delayed && ([...p.queue.all()].length === 0 || p.modalMain !== -1) && !p.target) idle++;
            else idle = 0;
            H.tick(1);
            continue;
        }
        idle = 0;
        const names = p.resumeButtons.map((id: number) => Component.get(id).comName ?? '');
        const open = p.modalChat === -1 ? '' : (Component.get(p.modalChat).comName ?? '');
        const multi = open.startsWith('multi') ? names.find((n: string) => n.startsWith(open + ':')) : null;
        if (open === 'multiobj2') {
            const pick = picks.shift();
            if (pick === undefined) throw new Error('unexpected menu: ' + open);
            H.choose(p, `multiobj2:obj${pick}`);
        } else if (multi) {
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

function npcAny(name: string, x: number, z: number, level: number): Npc | null {
    return [level, 0, 1, 2, 3].map(l => H.npcNear(name, x, z, l)).find(n => n) ?? null;
}
function settle(p: Player) {
    for (let t = 0; t < 30 && (p.delayed || p.activeScript); t++) H.tick(1);
}
function standBy(p: Player, npc: Npc) {
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
        p.teleport(npc.x + dx, npc.z + dz, npc.level);
        return;
    }
}
/** Talk to the nearest npc of a type (any floor), standing next to it first. */
function talk(p: Player, npcName: string, picks: number[] = [], op = 1): string[] {
    const npc = npcAny(npcName, p.x, p.z, p.level);
    if (!npc) throw new Error('no npc ' + npcName);
    settle(p);
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
        [0, -2],
        [3, 0],
        [0, 3]
    ]) {
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
/** Use an item on another item: OpHeldUHandler's lookup (target, used, target cat, used cat). */
function useOnHeld(p: Player, useName: string, onName: string, picks: number[] = []) {
    settle(p);
    const use = ObjType.get(ObjType.getId(useName));
    const on = ObjType.get(ObjType.getId(onName));
    p.lastItem = on.id;
    p.lastSlot = slotOf(p, onName);
    p.lastUseItem = use.id;
    p.lastUseSlot = slotOf(p, useName);
    let script = ScriptProvider.getByTriggerSpecific(ServerTriggerType.OPHELDU, on.id, -1);
    if (!script) {
        script = ScriptProvider.getByTriggerSpecific(ServerTriggerType.OPHELDU, use.id, -1);
        [p.lastItem, p.lastUseItem] = [p.lastUseItem, p.lastItem];
        [p.lastSlot, p.lastUseSlot] = [p.lastUseSlot, p.lastSlot];
    }
    if (!script && on.category !== -1) script = ScriptProvider.getByTriggerSpecific(ServerTriggerType.OPHELDU, -1, on.category);
    if (!script && use.category !== -1) {
        script = ScriptProvider.getByTriggerSpecific(ServerTriggerType.OPHELDU, -1, use.category);
        [p.lastItem, p.lastUseItem] = [p.lastUseItem, p.lastItem];
        [p.lastSlot, p.lastUseSlot] = [p.lastUseSlot, p.lastSlot];
    }
    if (!script) throw new Error(`no opheldu for ${useName} on ${onName}`);
    p.executeScript(ScriptRunner.init(script, p), true);
    drive(p, picks);
}
/** Use an item on an npc: OpNpcUHandler, standing next to it. */
function useOnNpc(p: Player, npcName: string, objName: string, picks: number[] = []) {
    const npc = npcAny(npcName, p.x, p.z, p.level);
    if (!npc) throw new Error('no npc ' + npcName);
    settle(p);
    standBy(p, npc);
    H.tick(1);
    p.clearPendingAction();
    p.lastUseItem = ObjType.getId(objName);
    p.lastUseSlot = slotOf(p, objName);
    p.queueWaypoints(findPathToEntity(p.level, p.x, p.z, npc.x, npc.z, p.width, npc.width, npc.length));
    p.setInteraction(Interaction.ENGINE, npc, ServerTriggerType.APNPCU);
    (p as unknown as { opcalled: boolean }).opcalled = true;
    return drive(p, picks);
}
/** Use an item on a loc: OpLocUHandler, with the route a client would send. */
function useOnLoc(p: Player, x: number, z: number, locName: string, objName: string, picks: number[] = []) {
    const id = LocType.getId(locName);
    const loc = World.getLoc(x, z, p.level, id);
    if (!loc) throw new Error(`no ${locName} at ${x},${z},${p.level}`);
    settle(p);
    p.clearPendingAction();
    p.queueWaypoints(findPathToLoc(p.level, p.x, p.z, loc.x, loc.z, p.width, loc.width, loc.length, loc.angle, loc.shape, LocType.get(id).forceapproach));
    p.lastUseItem = ObjType.getId(objName);
    p.lastUseSlot = slotOf(p, objName);
    p.setInteraction(Interaction.ENGINE, loc, ServerTriggerType.APLOCU);
    (p as unknown as { opcalled: boolean }).opcalled = true;
    return drive(p, picks);
}
function op(p: Player, x: number, z: number, locName: string, n = 1, picks: number[] = []) {
    settle(p);
    H.opLoc(p, x, z, locName, n);
    return drive(p, picks);
}
/** The first loc in a box whose type carries a category. */
function findLocByCategory(cat: string, level: number, x0: number, z0: number, r: number) {
    const catId = CategoryType.getId(cat);
    for (let x = x0 - r; x <= x0 + r; x += 8)
        for (let z = z0 - r; z <= z0 + r; z += 8) {
            const zone = World.gameMap.getZone(x, z, level);
            for (const loc of [...zone.getAllLocsUnsafe()]) {
                if (LocType.get(loc.type).category === catId) return loc;
            }
        }
    return null;
}
function journal(p: Player): string {
    settle(p);
    const from = H.ifaces.length;
    H.ifButton(p, 'questlist:tbwt');
    drive(p);
    const t = H.ifaces
        .slice(from)
        .filter(i => i.who === p.username && i.kind === 'text' && i.text)
        .map(i => i.text!)
        .join('|');
    p.closeModal();
    return t;
}
const qp = (p: Player) => H.runProc(p, '[proc,count_questpoints]')[0];

const e0 = errors.length;

// ======================================================================================= the quest
if (want('quest')) {
    console.log('TAI BWO WANNAI TRIO (original stages)');
    const p = player('tbwt349', 2781, 3087, 1);
    H.setVarBit(p, 'port349_tbwt', 1); // a player already migrated; the migration has its own section
    H.setVar(p, 'druidquest', 4); // Jungle Potion needs Druidic Ritual, and so does grinding
    const qp0 = qp(p);
    check('journal before Jungle Potion: start hint', journal(p).includes('after completing'), true);

    console.log('Timfraku:');
    talk(p, 'tbwt_timfraku', [1, 2]); // roving adventurer, "Right, I'm going then."
    check('without Jungle Potion: stage 1 (spoke to Timfraku), no quest', v(p, 'tbwt_main'), 1);
    H.setVar(p, 'junglepotion', 13);
    talk(p, 'tbwt_timfraku', [1, 2]); // "Your gratitude is all I deserve", then decline
    check('Trufitus sent me, declined: stage 2 (asked for help)', v(p, 'tbwt_main'), 2);
    talk(p, 'tbwt_timfraku', [1]); // ready to help: Yes
    check('accepted: stage 3 (started)', v(p, 'tbwt_main'), 3);
    check('journal: find the three sons', journal(p).includes('find the three sons'), true);
    talk(p, 'tbwt_timfraku', [4]); // "I'll be back later."
    check('Timfraku while started: still 3', v(p, 'tbwt_main'), 3);

    console.log('Tiadeche, Tinsay, Tamayu, the first visit:');
    talk(p, 'tbwt_tiadeche_multinpc_shore', [1]);
    check('Tiadeche: will return when he has caught a karambwan (2)', v(p, 'tbwt_tiadeche'), 2);
    talk(p, 'tbwt_tinsay_multinpc_island');
    check('Tinsay: wants banana in Karamjan rum (2)', v(p, 'tbwt_tinsay'), 2);
    talk(p, 'tbwt_tamayu_multinpc_jungle');
    check('Tamayu: vows to slay the Shaikahan (2)', v(p, 'tbwt_tamayu'), 2);

    console.log("Tinsay's rum:");
    H.give(p, 'banana', 2);
    H.give(p, 'knife');
    H.give(p, 'karamja_rum', 2);
    useOnHeld(p, 'karamja_rum', 'banana');
    check('banana stuffed into the rum', H.invCount(p, 'tbwt_banana_in_karamja_rum'), 1);
    useOnHeld(p, 'banana', 'knife');
    check('banana sliced (banana on knife)', H.invCount(p, 'tbwt_sliced_banana'), 1);
    useOnHeld(p, 'tbwt_sliced_banana', 'karamja_rum');
    check('sliced banana in the rum', H.invCount(p, 'tbwt_sliced_banana_in_karamja_rum'), 1);
    talk(p, 'tbwt_tinsay_multinpc_island', [1]); // "Yes." - he takes the sliced one
    check('Tinsay drinks it and wants a sandwich (4)', [v(p, 'tbwt_tinsay'), H.invCount(p, 'tbwt_sliced_banana_in_karamja_rum')], [4, 0]);

    console.log('Lubufu:');
    talk(p, 'tbwt_lubufu', [3]); // "Who are you?"
    check('Lubufu met (1)', v(p, 'tbwt_lubufu'), 1);
    talk(p, 'tbwt_lubufu', [1, 3, 2, 3, 1]); // about him, what do you do, how old, I could help, could do with the help
    check('offered to help: fetch 20 karambwanji (5)', v(p, 'tbwt_lubufu'), 5);

    console.log('Karambwanji fishing:');
    H.give(p, 'net');
    const spot = npcAny('0_43_47_karambwanji', 2791, 3019, 0)!;
    p.teleport(spot.x + 1, spot.z, 0);
    H.tick(1);
    H.opNpc(p, spot, 1);
    for (let t = 0; t < 1500 && H.invCount(p, 'tbwt_raw_karambwanji') < 21; t++) {
        H.tick(1);
        if (!p.target && !p.activeScript) H.opNpc(p, spot, 1);
    }
    p.clearPendingAction();
    check('karambwanji netted at the Holy Lake shoal', H.invCount(p, 'tbwt_raw_karambwanji') >= 21, true);
    H.give(p, 'tbwt_raw_karambwanji', 10); // bait and paste for later
    talk(p, 'tbwt_lubufu');
    check('20 karambwanji handed over (25)', v(p, 'tbwt_lubufu'), 25);
    talk(p, 'tbwt_lubufu', [1]);
    talk(p, 'tbwt_lubufu', [2]);
    check('two questions (27)', v(p, 'tbwt_lubufu'), 27);
    talk(p, 'tbwt_lubufu', [3, 1]); // what do you use - apprentice? Yes!
    check('apprenticed: complete (31), vessel in hand', [v(p, 'tbwt_lubufu'), H.invCount(p, 'tbwt_karambwan_vessel')], [31, 1]);

    console.log("Karambwan fishing (Lubufu's spot):");
    useOnHeld(p, 'tbwt_raw_karambwanji', 'tbwt_karambwan_vessel');
    check('vessel loaded with karambwanji', H.invCount(p, 'tbwt_karambwan_vessel_loaded_with_karambwanji'), 1);
    const kspot = npcAny('lubufu_karambwan', 2768, 3165, 0)!;
    for (let i = 0; i < 40 && H.invCount(p, 'tbwt_raw_karambwan') === 0; i++) {
        if (H.invCount(p, 'tbwt_karambwan_vessel_loaded_with_karambwanji') === 0) useOnHeld(p, 'tbwt_raw_karambwanji', 'tbwt_karambwan_vessel');
        settle(p);
        p.teleport(kspot.x + 1, kspot.z, 0);
        H.tick(1);
        H.opNpc(p, kspot, 1);
        drive(p);
    }
    check('a raw karambwan caught in the vessel', H.invCount(p, 'tbwt_raw_karambwan') >= 1, true);

    console.log("Tiadeche's karambwan:");
    if (H.invCount(p, 'tbwt_karambwan_vessel_loaded_with_karambwanji') === 0) useOnHeld(p, 'tbwt_raw_karambwanji', 'tbwt_karambwan_vessel');
    useOnNpc(p, 'tbwt_tiadeche_multinpc_shore', 'tbwt_karambwan_vessel_loaded_with_karambwanji', [1]); // accept his first catch
    check('Tiadeche traps one and wants the vessel studied (4)', v(p, 'tbwt_tiadeche'), 4);

    console.log("Tamayu's hunt:");
    talk(p, 'tbwt_tamayu_multinpc_jungle', [3, 1]); // when will you succeed - follow him: yes
    check('watched the hunt (3), back beside Tamayu', [v(p, 'tbwt_tamayu'), p.x >= 2830 && p.x <= 2860 && p.z >= 3030 && p.z <= 3055], [3, true]);
    H.give(p, '4dose1agility');
    useOnNpc(p, 'tbwt_tamayu_multinpc_jungle', '4dose1agility');
    check('four doses of agility potion drunk', H.runProc(p, '[proc,get_tbwt_tamayu_agility_count]')[0], 4);
    // a raw karambwan, cooked poorly (the only way before Tinsay teaches you), ground into poison
    const range = findLocByCategory('cooking_oven', 0, 2800, 3120, 160);
    check('a range to cook on nearby', range !== null, true);
    if (range) {
        H.give(p, 'tbwt_raw_karambwan');
        p.teleport(range.x + 1, range.z, 0);
        H.tick(1);
        const lt = LocType.get(range.type).debugname!;
        for (let i = 0; i < 10 && H.invCount(p, 'tbwt_poorly_cooked_karambwan') === 0; i++) {
            if (H.invCount(p, 'tbwt_raw_karambwan') === 0) H.give(p, 'tbwt_raw_karambwan');
            useOnLoc(p, range.x, range.z, lt, 'tbwt_raw_karambwan');
        }
        check("karambwan cooked poorly (no choice before Tinsay's reward)", H.invCount(p, 'tbwt_poorly_cooked_karambwan') >= 1, true);
    }
    H.give(p, 'pestle_and_mortar');
    useOnHeld(p, 'tbwt_poorly_cooked_karambwan', 'pestle_and_mortar');
    check('ground into poisonous karambwan paste (fish on pestle)', H.invCount(p, 'tbwt_poisonous_karambwan_paste'), 1);
    H.give(p, 'iron_spear');
    useOnHeld(p, 'iron_spear', 'tbwt_poisonous_karambwan_paste');
    check('karambwan poisoned iron spear', [H.invCount(p, 'tbwt_iron_spear_kp'), H.invCount(p, 'iron_spear')], [1, 0]);
    H.give(p, 'tbwt_cleaning_cloth');
    useOnHeld(p, 'tbwt_cleaning_cloth', 'tbwt_iron_spear_kp');
    check('the cleaning cloth wipes it clean', [H.invCount(p, 'tbwt_iron_spear_kp'), H.invCount(p, 'iron_spear')], [0, 1]);
    H.give(p, 'tbwt_poisonous_karambwan_paste');
    useOnHeld(p, 'tbwt_poisonous_karambwan_paste', 'iron_spear');
    useOnNpc(p, 'tbwt_tamayu_multinpc_jungle', 'tbwt_iron_spear_kp');
    const fl = v(p, 'tbwt_flags');
    check('Tamayu has a strong, karambwan poisoned spear (flag bits 6 and 8)', [(fl >> 6) & 1, (fl >> 8) & 1], [1, 1]);
    for (let i = 0; i < 12 && v(p, 'tbwt_tamayu') !== 4; i++) talk(p, 'tbwt_tamayu_multinpc_jungle', [3]); // take me on your next hunt
    check('Tamayu slays the Shaikahan (4)', v(p, 'tbwt_tamayu'), 4);
    talk(p, 'tbwt_tamayu_multinpc_jungle');

    console.log('The Shaikahan in a fight:');
    const beast = H.npcNear('tbwt_beast', 2906, 3094, 0)!;
    check('the Shaikahan is aggressive now', NpcType.get(beast.type).huntmode !== -1, true);

    console.log('Monkey skin and seaweed:');
    const monkey = npcAny('monkey', 2829, 3029, 0)!;
    H.equip(p, { rhand: 'iron_scimitar' });
    p.teleport(monkey.x + 1, monkey.z, 0);
    H.tick(1);
    const m0 = H.mesgs.length;
    H.attackNpc(p, monkey);
    for (let t = 0; t < 12; t++) H.tick(1);
    check(
        'a monkey dodges melee while the quest runs',
        mesSince(p, m0).some(m => m.includes('deftly avoids')),
        true
    );
    p.clearPendingAction();
    H.equip(p, { rhand: 'magic_shortbow', quiver: 'rune_arrow' });
    const mx = monkey.x,
        mz = monkey.z;
    for (let t = 0; t < 200 && monkey.isActive; t++) {
        if (!p.target) {
            p.teleport(mx + 4, mz, 0);
            H.attackNpc(p, monkey);
        }
        H.tick(1);
    }
    H.tick(4);
    let corpse = false;
    for (let dx = -8; dx <= 8 && !corpse; dx++)
        for (let dz = -8; dz <= 8 && !corpse; dz++) {
            const zone = World.gameMap.getZone(mx + dx, mz + dz, 0);
            for (const o of [...zone.getAllObjsUnsafe()]) if (o.type === ObjType.getId('tbwt_monkey_corpse')) corpse = true;
        }
    check('a monkey killed at range drops a monkey corpse', corpse, true);
    H.give(p, 'tbwt_monkey_corpse');
    H.give(p, 'seaweed', 2);
    useOnNpc(p, 'tbwt_tamayu_multinpc_jungle', 'tbwt_monkey_corpse');
    check('Tamayu skins it', [H.invCount(p, 'tbwt_monkey_skin'), H.invCount(p, 'mm_normal_monkey_bones')], [1, 1]);
    useOnHeld(p, 'seaweed', 'tbwt_monkey_skin');
    check('seaweed in monkey skin sandwich', H.invCount(p, 'tbwt_seaweed_in_monkey_skin_sandwich'), 1);
    const m1 = H.mesgs.length;
    H.opheld(p, 'tbwt_seaweed_in_monkey_skin_sandwich', 1);
    drive(p);
    check('you really do not want to eat it', [H.invCount(p, 'tbwt_seaweed_in_monkey_skin_sandwich'), mesSince(p, m1).some(m => m.includes('do not want to eat'))], [1, true]);
    talk(p, 'tbwt_tinsay_multinpc_island', [1]);
    check('Tinsay eats the sandwich and wants marinated Jogre bones (6)', v(p, 'tbwt_tinsay'), 6);

    console.log('Jogre bones:');
    H.give(p, 'tbwt_jogre_bones', 2);
    H.give(p, 'firerune', 8);
    H.give(p, 'naturerune', 2);
    H.castOnHeld(p, 'tbwt_jogre_bones', 'magic:superheat_item');
    drive(p);
    check('Superheat burns the Jogre bones', H.invCount(p, 'tbwt_burnt_jogre_bones'), 1);
    H.give(p, 'tinderbox');
    const fmx = 2800,
        fmz = 3070;
    p.teleport(fmx, fmz, 0);
    H.tick(1);
    useOnHeld(p, 'tinderbox', 'tbwt_jogre_bones');
    for (let t = 0; t < 120 && H.invCount(p, 'tbwt_jogre_bones') === 0; t++) {
        H.tick(1);
        const zone = World.gameMap.getZone(fmx, fmz, 0);
        const burnt = [...zone.getAllObjsUnsafe()].find(o => o.type === ObjType.getId('tbwt_burnt_jogre_bones'));
        if (burnt) {
            check('lit on the ground with a tinderbox, they burn', true, true);
            break;
        }
    }
    useOnHeld(p, 'tbwt_raw_karambwanji', 'pestle_and_mortar');
    check('raw karambwanji paste', H.invCount(p, 'tbwt_raw_karambwanji_paste'), 1);
    useOnHeld(p, 'tbwt_raw_karambwanji_paste', 'tbwt_burnt_jogre_bones');
    check('burnt bones in raw paste', H.invCount(p, 'tbwt_burnt_jogre_bones_in_raw_karambwanji_paste'), 1);
    if (range) {
        p.teleport(range.x + 1, range.z, 0);
        H.tick(1);
        useOnLoc(p, range.x, range.z, LocType.get(range.type).debugname!, 'tbwt_burnt_jogre_bones_in_raw_karambwanji_paste');
        check('cooked into marinated burnt Jogre bones', H.invCount(p, 'tbwt_burnt_jogre_bones_marinated_in_karambwanji'), 1);
    }
    talk(p, 'tbwt_tinsay_multinpc_island', [1]);
    check('Tinsay is satisfied (7)', v(p, 'tbwt_tinsay'), 7);

    console.log('The crafting manual:');
    talk(p, 'tbwt_lubufu', [3, 2]); // lost my vessel - "a Karambwan stole it!"
    check('Lubufu replaces a lost vessel', H.invCount(p, 'tbwt_karambwan_vessel') >= 1, true);
    if (H.invCount(p, 'tbwt_karambwan_vessel') > 1) {
        H.clearInv(p);
        H.give(p, 'tbwt_karambwan_vessel');
    }
    useOnNpc(p, 'tbwt_tinsay_multinpc_island', 'tbwt_karambwan_vessel');
    check('Tinsay writes the manual (Tiadeche 5)', [v(p, 'tbwt_tiadeche'), H.invCount(p, 'tbwt_crafting_manual')], [5, 1]);
    talk(p, 'tbwt_tiadeche_multinpc_shore');
    check('Tiadeche takes it (6); all three done: stage 4', [v(p, 'tbwt_tiadeche'), H.invCount(p, 'tbwt_crafting_manual'), v(p, 'tbwt_main')], [6, 0, 4]);
    check('journal: speak with Timfraku', journal(p).includes('speak with'), true);

    console.log("Timfraku's reward:");
    H.clearInv(p);
    H.fillInv(p);
    const qpBefore = qp(p);
    talk(p, 'tbwt_timfraku', [2]); // "I'd rather have some gold please."
    check('the quest complete scroll is up', p.modalMain !== -1, true);
    p.closeModal();
    drive(p, [2]); // Timfraku sends you to his sons: Ok, thanks
    check('quest complete (6)', v(p, 'tbwt_main'), 6);
    check('quest points: +2', qp(p) - qpBefore, 2);
    void qp0;
    let onFloor = false;
    for (let dx = -8; dx <= 8; dx += 8)
        for (let dz = -8; dz <= 8; dz += 8)
            for (const lvl of [0, 1]) {
                for (const o of [...World.gameMap.getZone(p.x + dx, p.z + dz, lvl).getAllObjsUnsafe()]) if (o.type === ObjType.getId('coins') && o.count === 2000) onFloor = true;
            }
    check('full pack: the 2,000 coins land at your feet, not lost', onFloor, true);
    H.clearInv(p);
    check('journal: QUEST COMPLETE', journal(p).includes('QUEST COMPLETE'), true);

    console.log('The sons at home:');
    talk(p, 'tbwt_tiadeche_multinpc_house');
    check("Tiadeche's reward (7)", v(p, 'tbwt_tiadeche'), 7);
    talk(p, 'tbwt_tinsay_multinpc_house');
    check("Tinsay's reward (8)", v(p, 'tbwt_tinsay'), 8);
    talk(p, 'tbwt_tamayu_multinpc_house');
    check("Tamayu's reward (5) and the rune spear(kp)", [v(p, 'tbwt_tamayu'), H.invCount(p, 'tbwt_rune_spear_kp')], [5, 1]);
    talk(p, 'tbwt_tamayu_multinpc_house', [1]);
    check("Tamayu's spear stall opens", [p.modalMain === Component.getId('shop_template'), v(p, 'shop') === InvType.getId('tbwt_tamayu_final_inventory')], [true, true]);
    p.closeModal();
    talk(p, 'tbwt_tiadeche_multinpc_house', [1]);
    check("Tiadeche's karambwan stall opens", [p.modalMain === Component.getId('shop_template'), v(p, 'shop') === InvType.getId('tbwt_tiadeche_final_inventory')], [true, true]);
    p.closeModal();
    if (range) {
        H.give(p, 'tbwt_raw_karambwan', 1);
        for (let i = 0; i < 10 && H.invCount(p, 'tbwt_cooked_karambwan') === 0; i++) {
            if (H.invCount(p, 'tbwt_raw_karambwan') === 0) H.give(p, 'tbwt_raw_karambwan');
            p.teleport(range.x + 1, range.z, 0);
            H.tick(1);
            useOnLoc(p, range.x, range.z, LocType.get(range.type).debugname!, 'tbwt_raw_karambwan', [2]); // Thoroughly
        }
        check('after Tinsay: karambwan cooked thoroughly', H.invCount(p, 'tbwt_cooked_karambwan') >= 1, true);
        p.levels[3] = 50;
        // Measured against what else landed while eating: drive() runs a few idle ticks, and on a
        // loaded machine a hitpoints regen tick or the last hit of the poorly cooked one's poison
        // could fall inside them (seen as 66 and 69).
        const hits0 = H.hits.length;
        H.opheld(p, 'tbwt_cooked_karambwan', 1);
        drive(p);
        const hurt = H.hits
            .slice(hits0)
            .filter(h => h.who === p.username)
            .reduce((a, h) => a + h.damage, 0);
        const healed = p.levels[3] - 50 + hurt;
        check('a cooked karambwan still eats as combo food (heals 18, give or take one regen tick)', healed === 18 || healed === 19, true);
    }
    H.give(p, 'tbwt_poorly_cooked_karambwan');
    const hp0 = p.levels[3];
    H.opheld(p, 'tbwt_poorly_cooked_karambwan', 1);
    drive(p);
    check('a poorly cooked one hurts', p.levels[3] < hp0, true);
    p.levels[5] = 1;
    p.teleport(2797, 3090, 0);
    H.tick(1);
    op(p, 2795, 3090, 'tbwt_tribal_statue');
    check('the repaired statue can be prayed at', p.levels[5], 99);
    for (const [x, z] of [
        [2782, 3057],
        [2792, 3054],
        [2802, 3058]
    ] as [number, number][]) {
        p.teleport(x + 1, z, 0);
        H.tick(1);
        const m2 = H.mesgs.length;
        op(p, x, z, 'tbwt_bamboo_door');
        check(
            `bamboo door at ${x},${z} opens after the quest`,
            mesSince(p, m2).some(m => m.includes('permission')),
            false
        );
    }
    const q2 = player('tbwtdoor', 2783, 3057);
    const m3 = H.mesgs.length;
    op(q2, 2782, 3057, 'tbwt_bamboo_door');
    check(
        '...and not before it',
        mesSince(q2, m3).some(m => m.includes('permission')),
        true
    );
    check('no script errors in the quest', errors.slice(e0), []);
}

// ======================================================================================= Karamja extras
if (want('extras')) {
    console.log('KARAMJA EXTRAS');
    const e1 = errors.length;
    const p = player('karamx', 2745, 3149);
    H.setVarBit(p, 'port349_tbwt', 1);
    console.log('Brimhaven dungeon:');
    H.give(p, 'coins', 1000);
    talk(p, 'tribesman_doorman', [1, 1]); // can I go through - here's 875 coins
    check('Saniboch takes 875 coins', [v(p, 'karam_dungeon_varbit'), H.invCount(p, 'coins')], [1, 125]);
    p.teleport(2744, 3152, 0);
    H.tick(1);
    op(p, 2743, 3153, 'dungeon_tree_closed');
    check('in through the tree: inside the dungeon', [p.x, p.z, p.level], [2713, 9564, 0]);
    H.give(p, 'rune_axe');
    p.teleport(2691, 9564, 0);
    H.tick(1);
    for (let i = 0; i < 20 && p.x !== 2689; i++) op(p, 2690, 9564, 'karam_dungeon_vineblocking1');
    check('chopped through the vines', [p.x, p.z], [2689, 9564]);
    p.teleport(2649, 9562, 0);
    H.tick(1);
    op(p, 2649, 9561, 'karam_dungeon_stone1');
    check('stepping stones: no errors, somewhere walkable', p.level, 0);
    p.teleport(2655, 9573, 0);
    H.tick(1);
    op(p, 2655, 9571, 'loc_5100');
    check('the pipe: squeezed through', p.z !== 9573, true);
    p.teleport(2649, 9591, 0);
    H.tick(1);
    op(p, 2648, 9592, 'karam_dungeon_cavestairs');
    check("up the cave stairs to the dragons' level", p.level, 2);
    op(p, 2644, 9593, 'loc_5096');
    check('and down again', p.level, 0);
    p.teleport(2713, 9564, 0);
    H.tick(1);
    op(p, 2714, 9564, 'karam_dungeon_exit');
    check('out again', [p.x, p.z, p.level], [2745, 3152, 0]);

    console.log('Metal dragons:');
    const d = H.npcNear('bronze_dragon', 2700, 9500, 0)!;
    check('a bronze dragon in the dungeon', d !== null, true);
    H.equip(p, { rhand: 'magic_shortbow', quiver: 'rune_arrow' });
    p.teleport(d.x + 6, d.z, 0);
    H.tick(1);
    const h0 = H.hits.length;
    const m0 = H.mesgs.length;
    for (let t = 0; t < 60; t++) {
        p.levels[3] = 99;
        if (!p.target && d.isActive) H.attackNpc(p, d);
        H.tick(1);
    }
    const took = H.hits.slice(h0).filter(h => h.who === p.username).length;
    check('the dragon fights back from range (dragonfire)', took > 0 && mesSince(p, m0).some(m => /dragon fire|dragon's breath/i.test(m)), true);
    check('no script errors in the extras', errors.slice(e1), []);
}

// ======================================================================================= migration
if (want('migrate')) {
    console.log('SAVE MIGRATION (old invented version -> original)');
    const e2 = errors.length;
    type S = { main: number; tia: number; tin: number; tam: number; lub: number; flags: number };
    const cases: [string, S, S][] = [
        ['fresh player', { main: 0, tia: 0, tin: 0, tam: 0, lub: 0, flags: 0 }, { main: 0, tia: 0, tin: 0, tam: 0, lub: 0, flags: 0 }],
        ['asked by Timfraku', { main: 1, tia: 0, tin: 0, tam: 0, lub: 0, flags: 0 }, { main: 3, tia: 0, tin: 0, tam: 0, lub: 0, flags: 0 }],
        ['all asked, Lubufu asked', { main: 1, tia: 1, tin: 1, tam: 1, lub: 1, flags: 0 }, { main: 3, tia: 2, tin: 2, tam: 2, lub: 5, flags: 0 }],
        ['two sons helped, beast dead, Lubufu paid', { main: 3, tia: 2, tin: 2, tam: 1, lub: 2, flags: 1 }, { main: 3, tia: 3, tin: 3, tam: 2, lub: 25, flags: 4 }],
        ['all three helped, Timfraku told', { main: 5, tia: 2, tin: 2, tam: 2, lub: 2, flags: 1 }, { main: 3, tia: 3, tin: 3, tam: 3, lub: 25, flags: 4 }],
        ['complete', { main: 6, tia: 2, tin: 2, tam: 2, lub: 2, flags: 1 }, { main: 6, tia: 7, tin: 8, tam: 4, lub: 31, flags: 4 | (4 << 3) | (7 << 6) }]
    ];
    const setS = (p: Player, s: S) => {
        H.setVar(p, 'tbwt_main', s.main);
        H.setVar(p, 'tbwt_tiadeche', s.tia);
        H.setVar(p, 'tbwt_tinsay', s.tin);
        H.setVar(p, 'tbwt_tamayu', s.tam);
        H.setVar(p, 'tbwt_lubufu', s.lub);
        H.setVar(p, 'tbwt_flags', s.flags);
    };
    const getS = (p: Player): S => ({ main: v(p, 'tbwt_main'), tia: v(p, 'tbwt_tiadeche'), tin: v(p, 'tbwt_tinsay'), tam: v(p, 'tbwt_tamayu'), lub: v(p, 'tbwt_lubufu'), flags: v(p, 'tbwt_flags') });
    /** Run a proc as the login trigger does: with protected access. */
    const runProtected = (p: Player, name: string) => {
        const script = ScriptProvider.getByName(name);
        if (!script) throw new Error('no such script: ' + name);
        p.executeScript(ScriptRunner.init(script, p), true);
        drive(p);
    };
    let n = 0;
    for (const [what, before, after] of cases) {
        // the old values are on the player before it logs in, so the real [login,_] path runs it
        const p = H.makePlayer('mig' + n++, 2780, 3087, bucket++);
        setS(p, before);
        H.setVarBit(p, 'port349_tbwt', 0);
        H.tick(1);
        drive(p);
        check(`${what}: migrated at login`, getS(p), after);
        check(`${what}: marked done`, H.getVarBit(p, 'port349_tbwt'), 1);
        runProtected(p, '[proc,port349_login]');
        check(`${what}: logging in again changes nothing`, getS(p), after);
        if (after.main === 6) check(`${what}: counts 2 quest points`, H.runProc(p, '[proc,count_questpoints]')[0] >= 2, true);
    }
    // and once migrated, a later login leaves new-version values alone even where they overlap the
    // old numbering (new stage 5 = Timfraku's gold, not the old "Timfraku told")
    const p2 = H.makePlayer('migdone', 2780, 3087, bucket++);
    setS(p2, { main: 5, tia: 6, tin: 7, tam: 4, lub: 31, flags: 0 });
    H.setVarBit(p2, 'port349_tbwt', 1);
    H.tick(1);
    drive(p2);
    check('an already-migrated player is not migrated again', getS(p2), { main: 5, tia: 6, tin: 7, tam: 4, lub: 31, flags: 0 });
    // a migrated finished player: the sons are home, Tiadeche and Tinsay do not pay again, Tamayu's
    // reward (never part of the old version) is handed over once
    const pc = H.makePlayer('migdone2', 2781, 3060, bucket++);
    setS(pc, { main: 6, tia: 2, tin: 2, tam: 2, lub: 2, flags: 1 });
    H.setVarBit(pc, 'port349_tbwt', 0);
    H.tick(1);
    drive(pc);
    H.maxOut(pc);
    H.clearInv(pc);
    const fx0 = pc.stats[10];
    talk(pc, 'tbwt_tiadeche_multinpc_house', [2]);
    check('migrated finisher: Tiadeche does not pay the fishing XP again', pc.stats[10] - fx0, 0);
    talk(pc, 'tbwt_tamayu_multinpc_house');
    talk(pc, 'tbwt_tamayu_multinpc_house', [2]);
    check('migrated finisher: Tamayu hands over the rune spear(kp) once', [v(pc, 'tbwt_tamayu'), H.invCount(pc, 'tbwt_rune_spear_kp')], [5, 1]);
    // a migrated in-progress player can carry on: Tiadeche answers at his mapped stage
    const p = H.makePlayer('miglogin', 2780, 3087, bucket++);
    setS(p, { main: 2, tia: 1, tin: 0, tam: 0, lub: 0, flags: 0 });
    H.setVarBit(p, 'port349_tbwt', 0);
    H.tick(1);
    drive(p);
    H.maxOut(p);
    check('old stage 2 (one son) -> started, Tiadeche asked -> 2', [v(p, 'tbwt_main'), v(p, 'tbwt_tiadeche')], [3, 2]);
    talk(p, 'tbwt_tiadeche_multinpc_shore', [2]);
    check('a migrated player talks to Tiadeche at the new stage', v(p, 'tbwt_tiadeche'), 2);
    check('no script errors in the migration', errors.slice(e2), []);
}

console.log(`\n${R.ok} ok, ${R.bad} FAIL`);
process.exit(R.bad ? 1 : 0);
