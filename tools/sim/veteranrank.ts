// ::veteran - the Veteran rank, from the command to the account row and back to the chat icon.
//
// THE PART WORTH TESTING IS THE ROUND TRIP, and it is the part nothing else checks. The command
// posts a message to the login worker, the worker writes the account table and posts a reply, and
// World turns the reply into a crown. Every hop is a string literal in an `any`-typed message, so
// the compiler is no help at all: one typo and the command says "granting..." for ever and nothing
// happens. So this runs the real worker against the real database rather than stubbing either.
//
// It makes its own account rows, named so they cannot collide with anybody's, and deletes them at
// the end - including when an assertion fails, or a failed run would leave them behind.
//
//   npx tsx tools/sim/veteranrank.ts
import { DatabaseSync } from 'node:sqlite';

import * as H from './harness.ts';
import { check, R, player } from './a1lib.ts';
import ClientCheatHandler from '#/network/game/client/handler/ClientCheatHandler.js';
import ClientCheat from '#/network/game/client/model/ClientCheat.js';
import World from '#/engine/World.js';
import Player from '#/engine/entity/Player.js';
import { chatCrown } from '#/engine/entity/ChatCrown.js';
import { toBase37, toSafeName } from '#/util/JString.js';
import ScriptProvider from '#/engine/script/ScriptProvider.js';
import ScriptRunner from '#/engine/script/ScriptRunner.js';

/**
 * What ~broadcast_name returns for this player: the icon markers and their display name, the
 * string a yell or a rare drop is built from. runProc only hands back the int stack, and this proc
 * returns a string, so the string stack is read directly.
 */
function broadcastName(p: Player): string {
    const script = ScriptProvider.getByName('[proc,broadcast_name]');
    if (!script) throw new Error('no [proc,broadcast_name] - is the content built?');
    const state = ScriptRunner.init(script, p, null, []);
    ScriptRunner.execute(state);
    const st = state as unknown as { stringStack: (string | null)[]; ssp: number };
    return st.stringStack[st.ssp - 1] ?? '';
}

/** The rank markers in a name, which is every icon marker except the three xp badges. */
function rankMarkers(name: string): string[] {
    return (ChatIcons.leading(name).match(/@cr[0-9a]@/g) ?? []).filter(m => m !== '@cr3@' && m !== '@cr4@' && m !== '@cr5@');
}

/** The client's own reader, so the test agrees with what will actually be drawn. */
const ChatIcons = {
    leading(text: string): string {
        let i = 0;
        while (/^@cr[1-9a]@/.test(text.slice(i))) i += 5;
        return text.slice(0, i);
    }
};

const TARGET = 'vetsim_tgt';
const MISSING = 'vetsim_none';
const db = new DatabaseSync('db.sqlite');

function cleanup() {
    db.prepare("DELETE FROM account WHERE username LIKE 'vetsim\\_%' ESCAPE '\\'").run();
}

function veteranOf(username: string): number | null {
    const row = db.prepare('SELECT veteran FROM account WHERE username = ?').get(toSafeName(username)) as { veteran: number } | undefined;
    return row ? row.veteran : null;
}

/** Wait for the login worker's reply, which World clears the request on. */
async function settled(username: string, ticks = 200): Promise<boolean> {
    const safe = toSafeName(username);
    for (let i = 0; i < ticks; i++) {
        if (!World.veteranRequests.has(safe)) {
            return true;
        }
        await new Promise(resolve => setTimeout(resolve, 25));
    }
    return false;
}

cleanup();
await H.boot();

const handler = new ClientCheatHandler();
const run = (p: Player, text: string) => {
    H.clearLogs();
    handler.handle(new ClientCheat(text), p);
    return H.mesgs.filter(m => m.who === p.username).map(m => m.text);
};
const since = (p: Player) => H.mesgs.filter(m => m.who === p.username).map(m => m.text);

try {
    // ---------------------------------------------------------------- the crown itself
    console.log('\nTHE CROWN, WITHOUT ANY OF THE PLUMBING');
    check('  a plain player has no icon', chatCrown(0, false), 0);
    check('  a veteran has crown 7', chatCrown(0, true), 7);
    // The one that is easy to get backwards. A veteran who is also a moderator is a moderator:
    // the rank that carries powers is the one worth seeing.
    check('  staff beats veteran, not the other way round', chatCrown(2, true), 2);
    check('  and the owner too', chatCrown(5, true), 5);
    check('  a veteran is NOT 6, which is the second owner', chatCrown(0, true) === 6, false);

    // ---------------------------------------------------------------- the appearance byte
    console.log('\nTHE BYTE EVERYONE ELSE IS SENT');
    const solo = player('vetsim_byte', 3222, 3222);
    solo.veteran = true;
    check('  crown 7 in the low nibble', solo.chatIcons() & 0xf, 7);
    // The badge shares the byte; a veteran on Realism must not come out as some other crown.
    check('  the badge is still in the high nibble', (solo.chatIcons() >> 4) & 0xf, 1);
    solo.veteran = false;
    check('  and nothing when the flag is off', solo.chatIcons() & 0xf, 0);

    // ---------------------------------------------------------------- and the broadcast line
    // THE ICON OVER THE HEAD WAS NEVER THE WHOLE OF IT. ~broadcast_name builds the name for a
    // yell, an announcement, a rare drop and a pet, and it used to read staffmodlevel and rebuild
    // the ladder itself - which cannot reach this rank at all, because Veteran is a flag on the
    // account and not a staff level. So a veteran's icon showed over their head and on their
    // public chat (both come from the appearance byte above) and vanished the moment they yelled.
    // It reads the chatcrown op now, which is the same number as the byte, so the two cannot
    // disagree. @cr9@ is the marker the client's ChatIcons.forPlayer draws crown 7 as.
    console.log('\nAND THE NAME A YELL OR A RARE DROP GOES OUT WITH');
    solo.veteran = true;
    check('  a veteran yells with the bronze emblem', ChatIcons.leading(broadcastName(solo)).includes('@cr9@'), true);
    check('    and only one rank marker', rankMarkers(broadcastName(solo)).length, 1);
    solo.veteran = false;
    check('  a plain player has no rank marker', rankMarkers(broadcastName(solo)).length, 0);
    // The XP badge is a separate marker and must survive either way - it is the thing a veteran
    // used to be left with on its own.
    check('    but still their xp badge', ChatIcons.leading(broadcastName(solo)).includes('@cr3@'), true);
    // Staff still wins here, exactly as it does in the byte.
    solo.veteran = true;
    solo.staffModLevel = 2;
    check('  a moderator who is also a veteran yells as a moderator', ChatIcons.leading(broadcastName(solo)).includes('@cr2@'), true);
    check('    and not as a veteran', ChatIcons.leading(broadcastName(solo)).includes('@cr9@'), false);
    solo.staffModLevel = 0;
    solo.veteran = false;

    // ---------------------------------------------------------------- and a private message
    // THE ICON AND THE STAFF LEVEL TRAVEL AS TWO FIELDS, which is the whole reason this works.
    // A private message goes out through the friend server, and FriendServerRepository.register
    // enrols anything above staffLvl 1 as staff - so putting crown 7 in staffLvl to get the emblem
    // drawn would quietly make every veteran staff on the friend server. `crown` is a field of its
    // own and `staffLvl` keeps meaning staff level.
    console.log('\nAND A PRIVATE MESSAGE');
    const sent: Record<string, unknown>[] = [];
    const ft = (World as unknown as { friendThread: { postMessage: (m: Record<string, unknown>) => void } }).friendThread;
    const realPost = ft.postMessage.bind(ft);
    ft.postMessage = (m: Record<string, unknown>) => void sent.push(m);
    try {
        const pm = player('vetsim_pm', 3222, 3224);
        pm.veteran = true;
        World.sendPrivateMessage(pm, toBase37('vetsim_pm2'), 'hello');
        check('  a veteran sends the bronze emblem', sent[sent.length - 1]?.crown, 7);
        check('    and their staff level is still 0', sent[sent.length - 1]?.staffLvl, 0);
        pm.veteran = false;
        pm.staffModLevel = 2;
        World.sendPrivateMessage(pm, toBase37('vetsim_pm2'), 'hello');
        check('  a moderator still sends the gold crown', sent[sent.length - 1]?.crown, 2);
        check('    with the staff level beside it', sent[sent.length - 1]?.staffLvl, 2);
        pm.staffModLevel = 0;
        World.sendPrivateMessage(pm, toBase37('vetsim_pm2'), 'hello');
        check('  and a plain player sends no icon', sent[sent.length - 1]?.crown, 0);
        H.despawn(pm);
    } finally {
        ft.postMessage = realPost;
    }
    H.despawn(solo);

    // ---------------------------------------------------------------- the round trip
    console.log('\n::veteran, THROUGH THE REAL LOGIN WORKER');
    db.prepare("INSERT INTO account (username, password, veteran) VALUES (?, '-', 0)").run(TARGET);
    check('  the test account starts without it', veteranOf(TARGET), 0);

    const admin = player('vetsim_admin', 3222, 3222);
    admin.staffModLevel = 3;
    const target = player(TARGET, 3224, 3222);
    // As it would be after login, so the live refresh has something to rebuild.
    target.buildAppearance(0);

    const said = run(admin, `veteran ${TARGET}`);
    check(
        '  the administrator is told it is in flight',
        said.some(m => m.includes('granting')),
        true
    );
    check('  it settled', await settled(TARGET), true);

    check('  the account row is set', veteranOf(TARGET), 1);
    check('  the player has it without relogging', target.veteran, true);
    check('  and their appearance now carries crown 7', target.chatIcons() & 0xf, 7);
    check(
        '  the administrator is told who',
        since(admin).some(m => m.includes('Vetsim Tgt') && m.includes('now has the Veteran rank')),
        true
    );
    check(
        '  and the player is told',
        since(target).some(m => m.includes('You have been given the Veteran rank')),
        true
    );

    // ---------------------------------------------------------------- taking it back
    console.log('\n::veteran <name> off');
    run(admin, `veteran ${TARGET} off`);
    check('  it settled', await settled(TARGET), true);
    check('  the account row is cleared', veteranOf(TARGET), 0);
    check('  the player loses it at once', target.veteran, false);
    check('  and the crown with it', target.chatIcons() & 0xf, 0);
    check(
        '  the administrator is told',
        since(admin).some(m => m.includes('no longer has the Veteran rank')),
        true
    );

    // ---------------------------------------------------------------- the ways it can go wrong
    console.log('\nWHAT IT SAYS WHEN IT CANNOT');
    const usage = run(admin, 'veteran');
    check(
        '  no name at all gets the usage line',
        usage.some(m => m.startsWith('Usage: ::veteran')),
        true
    );

    run(admin, `veteran ${MISSING}`);
    check('  it settled', await settled(MISSING), true);
    check(
        '  an account that does not exist says so',
        since(admin).some(m => m.includes('there is no account called Vetsim None')),
        true
    );

    // A DISPLAY NAME WITH A SPACE IN IT, which the handler has already split in two by the time
    // the command sees it. This is the one ::ban gets wrong - it reads args[0] and acts on
    // "Vetsim", a name nobody has - so it is worth holding this command to a higher standard than
    // the ones beside it.
    db.prepare("INSERT INTO account (username, password, veteran) VALUES ('vetsim_spcd', '-', 0)").run();
    run(admin, 'veteran Vetsim Spcd');
    check('  it settled', await settled('vetsim_spcd'), true);
    check('  "Vetsim Spcd" finds vetsim_spcd', veteranOf('vetsim_spcd'), 1);

    // And the same name with the flag after it, which is where joining the arguments could easily
    // have swallowed the "off".
    run(admin, 'veteran Vetsim Spcd off');
    check('  it settled', await settled('vetsim_spcd'), true);
    check('  "Vetsim Spcd off" takes it back', veteranOf('vetsim_spcd'), 0);

    // "off" on its own is not a name.
    const offOnly = run(admin, 'veteran off');
    check(
        '  ::veteran off alone gets the usage line',
        offOnly.some(m => m.startsWith('Usage: ::veteran')),
        true
    );

    // ---------------------------------------------------------------- a player below the rank
    console.log('\nWHO MAY RUN IT');
    const mod = player('vetsim_mod', 3226, 3222);
    mod.staffModLevel = 2;
    const refused = run(mod, `veteran ${TARGET}`);
    check(
        '  a moderator cannot',
        refused.some(m => m.includes('granting')),
        false
    );
    check('  and the row is untouched', veteranOf(TARGET), 0);

    H.despawn(admin, target, mod);
} finally {
    cleanup();
    db.close();
}

console.log(`\n${R.ok} ok, ${R.bad} FAIL`);
process.exit(R.bad ? 1 : 0);
