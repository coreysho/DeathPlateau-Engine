// THE COMBAT TAB REMEMBERS A STYLE PER WEAPON CATEGORY - run with `npx tsx tools/sim/atkstyle.ts`.
//
// Reported from play: "when equipping bows after login it automatically goes to longrange style".
// %com_mode was made perm on 2026-09-10 so that the style survived a logout, but it is ONE number
// for the whole character, and player_combat_stat.rs2 clamps it to the equipped weapon's style
// count - so a melee Block (index 3) carried onto a bow came out as the bow tab's last style,
// Longrange. Old School remembers one style per weapon CATEGORY instead (6th Birthday and QoL,
// 21 February 2019: "Weapons that share a category (daggers, swords, bows etc.) will now remember
// the combat style that was used"), which is what the content does now - eighteen three-bit slots
// over atkstyle_memory1/2, one per combat tab.
//
// This also guards the staff tab's five options against the restore, because picking an autocast
// spell ends in ~initalltabs and ~initalltabs redraws the combat tab (see tools/sim/magicfix.ts).
import * as H from './harness.ts';
import World from '#/engine/World.js';
import Player from '#/engine/entity/Player.js';
import ObjType from '#/cache/config/ObjType.js';
import InvType from '#/cache/config/InvType.js';
import VarPlayerType from '#/cache/config/VarPlayerType.js';
import { PlayerLoading } from '#/engine/entity/PlayerLoading.js';
import Packet from '#/io/Packet.js';
import ScriptProvider from '#/engine/script/ScriptProvider.js';
import ScriptRunner from '#/engine/script/ScriptRunner.js';
import ScriptPointer from '#/engine/script/ScriptPointer.js';

await H.boot();
H.loginOrder();
let ok = 0, bad = 0, n = 0;
const check = (what: string, got: unknown, want: unknown) => {
    const pass = JSON.stringify(got) === JSON.stringify(want);
    pass ? ok++ : bad++;
    console.log(`  ${pass ? 'ok  ' : 'FAIL'} ${what}: ${JSON.stringify(got)}${pass ? '' : `   (want ${JSON.stringify(want)})`}`);
};

const RHAND = 3;
const style = (p: Player) => H.getVar(p, 'com_mode');
const slot = (p: Player, name: string) => H.getVarBit(p, name);

/** A player past the tutorial, so that ~update_all is allowed to touch the combat tab at all. */
function fresh(): Player {
    const p = H.makePlayer('atks' + n, 3222, 3218, 60 + (n % 20));
    n++;
    H.tick(2);
    H.maxOut(p);
    H.clearInv(p);
    H.setVar(p, 'tutorial', 1000); // ^tutorial_complete
    H.tick(1);
    return p;
}

/**
 * Put a weapon in the right hand the way the game does it - through ~update_all, which is what
 * fires ~update_weapon_category and then ~player_combat_stat. H.equip only writes the inventory
 * slot, which is exactly the step this round's fix hangs off, so it cannot be used here.
 */
function wield(p: Player, objName: string | null) {
    const worn = p.getInventory(InvType.WORN)!;
    const previous = worn.get(RHAND)?.id ?? -1;
    if (objName === null) {
        if (previous !== -1) p.invDelSlot(InvType.WORN, RHAND);
    } else {
        const id = ObjType.getId(objName);
        if (id === -1) throw new Error('no such obj: ' + objName);
        p.invSet(InvType.WORN, id, 1, RHAND);
    }
    // WITH PROTECTED ACCESS, because that is what equipping really has: ~update_all runs
    // ~runecraft_sync_no_tally, which writes a varbit that demands it. H.runProc alone gets it from
    // the p_finduid inside ~update_all, and that call fails for a player who has just been logged
    // back in from a save - the proc then dies before it reaches ~update_weapon_category.
    const script = ScriptProvider.getByName('[proc,update_all]')!;
    const state = ScriptRunner.init(script, p, null, [previous]);
    state.pointerAdd(ScriptPointer.ProtectedActivePlayer);
    p.protect = true;
    ScriptRunner.execute(state);
    p.protect = false;
}

// ------------------------------------------------------- the report: a bow after a melee style
console.log('A BOW DOES NOT PICK UP A MELEE STYLE');
{
    const p = fresh();
    wield(p, 'bronze_scimitar');
    check('a scimitar nobody has touched opens on the first style, Chop', style(p), 0);
    H.ifButton(p, 'combat_hacksword:hack3'); // Block
    check('Block is the fourth style and is remembered for slash weapons', [style(p), slot(p, 'atkstyle_slash')], [3, 3]);
    wield(p, 'shortbow');
    check('the bow comes up ACCURATE, not Longrange', style(p), 0);
    check('  and the scimitar\'s Block was not written over the bow\'s slot', [slot(p, 'atkstyle_slash'), slot(p, 'atkstyle_bow')], [3, 0]);
    H.despawn(p);
}

// ------------------------------------------------------------------- swapping back and forth
console.log('\nEACH CATEGORY KEEPS ITS OWN STYLE');
{
    const p = fresh();
    wield(p, 'bronze_scimitar');
    H.ifButton(p, 'combat_hacksword:hack3'); // Block
    wield(p, 'shortbow');
    H.ifButton(p, 'combat_bow:bow1'); // Rapid
    check('the bow is on Rapid', [style(p), slot(p, 'atkstyle_bow')], [1, 1]);
    wield(p, 'bronze_scimitar');
    check('back to the scimitar: Block again', style(p), 3);
    wield(p, 'shortbow');
    check('back to the bow: Rapid again', style(p), 1);
    wield(p, 'bronze_scimitar');
    check('and round again', style(p), 3);
    wield(p, 'shortbow');
    check('and again', style(p), 1);
    // a third category, never touched, must not inherit either of them
    wield(p, 'abyssal_whip');
    check('a whip nobody has ever set a style on opens on its first option', style(p), 0);
    H.ifButton(p, 'combat_whip:whip2'); // Block
    wield(p, 'rune_2h_sword');
    check('a two-hander is its own category, not the scimitar\'s', style(p), 0);
    wield(p, 'abyssal_whip');
    check('the whip kept its Block', style(p), 2);
    wield(p, 'bronze_scimitar');
    check('and the scimitar is still where it was left', style(p), 3);
    H.despawn(p);
}

// ------------------------------------------------------------------------- the unarmed slot
console.log('\nUNARMED IS A CATEGORY TOO');
{
    const p = fresh();
    wield(p, null);
    check('bare hands open on Punch', style(p), 0);
    H.ifButton(p, 'combat_unarmed:unarmed1'); // Kick
    check('Kick is remembered', [style(p), slot(p, 'atkstyle_unarmed')], [1, 1]);
    wield(p, 'shortbow');
    H.ifButton(p, 'combat_bow:bow2'); // Longrange, deliberately - the style the bug used to force
    wield(p, null);
    check('dropping the bow goes back to Kick, not Longrange', style(p), 1);
    wield(p, 'shortbow');
    check('and the bow really was left on Longrange', style(p), 2);
    H.despawn(p);
}

// ------------------------------------------------------------------------------ over a login
console.log('\nTHE MEMORY SURVIVES A LOGOUT');
{
    const p = fresh();
    wield(p, 'bronze_scimitar');
    H.ifButton(p, 'combat_hacksword:hack3'); // Block
    wield(p, 'abyssal_whip');
    H.ifButton(p, 'combat_whip:whip1'); // Lash
    wield(p, 'shortbow');
    H.ifButton(p, 'combat_bow:bow1'); // Rapid
    const name = p.username;
    const saved = new Packet(p.save());
    H.despawn(p);
    H.tick(1);

    const back: any = PlayerLoading.load(name, saved, null);
    const g = (varp: string) => back.getVar(VarPlayerType.getByName(varp)!.id);
    check('both memory varps are in the save file', [typeof g('atkstyle_memory1'), typeof g('atkstyle_memory2')], ['number', 'number']);

    // log them back in for real: World.processLogins runs the [login,_] trigger, which is what calls
    // ~initalltabs and so ~update_weapon_category
    back.teleport(3222, 3218, 0);
    (back as any).__ip = 60;
    World.newPlayers.add(back);
    H.tick(10);
    check('they logged back in with the bow still equipped', ObjType.get(back.getInventory(InvType.WORN)!.get(RHAND)!.id).debugname, 'shortbow');
    check('the bow is on Rapid, not Longrange and not the scimitar\'s Block', style(back), 1);
    wield(back, 'bronze_scimitar');
    check('the scimitar still has its Block from before the logout', style(back), 3);
    wield(back, 'abyssal_whip');
    check('and the whip its Lash', style(back), 1);
    wield(back, 'bronze_crossbow');
    check('a crossbow, never used, still opens on Accurate', style(back), 0);
    H.despawn(back);
}

// ---------------------------------------------------------------- the staff's five options
console.log('\nA STAFF STILL HAS FIVE OPTIONS');
{
    const p = fresh();
    for (const r of ['airrune', 'mindrune']) H.give(p, r, 1000);
    wield(p, 'staff_of_air');
    check('a staff nobody has touched opens on Bash', style(p), 0);
    H.ifButton(p, 'combat_staff_2:auto_cast');
    H.ifButton(p, 'staff_spells:ssb0'); // Wind Strike - this ends in ~initalltabs
    check('the plain Spell box survives the tab redraw picking a spell causes', [style(p), H.getVarBit(p, 'autocast_set')], [3, 1]);
    check('  and it went into the staff\'s slot, not anything else\'s', [slot(p, 'atkstyle_staff'), slot(p, 'atkstyle_unarmed')], [3, 0]);
    H.ifButton(p, 'combat_staff_2:auto_defensive');
    H.ifButton(p, 'staff_spells:ssb0');
    check('the defensive Spell box is the fifth style and sticks', [style(p), slot(p, 'atkstyle_staff')], [4, 4]);
    wield(p, 'shortbow');
    check('a bow off a staff on style 4 is Accurate, not its last style', style(p), 0);
    wield(p, 'staff_of_air');
    check('and the staff comes back to defensive casting', style(p), 4);
    H.ifButton(p, 'combat_staff_2:staff2a'); // Bash
    check('picking Bash turns autocast off and is remembered', [style(p), H.getVarBit(p, 'autocast_set'), slot(p, 'atkstyle_staff')], [0, 0, 0]);
    H.despawn(p);
}

// ------------------------------------------------------- the clamp cannot reach across weapons
console.log('\nNO STYLE INDEX CROSSES A CATEGORY');
{
    // What the bug WAS, asserted directly: a style index only a four-option tab can produce, with a
    // three-option weapon in hand. player_combat_stat's clamp is the thing that used to turn it into
    // Longrange; nothing should now be able to hand it a value out of range in the first place.
    const p = fresh();
    wield(p, 'bronze_scimitar');
    H.ifButton(p, 'combat_hacksword:hack3');
    for (const w of ['shortbow', 'bronze_crossbow', 'abyssal_whip', 'staff_of_air', 'bronze_dagger', 'rune_2h_sword']) {
        wield(p, w);
        H.runProc(p, '[proc,player_combat_stat]');
        check(`${w} after a melee Block: still its own first style`, style(p), 0);
    }
    H.despawn(p);
}

{
    // THE BACKSTOP ITSELF, forced. A style index that a bow's three-option tab cannot produce is
    // written straight into %com_mode and the stats are recomputed with no protected access, the way
    // a combat tick does it - the clamp has to trim it AND put the trimmed value in the bow's slot,
    // and it has to be allowed to write that varbit at all (atkstyle_memory1/2 are protect=no
    // precisely so that it can).
    const p = fresh();
    wield(p, 'shortbow');
    H.setVar(p, 'com_mode', 3);
    H.runProc(p, '[proc,player_combat_stat]');
    check('a style index off the end of the bow tab is trimmed to its last style', style(p), 2);
    check("  and the trim is written into the bow's own slot, not left to drift", slot(p, 'atkstyle_bow'), 2);
    H.despawn(p);
}

console.log(`\n${ok} ok, ${bad} FAIL`);
process.exit(bad ? 1 : 0);
