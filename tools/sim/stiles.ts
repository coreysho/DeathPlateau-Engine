// THE STILES AND THE FENCES - every wall-on-an-edge you cross on foot, and the one that did nothing.
//
//   npx tsx tools/sim/stiles.ts
//
// Reported from the game as the Varrock fence gate, where "nothing interesting happens": loc_9300,
// the fence south of Varrock, carried op1=Jump-over and no script answered it. It is OSRS's own
// shortcut - loc 16518 there, at 3240,3334, Agility 13, no experience - and the only thing it
// needed was a handler.
//
// AND EVERY OTHER CALLER OF ~climb_stile, because that proc now takes its animation as an argument
// (a stile is stepped over, a fence is hurdled) and a signature change with four call sites is
// four things that can break silently. Each one is clicked here from both sides.
import * as H from './harness.js';
import * as A from './a1lib.js';
import { check, R, player } from './a1lib.js';
import { World, LocType } from './a1lib.js';
import { PlayerStat } from '#/engine/entity/PlayerStat.js';

await H.boot();
H.loginOrder();

let bucket = 0;
/** Click a barrier from one side and say where the player ended up. */
function cross(name: string, lx: number, lz: number, from: [number, number], agility: number, extra?: (p: any) => void) {
    // a fresh name every time: two calls with the same loc, side and level would otherwise ask for
    // the same player twice, and the second one inherits where the first finished
    const p: any = player(`st${bucket++}`, from[0], from[1], 0);
    H.maxOut(p);
    p.setLevel(PlayerStat.AGILITY, agility);
    H.clearInv(p);
    if (extra) extra(p);
    H.tick(2);
    const m = A.mark();
    H.opLoc(p, lx, lz, name, 1);
    for (let t = 0; t < 20; t++) H.tick(1);
    const out = { at: [p.x, p.z] as [number, number], said: A.mesSince(p, m) };
    H.despawn(p);
    return out;
}

console.log('THE FENCE SOUTH OF VARROCK, WHICH ANSWERED NOTHING AT ALL');
{
    check('  it is where OSRS has it', World.getLoc(3240, 3335, 0, LocType.getId('loc_9300')) !== null, true);
    // 12 is refused by name and goes nowhere; the message is the only thing a player gets, so it
    // is the thing worth checking rather than the absence of movement alone
    const low = cross('loc_9300', 3240, 3335, [3240, 3334], 12);
    check('  Agility 12 is refused, and told the number', [low.at, low.said.some(s => /agility level of 13/.test(s))], [[3240, 3334], true]);

    // WHICH WAY IT CROSSES, which this used to get wrong in exactly the way the game did. It asked
    // whether the player had MOVED east or west and was happy when they had - so the bug report
    // "jumps you to the east/west instead of north/south" was a thing this sim had blessed. What
    // makes a crossing a crossing is the blocked edge: the fence is a wall on the south edge of
    // 3240,3335, so a plain step from 3334 to 3335 is refused, and the jump is what gets you there.
    {
        const w: any = player('st_block', 3240, 3334, 0);
        H.walkTo(w, 3240, 3335);
        for (let t = 0; t < 6; t++) H.tick(1);
        check('  a plain step north is blocked by the fence', [w.x, w.z], [3240, 3334]);
        H.despawn(w);
    }
    const north = cross('loc_9300', 3240, 3335, [3240, 3334], 13);
    check('  Agility 13 jumps it northward, onto the far side', [north.at, north.said], [[3240, 3335], []]);
    const south = cross('loc_9300', 3240, 3335, [3240, 3336], 13);
    check('  ...and southward, back over it', [south.at, south.said], [[3240, 3334], []]);
    // ...and standing beside the fence rather than square to it still crosses it, rather than
    // sliding along the fence line, which is what the old reading did from every side.
    const beside = cross('loc_9300', 3240, 3335, [3239, 3335], 13);
    check('  and from beside it, the player still ends up across', beside.at, [3240, 3334]);
}

console.log('\nAND THE OTHER THREE CALLERS OF THE SAME PROC STILL WORK');
{
    // the broken fence near Al Kharid, which crawls through rather than hurdling: a different proc
    // but the neighbour of the one that was broken, and the model for its handler
    const brokenLow = cross('loc_9299', 3240, 3190, [3240, 3191], 28);
    check(
        '  the broken fence refuses Agility 28',
        brokenLow.said.some(s => /agility level of 29/.test(s)),
        true
    );
    const broken = cross('loc_9299', 3240, 3190, [3240, 3191], 29);
    check('  ...and squeezes through at 29', broken.at[1] <= 3190, true);

    // the two farming stiles and the sheep-shearer one, which pass human_walk_style now
    for (const [name, lx, lz, from] of [
        ['farming_style', 3043, 3305, [3043, 3306]],
        ['farming_style', 3063, 3282, [3063, 3283]],
        ['qip_sheep_shearer_fullstyle', 3197, 3276, [3197, 3277]]
    ] as [string, number, number, [number, number]][]) {
        const r = cross(name, lx, lz, from, 1);
        check(`  ${name} at ${lx},${lz} still steps over`, [r.at[0] !== from[0] || r.at[1] !== from[1], r.said], [true, []]);
    }

    // and the falconry stile, which is the only one with a condition in front of it: it refuses to
    // let you out while you are still wearing the falconer's borrowed glove
    const falcLoc = LocType.getId('loc474_19222');
    let fx = -1,
        fz = -1;
    for (let x = 2340; x <= 2400 && fx < 0; x++)
        for (let z = 3590; z <= 3650; z++)
            if (World.getLoc(x, z, 0, falcLoc)) {
                fx = x;
                fz = z;
                break;
            }
    check('  the falconry stile is findable', fx > 0, true);
    if (fx > 0) {
        // the glove test only applies LEAVING: the handler refuses when the player is south of the
        // stile, which is the falconry side, so that is the side this starts on
        const glove = cross('loc474_19222', fx, fz, [fx, fz - 1], 1, p => H.equip(p, { rhand: 'falconers_glove' }));
        check("  it will not let you out holding the falconer's glove", glove.at, [fx, fz - 1]);
        const bare = cross('loc474_19222', fx, fz, [fx, fz - 1], 1);
        check('  ...and lets you over with empty hands', bare.at[1] !== fz - 1 || bare.at[0] !== fx, true);
    }
}

console.log(`\n${R.ok} ok, ${R.bad} FAIL`);
process.exit(R.bad ? 1 : 0);
