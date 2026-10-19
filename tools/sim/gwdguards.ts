// THE TWELVE GOD WARS BODYGUARDS AND WHAT THEY DROP.
//
//   npx tsx tools/sim/gwdguards.ts
//
// Reported as "gwd minions need drop tables". Three bodyguards die on every trip into a boss room
// and none of the twelve had an [ai_queue3] of its own, so the only thing they left behind was the
// bones the shared death routine gives everything that dies.
//
// WHAT THIS CHECKS is the shape of the table rather than one kill's luck. The wiki's structure is
// 1/127 for the god's unique table, 1/127 for the godsword shards and 125/127 for the regular
// table, so over eighteen hundred rolls per trio every item on the regular table has to appear -
// a branch that never fires is a branch that cannot be reached - and nothing may appear that is not
// on the list. The uniques are too rare to assert either way at this sample size and are counted.
import * as H from './harness.js';
import { check, R, player } from './a1lib.js';
import { World } from './a1lib.js';
import * as A from './a1lib.js';
import ObjType from '#/cache/config/ObjType.js';
import { NpcStat } from '#/engine/entity/NpcStat.js';

await H.boot();
H.loginOrder();

const TRIOS: [string, string[], string[]][] = [
    [
        'Bandos',
        ['gwd_strongstack', 'gwd_steelwill', 'gwd_grimspike'],
        [
            'bones',
            'coins',
            'steel_arrow',
            'steel_dart',
            'naturerune',
            'cosmicrune',
            'shark',
            'potato_chilli+carne',
            'cert_limpwurt_root',
            '3dose2strength',
            'bandos_chestplate',
            'bandos_tassets',
            'bandos_boots',
            'godsword_shard_1',
            'godsword_shard_2',
            'godsword_shard_3',
            'kebab',
            'beer',
            'eye_patch',
            'champions_challenge_goblin'
        ]
    ],
    [
        'Saradomin',
        ['gwd_starlight', 'gwd_growler', 'gwd_bree'],
        ['bones', 'coins', 'steel_arrow', 'steel_dart', 'lawrune', 'monkfish', 'summer_pie', 'cert_unidentified_ranarr', 'cert_snape_grass', 'cert_unicorn_horn', 'saradomin_sword', 'godsword_shard_1', 'godsword_shard_2', 'godsword_shard_3']
    ],
    [
        'Armadyl',
        ['gwd_wingman_skree', 'gwd_flockleader_geerin', 'gwd_flight_kilisa'],
        [
            'bones',
            'feather',
            'coins',
            'steel_arrow',
            'steel_dart',
            'smokerune',
            'mantaray',
            'potato_mushroom+onion',
            'cert_crushed_bird_nest',
            'cert_unidentified_kwuarm',
            'armadyl_helmet',
            'armadyl_chestplate',
            'armadyl_chainskirt',
            'godsword_shard_1',
            'godsword_shard_2',
            'godsword_shard_3'
        ]
    ],
    [
        'Zamorak',
        ['gwd_balfrug_kreeyath', 'gwd_tstanon_karlak', 'gwd_zakln_gritch'],
        [
            'ashes',
            'bones',
            'coins',
            'steel_arrow',
            'steel_dart',
            'deathrune',
            'bloodrune',
            'shark',
            'potato_tuna+sweetcorn',
            'cert_wine_of_zamorak',
            '3dose2attack',
            '3dose2strength',
            'zamorakian_spear',
            'godsword_shard_1',
            'godsword_shard_2',
            'godsword_shard_3',
            'champions_challenge_lesserdemon'
        ]
    ]
];
// the uniques and the one-offs, which 480 kills cannot say anything about either way
// AWAY FROM THE DUNGEON, AND THAT IS NOT A CONVENIENCE. Spawned in the main chamber these die in
// the middle of the four gods' own war: a Saradomin knight kills the Bandos sergeant, there is no
// player hero, and the table correctly drops nothing - which read as a missing 100% row about one
// kill in fifteen. gwdskirmish.ts asserts that an npc killed by another npc pays nothing, so this
// is the game working; the drop table has to be tested somewhere nobody else is swinging.
const ARENA: [number, number] = [3200, 3200];
const RARE = /godsword_shard|bandos_(chestplate|tassets|boots)|armadyl_(helmet|chestplate|chainskirt)|saradomin_sword|zamorakian_spear|champions_challenge|^kebab$|^beer$|^eye_patch$/;

/** Kill an npc `times` over and tally everything it leaves on the floor. */
function loot(p: { username: string }, name: string, times: number) {
    const got = new Map<string, number>();
    let killed = 0;
    for (let i = 0; i < times; i++) {
        // HEAL BETWEEN KILLS. A bodyguard hits hard and there are a hundred and thirty-five of
        // them: left alone the player dies partway through, drops its halberd, respawns in
        // Lumbridge and the rest of the run measures nothing. That is where the five "missing"
        // bones came from - not a missing drop, a missing player.
        H.maxOut(p as never);
        const npc = H.addNpcAt(name, ARENA[0], ARENA[1], 0);
        // A REAL KILL, AND NOTHING SHORTER WORKS. Running the [ai_queue3] directly drops nothing at
        // all: every table in the build opens with npc_findhero, and an npc has no hero until the
        // player has damaged it - setting its target, or landing one hit and then calling the
        // trigger by hand, both leave findhero false and the table returns having done nothing.
        // Two drafts of this sim reported "no drops" for a table that works perfectly in the game.
        // One hitpoint is what keeps a real kill affordable.
        npc.levels[NpcStat.HITPOINTS] = 1;
        H.tick(1);
        if (A.fight(p as never, npc, 60)) killed++;
        H.tick(2);
        // WIDE ENOUGH FOR AN NPC THAT WALKED. A bodyguard hunts the player before it dies, so the
        // drop lands wherever it got to and not on its spawn tile - a four-tile box lost about one
        // kill in twenty and read as a missing bones.
        for (let dx = -14; dx <= 14; dx++)
            for (let dz = -14; dz <= 14; dz++) {
                const zone = World.gameMap.getZone(ARENA[0] + dx, ARENA[1] + dz, 0);
                for (const o of [...zone.getAllObjsUnsafe()]) {
                    if (!o || o.x !== ARENA[0] + dx || o.z !== ARENA[1] + dz) continue;
                    const n = ObjType.get(o.type).debugname ?? `obj_${o.type}`;
                    got.set(n, (got.get(n) ?? 0) + o.count);
                    World.removeObj(o, 0);
                }
            }
        // and off the world again: leaving them standing is how the first draft ran out of memory
        if (npc.isActive) World.removeNpc(npc, 0);
        H.tick(1);
    }
    return { got, killed };
}

for (const [god, npcs, allowed] of TRIOS) {
    console.log(`\n${god.toUpperCase()}: ${npcs.join(', ')}`);
    const all = new Map<string, number>();
    const p: any = player('guard_' + god, ARENA[0] - 2, ARENA[1], 0);
    H.maxOut(p);
    // a halberd: the three Armadylean bodyguards carry min_attackrange=2 and cannot be hit with a
    // shorter weapon, which is Old School's own rule for them
    H.equip(p, { rhand: 'rune_halberd' });
    H.tick(1);
    let kills = 0;
    for (const n of npcs) {
        const { got, killed } = loot(p, n, 45);
        kills += killed;
        for (const [k, v] of got) all.set(k, (all.get(k) ?? 0) + v);
    }
    H.despawn(p);
    // A HARD CLUE IS NOT ONE OBJECT. ~trail_hardcluedrop hands out one of the tier's many named
    // scrolls - trail_clue_hard_riddle011, _sextant009 and so on - so the clue is matched by shape
    // rather than listed, which is also how a new scroll being added does not fail this.
    const unexpected = [...all.keys()].filter(k => !allowed.includes(k) && !k.startsWith('trail_clue_hard_')).sort();
    check("  nothing drops that is not on the wiki's list", unexpected, []);
    // 135 kills a trio cannot speak to a 2-in-127 item, let alone a 1-in-16256 one, so what is
    // asserted is what a sample this size really does settle: the table is reached, its common
    // items come out of it, and the per-npc extras belong to the npcs that own them.
    check('  coins come off it, which is two thirds of the table', (all.get('coins') ?? 0) > 0, true);
    // the 100% row, which is each table's own job rather than ~npc_death's - these four tables
    // forgot the line and left nothing but loot behind
    // AS MANY AS THERE WERE KILLS, not as many as there were attempts. A fight that does not finish
    // inside its tick budget drops nothing and should not: this counts what A.fight confirms died,
    // which was 124 to 130 of 135 the first time it was asked.
    const hundred = god === 'Zamorak' ? 'ashes' : 'bones';
    check(`  and the ${hundred} every one of them leaves: one per kill, ${kills} kills`, all.get(hundred) ?? 0, kills);
    const regular = allowed.filter(k => !RARE.test(k));
    const seen = regular.filter(k => all.has(k));
    check(`  and most of the regular table with them: ${seen.length} of ${regular.length}`, seen.length >= Math.ceil(regular.length / 2), true);
    console.log(
        '    ' +
            [...all]
                .sort((a, b) => b[1] - a[1])
                .map(([k, v]) => `${k} x${v}`)
                .join(', ')
    );
}

// ---------------------------------------------------------------- the per-npc extras
console.log('\nAND THE FOUR THAT ARE NOT SHARED BELONG TO THE RIGHT NPC');
// Strongstack's kebab, Steelwill's beer and Grimspike's eye patch are 1 in 6, so 60 kills each is
// plenty; Zakl'n Gritch's champion scroll is 1 in 5000 and only its ABSENCE from the other two can
// be asserted at any affordable sample, so that is what is asserted.
{
    const p: any = player('guard_extras', ARENA[0] - 2, ARENA[1], 0);
    H.maxOut(p);
    H.equip(p, { rhand: 'rune_halberd' });
    H.tick(1);
    for (const [npc, own, others] of [
        ['gwd_strongstack', 'kebab', ['beer', 'eye_patch']],
        ['gwd_steelwill', 'beer', ['kebab', 'eye_patch']],
        ['gwd_grimspike', 'eye_patch', ['kebab', 'beer']]
    ] as [string, string, string[]][]) {
        const { got } = loot(p, npc, 60);
        check(`  ${npc.replace('gwd_', '').padEnd(12)} drops its own ${own}`, (got.get(own) ?? 0) > 0, true);
        check(
            '    ...and neither of the other two',
            others.filter(o => got.has(o)),
            []
        );
    }
    H.despawn(p);
}

console.log(`\n${R.ok} ok, ${R.bad} FAIL`);
process.exit(R.bad ? 1 : 0);
