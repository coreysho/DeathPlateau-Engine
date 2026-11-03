import ServerGameMessage from '#/network/game/server/ServerGameMessage.js';

/**
 * Every varp a client needs, in one packet instead of one packet each.
 *
 * A LOGIN WAS 536 PACKETS AND 371 OF THEM WERE VARPS. Player.onLogin sends every varp whose type is
 * transmit, and it sent one VARP_SMALL or VARP_LARGE per varp whatever the value - 360 and 11 of
 * them for a character that had done nothing, and the same for a maxed one, because the count is a
 * property of the content and not of the player. The 377 client parses at most five packets per
 * loop iteration (GameShell.run, paced at 20ms), so that was about 2.2 seconds of it catching up
 * before it was level with the world. See tools/sim/loginspike.ts for the breakdown.
 *
 * The zeros cannot simply be left out, which is the first thing to try: RESET_CLIENT_VARCACHE
 * copies varCache back into varps rather than zeroing them, and the client frees that array only in
 * unload(), not on logout - so a player who logs out to the login screen and back in still holds
 * the last session's values, and a varp that is now 0 would keep its old one.
 *
 * SMALL AND LARGE STAY APART inside the batch rather than carrying a per-entry tag. A tag byte
 * would cost one byte per varp, which is exactly what the saving is: an entry loses the opcode byte
 * a packet of its own needed, so 3 bytes instead of 4, and 360 of those is the difference between
 * this being worth doing and being a wash.
 */
export default class VarpBatch extends ServerGameMessage {
    constructor(
        /** varps whose value fits a signed byte, as [varp, value] pairs */
        readonly small: number[][],
        /** ...and the rest, which need four */
        readonly large: number[][]
    ) {
        super();
    }
}
