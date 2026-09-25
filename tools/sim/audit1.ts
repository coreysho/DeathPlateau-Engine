// Quest audit, batch 1: every quest the audit FIXED is driven here through its real triggers on the
// real map, and where it was practical the whole quest runs start to finish.
// Usage: npx tsx tools/sim/audit1.ts [section ...]      (no args = every section)
import { R, check, player, at, lastMes, mark, mesSince, said, drive, saw, talk, useOn, useOnNpc, useHeld, op, held, connected, reachLoc, walkable, enqueue, H, World, findNpc, LocType, fight, take, NpcType, runProcProtected, locsNamed, addLoc } from './a1lib.js';
import Player from '#/engine/entity/Player.js';
import InvType from '#/cache/config/InvType.js';
import ObjType from '#/cache/config/ObjType.js';
import CategoryType from '#/cache/config/CategoryType.js';

await H.boot();
H.loginOrder();

const want = process.argv.slice(2);
const run = (name: string) => want.length === 0 || want.includes(name);

/** The quest list row's journal, as text. */
function journal(p: Player, com: string): string {
    const from = H.ifaces.length;
    H.ifButton(p, com);
    drive(p);
    return H.ifaces.slice(from).filter(i => i.who === p.username && i.kind === 'text').map(i => i.text).join(' ');
}
/** Every stage of a quest has journal text (the row click neither crashes nor leaves the page blank). */
function journalStages(p: Player, varp: string, com: string, stages: number[]) {
    const blank: number[] = [];
    for (const s of stages) {
        H.setVar(p, varp, s);
        const t = journal(p, com);
        if (t.replace(/@\w\w\w@|\|/g, '').trim().length < 20) blank.push(s);
    }
    check(`${com}: every stage has journal text`, blank, []);
}
/** A varp or a varbit, whichever the name is. */
const V = (p: Player, name: string): number => { try { return H.getVar(p, name); } catch { return H.getVarBit(p, name); } };
function journalStagesBit(p: Player, varbit: string, com: string, stages: number[]) {
    const blank: number[] = [];
    for (const s of stages) {
        H.setVarBit(p, varbit, s);
        const t = journal(p, com);
        if (t.replace(/@\w\w\w@|\|/g, '').trim().length < 20) blank.push(s);
    }
    check(`${com}: every stage has journal text`, blank, []);
}
const qp = (p: Player) => H.runProc(p, '[proc,count_questpoints]')[0];

// ============================================================================ Creature of Fenkenstrain
if (run('fenk')) {
    console.log('CREATURE OF FENKENSTRAIN');
    const p = player('fenk1', 3548, 3531);
    // the castle's own doors
    check('castle shut before any door is opened', connected(0, 3548, 3531, 3552, 3549), false);
    op(p, 3548, 3535, 'fenk_door', 1);
    op(p, 3548, 3543, 'fenk_door', 1);
    check('south doors open and the hall is reachable on foot', connected(0, 3548, 3531, 3552, 3549), true);
    op(p, 3548, 3551, 'fenk_door', 1);
    op(p, 3549, 3558, 'fenk_door', 1);
    check('on through the north doors to the courtyard (cupboard, canes, shed, ghost)', connected(0, 3548, 3531, 3551, 3563), true);

    const start = qp(p);
    talk(p, 'fenk_fenkenstrain', [1, 1]);
    check('Fenkenstrain hires you: stage 1 and the cavern key', [H.getVar(p, 'fenk_quest'), H.invCount(p, 'fenk_mausoleum_key')], [1, 1]);

    H.give(p, 'spade');
    p.teleport(3572, 3525, 0);
    H.tick(2);
    for (let i = 0; i < 3; i++) op(p, 3572, 3527, 'fenk_grave', 2);
    check('three digs: arms, legs, torso', ['fenk_arms', 'fenk_legs', 'fenk_torso'].map(o => H.invCount(p, o)), [1, 1, 1]);

    H.equip(p, { front: 'amulet_of_ghostspeak' });
    talk(p, 'fenk_gardener_multi_2');
    check('gardener ghost gives the obsidian amulet and the shed key', [H.invCount(p, 'fenk_obsidian_amulet'), H.invCount(p, 'fenk_shed_key')], [1, 1]);

    p.teleport(3549, 3565, 0);
    H.tick(2);
    op(p, 3546, 3563, 'fenk_broomcupboard', 1);
    check('the cupboard is inside the shed (not reachable from the courtyard)', lastMes(p), "I can't reach that!");
    for (const o of ['fenk_shed_key', 'fenk_obsidian_amulet', 'fenk_arms', 'fenk_legs', 'fenk_torso', 'spade']) H.give(p, o);
    H.fillInv(p);
    op(p, 3548, 3565, 'fenk_shed_door', 1);
    check('unlocked with a full pack: in, but no amulet yet', [H.getVarBit(p, 'fenk_unlocked_shed'), H.invCount(p, 'fenk_marble_amulet'), p.x], [1, 0, 3547]);
    H.clearInv(p);
    for (const o of ['fenk_obsidian_amulet', 'fenk_arms', 'fenk_legs', 'fenk_torso', 'spade']) H.give(p, o);
    op(p, 3548, 3565, 'fenk_shed_door', 1);
    check('out again, and the amulet is picked up on the way', [H.invCount(p, 'fenk_marble_amulet'), p.x], [1, 3548]);
    op(p, 3548, 3565, 'fenk_shed_door', 1);
    check('back into the shed', p.x, 3547);
    op(p, 3546, 3563, 'fenk_broomcupboard', 1);
    op(p, 3546, 3563, 'fenk_broomcupboard_open', 2);
    check('Search the open cupboard: the garden brush', H.invCount(p, 'fenk_brush0'), 1);
    op(p, 3546, 3563, 'fenk_broomcupboard_open', 3);
    check('Shut closes it', World.getLoc(3546, 3563, 0, LocType.getId('fenk_broomcupboard')) !== null, true);
    op(p, 3548, 3565, 'fenk_shed_door', 1);
    for (let i = 0; i < 3; i++) op(p, 3551, 3564, 'fenk_canepile', 1);
    for (let i = 0; i < 3; i++) useHeld(p, 'fenk_cane', H.invCount(p, 'fenk_brush0') ? 'fenk_brush0' : H.invCount(p, 'fenk_brush1') ? 'fenk_brush1' : 'fenk_brush2');
    check('brush plus three canes', H.invCount(p, 'fenk_brush3'), 1);
    useHeld(p, 'fenk_marble_amulet', 'fenk_obsidian_amulet');
    check('the halves make the star', H.invCount(p, 'fenk_star_amulet'), 1);

    p.teleport(3574, 3524, 0);
    H.tick(2);
    op(p, 3574, 3526, 'fenk_coffin', 1);
    op(p, 3574, 3526, 'fenk_coffin', 2);
    check('memorial pushed and searched: the head', H.invCount(p, 'fenk_head_empty'), 1);

    talk(p, 'fenk_fenkenstrain');
    check('all four parts: stage 2 and a brain', [H.getVar(p, 'fenk_quest'), H.invCount(p, 'fenk_brain')], [2, 1]);
    // lose the brain and ask again
    H.clearInv(p);
    for (const o of ['fenk_arms', 'fenk_legs', 'fenk_torso', 'fenk_head_empty']) H.give(p, o);
    talk(p, 'fenk_fenkenstrain');
    check('a lost brain is replaced at stage 2', H.invCount(p, 'fenk_brain'), 1);
    useHeld(p, 'fenk_brain', 'fenk_head_empty');
    H.give(p, 'needle');
    H.give(p, 'thread', 5);
    useHeld(p, 'needle', 'fenk_torso');
    check('sewn on the slab: stage 3', H.getVar(p, 'fenk_quest'), 3);

    talk(p, 'fenk_fenkenstrain');
    check('the mould', H.invCount(p, 'fenk_lightning_mould'), 1);
    H.give(p, 'silver_bar');
    useHeld(p, 'silver_bar', 'fenk_lightning_mould');
    check('a conductor cast', H.invCount(p, 'fenk_conductor'), 1);

    // up to the roof on foot: west stairs, the upstairs door, the south tower ladder
    p.teleport(3538, 3549, 0);
    H.tick(2);
    op(p, 3537, 3551, 'fenk_stairs_lv1', 1);
    check('west stairs up', p.level, 1);
    op(p, 3548, 3543, 'fenk_door_mirror', 1);
    op(p, 3548, 3539, 'ladder', 1);
    check('through the upstairs door and up the south tower ladder', p.level, 2);
    op(p, 3548, 3536, 'fenk_conductor_broken', 1);
    check('conductor fitted: stage 4', H.getVar(p, 'fenk_quest'), 4);

    talk(p, 'fenk_fenkenstrain');
    check('the storm: stage 5', H.getVar(p, 'fenk_quest'), 5);

    // the creature is on the tower top, behind the bolted door
    p.teleport(3538, 3549, 1);
    H.tick(2);
    op(p, 3548, 3551, 'fenk_tower_door', 1);
    check('tower door bolted before the clock', p.z < 3552, true);
    // the clock room is its own: up the ladder in the ground floor's west wing
    p.teleport(3541, 3547, 0);
    H.tick(2);
    op(p, 3539, 3543, 'ladder', 1);
    check('the west-wing ladder up to the clock room', p.level, 1);
    op(p, 3540, 3545, 'fenk_clock', 1);
    check('clock can be wound once the creature is alive', H.getVarBit(p, 'fenk_wound_clock'), 1);
    op(p, 3539, 3543, 'laddertop', 1);
    p.teleport(3538, 3549, 0);
    H.tick(2);
    op(p, 3537, 3551, 'fenk_stairs_lv1', 1);
    op(p, 3548, 3551, 'fenk_tower_door', 1);
    check('through the tower door', [p.z >= 3552, p.level], [true, 1]);
    op(p, 3548, 3554, 'ladder', 1);
    check('up the tower ladder', p.level, 2);
    talk(p, 'fenk_creature', [], 1, false);
    check('the creature speaks: stage 6', H.getVar(p, 'fenk_quest'), 6);

    p.teleport(3541, 3553, 0);
    H.tick(2);
    op(p, 3541, 3551, 'fenk_bookcase', 1);
    check('the journal: stage 7', [H.getVar(p, 'fenk_quest'), H.invCount(p, 'fenk_journal')], [7, 1]);
    talk(p, 'fenk_fenkenstrain');
    H.tick(3);
    check('accused: complete, 2 quest points', [H.getVar(p, 'fenk_quest'), qp(p) - start], [8, 2]);
    journalStages(p, 'fenk_quest', 'questlist:creatureoffenkenstrain', [0, 1, 2, 3, 4, 5, 6, 7, 8]);
}

// ============================================================================ Rag and Bone Man
if (run('rag')) {
    console.log('RAG AND BONE MAN');
    const p = player('rag1', 3362, 3505);
    const start = qp(p);
    talk(p, 'rag_odd_old_man', [1, 1]);
    check('the Odd Old Man starts it', H.getVar(p, 'rag_quest'), 1);
    const bones = ['goblin', 'bear', 'ram', 'unicorn', 'giant_rat'];
    for (const b of bones) {
        H.give(p, 'rag_vinegar');
        H.give(p, 'pot_empty');
        useHeld(p, 'rag_vinegar', 'pot_empty');
        H.give(p, `rag_${b}_bone`);
        useHeld(p, `rag_${b}_bone`, 'rag_pot_vinegar');
    }
    check('five bones steeping in vinegar', bones.map(b => H.invCount(p, `rag_pot_${b}_bone`)), [1, 1, 1, 1, 1]);
    p.teleport(3230, 3197, 0);
    H.tick(2);
    for (const b of bones) useOn(p, 3230, 3196, 'range', `rag_pot_${b}_bone`);
    check('boiled clean on a range', bones.map(b => H.invCount(p, `rag_polished_${b}_bone`)), [1, 1, 1, 1, 1]);
    p.invDel(InvType.INV, ObjType.getId('rag_polished_ram_bone'), 1);
    const lines = talk(p, 'rag_odd_old_man');
    check('four of five: he says what is still wanted', [saw(lines, 'Still wanting'), saw(lines, "ram's skull"), H.getVar(p, 'rag_quest')], [true, true, 1]);
    H.give(p, 'rag_polished_ram_bone');
    talk(p, 'rag_odd_old_man');
    H.tick(3);
    check('handed in: complete, 1 quest point', [H.getVar(p, 'rag_quest'), qp(p) - start], [2, 1]);
    journalStages(p, 'rag_quest', 'questlist:rag', [0, 1, 2]);
}

// ============================================================================ Mourning's End Part I
if (run('mourning')) {
    console.log("MOURNING'S END PART I");
    const p = player('mourn1', 2292, 3147);
    H.setVar(p, 'roving_elves_quest', 10);
    H.setVar(p, 'biohazard', 16); // Roving Elves -> Regicide -> Underground Pass -> Biohazard
    const start = qp(p);
    talk(p, 'roving_islwyn');
    check('Islwyn starts it', H.getVar(p, 'mourning_quest'), 1);
    talk(p, 'roving_female_woodelf');
    H.tick(6);
    check('Eluned takes you to Lletya', [Math.abs(p.x - 2353) < 3, Math.abs(p.z - 3170) < 3, walkable(0, p.x, p.z)], [true, true, true]);
    talk(p, 'mourning_arianwyn');
    check('Arianwyn: stage 2 and a teleport crystal', [H.getVar(p, 'mourning_quest'), H.invCount(p, 'mourning_teleport_crystal_4')], [2, 1]);

    // the uniform: a kill on the pass, then the soap, the bucket and Oronwen
    const m = findNpc('mourning_overpass_mourner1', p);
    check('the overpass mourners can be fought', m.levels[3] > 1, true);
    for (const o of ['mourning_bloody_mourner_top', 'mourning_ripped_mourner_legs', 'mourning_mourner_cloak', 'mourning_mourner_gloves', 'mourning_mourner_boots', 'gasmask', 'bucket_water']) H.give(p, o);
    p.teleport(2912, 3416, 0);
    H.tick(2);
    op(p, 2912, 3418, 'eadgar_laundry_basket', 1);
    check('soap from the Taverley laundry basket', H.invCount(p, 'mourning_soap'), 1);
    useHeld(p, 'mourning_soap', 'mourning_bloody_mourner_top');
    check('the top washed', H.invCount(p, 'mourning_mourner_top'), 1);
    talk(p, 'mourning_seamstress');
    check('Oronwen mends the trousers: stage 3', [H.invCount(p, 'mourning_mourner_legs'), H.getVar(p, 'mourning_quest')], [1, 3]);

    // into the headquarters in the uniform
    H.clearInv(p);
    H.equip(p, { torso: 'mourning_mourner_top', legs: 'mourning_mourner_legs', back: 'mourning_mourner_cloak', hands: 'mourning_mourner_gloves', feet: 'mourning_mourner_boots', hat: 'gasmask' });
    p.teleport(2551, 3318, 0);
    H.tick(2);
    op(p, 2551, 3320, 'mournerstewdoor', 1);
    check('the HQ front door lets the uniform in: stage 4', [H.getVar(p, 'mourning_quest'), p.z > 3320], [4, true]);
    op(p, 2546, 3325, 'loc_1530', 1);
    check('the yard trapdoor is reachable on foot through the back door', reachLoc(0, p.x, p.z, 'mourning_hideout_trap_door', 2542, 3327), true);
    op(p, 2542, 3327, 'mourning_hideout_trap_door', 1);
    check('down the trapdoor into the hideout', [Math.abs(p.x - 2044) < 2, Math.abs(p.z - 4649) < 2], [true, true]);
    check('the office is shut off by its door', reachLoc(0, p.x, p.z, 'mourning_gnome_rack', 2035, 4629), false);
    op(p, 2037, 4633, 'mourner_hideout_door3', 1);
    check('through the door to the rack room', p.z <= 4633, true);
    op(p, 2035, 4629, 'mourning_gnome_rack', 1);
    check('the gnome on the rack: stage 5', H.getVar(p, 'mourning_quest'), 5);

    talk(p, 'elena2');
    check('Elena gives the sieve: stage 6', [H.getVar(p, 'mourning_quest'), H.invCount(p, 'mourning_sieve')], [6, 1]);
    p.teleport(2474, 3362, 0);
    H.tick(2);
    check('the orchard is fenced off', connected(0, 2474, 3362, 2486, 3375, 60), false);
    op(p, 2474, 3364, 'mourning_orchard_fencegate_l', 1);
    check('the orchard gate opens onto the apples and the press', connected(0, 2474, 3362, 2486, 3375, 60), true);
    op(p, 2487, 3374, 'mourning_orchard_applepile', 1);
    check('a barrel of rotten apples', H.invCount(p, 'applebarrel_full'), 1);
    useOn(p, 2484, 3374, 'mourning_orchard_applebarrel_empty', 'applebarrel_full');
    H.give(p, 'regicide_barrel_naphtha');
    useHeld(p, 'regicide_barrel_naphtha', 'mourning_applebarrel_mush');
    useOn(p, 2484, 3374, 'mourning_orchard_applebarrel_empty', 'mourning_applebarrel_naphtha_mush');
    useHeld(p, 'mourning_sieve', 'mourning_toxic_naphtha');
    check('pressed, mixed, pressed and strained: three doses, stage 7', [H.invCount(p, 'mourning_apple_toxin'), H.getVar(p, 'mourning_quest')], [3, 7]);

    p.teleport(2551, 3322, 0);
    H.tick(2);
    useOn(p, 2550, 3321, 'cookingshelves', 'mourning_apple_toxin');
    // upstairs from the yard, through the quarters door and the storeroom gate to the ration crate
    p.teleport(2543, 3325, 0);
    H.tick(2);
    op(p, 2542, 3324, 'loc_1738', 1);
    check('the yard stairs up to the quarters', p.level, 1);
    op(p, 2547, 3325, 'mournerstewdoorup', 1);
    check('the uniform passes the quarters door', p.x >= 2547, true);
    op(p, 2551, 3326, 'mournerquaters_gatel', 1);
    check('and the storeroom gate', p.x >= 2552, true);
    useOn(p, 2554, 3327, 'mournercrateup', 'mourning_apple_toxin');
    p.teleport(2543, 3330, 0);
    H.tick(2);
    useOn(p, 2543, 3332, 'loc_2043', 'mourning_apple_toxin');
    check('the shelves, the ration crate and the stew: stage 8', [H.getVar(p, 'mourning_quest'), H.invCount(p, 'mourning_apple_toxin')], [8, 0]);

    p.teleport(2044, 4649, 0);
    H.tick(2);
    op(p, 2042, 4633, 'mourner_hideout_door2', 1);
    op(p, 2043, 4629, 'loc_8799', 1);
    check("the head mourner's desk: key and letter, stage 9", [H.invCount(p, 'mourning_head_mourner_key'), H.getVar(p, 'mourning_quest')], [1, 9]);
    op(p, 2039, 4633, 'mourning_office_chest_closed', 1);
    op(p, 2039, 4633, 'mourning_office_chest_open', 1);
    check('the office chest: device, rack key, excavation key', ['mourning_paint_gun_broken', 'mourning_gnome_key', 'mourning_excavation_key'].map(o => H.invCount(p, o)), [1, 1, 1]);
    op(p, 2042, 4633, 'mourner_hideout_door2', 1);
    p.teleport(2037, 4634, 0);
    H.tick(2);
    op(p, 2037, 4633, 'mourner_hideout_door3', 1);
    op(p, 2035, 4629, 'mourning_gnome_rack', 2);
    check('the rack released: stage 10', H.getVar(p, 'mourning_quest'), 10);
    talk(p, 'mourner_hideout_gnome', [], 1, false);
    useOnNpc(p, 'mourner_hideout_gnome', 'mourning_paint_gun_broken');
    check('the gnome mends the device: stage 11', [H.invCount(p, 'mourning_paint_gun'), H.getVar(p, 'mourning_quest')], [1, 11]);
    op(p, 2037, 4633, 'mourner_hideout_door3', 1);
    check('back out of the rack room', p.z >= 4634, true);
    op(p, 2044, 4650, 'mourner_hideout_ladder1', 1);
    check('the hideout ladder back up lands on a walkable tile in the yard', [p.level, walkable(0, p.x, p.z), Math.abs(p.x - 2542) < 3], [0, true, true]);

    // four flocks, four colours
    const flocks: [string, string, number, number][] = [['plaguesheep_1', 'red', 2609, 3344], ['plaguesheep_2', 'green', 2621, 3367], ['plaguesheep_3', 'blue', 2560, 3389], ['plaguesheep_4', 'yellow', 2610, 3391]];
    for (const [sheep, colour, x, z] of flocks) {
        H.give(p, 'empty_ogre_bellows');
        H.give(p, `${colour}dye`);
        H.give(p, 'bloated_toad');
        useHeld(p, `${colour}dye`, 'empty_ogre_bellows');
        useHeld(p, `mourning_ogre_bellows_${colour}`, 'bloated_toad');
        useHeld(p, `mourning_bloated_toad_${colour}`, 'mourning_paint_gun');
        p.teleport(x + 2, z, 0);
        H.tick(2);
        useOnNpc(p, sheep, 'mourning_paint_gun');
    }
    check('all four flocks dyed: stage 12', [H.getVarBit(p, 'mourning_sheep_red'), H.getVarBit(p, 'mourning_sheep_green'), H.getVarBit(p, 'mourning_sheep_blue'), H.getVarBit(p, 'mourning_sheep_yellow'), H.getVar(p, 'mourning_quest')], [1, 1, 1, 1, 12]);
    talk(p, 'elena2');
    check('Elena has seen them: stage 13', H.getVar(p, 'mourning_quest'), 13);
    H.give(p, 'mourning_teleport_crystal_4'); // (the sim emptied the pack before the HQ)
    held(p, 'mourning_teleport_crystal_4', 1);
    H.tick(6);
    check('the crystal goes back to Lletya', [Math.abs(p.x - 2353) < 3, Math.abs(p.z - 3170) < 3], [true, true]);
    talk(p, 'mourning_arianwyn');
    H.tick(3);
    check('Arianwyn: complete, 2 quest points', [H.getVar(p, 'mourning_quest'), qp(p) - start], [20, 2]);
    journalStages(p, 'mourning_quest', 'questlist:mourning', [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 20]);
}

// ============================================================================ Recipe for Disaster
/** The nearest loc (same level) whose category is `cat`, as [x, z, name]. */
function nearestCat(p: Player, cat: string, radius = 40): [number, number, string] | null {
    const catId = CategoryType.getId(cat);
    let best: [number, number, string] | null = null;
    let bd = Infinity;
    for (let x = (p.x - radius) & ~7; x <= p.x + radius; x += 8)
        for (let z = (p.z - radius) & ~7; z <= p.z + radius; z += 8)
            for (const l of World.gameMap.getZone(x, z, p.level).getAllLocsUnsafe()) {
                const t = LocType.get(l.type);
                if (t.category !== catId) continue;
                const d = Math.max(Math.abs(l.x - p.x), Math.abs(l.z - p.z));
                if (d < bd && World.getLoc(l.x, l.z, p.level, l.type)) { bd = d; best = [l.x, l.z, t.debugname!]; }
            }
    return best;
}
const chatLogX = () => H.ifaces.slice(-8).map(i => i.text);
const tally = (p: Player) => H.runProc(p, '[proc,hundred_subquests_done]')[0];
const rfd = run('rfd') ? player('rfd1', 3208, 3214) : null;
if (rfd) {
    console.log('RECIPE FOR DISASTER - the frame');
    const p = rfd;
    H.setVar(p, 'cookquest', 2);
    const start = qp(p);
    talk(p, 'cook', [1]);
    check('the Cook asks for help: stage 1', V(p, 'hundred_main_quest_var'), 1);
    p.teleport(3208, 3215, 0);
    H.tick(2);
    op(p, 3207, 3217, 'hundred_lumbridge_door', 1);
    op(p, 3209, 3218, 'hundred_portal_multi', 1);
    check('the portal into the frozen room: stage 2, on a walkable tile', [V(p, 'hundred_main_quest_var'), p.x, p.z, walkable(0, p.x, p.z)], [2, 1861, 5317, true]);
    check('Aris is reachable on foot from the landing', connected(0, p.x, p.z, 1866, 5326), true);
    talk(p, 'hundred_aris');
    check('Aris explains: stage 4 (the Cook sub-quest ticks it on), 1 sub-quest', [V(p, 'hundred_main_quest_var'), tally(p)], [4, 1]);
    p.teleport(1861, 5318, 0); // the barrier landing: every plinth is walked to from here
    H.tick(2);
    for (const [loc, x, z] of [['hundred_dwarf_ambassador_base', 1862, 5321], ['hundred_goblin1_base', 1862, 5325], ['hundred_pirate_base', 1862, 5323], ['hundred_guide_base', 1865, 5325], ['hundred_dave_base', 1865, 5323], ['hundred_ogre_base', 1863, 5328], ['hundred_varze_base', 1865, 5321], ['hundred_monkey_base', 1865, 5319]] as [string, number, number][]) {
        const from = mark();
        op(p, x, z, loc, 1);
        if (said(p, from, "can't reach")) check(`inspect ${loc}`, 'unreachable', 'ok');
    }
    check('inspecting the plinths starts the sub-quests', [V(p, 'hundred_dwarf_quest'), V(p, '100goblin'), V(p, '100_pirate_quest_var'), V(p, '100guide_prog'), V(p, 'hundred_dave_main'), V(p, '100_ogre_prog'), V(p, 'hundred_ilm_quest')], [1, 1, 1, 1, 1, 1, 1]);
    op(p, 1861, 5316, 'hundred_portal_door1', 1);
    check('the barrier leads back to Lumbridge', [p.x, p.z, walkable(0, p.x, p.z)], [3208, 3218, true]);
    p.teleport(3218, 9624, 0);
    H.tick(2);
    op(p, 3219, 9623, 'hundred_goodchest', 2);
    check('the cellar chest opens its tier-1 food shop', said(p, 0, 'will not open'), false);

    console.log('RECIPE FOR DISASTER - the Mountain Dwarf');
    talk(p, 'hundred_dwarf_dad_multi');
    check('Rohak named and asking for ale', V(p, 'hundred_dwarf_quest'), 3);
    H.give(p, 'asgarnian_ale');
    H.give(p, 'coins', 10);
    useHeld(p, 'coins', 'asgarnian_ale');
    useOnNpc(p, 'hundred_dwarf_dad_multi', 'hundred_dwarf_asgarnian_ale');
    check('Rohak drinks: stage 4', V(p, 'hundred_dwarf_quest'), 4);
    talk(p, 'hundred_dwarf_drunk_multi');
    check('drunk Rohak bakes a hot rock cake', H.invCount(p, 'hundred_dwarf_hot_rockcake'), 1);
    p.teleport(3221, 3214, 0);
    H.tick(2);
    const water = nearestCat(p, 'watersource', 60);
    if (water) {
        p.teleport(water[0] + 1, water[1], 0);
        H.tick(1);
        useOn(p, water[0], water[1], water[2], 'hundred_dwarf_hot_rockcake');
    }
    check('cooled in water', H.invCount(p, 'hundred_dwarf_cool_rockcake'), 1);
    p.teleport(1861, 5318, 0); // the barrier landing: every plinth is walked to from here
    H.tick(2);
    useOn(p, 1862, 5321, 'hundred_dwarf_ambassador_base', 'hundred_dwarf_cool_rockcake');
    check('the Mountain Dwarf is freed', [V(p, 'hundred_dwarf_quest'), tally(p)], [7, 2]);

    console.log('RECIPE FOR DISASTER - the Lumbridge Guide');
    talk(p, 'cook');
    talk(p, 'lumbridge_guide2_man');
    talk(p, 'lumbridge_guide2_woman');
    check('flour from the Cook, an egg from Gee, milk from Donie', ['pot_flour', 'egg', 'bucket_milk'].map(o => H.invCount(p, o)), [1, 1, 1]);
    H.give(p, 'cake_tin');
    useHeld(p, 'pot_flour', 'cake_tin');
    check('the cake mixed', H.invCount(p, 'uncooked_cake'), 1);
    p.teleport(3230, 3197, 0);
    H.tick(2);
    useOn(p, 3230, 3196, 'range', 'uncooked_cake');
    check('baked', H.invCount(p, 'cake'), 1);
    p.teleport(1861, 5318, 0); // the barrier landing: every plinth is walked to from here
    H.tick(2);
    useOn(p, 1865, 5325, 'hundred_guide_base', 'cake');
    check('the Lumbridge Guide is freed', tally(p), 3);

    console.log('RECIPE FOR DISASTER - Sir Amik Varze');
    talk(p, 'sir_amik_varze');
    H.give(p, 'fruit_blast');
    H.give(p, 'ashes');
    useHeld(p, 'ashes', 'fruit_blast');
    check('a dirty blast', H.invCount(p, 'hundred_fruit_blast'), 1);
    p.teleport(1861, 5318, 0); // the barrier landing: every plinth is walked to from here
    H.tick(2);
    useOn(p, 1865, 5321, 'hundred_varze_base', 'hundred_fruit_blast');
    check('Sir Amik is freed', tally(p), 4);

    console.log('RECIPE FOR DISASTER - the Goblin generals');
    talk(p, 'general_wartface');
    talk(p, 'general_bentnoze');
    check('both generals asked', V(p, '100goblin'), 2);
    for (const o of ['bread', 'bucket_water', 'fishing_bait', 'spicespot', 'orange_slices', 'reddye']) H.give(p, o);
    useHeld(p, 'bucket_water', 'bread');
    useHeld(p, 'spicespot', 'fishing_bait');
    useHeld(p, 'reddye', 'orange_slices');
    check('soggy bread, spicy maggots, dyed oranges', ['100goblin_soggy_bread', '100goblin_spicey_maggots', '100goblin_dyed_oranges'].map(o => H.invCount(p, o)), [1, 1, 1]);
    p.teleport(2961, 3506, 0);
    H.tick(2);
    op(p, 2960, 3507, '100_goblin_ladder_down', 1);
    check('down into the kitchen', [Math.abs(p.z - 9915) < 3, walkable(0, p.x, p.z)], [true, true]);
    useOn(p, 2980, 9910, '100_goblin_cauldren_still', '100goblin_soggy_bread');
    H.tick(10);
    check('the cauldron blows: slop of compromise', [H.invCount(p, '100goblin_compromise_mush'), V(p, '100goblin')], [1, 3]);
    op(p, 2981, 9916, '100_goblin_ladder_up', 1);
    check('back up to the village', p.z < 4000, true);
    p.teleport(1861, 5318, 0); // the barrier landing: every plinth is walked to from here
    H.tick(2);
    useOn(p, 1862, 5325, 'hundred_goblin1_base', '100goblin_compromise_mush');
    check('the Goblin generals are freed', tally(p), 5);
    void start;
}

if (rfd) {
    const p = rfd;
    H.equip(p, { rhand: 'rune_scimitar' });
    const plinth = (loc: string, x: number, z: number, obj: string) => {
        p.teleport(1861, 5318, 0);
        H.tick(2);
        useOn(p, x, z, loc, obj);
    };

    console.log('RECIPE FOR DISASTER - Pirate Pete');
    H.clearInv(p);
    talk(p, 'murphy');
    check('Murphy kits you out: stage 2', [V(p, '100_pirate_quest_var'), H.invCount(p, 'hundred_pirate_diving_helmet'), H.invCount(p, 'hundred_pirate_diving_backpack')], [2, 1, 1]);
    H.clearInv(p);
    H.equip(p, { hat: 'hundred_pirate_diving_helmet', back: 'hundred_pirate_diving_backpack', rhand: 'rune_scimitar' });
    talk(p, 'murphy', [1]);
    check('lowered to the seabed: stage 3, a walkable tile', [V(p, '100_pirate_quest_var'), p.level, walkable(p.level, p.x, p.z)], [3, 1, true]);
    op(p, 2949, 9480, 'kelp_pickingpoint', 1);
    check('kelp', H.invCount(p, 'hundred_pirate_kelp'), 1);
    p.teleport(2974, 9513, 1);
    H.tick(2);
    op(p, 2974, 9514, 'pen_wall_doorl', 1);
    check('the crab pen door opens', lastMes(p) !== "I can't reach that!", true);
    const crab = [1].map(() => H.npcNear('hundred_pirate_giant_crab', 2974, 9518, 1) ?? H.npcNear('hundred_pirate_giant_crab_2', 2974, 9518, 1))[0];
    check('a giant crab in the pen', crab !== null, true);
    if (crab) {
        check('the pen is open to walk into', connected(1, p.x, p.z, crab.x - 1, crab.z) || connected(1, p.x, p.z, crab.x + crab.width, crab.z), true);
        check('the crab dies to a real fight', fight(p, crab), true);
        check('crab meat', take(p, 'hundred_pirate_giant_crab_meat', 4), true);
    }
    p.teleport(2963, 9479, 1);
    H.tick(2);
    op(p, 2963, 9477, 'anchor_middle', 1);
    check('up the anchor chain to Port Khazard', [p.level, walkable(0, p.x, p.z), Math.abs(p.x - 2669) < 3], [0, true, true]);
    for (const o of ['raw_cod', 'bread', 'pestle_and_mortar']) H.give(p, o);
    for (const o of ['hundred_pirate_kelp', 'hundred_pirate_giant_crab_meat', 'raw_cod', 'bread']) useHeld(p, 'pestle_and_mortar', o);
    check('all four ground', ['hundred_pirate_ground_kelp', 'hundred_pirate_ground_giant_crab_meat', 'hundred_pirate_ground_cod', 'hundred_pirate_breadcrumbs'].map(o => H.invCount(p, o)), [1, 1, 1, 1]);
    useHeld(p, 'hundred_pirate_ground_kelp', 'hundred_pirate_breadcrumbs');
    p.teleport(3230, 3197, 0);
    H.tick(2);
    useOn(p, 3230, 3196, 'range', 'hundred_pirate_raw_fishcake');
    check('a fishcake, cooked', H.invCount(p, 'hundred_pirate_fishcake'), 1);
    plinth('hundred_pirate_base', 1862, 5323, 'hundred_pirate_fishcake');
    check('Pirate Pete is freed', tally(p), 6);

    console.log('RECIPE FOR DISASTER - Evil Dave');
    talk(p, 'hundred_dave_mum');
    check('Doris: stage 2', V(p, 'hundred_dave_main'), 2);
    p.teleport(3078, 3493, 0);
    H.tick(2);
    op(p, 3077, 3493, '100_dave_celler_trapdoor', 1);
    op(p, 3077, 3493, '100_dave_celler_trapdoor', 1);
    check('down the trapdoor to a walkable cellar tile', [p.z > 9000, walkable(0, p.x, p.z)], [true, true]);
    check('Evil Dave is reachable on foot', connected(0, p.x, p.z, 3080, 9891) || connected(0, p.x, p.z, 3081, 9890) || connected(0, p.x, p.z, 3079, 9890), true);
    talk(p, 'hundred_evil_dave', [], 1, false);
    check('Dave names the stew: stage 3', V(p, 'hundred_dave_main'), 3);
    // the spice: the cat catches four hell-rats and the fourth is a behemoth that drops a shaker
    for (let i = 0; i < 4; i++) runProcProtected(p, '[proc,hundred_dave_hellrat_caught]'); // what [opnpc5,_petcat] calls on each hell-rat the cat catches
    H.tick(2);
    const behemoth = H.npcNear('hundred_dave_hellrat_behemoth', p.x, p.z, 0);
    check('four catches bring out a behemoth', behemoth !== null, true);
    if (behemoth) {
        check('the behemoth dies to a real fight', fight(p, behemoth), true);
        const got = ['red', 'orange', 'yellow', 'brown'].some(c => take(p, `hundred_dave_spice_${c}_4`, 4));
        check('and drops a spice shaker', got, true);
    }
    H.clearInv(p);
    const want: Record<string, number> = {};
    for (const c of ['red', 'orange', 'yellow', 'brown']) want[c] = V(p, `hundred_dave_${c}_target`);
    H.give(p, 'stew');
    for (const c of ['red', 'orange', 'yellow', 'brown']) H.give(p, `hundred_dave_spice_${c}_4`);
    let first = true;
    for (const [c, n] of Object.entries(want)) {
        for (let i = 0; i < n; i++) {
            useHeld(p, `hundred_dave_spice_${c}_${4 - i}`, first ? 'stew' : 'hundred_dave_stew');
            first = false;
        }
    }
    check('the stew spiced to his three doses', ['red', 'orange', 'yellow', 'brown'].map(c => V(p, `hundred_dave_${c}`)), Object.values(want));
    useOnNpc(p, 'hundred_evil_dave', 'hundred_dave_stew');
    check('Dave approves: stage 4', V(p, 'hundred_dave_main'), 4);
    op(p, 3076, 9893, '100_dave_celler_stairs', 1);
    check('the cellar stairs back up', [p.z < 4000, walkable(0, p.x, p.z)], [true, true]);
    plinth('hundred_dave_base', 1865, 5323, 'hundred_dave_stew');
    check('Evil Dave is freed', tally(p), 7);

    console.log('RECIPE FOR DISASTER - Skrach Uglogwee');
    H.clearInv(p);
    talk(p, '100_rantz_multi_npc');
    check('Rantz pushes the tree over: stage 3', V(p, '100_ogre_prog'), 3);
    H.give(p, 'bronze_axe');
    p.teleport(2651, 2961, 0);
    H.tick(2);
    useOn(p, 2653, 2963, '100_jubbly_multi_push_tree', 'bronze_axe');
    useOn(p, 2653, 2963, '100_jubbly_multi_push_tree', 'bronze_axe');
    check('roots off, hollowed out: stage 5', V(p, '100_ogre_prog'), 5);
    talk(p, '100_rantz_multi_npc');
    check('Rantz launches the boat: stage 6 and balloon toads', [V(p, '100_ogre_prog'), H.invCount(p, '100_jubbly_balloon_toad_brown') > 0], [6, true]);
    p.teleport(2651, 2961, 0);
    H.tick(2);
    talk(p, '100_jubbly_multi_boat_feldip', [], 1, false);
    check('the shore boat is out on the water: clicking it does nothing', Math.abs(p.x - 2760) < 3, false);
    talk(p, '100_rantz_multi_npc', [1]);
    H.tick(4);
    check('Rantz has the kids row you out: the island, a walkable tile', [Math.abs(p.x - 2760) < 3, Math.abs(p.z - 3081) < 3, walkable(0, p.x, p.z)], [true, true, true]);
    held(p, '100_jubbly_balloon_toad_brown', 1);
    H.tick(8);
    const bird = H.npcNear('100_jubbly_bird', p.x, p.z, 0);
    check('a jubbly bird comes for the toad', bird !== null, true);
    if (bird) {
        check('the jubbly bird dies to a real fight', fight(p, bird), true);
        H.tick(2);
        talk(p, '100_jubbly_bird_dead', [], 4);
        check('plucked: stage 7 and raw jubbly', [V(p, '100_ogre_prog'), take(p, '100_jubbly_meat_raw', 7)], [7, true]);
    }
    p.teleport(2760, 3081, 0);
    H.tick(2);
    talk(p, '100_jubbly_multi_boat_karamja', [], 1, false);
    H.tick(4);
    check('rowed back, a walkable tile', [Math.abs(p.x - 2654) < 3, walkable(0, p.x, p.z)], [true, true]);
    // an open fire on the shore (the sim does not light one - see the report)
    p.teleport(2649, 2958, 0);
    H.tick(1);
    addLoc('fire', 2650, 2958, 0, 10);
    H.tick(1);
    useOn(p, 2650, 2958, 'fire', '100_jubbly_meat_raw');
    check('cooked jubbly', H.invCount(p, '100_jubbly_meat_cooked'), 1);
    plinth('hundred_ogre_base', 1863, 5328, '100_jubbly_meat_cooked');
    check('Skrach Uglogwee is freed', tally(p), 8);

    console.log('RECIPE FOR DISASTER - King Awowogei');
    H.clearInv(p);
    for (const m of ['hundred_ilm_mizaru', 'hundred_ilm_kikazaru', 'hundred_ilm_iwazaru']) talk(p, m);
    check('the three wise monkeys give the recipe: stage 2', V(p, 'hundred_ilm_quest'), 2);
    p.teleport(2697, 2784, 0);
    H.tick(2);
    op(p, 2696, 2785, 'loc_12610', 1);
    op(p, 2696, 2785, 'loc_12610', 1);
    check('the crown hauled down: a red banana', H.invCount(p, 'hundred_ilm_red_banana'), 1);
    // On foot, the 2006 way: from inside Marim's gate to the temple, down its trapdoor into the crypt,
    // through the crypt to the nut cave's crack (loc_12617), and back up the rope. Monkey Madness wires
    // the trapdoor and the rope (quest_mm/scripts/mm_ladders.rs2).
    check('Marim (inside the gate) reaches the temple trapdoor on foot', [connected(0, 2721, 2767, 2806, 2785, 200), walkable(0, 2807, 2785)], [true, false]);
    p.teleport(2792, 2772, 0);
    H.tick(2);
    op(p, 2807, 2785, 'mm_temple_trapdoor', 1);
    check('the trapdoor opens (worked from the temple floor)', [at(p), World.getLoc(2807, 2785, 0, LocType.getId('mm_temple_trapdoor_open')) !== null], [[2806, 2785, 0], true]);
    op(p, 2807, 2785, 'mm_temple_trapdoor_open', 1);
    check('down into the crypt beside the rope, a walkable tile', [at(p), walkable(0, p.x, p.z)], [[2807, 9201, 0], true]);
    check('  and the crypt leads to the nut cave on foot', connected(0, p.x, p.z, 2804, 9199, 200), true);
    op(p, 2805, 9199, 'loc_12617', 1);
    check('into the nut cave, a walkable tile', [p.z < 6000, walkable(0, p.x, p.z)], [true, true]);
    op(p, 3020, 5457, 'loc_12615', 1);
    check('Tchiki nuts', H.invCount(p, 'hundred_ilm_tchiki_monkey_nuts'), 1);
    op(p, 3025, 5457, 'loc_12616', 1);
    check('out of the nut cave, a walkable tile', [p.z > 9000, walkable(0, p.x, p.z)], [true, true]);
    check('  and back to the rope on foot', connected(0, p.x, p.z, 2807, 9201, 200), true);
    op(p, 2808, 9201, 'mm_climbing_rope_bottom_temple', 1);
    check('up the rope, beside the trapdoor', [at(p), walkable(0, p.x, p.z), connected(0, p.x, p.z, 2721, 2767, 200)], [[2806, 2785, 0], true, true]);
    op(p, 2807, 2785, 'mm_temple_trapdoor_open', 2);
    check('  and the trapdoor closes', World.getLoc(2807, 2785, 0, LocType.getId('mm_temple_trapdoor')) !== null, true);
    p.teleport(2920, 2721, 0);
    H.tick(2);
    op(p, 2921, 2721, 'loc_12602', 1);
    check('down into the snake pit, a walkable tile', [p.z > 5000, walkable(0, p.x, p.z)], [true, true]);
    const snake = H.npcNear('hundred_ilm_snake', p.x, p.z, 0);
    if (snake) {
        check('a big snake dies to a real fight', fight(p, snake), true);
        check('snake corpse', take(p, 'hundred_ilm_snake_corpse', 4), true);
    }
    op(p, 3023, 5488, 'loc_12601', 1);
    check('the rope out of the pit, a walkable tile', [p.z < 3000, walkable(0, p.x, p.z)], [true, true]);
    H.give(p, 'knife');
    H.give(p, 'pestle_and_mortar');
    useHeld(p, 'knife', 'hundred_ilm_red_banana');
    useHeld(p, 'pestle_and_mortar', 'hundred_ilm_tchiki_monkey_nuts');
    useHeld(p, 'hundred_ilm_sliced_red_banana', 'hundred_ilm_snake_corpse');
    check('the snake stuffed', H.invCount(p, 'hundred_ilm_correctly_stuffed_snake'), 1);
    p.teleport(3230, 3197, 0);
    H.tick(2);
    useOn(p, 3230, 3196, 'range', 'hundred_ilm_correctly_stuffed_snake');
    plinth('hundred_monkey_base', 1865, 5319, 'hundred_ilm_cooked_stuffed_snake');
    check('King Awowogei is freed', tally(p), 9);

    console.log('RECIPE FOR DISASTER - the Culinaromancer');
    const start = qp(p);
    talk(p, 'hundred_aris', [1]);
    check('Aris puts you in the arena, a walkable tile', [p.level, walkable(2, p.x, p.z)], [2, true]);
    const order = ['hundred_minion1', 'hundred_minion2', 'hundred_minion3', 'hundred_minion4', 'hundred_minion5_air', 'hundred_culinaromancer_final'];
    for (const [i, name] of order.entries()) {
        let npc = H.npcNear(name, p.x, p.z, 2);
        if (!npc && i === 4) npc = ['water', 'fire', 'earth', 'melee', 'ranged'].map(f => H.npcNear(`hundred_minion5_${f}`, p.x, p.z, 2)).find(n => n) ?? null;
        check(`${name} appears`, npc !== null, true);
        if (!npc) break;
        if (i === 4) {
            // the Gelatinnoth Mother only takes damage from her current form's style, and her form
            // turns every 30 ticks; a scimitar fights her melee form, so each time she comes round
            // to it, attack until she turns again
            let dead = false;
            for (let round = 0; round < 40 && !dead; round++) {
                for (let t = 0; t < 200 && NpcType.get(npc.type).debugname !== 'hundred_minion5_melee'; t++) H.tick(1);
                H.attackNpc(p, npc);
                for (let t = 0; t < 30; t++) {
                    H.tick(1);
                    if (!npc.isActive || npc.levels[3] === 0) { dead = true; break; }
                    if (!p.target && t % 5 === 4) H.attackNpc(p, npc);
                    if (p.levels[3] < 50) p.levels[3] = 99;
                }
            }
            H.tick(3);
            check(`${name} dies to a real fight (her melee form)`, dead, true);
        } else {
            check(`${name} dies to a real fight`, fight(p, npc, 900), true);
        }
        H.tick(3);
        check(`  the tally counts it`, V(p, 'hundred_minionskilled_tally'), i + 1);
    }
    drive(p);
    check('complete: stage 5, all ten, 1 more quest point, the lamp', [V(p, 'hundred_main_quest_var'), tally(p), qp(p) - start, H.invCount(p, 'hundred_rewardlamp')], [5, 10, 1, 1]);
    check('landed in the freed dining room on a walkable tile', [p.level, walkable(0, p.x, p.z), p.z > 5330], [0, true, true]);
    journalStagesBit(p, 'hundred_main_quest_var', 'questlist:hundred_main', [0, 1, 2, 3, 4, 5]);
}

// ============================================================================ Demon Slayer
if (run('demon')) {
    console.log('DEMON SLAYER');
    const p = player('demon1', 3204, 3425);
    const start = qp(p);
    H.give(p, 'coins', 100);
    talk(p, 'aris', ['here you go', 'Aaargh bit', "Who's Delrith", 'Okay, where is he', 'What is the magical incantation', 'do my best']);
    check('the gypsy tells the future: stage 1', V(p, 'demonstart'), 1);
    talk(p, 'sir_prysin', ['Gypsy Aris', 'I need to find Silverlight', "gypsy's crystal ball", 'So give me the keys', 'give me your key', 'drain lead', 'Captain Rovin', 'key hunting']);
    check('Sir Prysin sends you for three keys: stage 2', V(p, 'demonstart'), 2);
    talk(p, 'captain_rovin', ['this is important', 'demon who wants to invade']);
    check('Captain Rovin gives his key', H.invCount(p, 'silverlight_key_2'), 1);
    talk(p, 'traiborn', ['key given to you by Sir Prysin', 'keys knocking around', 'get the bones']);
    check('Traiborn wants bones: stage 3', V(p, 'demonstart'), 3);
    H.give(p, 'bones', 25);
    talk(p, 'traiborn');
    check('25 bones: Traiborn\'s key', [V(p, 'demonstart'), H.invCount(p, 'silverlight_key_1')], [28, 1]);
    // the drain: a bucket of water washes the key down to the sewer
    p.teleport(3225, 3496, 0);
    H.tick(2);
    H.give(p, 'bucket_water');
    useOn(p, 3225, 3495, 'questdrain', 'bucket_water');
    p.teleport(3226, 9897, 0);
    H.tick(2);
    check('the sewer under the drain is walkable', walkable(0, 3225, 9897), true);
    check('the washed key lies in the sewer', take(p, 'silverlight_key_3', 6), true);
    talk(p, 'sir_prysin');
    check('three keys: Silverlight, stage 29', [V(p, 'demonstart'), H.invCount(p, 'silverlight')], [29, 1]);
    H.clearInv(p);
    H.equip(p, { rhand: 'silverlight' });
    const d = findNpc('delrith', p);
    check('Delrith can be fought', d.levels[3] > 1, true);
    fight(p, d, 400);
    drive(p, ['Carlem Aber Camerinthum Purchai Gabindo']);
    H.tick(4);
    drive(p);
    check('the incantation: complete, 3 quest points', [V(p, 'demonstart'), qp(p) - start], [30, 3]);
    journalStages(p, 'demonstart', 'questlist:demon', [0, 1, 2, 3, 10, 28, 29, 30]);
}

// ============================================================================ Waterfall Quest
if (run('waterfall')) {
    console.log('WATERFALL QUEST');
    const p = player('wfall1', 2522, 3497);
    const start = qp(p);
    talk(p, 'almera_waterfall_quest', ['How can I help']);
    check('Almera: stage 1', V(p, 'waterfall_quest'), 1);
    p.teleport(2509, 3494, 0);
    H.tick(2);
    op(p, 2509, 3493, 'lograft_waterfall_quest', 1);
    check('the raft to Hudon: stage 2, a walkable tile', [V(p, 'waterfall_quest'), walkable(0, p.x, p.z)], [2, true]);
    p.teleport(2519, 3426, 1);
    H.tick(2);
    op(p, 2520, 3426, 'bookcase_waterfall_quest', 1);
    check("the Book on Baxtorian from Hadley's bookcase", H.invCount(p, 'baxtorian_book_waterfall_quest'), 1);
    held(p, 'baxtorian_book_waterfall_quest', 1);
    p.closeModal();
    check('reading it: stage 3', V(p, 'waterfall_quest'), 3);
    p.teleport(2548, 9566, 0);
    H.tick(2);
    op(p, 2548, 9565, 'golrie_crate_waterfall_quest', 1);
    check("Golrie's key from the crate", H.invCount(p, 'golrie_key_waterfall_quest'), 1);
    p.teleport(2515, 9574, 0);
    H.tick(2);
    useOn(p, 2515, 9575, 'golrie_gate_waterfall_quest', 'golrie_key_waterfall_quest');
    check('through the gate to Golrie', p.z >= 9576, true);
    talk(p, 'golrie_waterfall_quest', [], 1, false);
    check("Glarial's pebble", H.invCount(p, 'glarials_pebble_waterfall_quest'), 1);
    p.teleport(2558, 3443, 0);
    H.tick(2);
    useOn(p, 2558, 3444, 'glarials_tombstone_waterfall_quest', 'glarials_pebble_waterfall_quest');
    check("into Glarial's tomb: stage 4, a walkable tile", [V(p, 'waterfall_quest'), p.z > 9000, walkable(0, p.x, p.z)], [4, true, true]);
    check('the chest is reachable from the landing', reachLoc(0, p.x, p.z, 'glarials_chest_closed_waterfall_quest', 2530, 9844), true);
    op(p, 2530, 9844, 'glarials_chest_closed_waterfall_quest', 1);
    op(p, 2530, 9844, 'glarials_chest_open_waterfall_quest', 1);
    op(p, 2542, 9811, 'glarials_tomb_waterfall_quest', 1);
    check("Glarial's amulet and urn", [H.invCount(p, 'glarials_amulet_waterfall_quest'), H.invCount(p, 'glarials_urn_full_waterfall_quest')], [1, 1]);
    // the island: rope on the rock from the raft landing, then rope on the tree down to the ledge
    H.give(p, 'rope', 2);
    p.teleport(2512, 3481, 0);
    H.tick(2);
    useOn(p, 2512, 3468, 'crossing_rock_waterfall_quest', 'rope');
    H.tick(4);
    check('the rope across to the rock', [p.z <= 3469, walkable(0, p.x, p.z)], [true, true]);
    useOn(p, 2512, 3465, 'overhanging_tree1_waterfall_quest', 'rope');
    check('down onto the ledge, a walkable tile', [p.x, p.z, walkable(0, p.x, p.z)], [2511, 3463, true]);
    H.equip(p, { front: 'glarials_amulet_waterfall_quest' });
    H.clearInv(p);
    H.give(p, 'glarials_urn_full_waterfall_quest');
    for (const r of ['airrune', 'earthrune', 'waterrune']) H.give(p, r, 6);
    op(p, 2511, 3464, 'waterfall_ledge_door', 1);
    check('the ledge door with the amulet: in, stage 5, a walkable tile', [V(p, 'waterfall_quest'), p.z > 9000, walkable(0, p.x, p.z)], [5, true, true]);
    op(p, 2582, 9875, 'loc_1516', 1); // the double doors east of the landing
    op(p, 2589, 9888, 'baxtorian_crate_waterfall_quest', 1);
    check('a large key', H.invCount(p, 'baxtorian_key_waterfall_quest'), 1);
    const door = [2566, 9901];
    op(p, 2564, 9881, 'loc_1516', 1);
    useOn(p, 2568, 9893, 'baxtorian_door_2_waterfall_quest', 'baxtorian_key_waterfall_quest');
    check('the key opens the south door', p.z >= 9894, true);
    useOn(p, door[0], door[1], 'baxtorian_door_2_waterfall_quest', 'baxtorian_key_waterfall_quest');
    check('through the key door into the puzzle room: stage 6', [V(p, 'waterfall_quest'), p.z >= door[1]], [6, true]);
    for (const [x, z] of [[2562, 9910], [2562, 9912], [2562, 9914], [2569, 9910], [2569, 9912], [2569, 9914]])
        for (const r of ['airrune', 'earthrune', 'waterrune']) useOn(p, x, z, 'stonepillar_small_waterfall_quest', r);
    check('a rune of each on all six pillars', [H.invCount(p, 'airrune'), H.invCount(p, 'earthrune'), H.invCount(p, 'waterrune')], [0, 0, 0]);
    H.clearInv(p);
    p.invDel(InvType.WORN, ObjType.getId('glarials_amulet_waterfall_quest'), 1);
    H.give(p, 'glarials_amulet_waterfall_quest');
    H.give(p, 'glarials_urn_full_waterfall_quest');
    useOn(p, 2565, 9916, 'statue_queen_waterfall_quest', 'glarials_amulet_waterfall_quest');
    check('the amulet on the statue raises the floor: stage 8, the raised room, a walkable tile', [V(p, 'waterfall_quest'), p.x > 2600, walkable(p.level, p.x, p.z)], [8, true, true]);
    useOn(p, 2603, 9910, 'baxtorian_chalice_waterfall_quest', 'glarials_urn_full_waterfall_quest');
    H.tick(3);
    drive(p);
    check('the ashes in the chalice: complete, 1 quest point, the treasure', [V(p, 'waterfall_quest'), qp(p) - start, H.invCount(p, 'mithril_seed')], [10, 1, 40]);
    journalStages(p, 'waterfall_quest', 'questlist:waterfall', [0, 1, 2, 3, 4, 5, 6, 8, 10]);
}

// ============================================================================ Monk's Friend
if (run('monk')) {
    console.log("MONK'S FRIEND");
    const p = player('monk1', 2604, 3210);
    const start = qp(p);
    talk(p, 'brother_omad', ["Why can't you sleep", 'Can I help']);
    check('Brother Omad: stage 10', V(p, 'drunkmonkquest'), 10);
    p.teleport(2562, 3224, 0);
    H.tick(4);
    check('the hidden ladder appears in the ring of stones', World.getLoc(2561, 3222, 0, LocType.getId('loc_1765')) !== null, true);
    op(p, 2561, 3222, 'loc_1765', 1);
    check('down into the thieves\' cave, a walkable tile', [p.z > 9000, walkable(0, p.x, p.z)], [true, true]);
    op(p, 2565, 9612, 'loc_1530', 1);
    check('through the door, the blanket table is reachable on foot', connected(0, p.x, p.z, 2569, 9604, 60), true);
    p.teleport(2569, 9604, 0);
    H.tick(1);
    check('the blanket', take(p, 'childs_blanket', 1), true);
    p.teleport(2561, 9621, 0);
    H.tick(1);
    op(p, 2561, 9622, 'loc_1755', 1);
    check('the ladder back up to the forest', [p.z < 4000, walkable(0, p.x, p.z)], [true, true]);
    talk(p, 'brother_omad');
    check('the blanket back: stage 20', V(p, 'drunkmonkquest'), 20);
    talk(p, 'brother_omad', ["Who's Brother Cedric", 'Where should I look']);
    check('asked to find Cedric: stage 30', V(p, 'drunkmonkquest'), 30);
    talk(p, 'brother_cedric');
    H.give(p, 'jug_water');
    talk(p, 'brother_cedric', ['happy to']);
    check('water and the cart: stage 60', V(p, 'drunkmonkquest'), 60);
    H.give(p, 'logs');
    talk(p, 'brother_cedric');
    check('the cart mended: stage 70', V(p, 'drunkmonkquest'), 70);
    talk(p, 'brother_omad');
    H.tick(20);
    drive(p);
    check('the party: complete, 1 quest point, 8 law runes', [V(p, 'drunkmonkquest'), qp(p) - start, H.invCount(p, 'lawrune')], [80, 1, 8]);
    journalStages(p, 'drunkmonkquest', 'questlist:drunkmonk', [0, 10, 20, 30, 40, 50, 60, 70, 80]);
}

// ============================================================================ Goblin Diplomacy
if (run('gobdip')) {
    console.log('GOBLIN DIPLOMACY');
    const p = player('gobdip1', 3045, 3257);
    const start = qp(p);
    talk(p, 'rustyanchor_bartender', ['Not very busy']);
    check('the Rusty Anchor bartender: stage 1', V(p, 'goblinquest'), 1);
    talk(p, 'general_wartface', ['pick an armour colour']);
    check('the generals want armour: stage 2', V(p, 'goblinquest'), 2);
    H.give(p, 'goblin_armour', 3);
    H.give(p, 'reddye');
    H.give(p, 'yellowdye');
    H.give(p, 'bluedye');
    useHeld(p, 'reddye', 'yellowdye');
    useHeld(p, 'orangedye', 'goblin_armour');
    useHeld(p, 'bluedye', 'goblin_armour');
    check('orange and blue goblin mail', [H.invCount(p, 'goblin_armour_orange'), H.invCount(p, 'goblin_armour_darkblue'), H.invCount(p, 'goblin_armour')], [1, 1, 1]);
    talk(p, 'general_wartface');
    check('orange handed over: stage 3', V(p, 'goblinquest'), 3);
    talk(p, 'general_bentnoze');
    check('blue handed over: stage 4', V(p, 'goblinquest'), 4);
    talk(p, 'general_wartface');
    H.tick(3);
    drive(p);
    check('brown handed over: complete, 5 quest points, a gold bar', [V(p, 'goblinquest'), qp(p) - start, H.invCount(p, 'gold_bar')], [6, 5, 1]);
    journalStages(p, 'goblinquest', 'questlist:gobdip', [0, 1, 2, 3, 4, 5, 6]);
}

// ============================================================================ Scorpion Catcher
if (run('scorp')) {
    console.log('SCORPION CATCHER');
    const p = player('scorp1', 2703, 3406, 3);
    const start = qp(p);
    talk(p, 'thormac', ['What do you need assistance', 'how would I go about catching', 'I will do it']);
    check('Thormac: stage 1 and a cage', [V(p, 'scorpcatcher'), H.invCount(p, 'scorpioncageempty')], [1, 1]);
    talk(p, 'seer', ['locate some scorpions']);
    check('the Seer\'s first hint: stage 2', V(p, 'scorpcatcher'), 2);
    p.teleport(2875, 9800, 0);
    H.tick(2);
    check('the secret wall is reachable from the dungeon side', reachLoc(0, 2875, 9800, 'scorpionwall', 2875, 9799) || reachLoc(0, 2876, 9799, 'scorpionwall', 2875, 9799), true);
    op(p, 2875, 9799, 'scorpionwall', 1);
    check('through the secret wall', mesSince(p, 0).some(m => m.includes('secret door')), true);
    useOnNpc(p, 'questscorpiona', 'scorpioncageempty');
    check('the Taverley scorpion', H.invCount(p, 'scorpioncagea'), 1);
    talk(p, 'seer');
    check('the Seer\'s second hint: stage 3', V(p, 'scorpcatcher'), 3);
    talk(p, 'peksa', ['small scorpion']);
    p.teleport(2552, 3572, 0);
    H.tick(2);
    useOnNpc(p, 'questscorpionb', 'scorpioncagea');
    check('the outpost scorpion', H.invCount(p, 'scorpioncageab'), 1);
    p.teleport(3058, 3490, 1);
    H.tick(2);
    useOnNpc(p, 'questscorpionc', 'scorpioncageab');
    check('the monastery scorpion: a full cage', H.invCount(p, 'scorpioncagefull'), 1);
    talk(p, 'thormac');
    H.tick(3);
    drive(p);
    check('back to Thormac: complete, 1 quest point', [V(p, 'scorpcatcher'), qp(p) - start], [6, 1]);
    journalStages(p, 'scorpcatcher', 'questlist:scorpcatcher', [0, 1, 2, 3, 6]);
}

// ============================================================================ Tribal Totem
if (run('totem')) {
    console.log('TRIBAL TOTEM');
    const p = player('totem1', 2792, 3182);
    const start = qp(p);
    talk(p, 'kangai_mau', ['in search of adventure', 'I will get it back']);
    check('Kangai Mau: stage 1', V(p, 'totemquest'), 1);
    p.teleport(2650, 3274, 0);
    H.tick(2);
    op(p, 2650, 3273, 'horncrate', 2);
    check('the delivery label peeled off the crate', H.invCount(p, 'tribal_totem_label'), 1);
    useOn(p, 2650, 3271, 'teleportcrate', 'tribal_totem_label');
    check('relabelled for Handelmort: stage 2', V(p, 'totemquest'), 2);
    talk(p, 'rpdt_employee', ['when are you going to deliver']);
    check('the RPDT delivers it: stage 3', V(p, 'totemquest'), 3);
    talk(p, 'ardounge_wizard', ['So what have you invented', 'Can I be teleported', 'Teleport me']);
    H.tick(4);
    check('Cromperty teleports you into the mansion: stage 4, a walkable tile', [V(p, 'totemquest'), p.x, p.z, walkable(0, p.x, p.z)], [4, 2638, 3321, true]);
    op(p, 2636, 3323, 'loc_1533', 1);
    op(p, 2634, 3323, 'combodoor', 1);
    for (const [lock, n] of [[1, 10], [2, 20], [3, 17], [4, 19]]) for (let i = 0; i < n; i++) H.ifButton(p, `tribal_door2:com_${46 + 2 * lock}`);
    H.ifButton(p, 'tribal_door2:com_57');
    check('KURT opens the combination lock', lastMes(p), 'The combination seems correct!');
    op(p, 2634, 3323, 'combodoor', 1);
    check('through the combination door', p.x < 2634, true);
    op(p, 2631, 3322, 'totemtrapstairs', 2);
    op(p, 2631, 3322, 'totemtrapstairs', 1);
    check('the trap found, then up the stairs safely', [p.level, walkable(1, p.x, p.z)], [1, true]);
    op(p, 2632, 3319, 'loc_1533', 1);
    op(p, 2638, 3319, 'loc_1533', 1);
    op(p, 2638, 3324, 'totemshutchest', 1);
    op(p, 2638, 3324, 'totemopenchest', 1);
    check('the tribal totem', H.invCount(p, 'tribal_totem'), 1);
    talk(p, 'kangai_mau');
    H.tick(3);
    drive(p);
    check('back to Kangai Mau: complete, 1 quest point', [V(p, 'totemquest'), qp(p) - start], [5, 1]);
    journalStages(p, 'totemquest', 'questlist:totem', [0, 1, 2, 3, 4, 5]);
}

// ============================================================================ Shield of Arrav
if (run('arrav')) {
    console.log('SHIELD OF ARRAV - the Phoenix Gang, solo');
    const p = player('arrav1', 3210, 3494);
    const start = qp(p);
    talk(p, 'reldo', ['in search of a quest']);
    check('Reldo: stage 1', V(p, 'phoenixgang'), 1);
    op(p, 3212, 3493, 'questbookcase', 2);
    check('the book from the bookcase', H.invCount(p, 'the_shield_of_arrav'), 1);
    held(p, 'the_shield_of_arrav', 1);
    p.closeModal();
    check('read: stage 2', V(p, 'phoenixgang'), 2);
    talk(p, 'reldo');
    check('back to Reldo: stage 3', V(p, 'phoenixgang'), 3);
    H.give(p, 'coins', 100);
    talk(p, 'baraek', ['Phoenix Gang', 'Have 20 gold']);
    check('Baraek: stage 4', V(p, 'phoenixgang'), 4);
    p.teleport(3246, 9782, 0);
    H.tick(2);
    talk(p, 'straven', ['I know who you are', 'offer you my services']);
    check('Straven\'s mission: stage 8', V(p, 'phoenixgang'), 8);
    H.equip(p, { rhand: 'rune_scimitar' });
    const j = findNpc('jonny_the_beard', p);
    check('Jonny the Beard can be fought', j.levels[3] > 1, true);
    check('  and dies', fight(p, j), true);
    check('the intelligence report', take(p, 'intelligence_report', 4), true);
    p.teleport(3246, 9782, 0);
    H.tick(2);
    talk(p, 'straven');
    check('report handed in: joined, stage 9, the weapon store key', [V(p, 'phoenixgang'), H.invCount(p, 'phoenixkey2')], [9, 1]);
    op(p, 3247, 9779, 'phoenixdoor', 1);
    check('the hideout door opens for a member', p.z <= 9779, true);
    op(p, 3249, 9774, 'loc_1530', 1);
    op(p, 3238, 9767, 'loc_1530', 1);
    op(p, 3235, 9761, 'phoenixshutchest', 1);
    op(p, 3235, 9761, 'phoenixopenchest', 1);
    check('half the shield', H.invCount(p, 'arravshield1'), 1);
    talk(p, 'curator');
    check('the curator: a certificate for the half', H.invCount(p, 'arravcertificate'), 1);
    p.teleport(3223, 3476, 0);
    H.tick(2);
    useOnNpc(p, 'king_roald', 'arravcertificate');
    H.tick(3);
    drive(p);
    check('King Roald: complete, 1 quest point, 600 coins', [V(p, 'phoenixgang'), qp(p) - start, H.invCount(p, 'coins') >= 600], [10, 1, true]);
    journalStages(p, 'phoenixgang', 'questlist:blackarmgang', [1, 2, 3, 4, 8, 9, 10]);

    console.log('SHIELD OF ARRAV - the Black Arm Gang');
    const b = player('arrav2', 3209, 3390);
    talk(b, 'tramppg', ['anything down this alleyway', 'let me join']);
    check('Charlie the tramp: stage 1', V(b, 'blackarmgang'), 1);
    talk(b, 'katrine', ["heard you're the Black Arm Gang", 'tramp outside', 'become a member', 'give me a try', 'no problem']);
    check('Katrine wants the crossbows: stage 2', V(b, 'blackarmgang'), 2);
    H.give(b, 'phoenix_crossbow', 2);
    talk(b, 'katrine');
    check('two crossbows: joined, stage 3', V(b, 'blackarmgang'), 3);
    b.teleport(3186, 3388, 0);
    H.tick(2);
    op(b, 3185, 3388, 'blackarmdoor', 1);
    check('the hideout door opens for a member', b.x <= 3185, true);
    b.teleport(3189, 3386, 1);
    H.tick(2);
    op(b, 3189, 3385, 'blackarmcupboardshut', 1);
    op(b, 3189, 3385, 'blackarmcupboardopen', 2);
    check('the other half', H.invCount(b, 'arravshield2'), 1);
    talk(b, 'curator');
    b.teleport(3223, 3476, 0);
    H.tick(2);
    useOnNpc(b, 'king_roald', 'arravcertificate');
    H.tick(3);
    drive(b);
    check('King Roald: complete', V(b, 'blackarmgang'), 4);
    journalStages(b, 'blackarmgang', 'questlist:blackarmgang', [0, 1, 2, 3, 4]);
}

// ============================================================================ Hero's Quest
if (run('hero')) {
    console.log("HERO'S QUEST - a Phoenix player and a Black Arm player, as the quest is built");
    const p = player('heroph', 2904, 3511);
    const b = player('herobk', 2904, 3512);
    for (const q of [p, b]) {
        // the requirements, set to their completes
        H.setVar(q, 'zanaris', 6);
        H.setVar(q, 'dragonquest', 10);
        H.setVar(q, 'arthur', 7);
        H.setVar(q, 'qp', 60);
        H.setVar(q, 'druidquest', 4); // Druidic Ritual, for the blamish oil
    }
    H.setVar(p, 'phoenixgang', 10);
    H.setVar(b, 'blackarmgang', 4);
    talk(p, 'achietties', ["I'm a hero", "start looking"]);
    check('Achietties starts it for a Phoenix member', V(p, 'heroquest'), 1);
    talk(b, 'achietties', ["I'm a hero", "start looking"]);
    check('and for a Black Arm member', V(b, 'heroquest'), 1);

    // the feather: ice gloves, the Entrana firebird
    H.equip(p, { hands: 'ice_gloves', rhand: 'rune_scimitar' });
    const bird = findNpc('fire_bird', p);
    check('the firebird dies to a real fight', fight(p, bird), true);
    check('the hot feather picked up in ice gloves', take(p, 'hot_feather', 3), true);
    // the eel: Gerrant's slime, blamish oil, the oily rod, the lava in Taverley dungeon
    talk(p, 'gerrant', ['lava eel']);
    check("Gerrant's snail slime", H.invCount(p, 'blamish_snail_slime'), 1);
    H.give(p, 'harralandervial');
    useHeld(p, 'blamish_snail_slime', 'harralandervial');
    check('blamish oil', H.invCount(p, 'blamish_oil'), 1);
    H.give(p, 'fishing_rod');
    useHeld(p, 'blamish_oil', 'fishing_rod');
    check('an oily fishing rod', H.invCount(p, 'oily_fishing_rod'), 1);
    H.give(p, 'fishing_bait', 50);
    const spot = findNpc('0_45_152_lavafish', { x: 2889, z: 9766, level: 0 } as any);
    p.teleport(spot.x, spot.z + 1, 0);
    H.tick(2);
    H.opNpc(p, spot, 1);
    for (let t = 0; t < 200 && H.invCount(p, 'raw_lava_eel') === 0; t++) H.tick(1);
    check('a raw lava eel from the Taverley lava', H.invCount(p, 'raw_lava_eel') > 0, true);
    p.teleport(3230, 3197, 0);
    H.tick(2);
    useOn(p, 3230, 3196, 'range', 'raw_lava_eel');
    check('cooked', H.invCount(p, 'lava_eel') > 0, true);

    // the Phoenix side: Straven, Alfonse, Charlie, Grip
    p.teleport(3246, 9782, 0);
    H.tick(2);
    talk(p, 'straven');
    check('Straven: stage 2', V(p, 'heroquest'), 2);
    talk(p, 'alfonse_the_waiter', ['Gherkins']);
    check('Alfonse: stage 3', V(p, 'heroquest'), 3);
    p.teleport(2788, 3188, 0);
    H.tick(2);
    op(p, 2788, 3189, 'herokitchendoor', 1);
    check('the kitchen door opens for a Phoenix member', p.z >= 3189, true);
    talk(p, 'charlie_the_cook', ['fellow member', 'candlesticks']);
    check('Charlie: stage 4', V(p, 'heroquest'), 4);
    op(p, 2787, 3190, 'herokitchenpanel', 1);
    check('through the kitchen panel into the mansion', p.x < 2787, true);

    // the Black Arm side: Katrine, Grubor, Trobert, Garv, Grip
    b.teleport(3186, 3385, 0);
    H.tick(2);
    talk(b, 'katrine', ['rank of master thief']);
    check('Katrine: stage 7', V(b, 'heroquest'), 7);
    b.teleport(2811, 3169, 0);
    H.tick(2);
    op(b, 2811, 3170, 'grubordoor', 1, ['Four leaved clover']);
    check("Grubor's password: stage 8", V(b, 'heroquest'), 8);
    op(b, 2811, 3170, 'grubordoor', 1);
    talk(b, 'trobert', ['candlesticks', 'volunteer']);
    check('Trobert: ID papers, stage 9', [V(b, 'heroquest'), H.invCount(b, 'id_papers')], [9, 1]);
    H.equip(b, { legs: 'black_platelegs', torso: 'black_platebody', hat: 'black_full_helm' });
    b.teleport(2774, 3185, 0);
    H.tick(2);
    op(b, 2774, 3187, 'garvdoor', 1);
    op(b, 2774, 3187, 'garvdoor', 1);
    check('Garv lets the black-armoured guard in: stage 10', [V(b, 'heroquest'), b.z >= 3187], [10, true]);
    talk(b, 'grip', ['duties', 'Anything I can do now']);
    check('Grip takes the papers and hands over the side-door key', [V(b, 'heroquest'), H.invCount(b, 'misc_key')], [11, 1]);

    // the Phoenix member kills Grip for his keys, and hands them over
    const grip = findNpc('grip', p);
    p.teleport(grip.x + 1, grip.z, 0);
    H.tick(1);
    check('Grip dies to the Phoenix member', fight(p, grip), true);
    check('  stage 5', V(p, 'heroquest'), 5);
    check("  Grip's keys", take(p, 'grip_keys', 3), true);
    p.invDel(InvType.INV, ObjType.getId('grip_keys'), 1);
    H.give(b, 'grip_keys');
    b.teleport(2763, 3197, 0);
    H.tick(2);
    useOn(b, 2764, 3197, 'pete_treasuredoor', 'grip_keys');
    check('the treasure room door', b.x >= 2764, true);
    op(b, 2766, 3199, 'shutcandlechest', 1);
    op(b, 2766, 3199, 'opencandlechest', 1);
    check('two candlesticks: stage 12', [V(b, 'heroquest'), H.invCount(b, 'petecandlestick')], [12, 2]);
    b.invDel(InvType.INV, ObjType.getId('petecandlestick'), 1);
    H.give(p, 'petecandlestick');

    // the armbands
    p.teleport(3246, 9782, 0);
    H.tick(2);
    talk(p, 'straven');
    check("Straven's armband for the Phoenix member: stage 6", [V(p, 'heroquest'), H.invCount(p, 'master_thief_armband')], [6, 1]);
    b.teleport(3186, 3385, 0);
    H.tick(2);
    talk(b, 'katrine', ['candlestick']);
    check("Katrine's armband for the Black Arm member: stage 13", [V(b, 'heroquest'), H.invCount(b, 'master_thief_armband')], [13, 1]);

    const start = qp(p);
    talk(p, 'achietties');
    H.tick(3);
    drive(p);
    check('feather, eel and armband: complete, 1 quest point', [V(p, 'heroquest'), qp(p) - start], [15, 1]);
    journalStages(p, 'heroquest', 'questlist:hero', [0, 1, 2, 3, 4, 5, 6, 15]);
    journalStages(b, 'heroquest', 'questlist:hero', [7, 8, 9, 10, 11, 12, 13]);
}

// ============================================================================ Watchtower
if (run('watchtower')) {
    console.log('WATCHTOWER');
    const p = player('watch1', 2545, 3112, 2);
    H.setVar(p, 'druidquest', 4); // Druidic Ritual, for the herblore
    const start = qp(p);
    talk(p, 'watchtower_wizard', ["What's the matter", "spell doesn't work", 'Can I be of help']);
    check('the wizard: stage 1', V(p, 'itwatchtower'), 1);
    p.teleport(2544, 3133, 0);
    H.tick(2);
    op(p, 2544, 3134, 'watchtowerbushnail', 1);
    check('fingernails from the bush', H.invCount(p, 'fingernails'), 1);
    p.teleport(2545, 3112, 0);
    H.tick(1);
    op(p, 2544, 3111, 'towerladder', 1);
    op(p, 2549, 3111, 'watchladderup', 1);
    check('up the tower on its ladders', p.level, 2);
    useOnNpc(p, 'watchtower_wizard', 'fingernails', ['What do you suggest', 'So what do I do']);
    check('the evidence: stage 2', V(p, 'itwatchtower'), 2);

    // the three relic parts
    talk(p, 'og', ['seek entrance']);
    check("Og's key to Toban's chest", H.invCount(p, 'toban_key'), 1);
    p.teleport(2575, 3030, 0);
    H.tick(2);
    op(p, 2575, 3031, 'tobanchest', 1);
    check("Og's gold from Toban's chest", H.invCount(p, 'stolen_gold'), 1);
    talk(p, 'og');
    check("Og's relic part", H.invCount(p, 'relicpart1'), 1);
    talk(p, 'grew', ["Don't eat me"]);
    const gorad = findNpc('gorad', p);
    check('Gorad can be fought', gorad.levels[3] > 1, true);
    check('  and dies', fight(p, gorad), true);
    check("  Gorad's tooth", H.invCount(p, 'ogretooth'), 1);
    talk(p, 'grew');
    check("Grew's relic part and the first crystal", [H.invCount(p, 'relicpart2'), H.invCount(p, 'powering_crystal1')], [1, 1]);
    talk(p, 'toban', ['seek entrance', 'do something for you']);
    H.give(p, 'dragon_bones');
    talk(p, 'toban');
    check("Toban's relic part", H.invCount(p, 'relicpart3'), 1);
    for (const r of ['relicpart1', 'relicpart2', 'relicpart3']) {
        p.teleport(2545, 3112, 2);
        H.tick(1);
        useOnNpc(p, 'watchtower_wizard', r);
    }
    check('the wizard mends the relic: stage 3', [V(p, 'itwatchtower'), H.invCount(p, 'ogrerelic')], [3, 1]);

    // into Gu'Tanoth
    p.teleport(2503, 3062, 0);
    H.tick(2);
    talk(p, 'ogre_guard2');
    useOnNpc(p, 'ogre_guard2', 'ogrerelic');
    check('the relic gets you past the guard: stage 4', V(p, 'itwatchtower'), 4);
    check('inside the city on a walkable tile', walkable(0, p.x, p.z), true);
    talk(p, 'city_guard', ['passage into the skavid caves']);
    check("the city guard's riddle: stage 5", V(p, 'itwatchtower'), 5);
    H.give(p, 'deathrune');
    useOnNpc(p, 'city_guard', 'deathrune');
    check('a death rune: the skavid map, stage 6', [V(p, 'itwatchtower'), H.invCount(p, 'skavidmap')], [6, 1]);

    // the skavid caves
    H.give(p, 'lit_candle');
    p.teleport(2527, 3012, 0);
    H.tick(2);
    op(p, 2527, 3011, 'skavid_cave6', 1);
    check('into the skavid caves with the map and a light', [p.z > 9000, walkable(0, p.x, p.z)], [true, true]);
    talk(p, 'scared_skavid', ['Okay, okay']);
    for (const [s, w] of [['skavidtalker1', 'Ig'], ['skavidtalker2', 'Ar'], ['skavidtalker3', 'Cur'], ['skavidtalker4', 'Nod']] as [string, string][]) talk(p, s, [w]);
    check('the four skavid words', [13, 14, 15, 16].map(b => (V(p, 'itwatchtower_bits') >> b) & 1), [1, 1, 1, 1]);
    // it says one of three phrases at random; each has one right reply, so try the replies in turn
    for (let i = 0; i < 20 && V(p, 'itwatchtower') < 7; i++) talk(p, 'mad_skavid', [(i % 5) + 1]);
    check('the mad skavid gives the second crystal: stage 7', [V(p, 'itwatchtower'), H.invCount(p, 'powering_crystal2')], [7, 1]);

    // the enclave, the potion, the shamans
    H.give(p, 'nightshade');
    p.teleport(2508, 3038, 0);
    H.tick(2);
    useOnNpc(p, 'enclave_guard', 'nightshade');
    check('nightshade for the enclave guard: stage 8, in the shaman cave', [V(p, 'itwatchtower'), p.z > 9000, walkable(0, p.x, p.z)], [8, true, true]);
    op(p, 2598, 9468, 'enclavecave', 1);
    p.teleport(2545, 3112, 2);
    H.tick(2);
    talk(p, 'watchtower_wizard', []);
    check('the wizard teaches the potion: stage 9', V(p, 'itwatchtower'), 9);
    for (const o of ['vial_water', 'jangerberries', 'guam_leaf', 'ground_bat_bones']) H.give(p, o);
    useHeld(p, 'guam_leaf', 'vial_water');
    useHeld(p, 'jangerberries', 'guamvial');
    useHeld(p, 'ground_bat_bones', 'guamjangervial');
    check('the ogre potion brewed', H.invCount(p, 'ogre_potion'), 1);
    useOnNpc(p, 'watchtower_wizard', 'ogre_potion');
    check('the wizard enchants it: stage 10', [V(p, 'itwatchtower'), H.invCount(p, 'magic_ogre_potion')], [10, 1]);
    p.teleport(2508, 3038, 0);
    H.tick(2);
    H.give(p, 'nightshade');
    useOnNpc(p, 'enclave_guard', 'nightshade');
    let shamans = 0;
    for (let i = 0; i < 6; i++) {
        let s: any = null;
        for (let t = 0; t < 200 && !s; t++) { s = H.npcNear('ogre_shaman', p.x, p.z, 0); if (!s) H.tick(1); }
        if (!s) break;
        p.teleport(s.x + 1, s.z, 0);
        H.tick(1);
        useOnNpc(p, 'ogre_shaman', 'magic_ogre_potion');
        shamans = (V(p, 'itwatchtower_bits') >> 17) & 7;
    }
    check('six shamans dissolved, the third crystal', [shamans, H.invCount(p, 'powering_crystal3')], [6, 1]);
    H.give(p, 'rune_pickaxe');
    p.teleport(2590, 9450, 0);
    H.tick(2);
    op(p, 2590, 9449, 'rock_of_dalgroth', 2);
    check('the fourth crystal from the Rock of Dalgroth', H.invCount(p, 'powering_crystal4'), 1);
    op(p, 2598, 9468, 'enclavecave', 1);
    check('out of the enclave, a walkable tile', [p.z < 4000, walkable(0, p.x, p.z)], [true, true]);

    p.teleport(2545, 3112, 2);
    H.tick(2);
    talk(p, 'watchtower_wizard', []);
    check('four crystals: stage 11', V(p, 'itwatchtower'), 11);
    op(p, 2543, 3115, 'watchleverup', 1);
    H.tick(6);
    drive(p);
    check('the lever: complete, 4 quest points, the spell scroll', [V(p, 'itwatchtower'), qp(p) - start, H.invCount(p, 'watchtowerspell')], [13, 4, 1]);
    check('landed on a walkable tile', walkable(p.level, p.x, p.z), true);
    journalStages(p, 'itwatchtower', 'questlist:itwatchtower', [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 14]);
}

// ============================================================================ Marim's gate (for RFD's King Awowogei)
if (run('marim')) {
    console.log("MARIM'S GATE - the way to the three wise monkeys");
    const p = player('marim1', 2802, 2705);
    check('the village is walled off from the Ape Atoll landing', connected(0, 2802, 2705, 2788, 2794, 200), false);
    p.teleport(2720, 2764, 0);
    H.tick(2);
    // Monkey Madness's gate (mm_stage3.rs2) lets anyone through - you arrive a human and have to reach
    // Garkor before you have a greegree; the elder guards at the palace are what stop a human.
    op(p, 2719, 2766, 'mm_bamboo_largedoor', 1);
    check('through the gate', [p.z > 2766, walkable(0, p.x, p.z)], [true, true]);
    check('  and on to the three wise monkeys and the banana tree', [connected(0, p.x, p.z, 2788, 2794, 200), connected(0, p.x, p.z, 2697, 2784, 200)], [true, true]);
    op(p, 2721, 2766, 'mm_bamboo_largedoor_left', 1);
    check('  and back out', p.z < 2766, true);
}

// ==== END
console.log(`\n${R.ok} ok, ${R.bad} FAIL`);
process.exit(R.bad ? 1 : 0);
