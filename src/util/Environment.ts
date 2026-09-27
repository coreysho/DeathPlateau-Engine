import 'dotenv/config';
import { tryParseBoolean, tryParseInt, tryParseString } from '#/util/TryParse.js';
import { WalkTriggerSetting } from '#/engine/entity/WalkTriggerSetting.js';

export default {
    EASY_STARTUP: tryParseBoolean(process.env.EASY_STARTUP, false),
    WEBSITE_REGISTRATION: tryParseBoolean(process.env.WEBSITE_REGISTRATION, true),

    /// web server
    WEB_PORT: tryParseInt(process.env.WEB_PORT, process.platform === 'win32' || process.platform === 'darwin' ? 80 : 8888),
    WEB_ALLOWED_ORIGIN: tryParseString(process.env.WEB_ALLOWED_ORIGIN, ''),

    // management server
    WEB_MANAGEMENT_PORT: tryParseInt(process.env.WEB_MANAGEMENT_PORT, 8898),
    // custom (2026-09-27) - loopback by default: /prometheus is not for the internet. Set to 0.0.0.0
    // only if something on another machine scrapes it, and firewall the port to that machine.
    WEB_MANAGEMENT_HOST: tryParseString(process.env.WEB_MANAGEMENT_HOST, '127.0.0.1'),

    /// internal servers (login, friend, logger) - see server/InternalServer.ts
    // What they listen on. Loopback keeps them off the network; a world on another machine needs
    // this set to a LAN address AND INTERNAL_SECRET set, or they refuse to start.
    INTERNAL_BIND_HOST: tryParseString(process.env.INTERNAL_BIND_HOST, '127.0.0.1'),
    // Shared by every process (world, login, friend, logger). Empty = no check, loopback only.
    INTERNAL_SECRET: tryParseString(process.env.INTERNAL_SECRET, ''),

    /// game server
    // Build handshake, NOT the RS protocol revision. The client sends this in its login
    // block (Client.java, `this.login.p2(...)`) and World.onClientData rejects a mismatch
    // with login response 6, "your client is out of date". Bump BOTH sides together
    // whenever a client change is mandatory - it is the only way a stale jar gets turned
    // away at the door instead of crashing someone mid-fight.
    //   378 = the walk-merge skeleton guard (Model.method368). An unpatched client throws
    //         ArrayIndexOutOfBounds on eat-while-walking with a godsword.
    //   379 = P_DIALOGPROMPT (server prot 9, 2026-09-21). An older client has no length for it and
    //         would read its text as the next packets.
    //   380 = the login RSA key rotation (2026-09-27). An older client encrypts with the old, public key,
    //         which the server no longer has - it could not log in anyway, this says why.
    // Escape hatch: ENGINE_REVISION=377 in the server's .env lets old clients back in
    // without a rebuild, if a cutover has to be rolled back in a hurry. (Not across 380: the
    // old clients' key is gone, so rolling back past it also means LOGIN_RSA_KEY_PATH=the old pem.)
    ENGINE_REVISION: tryParseInt(process.env.ENGINE_REVISION, 380),
    // world id - offset by 9, so 1 = 10, 2 = 11, etc
    NODE_ID: tryParseInt(process.env.NODE_ID, 10),
    NODE_PORT: tryParseInt(process.env.NODE_PORT, 43594),
    // members content
    NODE_MEMBERS: tryParseBoolean(process.env.NODE_MEMBERS, true),
    // automatically upgrade accounts to members on successful login to a members world
    NODE_AUTO_SUBSCRIBE_MEMBERS: tryParseBoolean(process.env.NODE_AUTO_SUBSCRIBE_MEMBERS, true),
    // addxp multiplier
    NODE_XPRATE: tryParseInt(process.env.NODE_XPRATE, 1),
    // production mode!
    NODE_PRODUCTION: tryParseBoolean(process.env.NODE_PRODUCTION, false),
    // custom (2026-09-27) - a staff-only world (the dev world): a login whose account is below this
    // staffmodlevel is refused with "This world is full". 3 = administrators and up; 1-2 (player mods,
    // mods) are turned away. It is the level in the database that counts, not the developer level
    // NODE_PRODUCTION=false gives everyone who does get in. 0 = anyone may log in. See LoginThread.
    NODE_MIN_STAFF_LEVEL: tryParseInt(process.env.NODE_MIN_STAFF_LEVEL, 0),
    NODE_SUBMIT_INPUT: tryParseBoolean(process.env.NODE_SUBMIT_INPUT, false),
    // Maximum approximate number of storage bytes allowed per single input tracking session.
    // It does not seem remotely possible to get near this amount under normal inputs.
    NODE_LIMIT_BYTES_PER_TRACKING_SESSION: tryParseInt(process.env.NODE_MAX_BYTES_PER_TRACKING_SESSION, 50_000),
    NODE_MINIMUM_WEALTH_VALUE_EVENT: tryParseInt(process.env.NODE_MINIMUM_WEALTH_VALUE_EVENT, 10),
    // extra debug info e.g. missing triggers
    NODE_DEBUG: tryParseBoolean(process.env.NODE_DEBUG, true),
    // measuring script execution
    NODE_DEBUG_PROFILE: tryParseBoolean(process.env.NODE_DEBUG_PROFILE, false),
    // doing headless bot testing!
    NODE_DEBUG_SOCKET: tryParseBoolean(process.env.NODE_DEBUG_SOCKET, false),
    // no server routefinding until 2009
    NODE_CLIENT_ROUTEFINDER: tryParseBoolean(process.env.NODE_CLIENT_ROUTEFINDER, true),
    // yellow-x walktriggers in osrs went from: in packet handler -> in player setup -> player movement
    // 0 = processed in packet handler. 1 = processed in player setup (client input). 2 = processed in player movement
    NODE_WALKTRIGGER_SETTING: tryParseInt(process.env.NODE_WALKTRIGGER_SETTING, WalkTriggerSetting.PLAYERPACKET),
    // separate save folder
    NODE_PROFILE: tryParseString(process.env.NODE_PROFILE, 'main'),
    // entities cap
    NODE_MAX_PLAYERS: tryParseInt(process.env.NODE_MAX_PLAYERS, 2047),
    NODE_MAX_CONNECTED: tryParseInt(process.env.NODE_MAX_CONNECTED, 1000),
    // custom (2026-09-27) - open sockets (game + ondemand, TCP + WebSocket), see server/ConnectionLimiter.ts.
    // 0 = no limit. Behind a proxy, set PROXY_PROTOCOL_FROM below so players keep their own addresses -
    // without it every player shares the proxy's, and one per-IP cap.
    NODE_MAX_SOCKETS: tryParseInt(process.env.NODE_MAX_SOCKETS, 2048),
    NODE_MAX_SOCKETS_PER_IP: tryParseInt(process.env.NODE_MAX_SOCKETS_PER_IP, 16),
    // custom (2026-09-27) - addresses (and IPv4 CIDRs), comma separated, of a proxy or tunnel in front of
    // the game and web ports that sends PROXY protocol, so players keep their own addresses. Empty = off.
    // Connections from these must carry the header; everyone else connects as before. server/ProxyProtocol.ts
    PROXY_PROTOCOL_FROM: tryParseString(process.env.PROXY_PROTOCOL_FROM, ''),
    NODE_MAX_NPCS: tryParseInt(process.env.NODE_MAX_NPCS, 16383),
    NODE_DEBUGPROC_CHAR: tryParseString(process.env.NODE_DEBUGPROC_CHAR, '~'),
    NODE_WS_ONDEMAND: tryParseBoolean(process.env.NODE_WS_ONDEMAND, false),
    NODE_HOP_TIME: tryParseInt(process.env.NODE_MAX_NPCS, 45000), // 45s
    // limit login attempts
    NODE_RATELIMIT_ADDRESS_LOGIN: tryParseInt(process.env.NODE_RATELIMIT_ADDRESS_LOGIN, 30), // ip (60s)
    NODE_RATELIMIT_DEVICE_LOGIN: tryParseInt(process.env.NODE_RATELIMIT_DEVICE_LOGIN, 5), // uid+ip (15s)
    // the private half of the login RSA key - made by `npm run rsa`, never committed (World.ts)
    LOGIN_RSA_KEY_PATH: tryParseString(process.env.LOGIN_RSA_KEY_PATH, 'data/config/login-rsa.pem'),

    /// login server
    LOGIN_SERVER: tryParseBoolean(process.env.LOGIN_SERVER, false),
    LOGIN_HOST: tryParseString(process.env.LOGIN_HOST, 'localhost'),
    LOGIN_PORT: tryParseInt(process.env.LOGIN_PORT, 43500),

    /// friends server
    FRIEND_SERVER: tryParseBoolean(process.env.FRIEND_SERVER, false),
    FRIEND_HOST: tryParseString(process.env.FRIEND_HOST, 'localhost'),
    FRIEND_PORT: tryParseInt(process.env.FRIEND_PORT, 45099),

    /// logger server
    LOGGER_SERVER: tryParseBoolean(process.env.LOGGER_SERVER, false),
    LOGGER_HOST: tryParseString(process.env.LOGGER_HOST, 'localhost'),
    LOGGER_PORT: tryParseInt(process.env.LOGGER_PORT, 43501),

    /// database
    DB_BACKEND: tryParseString(process.env.DB_BACKEND, 'sqlite'),
    DB_HOST: tryParseString(process.env.DB_HOST, 'localhost'),
    DB_PORT: tryParseInt(process.env.DB_PORT, 3306),
    DB_USER: tryParseString(process.env.DB_USER, 'root'),
    DB_PASS: tryParseString(process.env.DB_PASS, 'password'),
    DB_NAME: tryParseString(process.env.DB_NAME, 'lostcity'),
    DB_LOGGER_HOST: tryParseString(process.env.DB_LOGGER_HOST, ''),
    DB_LOGGER_PORT: tryParseInt(process.env.DB_LOGGER_PORT, 0),
    DB_LOGGER_USER: tryParseString(process.env.DB_LOGGER_USER, ''),
    DB_LOGGER_PASS: tryParseString(process.env.DB_LOGGER_PASS, ''),
    DB_LOGGER_NAME: tryParseString(process.env.DB_LOGGER_NAME, ''),

    /// kysely
    KYSELY_VERBOSE: tryParseBoolean(process.env.KYSELY_VERBOSE, false),

    /// development
    BUILD_VERBOSE: tryParseBoolean(process.env.BUILD_VERBOSE, false),
    // auto-build on startup
    BUILD_STARTUP: tryParseBoolean(process.env.BUILD_STARTUP, false),
    // BUILD_VERIFY covers the pack files: every config has an id line, and every id line has a
    // config. Those catch real mistakes in a content repo and cost nothing, so they stay on.
    BUILD_VERIFY: tryParseBoolean(process.env.BUILD_VERIFY, true),
    // BUILD_VERIFY_CACHE is the other thing BUILD_VERIFY used to gate: a CRC of each packed archive
    // against the ORIGINAL 377 cache, to prove the build reproduces it byte for byte. That is a
    // guarantee an unmodified repo can give and a content repo cannot - this one has added locs,
    // npcs, objs, seqs, spotanims, varbits, varps and interfaces, and eight of the ten archives no
    // longer match (.flo and .idk still do). One flag covering both meant the only way to build was
    // BUILD_VERIFY=false, which ALSO turned off the pack-file checks - and that is how a dangling
    // seq id sat in the repo unnoticed. Set it to true on a repo that is meant to reproduce stock.
    BUILD_VERIFY_CACHE: tryParseBoolean(process.env.BUILD_VERIFY_CACHE, false),
    // used to keep some semblance of sanity in our folder structure
    BUILD_VERIFY_FOLDER: tryParseBoolean(process.env.BUILD_VERIFY_FOLDER, true),
    // used for unpacking/custom development
    BUILD_VERIFY_PACK: tryParseBoolean(process.env.BUILD_VERIFY_PACK, true),
    // used for unpacking/custom development
    BUILD_SRC_DIR: tryParseString(process.env.BUILD_SRC_DIR, '../content'),

    // custom (2026-09-21) - the Discord relay (server/discord/DiscordThread.ts): a bot that DMs players
    // their trading post notices. Both must be set or it does not start. Keep the token in .env only.
    DISCORD_TOKEN: tryParseString(process.env.DISCORD_TOKEN, ''),
    DISCORD_GUILD_ID: tryParseString(process.env.DISCORD_GUILD_ID, '')
};
