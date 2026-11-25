// A GUARD WHO SEES YOU STEAL PUNISHES IT; HE DOES NOT PREVENT IT.
//
//   npx tsx tools/sim/stallguard.ts
//
// "cant steal from ardy baker stall" (tracker issue 14), which was accurate. ~stealing_check_for_guard
// returned a boolean and [proc,steal_from_stall] returned on it, so a guard within 5 tiles with
// line of sight stopped the theft before any loot was rolled. `ardougne_guard` has wanderrange=5
// and six guards spawn within 12 tiles of the bakery, so at the natural approach tile a guard was
// in range most of the time: 10 of 14 first attempts refused, every one with a guard in range. A
// stall that pays nothing 70% of the time is not trainable, and "cant steal from it" is a fair
// description of one.
//
// The decision was to PUNISH rather than BLOCK. The guard still shouts and still attacks - that is
// the consequence - and the steal goes through.
//
// A DELIBERATE DIVERGENCE FROM OLD SCHOOL, recorded here so nobody has to rediscover it: the
// wiki's bakery stall page says "Thieving will fail if the player is spotted by the stall's owner
// or nearby guard". What this sim pins is the behaviour that was chosen for this server, not a
// claim about what Jagex does.
//
// WHAT DID NOT CHANGE, and is checked here because it would be easy to lose: the OWNER still
// refuses, and he is the stop a player can do something about. Two tiles beat him, and both are
// checked below - his own square, and the tile across the stall from him, which is Old School's
// own advice ("thieve with the stall between your character and the NPC"). The stall really does
// block line of sight in this engine, which is what makes that second one work.
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

const TH = PlayerStatMap.get('THIEVING')!;
const HP = PlayerStatMap.get('HITPOINTS')!;
const STALL: [number, number] = [2655, 3311];
const BAKERY = 'bakers_stall_stealing';
const ROW = DbRowType.getId('stealing_bakery_stall');
const LOOT = ['cake', 'bread', 'chocolate_slice'];

// WEST IS THE BAKER'S OWN TILE. He spawns on 2654,3311, which is the safespot - the first draft of
// this sim stole from there all the way through and never once saw the owner refuse anything.
// NORTH is a tile beside the stall that he can see, so it is the one that measures him.
const UNDER_BAKER: [number, number] = [2654, 3311];
const SEEN_BY_BAKER: [number, number] = [2654, 3312];
const ACROSS_STALL: [number, number] = [2656, 3311];

const npcsNamed = (name: string): Npc[] => {
    const t = NpcType.getId(name);
    return [...World.npcs].filter((n): n is Npc => !!n && n.type === t);
};
const loot = (p: Player) => LOOT.reduce((a, o) => a + H.invCount(p, o), 0);

const GUARD_TYPES = ['ardougne_guard', 'knight_of_ardougne', 'knight_of_ardougne2', 'paladin', 'ardougne_paladin2', 'hero'];
const guards: Npc[] = GUARD_TYPES.flatMap(n => npcsNamed(n)).filter(n => Math.max(Math.abs(n.startX - STALL[0]), Math.abs(n.startZ - STALL[1])) <= 20);
const baker = npcsNamed('baker_merchant')[0];

/**
 * Park every guard out of npc_huntall's five tiles and out of sight, without deleting anybody -
 * a deleted npc cannot be put back for the rounds that need him. The market is six guards deep
 * and they wander five tiles, so left alone each attempt is a different experiment; that is
 * exactly what made the original report so hard to pin down.
 */
function park(...who: Npc[]) {
    for (const n of who) {
        n.teleport(STALL[0] + 40, STALL[1] + 40, n.level);
        n.clearInteraction();
    }
}

const thief = H.makePlayer('stallguard', UNDER_BAKER[0], UNDER_BAKER[1]);
H.tick(1);
// MAXED, AND NOT JUST AT THIEVING. The punishment is a real fight: an earlier draft gave the thief
// 99 Thieving and nothing else, an Ardougne guard killed him in round one, and every round after
// that was quietly measured from Lumbridge. A dead thief is no evidence about a stall.
H.maxOut(thief);
H.clearInv(thief);
H.tick(1);
thief.closeModal();
const MAXHP = thief.baseLevels[HP];

/** Tick until the stall is back, so a round never measures a stall that is still a `market`. */
function waitForStall(max = 40): boolean {
    for (let i = 0; i < max; i++) {
        if (H.locAt(0, STALL[0], STALL[1], BAKERY)) return true;
        H.tick(1);
    }
    return H.locAt(0, STALL[0], STALL[1], BAKERY);
}

type Result = { got: number; shouts: string[]; hit: boolean; mes: string[] };
/** One attempt from `from`, as a fresh player: full health, out of combat, stall restocked. */
function attempt(from: [number, number]): Result {
    // Being hit sets %lastcombat and the steal is refused for 10 ticks after that, so without
    // these resets a round would be measuring the previous round's fight.
    H.setVar(thief, 'lastcombat', 0);
    thief.levels[HP] = MAXHP;
    thief.clearInteraction();
    thief.teleport(from[0], from[1], 0);
    waitForStall();
    H.tick(1);
    H.clearInv(thief);
    H.clearLogs();
    H.opLoc(thief, STALL[0], STALL[1], BAKERY, 2);
    H.tick(12);
    return {
        got: loot(thief),
        shouts: H.says.filter(s => s.text.includes('hands off')).map(s => s.who),
        hit: H.hits.some(h => h.who === 'stallguard'),
        mes: H.mesgs.filter(m => m.who === 'stallguard').map(m => m.text)
    };
}

console.log('\n================ A GUARD IN RANGE WITH LINE OF SIGHT');
{
    park(...guards, baker);
    const g = guards.find(n => NpcType.get(n.type).debugname === 'ardougne_guard')!;
    g.teleport(UNDER_BAKER[0], UNDER_BAKER[1] + 1, 0);
    H.tick(1);
    // Range and sight asserted rather than assumed - the whole proc turns on them.
    check('the guard is within 5 tiles of the thief', Math.max(Math.abs(g.x - UNDER_BAKER[0]), Math.abs(g.z - UNDER_BAKER[1])) <= 5, true);
    check('...and has line of sight to him', isLineOfSight(0, g.x, g.z, UNDER_BAKER[0], UNDER_BAKER[1]), true);

    const xpBefore = thief.stats[TH];
    const a = attempt(UNDER_BAKER);
    console.log(`  got ${a.got}; shouts ${JSON.stringify(a.shouts)}; hit=${a.hit}`);
    // THE WHOLE POINT OF THE CHANGE. Before it, this was 0.
    check('the theft pays out with a guard watching', a.got, 1);
    check('...and still awards Thieving experience', thief.stats[TH] > xpBefore, true);
    check('the guard still shouts', a.shouts.includes('ardougne_guard'), true);
    // THE PUNISHMENT IS A FIGHT, not a message. Asked as "did he land a hit" rather than "is he
    // still targeting me", because the second depends on how many ticks have gone by.
    check('...and he attacks the thief for it', a.hit, true);
    check(
        '...and the player is told what he stole',
        a.mes.some(m => m.startsWith('You steal')),
        true
    );
    H.tick(20);
}

console.log('\n================ FOUR GUARDS DO NOT START FOUR FIGHTS');
{
    park(...guards, baker);
    H.tick(1);
    const gs = guards.filter(n => NpcType.get(n.type).debugname === 'ardougne_guard').slice(0, 4);
    const spots: [number, number][] = [
        [2654, 3312],
        [2653, 3311],
        [2654, 3310],
        [2653, 3312]
    ];
    gs.forEach((g, i) => g.teleport(spots[i][0], spots[i][1], 0));
    H.tick(1);
    const a = attempt(UNDER_BAKER);
    console.log(`  got ${a.got}; ${a.shouts.length} shout(s)`);
    check('still pays out', a.got, 1);
    // ~stealing_check_for_guard returns after the first guard it finds. That was true before the
    // change too - it is the one thing about the proc that did not change - and it is what keeps a
    // theft from aggroing the whole market at once.
    check('exactly one guard shouts', a.shouts.length, 1);
    check('...and the thief is attacked', a.hit, true);
    H.tick(20);
}

console.log('\n================ AND AN UNWATCHED THEFT IS STILL QUIET');
{
    park(...guards, baker);
    H.tick(2);
    const a = attempt(UNDER_BAKER);
    console.log(`  got ${a.got}; shouts ${JSON.stringify(a.shouts)}; hit=${a.hit}`);
    check('an unwatched theft pays out', a.got, 1);
    check('...with nobody shouting', a.shouts, []);
    check('...and nobody attacking', a.hit, false);
    H.tick(20);
}

console.log('\n================ THE OWNER STILL REFUSES, WHICH IS THE HALF THAT DID NOT CHANGE');
{
    park(...guards);
    baker.teleport(baker.startX, baker.startZ, baker.level);
    H.tick(1);
    check('the baker is back at his post', [baker.x, baker.z], [UNDER_BAKER[0], UNDER_BAKER[1]]);

    // Him in plain view of the thief: a tile beside the stall that is not his own square.
    thief.teleport(SEEN_BY_BAKER[0], SEEN_BY_BAKER[1], 0);
    H.tick(1);
    H.clearLogs();
    check('he sees a thief on the tile north of him', H.runProc(thief, '[proc,stealing_check_for_owner]', [ROW])[0], 1);

    const seen = attempt(SEEN_BY_BAKER);
    console.log(`  from ${SEEN_BY_BAKER}: got ${seen.got}; shouts ${JSON.stringify(seen.shouts)}`);
    check('and the owner seeing you still refuses the theft', seen.got, 0);
    check('...and it is him shouting, not a guard', seen.shouts, ['baker_merchant']);

    // TWO TILES STILL BEAT HIM, which is what makes the owner a stop worth having rather than
    // another unavoidable one.
    thief.teleport(UNDER_BAKER[0], UNDER_BAKER[1], 0);
    H.tick(1);
    H.clearLogs();
    check('standing under him is not seen', H.runProc(thief, '[proc,stealing_check_for_owner]', [ROW])[0], 0);
    const under = attempt(UNDER_BAKER);
    check('...and pays out', under.got, 1);

    // THE STALL IS A WALL. This is Old School's own advice working in this engine - the tile east
    // of the stall is two from the baker and he cannot see through his own stall to reach it.
    check('the stall blocks line of sight across itself', isLineOfSight(0, baker.x, baker.z, ACROSS_STALL[0], ACROSS_STALL[1]), false);
    thief.teleport(ACROSS_STALL[0], ACROSS_STALL[1], 0);
    H.tick(1);
    H.clearLogs();
    check('...so the far side of the stall is not seen either', H.runProc(thief, '[proc,stealing_check_for_owner]', [ROW])[0], 0);
    H.tick(20);
}

console.log("\n================ THE PLAYER'S ACTUAL COMPLAINT: ATTEMPTS AT THE BAKERY");
{
    // Guards left to wander exactly as they do in the live world. The baker is parked because he
    // is a separate, deliberate stop with two tiles of its own - measured just above.
    for (const n of guards) n.teleport(n.startX, n.startZ, n.level);
    park(baker);
    H.tick(5);
    const ROUNDS = 14;
    let paid = 0;
    let seen = 0;
    let seenAndPaid = 0;
    for (let i = 0; i < ROUNDS; i++) {
        const a = attempt(UNDER_BAKER);
        if (a.got > 0) paid++;
        else console.log(`    round ${i} paid nothing: mes=${JSON.stringify(a.mes)} shouts=${JSON.stringify(a.shouts)}`);
        if (a.shouts.length > 0) {
            seen++;
            if (a.got > 0) seenAndPaid++;
        }
        H.tick(20); // let any fight drop
    }
    console.log(`  ${ROUNDS} attempts beside the bakery: ${paid} paid out, ${seen} were seen by a guard`);
    // THE CLAIM, stated so it does not depend on how the guards happened to wander: being seen no
    // longer costs you the item. Before the change, every seen attempt paid nothing - that is what
    // 4 of 14 was.
    check('a guard still notices sometimes', seen > 0, true);
    check('and every attempt a guard noticed STILL paid out', seenAndPaid, seen);
    check('...as did every attempt', paid, ROUNDS);
}

console.log(`\n${R.ok} ok, ${R.bad} FAIL`);
process.exit(R.bad ? 1 : 0);
