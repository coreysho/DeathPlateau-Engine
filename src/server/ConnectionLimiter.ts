import Environment from '#/util/Environment.js';

// custom (2026-09-27) - there was no limit on sockets at all. Each one costs ~95 KB of buffers before
// it has sent a byte (ClientSocket), so a few thousand idle connections from one machine were enough
// to eat the server's memory. This caps sockets per address and in total, for TCP and WebSocket both.
// A player uses one or two (game + ondemand), so the per-address cap still fits a household.

// how long a socket may take from connect to a finished login before it is dropped
export const HANDSHAKE_TIMEOUT_MS = 30_000;

// ::ffff:1.2.3.4 is the same machine as 1.2.3.4 - one key for both, and it matches ipban rows
export function normalizeAddress(address: string | undefined): string {
    if (!address) {
        return 'unknown';
    }

    return address.startsWith('::ffff:') ? address.substring(7) : address;
}

class ConnectionLimiter {
    private perAddress: Map<string, number> = new Map();
    private total = 0;

    tryAcquire(address: string): boolean {
        if (Environment.NODE_MAX_SOCKETS > 0 && this.total >= Environment.NODE_MAX_SOCKETS) {
            return false;
        }

        const count = this.perAddress.get(address) ?? 0;
        if (Environment.NODE_MAX_SOCKETS_PER_IP > 0 && count >= Environment.NODE_MAX_SOCKETS_PER_IP) {
            return false;
        }

        this.perAddress.set(address, count + 1);
        this.total++;
        return true;
    }

    release(address: string) {
        const count = this.perAddress.get(address);
        if (count === undefined) {
            return;
        }

        if (count <= 1) {
            this.perAddress.delete(address);
        } else {
            this.perAddress.set(address, count - 1);
        }
        this.total--;
    }
}

export default new ConnectionLimiter();
