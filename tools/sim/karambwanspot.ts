// THE KARAMBWAN SPOTS, which Tai Bwo Wannai Trio promises and nothing could click.
//
//   npx tsx tools/sim/karambwanspot.ts
//
// The quest's completion panel lists "Karambwan fishing" as its reward and the reward worked one
// way only: dropping a loaded vessel out of your inventory inside a zone off the east coast. The
// three spot records the maps place carried op1=Fish and no category, so the obvious click did
// nothing - five spawn points of it, which tools/silentnpcops.py is how anyone noticed.
//
// WHAT THIS ASSERTS is that the Fish op reaches the quest's own catch and not a second copy of it:
// the same level gate, the same roll, the same bait consumed whether or not a fish comes up. And
// that it works at the Brimhaven spot, which is nowhere near the zone the hand-dropped vessel
// insists on - the spot being the deep water is the whole reason it skips that check.
import * as H from './harness.js';
import * as A from './a1lib.js';
import World from '#/engine/World.js';
import Npc from '#/engine/entity/Npc.js';
import NpcType from '#/cache/config/NpcType.js';
import CategoryType from '#/cache/config/CategoryType.js';
import Player from '#/engine/entity/Player.js';
import { PlayerStat } from '#/engine/entity/PlayerStat.js';
import { isFlagged, isZoneAllocated } from '#/engine/GameMap.js';
import { CollisionFlag } from '#/engine/routefinder/index.js';

await H.boot();
H.loginOrder();

const R = { ok: 0, bad: 0 };
const check = (what: string, got: unknown, want: unknown, detail?: unknown) => {
    const pass = JSON.stringify(got) === JSON.stringify(want);
    if (pass) R.ok++;
    else R.bad++;
    console.log(`  ${pass ? 'ok  ' : 'FAIL'} ${what}: ${JSON.stringify(got)}${pass ? '' : `   (want ${JSON.stringify(want)})`}`);
    if (!pass && detail !== undefined) console.log('    saw:', JSON.stringify(detail));
};
// a refusal is a mesbox, which is an interface and not the chat log
const ifaceMark = () => H.ifaces.length;
const shown = (p: { username: string }, from: number) =>
    H.ifaces
        .slice(from)
        .filter(i => i.who === p.username && i.kind === 'text' && i.text && i.text.length > 1)
        .map(i => i.text!);

const SPOTS = ['lubufu_karambwan', '0_45_48_karambwan', 'general_karambwan'];
const VESSEL = 'tbwt_karambwan_vessel';
const LOADED = 'tbwt_karambwan_vessel_loaded_with_karambwanji';
const spots = (name: string) => [...World.npcs].filter((n): n is Npc => !!n && n.type === NpcType.getId(name));
const blocked = (x: number, z: number) => isFlagged(x, z, 0, CollisionFlag.WALK_BLOCKED);
const bankOf = (n: Npc) =>
    (
        [
            [1, 0],
            [-1, 0],
            [0, 1],
            [0, -1],
            [1, 1],
            [-1, -1]
        ] as [number, number][]
    )
        .map(([dx, dz]) => [n.x + dx, n.z + dz] as [number, number])
        .find(([x, z]) => isZoneAllocated(n.level, x, z) && !blocked(x, z));

let bucket = 1;
function fisher(name: string, spot: Npc, fishing: number): Player {
    const bank = bankOf(spot)!;
    const p = H.makePlayer(name, bank[0], bank[1], bucket++);
    H.tick(1);
    p.teleport(bank[0], bank[1], spot.level);
    H.tick(1);
    H.maxOut(p);
    H.clearInv(p);
    p.setLevel(PlayerStat.FISHING, fishing);
    H.tick(2);
    return p;
}

console.log('FIVE SPAWN POINTS OF A QUEST REWARD THAT COULD NOT BE CLICKED');
{
    const counts = SPOTS.map(n => spots(n).length);
    check('all three types are placed, and this is how many of each', counts, [1, 2, 2]);
    check(
        'five spawn points in all',
        counts.reduce((a, b) => a + b, 0),
        5
    );
    check(
        'each carries the karambwan category now',
        SPOTS.filter(n => NpcType.get(NpcType.getId(n)).category !== CategoryType.getId('karambwan')),
        []
    );
    // no whirlpool param, and that is on purpose: this catch is one drop and never calls
    // macro_event_fishing, so there is no event to turn the spot into one
    // the box comes from where the spots actually are, so this cannot pass by looking in the
    // wrong place - which a hand-written pair of Karamja boxes did in the first draft
    const all = SPOTS.flatMap(n => spots(n));
    const x1 = Math.min(...all.map(n => n.x)) - 5;
    const z1 = Math.min(...all.map(n => n.z)) - 5;
    const x2 = Math.max(...all.map(n => n.x)) + 5;
    const z2 = Math.max(...all.map(n => n.z)) + 5;
    const dead = [...A.deadNpcOps(x1, z1, x2, z2).keys()];
    check(
        'and the Fish op is no longer in deadNpcOps',
        SPOTS.filter(n => dead.some(k => k.startsWith(n + ' '))),
        []
    );
    for (const n of SPOTS) for (const s of spots(n)) console.log(`    ${n} at ${s.x},${s.z},${s.level} - bank ${JSON.stringify(bankOf(s))}`);
}

console.log('\nTHE BRIMHAVEN SPOT, WHICH THE HAND-DROPPED VESSEL WOULD REFUSE');
{
    const spot = spots('lubufu_karambwan')[0];
    // nothing in hand at all: the Lubufu answer
    let p = fisher('karanone', spot, 65);
    let from = ifaceMark();
    H.opNpc(p, spot, 1);
    for (let t = 0; t < 10; t++) H.tick(1);
    check(
        'with no vessel it names the man who makes them',
        shown(p, from).some(m => /Lubufu/.test(m)),
        true,
        shown(p, from)
    );
    H.despawn(p);

    // an empty vessel: the bait answer
    p = fisher('karaempty', spot, 65);
    H.give(p, VESSEL, 1);
    H.tick(1);
    from = ifaceMark();
    H.opNpc(p, spot, 1);
    for (let t = 0; t < 10; t++) H.tick(1);
    check(
        'an empty vessel is told it wants a karambwanji',
        shown(p, from).some(m => /karambwanji/i.test(m)),
        true,
        shown(p, from)
    );
    check('  and the vessel is still empty and still there', [H.invCount(p, VESSEL), H.invCount(p, LOADED)], [1, 0]);
    H.despawn(p);

    // 64 Fishing: the quest's own gate, reached through the spot
    p = fisher('karalow', spot, 64);
    H.give(p, LOADED, 1);
    H.tick(1);
    const m = A.mark();
    H.opNpc(p, spot, 1);
    for (let t = 0; t < 10; t++) H.tick(1);
    check('64 Fishing is refused by the quest gate', [H.invCount(p, LOADED), A.mesSince(p, m).some(s => /Fishing level of 65/.test(s))], [1, true], A.mesSince(p, m));
    H.despawn(p);
}

console.log('\nAND AT 65 IT CATCHES, OUT OF THE SPOT RATHER THAN OUT OF THE INVENTORY');
{
    const spot = spots('lubufu_karambwan')[0];
    const p = fisher('karafish', spot, 65);
    let caught = 0;
    let tries = 0;
    let xp0 = p.stats[PlayerStat.FISHING];
    let xpForCatches = 0;
    // the bait goes whether or not a fish comes up, which is the wiki's own note about this spot,
    // so each try is one loaded vessel in and one empty vessel out
    for (let i = 0; i < 25 && caught < 2; i++) {
        H.clearInv(p);
        H.give(p, LOADED, 1);
        H.tick(1);
        xp0 = p.stats[PlayerStat.FISHING];
        tries++;
        H.opNpc(p, spot, 1);
        for (let t = 0; t < 20 && H.invCount(p, LOADED) > 0; t++) H.tick(1);
        H.tick(2);
        if (H.invCount(p, 'tbwt_raw_karambwan') > 0) {
            caught++;
            xpForCatches += (p.stats[PlayerStat.FISHING] - xp0) / 10;
        } else {
            check(`  a miss still takes the karambwanji (try ${tries})`, [H.invCount(p, LOADED), H.invCount(p, VESSEL)], [0, 1]);
            check(`  and pays nothing for it (try ${tries})`, p.stats[PlayerStat.FISHING] - xp0, 0);
        }
    }
    check('it catches karambwan from the spot', caught >= 1, true);
    // 80 and not Old School's 50: quest_tbwt.rs2 has paid 80 since it was written, and the spot
    // reaches the same catch rather than carrying a second number of its own. What the wiki says
    // is 50 now and 105 before a 2016 rebalance, so 2006 would have been 105 - a decision for the
    // owner, and this check is here so that whichever way it goes, both doors move together.
    check('  at the same experience the hand-dropped vessel pays, 80', caught > 0 ? xpForCatches / caught : 0, 80);
    check('  and the empty vessel comes back every time', H.invCount(p, VESSEL), 1);
    console.log(`    (${caught} karambwan in ${tries} drops at 65 Fishing)`);
    H.despawn(p);
}

console.log('');
console.log(`${R.ok} ok, ${R.bad} failed`);
process.exit(R.bad ? 1 : 0);
