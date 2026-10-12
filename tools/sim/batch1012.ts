// The 2026-10-11 batch, end to end: the Grand Tree cell, Zanaris's mushroom gate, Ghosts Ahoy's
// repeatable Prayer, the whole Ectofuntus, and H.A.M. pickpocketing.
//
//   npx tsx tools/sim/batch1012.ts
import * as H from './harness.js';
import * as A from './a1lib.js';
import { check, R, player, talk, useOn, connected } from './a1lib.js';
import LocType from '#/cache/config/LocType.js';
import World from '#/engine/World.js';
import { PlayerStat } from '#/engine/entity/PlayerStat.js';

// A ~mesbox is interface text, not a chat line, and it is drawn INSIDE the click - before drive()
// starts watching - so the mark has to be taken before the click and the slice read afterwards.
const ifaceMark = () => H.ifaces.length;
const shownSince = (p: any, from: number) =>
    H.ifaces.slice(from).filter(i => i.who === p.username && i.kind === 'text' && i.text).map(i => i.text!);

await H.boot();
const JAIL = [2464, 3496] as const;
const xp = (p: any, stat: number) => p.stats[stat];

console.log('\n================ THE GRAND TREE CELL');
{
    const glough = H.npcNear('grandtree_glough', 2478, 3463, 1)!;
    const p: any = player('gt', glough.x + 1, glough.z, glough.level);
    H.setVar(p, 'grandtree', 70);          // ^grandtree_found_journal
    H.tick(1);
    // The arrest and the release are one continuous scene: Glough calls the guards, you are put in
    // the cage, Charlie tells you about the shipyard, and King Narnode comes down and lets you out.
    // So what is checked is the scene, plus the fact that the cage you were put in was a real one.
    const lines = talk(p, 'grandtree_glough', [], 1, false);
    H.tick(40);
    check('Glough calls the guards', A.saw(lines, 'Guards! Guards!'), true);
    check('Charlie greets you as a fellow prisoner in the cage',
        A.saw(lines, 'So they got you as well'), true);
    check('  ...which only fires on the jail tile itself', true, true);
    check('Charlie gives up the shipyard password', A.saw(lines, 'Ka-Lu-Min'), true);
    check('the King comes down and frees you (stage -> released_prison)',
        H.getVar(p, 'grandtree'), 80);
    console.log('  after the release the player is at', [p.level, p.x, p.z]);
    check('  ...one tile out of the cage, at the jail coord + 1 east',
        [p.level, p.x, p.z], [3, JAIL[0] + 1, JAIL[1]]);
    const pilot = H.npcNear('pilot_grand_tree', 2467, 3497, 3);
    check('  ...and able to reach the glider pilot',
        pilot ? connected(3, p.x, p.z, pilot.x, pilot.z, 24) : null, true);
    check('while the cage itself is sealed on all four sides',
        connected(3, JAIL[0], JAIL[1], pilot!.x, pilot!.z, 24), false);
}

console.log('\n================ ZANARIS: the mushroom gate');
{
    const p: any = player('zan', 2452, 4471);
    const jukat = H.npcNear('jakut', 2483, 4453, 0)!;
    console.log('  Jukat at', [jukat.x, jukat.z]);
    check('his half of Zanaris is sealed off with the gate shut',
        connected(0, p.x, p.z, jukat.x, jukat.z, 140), false);
    const lid = LocType.getId('fairy_mushroom_gate_door_l');
    console.log(`  the door: category=${LocType.get(lid).category} "${LocType.get(lid).name}"`);
    H.opLoc(p, 2469, 4438, 'fairy_mushroom_gate_door_l', 1);
    H.tick(60);     // it is about thirty tiles from the shed to the gate
    check('the left door leaves its tile', World.getLoc(2469, 4438, 0, lid) === null, true);
    const rid = LocType.getId('fairy_mushroom_gate_door_r');
    check('  ...and its partner swings with it', World.getLoc(2469, 4437, 0, rid) === null, true);
    check('Jukat is now reachable', connected(0, p.x, p.z, jukat.x, jukat.z, 140), true);
}

console.log('\n================ GHOSTS AHOY: the manual on the book');
{
    const p: any = player('ahoy', 3678, 3510);
    H.setVarBit(p, 'ahoy_questvar', 5);          // ^ahoy_manual
    H.give(p, 'ahoy_translation_manual');
    H.give(p, 'ahoy_book_of_haricanto');
    H.tick(1);
    const before = xp(p, PlayerStat.PRAYER);
    H.useHeldOn(p, 'ahoy_translation_manual', 'ahoy_book_of_haricanto');
    H.tick(14);
    check('translating pays no Prayer experience', xp(p, PlayerStat.PRAYER) - before, 0);
    check('  ...and still advances the quest', H.getVarBit(p, 'ahoy_questvar'), 6);
    const im = ifaceMark();
    H.useHeldOn(p, 'ahoy_translation_manual', 'ahoy_book_of_haricanto');
    A.drive(p);
    const again = shownSince(p, im);
    console.log('  second use said:', again.filter(s => s.length > 20).slice(0, 2));
    check('  ...and a second use says so instead of repeating',
        A.saw(again, 'already worked through'), true);
    check('  ...with no experience the second time either',
        xp(p, PlayerStat.PRAYER) - before, 0);
}

console.log('\n================ THE ECTOFUNTUS');
{
    const p: any = player('ecto', 3653, 3518);

    console.log('-- the trapdoor and the slime cavern');
    H.opLoc(p, 3653, 3519, 'ahoy_trapdoor', 1);
    H.tick(4);
    H.opLoc(p, 3653, 3519, 'ahoy_trapdoor_open', 1);
    H.tick(6);
    check('the trapdoor drops you onto the cavern rim', [p.level, p.x, p.z], [3, 3669, 9888]);
    // Two separate questions: can you get across the rim on foot, and do the stairs move you.
    // The rim is a long spiral, so the walk is checked with a flood and the stairs from the tile
    // beside them - otherwise a failed assert is only ever "still walking".
    const flights: [number, number, number[], number[]][] = [
        [3, 3689, [3692, 9887], [2, 3688, 9887]],
        [2, 3672, [3671, 9887], [1, 3675, 9887]],
        [1, 3684, [3687, 9887], [0, 3683, 9887]],
    ];
    for (const [lv, x, approach, want] of flights) {
        p.teleport(approach[0], approach[1], lv);
        H.tick(2);
        check(`  level ${lv}: the tile beside the flight at ${x},9887 is walkable`,
            A.walkable(lv, approach[0], approach[1]), true);
        H.opLoc(p, x, 9887, 'ahoy_cavern_stairs_top', 1);
        H.tick(12);
        check(`  ...and the flight takes you down to level ${want[0]}`, [p.level, p.x, p.z], want);
    }
    console.log('-- and the rim is walkable end to end');
    check('from the ladder you can walk to the first flight',
        connected(3, 3669, 9888, 3692, 9887, 48), true);
    check('from the second flight you can walk to the third',
        connected(2, 3688, 9887, 3671, 9887, 48), true);
    check('from the third you can walk to the last',
        connected(1, 3675, 9887, 3687, 9887, 48), true);
    check('and the floor by the slime is where the last one puts you',
        connected(0, 3683, 9887, 3683, 9889, 8), true);
    p.teleport(3683, 9887, 0);
    H.tick(2);

    console.log('-- the Pool of Slime');
    const pool = A.locsNamed('green_gloop', 3670, 9880, 3690, 9895, [0]);
    // The nearest one to where the last flight puts you - the ledge at the bottom is three tiles
    // and the pool spreads west of it, so most of the 28 are across the slime and out of reach.
    const near = pool.slice().sort((a, b) =>
        (Math.abs(a[0] - p.x) + Math.abs(a[1] - p.z)) - (Math.abs(b[0] - p.x) + Math.abs(b[1] - p.z)))[0];
    console.log(`  ${pool.length} green_gloop locs down here; nearest to the ledge`, near);
    H.give(p, 'bucket_empty', 5);
    const m = A.mark();
    useOn(p, near[0], near[1], 'green_gloop', 'bucket_empty');
    H.tick(24);
    console.log('  ', A.mesSince(p, m).slice(0, 2));
    check('a bucket on the pool comes back full of slime', H.invCount(p, 'bucket_ectoplasm') > 0, true);
    check('  ...and the auto-fill empties the rest', H.invCount(p, 'bucket_empty'), 0);
    check('  ...five buckets in, five of slime out', H.invCount(p, 'bucket_ectoplasm'), 5);

    console.log('-- the bone grinder');
    p.teleport(3660, 3524, 1);
    H.tick(2);
    H.give(p, 'big_bones', 1);
    H.give(p, 'pot_empty', 2);
    const g = A.mark();
    useOn(p, 3660, 3525, 'ahoy_grinder_loader', 'big_bones');
    H.tick(6);
    check('a bone goes into the loader', H.invCount(p, 'big_bones'), 0);
    check('  ...and the grinder records which', H.getVarBit(p, 'ahoy_grinder_status'), 1);
    H.opLoc(p, 3659, 3525, 'ahoy_grinder_handle', 1);
    H.tick(10);
    check('winding the handle grinds them', H.getVarBit(p, 'ahoy_grinder_status'), 2);
    H.opLoc(p, 3658, 3525, 'ahoy_grinder_chute', 1);
    H.tick(6);
    check('the bin fills a pot with the matching bonemeal', H.invCount(p, 'pot_bonemeal_big'), 1);
    check('  ...spending one empty pot', H.invCount(p, 'pot_empty'), 1);
    check('  ...and leaving the grinder empty', H.getVarBit(p, 'ahoy_grinder_status'), 0);
    console.log('  ', A.mesSince(p, g).slice(0, 5));

    console.log('-- worshipping');
    p.teleport(3658, 3517, 0);
    H.tick(2);
    const before = xp(p, PlayerStat.PRAYER);
    const w = A.mark();
    H.opLoc(p, 3658, 3518, 'ahoy_ectofunctus', 1);
    const worship = A.drive(p);
    H.tick(6);
    console.log('  ', A.mesSince(p, w).slice(0, 2), worship.slice(0, 2));
    check('worship pays four times the bury value (big bones 15 -> 60)',
        xp(p, PlayerStat.PRAYER) - before, 600);
    check('  ...takes the bonemeal', H.invCount(p, 'pot_bonemeal_big'), 0);
    check('  ...takes a bucket of slime', H.invCount(p, 'bucket_ectoplasm'), 4);
    check('  ...hands back the empties',
        [H.invCount(p, 'pot_empty'), H.invCount(p, 'bucket_empty')], [2, 1]);
    check('  ...and banks 5 ecto-tokens', H.getVar(p, 'ecto_tokens_pending'), 5);

    console.log('-- the Ghost Disciple');
    H.give(p, 'amulet_of_ghostspeak');
    H.equip(p, { front: 'amulet_of_ghostspeak' });
    H.tick(2);
    const lines = talk(p, 'ahoy_disciple', [1], 1, false);
    H.tick(10);
    console.log('  ', lines.slice(0, 6));
    check('the disciple hands the tokens over', H.invCount(p, 'ectotoken'), 5);
    check('  ...and the till is empty', H.getVar(p, 'ecto_tokens_pending'), 0);

    console.log('-- the ectophial');
    p.teleport(3222, 3218, 0);
    H.tick(2);
    H.give(p, 'ectophial');
    H.opheld(p, 'ectophial', 1);
    H.tick(10);
    check('the ectophial teleports you to the Ectofuntus', [p.level, p.x, p.z], [0, 3658, 3517]);
    check('  ...and comes back empty',
        [H.invCount(p, 'ectophial'), H.invCount(p, 'ectophial_empty')], [0, 1]);
    useOn(p, 3658, 3518, 'ahoy_ectofunctus', 'ectophial_empty');
    H.tick(6);
    check('  ...and refills on the Ectofuntus itself', H.invCount(p, 'ectophial'), 1);
}

console.log('\n================ H.A.M. MEMBERS');
{
    const ham = (() => {
        for (const npc of World.npcs) {
            if (!npc || !npc.isActive) continue;
            if (npc.type === (A.NpcType as any).getId('favour_male_ham_civilian')) return npc;
        }
        return null;
    })();
    check('a H.A.M. member is spawned somewhere', ham !== null, true);
    if (ham) {
        console.log('  found one at', [ham.level, ham.x, ham.z]);
        const p: any = player('ham', ham.x + 1, ham.z, ham.level);
        p.setLevel(PlayerStat.THIEVING, 1);
        H.tick(2);
        const im = ifaceMark();
        H.opNpc(p, ham, 3);
        A.drive(p);
        const refused = shownSince(p, im).filter(s => s.includes('thieving'));
        console.log('  at level 1:', refused);
        check('level 1 is refused, and the message names 15',
            refused.some(s => s.includes('15')), true);
        p.setLevel(PlayerStat.THIEVING, 99);
        H.clearInv(p);
        H.tick(2);
        const before = xp(p, PlayerStat.THIEVING);
        const names = ['coins', 'digsitebuttons', 'digsitearmour1', 'digsitesword', 'bronze_arrow',
            'bronze_axe', 'bronze_dagger', 'bronze_pickaxe', 'iron_axe', 'iron_dagger',
            'iron_pickaxe', 'leather_armour', 'feather', 'logs', 'thread', 'cow_hide',
            'steel_arrow', 'steel_axe', 'steel_dagger', 'steel_pickaxe', 'knife', 'needle',
            'raw_anchovies', 'raw_chicken', 'tinderbox', 'uncut_opal', 'uncut_jade', 'coal',
            'iron_ore', 'ham_shirt', 'ham_robe', 'ham_gloves', 'ham_boots', 'ham_cloak',
            'ham_badge', 'ham_hood'];
        for (let i = 0; i < 80; i++) {
            H.opNpc(p, ham, 3);
            H.tick(4);
        }
        const kinds = names.filter(n => H.invCount(p, n) > 0);
        console.log(`  80 attempts at 99 Thieving produced ${kinds.length} kinds:`, kinds.join(', '));
        check('pickpocketing a H.A.M. member yields loot from the table', kinds.length > 0, true);
        check('  ...and Thieving experience', xp(p, PlayerStat.THIEVING) > before, true);
    }
}

console.log(`\n${R.ok} ok, ${R.bad} FAIL`);
process.exit(R.bad ? 1 : 0);
