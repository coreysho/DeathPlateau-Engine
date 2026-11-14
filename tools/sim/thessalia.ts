// THESSALIA'S WOMEN'S TROUSERS - the seven styles, and the one you clicked is the one you get.
//
//   npx tsx tools/sim/thessalia.ts
//
// This window was wired wrong in two separate ways and both ways compiled, ran, and looked fine.
//
// ONE: THE HANDLER BLOCK WAS SHIFTED ALONG THE ROW. The seven style buttons are com_132..com_138
// and the script claimed com_133..com_140 for %if1 = 1..8. com_132 is "Plain" - the first button
// in the window - so it did nothing at all, every other style stored the value belonging to the
// button to its left, and the last two handlers sat on com_139 and com_140, which are not buttons
// but the 25x25 overlay_multiway tick graphics that mark the current selection.
//
// TWO: VALUES 4 AND 5 WERE SWAPPED. Even with the row lined up, %if1 = 4 set woman_legs_longskirt
// and 5 set woman_legs_longskirt_narrow, and the buttons the cache gives those values to are
// "Long Narrow Skirt" and "Long Skirt" in that order.
//
// THE CACHE SETTLES BOTH, which is why none of the mapping below is anybody's taste. Each button
// carries a client-side highlight script (script1op1=pushvar,if1 / script1=eq,N) naming the %if1
// value that means "I am chosen", and each is drawn beside a preview model whose own name says
// which idkit it is promising. tools/sim/ifselect.ts is the general form of the first half and
// fails on any select button whose handler stores a value the cache does not highlight on. This
// file is the second half: it clicks each button for real and checks what comes out the other
// end, which is the part no cross-reference can do.
//
// NOTE THE GAP AT 6. %if1 = 6 is woman_legs_tatty, and 377 put no button for it in this window -
// the seven ticks com_139..com_145 cover {1,2,3,4,5,7,8} and six is not among them. A dense 1..7
// here would run and still be wrong: the highlight would land on the wrong button.
import * as H from './harness.js';
import { check, R } from './a1lib.js';
import Component from '#/cache/config/Component.js';
import IdkType from '#/cache/config/IdkType.js';

await H.boot();

/** button name, the label the player reads, the %if1 the cache highlights on, the idkit it owes. */
const STYLES: [string, string, number, string][] = [
    ['com_132', 'Plain', 1, 'woman_legs_basic'],
    ['com_133', 'Shorts', 2, 'woman_legs_basic2'],
    ['com_134', 'Flares', 3, 'woman_legs_flares'],
    ['com_135', 'Long Narrow Skirt', 4, 'woman_legs_longskirt_narrow'],
    ['com_136', 'Long Skirt', 5, 'woman_legs_longskirt'],
    ['com_137', 'Turn-ups', 7, 'woman_legs_turnups'],
    ['com_138', 'Short Skirt', 8, 'woman_legs_shortskirt']
];
const IFACE = 'player_kit_tailor_legs_woman';
/**
 * Player.body index for the legs. SETIDKIT stores at idkType.type, less 7 for a woman, and every
 * woman_legs kit is type 12 - so 5, the sixth of the seven appearance slots.
 */
const LEGS_SLOT = 5;
/** Player.colors index SETIDKIT recolours for a legs kit. */
const LEGS_COLOUR = 2;

console.log('THE CACHE AND THE TABLE ABOVE AGREE');
for (const [com, label, value] of STYLES) {
    const c = Component.get(Component.getId(`${IFACE}:${com}`));
    check(`${com} is the "${label}" button`, (c as unknown as { option?: string }).option, label);
    check(`  and it highlights on %if1 = ${value}`, c.scriptOperand?.[0], value);
}

console.log('CLICKING A STYLE STORES THE VALUE THE CACHE HIGHLIGHTS ON');
{
    const p = H.makePlayer('thessalia1', 3206, 3417);
    H.tick(3);
    p.gender = 1;
    for (const [com, label, value] of STYLES) {
        H.setVar(p, 'if1', 0);
        H.ifButton(p, `${IFACE}:${com}`);
        check(`"${label}" sets %if1 = ${value}`, H.getVar(p, 'if1'), value);
    }
    H.despawn(p);
}

console.log('AND CONFIRM HANDS OVER THAT STYLE');
{
    for (const [com, label, , kit] of STYLES) {
        const p = H.makePlayer(`thess_${com}`, 3206, 3417);
        H.tick(3);
        p.gender = 1;
        H.give(p, 'coins', 500);
        H.ifButton(p, `${IFACE}:${com}`);
        // Khaki as well, so the colour half is exercised too. The legs palette in the client is
        // the torso palette rotated by one, and the cache compensates: com_91 "Khaki" highlights
        // on %if3 = 2, and $color is %if3 - 1, so khaki legs are colour 1 and not 0.
        H.ifButton(p, `${IFACE}:com_91`);
        H.ifButton(p, `${IFACE}:confirm`);
        check(`"${label}" -> ${kit}`, p.body[LEGS_SLOT], IdkType.getId(kit));
        check('  in khaki', p.colors[LEGS_COLOUR], 1);
        check('  and it cost 500 coins', H.invCount(p, 'coins'), 0);
        H.despawn(p);
    }
}

console.log('NO BUTTON IN THIS WINDOW CAN ASK FOR woman_legs_tatty');
{
    const reachable = new Set(STYLES.map(s => s[2]));
    check('%if1 = 6 is not one of the seven', reachable.has(6), false);
    check("  and the seven are the cache's seven", [...reachable].sort((a, b) => a - b).join(','), '1,2,3,4,5,7,8');
}

console.log(`\n${R.ok} ok, ${R.bad} FAIL`);
process.exit(R.bad ? 1 : 0);
