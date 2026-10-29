// WHAT LOCS ARE IN THIS BOX, and what can be done to them? Every placement inside a rectangle
// whose debugname or op list matches a pattern, on every level, with shape and angle.
//
//   npx tsx tools/sim/locsinbox.ts <x1> <x2> <z1> <z2> ["pattern"]
//
// wherelocs.ts answers "where is the loc I already know the name of". This one answers the
// question that comes BEFORE that: "there must be a door/stair/fence here somewhere - what is it
// called?" Biohazard needed it three times: the staircase inside the mourners' quarters, the door
// out of Jerico's house, and the one fence that joins the stew yard to the rest of West Ardougne -
// none of which any script in the quest folder names.
import World from '#/engine/World.js';
import * as H from './harness.js';
import LocType from '#/cache/config/LocType.js';

await H.boot();
const [x0, x1, z0, z1] = process.argv.slice(2, 6).map(Number);
const re = new RegExp(process.argv[6] ?? '.', 'i');
let n = 0;
for (const zone of ((World.gameMap as any).zonemap.zones as Map<number, any>).values()) {
    for (const loc of zone.getAllLocsUnsafe()) {
        if (loc.x < x0 || loc.x > x1 || loc.z < z0 || loc.z > z1) continue;
        const t = LocType.get(loc.type);
        const nm = t.debugname ?? 'loc_' + loc.type;
        const ops = (t.op ?? []).filter(Boolean).join('/');
        if (!re.test(nm) && !re.test(ops)) continue;
        console.log(`${loc.level},${loc.x},${loc.z} s${loc.shape}a${loc.angle}  ${nm}  [${ops}]`);
        n++;
    }
}
console.log(`${n} locs in ${x0}-${x1} x ${z0}-${z1} matching ${re}`);
process.exit(0);
