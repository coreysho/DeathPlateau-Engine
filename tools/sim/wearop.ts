// Worn options: the Worn Equipment tab's per-item options (ObjType.wearop, WEAROP packet). Drives the
// real WearOpHandler against the real content, so a check here is the packet a client sends.
// Usage: npx tsx tools/sim/wearop.ts
import * as H from './harness.js';
import Component from '#/cache/config/Component.js';
import InvType from '#/cache/config/InvType.js';
import ObjType from '#/cache/config/ObjType.js';
import Player from '#/engine/entity/Player.js';
import ScriptState from '#/engine/script/ScriptState.js';
import WearOp from '#/network/game/client/model/WearOp.js';
import WearOpHandler from '#/network/game/client/handler/WearOpHandler.js';

await H.boot();
H.loginOrder();

const R = { ok: 0, bad: 0 };
const check = (what: string, got: unknown, want: unknown) => {
    const pass = JSON.stringify(got) === JSON.stringify(want);
    if (pass) R.ok++;
    else R.bad++;
    console.log(`  ${pass ? 'ok  ' : 'FAIL'} ${what}: ${JSON.stringify(got)}${pass ? '' : `   (want ${JSON.stringify(want)})`}`);
};

const WORN_COM = Component.getId('wornitems:worn');
const INV_COM = Component.getId('inventory:inv');
const SLOT: Record<string, number> = { hat: 0, back: 1, front: 2, rhand: 3, ring: 12 };
const handler = new WearOpHandler();
const LUMBRIDGE = [3222, 3222];

let bucket = 1;
function player(name: string): Player {
    const p = H.makePlayer(name, LUMBRIDGE[0], LUMBRIDGE[1], bucket++);
    H.tick(2);
    H.maxOut(p);
    H.clearInv(p);
    return p;
}
const worn = (p: Player, slot: string) => {
    const o = p.getInventory(InvType.WORN)!.get(SLOT[slot]);
    return o ? ObjType.get(o.id).debugname : null;
};
const at = (p: Player) => [p.x, p.z];
const near = (p: Player, x: number, z: number, r = 3) => Math.abs(p.x - x) <= r && Math.abs(p.z - z) <= r;
/** What a client sends for worn option `op` on whatever is in `slot`; true if the server took it. */
function wearop(p: Player, slot: string, op: number, objName?: string, com = WORN_COM): boolean {
    const o = p.getInventory(InvType.WORN)!.get(SLOT[slot]);
    const obj = objName ? ObjType.getId(objName) : (o?.id ?? -1);
    return handler.handle(new WearOp(op, obj, SLOT[slot], com), p);
}
function settle(p: Player, n = 12) {
    for (let t = 0; t < n; t++) {
        H.tick(1);
    }
    void p;
}
const mesSince = (p: Player, from: number) => H.mesgs.slice(from).filter(m => m.who === p.username).map(m => m.text);
/** Answer a p_choice menu with its option `pick` (1-based). */
function pickMenu(p: Player, pick: number): boolean {
    for (let t = 0; t < 6; t++) {
        const s = p.activeScript;
        if (s && s.execution === ScriptState.PAUSEBUTTON) {
            const names = p.resumeButtons.map((id: number) => Component.get(id).comName ?? '');
            const open = p.modalChat === -1 ? '' : Component.get(p.modalChat).comName ?? '';
            const iface = names.find((n: string) => n.startsWith(open + ':'))?.split(':')[0];
            return iface ? H.choose(p, `${iface}:com_${pick}`) : false;
        }
        H.tick(1);
    }
    return false;
}

console.log('== every worn option has a handler');
{
    const missing: string[] = [];
    let items = 0;
    for (const o of ObjType.configs) {
        if (!o || !o.wearop.some(w => w !== null)) continue;
        items++;
        o.wearop.forEach((w, i) => {
            if (w !== null && !WearOpHandler.findScript(o, i + 1)) missing.push(`${o.debugname} wearop${i + 1}=${w}`);
        });
    }
    console.log(`     ${items} items carry worn options`);
    check('items with worn options', items > 0, true);
    check('worn options with no [label,wearop<n>_...]', missing, []);
}

console.log('== the glory: Edgeville from the worn tab');
{
    const p = player('wornglory');
    H.equip(p, { front: 'amulet_of_glory_4' });
    check('glory(4) options', ObjType.get(ObjType.getId('amulet_of_glory_4')).wearop.filter(w => w), ['Edgeville', 'Karamja', 'Draynor Village', 'Al Kharid']);
    check('uncharged glory has none', ObjType.get(ObjType.getId('amulet_of_glory')).wearop.filter(w => w), []);
    const from = H.mesgs.length;
    check('Edgeville accepted', wearop(p, 'front', 1), true);
    settle(p);
    check('at Edgeville (3087,3496)', near(p, 3087, 3496), true);
    check('still worn, one charge down', worn(p, 'front'), 'amulet_of_glory_3');
    check('nothing went to the pack', H.invCount(p, 'amulet_of_glory_3'), 0);
    check('the charge message', mesSince(p, from).includes('Your amulet has three charges left.'), true);

    // the last charge leaves the uncharged amulet on the neck, as OSRS does
    H.equip(p, { front: 'amulet_of_glory_1' });
    check('Draynor Village accepted', wearop(p, 'front', 3), true);
    settle(p);
    check('at Draynor (3105,3249)', near(p, 3105, 3249), true);
    check('uncharged amulet left worn', worn(p, 'front'), 'amulet_of_glory');
    check('and now it offers nothing', wearop(p, 'front', 1), false);
}

console.log('== refused');
{
    const p = player('wornbad');
    H.equip(p, { front: 'amulet_of_glory_4', rhand: 'bronze_sword' });
    check('bronze sword has no worn options', ObjType.get(ObjType.getId('bronze_sword')).wearop.filter(w => w), []);
    check('op 1 on the sword', wearop(p, 'rhand', 1), false);
    check('op 5 on a glory (it has 4)', wearop(p, 'front', 5), false);
    check('op 0', wearop(p, 'front', 0), false);
    check('op 9', wearop(p, 'front', 9), false);
    check('a glory that is not in that slot', wearop(p, 'front', 1, 'amulet_of_glory_2'), false);
    H.give(p, 'amulet_of_glory_4');
    // the backpack's component, with a glory in its slot 0: worn options are for the worn inventory only
    check('from the backpack component', handler.handle(new WearOp(1, ObjType.getId('amulet_of_glory_4'), 0, INV_COM), p), false);
    settle(p, 2);
    check('nobody moved', at(p), LUMBRIDGE);
    check('glory untouched', worn(p, 'front'), 'amulet_of_glory_4');
}

console.log('== ring of dueling and games necklace');
{
    const p = player('wornring');
    H.equip(p, { ring: 'ring_of_dueling_1' });
    const from = H.mesgs.length;
    check('Duel Arena accepted', wearop(p, 'ring', 1), true);
    settle(p);
    check('at the Duel Arena', near(p, 3315, 3235, 4), true);
    check('last charge: ring gone from the finger', worn(p, 'ring'), null);
    check('crumbles', mesSince(p, from).includes('Your Ring of Dueling crumbles to dust.'), true);

    p.teleport(LUMBRIDGE[0], LUMBRIDGE[1], 0);
    H.equip(p, { front: 'necklace_of_minigames_8' });
    check('Barbarian Outpost accepted', wearop(p, 'front', 2), true);
    settle(p);
    check('at the Barbarian Outpost', near(p, 2519, 3571, 4), true);
    check('necklace(7) worn', worn(p, 'front'), 'necklace_of_minigames_7');
}

console.log('== slayer ring: Teleport is the Rub menu');
{
    const p = player('wornslayer');
    H.equip(p, { ring: 'slayer_ring_8' });
    check('Teleport accepted', wearop(p, 'ring', 2), true);
    check('picked Slayer Tower', pickMenu(p, 1), true);
    settle(p);
    check('at the Slayer Tower', near(p, 3428, 3524, 3), true);
    check('ring(7) worn', worn(p, 'ring'), 'slayer_ring_7');
    const from = H.mesgs.length;
    check('Check accepted', wearop(p, 'ring', 1), true);
    settle(p, 2);
    check('Check says the task', mesSince(p, from).some(m => m.startsWith('You')), true);
}

console.log('== checks and capes');
{
    const p = player('worncape');
    H.equip(p, { hat: 'slayer_helm_red_i', back: 'strength_cape', rhand: 'trident_of_the_seas' });
    let from = H.mesgs.length;
    check('slayer helmet Check', wearop(p, 'hat', 1), true);
    settle(p, 2);
    check('  said something', mesSince(p, from).length > 0, true);
    from = H.mesgs.length;
    check('trident Check', wearop(p, 'rhand', 1), true);
    settle(p, 2);
    check('  charges', mesSince(p, from).some(m => m.startsWith('Your trident has')), true);
    check('strength cape Teleport', wearop(p, 'back', 1), true);
    settle(p);
    check('  at the Warriors\' Guild', near(p, 2870, 3546, 3), true);
    check('  cape still worn', worn(p, 'back'), 'strength_cape');

    H.equip(p, { back: 'max_cape' });
    check('max cape options', ObjType.get(ObjType.getId('max_cape')).wearop.filter(w => w), ["Warriors' Guild", 'Fishing Guild', 'Crafting Guild', 'Tele to POH', 'Spellbook', 'Features']);
    check('max cape Crafting Guild', wearop(p, 'back', 3), true);
    settle(p);
    check('  at the Crafting Guild', near(p, 2933, 3284, 3), true);
}

// The backpack's Rub shares its teleport with the worn options now, so hold it to what it did.
console.log('== the backpack Rub menus still work');
{
    const p = player('packrub');
    const rub = (item: string, op: number, pick: number, x: number, z: number, after: string | null) => {
        p.teleport(LUMBRIDGE[0], LUMBRIDGE[1], 0);
        H.clearInv(p);
        H.give(p, item);
        settle(p, 2);
        H.opheld(p, item, op);
        check(`${item}: menu answered`, pickMenu(p, pick), true);
        settle(p);
        check(`${item}: arrived`, near(p, x, z, 4), true);
        check(`${item}: now ${after}`, after === null ? H.invCount(p, item) : H.invCount(p, after), after === null ? 0 : 1);
    };
    rub('amulet_of_glory_4', 4, 1, 3087, 3496, 'amulet_of_glory_3');
    rub('ring_of_dueling_1', 4, 2, 2441, 3090, null);
    rub('necklace_of_minigames_2', 4, 1, 2207, 4940, 'necklace_of_minigames_1');
    rub('slayer_ring_1', 1, 2, 2796, 3615, null);
}

console.log(`\n${R.ok} ok, ${R.bad} FAIL`);
process.exit(R.bad === 0 ? 0 : 1);
