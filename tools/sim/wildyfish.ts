// THE WILDERNESS FISHING SPOT: sea turtle and manta ray among the west dragons.
//
//   npx tsx tools/sim/wildyfish.ts
//
// Suggestion #10. The point of the spot is that it is a SIDEGRADE to the Fishing Trawler - same
// rolls, same xp, more risk - so most of what is checked here is that it really is one: the catch
// rates are the shark's own numbers and the xp is unchanged, because a Wilderness spot that simply
// out-earned the Trawler would replace it rather than add to it.
import * as H from './harness.js';
import NpcType from '#/cache/config/NpcType.js';
import ParamType from '#/cache/config/ParamType.js';
import StructType from '#/cache/config/StructType.js';
import Player from '#/engine/entity/Player.js';
import { PlayerStat } from '#/engine/entity/PlayerStat.js';
import { isFlagged, isZoneAllocated } from '#/engine/GameMap.js';
import { CollisionFlag } from '#/engine/routefinder/index.js';

await H.boot();
H.loginOrder();

const R = { ok: 0, bad: 0 };
const check = (what: string, got: unknown, want: unknown) => {
    const pass = JSON.stringify(got) === JSON.stringify(want);
    if (pass) R.ok++;
    else R.bad++;
    console.log(`  ${pass ? 'ok  ' : 'FAIL'} ${what}: ${JSON.stringify(got)}${pass ? '' : `   (want ${JSON.stringify(want)})`}`);
};

const SPOT: [number, number] = [2977, 3616];
const TURTLE = 79;
const sp = (name: string, p: string) => StructType.get(StructType.getId(name)).params.get(ParamType.getId(p));

let bucket = 1;
function player(name: string, fishing: number): Player {
    const p = H.makePlayer(name, SPOT[0] + 1, SPOT[1], bucket++);
    H.tick(2);
    H.maxOut(p);
    H.clearInv(p);
    p.setLevel(PlayerStat.FISHING, fishing);
    H.give(p, 'harpoon', 1);
    return p;
}

console.log('== the spot is where the dragons are');
{
    const [x, z] = SPOT;
    const npc = H.npcNear('wildyfish', x, z);
    check('it is spawned', npc ? `${npc.x},${npc.z}` : 'nowhere', `${x},${z}`);
    check('on a tile a player can reach', isZoneAllocated(0, x + 1, z) && !isFlagged(x + 1, z, 0, CollisionFlag.WALK_BLOCKED), true);
    const t = NpcType.get(NpcType.getId('wildyfish'));
    check('it does not drift', t.wanderrange, 0);
    check('and offers Harpoon', t.op[2], 'Harpoon');
    // Level 13 Wilderness: (3616 - 3520) / 8 + 1. Deep enough to matter, shallow enough to leave.
    check('at Wilderness level 13', Math.floor((z - 3520) / 8) + 1, 13);
    // the three green dragons it was put among
    const near = [
        [2973, 3620],
        [2977, 3611],
        [2982, 3618]
    ].map(([dx, dz]) => Math.max(Math.abs(dx - x), Math.abs(dz - z)));
    check(
        'within five tiles of all three west dragons',
        near.every(d => d <= 5),
        true
    );
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
    const npc = H.npcNear('wildyfish', SPOT[0], SPOT[1])!;
    H.clearLogs();
    H.opNpc(p, npc, 3);
    for (let t = 0; t < 20; t++) H.tick(1);
    check('below 79 catches nothing', H.invCount(p, 'raw_seaturtle') + H.invCount(p, 'raw_mantaray'), 0);
}
{
    // At 79 the turtle is reachable and the manta is not - the roll only offers what you can catch.
    const p = player('turtler', TURTLE);
    const npc = H.npcNear('wildyfish', SPOT[0], SPOT[1])!;
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
    const npc = H.npcNear('wildyfish', SPOT[0], SPOT[1])!;
    H.clearLogs();
    H.opNpc(p, npc, 3);
    for (let t = 0; t < 600 && H.invCount(p, 'raw_mantaray') < 3; t++) H.tick(1);
    check('at 99 manta rays come up', H.invCount(p, 'raw_mantaray') > 0, true);
    console.log(`       (${H.invCount(p, 'raw_mantaray')} manta, ${H.invCount(p, 'raw_seaturtle')} turtle in 600 ticks)`);
}
{
    const p = player('nokit', 99);
    H.clearInv(p); // no harpoon
    const npc = H.npcNear('wildyfish', SPOT[0], SPOT[1])!;
    H.clearLogs();
    H.opNpc(p, npc, 3);
    for (let t = 0; t < 20; t++) H.tick(1);
    check('without a harpoon it catches nothing', H.invCount(p, 'raw_seaturtle') + H.invCount(p, 'raw_mantaray'), 0);
}

console.log('');
console.log(`${R.ok} passed, ${R.bad} failed`);
process.exit(R.bad ? 1 : 0);
