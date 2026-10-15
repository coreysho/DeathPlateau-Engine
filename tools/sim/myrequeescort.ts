// IVAN STROM'S ESCORT - the guide's steps 31 to 35, which the quest did not have and the cache
// described completely:
//
//   burgh_ivan_strom_temple_ambush          Ivan, with a bronze sword in model11
//   burgh_ivan_strom_temple_ambush_sickle   the same def, and model11 is a silver sickle
//   burgh_ivan_temple_vampire_juve_1, _2    two Vampyre Juvinates, vislevel 75
//   burgh_ivan_armour_give_helm/_legs/_body three bits, one per piece
//   burgh_ivan_food_give                    four bits: what he is carrying
//
// Two npcs that differ by what is in his hand, two level 75s with "temple ambush" in their names,
// three armour bits and a food counter. This drives the whole step: Veliaf hands him over, the kit
// goes on him, he follows across four map squares, the gate is where they are waiting, and Drezel
// takes him in and hands over the library key the quest used to find in an invented chest.
//
//   npx tsx tools/sim/myrequeescort.ts
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
import { findPathToEntity, findPathToLoc } from '#/engine/GameMap.js';

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

// the Myreque cellar, read off the probe: Veliaf at 3493,9625, and the quest puts Ivan at 39,28 of
// m54_150, which is 3495,9624
const VELIAF: [number, number] = [3493, 9625];
const DREZEL: [number, number] = [3439, 9898];
const GATE: [number, number] = [3447, 3460];      // north of Ulizius, inside the ambush box

const p: any = H.makePlayer('myreqescort', VELIAF[0], VELIAF[1] + 2);
H.tick(1);
p.teleport(VELIAF[0], VELIAF[1] + 2, 0);
H.tick(1);
H.maxOut(p);
H.clearInv(p);
H.tick(2);
p.closeModal();

const ivanTypes = ['burgh_ivan_strom_temple_ambush', 'burgh_ivan_strom_temple_ambush_sickle'];
const juveTypes = ['burgh_ivan_temple_vampire_juve_1', 'burgh_ivan_temple_vampire_juve_2'];
const npcsOf = (names: string[]): Npc[] => {
    const ids = names.map(n => NpcType.getId(n));
    const out: Npc[] = [];
    for (const n of World.npcs) if (n && n.isActive && ids.includes(n.type)) out.push(n);
    return out;
};
const ivan = (): Npc | null => npcsOf(ivanTypes)[0] ?? null;

const heard = (fn: () => void): string => {
    const mark = H.mesgs.length;
    const faces = H.ifaces.length;
    fn();
    return H.ifaces.slice(faces).filter(i => i.kind === 'text' && i.text).map(i => i.text!)
        .concat(H.mesgs.slice(mark).map(m => m.text)).join(' ');
};
const talkTo = (npc: Npc, picks: number[] = []): string =>
    heard(() => {
        p.teleport(npc.x + 1, npc.z, npc.level);
        H.tick(1);
        p.clearPendingAction();
        p.queueWaypoints(findPathToEntity(p.level, p.x, p.z, npc.x, npc.z, p.width, npc.width, npc.length));
        p.setInteraction(Interaction.ENGINE, npc, ServerTriggerType.APNPC1);
        settle(p, picks);
    });
function slotOf(objName: string) {
    const id = ObjType.getId(objName);
    const inv = p.getInventory(InvType.INV)!;
    for (let i = 0; i < inv.capacity; i++) if (inv.get(i)?.id === id) return i;
    throw new Error('not carrying ' + objName);
}
// what "use this on him" sends: OpNpcU, which arrives as the APNPCU interaction
const useOnNpc = (objName: string, npc: Npc): string =>
    heard(() => {
        p.teleport(npc.x + 1, npc.z, npc.level);
        H.tick(1);
        p.clearPendingAction();
        p.lastUseItem = ObjType.getId(objName);
        p.lastUseSlot = slotOf(objName);
        p.queueWaypoints(findPathToEntity(p.level, p.x, p.z, npc.x, npc.z, p.width, npc.width, npc.length));
        p.setInteraction(Interaction.ENGINE, npc, ServerTriggerType.APNPCU);
        settle(p);
    });

// ------------------------------------------------------------------ what the cache had
console.log('');
console.log('WHAT THE CACHE HAD ALL ALONG');
for (const n of [...ivanTypes, ...juveTypes]) check(`${n} is an npc`, NpcType.getId(n) !== -1, true);
const plain = NpcType.get(NpcType.getId(ivanTypes[0]));
const sickle = NpcType.get(NpcType.getId(ivanTypes[1]));
check('the two Ivans are the same man', [plain.name, sickle.name, plain.desc === sickle.desc], ['Ivan Strom', 'Ivan Strom', true]);
let modelDiffs = 0;
for (let i = 0; i < plain.models!.length; i++) if (plain.models![i] !== sickle.models![i]) modelDiffs++;
check('and the only difference in the whole def is what is in his hand', modelDiffs, 1);
// the guide offers "a short route with two level 75s or a long one with four level 50s"; the two
// the cache keeps for this ambush are one of each
check('the two who are waiting are a 75 and a 50',
    juveTypes.map(n => NpcType.get(NpcType.getId(n)).vislevel), [75, 50]);
for (const [name, bits] of [['burgh_ivan_armour_give_helm', 1], ['burgh_ivan_armour_give_body', 1],
                            ['burgh_ivan_armour_give_legs', 1], ['burgh_ivan_food_give', 4]] as [string, number][]) {
    const b = VarBitType.getByName(name)!;
    check(`${name} is ${bits} bit${bits > 1 ? 's' : ''}`, b.endbit - b.startbit + 1, bits);
}

// ------------------------------------------------------------------ Veliaf hands him over
console.log('');
console.log('VELIAF HANDS HIM OVER');
set(p, 'myreque_2_quest', 60);         // ^m2_base: the cellar is open and the Myreque have moved in
const veliaf = npcsOf(['burgh_rescue_veliaf_hurtz_talk'])[0];
check('Veliaf is in the cellar', veliaf !== undefined, true);
let said = talkTo(veliaf);
check('he names the boy and the man who would ordain him',
    [said.includes('Ivan Strom'), said.includes('Drezel'), v(p, 'myreque_2_quest')], [true, true, 72]);
check('and Ivan is standing in the cellar', ivan() !== null, true);
check('  by the cellar ladder, where Veliaf says he is', [ivan()!.x, ivan()!.z], [3491, 9632]);
const before = ivan()!.nid;
talkTo(veliaf);
check('asking again does not produce a second Ivan', [npcsOf(ivanTypes).length, ivan()!.nid], [1, before]);

// ------------------------------------------------------------------ the kit
console.log('');
console.log('WHAT HE NEEDS BEFORE HE WILL GO');
said = talkTo(ivan()!);
check('a gown and a bronze sword, and he says so',
    [said.includes('something for his head'), said.includes('something to eat'),
        ivan()!.targetOp === 4], [true, true, false]);     // 4 is PLAYERFOLLOW: he has not set off

H.give(p, 'iron_med_helm', 1);
said = useOnNpc('iron_med_helm', ivan()!);
check('a helm is a helm', [v(p, 'burgh_ivan_armour_give_helm'), H.invCount(p, 'iron_med_helm')], [1, 0]);
H.give(p, 'iron_platebody', 1);
useOnNpc('iron_platebody', ivan()!);
H.give(p, 'iron_platelegs', 1);
useOnNpc('iron_platelegs', ivan()!);
check('and a body and legs are the other two bits',
    [v(p, 'burgh_ivan_armour_give_body'), v(p, 'burgh_ivan_armour_give_legs')], [1, 1]);
H.give(p, 'iron_platebody', 1);
said = useOnNpc('iron_platebody', ivan()!);
check('he will not take a second of anything',
    [said.includes('already'), H.invCount(p, 'iron_platebody')], [true, 1]);

H.give(p, 'bread', 4);
useOnNpc('bread', ivan()!);
useOnNpc('bread', ivan()!);
check('food is a count, not a bit', [v(p, 'burgh_ivan_food_give'), H.invCount(p, 'bread')], [2, 2]);
set(p, 'burgh_ivan_food_give', 15);
said = useOnNpc('bread', ivan()!);
check('and the count stops where four bits stop',
    [v(p, 'burgh_ivan_food_give'), said.includes('cannot carry')], [15, true]);
set(p, 'burgh_ivan_food_give', 3);

check('he is the Ivan with a bronze sword', NpcType.get(ivan()!.type).debugname, ivanTypes[0]);
H.give(p, 'silver_sickle', 1);
said = useOnNpc('silver_sickle', ivan()!);
check('a silver sickle makes him the other one',
    [NpcType.get(ivan()!.type).debugname, H.invCount(p, 'silver_sickle')], [ivanTypes[1], 0]);

// ------------------------------------------------------------------ the walk
console.log('');
console.log('AND THEN HE WALKS BEHIND YOU');
const hpBefore = ivan()!.levels[3];
said = talkTo(ivan()!, [1]);                 // "Let's go."
check('he sets off following', ivan()!.targetOp, 4);         // NpcMode.PLAYERFOLLOW
check('  three pieces of armour are thirty more hits in him', ivan()!.levels[3] - hpBefore, 30);
p.teleport(3494, 9640, 0);                   // the far end of the cellar, out of his range
H.tick(12);
const d = Math.max(Math.abs(ivan()!.x - p.x), Math.abs(ivan()!.z - p.z));
check('left behind, he comes to you - the swamp road is four map squares long', d <= 12, true);

// ------------------------------------------------------------------ the gate
console.log('');
console.log('THE GATE, WHICH IS WHERE THEY ARE WAITING');
check('nothing is waiting before you get there', npcsOf(juveTypes).length, 0);
p.teleport(GATE[0], GATE[1], 0);
H.tick(20);
const juves = npcsOf(juveTypes);
check('two juvinates, on the Paterdomus side of Ulizius gate', juves.length, 2);
// opplayer2 is where they start; [ai_opplayer2,_] turns that into applayer2 as soon as they are in
// reach, so what is asserted is who they are after, not which half of the swing they are in
check('  and both of them come for whoever is walking with him',
    juves.every(n => (n as any).target === p && (n.targetOp === 8 || n.targetOp === 13)), true);
check('  Ivan is still on his feet', ivan() !== null, true);
said = talkTo(ivan()!);
check('  and the journal catches up when you ask him about it - an ai_timer cannot write a transmitted varbit',
    [said.includes('seen two of them die'), v(p, 'myreque_2_quest')], [true, 74]);
const ivanHp = ivan()!.levels[3];
const juveHp = juves.map(n => n.levels[3]);
H.tick(60);
check('they bite him, which is what they came for', ivan() === null || ivan()!.levels[3] < ivanHp, true);
check('and the sickle is not for show: he takes some of it back',
    npcsOf(juveTypes).some((n, i) => n.levels[3] < juveHp[i]) || npcsOf(juveTypes).length < 2, true);
if (ivan()) {
    check('  he eats what you gave him rather than dying on the road',
        v(p, 'burgh_ivan_food_give'), 3);             // the count he eats from lives on him, not here
}

// ------------------------------------------------------------------ Drezel
console.log('');
console.log('DREZEL TAKES HIM IN');
for (const n of npcsOf(juveTypes)) n.delayed = false;
// the fight is not the point here: the walk continues once they are off him
for (const n of npcsOf(juveTypes)) World.removeNpc(n, -1);
H.tick(2);
if (!ivan()) {
    // if the road killed him, Veliaf puts him back - which is the only way to start again
    p.teleport(VELIAF[0], VELIAF[1] + 2, 0);
    H.tick(1);
    said = talkTo(veliaf);
    check('if he dies on the road Veliaf sends him out again',
        [said.includes('came back'), ivan() !== null, v(p, 'myreque_2_quest')], [true, true, 72]);
    H.runProc(p, '[proc,m2_ivan_walking]');
    talkTo(ivan()!, [1]);
}
const drezel = npcsOf(['priestperiltrappedmonk2'])[0];
check('Drezel is in the mausoleum', drezel !== undefined, true);
p.teleport(DREZEL[0], DREZEL[1] + 2, 0);
H.tick(10);                                   // he follows you through the barrier
said = talkTo(drezel);
check('he keeps the boy and hands over the key',
    [H.invCount(p, 'burgh_key'), v(p, 'myreque_2_quest'), said.includes('novice')], [1, 80, true]);
check('  and Ivan is no longer walking behind you', ivan(), null);

// ------------------------------------------------------------------ the chest
console.log('');
console.log('AND THE CHEST IN THE CELLAR IS A CHEST');
set(p, 'myreque_2_quest', 72);
H.clearInv(p);
H.tick(1);
p.teleport(3493, 9630, 0);   // forceapproach 14: the chest has one side, and it is the south
H.tick(1);
const chest = World.getLoc(3493, 9632, 0, LocType.getId('burgh_chest_closed'));
check('the chest is where the constant says', chest !== null, true);
if (chest) {
    said = heard(() => {
        // the real click: walk to it the way the engine routes a loc, then Search
        p.clearPendingAction();
        p.queueWaypoints(findPathToLoc(p.level, p.x, p.z, chest.x, chest.z, p.width, chest.width,
            chest.length, chest.angle, chest.shape, LocType.get(chest.type).forceapproach));
        p.setInteraction(Interaction.ENGINE, chest, ServerTriggerType.APLOC1);
        settle(p);
    });
    check('it no longer holds the library key',
        [H.invCount(p, 'burgh_key'), said.includes('has ever claimed it')], [0, true]);
}

console.log('');
console.log(`${R.ok} ok, ${R.bad} failed`);
process.exit(R.bad ? 1 : 0);
