// How many server messages one client is sent in a tick, and whether that figure is trustworthy.
//
// WHY THIS NUMBER AND NOT BYTES. The 377 client parses its socket inside update(), which the shell
// runs once per loop iteration (GameShell.run, paced at deltime = 20ms), and takes at most five
// packets per call:
//
//     for (int i = 0; i < 5 && this.readPacket(); i++) {
//
// About 250 messages a second, or 150 in a 600ms tick. Under that the backlog clears inside the
// tick; over it the backlog grows every tick and the client falls further behind the world for as
// long as it stays there. Bytes cannot answer that: one 40 KB packet is fine, two hundred 20-byte
// ones are not.
//
// A SIM PLAYER CANNOT TEST THIS. harness.makePlayer builds a plain Player, so isClientConnected is
// false and writeInner - the one funnel every server message goes through, and where the count is
// taken - never runs for it. So this builds a real NetworkPlayer on a socket that counts what it
// is handed and throws it away, which is also the independent check: the engine's count has to
// agree with the number of sends the socket actually saw.
//
// Usage: NODE_PRODUCTION=true npx tsx tools/sim/packetcount.ts
import * as H from './harness.js';
import World from '#/engine/World.js';
import { WorldStat } from '#/engine/WorldStat.js';
import { NetworkPlayer } from '#/engine/entity/NetworkPlayer.js';
import MessageGame from '#/network/game/server/model/MessageGame.js';
import ClientSocket from '#/server/ClientSocket.js';
import { toBase37 } from '#/util/JString.js';

await H.boot();

const R = { ok: 0, bad: 0 };
const check = (what: string, got: unknown, want: unknown) => {
    const pass = JSON.stringify(got) === JSON.stringify(want);
    if (pass) R.ok++;
    else R.bad++;
    console.log(`  ${pass ? 'ok  ' : 'FAIL'} ${what}: ${JSON.stringify(got)}${pass ? '' : `   (want ${JSON.stringify(want)})`}`);
};

/** A socket that keeps the tally and the bytes, and sends nothing anywhere. */
class CountingSocket extends ClientSocket {
    sends = 0;
    bytes = 0;

    send(src: Uint8Array): void {
        this.sends++;
        this.bytes += src.length;
    }

    read(_dest: Uint8Array, _offset: number, _length: number): boolean {
        return false;
    }

    get bufferedBytes(): number {
        return 0;
    }

    close(): void {
        // no-op
    }

    terminate(): void {
        // no-op
    }
}

function join(name: string, address: string = '127.0.0.1'): { player: NetworkPlayer; socket: CountingSocket } {
    const socket = new CountingSocket();
    socket.remoteAddress = address;
    const player = new NetworkPlayer(name, toBase37(name), BigInt(Math.floor(Math.random() * 1e9)), socket);
    player.teleport(3222, 3222, 0);
    World.newPlayers.add(player);
    return { player, socket };
}

const a = join('packetcount1');
const b = join('packetcount2');

// log them in, then let the world settle: a login sends the map, every inventory and every stat,
// so its own tick is nothing like a quiet one and is no basis for a baseline.
World.cycle();
check('a client on a real socket is seen as connected', [a.player instanceof NetworkPlayer, a.socket.sends > 0], [true, true]);
check('...and the login tick is counted, not reported as nothing', World.cycleStats[WorldStat.PACKETS_OUT_MAX] > 25, true);
H.tick(5);

// ---- the baseline. Whatever a settled, idle client is sent each tick.
World.cycle();
const idle = World.cycleStats[WorldStat.PACKETS_OUT_MAX];
check('an idle client is sent far fewer than the 150 a tick it can drain', idle < 150, true);

// ---- a known burst on top of it, counted two ways
const BURST = 40;
const before = a.socket.sends;
for (let i = 0; i < BURST; i++) {
    a.player.write(new MessageGame(`burst ${i}`));
}
check('the socket saw every message of the burst', a.socket.sends - before, BURST);
World.cycle();
check('and the tick reports the burst on top of the idle traffic', World.cycleStats[WorldStat.PACKETS_OUT_MAX], idle + BURST);

// ---- it is a per-tick figure, so the next tick must not carry it
World.cycle();
check('the count is cleared between ticks', World.cycleStats[WorldStat.PACKETS_OUT_MAX], idle);

// ---- the MOST to any one client, not the total across them: two clients at 30 and 10 are not 40.
// A total would read as one client in trouble when neither is.
for (let i = 0; i < 30; i++) {
    a.player.write(new MessageGame(`a ${i}`));
}
for (let i = 0; i < 10; i++) {
    b.player.write(new MessageGame(`b ${i}`));
}
World.cycle();
check('two clients report the busiest one, not their sum', World.cycleStats[WorldStat.PACKETS_OUT_MAX], idle + 30);

// ---- and the stat can hold the figures it is given. BANDWIDTH_OUT lives in this same array and
// counts BYTES per tick: at Uint16 it wrapped at 65535, which is 150 packets of 437, so a busy tick
// under-reported by whole multiples of 64 KB with nothing to say it had.
World.cycleStats[WorldStat.BANDWIDTH_OUT] = 70000;
check('a tick over 64 KB out is not wrapped away (was 4464)', World.cycleStats[WorldStat.BANDWIDTH_OUT], 70000);
World.cycleStats[WorldStat.PACKETS_OUT_MAX] = 70000;
check('...and neither is a packet count that large', World.cycleStats[WorldStat.PACKETS_OUT_MAX], 70000);

// ---- A CLIENT WHOSE ADDRESS CANNOT BE READ IS STILL A CLIENT. normalizeAddress answers 'unknown'
// for a socket with no remoteAddress (Node gives that for one destroyed before the connection event
// is handled), and World.processLogins buckets the player loop by address: the IPv4 branch wants a
// '.', the IPv6 branch a ':', and 'unknown' has neither. With no bucket the player was never added
// to the loop at all - logged in and then never ticked, which is how this test found it, reporting
// 0 packets for a client whose socket had plainly been handed 484.
const ghost = join('packetcount3', 'unknown');
World.cycle();
const inLoop = [...World.playerLoop.all()].filter(p => p === ghost.player).length;
check('a client with an unreadable address is still put in the player loop', inLoop, 1);
H.tick(3);
const seen = ghost.socket.sends;
H.tick(1);
check('...so the world keeps sending to it', ghost.socket.sends > seen, true);

console.log(`  (an idle client is sent ${idle} packet${idle === 1 ? '' : 's'} a tick; the client drains about 150)`);
console.log(`\n${R.ok} ok, ${R.bad} failed`);
process.exit(R.bad > 0 ? 1 : 0);
