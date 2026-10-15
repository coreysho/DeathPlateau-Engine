// MONKEY MADNESS'S LAUNCH PANEL, both routes. Wiki step 9: "Solve the sliding puzzle on the
// south-eastern panel in the hangar, or pay Glough 200,000 in the Stronghold."
//
// This is its own sim rather than steps in quest_mm_run.ts for two reasons. Driving a twenty-four
// piece sliding puzzle through a manifest would be a hundred clicks that test the puzzle rather than
// the quest; and Glough is in a sealed cage, so the walked runner cannot get line of sight to him -
// he has an [apnpc1] now, which works when you are standing against the bars but not from across
// the room the runner's pathfinder leaves you in.
//
//   npx tsx tools/sim/mmpanel.ts
import * as H from './harness.js';
import { check, R, drive, findNpc } from './a1lib.js';
import ObjType from '#/cache/config/ObjType.js';
import InvType from '#/cache/config/InvType.js';

await H.boot();

const PIECES = 24;

// The slide is [opheld5,_trail_puzzle_piece] - an op 5 on a piece inside the puzzle interface's own
// inventory, which the client sends as an InvButton. bankux.ts drives the bank the same way.
const inv = InvType.getId('trail_puzzleinv');

console.log('=== THE PANEL, in the hangar');
{
    const p: any = H.makePlayer('panel', 2586, 4508);
    H.tick(2);
    p.teleport(2586, 4508, 0);
    H.setVar(p, 'mm_main', 3); // ^mm_in_hangar
    H.tick(1);

    H.clearLogs();
    H.opLoc(p, 2586, 4507, 'bunker_controlpanal', 1);
    for (let i = 0; i < 12; i++) H.tick(1);
    const opened = H.ifaces.some(f => f.who === p.username);
    check('clicking the panel opens the puzzle', opened, true);

    // THE SLIDE ITSELF IS NOT MINE. [opheld5,_trail_puzzle_piece] is the clue-scroll code and has
    // been driving puzzle boxes since long before this quest touched it; the harness cannot post a
    // click into a dummy inv (InvButtonHandler wants the component visible and an iop on it, and
    // the real client sends an OpHeld for these). What IS new is the completion hook at the end of
    // that trigger, so its two conditions are asserted here instead of through the packet layer.
    for (let i = 0; i < PIECES; i++) {
        p.invSet(inv, ObjType.getId('trail_slidingpuzzleb' + String(i + 1).padStart(2, '0')), 1, i);
    }
    H.tick(1);
    check('a solved board reads as solved', H.runProc(p, '[proc,trail_puzzle_complete]'), [1]);
    const inHangar = p.x >= 2560 && p.x <= 2623 && p.z >= 4480 && p.z <= 4543;
    check('  and the player is inside the hangar zone the hook checks', inHangar, true);
    check('  so the panel is still shut until the last piece moves', H.getVarBit(p, 'mm_hangar_puzzle_complete'), 0);
}

console.log('\n=== THE SAME PUZZLE AS A CLUE, in Varrock, which must NOT open anything');
{
    const p: any = H.makePlayer('cluer', 3210, 3424);
    H.tick(2);
    p.teleport(3210, 3424, 0);
    H.setVar(p, 'mm_main', 3); // the same stage, nowhere near the hangar
    H.tick(1);
    for (let i = 0; i < PIECES; i++) {
        p.invSet(inv, ObjType.getId('trail_slidingpuzzleb' + String(i + 1).padStart(2, '0')), 1, i);
    }
    H.tick(1);
    // The board is solved and the stage matches; the only thing standing between this player and an
    // open hangar on the far side of the world is the zone guard, so that is what is asserted.
    check('a clue puzzle solved in Varrock is solved', H.runProc(p, '[proc,trail_puzzle_complete]'), [1]);
    const inHangar = p.x >= 2560 && p.x <= 2623 && p.z >= 4480 && p.z <= 4543;
    check('  but the player is nowhere near the hangar', inHangar, false);
    check('  and the hangar stays shut', H.getVarBit(p, 'mm_hangar_puzzle_complete'), 0);
}

console.log('\n=== GLOUGH, through the bars of his cage');
{
    const p: any = H.makePlayer('bribe', 2479, 3465);
    H.tick(2);
    H.setVar(p, 'grandtree', 160); // The Grand Tree complete
    H.setVar(p, 'mm_main', 3);
    H.give(p, 'coins', 200000);
    H.tick(2);
    H.clearLogs();
    // HE WANDERS INSIDE HIS CAGE. Nothing overrides wanderrange for grandtree_glough and the engine
    // defaults it to 5, so his tile moves between runs - and glough.rs2's own header says the cage
    // is sealed and "no tile beside him can be walked to", which is why it carries an [apnpc1] as
    // well as an [opnpc1]. "Him plus one north" is therefore a coin toss: it is against the bars on
    // one run and across them on the next, and an op that cannot reach prints nothing, so all three
    // checks here failed on a sweep run that had passed 10 of 10 the night before. Re-read his tile
    // and try the tiles around him until one of them gets the dialogue started.
    let lines: string[] = [];
    let stood: number[] | null = null;
    for (const [dx, dz] of [
        [0, 1],
        [0, -1],
        [1, 0],
        [-1, 0],
        [0, 2],
        [0, -2],
        [2, 0],
        [-2, 0]
    ]) {
        const g = findNpc('grandtree_glough', p);
        p.teleport(g.x + dx, g.z + dz, g.level);
        H.tick(1);
        H.opNpc(p, g, 1);
        for (let i = 0; i < 25 && !p.activeScript; i++) H.tick(1);
        if (p.activeScript) {
            stood = [g.x + dx, g.z + dz];
            lines = drive(p, [1]);
            break;
        }
    }
    if (!stood) console.log('    [debug] no tile around Glough started the dialogue; he was at', findNpc('grandtree_glough', p).x, findNpc('grandtree_glough', p).z);
    check('he offers the code', lines.join(' ').includes('fair price'), true);
    check('  takes the 200,000', H.invCount(p, 'coins'), 0);
    check('  and the hangar opens', H.getVarBit(p, 'mm_hangar_puzzle_complete'), 1);
}

console.log('');
console.log(R.ok + ' ok, ' + R.bad + ' FAIL');
process.exit(R.bad ? 1 : 0);
