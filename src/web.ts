import net from 'net';
import path from 'path';
import { existsSync, readFileSync } from 'fs';

import ejs from 'ejs';
import Fastify from 'fastify';
import FastifyStatic from '@fastify/static';
import FastifyView from '@fastify/view';
import FastifyWebsocket from '@fastify/websocket';
import { register } from 'prom-client';

import { CrcBuffer, CrcTable } from '#/cache/CrcTable.js';

import OnDemand from '#/engine/OnDemand.js';
import World from '#/engine/World.js';

import NullClientSocket from '#/server/NullClientSocket.js';

import { LoggerEventType } from '#/server/logger/LoggerEventType.js';

import WSClientSocket from '#/server/ws/WSClientSocket.js';
import ConnectionLimiter, { HANDSHAKE_TIMEOUT_MS, normalizeAddress } from '#/server/ConnectionLimiter.js';
import { isProxyProtocolEnabled, isTrustedProxy, readProxyHeader } from '#/server/ProxyProtocol.js';

import Environment from '#/util/Environment.js';
import { tryParseInt } from '#/util/TryParse.js';

const fastify = Fastify({
    // logger: true
});

fastify.register(FastifyView, {
    engine: {
        ejs
    },
    root: 'view'
});

await fastify.register(FastifyWebsocket, {
    options: {
        maxPayload: 1600,
        perMessageDeflate: false,
        verifyClient: function (info, next) {
            if (Environment.WEB_ALLOWED_ORIGIN && info.req.headers.origin !== Environment.WEB_ALLOWED_ORIGIN) {
                next(false);
                return;
            }

            next(true);
        }
    }
});

// general routes

fastify.route({
    method: 'GET',
    url: '/',
    handler: (_req, reply) => {
        return reply.redirect('/rs2.cgi', 302);
    },
    wsHandler: (socket, req) => {
        const address = normalizeAddress(req.socket.remoteAddress);
        if (!ConnectionLimiter.tryAcquire(address)) {
            socket.terminate();
            return;
        }

        const client = new WSClientSocket(
            {
                get bufferedAmount() {
                    return socket.bufferedAmount;
                },
                send(data: Uint8Array) {
                    socket.send(data);
                },
                close() {
                    socket.close();
                },
                terminate() {
                    socket.terminate();
                }
            },
            address
        );

        // custom (2026-09-27) - the same rules as TCP (TcpServer): 30 seconds without a byte, or 30
        // seconds without finishing a login, and the socket is dropped. WebSockets had no timeout at all.
        const handshakeDeadline = setTimeout(() => {
            if (client.state === 0) {
                client.terminate();
            }
        }, HANDSHAKE_TIMEOUT_MS);
        let idleTimer = setTimeout(() => client.terminate(), 30000);

        socket.on('message', (message: Buffer<ArrayBufferLike>) => {
            clearTimeout(idleTimer);
            idleTimer = setTimeout(() => client.terminate(), 30000);

            try {
                if (client.state === -1 || client.remaining <= 0) {
                    client.terminate();
                    return;
                }

                client.buffer(message);

                if (client.state === 0) {
                    World.onClientData(client);
                } else if (client.state === 2) {
                    OnDemand.onClientData(client);
                }
            } catch {
                socket.terminate();
            }
        });

        socket.on('close', () => {
            clearTimeout(handshakeDeadline);
            clearTimeout(idleTimer);
            ConnectionLimiter.release(address);
            client.state = -1;
            OnDemand.onClientClosed(client);

            if (client.player) {
                client.player.addSessionLog(LoggerEventType.ENGINE, 'WS socket closed');
                client.player.client = new NullClientSocket();
            }
        });

        socket.on('error', () => {
            socket.terminate();
        });
    }
});

const rs2cgiPath = path.join(process.cwd(), 'public', 'rs2.cgi');
if (existsSync(rs2cgiPath)) {
    const rs2cgiHtml = readFileSync(rs2cgiPath, 'utf8');
    fastify.get('/rs2.cgi', (_req, reply) => {
        reply.type('text/html').send(rs2cgiHtml);
    });
}

// cache routes

fastify.get('/crc:cachebust', async (_req, reply) => {
    reply.send(CrcBuffer.data);
});

fastify.get<{ Params: { crc: string } }>('/title:crc', async (req, reply) => {
    const { crc } = req.params;

    if (tryParseInt(crc, -1) !== CrcTable[1]) {
        reply.status(404);
        return;
    }

    reply.send(OnDemand.cache.read(0, 1));
});

fastify.get<{ Params: { crc: string } }>('/config:crc', async (req, reply) => {
    const { crc } = req.params;

    if (tryParseInt(crc, -1) !== CrcTable[2]) {
        reply.status(404);
        return;
    }

    reply.send(OnDemand.cache.read(0, 2));
});

fastify.get<{ Params: { crc: string } }>('/interface:crc', async (req, reply) => {
    const { crc } = req.params;

    if (tryParseInt(crc, -1) !== CrcTable[3]) {
        reply.status(404);
        return;
    }

    reply.send(OnDemand.cache.read(0, 3));
});

fastify.get<{ Params: { crc: string } }>('/media:crc', async (req, reply) => {
    const { crc } = req.params;

    if (tryParseInt(crc, -1) !== CrcTable[4]) {
        reply.status(404);
        return;
    }

    reply.send(OnDemand.cache.read(0, 4));
});

fastify.get<{ Params: { crc: string } }>('/versionlist:crc', async (req, reply) => {
    const { crc } = req.params;

    if (tryParseInt(crc, -1) !== CrcTable[5]) {
        reply.status(404);
        return;
    }

    reply.send(OnDemand.cache.read(0, 5));
});

fastify.get<{ Params: { crc: string } }>('/textures:crc', async (req, reply) => {
    const { crc } = req.params;

    if (tryParseInt(crc, -1) !== CrcTable[6]) {
        reply.status(404);
        return;
    }

    reply.send(OnDemand.cache.read(0, 6));
});

fastify.get<{ Params: { crc: string } }>('/wordenc:crc', async (req, reply) => {
    const { crc } = req.params;

    if (tryParseInt(crc, -1) !== CrcTable[7]) {
        reply.status(404);
        return;
    }

    reply.send(OnDemand.cache.read(0, 7));
});

fastify.get<{ Params: { crc: string } }>('/sounds:crc', async (req, reply) => {
    const { crc } = req.params;

    if (tryParseInt(crc, -1) !== CrcTable[8]) {
        reply.status(404);
        return;
    }

    reply.send(OnDemand.cache.read(0, 8));
});

fastify.register(FastifyStatic, {
    root: path.join(process.cwd(), 'public')
});

export async function startWeb() {
    if (!isProxyProtocolEnabled()) {
        await fastify.listen({ port: Environment.WEB_PORT, host: '0.0.0.0' });
        return;
    }

    // custom (2026-09-27) - behind a proxy that sends PROXY protocol (server/ProxyProtocol.ts). The web
    // server does not listen itself: this does, takes the header off a proxied connection, and hands
    // the socket on carrying the player's address - which is what req.socket.remoteAddress (the
    // WebSocket game connection, ConnectionLimiter) and req.ip read.
    await fastify.ready();
    const server = net.createServer(socket => {
        socket.on('error', () => socket.destroy());

        if (!isTrustedProxy(normalizeAddress(socket.remoteAddress))) {
            fastify.server.emit('connection', socket);
            return;
        }

        readProxyHeader(socket).then(player => {
            if (player === null) {
                return;
            }

            Object.defineProperty(socket, 'remoteAddress', { value: player, configurable: true });
            // Node's HTTP server normally reads the socket's handle directly, which would jump ahead of
            // the bytes readProxyHeader put back. Marked consumed, it reads them through the stream, in order.
            const handle = (socket as unknown as { _handle?: { _consumed?: boolean } })._handle;
            if (handle) {
                handle._consumed = true;
            }
            fastify.server.emit('connection', socket);
            socket.resume();
        });
    });

    await new Promise<void>(resolve => server.listen(Environment.WEB_PORT, '0.0.0.0', resolve));
}

// management routes

const management = Fastify();

management.register(FastifyView, {
    engine: {
        ejs
    },
    root: 'view'
});

management.get('/prometheus', async (_req, reply) => {
    reply.header('Content-Type', register.contentType);
    return register.metrics();
});

// custom (2026-09-21) - a timed restart from the server's own shell (content/tools/restart.sh):
// the "System update in" countdown every client draws, a line in chat, and a clean shutdown when it
// runs out - the same as ::slowreboot, without needing to be logged in. Loopback only: anyone who
// can reach this port from outside must not be able to take the world down.
// req.ip is the socket's address (no trustProxy), so a header cannot fake it - but a reverse proxy on
// this machine would make every request loopback. Never put one in front of the management port.
management.post<{ Querystring: { seconds?: string } }>('/reboot', async (req, reply) => {
    if (req.ip !== '127.0.0.1' && req.ip !== '::1' && req.ip !== '::ffff:127.0.0.1') {
        return reply.code(403).send('loopback only\n');
    }
    const seconds = Math.max(5, Math.min(3600, parseInt(req.query.seconds ?? '60', 10) || 60));
    if (World.isPendingShutdown) {
        return reply.code(409).send(`a restart is already under way: ${Math.round((World.shutdownTicksRemaining * 600) / 1000)}s left\n`);
    }
    const ticks = Math.ceil((seconds * 1000) / 600);
    World.rebootTimer(ticks);
    const when = seconds % 60 === 0 ? `${seconds / 60} minute${seconds === 60 ? '' : 's'}` : `${seconds} seconds`;
    World.broadcastMes(`@red@The server will restart in ${when}. Please find a safe place to log out.`);
    return reply.send(`restart in ${seconds}s (${ticks} ticks)\n`);
});

export async function startManagementWeb() {
    await management.listen({ port: Environment.WEB_MANAGEMENT_PORT, host: Environment.WEB_MANAGEMENT_HOST });
}
