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

    clickAttack(a, b);
    H.tick(2);
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
    clickAttack(a, b);
    H.tick(1);
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
    check('  and gets in the moment it lapses', gate(c, b).allowed, true);
    H.despawn(a, b, c);
    H.tick(2);
}

console.log('MULTIWAY: NO RESTRICTION');
{
    const a = spawn(MULTI, 0);
    const b = spawn(MULTI, 1);
    const c = spawn(MULTI, 3);
    clickAttack(a, b);
    H.tick(2);
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
    clickAttack(a, b);
    H.tick(2);
    // A teleports out of the wilderness entirely
    breakOff(a, b);
    a.teleport(3222, 3218, 0);
    H.tick(2);
    const onB = gate(c, b);
    check('A teleports away: B is still held for the rest of the timer', [onB.allowed, onB.said], [false, 'Someone else is already fighting your opponent.']);
    const bOnC = gate(b, c);
    check('  and B may not start on C either', [bOnC.allowed, bOnC.said], [false, "I'm already under attack."]);
    H.tick(PJ);
    check('  once the 20 ticks are up, both are free', [gate(c, b).allowed, gate(b, c).allowed], [true, true]);
    H.despawn(a, b, c);
    H.tick(2);
}

console.log('ONE OF THEM LOGS OUT');
{
    const a = spawn(SINGLE, 0);
    const b = spawn(SINGLE, 1);
    const c = spawn(SINGLE, 3);
    clickAttack(a, b);
    H.tick(2);
    check('B is locked to A', varp(b, 'pvp_opponent') === uidOf(a), true);
    // the real logout path: request it and let World.processLogouts run the [logout,_] trigger
    breakOff(a, b);
    const struck = varp(b, 'lastcombat_pvp');
    let gone = -1;
    for (let t = 0; t < 30 && gone === -1; t++) {
        (a as any).requestLogout = true; // the click, held down until the engine lets it through
        H.tick(1);
        if (a.slot === -1) gone = World.currentTick - struck;
    }
    // ~.combat_preventlogout is p_preventlogout(..., 16), counted from the tick the hit landed; the
    // logout itself goes through on the tick after that runs out
    check('A is held in the world by the 16-tick logout delay, then goes', [gone !== -1, gone], [true, 17]);
    check('  and B is not locked to a ghost any more', varp(b, 'pvp_opponent'), -1);
    check('  so B may start on C', gate(b, c).allowed, true);
    const onB = gate(c, b);
    check('  but C still may not jump B - their own 12 seconds are their own', [onB.allowed, onB.said], [false, 'Someone else is already fighting your opponent.']);
    H.tick(PJ);
    check('  until they lapse', gate(c, b).allowed, true);
    H.despawn(b, c);
    H.tick(2);
}

console.log('A KILL FREES THE KILLER');
{
    const a = spawn(SINGLE, 0);
    const b = spawn(SINGLE, 1);
    const c = spawn(SINGLE, 3);
    clickAttack(a, b);
    H.tick(2);
    check('A is locked to B', varp(a, 'pvp_opponent') === uidOf(b), true);
    // kill B outright
    (b as any).levels[3] = 1;
    for (let t = 0; t < 30 && varp(a, 'pvp_opponent') !== -1; t++) {
        H.attack(a, b);
        H.tick(1);
    }
    check('B dies: the killer is no longer locked to them', varp(a, 'pvp_opponent'), -1);
    check('  so A may turn on C right away', gate(a, c).allowed, true);
    check('  while C still cannot touch A - the killer keeps their 12 seconds', gate(c, a).allowed, false);
    H.tick(PJ);
    check('  until it lapses', gate(c, a).allowed, true);
    H.despawn(a, b, c);
    H.tick(2);
}

console.log(`PJTIMER  ${ok} ok, ${bad} failed`);
process.exit(0);
