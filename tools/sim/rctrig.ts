// IS THE TRIGGER THERE? The op was sent, the player arrived, and nothing ran.
import * as H from './harness.js';
import LocType from '#/cache/config/LocType.js';
import ScriptProvider from '#/engine/script/ScriptProvider.js';
import ServerTriggerType from '#/engine/script/ServerTriggerType.js';

await H.boot();
for (const nm of ['vc_ladder', 'vc_laddertop', 'vc_manhole_open', 'ratcatchers_rathole1', 'ratcatchers_rathole5', 'vc_ornaterailing']) {
    const id = LocType.getId(nm);
    const t = LocType.get(id);
    const ap = ScriptProvider.getByTrigger(ServerTriggerType.APLOC1, id, t.category);
    const op = ScriptProvider.getByTrigger(ServerTriggerType.OPLOC1, id, t.category);
    const apu = ScriptProvider.getByTrigger(ServerTriggerType.APLOCU, id, t.category);
    const opu = ScriptProvider.getByTrigger(ServerTriggerType.OPLOCU, id, t.category);
    console.log(`${nm.padEnd(24)} id ${String(id).padStart(5)} cat ${t.category}  blockwalk ${(t as any).blockwalk}  forceapproach ${(t as any).forceapproach}  w${t.width}l${t.length}`);
    console.log(`    aploc1 ${ap ? ap.name : '-'}   oploc1 ${op ? op.name : '-'}   aplocu ${apu ? apu.name : '-'}   oplocu ${opu ? opu.name : '-'}`);
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
