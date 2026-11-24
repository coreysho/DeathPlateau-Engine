// A LOGOUT THAT CANNOT FINISH, and the fact that nothing used to say so.
// Usage: NODE_MEMBERS=true npx tsx tools/sim/logoutstall.ts   (exit code is the verdict)
//
// Reported from play as players showing online who were not, and cured by restarting the world -
// which is exactly what in-memory state does, and which left nothing behind to look at.
//
// World.processLogouts only completes a logout when
//
//     player.canAccess() && player.engineQueue.head() === null && queueDiscardable
//
// with canAccess() = `World.shutdown ? true : (!protect && !busy())` and busy() = `delayed ||
// containsModalInterface()`. A FORCED logout - no response for 60s, or an idle kick - is refused on
// those same terms. The single override is World.shutdown, where canAccess() returns true outright:
// a restart. Until then the player keeps their slot in World.players, getHumanPlayerCount() counts
// them among those online, and before this change the engine never said a word about it.
//
// WHICH OF THOSE CONDITIONS CAN ACTUALLY STAY STUCK, measured here rather than assumed, because a
// first guess at this was wrong in a way worth writing down:
//
//   protect  - CANNOT be held across a tick by itself. World.processCleanup calls
//              Player.resetEntity(false) for every player every tick and that sets protect = false;
//              a parked protected script only has it re-set (Player.executeScript) for the tick it
//              is resumed in. Section 1 measures this, which is why nothing below is built on it.
//   delayed  - CAN, and has no deadline of its own. It is cleared in exactly one place,
//              World.processPlayers: `if (player.delayed && currentTick >= player.delayedUntil)`.
//              p_delay writes `delayed = true; delayedUntil = currentTick + 1 + n`, so the state
//              sections 3 and 4 set by hand is the state content writes, with a large n.
//   queue    - CAN. A NORMAL or STRONG queued request makes queueDiscardable false until it runs,
//              and Player.processQueue only runs it when canAccess() is true - so while the player
//              is delayed the queue cannot drain either. Section 5.
//
// AND THE ANSWER THAT WAS GIVEN (DeathPlateau-Bugs#105, decided 25 November 2026). Overriding all
// of it would cut a script off mid-way, which is where a dupe or a lost item comes from, so the
// override is the one case that can lose nothing: a BARE delay - no protected access, no modal, no
// active script, no engine-queued request and nothing in the queue - is a player the engine is
// holding for a timer and for no other reason. After a hundred ticks of that the delay is given
// up. Everything else still waits, and is still reported by name rather than silently.
//
// NOT ONLY FOR A FORCED LOGOUT, which is where the question came from: the condition is what makes
// it safe, not who asked. Sections 4 to 7 are that rule from both ends - given up where there is
// nothing pending, refused for three hundred ticks where there is, and the same either way for a
// logout the player asked for and one the engine forced.
import * as H from './harness.js';
import { check, R, player } from './a1lib.js';
import { PlayerQueueType } from '#/engine/entity/PlayerQueueRequest.js';
import ScriptProvider from '#/engine/script/ScriptProvider.js';
import World from '#/engine/World.js';

await H.boot();

// EVERY WARNING THE ENGINE WRITES, kept so the checks can read the diagnostic itself rather than a
// counter that claims it happened. printWarning goes through console.log.
const warnings: string[] = [];
const realLog = console.log.bind(console);
console.log = (...args: unknown[]) => {
    const line = args.map(a => String(a)).join(' ');
    if (line.includes('logout stalled') || line.includes('logout override')) {
        warnings.push(line);
    }
    realLog(...args);
};
const stallLines = (username: string): string[] => warnings.filter(l => l.includes(`logout stalled for ${username}`));
const overrideLines = (username: string): string[] => warnings.filter(l => l.includes(`logout override for ${username}`));

const online = () => World.getHumanPlayerCount();
const here = (username: string) => !!World.getPlayerByUsername(username);

/**
 * Ticks WITHOUT telling the engine the players are still connected.
 *
 * H.tick refreshes lastConnected and lastResponse for every player every tick, because a sim player
 * has no socket and would otherwise be kicked for a lost connection after 50 ticks. That also makes
 * a 60-second timeout unreachable, and the timeout is how World.processLogouts arrives at a FORCED
 * logout - the case section 4 is about. So this cycles the world directly and leaves those two
 * fields alone. Only use it with a player who is meant to look silent.
 */
function tickSilent(n = 1): void {
    for (let i = 0; i < n; i++) {
        World.cycle();
    }
}

console.log('== 1. protect is not the thing to hunt for: it does not survive a tick');
{
    const p: any = player('stall_prot', 3222, 3217, 0);
    H.tick(2);
    p.protect = true;
    check('set by hand it is true', p.protect, true);
    H.tick(1);
    check('  ...and resetEntity has cleared it one tick later', p.protect, false);
    p.requestLogout = true;
    H.tick(4);
    check('  so a player "holding protected access" logs out normally', here('stall_prot'), false);
}

console.log('\n== 2. a clean logout leaves, and stops being counted');
{
    const p: any = player('stall_ok', 3222, 3218, 0);
    H.tick(2);
    const before = online();
    check('the player is counted while they are here', before >= 1, true);
    p.requestLogout = true;
    H.tick(4);
    check('a player with nothing holding them is gone', here('stall_ok'), false);
    check('  ...and the count came back down', online(), before - 1);
}

console.log('\n== 3. a delay that still has an end: refused while it runs, finished when it expires');
{
    const p: any = player('stall_wait', 3222, 3219, 0);
    H.tick(2);
    const before = online();
    // Exactly what p_delay(12) writes.
    p.delayed = true;
    p.delayedUntil = World.currentTick + 1 + 12;
    p.requestLogout = true;
    H.tick(6);
    check('the logout is refused while the delay runs', here('stall_wait'), true);
    check('  ...and they are still counted online', online(), before);
    check('  ...with the stall recorded from the first refusal', p.logoutStallSince >= 0, true);
    check('  but not yet reported - 6 ticks is not 50', stallLines('stall_wait').length, 0);
    H.tick(12);
    check('when the delay expires the logout completes on its own', here('stall_wait'), false);
    check('  ...the count comes down', online(), before - 1);
    check('  ...and the stall record is cleared with it', p.logoutStallSince, -1);
}

console.log('\n== 4. a BARE delay: refused, reported, and then given up');
{
    const p: any = player('stall_held', 3222, 3220, 0);
    H.tick(2);
    const before = online();
    // p_delay(1000000) and nothing else: no protected access, no modal, no active script, nothing
    // queued. The engine is holding this player for a timer and for no other reason, which is the
    // one case DeathPlateau-Bugs#105 decided it is safe to override - there is nothing to lose by
    // giving the delay up.
    p.delayed = true;
    p.delayedUntil = World.currentTick + 1 + 1000000;
    p.requestLogout = true;
    H.tick(4);
    check('the logout is refused at first', here('stall_held'), true);
    check('  ...and they are counted online while gone from the game', online(), before);

    H.tick(55);
    check('past 50 ticks the engine writes a line about it', stallLines('stall_held').length >= 1, true);
    check('  ...naming the condition that holds it', stallLines('stall_held')[0]?.includes('held by delayed'), true);
    check('  ...and they are still here, because the report is only a report', here('stall_held'), true);

    // AND AT A HUNDRED TICKS THE DELAY IS GIVEN UP. Twice the warning's patience, so the journal
    // always has the stall written down before anything acts on it.
    H.tick(50);
    check('the delay is given up at last', here('stall_held'), false);
    check('  ...the count comes down', online(), before - 1);
    check('  ...and the journal says it was overridden, not that it simply left', overrideLines('stall_held').length, 1);
    check('  ...naming what was holding them', overrideLines('stall_held')[0]?.includes('bare delay with no script'), true);
}

console.log('\n== 5. and a delay with WORK behind it is not given up');
{
    const p: any = player('stall_queue', 3222, 3221, 0);
    H.tick(2);
    const before = online();

    // A REAL QUEUED SCRIPT, through the engine's own Player.enqueueScript - the call the `queue`
    // command compiles to. The delay means it never runs, which is the point: a queued request
    // that has not run yet is work the player is owed, and Player.processQueue cannot run it while
    // they are delayed. THIS is what must never be overridden, because giving the delay up here
    // would drop whatever that script was going to do.
    const script = ScriptProvider.getByName('[queue,damage_player]');
    check('the queued script used here exists in the content', !!script, true);
    p.enqueueScript(script!, PlayerQueueType.NORMAL, 1000000, [0]);
    p.delayed = true;
    p.delayedUntil = World.currentTick + 1 + 1000000;
    p.requestLogout = true;

    H.tick(60);
    check('the logout is refused', here('stall_queue'), true);
    check(
        '  ...with both conditions named',
        stallLines('stall_queue').some(l => l.includes('held by delayed + queue')),
        true
    );
    H.tick(200);
    check('and three hundred ticks later it is STILL refused', here('stall_queue'), true);
    check('  ...with nothing overridden', overrideLines('stall_queue').length, 0);
    check('  ...and the queued request still has not run', H.queued(p, '[queue,damage_player]').length, 1);
    check('  ...and they are still counted online', online(), before);

    // TAKE THE WORK AWAY AND THE DELAY IS BARE, so the override applies on the next pass: the rule
    // is about what is pending, not about how long anybody has waited.
    p.queue.clear();
    H.tick(4);
    check('with the queue cleared the bare delay is given up', here('stall_queue'), false);
    check('  ...and the count comes down', online(), before - 1);
    check('  ...with an override line for it', overrideLines('stall_queue').length, 1);
}

console.log('\n== 6. a queued request on its own, with no delay at all');
{
    // canAccess() is fine here - no delay, no protect, no modal - and the logout is still refused,
    // because a queued request that has not run is work the player is owed. Not a bare delay, so
    // not overridden, and the line names the queue rather than the delay.
    const p: any = player('stall_qonly', 3222, 3222, 0);
    H.tick(2);
    const before = online();
    const script = ScriptProvider.getByName('[queue,damage_player]');
    p.enqueueScript(script!, PlayerQueueType.NORMAL, 1000000, [0]);
    p.requestLogout = true;
    H.tick(120);
    check('the logout is refused with access perfectly fine', here('stall_qonly'), true);
    check('  ...and canAccess really is fine', p.canAccess(), true);
    check('  ...the line names the queue', stallLines('stall_qonly')[0]?.includes('held by queue'), true);
    check('  ...and nothing was overridden', overrideLines('stall_qonly').length, 0);
    p.queue.clear();
    H.tick(4);
    check('clearing it lets them go', here('stall_qonly'), false);
    check('  ...and the count comes down', online(), before - 1);
}

console.log('\n== 7. a FORCED logout is held by the same rules, and freed by the same one');
{
    // The question on the issue was whether a forced logout should override protected access. It
    // does not: the override is about what is pending, not about who asked - so a forced logout
    // held by a bare delay is given up like any other, and one held by real work waits like any
    // other. This is the forced half of 4 and 5.
    const p: any = player('stall_force', 3222, 3223, 0);
    H.tick(2);
    const before = online();
    const script = ScriptProvider.getByName('[queue,damage_player]');
    p.enqueueScript(script!, PlayerQueueType.NORMAL, 1000000, [0]);
    p.delayed = true;
    p.delayedUntil = World.currentTick + 1 + 1000000;
    p.lastResponse = World.currentTick - 200;
    p.lastConnected = World.currentTick - 200;
    tickSilent(150);
    check('the engine forces the logout after 60s of silence', p.logoutReason, 'no response for 60s');
    check('  ...and work behind the delay still refuses it', here('stall_force'), true);
    check(
        '  ...with the line saying FORCED',
        stallLines('stall_force').some(l => l.includes('FORCED')),
        true
    );
    check('  ...and nothing overridden', overrideLines('stall_force').length, 0);
    check('  ...and they are still counted online', online(), before);

    // THE ONE OVERRIDE THERE HAS EVER BEEN, which is why a restart cured this. Read as a plain
    // call rather than by cycling the world, so nothing else in this run sees a shutting-down
    // world.
    World.shutdownTick = World.currentTick;
    const underShutdown = p.canAccess();
    World.shutdownTick = -1;
    check('only a world shutdown lifts canAccess outright', underShutdown, true);

    p.queue.clear();
    tickSilent(4);
    check('and with the work gone the bare delay is given up', here('stall_force'), false);
    check('  ...and the count comes down at last', online(), before - 1);
    check('  ...with an override line naming the bare delay', overrideLines('stall_force')[0]?.includes('bare delay with no script'), true);
}

console.log = realLog;
console.log(`\n${R.ok} ok, ${R.bad} FAIL`);
process.exit(R.bad ? 1 : 0);
