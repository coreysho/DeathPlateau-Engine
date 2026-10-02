import * as H from './harness.ts';
import { locsNamed } from './a1lib.ts';
await H.boot();
const wildy = (z: number) => Math.floor((z - 3520) / 8) + 1;
for (const n of ['chaosaltar', 'trappedchaosaltar']) {
    const found = locsNamed(n, 2000, 2000, 4000, 4000, [0, 1, 2, 3]);
    console.log(`${n}: ${found.length}`);
    for (const [x, z, level] of found) {
        const inWild = x >= 2944 && x < 3392 && z >= 3520 && z < 6400;
        console.log(`   ${x},${z} level ${level}${inWild ? `   WILDERNESS level ${wildy(z)}` : ''}`);
    }
}
process.exit(0);
