// Barbarian Fishing at Otto's Grotto: the bed, the spots, the catch, the level gate, gutting.
// npx tsx tools/sim/barbfish.ts
import World from '#/engine/World.js';
import * as H from './harness.js';
import ObjType from '#/cache/config/ObjType.js';
import InvType from '#/cache/config/InvType.js';
import ScriptProvider from '#/engine/script/ScriptProvider.js';
import ScriptRunner from '#/engine/script/ScriptRunner.js';
import ServerTriggerType from '#/engine/script/ServerTriggerType.js';
import { PlayerStat } from '#/engine/entity/PlayerStat.js';

let fails = 0;
function check(ok: boolean, what: string) {
    console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}`);
    if (!ok) fails++;
}

await H.boot();
H.loginOrder();

// OpHeldUHandler: [opheldu,b], else [opheldu,a] with the two swapped.
function useOn(p: any, useName: string, onName: string) {
    const inv = p.getInventory(InvType.INV)!;
    const slotOf = (id: number) => { for (let i = 0; i < inv.capacity; i++) if (inv.get(i)?.id === id) return i; return -1; };
    const a = ObjType.getId(useName), b = ObjType.getId(onName);
    p.lastUseItem = a; p.lastUseSlot = slotOf(a); p.lastItem = b; p.lastSlot = slotOf(b);
    let script = ScriptProvider.getByTriggerSpecific(ServerTriggerType.OPHELDU, b, -1);
    if (!script) {
        script = ScriptProvider.getByTriggerSpecific(ServerTriggerType.OPHELDU, a, -1);
        [p.lastItem, p.lastUseItem] = [p.lastUseItem, p.lastItem];
        [p.lastSlot, p.lastUseSlot] = [p.lastUseSlot, p.lastSlot];
    }
    if (!script) throw new Error(`no opheldu for ${useName} on ${onName}`);
    p.executeScript(ScriptRunner.init(script, p), true);
}
const texts = (name: string) => H.ifaces.filter(i => i.who === name && i.kind === 'text').map(i => i.text!);
const mes = (name: string) => H.mesgs.filter(m => m.who === name).map(m => m.text);

// ---- the house and its spawns
const otto = H.npcNear('otto_godblessed', 2502, 3489);
check(!!otto && Math.max(Math.abs(otto.x - 2502), Math.abs(otto.z - 3490)) <= 3, `Otto spawned in his house (${otto?.x},${otto?.z})`);
const spots = ['barbarian_fishing_spot'].flatMap(() => {
    const out: any[] = [];
    for (const n of World.npcs) if (n && n.isActive && n.type === (otto ? H.npcNear('barbarian_fishing_spot', 2504, 3497)!.type : -1)) out.push(n);
    return out;
});
check(spots.length === 3, `three leaping-fish spots in the lake: ${spots.map(s => s.x + ',' + s.z).join(' ')}`);

// ---- the bed: nothing before Otto's lesson, the rod after
const a = H.makePlayer('barbA', 2502, 3487, 2130706433);
H.tick(2);
H.maxOut(a);
H.clearInv(a);
H.opLoc(a, 2500, 3490, 'loc474_25268', 1);
H.tick(8);
check(H.invCount(a, 'barbarian_rod') === 0 && mes('barbA').includes('You search the bed but find nothing of interest.'), `bed before talking to Otto: no rod (${mes('barbA').slice(-1)})`);
// ---- Otto: meet him, ask about the rod. A page is continued the way ResumePauseButtonHandler does;
// a menu is answered with the first option whose text is the one we want.
function talk(p: any, name: string, wanted: string[]): string[] {
    const want = [...wanted];
    H.opNpc(p, otto!, 1);
    for (let t = 0; t < 12 && !p.activeScript; t++) H.tick(1);
    const said: string[] = [];
    for (let i = 0; i < 40 && p.activeScript; i++) {
        const last = texts(name).slice(-4);
        const pick = want.find(w => last.includes(w) && p.resumeButtons?.length);
        if (pick) {
            const all = texts(name); const opts = all.slice(all.lastIndexOf('Select an Option') + 1);
            const multi = opts.length === 3 ? 'multi3' : 'multi2';
            const ok = H.choose(p, `${multi}:com_${opts.indexOf(pick) + 1}`);
            said.push('> ' + pick + (ok ? '' : ' (NOT CHOSEN)'));
            want.splice(want.indexOf(pick), 1);
        } else {
            said.push(last.slice(-1)[0]);
            p.executeScript(p.activeScript, true, true);
        }
        H.tick(1);
    }
    console.log('  dialogue:\n    ' + said.join('\n    '));
    return said;
}
const said = talk(a, 'barbA', ['You think so?', 'What can I learn about the use of a fishing rod?', 'I have no more questions at this time.']);
check(H.getVar(a, 'barbarian_fishing') === 1 && !(a as any).activeScript && said.slice(-1)[0] === 'In that case, farewell.', "Otto's rod lesson sets %barbarian_fishing to 1; 'no more questions' ends it");
(a as any).closeModal();
H.setVar(a, 'barbarian_fishing', 1);
H.opLoc(a, 2500, 3490, 'loc474_25268', 1);
H.tick(12);
console.log(`  at the bed: ${a.x},${a.z}; ${mes('barbA').slice(-1)}`);
check(H.invCount(a, 'barbarian_rod') === 1, 'bed after Otto\'s lesson: a barbarian rod');

// ---- fishing: levels 80/50/50 reach all three fish
a.setLevel(PlayerStat.FISHING, 80);
a.setLevel(PlayerStat.AGILITY, 50);
a.setLevel(PlayerStat.STRENGTH, 50);
H.give(a, 'feather', 200);
const spot = H.npcNear('barbarian_fishing_spot', 2504, 3497)!;
spot.timerInterval = 0; // hold it still for the test
a.teleport(spot.x - 1, spot.z, 0);
H.tick(2);
const xp0 = { f: a.stats[PlayerStat.FISHING], ag: a.stats[PlayerStat.AGILITY], st: a.stats[PlayerStat.STRENGTH] };
H.opNpc(a, spot, 1);
H.tick(300);
const fish = { trout: H.invCount(a, 'leaping_trout'), salmon: H.invCount(a, 'leaping_salmon'), sturgeon: H.invCount(a, 'leaping_sturgeon') };
const caught = fish.trout + fish.salmon + fish.sturgeon;
const dxp = { f: (a.stats[PlayerStat.FISHING] - xp0.f) / 10, ag: (a.stats[PlayerStat.AGILITY] - xp0.ag) / 10, st: (a.stats[PlayerStat.STRENGTH] - xp0.st) / 10 };
console.log('  caught', fish, 'xp', dxp, 'feathers left', H.invCount(a, 'feather'));
check(caught > 10, `caught leaping fish in 300 ticks: ${caught}`);
check(fish.trout > 0 && fish.salmon > 0 && fish.sturgeon > 0, 'all three kinds at 80/50/50');
check(dxp.f === fish.trout * 50 + fish.salmon * 70 + fish.sturgeon * 80, `Fishing xp ${dxp.f} = 50/70/80 per fish`);
const agstr = fish.trout * 5 + fish.salmon * 6 + fish.sturgeon * 7;
check(dxp.ag === agstr && dxp.st === agstr, `Agility ${dxp.ag} and Strength ${dxp.st} xp = 5/6/7 per fish (${agstr})`);
check(H.invCount(a, 'feather') === 200 - caught, 'one feather per catch');
check(H.getVar(a, 'barbarian_fishing') === 2, 'a catch moves %barbarian_fishing to 2');
check(mes('barbA').some(m => m === 'You catch a leaping sturgeon.'), 'catch message');
a.teleport(2503, 3488, 0);
H.tick(2);
const said2 = talk(a, 'barbA', ["I've fished with a barbarian rod!", 'I have no more questions at this time.']);
check(said2.some(l => l.includes('roe and caviar is more useful for us')) && said2.slice(-1)[0] === 'In that case, farewell.', 'after a catch Otto talks of the eggs and the knife');

// ---- trout-only levels catch only trout
const c = H.makePlayer('barbC', 2502, 3487, 2130706435);
H.tick(2);
H.maxOut(c);
H.clearInv(c);
c.setLevel(PlayerStat.FISHING, 99);
c.setLevel(PlayerStat.AGILITY, 20);
c.setLevel(PlayerStat.STRENGTH, 99);
H.give(c, 'barbarian_rod');
H.give(c, 'fish_offcuts', 5);
H.give(c, 'feather', 50);
const spot2 = H.npcNear('barbarian_fishing_spot', 2506, 3493)!;
spot2.timerInterval = 0;
c.teleport(spot2.x - 1, spot2.z, 0);
H.tick(2);
H.opNpc(c, spot2, 1);
H.tick(150);
const cT = H.invCount(c, 'leaping_trout'), cO = H.invCount(c, 'leaping_salmon') + H.invCount(c, 'leaping_sturgeon');
console.log(`  20 Agility: trout ${cT}, other ${cO}, offcuts ${H.invCount(c, 'fish_offcuts')}, feathers ${H.invCount(c, 'feather')}`);
check(cT > 0 && cO === 0, '20 Agility catches trout only');
check(H.invCount(c, 'fish_offcuts') === Math.max(0, 5 - cT) && (cT <= 5 || H.invCount(c, 'feather') === 50 - (cT - 5)), 'offcuts are used before feathers');

// ---- too low: refused with the message
const b = H.makePlayer('barbB', 2502, 3487, 2130706434);
H.tick(2);
H.maxOut(b);
H.clearInv(b);
b.setLevel(PlayerStat.FISHING, 47);
H.give(b, 'barbarian_rod');
H.give(b, 'feather', 50);
b.teleport(spot.x - 1, spot.z, 0);
H.tick(2);
H.opNpc(b, spot, 1);
H.tick(20);
console.log('  47 Fishing texts:', texts('barbB'));
check(texts('barbB').some(t => t.includes('You need at least 48 Fishing, 15 Agility and 15 Strength')), '47 Fishing refused with the message');
check(H.invCount(b, 'leaping_trout') === 0 && H.invCount(b, 'feather') === 50, 'nothing caught, no bait used');
// no bait
H.clearInv(b);
b.setLevel(PlayerStat.FISHING, 99);
H.give(b, 'barbarian_rod');
H.opNpc(b, spot, 1);
H.tick(10);
check(texts('barbB').some(t => t.includes("You don't have any bait left.")), 'no bait: refused');

// ---- gutting: knife on each fish, both directions; 99 Cooking
H.clearLogs();
const d = H.makePlayer('barbD', 2502, 3487, 2130706436);
H.tick(2);
H.maxOut(d);
H.clearInv(d);
H.give(d, 'knife');
for (let i = 0; i < 5; i++) H.give(d, 'leaping_sturgeon');
for (let i = 0; i < 5; i++) H.give(d, 'leaping_trout');
const ck0 = d.stats[PlayerStat.COOKING];
useOn(d, 'knife', 'leaping_sturgeon');
H.tick(20);
const cav = H.invCount(d, 'caviar');
console.log(`  sturgeon x5 at 99 Cooking: caviar ${cav}, offcuts ${H.invCount(d, 'fish_offcuts')}, cooking xp ${(d.stats[PlayerStat.COOKING] - ck0) / 10}`);
check(H.invCount(d, 'leaping_sturgeon') === 0 && cav === 5, 'all five sturgeon gutted (auto-repeat), 100% caviar at 80+ Cooking');
check(d.stats[PlayerStat.COOKING] - ck0 === 5 * 150, '15 Cooking xp per caviar');
const ck1 = d.stats[PlayerStat.COOKING];
useOn(d, 'leaping_trout', 'knife');
H.tick(20);
const roe = H.invCount(d, 'roe');
console.log(`  trout x5 at 99 Cooking: roe ${roe}, offcuts ${H.invCount(d, 'fish_offcuts')}, cooking xp ${(d.stats[PlayerStat.COOKING] - ck1) / 10}`);
check(H.invCount(d, 'leaping_trout') === 0, 'trout on knife works too; all gutted');
check(d.stats[PlayerStat.COOKING] - ck1 === roe * 100, '10 Cooking xp per roe');
console.log('  messages:', [...new Set(mes('barbD'))]);
// low Cooking: sturgeon at 1 Cooking mostly fails
d.setLevel(PlayerStat.COOKING, 1);
for (let i = 0; i < 20; i++) H.give(d, 'leaping_salmon');
const cav1 = H.invCount(d, 'roe');
useOn(d, 'knife', 'leaping_salmon');
H.tick(70);
console.log(`  salmon x20 at 1 Cooking: roe gained ${H.invCount(d, 'roe') - cav1}, salmon left ${H.invCount(d, 'leaping_salmon')}`);
check(H.invCount(d, 'leaping_salmon') === 0 && H.invCount(d, 'roe') - cav1 <= 3, 'at 1 Cooking salmon rarely gives roe (1/80)');
// eat roe
d.levels[PlayerStat.HITPOINTS] = 50;
H.opheld(d, 'roe', 1);
H.tick(2);
check(d.levels[PlayerStat.HITPOINTS] === 53, `roe heals 3 (${d.levels[PlayerStat.HITPOINTS]})`);

// ---- spots move on their own timer
const s3 = spots.find(n => n.timerInterval > 0)!;
const seen = new Set([`${s3.x},${s3.z}`]);
for (let t = 0; t < 1200; t++) { H.tick(1); seen.add(`${s3.x},${s3.z}`); }
console.log(`  the free spot stood at: ${[...seen].join(' ')}`);
check(seen.size > 1 && [...seen].every(c => ['2504,3497', '2520,3518', '2506,3493', '2500,3506', '2500,3512'].includes(c)), 'a spot moves among the five wiki positions');

console.log(fails ? `${fails} FAILED` : 'all ok');
process.exit(fails ? 1 : 0);
