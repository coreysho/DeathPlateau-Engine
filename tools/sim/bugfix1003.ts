// The seven bugs reported on 3 October 2026, each on the real engine.
//
//   1  Farmer's strawhat was bright orange          - a stale OSRS conversion, re-encoded
//   2  the Dwarven rock cake could be eaten whole   - it costs a hitpoint and stays in the pack
//   3  Studded body/chaps (t) had no armour at all  - and Black mask (i) was missing two penalties
//   4  Magic shortbow (i) had no glow               - it was the plain bow's model recoloured
//   5  the Rogue outfit existed twice               - the cache's unused copy is gone
//   6  the Easter ring did nothing                  - it turns you into an egg
//   7  clue loot vanished on a full inventory       - it goes on the floor
//
//   npx tsx tools/sim/bugfix1003.ts
import { readFileSync } from 'fs';

import * as H from './harness.ts';
import * as A from './a1lib.ts';
import { check, R, player, World } from './a1lib.ts';
import ObjType from '#/cache/config/ObjType.js';
import InvType from '#/cache/config/InvType.js';
import ParamType from '#/cache/config/ParamType.js';
import NpcType from '#/cache/config/NpcType.js';

await H.boot();

const obj = (name: string) => ObjType.get(ObjType.getId(name));
const param = (name: string, p: string) => {
    const t = obj(name) as any;
    const id = ParamType.getId(p);
    return t.params?.get(id) ?? null;
};
const hp = (p: any) => p.levels[3];
const setHp = (p: any, n: number) => { p.levels[3] = n; };

// ---------------------------------------------------------------- 1. the strawhat
// The model is 39 faces of straw. They used to be colour 6070 - osrs2ob2's TEXTURED_HSL, the
// orange-brown last resort for a texture the table did not know - because the hat was converted
// before osrstexhsl.py existed. Texture 18 is `thatched`, which 377 has under the same id, so the
// re-encode keeps it textured instead of painting it.
console.log("THE FARMER'S STRAWHAT IS STRAW, NOT ORANGE");
{
    const raw = readFileSync('../content/models/obj/obj_farmers_strawhat.ob2');
    // colour 6070 appears in the face-colour block as two bytes 0x17 0xB6
    let orange = 0;
    for (let i = 0; i + 1 < raw.length; i++) if (raw[i] === 0x17 && raw[i + 1] === 0xb6) orange++;
    check('  no face is painted TEXTURED_HSL any more', orange, 0);
}

// ---------------------------------------------------------------- 2. the rock cake
console.log('\nTHE DWARVEN ROCK CAKE IS NOT FOOD');
{
    const p: any = player('cake', 3200, 3200);
    H.give(p, 'hundred_dwarf_cool_rockcake', 1);

    setHp(p, 10);
    H.opheld(p, 'hundred_dwarf_cool_rockcake', 1);          // Eat
    check('  eating costs one hitpoint', hp(p), 9);
    check('  and the cake is still in the pack', H.invCount(p, 'hundred_dwarf_cool_rockcake'), 1);

    setHp(p, 2);
    H.opheld(p, 'hundred_dwarf_cool_rockcake', 1);
    check('  at 2 hitpoints eating does nothing', hp(p), 2);

    setHp(p, 20);
    H.opheld(p, 'hundred_dwarf_cool_rockcake', 2);          // Guzzle
    check('  guzzling takes a tenth plus one (20 -> 17)', hp(p), 17);

    setHp(p, 2);
    H.opheld(p, 'hundred_dwarf_cool_rockcake', 2);
    check('  and it can reach 1, which Eat cannot', hp(p), 1);

    H.opheld(p, 'hundred_dwarf_cool_rockcake', 2);
    check('  at 1 hitpoint it cannot kill you', hp(p), 1);
    check('  the cake survived all of that', H.invCount(p, 'hundred_dwarf_cool_rockcake'), 1);
    H.despawn(p);
}

// ---------------------------------------------------------------- 3. armour that defends
console.log('\nTRIMMED ARMOUR IS STILL ARMOUR');
for (const [variant, base] of [['studded_body_trim_fur', 'studded_body'],
                               ['studded_body_trim_gold', 'studded_body'],
                               ['studded_chaps_trim_fur', 'studded_chaps'],
                               ['studded_chaps_trim_gold', 'studded_chaps']] as [string, string][]) {
    const same = ['stabdefence', 'slashdefence', 'crushdefence', 'magicdefence', 'rangedefence',
                  'rangeattack', 'magicattack'].every(k => param(variant, k) === param(base, k));
    check(`  ${variant.padEnd(24)} matches ${base}`, same, true);
}
// An imbue raises the slayer bonus. It does not hand you +3 magic attack over the mask it was
// made from, which is what leaving these two off did.
check('  black_mask_i keeps the plain mask\'s magic attack penalty', param('black_mask_i', 'magicattack'), param('black_mask', 'magicattack'));
check('  and its ranged attack penalty', param('black_mask_i', 'rangeattack'), param('black_mask', 'rangeattack'));

// ---------------------------------------------------------------- 4. the glow
console.log('\nTHE MAGIC SHORTBOW (I) IS ITS OWN BOW');
{
    const plain = obj('magic_shortbow') as any;
    const imbued = obj('magic_shortbow_i') as any;
    check('  it no longer borrows the plain bow\'s model', imbued.model === plain.model, false);
    check('  nor its worn model', imbued.manwear === plain.manwear, false);
    const size = (n: string) => readFileSync(`../content/models/obj/${n}.ob2`).length;
    check('  and its model is the bigger of the two', size('obj_magic_shortbow_i') > size('obj_shortbow'), true);

    // ONE FRAME OF THE SPARKLE, NOT ALL THREE. Old School bakes the icon animation into the
    // mesh - the sparkle sits at three places along the limb, four faces each, and the client
    // shows one position per frame. 377 cannot animate an icon, so it drew all twelve at once
    // and the bow came out buried under pale slabs. tools/models/genmsbi.py marks eight of
    // them undrawn; this is what says they stayed that way.
    for (const n of ['obj_magic_shortbow_i', 'obj_magic_shortbow_i_manwear', 'obj_magic_shortbow_i_womanwear']) {
        const raw = readFileSync(`../content/models/obj/${n}.ob2`);
        const h = raw.length - 18;
        const g2 = (o: number) => (raw[o] << 8) | raw[o + 1];
        const vcount = g2(h), fcount = g2(h + 2), tcount = raw[h + 4];
        const [fTex, fPri, fAlpha, fFlab, fVlab] = [raw[h + 5], raw[h + 6], raw[h + 7], raw[h + 8], raw[h + 9]];
        let o = vcount + fcount;                       // vertex flags, face types
        if (fPri === 255) o += fcount;
        if (fFlab === 1) o += fcount;
        const finfoAt = o;
        if (fTex === 1) o += fcount;
        if (fVlab === 1) o += vcount;
        const alphaAt = o;
        if (fAlpha === 1) o += fcount;
        o += g2(h + 16);                               // face data
        const colourAt = o;
        let sparkle = 0, drawn = 0;
        for (let i = 0; i < fcount; i++) {
            if (g2(colourAt + i * 2) !== 9443) continue;   // the pale cream the sparkle is painted
            sparkle++;
            if (fAlpha !== 1 || raw[alphaAt + i] < 255) drawn++;
        }
        void finfoAt; void tcount;
        check(`  ${n.padEnd(34)} shows 4 of its ${sparkle} sparkle faces`, [sparkle, drawn], [12, 4]);
    }
}

// ---------------------------------------------------------------- 5. one Rogue outfit
console.log('\nTHE ROGUE OUTFIT EXISTS ONCE');
for (const name of ['Rogue top', 'Rogue mask', 'Rogue trousers', 'Rogue gloves', 'Rogue boots']) {
    let n = 0;
    for (let i = 0; i < ObjType.count; i++) {
        const t = ObjType.get(i);
        if (t && t.name === name && t.certlink === -1) n++;
    }
    check(`  "${name}" is one item`, n, 1);
}
check('  and the one that is wired up is the one that survived', ObjType.getId('rogue_top') >= 0, true);

// ---------------------------------------------------------------- 6. the Easter ring
console.log('\nTHE EASTER RING TURNS YOU INTO AN EGG');
{
    const p: any = player('bunny', 3200, 3200);
    H.give(p, 'easter06_ring_of_egg', 1);
    check('  you start as yourself', p.npcId, -1);

    H.opheld(p, 'easter06_ring_of_egg', 2);                 // Wear
    A.drive(p);                                            // the mesbox, and the tick the equip lands on
    check('  wearing it puts the ring on', p.getInventory(InvType.WORN)!.get(12)?.id, ObjType.getId('easter06_ring_of_egg'));
    const eggs = ['easter06_npc_3689', 'easter06_npc_3690', 'easter06_npc_3691',
                  'easter06_npc_3692', 'easter06_npc_3693', 'easter06_npc_3694']
        .map(n => NpcType.getId(n));
    check('  and turns you into one of the six eggs', eggs.includes(p.npcId), true);

    // Which egg is the map square's, so it is the same egg every time you stand there and a
    // different one elsewhere - the wiki's "depends on the player's current location".
    const here = p.npcId;
    p.teleport(2700, 3300, 0);
    H.runProc(p, '[proc,easter_ring_become_egg]');
    check('  a different part of the world is a different egg', p.npcId !== here, true);

    // Logging back in wearing it: p_transmogrify is not saved, the worn ring is.
    p.npcId = -1;
    H.runProc(p, '[proc,easter_ring_login]');
    check('  and logging in wearing it makes you an egg again', p.npcId !== -1, true);

    H.runProc(p, '[proc,easter_ring_removed]');
    check('  taking it off gives you back', p.npcId, -1);
    H.despawn(p);
}

// ---------------------------------------------------------------- 7. clue loot
console.log('\nCLUE LOOT THAT WILL NOT FIT GOES ON THE FLOOR');
{
    const p: any = player('clue', 3210, 3210);
    H.clearInv(p);
    // Four things waiting in the reward inv and nowhere to put any of them.
    const rewards = ['black_platebody', 'black_longsword', 'black_full_helm', 'black_platelegs'];
    rewards.forEach((o, i) => p.invSet(InvType.getId('trail_rewardinv'), ObjType.getId(o), 1, i));
    H.fillInv(p);
    check('  the pack is full', p.getInventory(InvType.INV)!.freeSlotCount, 0);

    const dropped = A.runProcProtected(p, '[proc,trail_flush_rewards]');
    check('  all four had to go somewhere else', dropped[0], 4);
    check('  the reward inv is empty, not holding them back',
        [0, 1, 2, 3].every(i => p.getInventory(InvType.getId('trail_rewardinv'))!.get(i) === null), true);
    // Looked for in the zone rather than picked up: the pack is still full, so take() cannot.
    const here = rewards.every(o => World.getObj(p.x, p.z, p.level, ObjType.getId(o), p.hash64) !== null);
    check('  and every one of them is on the ground under the player', here, true);
    H.despawn(p);
}

console.log(`\n${R.ok} ok, ${R.bad} FAIL`);
process.exit(R.bad ? 1 : 0);
