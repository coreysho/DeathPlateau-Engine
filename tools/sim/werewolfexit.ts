// THE WAY BACK OUT, which the lap sim never tested.
//
// werewolfrun.ts walks the course and takes the trapdoor DOWN, and stops there. The ladder back up
// was written from the trapdoor's own coordinates and never once climbed, so if 3543,3463 is not a
// tile a player can stand on, every player who goes down is stuck underground until they teleport.
// That is the sort of thing worth finding before somebody else does.
//
// Also: the refusal messages talk about a werewolf standing over the trapdoor. If he is not
// actually spawned up there, the course refuses players in the name of somebody who is not in the
// room, and the surface end of this needs a look.
import * as H from './harness.ts';
import * as A from './a1lib.ts';
import { check, R, player } from './a1lib.ts';
import { thinAir } from './mapfloor.ts';
import { canTravel, isFlagged } from '#/engine/GameMap.js';
import { CollisionFlag, CollisionType } from '#/engine/routefinder/index.js';

await H.boot();

const DIRS: [number, number][] = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const stand = (x: number, z: number, lv = 0) =>
    DIRS.some(([dx, dz]) => canTravel(lv, x - dx, z - dz, dx, dz, 1, 0, CollisionType.NORMAL));
const open = (x: number, z: number, lv = 0) => !isFlagged(x, z, lv, CollisionFlag.WALK_BLOCKED);

for (const [x, z] of [[3543, 3463], [3549, 9865], [3543, 9862]] as [number, number][]) {
    const p = H.makePlayer(`wx_${x}_${z}`, x, z);
    p.teleport(x, z, 0);
    H.tick(2);
}

console.log('\n================ THE SURFACE END OF THE WEREWOLF COURSE');

console.log('\n  the ladder puts the player somewhere real');
{
    const x = 3543;
    const z = 3463;
    check(`    ${x},${z} is open`, open(x, z), true);
    check(`    ${x},${z} can be stood on`, stand(x, z), true);
    check(`    ${x},${z} is not thin air`, !thinAir(x, z, 0), true);
}

console.log('\n  and climbing it actually gets you there');
{
    const p: any = player('werewolf_out', 3549, 9865, 0);
    H.setVar(p, 'tutorial', 1000);
    A.op(p, 3549, 9864, 'loc_5130', 1);
    H.tick(12);
    check(`    up the ladder -> ${p.x},${p.z}`, `${p.x},${p.z}`, '3543,3463');
    // and back down again, so the pair is a loop rather than a one-way trip
    H.setVar(p, 'fenk_quest', 99);
    H.equip(p, { ring: 'ring_of_charos' });
    A.op(p, 3543, 3462, 'loc_5131', 1);
    H.tick(6);
    A.op(p, 3543, 3462, 'loc_5132', 1);
    H.tick(10);
    check(`    and down the trapdoor again -> ${p.x},${p.z}`, `${p.x},${p.z}`, '3543,9862');
    H.despawn(p);
}

console.log('\n  the werewolf the refusals name');
{
    const guard = H.npcNear('waa_werewolf_guard', 3543, 3462, 0);
    check('    waa_werewolf_guard is spawned by the trapdoor', guard !== null,
        guard !== null ? true : 'NOT SPAWNED - the refusal messages describe somebody who is not there');
    if (guard) {
        console.log(`      he is at ${guard.x},${guard.z}`);
    }
}

console.log(`\n${R.ok} ok, ${R.bad} FAIL`);
process.exit(R.bad ? 1 : 0);
