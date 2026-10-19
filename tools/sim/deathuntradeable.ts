// WHAT HAPPENS TO AN UNTRADEABLE WHEN YOU DIE, asked by the owner on 2026-10-13 for both the
// Wilderness and everywhere else. The answer is decided in two places and they do not agree with
// each other, so this reads it off the engine rather than off the scripts:
//
//   INV_DROPALL   (the PvM path)  untradeable -> owned by the DEAD PLAYER
//                                 tradeable   -> Obj.NO_RECEIVER, public at once
//   BOTH_DROPSLOT (the PvP path)  untradeable -> owned by the VICTIM
//                                 tradeable   -> owned by the KILLER
//
// and Zone.revealObj refuses to reveal an untradeable at all, so one dropped with an owner stays
// private to that owner for its whole life rather than going public after 100 ticks.
//
//   npx tsx tools/sim/deathuntradeable.ts
import * as H from './harness.ts';
import { check, R, player } from './a1lib.ts';
import ObjType from '#/cache/config/ObjType.js';
import Obj from '#/engine/entity/Obj.js';
import Player from '#/engine/entity/Player.js';
import ScriptProvider from '#/engine/script/ScriptProvider.js';
import ScriptPointer from '#/engine/script/ScriptPointer.js';
import ScriptRunner from '#/engine/script/ScriptRunner.js';
import World from '#/engine/World.js';
import Environment from '#/util/Environment.js';
import { EntityLifeCycle } from '#/engine/entity/EntityLifeCycle.js';

await H.boot();

// map_live reads Environment.NODE_PRODUCTION when the script runs, and a development world takes
// nothing at all on death (deathitems.ts covers that rule). Everything below is about the LIVE
// rules, so the whole run stands in the live world.
Environment.NODE_PRODUCTION = true;

function runDeath(p: Player, name: string, killer?: Player): void {
    const script = ScriptProvider.getByName(name);
    if (!script) throw new Error('no such script: ' + name);
    const state = ScriptRunner.init(script, p, killer ?? null, []);
    state.pointerAdd(ScriptPointer.ProtectedActivePlayer);
    p.protect = true;
    ScriptRunner.execute(state);
    p.protect = false;
}

/** Everything lying around this player: name, who owns it, and whether it will ever go public. */
function floor(p: Player): { name: string; owner: string; reveals: boolean }[] {
    const out: { name: string; owner: string; reveals: boolean }[] = [];
    for (let zx = (p.x - 2) >> 3; zx <= (p.x + 2) >> 3; zx++) {
        for (let zz = (p.z - 2) >> 3; zz <= (p.z + 2) >> 3; zz++) {
            for (const obj of World.gameMap.getZone(zx << 3, zz << 3, p.level).getAllObjsSafe()) {
                if (Math.abs(obj.x - p.x) > 2 || Math.abs(obj.z - p.z) > 2) continue;
                if (obj.lifecycle !== EntityLifeCycle.DESPAWN) continue;
                const who = obj.receiver64 === Obj.NO_RECEIVER ? 'everyone' : (World.getPlayerByHash64(obj.receiver64)?.username ?? 'someone');
                out.push({
                    name: ObjType.get(obj.type).debugname ?? String(obj.type),
                    owner: who,
                    reveals: obj.reveal !== -1
                });
            }
        }
    }
    return out.sort((a, b) => a.name.localeCompare(b.name));
}

function clearFloor(p: Player): void {
    for (let zx = (p.x - 2) >> 3; zx <= (p.x + 2) >> 3; zx++)
        for (let zz = (p.z - 2) >> 3; zz <= (p.z + 2) >> 3; zz++) for (const obj of World.gameMap.getZone(zx << 3, zz << 3, p.level).getAllObjsSafe()) if (obj.lifecycle === EntityLifeCycle.DESPAWN) World.removeObj(obj, 0);
}

const show = (rows: ReturnType<typeof floor>) => rows.map(r => `${r.name} -> ${r.owner}${r.reveals ? ' (will go public)' : ''}`);

// Five things carried: three tradeables and two untradeables, one of them a god cape.
function kit(p: any) {
    H.clearInv(p);
    H.give(p, 'shark', 3);
    H.give(p, 'rune_scimitar', 1);
    H.give(p, 'amulet_of_ghostspeak', 1); // untradeable, not a cape
    H.give(p, 'saradomin_cape', 1); // untradeable, category armour_godcape
    H.setVar(p, 'pk_skull', 1); // skulled, so nothing is kept and the floor is the whole story
    H.tick(1);
}

console.log('=== KILLED BY SOMETHING THAT IS NOT A PLAYER (anywhere, Wilderness included)');
{
    const p: any = player('pvm', 3222, 3218, 0);
    clearFloor(p);
    kit(p);
    runDeath(p, '[proc,player_death_lose_items]');
    const rows = floor(p);
    console.log('  on the floor:');
    for (const line of show(rows)) console.log('    ' + line);
    const owner = (n: string) => rows.find(r => r.name === n)?.owner;
    check('a tradeable is public to everyone at once', owner('rune_scimitar'), 'everyone');
    check('  ...and so are the stacked ones', owner('shark'), 'everyone');
    check('an untradeable is owned by the player who died', owner('amulet_of_ghostspeak'), 'pvm');
    // A reveal is SCHEDULED on anything with an owner, but Zone.revealObj refuses to reveal an
    // untradeable - it just stops trying. So the question is what the owner is AFTER the window,
    // not whether one was booked.
    H.tick(Obj.REVEAL + 20);
    const after = floor(p);
    console.log('  after the reveal window:');
    for (const line of show(after)) console.log('    ' + line);
    check('  ...and it is still only theirs once the reveal window has passed', after.find(r => r.name === 'amulet_of_ghostspeak')?.owner, 'pvm');
    console.log('  -- the god cape, which tells you Saradomin reclaimed it');
    check('a god cape is destroyed on a PvM death, as its message says', owner('saradomin_cape'), undefined);
}

console.log('\n=== KILLED BY A PLAYER');
{
    const victim: any = player('victim', 3240, 3218, 0);
    const killer: any = player('killer', 3241, 3218, 0);
    clearFloor(victim);
    kit(victim);
    runDeath(victim, '[proc,pvp_death_lose_items]', killer);
    const rows = floor(victim);
    console.log('  on the floor:');
    for (const line of show(rows)) console.log('    ' + line);
    const owner = (n: string) => rows.find(r => r.name === n)?.owner;
    check('a tradeable goes to the killer', owner('rune_scimitar'), 'killer');
    check('  ...and so do the stacked ones', owner('shark'), 'killer');
    check('an untradeable stays with the victim', owner('amulet_of_ghostspeak'), 'victim');
    H.tick(Obj.REVEAL + 20);
    const after = floor(victim);
    console.log('  after the reveal window:');
    for (const line of show(after)) console.log('    ' + line);
    check('  ...and is STILL only the victim, so the killer can never take it', after.find(r => r.name === 'amulet_of_ghostspeak')?.owner, 'victim');
    check('  while the killer share goes public once the window passes', after.find(r => r.name === 'rune_scimitar')?.owner, 'everyone');
    check('a god cape IS destroyed on a player kill', owner('saradomin_cape'), undefined);
}

console.log('\n=== AND WHAT THE THREE KEPT ITEMS CAN BE');
{
    const p: any = player('keep', 3260, 3218, 0);
    clearFloor(p);
    kit(p);
    H.setVar(p, 'pk_skull', 0); // unskulled: three kept
    H.tick(1);
    runDeath(p, '[proc,player_death_lose_items]');
    const held: string[] = [];
    for (const n of ['shark', 'rune_scimitar', 'amulet_of_ghostspeak', 'saradomin_cape']) if (H.invCount(p, n) > 0) held.push(`${n} x${H.invCount(p, n)}`);
    console.log('  kept:', held);
    // THE RANKING IS oc_cost AND NOTHING ELSE - tradeability does not enter into it. The ghostspeak
    // amulet costs 35 and a shark 300, so the amulet loses; that is the whole reason it dropped.
    check('a cheap untradeable loses to a dearer tradeable', H.invCount(p, 'amulet_of_ghostspeak'), 0);
    check('  ...the three dearest things are what is kept', [H.invCount(p, 'rune_scimitar'), H.invCount(p, 'shark')], [1, 2]);
    check('  ...and a god cape is barred outright by param=destroy_death', H.invCount(p, 'saradomin_cape'), 0);

    // And the other way round: the dearest untradeable in the game is kept ahead of everything.
    const q: any = player('keep2', 3280, 3218, 0);
    clearFloor(q);
    H.clearInv(q);
    H.give(q, 'shark', 3);
    H.give(q, 'dragonfire_shield', 1); // untradeable, cost 2,000,000
    H.setVar(q, 'pk_skull', 0);
    H.tick(1);
    runDeath(q, '[proc,player_death_lose_items]');
    check('an untradeable IS kept when it is the dearest thing carried', H.invCount(q, 'dragonfire_shield'), 1);
}

console.log(`\n${R.ok} ok, ${R.bad} FAIL`);
process.exit(R.bad ? 1 : 0);
