// THE TWO EEL SPOTS, which the maps have carried since the 377 import with nothing behind them.
//
//   npx tsx tools/sim/eelspots.ts
//
// tools/silentnpcops.py found them: three spot records in Mort Myre offering Bait and two in the
// Lumbridge Swamp Caves offering Net and Bait, nineteen spawn points in all, none with a category
// and so none reachable by any trigger. The earlier fix could only turn on the spots whose KIND
// already had a handler; these two kinds had none, and this is them being built.
//
//   slimy eel    28 Fishing, rod and bait, 65 experience in Mort Myre and 80 in the caves
//   cave eel     38 Fishing, rod and bait, 80 experience
//   frog spawn   33 Fishing, small net, 75 experience
//
// Every number is Old School's, taken from the {{Skilling success chart}} low= and high= on the
// wiki's own pages rather than read off its graphs - those are the game's stat_random arguments.
//
// WHAT IS WORTH ASSERTING HERE is not that fishing works - nine other spots prove that - but the
// two things this build had to decide. First, the same obj pays 65 in the swamp and 80 underground,
// and one struct cannot hold both: the swamp's number is in the struct and cavefish.rs2 tops up the
// fifteen, so the experience PER CATCH is the check, in both places. Second, at 38 the cave spot
// rolls a cave eel and then a slimy eel from one click - and both are worth 80, which makes the
// experience per catch exactly 80 whichever fish arrives.
import * as H from './harness.js';
import * as A from './a1lib.js';
import World from '#/engine/World.js';
import Npc from '#/engine/entity/Npc.js';
import NpcType from '#/cache/config/NpcType.js';
import CategoryType from '#/cache/config/CategoryType.js';
import ParamType from '#/cache/config/ParamType.js';
import StructType from '#/cache/config/StructType.js';
import Player from '#/engine/entity/Player.js';
import { PlayerStat } from '#/engine/entity/PlayerStat.js';
import { isFlagged, isZoneAllocated } from '#/engine/GameMap.js';
import { CollisionFlag } from '#/engine/routefinder/index.js';
import ObjType from '#/cache/config/ObjType.js';

const oc = (name: string) => ObjType.get(ObjType.getId(name)).name ?? name;

await H.boot();
H.loginOrder();

// A REFUSAL IS A MESBOX, NOT A CHAT LINE. ~mesbox writes an interface, so A.mesSince never sees
// "You need at least 28 Fishing to bait these fish." - the first draft of this sim read the chat
// log for all five refusals and called every one of them a failure. The mark goes before the click
// either way, which is the other half of the same lesson (tools/sim/README.md).
const ifaceMark = () => H.ifaces.length;
const shown = (p: { username: string }, from: number) =>
    H.ifaces
        .slice(from)
        .filter(i => i.who === p.username && i.kind === 'text' && i.text && i.text.length > 1)
        .map(i => i.text!);

const R = { ok: 0, bad: 0 };
const check = (what: string, got: unknown, want: unknown, detail?: unknown) => {
    const pass = JSON.stringify(got) === JSON.stringify(want);
    if (pass) R.ok++;
    else R.bad++;
    console.log(`  ${pass ? 'ok  ' : 'FAIL'} ${what}: ${JSON.stringify(got)}${pass ? '' : `   (want ${JSON.stringify(want)})`}`);
    if (!pass && detail !== undefined) console.log('    saw:', JSON.stringify(detail));
};

const SWAMP = ['0_53_51_slimey_eel', '0_53_53_slimey_eel', '0_54_53_slimey_eel'];
const CAVES = ['0_49_149_cavefish', '0_50_149_cavefish'];
const sp = (name: string, p: string) => StructType.get(StructType.getId(name)).params?.get(ParamType.getId(p));
const WHIRLPOOL = ParamType.getId('whirlpool');
const blocked = (x: number, z: number) => isFlagged(x, z, 0, CollisionFlag.WALK_BLOCKED);

/** A walkable tile beside a spot - the bank, which is the only place it can be fished from. */
const bankOf = (n: Npc) =>
    (
        [
            [1, 0],
            [-1, 0],
            [0, 1],
            [0, -1]
        ] as [number, number][]
    )
        .map(([dx, dz]) => [n.x + dx, n.z + dz] as [number, number])
        .find(([x, z]) => isZoneAllocated(n.level, x, z) && !blocked(x, z));

const spots = (name: string) => [...World.npcs].filter((n): n is Npc => !!n && n.type === NpcType.getId(name));

let bucket = 1;
/** On the bank beside the first spot of a type, with a rod, bait and a net. */
function fisher(name: string, type: string, fishing: number): [Player, Npc] {
    const spot = spots(type)[0];
    const bank = bankOf(spot)!;
    const p = H.makePlayer(name, bank[0], bank[1], bucket++);
    H.tick(1);
    p.teleport(bank[0], bank[1], spot.level);
    H.tick(1);
    H.maxOut(p);
    H.clearInv(p);
    p.setLevel(PlayerStat.FISHING, fishing);
    H.give(p, 'fishing_rod', 1);
    H.give(p, 'fishing_bait', 500);
    H.give(p, 'net', 1);
    H.tick(2);
    return [p, spot];
}

/** Fish until `want` catches or the ticks run out; returns what came up and the experience. */
function fishFor(p: Player, spot: Npc, op: number, objs: string[], want: number, maxTicks = 600) {
    const xp0 = p.stats[PlayerStat.FISHING];
    const count = () => objs.reduce((a, o) => a + H.invCount(p, o), 0);
    const from = A.mark();
    const iface = ifaceMark();
    H.opNpc(p, spot, op);
    for (let t = 0; t < maxTicks && count() < want; t++) H.tick(1);
    const got: Record<string, number> = {};
    for (const o of objs) got[o] = H.invCount(p, o);
    return { got, caught: count(), xp: (p.stats[PlayerStat.FISHING] - xp0) / 10, said: [...A.mesSince(p, from), ...shown(p, iface)] };
}

// ======================================================================= the records and the kinds
console.log('NINETEEN SPAWN POINTS THAT ANSWERED NOTHING');
{
    const placed = [...SWAMP, ...CAVES].map(n => spots(n).length);
    check('all five spot types are placed, and this is how many of each', placed, [6, 6, 5, 1, 1]);
    check(
        'nineteen spawn points in all',
        placed.reduce((a, b) => a + b, 0),
        19
    );
    // the category is what [opnpc1,_slimey_eel] and [opnpc1,_cavefish] are looked up through, and
    // the whirlpool is what the fishing random event changes the spot into - without the param,
    // macro_event_whirlpool_spawn throws rather than spawning one
    const kindOf = [...SWAMP.map(n => [n, 'slimey_eel'] as const), ...CAVES.map(n => [n, 'cavefish'] as const)];
    const wrong = kindOf.filter(([name, kind]) => {
        const t = NpcType.get(NpcType.getId(name));
        return t.category !== CategoryType.getId(kind) || t.params?.get(WHIRLPOOL) !== NpcType.getId('macro_whirlpool_' + kind);
    });
    check(
        'each carries its kind and the whirlpool that kind turns into',
        wrong.map(w => w[0]),
        []
    );
    for (const kind of ['slimey_eel', 'cavefish']) {
        const w = NpcType.get(NpcType.getId('macro_whirlpool_' + kind));
        check(`  macro_whirlpool_${kind} is a whirlpool of that kind, so the handlers still answer it`, [w.params?.get(ParamType.getId('is_whirlpool')), w.category === CategoryType.getId(kind)], [1, true]);
    }
    // and nothing in either area is left with an op nothing answers
    const dead = [...A.deadNpcOps(3328, 3200, 3520, 3456).keys(), ...A.deadNpcOps(3072, 9472, 3264, 9664).keys()];
    check(
        'none of the five is in deadNpcOps any more',
        [...SWAMP, ...CAVES].filter(n => dead.some(k => k.startsWith(n + ' '))),
        []
    );
}

// =========================================================================== the experience itself
console.log('\nTHE EXPERIENCE PER CATCH, WHICH IS THE ONE THING THIS BUILD HAD TO DECIDE');
{
    check(
        'the struct carries Mort Myre 65, the caves 80 for a cave eel, 75 for frog spawn',
        [sp('fishing_struct_mort_slimey_eel', 'productexp'), sp('fishing_struct_raw_cave_eel', 'productexp'), sp('fishing_struct_giant_frogspawn', 'productexp')],
        [650, 800, 750]
    );
    check(
        'and the wiki pairs: both eels 10/80, frog spawn 16/96',
        [
            sp('fishing_struct_mort_slimey_eel', 'success_low'),
            sp('fishing_struct_mort_slimey_eel', 'success_high'),
            sp('fishing_struct_raw_cave_eel', 'success_low'),
            sp('fishing_struct_raw_cave_eel', 'success_high'),
            sp('fishing_struct_giant_frogspawn', 'success_low'),
            sp('fishing_struct_giant_frogspawn', 'success_high')
        ],
        [10, 80, 10, 80, 16, 96]
    );
}

console.log('\nMORT MYRE: BAIT, AND NOTHING ELSE');
{
    const [p, spot] = fisher('swampeel', SWAMP[0], 27);
    let r = fishFor(p, spot, 1, ['mort_slimey_eel'], 1, 30);
    check('27 Fishing is refused, and says so', [r.caught, r.said.some(m => /28 Fishing/.test(m))], [0, true], r.said);
    p.setLevel(PlayerStat.FISHING, 28);
    H.tick(1);
    r = fishFor(p, spot, 1, ['mort_slimey_eel'], 4);
    check('28 Fishing catches slimy eels', r.caught >= 1, true, r.said.slice(0, 3));
    check('  at 65 experience each, which is Mort Myre and not the caves', r.caught > 0 ? r.xp / r.caught : 0, 65);
    check('  and the bait goes with them', H.invCount(p, 'fishing_bait'), 500 - r.caught);
    console.log(`    (${r.caught} eels in 600 ticks)`);
    H.despawn(p);
}
{
    // THE TWO REFUSALS GET FRESH PLAYERS. The first draft clicked Bait again with the fisher who
    // had just caught four eels, and nothing was printed at all: that player still had a queued
    // op and an %action_delay in the future, so the click went nowhere. A refusal is only a
    // refusal when the click actually reached the trigger.
    const [p, spot] = fisher('swamptool', SWAMP[0], 28);
    H.clearInv(p);
    H.give(p, 'harpoon', 1);
    H.tick(1);
    let from = ifaceMark();
    H.opNpc(p, spot, 1);
    for (let t = 0; t < 10; t++) H.tick(1);
    check(
        'a harpoon and no rod is told which tool it wants',
        shown(p, from).some(m => /Fishing Rod/i.test(m)),
        true,
        shown(p, from)
    );
    H.despawn(p);
    const [q, spot2] = fisher('swampbait', SWAMP[0], 28);
    H.clearInv(q);
    H.give(q, 'fishing_rod', 1);
    H.tick(1);
    from = ifaceMark();
    H.opNpc(q, spot2, 1);
    for (let t = 0; t < 10; t++) H.tick(1);
    check(
        'a rod with no bait is refused',
        shown(q, from).some(m => /fishing bait/i.test(m)),
        true,
        shown(q, from)
    );
    H.despawn(q);
}

console.log('\nTHE LUMBRIDGE SWAMP CAVES: NET FOR FROG SPAWN, BAIT FOR BOTH EELS');
{
    const [p, spot] = fisher('caveeel', CAVES[0], 28);
    // the Bait op is 3 here, because this record has both
    let r = fishFor(p, spot, 3, ['mort_slimey_eel', 'raw_cave_eel'], 4);
    check('at 28 the caves give slimy eels and no cave eel', [r.got['mort_slimey_eel'] >= 1, r.got['raw_cave_eel']], [true, 0], r.said.slice(0, 3));
    check('  at 80 experience each - the struct 65 plus the caves fifteen', r.caught > 0 ? r.xp / r.caught : 0, 80);
    console.log(`    (${r.got['mort_slimey_eel']} slimy eels in 600 ticks)`);
    H.clearInv(p);
    H.give(p, 'fishing_rod', 1);
    H.give(p, 'fishing_bait', 500);
    p.setLevel(PlayerStat.FISHING, 38);
    H.tick(2);
    r = fishFor(p, spot, 3, ['mort_slimey_eel', 'raw_cave_eel'], 8);
    check('at 38 cave eels come up too', r.got['raw_cave_eel'] >= 1, true, r.said.slice(0, 3));
    check('  and every catch is 80, whichever eel it was', r.caught > 0 ? r.xp / r.caught : 0, 80);
    console.log(`    (${r.got['raw_cave_eel']} cave, ${r.got['mort_slimey_eel']} slimy in 600 ticks)`);
    H.despawn(p);
}
{
    const [p, spot] = fisher('frogger', CAVES[0], 32);
    H.give(p, 'net', 1);
    H.tick(1);
    let r = fishFor(p, spot, 1, ['giant_frogspawn'], 1, 30);
    check('32 Fishing nets nothing, and says 33', [r.caught, r.said.some(m => /33 Fishing/.test(m))], [0, true], r.said);
    p.setLevel(PlayerStat.FISHING, 33);
    H.tick(1);
    r = fishFor(p, spot, 1, ['giant_frogspawn'], 4);
    check('33 nets frog spawn', r.caught >= 1, true, r.said.slice(0, 3));
    check('  at 75 experience each, and no bait used', [r.caught > 0 ? r.xp / r.caught : 0, H.invCount(p, 'fishing_bait')], [75, 500]);
    console.log(`    (${r.caught} frog spawn in 600 ticks)`);
    H.despawn(p);
}

// ================================================================================== and cooking it
console.log('\nAND BOTH EELS COOK, WHICH THEY COULD NOT BEFORE BECAUSE NOTHING PRODUCED THEM');
{
    // a Range beside the player, which is all [oplocu,_cooking_oven] needs
    const p = A.player('eelcook', 3222, 3218);
    H.maxOut(p);
    H.clearInv(p);
    H.tick(1);
    A.addLoc('loc_2729', 3222, 3219, 0);
    H.tick(1);
    // ONE AT A TIME, because cooking more than one opens the cookx chat (1 / 5 / All / X) and a
    // sim that clicks through it without choosing gets one cooked item and a queue of minus one.
    // inv_total = 1 is cooking.rs2's own direct path, so twelve single cooks measure the same
    // level gate, the same burn curve and the same experience without the dialogue.
    const cook = (raw: string, cooked: string, burnt: string, level: number, xpEach: number) => {
        p.setLevel(PlayerStat.COOKING, level - 1);
        H.clearInv(p);
        H.give(p, raw, 1);
        H.tick(1);
        const from = ifaceMark();
        A.useOn(p, 3222, 3219, 'loc_2729', raw);
        check(`${level - 1} Cooking will not cook ${oc(raw)}`, [H.invCount(p, raw), shown(p, from).some(m => new RegExp('Cooking level of ' + level).test(m))], [1, true], shown(p, from));
        p.setLevel(PlayerStat.COOKING, level);
        H.tick(1);
        const xp0 = p.stats[PlayerStat.COOKING];
        let made = 0;
        let spoiled = 0;
        for (let i = 0; i < 12; i++) {
            H.clearInv(p);
            H.give(p, raw, 1);
            H.tick(1);
            A.useOn(p, 3222, 3219, 'loc_2729', raw);
            for (let t = 0; t < 20 && H.invCount(p, raw) > 0; t++) H.tick(1);
            made += H.invCount(p, cooked);
            spoiled += H.invCount(p, burnt);
        }
        check(`${level} Cooking cooks every one of twelve, one way or the other`, [made + spoiled, H.invCount(p, raw)], [12, 0]);
        check(`  and pays ${xpEach} for each one that worked`, made > 0 ? (p.stats[PlayerStat.COOKING] - xp0) / 10 / made : 0, xpEach);
        console.log(`    (${made} cooked, ${spoiled} burnt out of twelve at level ${level})`);
    };
    cook('mort_slimey_eel', 'mort_slimey_eel_cooked', 'burnt_eel', 28, 95);
    cook('raw_cave_eel', 'cave_eel', 'burnt_cave_eel', 38, 115);
    H.despawn(p);
}

console.log('');
console.log(`${R.ok} ok, ${R.bad} failed`);
process.exit(R.bad ? 1 : 0);
