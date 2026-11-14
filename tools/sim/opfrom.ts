// WHICH SIDE DOES THIS LOC TAKE A CLICK FROM? Sends the op from every tile within two and says
// which ones ran a script, which is the question forceapproach actually answers.
//
//   npx tsx tools/sim/opfrom.ts <locname> <x> <z> [level] [op]
import * as H from './harness.js';
import LocType from '#/cache/config/LocType.js';
import World from '#/engine/World.js';

await H.boot();
const [nm, xs, zs, ls, ops] = process.argv.slice(2);
const x = Number(xs),
    z = Number(zs),
    level = Number(ls ?? 0),
    op = Number(ops ?? 1);
const id = LocType.getId(nm);
const t = LocType.get(id);
const loc = World.getLoc(x, z, level, id);
console.log(`${nm} id ${id} at ${x},${z} L${level}: ${loc ? 'shape ' + loc.shape + ' angle ' + loc.angle : 'NOT THERE'}`);
console.log(`  blockwalk ${(t as any).blockwalk} forceapproach ${(t as any).forceapproach} w${t.width} l${t.length}`);

const p: any = H.makePlayer('opfrom', x, z + 2);
H.tick(2);
H.maxOut(p);
for (let dx = -2; dx <= 2; dx++) {
    for (let dz = -2; dz <= 2; dz++) {
        if (dx === 0 && dz === 0) continue;
        p.clearPendingAction();
        p.queueWaypoints([]);
        p.teleport(x + dx, z + dz, level);
        H.tick(2);
        if (p.x !== x + dx || p.z !== z + dz) continue;
        const mark = H.mesgs.length;
        const before = p.x + ',' + p.z + ',' + p.level;
        let sent = false;
        try {
            sent = H.opLoc(p, x, z, nm, op);
        } catch {
            continue;
        }
        if (!sent) continue;
        for (let i = 0; i < 12; i++) H.tick(1);
        const said = H.mesgs
            .slice(mark)
            .map((m: any) => m.text)
            .join(' | ');
        const after = p.x + ',' + p.z + ',' + p.level;
        if (said || after !== before) {
            console.log(`  from ${x + dx},${z + dz}  ->  ${after !== before ? 'MOVED to ' + after + '  ' : ''}${said}`);
        }
    }
}

// EXITS, because the engine's own timers keep the event loop alive for ever otherwise. This file
// prints a report rather than asserting anything, so it had no process.exit at all and simply hung
// once it had finished printing: ten minutes of wall clock using 0.4 seconds of CPU, which is a
// process waiting rather than working. tools/sim/sweep.sh runs every sim with a cap of 5400s, so
// fourteen files in this shape could spend the better part of a day being killed one by one.
//
// The nightly never noticed because its filter only runs a sim that CAN report a verdict
// (`grep -qE 'process\.exit\([^0-9)]'`), and a file with no exit at all does not match.
process.exit(0);
