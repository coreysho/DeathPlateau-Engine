// Who loses their items when they die, and the world that takes nothing.
//
// A development world used to take them: [proc,player_death_lose_items] let staff keep theirs on
// the LIVE world and nobody keep theirs anywhere else, so dying while testing cost you the kit you
// were testing with, a ::give at a time. That is now the other way round - a dev world keeps
// everything, for everybody - and the live rules are exactly as they were, which is the half of
// this that matters and the half a sim is for.
//
// ONE RUN, BOTH WORLDS. map_live asks Environment.NODE_PRODUCTION at the moment the script runs,
// so the sim can stand in either world and say which. A sim that could only test the world it
// happened to be started in would quietly test one rule and claim both.
import * as H from './harness.ts';
import * as A from './a1lib.ts';
import { check, R, player } from './a1lib.ts';
import Environment from '#/util/Environment.js';
import InvType from '#/cache/config/InvType.js';
import ObjType from '#/cache/config/ObjType.js';
import Player from '#/engine/entity/Player.js';
import ScriptProvider from '#/engine/script/ScriptProvider.js';
import ScriptPointer from '#/engine/script/ScriptPointer.js';
import ScriptRunner from '#/engine/script/ScriptRunner.js';
import World from '#/engine/World.js';
import { EntityLifeCycle } from '#/engine/entity/EntityLifeCycle.js';

await H.boot();

function inWorld(live: boolean, what: () => void) {
    const was = Environment.NODE_PRODUCTION;
    Environment.NODE_PRODUCTION = live;
    try {
        what();
    } finally {
        Environment.NODE_PRODUCTION = was;
    }
}

// The death procs run from a queue, where the player is protected - inv_clear and both_dropslot
// refuse to run without it - and the pvp one needs the killer as its secondary.
function runDeath(p: Player, name: string, killer?: Player): void {
    const script = ScriptProvider.getByName(name);
    if (!script) {
        throw new Error('no such script: ' + name);
    }
    const state = ScriptRunner.init(script, p, killer ?? null, []);
    state.pointerAdd(ScriptPointer.ProtectedActivePlayer);
    p.protect = true;
    ScriptRunner.execute(state);
    p.protect = false;
}

/** Everything a death left lying around this player, by name. */
function onTheFloor(p: Player): string[] {
    const names: string[] = [];
    for (let zx = (p.x - 2) >> 3; zx <= (p.x + 2) >> 3; zx++) {
        for (let zz = (p.z - 2) >> 3; zz <= (p.z + 2) >> 3; zz++) {
            for (const obj of World.gameMap.getZone(zx << 3, zz << 3, p.level).getAllObjsSafe()) {
                if (Math.abs(obj.x - p.x) <= 2 && Math.abs(obj.z - p.z) <= 2 && obj.lifecycle === EntityLifeCycle.DESPAWN) {
                    names.push(ObjType.get(obj.type).debugname ?? String(obj.type));
                }
            }
        }
    }
    return names.sort();
}

function clearFloor(p: Player): void {
    for (let zx = (p.x - 2) >> 3; zx <= (p.x + 2) >> 3; zx++) {
        for (let zz = (p.z - 2) >> 3; zz <= (p.z + 2) >> 3; zz++) {
            for (const obj of World.gameMap.getZone(zx << 3, zz << 3, p.level).getAllObjsSafe()) {
                if (obj.lifecycle === EntityLifeCycle.DESPAWN) {
                    World.removeObj(obj, 0);
                }
            }
        }
    }
}

/** A player carrying something worth losing: five sharks in the bag and a scimitar in hand. */
function kitted(name: string, x: number, z: number, staffModLevel = 0): Player {
    const p: any = player(name, x, z);
    p.staffModLevel = staffModLevel;
    H.clearInv(p);
    H.give(p, 'shark', 5);
    H.equip(p, { rhand: 'rune_scimitar' });
    H.tick(1);
    clearFloor(p);
    H.clearLogs();
    return p as Player;
}

/** What a worn slot holds, since invCount only looks in the bag and the scimitar is in a hand. */
function wornCount(p: Player, objName: string): number {
    const obj = ObjType.getId(objName);
    const worn = (p as any).getInventory(InvType.WORN);
    let n = 0;
    for (let i = 0; i < worn.capacity; i++) {
        const slot = worn.get(i);
        if (slot && slot.id === obj) {
            n += slot.count;
        }
    }
    return n;
}

// [sharks, scimitars] still held, wherever they are: what death keeps for you comes back in the
// BAG, not on your back (~moveallinv(deathkeep, inv)), so counting only the hand would read a kept
// scimitar as a lost one.
const carrying = (p: Player) => [H.invCount(p, 'shark'), H.invCount(p, 'rune_scimitar') + wornCount(p, 'rune_scimitar')];

console.log('THE LIVE WORLD, WHERE DEATH COSTS WHAT IT ALWAYS HAS');
inWorld(true, () => {
    // Unskulled, which is the 2006 rule: the three priciest things come back and the rest is on the
    // floor. The scimitar is the priciest, then two of the sharks.
    const p = kitted('deadsim', 3200, 3200);
    runDeath(p, '[proc,player_death_lose_items]');
    check('  an ordinary player keeps three things', carrying(p), [2, 1]);
    check('  and leaves the rest where they fell', onTheFloor(p), ['bones', 'shark', 'shark', 'shark']);
    H.despawn(p);

    // Skulled, which is the whole lot.
    const skulled = kitted('skulledsim', 3240, 3210);
    H.setVar(skulled, 'pk_skull', 1);
    runDeath(skulled, '[proc,player_death_lose_items]');
    check('  a skulled one keeps nothing', carrying(skulled), [0, 0]);
    check('  it is all on the floor', onTheFloor(skulled), ['bones', 'rune_scimitar', 'shark', 'shark', 'shark', 'shark', 'shark']);
    clearFloor(skulled);
    H.despawn(skulled);

    const mod = kitted('modsim', 3210, 3200, 2);
    runDeath(mod, '[proc,player_death_lose_items]');
    check('  a moderator keeps theirs, as they always have', carrying(mod), [5, 1]);
    check('  with nothing on the floor', onTheFloor(mod), []);
    H.despawn(mod);
});

console.log('\nTHE DEVELOPMENT WORLD, WHICH IS THE CHANGE');
inWorld(false, () => {
    const p = kitted('devdeadsim', 3220, 3200);
    runDeath(p, '[proc,player_death_lose_items]');
    check('  an ordinary player keeps the lot', carrying(p), [5, 1]);
    check('  nothing is dropped, not even the bones', onTheFloor(p), []);
    check('  and they are told why, so it does not look like a bug',
        H.mesgs.filter(m => m.who === p.username).map(m => m.text),
        ['Your items came with you - this is a development world.']);
    H.despawn(p);
});

console.log('\nAND THE SAME WHEN IT IS A PLAYER WHO KILLED YOU');
{
    const killer: any = player('killersim', 3230, 3202);
    H.tick(1);

    inWorld(true, () => {
        // Skulled, so the killer gets everything - which is the case worth stating.
        const victim = kitted('pvpdeadsim', 3230, 3200);
        H.setVar(victim, 'pk_skull', 1);
        runDeath(victim, '[proc,pvp_death_lose_items]', killer);
        check('  live: the killer gets what you were carrying', carrying(victim), [0, 0]);
        check('  which is on the floor for them', onTheFloor(victim), ['bones', 'rune_scimitar', 'shark', 'shark', 'shark', 'shark', 'shark']);
        clearFloor(victim);
        H.despawn(victim);
    });

    inWorld(false, () => {
        const victim = kitted('pvpdevsim', 3240, 3200);
        runDeath(victim, '[proc,pvp_death_lose_items]', killer);
        check('  dev: nothing changes hands', carrying(victim), [5, 1]);
        check('  and nothing is on the floor', onTheFloor(victim), []);
        H.despawn(victim);
    });

    H.despawn(killer);
}

console.log("\nTHE ONE PILE THAT IS NOT ON YOU: ZULRAH'S PRIESTESS");
{
    // An unsafe death anywhere else destroys what she is holding. That is the live rule, and a dev
    // world that keeps what you were carrying but burns what she has kept would be keeping half.
    const stash = (p: Player) => {
        H.clearInv(p);
        H.give(p, 'shark', 5);
        A.runProcProtected(p, '[proc,zulrah_stash_items]');
        H.tick(1);
    };

    inWorld(true, () => {
        const p: any = player('zdeadsim', 3250, 3200);
        H.tick(1);
        stash(p);
        check('  live: she is holding it', H.getVar(p, 'zulrah_items_held'), 1);
        A.runProcProtected(p, '[proc,zulrah_deathbank_lost]');
        check('  and an unsafe death elsewhere destroys it', H.getVar(p, 'zulrah_items_held'), 0);
        H.despawn(p);
    });

    inWorld(false, () => {
        const p: any = player('zdevsim', 3260, 3200);
        H.tick(1);
        stash(p);
        A.runProcProtected(p, '[proc,zulrah_deathbank_lost]');
        check('  dev: she is still holding it afterwards', H.getVar(p, 'zulrah_items_held'), 1);
        H.despawn(p);
    });
}

console.log(`\n${R.ok} ok, ${R.bad} FAIL`);
process.exit(R.bad ? 1 : 0);
