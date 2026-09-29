import fs from 'fs';
import { Worker } from 'worker_threads';

import { collectDefaultMetrics, register } from 'prom-client';

import { packAll } from '#tools/pack/PackAll.js';
import World from '#/engine/World.js';
import TcpServer from '#/server/tcp/TcpServer.js';
import Environment from '#/util/Environment.js';
import { printError, printInfo, printWarning } from '#/util/Logger.js';
import { startManagementWeb, startWeb } from '#/web.js';
import OnDemand from '#/engine/OnDemand.js';
import BotManager from '#/engine/bot/BotManager.js';
import ScriptFaults from '#/engine/script/ScriptFaults.js';

if (OnDemand.cache.count(0) !== 9 || OnDemand.cache.count(2) === 0 || !fs.existsSync('data/pack/server/script.dat')) {
    printInfo('Packing cache, please wait until you see the world is ready.');

    try {
        // todo: different logic so the main thread doesn't have to load pack files
        const modelFlags: number[] = [];
        await packAll(modelFlags);
    } catch (err) {
        if (err instanceof Error) {
            printError(err);
        }

        process.exit(1);
    }
}

if (Environment.EASY_STARTUP) {
    new Worker(new URL('./login.ts', import.meta.url));
    new Worker(new URL('./friend.ts', import.meta.url));
    new Worker(new URL('./logger.ts', import.meta.url));
}

// custom (2026-09-27) - development mode makes EVERY login a developer (LoginThread) with the
// destructive commands, and turns the login rate limits off. Fine on a laptop, a disaster on a
// port-forwarded world - say so where the log is read.
if (!Environment.NODE_PRODUCTION) {
    printWarning('NODE_PRODUCTION is false: every player gets developer commands and login rate limits are off. Set NODE_PRODUCTION=true in .env on any world other people can reach.');
}
if (Environment.NODE_MIN_STAFF_LEVEL > 0) {
    printInfo(`Staff-only world: accounts below staff level ${Environment.NODE_MIN_STAFF_LEVEL} are refused at login (NODE_MIN_STAFF_LEVEL).`);
}

// custom (2026-09-29) - the script fault reporter (engine/script/ScriptFaults.ts). Before
// World.start, because the login and startup scripts run inside it and a fault there is exactly the
// kind nobody is watching for. Does nothing at all unless NODE_SCRIPT_FAULTS is set.
ScriptFaults.init();

await World.start();

// custom (2026-09-27) - server-side bots, only where asked for (the dev world). Never on live.
if (Environment.NODE_BOTS) {
    BotManager.start();

    // custom (2026-09-29) - the fuzzers (src/engine/bot/BotFuzzer.ts). startFuzzers refuses on
    // anything but a development world and says why, so this is safe to leave in app.ts: on live it
    // is one boolean read that is false.
    if (Environment.NODE_BOTS_FUZZ) {
        const why = BotManager.startFuzzers(Environment.NODE_BOTS_FUZZ_COUNT, Environment.NODE_BOTS_FUZZ_SEED);
        if (why) {
            printWarning(`bots: fuzzers not started - ${why}`);
        }
    }
}

const tcpServer = new TcpServer();
tcpServer.start();

await startWeb();
await startManagementWeb();

register.setDefaultLabels({ nodeId: Environment.NODE_ID });
collectDefaultMetrics({ register });

let exiting = false;
function safeExit() {
    if (exiting) {
        return;
    }

    exiting = true;
    // Anything recorded since the last five-second flush would otherwise be lost on a restart, and
    // the fault that took the world down is the one most worth keeping.
    ScriptFaults.flush();
    World.rebootTimer(0);
}

process.on('SIGINT', safeExit);
process.on('SIGTERM', safeExit);

process.on('uncaughtException', function (err) {
    console.error(err, 'Uncaught exception');
});

process.on('unhandledRejection', (reason, promise) => {
    console.error({ promise, reason }, 'Unhandled Rejection at: Promise');
});
