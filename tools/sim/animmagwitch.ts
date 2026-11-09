// THE WITCH WHO MAKES THE MAGNET STANDS INSIDE THE MANOR.
// Usage: NODE_MEMBERS=true npx tsx tools/sim/animmagwitch.ts   (exit code is the verdict)
//
// Reported from play: "animal magnetism, magnet part, witch you speak to spawns outside". She did:
// her spawn in maps/m48_52.jm2 was "0 21 41: 4801", which is 3093,3369 - the strip of grass along
// Draynor Manor's west wall, outdoors, and not connected to the manor's inside at all. With the
// default wanderrange of 5 she then drifted, and was found at 3094,3373.
//
// The wiki puts her "in the north-western corner of Draynor Manor", and Ava in "the secret room of
// Draynor Manor, at the south-west part behind the hidden door next to the bookcase" - which is the
// "next door" the magnet dialogue means. So: 3098,3370, and wanderrange=0 so she stays there.
import * as H from './harness.js';
import * as A from './a1lib.js';
import { check, R, player } from './a1lib.js';
import World from '#/engine/World.js';
import NpcType from '#/cache/config/NpcType.js';
import VarPlayerType from '#/cache/config/VarPlayerType.js';
import { isIndoors } from '#/engine/GameMap.js';

await H.boot();
H.loginOrder();

const at = (name: string) => {
    const id = NpcType.getId(name);
    for (const npc of World.npcs) if (npc && npc.isActive && npc.type === id) return npc;
    return null;
};

console.log('== she is inside Draynor Manor, where Ava is');
{
    const witch = at('animmag_witch');
    check('the witch is in the world', witch !== null, true);
    if (witch) {
        // The spawn square itself, not wherever she has wandered to - wanderrange=0 makes them the same.
        check('  indoors', isIndoors(witch.x, witch.z, witch.level), true);
        check('  and standing on her own spawn', [witch.x, witch.z, witch.level], [3098, 3370, 0]);
    }
    const ava = at('animmag_ava');
    check('Ava is indoors too', ava ? isIndoors(ava.x, ava.z, ava.level) : false, true);
    // The same floor of the same building: she is north-west, Ava's secret room is south-west.
    if (witch && ava) {
        check('  on the same floor', witch.level, ava.level);
        check('  with Ava to the south', ava.z < witch.z, true);
    }
    // The old spawn, for the record: still walkable, still outdoors, still outside the manor.
    check('the old spawn was outdoors', isIndoors(3093, 3369, 0), false);
    check('  and no witch stands there now', at('animmag_witch')?.x !== 3093, true);
}

console.log('\n== and she is in the same room as the manor, not sealed into a pocket');
{
    // The lesson from the Lunar Isle bank: a tile can be walkable, indoors and impossible to leave.
    // The generic Draynor witch (the cache's own, unrelated to the quest) stands on this floor, so
    // her square is a fair "inside the manor" to flood-fill from.
    check('her square connects to the manor floor', A.connected(0, 3101, 3368, 3098, 3370, 400), true);
    // ...and a player can get beside her from inside, which is what talking needs.
    const beside: [number, number][] = [
        [3099, 3370],
        [3098, 3369],
        [3097, 3370]
    ];
    const reachable = beside.filter(([x, z]) => A.walkable(0, x, z) && A.connected(0, 3101, 3368, x, z, 400));
    check('  with free squares beside her', reachable.length >= 2, true);
}

console.log('\n== and talking to her gets the quest dialogue, not silence');
{
    const witch = at('animmag_witch')!;
    const p: any = player('amwitch', witch.x + 1, witch.z, 0);
    H.maxOut(p);
    H.clearInv(p);
    // Far enough into the quest that she has something to say: ^animmag_chickens_given is where she
    // starts answering, and below it she tells you to go away.
    p.setVar(VarPlayerType.getByName('animmag')!.id, 2);
    H.tick(1);
    H.clearLogs();
    H.opNpc(p, witch, 1);
    const lines = A.drive(p, ['Just tell me what you need'], 6);
    check('she answers', lines.length > 0, true);
    check('  and it is her, not a stranger', lines.join(' ').toLowerCase().includes('magnet') || lines.join(' ').toLowerCase().includes('ava'), true);
}

console.log(`\n${R.ok} ok, ${R.bad} FAIL`);
process.exit(R.bad ? 1 : 0);
