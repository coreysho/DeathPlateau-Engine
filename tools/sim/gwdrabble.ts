// THE TWENTY GOD WARS SKIRMISH NPCS AND WHAT THEY DROP.
//
//   npx tsx tools/sim/gwdrabble.ts
//
// DeathPlateau-Bugs#107. All twenty carry category=gwd_army so [ai_timer,_gwd_army] can find them
// for the skirmish, and an npc has ONE category - so taking that one cost each of them the drop
// category it would otherwise have had. Nothing answered gwd_army, and a creature whose table
// never runs leaves NOTHING AT ALL: ~npc_death does a great many things on the way out but it does
// not drop the bones, because every table in the build calls obj_add(npc_coord,
// npc_param(death_drop), ...) for itself. The same shape as #32's four Death Plateau trolls.
//
// So the bone on the floor is the proof the table ran, and that is what most of this file asks.
//
// ELEVEN OF THE THIRTEEN KINDS already had a table elsewhere in the world - they are the same
// ogres, jogres, cyclopes, hobgoblins, goblins, hellhounds, werewolves, bloodvelds, pyrefiends,
// icefiends and imps - so the fix names each God Wars copy on its counterpart's table rather than
// writing a second one, and what this file proves for those eleven is that the copy REACHES it.
// The table's contents are its counterpart's business and are tested there.
//
// THREE OF THE OTHER FOUR REALLY DO DROP ALMOST NOTHING, which is worth being careful about: the
// wiki gives the Saradomin priest exactly bones and a hard clue, the knights the same plus
// Wilderness-only rows that cannot apply here, and the hellhound the same. A sim that demanded
// loot from everything would have been wrong about four of the twenty.
import * as H from './harness.js';
import { check, R, player } from './a1lib.js';
import { World } from './a1lib.js';
import * as A from './a1lib.js';
import ObjType from '#/cache/config/ObjType.js';
import JavaRandom from '#/util/JavaRandom.js';
import { NpcStat } from '#/engine/entity/NpcStat.js';

await H.boot();
H.loginOrder();

// AWAY FROM THE DUNGEON, and that is not a convenience: in the main chamber these die in the
// middle of the four gods' own war, a Saradomin knight kills the Bandos ork, there is no player
// hero and the table correctly pays nothing - which reads as a missing table about one kill in
// fifteen (gwdguards.ts). AND ON GROUND THE WORLD LEAVES EMPTY: 3210,3210 was the first choice and
// a jug respawns on it, which read as a drop. This tile is clean, and the check below holds it
// that way rather than filtering - a filter would also hide a real knife, and `knife` is on the
// ork's own table.
const ARENA: [number, number] = [3300, 3300];

const p: any = player('gwdrabble', ARENA[0], ARENA[1]);
// NO DROP-RATE BOOST. A new account is on a mode that boosts drops (droprate.rs2), and the boost
// rolls every row of the monster's own table a second time. With the dice pinned that is every
// row at once, which is how the ork table started failing the moment the generated bonus list
// gained its rows. 10x is the mode that carries no boost.
H.setVar(p, 'xp_rate', 10);

// THE DICE, PINNED ONLY ONCE THE NPC IS DEAD.
//
// Two earlier drafts got this wrong in opposite directions. Pinned through the fight, the accuracy
// roll is pinned too and any low value makes every swing miss - nothing died below about 100 and
// the sim read a working table as one that dropped nothing. Pinned AFTER A.fight returns, the pin
// arrives too late: the death queue has already run, and twenty-two of the ork's twenty-six
// branches came back with a different item each time, which is simply the table rolling for real.
//
// The seam is the npc's own hitpoints. While it has any, the dice are real and the fight works;
// the moment it is at zero every roll is the pinned one, and [ai_queue3] has not run yet.
const origND = JavaRandom.nextDouble.bind(JavaRandom);
let pinned: { npc: { levels: number[] }; v: number } | null = null;
(JavaRandom as unknown as { nextDouble: () => number }).nextDouble = () => (pinned && pinned.npc.levels[NpcStat.HITPOINTS] <= 0 ? pinned.v : origND());

/** Everything lying within two tiles of here, taken off the floor. */
function sweep(x: number, z: number): Map<string, number> {
    const got = new Map<string, number>();
    for (let dx = -2; dx <= 2; dx++)
        for (let dz = -2; dz <= 2; dz++) {
            const zone = World.gameMap.getZone(x + dx, z + dz, 0);
            for (const o of [...zone.getAllObjsUnsafe()]) {
                if (!o || o.x !== x + dx || o.z !== z + dz) continue;
                const n = ObjType.get(o.type).debugname ?? `obj_${o.type}`;
                got.set(n, (got.get(n) ?? 0) + o.count);
                World.removeObj(o, 0);
            }
        }
    return got;
}

/** Kill an npc `times` over and tally everything it leaves. `at` pins its drop roll to that value. */
function loot(name: string, times: number, at: number | null = null) {
    const got = new Map<string, number>();
    let killed = 0;
    for (let i = 0; i < times; i++) {
        H.maxOut(p);
        const npc = H.addNpcAt(name, ARENA[0], ARENA[1], 0);
        // A REAL KILL, and nothing shorter works: every table opens with npc_findhero and an npc
        // has no hero until the player has damaged it, so running the [ai_queue3] by hand drops
        // nothing at all. One hitpoint is what keeps a real kill affordable. (gwdguards.ts)
        npc.levels[NpcStat.HITPOINTS] = 1;
        pinned = at === null ? null : { npc: npc as unknown as { levels: number[] }, v: (at + 0.5) / 128 };
        H.tick(1);
        // 120 rather than 60: at 60 a large npc the player has to walk round occasionally
        // outlasted the budget and one ogre kill in ten did not land, which is a flaky sim
        // rather than a finding.
        if (A.fight(p, npc, 120)) killed++;
        H.tick(2);
        pinned = null;
        for (const [k, v] of sweep(npc.x, npc.z)) got.set(k, (got.get(k) ?? 0) + v);
        if (npc.isActive) World.removeNpc(npc, 0);
        H.tick(1);
    }
    return { got, killed };
}

const ambient = new Set<string>();
for (let t = 0; t < 40; t++) {
    for (const k of sweep(ARENA[0], ARENA[1]).keys()) ambient.add(k);
    H.tick(1);
}
check('the arena has nothing of its own lying on it', [...ambient].sort(), []);

// ------------------------------------------------------------------ the eleven with a counterpart
// Each one's REAL param=death_drop, read out of gwd_army.npc and gwd_rabble.npc rather than
// assumed - six of the eleven are not plain bones, and two have no 100% row to look for at all.
// The first draft guessed and reported six failures that were its own.
console.log('THE ELEVEN THAT SHARE A TABLE WITH THEIR ORDINARY SELVES');
// name, its death_drop, and - where there is no 100% row - a pinned roll and what it must produce.
const SHARED: [string, string | null, number | null, string | null][] = [
    ['gwd_ogre', 'big_bones', null, null],
    ['gwd_jogre', 'tbwt_jogre_bones', null, null],
    ['gwd_cyclops', 'big_bones', null, null],
    ['gwd_hobgoblin', 'bones', null, null],
    ['gwd_goblin', 'bones', null, null],
    ['gwd_hellhound', 'bones', null, null],
    ['gwd_werewolf_1', 'wolf_bones', null, null],
    ['gwd_werewolf_2', 'wolf_bones', null, null],
    // The bloodveld's death_drop is null ON PURPOSE - here and on its ordinary self, because
    // bloodvelds leave no bones - so a pinned roll stands in as the proof the table ran.
    ['gwd_bloodveld', null, 0, 'coins'],
    ['gwd_pyrefiend', 'ashes', null, null],
    // The icefiend's config says ashes and ITS TABLE USED NOT TO DROP THEM: icefiend.rs2 had no
    // obj_add(npc_param(death_drop)) line at all, which is the "a table that forgets that row is a
    // monster that leaves nothing" trap gwd_bodyguard_drops.rs2 records. That was true of the
    // ORDINARY icefiend too, so it was pinned around here like the bloodveld and filed as
    // DeathPlateau-Bugs#109 rather than papered over. It is fixed there, so the God Wars copy is
    // asserted like the pyrefiend now: a handful of ashes for every kill that happened.
    ['gwd_icefiend', 'ashes', null, null],
    ['gwd_imp', 'ashes', null, null]
];
for (const [name, bone, at, want] of SHARED) {
    check(`${name} has a table at all`, H.hasScript(`[ai_queue3,${name}]`), true);
    if (bone !== null) {
        const { got, killed } = loot(name, 10);
        // The claim is the RATIO - a bone for every kill that happened - and that at least nine of
        // ten happened at all, so a world that stopped these dying still fails here.
        check(`  ...and it runs: ${bone} on all ${killed} kills`, [killed >= 9, (got.get(bone) ?? 0) >= killed], [true, true]);
        const others = [...got.keys()].filter(k => k !== bone).sort();
        if (others.length) console.log(`       and in ten kills it also left: ${others.join(', ')}`);
    } else {
        const { got, killed } = loot(name, 3, at);
        check(`  ...and it runs: a pinned roll gives ${want}`, [killed, got.has(want!)], [3, true]);
    }
}

// ------------------------------------------------------------------ the ordinary icefiend
console.log('THE ORDINARY ICEFIEND, WHICH IS THE ONE A SLAYER PLAYER ACTUALLY MEETS');
// DeathPlateau-Bugs#109. The God Wars copy above is the same creature on the same table, but it
// is a corner of the map; slayer_icefiend_1 is the Ice Mountain icefiend that a Slayer task sends
// people to, and "twelve kills, zero ashes" was measured on that one. Its config says
// param=death_drop,ashes and the table had no line that dropped it.
{
    check('slayer_icefiend_1 has a table at all', H.hasScript('[ai_queue3,slayer_icefiend_1]'), true);
    const { got, killed } = loot('slayer_icefiend_1', 10);
    check(`  ...and it drops its ashes on all ${killed} kills`, [killed >= 9, (got.get('ashes') ?? 0) >= killed], [true, true]);
    // AND THE ROLLS STILL RUN: the new line goes before them and must not have replaced them.
    // A pinned roll 0 is the water rune branch (random(128) < 4).
    const rolled = loot('slayer_icefiend_1', 3, 0);
    check('  ...and its rune roll is still there beside it', [rolled.killed, rolled.got.has('waterrune')], [3, true]);
}

// ------------------------------------------------------------------ the ork, branch by branch
console.log('THE ORK, WHOSE TABLE IS NEW - BOTH ENDS OF ALL 25 BRANCHES, PINNED');
// BOTH ENDS OF EVERY BRANCH, not just the first value - which is the difference between a test
// and a test that looks like one. The first draft pinned only the opening value of each range, and
// a mutation that moved the bronze scimitar's edge from 26 down to 25 passed it: 25 was in nobody's
// list, so a slot quietly changing hands was invisible. Pinning both ends pins the boundary.
const ORK_BRANCHES: [number, number, string, number][] = [
    [0, 4, 'bronze_2h_sword', 1],
    [5, 9, 'bronze_battleaxe', 1],
    [10, 14, 'bronze_dart', 2],
    [15, 19, 'bronze_halberd', 1],
    [20, 25, 'bronze_scimitar', 1],
    [26, 30, 'bronze_warhammer', 1],
    [31, 35, 'iron_dart', 2],
    [36, 40, 'iron_longsword', 1],
    [41, 45, 'iron_mace', 1],
    [46, 50, 'iron_scimitar', 1],
    [51, 55, 'steel_axe', 1],
    [56, 60, 'steel_dagger', 1],
    [61, 65, 'steel_mace', 1],
    [66, 69, 'iron_spear', 1],
    [70, 74, 'bronze_med_helm', 1],
    [75, 79, 'bronze_full_helm', 1],
    [80, 84, 'bronze_platelegs', 1],
    [85, 89, 'iron_chainbody', 1],
    [90, 94, 'steel_med_helm', 1],
    [95, 102, 'coins', 10],
    [103, 107, 'coins', 5],
    [108, 112, 'coins', 8],
    [113, 117, 'coins', 12],
    [118, 122, 'coins', 23],
    [123, 127, 'knife', 1]
];
const orkWrong: string[] = [];
for (const [lo, hi, item, n] of ORK_BRANCHES) {
    for (const v of lo === hi ? [lo] : [lo, hi]) {
        const { got } = loot('gwd_ork_1', 1, v);
        const had = [...got]
            .filter(([k]) => k !== 'bones' && !k.startsWith('trail_clue_'))
            .map(([k, c]) => `${c} x ${k}`)
            .join(', ');
        if ((got.get(item) ?? 0) !== n) orkWrong.push(`${v} wanted ${n} x ${item}, got ${had || 'nothing'}`);
        if ((got.get('bones') ?? 0) < 1) orkWrong.push(`${v} left no bones`);
    }
}
check('both ends of all 25 ork branches hand over exactly what they say', orkWrong, []);
// 0 and 127 are the two ends of the whole table, so hitting both is the proof it fills all 128
// slots rather than leaving a gap at either end that silently drops nothing.
check(
    '  ...including 0 and 127, so the table fills all 128 slots',
    orkWrong.filter(w => w.startsWith('0 ') || w.startsWith('127 ')),
    []
);
for (const n of ['gwd_ork_2', 'gwd_ork_3', 'gwd_ork_4']) {
    check(`${n} is on the same table`, H.hasScript(`[ai_queue3,${n}]`), true);
    const r = loot(n, 1, 0);
    check('  ...and it runs', [r.got.get('bronze_2h_sword') ?? 0, r.got.get('bones') ?? 0], [1, 1]);
}

// ------------------------------------------------------------------ the gorak
console.log('THE GORAK, WHICH ROLLS THE SHARED GEM TABLE EVERY KILL');
// ~randomjewel is on the same 1/128 scale: 0-31 sapphire, 32-47 emerald, 48-55 ruby, 56-57 diamond.
const GEMS: [number, string][] = [
    [0, 'uncut_sapphire'],
    [32, 'uncut_emerald'],
    [48, 'uncut_ruby'],
    [56, 'uncut_diamond']
];
const gemWrong: string[] = [];
for (const [v, item] of GEMS) {
    const { got } = loot('gwd_gorak', 1, v);
    if (!got.has(item)) gemWrong.push(`${v} wanted ${item}, got ${[...got.keys()].join(', ') || 'nothing'}`);
    if ((got.get('big_bones') ?? 0) < 1) gemWrong.push(`${v} left no big bones`);
}
check('the gorak rolls the shared gem table, and big bones with it', gemWrong, []);
// AND THE HALF OF THAT TABLE THAT IS NOTHING. ~randomjewel returns no value at all above 64
// without a ring of wealth, and every caller in the build passes it straight to obj_add unguarded.
// The gorak rolls it on EVERY kill rather than inside a 1-in-something branch, so it meets that
// fall-through about half the time - more often than anything else in the game.
const fell = loot('gwd_gorak', 4, 100);
check('a gem roll that lands on nothing still leaves the big bones', [fell.killed, fell.got.get('big_bones') ?? 0], [4, 4]);
check(
    '  ...and nothing else',
    [...fell.got.keys()].filter(k => k !== 'big_bones'),
    []
);

// ------------------------------------------------------------------ bones and a clue, on purpose
console.log('THE FOUR WHOSE WHOLE TABLE IS A BONE AND A 1/128 CLUE');
// A 1/128 clue cannot be demonstrated by sampling: at 400 kills it is missing one run in
// twenty-three, which is a flaky check pretending to be a measurement.
for (const name of ['gwd_hellhound', 'gwd_saradomin_priest', 'gwd_saradomin_knight_1', 'gwd_saradomin_knight_2']) {
    const { got, killed } = loot(name, 2, 0);
    check(`${name}: bones, and the hard clue when the roll says so`, [killed, got.get('bones') ?? 0, [...got.keys()].filter(k => k.startsWith('trail_clue_hard')).length], [2, 2, 1]);
    check(
        '  ...and nothing else at all, which IS its table',
        [...got.keys()].filter(k => k !== 'bones' && !k.startsWith('trail_clue_')),
        []
    );
}

console.log(`\n${R.ok} ok, ${R.bad} FAIL`);
process.exit(R.bad > 0 ? 1 : 0);
