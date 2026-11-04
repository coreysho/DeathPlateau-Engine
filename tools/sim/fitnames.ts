/**
 * fitName, on its own. Every other sim in here leans on it for a username the world will accept,
 * and it is the one piece of the harness that can be measured without a world, so it is measured
 * without one: this file runs in under a second.
 */
import { fitName } from './fitname.js';
import { toBase37 } from '#/util/JString.js';

let ok = 0;
let bad = 0;
const check = (what: string, got: unknown, want: unknown) => {
    const g = JSON.stringify(got);
    const w = JSON.stringify(want);
    if (g === w) {
        ok++;
        console.log(`  ok   ${what}: ${g}`);
    } else {
        bad++;
        console.log(`  FAIL ${what}: ${g} != ${w}`);
    }
};

// What the truncation actually is, measured off toBase37 rather than remembered. An underscore
// inside the first twelve characters holds a place and counts as zero, and a trailing zero is
// divided away, so these two 13-character names are one account and the same names without the
// underscore are two.
check('an underscore costs a slot', toBase37('orn1333_11207') === toBase37('orn1333_11206'), true);
check('and without it they are two accounts', toBase37('orn133311207') === toBase37('orn133311206'), false);
check('a trailing separator is divided away', toBase37('ab') === toBase37('ab__'), true);

// A name that fits is left alone, so a sim's log still says what the sim asked for.
check('a short name is its own username', fitName('plundclock'), 'plundclock');
check('exactly twelve letters is still its own', fitName('abcdefghijkl'), 'abcdefghijkl');
check('asking twice gives the same name', fitName('plundclock'), 'plundclock');

// The cases that were silently one account. Each group keeps its first label and shortens the rest
// to head-plus-tail, which is where the difference between two cases of one sim lives.
const groups = [
    ['spec_dragon_sword', 'spec_dragon_warhammer', 'spec_dragon_dagger', 'spec_dragon_halberd'],
    ['wear_imbued_ancient_cape_guthix', 'wear_imbued_ancient_cape_saradomin', 'wear_imbued_ancient_cape_zamorak'],
    ['orn1333_11207', 'orn1333_11206', 'orn1333_11205'],
    ['gp_vial_empty_5', 'gp_vial_empty_1', 'gp_vial_empty_9'],
    ['o2_candle_lantern_black_lit', 'o2_candle_lantern_lit'],
    ['fall_seed_varrock_3213_3414', 'fall_seed_varrock_3221_3416', 'fall_seed_varrock_3213_3416'],
    ['basaltsafehorror_jumping_spot1_0', 'basaltsafehorror_jumping_spot1_1', 'basaltsafehorror_jumping_spot1_2']
];
for (const labels of groups) {
    const names = labels.map(l => fitName(l));
    const accounts = new Set(names.map(n => String(toBase37(n))));
    check(`${labels.length} of ${labels[0]} are ${labels.length} accounts`, accounts.size, labels.length);
    check('  and the first one keeps its name', names[0], labels[0]);
    console.log(`       ${labels.map((l, i) => `${l} -> ${names[i]}`).join('\n       ')}`);
}

// Across every label above, no two share an account - the groups are not checked in isolation.
const everything = ['plundclock', 'abcdefghijkl', ...groups.flat()];
const all = new Set(everything.map(l => String(toBase37(fitName(l)))));
check('and no two of all of them collide', all.size, everything.length);

// A label that fits keeps itself even when it is longer than twelve characters - the world
// truncates it to the account we reserved for it, which is the point. But a name fitName had to
// INVENT must fit in twelve, or the world would truncate that in turn and undo the counter.
check(
    'every invented name fits in twelve characters',
    everything.map(l => fitName(l)).filter(n => !everything.includes(n) && n.length > 12),
    []
);

console.log(`\n${ok} ok, ${bad} FAIL`);
process.exit(bad === 0 ? 0 : 1);
