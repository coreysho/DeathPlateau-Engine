import * as H from './harness.ts';
import { ascii } from './a1lib.ts';
await H.boot();
console.log('level 3 roofs, x 3084..3107 by z 3250..3285   (# blocked, . free)');
console.log(ascii(3, 3084, 3250, 3107, 3285, 3102, 3279));
process.exit(0);
