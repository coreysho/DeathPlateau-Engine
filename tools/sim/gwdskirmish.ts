// The God Wars free-for-all: the four armies fighting each other, and the crowd that does it.
//
// There is no npc-versus-npc combat system in this build - skill_combat is a monster hitting a
// player from end to end - so the skirmish is driven off each follower's timer and lands its damage
// through npc_huntall plus ~npc_default_damage, the one route that already exists for it
// (Commander Montai's catapult). That makes two things worth pinning: that an enemy actually takes
// damage, and that NOBODY ELSE DOES - not a follower of the same god, and not the player.
//
// The second half is the chamber itself. Twenty npcs were added to the main room on 2026-10-05 and
// every one of them is a line in a map file: a spawn on a blocked tile, or a size-2 npc with one
// square inside a pillar, is silently dropped by the engine and the room is just emptier than the
// file says. So the spawns are read back out of the running world, not out of the jm2.
//
//   npx tsx tools/sim/gwdskirmish.ts
import * as H from './harness.ts';
import * as A from './a1lib.ts';
import { check, R, player, World, NpcType } from './a1lib.ts';
import ParamType from '#/cache/config/ParamType.js';
import VarPlayerType from '#/cache/config/VarPlayerType.js';
import CategoryType from '#/cache/config/CategoryType.js';
import SeqType from '#/cache/config/SeqType.js';
import { NpcStat } from '#/engine/entity/NpcStat.js';
import { isFlagged } from '#/engine/GameMap.js';
import { CollisionFlag } from '#/engine/routefinder/index.js';

await H.boot();

const god = (n: string | number) =>
    (NpcType.get(typeof n === 'number' ? n : NpcType.getId(n)) as any).params?.get(ParamType.getId('gwd_god')) ?? null;
const CHAMBER = { x: 2890, z: 5295, level: 2 };

// ---------------------------------------------------------------- the armies are tagged
console.log('EVERY FOLLOWER KNOWS WHICH GOD IT IS');
{
    const four = new Set<number>();
    let tagged = 0, untagged: string[] = [];
    for (let i = 0; i < NpcType.count; i++) {
        const t = NpcType.get(i) as any;
        if (!t?.debugname?.startsWith('gwd_spiritual_') && !t?.debugname?.startsWith('gwd_aviansie')) continue;
        const g = god(t.debugname);
        if (g === null || g === 0) untagged.push(t.debugname); else { tagged++; four.add(g); }
    }
    check('  every spiritual and aviansie carries a god', untagged.length ? untagged.join(' ') : 'yes', 'yes');
    check(`  and all four are represented across ${tagged} of them`, four.size, 4);
}

// ---------------------------------------------------------------- and so does the rank and file
// The twenty-one in configs/gwd_army.npc and configs/gwd_rabble.npc. Four things make one of these
// work and all four are easy to leave out of a config: the god (which decides who it fights and
// which killcount it pays), real combat stats (the cache this art came from carries none, so a
// default entry is a punchbag), the timer (without it [ai_timer] never fires and it just stands
// there), and the category the trigger is hung on.
console.log('\nTHE REST OF THE ARMIES ARE WIRED UP');
{
    const ARMY = CategoryType.getId('gwd_army');
    const members: string[] = [];
    for (let i = 0; i < NpcType.count; i++) {
        const t = NpcType.get(i) as any;
        if (t?.category === ARMY) members.push(t.debugname);
    }
    check(`  the category has members (${members.length})`, members.length >= 20, true);
    const faults: string[] = [];
    for (const n of members) {
        const t = NpcType.get(NpcType.getId(n)) as any;
        const g = god(n);
        if (g === null || g === 0) faults.push(`${n}: no god`);
        if ((t.stats?.[NpcStat.HITPOINTS] ?? 1) <= 1) faults.push(`${n}: no stats`);
        if (!t.timer) faults.push(`${n}: no timer`);
        if (!t.models?.length) faults.push(`${n}: no models`);
        if (t.readyanim === undefined || t.readyanim < 0) faults.push(`${n}: no readyanim`);
        if (t.walkanim === undefined || t.walkanim < 0) faults.push(`${n}: no walkanim`);
        if (t.huntmode === undefined || t.huntmode < 0) faults.push(`${n}: no huntmode`);
        // The three combat anims. A missing one is not a crash - npc_combat falls back to the
        // human default - and a human swing on an ork reads as a bug in the model, not the config.
        for (const p of ['attack_anim', 'defend_anim', 'death_anim']) {
            const s = t.params?.get(ParamType.getId(p));
            if (s === undefined || s === null) faults.push(`${n}: no ${p}`);
            else if (!SeqType.get(s)?.frames?.length) faults.push(`${n}: ${p} has no frames`);
        }
    }
    for (const f of faults) console.log('    ' + f);
    check('  every one has a god, stats, a timer, art and three combat anims', faults.length, 0);
    const gods = new Set(members.map(god));
    check('  and three gods field them (Armadyl fields aviansies)', gods.size, 3);
}

// ---------------------------------------------------------------- the chamber is full
// Read off the running world: a spawn the engine refused is a spawn that is not here.
console.log('\nTHE MAIN CHAMBER IS POPULATED');
{
    // World.npcs is an EntityList - an Array subclass whose iterator walks its own id table -
    // so filter()/map() on it return lists that iterate as empty. Walk it into a plain array.
    const inChamber: any[] = [];
    for (const n of World.npcs) {
        if (n && n.level === 2 && n.x >= 2880 && n.x < 2913 && n.z >= 5280 && n.z < 5312) inChamber.push(n);
    }
    const names = inChamber.map(n => NpcType.get(n.type).debugname ?? String(n.type));
    const distinct = new Set(names);
    console.log(`  ${inChamber.length} npcs, ${distinct.size} kinds`);
    // 50, not 60. The number used to be ours to choose; the spawns are Old School's own
    // coordinates now, so what this box holds is what Old School puts in it - 58 - and the
    // check is back to asking the question it was written for: a crowd, not a handful.
    check('  the room holds a crowd', inChamber.length >= 50, true);
    check('  of many kinds, not six spirituals repeated', distinct.size >= 20, true);
    // All four armies present in the one room, which is what makes it a free-for-all rather than
    // four separate guard posts.
    const byGod = new Set(inChamber.map(n => god(n.type)).filter(g => g !== null && g !== 0));
    check('  with all four gods represented', byGod.size, 4);

    // NOT ON TOP OF EACH OTHER, and not inside a wall. Both are things the engine tolerates
    // quietly: two npcs on one tile look like one npc, and a blocked spawn is just absent.
    // SPAWN positions, not live ones. These npcs roam, and this runs after the free-for-all has
    // been ticking, so by now they have walked about - and an npc standing on a tile makes that
    // tile WALK_BLOCKED, so a roamed npc flags itself. With the room this full that turned the
    // check flaky: three runs in five. What it is for is the MAP DATA - that no two spawns were
    // written onto one square and none into a wall - so it asks where they started.
    const seen = new Map<string, string>();
    const clashes: string[] = [];
    for (const n of inChamber) {
        const t = NpcType.get(n.type);
        for (let dx = 0; dx < (t.size || 1); dx++) for (let dz = 0; dz < (t.size || 1); dz++) {
            const k = `${n.startX + dx},${n.startZ + dz}`;
            if (seen.has(k)) clashes.push(`${t.debugname} on ${seen.get(k)} at ${k}`);
            else seen.set(k, t.debugname ?? '?');
            if (isFlagged(n.startX + dx, n.startZ + dz, 2, CollisionFlag.WALK_BLOCKED)) clashes.push(`${t.debugname} blocked at ${k}`);
        }
    }
    for (const c of clashes.slice(0, 10)) console.log('    ' + c);
    check('  nobody shares a square or stands in a wall', clashes.length, 0);

    // AND THE TILE YOU ARRIVE ON IS CLEAR. ^gwd_entrance_inside is where the hole drops you, and
    // a follower standing on it would put a player inside an npc on the way in.
    const arrival = { x: 2880, z: 5310 };
    const onTop = inChamber.filter(n => Math.abs(n.x - arrival.x) <= 1 && Math.abs(n.z - arrival.z) <= 1);
    check('  and the tile the hole drops you on is empty', onTop.length, 0);
}

// ---------------------------------------------------------------- a swing hurts the enemy
console.log('\nA SWING LANDS ON THE OTHER GOD');
{
    const attacker = H.addNpcAt('gwd_spiritual_warrior_zamorak', CHAMBER.x, CHAMBER.z, CHAMBER.level);
    const enemy = H.addNpcAt('gwd_spiritual_warrior_saradomin', CHAMBER.x + 1, CHAMBER.z, CHAMBER.level);
    const ally = H.addNpcAt('gwd_spiritual_ranger_zamorak', CHAMBER.x, CHAMBER.z + 1, CHAMBER.level);
    H.tick(1);
    const hp = (n: any) => n.levels[3];
    const e0 = hp(enemy), a0 = hp(ally);

    // the label directly, so the roll that gates it cannot make this flaky
    for (let i = 0; i < 40; i++) H.runNpcProc(attacker, '[label,gwd_skirmish]');
    check('  the enemy takes damage', hp(enemy) < e0, true);
    check('  and its own god does not', hp(ally), a0);
    check('  nor does the attacker', hp(attacker), attacker.baseLevels[3]);
}

// ---------------------------------------------------------------- the new armies swing too
// Same test on an ork and a knight: these are the npcs the trigger was extended to, and a category
// that is not on the trigger list is a follower that stands and watches.
console.log('\nSO DO THE ORKS AND THE KNIGHTS');
{
    const ork = H.addNpcAt('gwd_ork_1', CHAMBER.x + 8, CHAMBER.z, CHAMBER.level);
    const knight = H.addNpcAt('gwd_saradomin_knight_1', CHAMBER.x + 9, CHAMBER.z, CHAMBER.level);
    H.tick(1);
    const k0 = knight.levels[3], o0 = ork.levels[3];
    for (let i = 0; i < 40; i++) H.runNpcProc(ork, '[label,gwd_skirmish]');
    check('  a Bandos ork hurts a Saradomin knight', knight.levels[3] < k0, true);
    for (let i = 0; i < 40; i++) H.runNpcProc(knight, '[label,gwd_skirmish]');
    check('  and the knight hits back', ork.levels[3] < o0, true);
}

// ---------------------------------------------------------------- and never the player
console.log('\nAND NEVER THE PLAYER STANDING IN IT');
{
    const p: any = player('gwdwar', CHAMBER.x + 1, CHAMBER.z + 1, CHAMBER.level);
    H.maxOut(p);
    const before = p.levels[3];
    const n = H.addNpcAt('gwd_spiritual_mage_bandos', CHAMBER.x + 1, CHAMBER.z + 1, CHAMBER.level);
    H.tick(1);
    for (let i = 0; i < 40; i++) H.runNpcProc(n, '[label,gwd_skirmish]');
    check('  the player is untouched by the free-for-all', p.levels[3], before);
    H.despawn(p);
}

// ---------------------------------------------------------------- a follower killed by a follower pays nothing
console.log('\nNOBODY IS CREDITED FOR A SKIRMISH KILL');
{
    const p: any = player('gwdkc2', 3200, 3200);
    const kc = () => p.getVar(VarPlayerType.getByName('gwd_kc_saradomin')!.id);
    const before = kc();
    const attacker = H.addNpcAt('gwd_spiritual_warrior_zamorak', CHAMBER.x + 4, CHAMBER.z + 4, CHAMBER.level);
    const victim = H.addNpcAt('gwd_spiritual_mage_saradomin', CHAMBER.x + 5, CHAMBER.z + 4, CHAMBER.level);
    H.tick(1);
    for (let i = 0; i < 400 && victim.levels[3] > 0; i++) H.runNpcProc(attacker, '[label,gwd_skirmish]');
    check('  the victim can be killed by it', victim.levels[3], 0);
    // every drop table and the killcount open with "if (npc_findhero = ^false) return", and a
    // follower killed by a follower has no hero - so neither moves.
    check('  and no killcount is paid for it', kc(), before);
    H.despawn(p);
}

console.log(`\n${R.ok} ok, ${R.bad} FAIL`);
process.exit(R.bad ? 1 : 0);
