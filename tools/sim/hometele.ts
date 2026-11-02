// WHERE HOME TELEPORT PUTS YOU, one book at a time.
// Usage: npx tsx tools/sim/hometele.ts   (exit code is the verdict)
//
// All three books used to call one label with no argument and land everyone in Edgeville, which is
// also where ::home goes - two ways to the same square, one of them with a thirty-minute wait. The
// normal book now goes to Lumbridge again, the way 474 had it and the way this build had it before
// September. The destination travels as an argument through five weak queues, so what this asserts
// is that it arrives: the staging is the part that can silently drop it.
import * as H from './harness.js';
import { check, R, player } from './a1lib.js';

await H.boot();

// Falador, far from both destinations and not in the Wilderness, so "did it move" means something
// whichever book is being cast.
const START: [number, number] = [2965, 3380];

type Book = { com: string; what: string; where: [number, number]; place: string };
const BOOKS: Book[] = [
    { com: 'magic:home_teleport', what: 'the normal book', where: [3221, 3218], place: 'Lumbridge' },
    { com: 'ancient_magic:home_teleport', what: 'the Ancient Magicks', where: [3087, 3496], place: 'Edgeville' },
    // Old School sends this one to Lunar Isle; here it has only ever gone to Edgeville.
    { com: 'lunar_magic:lunar_home_teleport', what: 'Lunar', where: [3087, 3496], place: 'Edgeville' }
];

// map_findsquare searches two squares out, so the landing can be the chosen square or a neighbour.
const near = (p: { x: number; z: number }, w: [number, number]) => Math.abs(p.x - w[0]) <= 2 && Math.abs(p.z - w[1]) <= 2;

console.log('== each book lands where it should');
let n = 0;
for (const b of BOOKS) {
    const p = player('hometele' + n++, START[0], START[1]);
    H.setVar(p, 'home_teleport_last', 0);
    H.ifButton(p, b.com);
    H.tick(30);
    check(`${b.what} -> ${b.place}`, near(p, b.where) ? b.place : `(${p.x}, ${p.z})`, b.place);
}

// ---------------------------------------------------------------------------------------------
// The five stages are 7 + 6 + 3 + 5 + 3 = 24 ticks, which is Old School's cast time. A destination
// that failed to reach the last queue would land the player nowhere at all, and so would a stage
// that stopped chaining - checking the clock as well as the square tells those two apart.
console.log('\n== and takes the full cast to get there');
{
    const p = player('hometeleclock', START[0], START[1]);
    H.setVar(p, 'home_teleport_last', 0);
    H.ifButton(p, 'magic:home_teleport');
    let arrived = -1;
    for (let t = 1; t <= 40 && arrived === -1; t++) {
        H.tick(1);
        if (p.x !== START[0] || p.z !== START[1]) arrived = t;
    }
    // 7 + 6 + 3 + 5 + 3 stage delays, and the arrival queue runs the tick after the last of them.
    check('it lands on tick 25, not before', arrived, 25);
    check('and it lands in Lumbridge', near(p, [3221, 3218]), true);
}

// ---------------------------------------------------------------------------------------------
console.log('\n== the thirty-minute wait still bites');
{
    const p = player('hometelewait', START[0], START[1]);
    H.setVar(p, 'home_teleport_last', 0);
    H.ifButton(p, 'magic:home_teleport');
    H.tick(30);
    check('the first cast worked', near(p, [3221, 3218]), true);
    const was: [number, number] = [p.x, p.z];
    const from = H.mesgs.length;
    H.ifButton(p, 'magic:home_teleport');
    H.tick(30);
    check('the second does not move you', [p.x, p.z], was);
    const said = H.mesgs
        .slice(from)
        .filter(m => m.who === p.username)
        .map(m => m.text);
    check(
        'and says how long to wait',
        said.some(m => m.includes('wait another')),
        true
    );
}

// ---------------------------------------------------------------------------------------------
// Each stage waits in a WEAK queue so that doing anything else gives up the teleport. That is the
// one property the switch from weakqueue to weakqueue* could have quietly dropped - the starred
// form takes its arguments in a second bracket, and a plain queue would look identical until a
// player walked away mid-cast and got carried off anyway.
console.log('\n== and walking away still gives it up');
{
    const p = player('hometelewalk', START[0], START[1]);
    H.setVar(p, 'home_teleport_last', 0);
    H.ifButton(p, 'magic:home_teleport');
    H.tick(4);
    H.walkTo(p, START[0] + 4, START[1]);
    H.tick(30);
    check('still in Falador', Math.abs(p.x - START[0]) <= 6 && Math.abs(p.z - START[1]) <= 6, true);
    check('and the wait was not spent', H.getVar(p, 'home_teleport_last'), 0);
}

console.log(`\n${R.ok} ok, ${R.bad} FAIL`);
process.exit(R.bad ? 1 : 0);
