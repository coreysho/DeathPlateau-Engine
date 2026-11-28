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
// THIS FILE DOES NOT ASSERT THAT ANY OF IT IS RIGHT. Whether a forced logout should eventually
// override protected access is a question about the game, not one a sim should settle by passing.
// What it pins is the shape: refused, still counted, and now RECORDED by name, so the next
// occurrence says what held it instead of needing a restart to clear.
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
    if (line.includes('logout stalled')) {
        warnings.push(line);
    }
    realLog(...args);
};
const stallLines = (username: string): string[] => warnings.filter(l => l.includes(`logout stalled for ${username}`));

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

console.log('\n== 4. a delay with no end: refused for ever, forced or not, and now named');
{
    const p: any = player('stall_held', 3222, 3220, 0);
    H.tick(2);
    const before = online();
    // p_delay(1000000): a parked script, or one re-delaying in a loop, leaves this and nothing in
    // the engine will clear it before delayedUntil.
    p.delayed = true;
    p.delayedUntil = World.currentTick + 1 + 1000000;
    p.requestLogout = true;
    H.tick(4);
    check('the logout is refused', here('stall_held'), true);
    check('  ...and they are counted online while gone from the game', online(), before);

    H.tick(60);
    check('past 50 ticks the engine writes a line about it', stallLines('stall_held').length >= 1, true);
    check('  ...naming the condition that holds it', stallLines('stall_held')[0]?.includes('held by delayed'), true);
    check('  ...saying they are still counted', stallLines('stall_held')[0]?.includes('still counted online'), true);
    check('  ...and they are, because this only records it', here('stall_held'), true);

    // ONE LINE PER 50 TICKS, not one per tick: a world where this fires must stay readable. The
    // next line is due 50 ticks after the last one was written, so the waiting is counted from the
    // engine's own record of that rather than from this file's idea of how many ticks have passed.
    const written = stallLines('stall_held').length;
    const due = p.logoutStallReported + 50;
    H.tick(due - World.currentTick - 1);
    check('it is throttled rather than written every tick', stallLines('stall_held').length, written);
    H.tick(2);
    check('  ...and repeats once the interval is up', stallLines('stall_held').length, written + 1);

    // AND A FORCED LOGOUT IS NO BETTER, which is the part that makes this a defect rather than a
    // delay. 100 ticks of silence is World.TIMEOUT_NO_RESPONSE: the engine decides to log them out
    // itself, force = true, and the refusal is identical.
    p.lastResponse = World.currentTick - 200;
    p.lastConnected = World.currentTick - 200;
    const beforeForce = stallLines('stall_held').length;
    tickSilent(60);
    check('the engine forces the logout after 60s of silence', p.logoutReason, 'no response for 60s');
    check('  ...and it is refused on the same terms', here('stall_held'), true);
    check(
        '  ...with the line now saying FORCED',
        stallLines('stall_held')
            .slice(beforeForce)
            .some(l => l.includes('FORCED')),
        true
    );
    check('  ...and they are STILL counted online', online(), before);

    // THE ONE OVERRIDE, and the reason a restart cured it. Read as a plain call rather than by
    // cycling the world, so that nothing else in this run sees a shutting-down world.
    // World.shutdown is a getter over shutdownTick, so this is set the way the reboot command sets
    // it, and put back before anything cycles.
    World.shutdownTick = World.currentTick;
    const underShutdown = p.canAccess();
    World.shutdownTick = -1;
    check('only a world shutdown lifts the refusal', underShutdown, true);
    check('  ...whereas a running world still refuses', p.canAccess(), false);

    // AND THE ACCOUNT CANNOT GET BACK IN, which is the half of this a player actually feels. The
    // login path refuses a username that is still in the world - processLogins, 'already logged in',
    // reply 5 - and a stalled player is still in it. NOT through logoutRequests: that map is only
    // written by flushPlayer, when a logout COMPLETES, so a stall never reaches it. H.makePlayer
    // reuses the same account for the same label, so this is the same name coming back.
    const again = H.makePlayer('stall_held', 3222, 3220);
    H.tick(2);
    check('a fresh login under the same name is refused', again.isActive, false);
    check('  ...and the world still holds the stuck one', World.getPlayerByUsername('stall_held') === p, true);

    // AND IT CLEARS THE MOMENT THE BLOCKER DOES: the logout was never broken, only blocked.
    p.delayed = false;
    H.tick(4);
    check('releasing the delay lets the logout finish', here('stall_held'), false);
    check('  ...and the count comes down at last', online(), before - 1);
}

console.log('\n== 5. a queued request does it too, and is named separately');
{
    const p: any = player('stall_queue', 3222, 3221, 0);
    H.tick(2);
    const before = online();

    // A REAL QUEUED SCRIPT, through the engine's own Player.enqueueScript - the call the `queue`
    // command compiles to. The delay means it never actually runs, which is the point: a queued
    // request that has not run yet makes queueDiscardable false, and Player.processQueue only runs
    // one when canAccess() is true, so a delayed player cannot drain their own queue either.
    const script = ScriptProvider.getByName('[queue,damage_player]');
    check('the queued script used here exists in the content', !!script, true);
    p.enqueueScript(script!, PlayerQueueType.NORMAL, 1000000, [0]);
    p.requestLogout = true;
    H.tick(60);
    check('the logout is refused with nothing else holding them', here('stall_queue'), true);
    check('  ...and canAccess is not the problem - it is fine', p.canAccess(), true);
    check('  ...the line names the queue instead', stallLines('stall_queue')[0]?.includes('held by queue'), true);

    // AND THE COMPOUND, which is how a stall survives everything: the queue cannot run while the
    // player is delayed, so each condition keeps the other alive.
    p.delayed = true;
    p.delayedUntil = World.currentTick + 1 + 1000000;
    const beforeBoth = stallLines('stall_queue').length;
    H.tick(60);
    check(
        'with a delay as well, both are named at once',
        stallLines('stall_queue')
            .slice(beforeBoth)
            .some(l => l.includes('held by delayed + queue')),
        true
    );
    check('  ...and the queued request still has not run', H.queued(p, '[queue,damage_player]').length, 1);

    p.delayed = false;
    p.queue.clear();
    H.tick(4);
    check('clearing both lets them go', here('stall_queue'), false);
    check('  ...and the count comes down', online(), before - 1);
}

console.log = realLog;
console.log(`\n${R.ok} ok, ${R.bad} FAIL`);
process.exit(R.bad ? 1 : 0);
