// ZOGRE FLESH EATERS' REWARD, which the quest handed out as three varbits that nothing read.
//
// "Grish teach you ogre way of arrows and potions" - and then thzfe_makebrutalarrow,
// thzfe_makecompozogrebow and thzfe_makecuredisease were set and no script anywhere looked at
// them. The cache has had the whole reward in it since 2005:
//
//   zogre_brutal_bronze .. _rune   seven arrows, five stack graphics each, and not one stat:
//                                  no category, so no bow would fire them, and no rangebonus,
//                                  so they would have done nothing if one had
//   unstrung_zogre_bow, zogre_bow  the comp ogre bow, with Wield and Check kills and no combat
//                                  params at all - a log with a bowstring on it
//
// This drives the lot: the fletching, the two bows, and which arrows each will fire.
//
//   npx tsx tools/sim/brutalarrows.ts
import * as H from './harness.js';
import Player from '#/engine/entity/Player.js';
import ObjType from '#/cache/config/ObjType.js';
import ParamType from '#/cache/config/ParamType.js';
import CategoryType from '#/cache/config/CategoryType.js';
import Component from '#/cache/config/Component.js';
import ScriptState from '#/engine/script/ScriptState.js';

await H.boot();

const R = { ok: 0, bad: 0 };
const check = (what: string, got: unknown, want: unknown) => {
    const pass = JSON.stringify(got) === JSON.stringify(want);
    if (pass) R.ok++;
    else R.bad++;
    console.log(`  ${pass ? 'ok  ' : 'FAIL'} ${what}: ${JSON.stringify(got)}${pass ? '' : `   (want ${JSON.stringify(want)})`}`);
};

function settle(p: Player, picks: number[] = [], max = 120) {
    let idle = 0;
    for (let g = 0; g < max; g++) {
        const s = p.activeScript;
        if (s && s.execution === ScriptState.PAUSEBUTTON) {
            idle = 0;
            const names = p.resumeButtons.map((id: number) => Component.get(id).comName ?? '');
            const open = p.modalChat === -1 ? '' : Component.get(p.modalChat).comName ?? '';
            const multi = open.startsWith('multi') ? names.find((n: string) => n.startsWith(open + ':')) : null;
            if (multi) {
                const pick = picks.shift();
                if (pick === undefined) throw new Error('unexpected menu: ' + names.join(','));
                // multi1/multi2 number their buttons com_N; multiobj2 resumes on obj1/obj2, so a
                // pick that is not a com_N is an index into the buttons that are there
                const byName = names.find((n: string) => n === `${open}:com_${pick}`);
                H.choose(p, byName ?? names[pick]);
                continue;
            }
            p.executeScript(s, true, true);
            continue;
        }
        H.tick(1);
        if (!p.activeScript && !p.target && !p.delayed && p.queue.head() === null) {
            if (++idle >= 3) break;
        } else idle = 0;
    }
    if (picks.length) throw new Error('menus not reached: ' + picks.join(','));
    p.closeModal();
}

const p: any = H.makePlayer('brutal', 3222, 3218);
H.tick(1);
H.maxOut(p);
H.clearInv(p);
H.tick(2);
p.closeModal();

const param = (objName: string, paramName: string) => {
    const t = ObjType.get(ObjType.getId(objName));
    const id = ParamType.getId(paramName);
    return (t.params?.get(id) as number | string | undefined) ?? null;
};
const heard = (fn: () => void): string => {
    const mark = H.mesgs.length;
    const faces = H.ifaces.length;
    fn();
    return H.ifaces.slice(faces).filter(i => i.kind === 'text' && i.text).map(i => i.text!)
        .concat(H.mesgs.slice(mark).map(m => m.text)).join(' ');
};
const use = (a: string, b: string, picks: number[] = []): string =>
    heard(() => {
        H.useHeldOn(p, a, b);
        settle(p, picks);
    });
const fletch = (level: number) => {
    p.setLevel(9, level);          // 9 is Fletching
    H.tick(1);
};

const METALS: [string, string, number, number, number][] = [
    // nails,            arrow,                  Fletching, xp x10, ranged strength
    ['nails_bronze', 'zogre_brutal_bronze', 7, 14, 11],
    ['nails_iron', 'zogre_brutal_iron', 18, 26, 13],
    ['nails', 'zogre_brutal_steel', 33, 51, 19],
    ['nails_black', 'zogre_brutal_black', 38, 65, 22],
    ['nails_mithril', 'zogre_brutal_mithril', 49, 75, 34],
    ['nails_adamant', 'zogre_brutal_adamant', 62, 102, 45],
    ['nails_rune', 'zogre_brutal_rune', 77, 125, 60]
];

// ------------------------------------------------------------------ the stats they never had
console.log('');
console.log('SEVEN ARROWS THAT WERE NAMES AND MODELS');
for (const [, arrow, , , strength] of METALS) {
    check(`${arrow}: +${strength} ranged strength, in the ogre_arrows category`,
        [param(arrow, 'rangebonus'), CategoryType.get(ObjType.get(ObjType.getId(arrow)).category).debugname],
        [strength, 'ogre_arrows']);
}
check('and five stack graphics each, which is all the cache ever gave them',
    METALS.every(([, a]) => [2, 3, 4, 5].every(n => ObjType.getId(a.replace('zogre_brutal_', 'zogre_brutal_') + n) !== -1)), true);
check('the comp ogre bow is a bow now: +38 ranged attack, 5 ticks, 5 tiles',
    [param('zogre_bow', 'rangeattack'), param('zogre_bow', 'attackrate'), param('zogre_bow', 'attackrange'),
        CategoryType.get(ObjType.get(ObjType.getId('zogre_bow')).category).debugname],
    [38, 5, 5, 'weapon_bow']);

// ------------------------------------------------------------------ making them
console.log('');
console.log('NAILS ON A FLIGHTED OGRE ARROW');
H.setVarBit(p, 'thzfe_makebrutalarrow', 0);
H.give(p, 'ogre_headless_arrow', 10);
H.give(p, 'nails_bronze', 10);
let said = use('nails_bronze', 'ogre_headless_arrow');
check('before Grish has taught you, they are nails and sticks',
    [H.invCount(p, 'zogre_brutal_bronze'), said.includes('no idea')], [0, true]);
H.setVarBit(p, 'thzfe_makebrutalarrow', 1);
said = use('nails_bronze', 'ogre_headless_arrow');
check('and without a hammer there is nothing to hit them with',
    [H.invCount(p, 'zogre_brutal_bronze'), said.includes('hammer')], [0, true]);
H.give(p, 'hammer', 1);
fletch(6);
said = use('nails_bronze', 'ogre_headless_arrow');
check('bronze wants Fletching 7', [H.invCount(p, 'zogre_brutal_bronze'), said.includes('level of 7')], [0, true]);
fletch(7);
let xp = p.stats[9];
use('nails_bronze', 'ogre_headless_arrow');
check('six at a time, nails and shafts both',
    [H.invCount(p, 'zogre_brutal_bronze'), H.invCount(p, 'nails_bronze'), H.invCount(p, 'ogre_headless_arrow')],
    [6, 4, 4]);
check('  and 1.4 Fletching experience an arrow', (p.stats[9] - xp) / 10, 8.4);
use('nails_bronze', 'ogre_headless_arrow');
check('the last four make four', H.invCount(p, 'zogre_brutal_bronze'), 10);

console.log('');
console.log('ALL SEVEN METALS, AT THE LEVELS THE WIKI GIVES');
for (const [nails, arrow, level, perArrow] of METALS) {
    H.clearInv(p);
    H.tick(1);
    H.give(p, 'hammer', 1);
    H.give(p, 'ogre_headless_arrow', 6);
    H.give(p, nails, 6);
    fletch(level - 1);
    use(nails, 'ogre_headless_arrow');
    const tooLow = H.invCount(p, arrow);
    fletch(level);
    xp = p.stats[9];
    use(nails, 'ogre_headless_arrow');
    check(`${arrow}: level ${level}, ${perArrow / 10} xp each`,
        [tooLow, H.invCount(p, arrow), (p.stats[9] - xp) / 10], [0, 6, (perArrow * 6) / 10]);
}

// ------------------------------------------------------------------ the bow
console.log('');
console.log('THE ONLY COMPOSITE BOW FLETCHING CAN MAKE');
H.clearInv(p);
H.tick(1);
H.setVarBit(p, 'thzfe_makecompozogrebow', 1);
H.setVar(p, 'chompybird', 5);          // the shafts are Big Chompy Bird Hunting's own gate
H.give(p, 'knife', 1);
H.give(p, 'achey_tree_logs', 2);
fletch(30);
said = use('knife', 'achey_tree_logs');
check('a knife on achey logs is still arrow shafts when that is all you can make',
    [H.invCount(p, 'ogre_arrow_shaft') > 0, H.invCount(p, 'unstrung_zogre_bow')], [true, 0]);
H.give(p, 'wolf_bones', 1);
xp = p.stats[9];
said = use('knife', 'achey_tree_logs', [1]);      // the second option: Comp Ogre Bow
check('with wolf bones in your hands it asks, and makes the bow',
    [H.invCount(p, 'unstrung_zogre_bow'), H.invCount(p, 'wolf_bones'), (p.stats[9] - xp) / 10], [1, 0, 45]);
H.give(p, 'bow_string', 1);
xp = p.stats[9];
said = use('bow_string', 'unstrung_zogre_bow');
check('a bowstring finishes it',
    [H.invCount(p, 'zogre_bow'), H.invCount(p, 'unstrung_zogre_bow'), (p.stats[9] - xp) / 10], [1, 0, 45]);

console.log('');
console.log('AND IT WANTS A WORD WITH GRISH BEFORE YOU HOLD IT');
H.setVarBit(p, 'thzfe_grish_warning_yes', 0);
said = heard(() => {
    H.opheld(p, 'zogre_bow', 2);
    settle(p);
});
check('nobody has shown you how', [H.invCount(p, 'zogre_bow'), said.includes('no idea how to hold')], [1, true]);
H.setVarBit(p, 'thzfe_grish_warning_yes', 1);
p.setLevel(4, 29);                                 // 4 is Ranged
H.tick(1);
said = heard(() => {
    H.opheld(p, 'zogre_bow', 2);
    settle(p);
});
check('and it still wants 30 Ranged', said.includes('Ranged level of 30'), true);
p.setLevel(4, 30);
H.tick(1);
H.opheld(p, 'zogre_bow', 2);
settle(p);
check('then it is a bow in your hands', H.invCount(p, 'zogre_bow'), 0);

// ------------------------------------------------------------------ what each bow will fire
console.log('');
console.log('WHICH ARROWS EACH BOW WILL FIRE');
const fires = (bow: string, ammo: string) => {
    H.equip(p, { rhand: bow, quiver: ammo });
    H.tick(1);
    const got = H.runProc(p, '[proc,player_ranged_check_ammo]', [ObjType.getId(bow)])[0];
    return got === ObjType.getId(ammo);
};
check('the ogre bow fires ogre arrows', fires('ogre_bow', 'ogre_arrow'), true);
check('  and brutal arrows up to mithril',
    ['zogre_brutal_bronze', 'zogre_brutal_iron', 'zogre_brutal_steel', 'zogre_brutal_black', 'zogre_brutal_mithril']
        .every(a => fires('ogre_bow', a)), true);
check('  and not adamant or rune: "Your bow is not powerful enough for those arrows"',
    ['zogre_brutal_adamant', 'zogre_brutal_rune'].some(a => fires('ogre_bow', a)), false);
check('the comp ogre bow fires every one of them',
    METALS.every(([, a]) => fires('zogre_bow', a)) && fires('zogre_bow', 'ogre_arrow'), true);
check('and a maple shortbow fires none of them', fires('maple_shortbow', 'zogre_brutal_bronze'), false);
check('  nor will an ogre bow fire a rune arrow', fires('ogre_bow', 'rune_arrow'), false);

console.log('');
console.log(`${R.ok} ok, ${R.bad} failed`);
process.exit(R.bad ? 1 : 0);
