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

import ServerGameProt from '#/network/game/server/ServerGameProt.js';
import ServerGameZoneProt from '#/network/game/server/ServerGameZoneProt.js';

import OnDemand from '#/engine/OnDemand.js';
import World from '#/engine/World.js';

import NullClientSocket from '#/server/NullClientSocket.js';

import { LoggerEventType } from '#/server/logger/LoggerEventType.js';

import WSClientSocket from '#/server/ws/WSClientSocket.js';
import ConnectionLimiter, { HANDSHAKE_TIMEOUT_MS, normalizeAddress } from '#/server/ConnectionLimiter.js';
import { isProxyProtocolEnabled, isTrustedProxy, readProxyHeader } from '#/server/ProxyProtocol.js';

import { printInfo, printWarning } from '#/util/Logger.js';
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

// ------------------------------------------------------------------- the web client
//
// THE BROWSER PLAYS THE REAL CLIENT (2026-10-06). public/client.jar is the jar the launcher
// installs, and CheerpJ - a JVM compiled to WebAssembly - runs it in the tab. That is the whole
// design: there is one client, built from Client-Java, and the browser gets the same one rather
// than a second implementation of the protocol that has to be kept in step with it forever.
//
// It replaces public/client/client.js, which came with the server and is a web client for another
// game revision: it announces 274 at login where this server takes ENGINE_REVISION, and it frames
// 116 of the 256 server packets differently. The check further down still reads whatever bundle is
// there and says so, and that page is only served if a bundle ever turns up that agrees with us.
//
// WHAT THE PAGE HAS TO SUPPLY is a socket. A tab cannot open TCP, so jagex2/io/WsSocket.java asks
// the page for one through four CheerpJ natives, and the page gives it a WebSocket to this same
// server - the route at '/' above, which already carries both the login stream and the update
// stream and tells them apart by the first byte. lostcity.ws is what turns that path on inside the
// client; a desktop client never sets it.

// THE CLIENT IS 765 BY 503 and takes that from the canvas: it calls getElementById('canvas') and
// never sets a size. The page on live had the two the wrong way round, which drew the game into a
// tall narrow strip with most of it cut off.
const WEB_CLIENT_WIDTH = 765;
const WEB_CLIENT_HEIGHT = 503;

const LAUNCHER_URL = 'https://github.com/coreysho/DeathPlateau-Client/releases/latest/download/Death-Plateau-Launcher.jar';

const clientJarPath = path.join(process.cwd(), 'public', 'client.jar');
const hasClientJar = existsSync(clientJarPath);

// The page that runs client.jar. Everything in it is this file's, so a change to the natives and a
// change to WsSocket.java are one commit apart rather than one hand-edit on the server apart.
const CHEERPJ_PAGE = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Death Plateau</title>
<style>
  html, body { margin: 0; padding: 0; background: #000; color: #9a9a9a; font: 12px sans-serif; overflow: hidden; }
  #display { margin: 0 auto; width: ${WEB_CLIENT_WIDTH}px; height: ${WEB_CLIENT_HEIGHT}px; }
  #foot { text-align: center; padding: 6px; }
  #foot a { color: #c8a04a; }
</style>
<script src="https://cjrtnc.leaningtech.com/4.3/loader.js"></script>
</head>
<body>
<div id="display"></div>
<div id="foot">The browser client is slower than the real thing. <a href="${LAUNCHER_URL}">Download the launcher</a> to play properly.</div>
<script>
// A BROWSER TAB HAS NO TCP. jagex2/io/WsSocket.java declares these four as native and this is where
// they are implemented - CheerpJ looks for a function named Java_<class with dots as underscores>_<method>.
// They are async because CheerpJ awaits them, which is also what makes a blocking read work: the
// Java thread waits inside wsRead while the browser's event loop keeps running underneath it.
//
// Bytes cross as base64 because a string is the one thing documented to survive the boundary
// unchanged. The game stream is a few kilobytes a second, so the encoding is free in practice.
const SOCKETS = new Map();
let NEXT_SOCKET = 1;

function wake(s) {
    if (s.wake) { const w = s.wake; s.wake = null; w(); }
}

const natives = {
    async Java_jagex2_io_WsSocket_wsOpen(lib, url) {
        const ws = new WebSocket(url);
        ws.binaryType = 'arraybuffer';
        const s = { ws: ws, chunks: [], size: 0, closed: false, wake: null };
        ws.onmessage = e => {
            const b = new Uint8Array(e.data);
            s.chunks.push(b);
            s.size += b.length;
            wake(s);
        };
        ws.onclose = () => { s.closed = true; wake(s); };
        ws.onerror = () => { s.closed = true; wake(s); };
        const open = await new Promise(resolve => {
            if (ws.readyState === WebSocket.OPEN) { resolve(true); return; }
            ws.onopen = () => resolve(true);
            ws.addEventListener('close', () => resolve(false));
            setTimeout(() => resolve(ws.readyState === WebSocket.OPEN), 15000);
        });
        if (!open) return -1;
        const id = NEXT_SOCKET++;
        SOCKETS.set(id, s);
        return id;
    },

    // "" is "nothing yet", null is "this socket is gone" - the two things the Java side has to be
    // able to tell apart, since one is a wait and the other is an IOException.
    async Java_jagex2_io_WsSocket_wsRead(lib, handle, max, waitMillis) {
        const s = SOCKETS.get(handle);
        if (!s) return null;
        if (s.size === 0 && !s.closed && waitMillis > 0) {
            await new Promise(resolve => {
                s.wake = resolve;
                setTimeout(() => { if (s.wake === resolve) { s.wake = null; resolve(); } }, waitMillis);
            });
        }
        if (s.size === 0) return s.closed ? null : '';
        const out = new Uint8Array(Math.min(max, s.size));
        let n = 0;
        while (n < out.length) {
            const head = s.chunks[0];
            const take = Math.min(head.length, out.length - n);
            out.set(head.subarray(0, take), n);
            n += take;
            if (take === head.length) s.chunks.shift(); else s.chunks[0] = head.subarray(take);
            s.size -= take;
        }
        let bin = '';
        for (let i = 0; i < out.length; i++) bin += String.fromCharCode(out[i]);
        return btoa(bin);
    },

    async Java_jagex2_io_WsSocket_wsWrite(lib, handle, base64) {
        const s = SOCKETS.get(handle);
        if (!s || s.closed) return;
        const bin = atob(base64);
        const bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        s.ws.send(bytes);
    },

    async Java_jagex2_io_WsSocket_wsClose(lib, handle) {
        const s = SOCKETS.get(handle);
        if (!s) return;
        s.closed = true;
        SOCKETS.delete(handle);
        try { s.ws.close(); } catch (e) { /* already gone */ }
    }
};

(async function () {
    const port = location.port || (location.protocol === 'https:' ? '443' : '80');
    const ws = (location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + '/';
    await cheerpjInit({
        version: 8,
        natives: natives,
        // The client reads its server from these (Client.SERVER_HOST and friends). Everything it
        // needs - the cache archives and the game stream both - is this same origin, so the page
        // tells it where it is rather than leaving it pointed at whatever the jar was built with.
        javaProperties: [
            'lostcity.host=' + location.hostname,
            'lostcity.webhost=' + location.hostname,
            'lostcity.webport=' + port,
            'lostcity.ws=' + ws,
            // CheerpJ keeps /files in the browser's own storage, so the client's file store
            // survives a reload and the animations and models are downloaded once rather than
            // every visit. signlink.findcachedir reads this.
            'lostcity.cachedir=/files/.deathplateau'
        ]
    });
    cheerpjCreateDisplay(${WEB_CLIENT_WIDTH}, ${WEB_CLIENT_HEIGHT}, document.getElementById('display'));
    await cheerpjRunMain('jagex2.client.Client', '/app/client.jar');
})();
</script>
</body>
</html>
`;

// Served when there is no client.jar and no usable bundle: the launcher is the way in, and a page
// that says so is better than one that loads a client which cannot log in.
const LAUNCHER_PAGE = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Death Plateau</title>
<style>
  html, body { margin: 0; padding: 0; height: 100%; background: #0b0b0d; color: #d8d8d8;
               font: 15px/1.6 sans-serif; display: flex; align-items: center; justify-content: center; }
  main { max-width: 32em; padding: 2em; text-align: center; }
  h1 { font-size: 1.6em; margin: 0 0 .2em; color: #e8e8e8; }
  p.slogan { color: #8d8d8d; margin: 0 0 2em; }
  a.get { display: inline-block; padding: .7em 1.4em; background: #c8a04a; color: #1a1a1a;
          text-decoration: none; border-radius: 3px; font-weight: bold; }
  p.small { color: #777; font-size: .9em; margin-top: 2em; }
</style>
</head>
<body>
<main>
<h1>Death Plateau</h1>
<p class="slogan">The true golden era.</p>
<p>The game runs from the launcher - it keeps itself up to date and plays at full speed.</p>
<p><a class="get" href="${LAUNCHER_URL}">Download the launcher</a></p>
<p class="small">Java is required. There is no browser client on this world right now.</p>
</main>
</body>
</html>
`;

// Served when public/rs2.cgi is missing and a usable bundle is present.
const DEFAULT_RS2CGI = `<!DOCTYPE html>
<html>
<head>
<title>Death Plateau</title>
<style>
  html, body { margin: 0; padding: 0; background: #000; overflow: hidden; }
  canvas { display: block; margin: 0 auto; image-rendering: pixelated; }
</style>
</head>
<body>
<canvas id="canvas" width="${WEB_CLIENT_WIDTH}" height="${WEB_CLIENT_HEIGHT}"></canvas>
<script type="module">
  import { Client } from '/client/client.js';
  new Client(${Environment.NODE_ID}, false, ${Environment.NODE_MEMBERS});
</script>
</body>
</html>
`;

// COMPONENT TYPE 8 is a 377 interface component that holds one string, and this content uses it -
// the combat tab's Auto Retaliate area is one. The Java client reads it (jagex2/config/Component.java)
// and so does the server (cache/config/Component.ts), but an older web client bundle has no branch
// for it: it reads the type, falls through every case without consuming the string, and from there
// every following component is read out of the middle of the one before. It dies about two thirds of
// the way through with "Unpacking interfaces 95%: Offset is outside the bounds of the DataView" and
// the game never loads at all. tools/sim/ifunpack.ts walks the archive the same way and names it.
//
// So a bundle that cannot read this cache is repaired on the way out. The anchor is the end of the
// type 7 block, which is where the string belongs; a bundle that already handles type 8, or one
// minified differently enough that the anchor is gone, is served exactly as it is and says so.
const WEB_CLIENT_COM8_ANCHOR = '0===T.Ml[N].length&&(T.Ml[N]=null)}2!==T.Rm&&2!==T.type||(';
const WEB_CLIENT_COM8_PATCH = '0===T.Ml[N].length&&(T.Ml[N]=null)}8===T.type&&(T.text=t.xa()),2!==T.Rm&&2!==T.type||(';

const clientJsPath = path.join(process.cwd(), 'public', 'client', 'client.js');
let bundleCanPlay = false;
if (existsSync(clientJsPath)) {
    let clientJs = readFileSync(clientJsPath, 'utf8');
    if (clientJs.includes('8===T.type')) {
        printInfo('web client: reads interface component type 8 already');
    } else if (clientJs.includes(WEB_CLIENT_COM8_ANCHOR)) {
        clientJs = clientJs.replace(WEB_CLIENT_COM8_ANCHOR, WEB_CLIENT_COM8_PATCH);
        printWarning('web client: patched in interface component type 8, which this bundle could not read');
    } else {
        printWarning('web client: cannot tell whether this bundle reads interface component type 8 - if it will not load past "Unpacking interfaces", that is why');
    }

    // WHICH CLIENT THIS IS. The bundle is not built from this repository - it came with the server
    // and is maintained nowhere - so the only way to know whether it can play here is to read it.
    // Two things in it say so, and both have cost an evening:
    //
    //   THE BUILD HANDSHAKE it sends at login (`p1(255), p2(<rev>)`), which World.onClientData
    //   compares with ENGINE_REVISION and refuses with response 6. The client then shows "has been
    //   updated! Please reload this page", which reads like a stale cache and is not one: the
    //   bundle sends that same number every time, so no reload can fix it.
    //
    //   ITS TABLE OF SERVER PACKET LENGTHS, which is what frames the stream. A bundle that
    //   disagrees here cannot be let in by relaxing the revision - it would read one packet out of
    //   the middle of another the first time the server sent one it frames differently.
    const rev = /p1\(255\),\s*[\w$.]+\.p2\((\d+)\)/.exec(clientJs);
    const revOk = rev !== null && Number(rev[1]) === Environment.ENGINE_REVISION;
    if (!rev) {
        printWarning('web client: cannot find the build handshake in this bundle');
    } else if (!revOk) {
        printWarning(`web client: this bundle logs in as revision ${rev[1]} and the server takes only ${Environment.ENGINE_REVISION} - every login is refused with "has been updated, please reload this page", and reloading cannot help`);
    }
    // The longest numeric array literal in the bundle is that packet length table.
    const arrays = clientJs.match(/\[-?\d+(?:,-?\d+){200,}\]/g) ?? [];
    const table = arrays.map(a => JSON.parse(a) as number[]).sort((a, b) => b.length - a.length)[0];
    let protOk = false;
    if (table) {
        const ours: number[] = new Array(256).fill(0);
        for (const prot of Object.values(ServerGameProt)) {
            if (prot instanceof ServerGameProt) ours[prot.id] = prot.length;
        }
        for (const prot of Object.values(ServerGameZoneProt)) {
            if (prot instanceof ServerGameZoneProt) ours[prot.id] = prot.length;
        }
        let differ = 0;
        for (let i = 0; i < 256; i++) {
            if ((table[i] ?? 0) !== ours[i]) differ++;
        }
        protOk = differ === 0;
        if (differ > 0) {
            printWarning(`web client: this bundle frames ${differ} of 256 server packets differently - it is a client for another revision and cannot play here, whatever it is allowed to log in as`);
        }
    }
    bundleCanPlay = revOk && protOk;

    const patched = clientJs;
    fastify.get('/client/client.js', (_req, reply) => {
        reply.type('text/javascript').send(patched);
    });
}

// WHAT THE FRONT PAGE IS, in the order of what can actually be played: the real client under
// CheerpJ, else a bundle that agrees with this server's protocol, else the launcher.
let rs2cgiHtml: string;
if (hasClientJar) {
    rs2cgiHtml = CHEERPJ_PAGE;
    printInfo('web client: serving public/client.jar through CheerpJ');
} else if (bundleCanPlay) {
    const rs2cgiPath = path.join(process.cwd(), 'public', 'rs2.cgi');
    rs2cgiHtml = existsSync(rs2cgiPath) ? readFileSync(rs2cgiPath, 'utf8') : DEFAULT_RS2CGI;

    const canvas = /<canvas[^>]*\swidth="(\d+)"[^>]*\sheight="(\d+)"/.exec(rs2cgiHtml);
    if (canvas && (canvas[1] !== String(WEB_CLIENT_WIDTH) || canvas[2] !== String(WEB_CLIENT_HEIGHT))) {
        printWarning(`public/rs2.cgi declares a ${canvas[1]}x${canvas[2]} canvas; the client draws ${WEB_CLIENT_WIDTH}x${WEB_CLIENT_HEIGHT} - serving a corrected page`);
        rs2cgiHtml = rs2cgiHtml.replace(canvas[0], canvas[0]
            .replace(`width="${canvas[1]}"`, `width="${WEB_CLIENT_WIDTH}"`)
            .replace(`height="${canvas[2]}"`, `height="${WEB_CLIENT_HEIGHT}"`));
    }
} else {
    rs2cgiHtml = LAUNCHER_PAGE;
    printWarning('web client: no public/client.jar and no bundle that can play here - serving the launcher page instead');
}
fastify.get('/rs2.cgi', (_req, reply) => {
    reply.type('text/html').send(rs2cgiHtml);
});


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
