// Old School's PJ ("pile jumping") timer in single-way combat - run with `npx tsx tools/sim/pjtimer.ts`.
//
// Three players: A and B fight each other in the Graveyard of Shadows (single-way, wilderness 19),
// C stands next to them and tries to muscle in.
//
//   the timer        20 ticks / 12 seconds from the last hit between A and B
//                    (https://oldschool.runescape.wiki/w/PJ_timer, and Jagex 9 March 2022:
//                    "unable to hit you for the next 20 cycles (12 seconds)")
//   both sides       the ATTACKER is covered as well as the defender - the old 8-tick rule only
//                    started a clock on whoever took the hit, so A could be piled for free
//   each other       A and B keep swinging at each other the whole time
//   lapsing          C gets in the moment the 20th tick passes with no blow between them
//   multi            no restriction at all: C attacks either of them on the spot
//   running off      the clock is not cleared when a fight breaks up - it runs out, and until it
//                    does neither the one left behind nor a third player may start something new
//   teleporting      the same: the clock runs, it is not cut short
//   logging out      the leaver's lock is dropped, so whoever was holding them is free at once
//   unsigned uids    a uid of 2^31 or more is negative in a varp; the lock is compared as a signed
//                    int on both sides, so the run below uses names that land in that half
//
// NOTHING HERE COUNTS TICKS BY HAND. A swing can miss and a hit can roll 0 damage, and a click made
// while the player is delayed is thrown away, so every step waits for the state it needs rather
// than assuming a fixed number of ticks got it there: ~engage swings until the fight has actually
// started, ~killOutright pins the victim at 1 hitpoint and swings until the death script has run
// (and says so plainly if it never did), and ~lapse walks to the timer's own boundary read off
// %lastcombat_pvp instead of ticking a count. The logout hold is likewise read off the engine's
// preventLogoutUntil. Before that this run failed about one time in three.
import * as H from './harness.ts';
import World from '#/engine/World.js';
import Player from '#/engine/entity/Player.js';
import { CoordGrid } from '#/engine/CoordGrid.js';
import { isMapBlocked } from '#/engine/GameMap.js';
import { toBase37 } from '#/util/JString.js';
import { wildernessLevel } from '#/engine/bot/BotBrain.js';

const PJ = 20;

let ok = 0,
    bad = 0;
const check = (what: string, got: unknown, want: unknown) => {
    const pass = JSON.stringify(got) === JSON.stringify(want);
    pass ? ok++ : bad++;
    console.log(`  ${pass ? 'ok  ' : 'FAIL'} ${what}: ${JSON.stringify(got)}${pass ? '' : `   (want ${JSON.stringify(want)})`}`);
};

await H.boot();
H.loginOrder();

// A single-way patch of the wilderness (the Graveyard of Shadows) and a multiway one.
const SINGLE = { x: 3160, z: 3668 };
const MULTI = { x: 3240, z: 3600 };
const multiAt = (x: number, z: number) => World.gameMap.isMulti(CoordGrid.packCoord(0, x, z));

// A uid is ((username37 & 0x1fffff) << 11) | slot, which is unsigned - but a varp is an Int32Array,
// so half of all names come back out of a varp negative. These names are all in that half, so every
// uid the run compares has its top bit set and a comparison that is not signed on both sides fails.
const highNames: string[] = [];
for (let n = 0; highNames.length < 40; n++) {
    const name = 'pjt' + n;
    if (toBase37(name) & 0x100000n) highNames.push(name);
}
let nameIdx = 0;

const spawn = (at: { x: number; z: number }, dx: number): Player => {
    let x = at.x + dx,
        z = at.z;
    while (isMapBlocked(x, z, 0)) z++;
    const p: any = H.makePlayer(highNames[nameIdx++], x, z);
    H.tick(2);
    H.maxOut(p);
    p.combatLevel = p.getCombatLevel();
    H.clearInv(p);
    H.equip(p, { rhand: 'rune_scimitar', torso: 'rune_platebody', legs: 'rune_platelegs', hat: 'rune_full_helm' });
    H.tick(1);
    return p;
};

const uidOf = (p: Player) => p.uid | 0;
const varp = (p: Player, name: string) => H.getVar(p, name);

/** Break the fight off: nobody walks back for another swing, so nothing refreshes the clocks. */
const breakOff = (...ps: Player[]) => {
    for (const p of ps) {
        p.clearPendingAction();
        p.clearInteraction();
        (p as any).waypointIndex = -1;
    }
};

/** ~pvp_in_combat_check, the gate itself: does it let this attack through, and what does it say? */
const gate = (p: Player, target: Player): { allowed: boolean; said: string | null } => {
    H.clearLogs();
    const out = H.runProc(p, '[proc,pvp_in_combat_check]', [], target);
    const said = H.mesgs.filter(m => m.who === p.username).map(m => m.text);
    return { allowed: out[out.length - 1] === 1, said: said.length ? said[said.length - 1] : null };
};

/** A real Attack click, ticked through - returns whatever the engine told the clicker. */
const clickAttack = (p: Player, target: Player): string[] => {
    H.clearLogs();
    H.attack(p, target);
    H.tick(1);
    return H.mesgs.filter(m => m.who === p.username).map(m => m.text);
};

/**
 * Start a fight and do not come back until it has actually started. A single click can be thrown
 * away - H.attack refuses one made while the player is delayed - so the click is repeated until the
 * engine has run ~set_pk_vars, which is what every assertion after this reads.
 */
const engage = (p: Player, target: Player) => {
    for (let t = 0; t < 20; t++) {
        if (varp(target, 'lastcombat_pvp') > 0 && varp(target, 'pvp_opponent') === uidOf(p)) return;
        H.attack(p, target);
        H.tick(1);
    }
    check(`${p.username} never got a swing in on ${target.username}`, false, true);
};

/**
 * Kill a player for certain. A swing can miss, and a hit can roll 0 damage, so this keeps the
 * victim pinned at 1 hitpoint and the killer topped up (they are being retaliated on) and swings
 * until the death script has run - then says so plainly if it never did, instead of letting every
 * assertion after it fall over with a mystery value.
 */
const killOutright = (killer: Player, victim: Player) => {
    const deaths = varp(victim, 'player_deaths');
    let died = false;
    for (let t = 0; t < 200 && varp(killer, 'pvp_opponent') !== -1; t++) {
        (victim as any).levels[3] = 1;
        (killer as any).levels[3] = 99;
        H.attack(killer, victim);
        H.tick(1);
        if (varp(victim, 'player_deaths') > deaths) died = true;
    }
    check(`  ${victim.username} is killed outright`, died, true);
};

/**
 * Walk the clock to the last tick of a player's PJ timer and then one over it, so the boundary is
 * read off the timer itself rather than counted from wherever the fight happened to end.
 * ~pj_timer_pvp_running is `%lastcombat_pvp + 20 > map_clock`: covered at until - 1, free at until.
 */
const lapse = (holder: Player, jumper: Player, what: string) => {
    const until = varp(holder, 'lastcombat_pvp') + PJ;
    check(`${what} - the timer still has ticks to run`, World.currentTick < until, true);
    while (World.currentTick < until - 1) H.tick(1);
    check("  still covered on the timer's last tick", gate(jumper, holder).allowed, false);
    H.tick(1);
    check('  and open the moment it lapses', gate(jumper, holder).allowed, true);
};

console.log('THE MAP AND THE UIDS');
{
    const p = spawn(SINGLE, 8);
    check('the Graveyard of Shadows is single-way wilderness', [multiAt(SINGLE.x, SINGLE.z), wildernessLevel(p, SINGLE.x, SINGLE.z, 0) >= 1], [false, true]);
    check('and there is a multiway patch to compare it with', [multiAt(MULTI.x, MULTI.z), wildernessLevel(p, MULTI.x, MULTI.z, 0) >= 1], [true, true]);
    check('the run uses players whose uid is 2^31 or more', p.uid >= 2 ** 31, true);
    check('  so every lock below reads back from its varp negative', uidOf(p) < 0, true);
    H.despawn(p);
    H.tick(2);
}

console.log('A AND B FIGHT, C TRIES TO JUMP IN (single-way)');
{
    const a = spawn(SINGLE, 0);
    const b = spawn(SINGLE, 1);
    const c = spawn(SINGLE, 3);

    check('before anything, C may attack either of them', [gate(c, a).allowed, gate(c, b).allowed], [true, true]);

    engage(a, b);
    check('A swings at B: both PJ timers are set', [varp(a, 'lastcombat_pvp') > 0, varp(b, 'lastcombat_pvp') > 0], [true, true]);
    check('  and they are locked to each other (signed uids)', [varp(a, 'pvp_opponent') === uidOf(b), varp(b, 'pvp_opponent') === uidOf(a)], [true, true]);

    const onA = gate(c, a);
    const onB = gate(c, b);
    check('C cannot attack the DEFENDER', [onB.allowed, onB.said], [false, 'Someone else is already fighting your opponent.']);
    check('C cannot attack the ATTACKER either', [onA.allowed, onA.said], [false, 'Someone else is already fighting your opponent.']);
    check('  and the real click says so too', clickAttack(c, a), ['Someone else is already fighting your opponent.']);

    check('A and B may keep fighting each other', [gate(a, b).allowed, gate(b, a).allowed], [true, true]);
    const away = gate(a, c);
    check('but neither may turn on C', [away.allowed, away.said], [false, "I'm already under attack."]);

    // let the fight run: every swing refreshes both clocks, so C stays out for as long as it lasts
    let blocked = true;
    for (let t = 0; t < 40; t++) {
        H.attack(a, b);
        H.tick(1);
        if (gate(c, b).allowed || gate(c, a).allowed) blocked = false;
    }
    check('through 40 ticks of fighting C never gets in', blocked, true);

    H.despawn(a, b, c);
    H.tick(2);
}

console.log('THE TIMER IS 20 TICKS, NOT 8');
{
    const a = spawn(SINGLE, 0);
    const b = spawn(SINGLE, 1);
    const c = spawn(SINGLE, 3);
    engage(a, b);
    const struck = varp(b, 'lastcombat_pvp');
    // A runs off so nothing refreshes the clock, and we watch the tick C gets in
    breakOff(a, b);
    a.teleport(SINGLE.x + 14, SINGLE.z, 0);
    let firstIn = -1;
    for (let t = 0; t < 40 && firstIn === -1; t++) {
        H.tick(1);
        if (gate(c, b).allowed) firstIn = World.currentTick - struck;
    }
    check('C is held out for the full 20 ticks (12 seconds), not the old 8', firstIn, PJ);
    check('  and nothing refreshed the clock while A was away', varp(b, 'lastcombat_pvp'), struck);
    H.despawn(a, b, c);
    H.tick(2);
}

console.log('MULTIWAY: NO RESTRICTION');
{
    const a = spawn(MULTI, 0);
    const b = spawn(MULTI, 1);
    const c = spawn(MULTI, 3);
    engage(a, b);
    check('the fight is on', [varp(a, 'pvp_opponent') === uidOf(b), varp(b, 'pvp_opponent') === uidOf(a)], [true, true]);
    check('C attacks the defender on the spot', gate(c, b).allowed, true);
    check('  and the attacker too', gate(c, a).allowed, true);
    check('  and A may turn on C', gate(a, c).allowed, true);
    H.despawn(a, b, c);
    H.tick(2);
}

console.log('ONE OF THEM RUNS OFF OR TELEPORTS');
{
    const a = spawn(SINGLE, 0);
    const b = spawn(SINGLE, 1);
    const c = spawn(SINGLE, 3);
    engage(a, b);
    // A teleports out of the wilderness entirely
    breakOff(a, b);
    a.teleport(3222, 3218, 0);
    H.tick(2);
    const onB = gate(c, b);
    check('A teleports away: B is still held for the rest of the timer', [onB.allowed, onB.said], [false, 'Someone else is already fighting your opponent.']);
    const bOnC = gate(b, c);
    check('  and B may not start on C either', [bOnC.allowed, bOnC.said], [false, "I'm already under attack."]);
    lapse(b, c, '  the clock was not cut short');
    check('  and B may start a new fight once it has', gate(b, c).allowed, true);
    H.despawn(a, b, c);
    H.tick(2);
}

console.log('ONE OF THEM LOGS OUT');
{
    const a = spawn(SINGLE, 0);
    const b = spawn(SINGLE, 1);
    const c = spawn(SINGLE, 3);
    engage(a, b);
    check('B is locked to A', varp(b, 'pvp_opponent') === uidOf(a), true);
    // ~.combat_preventlogout is p_preventlogout(..., 16), and it is set on whoever TAKES a hit - so
    // A is only held once B has hit back. Trade until that happens rather than assuming it has, and
    // read the boundary off the engine's own preventLogoutUntil instead of counting ticks by hand.
    let held = false;
    for (let t = 0; t < 40 && !held; t++) {
        H.attack(a, b);
        H.tick(1);
        held = (a as any).preventLogoutUntil > World.currentTick;
    }
    // B's swing sets both of these on A in the one script path (~set_pk_vars and ~.pvp_damage_max ->
    // ~.combat_preventlogout), so the 16 is read off the engine's own two numbers, not off a count
    check('  B hits back, so A is held in the world for 16 ticks', [held, (a as any).preventLogoutUntil - varp(a, 'lastcombat_pvp')], [true, 16]);
    const heldUntil = (a as any).preventLogoutUntil as number;
    // the real logout path: request it and let World.processLogouts run the [logout,_] trigger
    breakOff(a, b);
    let gone = -1;
    for (let t = 0; t < 40 && gone === -1; t++) {
        (a as any).requestLogout = true; // the click, held down until the engine lets it through
        H.tick(1);
        if (a.slot === -1) gone = World.currentTick;
    }
    check('  and goes on the tick after that runs out', [gone !== -1, gone - heldUntil], [true, 1]);
    check('  B is not locked to a ghost any more', varp(b, 'pvp_opponent'), -1);
    check("  while B's own timer is still running - the 16-tick hold ends inside the 20", varp(b, 'lastcombat_pvp') + PJ > World.currentTick, true);
    check('  so B may start on C', gate(b, c).allowed, true);
    const onB = gate(c, b);
    check('  but C still may not jump B - their own 12 seconds are their own', [onB.allowed, onB.said], [false, 'Someone else is already fighting your opponent.']);
    lapse(b, c, '  and they are B\'s own to run down');
    H.despawn(b, c);
    H.tick(2);
}

console.log('A KILL FREES THE KILLER');
{
    const a = spawn(SINGLE, 0);
    const b = spawn(SINGLE, 1);
    const c = spawn(SINGLE, 3);
    engage(a, b);
    check('A is locked to B', varp(a, 'pvp_opponent') === uidOf(b), true);
    killOutright(a, b);
    check('B dies: the killer is no longer locked to them', varp(a, 'pvp_opponent'), -1);
    check('  so A may turn on C right away', gate(a, c).allowed, true);
    check('  while C still cannot touch A - the killer keeps their 12 seconds', gate(c, a).allowed, false);
    lapse(a, c, '  the killer keeps the rest of the timer');
    H.despawn(a, b, c);
    H.tick(2);
}

console.log('A RANDOM EVENT CANNOT PJ A FIGHT');
{
    // A monster that has hold of you keeps other players off you for 8 ticks, and that is right:
    // you are busy, and somebody else's hit would be a pile-on you did not ask for. A RANDOM EVENT
    // IS NOT THAT. It walked up on its own, it chose the moment, and neither player invited it - so
    // letting it set the hold hands a third party the power to end a fight. Reported as "aggressive
    // random events can pj a pvp fight".
    //
    // Every event npc carries %npc_macro_event_target, the player it came for, and nothing else in
    // the game sets it; ~pj_blocking_npc reads exactly that. The control below is the same setup
    // with an ordinary monster, because a fix that let EVERY monster through would pass the first
    // half of this and break the timer.
    const a = spawn(SINGLE, 0);
    const b = spawn(SINGLE, 1);

    const hold = (victim: Player, npcName: string, event: boolean) => {
        const npc = H.addNpc(npcName, victim.x + 1, victim.z);
        H.tick(1);
        if (event) H.setNpcVar(npc, 'npc_macro_event_target', victim.uid);
        H.setVar(victim, 'aggressive_npc', npc.uid);
        H.setVar(victim, 'lastcombat', World.currentTick);
        return npc;
    };

    const golem = hold(a, 'macro_golemguardian_1', true);
    check('a random event on A does not shut B out', gate(b, a).allowed, true);
    check('  and does not stop A attacking B either', gate(a, b).allowed, true);
    World.removeNpc(golem, -1);
    H.tick(1);

    const goblin = hold(a, 'goblin', false);
    check('an ordinary monster on A still shuts B out', [gate(b, a).allowed, gate(b, a).said],
        [false, 'Someone else is already fighting your opponent.']);
    check('  and still stops A starting on B', [gate(a, b).allowed, gate(a, b).said],
        [false, "I'm already under attack."]);
    World.removeNpc(goblin, -1);

    H.despawn(a, b);
    H.tick(2);
}


console.log(`PJTIMER  ${ok} ok, ${bad} failed`);
process.exit(0);
