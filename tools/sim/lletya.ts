// LLETYA'S SEVEN ELVES, all of them placed on the map and none of them with a script - and five
// of them carrying op3=Pickpocket, which the 2026-09-08 dead-op audit left out on purpose because
// they want their own rates rather than citizen-tier. These are those rates.
//
//   npx tsx tools/sim/lletya.ts
import * as H from './harness.js';
import Player from '#/engine/entity/Player.js';
import World from '#/engine/World.js';
import Npc from '#/engine/entity/Npc.js';
import NpcType from '#/cache/config/NpcType.js';
import Component from '#/cache/config/Component.js';
import ScriptState from '#/engine/script/ScriptState.js';
import ServerTriggerType from '#/engine/script/ServerTriggerType.js';
import ScriptProvider from '#/engine/script/ScriptProvider.js';
import { Interaction } from '#/engine/entity/Interaction.js';
import { findPathToEntity } from '#/engine/GameMap.js';

await H.boot();

const R = { ok: 0, bad: 0 };
const check = (what: string, got: unknown, want: unknown) => {
    const pass = JSON.stringify(got) === JSON.stringify(want);
    if (pass) R.ok++;
    else R.bad++;
    console.log(`  ${pass ? 'ok  ' : 'FAIL'} ${what}: ${JSON.stringify(got)}${pass ? '' : `   (want ${JSON.stringify(want)})`}`);
};

function settle(p: Player, picks: number[] = [], max = 150) {
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
                const byName = names.find((n: string) => n === `${open}:com_${pick}`);
                H.choose(p, byName ?? names[pick]);
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

const ELVES: [string, string][] = [
    ['mourning_town_elf_1', 'Goreu'],
    ['mourning_town_elf_2', 'Ysgawyn'],
    ['mourning_town_elf_3', 'Arvel'],
    ['mourning_town_elf_4', 'Mawrth'],
    ['mourning_town_elf_5', 'Kelyn'],
    ['mourning_elf_kid_1', 'Eoin'],
    ['mourning_elf_kid_2', 'Iona']
];

const p: any = H.makePlayer('lletya', 2338, 3162);
H.tick(1);
H.maxOut(p);
H.clearInv(p);
H.tick(2);
p.closeModal();

const npcOf = (name: string): Npc => {
    const id = NpcType.getId(name);
    for (const n of World.npcs) if (n && n.isActive && n.type === id) return n as Npc;
    throw new Error(name + ' is not spawned');
};
const heard = (fn: () => void): string => {
    const mark = H.mesgs.length;
    const faces = H.ifaces.length;
    fn();
    return H.ifaces.slice(faces).filter(i => i.kind === 'text' && i.text).map(i => i.text!)
        .concat(H.mesgs.slice(mark).map(m => m.text)).join(' ');
};
const opNpc = (npc: Npc, op: number, picks: number[] = []): string =>
    heard(() => {
        p.teleport(npc.x + 1, npc.z, npc.level);
        H.tick(1);
        p.clearPendingAction();
        p.queueWaypoints(findPathToEntity(p.level, p.x, p.z, npc.x, npc.z, p.width, npc.width, npc.length));
        p.setInteraction(Interaction.ENGINE, npc, ServerTriggerType.APNPC1 + op - 1);
        settle(p, picks);
    });

// ------------------------------------------------------------------ the seven
console.log('');
console.log('SEVEN ELVES WITH NAMES AND NO SCRIPTS');
for (const [name, who] of ELVES) {
    const t = NpcType.get(NpcType.getId(name));
    check(`${name} is ${who}, placed, with Talk-to`,
        [t.name, (t.op ?? [])[0], npcOf(name) !== null], [who, 'Talk-to', true]);
}

console.log('');
console.log('AND NOW THEY TALK');
H.setVarBit(p, 'mourning_quest_main', 0);
let said = opNpc(npcOf('mourning_town_elf_2'), 1);
check('before Arianwyn vouches for you, nobody in this village says much',
    said.includes('only reason you are standing here'), true);
said = opNpc(npcOf('mourning_elf_kid_1'), 1);
check('  except the children, who have never seen a human', said.includes("You're a human"), true);
H.setVarBit(p, 'mourning_quest_main', 2);      // ^mourning_told_arianwyn
const lines: Record<string, string> = {
    mourning_town_elf_1: 'traps in Isafdar',
    mourning_town_elf_2: 'Arianwyn wants evidence',
    mourning_town_elf_3: 'born in Prifddinas',
    mourning_town_elf_4: 'grown, not cut',
    mourning_town_elf_5: 'Oronwen will sell you crystal',
    mourning_elf_kid_1: 'human city',
    mourning_elf_kid_2: 'never seen Prifddinas'
};
for (const [name, who] of ELVES) {
    said = opNpc(npcOf(name), 1);
    check(`${who} has something of his own to say`, said.includes(lines[name]), true);
}
H.setVarBit(p, 'mourning_quest_main', 20);     // past the quest
said = opNpc(npcOf('mourning_town_elf_1'), 1);
check('and Goreu has heard about the gates afterwards', said.includes('opened the gates'), true);

// ------------------------------------------------------------------ the pickpocket
console.log('');
console.log('THE PICKPOCKET THE CACHE HAS ALWAYS OFFERED');
const PICK = ELVES.slice(0, 5).map(([n]) => n);
for (const name of PICK) {
    const t = NpcType.get(NpcType.getId(name));
    check(`${t.name} carries op3=Pickpocket, and it has a trigger now`,
        [(t.op ?? [])[2], ScriptProvider.getByTrigger(ServerTriggerType.OPNPC3, NpcType.getId(name), t.category) !== null],
        ['Pickpocket', true]);
}
p.setLevel(17, 84);                       // 17 is Thieving
H.tick(1);
said = opNpc(npcOf('mourning_town_elf_3'), 3);
check('84 Thieving is not enough', said.includes('85'), true);
p.setLevel(17, 85);
H.tick(1);
let xp = p.stats[17];
let got = 0;
let stunned = 0;
for (let i = 0; i < 60; i++) {
    H.clearInv(p);
    p.levels[3] = 99;
    H.tick(1);
    const before = p.stats[17];
    said = opNpc(npcOf('mourning_town_elf_3'), 3);
    if (p.stats[17] > before) got++;
    else if (said.includes('stunned')) stunned++;
    H.tick(6);
}
check('at 85 it succeeds about a third of the time, and the rest stun you',
    [got > 5, got < 45, stunned > 5], [true, true, true]);
console.log(`  (${got} of 60 succeeded, ${stunned} stunned)`);

H.clearInv(p);
H.tick(1);
const before = p.stats[17];
let tries = 0;
while (p.stats[17] === before && tries < 80) {
    p.levels[3] = 99;
    opNpc(npcOf('mourning_town_elf_3'), 3);
    H.tick(6);
    tries++;
}
check('and one success is 353.3 Thieving experience', (p.stats[17] - before) / 10, 353.3);
const loot = ['coins', 'deathrune', 'jug_wine', 'naturerune', 'fire_orb', 'diamond', 'gold_ore'];
check('  with something of the elf table in your hands',
    loot.some(o => H.invCount(p, o) > 0), true);

console.log('');
console.log(`${R.ok} ok, ${R.bad} failed`);
process.exit(R.bad ? 1 : 0);
