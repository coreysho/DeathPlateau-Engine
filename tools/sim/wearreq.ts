// WHAT A LEVEL 1 PLAYER CAN PUT ON.
//
// Equip requirements in this content are not data - there is no "requires 40 Defence" field on an
// obj. They are one [opheld2,<obj>] @levelrequire_<stat>(<n>, last_slot) trigger per item, and
// anything without one falls through to [opheld2,_] ~equip(last_slot) and goes on at level 1. So
// the only way to be sure an item is gated is to be a level 1 and try to wear it.
//
// That is what this does: a fresh account with every stat at 1 takes each item in turn, clicks
// Wear, and the item must still be in the pack afterwards. Then the same player is maxed and has
// to be able to wear it, which is the half that catches a requirement typed too high or pointed
// at the wrong skill.
//
//   npx tsx tools/sim/wearreq.ts

import * as H from './harness.js';
import { check, R } from './a1lib.js';
import ObjType from '#/cache/config/ObjType.js';
import InvType from '#/cache/config/InvType.js';

// WITHOUT THIS NOTHING IS LOADED and every check below passes against an empty world - ObjType
// answers -1 for every name, the "no such obj" branch skips it, and the run reports all green.
await H.boot();

/** Try to wear one item and say whether it ended up on. */
function canWear(p: any, obj: string): boolean {
    H.clearInv(p);
    H.give(p, obj, 1);
    H.opheld(p, obj, 2);
    for (let i = 0; i < 6 && (p.activeScript || p.delayed); i++) H.tick(1);
    H.tick(1);
    const worn = p.getInventory(InvType.WORN)!;
    for (let i = 0; i < worn.capacity; i++) {
        if (worn.get(i)?.id === ObjType.getId(obj)) return true;
    }
    return false;
}

function strip(p: any) {
    const worn = p.getInventory(InvType.WORN)!;
    for (let i = 0; i < worn.capacity; i++) worn.delete(i, 0x7fffffff);
}

// The items this round wired up, and what each one is now meant to want. The point of the list is
// that every one of them could be worn at level 1 before.
const GATED: string[] = [
    // the two that were reported from the game
    'rune_defender_t',
    'third_age_platebody',
    // the rest of 3rd age - twenty-three pieces, none of which asked for anything
    'third_age_full_helmet', 'third_age_platelegs', 'third_age_plateskirt', 'third_age_kiteshield',
    'third_age_longsword', 'third_age_mage_hat', 'third_age_robe_top', 'third_age_robe',
    'third_age_amulet', 'third_age_wand', 'third_age_range_coif', 'third_age_range_top',
    'third_age_range_legs', 'third_age_vambraces', 'third_age_bow',
    'third_age_druidic_robe_top', 'third_age_druidic_robe_bottoms', 'third_age_druidic_cloak',
    'third_age_druidic_staff', 'third_age_cloak', 'third_age_axe', 'third_age_pickaxe',
    // repaints of rune, found by tools/wearreq.py
    'rune_platebody_h1', 'rune_platebody_goldplate', 'rune_scimitar_guthix',
    'rune_full_helm_goldplate', 'rune_kiteshield_goldplate',
    'saradomin_platebody', 'ancient_platelegs', 'armadyl_full_helm', 'bandos_kiteshield',
    'gilded_scimitar', 'gilded_2h_sword', 'gilded_chainbody', 'gilded_dhide_body',
    'dragon_defender_t', 'dragon_chainbody_g', 'dragon_boots_g',
    'black_platebody_h1', 'black_dhide_body_t', 'red_dhide_body_g',
    'mithril_platebody_t', 'steel_platebody_g', 'adamant_platebody_h3',
    'studded_body_trim_gold', 'dark_infinity_top', 'light_infinity_hat', 'tzhaar_ket_om_t'
];

// DELIBERATELY WEARABLE AT ONE. The owner wants the black mask and every slayer helmet wearable
// from the start, and both requirement lines are commented out in tier10/tier20 saying so. This
// is here so that a later sweep putting them "right" trips a test instead of shipping.
const FREE: string[] = [
    'black_mask', 'black_mask_i', 'slayer_helm', 'slayer_helm_i',
    'slayer_helm_black', 'slayer_helm_red', 'slayer_helm_purple'
];

// NOT a1lib's player(), which maxes every stat on the way in. The whole test is being level 1.
const p: any = H.makePlayer('wearreq', 3222, 3222, 1);
H.tick(1);

console.log('');
console.log('A LEVEL 1 CANNOT PUT THESE ON');
const worn1: string[] = [];
for (const obj of GATED) {
    if (ObjType.getId(obj) === -1) { console.log(`  ??   no such obj: ${obj}`); continue; }
    if (canWear(p, obj)) worn1.push(obj);
    strip(p);
}
check('nothing on the list goes on at level 1', worn1, []);

console.log('');
console.log('...AND A MAXED PLAYER CAN');
H.maxOut(p);
// EVERY RUNE PLATEBODY WANTS DRAGON SLAYER as well as 40 Defence, and so do the repaints of it -
// that is what levelrequire_dragon_slayer_quest_defence is. A maxed account that has not done the
// quest cannot wear them, which is correct and is not what this half is testing.
H.setVar(p, 'dragonquest', 10);
H.tick(1);
const stuck: string[] = [];
for (const obj of GATED) {
    if (ObjType.getId(obj) === -1) continue;
    if (!canWear(p, obj)) stuck.push(obj);
    strip(p);
}
check('every one of them goes on when the levels are there', stuck, []);

console.log('');
console.log('AND THE ONES THE OWNER WANTS FREE STAY FREE');
const q: any = H.makePlayer('wearfree', 3226, 3222, 2);
H.tick(1);
const blocked: string[] = [];
for (const obj of FREE) {
    if (ObjType.getId(obj) === -1) { console.log(`  ??   no such obj: ${obj}`); continue; }
    if (!canWear(q, obj)) blocked.push(obj);
    strip(q);
}
check('black mask and the slayer helmets still go on at 1 Defence', blocked, []);

console.log('');
console.log(`WEARREQ ${R.ok} ok, ${R.bad} FAIL`);
process.exit(R.bad ? 1 : 0);
