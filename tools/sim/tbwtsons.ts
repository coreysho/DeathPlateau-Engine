// THE THREE SONS, HOME, and the three Talk-to options that had nothing behind them.
//
//   npx tsx tools/sim/tbwtsons.ts
//
// Reported as the last of this quest's dead clicks: Tiadeche, Tinsay and Tamayu all render in their
// own houses once Tai Bwo Wannai Trio is over, all three carry op1=Talk-to, and nothing answered
// any of them - because the quest paid its experience out at Timfraku's table instead. The live
// game pays it in the village, one son at a time, and says so on its own quest page: "You must talk
// to each of the three brothers in their houses along the southern fence of the village to receive
// the additional experience rewards."
//
// The thing a reader cannot check here is the one that matters: that none of it can be claimed
// twice, and that a character who finished the quest under the OLD code - paid at the table, never
// had the conversation - is not paid a second time by the sons. %tbwt_thanked = 0 on a finished
// quest is what means that, and it is checked both ways round below.
import * as H from './harness.js';
import * as A from './a1lib.js';
import { check, R, player } from './a1lib.js';
import NpcType from '#/cache/config/NpcType.js';
import { PlayerStat } from '#/engine/entity/PlayerStat.js';

await H.boot();
H.loginOrder();

const COMPLETE = 6; // ^tbwt_complete
const REPORTED = 5; // ^tbwt_reported
const OWE = 1; // ^tbwt_sons_owe
const XP = 10;

const SONS: [string, string, number, [string, number][]][] = [
    ['Tiadeche', 'tbwt_tiadeche_multinpc_house', 2, [['FISHING', 5000]]],
    ['Tinsay', 'tbwt_tinsay_multinpc_house', 4, [['COOKING', 5000]]],
    [
        'Tamayu',
        'tbwt_tamayu_multinpc_house',
        8,
        [
            ['ATTACK', 2500],
            ['STRENGTH', 2500]
        ]
    ]
];
// PlayerStat is a const enum, so there is no runtime object to index by name - the four this
// needs are written out instead.
const PlayerStatOf: Record<string, number> = {
    ATTACK: PlayerStat.ATTACK,
    STRENGTH: PlayerStat.STRENGTH,
    FISHING: PlayerStat.FISHING,
    COOKING: PlayerStat.COOKING
};
const stat = (p: any, n: string) => p.stats[PlayerStatOf[n]];

/**
 * Talk to a son and hand back everything that went on screen, as one string.
 *
 * Two reasons it is not just A.talk()'s return value. A script whose whole body is one ~chatnpc
 * runs to its pause INSIDE talk(), before drive() starts recording, so its line is already on
 * screen and talk() comes back empty - which is how the two early-return branches below read as
 * silent when they are not. And a line too long for the box is split across two components, so
 * "nowhere to put it" is never one string. Marking first and joining after solves both.
 */
function talkText(p: any, shell: string): string {
    const mark = H.ifaces.length;
    A.talk(p, shell);
    H.tick(2);
    return H.ifaces
        .slice(mark)
        .filter(i => i.who === p.username && i.kind === 'text' && i.text)
        .map(i => i.text)
        .join(' ');
}

console.log('ALL THREE SONS ARE IN THEIR HOUSES, where the live game has them');
{
    for (const [label, shell] of SONS) {
        const id = NpcType.getId(shell);
        const at = A.World.npcs.filter(n => n && n.type === id).map(n => `${n!.x},${n!.z}`);
        check(`  ${label.padEnd(9)} is placed`, at.length, 1);
    }
    // ...and no Talk-to along the southern fence is a dead click any more. This is the sweep the
    // three were found with, narrowed to op1: Tiadeche also carries op3=Trade for his karambwan
    // stall and Tamayu's spear stall npc is not the one the house shell renders, so the shops are
    // a separate piece of work and this check does not pretend otherwise.
    const dead = [...A.deadNpcOps(2770, 3045, 2810, 3070).keys()].filter(k => /tbwt/.test(k) && /op1=/.test(k));
    check('  and no Tai Bwo Wannai Talk-to in the village is unanswered', dead, []);
}

/** A character who has just finished the quest the new way: the sons owe them. */
function fresh(name: string) {
    const p: any = player(name, 2784, 3057);
    H.clearInv(p);
    H.setVar(p, 'tbwt_main', COMPLETE);
    H.setVar(p, 'tbwt_thanked', OWE);
    H.tick(1);
    return p;
}

console.log('\nEACH SON PAYS HIS OWN HALF OF THE REWARD, ONCE');
{
    for (const [label, shell, bit, rewards] of SONS) {
        const p = fresh('ts_' + label);
        const before = rewards.map(([s]) => stat(p, s));
        const said = talkText(p, shell);
        for (const [i, [s, want]] of rewards.entries()) {
            check(`  ${label.padEnd(9)} pays ${want} ${s.toLowerCase()}`, (stat(p, s) - before[i]) / XP, want);
        }
        check('    and records it', H.getVar(p, 'tbwt_thanked'), OWE | bit);
        check('    with something to say', said.length > 0, true);

        // ...and again pays nothing, which is the whole job of the bit
        const again = rewards.map(([s]) => stat(p, s));
        talkText(p, shell);
        check(
            '  ...and a second visit pays nothing',
            rewards.map(([s], i) => stat(p, s) - again[i]),
            rewards.map(() => 0)
        );
        check('    and leaves the record alone', H.getVar(p, 'tbwt_thanked'), OWE | bit);
        H.despawn(p);
    }
}

console.log('\nTAMAYU HANDS OVER THE POISONED SPEAR, and will not if there is nowhere to put it');
{
    const p = fresh('ts_spear');
    talkText(p, 'tbwt_tamayu_multinpc_house');
    check('  one karambwan-poisoned rune spear', H.invCount(p, 'tbwt_rune_spear_kp'), 1);
    H.despawn(p);

    const full = fresh('ts_spearfull');
    H.fillInv(full);
    const atk = stat(full, 'ATTACK');
    const said = talkText(full, 'tbwt_tamayu_multinpc_house');
    check('  a full inventory is told so', said.includes('nowhere to'), true);
    check('    and nothing is spent or paid', [H.invCount(full, 'tbwt_rune_spear_kp'), stat(full, 'ATTACK') - atk, H.getVar(full, 'tbwt_thanked')], [0, 0, OWE]);
    H.despawn(full);
}

console.log('\nA CHARACTER FROM BEFORE THE CHANGE IS NOT PAID TWICE');
{
    // %tbwt_thanked = 0 on a finished quest is the only record there is that the table paid: the
    // old code wrote nothing. So zero has to mean "owed nothing", and this is what proves it.
    for (const [label, shell, , rewards] of SONS) {
        const p: any = player('ts_old_' + label, 2784, 3057);
        H.clearInv(p);
        H.setVar(p, 'tbwt_main', COMPLETE);
        H.setVar(p, 'tbwt_thanked', 0);
        H.tick(1);
        const before = rewards.map(([s]) => stat(p, s));
        const said = talkText(p, shell);
        check(
            `  ${label.padEnd(9)} pays an old character nothing`,
            rewards.map(([s], i) => stat(p, s) - before[i]),
            rewards.map(() => 0)
        );
        check('    but still has something to say', said.length > 0, true);
        check('    and no spear changes hands', H.invCount(p, 'tbwt_rune_spear_kp'), 0);
        H.despawn(p);
    }
}

console.log('\nTIMFRAKU PAYS COINS AND NOTHING ELSE, which is what moved');
{
    const p: any = player('ts_finish', 2784, 3086, 1);
    H.clearInv(p);
    H.setVar(p, 'tbwt_main', REPORTED);
    H.setVar(p, 'tbwt_thanked', 0);
    H.tick(1);
    const before = [stat(p, 'FISHING'), stat(p, 'COOKING'), stat(p, 'ATTACK'), stat(p, 'STRENGTH')];
    const fletch = p.stats[PlayerStat.FLETCHING];
    A.talk(p, 'tbwt_timfraku');
    for (let t = 0; t < 20; t++) H.tick(1);
    check('  the quest completes', H.getVar(p, 'tbwt_main'), COMPLETE);
    check('  2,000 coins', H.invCount(p, 'coins'), 2000);
    check('  and no experience at the table', [stat(p, 'FISHING'), stat(p, 'COOKING'), stat(p, 'ATTACK'), stat(p, 'STRENGTH')], before);
    // Fletching was never one of this quest's rewards - it was standing in for Tamayu's two.
    check('  and none of the Fletching it never gave in the live game', p.stats[PlayerStat.FLETCHING] - fletch, 0);
    check('  with the sons marked as owing', H.getVar(p, 'tbwt_thanked'), OWE);
    H.despawn(p);
}

console.log('\nAND THE THOROUGH KARAMBWAN COOK FOLLOWS TINSAY, not the quest stage');
{
    // The live game has Tinsay teach it after the quest. The two only differ for the character who
    // finished the quest before he had anything to say, and for them the quest IS the lesson.
    function cookChoice(name: string, thanked: number) {
        const p: any = player(name, 3222, 3218);
        p.setLevel(PlayerStat.COOKING, 99);
        H.clearInv(p);
        H.setVar(p, 'tbwt_main', COMPLETE);
        H.setVar(p, 'tbwt_thanked', thanked);
        A.addLoc('fire', 3222, 3219, 0);
        H.give(p, 'tbwt_raw_karambwan');
        const said = A.useOn(p, 3222, 3219, 'fire', 'tbwt_raw_karambwan', ['thoroughly']).concat([]);
        H.tick(12);
        const out = { food: H.invCount(p, 'tbwt_cooked_karambwan'), said };
        H.despawn(p);
        return out;
    }

    // ...taught: the choice is there and the thorough cook goes through
    const taught = cookChoice('ts_cook_taught', OWE | 4);
    check('  after Tinsay, the thorough cook is offered', taught.food, 1);

    // ...and an old character keeps it, because the table paid them instead
    const old = cookChoice('ts_cook_old', 0);
    check('  an old character keeps it too', old.food, 1);

    // ...not taught yet: no choice at all, and it comes out poison
    const p: any = player('ts_cook_untaught', 3222, 3218);
    p.setLevel(PlayerStat.COOKING, 99);
    H.clearInv(p);
    H.setVar(p, 'tbwt_main', COMPLETE);
    H.setVar(p, 'tbwt_thanked', OWE);
    A.addLoc('fire', 3222, 3219, 0);
    H.give(p, 'tbwt_raw_karambwan');
    const said = A.useOn(p, 3222, 3219, 'fire', 'tbwt_raw_karambwan');
    H.tick(12);
    check(
        '  before Tinsay, there is no choice',
        said.some(s => /thoroughly/i.test(s)),
        false
    );
    check('    and it comes out poison', [H.invCount(p, 'tbwt_poorly_cooked_karambwan'), H.invCount(p, 'tbwt_cooked_karambwan')], [1, 0]);
    H.despawn(p);
}

console.log(`\n${R.ok} ok, ${R.bad} FAIL`);
process.exit(R.bad ? 1 : 0);
