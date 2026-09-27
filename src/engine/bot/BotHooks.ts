import type Player from '#/engine/entity/Player.js';

// What World calls on the bot manager (World.bots). A type only, so World never imports the bots.
export interface BotHooks {
    /** Once a tick, before any player's input: spawns, respawns, deaths, removals. */
    cycle(): void;
    /** A bot's "client input" for this tick, called where a client's packets are read. */
    input(player: Player): void;
    /** A name a real client may not log in with on a world that runs bots. */
    isReservedName(username: string): boolean;
}
