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
import { NpcStat } from '#/engine/entity/NpcStat.js';
import { World, LocType, NpcType, check, R, player } from './a1lib.ts';
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

console.log(`\n${R.ok} ok, ${R.bad} FAIL`);
process.exit(R.bad ? 1 : 0);
