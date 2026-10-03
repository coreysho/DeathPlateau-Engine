import v8 from 'node:v8';

import { Visibility } from '#/network/rsbuf/index.js';
import { LocAngle, LocShape } from '#/engine/routefinder/index.js';

import Component from '#/cache/config/Component.js';
import IdkType from '#/cache/config/IdkType.js';
import InvType from '#/cache/config/InvType.js';
import LocType from '#/cache/config/LocType.js';
import NpcType from '#/cache/config/NpcType.js';
import ObjType from '#/cache/config/ObjType.js';
import ScriptVarType from '#/cache/config/ScriptVarType.js';
import SeqType from '#/cache/config/SeqType.js';
import SpotanimType from '#/cache/config/SpotanimType.js';
import VarBitType from '#/cache/config/VarBitType.js';
import VarPlayerType from '#/cache/config/VarPlayerType.js';

import { CoordGrid } from '#/engine/CoordGrid.js';
import World from '#/engine/World.js';
import { EntityLifeCycle } from '#/engine/entity/EntityLifeCycle.js';
import Loc from '#/engine/entity/Loc.js';
import { MoveStrategy } from '#/engine/entity/MoveStrategy.js';
import { isClientConnected } from '#/engine/entity/NetworkPlayer.js';
import Npc from '#/engine/entity/Npc.js';
import Player, { getExpByLevel } from '#/engine/entity/Player.js';
import { PlayerStat, PlayerStatEnabled, PlayerStatMap } from '#/engine/entity/PlayerStat.js';
import ScriptProvider from '#/engine/script/ScriptProvider.js';
import ScriptRunner from '#/engine/script/ScriptRunner.js';

import ClientGameMessageHandler from '#/network/game/client/ClientGameMessageHandler.js';
import ClientCheat from '#/network/game/client/model/ClientCheat.js';

import { LoggerEventType } from '#/server/logger/LoggerEventType.js';
import { queueBugReport } from '#/server/tickets/TicketInbox.js';

import Environment from '#/util/Environment.js';
import handleBotCommand from '#/engine/bot/BotCommands.js';
import handleCoverageCommand from '#/engine/script/ScriptCoverageCommands.js';
import handleFaultsCommand from '#/engine/script/ScriptFaultCommands.js';
import { printDebug } from '#/util/Logger.js';
import { tryParseInt } from '#/util/TryParse.js';
import ChatText from '#/wordenc/ChatText.js';

// custom (2026-09-27) - ::yell reaches every player on the world, so a player gets one every
// YELL_COOLDOWN_TICKS (10 seconds). Staff (2+) are not held to it. Keyed weakly so a logged-out
// player's entry goes with them.
const YELL_COOLDOWN_TICKS = 17;
const lastYell: WeakMap<Player, number> = new WeakMap();

// custom (2026-09-27) - ::changepassword: one try every 5 seconds, so a logged-in session left open
// cannot be used to guess the current password quickly. The characters are the ones the login
// screen lets you type (Client.CHARSET), less space and backtick - a password you cannot type there
// would lock you out.
const PASSWORD_COOLDOWN_TICKS = 8;
const lastPasswordChange: WeakMap<Player, number> = new WeakMap();
const PASSWORD_CHARS = /^[a-z0-9!"$%^&*()\-_=+[{\]};:'@#~,<.>/?\\|]+$/;

// custom (2026-09-27) - ::bug goes to the staff as a Discord ticket, so one a minute per account.
// Keyed by username rather than Player so logging out and back in does not reset it.
const BUG_COOLDOWN_MS = 60_000;
const lastBugReport: Map<string, number> = new Map();

export default class ClientCheatHandler extends ClientGameMessageHandler<ClientCheat> {
    handle(message: ClientCheat, player: Player): boolean {
        if (message.input.length > 80) {
            return false;
        }

        const { input: cheat } = message;

        const args: string[] = cheat.toLowerCase().split(' ');
        const cmd: string | undefined = args.shift();
        if (cmd === undefined || cmd.length <= 0) {
            return false;
        }

        if (cmd === 'home') {
            // custom (Corey, 2026-09-04) - available to all players, not staff-gated. Destination is
            // Edgeville (coord 0_48_54_14_35), the spot Corey picked in-game on 2026-09-05.
            player.closeModal();

            if (!player.canAccess()) {
                player.messageGame('Please finish what you are doing first.');
                return false;
            }

            // custom (2026-09-27) - not a free escape. Anything that stops a logout (combat, for 16
            // ticks after the last hit: p_preventlogout) stops ::home too, and so does the wilderness.
            // Administrators and up are not held to it.
            if (player.staffModLevel < 3) {
                if (World.currentTick < player.preventLogoutUntil) {
                    player.messageGame("You can't teleport home until 10 seconds after the end of combat.");
                    return false;
                }

                if (player.isInWilderness()) {
                    player.messageGame("You can't teleport home from the Wilderness.");
                    return false;
                }
            }

            player.clearInteraction();
            player.unsetMapFlag();

            player.teleJump((48 << 6) + 14, (54 << 6) + 35, 0);
            player.messageGame('You teleport home to Edgeville.');
            return true;
        }

        if (cmd === 'changepassword') {
            // custom (2026-09-27) - handled before the staff "Ran cheat" session log below, which would
            // otherwise write a moderator's passwords into the logs. Available to all players.
            // ::changepassword <current> <new> <new again> - lowercase, like every password here.
            const [oldPassword, newPassword, confirm] = args;
            if (!oldPassword || !newPassword || !confirm || args.length !== 3) {
                player.messageGame('Usage: ::changepassword current new new');
                return true;
            }

            const last = lastPasswordChange.get(player);
            if (last !== undefined && World.currentTick - last < PASSWORD_COOLDOWN_TICKS) {
                player.messageGame('Please wait a few seconds before trying again.');
                return true;
            }
            lastPasswordChange.set(player, World.currentTick);

            if (newPassword !== confirm) {
                player.messageGame('The two new passwords do not match.');
            } else if (newPassword.length < 5 || newPassword.length > 20) {
                player.messageGame('Your new password must be 5 to 20 characters long.');
            } else if (!PASSWORD_CHARS.test(newPassword)) {
                player.messageGame('Your new password can only use letters, numbers and symbols you can type at the login screen.');
            } else if (newPassword === oldPassword) {
                player.messageGame('Your new password must be different from your current one.');
            } else if (newPassword === player.username.replaceAll('_', ' ') || newPassword === player.username) {
                player.messageGame('Your password cannot be your username.');
            } else if (!World.requestPasswordChange(player, oldPassword, newPassword)) {
                player.messageGame('Your last password change is still being processed.');
            } else {
                player.messageGame('Checking your password...');
            }
            return true;
        }

        if (cmd === 'discord') {
            // custom (2026-09-21) - link this account to Discord for trading post DMs. Available to all
            // players. See server/discord/DiscordThread.ts.
            if (!World.discordEnabled) {
                player.wrappedMessageGame('Discord alerts are not set up on this server.');
                return true;
            }

            if (args[0] === 'unlink') {
                World.discordUnlink(player);
                return true;
            }

            // Two short lines, the code in dark red so it stands out on the chatbox's parchment.
            // (@col@ tags in game messages need the client from 2026-09-21 on; an older client prints
            // them as text.)
            const code = World.discordCode(player);
            player.wrappedMessageGame(`Your Discord link code is @dre@${code}@bla@ - it works once, for 10 minutes.`);
            player.wrappedMessageGame(`In our Discord, type @dre@/link ${code}@bla@. To stop alerts later: ::discord unlink`);
            return true;
        }

        if (cmd === 'bug') {
            // custom (2026-09-27) - report a bug from where it happened. Available to all players.
            // It is filed as a private bug report in our Discord by the ticket bot, a process of its
            // own that may be down: the report waits in the inbox until it is back - see
            // server/tickets/TicketInbox.ts. Where the player stands goes with it.
            const text = cheat.substring(cmd.length).trim();
            if (text.length < 10) {
                player.wrappedMessageGame('Type ::bug followed by what went wrong, e.g. ::bug the cook in Lumbridge will not talk to me');
                return true;
            }

            const last = lastBugReport.get(player.username);
            if (last !== undefined && Date.now() - last < BUG_COOLDOWN_MS) {
                player.messageGame('You can only send one bug report a minute.');
                return true;
            }

            if (queueBugReport({ username: player.username, text, x: player.x, z: player.z, level: player.level }) === null) {
                player.messageGame('Your bug report could not be sent just now. Please try again in a moment.');
                return true;
            }
            lastBugReport.set(player.username, Date.now());

            player.messageGame('Thanks - your bug report has been sent to the staff.');
            if (World.discordEnabled) {
                player.wrappedMessageGame('If your account is linked to our Discord (::discord), you will be added to its ticket there to follow it up.');
            }
            return true;
        }

        if (cmd === 'yell') {
            // custom (Corey, 2026-09-04) - global broadcast chat, available to all players (like
            // ::home, not staff-gated).
            //
            // (2026-09-23) THE ENGINE ONLY DECIDES WHETHER; CONTENT DECIDES HOW IT LOOKS. The line is
            // built by [proc,yell] in content/scripts/general/scripts/broadcast.rs2, next to the rare
            // drop broadcasts, so a yell and a drop share one ~broadcast_name - the rank crown, the
            // XP-mode badge and the name - instead of this file and the drop tables each keeping a
            // copy of the rules for which crown a mod level earns.
            if (player.muted_until !== null && player.muted_until > new Date()) {
                return false;
            }

            // No markup from players. A chat line's colours and icons are all "@xxx@" tags, so what a
            // player typed would otherwise be drawn: "@cr2@" in a yell put the administrator's gold
            // crown in front of whatever followed it. (2026-09-27) The yell is chat, so it takes chat's
            // characters and case (ChatText.format), and every '@' is sent as ChatText.LITERAL_AT, which
            // the client draws as '@' but never reads as a tag - "@cr2@" now prints as typed.
            const text = ChatText.literal(ChatText.format(cheat.substring(cmd.length + 1)));
            if (text.length <= 0 || text.length > 100) {
                return false;
            }

            if (player.staffModLevel < 2) {
                const last = lastYell.get(player);
                if (last !== undefined && World.currentTick - last < YELL_COOLDOWN_TICKS) {
                    player.messageGame('You can only yell once every 10 seconds.');
                    return false;
                }
                lastYell.set(player, World.currentTick);
            }

            const script = ScriptProvider.getByName('[proc,yell]');
            if (!script) {
                // a content build from before broadcast.rs2 - still say it, just plainly
                World.broadcastMes(`[Yell] ${player.displayName}: ${text}`);
                return true;
            }
            player.executeScript(ScriptRunner.init(script, player, null, [text]), false);
            return true;
        }

        if (player.staffModLevel >= 2) {
            player.addSessionLog(LoggerEventType.MODERATOR, 'Ran cheat', cheat);
        }

        if (player.staffModLevel >= 4) {
            // developer and above, ON LIVE TOO - which is the whole reason this sits above the
            // block below rather than in it. ::godmode was asked for (2026-10-03) for testing boss
            // rotations on the real server, and a [debugproc,] cannot do that: debugprocs are
            // owner-only on a live world. Nothing here touches another player or the economy.

            if (cmd === 'godmode') {
                // The switch itself is content - misc/scripts/godmode.rs2 - so what it restores and
                // what it refuses is readable and editable there rather than buried in the engine.
                //
                // protect=true, like ::bank above: the proc writes %godmode and %sa_energy, both
                // protected varps, and running it unprotected is "requires protected access" and a
                // dropped client.
                if (!player.canAccess()) {
                    player.messageGame('Please finish what you are doing first.');
                    return false;
                }

                const script = ScriptProvider.getByName('[proc,godmode_toggle]');
                if (!script) {
                    // a content build from before godmode.rs2
                    return false;
                }

                player.executeScript(ScriptRunner.init(script, player), true);
                return true;
            }
        }

        if (player.staffModLevel >= 5 || (!Environment.NODE_PRODUCTION && player.staffModLevel >= 4)) {
            // developer commands. On live only the owners have them (5, red crown; 6, blue and gold) -
            // ::speed, ::snapshot, ::reload and the rest can stop or wreck the world, so a developer (4)
            // gets them on a dev server only, and an owner's password is the one that has to be strong.

            if (cmd[0] === Environment.NODE_DEBUGPROC_CHAR) {
                // debugprocs are NOT allowed on live ;)
                const script = ScriptProvider.getByName(`[debugproc,${cmd.slice(1)}]`);
                if (!script) {
                    return false;
                }

                const params = new Array(script.info.parameterTypes.length).fill(-1);
                for (let i = 0; i < script.info.parameterTypes.length; i++) {
                    const type = script.info.parameterTypes[i];

                    try {
                        switch (type) {
                            case ScriptVarType.STRING: {
                                const value = args.shift();
                                params[i] = value ?? '';
                                break;
                            }
                            case ScriptVarType.INT: {
                                const value = args.shift();
                                params[i] = parseInt(value ?? '0', 10) | 0;
                                break;
                            }
                            case ScriptVarType.OBJ:
                            case ScriptVarType.NAMEDOBJ: {
                                const name = args.shift();
                                params[i] = ObjType.getId(name ?? '');
                                break;
                            }
                            case ScriptVarType.NPC: {
                                const name = args.shift();
                                params[i] = NpcType.getId(name ?? '');
                                break;
                            }
                            case ScriptVarType.LOC: {
                                const name = args.shift();
                                params[i] = LocType.getId(name ?? '');
                                break;
                            }
                            case ScriptVarType.SEQ: {
                                const name = args.shift();
                                params[i] = SeqType.getId(name ?? '');
                                break;
                            }
                            case ScriptVarType.STAT: {
                                const name = args.shift() ?? '';
                                params[i] = PlayerStatMap.get(name.toUpperCase());
                                break;
                            }
                            case ScriptVarType.INV: {
                                const name = args.shift();
                                params[i] = InvType.getId(name ?? '');
                                break;
                            }
                            case ScriptVarType.COORD: {
                                const args2 = cheat.split('_');

                                const level = parseInt(args2[0].slice(6));
                                const mx = parseInt(args2[1]);
                                const mz = parseInt(args2[2]);
                                const lx = parseInt(args2[3]);
                                const lz = parseInt(args2[4]);

                                params[i] = CoordGrid.packCoord(level, (mx << 6) + lx, (mz << 6) + lz);
                                break;
                            }
                            case ScriptVarType.INTERFACE: {
                                const name = args.shift();
                                params[i] = Component.getId(name ?? '');
                                break;
                            }
                            case ScriptVarType.SPOTANIM: {
                                const name = args.shift();
                                params[i] = SpotanimType.getId(name ?? '');
                                break;
                            }
                            case ScriptVarType.IDKIT: {
                                const name = args.shift();
                                params[i] = IdkType.getId(name ?? '');
                                break;
                            }
                        }
                    } catch (_) {
                        // invalid arguments
                        return false;
                    }
                }

                player.executeScript(ScriptRunner.init(script, player, null, params), false);
            } else if (cmd === 'reload') {
                World.reload();
            } else if (cmd === 'rebuild') {
                player.messageGame('Rebuilding scripts...');
                World.rebuild();
            } else if (cmd === 'speed') {
                if (args.length < 1) {
                    player.messageGame('Usage: ::speed <ms>');
                    return false;
                }

                const speed: number = tryParseInt(args.shift(), 20);
                if (speed < 20) {
                    player.messageGame('::speed input was too low.');
                    return false;
                }

                player.messageGame(`World speed was changed to ${speed}ms`);
                World.tickRate = speed;
            } else if (cmd === 'fly') {
                if (player.moveStrategy === MoveStrategy.FLY) {
                    player.moveStrategy = MoveStrategy.SMART;
                } else {
                    player.moveStrategy = MoveStrategy.FLY;
                }

                player.messageGame(`Changed move strategy: ${player.moveStrategy === MoveStrategy.FLY ? 'fly' : 'smart'}`);
            } else if (cmd === 'naive') {
                if (player.moveStrategy === MoveStrategy.NAIVE) {
                    player.moveStrategy = MoveStrategy.SMART;
                } else {
                    player.moveStrategy = MoveStrategy.NAIVE;
                }

                player.messageGame(`Naive move strategy: ${player.moveStrategy === MoveStrategy.NAIVE ? 'naive' : 'smart'}`);
            } else if (cmd === 'random') {
                player.afkEventReady = true;
            }
        }

        if (player.staffModLevel >= 3) {
            // admin commands (potentially destructive for a live economy)

            // custom (2026-09-27) - server-side bots (engine/bot/BotCommands.ts). They only exist
            // where NODE_BOTS=true, the dev world; anywhere else these say so.
            if (cmd === 'bots' || cmd === 'bot') {
                return handleBotCommand(player, cmd, args);
            }

            // custom (2026-09-29) - the script fault reporter (engine/script/ScriptFaults.ts). A
            // script error aborts the whole trigger stack, so a fault buried in a gosub can eat a
            // drop table in silence; this is how staff read what has been thrown without journalctl.
            if (cmd === 'faults') {
                return handleFaultsCommand(player, args);
            }

            // custom (2026-09-29) - which of the build's triggers have ever run
            // (engine/script/ScriptCoverage.ts). The never-reached list is a to-do list nobody can
            // write by hand: there is no way to read off the source which triggers a player can
            // actually get to.
            if (cmd === 'coverage') {
                return handleCoverageCommand(player, args);
            }

            if (cmd === 'bank') {
                // ::bank - open the bank from anywhere.
                //
                // executeScript's second argument is `protect`, and it has to be true here.
                // openbank falls through to the bank PIN keypad when a PIN is set, and
                // bankpin_start_entry's first statement writes %bankpin_flow, a protected varp.
                // Running it unprotected threw "pop_varp %bankpin_flow requires protected
                // access" and dropped the client. (The debugproc dispatch above passes false
                // deliberately - that is why every debugproc calls p_finduid(uid) itself.)
                //
                // Routed via openbank rather than the bankpin_open_bank_real proc it guards, so
                // a set bank PIN is enforced instead of being sidestepped by the cheat.
                if (!player.canAccess()) {
                    player.messageGame('Please finish what you are doing first.');
                    return false;
                }

                const openbank = ScriptProvider.getByName('[label,openbank]');
                if (!openbank) {
                    return false;
                }

                player.executeScript(ScriptRunner.init(openbank, player), true);
                return true;
            }

            if (cmd === 'setvar') {
                // authentic
                if (args.length < 2) {
                    // ::setvar <variable> <value>
                    // Sets variable to specified value
                    return false;
                }

                const debugname = args[0];
                const value = Math.max(-0x80000000, Math.min(tryParseInt(args[1], 0), 0x7fffffff));

                let varp: VarPlayerType | null = null;
                const varbit = VarBitType.getByName(debugname);
                if (varbit) {
                    varp = VarPlayerType.get(varbit.basevar);

                    if (varp.protect) {
                        player.closeModal();

                        if (!player.canAccess()) {
                            player.messageGame('Please finish what you are doing first.');
                            return false;
                        }

                        player.clearInteraction();
                        player.unsetMapFlag();
                    }
                } else {
                    varp = VarPlayerType.getByName(debugname);
                }

                if (!varp) {
                    return false;
                }

                if (varp.protect) {
                    player.closeModal();

                    if (!player.canAccess()) {
                        player.messageGame('Please finish what you are doing first.');
                        return false;
                    }

                    player.clearInteraction();
                    player.unsetMapFlag();
                }

                if (varbit) {
                    player.setVarBit(varbit.id, value);
                    player.messageGame('set ' + varbit.debugname + ': to ' + value);
                } else {
                    player.setVar(varp.id, value);
                    player.messageGame('set ' + varp.debugname + ': to ' + value);
                }
            } else if (cmd === 'setvarother' && Environment.NODE_PRODUCTION) {
                // custom
                if (args.length < 3) {
                    // ::setvarother <username> <name> <value>
                    return false;
                }

                const other = World.getPlayerByUsername(args[0]);
                if (!other) {
                    player.messageGame(`${args[0]} is not logged in.`);
                    return false;
                }

                const varp = VarPlayerType.getByName(args[1]);
                if (!varp) {
                    return false;
                }

                if (varp.protect) {
                    other.closeModal();

                    if (!other.canAccess()) {
                        player.messageGame(`${args[0]} is busy right now.`);
                        return false;
                    }

                    other.clearInteraction();
                    other.unsetMapFlag();
                }

                const value = Math.max(-0x80000000, Math.min(tryParseInt(args[2], 0), 0x7fffffff));
                other.setVar(varp.id, value);
                player.messageGame('set ' + args[1] + ': to ' + value + ' on ' + other.username);
            } else if (cmd === 'getvar') {
                // authentic
                if (args.length < 1) {
                    // ::getvar <variable>
                    // Displays value of specified variable
                    return false;
                }

                const debugname = args[0];

                let varp: VarPlayerType | null = null;
                const varbit = VarBitType.getByName(debugname);
                if (varbit) {
                    varp = VarPlayerType.get(varbit.basevar);

                    if (varp.protect) {
                        player.closeModal();

                        if (!player.canAccess()) {
                            player.messageGame('Please finish what you are doing first.');
                            return false;
                        }

                        player.clearInteraction();
                        player.unsetMapFlag();
                    }
                } else {
                    varp = VarPlayerType.getByName(debugname);
                }

                if (!varp) {
                    return false;
                }

                if (varbit) {
                    const value = player.getVarBit(varbit.id);
                    player.messageGame('get ' + varbit.debugname + ': ' + value);
                } else {
                    const value = player.getVar(varp.id);
                    player.messageGame('get ' + varp.debugname + ': ' + value);
                }
            } else if (cmd === 'getvarother' && Environment.NODE_PRODUCTION) {
                // custom
                if (args.length < 2) {
                    // ::getvarother <username> <variable>
                    return false;
                }

                const other = World.getPlayerByUsername(args[0]);
                if (!other) {
                    player.messageGame(`${args[0]} is not logged in.`);
                    return false;
                }

                const varp = VarPlayerType.getByName(args[1]);
                if (!varp) {
                    return false;
                }

                const value = other.getVar(varp.id);
                player.messageGame('get ' + varp.debugname + ': ' + value + ' on ' + other.username);
            } else if (cmd === 'give') {
                // authentic
                if (args.length < 1) {
                    // ::give <item> (amount)
                    // Adds the items(s) to your inventory
                    return false;
                }

                const obj = ObjType.getId(args[0]);
                if (obj === -1) {
                    return false;
                }

                const count = Math.max(1, Math.min(tryParseInt(args[1], 1), 0x7fffffff));
                player.invAdd(InvType.INV, obj, count);
            } else if (cmd === 'giveother' && Environment.NODE_PRODUCTION) {
                // custom
                if (args.length < 2) {
                    // ::giveother <username> <item> (amount)
                    return false;
                }

                const other = World.getPlayerByUsername(args[0]);
                if (!other) {
                    player.messageGame(`${args[0]} is not logged in.`);
                    return false;
                }

                const obj = ObjType.getId(args[1]);
                if (obj === -1) {
                    return false;
                }

                const count = Math.max(1, Math.min(tryParseInt(args[2], 1), 0x7fffffff));
                other.invAdd(InvType.INV, obj, count);
            } else if (cmd === 'givecrap') {
                // authentic (we don't know the exact specifics of this...)

                // Fills your inventory with random items
                for (let i = 0; i < 28; i++) {
                    let random = -1;
                    while (random === -1) {
                        random = Math.trunc(Math.random() * ObjType.count);
                        const obj = ObjType.get(random);
                        if ((!Environment.NODE_MEMBERS && obj.members) || obj.dummyitem !== 0 || obj.certtemplate !== -1) {
                            random = -1;
                        }
                    }

                    player.invAdd(InvType.INV, random, 1);
                }
            } else if (cmd === 'givemany') {
                // authentic
                if (args.length < 1) {
                    // ::givemany <item>
                    // Adds up to 1000 of the item to your inventory
                    return false;
                }

                const obj = ObjType.getId(args[0]);
                if (obj === -1) {
                    return false;
                }

                player.invAdd(InvType.INV, obj, 1000);
            } else if (cmd === 'broadcast' && Environment.NODE_PRODUCTION) {
                // custom - a staff announcement to every player. (2026-09-23) Built by
                // [proc,broadcast_staff] in content, beside the drops and ::yell, so it carries the
                // sender's crown and the announcement styling. Staff text keeps its @col@ tags - the
                // rank check above is the trust. The old guard, args.length < 0, could never be true,
                // so an empty ::broadcast sent every player a blank line.
                const text = cheat.substring(cmd.length + 1).trim();
                if (text.length <= 0) {
                    return false;
                }

                const script = ScriptProvider.getByName('[proc,broadcast_staff]');
                if (script) {
                    player.executeScript(ScriptRunner.init(script, player, null, [text]), false);
                } else {
                    World.broadcastMes(text);
                }
            } else if (cmd === 'reboot' && Environment.NODE_PRODUCTION) {
                // semi-authentic - we actually just shut down for maintenance

                // Reboots the game world, applying packed changes
                World.rebootTimer(0);
            } else if (cmd === 'slowreboot' && Environment.NODE_PRODUCTION) {
                // semi-authentic - we actually just shut down for maintenance
                if (args.length < 1) {
                    // ::slowreboot <seconds>
                    // Reboots the game world, with a timer
                    return false;
                }

                World.rebootTimer(Math.ceil((tryParseInt(args[0], 30) * 1000) / 600));
            } else if (cmd === 'serverdrop') {
                // testing reconnection behavior
                player.terminate();
            } else if (cmd === 'teleother' && Environment.NODE_PRODUCTION) {
                // custom
                if (args.length < 1) {
                    // ::teleother <username>
                    return false;
                }

                const other = World.getPlayerByUsername(args[0]);
                if (!other) {
                    player.messageGame(`${args[0]} is not logged in.`);
                    return false;
                }

                other.closeModal();

                if (!other.canAccess()) {
                    player.messageGame(`${args[0]} is busy right now.`);
                    return false;
                }

                other.clearInteraction();
                other.unsetMapFlag();

                other.teleJump(player.x, player.z, player.level);
            } else if (cmd === 'setstat') {
                // authentic
                if (args.length < 2) {
                    // ::setstat <skill> <level>
                    // Sets the skill to specified level
                    return false;
                }

                const stat = PlayerStatMap.get(args[0].toUpperCase());
                if (typeof stat === 'undefined') {
                    return false;
                }

                player.setLevel(stat, parseInt(args[1]));
            } else if (cmd === 'advancestat') {
                // authentic
                if (args.length < 1) {
                    // ::advancestat <skill> <level>
                    // Advances skill to specified level, generates level up message etc.
                    return false;
                }

                const stat = PlayerStatMap.get(args[0].toUpperCase());
                if (typeof stat === 'undefined') {
                    return false;
                }

                player.stats[stat] = 0;
                player.baseLevels[stat] = 1;
                player.levels[stat] = 1;
                player.addXp(stat, getExpByLevel(parseInt(args[1])), false);
            } else if (cmd === 'minme') {
                // like maxme debugproc, but in engine because xp goes down
                for (let i = 0; i < PlayerStatEnabled.length; i++) {
                    if (i === PlayerStat.HITPOINTS) {
                        player.setLevel(i, 10);
                    } else {
                        player.setLevel(i, 1);
                    }
                }
            } else if (cmd === 'locadd') {
                // authentic - https://youtu.be/E6tQ3b3vzro?t=3194
                if (args.length < 1) {
                    return false;
                }
                const name: string = args[0];
                const type: LocType | null = LocType.getByName(name);
                if (!type) {
                    return false;
                }
                World.addLoc(new Loc(player.level, player.x, player.z, type.width, type.length, EntityLifeCycle.DESPAWN, type.id, LocShape.CENTREPIECE_STRAIGHT, LocAngle.WEST), 500);
                player.messageGame(`Loc Added: ${name} (ID: ${type.id})`);
            } else if (cmd === 'npcadd') {
                // authentic - https://youtu.be/E6tQ3b3vzro?t=3412
                if (args.length < 1) {
                    return false;
                }
                const name: string = args[0];
                const type: NpcType | null = NpcType.getByName(name);
                if (!type) {
                    return false;
                }
                World.addNpc(new Npc(player.level, player.x, player.z, type.size, type.size, EntityLifeCycle.DESPAWN, World.getNextNid(), type.id, type.blockwalk), 500);
            } else if (cmd === 'openmain') {
                if (args.length < 1) {
                    return false;
                }

                const name: string = args[0];
                const type: Component | null = Component.getByName(name);

                if (!type || type.rootLayer !== type.id) {
                    return false;
                }

                player.openMainModal(type.id);
            } else if (cmd === 'openoverlay') {
                if (args.length < 1) {
                    return false;
                }

                const name: string = args[0];
                const type: Component | null = Component.getByName(name);

                if (!type || type.rootLayer !== type.id) {
                    return false;
                }

                player.openMainOverlay(type.id);
            } else if (cmd === 'closeoverlay') {
                player.openMainOverlay(-1);
            } else if (cmd === 'snapshot') {
                const heap = v8.writeHeapSnapshot();
                printDebug(`Heap snapshot written to: ${heap}`);
            }
        }

        if (player.staffModLevel >= 2) {
            // "super-moderator" commands (similar to a jmod but we don't know their command capabilities on live)

            if (cmd === 'getcoord') {
                // authentic

                // Displays current coordinate
                player.messageGame(CoordGrid.formatString(player.level, player.x, player.z, ','));
            } else if (cmd === 'tele') {
                // authentic - https://youtu.be/60Y3y375VYA?t=980
                if (args.length < 1) {
                    // ::tele x,xx,xx[,xx,xx]
                    // Teleports you to the coordinate. In order, the parts are level, horizontal map square, vertical map square, horizontal tile, vertical tile.
                    return false;
                }

                const coord = args[0].split(',');
                if (coord.length < 3) {
                    return false;
                }

                player.closeModal();

                if (!player.canAccess()) {
                    player.messageGame('Please finish what you are doing first.');
                    return false;
                }

                player.clearInteraction();
                player.unsetMapFlag();

                const level = tryParseInt(coord[0], 0);
                const mx = tryParseInt(coord[1], 50);
                const mz = tryParseInt(coord[2], 50);
                const lx = tryParseInt(coord[3], 32);
                const lz = tryParseInt(coord[4], 32);

                if (level < 0 || level > 3 || mx < 0 || mx > 255 || mz < 0 || mz > 255 || lx < 0 || lx > 63 || lz < 0 || lz > 63) {
                    return false;
                }

                player.teleJump((mx << 6) + lx, (mz << 6) + lz, level);
            } else if (cmd === 'teleto' && Environment.NODE_PRODUCTION) {
                // custom
                if (args.length < 1) {
                    return false;
                }

                // ::teleto <username>
                const other = World.getPlayerByUsername(args[0]);
                if (!other) {
                    player.messageGame(`${args[0]} is not logged in.`);
                    return false;
                }

                player.closeModal();

                if (!player.canAccess()) {
                    player.messageGame('Please finish what you are doing first.');
                    return false;
                }

                player.clearInteraction();
                player.unsetMapFlag();

                player.teleJump(other.x, other.z, other.level);
            } else if (cmd === 'setvis' && Environment.NODE_PRODUCTION) {
                // authentic
                if (args.length < 1) {
                    // ::setvis <level>
                    return false;
                }

                switch (args[0]) {
                    case '0':
                        player.setVisibility(Visibility.DEFAULT);
                        break;
                    case '1':
                        player.setVisibility(Visibility.SOFT);
                        break;
                    case '2':
                        player.setVisibility(Visibility.HARD);
                        break;
                    default:
                        return false;
                }
            } else if (cmd === 'ban' && Environment.NODE_PRODUCTION) {
                // custom
                if (args.length < 2) {
                    // ::ban <username> <minutes>
                    player.messageGame('Usage: ::ban <username> <minutes>');
                    return false;
                }

                const username = args[0];
                const minutes = Math.max(0, tryParseInt(args[1], 60));

                World.notifyPlayerBan(player.username, username, Date.now() + minutes * 60 * 1000);
                player.messageGame(`Player '${args[0]}' has been banned for ${minutes} minutes.`);
            } else if (cmd === 'mute' && Environment.NODE_PRODUCTION) {
                // custom
                if (args.length < 2) {
                    // ::mute <username> <minutes>
                    player.messageGame('Usage: ::mute <username> <minutes>');
                    return false;
                }

                const username = args[0];
                const minutes = Math.max(0, tryParseInt(args[1], 60));

                World.notifyPlayerMute(player.username, username, Date.now() + minutes * 60 * 1000);
                player.messageGame(`Player '${args[0]}' has been muted for ${minutes} minutes.`);
            } else if (cmd === 'kick' && Environment.NODE_PRODUCTION) {
                // custom
                if (args.length < 1) {
                    // ::kick <username>
                    player.messageGame('Usage: ::kick <username>');
                    return false;
                }

                const username = args[0];

                const other = World.getPlayerByUsername(username);
                if (other) {
                    other.loggingOut = true;
                    if (isClientConnected(other)) {
                        other.logout();
                        other.client.close();
                    }
                    player.messageGame(`Player '${args[0]}' has been kicked from the game.`);
                } else {
                    player.messageGame(`Player '${args[0]}' does not exist or is not logged in.`);
                }
            }
        }

        return true;
    }
}
