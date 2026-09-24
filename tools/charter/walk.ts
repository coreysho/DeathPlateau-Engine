import World from '#/engine/World.js';
import { isMapBlocked, isZoneAllocated, findPath } from '#/engine/GameMap.js';
import NpcType from '#/cache/config/NpcType.js';
await World.start(false, false);
// crew x,z ; arrival x,z,level ; an inland tile to path to
const ports: Record<string, [number, number, number, number, number, number, number]> = {
    sarim: [3042, 3192, 3038, 3189, 1, 3029, 3217],
    catherby: [2796, 3415, 2792, 3417, 1, 2809, 3435],
    brimhaven: [2759, 3239, 2763, 3238, 1, 2772, 3225],
    musa: [2954, 3156, 2955, 3160, 1, 2946, 3152],
    khazard: [2673, 3144, 2674, 3141, 1, 2668, 3150],
    phasmatys: [3701, 3502, 3705, 3503, 1, 3696, 3496],
    shipyard: [3001, 3033, 2998, 3032, 1, 2998, 3043],
    tyras: [2145, 3122, 2142, 3125, 1, 2153, 3120],
};
const only = process.argv[2];
for (const [name, [cx, cz, ax, az, al, ix, iz]] of Object.entries(ports)) {
    if (only && only !== name) continue;
    for (const level of [0, 1]) {
        console.log(`== ${name} level ${level}  crew C ${cx},${cz}  arrive A ${ax},${az},${al}`);
        for (let z = cz + 9; z >= cz - 9; z--) {
            let row = String(z).padStart(5) + ' ';
            for (let x = cx - 14; x <= cx + 14; x++) {
                let ch = isZoneAllocated(level, x, z) ? (isMapBlocked(x, z, level) ? '#' : '.') : ' ';
                if (x === cx && z === cz && level === 0) ch = ch === '#' ? 'C' : 'c';
                if (x === ax && z === az && level === al) ch = ch === '#' ? 'A' : 'a';
                row += ch;
            }
            console.log(row);
        }
        console.log('      x ' + (cx - 14) + '..' + (cx + 14));
    }
    const p = findPath(0, cx, cz, ix, iz);
    console.log(`  path crew -> ${ix},${iz}: ${p.length} waypoints, ends ${p.length ? ((p[0] >> 14) & 0x3fff) + ',' + (p[0] & 0x3fff) : '-'}`);
}
process.exit(0);
