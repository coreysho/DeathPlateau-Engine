// THE TWO WILD BERRY BUSHES south-east of Varrock. Both were placed, named and examinable with no
// option on them, so neither could be picked - which left Romeo & Juliet's one item requirement
// obtainable only as an imp drop. Pick-from now works on both, and the bush is gone for two
// minutes afterwards.
//
//   npx tsx tools/sim/berrybushes.ts
import { H } from './a1lib.js';
import World from '#/engine/World.js';
import LocType from '#/cache/config/LocType.js';

await H.boot();

let ok = 0;
let bad = 0;
const check = (what: string, got: unknown, want: unknown) => {
    const good = JSON.stringify(got) === JSON.stringify(want);
    if (good) ok++;
    else {
        bad++;
        console.log('  FAIL ' + what + ': ' + JSON.stringify(got) + '   (want ' + JSON.stringify(want) + ')');
    }
};

const p: any = H.makePlayer('berries', 3273, 3375);
H.tick(2);
p.applyDamage = function () {};
H.setVar(p, 'macro_event', 1);
H.maxOut(p);
H.tick(1);

// Every bush the 377 map places, which is all of them: two cadava and three redberry, in the one
// patch by the south-east Varrock mine and nowhere else in the world.
const bushes: [string, number, number, string][] = [
    ['cadava_bush', 3272, 3375, 'cadavaberries'],
    ['cadava_bush', 3277, 3371, 'cadavaberries'],
    ['redberry_bush', 3268, 3370, 'redberries'],
    ['redberry_bush', 3271, 3367, 'redberries'],
    ['redberry_bush', 3277, 3374, 'redberries']
];

for (const [name, x, z, berry] of bushes) {
    const lt = LocType.get(LocType.getId(name));
    check(name + ' at ' + x + ',' + z + ' offers Pick-from on op3', lt.op?.[2] ?? null, 'Pick-from');
    p.teleport(x + 1, z, 0);
    H.tick(1);
    const before = H.invCount(p, berry);
    H.opLoc(p, x, z, name, 3);
    for (let t = 0; t < 12 && H.invCount(p, berry) === before; t++) H.tick(1);
    check('picking it gives ' + berry, H.invCount(p, berry) - before, 1);
    // and the bush goes with it, for two minutes
    const still = [...World.gameMap.getZone(x, z, 0).getAllLocsSafe()].some(
        l => l.x === x && l.z === z && l.type === LocType.getId(name)
    );
    check('the bush is picked bare', still, false);
}

console.log('');
console.log(ok + ' ok, ' + bad + ' FAIL');
process.exit(bad ? 1 : 0);
