// Where is everything? Prints the spawn coordinate of every npc named on the command line, and for
// a loc name, every tile it is placed on. A manifest cannot walk to a tile nobody knows, and an npc
// that is not spawned at all has to be told apart from one that is simply far away.
//
//   npx tsx tools/sim/questprobe.ts npc:ahoy_velorina loc:ahoy_town_barrier
import * as H from './harness.js';
import World from '#/engine/World.js';
import NpcType from '#/cache/config/NpcType.js';
import LocType from '#/cache/config/LocType.js';

await H.boot();

for (const arg of process.argv.slice(2)) {
    const [kind, name] = arg.split(':');
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
        // every zone in the world is too much; sweep the mapsquares Morytania and Ape Atoll use
        for (let mx = 42; mx <= 43; mx++) {
            for (let mz = 42; mz <= 43; mz++) {
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
