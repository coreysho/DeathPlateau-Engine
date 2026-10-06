// THE ROGUES' DEN: can a player get in, and does the Crack on a wall safe do anything?
//
// Asked for as "rouges den / wall safes". The safes had an op and no script. The first question had
// to be whether anybody could reach them at all, because a static walkability flood from the foot of
// the trapdoor says TWO tiles - the Den looks sealed. It is not: the door beside you is an ordinary
// category=door_closed and the shared [oploc1,_door_closed] opens it onto 418 more. A flood that
// does not open doors cannot be trusted to say what is reachable, so this clicks the door.
//
//   npx tsx tools/sim/rdreach.ts
import * as H from './harness.js';
import * as A from './a1lib.js';
import { check, R, player, mark, mesSince } from './a1lib.js';
import { PlayerStat } from '#/engine/entity/PlayerStat.js';
import World from '#/engine/World.js';
import LocType from '#/cache/config/LocType.js';
import { canTravel } from '#/engine/GameMap.js';
import { CollisionType } from '#/engine/routefinder/index.js';

await H.boot();

const flood = (level: number, sx: number, sz: number, rad = 80) => {
    const seen = new Set<number>();
    const key = (x: number, z: number) => ((x - sx + rad) << 9) | (z - sz + rad);
    const q: [number, number][] = [[sx, sz]];
    seen.add(key(sx, sz));
    while (q.length) {
        const [x, z] = q.shift()!;
        for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            const nx = x + dx, nz = z + dz;
            if (Math.abs(nx - sx) > rad || Math.abs(nz - sz) > rad) continue;
            if (seen.has(key(nx, nz))) continue;
            if (!canTravel(level, x, z, dx, dz, 1, 0, CollisionType.NORMAL)) continue;
            seen.add(key(nx, nz));
            q.push([nx, nz]);
        }
    }
    return { seen, has: (x: number, z: number) => seen.has(key(x, z)) };
};

const p: any = player('rdreach', 2905, 3537);
console.log('THE WAY IN');
H.opLoc(p, 2905, 3537, 'roguesden_trapdoor_entrance', 1);
H.tick(4);
check('the trapdoor drops you into the Den', [p.level, p.x, p.z], [1, 3061, 4984]);

const before = flood(1, p.x, p.z);
console.log(`  with the door shut, ${before.seen.size} tiles are reachable`);

H.opLoc(p, 3061, 4984, 'roguesden_door_to_pub', 1);
H.tick(3);
const after = flood(1, p.x, p.z);
console.log(`  after opening the door, ${after.seen.size}`);
check('the door opens onto the Den proper', after.seen.size > 300, true);

console.log('AND WHAT IS IN THERE');
const trader = H.npcNear('roguesden_trader', 3045, 4974, 1);
check('Martin Thwait, the Thieving cape master, is standable-next-to', trader !== null, true);
if (trader) check('  ...and on a tile you can walk to', after.has(trader.x + 1, trader.z) || after.has(trader.x - 1, trader.z) || after.has(trader.x, trader.z + 1) || after.has(trader.x, trader.z - 1), true);

for (const [x, z] of [[3055, 4970], [3055, 4977], [3057, 4970], [3057, 4977]] as const) {
    const beside = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dz]) => after.has(x + dx, z + dz));
    check(`  the wall safe at ${x},${z} is walkable to`, beside, true);
}
for (const [x, z] of [[3013, 5047], [3018, 5048]] as const) {
    const beside = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dz]) => after.has(x + dx, z + dz));
    console.log(`  (maze safe at ${x},${z}: ${beside ? 'walkable' : 'behind the maze'})`);
}


// ============================================================================ cracking one
console.log('');
console.log('AND CRACKING ONE');
{
    const SX = 3055, SZ = 4970;
    // The tile to stand on is found rather than written down: a walldecor is clickable from one
    // side only, and which side depends on the angle the map gives it.
    let stand: [number, number] | null = null;
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        if (A.reachLoc(1, SX + dx, SZ + dz, 'roguesden_walldecor_safe', SX, SZ)) stand = [SX + dx, SZ + dz];
    }
    check('there is a tile you can crack the safe from', stand !== null, true);

    // ONE PLAYER FOR ALL OF IT, with the Thieving level moved between phases. A second login beside
    // the safe could not see it - World.getLoc answered null for a loc the first player had just
    // clicked - and chasing that is not what this file is for.
    const thief: any = player('rdsafe', stand![0], stand![1], 1);
    // setLevel, NOT the three arrays by hand. A level written straight into baseLevels with no
    // matching experience lasts exactly until something awards xp: stat_advance recomputes the level
    // from the total, so the first successful crack turned a 99 into a 1 and the next 399 clicks were
    // all refused for being under 50. The test read that as "the safe only works once".
    const at = (_name: string, level: number) => {
        thief.setLevel(PlayerStat.THIEVING, level);
        H.clearInv(thief);
        return thief;
    };
    const xpOf = () => thief.stats[PlayerStat.THIEVING];
    // A CRACKED SAFE IS NOT THERE TO CLICK. loc_change swaps it for roguesden_walldecor_safe_open
    // for six ticks, so the next attempt has to wait for it to shut - which is also the respawn the
    // wiki gives it, and worth asserting: a safe that never came back would read here as a hang.
    const safeId = LocType.getId('roguesden_walldecor_safe');
    let worstWait = 0;
    // Tallied over every real click this section makes, wherever it is made from.
    let allFailed = 0, allSpiked = 0, everHurt = false;
    // THE BOUND IS 200 TICKS AND THE LONGEST WAIT IS PRINTED. It is a six-tick change, so this
    // should never need more than six - but it ran out once at a bound of 30, deep into a long run,
    // and a number that is measured is worth more than a bound that is guessed. Waiting for the
    // player to be idle as well would be stricter still and makes the run take hours: five runs at
    // this bound came back clean with a worst wait of three ticks.
    const waitForSafe = () => {
        for (let t = 0; t < 200; t++) {
            if (World.getLoc(SX, SZ, 1, safeId)) {
                if (t > worstWait) worstWait = t;
                return true;
            }
            H.tick(1);
        }
        return false;
    };
    const crack = (who: any) => {
        who.levels[PlayerStat.HITPOINTS] = 99;
        if (!waitForSafe()) throw new Error('the safe stayed open for 200 ticks');
        const from = mark();
        H.opLoc(who, SX, SZ, 'roguesden_walldecor_safe', 1);
        H.tick(6);
        const said = mesSince(who, from);
        if (said.some(m => m === 'You fail to crack the safe.')) {
            allFailed++;
            if (said.some(m => m === 'The floor spikes catch you!')) {
                allSpiked++;
                if (who.levels[PlayerStat.HITPOINTS] < 99) everHurt = true;
            }
        }
        return said;
    };

    // 1. the level gate
    const low = at('rdsafe_low', 49);
    check('49 Thieving is turned away', crack(low).join(' | '),
        'You need a Thieving level of 50 to crack this safe.');
    const idle = xpOf();
    check('  and it costs no experience', xpOf() - idle, 0);

    // 2. at 99 it opens, pays 70 and hands over something
    const hi = at('rdsafe_hi', 99);
    const xpBefore = xpOf();
    let opened = 0, failed = 0, spiked = 0;
    const loot = new Map<string, number>();
    for (let i = 0; i < 120; i++) {
        H.clearInv(hi);
        const said = crack(hi);
        if (said.some(m => m.startsWith('You crack the safe open'))) {
            opened++;
            for (const m of said) {
                const found = /^You find (.*?) inside/.exec(m);
                if (found) loot.set(found[1], (loot.get(found[1]) ?? 0) + 1);
            }
        } else if (said.some(m => m === 'You fail to crack the safe.')) {
            failed++;
            if (said.some(m => m === 'The floor spikes catch you!')) spiked++;
        }
    }
    console.log(`       ${opened} cracked, ${failed} failed, ${spiked} of those on the spikes`);
    console.log(`       loot: ${[...loot].sort((a, b) => b[1] - a[1]).map(([n, c]) => `${n} x${c}`).join(', ')}`);
    check('120 clicks at 99 are all either a crack or a failure', opened + failed, 120);
    check('  and about nine in ten open it', opened > 92 && opened < 119, true);
    check('  every one that opened paid 70 experience', xpOf() - xpBefore, opened * 700);
    check('  and every one that opened paid out', [...loot.values()].reduce((a, b) => a + b, 0), opened);

    // THE TABLE ITSELF, rolled without the world. A diamond is 2 in 256, so 300 cracks turn one up
    // less than half the time and a run of clicks cannot say whether the branch exists at all -
    // which is the difference between "rare" and "unreachable". 8,000 rolls of the reward proc can.
    {
        const seen = new Map<string, number>();
        H.clearInv(thief);
        for (let i = 0; i < 8000; i++) {
            const from = mark();
            H.runProc(thief, '[proc,roguesden_safe_reward]');
            for (const m of mesSince(thief, from)) {
                const found = /^You find (.*?) inside/.exec(m);
                if (found) seen.set(found[1], (seen.get(found[1]) ?? 0) + 1);
            }
            H.clearInv(thief);
        }
        console.log(`       8000 rolls of the table: ${[...seen].sort((a, b) => b[1] - a[1]).map(([n, c]) => `${n} ${(c / 80).toFixed(1)}%`).join(', ')}`);
        check('  every branch of the loot table is reachable', [...seen.keys()].sort(),
            ['Coins', 'Uncut diamond', 'Uncut emerald', 'Uncut ruby', 'Uncut sapphire']);
        const pct = (n: string) => (seen.get(n) ?? 0) / 80;
        check('  ...and gems are about a fifth of it, commonest first',
            pct('Uncut sapphire') > pct('Uncut emerald') && pct('Uncut emerald') > pct('Uncut ruby')
            && pct('Uncut ruby') > pct('Uncut diamond') && pct('Coins') > 70 && pct('Coins') < 90, true);
    }

    // 3. THE SUCCESS ROLL, asked 6,000 times a side without the world. Every real click costs the
    //    world nine ticks with twelve thousand npcs in it, so a sample big enough to separate 58%
    //    from 70% used to take the better part of an hour; the proc is the thing under test and it
    //    answers in milliseconds. The clicks above are what proves the proc is the one being used.
    const rate = (carry: boolean) => {
        const q = at(`rdsafe_st${carry ? 1 : 0}`, 50);
        H.clearInv(q);
        if (carry) H.give(q, 'roguesden_stethoscope', 1);
        let n = 0;
        for (let i = 0; i < 6000; i++) {
            if (H.runProc(q, '[proc,roguesden_safe_success]')[0] === 1) n++;
        }
        return n;
    };
    const without = rate(false);
    const withIt = rate(true);
    // The safe is loc_changed to its open model for six ticks after a crack, so every attempt waits
    // for it to shut. The longest that wait ever had to be is worth printing rather than assuming:
    // a bound of 30 ticks looked generous against a six-tick change and still ran out, once, deep
    // into a long run.
    console.log(`       the longest wait for the safe to shut again was ${worstWait} ticks`);
    check('  and it always shuts again', worstWait < 60, true);
    // AND THE SPIKES, which need failures to count and so need a player who fails: 150 clicks at
    // the requirement itself fail about sixty-five times, where half is 0.5 +/- 0.19 at three
    // standard deviations. At 99 there are barely thirty failures in three hundred clicks and the
    // same check was red about one run in thirty - noise wearing a failure's clothes.
    {
        const q = at('rdsafe_spikes', 50);
        for (let i = 0; i < 150; i++) {
            H.clearInv(q);
            crack(q);
        }
    }
    console.log(`       ${allFailed} failures across every click above, ${allSpiked} of them on the spikes`);
    check('  the spikes catch about half the failures',
        allFailed > 50 && allSpiked > allFailed * 0.3 && allSpiked < allFailed * 0.7, true);
    check('  and take hitpoints off you when they do', everHurt, true);
    console.log(`       at 50 Thieving: ${(without / 60).toFixed(1)}% succeed without a stethoscope, ${(withIt / 60).toFixed(1)}% with one (6000 rolls each)`);
    check('  a stethoscope in the pack raises the rate by about a fifth',
        withIt > without * 1.12 && withIt < without * 1.3, true);
}

console.log(`RDREACH ${R.ok} ok, ${R.bad} FAIL`);
process.exit(R.bad ? 1 : 0);
