// THE KARAMBWAN, from the guide that never listed it to the cook that paid nothing for it.
//
//   npx tsx tools/sim/karambwan.ts
//
// Two reported gaps, both about the one fish in the game with two ways to cook it:
//
//   the Fishing guide jumped 53 -> 76, so neither the karambwanji you net at 5 nor the karambwan
//   you drop a vessel for at 65 was in the list a player reads to find out what to catch next;
//
//   and the poorly cooked one - Old School calls it a poison karambwan now - paid NO Cooking
//   experience, where the live game pays 80 for it. It was a failure case rather than a choice:
//   a tinderbox on a raw karambwan, one roll, no burn, food if the quest was far enough along and
//   poison if it was not. The live game puts the choice to the player (poorly at 1 for 80, through
//   at 30 for 190, the same 70/255 roll either way, a burnt octopus when it fails), which is what
//   the cooking_generic row plus the override in cooking.rs2 now do.
import * as H from './harness.js';
import * as A from './a1lib.js';
import { check, R, player } from './a1lib.js';
import Component from '#/cache/config/Component.js';
import { PlayerStat } from '#/engine/entity/PlayerStat.js';

await H.boot();
H.loginOrder();

const COOK = (p: any) => p.stats[PlayerStat.COOKING];
/** Cooking experience is stored x10, as every stat is. */
const XP = 10;

// ------------------------------------------------------------------- the guide
console.log('THE FISHING GUIDE LISTS BOTH OF THEM NOW');
{
    const p: any = player('kb_guide', 3222, 3218);
    const from = H.ifaces.length;
    A.runProcProtected(p, '[proc,open_fishing_guide]');

    // The guide writes a level and a name per row, into skill_guide:lvl<n> and :name<n>. Read it
    // back the way the player reads it - off the components - rather than off the script source,
    // which cannot tell whether a row was shadowed by a later one writing the same component.
    const texts = new Map<number, string>();
    for (const i of H.ifaces.slice(from)) {
        if (i.kind === 'text' && i.who === p.username) texts.set(i.com, i.text ?? '');
    }
    // All forty rows are written: ~skillguide_begin blanks every one of them first, so a row the
    // proc does not fill comes back as "". That is what makes a gap visible here.
    const rows: { lvl: string; name: string }[] = [];
    for (let n = 1; n <= 40; n++) {
        rows.push({
            lvl: texts.get(Component.getId(`skill_guide:lvl${n}`)) ?? '',
            name: texts.get(Component.getId(`skill_guide:name${n}`)) ?? ''
        });
    }
    const filled = rows.filter(r => r.name.length > 0);

    check('  the list is 33 rows long, two longer than it was', filled.length, 33);
    check(
        '  and they are the first 33, with no gap in the middle',
        rows.findIndex(r => r.name.length === 0),
        33
    );
    const named = (s: string) => filled.find(r => r.name === s);
    check('  Raw karambwanji is in it, at 5', [!!named('Raw karambwanji'), named('Raw karambwanji')?.lvl], [true, '5']);
    check('  Raw karambwan is in it, at 65', [!!named('Raw karambwan'), named('Raw karambwan')?.lvl], [true, '65']);
    // ...and nothing was knocked out of order by the two insertions, which is the thing a
    // renumbered list gets wrong: a row written to the wrong component overwrites its neighbour.
    const lvls = filled.map(r => Number(r.lvl));
    check(
        '  and every row still reads higher than the one above it',
        lvls.every((v, i) => i === 0 || v >= lvls[i - 1]),
        true
    );
    H.despawn(p);
}

// ------------------------------------------------------------------- the cook
/** Put a fire down next to the player, hand them `n` raw karambwan, and set the quest stage. */
function cook(name: string, level: number, stage: number, picks: (number | string)[] = []) {
    const p: any = player(name, 3222, 3218);
    p.setLevel(PlayerStat.COOKING, level);
    H.clearInv(p);
    H.setVar(p, 'tbwt_main', stage);
    A.addLoc('fire', 3222, 3219, 0);
    H.give(p, 'tbwt_raw_karambwan');
    const before = COOK(p);
    const m = A.mark();
    const said = A.useOn(p, 3222, 3219, 'fire', 'tbwt_raw_karambwan', picks);
    H.tick(12);
    return {
        p,
        said: said.concat(A.mesSince(p, m)),
        xp: (COOK(p) - before) / XP,
        poison: H.invCount(p, 'tbwt_poorly_cooked_karambwan'),
        food: H.invCount(p, 'tbwt_cooked_karambwan'),
        burnt: H.invCount(p, 'tbwt_burnt_karambwan'),
        raw: H.invCount(p, 'tbwt_raw_karambwan')
    };
}

console.log('\nBEFORE THE TRIO IS OVER THERE IS NO CHOICE: it comes out poison, and pays 80');
{
    // Cooking 99 makes the 70/255 roll certain (70*0/98 + 255*98/98 + 1 = 256 of 256), so what is
    // left is the outcome and the experience rather than the odds.
    const r = cook('kb_mid', 99, 0);
    check('  one poison karambwan', [r.poison, r.food, r.burnt, r.raw], [1, 0, 0, 0]);
    check('  and 80 Cooking experience, where it used to pay nothing', r.xp, 80);
    check(
        '  without asking how to cook it',
        r.said.some(s => /thoroughly/i.test(s)),
        false
    );
    H.despawn(r.p);
}

console.log('\nAFTER IT, THE PLAYER PICKS');
{
    const thorough = cook('kb_thorough', 99, 6, ['thoroughly']);
    check('  cooked through: one cooked karambwan and 190', [thorough.food, thorough.poison, thorough.xp], [1, 0, 190]);
    check(
        '    and it says so',
        thorough.said.some(s => s.includes('It is safe')),
        true
    );
    H.despawn(thorough.p);

    const poorly = cook('kb_poorly', 99, 6, ['poorly']);
    check('  cooked poorly on purpose: one poison karambwan and 80', [poorly.poison, poorly.food, poorly.xp], [1, 0, 80]);
    H.despawn(poorly.p);

    // The thorough cook is the only half with a level on it. Old School shows the option anyway
    // and refuses it, which is why the check is inside the choice and not in front of it.
    const low = cook('kb_low', 29, 6, ['thoroughly']);
    check(
        '  Cooking 29 is refused the thorough cook',
        low.said.some(s => s.includes('Cooking level of 30')),
        true
    );
    check('    and keeps the raw one', [low.raw, low.food, low.poison, low.xp], [1, 0, 0, 0]);
    H.despawn(low.p);

    // ...and 29 can still cook it badly, because that half needs level 1. The roll at 29 is 123 of
    // 256, so what is asserted is that the cook HAPPENED - one outcome or the other, nothing raw
    // left, no refusal - rather than which way a coin came down.
    const lowPoor = cook('kb_lowpoor', 29, 6, ['poorly']);
    check('  and can still cook it badly', [lowPoor.raw, lowPoor.poison + lowPoor.burnt], [0, 1]);
    check(
        '    with no level refusal in the way',
        lowPoor.said.some(s => s.includes('Cooking level of')),
        false
    );
    check('    and 80 experience if it did not burn', lowPoor.xp, lowPoor.poison * 80);
    H.despawn(lowPoor.p);
}

console.log('\nAND IT BURNS NOW, WHICH IT NEVER DID');
{
    // Level 1 is 71 of 256, so twenty cooks turn up both outcomes with room to spare. Counting
    // both rather than asserting one keeps this off a single roll. One raw karambwan per cook,
    // because two or more opens the Cook-X count first and this is not a test of that.
    const p: any = player('kb_burn', 3222, 3218);
    p.setLevel(PlayerStat.COOKING, 1);
    H.setVar(p, 'tbwt_main', 0);
    A.addLoc('fire', 3222, 3219, 0);
    let burnt = 0;
    let poison = 0;
    let rawLeft = 0;
    const before = COOK(p);
    for (let i = 0; i < 20; i++) {
        H.clearInv(p);
        H.give(p, 'tbwt_raw_karambwan');
        A.useOn(p, 3222, 3219, 'fire', 'tbwt_raw_karambwan');
        H.tick(12);
        rawLeft += H.invCount(p, 'tbwt_raw_karambwan');
        burnt += H.invCount(p, 'tbwt_burnt_karambwan');
        poison += H.invCount(p, 'tbwt_poorly_cooked_karambwan');
    }
    check('  twenty cooks at level 1 leave nothing raw', rawLeft, 0);
    check('  some burnt', burnt > 0, true);
    check('  some poison', poison > 0, true);
    check('  and they add up to twenty', burnt + poison, 20);
    check('  with 80 experience for each one that worked', (COOK(p) - before) / XP, poison * 80);
    H.despawn(p);
}

console.log("\nTHE BURNT ONE HAS THE GAME'S OWN LINE FOR IT");
{
    const p: any = player('kb_burnt', 3222, 3218);
    H.clearInv(p);
    A.addLoc('fire', 3222, 3219, 0);
    H.give(p, 'tbwt_burnt_karambwan');
    const said = A.useOn(p, 3222, 3219, 'fire', 'tbwt_burnt_karambwan');
    check('  a burnt octopus is nothing to be gained from heating', A.saw(said, 'burnt octopus'), true);
    check('  and is not "You can\'t cook that."', A.saw(said, "can't cook that"), false);
    check('  and is still there', H.invCount(p, 'tbwt_burnt_karambwan'), 1);
    H.despawn(p);
}

console.log('\nTHE OLD TINDERBOX ROUTE IS GONE, AND THE KNIFE STILL SAYS ITS LINE');
{
    const p: any = player('kb_held', 3222, 3218);
    H.clearInv(p);
    H.setVar(p, 'tbwt_main', 6);
    p.setLevel(PlayerStat.COOKING, 99);

    H.give(p, 'tbwt_raw_karambwan');
    H.give(p, 'knife');
    // A ~mesbox from a trigger run through useHeld is on screen before drive() starts recording,
    // so the lines come off the interface log from a mark taken BEFORE the click, not off what
    // useHeld hands back. (craftgaps.ts learned this the same way.)
    const ifMark = H.ifaces.length;
    A.useHeld(p, 'knife', 'tbwt_raw_karambwan');
    const box = H.ifaces
        .slice(ifMark)
        .filter(i => i.who === p.username && i.kind === 'text')
        .map(i => i.text ?? '');
    check('  a knife on a raw one says it has to be cooked first', A.saw(box, 'has to be cooked'), true);
    check('    and does not cook it', [H.invCount(p, 'tbwt_raw_karambwan'), H.invCount(p, 'tbwt_cooked_karambwan')], [1, 0]);

    H.give(p, 'tinderbox');
    const before = COOK(p);
    A.useHeld(p, 'tinderbox', 'tbwt_raw_karambwan');
    H.tick(8);
    check('  a tinderbox no longer cooks it over thin air', [H.invCount(p, 'tbwt_raw_karambwan'), H.invCount(p, 'tbwt_cooked_karambwan'), COOK(p) - before], [1, 0, 0]);
    H.despawn(p);
}

console.log(`\n${R.ok} ok, ${R.bad} FAIL`);
process.exit(R.bad ? 1 : 0);
