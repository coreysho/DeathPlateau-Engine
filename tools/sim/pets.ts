// Getting a pet, Old School's way (content npc/scripts/follower.rs2, ~pet_receive):
//   nothing following  -> it follows you
//   a follower out     -> into the pack
//   ...and a full pack -> Probita's
//   owned already      -> nothing, "...would have been followed..."
// and a boss drop, made from the npc's side, arriving on the killer the same way.
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
const obj = (n: string) => ObjType.getId(n);
// the pet's own line; the collection log's "New item added" can come after it
const told = (p: any, text: string) => H.mesgs.some(m => m.who === p.username && m.text === text) ? text : null;
const follower = (p: any) => {
    const o = H.getVar(p, 'follower_obj');
    return o === -1 ? null : ObjType.get(o).debugname;
};
const inPack = (p: any, n: string) => H.invCount(p, n);
const atProbita = (p: any) => {
    const inv = p.getInventory(InvType.getId('lostpet_store'))!;
    const out: string[] = [];
    for (let s = 0; s < inv.capacity; s++) if (inv.get(s)) out.push(ObjType.get(inv.get(s)!.id).debugname!);
    return out;
};
// through the killer's queue, as a death table gives one - a queue has the protected access the
// follower varps need, which a bare proc run from here does not
const receive = (p: any, pet: string) => { H.runProc(p, '[proc,pet_receive_later]', [obj(pet), 0]); H.tick(2); };

const p: any = H.makePlayer('pets_a', 3222, 3218, 70);
H.tick(3);
H.clearInv(p);

console.log('NOTHING FOLLOWING');
receive(p, 'bosspet_kbd_item');
check('it comes out and follows you', follower(p), 'bosspet_kbd_item');
check('  "being followed"', told(p, "You have a funny feeling like you're being followed."), "You have a funny feeling like you're being followed.");
check('  and nothing went in the pack', inPack(p, 'bosspet_kbd_item'), 0);

console.log('SOMETHING FOLLOWING');
receive(p, 'bosspet_giant_mole_item');
check('it goes in the pack', inPack(p, 'bosspet_giant_mole_item'), 1);
check('  "sneaking into your backpack"', told(p, 'You feel something weird sneaking into your backpack.'), 'You feel something weird sneaking into your backpack.');
check('  and the first pet still follows', follower(p), 'bosspet_kbd_item');

console.log('OWNED ALREADY');
receive(p, 'bosspet_giant_mole_item');
check('a second of one in the pack is not given', inPack(p, 'bosspet_giant_mole_item'), 1);
check('  "would have been followed"', told(p, 'You have a funny feeling like you would have been followed...'), 'You have a funny feeling like you would have been followed...');
receive(p, 'bosspet_kbd_item');
check('nor of the one following you', [follower(p), inPack(p, 'bosspet_kbd_item')], ['bosspet_kbd_item', 0]);

console.log('FULL PACK');
H.fillInv(p);
receive(p, 'bosspet_kalphite_queen_item');
check("it goes to Probita's", atProbita(p), ['bosspet_kalphite_queen_item']);
check('  and says so', told(p, "Your pet is waiting for you at Probita's in East Ardougne."), "Your pet is waiting for you at Probita's in East Ardougne.");
receive(p, 'bosspet_kalphite_queen_item');
check('  and counts as owned there', atProbita(p), ['bosspet_kalphite_queen_item']);

console.log('A BOSS DROP');
const q: any = H.makePlayer('pets_b', 3230, 3218, 71);
H.tick(2);
H.clearInv(q);
// the npc-side half of a death table: the pet handed over in %pet_pending and queued on the killer
H.runProc(q, '[proc,pet_receive_later]', [obj('bosspet_kbd_item'), 0]);
check('queued, not given on the spot', follower(q), null);
H.tick(2);
check('a pet handed over by ~pet_receive_later follows the killer a tick later', follower(q), 'bosspet_kbd_item');
check('  and %pet_pending is cleared', H.getVar(q, 'pet_pending'), -1);


console.log(`\n${ok} ok, ${bad} FAIL`);
process.exit(bad ? 1 : 0);
