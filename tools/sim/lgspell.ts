// WHY WON'T CONFUSE LAND ON UNGADULU? Standing inside the octagram, talk to him once to set the
// ungadulu_curse timer, then cast Confuse at him and print every message and every option.
//   NODE_MEMBERS=true npx tsx tools/sim/lgspell.ts
import * as H from './harness.js';
import World from '#/engine/World.js';
import NpcType from '#/cache/config/NpcType.js';
import JavaRandom from '#/util/JavaRandom.js';
import { drive } from './a1lib.js';

await H.boot();

const p: any = H.makePlayer('lgspell', 2789, 9331);
H.tick(2);
p.teleport(2789, 9331, 0);
p.applyDamage = function () {};
H.maxOut(p);
H.runProc(p, '[proc,player_combat_stat]');
console.log('com_magicattack', H.getVar(p, 'com_magicattack'));
H.setVar(p, 'legendsquest', 10);
H.give(p, 'earthrune', 100);
H.give(p, 'waterrune', 100);
H.give(p, 'bodyrune', 100);
H.give(p, 'goldbowlbless_pure', 1);
H.tick(1);

const say = (s: string) => console.log('  ' + s);
const ids = NpcType.getId('ungadulu_good');
const find = () => {
    for (const npc of World.npcs) if (npc && npc.isActive && npc.type === ids && npc.level === 0) return npc;
    return null;
};
console.log('ungadulu_good:', find() ? find()!.x + ',' + find()!.z : 'NOT FOUND');
console.log('player at', p.x, p.z, 'level', p.level);

let mark = H.mesgs.length;
const dump = (label: string) => {
    console.log(label);
    for (const m of H.mesgs.slice(mark)) say(m.text);
    mark = H.mesgs.length;
};

// --- the talk, which sets the curse timer
const npc = find()!;
H.opNpc(p, npc, 1);
for (const line of drive(p, [])) say('TALK ' + line);
dump('--- after the talk');
console.log('player at', p.x, p.z, '  curse timer:', JSON.stringify([...(p.timers?.keys?.() ?? [])]));

// --- and the cast
const target = find();
console.log('target now:', target ? target.x + ',' + target.z + ' type ' + target.type : 'NOT FOUND', 'delayed:', p.delayed);
if (target) {
    const pin = Number(process.argv[2] ?? -1);
    if (pin >= 0) (JavaRandom as any).nextDouble = () => pin;
    console.log('rng pinned to', pin);
    const sent = H.castOnNpc(p, target, 'magic:confuse');
    console.log('castOnNpc returned', sent);
    for (let t = 0; t < 6; t++) H.tick(1);
    try {
        for (const line of drive(p, [])) say('CAST ' + line);
    } catch (e) {
        say('drive threw: ' + String(e).slice(0, 160));
    }
    dump('--- after the cast');
}
console.log('player at', p.x, p.z);
process.exit(0);
