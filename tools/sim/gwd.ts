// God Wars Dungeon, as far as it has been built. Run after any GWD map or spawn change:
//
//   npx tsx tools/sim/gwd.ts
//
// The dungeon comes from TWO caches and that is the thing most worth testing. Three of its four map
// squares are rev 474 (October 2007, the dungeon as it was built); m45_82 - the one holding the rope
// you arrive on and Commander Zilyana's room - has no XTEA key in any published set, so its locs
// cannot be read from 474 and it comes from the OSRS cache instead. Two sources meeting inside one
// dungeon is a seam, and a seam you cannot walk through is a dungeon nobody can finish.
import * as H from './harness.ts';
import * as A from './a1lib.ts';
import VarPlayerType from '#/cache/config/VarPlayerType.js';
import HuntType from '#/cache/config/HuntType.js';
import ParamType from '#/cache/config/ParamType.js';
import SeqType from '#/cache/config/SeqType.js';
import { NpcStat } from '#/engine/entity/NpcStat.js';
import { PlayerStat } from '#/engine/entity/PlayerStat.js';
import { World, LocType, NpcType, check, R, player, Player } from './a1lib.ts';
import { CollisionFlag, CollisionType } from '#/engine/routefinder/index.js';
import { isFlagged, canTravel } from '#/engine/GameMap.js';

await H.boot();

// Every anchor below was READ OUT OF THE BUILT MAP, not remembered. Three earlier versions of this
// file guessed the room coordinates off a wiki page and were wrong about every one of them - by
// 15-20 tiles, and about which level the dungeon sits on.
const ROOMS: [string, number, number, number, string][] = [
    ["Kree'arra (Armadyl)", 2821, 5301, 2, '44_82 (474)'],
    ['General Graardor (Bandos)', 2869, 5370, 2, '44_83 (474)'],
    ["K'ril Tsutsaroth (Zamorak)", 2937, 5323, 2, '45_83 (474)'],
    ['Commander Zilyana (Saradomin)', 2885, 5267, 0, '45_82 (OSRS)'],
];

// The four faction doors, and the rope you arrive on.
const LANDING: [number, number, number] = [2881, 5311, 2];
const DOORS: [string, number, number, number][] = [
    ['Armadyl', 2839, 5295, 2],
    ['Bandos', 2863, 5354, 2],
    ['Zamorak', 2925, 5332, 2],
    ['Saradomin', 2908, 5265, 0],
];

// isFlagged is (x, z, level, masks) - NOT (level, x, z, masks). The wrong way round it reads a tile
// nobody asked about and answers "open" everywhere, which reported this dungeon as having no walls
// in it. A control run said the same of Lumbridge castle, which is what gave it away.
function around(x: number, z: number, lvl: number, r = 12) {
    let open = 0, blocked = 0;
    for (let dx = -r; dx <= r; dx++)
        for (let dz = -r; dz <= r; dz++)
            isFlagged(x + dx, z + dz, lvl, CollisionFlag.WALK_BLOCKED) ? blocked++ : open++;
    return { open, blocked };
}

console.log('THE ROOMS');
for (const [name, x, z, lvl, src] of ROOMS) {
    const a = around(x, z, lvl);
    // A room is a chamber cut out of rock: floor to stand on AND rock around it. Space that never
    // loaded reads as floor everywhere and no rock at all, so the walled count is what separates
    // "built" from "not there" - counting open tiles alone passes for a square that is missing.
    check(`  ${name.padEnd(30)} ${src.padEnd(14)} (${a.open} open, ${a.blocked} walled)`,
        a.blocked > 100 && a.open > 100, true);
}

// ---------------------------------------------------------------- the seam
// The rope landing is in the OSRS square. The Armadyl and Bandos doors are in 474 squares. If you
// can walk from the one to the others then the two caches' halves of the dungeon actually join up.
// A rope and a door BLOCK the tile they stand on - you stand beside them, not in them - so both
// ends of each walk are the nearest tile you could actually be standing on.
function nearestOpen(x: number, z: number, lvl: number, r = 4): [number, number] | null {
    for (let d = 0; d <= r; d++)
        for (let dx = -d; dx <= d; dx++)
            for (let dz = -d; dz <= d; dz++) {
                if (Math.max(Math.abs(dx), Math.abs(dz)) !== d) continue;
                if (!isFlagged(x + dx, z + dz, lvl, CollisionFlag.WALK_BLOCKED)) return [x + dx, z + dz];
            }
    return null;
}
// You walk UP TO a faction door, never through it - the room behind it is sealed, which is the
// whole thing killcount exists to open. So the question is whether any tile beside the door can be
// reached, not whether the room can.
function canReachDoor(fx: number, fz: number, lvl: number, x: number, z: number) {
    for (let dx = -1; dx <= 1; dx++)
        for (let dz = -1; dz <= 1; dz++) {
            if (isFlagged(x + dx, z + dz, lvl, CollisionFlag.WALK_BLOCKED)) continue;
            if (connected(lvl, fx, fz, x + dx, z + dz, 220)) return true;
        }
    return false;
}

// THE SEAM, asked directly. Walking from the rope to a boss door is the wrong question - the route
// runs through doors that block until you open them, so a flat flood says "no" for reasons that
// have nothing to do with the map being sound. What matters is whether the OSRS square and the 474
// squares JOIN: how many tiles you can step across each cache boundary, in each direction.
console.log('\nTHE SEAM BETWEEN THE TWO CACHES');
const [lx, lz, llvl] = LANDING;
check(`  there is standable floor beside the rope at (${lx},${lz})`, nearestOpen(lx, lz, llvl) !== null, true);
for (const lvl of [0, 1, 2, 3]) {
    let we = 0, ew = 0, ns = 0, sn = 0;
    for (let z = 5248; z < 5376; z++) {
        if (canTravel(lvl, 2879, z, 1, 0, 1, 0, CollisionType.NORMAL)) we++;
        if (canTravel(lvl, 2880, z, -1, 0, 1, 0, CollisionType.NORMAL)) ew++;
    }
    for (let x = 2816; x < 2944; x++) {
        if (canTravel(lvl, x, 5311, 0, 1, 1, 0, CollisionType.NORMAL)) ns++;
        if (canTravel(lvl, x, 5312, 0, -1, 1, 0, CollisionType.NORMAL)) sn++;
    }
    console.log(`  level ${lvl}: x=2880 ${we} west-east / ${ew} east-west;  z=5312 ${ns} south-north / ${sn} north-south`);
    // Level 2 is the floor the rope lands on and the one three of the four boss doors sit on. If
    // that seam is shut the dungeon is in two halves and nobody reaches Armadyl or Bandos.
    if (lvl === 2) check('  the dungeon floor crosses both cache boundaries', we > 10 && ew > 10 && ns > 10 && sn > 10, true);
}

// ---------------------------------------------------------------- what is clickable
// Everything in the dungeon a player can click, which is the list the killcount and door stages
// work from. The 474 half is named; the OSRS half is still osrsloc_<id> and wants naming.
console.log('\nWHAT A PLAYER CAN CLICK');
const seen = new Map<string, { ops: string[]; name: string; n: number; where: string }>();
for (const reg of ['44_82', '44_83', '45_82', '45_83']) {
    const [mx, mz] = reg.split('_').map(Number);
    for (let lvl = 0; lvl < 4; lvl++)
        for (let x = mx << 6; x < (mx << 6) + 64; x++)
            for (let z = mz << 6; z < (mz << 6) + 64; z++)
                for (const loc of World.gameMap.getZone(x, z, lvl).getAllLocsUnsafe()) {
                    if (loc.x !== x || loc.z !== z || loc.level !== lvl) continue;
                    const t = LocType.get(loc.type);
                    const ops = (t.op ?? []).filter(Boolean) as string[];
                    if (!ops.length) continue;
                    const e = seen.get(t.debugname);
                    if (e) e.n++;
                    else seen.set(t.debugname, { ops, name: t.name ?? '', n: 1, where: `${lvl}_${mx}_${mz}_${x & 63}_${z & 63}` });
                }
}
for (const [dbg, e] of [...seen].sort((a, b) => a[0].localeCompare(b[0])))
    console.log(`  ${dbg.padEnd(22)} "${e.name}" [${e.ops.join('/')}] x${e.n} first at ${e.where}`);
check('  all four faction altars are in', [...seen].filter(([, e]) => e.ops.includes('Pray-at') || e.ops.includes('Pray')).length, 4);
check('  all four faction doors are in', [...seen].filter(([, e]) => e.name === 'Big door' && e.ops.includes('Open')).length, 4);

// ---------------------------------------------------------------- the cast
// Everyone in the dungeon who is not one of the four bosses: twelve bodyguards, each god's
// warrior/ranger/mage, and the fifteen Aviansies. Imported from rev 474 as one batch so that a
// model worn by several of them is copied once.
console.log('\nTHE CAST');
const BODYGUARDS: Record<string, string[]> = {
    Bandos: ['gwd_strongstack', 'gwd_steelwill', 'gwd_grimspike'],
    Zamorak: ['gwd_tstanon_karlak', 'gwd_zakln_gritch', 'gwd_balfrug_kreeyath'],
    Armadyl: ['gwd_wingman_skree', 'gwd_flockleader_geerin', 'gwd_flight_kilisa'],
    Saradomin: ['gwd_starlight', 'gwd_growler', 'gwd_bree'],
};
const GODS = ['bandos', 'zamorak', 'armadyl', 'saradomin'];
const ARMY = GODS.flatMap(g => ['warrior', 'ranger', 'mage'].map(k => `gwd_spiritual_${k}_${g}`));
const AVIANSIES = Array.from({ length: 15 }, (_, i) => `gwd_aviansie_${i + 1}`);
const BOSSES = ['graardor', 'kril', 'zilyana', 'kreearra'];

function npcOk(name: string) {
    const id = NpcType.getId(name);
    if (id < 0) return `missing`;
    const t = NpcType.get(id);
    if (!t.models?.length) return 'no models';
    // A ready or walk seq that did not convert leaves the npc frozen or sliding, which is the
    // failure the 474 import is most likely to produce and the hardest to see in a screenshot.
    if (t.readyanim === undefined || t.readyanim < 0) return 'no readyanim';
    if (t.walkanim === undefined || t.walkanim < 0) return 'no walkanim';
    return null;
}
const broken: string[] = [];
for (const [god, three] of Object.entries(BODYGUARDS)) {
    const bad = three.map(n => [n, npcOk(n)] as const).filter(([, e]) => e);
    check(`  ${god.padEnd(10)} bodyguards (${three.length})`, bad.length, 0);
    broken.push(...bad.map(([n, e]) => `${n}: ${e}`));
}
for (const list of [['the four armies', ARMY], ['the Aviansies', AVIANSIES], ['the four bosses', BOSSES]] as const) {
    const bad = (list[1] as string[]).map(n => [n, npcOk(n)] as const).filter(([, e]) => e);
    check(`  ${String(list[0]).padEnd(20)} (${(list[1] as string[]).length})`, bad.length, 0);
    broken.push(...bad.map(([n, e]) => `${n}: ${e}`));
}
for (const b of broken) console.log('    ' + b);
check('  nobody in the dungeon is missing models or animations', broken.length, 0);

// ---------------------------------------------------------------- the spawns
console.log('\nWHO IS STANDING IN THE ROOMS');
const SPAWNED: [string, string[]][] = [
    ['Armadyl', ['kreearra', 'gwd_wingman_skree', 'gwd_flockleader_geerin', 'gwd_flight_kilisa']],
    ['Bandos', ['graardor', 'gwd_strongstack', 'gwd_steelwill', 'gwd_grimspike']],
    ['Zamorak', ['kril', 'gwd_tstanon_karlak', 'gwd_zakln_gritch', 'gwd_balfrug_kreeyath']],
    ['Saradomin', ['zilyana', 'gwd_starlight', 'gwd_growler', 'gwd_bree']],
];
const inDungeon = (name: string) => World.npcs.filter(n => n && n.type === NpcType.getId(name)
    && n.x >= 2816 && n.x < 2944 && n.z >= 5248 && n.z < 5376).length;
for (const [god, who] of SPAWNED) {
    const missing = who.filter(n => inDungeon(n) === 0);
    check(`  ${god.padEnd(10)} boss and bodyguard are in the dungeon`, missing.join(',') || 'none', 'none');
}
// And the armies, which are what you actually grind killcount on - the bodyguards are behind the
// door you need the killcount to open, so without these there is no legitimate way in.
for (const g of ['armadyl', 'bandos', 'zamorak', 'saradomin']) {
    const n = ['warrior', 'ranger', 'mage'].reduce((s, k) => s + inDungeon(`gwd_spiritual_${k}_${g}`), 0);
    check(`  ${g.padEnd(10)} has an army outside its door (${n})`, n >= 6, true);
}
check(`  the Aviansies are in (${Array.from({ length: 15 }, (_, i) => inDungeon(`gwd_aviansie_${i + 1}`)).reduce((a, b) => a + b, 0)})`,
    Array.from({ length: 15 }, (_, i) => inDungeon(`gwd_aviansie_${i + 1}`)).reduce((a, b) => a + b, 0), 15);

// Stats, which 474 does not carry - every one of them came from the Old School cache. An npc left
// on the defaults is a punchbag, and a dungeon full of punchbags looks finished and is not.
const noStats = [...SPAWNED.flatMap(([, w]) => w),
    ...['armadyl', 'bandos', 'zamorak', 'saradomin'].flatMap(g => ['warrior', 'ranger', 'mage'].map(k => `gwd_spiritual_${k}_${g}`))]
    .filter(n => {
        // NpcType keeps the six combat numbers in .stats, not as .hitpoints - reading the latter
        // gives undefined for everyone, which is how the first version of this check reported the
        // whole dungeon statless including Graardor, who plainly is not.
        const t = NpcType.get(NpcType.getId(n));
        return (t.stats?.[NpcStat.HITPOINTS] ?? 1) <= 1;
    });
check('  everyone in the dungeon has real combat stats', noStats.join(',') || 'none', 'none');

// ---------------------------------------------------------------- killcount
console.log('\nKILLCOUNT');
{
    const p = player('gwd', 2880, 5310, 2);
    const kc = () => p.getVar(VarPlayerType.getByName('gwd_kc_bandos')!.id) as number;
    // ACTUALLY KILL ONE, rather than calling the proc with an npc nobody fought. Credit is
    // npc_findhero - the test every drop table opens with - so a victim that took no damage from
    // this player is nobody's kill and the count correctly stays put. Running the proc directly
    // was testing the early return and nothing else.
    H.setVar(p, 'gwd_kc_bandos', 0);
    H.maxOut(p);
    // Killed OUTSIDE the door, which is the only way a player could earn it: the bodyguards are in
    // the room you need the killcount to reach. Bandos's army holds the approach.
    let killed = 0;
    for (let i = 0; i < 3; i++) {
        const victim = World.npcs.find(n => n && n.isActive
            && NpcType.get(n.type).debugname?.startsWith('gwd_spiritual_') === true
            && NpcType.get(n.type).debugname?.endsWith('_bandos') === true);
        if (!victim) break;
        p.teleport(victim.x + 1, victim.z, victim.level); H.tick(1);
        if (A.fight(p, victim, 600)) killed++;
        H.tick(2); // the message is queued
    }
    check(`  killing ${killed} of Bandos's followers counts ${killed}`, kc(), killed);
    check('  and something was actually killed', killed > 0, true);

    // and nobody else's count moved - a death hook that credits the wrong god is worse than one
    // that credits nothing
    check('  the other three gods are untouched',
        ['armadyl', 'saradomin', 'zamorak'].map(g => p.getVar(VarPlayerType.getByName(`gwd_kc_${g}`)!.id)), [0, 0, 0]);

    // the door, below the price
    const door = { x: 2863, z: 5354, lvl: 2 };
    p.teleport(2862, 5354, 2); H.tick(1);
    H.setVar(p, 'gwd_kc_bandos', 39);
    const before = A.mark();
    H.opLoc(p, door.x, door.z, 'gwd_door_bandos', 1);
    H.tick(3); // clicking a door walks you to it first; the handler runs on arrival
    // What matters is that it did not let you THROUGH, and did not take the kills. Where the click
    // left you standing is the router's business - clicking a door walks you to it.
    check('  39 kills does not get you in', [p.x === 2864 && p.z === 5354, kc()], [false, 39]);
    check('  and it says how many are missing', A.said(p, before, '1 more kill'), true);

    // and at the price
    H.setVar(p, 'gwd_kc_bandos', 40);
    H.opLoc(p, door.x, door.z, 'gwd_door_bandos', 1);
    H.tick(1);
    check('  40 kills opens it, and is spent', kc(), 0);
    check('  and puts you on the room side of the door', [p.x, p.z, p.level], [2864, 5354, 2]);
    // the altar is in there with you, which is what makes it the room and not the corridor
    check('  with Graardor', World.npcs.some(n => n && n.type === NpcType.getId('graardor')
        && Math.max(Math.abs(n.x - p.x), Math.abs(n.z - p.z)) < 30), true);
    H.despawn(p);
}

// ---------------------------------------------------------------- getting in
// Walked rather than asserted from the constants: the boulder on Trollheim, the rope down, and
// back out again. Before this the dungeon could only be reached by teleport.
console.log('\nTHE WAY IN');
{
    const p = player('gwdin', 2898, 3724);
    const where = () => `${p.level}_${p.x}_${p.z}`;

    // too weak
    p.setLevel(PlayerStat.STRENGTH, 59);
    H.opLoc(p, 2898, 3720, 'gwd_boulder', 1);
    H.tick(5);
    check('  59 Strength cannot shift the boulder', p.z > 3700 && p.level === 0, true);
    check('  and it says what is needed', A.lastMes(p).includes('Strength level of 60'), true);

    // strong enough
    p.setLevel(PlayerStat.STRENGTH, 60);
    H.opLoc(p, 2898, 3720, 'gwd_boulder', 1);
    H.tick(6);
    check('  60 Strength puts you in the dungeon', [p.x, p.z, p.level], [2880, 5311, 3]);

    // down the rope to the floor the faction doors are on
    H.opLoc(p, 2881, 5311, 'gwd_rope_top', 1);
    H.tick(6);
    check('  the rope drops you onto the dungeon floor', [p.x, p.z, p.level], [2880, 5310, 2]);

    // back up, and out
    H.opLoc(p, 2881, 5311, 'gwd_rope_down', 1);
    H.tick(6);
    check('  and climbs back up', [p.x, p.z, p.level], [2880, 5311, 3]);
    H.opLoc(p, 2882, 5311, 'gwd_crack', 1);
    H.tick(12); // walk to it, then the squeeze-through delay
    check('  the crack puts you back on Trollheim', [p.x, p.z, p.level], [2898, 3724, 0]);
    void where;
    H.despawn(p);
}

// And the boulder must not wall off the summit it stands on - it is 4x3 and blocks.
check('  the Trollheim plateau is still crossable past the boulder',
    A.connected(0, 2890, 3722, 2905, 3730, 60), true);

// ---------------------------------------------------------------- into the encampments
// Four obstacles, one level-70 skill each, and before these the dungeon was four islands: you
// could get in and reach one faction, and no further on foot.
console.log('\nINTO THE ENCAMPMENTS');
{
    const p = player('gwdcross', 2880, 5310, 2);
    const go = (x: number, z: number, lvl: number, loc: string) => {
        p.teleport(x, z, lvl); H.tick(1);
        const m = A.mark();
        H.opLoc(p, ...(LOCAT[loc] as [number, number]), loc, 1);
        H.tick(12);
        return A.mesSince(p, m);
    };
    const LOCAT: Record<string, [number, number]> = {
        gwd_pillar_grapple: [2871, 5270], gwd_door_bang: [2851, 5333],
        gwd_ice_bridge: [2885, 5333], gwd_rock_tierope_upper: [2913, 5300],
        gwd_rock_tierope_lower: [2920, 5274],
    };

    // Armadyl - 70 Ranged, crossbow, grapple
    H.maxOut(p); H.clearInv(p);
    p.setLevel(PlayerStat.RANGED, 69);
    go(2871, 5279, 2, 'gwd_pillar_grapple');
    check('  Armadyl   69 Ranged cannot make the shot', p.z > 5275, true);
    p.setLevel(PlayerStat.RANGED, 70);
    go(2871, 5279, 2, 'gwd_pillar_grapple');
    check('  Armadyl   70 Ranged but no crossbow is refused', p.z > 5275, true);
    H.equip(p, { rhand: 'rune_crossbow' }); H.give(p, 'mith_grapple', 1);
    go(2871, 5279, 2, 'gwd_pillar_grapple');
    check('  Armadyl   70 Ranged + crossbow + grapple crosses the chasm', [p.x, p.z, p.level], [2871, 5269, 2]);

    // Bandos - 70 Strength and a hammer
    H.clearInv(p); p.setLevel(PlayerStat.STRENGTH, 70);
    go(2852, 5333, 2, 'gwd_door_bang');
    // "refused" means NOT ON THE FAR SIDE. Where the walk left you standing on the near side is
    // the router's business, and asserting x > 2851 was asserting that instead.
    check('  Bandos    no hammer is refused', p.x !== 2850, true);
    H.give(p, 'hammer', 1);
    go(2852, 5333, 2, 'gwd_door_bang');
    check('  Bandos    70 Strength + hammer opens the gong door', [p.x, p.z, p.level], [2850, 5333, 2]);

    // Zamorak - 70 Hitpoints, and it costs your prayer
    H.maxOut(p);
    p.setLevel(PlayerStat.PRAYER, 70);
    go(2885, 5332, 2, 'gwd_ice_bridge');
    check('  Zamorak   70 Hitpoints crosses the ice bridge', [p.x, p.z, p.level], [2885, 5345, 2]);
    check('  Zamorak   and the crossing empties your prayer', p.levels[PlayerStat.PRAYER], 0);

    // Saradomin - 70 Agility, not boostable, and two ropes
    H.maxOut(p); H.clearInv(p);
    H.setVar(p, 'gwd_rope_upper', 0); H.setVar(p, 'gwd_rope_lower', 0);
    go(2912, 5300, 2, 'gwd_rock_tierope_upper');
    check('  Saradomin no rope, no way down', p.level, 2);
    H.give(p, 'rope', 2);
    go(2912, 5300, 2, 'gwd_rock_tierope_upper');
    check('  Saradomin the first rope drops you a floor', [p.x, p.z, p.level], [2915, 5300, 1]);
    check('  Saradomin and it was spent', H.invCount(p, 'rope'), 1);
    go(2921, 5274, 1, 'gwd_rock_tierope_lower');
    check('  Saradomin the second lands you in the encampment', [p.x, p.z, p.level], [2919, 5274, 0]);
    // and a second visit costs nothing, because the ropes stay tied
    go(2912, 5300, 2, 'gwd_rock_tierope_upper');
    check('  Saradomin the ropes stay tied for next time', [p.level, H.invCount(p, 'rope')], [1, 0]);
    H.despawn(p);
}

// ---------------------------------------------------------------- aggression
// "All monsters in the dungeon are aggressive to any player unless they have equipped at least one
// item that is devoted to their god." The thing worth proving is that it is PER GOD: one item buys
// peace from one faction and from no other.
console.log('\nWHO COMES AFTER YOU');
{
    // huntAll is called DIRECTLY rather than waiting for the world to do it. World.cycle only hunts
    // for npcs with rsbuf observers, which a socketless sim player does not register as - so the
    // whole dungeon reads as peaceful if you just tick, including with nothing worn, which is how
    // the first version of this reported every faction ignoring everybody.
    const hunts = (npcName: string, p: Player) => {
        const npc = World.npcs.find(n => n && n.isActive && n.type === NpcType.getId(npcName));
        if (!npc) throw new Error('not spawned: ' + npcName);
        // A STANDABLE neighbour, not blindly x+1: drop the player inside a wall and check_vis
        // =lineofsight fails, which reads as that faction being peaceful. Zamorak's warrior happens
        // to stand with rock to its east, and that alone made it look like the one god who ignores
        // everybody.
        const spot = nearestOpen(npc.x, npc.z, npc.level, 3);
        if (!spot) throw new Error('nowhere to stand beside ' + npcName);
        p.teleport(spot[0], spot[1], npc.level);
        H.tick(1);
        npc.huntMode = NpcType.get(npc.type).huntmode;
        (npc as any).huntTarget = null;
        npc.huntAll(HuntType.get(npc.huntMode));
        return (npc as any).huntTarget === p;
    };
    const FACES = [['bandos', 'gwd_spiritual_warrior_bandos'], ['zamorak', 'gwd_spiritual_warrior_zamorak'],
                   ['armadyl', 'gwd_spiritual_warrior_armadyl'], ['saradomin', 'gwd_spiritual_warrior_saradomin']] as const;
    const WEAR: Record<string, string> = {
        bandos: 'bandos_chestplate', zamorak: 'zamorak_cape',
        armadyl: 'armadyl_chestplate', saradomin: 'saradomin_cape',
    };

    // nothing worn: everybody wants you
    {
        const p = player('gwdagg', 2880, 5310, 2);
        H.maxOut(p);
        const after = FACES.filter(([, n]) => hunts(n, p)).map(([g]) => g);
        check(`  wearing nothing, every faction hunts you (${after.join(',')})`, after.length, 4);
        H.despawn(p);
    }
    // one god's item: that god alone leaves you alone
    for (const [god] of FACES) {
        const p = player('gwdagg_' + god, 2880, 5310, 2);
        H.maxOut(p);
        H.equip(p, { [god === 'zamorak' || god === 'saradomin' ? 'back' : 'torso']: WEAR[god] });
        const after = FACES.filter(([, n]) => hunts(n, p)).map(([g]) => g);
        check(`  wearing ${WEAR[god].padEnd(20)} only ${god} ignores you (hunted by ${after.join(',') || 'nobody'})`,
            after.sort().join(','), FACES.map(([g]) => g).filter(g => g !== god).sort().join(','));
        H.despawn(p);
    }
}

// ---------------------------------------------------------------- combat animations
// Every npc in the dungeon should swing something. The cache states ready and walk only, so attack,
// defend and death were derived per rig; what this checks is that each one RESOLVES and sits on the
// same skeleton as the npc's own ready animation - an animation from another rig does not look
// wrong, it folds the model inside out.
console.log('\nSWINGING SOMETHING');
{
    const ALL = [...SPAWNED.flatMap(([, w]) => w.slice(1)),
        ...['armadyl', 'bandos', 'zamorak', 'saradomin'].flatMap(g => ['warrior', 'ranger', 'mage'].map(k => `gwd_spiritual_${k}_${g}`)),
        ...Array.from({ length: 15 }, (_, i) => `gwd_aviansie_${i + 1}`)];
    const P = (t: any, name: string) => t.params?.get(ParamType.getId(name));
    const noAttack: string[] = [], noDefend: string[] = [], wrongRig: string[] = [];
    for (const n of ALL) {
        const t = NpcType.get(NpcType.getId(n));
        const atk = P(t, 'attack_anim'), def = P(t, 'defend_anim');
        if (atk === undefined) noAttack.push(n);
        if (def === undefined) noDefend.push(n);
        // same skeleton as its ready animation?
        const base = (id: number) => { const s = SeqType.get(id); return s?.frames?.[0] !== undefined ? s.frames[0] >>> 16 : -1; };
        for (const [what, id] of [['attack', atk], ['defend', def]] as const) {
            if (id === undefined) continue;
            if (base(id) !== -1 && base(t.readyanim) !== -1 && base(id) !== base(t.readyanim))
                wrongRig.push(`${n} ${what}`);
        }
    }
    check(`  all ${ALL.length} have an attack animation`, noAttack.join(',') || 'none', 'none');
    check('  all have a defend animation', noDefend.join(',') || 'none', 'none');
    check('  and none of them is from another rig', wrongRig.join(',') || 'none', 'none');
}

// ---------------------------------------------------------------- the altars
console.log('\nTHE ALTARS');
{
    const p = player('gwdaltar', 2869, 5368, 2);   // inside Graardor's room, by the Bandos altar
    H.maxOut(p); H.clearInv(p);
    const prayer = () => p.levels[PlayerStat.PRAYER];
    const ALTAR: [number, number, number] = [2869, 5370, 2];

    H.setVar(p, 'gwd_altar_minute', 0);
    // drain the CURRENT level only - setLevel moves the base with it, which made the first
    // version of this check compare 10 against 10 and pass without testing anything
    p.levels[PlayerStat.PRAYER] = 10;
    H.opLoc(p, ALTAR[0], ALTAR[1], 'gwd_altar_bandos', 1);
    H.tick(6);
    check('  praying recharges you to your Prayer level', prayer(), p.baseLevels[PlayerStat.PRAYER]);

    // the ten minutes
    p.levels[PlayerStat.PRAYER] = 10;
    H.opLoc(p, ALTAR[0], ALTAR[1], 'gwd_altar_bandos', 1);
    H.tick(6);
    check('  and will not do it again straight away', prayer(), 10);

    // +1 per devoted piece worn, counted off the same param the factions read
    H.setVar(p, 'gwd_altar_minute', 0);
    H.equip(p, { torso: 'bandos_chestplate', legs: 'bandos_tassets', feet: 'bandos_boots' });
    p.levels[PlayerStat.PRAYER] = 10;
    H.opLoc(p, ALTAR[0], ALTAR[1], 'gwd_altar_bandos', 1);
    H.tick(6);
    check('  three Bandos pieces boost three above your level',
        prayer(), p.baseLevels[PlayerStat.PRAYER] + 3);

    // Teleport puts you out of the lair, not out of the dungeon
    H.opLoc(p, ALTAR[0], ALTAR[1], 'gwd_altar_bandos', 2);
    H.tick(8);
    check('  and Teleport puts you outside the lair', [p.x, p.z, p.level], [2862, 5354, 2]);
    H.despawn(p);
}

// ---------------------------------------------------------------- Graardor's two attacks
// He had one attack and Old School gives him two: crush for up to 60, and a ground slam that hits
// EVERY player in the room for 15-35 on a 1-in-3 roll. The slam is what makes his room a team
// fight rather than four separate ones.
console.log("\nGENERAL GRAARDOR");
{
    const boss = World.npcs.find(n => n && n.isActive && n.type === NpcType.getId('graardor'))!;
    const t = NpcType.get(boss.type);
    check('  he swings every 6 ticks', t.params?.get(ParamType.getId('attackrate')), 6);
    // and his melee max, which Old School puts at 60. Read off the engine's own formula rather
    // than assumed from his strength of 350.
    {
        const probe = player('gwdmax', boss.x + 1, boss.z, boss.level);
        H.maxOut(probe);
        const max = H.runNpcProc(boss, '[proc,npc_melee_maxhit]', probe)[0];
        check(`  his melee max is near Old School's 60 (formula gives ${max})`, max >= 45 && max <= 75, true);
        H.despawn(probe);
    }

    // THE SLAM REACHES EVERYONE. Three players spread around the room, only one of them his target.
    const crowd = [0, 1, 2].map(i => {
        const p = player('gwdslam' + i, boss.x + 3 + i * 3, boss.z + 3 + i * 2, boss.level);
        H.maxOut(p);
        return p;
    });
    H.tick(1);
    const before = crowd.map(p => p.levels[PlayerStat.HITPOINTS]);
    // drive the slam itself rather than waiting on a 1-in-3 roll
    H.runNpcProc(boss, '[proc,graardor_slam_attack]', crowd[0]);
    H.tick(3);
    const hurt = crowd.map((p, i) => before[i] - p.levels[PlayerStat.HITPOINTS]);
    check(`  the slam hits everyone in the room, not just his target (${hurt.join(', ')})`,
        hurt.every(h => h > 0), true);
    check(`  and each hit is between 15 and 35 (${hurt.join(', ')})`,
        hurt.every(h => h >= 15 && h <= 35), true);

    // Protect from Missiles stops it - it is a ranged attack, which is why a team brings that prayer
    const saved = crowd[0];
    saved.levels[PlayerStat.HITPOINTS] = saved.baseLevels[PlayerStat.HITPOINTS];
    H.setVar(saved, 'prayer13', 1);   // Protect from Missiles - check_protect_prayer reads %prayer13 for ranged
    const hpBefore = saved.levels[PlayerStat.HITPOINTS];
    H.runNpcProc(boss, '[proc,graardor_slam_attack]', saved);
    H.tick(3);
    check('  Protect from Missiles stops the slam', saved.levels[PlayerStat.HITPOINTS], hpBefore);

    for (const p of crowd) H.despawn(p);
}

// ---------------------------------------------------------------- K'ril and Zilyana
console.log("\nK'RIL TSUTSAROTH AND COMMANDER ZILYANA");
{
    const maxOf = (n: string) => {
        const b = World.npcs.find(x => x && x.isActive && x.type === NpcType.getId(n))!;
        const p = player('mx_' + n, b.x + 2, b.z, b.level);
        H.maxOut(p);
        const m = H.runNpcProc(b, '[proc,npc_melee_maxhit]', p)[0];
        H.despawn(p);
        return m;
    };
    const rate = (n: string) => NpcType.get(NpcType.getId(n)).params?.get(ParamType.getId('attackrate'));
    check("  K'ril swings every 6 ticks and maxes 46", [rate('kril'), maxOf('kril')], [6, 46]);
    check('  Zilyana swings every 2 ticks and maxes 27', [rate('zilyana'), maxOf('zilyana')], [2, 27]);

    // THE SPECIAL GOES THROUGH PRAYER. This is the one thing about K'ril that changes how he is
    // fought, so it is asserted from both sides: his ordinary magic is stopped by Protect from
    // Magic, and the special is not stopped by anything.
    const kril = World.npcs.find(n => n && n.isActive && n.type === NpcType.getId('kril'))!;
    const p = player('krilvictim', kril.x + 2, kril.z, kril.level);
    H.maxOut(p);

    H.setVar(p, 'prayer12', 1);                       // Protect from Magic
    p.levels[PlayerStat.HITPOINTS] = 99;
    H.runNpcProc(kril, '[proc,kril_magic_attack]', p);
    H.tick(3);
    check('  Protect from Magic stops his ordinary magic', p.levels[PlayerStat.HITPOINTS], 99);

    H.setVar(p, 'prayer14', 1);                       // and Protect from Melee as well
    p.levels[PlayerStat.HITPOINTS] = 99;
    p.setLevel(PlayerStat.PRAYER, 80);
    H.runNpcProc(kril, '[proc,kril_special_attack]', p);
    H.tick(3);
    const hurt = 99 - p.levels[PlayerStat.HITPOINTS];
    check(`  the special goes through prayer anyway (${hurt})`, hurt >= 35 && hurt <= 49, true);
    check(`  and takes half the prayer left (80 -> ${p.levels[PlayerStat.PRAYER]})`,
        p.levels[PlayerStat.PRAYER], 40);
    H.despawn(p);
}

// NOTE: this kills Graardor, so it goes LAST - anything after it finds an empty room.
// ---------------------------------------------------------------- the payout
// Killing a boss has to produce something, or none of the rest of this matters.
console.log('\nKILLING GRAARDOR');
{
    const p = player('gwdkill', 2870, 5358, 2);
    H.maxOut(p);
    H.equip(p, { rhand: 'dragon_scimitar' });
    // Protect from Melee. He hits 61 now and a 99-hitpoint player dies in two swings, which is
    // what killed this test the moment his strength bonus was corrected - the fight was being
    // lost, not the drop. This check is about the payout, not about surviving him.
    H.setVar(p, 'prayer14', 1);
    const boss = World.npcs.find(n => n && n.isActive && n.type === NpcType.getId('graardor'))!;
    // The slam test above leaves him mid-fight with players who have since been despawned, and
    // A.fight cannot take a boss that is already busy. Put him back to idle first.
    (boss as any).target = null;
    (boss as any).huntTarget = null;
    H.setNpcVar(boss, 'npc_action_delay', 0);
    H.tick(2);
    // AND STAND NEXT TO HIM. He wanders, and A.fight gives up rather than walking a long path -
    // which is why this test passed or failed depending on where he happened to be. Twice it
    // reported 'Graardor cannot be killed' with both of them untouched and seven tiles apart.
    const beside = nearestOpen(boss.x + boss.width, boss.z, boss.level, 4)!;
    p.teleport(beside[0], beside[1], boss.level);
    H.tick(1);
    const z = World.gameMap.getZone(boss.x, boss.z, boss.level);
    const before = [...z.getAllObjsUnsafe()].length;
    const bossHp0 = boss.levels[NpcStat.HITPOINTS];
    // 6000 ticks, not 2000: he has 255 hitpoints behind 90 defence in every melee style, and a
    // scimitar does not always get through that in 2000. The test was passing and failing on
    // the same code depending on the damage rolls.
    const dead = A.fight(p, boss, 6000);
    console.log(`    boss hp ${bossHp0} -> ${boss.levels[NpcStat.HITPOINTS]}, active ${boss.isActive}; `
        + `player hp ${p.levels[PlayerStat.HITPOINTS]}, at ${p.x},${p.z},${p.level} (boss at ${boss.x},${boss.z},${boss.level})`);
    H.tick(4);
    check('  Graardor can actually be killed', dead, true);
    const dropped = [...World.gameMap.getZone(boss.x, boss.z, boss.level).getAllObjsUnsafe()].length;
    check(`  and he drops something (${dropped - before} stacks)`, dropped > before, true);
}

console.log(`\n${R.ok} ok, ${R.bad} FAIL`);
process.exit(R.bad ? 1 : 0);
