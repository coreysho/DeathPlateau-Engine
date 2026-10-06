// Three owner reports, one run.
//
//   1. the make-x panel never went away. Spin a ball of wool and the "What would you like to make?"
//      chatbox interface sat there over the whole batch. Nothing was closing it: mes() does not, and
//      the 377 client only drops a chatbox interface on IF_CLOSE or when another interface opens. The
//      nine make-x procs in content interface_chat/scripts/chat.rs2 (multiobj2..4, multiobj3_close,
//      skillmulti1..5) now if_close the moment p_pausebutton wakes, which is every skill that has a
//      chooser: spinning, glassblowing, log cutting, smithing's blurite window and the gnome fruit.
//   2. a pet drew a yellow npc dot on the minimap.
//   3. and it offered its Pick-up / Talk-to / Metamorphosis to everyone, not just its owner.
//
// 2 and 3 are one flag: follower=yes, on every npc in the tree that carries param=pet_item_id. It
// sets the cache's own "no minimap dot" bit, which is what Old School's own pet records do, and it
// tells the client this npc's options belong to whoever is following it. Which npc that is comes
// from the follower slot's own varp, now transmitted with clientcode 12 - the client keeps the npc
// index out of the uid and Client.addNpcOptions drops every option from any other follower. The
// client half cannot be simmed here; what is checked is the half the server has to get right.
import * as H from './harness.ts';
import Component from '#/cache/config/Component.js';
import NpcType from '#/cache/config/NpcType.js';
import ObjType from '#/cache/config/ObjType.js';
import ParamType from '#/cache/config/ParamType.js';
import VarPlayerType from '#/cache/config/VarPlayerType.js';

await H.boot();
H.loginOrder();
let ok = 0, bad = 0;
const check = (what: string, got: unknown, want: unknown) => {
    const pass = JSON.stringify(got) === JSON.stringify(want);
    pass ? ok++ : bad++;
    console.log(`  ${pass ? 'ok  ' : 'FAIL'} ${what}: ${JSON.stringify(got)}${pass ? '' : `   (want ${JSON.stringify(want)})`}`);
};

// ---------------------------------------------------------------- 1. the spinning wheel's panel
// The Lumbridge castle wheel, first floor.
const spinner: any = H.makePlayer('spin_a', 3209, 3213, 91);
spinner.level = 1;
H.maxOut(spinner); // a bow string wants 10 Crafting; the panel is the point here, not the level gate
H.tick(3);
H.clearInv(spinner);
H.give(spinner, 'wool', 5);

console.log('SPINNING WHEEL - ONE THING TO SPIN');
H.opLoc(spinner, 3209, 3212, 'spinningwheel', 2);
H.tick(2);
check('the chooser is open', spinner.modalChat, Component.getId('skillmulti1'));
check('  and it is waiting on a button', spinner.resumeButtons.length > 0, true);
check('Make 1 is a button it will wake for', spinner.resumeButtons.indexOf(Component.getId('skillmulti1:com_6')) !== -1, true);
H.choose(spinner, 'skillmulti1:com_6');
check('choosing closes the panel there and then', spinner.modalChat, -1);
H.tick(6);
check('  and the wool is a ball of wool', [H.invCount(spinner, 'wool'), H.invCount(spinner, 'ball_of_wool')], [4, 1]);

console.log('SPINNING WHEEL - TWO THINGS TO SPIN');
H.give(spinner, 'flax', 3);
H.tick(2);
H.opLoc(spinner, 3209, 3212, 'spinningwheel', 2);
H.tick(2);
check('the two-product chooser is open', spinner.modalChat, Component.getId('skillmulti2'));
H.choose(spinner, 'skillmulti2:com_11');
check('choosing closes it too', spinner.modalChat, -1);
H.tick(6);
check('  and the flax is a bow string', [H.invCount(spinner, 'flax'), H.invCount(spinner, 'bow_string')], [2, 1]);

// Every make-x chooser shares the fix, so none of them may be left without the close.
const chat = (await import('node:fs')).readFileSync('../content/scripts/interface_chat/scripts/chat.rs2', 'latin1')
    .replace(/\r\n/g, '\n');
const makex = ['multiobj2', 'multiobj3', 'multiobj3_close', 'multiobj4',
               'skillmulti1', 'skillmulti2', 'skillmulti3', 'skillmulti4', 'skillmulti5'];
const unclosed = makex.filter(name => {
    const body = chat.split(`[proc,${name}]`)[1]?.split('\n[proc,')[0] ?? '';
    return !/p_pausebutton;\nif_close;/.test(body);
});
check('every make-x chooser closes on the choice', unclosed, []);

// ---------------------------------------------------------------- 2 and 3. what a pet is
console.log('PETS');
const petItem = ParamType.getId('pet_item_id');
const pets: number[] = [];
for (let i = 0; i < NpcType.count; i++) {
    if (NpcType.get(i).params?.has(petItem)) pets.push(i);
}
check('every npc with a pet item is flagged a follower', pets.filter(i => !NpcType.get(i).follower).length, 0);
check('  ...and none of them draws a minimap dot', pets.filter(i => NpcType.get(i).minimap).length, 0);
// COUNTED, NOT WRITTEN DOWN. This was the literal 73, which went stale twice without anybody
// noticing - the number only moves when a pet or a metamorphosis form is added, which is exactly
// when nobody is looking at this file. The invariant it was reaching for is the real one: every npc
// that carries pet_item_id is a member of some pet item's metamorphosis ring, walked from the base
// the item names in follower_id. An npc with the param that no ring reaches is a form that can
// never be shown; a ring member without the param is a form the pick-up cannot identify.
{
    const followerId = ParamType.getId('follower_id');
    const metamorphNext = ParamType.getId('metamorph_next');
    const reachable = new Set<number>();
    for (let i = 0; i < ObjType.count; i++) {
        const base = ObjType.get(i)?.params?.get(followerId) as number | undefined;
        if (typeof base !== 'number') continue;
        let at: number | undefined = base;
        for (let step = 0; step < 32 && typeof at === 'number' && !reachable.has(at); step++) {
            reachable.add(at);
            at = NpcType.get(at).params?.get(metamorphNext) as number | undefined;
        }
    }
    const unreachable = pets.filter(i => !reachable.has(i)).map(i => NpcType.get(i).debugname ?? String(i));
    const unmarked = [...reachable].filter(i => !NpcType.get(i).params?.has(petItem))
        .map(i => NpcType.get(i).debugname ?? String(i));
    console.log(`  ${pets.length} npcs carry a pet item; ${reachable.size} are reachable from one`);
    check("  ...and every one of them is on some pet item's ring", unreachable, []);
    check('  ...and every form on a ring carries the pet item', unmarked, []);
}
check('the cats are in that set as well as the boss and skilling pets',
    ['kittenpet1', 'growncat', 'overgrowncat', 'bosspet_kbd', 'skillpet_beaver', 'bosspet_kraken']
        .filter(n => !NpcType.get(NpcType.getId(n)).follower), []);
check('an ordinary npc is untouched: still a dot, still everyone\'s to click',
    [NpcType.get(NpcType.getId('goblin')).follower, NpcType.get(NpcType.getId('goblin')).minimap], [false, true]);

const slot = VarPlayerType.getByName('follower_uid')!;
check('the follower slot is sent to the client', slot.transmit, true);
check('  ...under the clientcode the client reads it at', slot.clientcode, 12);

const owner: any = H.makePlayer('pet_a', 3222, 3218, 92);
H.tick(3);
H.clearInv(owner);
H.give(owner, 'bosspet_kbd_item', 1);
H.opheld(owner, 'bosspet_kbd_item', 5);
H.tick(2);
const pet = H.followerOf(owner);
check('putting a pet down gives you a follower', pet !== null, true);
const uid = H.getVar(owner, 'follower_uid');
check('  ...and the varp the client gets names that npc', [uid & 0xffff, (uid >>> 16) & 0xffff],
    [pet?.nid ?? -1, NpcType.getId('bosspet_kbd')]);
check('  ...which is the npc index the client knows it by', pet?.nid === (uid & 0xffff), true);
check('  ...and it is a follower to the client', NpcType.get(pet?.type ?? 0).follower, true);

// Picking it back up empties the slot, so the client stops calling any npc yours.
H.opNpc(owner, pet!, 1);
H.tick(3);
check('picking it up empties the slot', H.getVar(owner, 'follower_uid') <= 0, true);
check('  ...and the pet is back in the pack', H.invCount(owner, 'bosspet_kbd_item'), 1);

// ------------------------------------------------- the Pet snakeling's three colours, in the hand
// Zulrah has three forms and so does the pet that drops from it. The ring is checked in the configs
// by content/tools/follower_battery.py; this is the right-click itself, because a ring that is
// closed on paper still has to come back round in play AND be remembered across a put-down.
{
    const owner2: any = H.makePlayer('pet_snake', 3226, 3218, 93);
    H.tick(3);
    H.clearInv(owner2);
    H.give(owner2, 'bosspet_snakeling_item', 1);
    H.opheld(owner2, 'bosspet_snakeling_item', 5);
    H.tick(2);
    const form = () => {
        const f = H.followerOf(owner2);
        return f ? (NpcType.get(f.type).debugname ?? String(f.type)) : 'none';
    };
    const seen = [form()];
    for (let i = 0; i < 3; i++) {
        H.opNpc(owner2, H.followerOf(owner2)!, 4);
        H.tick(2);
        seen.push(form());
    }
    check('the snakeling cycles its three colours and comes back round', seen,
        ['bosspet_snakeling', 'bosspet_snakeling_magma', 'bosspet_snakeling_tanzanite', 'bosspet_snakeling']);

    // and the chosen colour survives being put away, which is the whole point of %pet_form
    H.opNpc(owner2, H.followerOf(owner2)!, 4);
    H.tick(2);
    check('  ...stopping on the magma one', form(), 'bosspet_snakeling_magma');
    H.opNpc(owner2, H.followerOf(owner2)!, 1);
    H.tick(3);
    check('  ...which goes back in the pack', H.invCount(owner2, 'bosspet_snakeling_item'), 1);
    H.opheld(owner2, 'bosspet_snakeling_item', 5);
    H.tick(2);
    check('  ...and comes back out magma, not green', form(), 'bosspet_snakeling_magma');
}

console.log(`\n${ok} ok, ${bad} FAIL`);
process.exit(bad ? 1 : 0);
