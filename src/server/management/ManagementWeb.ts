import ejs from 'ejs';
import Fastify from 'fastify';
import FastifyView from '@fastify/view';
import { register } from 'prom-client';

import World from '#/engine/World.js';

import Environment from '#/util/Environment.js';

// THE MANAGEMENT PORT, on its own and not in web.ts (2026-10-07). It used to live there, and the
// login server imports startManagementWeb - which, when the login server runs as a worker thread,
// re-ran the WHOLE of web.ts inside that worker: a second Fastify with the static, view and
// websocket plugins, the player-facing routes registered again, the CheerpJ page built again, and
// public/client.jar and public/client/client.js read off the disk and examined a second time. A
// worker has its own module graph, so none of it was shared with the main thread; the only sign
// was every web-client line in the startup log appearing twice.
//
// Two servers that have nothing to do with each other: this one is loopback-only control for
// whoever is on the machine, that one is the game and its cache for players.

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
