// MOURNING'S END PART II, THE SECOND HALF - the one the quest did not have. It used to end when
// the light left the hole in the west wall; the guide ends it with a crystal, charged at the Death
// Altar, going back into the black crystal at the top of the temple.
//
// Everything here was already in the cache and standing in the world with no trigger on it: five
// searchable corpses in the cave, Edern's journal, the black crystal and its two states, Thorgel,
// his item list and the twenty-one varbits behind it, the ruins beside him and the altar through
// them. This drives all of it through the real triggers.
//
//   npx tsx tools/sim/templealtar.ts
import * as H from './harness.js';
import Player from '#/engine/entity/Player.js';
import World from '#/engine/World.js';
import LocType from '#/cache/config/LocType.js';
import ObjType from '#/cache/config/ObjType.js';
import InvType from '#/cache/config/InvType.js';
import NpcType from '#/cache/config/NpcType.js';
import VarBitType from '#/cache/config/VarBitType.js';
import Component from '#/cache/config/Component.js';
import ScriptState from '#/engine/script/ScriptState.js';
import ServerTriggerType from '#/engine/script/ServerTriggerType.js';
import { Interaction } from '#/engine/entity/Interaction.js';
import { findPathToLoc, findPathToEntity, isFlagged } from '#/engine/GameMap.js';
import { CollisionFlag } from '#/engine/routefinder/index.js';

await H.boot();

const R = { ok: 0, bad: 0 };
const check = (what: string, got: unknown, want: unknown) => {
    const pass = JSON.stringify(got) === JSON.stringify(want);
    if (pass) R.ok++;
    else R.bad++;
    console.log(`  ${pass ? 'ok  ' : 'FAIL'} ${what}: ${JSON.stringify(got)}${pass ? '' : `   (want ${JSON.stringify(want)})`}`);
};
const v = (p: Player, n: string) => (VarBitType.getByName(n) ? H.getVarBit(p, n) : H.getVar(p, n));
const set = (p: Player, n: string, val: number) => (VarBitType.getByName(n) ? H.setVarBit(p, n, val) : H.setVar(p, n, val));
const standing = (p: Player) => !isFlagged(p.x, p.z, p.level, CollisionFlag.WALK_BLOCKED);
const B = [29 * 64, 72 * 64];
const T = (x: number, z: number) => [B[0] + x, B[1] + z] as [number, number];

function settle(p: Player, picks: number[] = [], max = 300) {
    let idle = 0;
    for (let g = 0; g < max; g++) {
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

// 1925,4641 is the one open tile beside the first corpse: the cave is narrow and 1925,4643 - the
// obvious tile north of it - is solid rock, which the engine answers with "I can't reach that!"
const p: any = H.makePlayer('templealtar', 1925, 4641);
H.tick(1);
p.teleport(1925, 4641, 0);
H.tick(1);
H.maxOut(p);
H.clearInv(p);
H.tick(2);
p.closeModal();

const opLoc = (x: number, z: number, name: string, op = 1, picks: number[] = []) => {
    H.opLoc(p, x, z, name, op);
    settle(p, picks);
};
function slotOf(objName: string) {
    const id = ObjType.getId(objName);
    const inv = p.getInventory(InvType.INV)!;
    for (let i = 0; i < inv.capacity; i++) if (inv.get(i)?.id === id) return i;
    throw new Error('not carrying ' + objName);
}
const useOnLoc = (obj: string, x: number, z: number, name: string) => {
    const loc = World.getLoc(x, z, p.level, LocType.getId(name));
    if (!loc) throw new Error(`no ${name} at ${x},${z},${p.level}`);
    p.clearPendingAction();
    p.lastUseItem = ObjType.getId(obj);
    p.lastUseSlot = slotOf(obj);
    p.queueWaypoints(findPathToLoc(p.level, p.x, p.z, loc.x, loc.z, p.width, loc.width, loc.length, loc.angle, loc.shape, LocType.get(loc.type).forceapproach));
    p.setInteraction(Interaction.ENGINE, loc, ServerTriggerType.APLOCU);
    settle(p);
};
const talk = (npcName: string, picks: number[] = []) => {
    const id = NpcType.getId(npcName);
    const npc = [...World.npcs].find(n => n && n.isActive && n.type === id);
    if (!npc) throw new Error('no ' + npcName + ' spawned');
    p.teleport(npc.x + 1, npc.z, npc.level);
    H.tick(1);
    p.clearPendingAction();
    p.queueWaypoints(findPathToEntity(p.level, p.x, p.z, npc.x, npc.z, p.width, npc.width, npc.length));
    p.setInteraction(Interaction.ENGINE, npc, ServerTriggerType.APNPC1);
    settle(p, picks);
};

// ------------------------------------------------------------------ the cave and the journal
console.log('');
console.log('THE CAVE, AND EDERN\'S JOURNAL');
set(p, 'mourning_quest', 20);          // Part I complete
const Q = () => v(p, 'mourning_quest_main');
opLoc(1925, 4642, 'mourning_dead_guard1');
check('before the quest starts a corpse is just a corpse', [H.invCount(p, 'mourning_ederns_journal'), Q()], [0, 0]);
set(p, 'mourning_quest_main', 20);     // ^mt_inside, as if walked in from the excavation
// Arianwyn's first conversation sets this, and Thorgel is a multinpc on it - so a sim that jumps
// the stage has to set it too, or he is standing there invisible.
set(p, 'mourning_light_door_1_c_first_time', 1);
opLoc(1925, 4642, 'mourning_dead_guard1');
check('searching a guard gives up the journal, and the quest moves on',
    [H.invCount(p, 'mourning_ederns_journal'), Q()], [1, 24]);
p.teleport(1924, 4638, 0);
H.tick(1);
opLoc(1924, 4639, 'mourning_dead_guard2');
check('  and the next corpse does not give a second one', H.invCount(p, 'mourning_ederns_journal'), 1);

// ------------------------------------------------------------------ the black crystal
console.log('');
console.log('THE BLACK CRYSTAL ON THE TOP FLOOR');
p.teleport(...T(51, 31), 2);
H.tick(1);
check('there is a tile to stand on beside it', standing(p), true);
opLoc(...T(52, 30), 'mourning_temple_obsidian_crystal');
check('Search says what it is and takes nothing', H.invCount(p, 'mourning_crystal_sample'), 0);
H.give(p, 'chisel', 1);
useOnLoc('chisel', ...T(52, 30), 'mourning_temple_obsidian_crystal');
check('a chisel takes a sliver off it', [H.invCount(p, 'mourning_crystal_sample'), Q()], [1, 26]);
useOnLoc('chisel', ...T(52, 30), 'mourning_temple_obsidian_crystal');
check('  and it will not give a second one', H.invCount(p, 'mourning_crystal_sample'), 1);

// ------------------------------------------------------------------ Arianwyn makes it his own
console.log('');
console.log('ARIANWYN');
talk('mourning_arianwyn');
check('he sings over the sliver: a newly made crystal, empty',
    [H.invCount(p, 'mourning_crystal_sample'), H.invCount(p, 'mourning_crystal_new_sample'), Q()], [0, 1, 34]);
talk('mourning_arianwyn');
check('  and says what it wants', Q(), 34);

// ------------------------------------------------------------------ Thorgel
console.log('');
console.log('THORGEL, ELEVEN YEARS BY THE DEATH ALTAR');
check('he is spawned and visible (Arianwyn set the bit)',
    [[...World.npcs].some(n => n && n.isActive && n.type === NpcType.getId('mourning_deathalter_dwarf')),
        v(p, 'mourning_light_door_1_c_first_time')], [true, 1]);
talk('mourning_deathalter_dwarf');
check('he hands over the list, and the quest knows it',
    [H.invCount(p, 'mourning_deathalter_list'), v(p, 'mourning_dwarf_startedtask'), Q()], [1, 1, 42]);
H.opheld(p, 'mourning_deathalter_list', 1);
settle(p);
check('  the list reads, and nothing is crossed out yet', v(p, 'mourning_dwarf_rune'), 0);

// the 2006 list, in the cache's bit order
const LIST: [string, string][] = [
    ['rune', 'blankrune'],
    ['lobsterpot', 'lobster_pot'],
    ['fishingrod', 'fishing_rod'],
    ['tinderbox', 'tinderbox'],
    ['lockpick', 'lockpick'],
    ['helm', 'bronze_med_helm'],
    ['apron', 'white_apron'],
    ['wine', 'jug_wine'],
    ['kebab', 'kebab'],
    ['boots', 'leather_boots'],
    ['paste', 'swamppaste'],
    ['redberries', 'redberries'],
    ['cheese', 'cheese'],
    ['vial', 'vial_water'],
    ['flax', 'flax'],
    ['ring', 'gold_ring'],
    ['egg', 'egg'],
    ['gloves', 'leather_gloves'],
    ['tin', 'cake_tin'],
    ['necklace', 'necklace_mould'],
    ['tomato', 'rotten_tomato']
];
check('every item on it is a real obj', LIST.filter(([, o]) => ObjType.getId(o) === -1).map(([, o]) => o), []);

// hand over the first three, then the rest
H.clearInv(p);
H.give(p, 'mourning_crystal_new_sample', 1);
for (const [, obj] of LIST.slice(0, 3)) H.give(p, obj, 1);
talk('mourning_deathalter_dwarf');
check('three off the list, eighteen to go',
    [LIST.slice(0, 3).map(([b]) => v(p, 'mourning_dwarf_' + b)), H.invCount(p, 'death_talisman')], [[1, 1, 1], 0]);
for (const [, obj] of LIST.slice(3)) H.give(p, obj, 1);
talk('mourning_deathalter_dwarf');
check('all twenty-one, and a death talisman for them',
    [LIST.map(([b]) => v(p, 'mourning_dwarf_' + b)).filter(x => x === 0).length, H.invCount(p, 'death_talisman'),
        v(p, 'mourning_dwarf_startedtask'), Q()], [0, 1, 2, 44]);
check('  and he takes the list back', H.invCount(p, 'mourning_deathalter_list'), 0);

// ------------------------------------------------------------------ the ruins and the altar
console.log('');
console.log('THE RUINS, AND THE ALTAR THROUGH THEM');
const ruins = World.getLoc(1859, 4638, 0, LocType.getId('deathtemple_ruined'));
check('deathtemple_ruined is placed four tiles from Thorgel', ruins !== null, true);
p.teleport(1861, 4638, 0);
H.tick(1);
useOnLoc('death_talisman', 1859, 4638, 'deathtemple_ruined');
check('the talisman on the ruins puts you in the altar chamber', [p.level, standing(p), p.x > 2100], [0, true, true]);
const altar = [...Array(64).keys()].flatMap(i => [...Array(64).keys()].map(j => [34 * 64 + i, 75 * 64 + j]))
    .find(([x, z]) => World.getLoc(x, z, 0, LocType.getId('death_altar')) !== null);
check('the death altar is in there', altar !== undefined, true);
if (altar) {
    p.teleport(altar[0] + 2, altar[1], 0);
    H.tick(1);
    useOnLoc('mourning_crystal_new_sample', altar[0], altar[1], 'death_altar');
    check('the altar charges the crystal',
        [H.invCount(p, 'mourning_crystal_new_sample'), H.invCount(p, 'mourning_crystal_new_powered'), Q()], [0, 1, 46]);
    // and the altar still crafts runes, which is the thing a quest hook on it could break
    H.give(p, 'blankrune', 5);
    useOnLoc('blankrune', altar[0], altar[1], 'death_altar');
    check('  and still turns essence into death runes', H.invCount(p, 'deathrune') > 0, true);
}

// ------------------------------------------------------------------ back into the black crystal
console.log('');
console.log('THE LAST ACT');
p.teleport(...T(51, 31), 2);
H.tick(1);
useOnLoc('mourning_crystal_new_powered', ...T(52, 30), 'mourning_temple_obsidian_crystal');
check('the charged crystal goes back into the one it was cut from',
    [v(p, 'mourning_light_temple_safe_guards'), H.invCount(p, 'mourning_crystal_new_powered'), Q()], [1, 0, 48]);
check('  and the crystal renders as the repowered one',
    World.getLoc(...T(52, 30), 2, LocType.getId('mourning_temple_obsidian_crystal')) !== null, true);
opLoc(...T(52, 30), 'mourning_temple_obsidian_crystal');
check('  searching it now says it is lit', Q(), 48);
// THE REWARD, which used to be a tenth of itself spread over two skills the quest does not touch.
// The wiki gives one: 60,000 Agility XP, and the crystal trinket that lets you back into the
// temple - and ~send_quest_complete only DRAWS the obj on the scroll, so it was never handed over.
H.clearInv(p);
const agility0 = p.stats[16];
talk('mourning_arianwyn');
check('Arianwyn: Mourning\'s End Part II complete', Q(), 50);
check('  60,000 Agility XP, and the crystal trinket', [(p.stats[16] - agility0) / 10, H.invCount(p, 'mourning_crystal_trinket')], [60000, 1]);

console.log('');
console.log(`${R.ok} ok, ${R.bad} failed`);
process.exit(R.bad ? 1 : 0);
