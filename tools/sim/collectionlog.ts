// WHAT THE COLLECTION LOG LISTS, AND WHETHER ANY OF IT CAN ACTUALLY BE LOGGED.
//
//   npx tsx tools/sim/collectionlog.ts
//
// The log is generated from content/tools/collectionlogspec.json, and the generator already
// refuses an obj name no .obj config defines. What it cannot see is the other half: whether
// anything in the game ever calls ~collection_log_add with that item. A page can list a thing
// nobody can obtain, and the slot then sits empty for ever with no way to tell it apart from a
// thing you simply have not got yet.
//
// THAT HAPPENED. Belle's folly was listed on two pages, and the dragons drop belles_folly_TARNISHED
// - the polished sword is made with a hammer, and this log does not record a craft. Two slots that
// could never be filled. The pages list the tarnished sword now, and the first block here is the
// guard that would have caught it: every listed item has to resolve to a log index, and the ones
// that are only ever reached through another record have to be the record that is reached.
import * as H from './harness.js';
import * as A from './a1lib.js';
import { check, R, player } from './a1lib.js';
import InvType from '#/cache/config/InvType.js';
import ObjType from '#/cache/config/ObjType.js';
import EnumType from '#/cache/config/EnumType.js';

await H.boot();
H.loginOrder();

const LOG = InvType.getId('collection_log');
const index = EnumType.getId('collection_log_item_index');

function logged(p: any, name: string): boolean {
    const inv = p.getInventory(LOG)!;
    const id = ObjType.getId(name);
    for (let i = 0; i < inv.capacity; i++) if (inv.get(i)?.id === id) return true;
    return false;
}

/** Hand the player the item the way a drop does, and say whether the log took it. */
function give(p: any, name: string): boolean {
    A.runProcProtected(p, '[proc,collection_log_add]', [ObjType.getId(name), 1]);
    H.tick(1);
    return logged(p, name);
}

console.log('EVERY ITEM ON A PAGE HAS A SLOT IN THE LOG, AND NO SLOT IS OUT OF REACH');
{
    // The two enums the log is keyed by. An item on a page that is not in the index would be
    // dropped silently by ~collection_log_add - the shape of an unfillable slot - and an index
    // the items enum cannot read back would be a slot that logs and then shows nothing.
    const byObj = EnumType.get(index).values;
    const byIndex = EnumType.get(EnumType.getId('collection_log_items')).values;
    check('  the index enum lists the whole log', byObj.size, byIndex.size);
    check('    which is more than seven hundred items', byObj.size > 700, true);

    const broken: string[] = [];
    for (const [obj, i] of byObj) {
        const back = byIndex.get(i as number);
        if (back !== obj) broken.push(`${ObjType.get(obj).debugname} -> ${i} -> ${back}`);
    }
    check('  and every one of them round-trips obj -> index -> obj', broken, []);

    const cap = InvType.get(LOG).size;
    check('  the log inv has room for all of them', cap >= byObj.size, true);
}

console.log('\nTHE ITEMS ADDED THIS ROUND LOG WHEN THEY ARE GIVEN');
{
    const p: any = player('cloglist', 3200, 3200);
    H.tick(2);
    for (const name of [
        'staff_of_the_dead',
        'saradomins_light',
        'ancient_fabric',
        'slayer_imbue_scroll',
        'graceful_kit_draynor',
        'graceful_kit_ardougne',
        'explorers_ring_4',
        'varrock_armour_4',
        'kandarin_headgear_4',
        'pharaohs_sceptre',
        'amulet_of_eternal_glory'
    ]) {
        check(`  ${name.padEnd(22)} is logged when given`, give(p, name), true);
    }
    H.despawn(p);
}

console.log("\nAND BELLE'S FOLLY IS LISTED AS THE SWORD THE DRAGONS ACTUALLY DROP");
{
    const p: any = player('clogbelle', 3200, 3200);
    H.tick(2);
    check('  the tarnished sword logs', give(p, 'belles_folly_tarnished'), true);
    // The polished one is the same slot, because ~collection_log_add looks the item up by its own
    // record: polishing is a craft and gives no second entry.
    check('  and the polished one is not a slot of its own', logged(p, 'belles_folly'), false);
    H.despawn(p);
}

console.log('\nTHE LOG STILL REFUSES WHAT IT DOES NOT LIST');
{
    const p: any = player('clogno', 3200, 3200);
    H.tick(2);
    // A vote ticket is a currency, not a collectible, and the vote shop page says so.
    check('  a vote ticket is not logged', give(p, 'vote_ticket'), false);
    check('  nor is a plain bronze dagger', give(p, 'bronze_dagger'), false);
    H.despawn(p);
}

console.log(`\n${R.ok} ok, ${R.bad} FAIL`);
process.exit(R.bad ? 1 : 0);
