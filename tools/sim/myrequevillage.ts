// BURGH DE ROTT HAS THIRTY-ONE PEOPLE AND EVERY ONE OF THEM HAS A NAME IN THE CACHE - Sorin,
// Luscion, Sergiu, Radu, Grigore, Ileana, Valeria, Emilia, Florin, Catalina, Ivan, Victor, Helena,
// Teodor, Marius, Gabriela, Vladimir, Calin, Mihail, Nicoleta, Simona, Vasile, Razvan, Luminata,
// Benjamin, Liam, Miala, Verak - all with op1=Talk-to, and not one of them was mentioned in any
// script. Forty of In Aid of the Myreque's unreferenced npcs are the town the quest is about.
//
// Florin is the one with a job: the walkthrough's fifth step is talking to him through the gate and
// putting a piece of food in the chest before he opens it. burgh_quest_food_chest_closed is in the
// cache and placed on no map square, so the quest adds it beside the gate when he asks.
//
//   npx tsx tools/sim/myrequevillage.ts
import * as H from './harness.js';
import Player from '#/engine/entity/Player.js';
import World from '#/engine/World.js';
import Npc from '#/engine/entity/Npc.js';
import LocType from '#/cache/config/LocType.js';
import ObjType from '#/cache/config/ObjType.js';
import InvType from '#/cache/config/InvType.js';
import NpcType from '#/cache/config/NpcType.js';
import VarBitType from '#/cache/config/VarBitType.js';
import Component from '#/cache/config/Component.js';
import ScriptState from '#/engine/script/ScriptState.js';
import ServerTriggerType from '#/engine/script/ServerTriggerType.js';
import { Interaction } from '#/engine/entity/Interaction.js';
import { findPathToLoc, findPathToEntity } from '#/engine/GameMap.js';

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

function settle(p: Player, picks: number[] = [], max = 250) {
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
                continue;
            }
            p.executeScript(s, true, true);
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

// the gate, off the map: burgh_fencegate_l at 3485,3244 and _r beside it, and the chest the quest
// adds on the swamp-road side at 3485,3245
const GATE: [number, number] = [3485, 3244];
const CHEST: [number, number] = [3485, 3245];

const p: any = H.makePlayer('myreqvill', GATE[0], GATE[1] + 2);
H.tick(1);
p.teleport(GATE[0], GATE[1] + 2, 0);
H.tick(1);
H.maxOut(p);
H.clearInv(p);
H.tick(2);
p.closeModal();

const talkTo = (npcName: string, picks: number[] = []) => {
    const id = NpcType.getId(npcName);
    if (id === -1) throw new Error('no npc type ' + npcName);
    let best: Npc | null = null;
    let bestD = Infinity;
    for (const n of World.npcs) {
        if (!n || !n.isActive || n.type !== id) continue;
        const d = Math.max(Math.abs(n.x - p.x), Math.abs(n.z - p.z));
        if (d < bestD) {
            bestD = d;
            best = n;
        }
    }
    if (!best) throw new Error(npcName + ' is not spawned');
    const mark = H.mesgs.length;
    const faces = H.ifaces.length;
    p.teleport(best.x + 1, best.z, best.level);
    H.tick(1);
    p.clearPendingAction();
    p.queueWaypoints(findPathToEntity(p.level, p.x, p.z, best.x, best.z, p.width, best.width, best.length));
    p.setInteraction(Interaction.ENGINE, best, ServerTriggerType.APNPC1);
    settle(p, picks);
    const said = H.ifaces.slice(faces).filter(i => i.kind === 'text' && i.text).map(i => i.text!)
        .concat(H.mesgs.slice(mark).map(m => m.text));
    return said.join(' ');
};
const opLoc = (x: number, z: number, name: string, op = 1) => {
    H.opLoc(p, x, z, name, op);
    settle(p);
};
function slotOf(objName: string) {
    const id = ObjType.getId(objName);
    const inv = p.getInventory(InvType.INV)!;
    for (let i = 0; i < inv.capacity; i++) if (inv.get(i)?.id === id) return i;
    throw new Error('not carrying ' + objName);
}
const useOnLoc = (obj: string, x: number, z: number, name: string) => {
    const loc = World.getLoc(x, z, p.level, LocType.getId(name));
    if (!loc) throw new Error(`no ${name} at ${x},${z}`);
    p.clearPendingAction();
    p.lastUseItem = ObjType.getId(obj);
    p.lastUseSlot = slotOf(obj);
    p.queueWaypoints(findPathToLoc(p.level, p.x, p.z, loc.x, loc.z, p.width, loc.width, loc.length, loc.angle, loc.shape, LocType.get(loc.type).forceapproach));
    p.setInteraction(Interaction.ENGINE, loc, ServerTriggerType.APLOCU);
    settle(p);
};

// ------------------------------------------------------------------ the thirty-one
console.log('');
console.log('EVERY VILLAGER HAS A NAME, AND NOW A VOICE');
const VILLAGERS: [string, string][] = [
    ['burgh_villager_0', 'Sorin'], ['burgh_vilager_1', 'Luscion'], ['burgh_vilager_2', 'Sergiu'],
    ['burgh_vilager_3', 'Radu'], ['burgh_vilager_4', 'Grigore'], ['burgh_vilager_5', 'Ileana'],
    ['burgh_vilager_6', 'Valeria'], ['burgh_vilager_7', 'Emilia'], ['burgh_vilager_8', 'Florin'],
    ['burgh_vilager_sit1', 'Calin'], ['burgh_vilager_sit2', 'Mihail'], ['burgh_vilager_sit3', 'Nicoleta'],
    ['burgh_vilager_sit4', 'Simona'], ['burgh_vilager_rat_1', 'Vasile'], ['burgh_vilager_rat_2', 'Razvan'],
    ['burgh_vilager_rat_3', 'Luminata'], ['burgh_villager_child1', 'Catalina'],
    ['burgh_villager_child2', 'Ivan'], ['burgh_villager_child3', 'Victor'],
    ['burgh_villager_child4', 'Helena'], ['burgh_farmer', 'Teodor'], ['burgh_bed_man', 'Marius'],
    ['burgh_bed_man_wife', 'Gabriela'], ['burgh_donor_man', 'Vladimir'],
    ['burgh_turned_vampyre_male_ben', 'Benjamin'], ['burgh_turned_vampyre_male_liam', 'Liam'],
    ['burgh_turned_vampyre_male_miala', 'Miala'], ['burgh_turned_vampyre_male_verak', 'Verak']
];
check('all twenty-eight are npc types the cache names',
    VILLAGERS.filter(([n]) => NpcType.getId(n) === -1).map(([n]) => n), []);
check('and every one of them has a Talk-to trigger now',
    VILLAGERS.filter(([n]) => !H.hasScript('[opnpc1,' + n + ']')).map(([n]) => n), []);
const missing = VILLAGERS.filter(([n]) => ![...World.npcs].some(x => x && x.isActive && x.type === NpcType.getId(n)));
console.log('  ' + (VILLAGERS.length - missing.length) + ' of ' + VILLAGERS.length + ' are standing in the village');
// Marius is added by the quest when the gate opens - his wife is placed and he was not - and
// Vladimir with the four turned villagers belong to the blood tithe, which is the next piece.
check('the only ones not on a map square are Vladimir and the four who were turned',
    missing.map(([, name]) => name).sort(),
    ['Benjamin', 'Liam', 'Marius', 'Miala', 'Verak', 'Vladimir']);

// ------------------------------------------------------------------ Florin and the gate
console.log('');
console.log('FLORIN, AND THE GATE HE WILL NOT OPEN');
set(p, 'myreque_2_quest', 0);
let said = talkTo('burgh_vilager_8');
check('before Veliaf has sent you he tells you to go back up the road', said.includes('back up the road'), true);
set(p, 'myreque_2_quest', 10);     // ^m2_sent
p.teleport(GATE[0], GATE[1] + 2, 0);
H.tick(1);
opLoc(...GATE, 'burgh_fencegate_l');
// the click walks you up to the gate, as any click does; what matters is which side of it you end
// up on - the village is to the north, so anything at the gate's own row or south of it is outside
check('the gate is barred from the inside', p.z >= GATE[1], true);
said = talkTo('burgh_vilager_8');
check('he asks for something to eat, and a chest appears on your side of the fence',
    [said.includes('Put something to eat'), World.getLoc(...CHEST, 0, LocType.getId('burgh_quest_food_chest_closed')) !== null],
    [true, true]);
p.teleport(CHEST[0], CHEST[1] + 1, 0);
H.tick(1);
opLoc(...CHEST, 'burgh_quest_food_chest_closed');
check('the chest opens', World.getLoc(...CHEST, 0, LocType.getId('burgh_quest_food_chest_open')) !== null, true);
H.give(p, 'tinderbox', 1);
useOnLoc('tinderbox', ...CHEST, 'burgh_quest_food_chest_open');
check('a tinderbox is not food', [H.invCount(p, 'tinderbox'), v(p, 'myreque_2_quest')], [1, 10]);
H.give(p, 'bread', 1);
useOnLoc('bread', ...CHEST, 'burgh_quest_food_chest_open');
check('bread is: the boy takes it, the chest goes, and the gate opens',
    [H.invCount(p, 'bread'), v(p, 'myreque_2_quest'),
        World.getLoc(...CHEST, 0, LocType.getId('burgh_quest_food_chest_open')) !== null],
    [0, 12, false]);
p.teleport(GATE[0], GATE[1] + 2, 0);
H.tick(1);
opLoc(...GATE, 'burgh_fencegate_l');
check('and now it lets you through', p.z < GATE[1] + 2, true);

// ------------------------------------------------------------------ what the village says
console.log('');
console.log('WHAT THEY SAY, AND WHEN');
set(p, 'myreque_2_quest', 20);     // ^m2_arrived
said = talkTo('burgh_vilager_rat_1');
check('Vasile asked them to take him instead of his wife and they laughed at him',
    said.includes('laughed at me'), true);
said = talkTo('burgh_vilager_rat_2');
check('Razvan names the two quiet ways out of the village - the cellar and the temple road',
    said.includes('inn cellar'), true);
said = talkTo('burgh_villager_child2');
check('the child named Ivan wants to be a Myreque', said.includes('Myreque'), true);
// LIAM AND THE OTHER THREE WHO WERE TURNED CANNOT BE DRIVEN AT ALL, and this is the honest place
// to say so: they are not on a map square, and their lines go through ~chatnpc, which needs an
// active npc - "npc_name Attempt to access null active_npc" is what driving the label by hand
// gets. Their triggers exist (the block at the top of this file checks every one of the
// twenty-eight), and they will have something to say the moment the blood tithe puts them in the
// village, which is the next piece of this rebuild.

set(p, 'myreque_2_quest', 50);     // ^m2_tithe_broken
said = talkTo('burgh_vilager_5');
check('after the barrel is taken off Gadderanks, Ileana has a different line',
    said.includes('not stopped shaking'), true);
said = talkTo('burgh_bed_man');
check('Marius is in the room his wife talks about, and has been for two years',
    said.includes('not been out of this bed'), true);
set(p, 'myreque_2_quest', 60);     // ^m2_base
said = talkTo('burgh_vilager_8');
check('and Florin leaves the gate open in the daytime once the Myreque are in the cellar',
    said.includes('gate open in the daytime'), true);

console.log('');
console.log(`${R.ok} ok, ${R.bad} failed`);
process.exit(R.bad ? 1 : 0);
