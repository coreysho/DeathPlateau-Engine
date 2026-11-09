// THE AXE AND PICKAXE LADDERS, AGAINST THE CONFIGS THEY ARE SUPPOSED TO MATCH.
// Usage: npx tsx tools/sim/tooltiers.ts   (exit code is the verdict)
//
// Two procs decide which tool a player gets to use: ~woodcutting_best_axe (woodcut.rs2) and
// ~pickaxe_checker (pickaxe_checker.rs2). Both are hand-written ladders, and the comment in the
// first one says why that is a trap - "An axe that is not named here cannot be used however well
// its config is filled in - the gilded axe had param=woodcutting_struct and a chop animation for
// months and still chopped nothing".
//
// It had happened twice more. The gilded and 3rd Age PICKAXES are clue rewards with a mining rate
// and a mining animation of their own and neither was in ~pickaxe_checker, so neither could mine.
// And two tools had no levelrequire at all - third_age_axe and third_age_pickaxe - so the level a
// player needs read as 0 for anything asking the config rather than the ladder. dragon_axe carried
// 41 where Old School, dragon_pickaxe and the ladder's own "> 60" all say 61.
//
// This file is the check that makes the hand-written ladders safe: every tool the game has, in its
// ladder, with a level the config and the ladder agree on.
import fs from 'fs';
import * as H from './harness.js';
import { check, R } from './a1lib.js';
import ObjType from '#/cache/config/ObjType.js';
import ParamType from '#/cache/config/ParamType.js';
import CategoryType from '#/cache/config/CategoryType.js';

await H.boot();

const param = (objName: string, p: string): number | undefined => {
    const t = ObjType.get(ObjType.getId(objName)) as unknown as { params?: Map<number, unknown> };
    return t.params?.get(ParamType.getId(p)) as number | undefined;
};

/** Every real tool of a category: the ones carrying the param that makes the skill work. */
const tools = (cat: string, marker: string): string[] => {
    const c = CategoryType.getId(cat);
    const m = ParamType.getId(marker);
    const out: string[] = [];
    for (const [name, id] of ObjType.configNames) {
        const t = ObjType.get(id) as unknown as { category: number; certtemplate: number; params?: Map<number, unknown> };
        // certtemplate marks a NOTE, which carries its base item's category and params. certlink
        // is the other way round and is set on every tradeable base item that has a note, so
        // filtering on it drops the whole classic ladder and leaves only the untradeable imports.
        if (t.category !== c || t.certtemplate !== -1) continue;
        if (!t.params?.has(m)) continue;
        out.push(name);
    }
    return out.sort();
};

const src = (f: string) => fs.readFileSync('../content/' + f, 'utf8');

console.log('== every axe the skill knows about is in the axe ladder');
{
    // woodcutting_struct is what makes an axe choppable at all - the animation and the rate hang
    // off it - so an axe that has one and is not in the ladder is an axe that cannot be used.
    const axes = tools('weapon_axe', 'woodcutting_struct');
    check('the build has a ladder-sized set of axes', axes.length >= 10, true);
    const woodcut = src('scripts/skill_woodcutting/scripts/woodcut.rs2');
    const ladder = woodcut.slice(woodcut.indexOf('[proc,woodcutting_best_axe]'));
    const listed = [...new Set([...ladder.matchAll(/\$obj1 = (\w+)\b/g)].map(m => m[1]))].sort();
    check(
        '  and every one of them is in it',
        axes.filter(a => !listed.includes(a)),
        []
    );
    // The blessed axe from Animal Magnetism is the one exception and is meant to be: it is for the
    // undead trees only, has no woodcutting_struct, and ~animmag_chop_tree handles it by name.
    check('  the blessed axe is not one of them', param('animmag_blessed_axe', 'woodcutting_struct') === undefined, true);
}

console.log('\n== and every pickaxe is in the pickaxe ladder');
{
    const picks = tools('weapon_pickaxe', 'mining_animation');
    check('the build has a ladder-sized set of pickaxes', picks.length >= 8, true);
    const listed = [...new Set([...src('scripts/skill_mining/scripts/pickaxe_checker.rs2').matchAll(/oc_param\((\w+), levelrequire\)/g)].map(m => m[1]))].sort();
    check(
        '  and every one of them is in it',
        picks.filter(p => !listed.includes(p)),
        []
    );
    // The two that were missing, by name, because they are what the fix was for.
    check('    the gilded pickaxe among them', listed.includes('gilded_pickaxe'), true);
    check('    and the 3rd Age one', listed.includes('third_age_pickaxe'), true);
}

console.log('\n== every tool says what level it needs, and says it once');
{
    const missing: string[] = [];
    for (const t of [...tools('weapon_axe', 'woodcutting_struct'), ...tools('weapon_pickaxe', 'mining_animation')]) {
        if (param(t, 'levelrequire') === undefined) missing.push(t);
    }
    check('nothing is missing a levelrequire', missing, []);

    // The axe ladder writes its thresholds out as "> n", so the two have to agree: an axe needing
    // level 21 is one the ladder admits above 20. Where they disagree, one of them is a lie and a
    // player finds out by being refused a tool they can use, or handed one they cannot.
    const woodcut = src('scripts/skill_woodcutting/scripts/woodcut.rs2');
    const ladder = woodcut.slice(woodcut.indexOf('[proc,woodcutting_best_axe]'));
    const disagree: string[] = [];
    for (const m of ladder.matchAll(/\$obj1 = (\w+_axe)[\s\S]{0,120}?\$level > (\d+)\)/g)) {
        const want = param(m[1], 'levelrequire');
        // levelrequire 0 is the bronze/iron case: usable from level 1, written as "> 0".
        const expect = Number(m[2]) === 0 ? 0 : Number(m[2]) + 1;
        if (want !== expect) disagree.push(`${m[1]}: ladder > ${m[2]} wants ${expect}, config says ${want}`);
    }
    check('  and the axe ladder agrees with every config', disagree, []);
    // The dragon axe is the one that disagreed, so name it.
    check('    the dragon axe needs 61 Woodcutting', param('dragon_axe', 'levelrequire'), 61);
    check('    as the dragon pickaxe needs 61 Mining', param('dragon_pickaxe', 'levelrequire'), 61);
    check('    and both 3rd Age tools need 61 too', [param('third_age_axe', 'levelrequire'), param('third_age_pickaxe', 'levelrequire')], [61, 61]);
}

console.log(`\n${R.ok} ok, ${R.bad} FAIL`);
process.exit(R.bad ? 1 : 0);
