// ::changepassword through the real handler, World and login thread against the real account table,
// and ::ban / ::mute persisting without a login server (LoginThread). Makes its own accounts and
// removes them after. Usage: npx tsx tools/sim/changepassword.ts
import * as bcrypt from 'bcrypt-ts';

import * as H from './harness.js';
import { db, toDbDate } from '#/db/query.js';
import World from '#/engine/World.js';
import Player from '#/engine/entity/Player.js';
import ClientCheatHandler from '#/network/game/client/handler/ClientCheatHandler.js';
import ClientCheat from '#/network/game/client/model/ClientCheat.js';

await H.boot();
H.loginOrder();

// Every World.cycle() schedules the next one (setTimeout at its end). The other sims never give the
// event loop a turn, so those never run; this one has to, to hear back from the login thread - and
// the world would then tick on its own, with nobody refreshing the players, and log them out. Only
// H.tick() moves the world here.
const realSetTimeout = globalThis.setTimeout;
(globalThis as any).setTimeout = (fn: (...args: unknown[]) => void, ms?: number, ...rest: unknown[]) => (fn?.name === 'bound cycle' ? undefined : realSetTimeout(fn, ms, ...rest));

const R = { ok: 0, bad: 0 };
const check = (what: string, got: unknown, want: unknown) => {
    const pass = JSON.stringify(got) === JSON.stringify(want);
    if (pass) R.ok++;
    else R.bad++;
    console.log(`  ${pass ? 'ok  ' : 'FAIL'} ${what}: ${JSON.stringify(got)}${pass ? '' : `   (want ${JSON.stringify(want)})`}`);
};

const NAMES = ['pwtest', 'bantest'];
await db.deleteFrom('account').where('username', 'in', NAMES).execute();
for (const username of NAMES) {
    await db
        .insertInto('account')
        .values({ username, password: bcrypt.hashSync('oldpass1', 10), registration_ip: '127.0.0.1', registration_date: toDbDate(new Date()) })
        .execute();
}
const hashOf = async (username: string) => (await db.selectFrom('account').select('password').where('username', '=', username).executeTakeFirstOrThrow()).password;

const cheat = new ClientCheatHandler();
const p = H.makePlayer('pwtest', 3222, 3222, 1);
H.tick(2);

// the login thread answers asynchronously: wait until the player is told something, or give up.
//
// A MINUTE, NOT FIVE SECONDS, and it is not generosity. The checks that cross into the login
// worker are the only ones here that can time out, and a timeout does not cost its own check
// alone: World.onLoginMessage is what removes the username from World.passwordChanges (World.ts),
// so an answer that has not arrived leaves the username in that set, and every later
// requestPasswordChange returns false and reads "Your last password change is still being
// processed." One slow round trip therefore fails every check after it. This sim was the last
// entry in known-failing.txt that behaved differently on a runner than here on the same seed,
// which is the shape of a wait that is long enough on one machine and not the other.
//
// The real work is two bcrypt hashes - milliseconds. Nothing correct is made to pass by waiting
// longer; only a loaded machine is given room to answer at all.
const ANSWER_WAIT_MS = 60_000;
async function say(player: Player, text: string): Promise<string> {
    H.mesgs.length = 0;
    cheat.handle(new ClientCheat(text), player);
    const said = () => H.mesgs.filter(m => m.who === player.username).map(m => m.text);
    const deadline = Date.now() + ANSWER_WAIT_MS;
    while (Date.now() < deadline) {
        const lines = said();
        if (lines.length > 0 && lines[lines.length - 1] !== 'Checking your password...') {
            return lines[lines.length - 1];
        }
        // the reply is a message event from the login thread - it needs the event loop, not a tick.
        // realSetTimeout, because the override above is still in force.
        await new Promise(r => realSetTimeout(r, 50));
    }
    // Printed rather than swallowed: if this ever happens again the next run says which request
    // went unanswered and whether the world is still holding the lock, instead of leaving a wall
    // of "still being processed" to work backwards from.
    console.log(`  --   nothing came back for "${text}" in ${ANSWER_WAIT_MS / 1000}s; said so far ${JSON.stringify(said())}, still in World.passwordChanges: ${World.passwordChanges.has(player.username)}`);
    return '(no answer)';
}
const cool = () => H.tick(9);

console.log('::changepassword');
check('no arguments: usage', await say(p, 'changepassword'), 'Usage: ::changepassword current new new');
cool();
check('new passwords differ', await say(p, 'changepassword oldpass1 newpass1 newpass2'), 'The two new passwords do not match.');
check('straight after: the cooldown', await say(p, 'changepassword oldpass1 newpass1 newpass1'), 'Please wait a few seconds before trying again.');
cool();
check('too short', await say(p, 'changepassword oldpass1 abc abc'), 'Your new password must be 5 to 20 characters long.');
cool();
check('a character the login screen cannot type', await say(p, 'changepassword oldpass1 new`pass new`pass'), 'Your new password can only use letters, numbers and symbols you can type at the login screen.');
cool();
check('same as the current one', await say(p, 'changepassword oldpass1 oldpass1 oldpass1'), 'Your new password must be different from your current one.');
cool();
check('the username', await say(p, 'changepassword oldpass1 pwtest pwtest'), 'Your password cannot be your username.');
cool();
// WARM THE LOGIN WORKER before anything is timed against it. Every check above is answered
// inside ClientCheatHandler without leaving the game thread; this is the first that posts to the
// login thread, and that thread is a tsx-compiled worker which does not exist until the first
// message reaches it. On a cold machine the compile is the round trip, not the hashing. Paid here,
// where nothing is being measured and a wrong current password cannot change anything.
await say(p, 'changepassword notmine1 warmup12 warmup12');
cool();

const before = await hashOf('pwtest');
check('wrong current password', await say(p, 'changepassword notmine1 newpass1 newpass1'), 'That is not your current password. Your password has not been changed.');
check('... and the stored hash is untouched', (await hashOf('pwtest')) === before, true);
cool();
check('right current password (typed in capitals - passwords are not case sensitive)', await say(p, 'changepassword OLDPASS1 N3w!pass N3w!pass'), 'Your password has been changed.');
const after = await hashOf('pwtest');
check('the new password logs in', bcrypt.compareSync('n3w!pass', after), true);
check('the old one no longer does', bcrypt.compareSync('oldpass1', after), false);

console.log('::ban / ::mute without a login server');
const until = Date.now() + 60 * 60 * 1000;
World.notifyPlayerBan('owner', 'bantest', until);
World.notifyPlayerMute('owner', 'bantest', until);
let row = null;
for (let i = 0; i < 40; i++) {
    await new Promise(r => setTimeout(r, 50));
    row = await db.selectFrom('account').select(['banned_until', 'muted_until']).where('username', '=', 'bantest').executeTakeFirst();
    if (row?.banned_until && row?.muted_until) break;
}
check('the ban is in the account table', row?.banned_until !== null && row?.banned_until !== undefined, true);
check('the mute is in the account table', row?.muted_until !== null && row?.muted_until !== undefined, true);

await db.deleteFrom('account').where('username', 'in', NAMES).execute();
console.log(`\n${R.ok} ok, ${R.bad} failed`);
process.exit(R.bad > 0 ? 1 : 0);
