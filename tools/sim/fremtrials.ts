// The Fremennik Trials, the breaks reported in playtesting, re-checked against the ORIGINAL quest
// ported from PlagueCityRS 349 (2026-09-25). Usage: npx tsx tools/sim/fremtrials.ts
// The quest start to finish, and the save migration, are tools/sim/port349_viking.ts.
//
//   swensen    the house door opens, the maze ladder is reachable through it, every maze room is
//              sealed from the others, the seven portals, the exit and Swensen's vote - the
//              seventh, without which Brundt will not finish the quest
//   peer       Study only looks; the two red disks USED on the mural give the lid
//   thorvald   the ladder refuses weapons/armour carried as well as worn, and runes; food and
//              jewellery may go; each Koschei form attacks faster; a death down there is safe
//   olaf       knife and branch both ways round, the skill levels, Askeladden's rock, Lalli's stew
//              and the golden fleece, the wool on the lyre
//   manni      the pipe's Put-inside with the lit strange object, the use-item route, the keg off
//              the table
import * as H from './harness.js';
import World from '#/engine/World.js';
import InvType from '#/cache/config/InvType.js';
import ObjType from '#/cache/config/ObjType.js';
import LocType from '#/cache/config/LocType.js';
import Player from '#/engine/entity/Player.js';
import { findPath } from '#/engine/GameMap.js';
import { CoordGrid } from '#/engine/CoordGrid.js';
import {
    check, bits, bit, stage, setStage, viking, at, player, drain, text, mesSince, has, talk, clickLoc, useOnLoc, useHeld, opObj, npcsOf, until, done, BIT
} from './vikinglib.js';

await H.boot();
H.loginOrder();

const M41_57 = (x: number, z: number): [number, number] => [2624 + x, 3648 + z];
const M41_156 = (x: number, z: number): [number, number] => [2624 + x, 9984 + z];
const M43_56 = (x: number, z: number): [number, number] => [2752 + x, 3584 + z];
const locAt = (x: number, z: number, level: number, name: string) => World.getLoc(x, z, level, LocType.getId(name)) !== null;
const said = (p: Player, s: string) => H.mesgs.some(m => m.who === p.username && m.text.includes(s));

// =====================================================================================
console.log('SWENSEN  the house door, the maze, and the seventh vote');
{
    const [dx, dz] = M41_57(21, 15);
    const [lx, lz] = M41_57(20, 9);
    const p = player('frem_swensen', dx, dz + 2, 1);
    setStage(p, 'swensen', 1);
    check('the door is there, shut', locAt(dx, dz, 0, 'viking_abode_door'), true);
    H.opLoc(p, lx, lz, 'vt_mazeladdertopentrance', 1);
    drain(p);
    check('with the door shut, the ladder inside cannot be reached', p.z > 9000, false);
    H.clearLogs();
    clickLoc(p, dx, dz, 'viking_abode_door', 1);
    check('Open does something (no "Nothing interesting happens")', said(p, 'Nothing interesting'), false);
    check('  the closed door is gone from its tile', locAt(dx, dz, 0, 'viking_abode_door'), false);
    clickLoc(p, lx, lz, 'vt_mazeladdertopentrance', 1);
    check('through the open door, down the ladder into the maze', at(p), [...M41_156(7, 20), 0]);

    // every room is sealed from every other on foot: only the portals join them
    const landings: Record<string, [number, number]> = {
        enter: [7, 20], room2: [18, 33], room3: [27, 20], room4: [43, 31], room5: [6, 44], room6: [29, 51], room7: [44, 42], end: [41, 54]
    };
    const reach = (a: [number, number], b: [number, number]) => {
        const [ax, az] = M41_156(a[0], a[1]);
        const [bx, bz] = M41_156(b[0], b[1]);
        return Array.from(findPath(0, ax, az, bx, bz)).some(c => {
            const u = CoordGrid.unpackCoord(c);
            return u.x === bx && u.z === bz;
        });
    };
    const leaks: string[] = [];
    for (const [na, a] of Object.entries(landings)) for (const [nb, b] of Object.entries(landings)) if (na !== nb && reach(a, b)) leaks.push(`${na}->${nb}`);
    check('every maze room is sealed off from the others on foot', leaks, []);
    check('  (and the path check does find a walk inside one room)', [reach(landings.enter, [8, 21]), reach(landings.room4, [41, 30])], [true, true]);

    const portals: [number, number][] = [[7, 18], [15, 31], [32, 20], [41, 34], [6, 39], [32, 53], [42, 45]];
    const route: string[] = [];
    portals.forEach(([px, pz], i) => {
        clickLoc(p, ...M41_156(px, pz), `vt_mazeportal_${i + 1}`, 1);
        H.tick(2);
        const want = M41_156(...Object.values(landings)[i + 1]);
        route.push(`${i + 1}:${p.x === want[0] && p.z === want[1] ? 'ok' : 'at ' + at(p).join(',')}`);
    });
    check('each correct portal (S-W-E-N-S-E-N) leads into the next room', route, ['1:ok', '2:ok', '3:ok', '4:ok', '5:ok', '6:ok', '7:ok']);
    clickLoc(p, ...M41_156(41, 53), 'vt_mazeladderexit', 1);
    check('the exit ladder: back in the house, and his vote', [p.level, p.z < 9000, stage(p, 'swensen'), viking(p)], [0, true, 2, 2]);

    // Brundt: six votes are not enough without Swensen's
    const b = player('frem_six', ...M41_57(34, 21), 7);
    for (const [t, v] of [['reveller', 2], ['sigli', 3], ['olaf', 7], ['sigmund', 15], ['thorvald', 2], ['peer', 3]] as [string, number][]) setStage(b, t, v);
    let t = talk(b, 'viking_brundt');
    check("six votes (all but Swensen's): Brundt says keep going", [viking(b), has(t, 'I only have 6 votes so far.')], [7, true]);
    setStage(b, 'swensen', 2);
    H.setVar(b, 'viking', 8);
    t = talk(b, 'viking_brundt');
    H.tick(3);
    check('  all seven: The Fremennik Trials complete', viking(b), 10);
    H.despawn(p, b);
}

// =====================================================================================
console.log('PEER  the mural');
{
    const p = player('frem_mural', ...M41_57(11, 15), 1);
    setStage(p, 'peer', 2);
    let t = clickLoc(p, ...M41_57(10, 15), 'viking_seers_mural', 1);
    check('Study only looks: no lid', [has(t, '') || true, H.invCount(p, 'viking_vase_lid'), mesSince(p, 0).some(m => m.includes('missing something'))], [true, 0, true]);
    H.give(p, 'viking_red_wooden_coin', 1);
    useOnLoc(p, ...M41_57(10, 15), 'viking_seers_mural', 'viking_red_wooden_coin');
    check('one red disk in: no lid yet', [bit(p, BIT.reddisk1), H.invCount(p, 'viking_vase_lid')], [1, 0]);
    H.give(p, 'viking_red_wooden_coin', 1);
    useOnLoc(p, ...M41_57(10, 15), 'viking_seers_mural', 'viking_red_wooden_coin');
    check('the second: the lid falls out', [bit(p, BIT.reddisk2), H.invCount(p, 'viking_vase_lid')], [1, 1]);
    H.clearInv(p);
    clickLoc(p, ...M41_57(10, 15), 'viking_seers_mural', 1);
    check('a lost lid can be taken out of the mural again', H.invCount(p, 'viking_vase_lid'), 1);
    H.give(p, 'viking_uncoloured_wooden_coin');
    useOnLoc(p, ...M41_57(10, 15), 'viking_seers_mural', 'viking_uncoloured_wooden_coin');
    check('an uncoloured disk does nothing', said(p, 'Nothing interesting happens'), true);
    void t;
    H.despawn(p);
}

// =====================================================================================
console.log('THORVALD  the ladder, Koschei\'s speed, a safe death');
{
    const [lx, lz] = M41_57(43, 46);
    const down = (p: Player) => {
        p.teleport(lx, lz - 1, 0);
        H.tick(1);
        H.opLoc(p, lx, lz, 'viking_warrior_ladder', 2);
        drain(p);
        return p.level === 2;
    };
    const p = player('frem_thorvald', lx, lz - 1, 1);
    setStage(p, 'thorvald', 1);
    H.give(p, 'bronze_sword');
    check('a sword carried in the pack: refused', down(p), false);
    H.clearInv(p);
    H.give(p, 'bronze_platebody');
    check('a platebody carried in the pack: refused', down(p), false);
    H.clearInv(p);
    H.equip(p, { rhand: 'bronze_sword' });
    check('a sword worn: refused', down(p), false);
    p.invDelSlot(InvType.WORN, 3);
    H.give(p, 'airrune', 10);
    check('runes: refused', down(p), false);
    H.clearInv(p);
    H.give(p, 'lobster', 5);
    H.give(p, 'ring_of_recoil');
    H.equip(p, { front: 'amulet_of_strength', ring: 'ring_of_recoil' });
    check('food, an amulet and a ring (worn and carried): allowed down', down(p), true);

    // attack speed of each form, measured off the hits it lands
    const gaps: number[] = [];
    for (const form of ['viking_enemy1', 'viking_enemy2', 'viking_enemy3', 'viking_enemy4']) {
        const t = player('frem_k_' + form.slice(-1), 2624 + 30, 10048 + 30, 1, 2);
        const npc = H.addNpcAt(form, t.x + 1, t.z, 2);
        H.tick(1);
        H.setNpcVar(npc, 'npc_aggressive_player', t.uid);
        H.setNpcMode(npc, 'OPPLAYER2', t);
        H.clearLogs();
        for (let i = 0; i < 40; i++) {
            t.levels[3] = 99;
            H.tick(1);
        }
        const ts = H.hitsFor(t.username).map(h => h.tick);
        const d = ts.slice(1).map((v, i) => v - ts[i]);
        gaps.push(d.length ? Math.min(...d) : -1);
        npc.isActive && World.removeNpc(npc, -1);
        H.despawn(t);
    }
    check('Koschei attacks faster each form (ticks between hits, forms 1-4)', gaps, [5, 4, 3, 1]);

    // a death to form one: safe, and back to the hut
    until(() => npcsOf('viking_enemy1').some(n => Math.abs(n.x - p.x) < 5), 100);
    p.levels[3] = 0;
    H.runProc(p, '[proc,player_die]');
    until(() => p.level === 0, 30);
    H.tick(5);
    check('dying down there: Thorvald\'s hut, food and jewellery kept', [at(p), H.invCount(p, 'lobster'), p.getInventory(InvType.WORN)!.get(12)?.id === ObjType.getId('ring_of_recoil')], [[...M41_57(42, 46), 0], 5, true]);
    check('  and that Koschei goes too', npcsOf('viking_enemy1').filter(n => Math.abs(n.x - 2671) < 30 && n.level === 2).length, 0);
    H.despawn(p);
}

// =====================================================================================
console.log('OLAF  the branch, Lalli\'s stew, the wool');
{
    const p = player('frem_olaf', 2660, 3670, 1);
    setStage(p, 'olaf', 1);
    H.give(p, 'knife');
    H.give(p, 'viking_musical_tree_branch', 2);
    H.clearLogs();
    useHeld(p, 'knife', 'viking_musical_tree_branch');
    check('knife used on the branch: an unstrung lyre', [H.invCount(p, 'viking_unstrung_lyre'), H.invCount(p, 'viking_musical_tree_branch')], [1, 1]);
    useHeld(p, 'viking_musical_tree_branch', 'knife');
    check('branch used on the knife: another', [H.invCount(p, 'viking_unstrung_lyre'), H.invCount(p, 'viking_musical_tree_branch')], [2, 0]);
    check('  never "Nothing interesting happens"', said(p, 'Nothing interesting'), false);
    const low = player('frem_olaf_low', 2662, 3670, 1);
    low.setLevel(12, 39);
    H.give(low, 'knife');
    H.give(low, 'viking_musical_tree_branch');
    const t0 = useHeld(low, 'knife', 'viking_musical_tree_branch');
    check('39 Crafting cannot carve it (Crafting 40)', [H.invCount(low, 'viking_unstrung_lyre'), has(t0, 'Crafting level of 40')], [0, true]);
    H.despawn(low);
    H.clearInv(p);

    let t = talk(p, 'viking_lalli_troll', [1]);
    check('Lalli: will not give wool; "Other human?" - Askeladden', [stage(p, 'olaf'), has(t, 'Askeladden')], [2, true]);
    t = talk(p, 'viking_askelapen');
    check('Askeladden hands over the pet rock', [H.invCount(p, 'vt_useless_rock'), stage(p, 'olaf')], [1, 3]);
    t = talk(p, 'viking_lalli_troll');
    check('  Lalli with the rock: not another rock - but soup', [H.invCount(p, 'viking_golden_fleece'), stage(p, 'olaf')], [0, 4]);
    const [sx, sz] = M43_56(20, 39);
    for (const o of ['potato', 'cabbage', 'onion']) H.give(p, o);
    for (const item of ['vt_useless_rock', 'potato', 'cabbage']) useOnLoc(p, sx, sz, 'viking_troll_cauldron', item);
    check('three of four in the stew', [bit(p, BIT.rock), bit(p, BIT.potato), bit(p, BIT.cabbage), bit(p, BIT.onion), stage(p, 'olaf')], [1, 1, 1, 0, 4]);
    talk(p, 'viking_lalli_troll');
    check('Lalli with the onion missing: no fleece', H.invCount(p, 'viking_golden_fleece'), 0);
    useOnLoc(p, sx, sz, 'viking_troll_cauldron', 'onion');
    check('the onion in: the stew is made, ingredients spent', [bit(p, BIT.onion), stage(p, 'olaf'), H.invCount(p, 'onion') + H.invCount(p, 'potato') + H.invCount(p, 'vt_useless_rock')], [1, 5, 0]);
    talk(p, 'viking_lalli_troll');
    check('Lalli tastes it and gives the golden fleece', H.invCount(p, 'viking_golden_fleece'), 1);
    talk(p, 'viking_lalli_troll');
    check('  not a second while you still hold the first', H.invCount(p, 'viking_golden_fleece'), 1);
    t = talk(p, 'viking_askelapen');
    check('a lost rock: Askeladden has hundreds', H.invCount(p, 'vt_useless_rock'), 1);

    H.clearInv(p);
    H.give(p, 'viking_golden_wool');
    H.give(p, 'viking_unstrung_lyre');
    p.setLevel(9, 24);
    useHeld(p, 'viking_golden_wool', 'viking_unstrung_lyre');
    check('Fletching 24: cannot string it', H.invCount(p, 'viking_strung_lyre'), 0);
    p.setLevel(9, 25);
    useHeld(p, 'viking_unstrung_lyre', 'viking_golden_wool');
    check('Fletching 25, either way round: a lyre', H.invCount(p, 'viking_strung_lyre'), 1);
    H.despawn(p);
}

// =====================================================================================
console.log('MANNI  the pipe and the keg');
{
    const [px, pz] = M41_57(39, 26);
    const p = player('frem_manni', px - 1, pz, 1);
    setStage(p, 'reveller', 1);
    let t = clickLoc(p, px, pz, 'viking_pipe_end_longhall', 1);
    check('Put-inside with nothing to put in: says so', has(t, 'smelly old drain pipe'), true);
    H.give(p, 'viking_firecracker');
    t = clickLoc(p, px, pz, 'viking_pipe_end_longhall', 1);
    check('Put-inside with it unlit: not accepted', [bit(p, BIT.firecracker), H.invCount(p, 'viking_firecracker')], [0, 1]);
    H.give(p, 'tinderbox');
    useHeld(p, 'viking_firecracker', 'tinderbox');
    check('strange object on the tinderbox (the other way round): lit', H.invCount(p, 'viking_firecracker_lit'), 1);
    t = clickLoc(p, px, pz, 'viking_pipe_end_longhall', 1);
    check('Put-inside with the lit strange object: it goes in the pipe', [bit(p, BIT.firecracker), H.invCount(p, 'viking_firecracker_lit'), said(p, 'Nothing interesting')], [1, 0, false]);
    const q = player('frem_manni2', px - 1, pz, 1);
    setStage(q, 'reveller', 1);
    H.give(q, 'viking_firecracker_lit');
    useOnLoc(q, px, pz, 'viking_pipe_end_longhall', 'viking_firecracker_lit');
    check('the use-item route works too', [bit(q, BIT.firecracker), H.invCount(q, 'viking_firecracker_lit')], [1, 0]);
    H.despawn(q);

    p.teleport(...M41_57(36, 27), 0);
    H.tick(1);
    opObj(p, ...M41_57(36, 28), 'viking_beerkeg', 3);
    check('Take the keg of beer off the table', H.invCount(p, 'viking_beerkeg'), 1);
    opObj(p, ...M41_57(36, 28), 'viking_beerkeg', 3);
    check('  only one at a time', [H.invCount(p, 'viking_beerkeg'), said(p, 'You already have a keg of beer.')], [1, true]);
    H.give(p, 'viking_low_alcahol_beerkeg');
    useHeld(p, 'viking_beerkeg', 'viking_low_alcahol_beerkeg');
    t = talk(p, 'viking_reveller_3', [1]);
    check('the contest with the kegs swapped under cover of the bang: Manni\'s vote', [stage(p, 'reveller'), viking(p), H.invCount(p, 'viking_beerkeg'), H.invCount(p, 'viking_low_alcahol_beerkeg')], [2, 2, 0, 0]);
    void bits; void text;
    H.despawn(p);
}

done();
