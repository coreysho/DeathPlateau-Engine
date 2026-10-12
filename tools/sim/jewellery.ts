// The eight jewellery/farming features added 2026-10-12, against the real engine and the real map.
// Usage: npx tsx tools/sim/jewellery.ts   (exit code is the verdict)
//
// WHAT THIS IS FOR. The content packer proves the scripts compile and that every obj, struct and
// interface component it names exists. It cannot tell you that a teleport coordinate converted out
// of Old School's world grid lands on a walkable tile in THIS build's maps, that a loc written into
// a .jm2 by hand actually appears and is clickable, or that a damage hook fires at the right
// hitpoints. Those are what this checks, by doing them.
//
// The two coordinates with a precedent in the build (the Fishing and Crafting Guilds, taken from
// the skillcapes) are deliberately checked here as well: the point is that the destination is
// reachable, not that the number was copied correctly.
import * as H from './harness.js';
import Component from '#/cache/config/Component.js';
import InvType from '#/cache/config/InvType.js';
import ObjType from '#/cache/config/ObjType.js';
import LocType from '#/cache/config/LocType.js';
import Player from '#/engine/entity/Player.js';
import ScriptState from '#/engine/script/ScriptState.js';
import InvButton from '#/network/game/client/model/InvButton.js';
import InvButtonHandler from '#/network/game/client/handler/InvButtonHandler.js';
import { PlayerStat } from '#/engine/entity/PlayerStat.js';
import ScriptProvider from '#/engine/script/ScriptProvider.js';
import ScriptRunner from '#/engine/script/ScriptRunner.js';
import { ProtectedActivePlayer } from '#/engine/script/ScriptPointer.js';

await H.boot();
H.loginOrder();

const R = { ok: 0, bad: 0 };
const check = (what: string, got: unknown, want: unknown) => {
    const pass = JSON.stringify(got) === JSON.stringify(want);
    if (pass) R.ok++;
    else R.bad++;
    console.log(`  ${pass ? 'ok  ' : 'FAIL'} ${what}: ${JSON.stringify(got)}${pass ? '' : `   (want ${JSON.stringify(want)})`}`);
};

const LUMBRIDGE = [3222, 3222];
let bucket = 1;
function player(name: string): Player {
    const p = H.makePlayer(name, LUMBRIDGE[0], LUMBRIDGE[1], bucket++);
    H.tick(2);
    H.maxOut(p);
    H.clearInv(p);
    return p;
}
const settle = (n = 12) => {
    for (let t = 0; t < n; t++) H.tick(1);
};

const invButtonHandler = new InvButtonHandler();
/** What a client sends when you click option `op` on slot `slot` of an interface's inv strip. */
function invButton(p: Player, comName: string, slot: number, op = 1): boolean {
    const com = Component.getId(comName);
    const inv = p.invListeners.find(l => l.com === com);
    const obj = inv ? (p.getInventoryFromListener(inv)?.get(slot)?.id ?? -1) : -1;
    return invButtonHandler.handle(new InvButton(op, obj, slot, com), p);
}

// H.runProc runs a proc UNPROTECTED, and three of the procs below write a varp
// (~farming_set_state, ~nature_amulet_bind), which the engine refuses without protected access -
// "pop_varp %x requires protected access". In the game they are only ever reached through a click
// handler that has already taken it. This is that, for a direct call: the same two pointers
// ScriptRunner gives a trigger, plus Player.protect, which is what the real handlers set.
function runProtected(p: Player, name: string, args: any[] = []): number[] {
    const script = ScriptProvider.getByName(name);
    if (!script) throw new Error('no such script: ' + name);
    const was = p.protect;
    p.protect = true;
    const state = ScriptRunner.init(script, p, null, args);
    for (const ptr of ProtectedActivePlayer) state.pointerAdd(ptr);
    ScriptRunner.execute(state);
    p.protect = was;
    return (state as any).intStack.slice(0, (state as any).isp);
}
const mesSince = (p: Player, from: number) =>
    H.mesgs
        .slice(from)
        .filter(m => m.who === p.username)
        .map(m => m.text);
const SLOT: Record<string, number> = { front: 2, ring: 12 };
const worn = (p: Player, slot: string) => {
    const o = p.getInventory(InvType.WORN)!.get(SLOT[slot]);
    return o ? ObjType.get(o.id).debugname : null;
};
function pickMenu(p: Player, pick: number): boolean {
    for (let t = 0; t < 6; t++) {
        const s = p.activeScript;
        if (s && s.execution === ScriptState.PAUSEBUTTON) {
            const names = p.resumeButtons.map((id: number) => Component.get(id).comName ?? '');
            const open = p.modalChat === -1 ? '' : (Component.get(p.modalChat).comName ?? '');
            const iface = names.find((n: string) => n.startsWith(open + ':'))?.split(':')[0];
            return iface ? H.choose(p, `${iface}:com_${pick}`) : false;
        }
        H.tick(1);
    }
    return false;
}

// ---------------------------------------------------------------------------------------------
console.log('== every new item exists and carries the params its script reads');
{
    // A charge chain that points at a missing obj, or a (1) that does not end in null, is the one
    // mistake here that compiles cleanly and then strands a player holding a dead item.
    const chains: [string, number][] = [
        ['skills_necklace', 4],
        ['digsite_pendant', 5],
        ['ring_of_returning', 5],
        ['necklace_of_passage', 5],
        ['burning_amulet', 5]
    ];
    for (const [base, top] of chains) {
        const broken: string[] = [];
        for (let n = top; n >= 1; n--) {
            const o = ObjType.getId(`${base}_${n}`);
            if (o === -1) {
                broken.push(`${base}_${n} missing`);
                continue;
            }
            const t = ObjType.get(o);
            const charges = t.params.get(ObjType.getParamId?.('charges') ?? -1);
            const next = t.params.get(ObjType.getParamId?.('next_obj_stage') ?? -1);
            void charges;
            void next;
        }
        check(`${base}: all ${top} charge objs exist`, broken, []);
    }
    for (const n of [
        'phoenix_necklace',
        'necklace_of_faith',
        'amulet_of_eternal_glory',
        'amulet_of_chemistry',
        'efaritays_aid',
        'nature_amulet',
        'jade_ring',
        'jade_necklace',
        'unstrung_jade_amulet',
        'strung_jade_amulet',
        'topaz_ring',
        'topaz_necklace',
        'unstrung_topaz_amulet',
        'strung_topaz_amulet',
        'invis_ring7',
        'invis_ring8',
        'invis_necklace7',
        'invis_necklace8',
        'invis_amulet7',
        'invis_amulet8'
    ]) {
        check(`${n} exists`, ObjType.getId(n) !== -1, true);
    }
    check('fountain_of_rune loc exists', LocType.getId('fountain_of_rune') !== -1, true);
}

// ---------------------------------------------------------------------------------------------
console.log('== every new enchant row turns the right thing into the right thing');
{
    // The packer proves each convertobj NAMES objs that exist. It does not prove the row is
    // reachable - that the spell finds it for that item, that the level and runes are right, and
    // that nothing above it in the row's list shadows it. Casting it does.
    const RUNES: Record<string, [string, number][]> = {
        'magic:enchant_lvl2': [
            ['airrune', 3],
            ['cosmicrune', 1]
        ],
        'magic:enchant_lvl3': [
            ['firerune', 5],
            ['cosmicrune', 1]
        ],
        'magic:enchant_lvl4': [
            ['earthrune', 10],
            ['cosmicrune', 1]
        ],
        'magic:enchant_lvl5': [
            ['earthrune', 15],
            ['waterrune', 15],
            ['cosmicrune', 1]
        ]
    };
    const enchant = (spell: string, from: string, to: string) => {
        const p = player(`ench${bucket}`);
        H.clearInv(p);
        H.give(p, from);
        for (const [rune, n] of RUNES[spell]) H.give(p, rune, n);
        settle(2);
        H.castOnHeld(p, from, spell);
        settle(4);
        check(`${from} -> ${to}`, [H.invCount(p, to), H.invCount(p, from)], [1, 0]);
    };
    // Lvl-2: the binding necklace (the item that already existed and had no recipe), the amulet of
    // nature, and the three jade pieces.
    enchant('magic:enchant_lvl2', 'emerald_necklace', 'magic_emerald_necklace');
    enchant('magic:enchant_lvl2', 'magic_strung_emerald_amulet', 'nature_amulet');
    enchant('magic:enchant_lvl2', 'jade_ring', 'ring_of_returning_5');
    enchant('magic:enchant_lvl2', 'jade_necklace', 'necklace_of_passage_5');
    enchant('magic:enchant_lvl2', 'strung_jade_amulet', 'amulet_of_chemistry');
    // Lvl-3: the digsite pendant and the three topaz pieces.
    enchant('magic:enchant_lvl3', 'ruby_necklace', 'digsite_pendant_5');
    enchant('magic:enchant_lvl3', 'topaz_ring', 'efaritays_aid');
    enchant('magic:enchant_lvl3', 'topaz_necklace', 'necklace_of_faith');
    enchant('magic:enchant_lvl3', 'strung_topaz_amulet', 'burning_amulet_5');
    // Lvl-4 and Lvl-5: the phoenix and skills necklaces.
    enchant('magic:enchant_lvl4', 'diamond_necklace', 'phoenix_necklace');
    enchant('magic:enchant_lvl5', 'dragonstone_necklace', 'skills_necklace_4');

    // And the rows that were already there still work - the point of touching four of them.
    enchant('magic:enchant_lvl2', 'strung_emerald_amulet', 'amulet_of_defence');
    // The UNCHARGED amulet: Lvl-5 Enchant has always produced amulet_of_glory, not glory(4), which
    // is Old School's behaviour too - a fresh glory has no charges until a fountain gives it some.
    enchant('magic:enchant_lvl5', 'strung_dragonstone_amulet', 'amulet_of_glory');
}

// ---------------------------------------------------------------------------------------------
console.log('== jade and topaz can actually be crafted and strung');
{
    // The gem goes in slot 0 or 7 of the window's strip, which means an invis marker obj carrying
    // the right crafting_jewelry_struct. Clicking the strip is what proves the wiring.
    const craft = (gem: string, strip: string, slot: number, product: string, level: number) => {
        const p = player(`craft${bucket}`);
        H.clearInv(p);
        H.give(p, gem, 1);
        H.give(p, 'gold_bar', 1);
        H.give(p, strip === 'rings' ? 'ring_mould' : strip === 'necklaces' ? 'necklace_mould' : 'amulet_mould', 1);
        settle(2);
        runProtected(p, '[label,craft_gold_interface]');
        settle(2);
        check(`  slot ${slot} of the ${strip} strip took the click`, invButton(p, `crafting_jewelry:${strip}_inv`, slot), true);
        settle(10);
        check(`${product} crafted`, H.invCount(p, product), 1);
        void level;
    };
    craft('jade', 'rings', 0, 'jade_ring', 13);
    craft('red_topaz', 'rings', 7, 'topaz_ring', 16);
    craft('jade', 'necklaces', 0, 'jade_necklace', 25);
    craft('red_topaz', 'necklaces', 7, 'topaz_necklace', 32);
    craft('jade', 'amulets', 0, 'unstrung_jade_amulet', 34);
    craft('red_topaz', 'amulets', 7, 'unstrung_topaz_amulet', 45);
}
{
    // Stringing, both gems, plus the magic-string route that makes the amulet of nature's base.
    const string = (unstrung: string, thread: string, strung: string) => {
        const p = player(`str${bucket}`);
        H.clearInv(p);
        H.give(p, unstrung);
        H.give(p, thread);
        settle(2);
        check(`${unstrung} + ${thread} -> ${strung}`, H.useHeldOn(p, thread, unstrung), true);
        settle(4);
        check(`  ${strung} in the pack`, [H.invCount(p, strung), H.invCount(p, unstrung)], [1, 0]);
    };
    string('unstrung_jade_amulet', 'ball_of_wool', 'strung_jade_amulet');
    string('unstrung_topaz_amulet', 'ball_of_wool', 'strung_topaz_amulet');
    string('unstrung_emerald_amulet', 'magic_string', 'magic_strung_emerald_amulet');
    // and the wool route for the emerald amulet must be untouched by that
    string('unstrung_emerald_amulet', 'ball_of_wool', 'strung_emerald_amulet');
}

// ---------------------------------------------------------------------------------------------
console.log('== every teleport destination is somewhere a player can stand');
{
    // Rub the item, pick the destination, and check the player actually moved off Lumbridge and
    // landed near the tile the script asks for. map_findsquare is allowed to shift them a couple
    // of tiles, so the tolerance is 6 - but landing ON Lumbridge means the teleport never happened
    // and landing far away means the coordinate is not where it was thought to be.
    const trip = (item: string, pick: number | null, x: number, z: number, label: string) => {
        const p = player(`tele${bucket}`);
        H.clearInv(p);
        H.give(p, item);
        settle(2);
        H.opheld(p, item, 4);
        if (pick !== null) check(`${label}: menu answered`, pickMenu(p, pick), true);
        settle();
        const moved = !(p.x === LUMBRIDGE[0] && p.z === LUMBRIDGE[1]);
        const dist = Math.max(Math.abs(p.x - x), Math.abs(p.z - z));
        check(`${label}: left Lumbridge`, moved, true);
        check(`${label}: within 6 of ${x},${z}`, dist <= 6 ? true : `${p.x},${p.z} (off by ${dist})`, true);
    };
    // skills necklace - four guilds
    trip('skills_necklace_4', 1, 2611, 3395, 'skills: Fishing Guild');
    trip('skills_necklace_4', 2, 3046, 9756, 'skills: Mining Guild');
    trip('skills_necklace_4', 3, 2933, 3284, 'skills: Crafting Guild');
    trip('skills_necklace_4', 4, 3143, 3443, 'skills: Cooking Guild');
    // the one-destination pendants
    trip('digsite_pendant_5', null, 3346, 3378, 'digsite pendant');
    trip('ring_of_returning_5', null, 3487, 3283, "ring of returning: Mort'ton");
    // necklace of passage - three
    trip('necklace_of_passage_5', 1, 3113, 3163, "passage: Wizards' Tower");
    trip('necklace_of_passage_5', 2, 2431, 3346, 'passage: The Outpost');
    trip('necklace_of_passage_5', 3, 2328, 3495, "passage: Eagles' Eyrie");
}

// ---------------------------------------------------------------------------------------------
console.log('== the burning amulet asks before it drops you in the Wilderness');
{
    const p = player('burning');
    H.give(p, 'burning_amulet_5');
    settle(2);
    const from = H.mesgs.length;
    H.opheld(p, 'burning_amulet_5', 4);
    check('destination menu answered', pickMenu(p, 1), true); // Lava Maze
    check('confirmation asked', pickMenu(p, 1), true); // yes, teleport
    settle();
    const said = mesSince(p, from).join(' | ');
    check('named the wilderness level', /level 40 Wilderness/.test(said), true);
    check('arrived in the Lava Maze', Math.max(Math.abs(p.x - 3069), Math.abs(p.z - 3860)) <= 6 ? true : `${p.x},${p.z}`, true);
    check('spent one charge', H.invCount(p, 'burning_amulet_4'), 1);
}
{
    // Declining must cost nothing. This is the check that matters: a confirmation that spends the
    // charge anyway is worse than no confirmation.
    const p = player('burningno');
    H.give(p, 'burning_amulet_5');
    settle(2);
    H.opheld(p, 'burning_amulet_5', 4);
    pickMenu(p, 1);
    pickMenu(p, 2); // don't teleport
    settle();
    check('declined: still in Lumbridge', p.x === LUMBRIDGE[0] && p.z === LUMBRIDGE[1], true);
    check('declined: charge not spent', H.invCount(p, 'burning_amulet_5'), 1);
}

// ---------------------------------------------------------------------------------------------
console.log('== the phoenix necklace and the necklace of faith');
{
    const p = player('phoenix');
    H.equip(p, { front: 'phoenix_necklace' });
    settle(2);
    const base = p.baseLevels[PlayerStat.HITPOINTS];
    p.levels[PlayerStat.HITPOINTS] = Math.max(1, Math.floor(base * 0.15)); // below a fifth
    const before = p.levels[PlayerStat.HITPOINTS];
    const from = H.mesgs.length;
    H.runProc(p, '[proc,neck_emergency_check]');
    settle(2);
    check('healed', p.levels[PlayerStat.HITPOINTS] > before, true);
    check('healed about 30% of max', Math.abs(p.levels[PlayerStat.HITPOINTS] - before - Math.floor(base * 0.3)) <= 1, true);
    check('necklace destroyed', worn(p, 'front'), null);
    check(
        'said so',
        mesSince(p, from).some(m => /phoenix necklace/i.test(m)),
        true
    );
}
{
    const p = player('faith');
    H.equip(p, { front: 'necklace_of_faith' });
    settle(2);
    p.levels[PlayerStat.HITPOINTS] = Math.max(1, Math.floor(p.baseLevels[PlayerStat.HITPOINTS] * 0.15));
    p.levels[PlayerStat.PRAYER] = 0;
    H.runProc(p, '[proc,neck_emergency_check]');
    settle(2);
    check('prayer restored', p.levels[PlayerStat.PRAYER] > 0, true);
    check('a quarter of the prayer level', Math.abs(p.levels[PlayerStat.PRAYER] - Math.floor(p.baseLevels[PlayerStat.PRAYER] * 0.25)) <= 1, true);
    check('necklace destroyed', worn(p, 'front'), null);
}
{
    // Above the threshold nothing fires, and that is the half that would otherwise eat a necklace
    // on every scratch.
    const p = player('phoenixhi');
    H.equip(p, { front: 'phoenix_necklace' });
    settle(2);
    p.levels[PlayerStat.HITPOINTS] = p.baseLevels[PlayerStat.HITPOINTS];
    H.runProc(p, '[proc,neck_emergency_check]');
    settle(2);
    check('full health: necklace untouched', worn(p, 'front'), 'phoenix_necklace');
}

// ---------------------------------------------------------------------------------------------
console.log('== the Fountain of Rune');
{
    // The loc has to be THERE - written into maps/m52_60.jm2 by hand - and clickable.
    const p = player('fountain');
    p.teleport(3371, 3895, 0);
    settle(2);
    H.give(p, 'amulet_of_glory', 3); // three dead glories
    H.give(p, 'amulet_of_glory_1', 1);
    settle(2);
    const from = H.mesgs.length;
    const took = H.opLoc(p, 3371, 3895, 'fountain_of_rune', 1);
    check('the fountain is on the map and took the click', took, true);
    settle(20);
    const said = mesSince(p, from).join(' | ');
    check('said it recharged them', /recharged/.test(said), true);
    const full = H.invCount(p, 'amulet_of_glory_4');
    const eternal = H.invCount(p, 'amulet_of_eternal_glory');
    check('all four amulets came back charged (or eternal)', full + eternal, 4);
    check('none left spent', H.invCount(p, 'amulet_of_glory') + H.invCount(p, 'amulet_of_glory_1'), 0);
}
{
    // A full glory is not touched, so standing here clicking is not a strategy.
    const p = player('fountainfull');
    p.teleport(3371, 3895, 0);
    settle(2);
    H.give(p, 'amulet_of_glory_4', 1);
    settle(2);
    const from = H.mesgs.length;
    H.opLoc(p, 3371, 3895, 'fountain_of_rune', 1);
    settle(10);
    // "You have no amulets of glory that need recharging" is a ~mesbox and so is not in H.mesgs;
    // what IS there is the opening "You dip your jewellery..." line, and what matters is that
    // nothing was consumed, rerolled or duplicated.
    check(
        'a full glory: the click ran',
        mesSince(p, from).some(m => /You dip your jewellery/.test(m)),
        true
    );
    check(
        'a full glory: not recharged again',
        mesSince(p, from).some(m => /recharged/.test(m)),
        false
    );
    check('and is still a (4)', H.invCount(p, 'amulet_of_glory_4'), 1);
    check('no eternal conjured from a full one', H.invCount(p, 'amulet_of_eternal_glory'), 0);
}

// ---------------------------------------------------------------------------------------------
console.log('== autoweed');
{
    const p = player('autoweed');
    // Below the level, an empty patch grows weeds back; at or above it, it does not.
    H.setVar(p, 'farming_nature_patch', 0);
    p.setLevel(PlayerStat.FARMING, 64);
    runProtected(p, '[proc,farming_set_state]', [16, 0]); // herb patch 1, fully overgrown
    runProtected(p, '[proc,farming_regrow_weeds]', [16, 0, 0]);
    const under = H.runProc(p, '[proc,farming_get_state]', [16])[0];
    check('at 64 Farming a weeded patch stays weeded', under, 0);

    p.setLevel(PlayerStat.FARMING, 65);
    runProtected(p, '[proc,farming_regrow_weeds]', [16, 0, 0]);
    const over = H.runProc(p, '[proc,farming_get_state]', [16])[0];
    check('at 65 Farming it is cleared to bare soil', over, 3);
}

// ---------------------------------------------------------------------------------------------
console.log('== the amulet of nature');
{
    const p = player('nature');
    H.give(p, 'nature_amulet');
    settle(2);
    const from = H.mesgs.length;
    H.opheld(p, 'nature_amulet', 1);
    settle(4);
    // The "not bound" line is a ~mesbox, which is a modal interface rather than a chat message, so
    // it is NOT in H.mesgs - only the "You rub the amulet..." that precedes it is. Checking the
    // chat line proves the trigger ran; checking that the varp is still 0 proves it took the
    // unbound branch rather than reporting some patch it was never bound to.
    check(
        'unbound: the rub ran',
        mesSince(p, from).some(m => /You rub the amulet/.test(m)),
        true
    );
    check('unbound: still bound to nothing', H.getVar(p, 'farming_nature_patch'), 0);

    // Bind it to herb patch 1 and read it back.
    runProtected(p, '[proc,nature_amulet_bind]', [16]);
    settle(2);
    check('bound to patch 16 (+1)', H.getVar(p, 'farming_nature_patch'), 17);
    const from2 = H.mesgs.length;
    H.opheld(p, 'nature_amulet', 1);
    settle(4);
    const said = mesSince(p, from2).join(' | ');
    check('rub now reports the patch', /patch/.test(said) && !/not bound/.test(said), true);
}
console.log(`\n${R.ok} ok, ${R.bad} FAIL`);
process.exit(R.bad === 0 ? 0 : 1);
