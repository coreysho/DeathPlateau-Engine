import ServerGameMessage from '#/network/game/server/ServerGameMessage.js';

/**
 * custom (2026-11-02) - here is the saved login you asked for; keep this instead of the password.
 *
 * Sent once, in the login sequence, and only to a client that asked for one and then proved it
 * knew the password. It is the one direction the token ever travels on the wire from here: a
 * client logging in with a saved login sends it in the login block and is told nothing back.
 */
export default class SetLoginToken extends ServerGameMessage {
    constructor(readonly token: string) {
        super();
    }
}
