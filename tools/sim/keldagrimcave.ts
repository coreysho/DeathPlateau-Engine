// THE CAVE INTO KELDAGRIM (DeathPlateau-Bugs#115).
//
// A player who knows the main game looks for a cave entrance into Keldagrim. The one this build had
// was placed once, at 2838,10123, in a sealed two-tile pocket, and nothing answered its op - so there
// was no cave to find and no way to click it if there were. It now stands beside Hammerspike in the
// tunnels and takes the cart ride without the conversation.
//
//   npx tsx tools/sim/keldagrimcave.ts
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

console.log('WHERE IT STANDS');
const placed = H.locsNear('dwarf_cave_entrance', 2965, 9811);
check('exactly one is placed', placed.length === 1, JSON.stringify(placed));
const at = placed[0];
check('it is in the dwarven mine tunnels, within 10 tiles of Hammerspike', !!at && Math.abs(at.x - 2965) <= 10 && Math.abs(at.z - 9811) <= 10, JSON.stringify(at));

function play(startVal: number, label: string) {
    console.log(label);
    const p: any = H.makePlayer('keldcave' + startVal, 2966, 9811);
    H.tick(2);
    p.teleport(2966, 9811, 0);
    p.applyDamage = function () {};
    H.setVar(p, 'macro_event', 1);
    H.setVarBit(p, 'giantdwarf_quest', startVal);
    H.tick(1);
    check('click accepted on foot from the Hammerspike tile', H.opLoc(p, at.x, at.z, 'dwarf_cave_entrance', 1) === true);
    for (let i = 0; i < 40 && !(p.z > 10000); i++) H.tick(1);
    check('player ends up in Keldagrim', p.z > 10000 && p.x < 3000, `at ${p.x},${p.z}`);
    return p;
}

const fresh = play(0, 'A PLAYER WHO HAS NEVER BEEN HERE');
check('the quest is now at the refused stage (the city is open to them)', H.getVarBit(fresh, 'giantdwarf_quest') === 10, 'quest=' + H.getVarBit(fresh, 'giantdwarf_quest'));

const mid = play(40, 'A PLAYER PART WAY THROUGH THE QUEST');
check('their progress is untouched', H.getVarBit(mid, 'giantdwarf_quest') === 40, 'quest=' + H.getVarBit(mid, 'giantdwarf_quest'));

console.log(`\n${ok} ok, ${fail} FAIL`);
process.exit(fail ? 1 : 0);
