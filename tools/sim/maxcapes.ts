// THE MAX CAPE AND ITS TEN VARIANTS, and who is allowed to wear them.
//
//   npx tsx tools/sim/maxcapes.ts
//
// Reported from the game as "max cape equippable at 1 def", and it was all ten variants rather than
// the plain cape: the six god ones went to @god_cape_equip, which asks about the staff in your hand
// and nothing else, and the other four had no [opheld2,...] at all and fell through to the global
// equip, which wears anything. tools/maxcape_battery.py reads the generated script and checks that
// every variant names the gate; this stands a player up and clicks Wear, which is the only thing
// that proves the gate is REACHED - a trigger can name a gate and still be shadowed by another
// trigger, and a static reader cannot see that.
import * as H from './harness.js';
import * as A from './a1lib.js';
import { check, R, player } from './a1lib.js';
import { PlayerStatMap } from '#/engine/entity/PlayerStat.js';

await H.boot();
H.loginOrder();

const GOD = { saradomin_max_cape: 'saradomin', guthix_max_cape: 'guthix', zamorak_max_cape: 'zamorak', imbued_saradomin_max_cape: 'saradomin', imbued_guthix_max_cape: 'guthix', imbued_zamorak_max_cape: 'zamorak' } as Record<string, string>;
const VARIANTS = ['fire_max_cape', 'infernal_max_cape', 'undertaker_max_cape', 'accumulator_max_cape', 'saradomin_max_cape', 'guthix_max_cape', 'zamorak_max_cape', 'imbued_saradomin_max_cape', 'imbued_guthix_max_cape', 'imbued_zamorak_max_cape'];
const HOODS = ['max_hood', 'fire_max_hood', 'saradomin_max_hood'];
// PlayerStatMap and not Object.values(PlayerStat): PlayerStat is a `const enum`, which has no
// runtime object to enumerate - tsx strips the types and lets it through, and tsc does not.
const NSTATS = PlayerStatMap.size;

/** Click Wear on `cape` and say whether it left the inventory, plus anything the click said. */
function wear(name: string, cape: string, maxed: boolean, hold?: string) {
    const p: any = player(name, 3200, 3200);
    if (!maxed) for (let s = 0; s < NSTATS; s++) p.setLevel(s, 1);
    H.clearInv(p);
    if (hold) {
        H.equip(p, { rhand: hold });
        H.tick(1);
    }
    H.give(p, cape, 1);
    H.tick(1);
    const m = A.mark();
    A.held(p, cape, 2);
    H.tick(1);
    const out = { worn: H.invCount(p, cape) === 0, said: A.mesSince(p, m) };
    H.despawn(p);
    return out;
}

console.log('EVERY STAT AT 1: the cape and all ten variants are refused, and say the same thing');
{
    // one check per cape rather than a count, so a gate dropped from one of them is caught by the
    // check that names it
    for (const cape of ['max_cape', ...VARIANTS]) {
        const r = wear('mc1_' + cape, cape, false);
        check(`  ${cape.padEnd(26)} refused, with the Max cape's own message`, [r.worn, r.said.some(s => /level 99 in all \d+ skills/.test(s))], [false, true]);
    }
    // ...and the hoods are not, because a skillcape hood is cosmetic in the live game
    for (const hood of HOODS) {
        const r = wear('mch_' + hood, hood, false);
        check(`  ${hood.padEnd(26)} goes on anyway: a hood is cosmetic`, r.worn, true);
    }
}

console.log('\nAND MAXED, EVERY ONE OF THEM GOES ON');
{
    for (const cape of ['max_cape', ...VARIANTS]) {
        const r = wear('mc99_' + cape, cape, true);
        check(`  ${cape.padEnd(26)} worn`, [r.worn, r.said], [true, []]);
    }
}

console.log('\nTHE SIX GOD VARIANTS STILL REFUSE THE STAFF OF ANOTHER GOD');
{
    // the gate goes first and the staff test second, and both have to survive: a maxed player with
    // the wrong staff is refused for the staff, not for the skills
    for (const [cape, god] of Object.entries(GOD)) {
        const wrong = god === 'zamorak' ? 'saradomin_staff' : 'zamorak_staff';
        const r = wear('mcw_' + cape, cape, true, wrong);
        check(`  ${cape.padEnd(26)} refused while holding the ${wrong.split('_')[0]} staff`, [r.worn, r.said.some(s => /staff of another god/.test(s))], [false, true]);
        const ok = wear('mcr_' + cape, cape, true, god + '_staff');
        check('    ...and worn with its own', ok.worn, true);
    }
    // the four with no god are not caught by that test
    for (const cape of ['fire_max_cape', 'accumulator_max_cape']) {
        const r = wear('mcn_' + cape, cape, true, 'zamorak_staff');
        check(`  ${cape.padEnd(26)} has no god to conflict with`, r.worn, true);
    }
}

console.log(`\n${R.ok} ok, ${R.bad} FAIL`);
process.exit(R.bad ? 1 : 0);
