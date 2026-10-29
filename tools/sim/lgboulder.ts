// WHY DOES THE SECOND NEZIKCHENED NOT ALWAYS LAND? Push the boulder in the Viyeldi caves with the
// glowing dagger in hand and print every message, every npc near the player, and the stage.
//   NODE_MEMBERS=true npx tsx tools/sim/lgboulder.ts [x] [z]
import * as H from './harness.js';
import World from '#/engine/World.js';
import NpcType from '#/cache/config/NpcType.js';
import { drive, findNpc } from './a1lib.js';

await H.boot();

const X = Number(process.argv[2] ?? 2389);
const Z = Number(process.argv[3] ?? 4686);

const p: any = H.makePlayer('lgboulder', X, Z);
H.tick(2);
p.teleport(X, Z, 0);
p.applyDamage = function () {};
H.maxOut(p);
H.runProc(p, '[proc,player_combat_stat]');
H.setVar(p, 'legendsquest', 20); // ^legends_received_dagger
H.setVar(p, 'legends_bits', (1 << 29) | (1 << 25) | (1 << 26) | (1 << 27) | (1 << 28));
H.give(p, 'deathdaggerdone', 1);
H.give(p, 'goldbowlbless_empty', 1);
H.tick(2);

const near = (r: number) => {
    const out: string[] = [];
    for (const npc of World.npcs) {
        if (!npc || !npc.isActive) continue;
        if (Math.max(Math.abs(npc.x - p.x), Math.abs(npc.z - p.z)) > r) continue;
        out.push((NpcType.get(npc.type).debugname ?? String(npc.type)) + '@' + npc.x + ',' + npc.z);
    }
    return out.join(' ');
};

console.log('player at', p.x, p.z, '  near:', near(12));
let mark = H.mesgs.length;

const boulder = findNpc('boulder_legends', p);
console.log('boulder at', boulder.x + ',' + boulder.z);
H.opNpc(p, boulder, 1);
let lines: string[] = [];
try {
    lines = drive(p, []);
} catch (e) {
    console.log('drive threw:', String(e).slice(0, 160));
}
for (const l of lines) console.log('  SAID ' + l);
for (const m of H.mesgs.slice(mark)) console.log('  MES  ' + m.text);
mark = H.mesgs.length;
console.log('after the push: player at', p.x, p.z, ' stage', H.getVar(p, 'legendsquest'));
console.log('  near:', near(16));
for (let t = 0; t < 10; t++) H.tick(1);
console.log('ten ticks later, near:', near(16));

// AND AGAIN, which is what the manifest's insurance shove does
const b2 = findNpc('boulder_legends', p);
H.opNpc(p, b2, 1);
try {
    for (const l of drive(p, [])) console.log('  SAID2 ' + l);
} catch (e) {
    console.log('drive2 threw:', String(e).slice(0, 160));
}
for (const m of H.mesgs.slice(mark)) console.log('  MES2 ' + m.text);
console.log('after the second push: player at', p.x, p.z, ' stage', H.getVar(p, 'legendsquest'));
console.log('  near:', near(24));
for (let t = 0; t < 20; t++) H.tick(1);
console.log('twenty ticks later, near:', near(24));
process.exit(0);
