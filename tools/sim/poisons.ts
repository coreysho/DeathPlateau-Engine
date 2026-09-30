// The coconut-milk poisons, brewed through the real engine.
//
//   npx tsx tools/sim/poisons.ts
//
// Antidote+, Weapon poison(+) and Weapon poison(++) could not be made at all: the objs existed and
// the skill guide listed them, but no brew_potion struct described them and nothing in the game
// produced one. Antidote++ was the only one of the four that worked, and is the template.
//
// Each is two steps - a herb into COCONUT MILK, then a secondary into the unfinished potion - and
// both steps are driven here the way a player does them, by using one item on the other.
import * as H from './harness.ts';
import * as A from './a1lib.ts';
import { PlayerStat } from '#/engine/entity/PlayerStat.js';

await H.boot();
let ok = 0, fail = 0;
const check = (what: string, got: unknown, want: unknown) => {
    const good = JSON.stringify(got) === JSON.stringify(want);
    console.log(`  ${good ? 'ok  ' : 'FAIL'} ${what}${good ? '' : `  got ${JSON.stringify(got)} want ${JSON.stringify(want)}`}`);
    good ? ok++ : fail++;
};

let n = 0;
function brewer(herblore: number) {
    const p = H.makePlayer('brew' + n, 3222 + (n % 6), 3218, 800 + n); n++;
    H.tick(2);
    H.maxOut(p);
    H.clearInv(p);
    // DRUIDIC RITUAL, or the skill refuses every action regardless of level - which reads as
    // "nothing brews" and is not the recipe being missing. craftgaps.ts sets the same var.
    H.setVar(p, 'druidquest', 4);
    p.setLevel(PlayerStat.HERBLORE, herblore);
    H.tick(1);
    return p;
}

/** Use one on the other and say what came out, exactly as a player would. */
function mix(level: number, a: string, b: string, want: string): { made: number; xp: number } {
    const p = brewer(level);
    H.give(p, a, 1);
    H.give(p, b, 1);
    const before = p.stats[PlayerStat.HERBLORE];
    A.useHeld(p, a, b);
    H.tick(4);
    const made = H.invCount(p, want);
    const xp = Math.round((p.stats[PlayerStat.HERBLORE] - before));
    H.despawn(p);
    H.tick(1);
    return { made, xp };
}

// step name, level, the two items, what should come out, and the xp x10 the wiki gives
const STEPS: [string, number, string, string, string, number][] = [
    ['Antidote+ (unf)', 68, 'toadflax', 'vial_coconut_milk', 'unfinished_antidote+', 0],
    ['Antidote+', 68, 'yew_roots', 'unfinished_antidote+', 'antidote+4', 1550],
    ['Weapon poison+ (unf)', 73, 'cactus_spine', 'vial_coconut_milk', 'unfinished_weapon_poison+', 0],
    ['Weapon poison(+)', 73, 'red_spiders_eggs', 'unfinished_weapon_poison+', 'weapon_poison+', 1900],
    ['Weapon poison++ (unf)', 82, 'nightshade', 'vial_coconut_milk', 'unfinished_weapon_poison++', 0],
    ['Weapon poison(++)', 82, 'poisonivy_berries', 'unfinished_weapon_poison++', 'weapon_poison++', 1900],
    // The one that already worked, so a regression in the shared code shows up here too.
    ['Antidote++ (unf)', 79, 'irit_leaf', 'vial_coconut_milk', 'unfinished_antidote++', 0],
    ['Antidote++', 79, 'magic_roots', 'unfinished_antidote++', 'antidote++4', 1775],
];

console.log('EVERY STEP OF THE THREE POISONS, AND THE ONE THAT ALREADY WORKED');
for (const [name, level, a, b, want, xp] of STEPS) {
    const r = mix(level, a, b, want);
    check(`${name}: ${a} + ${b}`, r.made > 0, true);
    if (xp > 0) check(`  and ${xp / 10} Herblore xp`, r.xp, xp);
}

console.log('\nAND THE LEVEL IS A GATE, NOT A SUGGESTION');
for (const [name, level, a, b, want] of STEPS) {
    if (level < 2) continue;
    const r = mix(level - 1, a, b, want);
    check(`  one level short of ${name} makes nothing`, r.made, 0);
}

console.log('\nRED SPIDERS\' EGGS STILL MAKE WHAT THEY ALWAYS DID');
// They now carry three recipes - restore, super restore and weapon poison(+) - and get_brew_struct
// walks struct, _secondary, _tertiary in order. Adding the third must not shadow the first two.
{
    const r1 = mix(22, 'red_spiders_eggs', 'harralandervial', '3dosestatrestore');
    check('  harralander potion (unf) still gives a restore potion', r1.made > 0, true);
}

console.log(`\n${ok + fail} checks: ${ok} ok, ${fail} FAILED`);
process.exit(0);
