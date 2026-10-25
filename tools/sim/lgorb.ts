// WHY DOES THE ORB CAST AT THE MAGIC TRIAL GATE SOMETIMES DO NOTHING? Stand on a given tile with
// an unpowered orb and the runes, cast Charge Air Orb at the gate, and print everything.
//   NODE_MEMBERS=true npx tsx tools/sim/lgorb.ts [x] [z]
import * as H from './harness.js';
import { drive } from './a1lib.js';

await H.boot();

const X = Number(process.argv[2] ?? 2762);
const Z = Number(process.argv[3] ?? 9312);

const p: any = H.makePlayer('lgorb', X, Z);
H.tick(2);
p.teleport(X, Z, 0);
p.applyDamage = function () {};
H.maxOut(p);
H.runProc(p, '[proc,player_combat_stat]');
H.setVar(p, 'legendsquest', 15);
H.give(p, 'stafforb', 3);
H.give(p, 'airrune', 100);
H.give(p, 'cosmicrune', 100);
H.tick(2);

console.log('player at', p.x, p.z, 'delayed', p.delayed);
const mark = H.mesgs.length;
const sent = H.castOnLoc(p, 2762, 9313, 'lgmagictrialgateclosed', 'magic:air_orb');
console.log('castOnLoc returned', sent);
for (let t = 0; t < 40; t++) H.tick(1);
let lines: string[] = [];
try {
    lines = drive(p, []);
} catch (e) {
    console.log('drive threw:', String(e).slice(0, 120));
}
for (const l of lines) if (!/^(Lgorb|126|2,277|Total XP|0 \/|107|Collections|Game mode|Players online)/.test(l)) console.log('  SAID ' + l);
for (const m of H.mesgs.slice(mark)) console.log('  MES  ' + m.text);
console.log('after: player at', p.x, p.z, '  orbs left', H.invCount(p, 'stafforb'));
process.exit(0);
