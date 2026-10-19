// The fixes from the 2026-10-19 security review, through the real handlers and the real content.
// Usage: NODE_PRODUCTION=true NODE_IDLE_LOGOUT_TICKS=20 npx tsx tools/sim/securityfixes.ts
//
//   ::home        goes through content's teleport checks (Ana's barrel here; duels, Castle Wars... alike)
//   equipment     the coloured whips and the other variants that went on at level 1
//   max cape      a variant counts as owning the Max cape, so Mac does not hand out a free one
//   godmode       no attacking players, no being attacked
//   inventory     Inventory.add of 0 adds nothing
//   idle logout   decided by the server, not by a client that may never ask
//   crash         every player's save is on disk before the process exits
import fs from 'fs';

import * as H from './harness.js';
import InvType from '#/cache/config/InvType.js';
import ObjType from '#/cache/config/ObjType.js';
import World from '#/engine/World.js';
import Player from '#/engine/entity/Player.js';
import { PlayerLoading } from '#/engine/entity/PlayerLoading.js';
import Packet from '#/io/Packet.js';
import ClientCheatHandler from '#/network/game/client/handler/ClientCheatHandler.js';
import ClientCheat from '#/network/game/client/model/ClientCheat.js';
import Environment from '#/util/Environment.js';

if (!Environment.NODE_PRODUCTION || Environment.NODE_IDLE_LOGOUT_TICKS !== 20) {
    console.error('Run with NODE_PRODUCTION=true NODE_IDLE_LOGOUT_TICKS=20.');
    process.exit(1);
}

await H.boot();
H.loginOrder();

const R = { ok: 0, bad: 0 };
const check = (what: string, got: unknown, want: unknown) => {
    const pass = JSON.stringify(got) === JSON.stringify(want);
    if (pass) R.ok++;
    else R.bad++;
    console.log(`  ${pass ? 'ok  ' : 'FAIL'} ${what}: ${JSON.stringify(got)}${pass ? '' : `   (want ${JSON.stringify(want)})`}`);
};

const cheat = new ClientCheatHandler();
const LUMBRIDGE = [3222, 3222];
const EDGEVILLE = [(48 << 6) + 14, (54 << 6) + 35];
const at = (p: Player) => [p.x, p.z];
const worn = (p: Player, slot: number) => {
    const o = p.getInventory(InvType.WORN)!.get(slot);
    return o ? ObjType.get(o.id).debugname : null;
};

// Everyone but the idle-logout subject is "at the keyboard": the harness ticks refresh the connection,
// and this refreshes the input the idle logout looks at.
let idleSubject: Player | null = null;
function tick(n = 1) {
    for (let i = 0; i < n; i++) {
        for (const p of World.playerLoop.all()) {
            if (p !== idleSubject) p.lastUserInput = World.currentTick;
        }
        H.tick(1);
    }
}

let bucket = 1;
function player(name: string, maxed = true): Player {
    const p = H.makePlayer(name, LUMBRIDGE[0], LUMBRIDGE[1], bucket++);
    tick(2);
    H.maxOut(p); // off Tutorial Island
    if (!maxed) {
        for (let stat = 0; stat < p.baseLevels.length; stat++) {
            if (stat === 3) continue; // hitpoints
            p.baseLevels[stat] = 1;
            p.levels[stat] = 1;
        }
    }
    H.clearInv(p);
    p.teleport(LUMBRIDGE[0], LUMBRIDGE[1], 0);
    tick(1);
    return p;
}

console.log('::home');
{
    const p = player('homer');
    H.give(p, 'thanainabarrel');
    cheat.handle(new ClientCheat('home'), p);
    tick(3);
    check("carrying Ana's barrel, it is refused (as any teleport is)", at(p), LUMBRIDGE);
    H.clearInv(p);
    p.closeModal();
    tick(1);
    cheat.handle(new ClientCheat('home'), p);
    tick(3);
    check('otherwise it goes to Edgeville', at(p), EDGEVILLE);
}

console.log('equipment requirements');
{
    const p = player('pure', false);
    for (const whip of ['abyssal_whip_frozen', 'bandos_godsword_or', 'dragon_plateskirt_g', 'rune_helm_h3', 'toxic_blowpipe_empty']) {
        H.give(p, whip);
        H.mesgs.length = 0;
        H.opheld(p, whip, 2);
        tick(1);
        const said = H.mesgs
            .filter(m => m.who === 'pure')
            .map(m => m.text)
            .join(' | ');
        check(`${whip} at level 1 is refused for its level`, [p.getInventory(InvType.INV)!.getItemIndex(ObjType.getId(whip)) !== -1, /level/i.test(said)], [true, true]);
        H.clearInv(p);
    }
    const strong = player('strong');
    H.give(strong, 'abyssal_whip_frozen');
    H.opheld(strong, 'abyssal_whip_frozen', 2);
    tick(1);
    check('a frozen whip at 99 Attack is wielded', worn(strong, 3), 'abyssal_whip_frozen');
}

console.log('max cape');
{
    const p = player('maxed');
    const missing = () => H.runProc(p, '[proc,maxcape_missing]')[0];
    check('holding nothing: cape and hood missing', missing(), 2);
    H.give(p, 'saradomin_max_cape');
    H.give(p, 'saradomin_max_hood');
    check('holding a variant cape and hood: nothing missing (no free cape from Mac)', missing(), 0);
    H.clearInv(p);
    H.give(p, 'max_cape');
    H.give(p, 'max_hood');
    check('holding the plain ones: nothing missing', missing(), 0);
}

console.log('godmode');
{
    const a = player('goda');
    const b = player('godb');
    const attackable = () => H.runProc(a, '[proc,pvp_is_attackable]', [], b)[0];
    H.setVar(a, 'godmode', 1);
    check('in godmode, attacking a player is refused', attackable(), 0);
    H.setVar(a, 'godmode', 0);
    H.setVar(b, 'godmode', 1);
    check('a player in godmode cannot be attacked', attackable(), 0);
    H.setVar(b, 'godmode', 0);
    check('silent check (area spells) refuses godmode too', (H.setVar(a, 'godmode', 1), H.runProc(a, '[proc,pvp_is_attackable_opt]', [], b)[0]), 0);
    H.setVar(a, 'godmode', 0);
}

console.log('inventory');
{
    const p = player('counter');
    const inv = p.getInventory(InvType.INV)!;
    const before = inv.freeSlotCount;
    check('add(non-stackable, 0) adds nothing', [inv.add(ObjType.getId('rune_scimitar'), 0), inv.freeSlotCount], [0, before]);
    check('add(stackable, 0) adds nothing', [inv.add(ObjType.getId('coins'), 0), inv.freeSlotCount], [0, before]);
}

console.log('idle logout');
{
    const p = player('idler');
    idleSubject = p;
    tick(25);
    check('20 ticks with no input: logged out', World.getPlayerByUsername('idler') === undefined, true);
    idleSubject = null;
    player('typist');
    tick(25);
    check('someone still clicking is not', World.getPlayerByUsername('typist') !== undefined, true);
}

console.log('crash');
{
    const p = player('crashtest');
    H.give(p, 'abyssal_whip', 1);
    const file = `data/players/${Environment.NODE_PROFILE}/crashtest.sav`;
    fs.rmSync(file, { force: true });
    tick(1);

    // the real crash path: something in the tick throws, and World.cycle's catch runs - stop it short of
    // actually exiting
    (World as any).processWorld = () => {
        throw new Error('simulated crash');
    };
    const exit = process.exit;
    let exitCode: number | undefined;
    (process as any).exit = (code: number) => {
        exitCode = code;
    };
    World.cycle();
    (process as any).exit = exit;

    check('the world exits', exitCode, 1);
    check('the save is on disk before it does', fs.existsSync(file), true);
    if (fs.existsSync(file)) {
        const loaded = PlayerLoading.load('crashtest', new Packet(new Uint8Array(fs.readFileSync(file))), null);
        check('... and it has the whip that was in the bag', loaded.getInventory(InvType.INV)!.getItemIndex(ObjType.getId('abyssal_whip')) !== -1, true);
        fs.rmSync(file, { force: true });
    }
}

console.log(`\n${R.ok} ok, ${R.bad} failed`);
process.exit(R.bad > 0 ? 1 : 0);
