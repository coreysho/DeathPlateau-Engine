// THE EDGEVILLE DUNGEON OBSTACLE PIPE ACTUALLY CROSSES.
// Usage: npx tsx tools/sim/edgepipe.ts   (exit code is the verdict)
//
// loc_9295 shipped with op1=Squeeze-through and nothing behind it, so the only link between the two
// halves of the dungeon did nothing when clicked. The two sides are joined by this pipe and by
// nothing else, which is the first thing asserted here: if a flood fill ever finds another way
// round, the rest of this is measuring a shortcut that is not one.
import * as H from './harness.js';
import { check, R, player, connected } from './a1lib.js';

await H.boot();

const WEST: [number, number] = [3149, 9906];
const EAST: [number, number] = [3155, 9906];
const PIPE_W: [number, number] = [3150, 9906];
const PIPE_E: [number, number] = [3153, 9906];

const cross = (p: any, from: [number, number], pipe: [number, number], ticks = 20) => {
    p.teleport(from[0], from[1], 0);
    H.tick(1);
    H.opLoc(p, pipe[0], pipe[1], 'loc_9295', 1);
    for (let t = 0; t < ticks; t++) H.tick(1);
    return [p.x, p.z];
};

console.log('== the pipe is the only way between the two halves');
check('no walk route round it', connected(0, WEST[0], WEST[1], EAST[0], EAST[1]), false);

console.log('\n== 51 Agility, and not a level less');
{
    const p: any = player('pipelow', WEST[0], WEST[1], 0);
    p.setLevel(16, 50); // agility
    // ~mesbox is interface text, not a chat line, so it lands in H.ifaces rather than H.mesgs.
    const from = H.ifaces.length;
    const at = cross(p, WEST, PIPE_W);
    check('at 50 you do not get through', at, [WEST[0], WEST[1]]);
    const shown = H.ifaces
        .slice(from)
        .filter(i => i.who === p.username && i.kind === 'text')
        .map(i => i.text ?? '');
    check(
        '  and it says why',
        shown.some(m => m.includes('Agility level of 51')),
        true
    );
}

console.log('\n== and at 51 it crosses, both ways');
{
    const p: any = player('pipego', WEST[0], WEST[1], 0);
    p.setLevel(16, 51);
    check('west -> east', cross(p, WEST, PIPE_W), [EAST[0], EAST[1]]);
    check('east -> west', cross(p, EAST, PIPE_E), [WEST[0], WEST[1]]);
}

// Clicking the FAR half from the wrong side is the engine's business and not this script's: the far
// loc has no interaction tile a player on the other side can stand on, so the click never arrives
// and they walk into the rock instead. Asserted so that it stays a walk and never becomes a
// crossing that starts from the wrong mouth.
console.log('\n== and clicking the far half from the wrong side does not teleport you anywhere');
{
    const p: any = player('pipefar', WEST[0], WEST[1], 0);
    p.setLevel(16, 51);
    const at = cross(p, WEST, PIPE_E);
    check('still on the west side', at[0] <= PIPE_W[0], true);
    const at2 = cross(p, EAST, PIPE_W);
    check('still on the east side', at2[0] >= PIPE_E[0], true);
}

console.log('\n== ten experience a crossing, and no damage');
{
    const p: any = player('pipexp', WEST[0], WEST[1], 0);
    p.setLevel(16, 51);
    const before = p.getStatXp ? p.getStatXp(16) : (p as any).stats[16];
    const hp = p.levels[3];
    cross(p, WEST, PIPE_W);
    const after = p.getStatXp ? p.getStatXp(16) : (p as any).stats[16];
    check('10 Agility xp (in tenths)', after - before, 100);
    check('and it does not hurt you', p.levels[3], hp);
}

console.log(`\n${R.ok} ok, ${R.bad} FAIL`);
process.exit(R.bad ? 1 : 0);
