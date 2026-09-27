import net from 'net';

import { normalizeAddress } from '#/server/ConnectionLimiter.js';
import Environment from '#/util/Environment.js';

// custom (2026-09-27) - PROXY protocol (v1 and v2, as HAProxy, nginx and tunnel services send it).
// Behind a tunnel or a VPS every connection comes from the proxy, so every player would share one
// address - one per-IP socket cap, one login rate limit, and IP bans that ban everyone. A proxy that
// speaks PROXY protocol puts the player's real address in front of the stream instead.
//
// Only connections FROM an address in PROXY_PROTOCOL_FROM are expected to carry the header, and they
// must - one without it is dropped. Anyone else connects as before, with their socket address, so a
// player cannot claim an address by sending a header of their own.

const HEADER_TIMEOUT_MS = 5000;
const V1_MAX = 107; // "PROXY TCP6 <39> <39> <5> <5>\r\n"
const V2_SIGNATURE = Buffer.from([0x0d, 0x0a, 0x0d, 0x0a, 0x00, 0x0d, 0x0a, 0x51, 0x55, 0x49, 0x54, 0x0a]);

type Cidr = { base: number; mask: number } | { exact: string };

function parseIpv4(address: string): number | null {
    const parts = address.split('.');
    if (parts.length !== 4) {
        return null;
    }

    let value = 0;
    for (const part of parts) {
        const n = Number(part);
        if (!/^\d{1,3}$/.test(part) || n > 255) {
            return null;
        }
        value = (value << 8) | n;
    }
    return value >>> 0;
}

function parseTrusted(list: string): Cidr[] {
    const out: Cidr[] = [];
    for (const raw of list.split(',')) {
        const entry = raw.trim();
        if (!entry) {
            continue;
        }

        const [ip, bitsText] = entry.split('/');
        const base = parseIpv4(ip);
        if (base !== null && bitsText !== undefined) {
            const bits = Math.max(0, Math.min(32, Number(bitsText)));
            const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
            out.push({ base: (base & mask) >>> 0, mask });
        } else {
            out.push({ exact: normalizeAddress(ip) });
        }
    }
    return out;
}

const trusted = parseTrusted(Environment.PROXY_PROTOCOL_FROM);

export function isProxyProtocolEnabled(): boolean {
    return trusted.length > 0;
}

export function isTrustedProxy(address: string): boolean {
    const normalized = normalizeAddress(address);
    const v4 = parseIpv4(normalized);

    for (const entry of trusted) {
        if ('exact' in entry) {
            if (entry.exact === normalized) {
                return true;
            }
        } else if (v4 !== null && (v4 & entry.mask) >>> 0 === entry.base) {
            return true;
        }
    }
    return false;
}

type Parsed = { address: string | null; length: number } | 'incomplete' | 'invalid';

// address null = a LOCAL / UNKNOWN connection (a health check from the proxy itself): keep the socket's
function parseHeader(buf: Buffer): Parsed {
    if (buf.length >= 1 && buf[0] === 0x0d) {
        if (buf.length < 16) {
            return V2_SIGNATURE.subarray(0, buf.length).equals(buf.subarray(0, Math.min(buf.length, 12))) ? 'incomplete' : 'invalid';
        }
        if (!buf.subarray(0, 12).equals(V2_SIGNATURE) || buf[12] >> 4 !== 2) {
            return 'invalid';
        }

        const length = 16 + buf.readUInt16BE(14);
        if (buf.length < length) {
            return 'incomplete';
        }

        const command = buf[12] & 0x0f;
        const family = buf[13] >> 4;
        if (command === 0x0) {
            return { address: null, length };
        }
        if (command !== 0x1) {
            return 'invalid';
        }

        if (family === 0x1 && length >= 16 + 12) {
            return { address: Array.from(buf.subarray(16, 20)).join('.'), length };
        }
        if (family === 0x2 && length >= 16 + 36) {
            const groups: string[] = [];
            for (let i = 0; i < 8; i++) {
                groups.push(buf.readUInt16BE(16 + i * 2).toString(16));
            }
            return { address: groups.join(':'), length };
        }
        return { address: null, length };
    }

    const end = buf.indexOf('\r\n');
    if (end === -1) {
        return buf.length < V1_MAX && 'PROXY '.startsWith(buf.subarray(0, 6).toString('latin1')) ? 'incomplete' : 'invalid';
    }

    const line = buf.subarray(0, end).toString('latin1');
    const parts = line.split(' ');
    if (parts[0] !== 'PROXY') {
        return 'invalid';
    }
    if (parts[1] === 'UNKNOWN') {
        return { address: null, length: end + 2 };
    }
    if ((parts[1] !== 'TCP4' && parts[1] !== 'TCP6') || parts.length !== 6 || net.isIP(parts[2]) === 0) {
        return 'invalid';
    }
    return { address: parts[2], length: end + 2 };
}

/**
 * Read the PROXY header off the front of a socket from a trusted proxy. Resolves with the player's
 * address, the socket left paused with whatever followed the header put back to be read again - or
 * with null, the socket destroyed, when the header is missing, broken or too slow.
 */
export function readProxyHeader(socket: net.Socket): Promise<string | null> {
    return new Promise(resolve => {
        let buf = Buffer.alloc(0);

        const finish = (address: string | null) => {
            clearTimeout(timer);
            socket.off('data', onData);
            socket.off('close', onClose);
            socket.off('error', onClose);
            if (address === null) {
                socket.destroy();
            }
            resolve(address);
        };

        const onData = (data: Buffer) => {
            buf = Buffer.concat([buf, data]);
            const parsed = parseHeader(buf);
            if (parsed === 'incomplete') {
                return;
            }
            if (parsed === 'invalid') {
                finish(null);
                return;
            }

            socket.pause();
            const rest = buf.subarray(parsed.length);
            if (rest.length > 0) {
                socket.unshift(rest);
            }
            finish(normalizeAddress(parsed.address ?? socket.remoteAddress));
        };

        const onClose = () => finish(null);
        const timer = setTimeout(() => finish(null), HEADER_TIMEOUT_MS);

        socket.on('data', onData);
        socket.on('close', onClose);
        // without a listener an error on this socket would be thrown at the process
        socket.on('error', onClose);
    });
}
