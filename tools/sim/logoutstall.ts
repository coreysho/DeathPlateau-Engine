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
import ScriptRunner from '#/engine/script/ScriptRunner.js';
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

console.log('\n== 4. a delay with no end: a REQUESTED logout is refused for ever, and now named');
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

    // A FORCED LOGOUT USED TO BE NO BETTER, which is the part that made this a defect and not just
    // a delay: the engine decides to log them out itself after 100 ticks of silence, force = true,
    // and the refusal was identical. That is no longer true of THIS case - a bare delay - and it
    // is pinned in section 6, which also pins the cases where it is deliberately still true. This
    // section stays on the requested logout, where the client is connected and nothing is overridden.

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

console.log('\n== 6. the middle option: a FORCED logout releases a BARE delay, and only that');
// DeathPlateau-Bugs#105, owner's call. Everything above is what is still refused; this is the one
// thing that no longer is. THE RISK OF OVERRIDING A REFUSED LOGOUT is the one the refusal exists for -
// protect, delayed and the queues are there so that a trade, a death or an item halfway between two
// inventories is not interrupted - so the override is true only when none of that is in play.
//
// EVERY SCENARIO CLEANS UP BEFORE THE NEXT. tickSilent cycles the world without refreshing anybody's
// connection, so a player left stuck by one scenario would time out and become a forced logout in
// the next, and the next would be measuring the last.
const forceSilent = (p: any) => {
    p.lastResponse = World.currentTick - 200;
    p.lastConnected = World.currentTick - 200;
};
const bareDelay = (p: any) => {
    p.delayed = true;
    p.delayedUntil = World.currentTick + 1 + 1000000;
};
{
    // ---- A. the override itself, and its threshold ----
    const p: any = player('stall_bare', 3222, 3222, 0);
    H.tick(2);
    const before = online();
    bareDelay(p);
    forceSilent(p);
    tickSilent(1);
    check('the engine forces the logout', p.logoutReason, 'no response for 60s');
    check('  ...and a stall has begun', p.logoutStallSince !== -1, true);
    // READ NOW. A successful logout resets logoutStallSince to -1 on the way out, so measuring the
    // wait afterwards against it gave currentTick + 1 - 414 ticks of "stall" for a player who was
    // released at 100. The first draft of this check did exactly that.
    const since = p.logoutStallSince;

    // THE THRESHOLD, from the engine's own record of when the stall began rather than this file's
    // idea of how many ticks have passed. Still refused well inside it.
    tickSilent(90);
    check('90 ticks in, it is still refused - the delay gets time to finish by itself', here('stall_bare'), true);
    check('  ...with nothing overridden yet', overrideLines('stall_bare').length, 0);
    check(
        '  ...and the ordinary line naming the delay has been written',
        stallLines('stall_bare').some(l => l.includes('held by delayed') && l.includes('FORCED')),
        true
    );

    // THEN IT GOES, ON THE TICK THE THRESHOLD IS REACHED. Counted rather than assumed.
    let guard = 0;
    while (here('stall_bare') && guard++ < 30) {
        tickSilent(1);
    }
    const waited = World.currentTick - since;
    check('past the threshold the forced logout goes through', here('stall_bare'), false);
    check(`  ...after ${waited} ticks of stall, which is 100 or one over`, waited >= 100 && waited <= 102, true);
    check('  ...and they stop being counted online', online(), before - 1);
    check('  ...with exactly one override line, not one per tick', overrideLines('stall_bare').length, 1);
    check('  ...saying why nothing was cut off', overrideLines('stall_bare')[0]?.includes('no script behind it'), true);
}

{
    // ---- B. a REQUESTED logout from a live client is not touched ----
    const p: any = player('stall_live', 3222, 3223, 0);
    H.tick(2);
    bareDelay(p);
    p.requestLogout = true;
    // H.tick, not tickSilent: this client is connected, which is the whole point of the case.
    H.tick(300);
    check('a client that is still connected is not overridden, however long it waits', here('stall_live'), true);
    check('  ...and no override was ever written for them', overrideLines('stall_live').length, 0);
    p.delayed = false;
    H.tick(4);
    check('  ...and it still completes the moment the delay ends', here('stall_live'), false);
}

{
    // ---- C. REAL WORK PENDING stays refused, forced or not ----
    const p: any = player('stall_work', 3222, 3224, 0);
    H.tick(2);
    const script = ScriptProvider.getByName('[queue,damage_player]');
    p.enqueueScript(script!, PlayerQueueType.NORMAL, 1000000, [0]);
    bareDelay(p);
    forceSilent(p);
    tickSilent(300);
    check('a forced logout with a QUEUED request is still refused after 300 ticks', here('stall_work'), true);
    check('  ...the queued request is still there, uncut', H.queued(p, '[queue,damage_player]').length, 1);
    check('  ...nothing was overridden', overrideLines('stall_work').length, 0);
    check(
        '  ...and the line still names both',
        stallLines('stall_work').some(l => l.includes('held by delayed + queue')),
        true
    );
    p.delayed = false;
    p.queue.clear();
    tickSilent(4);
    check('  ...and it goes the moment the work is gone', here('stall_work'), false);
}

{
    // ---- D. A PARKED SCRIPT stays refused, forced or not ----
    // A script in the middle of a delay will RESUME when it ends and carry on doing whatever it was
    // doing - which is exactly what must not be cut short. A delay with no script is a timer with
    // nothing left to time; this one has something to resume.
    const p: any = player('stall_script', 3222, 3225, 0);
    H.tick(2);
    const script = ScriptProvider.getByName('[queue,damage_player]');
    p.activeScript = ScriptRunner.init(script!, p);
    bareDelay(p);
    forceSilent(p);
    tickSilent(300);
    check('the script is still parked there', p.activeScript !== null, true);
    check('a forced logout with a parked script is still refused after 300 ticks', here('stall_script'), true);
    check('  ...nothing was overridden', overrideLines('stall_script').length, 0);
    p.activeScript = null;
    p.delayed = false;
    tickSilent(4);
    check('  ...and it goes once the script is gone', here('stall_script'), false);
}

console.log = realLog;
console.log(`\n${R.ok} ok, ${R.bad} FAIL`);
process.exit(R.bad ? 1 : 0);
