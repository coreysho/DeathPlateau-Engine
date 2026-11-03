import Player from '#/engine/entity/Player.js';
import { isClientConnected } from '#/engine/entity/NetworkPlayer.js';
import ClientGameMessageHandler from '#/network/game/client/ClientGameMessageHandler.js';
import Pong from '#/network/game/client/model/Pong.js';
import { trackPlayerPing } from '#/server/Metrics.js';
import Environment from '#/util/Environment.js';

export default class PongHandler extends ClientGameMessageHandler<Pong> {
    handle(message: Pong, player: Player): boolean {
        // Only the ping that is actually outstanding counts. A duplicate, a late answer to a ping
        // already written off, or a made-up sequence number is ignored rather than recorded as a
        // round trip of nonsense.
        if (player.pingSentAt === -1 || message.seq !== player.pingSeq) {
            return false;
        }

        // When THIS ANSWER landed, not when this tick got round to reading it - input is read once
        // a tick, so Date.now() here would make every round trip look like a whole tick. Nor when
        // the batch holding it began: a client being played sends mouse and camera packets
        // continuously, so that stamp usually belonged to an earlier one and reported 1-2 ms on a
        // 30 ms connection. See ClientSocket.packetArrival. Falls back to now if nothing timed it.
        const arrived = isClientConnected(player) && player.client.packetArrival > 0 ? player.client.packetArrival : Date.now();
        player.pingMs = Math.max(0, Math.min(0xfffe, arrived - player.pingSentAt));
        player.pingSentAt = -1;

        if (Environment.NODE_PRODUCTION) {
            trackPlayerPing.observe(player.pingMs);
        }

        return true;
    }
}
