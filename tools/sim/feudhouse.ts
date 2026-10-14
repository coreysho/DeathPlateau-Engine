// The Mayor's house, on its own. The playthrough reached it with the keys and then stopped twice:
// the cactus never set feud_var_mayorsdoor, and the staircase never changed the player's level.
// Both ops reported as sent, which means a script ran and took a branch - so this prints the branch
// it took, with the state it took it on.
import * as H from './harness.js';
import * as a1lib from './a1lib.js';
import LocType from '#/cache/config/LocType.js';
import VarBitType from '#/cache/config/VarBitType.js';
import ObjType from '#/cache/config/ObjType.js';
import InvType from '#/cache/config/InvType.js';

await H.boot();
// MADE THE WAY THE RUN MAKES ITS PLAYER. A first version called H.loginOrder, which runs the real
// login script - and that teleported the player to Lumbridge a few ticks later and ate the equips,
// so the cactus test measured the login, not the cactus.
const p = H.makePlayer('feudhouse', 3363, 2968);
H.tick(2);
H.maxOut(p);
p.teleport(3363, 2968, 0);
H.tick(1);
(p as any).applyDamage = function () {};

const V = (n: string) => (VarBitType.getId(n) !== -1 ? H.getVarBit(p, n) : H.getVar(p, n));
const SV = (n: string, v: number) => (VarBitType.getId(n) !== -1 ? H.setVarBit(p, n, v) : H.setVar(p, n, v));
const worn = () => {
    const inv = p.getInventory(InvType.WORN);
    const out: string[] = [];
    if (inv) for (let i = 0; i < inv.capacity; i++) {
        const o = inv.get(i);
        if (o) out.push(i + ':' + ObjType.get(o.id).debugname);
    }
    return out.join(', ') || '(nothing)';
};
const show = (label: string, lines: string[]) => {
    console.log('  ' + label);
    for (const l of lines.slice(0, 4)) console.log('      "' + l.slice(0, 110) + '"');
};

SV('feud_var', 36);          // ^feud_heist
SV('macro_event', 1);
H.give(p, 'feud_mayors_house_keys', 1);
H.give(p, 'feud_karidian_fakebeard_and_hat', 1);
H.give(p, 'leather_gloves', 1);

console.log('');
console.log('the cactus');
H.opheld(p, 'feud_karidian_fakebeard_and_hat', 2); a1lib.drive(p);
H.opheld(p, 'leather_gloves', 2); a1lib.drive(p);
console.log('  worn: ' + worn());
const lt: any = LocType.get(LocType.getId('feud_cactus_row'));
console.log('  cactus forceapproach=' + lt.forceapproach + ' w=' + lt.width + ' l=' + lt.length
    + ' ops=' + JSON.stringify(lt.op));
H.opLoc(p, 3363, 2967, 'feud_cactus_row', 1);
show('after the click, at ' + p.x + ',' + p.z + ', mayorsdoor=' + V('feud_var_mayorsdoor'), a1lib.drive(p));
H.tick(8);
console.log('  settled at ' + p.x + ',' + p.z + ', mayorsdoor=' + V('feud_var_mayorsdoor'));

console.log('');
console.log('the staircase');
p.teleport(3373, 2977, 0);
H.tick(2);
const st: any = LocType.get(LocType.getId('feud_insidestairs_base'));
console.log('  stairs forceapproach=' + st.forceapproach + ' w=' + st.width + ' l=' + st.length
    + ' ops=' + JSON.stringify(st.op));
H.opLoc(p, 3373, 2978, 'feud_insidestairs_base', 1);
show('after the click, at ' + p.x + ',' + p.z + ' L' + p.level, a1lib.drive(p));
H.tick(8);
console.log('  settled at ' + p.x + ',' + p.z + ' L' + p.level);
