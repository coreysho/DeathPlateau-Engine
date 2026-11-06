import { Counter, Gauge, Histogram } from 'prom-client';

export const trackPlayerCount = new Gauge({ name: 'lostcity_active_players', help: 'Active player count.' });
export const trackNpcCount = new Gauge({ name: 'lostcity_active_npcs', help: 'Active NPC count.' });

export const trackCycleTime = new Histogram({
    name: 'lostcity_cycle_ms',
    help: 'Overall processing duration in milliseconds.',
    buckets: [10, 20, 30, 50, 80, 100, 150, 200, 250, 300, 400, 450, 550, 600, 800, 1000]
});

export const trackCycleWorldTime = new Histogram({
    name: 'lostcity_cycle_world_ms',
    help: 'World (not overall) processing duration in milliseconds.',
    buckets: [10, 20, 30, 40, 50, 100]
});

export const trackCycleClientInTime = new Histogram({
    name: 'lostcity_cycle_client_in_ms',
    help: 'Client In processing duration in milliseconds.',
    buckets: [10, 30, 50, 100, 200, 300, 400]
});

export const trackCycleClientOutTime = new Histogram({
    name: 'lostcity_cycle_client_out_ms',
    help: 'Client Out processing duration in milliseconds.',
    buckets: [10, 30, 50, 100, 200, 300, 400]
});

export const trackCycleNpcTime = new Histogram({
    name: 'lostcity_cycle_npc_ms',
    help: 'NPC processing duration in milliseconds.',
    buckets: [10, 20, 30, 40, 50, 100]
});

export const trackCyclePlayerTime = new Histogram({
    name: 'lostcity_cycle_player_ms',
    help: 'Player processing duration in milliseconds.',
    buckets: [10, 20, 30, 40, 50, 100]
});

export const trackCycleZoneTime = new Histogram({
    name: 'lostcity_cycle_zone_ms',
    help: 'Zone processing duration in milliseconds.',
    buckets: [10, 20, 30, 40, 50, 100]
});

export const trackCycleLoginTime = new Histogram({
    name: 'lostcity_cycle_login_ms',
    help: 'Login processing duration in milliseconds.',
    buckets: [10, 30, 50, 100]
});

export const trackCycleLogoutTime = new Histogram({
    name: 'lostcity_cycle_logout_ms',
    help: 'Logout processing duration in milliseconds.',
    buckets: [10, 30, 50, 100]
});

export const trackCycleBandwidthInBytes = new Counter({
    name: 'lostcity_cycle_bandwidth_in_bytes',
    help: 'Total incoming bandwidth in bytes.'
});

export const trackCycleBandwidthOutBytes = new Counter({
    name: 'lostcity_cycle_bandwidth_out_bytes',
    help: 'Total outgoing bandwidth in bytes.'
});

export const trackPlayerPing = new Histogram({
    name: 'lostcity_player_ping_ms',
    help: 'Round trip to a connected client, in milliseconds.',
    buckets: [20, 50, 100, 150, 200, 300, 500, 800, 1200, 2000]
});

// custom (2026-11-03) - WHETHER A CLIENT CAN KEEP UP, which is a question about the NUMBER of
// messages and not their size. The 377 client parses its socket inside update(), which the shell
// runs once per loop iteration (GameShell.run, paced at deltime = 20ms), and it takes at most five
// packets per call:
//
//     for (int i = 0; i < 5 && this.readPacket(); i++) {
//
// So it drains about 250 messages a second, or 150 in a 600ms tick. Below that the backlog clears
// within the tick; above it the backlog grows every tick and the client falls further behind the
// world the longer it stays there - which is what "lag when doing anything" feels like, and it
// would show up first wherever players gather. Bytes do not answer this: one 40 KB packet is fine
// and two hundred 20-byte ones are not.
export const trackPlayerPacketsPerTick = new Histogram({
    name: 'lostcity_player_packets_per_tick',
    help: 'Server messages sent to one client in one tick. The client drains about 150 a tick (5 per 20ms loop iteration), so observations at or above that bucket are a client falling behind.',
    // 150 is the client's drain rate for a tick; the buckets above it are how far past it a tick
    // went, because a login measured 428 in one and that is three ticks of catching up.
    buckets: [1, 5, 10, 25, 50, 100, 150, 300, 500, 1000]
});

export const trackSessionEventsPublished = new Counter({
    name: 'lostcity_session_events_published',
    help: 'Total number of session events published.'
});
