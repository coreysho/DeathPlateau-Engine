// SHAPING THE SLUG MENACE RUNES FROM PURE ESSENCE (DeathPlateau-Bugs#112).
//
// The shaping step only looked for rune essence, so a player at the pages with a pack of pure essence
// was told they had none. Either works; rune essence is used first.
//
//   npx tsx tools/sim/slugpure.ts
import * as H from './harness.js';

await H.boot();
let ok = 0;
let fail = 0;
function check(name: string, cond: boolean, detail = '') {
    if (cond) {
        ok++;
        console.log('  ok   ' + name);
    } else {
        fail++;
        console.log('  FAIL ' + name + (detail ? '  -- ' + detail : ''));
    }
}

function setup(name: string) {
    const p: any = H.makePlayer(name, 2721, 3304);
    H.tick(2);
    p.teleport(2721, 3304, 0);
    p.applyDamage = function () {};
    H.maxOut(p);
    H.give(p, 'chisel');
    H.give(p, 'slug_page1');
    H.tick(1);
    return p;
}
// Shape until a rune appears or the stock is gone; a failed stage destroys the essence and the player tries again.
function shapeAll(p: any, essence: string) {
    let tries = 0;
    while (H.invCount(p, 'slug_blank_air_rune') === 0 && H.invCount(p, essence) > 0 && tries++ < 400) {
        H.opheld(p, 'slug_page1', 3);
        H.tick(2);
    }
    return tries;
}

console.log('PURE ESSENCE ONLY');
let p = setup('slugpure1');
H.give(p, 'blankrune_high', 40);
const before = H.invCount(p, 'blankrune_high');
shapeAll(p, 'blankrune_high');
check('a blank air rune is made', H.invCount(p, 'slug_blank_air_rune') === 1, 'runes=' + H.invCount(p, 'slug_blank_air_rune'));
check('pure essence was spent', H.invCount(p, 'blankrune_high') < before);

console.log('BOTH ESSENCES: RUNE ESSENCE GOES FIRST');
p = setup('slugpure2');
H.give(p, 'blankrune', 1);
H.give(p, 'blankrune_high', 5);
H.opheld(p, 'slug_page1', 3);
H.tick(2);
check('rune essence was the one used', H.invCount(p, 'blankrune') === 0 && H.invCount(p, 'blankrune_high') === 5);

console.log('NO ESSENCE AT ALL');
p = setup('slugpure3');
H.opheld(p, 'slug_page1', 3);
H.tick(2);
check('nothing is made', H.invCount(p, 'slug_blank_air_rune') === 0);

console.log(`\n${ok} ok, ${fail} FAIL`);
process.exit(fail ? 1 : 0);
