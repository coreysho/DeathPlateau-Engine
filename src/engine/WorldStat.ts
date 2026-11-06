export const enum WorldStat {
    CYCLE,
    WORLD,
    CLIENT_IN,
    NPC,
    PLAYER,
    LOGOUT,
    LOGIN,
    ZONE,
    CLIENT_OUT,
    CLEANUP,
    BANDWIDTH_IN,
    BANDWIDTH_OUT,
    // custom (2026-11-03) - the most server messages sent to any ONE client this tick. See
    // NetworkPlayer.packetsThisTick for why a count of messages, not of bytes, is the figure that
    // decides whether a client can keep up.
    PACKETS_OUT_MAX
}
