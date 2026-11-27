// A GUARD WHO SEES YOU STEAL REFUSES THE THEFT - AND YOU CAN STAND WHERE HE CANNOT SEE YOU.
//
//   npx tsx tools/sim/stallguard.ts
//
// "cant steal from ardy baker stall" (tracker issue 14), which was accurate. The refusal itself is
// right: Old School fails a theft the stall's owner or a nearby guard can see. What was wrong is
// that there was nowhere to stand. Old School's way round it is positional - "thieve with the
// stall between your character and the NPC" - and the stall really does block line of sight in
// this engine, so that mitigation is implementable here. Two things defeated it:
//
//   1. ~stealing_check_for_guard hunted FIVE tiles, which is this implementation's own invention;
//      Old School's rule is line of sight and the word "nearby".
//   2. ardougne_guard roamed 5 tiles and knight_of_ardougne roamed FIFTEEN, so a guard could be
//      almost anywhere in the market.
//
// MEASURED BEFORE ANYTHING WAS CHANGED, over every tile a guard could wander to rather than over a
// sample of ticks: at radius 5 the bakery had ZERO safe approach tiles of 17, and still zero with
// every guard frozen on its spawn. So taming the roam alone could not have worked - which is worth
// writing down, because it was the first thing tried. Both levers at 2 give every guarded stall
// safespots: bakery 5 of 17, silk 6, fur 11, silver 3, spice 9, gem 4.
//
// AND A SAFE TILE IS ONLY SAFE IF YOU CAN STEAL FROM IT. Three of the bakery's five geometrically
// safe tiles are two tiles out, and opLoc walks the player off them to reach the stall - which
// would have made this sim pass while a player gained nothing. The two the player actually keeps
// their feet on are the ones used below.
import * as H from './harness.js';
import World from '#/engine/World.js';
import Npc from '#/engine/entity/Npc.js';
import Player from '#/engine/entity/Player.js';
import NpcType from '#/cache/config/NpcType.js';
import DbRowType from '#/cache/config/DbRowType.js';
import { isLineOfSight } from '#/engine/GameMap.js';
import { PlayerStatMap } from '#/engine/entity/PlayerStat.js';
import { check, R } from './a1lib.js';

await H.boot();

const HP = PlayerStatMap.get('HITPOINTS')!;
const STALL: [number, number] = [2655, 3311];
const BAKERY = 'bakers_stall_stealing';
const ROW = DbRowType.getId('stealing_bakery_stall');
const LOOT = ['cake', 'bread', 'chocolate_slice'];

/** Safe AND stealable-from: measured, not assumed. See the header. */
const SAFESPOT: [number, number] = [2654, 3312];
const SAFESPOT2: [number, number] = [2655, 3313];
/** In the open, north of the stall - no cover from a guard standing beside it. */
const EXPOSED: [number, number] = [2654, 3310];

const npcsNamed = (name: string): Npc[] => {
    const t = NpcType.getId(name);
    return t < 0 ? [] : [...World.npcs].filter((n): n is Npc => !!n && n.type === t);
};
const loot = (p: Player) => LOOT.reduce((a, o) => a + H.invCount(p, o), 0);

const GUARD_TYPES = ['ardougne_guard', 'knight_of_ardougne', 'hero'];
const guards: Npc[] = GUARD_TYPES.flatMap(n => npcsNamed(n));
const baker = npcsNamed('baker_merchant')[0];

const thief = H.makePlayer('stallguard', SAFESPOT[0], SAFESPOT[1]);
H.tick(1);
// MAXED, AND NOT JUST AT THIEVING: a refusal comes with a fight, and a thief who dies is measured
// from Lumbridge for every round after that.
H.maxOut(thief);
H.clearInv(thief);
H.tick(1);
thief.closeModal();
const MAXHP = thief.baseLevels[HP];

function park(...who: Npc[]) {
    for (const n of who) {
        n.teleport(STALL[0] + 40, STALL[1] + 40, n.level);
        n.clearInteraction();
    }
}
function home(...who: Npc[]) {
    // clearInteraction AS WELL AS THE TELEPORT. Sending a guard back to his spawn while he is
    // still fighting the thief leaves him hitting them from across the market, and a hit sets
    // %lastcombat - which [label,attempt_steal_from_stall] refuses a steal for. One round of the
    // safespot section paid nothing for exactly that: "You can't steal from the market stall
    // during combat!", inherited from the guard the EXPOSED section deliberately provoked. The
    // same trap as a round measuring the previous round's fight, one section further out.
    for (const n of who) {
        n.teleport(n.startX, n.startZ, n.level);
        n.clearInteraction();
    }
}

type Result = { got: number; shouts: string[]; stayed: boolean; mes: string[]; locThere: boolean };
/** One attempt from `from`, as a fresh player. */
function attempt(from: [number, number]): Result {
    H.setVar(thief, 'lastcombat', 0);
    thief.levels[HP] = MAXHP;
    thief.clearInteraction();
    thief.teleport(from[0], from[1], 0);
    for (let i = 0; i < 40 && !H.locAt(0, STALL[0], STALL[1], BAKERY); i++) H.tick(1);
    H.tick(1);
    H.clearInv(thief);
    H.clearLogs();
    H.opLoc(thief, STALL[0], STALL[1], BAKERY, 2);
    H.tick(12);
    return {
        got: loot(thief),
        shouts: H.says.filter(s => s.text.includes('hands off')).map(s => s.who),
        stayed: thief.x === from[0] && thief.z === from[1],
        mes: H.mesgs.filter(m => m.who === 'stallguard').map(m => m.text.slice(0, 60)),
        locThere: H.locAt(0, STALL[0], STALL[1], BAKERY)
    };
}

console.log('\n================ THE CONFIG THE SAFESPOT RESTS ON');
{
    // PINNED, because the whole fix is two numbers and one of them lives in the npc config. The
    // other two guard types the stall rows name have NO spawns at all - knight_of_ardougne2 and
    // ardougne_paladin2 are both zero - so their roam is irrelevant and is deliberately not set.
    for (const n of GUARD_TYPES) {
        check(`${n.padEnd(20)} roams 2 tiles`, NpcType.get(NpcType.getId(n)).wanderrange, 2);
    }
    check('paladin is already 2, and has no Ardougne spawn', NpcType.get(NpcType.getId('paladin')).wanderrange, 2);
    for (const n of ['knight_of_ardougne2', 'ardougne_paladin2']) {
        check(`${n} has no spawns, so its roam does not matter`, npcsNamed(n).length, 0);
    }
}

console.log('\n================ A GUARD WHO SEES YOU STILL REFUSES THE THEFT');
{
    park(...guards, baker);
    const g = npcsNamed('ardougne_guard')[0];
    // Beside the exposed tile, so there is no question of range or sight.
    g.teleport(EXPOSED[0], EXPOSED[1] - 1, 0);
    H.tick(1);
    check('the guard is within 2 tiles', Math.max(Math.abs(g.x - EXPOSED[0]), Math.abs(g.z - EXPOSED[1])) <= 2, true);
    check('...and has line of sight', isLineOfSight(0, g.x, g.z, EXPOSED[0], EXPOSED[1]), true);

    const a = attempt(EXPOSED);
    console.log(`  in the open: got ${a.got}; shouts ${JSON.stringify(a.shouts)}`);
    // THE HALF THAT MUST NOT CHANGE. Old School fails a theft that is seen, and so does this.
    check('a theft he can see pays nothing', a.got, 0);
    check('...and he says so', a.shouts.includes('ardougne_guard'), true);
    H.tick(20);
}

console.log('\n================ AND THE SAFESPOT WORKS, WITH THE GUARDS LEFT TO WANDER');
{
    // THE GUARDS ARE NOT PARKED HERE. They start on their spawns and roam as they do live, which
    // is the whole claim: the tile is safe from every tile they can reach, not just from where
    // they happen to be standing.
    home(...guards);
    park(baker);
    H.tick(5);
    const ROUNDS = 14;
    let paid = 0;
    let seen = 0;
    let stayed = 0;
    for (let i = 0; i < ROUNDS; i++) {
        const a = attempt(SAFESPOT);
        if (a.got > 0) paid++;
        else console.log(`    round ${i} paid nothing: locThere=${a.locThere} mes=${JSON.stringify(a.mes)}`);
        if (a.shouts.length > 0) seen++;
        if (a.stayed) stayed++;
        H.tick(16);
    }
    console.log(`  ${ROUNDS} attempts from ${SAFESPOT}: ${paid} paid, ${seen} seen, ${stayed} stayed put`);
    // BEFORE THIS CHANGE: 4 of 14 paid, every failure with a guard in range.
    check('every attempt from the safespot pays out', paid, ROUNDS);
    check('...and no guard ever sees it', seen, 0);
    // AND THE PLAYER KEEPS THEIR FEET ON IT. A tile opLoc walks you off is not a safespot, and
    // three of the bakery's geometrically safe tiles are exactly that.
    check('...and the player never has to leave the tile', stayed, ROUNDS);
}

console.log('\n================ THE SECOND SAFESPOT, SO IT IS NOT ONE LUCKY TILE');
{
    home(...guards);
    park(baker);
    H.tick(5);
    let paid = 0;
    let seen = 0;
    for (let i = 0; i < 6; i++) {
        const a = attempt(SAFESPOT2);
        if (a.got > 0) paid++;
        if (a.shouts.length > 0) seen++;
        H.tick(16);
    }
    console.log(`  6 attempts from ${SAFESPOT2}: ${paid} paid, ${seen} seen`);
    check('the other safespot pays out too', paid, 6);
    check('...and is not seen either', seen, 0);
}

console.log('\n================ THE OWNER IS UNCHANGED, AND STILL HAS HIS OWN TILE');
{
    park(...guards);
    home(baker);
    H.tick(1);
    // He is a separate stop from the guards and this change does not touch him: he still refuses
    // from a tile he can see, and still cannot see inside his own square.
    thief.teleport(baker.startX, baker.startZ + 1, 0);
    H.tick(1);
    H.clearLogs();
    check('the baker still sees a thief beside him', H.runProc(thief, '[proc,stealing_check_for_owner]', [ROW])[0], 1);
    thief.teleport(baker.startX, baker.startZ, 0);
    H.tick(1);
    H.clearLogs();
    check('...and still cannot see one standing under him', H.runProc(thief, '[proc,stealing_check_for_owner]', [ROW])[0], 0);
}

console.log(`\n${R.ok} ok, ${R.bad} FAIL`);
process.exit(R.bad ? 1 : 0);
