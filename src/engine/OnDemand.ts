import FileStream from '#/io/FileStream.js';
import Packet from '#/io/Packet.js';
import ClientSocket from '#/server/ClientSocket.js';

import { Worker } from 'worker_threads';

type OnDemandRequest = {
    type: 'request';
    clientId: string;
    archive: number;
    file: number;
    priority: number;
};

type OnDemandClientClosed = {
    type: 'client_closed';
    clientId: string;
};

type OnDemandReloadCache = {
    type: 'reload_cache';
};

type OnDemandWorkerMessage =
    | {
          type: 'chunk';
          clientId: string;
          data: Uint8Array;
      }
    | {
          type: 'close_client';
          clientId: string;
      };

type OnDemandFlowControl = {
    type: 'pause' | 'resume';
    clientId: string;
};

type OnDemandWorkerRequest = OnDemandRequest | OnDemandClientClosed | OnDemandReloadCache | OnDemandFlowControl;

// custom (2026-09-27) - backpressure. The worker serves as fast as it can, and send() never blocks, so
// a client that requests files and then stops reading (no login needed) made Node buffer without limit
// until the whole world ran out of memory. Past HIGH the client is paused in the worker; it resumes
// once its socket drains below LOW. Past HARD - only possible if a pause is ignored - it is dropped.
const BACKPRESSURE_HIGH = 1024 * 1024;
const BACKPRESSURE_LOW = 256 * 1024;
const BACKPRESSURE_HARD = 16 * 1024 * 1024;
const BACKPRESSURE_POLL_MS = 50;

type WorkerWithTransfers = Worker & {
    postMessage(value: OnDemandWorkerRequest): void;
};

class OnDemand {
    cache = new FileStream('data/pack');

    private worker: WorkerWithTransfers | null = null;
    private clients: Map<string, ClientSocket> = new Map();
    private restarting: NodeJS.Timeout | null = null;
    private paused: Set<string> = new Set();
    private drainTimer: NodeJS.Timeout | null = null;

    cycle() {
        this.startWorker();
    }

    reloadCache() {
        this.cache.close();
        this.cache = new FileStream('data/pack');
        this.worker?.postMessage({
            type: 'reload_cache'
        });
    }

    onClientData(client: ClientSocket) {
        if (client.state !== 2) {
            return;
        }

        if (client.available < 4) {
            return;
        }

        const buf = Packet.alloc(0);
        while (client.available >= 4) {
            client.read(buf.data, 0, 4);
            buf.pos = 0;

            const archive = buf.g1();
            const file = buf.g2();
            const priority = buf.g1();

            if (archive > 3 || priority > 2) {
                client.close();
                return;
            }

            this.queue(client, archive, file, priority);
        }
    }

    onClientClosed(client: ClientSocket) {
        this.paused.delete(client.uuid);

        if (!this.clients.delete(client.uuid)) {
            return;
        }

        this.worker?.postMessage({
            type: 'client_closed',
            clientId: client.uuid
        });
    }

    private queue(client: ClientSocket, archive: number, file: number, priority: number) {
        const worker = this.startWorker();
        if (!worker) {
            return;
        }

        this.clients.set(client.uuid, client);
        worker.postMessage({
            type: 'request',
            clientId: client.uuid,
            archive,
            file,
            priority
        });
    }

    private startWorker(): WorkerWithTransfers | null {
        if (this.worker) {
            return this.worker;
        }

        const worker = new Worker(new URL('./OnDemandThread.ts', import.meta.url)) as WorkerWithTransfers;
        this.worker = worker;

        worker.on('message', (msg: OnDemandWorkerMessage) => this.onWorkerMessage(msg));
        worker.on('error', err => {
            console.error('OnDemand worker error:', err);
        });
        worker.on('exit', code => {
            this.worker = null;
            this.clients.clear();
            this.paused.clear();

            if (code === 0 || this.restarting) {
                return;
            }

            console.error(`OnDemand worker exited with code ${code}; restarting shortly.`);
            this.restarting = setTimeout(() => {
                this.restarting = null;
                this.startWorker();
            }, 1000);
        });

        return worker;
    }

    private onWorkerMessage(msg: OnDemandWorkerMessage) {
        const client = this.clients.get(msg.clientId);
        if (!client || client.state !== 2) {
            this.clients.delete(msg.clientId);
            this.worker?.postMessage({
                type: 'client_closed',
                clientId: msg.clientId
            });
            return;
        }

        if (msg.type === 'close_client') {
            client.close();
            this.clients.delete(msg.clientId);
            this.worker?.postMessage({
                type: 'client_closed',
                clientId: msg.clientId
            });
            return;
        }

        client.send(msg.data);

        const buffered = client.bufferedBytes;
        if (buffered > BACKPRESSURE_HARD) {
            client.terminate();
            this.onClientClosed(client);
        } else if (buffered > BACKPRESSURE_HIGH && !this.paused.has(client.uuid)) {
            this.paused.add(client.uuid);
            this.worker?.postMessage({ type: 'pause', clientId: client.uuid });
            this.watchDrain();
        }
    }

    private watchDrain() {
        if (this.drainTimer) {
            return;
        }

        this.drainTimer = setInterval(() => {
            for (const clientId of this.paused) {
                const client = this.clients.get(clientId);
                if (!client || client.state !== 2) {
                    this.paused.delete(clientId);
                    continue;
                }

                if (client.bufferedBytes < BACKPRESSURE_LOW) {
                    this.paused.delete(clientId);
                    this.worker?.postMessage({ type: 'resume', clientId });
                }
            }

            if (this.paused.size === 0 && this.drainTimer) {
                clearInterval(this.drainTimer);
                this.drainTimer = null;
            }
        }, BACKPRESSURE_POLL_MS);
    }
}

export default new OnDemand();
