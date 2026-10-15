// EVERY WORKER THREAD COMES THROUGH HERE, and the reason is one character in package.json.
//
// A worker thread starts with Node's own module resolution and nothing else: the ESM hooks tsx
// installs are per-thread, and a worker inherits none of them (--import tsx in the worker's
// execArgv does not help either - measured). Node then resolves "#/engine/..." itself, against
// package.json's imports map, and refuses: an imports key may not be "#" and may not start with
// "#/", so the map's "#/*" is not a key Node will accept and the specifier comes back as
//   Invalid module "#/server/login/LoginClient.js" is not a valid internal imports specifier name
// On the main thread that never shows, because tsx resolves those specifiers out of tsconfig's
// paths before Node sees them.
//
// So every one of the engine's worker threads died on its first import - login, friend, logger,
// Discord, the dev cache and on-demand - and because World only logs a worker's 'error' event, the
// server came up looking healthy with no login server, no friend server and no logging. The
// changepassword sim is what finally said so out loud: eight checks pass and six fail, all six
// downstream of a login thread that was never alive.
//
// Registering tsx inside the worker, before the real entry is imported, is what makes "#/..."
// resolvable there. A deployment running built JavaScript has nothing to register and skips it.
//
// The entry to load comes in as workerData.entry, a file URL. Nothing else is in workerData; if a
// thread ever needs its own, pass it alongside and the thread can read it as usual.
import { workerData } from 'node:worker_threads';

try {
    const { register } = await import('tsx/esm/api');
    register();
} catch {
    // no tsx here: either it is not installed or this is built JavaScript. Either way the entry
    // below is loaded by Node as it stands, which is what a .js deployment wants.
}

await import(workerData.entry);
