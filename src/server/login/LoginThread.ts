import fs from 'fs';
import { parentPort } from 'worker_threads';

import { LoginClient } from '#/server/login/LoginClient.js';
import { db, toDbDate } from '#/db/query.js';
import * as bcrypt from 'bcrypt-ts';
import Environment from '#/util/Environment.js';

import { type GenericLoginThreadResponse } from './index.d.js';
import { trackLoginAttempts, trackLoginTime } from './LoginMetrics.js';

const client = new LoginClient(Environment.NODE_ID);

if (!parentPort) throw new Error('This file must be run as a worker thread.');

parentPort.on('message', async msg => {
    try {
        if (!parentPort) throw new Error('This file must be run as a worker thread.');
        await handleRequests(parentPort, msg);
    } catch (err) {
        console.error(err);
    }
});

client.onMessage((opcode, data) => {
    parentPort!.postMessage({ opcode, data });
});

type ParentPort = {
    postMessage: (msg: GenericLoginThreadResponse) => void;
};

// custom (2026-09-27) - the reply for a login refused by NODE_MIN_STAFF_LEVEL. Not one the login server
// uses; World.onLoginMessage turns it into the client's "This world is full. Please use a different world."
// (Not exported: this file is a worker, and importing it anywhere else would run it.)
const REPLY_STAFF_ONLY = 11;

// The account's own level, from the database - checked BEFORE the dev-mode bump below lifts everyone to
// 4, or a staff-only dev world would let every player in.
function belowStaffLevel(staffmodlevel: number | undefined | null): boolean {
    return Environment.NODE_MIN_STAFF_LEVEL > 0 && (staffmodlevel ?? 0) < Environment.NODE_MIN_STAFF_LEVEL;
}

async function handleRequests(parentPort: ParentPort, msg: any) {
    const { type } = msg;

    switch (type) {
        case 'world_startup': {
            if (Environment.LOGIN_SERVER) {
                await client.worldStartup();
            }
            break;
        }
        case 'player_login': {
            const { socket, remoteAddress, username, password, uid, lowMemory, reconnecting, hasSave } = msg;

            if (Environment.LOGIN_SERVER) {
                trackLoginAttempts.inc();
                const stopTimer = trackLoginTime.startTimer();
                const response = await client.playerLogin(username, password, uid, socket, remoteAddress, reconnecting, hasSave);

                // A staff-only world (NODE_MIN_STAFF_LEVEL). Only a login the login server let in (0, 2, 4)
                // is refused here - it has marked the account online on this world by now, so it is
                // released again, the way World releases a login it cannot finish.
                if ((response.reply === 0 || response.reply === 2 || response.reply === 4) && belowStaffLevel(response.staffmodlevel)) {
                    await client.playerForceLogout(username);
                    parentPort.postMessage({ type: 'player_login', socket, username, lowMemory, reconnecting, reply: REPLY_STAFF_ONLY, save: null, account_id: -1, members: false });
                    stopTimer();
                    break;
                }

                if (!Environment.NODE_PRODUCTION) {
                    // dev (destructive commands) - AT LEAST 4, so an owner (5) is not demoted
                    response.staffmodlevel = Math.max(4, response.staffmodlevel ?? 0);
                }

                parentPort.postMessage({
                    type: 'player_login',
                    socket,
                    username,
                    lowMemory,
                    reconnecting,
                    ...response
                });
                stopTimer();
            } else {
                const profile = Environment.NODE_PROFILE;

                let account = await db.selectFrom('account').selectAll().where('username', '=', username).executeTakeFirst();

                // A staff-only world never registers anybody: a name it does not know cannot be staff.
                if (!account && Environment.NODE_MIN_STAFF_LEVEL > 0) {
                    parentPort.postMessage({ type: 'player_login', socket, username, lowMemory, reconnecting, reply: REPLY_STAFF_ONLY, save: null, account_id: -1, members: false });
                    break;
                }

                if (!account) {
                    await db
                        .insertInto('account')
                        .values({
                            username,
                            password: bcrypt.hashSync(password.toLowerCase(), 10),
                            registration_ip: remoteAddress,
                            registration_date: toDbDate(new Date())
                        })
                        .executeTakeFirst();
                    account = await db.selectFrom('account').selectAll().where('username', '=', username).executeTakeFirst();
                }

                // custom (2026-09-27) - this path used to load any existing account and its save without
                // ever looking at the password: anyone could log in as anyone by typing their name.
                // Same checks and replies as LoginServer's player_login.
                if (!account || !(await bcrypt.compare(password.toLowerCase(), account.password))) {
                    parentPort.postMessage({ type: 'player_login', socket, username, lowMemory, reconnecting, reply: 1, save: null, account_id: -1, members: false });
                    break;
                }

                if (account.banned_until !== null && new Date(account.banned_until) > new Date()) {
                    parentPort.postMessage({ type: 'player_login', socket, username, lowMemory, reconnecting, reply: 5, save: null, account_id: -1, members: false });
                    break;
                }

                // after the password and the ban, so a wrong password still says so
                if (belowStaffLevel(account.staffmodlevel)) {
                    parentPort.postMessage({ type: 'player_login', socket, username, lowMemory, reconnecting, reply: REPLY_STAFF_ONLY, save: null, account_id: -1, members: false });
                    break;
                }

                let staffmodlevel = account ? account.staffmodlevel : 0;
                if (!Environment.NODE_PRODUCTION) {
                    // dev (destructive commands) - AT LEAST 4, so an owner (5) is not demoted
                    staffmodlevel = Math.max(4, staffmodlevel);
                }

                const accountId = account ? account.id : 1;

                if (!fs.existsSync(`data/players/${profile}`)) {
                    fs.mkdirSync(`data/players/${profile}`, { recursive: true });
                }

                if (!fs.existsSync(`data/players/${profile}/${username}.sav`)) {
                    parentPort.postMessage({
                        type: 'player_login',
                        socket,
                        username,
                        lowMemory,
                        reconnecting,
                        reply: 4,
                        staffmodlevel,
                        muted_until: account.muted_until,
                        save: null,
                        account_id: accountId,
                        members: Environment.NODE_MEMBERS
                    });
                } else {
                    parentPort.postMessage({
                        type: 'player_login',
                        socket,
                        username,
                        lowMemory,
                        reconnecting,
                        reply: 0,
                        staffmodlevel,
                        muted_until: account.muted_until,
                        save: fs.readFileSync(`data/players/${profile}/${username}.sav`),
                        account_id: accountId,
                        members: Environment.NODE_MEMBERS
                    });
                }
            }
            break;
        }
        case 'player_logout': {
            const { username, save } = msg;

            if (Environment.LOGIN_SERVER) {
                const success = await client.playerLogout(username, save);

                parentPort.postMessage({
                    type: 'player_logout',
                    username,
                    success
                });
            } else {
                const profile = Environment.NODE_PROFILE;
                if (!fs.existsSync(`data/players/${profile}`)) {
                    fs.mkdirSync(`data/players/${profile}`, { recursive: true });
                }

                fs.writeFileSync(`data/players/${profile}/${username}.sav`, save);

                parentPort.postMessage({
                    type: 'player_logout',
                    username,
                    success: true
                });
            }
            break;
        }
        case 'player_autosave': {
            const { username, save } = msg;

            if (Environment.LOGIN_SERVER) {
                await client.playerAutosave(username, save);
            } else {
                const profile = Environment.NODE_PROFILE;
                if (!fs.existsSync(`data/players/${profile}`)) {
                    fs.mkdirSync(`data/players/${profile}`, { recursive: true });
                }

                fs.writeFileSync(`data/players/${profile}/${username}.sav`, save);
            }
            break;
        }
        case 'player_force_logout': {
            if (Environment.LOGIN_SERVER) {
                const { username } = msg;
                await client.playerForceLogout(username);
            }
            break;
        }
        case 'player_ban': {
            const { staff, username, until } = msg;
            if (Environment.LOGIN_SERVER) {
                // todo: wait for confirmation? resend?
                await client.playerBan(staff, username, until);
            } else {
                // custom (2026-09-27) - without a login server a ::ban used to go nowhere: the player was
                // kicked and could log straight back in. Written here, as LoginServer would.
                await db
                    .updateTable('account')
                    .set({ banned_until: toDbDate(until) })
                    .where('username', '=', username)
                    .execute();
            }
            break;
        }
        case 'player_mute': {
            const { staff, username, until } = msg;
            if (Environment.LOGIN_SERVER) {
                // todo: wait for confirmation? resend?
                await client.playerMute(staff, username, until);
            } else {
                // custom (2026-09-27) - as player_ban: a mute now outlasts a relog without a login server
                await db
                    .updateTable('account')
                    .set({ muted_until: toDbDate(until) })
                    .where('username', '=', username)
                    .execute();
            }
            break;
        }
        case 'player_change_password': {
            // custom (2026-09-27) - ::changepassword. The account table is the same database in both login
            // modes, so this goes to it directly. Passwords are compared and stored lowercased, as at login.
            const { username, oldPassword, newPassword } = msg;
            let result: 'ok' | 'wrong' | 'error' = 'error';
            try {
                const account = await db.selectFrom('account').select(['id', 'password']).where('username', '=', username).executeTakeFirst();
                if (!account || !(await bcrypt.compare(oldPassword.toLowerCase(), account.password))) {
                    result = 'wrong';
                } else {
                    const hash = await bcrypt.hash(newPassword.toLowerCase(), 10);
                    await db.updateTable('account').set({ password: hash }).where('id', '=', account.id).execute();
                    result = 'ok';
                }
            } catch (err) {
                console.error(err);
            }
            parentPort.postMessage({ type: 'player_change_password', username, result });
            break;
        }
        case 'world_heartbeat': {
            break;
        }
        default:
            console.error('Unknown message type: ' + msg.type);
            break;
    }
}
