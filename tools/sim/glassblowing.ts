// GLASSBLOWING: every product the pipe can make, and the panel that now offers them.
//
//   npx tsx tools/sim/glassblowing.ts
//
// Reported from the game as "cant make candle lantern". The chooser was ~multiobj4 and glass.struct
// has had more products than that since the file was written, so the candle lantern, the oil lamp,
// the fishbowl and the lantern lens were unreachable - each of them a real OSRS product with a
// level and an experience value already sitting in the config. The narrow fix was ~multiobj7.
//
// This round replaces the chooser with 2006's own panel, skill_crafting/interfaces/
// glass_crafting.if, which was in the cache the whole time and which nothing opened: all seven
// products laid out with their models, and Make 1 / 5 / 10 / X on each. Twenty-eight buttons.
//
// Twenty-eight buttons is exactly what a reader cannot check. Every one is clicked here, and what
// comes out is compared against glass.struct through the obj's own param rather than against a
// second copy of the numbers - so a button wired to the wrong product, or the wrong count, is
// caught by the check that names it.
import { readFileSync } from 'fs';
import * as H from './harness.js';
import * as A from './a1lib.js';
import { check, R, player } from './a1lib.js';
import Component from '#/cache/config/Component.js';
import ObjType from '#/cache/config/ObjType.js';
import ParamType from '#/cache/config/ParamType.js';
import StructType from '#/cache/config/StructType.js';
import ScriptState from '#/engine/script/ScriptState.js';
import { PlayerStat } from '#/engine/entity/PlayerStat.js';

await H.boot();
H.loginOrder();

// level, product, experience in tenths - OSRS's own table off the Molten glass page
const WANT: [number, string, number][] = [
    [1, 'beer_glass', 175],
    [4, 'candle_lantern_empty', 190],
    [12, 'oil_lamp_empty', 250],
    [33, 'vial_empty', 350],
    [42, 'fishbowl_empty', 425],
    [46, 'stafforb', 525],
    [49, 'bullseye_lantern_lens', 550]
];
// The panel's own layout, read off glass_crafting.if: the first component of each group, then
// Make X, 10, 5, 1 in that order. The product each group is wired to is what has to agree.
const GROUPS: [number, string, string][] = [
    [10, 'vial_empty', 'Vial'],
    [14, 'stafforb', 'Orb'],
    [18, 'beer_glass', 'Beer Glass'],
    [22, 'candle_lantern_empty', 'Candle Lantern'],
    [26, 'oil_lamp_empty', 'Oil Lamp'],
    [30, 'bullseye_lantern_lens', 'Lantern Lens'],
    [34, 'fishbowl_empty', 'Fishbowl']
];
const PRODUCTS = WANT.map(w => w[1]);

const sp = (obj: string, p: string) => {
    const st = (ObjType.get(ObjType.getId(obj)) as any).params?.get(ParamType.getId('crafting_glass_struct'));
    return st === undefined ? null : ((StructType.get(st) as any).params?.get(ParamType.getId(p)) ?? null);
};

/** Answer a p_countdialog with `n`, the way ResumePCountDialogHandler does. */
function answerCount(q: any, n: number): boolean {
    for (let t = 0; t < 6; t++) {
        const s = q.activeScript;
        if (s && s.execution === ScriptState.COUNTDIALOG) {
            s.lastInt = n;
            q.executeScript(s, true, true);
            return true;
        }
        H.tick(1);
    }
    return false;
}

/** Open the panel with `glass` molten glass at Crafting `level`, click one button, and report. */
function make(name: string, com: number, glass: number, level = 99, countX?: number) {
    const p: any = player(name, 3200, 3200);
    p.setLevel(PlayerStat.CRAFTING, level);
    H.clearInv(p);
    H.give(p, 'glassblowingpipe', 1);
    // One piece is needed to open the panel at all, so the no-glass case opens it and then empties
    // the pocket - which is the state a player reaches by blowing their last piece.
    H.give(p, 'molten_glass', glass || 1);
    H.tick(1);
    const xp0 = p.stats[PlayerStat.CRAFTING];
    H.useHeldOn(p, 'molten_glass', 'glassblowingpipe');
    H.tick(1);
    if (!glass) {
        H.clearInv(p);
        H.give(p, 'glassblowingpipe', 1);
    }
    const m = A.mark();
    H.ifButton(p, `glass_crafting:com_${com}`);
    if (countX !== undefined) answerCount(p, countX);
    for (let t = 0; t < 150; t++) H.tick(1);
    const made: Record<string, number> = {};
    for (const obj of PRODUCTS) {
        const n = H.invCount(p, obj);
        if (n) made[obj] = n;
    }
    const out = { made, glass: H.invCount(p, 'molten_glass'), xp: p.stats[PlayerStat.CRAFTING] - xp0, said: A.mesSince(p, m) };
    H.despawn(p);
    return out;
}

console.log("THE CONFIG: every product carries a struct, and its numbers are the wiki's");
for (const [lvl, obj, xp] of WANT) {
    check(`  ${obj.padEnd(22)} level ${lvl}, ${xp / 10} experience`, [sp(obj, 'levelrequire') ?? 1, sp(obj, 'productexp')], [lvl, xp]);
}

console.log('\nA PIPE ON MOLTEN GLASS OPENS THE PANEL, which nothing used to open');
{
    // p.modalMain and not the interface log: openMainModal sets the player's modal state and the
    // IfOpenMain goes out on the next flush, which a harness with no socket on the other end does
    // not necessarily reach. The modal state is the engine's own answer to "what is open".
    const PANEL = Component.getId('glass_crafting');
    for (const [use, on] of [
        ['molten_glass', 'glassblowingpipe'],
        ['glassblowingpipe', 'molten_glass']
    ]) {
        const p: any = player(`gp_open_${use}`, 3200, 3200);
        H.clearInv(p);
        H.give(p, 'glassblowingpipe', 1);
        H.give(p, 'molten_glass', 5);
        H.tick(1);
        H.useHeldOn(p, use, on);
        H.tick(2);
        check(`  ${use} on ${on} opens glass_crafting`, p.modalMain, PANEL);
        check('    and opens no chat chooser with it', p.modalChat, -1);
        H.despawn(p);
    }
}

console.log('\nEVERY ONE OF THE TWENTY-EIGHT BUTTONS MAKES ITS OWN PRODUCT, in its own count');
{
    // Crafting 99 and twenty glass, so what is measured is the wiring and nothing else. One check
    // per button rather than a tally: a button crossed with its neighbour is then caught by the
    // check that names it.
    for (const [base, obj, label] of GROUPS) {
        for (const [off, want] of [
            [3, 1],
            [2, 5],
            [1, 10]
        ] as [number, number][]) {
            const r = make(`gp_${obj}_${want}`, base + off, 20);
            check(`  ${label.padEnd(14)} Make ${String(want).padEnd(2)} -> ${want}`, [r.made, r.glass], [{ [obj]: want }, 20 - want]);
        }
        const x = make(`gp_${obj}_x`, base, 20, 99, 7);
        check(`  ${label.padEnd(14)} Make X  -> the seven asked for`, [x.made, x.glass], [{ [obj]: 7 }, 13]);
    }
}

console.log('\nTHE COUNT IS A CEILING, NOT A PROMISE: it stops when the glass runs out');
{
    const r = make('gp_short', 11, 3); // Make 10 vials, three glass
    check('  Make 10 with three glass makes three', [r.made, r.glass], [{ vial_empty: 3 }, 0]);
    const none = make('gp_noglass', 13, 0);
    check('  and with no glass at all it says so', [none.made, none.said.some(s => s.includes('no molten glass'))], [{}, true]);
    // ...and Make X will take nothing for an answer, which is how the dialogue is cancelled
    const zero = make('gp_zero', 10, 20, 99, 0);
    check('  a count of nothing makes nothing', [zero.made, zero.glass, zero.xp], [{}, 20, 0]);
}

console.log('\nAND MAKE X STILL DOES THE WHOLE INVENTORY, which one click used to do');
{
    const r = make('gp_all', 22, 26, 99, 100);
    check('  twenty-six molten glass become twenty-six candle lanterns', [r.made, r.glass], [{ candle_lantern_empty: 26 }, 0]);
    check('    and pay for every one of them', r.xp, 26 * 190);
}

console.log('\nTHE LEVELS: one under each gate is refused by name, and nothing is consumed');
{
    for (const [base, obj, label] of GROUPS) {
        const lvl = (sp(obj, 'levelrequire') as number) ?? 1;
        if (lvl > 1) {
            const no = make(`gp_low_${obj}`, base + 3, 5, lvl - 1);
            check(`  ${label.padEnd(14)} refused at ${lvl - 1}`, [no.made, no.glass], [{}, 5]);
            check(
                `    and names level ${lvl}`,
                no.said.some(s => s.includes(`level ${lvl} Crafting`)),
                true
            );
        }
        const yes = make(`gp_at_${obj}`, base + 3, 5, lvl);
        check(`  ${label.padEnd(14)} allowed at ${lvl}, for the struct's experience`, [yes.made, yes.xp], [{ [obj]: 1 }, sp(obj, 'productexp')]);
    }
}

console.log('\nAND THE PANEL PICTURES WHAT YOU GET: the empty lantern and the empty lamp');
{
    // It shipped showing the ones with a candle and a wick in them, which glassblowing does not
    // make. Model ids move when the pack is rebuilt, so the name is resolved out of model.pack
    // rather than written in here as a number.
    const byName = new Map<string, number>();
    for (const line of readFileSync('../content/pack/model.pack', 'utf8').split(/\r?\n/)) {
        const [id, name] = line.split('=');
        if (name) byName.set(name, Number(id));
    }
    for (const [com, want] of [
        [6, 'obj_candle_lantern_empty'],
        [7, 'obj_oil_lamp_empty']
    ] as [number, string][]) {
        const c: any = Component.get(Component.getId(`glass_crafting:com_${com}`));
        check(`  com_${com} is ${want}`, c.model, byName.get(want));
    }
}

console.log('\nAND AN EMPTY CANDLE LANTERN TAKES A CANDLE, which nothing would put in it');
{
    // The other half of "cant make candle lantern": the panel hands out empty ones and there was
    // no way to finish one. Four candles, four lanterns, and the only thing that separates them is
    // whether the candle is already burning - a lit one wants Firemaking 4.
    const RECIPES: [string, string, number][] = [
        ['unlit_candle', 'candle_lantern_unlit', 1],
        ['unlit_black_candle', 'candle_lantern_black_unlit', 1],
        ['lit_candle', 'candle_lantern_lit', 4],
        ['lit_black_candle', 'candle_lantern_black_lit', 4]
    ];
    for (const [candle, want, lvl] of RECIPES) {
        const p: any = player('cl_' + candle, 3200, 3200);
        p.setLevel(PlayerStat.FIREMAKING, lvl);
        H.clearInv(p);
        H.give(p, 'candle_lantern_empty', 1);
        H.give(p, candle, 1);
        H.tick(1);
        A.useHeld(p, candle, 'candle_lantern_empty');
        H.tick(2);
        check(`  ${candle.padEnd(18)} makes ${want}`, [H.invCount(p, want), H.invCount(p, 'candle_lantern_empty'), H.invCount(p, candle)], [1, 0, 0]);
        H.despawn(p);

        if (lvl > 1) {
            const low: any = player('cll_' + candle, 3200, 3200);
            low.setLevel(PlayerStat.FIREMAKING, lvl - 1);
            H.clearInv(low);
            H.give(low, 'candle_lantern_empty', 1);
            H.give(low, candle, 1);
            H.tick(1);
            const m = A.mark();
            A.useHeld(low, candle, 'candle_lantern_empty');
            H.tick(2);
            check(`    and is refused at ${lvl - 1}, keeping both`, [H.invCount(low, want), H.invCount(low, 'candle_lantern_empty'), A.mesSince(low, m).some(s => s.includes('Firemaking level of 4'))], [0, 1, true]);
            H.despawn(low);
        }
    }

    // ...and the finished lantern lights, which took no wiring at all: both unlit lanterns already
    // carry category=light_source_unlit and param=product in the cache, so the tinderbox that
    // lights every other light source lights these the moment one can exist.
    const q: any = player('cl_light', 3200, 3200);
    q.setLevel(PlayerStat.FIREMAKING, 99);
    H.clearInv(q);
    H.give(q, 'candle_lantern_unlit', 1);
    H.give(q, 'tinderbox', 1);
    H.tick(1);
    A.useHeld(q, 'tinderbox', 'candle_lantern_unlit');
    H.tick(2);
    check('  a tinderbox lights the finished lantern', H.invCount(q, 'candle_lantern_lit'), 1);
    H.despawn(q);
}

console.log(`\n${R.ok} ok, ${R.bad} FAIL`);
process.exit(R.bad ? 1 : 0);
