// COOKING ON A FIRE THAT NOBODY CATEGORISED.
// Usage: npx tsx tools/sim/hamfire.ts   (exit code is the verdict)
//
// Reported from play: "Fire doesn't work in HAM Hideout. Fire doesn't work when trying to cook raw
// chicken or anchovies from HAM members. Try using food on either fire in the dungeon."
//
// Cooking in this build runs off ONE thing: the loc's category. skill_cooking/scripts/cooking.rs2
// is [oplocu,_cooking_fire] and [oplocu,_cooking_oven] and nothing else - there is no per-loc
// handler and no name matching. The HAM Hideout's fires are favour_campfire, which had no category
// at all, so using food on one did nothing whatsoever: no message, no animation, no burnt chicken.
//
// It was not one fire. favour_campfire is placed eight times (the two in the hideout, plus six
// around Burthorpe and the Troll Stronghold), and sweeping every PLACED loc that calls itself a
// fire, a fireplace, a range, a stove or an oven and cannot cook turned up eleven more types.
// Twelve are categorised now; the ones left are listed in cooking_sources.loc, with why.
import * as H from './harness.js';
import { check, R, player } from './a1lib.js';
import LocType from '#/cache/config/LocType.js';
import CategoryType from '#/cache/config/CategoryType.js';

await H.boot();

const catOf = (name: string): string => {
    const t = LocType.get(LocType.getId(name));
    return t.category === -1 ? '-' : (CategoryType.get(t.category)?.debugname ?? String(t.category));
};

console.log('== the HAM Hideout fire is a cooking fire');
{
    check('favour_campfire is categorised', catOf('favour_campfire'), 'cooking_fire');
    // The two the report names, and the six nobody mentioned.
    const all = H.locsNear('favour_campfire', 3150, 9620, 0);
    const inHideout = all.filter(l => l.x > 3120 && l.x < 3230 && l.z > 9530 && l.z < 9740);
    check('  and it is placed in the hideout', inHideout.length >= 2, true);
    check('  eight placements in all', all.length, 8);
}

console.log('\n== and raw chicken cooks on it');
{
    const fire = H.locsNear('favour_campfire', 3150, 9620, 0).filter(l => l.z > 9530)[0];
    const p: any = player('hamcook', fire.x + 1, fire.z, 0);
    p.setLevel(7, 99); // cooking
    H.clearInv(p);
    H.give(p, 'raw_chicken', 5);
    H.clearLogs();
    check('the food goes on the fire', H.useHeldOnLoc(p, 'raw_chicken', fire.x, fire.z, 'favour_campfire'), true);
    for (let t = 0; t < 10 && p.modalChat < 0; t++) H.tick(1);
    // Five of one thing opens the how-many panel, the same cookx panel the range uses.
    check('  it asks how many', p.modalChat >= 0, true);
    H.choose(p, 'cookx:com_6'); // Make 1
    for (let t = 0; t < 20; t++) H.tick(1);
    check('  one raw chicken went', H.invCount(p, 'raw_chicken'), 4);
    // A 99 cook does not burn a chicken, but the test is that SOMETHING came off the fire.
    const cooked = H.invCount(p, 'cooked_chicken') + H.invCount(p, 'burnt_chicken');
    check('  and one came off cooked or burnt', cooked, 1);
}

console.log('\n== raw anchovies too, which is the other half of the report');
{
    const fire = H.locsNear('favour_campfire', 3150, 9620, 0).filter(l => l.z > 9530)[1];
    const p: any = player('hamcook2', fire.x + 1, fire.z, 0);
    p.setLevel(7, 99);
    H.clearInv(p);
    H.give(p, 'raw_anchovies', 1);
    H.clearLogs();
    H.useHeldOnLoc(p, 'raw_anchovies', fire.x, fire.z, 'favour_campfire');
    for (let t = 0; t < 20; t++) H.tick(1);
    check('one raw anchovy went', H.invCount(p, 'raw_anchovies'), 0);
    check('  and one came back', H.invCount(p, 'anchovies') + H.invCount(p, 'burntfish1'), 1);
}

// THE REST OF THE SWEEP. Each of these is a placed loc whose own name and description say it is
// for cooking, and none of them could cook before. The four fires and the clay oven moved into
// cooking_sources.loc; the other seven were categorised in the area or quest file that owns them.
console.log('\n== and the eleven others found with it');
{
    const fires = [
        'viking_house_fire',
        'viking_longhall_fire',
        'farm_fireplace',
        'qip_sheep_shearer_fireplacecookingpot',
        'dwarf_keldagrim_kebab_fireplace',
        'dwarf_keldagrim_poor_fireplace',
        'dwarf_keldagrim_fireplace',
        'dwarf_keldagrim_big_fireplace'
    ];
    for (const f of fires) check(`  ${f}`, catOf(f), 'cooking_fire');
    for (const o of ['elid_clay_oven', '100_dave_stove', 'loc474_16893']) check(`  ${o}`, catOf(o), 'cooking_oven');
}

// AND THE ONES DELIBERATELY LEFT, so a later sweep does not quietly adopt them. Each is a judgment
// about the place rather than about the config, and the list in cooking_sources.loc says so.
console.log('\n== the ones left alone are still left alone');
{
    for (const n of ['fire_remains', 'dwarf_lights', 'soulbane_firewall', 'obelisk_fire', 'blast_furnace_stove_low', 'rimmington_poor_range_chimney', 'elid_spirit_fire', 'dwarf_fire_small']) {
        check(`  ${n} does not cook`, H.locCookInfo(n).cooks, false);
    }
}

console.log(`\n${R.ok} ok, ${R.bad} FAIL`);
process.exit(R.bad ? 1 : 0);
