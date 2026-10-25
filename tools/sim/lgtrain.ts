// RADIMUS'S FOUR TRAINING SESSIONS, and the completion queue behind them.
//   NODE_MEMBERS=true npx tsx tools/sim/lgtrain.ts
import * as H from './harness.js';
import { drive, findNpc } from './a1lib.js';

await H.boot();

const p: any = H.makePlayer('lgtrain', 2727, 3377);
H.tick(2);
p.teleport(2727, 3377, 0);
p.applyDamage = function () {};
H.maxOut(p);
H.setVar(p, 'legendsquest', 50); // ^legends_returned_to_radimus
H.tick(2);

const stage = () => H.getVar(p, 'legendsquest');
console.log('player at', p.x, p.z, ' stage', stage());

const npc = findNpc('radimus_erkle', p);
console.log('radimus at', npc.x + ',' + npc.z);
H.opNpc(p, npc, 1);
const picks: (string | number)[] = ["Yes, I'll train now", '* Attack *', '* Attack *', '* Attack *', '* Attack *'];
try {
    for (const l of drive(p, picks)) console.log('  ' + l);
} catch (e) {
    console.log('drive threw:', String(e).slice(0, 200));
}
console.log('after the talk: stage', stage(), ' picks left', picks.length);
for (let t = 0; t < 10; t++) H.tick(1);
console.log('ten ticks later: stage', stage());
try {
    for (const l of drive(p, [])) console.log('  RESUME ' + l);
} catch (e) {
    console.log('resume threw:', String(e).slice(0, 200));
}
console.log('after the resume: stage', stage());
p.closeModal();
for (let t = 0; t < 20; t++) H.tick(1);
console.log('after close + 20: stage', stage(), ' gift', H.invCount(p, 'thtotempolegift'));
process.exit(0);
