// THE WILDERNESS FISHING SPOTS: sea turtle and manta ray, on the lake beside the east dragons.
//
//   npx tsx tools/sim/wildyfish.ts
//
// Suggestion #10. The point of the spots is that they are a SIDEGRADE to the Fishing Trawler - same
// rolls, same xp, more risk - so most of what is checked here is that they really are one: the catch
// rates are the shark's own numbers and the xp is unchanged, because a Wilderness spot that simply
// out-earned the Trawler would replace it rather than add to it.
//
// MOVED EAST ON 15 OCTOBER, and this sim went red on the owner's own commit: one spot in the puddle
// among the WEST dragons became four down the west shore of the lake by the east dragons, and three
// checks here were still reading (2977,3616). What they assert now is the shape that move was for -
// four spots in the water with the bank beside them, far enough apart to be a queue, with the
// dragons in walking distance and the lake no longer something you can stroll across.
import * as H from './harness.js';
import World from '#/engine/World.js';
import Npc from '#/engine/entity/Npc.js';
import NpcType from '#/cache/config/NpcType.js';
import ParamType from '#/cache/config/ParamType.js';
import StructType from '#/cache/config/StructType.js';
import Player from '#/engine/entity/Player.js';
import { PlayerStat } from '#/engine/entity/PlayerStat.js';
import { isFlagged, isZoneAllocated, canTravel } from '#/engine/GameMap.js';
import { CollisionFlag, CollisionType } from '#/engine/routefinder/index.js';

await H.boot();
H.loginOrder();

const R = { ok: 0, bad: 0 };
const check = (what: string, got: unknown, want: unknown) => {
    const pass = JSON.stringify(got) === JSON.stringify(want);
    if (pass) R.ok++;
    else R.bad++;
    console.log(`  ${pass ? 'ok  ' : 'FAIL'} ${what}: ${JSON.stringify(got)}${pass ? '' : `   (want ${JSON.stringify(want)})`}`);
};

// The four, as the map places them: m52_57's NPC section at local (43,37), (39,43), (41,49) and
// (45,52), which is 3328+lx, 3648+lz.
const SPOTS: [number, number][] = [
    [3371, 3685],
    [3367, 3691],
    [3369, 3697],
    [3373, 3700]
];
const TURTLE = 79;
const sp = (name: string, p: string) => StructType.get(StructType.getId(name)).params?.get(ParamType.getId(p));
const blocked = (x: number, z: number) => isFlagged(x, z, 0, CollisionFlag.WALK_BLOCKED);
const banks = (x: number, z: number) =>
    (
        [
            [1, 0],
            [-1, 0],
            [0, 1],
            [0, -1]
        ] as [number, number][]
    )
        .map(([dx, dz]) => [x + dx, z + dz] as [number, number])
        .filter(([bx, bz]) => isZoneAllocated(0, bx, bz) && !blocked(bx, bz));
/** Can you walk from (x,z) to (tx,tz)? A flood over the real collision map. */
const onFoot = (x: number, z: number, tx: number, tz: number, radius = 60) => {
    const seen = new Set<string>([x + ',' + z]);
    const q = [[x, z]];
    while (q.length) {
        const [cx, cz] = q.pop()!;
        if (cx === tx && cz === tz) return true;
        for (const [dx, dz] of [
            [1, 0],
            [-1, 0],
            [0, 1],
            [0, -1]
        ]) {
            const nx = cx + dx,
                nz = cz + dz,
                k = nx + ',' + nz;
            if (seen.has(k) || Math.abs(nx - x) > radius || Math.abs(nz - z) > radius) continue;
            if (canTravel(0, cx, cz, dx, dz, 1, 0, CollisionType.NORMAL)) {
                seen.add(k);
                q.push([nx, nz]);
            }
        }
    }
    return false;
};

let bucket = 1;
/** On the bank beside a spot, which is the only tile it can be fished from. */
function player(name: string, fishing: number, spot: [number, number] = SPOTS[0]): Player {
    const [bx, bz] = banks(spot[0], spot[1])[0];
    const p = H.makePlayer(name, bx, bz, bucket++);
    H.tick(2);
    H.maxOut(p);
    H.clearInv(p);
    p.setLevel(PlayerStat.FISHING, fishing);
    H.give(p, 'harpoon', 1);
    return p;
}

console.log('== four spots, in the water, on the lake by the east dragons');
{
    const id = NpcType.getId('wildyfish');
    const placed = [...World.npcs]
        .filter((n): n is Npc => !!n && n.type === id)
        .map(n => [n.x, n.z] as [number, number])
        .sort((a, b) => a[1] - b[1]);
    check(
        'all four are spawned, and nowhere else',
        placed,
        [...SPOTS].sort((a, b) => a[1] - b[1])
    );
    // THE SHAPE EVERY CACHE FISHING SPOT HAS: the npc stands on a blocked water tile and the bank is
    // beside it, so the spot is reachable from the shore and from nowhere else. The puddle it came
    // from was walkable, and the lake was not flagged at all until the move.
    check(
        'each stands in the water with a bank beside it',
        SPOTS.filter(([x, z]) => !blocked(x, z) || banks(x, z).length === 0),
        []
    );
    // and the water is water: the lake cannot be crossed on foot from the west bank
    check('the lake cannot be walked across', onFoot(3366, 3691, 3384, 3691), false);
    const t = NpcType.get(NpcType.getId('wildyfish'));
    check('they do not drift', t.wanderrange, 0);
    check('and offer Harpoon', t.op?.[2] ?? null, 'Harpoon');
    // Wilderness 21 to 23, from (z - 3520) / 8 + 1. Deep enough to matter, shallow enough to leave.
    check(
        'at Wilderness 21 to 23',
        SPOTS.map(([, z]) => Math.floor((z - 3520) / 8) + 1),
        [21, 22, 23, 23]
    );
    // FOUR AND NOT ONE BECAUSE ONE SPOT IS A QUEUE: far enough apart that a taken one is a few steps
    // from a free one, which is the whole reason the move added three.
    let closest = 99;
    for (let i = 0; i < SPOTS.length; i++) for (let j = i + 1; j < SPOTS.length; j++) closest = Math.min(closest, Math.max(Math.abs(SPOTS[i][0] - SPOTS[j][0]), Math.abs(SPOTS[i][1] - SPOTS[j][1])));
    check('no two of them are within three tiles of each other', closest >= 4, true);
    // and the dragons, which are what the Wilderness levels are for
    const dragons = [...World.npcs].filter((n): n is Npc => !!n && NpcType.get(n.type).debugname === 'green_dragon').map(n => [n.x, n.z]);
    const nearest = SPOTS.map(([x, z]) => Math.min(...dragons.map(([dx, dz]) => Math.max(Math.abs(dx - x), Math.abs(dz - z)))));
    check(
        'a green dragon is within thirty tiles of every one of them',
        nearest.every(d => d <= 30),
        true
    );
    console.log(`       (nearest dragon to each: ${nearest.join(', ')} tiles)`);
}

console.log('== it is a sidegrade, not an upgrade');
{
    // The rolls are the shark's own, so a manta is caught no faster than a shark is.
    check('manta rolls at the shark rate', [sp('fishing_struct_mantaray', 'success_low'), sp('fishing_struct_mantaray', 'success_high')], [sp('fishing_struct_shark', 'success_low'), sp('fishing_struct_shark', 'success_high')]);
    check('and so does the turtle', [sp('fishing_struct_seaturtle', 'success_low'), sp('fishing_struct_seaturtle', 'success_high')], [sp('fishing_struct_shark', 'success_low'), sp('fishing_struct_shark', 'success_high')]);
    // The xp is Old School's and was already in the file - the spot must not have changed it.
    check('the xp is untouched', [sp('fishing_struct_mantaray', 'productexp'), sp('fishing_struct_seaturtle', 'productexp')], [690, 570]);
    // Both needed a catch message, because the Trawler awards directly and never rolled.
    check('both now have a catch message', [sp('fishing_struct_mantaray', 'productmessage'), sp('fishing_struct_seaturtle', 'productmessage')], ['You catch a manta ray.', 'You catch a sea turtle.']);
}

console.log('== fishing it');
{
    const p = player('toolow', TURTLE - 1);
    const npc = H.npcNear('wildyfish', SPOTS[0][0], SPOTS[0][1])!;
    H.clearLogs();
    H.opNpc(p, npc, 3);
    for (let t = 0; t < 20; t++) H.tick(1);
    check('below 79 catches nothing', H.invCount(p, 'raw_seaturtle') + H.invCount(p, 'raw_mantaray'), 0);
}
{
    // At 79 the turtle is reachable and the manta is not - the roll only offers what you can catch.
    const p = player('turtler', TURTLE);
    const npc = H.npcNear('wildyfish', SPOTS[0][0], SPOTS[0][1])!;
    H.clearLogs();
    H.opNpc(p, npc, 3);
    for (let t = 0; t < 400 && H.invCount(p, 'raw_seaturtle') + H.invCount(p, 'raw_mantaray') < 6; t++) H.tick(1);
    const turtles = H.invCount(p, 'raw_seaturtle');
    const mantas = H.invCount(p, 'raw_mantaray');
    check('at 79 it catches turtles', turtles > 0, true);
    check('and no manta rays', mantas, 0);
    console.log(`       (${turtles} turtles in 400 ticks)`);
}
{
    const p = player('mantaman', 99);
    const npc = H.npcNear('wildyfish', SPOTS[0][0], SPOTS[0][1])!;
    H.clearLogs();
    H.opNpc(p, npc, 3);
    for (let t = 0; t < 600 && H.invCount(p, 'raw_mantaray') < 3; t++) H.tick(1);
    check('at 99 manta rays come up', H.invCount(p, 'raw_mantaray') > 0, true);
    console.log(`       (${H.invCount(p, 'raw_mantaray')} manta, ${H.invCount(p, 'raw_seaturtle')} turtle in 600 ticks)`);
}
{
    const p = player('nokit', 99);
    H.clearInv(p); // no harpoon
    const npc = H.npcNear('wildyfish', SPOTS[0][0], SPOTS[0][1])!;
    H.clearLogs();
    H.opNpc(p, npc, 3);
    for (let t = 0; t < 20; t++) H.tick(1);
    check('without a harpoon it catches nothing', H.invCount(p, 'raw_seaturtle') + H.invCount(p, 'raw_mantaray'), 0);
}

console.log('');
console.log(`${R.ok} passed, ${R.bad} failed`);
process.exit(R.bad ? 1 : 0);
