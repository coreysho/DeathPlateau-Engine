import { Worker, type WorkerOptions } from 'node:worker_threads';

/**
 * Start a worker thread. The entry is loaded through WorkerEntry.mjs rather than directly, because a
 * worker resolves its own imports with Node and Node will not accept package.json's "#/*" imports
 * key - see the comment at the top of WorkerEntry.mjs, which is the whole story. Every worker in
 * this engine goes through here so that none of them can be started the way that does not work.
 */
export function spawnThread(entry: URL, options: WorkerOptions = {}): Worker {
    return new Worker(new URL('./WorkerEntry.mjs', import.meta.url), {
        ...options,
        workerData: { entry: entry.href, ...((options.workerData as object | undefined) ?? {}) }
    });
}
