import net from 'net';

import World from '#/engine/World.js';
import { LoggerEventType } from '#/server/logger/LoggerEventType.js';
import NullClientSocket from '#/server/NullClientSocket.js';
import TcpClientSocket from '#/server/tcp/TcpClientSocket.js';
import Environment from '#/util/Environment.js';
import OnDemand from '#/engine/OnDemand.js';
import ConnectionLimiter, { HANDSHAKE_TIMEOUT_MS, normalizeAddress } from '#/server/ConnectionLimiter.js';
import { isTrustedProxy, readProxyHeader } from '#/server/ProxyProtocol.js';

export default class TcpServer {
    tcp: net.Server;

    constructor() {
        this.tcp = net.createServer();
    }

    start() {
        this.tcp.on('connection', (s: net.Socket) => {
            const address = normalizeAddress(s.remoteAddress);

            if (isTrustedProxy(address)) {
                // from the tunnel/proxy: the player's own address is in the PROXY header in front
                readProxyHeader(s).then(player => {
                    if (player !== null) {
                        this.accept(s, player);
                        s.resume();
                    }
                });
                return;
            }

            this.accept(s, address);
        });

        this.tcp.listen(Environment.NODE_PORT, '0.0.0.0', () => {});
    }

    private accept(s: net.Socket, address: string) {
        if (!ConnectionLimiter.tryAcquire(address)) {
            s.destroy();
            return;
        }

        s.setTimeout(30000);
        s.setNoDelay(true);

        const client = new TcpClientSocket(s, address);

        // the idle timeout alone can be held off forever by a byte every 25 seconds
        const handshakeDeadline = setTimeout(() => {
            if (client.state === 0) {
                client.terminate();
            }
        }, HANDSHAKE_TIMEOUT_MS);

        s.on('data', (data: Buffer) => {
            try {
                if (client.state === -1 || client.remaining <= 0) {
                    client.terminate();
                    return;
                }

                client.buffer(data);

                if (client.state === 0) {
                    World.onClientData(client);
                } else {
                    OnDemand.onClientData(client);
                }
            } catch (_) {
                client.terminate();
            }
        });

        s.on('close', () => {
            clearTimeout(handshakeDeadline);
            ConnectionLimiter.release(address);
            client.state = -1;
            OnDemand.onClientClosed(client);

            if (client.player) {
                client.player.addSessionLog(LoggerEventType.ENGINE, 'TCP socket closed');
                client.player.client = new NullClientSocket();
            }
        });

        s.on('error', err => {
            if (client.player) {
                client.player.addSessionLog(LoggerEventType.ENGINE, 'TCP socket error', err.message);
            }

            s.destroy();
        });

        s.on('timeout', () => {
            if (client.player) {
                client.player.addSessionLog(LoggerEventType.ENGINE, 'TCP socket timeout');
            }

            s.destroy();
        });
    }
}
