// Planks from the sawmill before 2026-09-21 were obj 8187 (`plank`), a duplicate of the real Plank
// (`woodplank`) that no quest accepts. On login they become real planks, backpack and bank, one for
// one - then Horror from the Deep's bridge takes one.
import * as H from './harness.ts';
import InvType from '#/cache/config/InvType.js';
import ObjType from '#/cache/config/ObjType.js';

await H.boot();
H.loginOrder();
let ok = 0, bad = 0;
const check = (what: string, got: unknown, want: unknown) => {
    const pass = JSON.stringify(got) === JSON.stringify(want);
    pass ? ok++ : bad++;
    console.log(`  ${pass ? 'ok  ' : 'FAIL'} ${what}: ${JSON.stringify(got)}${pass ? '' : `   (want ${JSON.stringify(want)})`}`);
};
const BANK = InvType.getId('bank');
const bankCount = (p: any, name: string) => {
    const id = ObjType.getId(name);
    const inv = p.getInventory(BANK);
    let n = 0;
    for (let i = 0; i < inv.capacity; i++) {
        const s = inv.get(i);
        if (s && s.id === id) n += s.count;
    }
    return n;
};

console.log('Old planks on login:');
const p: any = H.makePlayer('oldplank', 2575, 3611);
H.clearInv(p);
H.give(p, 'plank', 3);
H.give(p, 'hammer', 1);
H.give(p, 'nails', 60);
p.invAdd(BANK, ObjType.getId('plank'), 25);
p.invAdd(BANK, ObjType.getId('woodplank'), 5);
H.tick(3);
check('backpack: 3 old planks -> 3 planks', [H.invCount(p, 'plank'), H.invCount(p, 'woodplank')], [0, 3]);
check('bank: 25 old + 5 real -> 30 real', [bankCount(p, 'plank'), bankCount(p, 'woodplank')], [0, 30]);
H.runProc(p, '[proc,sawmill_old_planks_login]');
check('a second login changes nothing', [H.invCount(p, 'woodplank'), bankCount(p, 'woodplank')], [3, 30]);

console.log(`\n${ok} ok, ${bad} failed`);
process.exit(bad ? 1 : 0);
