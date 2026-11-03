import ServerGameMessage from '#/network/game/server/ServerGameMessage.js';

/**
 * custom (2026-11-03) - the round trip the server measures for this player.
 *
 * `seq` is echoed straight back by the client (ClientGameProt.PONG) and the server times the
 * answer. `lastRtt` is what the PREVIOUS exchange measured, so the client has a number to draw
 * without a clock the two ends have to agree on - ^0xffff means "not known yet".
 */
export default class Ping extends ServerGameMessage {
    constructor(
        readonly seq: number,
        readonly lastRtt: number
    ) {
        super();
    }
}
