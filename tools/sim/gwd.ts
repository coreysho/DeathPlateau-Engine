// God Wars Dungeon, as far as it has been built. Run after any GWD map or spawn change:
//
//   npx tsx tools/sim/gwd.ts
//
// The dungeon comes from TWO caches and that is the thing most worth testing. Three of its four map
// squares are rev 474 (October 2007, the dungeon as it was built); m45_82 - the one holding the rope
// you arrive on and Commander Zilyana's room - has no XTEA key in any published set, so its locs
// cannot be read from 474 and it comes from the OSRS cache instead. Two sources meeting inside one
// dungeon is a seam, and a seam you cannot walk through is a dungeon nobody can finish.
// WAITS IN THIS FILE ARE DELIBERATELY GENEROUS. Clicking a loc or an npc walks the player there
// first and the handler runs on arrival; a projectile queues its damage for when it lands; a
// death queues its drops. Every short wait here has either failed intermittently or is the same
// shape as one that did, so they are 20 ticks rather than tuned individually - the sim is slow
// because it fights a 255-hitpoint boss, not because of these.
//
import * as H from './harness.ts';
import * as A from './a1lib.ts';
import VarPlayerType from '#/cache/config/VarPlayerType.js';
import HuntType from '#/cache/config/HuntType.js';
import ParamType from '#/cache/config/ParamType.js';
import SeqType from '#/cache/config/SeqType.js';
import SpotanimType from '#/cache/config/SpotanimType.js';
import { NpcStat } from '#/engine/entity/NpcStat.js';
import { PlayerStat } from '#/engine/entity/PlayerStat.js';
import { World, LocType, NpcType, check, R, player, Player } from './a1lib.ts';
import { CollisionFlag, CollisionType } from '#/engine/routefinder/index.js';
import { isFlagged, canTravel } from '#/engine/GameMap.js';
import { CoordGrid } from '#/engine/CoordGrid.js';

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
    H.tick(20); // clicking a door walks you to it first; the handler runs on arrival
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
//
// The boulder is at 2898,3716 and you click it from 2898,3715. Both numbers matter: the valley it
// stands in is grafted from a newer cache (gwd_surface.loc) because the 377 square had the lot as
// solid rock, so this walk is also the check that the graft is still joined to the mountain. If it
// comes adrift, a player standing here is standing inside a cliff.
console.log('\nTHE WAY IN');
{
    const p = player('gwdin', 2898, 3715);
    p.setLevel(PlayerStat.AGILITY, 60);

    // ---- the boulder: 60 Strength, and it only moves you to the other side of itself
    p.setLevel(PlayerStat.STRENGTH, 59);
    H.opLoc(p, 2898, 3716, 'gwd_boulder', 1);
    H.tick(20);
    check('  59 Strength cannot shift the boulder', [p.x, p.z, p.level], [2898, 3715, 0]);
    check('  and it says what is needed', A.lastMes(p).includes('Strength level of 60'), true);

    p.setLevel(PlayerStat.STRENGTH, 60);
    H.opLoc(p, 2898, 3716, 'gwd_boulder', 1);
    H.tick(20);
    check('  60 Strength puts you on the battlefield, NOT in the dungeon', [p.x, p.z, p.level], [2898, 3719, 0]);

    // ---- and the battlefield is a walk, not a doorstep
    check('  the hole is a walk away across it', A.connected(0, 2898, 3719, 2917, 3744, 60), true);
    check('  and you cannot walk back round the boulder', A.connected(0, 2898, 3719, 2898, 3715, 20), false);

    // ---- the hole wants a rope, once, and keeps it
    p.teleport(2917, 3744, 0); H.tick(1);
    H.opLoc(p, 2917, 3745, 'gwd_hole', 1);
    H.tick(20);
    check('  the hole needs a rope', [p.x, p.z, p.level], [2917, 3744, 0]);
    check('  and says so', A.lastMes(p).includes('rope'), true);
    H.give(p, 'rope', 1);
    H.opLoc(p, 2917, 3745, 'gwd_hole', 1);
    H.tick(20);
    check('  tying it spends the rope', H.invCount(p, 'rope'), 0);
    check('  and the hole stays roped', p.getVar(VarPlayerType.getByName('gwd_rope_tied')!.id), 1);

    H.opLoc(p, 2917, 3745, 'gwd_hole', 1);
    H.tick(20);
    check('  climbing down lands you on the shaft floor', [p.x, p.z, p.level], [2880, 5311, 3]);

    // ---- and only the rope goes the last step, into the chamber
    H.opLoc(p, 2881, 5311, 'gwd_rope_top', 1);
    H.tick(20);
    check('  the rope drops you into the chamber', [p.x, p.z, p.level], [2880, 5310, 2]);
    H.opLoc(p, 2881, 5311, 'gwd_rope_down', 1);
    H.tick(20);
    check('  and climbs back up', [p.x, p.z, p.level], [2880, 5311, 3]);
    H.opLoc(p, 2882, 5311, 'gwd_crack', 1);
    H.tick(20);
    check('  the crack puts you back out by the hole', [p.x, p.z, p.level], [2917, 3744, 0]);
    H.despawn(p);
}

// ---------------------------------------------------------------- the little crack
// Old School's Agility way past the same rock, both of its ends.
console.log('\nTHE LITTLE CRACK');
{
    const p = player('gwdcrack', 2899, 3713);
    p.setLevel(PlayerStat.AGILITY, 59);
    H.opLoc(p, 2900, 3713, 'gwd_crack', 1);
    H.tick(20);
    check('  59 Agility is refused', [p.x, p.z], [2899, 3713]);
    check('  and it says what is needed', A.lastMes(p).includes('Agility level of 60'), true);
    p.setLevel(PlayerStat.AGILITY, 60);
    H.opLoc(p, 2900, 3713, 'gwd_crack', 1);
    H.tick(20);
    check('  60 Agility crawls through to the battlefield', [p.x, p.z], [2904, 3720]);
    H.opLoc(p, 2904, 3719, 'gwd_crack', 1);
    H.tick(20);
    check('  and back again', [p.x, p.z], [2899, 3713]);
    H.despawn(p);
}

// ---------------------------------------------------------------- the chill
// "Drains your stats by 1 every few seconds, and will also drain all of your run and special
// energy." Trollweiss's ~apply_chill does exactly that, so the battlefield is another zone in
// chill_zones - but the zone is entered by a hop that never leaves map square 45_58, so the two
// crossings refresh the timer themselves. Both halves are checked: that it starts, and that it
// stops. The second matters more - a chill that followed you off the mountain would grind a
// player down to nothing on the walk home.
console.log('\nTHE CHILL');
{
    const p = player('gwdchill', 2898, 3715);
    p.setLevel(PlayerStat.STRENGTH, 60);
    const att = () => p.levels[PlayerStat.ATTACK];
    H.tick(30);
    check('  Trollheim does not chill you', att(), 99);
    H.opLoc(p, 2898, 3716, 'gwd_boulder', 1);
    H.tick(6);
    const onEntry = att();
    H.tick(30);
    check('  the battlefield does', att() < onEntry, true);
    H.opLoc(p, 2898, 3716, 'gwd_boulder', 1);
    H.tick(6);
    const onLeaving = att();
    H.tick(40);
    // Not equality: stats restore on their own, so off the battlefield Attack creeps back UP. What
    // must not happen is another point coming off.
    check('  and it stops when you leave', att() >= onLeaving, true);
    // THE TRAP THIS WOULD OTHERWISE BE. The chill takes Strength below 60 within a minute, so a
    // requirement read off the CURRENT level would shut a 60-Strength player out of the way they
    // came in, with the crack drained past its 60 Agility too. Both crossings read the base level,
    // as this tree's level requirements do.
    check('  and a drained player is not shut out', p.levels[PlayerStat.STRENGTH] < 60, true);
    H.opLoc(p, 2898, 3716, 'gwd_boulder', 1);
    H.tick(20);
    check('  the boulder still works on the base level', [p.x, p.z], [2898, 3719]);
    H.despawn(p);
}

// ---------------------------------------------------------------- the wolves
// "High-level ice wolves" on the way across. The 2006 map already had eighteen of them here; what
// it did not have was aggression - every ice_wolf_1..6 in the cache was huntmode=cowardly, and they
// spawn nowhere else in the tree, so they were made aggressive in place.
console.log('\nTHE ICE WOLVES');
{
    let wolves = 0;
    for (const n of World.npcs) {
        if (!n) continue;
        if (n.level === 0 && n.x >= 2880 && n.x <= 2940 && n.z >= 3715 && n.z <= 3760 &&
            (NpcType.get(n.type).debugname ?? '').startsWith('ice_wolf_')) wolves++;
    }
    check('  the battlefield is wolf country', wolves >= 15, true);
    // The config is the fact worth asserting - that all six carry an aggressive hunt rather than
    // the cowardly one they shipped with. Watching one walk is too flaky to assert on: a wandering
    // wolf may already be next to the bait, or may be busy with another wolf.
    const cowards = ['ice_wolf_1', 'ice_wolf_2', 'ice_wolf_3', 'ice_wolf_4', 'ice_wolf_5', 'ice_wolf_6']
        .filter(n => (HuntType.get(NpcType.getByName(n)!.huntmode).debugname ?? '').includes('coward'));
    check('  none of the six are cowardly any more', cowards, []);
    const w = H.npcNear('ice_wolf_3', 2898, 3733, 0) ?? H.npcNear('ice_wolf_2', 2895, 3730, 0);
    check('  and one is standing in the way', w !== null, true);
    if (w) {
        const p = player('gwdbait', w.x + 4, w.z);
        H.tick(15);
        const engaged = (w as any).target !== null || (w as any).mode !== 0 ||
            Math.abs(w.x - p.x) + Math.abs(w.z - p.z) <= 1;
        check('  and it engages you unprovoked', engaged, true);
        H.despawn(p);
    }
}

// ---------------------------------------------------------------- the whole place is multi
// "The space is multi-combat, with a free-for-all between each god's forces occurring there" - and
// not only the chamber, so every zone of all four squares that has ground on it is in multiway.csv.
console.log('\nMULTI-COMBAT');
{
    const multi = (lvl: number, x: number, z: number) => World.gameMap.isMulti(CoordGrid.packCoord(lvl, x, z));
    check('  the chamber', multi(2, 2880, 5310), true);
    check('  the shaft floor', multi(3, 2880, 5311), true);
    check('  the generals rooms', multi(2, 2864, 5354) && multi(2, 2871, 5269), true);
    check('  and Lumbridge still is not', multi(0, 3222, 3218), false);
}

// ---------------------------------------------------------------- the chamber is not empty
// "Numerous monsters from different gods' factions inhabit this area." They were all behind the
// four doors before this: the room they open onto had one npc standing in it.
console.log('\nTHE CHAMBER');
{
    const gods = new Set<string>();
    let n = 0;
    for (const npc of World.npcs) {
        if (!npc) continue;
        if (npc.level !== 2 || npc.x < 2846 || npc.x > 2912 || npc.z < 5279 || npc.z > 5347) continue;
        const name = NpcType.get(npc.type).debugname ?? '';
        if (!name.startsWith('gwd_spiritual_')) continue;
        n++;
        gods.add(name.split('_').pop()!);
    }
    check('  followers stand in the chamber', n >= 40, true);
    check('  and all four gods are in there together', gods.size, 4);
}

// ---------------------------------------------------------------- the killcount on screen
// Asked for by name: "add the killcount of followers to the screen like osrs". Written from the
// server and rewritten on every show, because the client drops server-set text when the interface
// holding it is replaced - a panel written only on a kill would come back blank.
console.log('\nTHE KILLCOUNT PANEL');
{
    const p = player('gwdpanel', 2880, 5310, 2);
    H.setVar(p, 'gwd_kc_armadyl', 7);
    H.setVar(p, 'gwd_kc_bandos', 40);
    H.setVar(p, 'gwd_kc_saradomin', 0);
    H.setVar(p, 'gwd_kc_zamorak', 13);
    H.clearLogs();
    H.runProc(p, '[proc,gwd_kc_overlay_open]');
    H.tick(2);
    const texts = H.ifaces.filter(f => f.kind === 'text').map(f => f.text);
    check('  it shows all four counts', texts.length, 4);
    check('  with the numbers that are stored', texts,
        ['Armadyl: 7', 'Bandos: 40', 'Saradomin: 0', 'Zamorak: 13']);
    H.despawn(p);
}

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
        H.tick(20);
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
    H.tick(20);
    check('  praying recharges you to your Prayer level', prayer(), p.baseLevels[PlayerStat.PRAYER]);

    // the ten minutes
    p.levels[PlayerStat.PRAYER] = 10;
    H.opLoc(p, ALTAR[0], ALTAR[1], 'gwd_altar_bandos', 1);
    H.tick(20);
    check('  and will not do it again straight away', prayer(), 10);

    // +1 per devoted piece worn, counted off the same param the factions read
    H.setVar(p, 'gwd_altar_minute', 0);
    H.equip(p, { torso: 'bandos_chestplate', legs: 'bandos_tassets', feet: 'bandos_boots' });
    p.levels[PlayerStat.PRAYER] = 10;
    H.opLoc(p, ALTAR[0], ALTAR[1], 'gwd_altar_bandos', 1);
    H.tick(20);
    check('  three Bandos pieces boost three above your level',
        prayer(), p.baseLevels[PlayerStat.PRAYER] + 3);

    // Teleport puts you out of the lair, not out of the dungeon
    H.opLoc(p, ALTAR[0], ALTAR[1], 'gwd_altar_bandos', 2);
    H.tick(20);
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

// ---------------------------------------------------------------- Kree'arra
// The only general who fights from across the room, and the biggest hit in the dungeon.
console.log("\nKREE'ARRA");
{
    const t = NpcType.get(NpcType.getId('kreearra'));
    check('  he swings every 3 ticks and reaches 8 tiles',
        [t.params?.get(ParamType.getId('attackrate')), t.attackrange], [3, 8]);

    const boss = World.npcs.find(n => n && n.isActive && n.type === NpcType.getId('kreearra'))!;
    const p = player('kreevictim', boss.x + 6, boss.z, boss.level);
    H.maxOut(p);
    H.tick(1);

    // A projectile's damage is QUEUED for when it lands, so each shot has to be let finish before
    // the next is fired. Without the drain, one shot's damage arrives during the next test and
    // reads as a prayer that failed to block - which is exactly how this first reported that both
    // of his prayers were broken.
    // AND HE MUST NOT FIRE ON HIS OWN while a single shot is being measured. He is aggressive at
    // three ticks, so twelve ticks of waiting is four more attacks of his own landing on top of
    // the one under test - which is how a 69-max attack measured 92.
    boss.huntMode = -1;
    (boss as any).target = null;
    (boss as any).huntTarget = null;
    // MEASURE THE SHOT, NOT THE WINDOW. Reading hitpoints before and after counts everything that
    // lands in between, and plenty does: the player AUTO-RETALIATES, which re-engages him, and he
    // then attacks on his own three-tick schedule however thoroughly he has been silenced. That is
    // how a 69-max attack measured 74 and 92, and how a blocked one measured 6.
    //
    // Retaliation off, and the FIRST hit recorded against this player after the shot is the shot.
    H.setVar(p, 'option_nodef', 1);                   // ^player_auto_retaliate_off
    const shoot = (proc: string) => {
        H.tick(12);                                   // let anything in flight land
        const from = H.hits.length;
        p.levels[PlayerStat.HITPOINTS] = 99;
        H.runNpcProc(boss, proc, p);
        H.tick(12);
        const mine = H.hits.slice(from).filter(h => h.who === p.username);
        return mine.length ? mine[0].damage : 0;
    };

    const ranged = shoot('[proc,kreearra_ranged_attack]');
    check(`  he shoots you from 6 tiles away (${ranged})`, ranged > 0 && ranged <= 69, true);

    H.setVar(p, 'prayer13', 1);                        // Protect from Missiles
    check('  Protect from Missiles stops it', shoot('[proc,kreearra_ranged_attack]'), 0);

    H.setVar(p, 'prayer13', 0);
    H.setVar(p, 'prayer12', 1);                        // Protect from Magic
    check('  and Protect from Magic stops the other one', shoot('[proc,kreearra_magic_attack]'), 0);

    // both projectiles resolve - a missing graphic is an attack with nothing leaving him
    for (const n of ['kreearra_ranged_proj', 'kreearra_magic_proj'])
        check(`  ${n} is a real spotanim`, SpotanimType.getId(n) >= 0, true);
    H.despawn(p);
}

// ---------------------------------------------------------------- the armies pay out
// Before this the 39 npcs you grind killcount on dropped nothing at all, which made wearing a god
// item strictly better than fighting. Four shared tables, one per kind.
console.log('\nTHE ARMIES DROP SOMETHING');
{
    // LOOK FOR A NEW OBJECT, ANYWHERE NEARBY. Counting objects around a point cannot work: these
    // chase the player across the room over a 1500-tick fight and die tens of tiles from where it
    // started, so a count near the start sees nothing and a count near the end has no baseline.
    // Both of those reported "killed and dropped (0)" for npcs the diagnostic showed dead with
    // their loot on the floor. A snapshot of what is on the ground before and after, over a box
    // wide enough to contain the whole fight, answers it whatever either of them did.
    const snapshot = (cx: number, cz: number, lvl: number, r = 40) => {
        const seen = new Set<string>();
        for (let zx = cx - r; zx <= cx + r; zx += 8)
            for (let zz = cz - r; zz <= cz + r; zz += 8)
                for (const o of World.gameMap.getZone(zx, zz, lvl).getAllObjsUnsafe() as any)
                    seen.add(`${o.x},${o.z},${o.type},${o.count}`);
        return seen;
    };

    // SOME OF THESE TABLES ROLL NOTHING. The wiki gives the Spiritual ranger a "Nothing" branch,
    // and the five items this cache lacks add their weights to it: 33 of its 128 rolls drop
    // nothing at all, and the mage has 7. So one kill proving nothing is not a failure - it is the
    // table. Up to three of each are killed, and the check is that SOME kill drops.
    for (const kind of ['gwd_spiritual_mage_bandos', 'gwd_spiritual_warrior_bandos',
                        'gwd_spiritual_ranger_bandos', 'gwd_aviansie_1']) {
        let dropped = 0, kills = 0;
        for (let attempt = 0; attempt < 3 && dropped === 0; attempt++) {
            const npc = World.npcs.find(n => n && n.isActive && n.type === NpcType.getId(kind));
            if (!npc) break;
            npc.huntMode = -1;
            const spot = nearestOpen(npc.x, npc.z, npc.level, 4)!;
            const p = player(`loot_${kind}_${attempt}`, spot[0], spot[1], npc.level);
            const near = nearestOpen(spot[0] + 1, spot[1], npc.level, 3)!;
            npc.teleport(near[0], near[1], npc.level);
            H.tick(1);
            H.maxOut(p);
            // A halberd, not a scimitar: the Armadylean flyers refuse anything with less than two
            // tiles of reach now, so a scimitar cannot kill an Aviansie at all.
            H.equip(p, { rhand: 'rune_halberd' });
            const cx = npc.x, cz = npc.z, clvl = npc.level;
            const before = snapshot(cx, cz, clvl);
            const dead = A.fight(p, npc, 1500);
            H.tick(20);
            if (dead) kills++;
            dropped += [...snapshot(cx, cz, clvl)].filter(k => !before.has(k)).length;
            H.despawn(p);
        }
        check(`  ${kind.replace('gwd_', '').padEnd(26)} ${kills} killed, ${dropped} dropped`,
            kills > 0 && dropped > 0, true);
    }
}

// ---------------------------------------------------------------- Armadyl cannot be meleed
// "Like other Armadylean followers in the God Wars Dungeon, he and his bodyguards cannot be
// attacked with Melee, except when using Halberds or Salamanders." min_attackrange=2 is how this
// build already says that - it is what keeps a short weapon off Zulrah across the water.
console.log('\nARMADYL FLIES');
{
    const FLYERS = ['kreearra', 'gwd_wingman_skree', 'gwd_flockleader_geerin', 'gwd_flight_kilisa',
        'gwd_spiritual_warrior_armadyl', 'gwd_spiritual_ranger_armadyl', 'gwd_spiritual_mage_armadyl',
        ...Array.from({ length: 15 }, (_, i) => `gwd_aviansie_${i + 1}`)];
    const reach = (n: string) => NpcType.get(NpcType.getId(n)).params?.get(ParamType.getId('min_attackrange'));
    const unguarded = FLYERS.filter(n => reach(n) !== 2);
    check(`  all ${FLYERS.length} Armadylean flyers refuse a short weapon`, unguarded.join(',') || 'none', 'none');

    // and the other three gods are NOT affected - this is Armadyl's rule, not a dungeon-wide one
    const others = ['graardor', 'kril', 'zilyana', 'gwd_strongstack', 'gwd_spiritual_warrior_bandos',
        'gwd_starlight', 'gwd_tstanon_karlak'];
    check('  and nobody else in the dungeon is melee-proof',
        others.filter(n => reach(n) === 2).join(',') || 'none', 'none');

    // the refusal actually fires: a scimitar is turned away, a halberd is not
    const boss = World.npcs.find(n => n && n.isActive && n.type === NpcType.getId('gwd_flight_kilisa'))!;
    // Pinned, like every other victim in this file. She wanders, and a fight that never starts
    // reads as "the halberd was refused" - which is the opposite of what it would mean.
    boss.huntMode = -1;
    const spot = nearestOpen(boss.x, boss.z, boss.level, 5)!;
    const p = player('armamelee', spot[0], spot[1], boss.level);
    const beside = nearestOpen(spot[0] + 2, spot[1], boss.level, 3)!;
    boss.teleport(beside[0], beside[1], boss.level);
    H.tick(1);
    H.maxOut(p);

    H.equip(p, { rhand: 'dragon_scimitar' });
    let mark = A.mark();
    H.opNpc(p, boss, 2);
    H.tick(20);   // the player walks to her first; the refusal fires on arrival, not on the click
    check('  a scimitar is told it cannot reach', A.said(p, mark, 'longer weapon'), true);

    H.equip(p, { rhand: 'rune_halberd' });
    mark = A.mark();
    const hpBefore = boss.levels[NpcStat.HITPOINTS];
    const swings = H.anims.length;
    H.opNpc(p, boss, 2);
    H.tick(30);
    // WHAT IS BEING TESTED IS THE REACH RULE, not the damage roll. Flight Kilisa has 175 defence
    // and a halberd got her down ONE hitpoint in sixty ticks when this was measured directly, so
    // asserting that she loses health makes the check a coin flip - which is exactly how it passed
    // once and failed once on identical code. The swing happening at all is the thing: no refusal,
    // and the player actually attacking rather than standing there.
    const swung = H.anims.slice(swings).some(a => a.who === p.username);
    check('  a halberd is not, and the swing happens',
        [A.said(p, mark, 'longer weapon'), swung], [false, true]);
    void hpBefore;
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
    // PIN HIM. Standing beside him once is not enough: he wanders, and A.fight gives up rather
    // than walking a long path, so this kept reporting 'Graardor cannot be killed' with both of
    // them untouched several tiles apart. Put him somewhere known, put the player next to him,
    // and keep him from drifting off while the fight starts.
    boss.teleport(2870, 5360, 2);
    boss.huntMode = -1;
    H.tick(1);
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
    H.tick(20);
    check('  Graardor can actually be killed', dead, true);
    const dropped = [...World.gameMap.getZone(boss.x, boss.z, boss.level).getAllObjsUnsafe()].length;
    check(`  and he drops something (${dropped - before} stacks)`, dropped > before, true);
}

console.log(`\n${R.ok} ok, ${R.bad} FAIL`);
process.exit(R.bad ? 1 : 0);
