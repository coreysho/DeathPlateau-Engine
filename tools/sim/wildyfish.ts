// THE WILDERNESS FISHING SPOTS: sea turtle and manta ray, on the lake beside the east dragons.
//
//   npx tsx tools/sim/wildyfish.ts
//
// Suggestion #10. The point of the spots is that they are a SIDEGRADE to the Fishing Trawler - same
// rolls, same xp, more risk - so most of what is checked here is that they really are one: the catch
// rates are the shark's own numbers and the xp is unchanged, because a Wilderness spot that simply
// out-earned the Trawler would replace it rather than add to it.
//
// MOVED THREE TIMES ON 15 OCTOBER, which is why nothing here is written down any more. The pond
// among the WEST dragons became four spots on the lake, then the east coast, then two pairs on
// whole water tiles - and this sim went red on the first two moves for reading coordinates out of
// its own source. So it now READS THE SPOTS OUT OF THE WORLD and asserts the properties each move
// was made to get: in water a player cannot walk into, with a tile beside it sharing an EDGE (the
// engine's reach for an npc is orthogonal only), in the Wilderness, within walking distance of the
// dragons, far enough apart to be a queue, and - the one that matters most - a Harpoon click that
// actually starts at every one of them.
//
// IT ALSO PRINTS THE WATER OVERLAY under each spot, straight out of maps/*.jm2, because that is
// what the last move was about: `o6` is the whole tile, `o6;shape` and `o6;shape;rotation` are the
// beach tiles that cut a tile diagonally (tools/unpack/map/Unpack.ts:204-210 writes all three
// forms), and an npc draws at the centre of its tile. It is printed rather than asserted because
// how much of a tile shape 3 or 4 covers is a question for the client, not for this sim.
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
import Environment from '#/util/Environment.js';
import { existsSync, readFileSync } from 'fs';

await H.boot();
H.loginOrder();

const R = { ok: 0, bad: 0 };
const check = (what: string, got: unknown, want: unknown) => {
    const pass = JSON.stringify(got) === JSON.stringify(want);
    if (pass) R.ok++;
    else R.bad++;
    console.log(`  ${pass ? 'ok  ' : 'FAIL'} ${what}: ${JSON.stringify(got)}${pass ? '' : `   (want ${JSON.stringify(want)})`}`);
};

const TURTLE = 79;
const sp = (name: string, p: string) => StructType.get(StructType.getId(name)).params?.get(ParamType.getId(p));
const blocked = (x: number, z: number) => isFlagged(x, z, 0, CollisionFlag.WALK_BLOCKED);
/** The tiles beside a spot that share an EDGE with it and are not blocked - the only ones that can reach it. */
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

/** Can you walk from one tile to another? A flood over the real collision map. */
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

/** The water overlay token under a tile, read out of the map source: 'o6', 'o6;4', 'o6;3;1'... */
const overlayAt = (x: number, z: number) => {
    const file = `${Environment.BUILD_SRC_DIR}/maps/m${Math.floor(x / 64)}_${Math.floor(z / 64)}.jm2`;
    if (!existsSync(file)) return '(no map file)';
    const line = readFileSync(file, 'utf8')
        .split('\n')
        .find(l => l.startsWith(`0 ${x % 64} ${z % 64}: `));
    return line?.match(/\bo\d+(;\d+)*/)?.[0] ?? '(no overlay)';
};

const spots = () =>
    [...World.npcs]
        .filter((n): n is Npc => !!n && n.type === NpcType.getId('wildyfish'))
        .map(n => [n.x, n.z] as [number, number])
        .sort((a, b) => a[1] - b[1] || a[0] - b[0]);

let bucket = 1;
/** On the bank beside a spot, which is the only tile it can be fished from. */
function player(name: string, fishing: number, spot: [number, number] = spots()[0]): Player {
    const [bx, bz] = banks(spot[0], spot[1])[0];
    const p = H.makePlayer(name, bx, bz, bucket++);
    H.tick(2);
    H.maxOut(p);
    H.clearInv(p);
    p.setLevel(PlayerStat.FISHING, fishing);
    H.give(p, 'harpoon', 1);
    return p;
}

console.log('== the spots, wherever they have been moved to this time');
{
    const placed = spots();
    check('four of them, and nowhere else', placed.length, 4);
    for (const [x, z] of placed) {
        console.log(`    ${x},${z}  Wilderness ${Math.floor((z - 3520) / 8) + 1}  overlay ${overlayAt(x, z)}  banks ${JSON.stringify(banks(x, z))}`);
    }
    // THE SHAPE EVERY CACHE FISHING SPOT HAS: the npc stands on a blocked water tile and the bank
    // is beside it, sharing an edge, so the spot is reachable from the shore and from nowhere else.
    check(
        'each stands in water a player cannot walk into',
        placed.filter(([x, z]) => !blocked(x, z)),
        []
    );
    check(
        'each has a tile beside it sharing an edge, which is the only reach the engine gives an npc',
        placed.filter(([x, z]) => banks(x, z).length === 0),
        []
    );
    const t = NpcType.get(NpcType.getId('wildyfish'));
    check('they do not drift', t.wanderrange, 0);
    check('and offer Harpoon', t.op?.[2] ?? null, 'Harpoon');
    // the Wilderness is the whole point of the spot: deep enough to matter, shallow enough to leave
    const levels = placed.map(([, z]) => Math.floor((z - 3520) / 8) + 1);
    check(
        'all four are in the Wilderness, between 20 and 25',
        levels.filter(l => l < 20 || l > 25),
        []
    );
    // FOUR AND NOT ONE BECAUSE ONE SPOT IS A QUEUE: far enough apart that a taken one is a few
    // steps from a free one.
    let closest = 99;
    for (let i = 0; i < placed.length; i++) for (let j = i + 1; j < placed.length; j++) closest = Math.min(closest, Math.max(Math.abs(placed[i][0] - placed[j][0]), Math.abs(placed[i][1] - placed[j][1])));
    check('no two of them are within three tiles of each other', closest >= 4, true);
    // AND THE DRAGONS, which are what the Wilderness levels are for - but as the owner's own test
    // rather than as a radius. A distance in tiles says nothing when a cliff is in the way, so
    // what his commits check and what this checks is that the bank beside each spot can be WALKED
    // to from a green dragon's tile; the distances are printed beside it because they moved from
    // twenty tiles to thirty-six across three moves and that is worth seeing, not failing over.
    const dragons = [...World.npcs].filter((n): n is Npc => !!n && NpcType.get(n.type).debugname === 'green_dragon').map(n => [n.x, n.z] as [number, number]);
    const nearest = placed.map(([x, z]) => Math.min(...dragons.map(([dx, dz]) => Math.max(Math.abs(dx - x), Math.abs(dz - z)))));
    const noWalk = placed.filter(([x, z]) => {
        const bank = banks(x, z)[0];
        if (!bank) return true;
        const near = dragons.filter(([dx, dz]) => Math.max(Math.abs(dx - x), Math.abs(dz - z)) <= 60);
        return !near.some(([dx, dz]) => onFoot(dx, dz, bank[0], bank[1], 70));
    });
    check('every one of them can be walked to from a green dragon, cliffs and all', noWalk, []);
    console.log(`       (nearest dragon to each: ${nearest.join(', ')} tiles)`);
}

console.log('== and a Harpoon click starts at every one of them');
{
    // THE CHECK THE LAST TWO MOVES NEEDED. A spot on a tile nothing can stand beside looks perfect
    // in every list above and does nothing when a player clicks it, which is how it was reported
    // from the game both times. So: stand on the bank of each in turn and click Harpoon.
    const dead: string[] = [];
    for (const spot of spots()) {
        const p = player('wildyreach' + spot[0] + '_' + spot[1], 99, spot);
        H.tick(1);
        const npc = H.npcNear('wildyfish', spot[0], spot[1])!;
        H.clearLogs();
        H.opNpc(p, npc, 3);
        let started = false;
        for (let t = 0; t < 12 && !started; t++) {
            H.tick(1);
            if (p.activeScript || H.mesgs.some(m => m.who === p.username)) started = true;
        }
        if (!started) dead.push(`${spot[0]},${spot[1]} from ${JSON.stringify(banks(spot[0], spot[1]))}`);
        H.despawn(p);
    }
    check('none of the four is a spot you cannot fish', dead, []);
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
    const npc = H.npcNear('wildyfish', spots()[0][0], spots()[0][1])!;
    H.clearLogs();
    H.opNpc(p, npc, 3);
    for (let t = 0; t < 20; t++) H.tick(1);
    check('below 79 catches nothing', H.invCount(p, 'raw_seaturtle') + H.invCount(p, 'raw_mantaray'), 0);
}
{
    // At 79 the turtle is reachable and the manta is not - the roll only offers what you can catch.
    const p = player('turtler', TURTLE);
    const npc = H.npcNear('wildyfish', spots()[0][0], spots()[0][1])!;
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
    const npc = H.npcNear('wildyfish', spots()[0][0], spots()[0][1])!;
    H.clearLogs();
    H.opNpc(p, npc, 3);
    for (let t = 0; t < 600 && H.invCount(p, 'raw_mantaray') < 3; t++) H.tick(1);
    check('at 99 manta rays come up', H.invCount(p, 'raw_mantaray') > 0, true);
    console.log(`       (${H.invCount(p, 'raw_mantaray')} manta, ${H.invCount(p, 'raw_seaturtle')} turtle in 600 ticks)`);
}
{
    const p = player('nokit', 99);
    H.clearInv(p); // no harpoon
    const npc = H.npcNear('wildyfish', spots()[0][0], spots()[0][1])!;
    H.clearLogs();
    H.opNpc(p, npc, 3);
    for (let t = 0; t < 20; t++) H.tick(1);
    check('without a harpoon it catches nothing', H.invCount(p, 'raw_seaturtle') + H.invCount(p, 'raw_mantaray'), 0);
}

console.log('');
console.log(`${R.ok} passed, ${R.bad} failed`);
process.exit(R.bad ? 1 : 0);
