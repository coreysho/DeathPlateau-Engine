// Quest-audit probes: dead:x1:z1:x2:z2 (loc/npc ops with no trigger), conn:level:x:z:tx:tz (on-foot flood),
// reach:level:x:z:loc:lx:lz, ascii:level:x1:z1:x2:z2:sx:sz (map with the flood), walk:level:x:z.
// Usage: npx tsx tools/sim/a1probe.ts <probe> ...
import { printDead, H, connected, reachLoc, walkable, ascii } from './a1lib.js';
await H.boot();
H.loginOrder();
const args = process.argv.slice(2);
for (const a of args) {
    const [cmd, ...r] = a.split(':');
    const n = r.map(Number);
    if (cmd === 'dead') printDead(a, n[0], n[1], n[2], n[3]);
    // conn:level:x:z:tx:tz  (npc tile / floor tile)
    if (cmd === 'conn') console.log(a, connected(n[0], n[1], n[2], n[3], n[4], 300));
    // reach:level:x:z:locname:lx:lz
    if (cmd === 'reach') console.log(a, reachLoc(n[0], n[1], n[2], r[3], Number(r[4]), Number(r[5])));
    if (cmd === 'ascii') console.log(a + '\n' + ascii(n[0], n[1], n[2], n[3], n[4], n[5], n[6]));
    if (cmd === 'walk') console.log(a, walkable(n[0], n[1], n[2]));
}
process.exit(0);
