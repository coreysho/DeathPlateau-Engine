import * as H from './harness.ts';
import * as A from './a1lib.ts';
await H.boot();
for (const n of process.argv.slice(2)) {
    const hits = A.locsNamed(n, 2990, 3310, 3070, 3380, [0,1,2,3]);
    console.log(n, JSON.stringify(hits));
}
process.exit(0);
