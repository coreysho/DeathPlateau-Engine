// THE VOID KNIGHTS' REWARD WINDOW - the interface that replaced the chat menus.
//
//   npx tsx tools/sim/voidrewards.ts
//
// WHAT NEEDED TESTING. The window itself is generated and the Slayer one already proves that
// shape works, so what is worth driving here is the half that is new: an EXPERIENCE exchange whose
// numbers depend on the player's level, are quoted on screen before they are bought, and are paid
// in a different unit from the one they are quoted in.
//
// THE UNIT IS THE TRAP. stat_advance counts experience in TENTHS of a point - a shrimp is
// productexp=100 and worth 10 experience - while every figure the window prints is in the player's
// units. Get that wrong and the Knights quote 560 and pay 56, which no compile and no eyeball on
// the interface would catch. So the sim buys experience and measures the stat.
//
// AND THE FORMULA IS OLD SCHOOL'S, floor(level*level/600)*N, checked against the wiki's own
// published table rather than against itself: sixteen level bands, three multipliers.
import * as H from './harness.js';
import Component from '#/cache/config/Component.js';
import EnumType from '#/cache/config/EnumType.js';
import ObjType from '#/cache/config/ObjType.js';
import Player from '#/engine/entity/Player.js';
import ScriptProvider from '#/engine/script/ScriptProvider.js';
import ScriptRunner from '#/engine/script/ScriptRunner.js';
import ScriptState from '#/engine/script/ScriptState.js';
import { ProtectedActivePlayer } from '#/engine/script/ScriptPointer.js';
import { PlayerStat } from '#/engine/entity/PlayerStat.js';

await H.boot();
H.loginOrder();

const R = { ok: 0, bad: 0 };
const check = (what: string, got: unknown, want: unknown) => {
    const pass = JSON.stringify(got) === JSON.stringify(want);
    if (pass) R.ok++;
    else R.bad++;
    console.log(`  ${pass ? 'ok  ' : 'FAIL'} ${what}: ${JSON.stringify(got)}${pass ? '' : `   (want ${JSON.stringify(want)})`}`);
};

let bucket = 1;
function player(name: string): Player {
    const p = H.makePlayer(name, 3222, 3222, bucket++);
    H.tick(2);
    H.clearInv(p);
    H.setVar(p, 'pest_commendation', 0);
    return p;
}
function runProtected(p: Player, name: string, args: unknown[] = []): number[] {
    const script = ScriptProvider.getByName(name);
    if (!script) throw new Error('no such script: ' + name);
    const was = p.protect;
    p.protect = true;
    const state = ScriptRunner.init(script, p, null, args as never[]);
    for (const ptr of ProtectedActivePlayer) state.pointerAdd(ptr);
    ScriptRunner.execute(state);
    p.protect = was;
    return (state as unknown as { intStack: number[]; isp: number }).intStack.slice(0, (state as unknown as { isp: number }).isp);
}
const mesFor = (q: Player) => H.mesgs.filter(m => m.who === q.username).map(m => m.text);
const said = (q: Player, fragment: string) => mesFor(q).some(t => t.includes(fragment));

// ============================================================ 1. the window exists
console.log('== the window, and what the generator wrote');
{
    check('the interface is registered', Component.getId('pest_rewards') !== -1, true);
    const missing = ['tab0', 'tab1', 'amounts', 'amtlabel', 'back', 'confirm', 'desc0', 'desc1']
        .concat([0, 1, 2, 3, 4, 5, 6].flatMap(i => [`row${i}`, `r${i}box`, `r${i}name`, `r${i}cost`]))
        .concat([0, 1, 2].flatMap(i => [`amt${i}`, `amt${i}fill`]))
        .filter(n => Component.getId(`pest_rewards:${n}`) === -1);
    check('every component the script names exists', missing, []);
    const procs = ['[proc,void_rewards_window]', '[proc,void_ui_draw]', '[proc,void_ui_buttons]', '[proc,void_ui_take]', '[proc,void_buy_xp]', '[proc,void_buy_gear]', '[proc,void_xp_per_point]', '[proc,void_xp_total]'];
    check(
        'and every proc it leans on',
        procs.filter(n => !H.hasScript(n)),
        []
    );
    // The chat menus it replaced are gone rather than sitting beside it.
    check('the old chat exchange is gone', [H.hasScript('[label,pest_exchange]'), H.hasScript('[label,pest_exchange_helmets]'), H.hasScript('[label,pest_buy]')], [false, false, false]);
}

// ============================================================ 2. the formula
console.log("== the experience formula is Old School's, band for band");
{
    const p = player('voidxp');
    // The wiki's own table: level band -> xp per point for melee, ranged/magic, prayer.
    const BANDS: [number, number, number, number, number][] = [
        [25, 34, 35, 32, 18],
        [35, 42, 70, 64, 36],
        [43, 48, 105, 96, 54],
        [49, 54, 140, 128, 72],
        [55, 59, 175, 160, 90],
        [60, 64, 210, 192, 108],
        [65, 69, 245, 224, 126],
        [70, 73, 280, 256, 144],
        [74, 77, 315, 288, 162],
        [78, 81, 350, 320, 180],
        [82, 84, 385, 352, 198],
        [85, 88, 420, 384, 216],
        [89, 91, 455, 416, 234],
        [92, 94, 490, 448, 252],
        [95, 97, 525, 480, 270],
        [98, 99, 560, 512, 288]
    ];
    // row index -> (stat, which column of the table)
    const ROWS: [number, PlayerStat, 0 | 1 | 2][] = [
        [0, PlayerStat.ATTACK, 0],
        [1, PlayerStat.STRENGTH, 0],
        [2, PlayerStat.DEFENCE, 0],
        [3, PlayerStat.HITPOINTS, 0],
        [4, PlayerStat.RANGED, 1],
        [5, PlayerStat.MAGIC, 1],
        [6, PlayerStat.PRAYER, 2]
    ];
    const wrong: string[] = [];
    for (const [lo, hi, melee, rng, pray] of BANDS) {
        const want = [melee, rng, pray];
        for (const lv of [lo, hi]) {
            for (const [row, stat, col] of ROWS) {
                p.setLevel(stat, lv);
                const got = runProtected(p, '[proc,void_xp_per_point]', [row])[0];
                if (got !== want[col]) wrong.push(`row ${row} at level ${lv}: ${got}, not ${want[col]}`);
            }
        }
    }
    check(`all ${BANDS.length} bands, both ends, all seven skills`, wrong, []);

    // Below 25 the formula pays nothing, which is why it is refused outright rather than taken.
    for (const [, stat] of ROWS) {
        p.setLevel(stat, 24);
    }
    check(
        'level 24 pays nothing, in every skill',
        ROWS.map(([row]) => runProtected(p, '[proc,void_xp_per_point]', [row])[0]),
        ROWS.map(() => 0)
    );
    H.despawn(p);
}

// ============================================================ 3. the batch bonus
console.log('== the batch bonus: 1, 10 at +1%, 100 at +10%');
{
    const p = player('voidbatch');
    p.setLevel(PlayerStat.ATTACK, 99);
    const per = runProtected(p, '[proc,void_xp_per_point]', [0])[0];
    check('99 Attack is 560 a point', per, 560);
    check('one point pays it flat', runProtected(p, '[proc,void_xp_total]', [0, 1])[0], 560);
    check('ten pays 1% more than ten singles', runProtected(p, '[proc,void_xp_total]', [0, 10])[0], 5600 + 56);
    check('a hundred pays 10% more', runProtected(p, '[proc,void_xp_total]', [0, 100])[0], 56000 + 5600);
    H.despawn(p);
}

// ============================================================ 4. buying experience
console.log('== buying it, and the unit it is paid in');
{
    const p = player('voidbuy');
    p.setLevel(PlayerStat.ATTACK, 99);
    H.setVar(p, 'pest_commendation', 100);
    const before = p.stats[PlayerStat.ATTACK];
    const quoted = runProtected(p, '[proc,void_xp_total]', [0, 10])[0];
    H.clearLogs();
    check('the trade goes through', runProtected(p, '[proc,void_buy_xp]', [0, 10])[0], 1);
    check('ten points are gone', H.getVar(p, 'pest_commendation'), 90);
    // THE WHOLE POINT OF THIS FILE. stat_advance counts tenths; the window quotes whole
    // experience. 5,656 quoted must be 56,560 tenths in the stat, not 5,656.
    check(`the stat moved by the quoted ${quoted}, in tenths`, p.stats[PlayerStat.ATTACK] - before, quoted * 10);
    check('and it said what it paid', said(p, `${quoted} attack experience`), true);

    // Not enough points: refused, and nothing moves.
    const xpNow = p.stats[PlayerStat.ATTACK];
    H.setVar(p, 'pest_commendation', 9);
    H.clearLogs();
    check('ten points with nine in hand: refused', runProtected(p, '[proc,void_buy_xp]', [0, 10])[0], 0);
    check('and nothing was taken or paid', [H.getVar(p, 'pest_commendation'), p.stats[PlayerStat.ATTACK]], [9, xpNow]);
    check('and it said why', said(p, 'commendation points, and you have 9'), true);

    // Under the level floor: refused even with points in hand.
    p.setLevel(PlayerStat.PRAYER, 24);
    H.setVar(p, 'pest_commendation', 100);
    H.clearLogs();
    check('Prayer at 24: refused', runProtected(p, '[proc,void_buy_xp]', [6, 10])[0], 0);
    check('with the points untouched', H.getVar(p, 'pest_commendation'), 100);
    check('and the reason named', said(p, 'level 25 prayer'), true);
    H.despawn(p);
}

// ============================================================ 5. buying equipment
console.log('== buying equipment');
{
    const COSTS: [string, number][] = [
        ['void_knight_top', 250],
        ['void_knight_robe', 250],
        ['void_knight_gloves', 150],
        ['void_mage_helm', 200],
        ['void_ranger_helm', 200],
        ['void_melee_helm', 200],
        ['void_knight_mace', 250]
    ];
    const objEnum = EnumType.get(EnumType.getId('pest_gear_obj'));
    const costEnum = EnumType.get(EnumType.getId('pest_gear_cost'));
    const wrong: string[] = [];
    for (let i = 0; i < COSTS.length; i++) {
        const [name, cost] = COSTS[i];
        const gotObj = ObjType.get(objEnum.values.get(i) as number).debugname;
        const gotCost = costEnum.values.get(i) as number;
        if (gotObj !== name || gotCost !== cost) wrong.push(`row ${i}: ${gotObj} at ${gotCost}, not ${name} at ${cost}`);
    }
    check("the shelf is Old School's seven, at Old School's prices", wrong, []);

    const p = player('voidgear');
    H.setVar(p, 'pest_commendation', 249);
    H.clearLogs();
    check('one point short of a top: refused', runProtected(p, '[proc,void_buy_gear]', [0])[0], 0);
    check('and nothing handed over', H.invCount(p, 'void_knight_top'), 0);
    H.setVar(p, 'pest_commendation', 250);
    check('exactly the price: bought', runProtected(p, '[proc,void_buy_gear]', [0])[0], 1);
    check('the top is in the pack and the points are gone', [H.invCount(p, 'void_knight_top'), H.getVar(p, 'pest_commendation')], [1, 0]);

    // A full inventory refuses rather than dropping it.
    H.setVar(p, 'pest_commendation', 250);
    H.fillInv(p);
    H.clearLogs();
    check('a full pack refuses', runProtected(p, '[proc,void_buy_gear]', [1])[0], 0);
    check('and keeps the points', H.getVar(p, 'pest_commendation'), 250);
    H.despawn(p);
}

// ============================================================ 6. the window opens
console.log('== and the Void Knights open it');
{
    const p = player('voidopen');
    H.setVar(p, 'pest_commendation', 500);
    const script = ScriptProvider.getByName('[proc,void_rewards_window]');
    check('the window proc exists', !!script, true);
    if (script) {
        // It pauses on a button, so it is started and left where it stops: what matters is which
        // modal the player is in by then.
        const state = ScriptRunner.init(script, p, null, []);
        p.executeScript(state, true);
        check('running it puts the player in the reward window', (p as unknown as { modalMain: number }).modalMain, Component.getId('pest_rewards'));
        check('and it is waiting on a button', p.activeScript?.execution, ScriptState.PAUSEBUTTON);
    }
    H.despawn(p);
}

console.log('');
console.log(`${R.ok} passed, ${R.bad} failed`);
process.exit(R.bad ? 1 : 0);
