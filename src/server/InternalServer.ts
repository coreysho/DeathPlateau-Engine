import { createHash, timingSafeEqual } from 'crypto';

import type { IncomingMessage } from 'http';

import { WebSocketServer } from 'ws';

import Environment from '#/util/Environment.js';

// custom (2026-09-27) - the login, friend and logger servers trust every message they are sent: a
// save to write, a ban to set, a world to shut down. They were bound to 0.0.0.0 with no check on
// who was talking, so anyone who could reach 43500/45099/43501 could do all of that. Now they bind
// to INTERNAL_BIND_HOST (loopback unless set otherwise), and when INTERNAL_SECRET is set every
// connection has to present it in this header before the socket is even opened.
export const INTERNAL_SECRET_HEADER = 'x-internal-secret';

// Saves and input tracking are the largest internal messages - tens of kB. ws allows 100 MiB by default.
const INTERNAL_MAX_PAYLOAD = 16 * 1024 * 1024;

export function isLoopbackHost(host: string): boolean {
    return host === '127.0.0.1' || host === '::1' || host === 'localhost';
}

function digest(value: string): Buffer {
    return createHash('sha256').update(value).digest();
}

export function isInternalSecretValid(presented: string | string[] | undefined): boolean {
    const secret = Environment.INTERNAL_SECRET;
    if (!secret) {
        return true;
    }

    if (typeof presented !== 'string') {
        return false;
    }

    // hashed first so the compare is constant-time whatever the lengths
    return timingSafeEqual(digest(presented), digest(secret));
}

export function internalClientHeaders(): Record<string, string> {
    return Environment.INTERNAL_SECRET ? { [INTERNAL_SECRET_HEADER]: Environment.INTERNAL_SECRET } : {};
}

export function createInternalServer(name: string, port: number, onListening: () => void): WebSocketServer {
    const host = Environment.INTERNAL_BIND_HOST;

    if (!Environment.INTERNAL_SECRET && !isLoopbackHost(host)) {
        // refuse rather than warn: this is the configuration that let the internet ban accounts
        throw new Error(`${name}: INTERNAL_BIND_HOST=${host} can be reached from other machines, so INTERNAL_SECRET must be set (the same value in every process's .env)`);
    }

    return new WebSocketServer(
        {
            port,
            host,
            maxPayload: INTERNAL_MAX_PAYLOAD,
            verifyClient: (info: { req: IncomingMessage }) => isInternalSecretValid(info.req.headers[INTERNAL_SECRET_HEADER])
        },
        onListening
    );
}
