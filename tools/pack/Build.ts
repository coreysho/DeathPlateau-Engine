import { assertClientCache } from '#tools/pack/CacheCheck.js';
import { packAll } from '#tools/pack/PackAll.js';
import { printError } from '#/util/Logger.js';

try {
    const modelFlags: number[] = [];
    console.time('pack');
    await packAll(modelFlags);
    console.timeEnd('pack');

    // AND IS IT READABLE? Packing reports success per file and cannot see the one failure that
    // matters: two builds against one checkout append their blocks into each other's chains, and
    // from then on the engine serves a crc of 0 for whatever it can no longer read. Clients then
    // fail at 30% with a connection error, which is the last place anybody looks for a bad pack.
    // Two seconds here against the day that cost.
    console.time('cache check');
    assertClientCache('data/pack');
    console.timeEnd('cache check');
} catch (err) {
    if (err instanceof Error) {
        printError(err);
    }

    process.exit(1);
}
