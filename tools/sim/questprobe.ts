// Where is everything? Prints the spawn coordinate of every npc named on the command line, and for
// a loc name, every tile it is placed on. A manifest cannot walk to a tile nobody knows, and an npc
// that is not spawned at all has to be told apart from one that is simply far away.
//
//   npx tsx tools/sim/questprobe.ts npc:ahoy_velorina loc:ahoy_town_barrier
//   npx tsx tools/sim/questprobe.ts sq:51-53,45-50 loc:feud_cactus_row
//
// A loc has to be hunted for, so the sweep is a band of mapsquares and `sq:` moves it. Editing the
// numbers in the source instead - which this did twice, once for Ape Atoll and once for
// Pollnivneach - leaves the next caller sweeping somebody else's quest and reading NOT PLACED.
import * as H from './harness.js';
import World from '#/engine/World.js';
import NpcType from '#/cache/config/NpcType.js';
import LocType from '#/cache/config/LocType.js';

await H.boot();

// the band to sweep for locs: mapsquare x from..to, mapsquare z from..to
let sweep = [42, 43, 42, 43];
for (const arg of process.argv.slice(2)) {
    if (!arg.startsWith('sq:')) continue;
    const [xs, zs] = arg.slice(3).split(',');
    const [x0, x1] = xs.split('-').map(Number);
    const [z0, z1] = zs.split('-').map(Number);
    sweep = [x0, x1 ?? x0, z0, z1 ?? z0];
}

for (const arg of process.argv.slice(2)) {
    const [kind, name] = arg.split(':');
    if (kind === 'sq') continue;
    if (kind === 'npc') {
        const id = NpcType.getId(name);
        if (id === -1) {
            console.log(name.padEnd(34) + ' NO SUCH NPC TYPE');
            continue;
        }
        const where: string[] = [];
        for (const npc of World.npcs) {
            if (!npc || !npc.isActive || npc.type !== id) continue;
            where.push(npc.x + ',' + npc.z + (npc.level ? ' L' + npc.level : ''));
        }
        console.log(name.padEnd(34) + (where.length ? where.join('   ') : 'NOT SPAWNED ON ANY MAP SQUARE'));
    } else if (kind === 'loc') {
        const id = LocType.getId(name);
        if (id === -1) {
            console.log(name.padEnd(34) + ' NO SUCH LOC TYPE');
            continue;
        }
        const where: string[] = [];
        // every zone in the world is too much, so the sweep is a band - Morytania and Ape Atoll by
        // default, and anywhere else with sq:MX0-MX1,MZ0-MZ1 in front of the names.
        for (let mx = sweep[0]; mx <= sweep[1]; mx++) {
            for (let mz = sweep[2]; mz <= sweep[3]; mz++) {
                for (let lvl = 0; lvl < 4; lvl++) {
                    for (let zx = 0; zx < 8; zx++) {
                        for (let zz = 0; zz < 8; zz++) {
                            const zone = World.gameMap.getZone((mx << 6) + (zx << 3), (mz << 6) + (zz << 3), lvl);
                            for (const loc of zone.getAllLocsUnsafe()) {
                                if (loc.type === id) where.push(loc.x + ',' + loc.z + (lvl ? ' L' + lvl : ''));
                            }
                        }
                    }
                }
            }
        }
        console.log(name.padEnd(34) + (where.length ? where.slice(0, 12).join('   ') + (where.length > 12 ? '  (+' + (where.length - 12) + ')' : '') : 'NOT PLACED IN THE SWEPT AREA'));
    }
}
process.exit(0);
