// FREEING EVIL DAVE: the rat IS the spice, seven catches corrupt the cat, and the behemoths are
// optional. The first pass had all three backwards - rats gave nothing, the counter ran to four, and
// the fourth catch forced a behemoth out that was the only source of spice in the game.
//
//   npx tsx tools/sim/hellrats.ts
import * as H from './harness.js';
import * as A from './a1lib.js';
import { check, R, player } from './a1lib.js';
import Npc from '#/engine/entity/Npc.js';
import NpcType from '#/cache/config/NpcType.js';
import LocType from '#/cache/config/LocType.js';
import World from '#/engine/World.js';

await H.boot();

const CELLAR = [3077, 9883] as const;
const SPICES = ['red', 'orange', 'yellow', 'brown'].flatMap(c => [1, 2, 3, 4].map(n => `hundred_dave_spice_${c}_${n}`));
const held = (p: any) => SPICES.filter(s => H.invCount(p, s) > 0);
const total = (p: any) => SPICES.reduce((n, s) => n + H.invCount(p, s), 0);
const catName = (p: any) => {
    const f = H.followerOf(p);
    return f ? (NpcType.get(f.type).debugname ?? String(f.type)) : null;
};

/** A player in Dave's cellar, part way through the sub-quest, with a real cat put down. */
function inCellar(name: string, item = 'growncatobject') {
    const p: any = player(name, CELLAR[0], CELLAR[1], 0);
    H.setVarBit(p, 'hundred_dave_main', 3); // ^hundred_dave_asked
    H.clearInv(p);
    H.give(p, item);
    H.tick(1);
    H.opheld(p, item, 5); // [opheld5,_cat] ~cat_drop
    H.tick(3);
    return p;
}

console.log('\n=== THE RATS PAY THE SPICE');
{
    const p: any = player('rats', CELLAR[0], CELLAR[1], 0);
    H.setVarBit(p, 'hundred_dave_main', 3);
    H.tick(1);
    check('there are Hell-Rats in the cellar', H.npcNear('hundred_dave_hellrat', CELLAR[0], CELLAR[1], 0) !== null, true);
    let paid = 0;
    const colours = new Set<string>();
    const doses = new Set<string>();
    for (let i = 0; i < 60; i++) {
        H.clearInv(p);
        H.tick(1);
        A.runProcProtected(p, '[proc,hundred_dave_hellrat_caught]');
        H.tick(1);
        if (total(p) > 0) paid++;
        for (const s of held(p)) {
            const bits = s.split('_');
            colours.add(bits[3]);
            doses.add(bits[4]);
        }
    }
    check('every single catch hands over a shaker', paid, 60);
    console.log('  colours seen:', [...colours].sort().join(', '));
    console.log('  dose counts seen:', [...doses].sort().join(', '));
    check('all four colours turn up', [...colours].sort(), ['brown', 'orange', 'red', 'yellow']);
    check('and shakers hold one to four doses', [...doses].sort(), ['1', '2', '3', '4']);
}

console.log('\n=== SEVEN CATCHES CORRUPT A GROWN CAT');
{
    const p = inCellar('seven');
    check('the cat is down and following', catName(p), 'growncat');
    for (let i = 1; i <= 6; i++) {
        A.runProcProtected(p, '[proc,hundred_dave_hellrat_caught]');
        H.tick(1);
        H.clearInv(p);
    }
    check('six catches leaves the counter at six', H.getVarBit(p, 'hundred_dave_hellrats_caught'), 6);
    check('  ...and the cat still an ordinary cat', catName(p), 'growncat');
    A.runProcProtected(p, '[proc,hundred_dave_hellrat_caught]');
    H.tick(3);
    check('the seventh corrupts it', catName(p), 'growncat_hell');
    check('  ...the counter resets', H.getVarBit(p, 'hundred_dave_hellrats_caught'), 0);
    check('  ...and it remembers what colour it was', H.getVarBit(p, 'hundred_dave_original_cat_colour'), 1);

    console.log('-- and it stays corrupt');
    const stairs = A.locsNamed('100_dave_celler_stairs', 3070, 9875, 3090, 9900, [0]);
    console.log('  the stairs out are at', stairs[0]);
    A.op(p, stairs[0][0], stairs[0][1], '100_dave_celler_stairs', 1);
    H.tick(10);
    console.log('  the player is now at', [(p as any).level, (p as any).x, (p as any).z]);
    check('climbing out no longer turns the cat back', catName(p), 'growncat_hell');

    console.log('-- and milk turns it back');
    H.give(p, 'bucket_milk');
    H.tick(1);
    const lines = A.useOnNpc(p, 'growncat_hell', 'bucket_milk');
    H.tick(8);
    console.log('  the cat is now', catName(p), lines.slice(0, 1));
    check('a bucket of milk turns a hell-cat back into the cat it was', catName(p), 'growncat');
    check('  ...and spends the bucket', [H.invCount(p, 'bucket_milk'), H.invCount(p, 'bucket_empty')], [0, 1]);
}

console.log('\n=== A KITTEN TURNS BY CHANCE, NOT BY COUNT');
{
    let turned = 0;
    const runs = 12;
    for (let r = 0; r < runs; r++) {
        const p = inCellar('kit' + r, 'kittenobject');
        if (catName(p) !== 'kittenpet1') continue;
        for (let i = 0; i < 6 && catName(p) === 'kittenpet1'; i++) {
            A.runProcProtected(p, '[proc,hundred_dave_hellrat_caught]');
            H.tick(1);
            H.clearInv(p);
        }
        if (catName(p) === 'kittenpet_hell') turned++;
    }
    console.log(`  ${turned} of ${runs} kittens turned inside six catches`);
    check('a kitten can turn before the seventh catch', turned > 0, true);
    check('  ...but not every one of them does', turned < runs, true);
}

console.log('\n=== THE BEHEMOTHS ARE OPTIONAL, ONE PER CURTAIN');
{
    const CURTAINS: [string, number, number, number, string][] = [
        ['red', 3073, 9886, 0, '100_dave_crypt_curtainsl'],
        ['orange', 3073, 9888, 1, '100_dave_crypt_curtainsl'],
        ['yellow', 3074, 9894, 2, '100_dave_crypt_curtainsr'],
        ['brown', 3074, 9897, 3, '100_dave_crypt_curtainsl']
    ];
    for (const [, x, z, , name] of CURTAINS) {
        check(`a ${name} stands at ${x},${z}`, World.getLoc(x, z, 0, LocType.getId(name)) !== null, true);
    }
    const lt = LocType.get(LocType.getId('100_dave_crypt_curtainsl'));
    check('the curtains are clickable now', (lt.op ?? []).filter(o => o).join('/'), 'Look-behind');

    // mid-quest: nothing comes out
    const p = inCellar('curtain');
    let m = A.mark();
    A.op(p, 3073, 9886, '100_dave_crypt_curtainsl', 1);
    H.tick(8);
    console.log('  mid-quest:', A.mesSince(p, m).slice(0, 1));
    check('mid-quest the curtain stays shut', H.npcNear('hundred_dave_hellrat_behemoth', 3073, 9886, 0) === null, true);

    // after the sub-quest: the yellow curtain, and only the yellow shaker
    H.setVarBit(p, 'hundred_dave_main', 5); // ^hundred_dave_done
    H.setVarBit(p, 'hundred_subquest_tally', 1023); // every sub-quest marked done
    H.tick(2);
    m = A.mark();
    // CATCH IT ON THE TICK IT APPEARS. It spawns on the player with huntmode=aggressive_melee and
    // opens with opplayer2, the player auto-retaliates, and 40 hitpoints do not survive ten ticks of
    // that - so the message said "the thing that has been eating the hell-rats comes out of it" and
    // the look afterwards found nothing, which read as a curtain that would not open. Same race as
    // audit1's Recipe for Disaster block.
    // NOT A.op() HERE. op() ends in drive(), which ticks until the chat settles - about thirty ticks
    // - and the behemoth spawns on the player with huntmode=aggressive_melee, opens with opplayer2,
    // and loses all 40 of its hitpoints to the player's auto-retaliation inside that. The message
    // said "the thing that has been eating the hell-rats comes out of it" and every look afterwards
    // found nothing, which read as a curtain that would not open. The raw click, ticked one at a
    // time, catches it; audit1's Recipe for Disaster block had the identical race.
    H.opLoc(p, 3074, 9894, '100_dave_crypt_curtainsr', 1);
    let b: Npc | null = null;
    for (let t = 0; t < 30 && !b; t++) {
        H.tick(1);
        b = H.npcNear('hundred_dave_hellrat_behemoth', 3074, 9894, 0);
    }
    console.log('  after the quest:', A.mesSince(p, m).slice(0, 1));
    check('the yellow curtain lets one out', b !== null, true);
    check('  ...and it records yellow (2) as the colour owed', H.getVarBit(p, 'hundred_dave_behemoth_colour'), 2);
    if (b) {
        const nt = NpcType.get(b.type);
        console.log(`  it is level ${nt.vislevel} with ${nt.stats[3]} hitpoints`);
        m = A.mark();
        A.op(p, 3073, 9886, '100_dave_crypt_curtainsl', 1);
        H.tick(6);
        check(
            'a second curtain will not open while one is out',
            A.mesSince(p, m).some(s => s.includes('already out')),
            true
        );
        H.clearInv(p);
        H.tick(1);
        A.fight(p, b, 1200);
        H.tick(12);
        console.log('  it paid:', held(p));
        check('killing it pays a four-dose YELLOW shaker', held(p), ['hundred_dave_spice_yellow_4']);
        check('  ...straight into the pack, not onto the floor', H.invCount(p, 'hundred_dave_spice_yellow_4'), 1);
    }
}

console.log(`\n${R.ok} ok, ${R.bad} FAIL`);
process.exit(R.bad ? 1 : 0);
