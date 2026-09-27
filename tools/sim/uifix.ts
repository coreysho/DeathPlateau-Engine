// The uifix round (2026-09-27), against the real engine and content:
//   * Equipment Stats stays open while you dress: wielding from its own side panel (OpHeldHandler)
//     and removing from its worn slots (InvButtonHandler) leave it up and rewrite the bonuses
//   * the 5x game mode's drop-rate boost is 7%, and the drop viewer's subtitle says so
//   * the XP lock's marker is the skill tooltip's extra line ("@red@XP locked", blank when unlocked)
// Usage: npx tsx tools/sim/uifix.ts
import * as H from './harness.js';
import Component from '#/cache/config/Component.js';
import InvType from '#/cache/config/InvType.js';
import NpcType from '#/cache/config/NpcType.js';
import ObjType from '#/cache/config/ObjType.js';
import Player from '#/engine/entity/Player.js';
import OpHeld from '#/network/game/client/model/OpHeld.js';
import OpHeldHandler from '#/network/game/client/handler/OpHeldHandler.js';
import InvButton from '#/network/game/client/model/InvButton.js';
import InvButtonHandler from '#/network/game/client/handler/InvButtonHandler.js';

await H.boot();
H.loginOrder();

const R = { ok: 0, bad: 0 };
const check = (what: string, got: unknown, want: unknown) => {
    const pass = JSON.stringify(got) === JSON.stringify(want);
    if (pass) R.ok++;
    else R.bad++;
    console.log(`  ${pass ? 'ok  ' : 'FAIL'} ${what}: ${JSON.stringify(got)}${pass ? '' : `   (want ${JSON.stringify(want)})`}`);
};
const com = (name: string) => {
    const id = Component.getId(name);
    if (id === -1) throw new Error('no such component ' + name);
    return id;
};
const slotOf = (p: Player, obj: string) => {
    const inv = p.getInventory(InvType.INV)!;
    for (let i = 0; i < inv.capacity; i++) if (inv.get(i)?.id === ObjType.getId(obj)) return i;
    return -1;
};
const opOf = (obj: string, verb: string) => ObjType.get(ObjType.getId(obj)).iop!.findIndex(o => o === verb) + 1;
const lastText = (p: Player, name: string) => {
    const id = com(name);
    const t = H.ifaces.filter(i => i.who === p.username && i.kind === 'text' && i.com === id);
    return t.length ? t[t.length - 1].text : undefined;
};
const wornRhand = (p: Player) => {
    const o = p.getInventory(InvType.WORN)!.get(3);
    return o ? ObjType.get(o.id).debugname : null;
};

let bucket = 1;
function player(name: string): Player {
    const p = H.makePlayer(name, 3222, 3222, bucket++);
    H.tick(2);
    H.maxOut(p);
    H.clearInv(p);
    return p;
}

// ============================================================================ Equipment Stats
console.log('EQUIPMENT STATS STAYS OPEN WHILE YOU DRESS');
{
    const p = player('uifix_eq');
    H.give(p, 'rune_scimitar');
    H.give(p, 'iron_scimitar');
    H.ifButton(p, 'wornitems:stats_button');
    H.tick(1);
    check('the window opens', p.modalMain, com('equipment_stats'));
    check('...with its own pack beside it, where the tabs were', p.modalSide, com('equipment_side'));
    check('...and the pack is shown there', p.invListeners.some(l => l.com === com('equipment_side:inv')), true);
    check('stab attack bonus with nothing worn', lastText(p, 'equipment_stats:stabattack'), 'Stab: +0');

    const opheld = new OpHeldHandler();
    const wield = opOf('rune_scimitar', 'Wield');
    check('a rune scimitar has a Wield op', wield > 0, true);
    check('Wield from the side panel is accepted',
        opheld.handle(new OpHeld(wield, ObjType.getId('rune_scimitar'), slotOf(p, 'rune_scimitar'), com('equipment_side:inv')), p), true);
    H.tick(2);
    check('the scimitar is wielded', wornRhand(p), 'rune_scimitar');
    check('the window is still open', p.modalMain, com('equipment_stats'));
    check('...and so is its pack', p.modalSide, com('equipment_side'));
    check('the bonuses were rewritten while it was open', lastText(p, 'equipment_stats:slashattack'), 'Slash: +45');

    // swap to an iron scimitar from the side panel: a wield that also takes something off
    check('Wield an iron scimitar over it',
        opheld.handle(new OpHeld(opOf('iron_scimitar', 'Wield'), ObjType.getId('iron_scimitar'), slotOf(p, 'iron_scimitar'), com('equipment_side:inv')), p), true);
    H.tick(2);
    check('the iron one is wielded and the rune one back in the pack', [wornRhand(p), slotOf(p, 'rune_scimitar') >= 0], ['iron_scimitar', true]);
    check('still open', [p.modalMain, p.modalSide], [com('equipment_stats'), com('equipment_side')]);
    check('slash bonus is the iron scimitar\'s', lastText(p, 'equipment_stats:slashattack'), 'Slash: +10');

    // Remove from the window's own worn slots
    const inv = new InvButtonHandler();
    check('Remove from the worn slot is accepted',
        inv.handle(new InvButton(1, ObjType.getId('iron_scimitar'), 3, com('equipment_stats:worn')), p), true);
    H.tick(2);
    check('the iron scimitar is off', wornRhand(p), null);
    check('still open after Remove', [p.modalMain, p.modalSide], [com('equipment_stats'), com('equipment_side')]);
    check('bonuses back to nothing', lastText(p, 'equipment_stats:slashattack'), 'Slash: +0');

    // the ordinary pack still closes a window it is not part of (a dialogue, a shop's screen...)
    H.ifButton(p, 'wornitems:stats_button');
    H.tick(1);
    // (the tab is hidden behind the side panel in the client; this is the server's rule on its own)
    opheld.handle(new OpHeld(wield, ObjType.getId('rune_scimitar'), slotOf(p, 'rune_scimitar'), com('inventory:inv')), p);
    H.tick(2);
    check('an op from the ordinary inventory tab still closes the main window', p.modalMain, -1);
    check('...and wields', wornRhand(p), 'rune_scimitar');
}

// ============================================================================ drop rates
console.log('THE 5x DROP-RATE BOOST IS 7%');
{
    const p = player('uifix_drop');
    for (const [rate, want] of [[1, 25], [5, 7], [10, 0]]) {
        H.setVar(p, 'xp_rate', rate);
        check(`xp rate ${rate}x boosts drops by`, H.runProc(p, '[proc,droprate_boost_percent]')[0], want);
    }
    H.setVar(p, 'xp_rate', 5);
    H.runProc(p, '[proc,npc_drops_open]', [NpcType.getId('goblin')]);
    check('the drop viewer tells a 5x player', lastText(p, 'npc_drops:subtitle'), 'Combat level 2. Your game mode: drop rates +7%');
}

// ============================================================================ XP lock marker
console.log('THE XP LOCK MARKS THE SKILL TOOLTIP');
{
    const p = player('uifix_lock');
    H.setVar(p, 'xp_locked', 1); // attack's bit
    H.runProc(p, '[proc,xplock_restore]');
    check('a locked Attack gets the red line on its tooltip', lastText(p, 'stats:com_125'), '@red@XP locked');
    const tip = Component.get(com('stats:com_125'));
    check('...which is the Attack tooltip\'s extra line (client code 332)', tip.clientCode, 332);
    check('and the Attack tooltip itself is client code 331', Component.get(com('stats:com_124')).clientCode, 331);
}

console.log(`\nuifix: ${R.ok} ok, ${R.bad} failed`);
process.exit(R.bad ? 1 : 0);
