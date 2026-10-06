// THE TWO RANDOM EVENTS THIS ROUND ADDED, and the setting that now survives a logout.
//
//   npx tsx tools/sim/randomevents.ts
//
// content/tools/randomevents.py counts 2006scape's list against the content and says what is in;
// this is the half that cannot be read off a file - whether the two new ones actually happen.
import * as H from './harness.js';
import { check, R, player, mark, mesSince } from './a1lib.js';
import World from '#/engine/World.js';
import NpcType from '#/cache/config/NpcType.js';
import VarPlayerType from '#/cache/config/VarPlayerType.js';
import ObjType from '#/cache/config/ObjType.js';
import ScriptProvider from '#/engine/script/ScriptProvider.js';
import ScriptRunner from '#/engine/script/ScriptRunner.js';
import { NpcStat } from '#/engine/entity/NpcStat.js';
import { NpcMode } from '#/engine/entity/NpcMode.js';

/** Run a proc the way a click does, so a p_delay inside it is resumed instead of abandoned. */
function runToEnd(p: any, name: string, ticks = 8) {
    const script = ScriptProvider.getByName(name);
    if (!script) throw new Error('no such script: ' + name);
    p.executeScript(ScriptRunner.init(script, p), true);
    for (let i = 0; i < ticks && (p.activeScript || p.delayed); i++) H.tick(1);
    H.tick(1);
}

await H.boot();

// ============================================================ auto retaliate survives a logout
console.log('AUTO RETALIATE IS REMEMBERED');
{
    // The whole of the fix is the varp's scope: it had none, a varp with none defaults to temp, and
    // every login turned the setting back on. Asserted against the packed cache rather than the
    // source line, so a config that fails to pack cannot pass this.
    const nodef = VarPlayerType.getByName('option_nodef')!;
    check('the setting is a varp the client is told about', nodef.transmit, true);
    check('  ...and it is saved rather than dropped at logout', nodef.scope, VarPlayerType.SCOPE_PERM);

    // and the button still flips it, both ways, without needing protected access
    const p: any = player('retaliate', 3222, 3222);
    H.setVar(p, 'option_nodef', 0);
    H.runProc(p, '[proc,toggle_auto_retaliate]');
    check('the button turns it off', H.getVar(p, 'option_nodef'), 1);
    H.runProc(p, '[proc,toggle_auto_retaliate]');
    check('  ...and on again', H.getVar(p, 'option_nodef'), 0);
}

// ============================================================================ the spade breaks
console.log('');
console.log('A SPADE BREAKS WHILE FARMING, AND GOES BACK TOGETHER');
{
    const p: any = player('spadebreak', 3222, 3222);
    H.clearInv(p);
    H.give(p, 'spade', 1);
    const from = mark();
    // THROUGH executeScript, NOT runProc. The event ends on p_delay while the head is still in the
    // air - runProc calls ScriptRunner.execute directly and nothing ever resumes the suspended
    // script, so the obj_add at the end of it never happens and the head never lands.
    runToEnd(p, '[proc,macro_event_lost_spade_spawn]');
    const said = mesSince(p, from);
    check('the spade comes apart in your hands', [H.invCount(p, 'spade'), H.invCount(p, 'spade_handle')], [0, 1]);
    check('  ...and says so', said.some(m => m === 'You dig into the soil.'), true);

    // the head is on the ground somewhere near, which is the half a player has to go and fetch
    const headId = ObjType.getId('spade_head');
    let onFloor = false;
    for (let dx = -8; dx <= 8 && !onFloor; dx++) {
        for (let dz = -8; dz <= 8 && !onFloor; dz++) {
            if (World.getObj(p.x + dx, p.z + dz, p.level, headId, p.hash64)) onFloor = true;
        }
    }
    check('  ...and the head lands on the floor nearby', onFloor, true);

    H.give(p, 'spade_head', 1);
    const from2 = mark();
    H.useHeldOn(p, 'spade_head', 'spade_handle');
    check('using the two together rebuilds the spade',
        [H.invCount(p, 'spade'), H.invCount(p, 'spade_handle'), H.invCount(p, 'spade_head')], [1, 0, 0]);
    check('  ...and either way round', mesSince(p, from2).some(m => m.startsWith('You carefully attach')), true);

    // the other way round, which is the half that used to be missed
    H.clearInv(p);
    H.give(p, 'spade_handle', 1);
    H.give(p, 'spade_head', 1);
    H.useHeldOn(p, 'spade_handle', 'spade_head');
    check('  ...including handle onto head', H.invCount(p, 'spade'), 1);

    // NO SPADE, NO BREAK. The roll falls through to a general event instead of taking apart a tool
    // you were not using - a farmer raking a patch has no spade in hand.
    H.clearInv(p);
    runToEnd(p, '[proc,macro_event_lost_spade_spawn]');
    check('with no spade it takes nothing apart', H.invCount(p, 'spade_handle'), 0);
}

// =========================================================================== the Evil Chicken
console.log('');
console.log('AN EVIL CHICKEN TURNS UP AND MEANS IT');
{
    const p: any = player('evilchicken', 3222, 3226);
    H.setVar(p, 'macro_event', 0);
    H.runProc(p, '[proc,macro_event_general_spawn]', [6]); // ^macro_evil_chicken
    H.tick(2);

    const chicken = H.npcNear('macro_evil_chicken_6', p.x, p.z, p.level);
    check('one spawns beside you', chicken !== null, true);
    if (chicken) {
        const t = NpcType.get(chicken.type);
        check('  ...at the bracket for a maxed player', t.debugname, 'macro_evil_chicken_6');
        check('  ...and it is something you can fight', [t.vislevel, t.stats[NpcStat.HITPOINTS]], [159, 170]);
    }
    check('  ...and it is the one holding you, so the PJ timer knows', H.getVar(p, 'aggressive_npc') !== 0, true);
}

console.log('');
// ============================================================== Call follower, on the equipment tab
console.log('');
console.log('CALL FOLLOWER BRINGS THE PET TO YOU');
{
    const p: any = player('callpet', 3230, 3222);
    H.clearInv(p);
    const from0 = mark();
    H.runProc(p, '[proc,call_follower]');
    check('with no pet out it says so', mesSince(p, from0).join(' | '), "You don't have a follower.");

    H.give(p, 'bosspet_kbd_item', 1);
    H.opheld(p, 'bosspet_kbd_item', 5);
    H.tick(2);
    const pet = H.followerOf(p);
    check('the pet is out', pet !== null, true);

    // STRAND IT SOMEWHERE IT CANNOT WALK BACK FROM, but close enough and on the same floor that
    // ~follower_keepup will not fetch it - which is the whole gap this button fills.
    pet!.teleport(p.x + 4, p.z + 4, p.level);
    H.tick(1);
    const away = Math.max(Math.abs(pet!.x - p.x), Math.abs(pet!.z - p.z));
    const from = mark();
    H.runProc(p, '[proc,call_follower]');
    H.tick(1);
    const near = Math.max(Math.abs(pet!.x - p.x), Math.abs(pet!.z - p.z));
    check('calling it brings it to your feet', [away > 1, near <= 1], [true, true]);
    check('  ...and says so', mesSince(p, from).join(' | '), 'You call your follower.');
    check('  ...and it is following again, not standing there', pet!.targetOp, NpcMode.PLAYERFOLLOW);
}


console.log(`RANDOMEVENTS ${R.ok} ok, ${R.bad} FAIL`);
process.exit(R.bad ? 1 : 0);
