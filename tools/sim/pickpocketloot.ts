// HOW MANY THINGS ONE POCKET PAYS, measured. The pickpocket loot column carries two different
// kinds of table - a weighted one that pays ONE row, and guaranteed drops that pay ALL of them -
// and the proc used to treat both as the second, so a 36-row table paid about three items a go.
// Asked as "am i supposed to be receiving 3 items per pickpocket at ham members?". No.
//
//   npx tsx tools/sim/pickpocketloot.ts
import * as H from './harness.js';
import * as A from './a1lib.js';
import { check, R } from './a1lib.js';
import World from '#/engine/World.js';
import { PlayerStat } from '#/engine/entity/PlayerStat.js';

await H.boot();

// Simpler and truer to the game: drive the real op on a real npc and count what the pocket paid.
function viaNpc(npcName: string, items: string[], tries: number) {
    const npc = (() => {
        for (const n of World.npcs) if (n && n.isActive && n.type === (A.NpcType as any).getId(npcName)) return n;
        return null;
    })();
    if (!npc) return null;
    const p: any = A.player('n_' + npcName, npc.x + 1, npc.z, npc.level);
    p.setLevel(PlayerStat.THIEVING, 99);
    H.tick(2);
    const counts: number[] = [];
    const kinds = new Map<string, number>();
    let successes = 0;
    for (let i = 0; i < tries; i++) {
        H.clearInv(p);
        H.setVar(p, 'stunned', 0);
        H.setVar(p, 'action_delay', 0);
        H.tick(1);
        H.opNpc(p, npc, 3);
        // Long enough for the whole attempt to resolve. At 4 ticks one pocket in ~370 landed its
        // item AFTER the count and showed up as a second kind in the next attempt's window, which
        // looks exactly like a double pay and is not one.
        H.tick(10);
        let got = 0;
        for (const it of items) {
            const c = H.invCount(p, it);
            if (c > 0) { got++; kinds.set(it, (kinds.get(it) ?? 0) + 1); }
        }
        if (got > 0) { successes++; counts.push(got); }
    }
    const mean = counts.length ? counts.reduce((a, b) => a + b, 0) / counts.length : 0;
    return { mean, max: counts.length ? Math.max(...counts) : 0, kinds, successes, paid: counts.length };
}

const HAM = ['coins', 'digsitebuttons', 'digsitearmour1', 'digsitesword', 'bronze_arrow',
    'bronze_axe', 'bronze_dagger', 'bronze_pickaxe', 'iron_axe', 'iron_dagger', 'iron_pickaxe',
    'leather_armour', 'feather', 'logs', 'thread', 'cow_hide', 'steel_arrow', 'steel_axe',
    'steel_dagger', 'steel_pickaxe', 'knife', 'needle', 'raw_anchovies', 'raw_chicken',
    'tinderbox', 'uncut_opal', 'uncut_jade', 'coal', 'iron_ore', 'ham_shirt', 'ham_robe',
    'ham_gloves', 'ham_boots', 'ham_cloak', 'ham_badge', 'ham_hood'];

console.log('=== A WEIGHTED TABLE PAYS ONE ROW');
{
    const r = viaNpc('favour_male_ham_civilian', HAM, 400);
    if (!r) { console.log('  no H.A.M. member spawned'); }
    else {
        console.log(`  ${r.paid} of 400 attempts paid something; mean kinds per paying pocket ${r.mean.toFixed(3)}, most ${r.max}`);
        console.log('  the ten commonest:', [...r.kinds].sort((a, b) => b[1] - a[1]).slice(0, 10)
            .map(([k, v]) => `${k} ${v}`).join(', '));
        check('a H.A.M. pocket never pays more than one kind of thing', r.max, 1);
        check('  ...and pays exactly one when it pays at all', r.mean, 1);
    }
}

console.log('\n=== GUARANTEED DROPS STILL PAY ALL OF THEM');
{
    // the watchman: 60 coins AND a loaf of bread, both at weight 128
    const r = viaNpc('yanille_watchman', ['coins', 'bread'], 120);
    if (!r) { console.log('  no watchman spawned'); }
    else {
        console.log(`  ${r.paid} of 120 paid; mean kinds ${r.mean.toFixed(3)}, most ${r.max}`);
        console.log('  what landed:', [...r.kinds].map(([k, v]) => `${k} ${v}`).join(', '));
        check('the watchman still pays the coins AND the bread', r.max, 2);
        check('  ...every single time he pays', r.mean, 2);
    }
}

console.log('\n=== AND THE PALADIN');
{
    const r = viaNpc('paladin', ['coins', 'chaosrune'], 120);
    if (!r) console.log('  no paladin spawned');
    else {
        console.log(`  ${r.paid} of 120 paid; mean kinds ${r.mean.toFixed(3)}, most ${r.max}`);
        check('coins and chaos runes together', r.max, 2);
    }
}

console.log(`\n${R.ok} ok, ${R.bad} FAIL`);
process.exit(R.bad ? 1 : 0);
