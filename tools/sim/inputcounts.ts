// What the client reports about the person using it, counted for everybody.
//
// THE PROPERTY THIS EXISTS FOR. InputTracking's capture is off unless somebody turns it on for a
// suspect, because it costs about a megabyte per player-hour. The COUNTS are not: they run for
// every session always, cost five integers, and are the triage that says who is worth the capture.
// So the counters have to sit in front of the `if (!this.active) return` in each method, and this
// checks they do - a counter behind that gate reads zero for everybody who was never suspected,
// which is everybody, which is the same as not having it.
//
// A sim player is a plain Player with no socket, so isClientConnected is false and none of this
// runs for it. This builds a real NetworkPlayer on a socket that throws its bytes away.
//
// Usage: NODE_PRODUCTION=true npx tsx tools/sim/inputcounts.ts
import fs from 'fs';

import * as H from './harness.js';
import World from '#/engine/World.js';
import ClientCheat from '#/network/game/client/model/ClientCheat.js';
import ClientCheatHandler from '#/network/game/client/handler/ClientCheatHandler.js';
import { NetworkPlayer } from '#/engine/entity/NetworkPlayer.js';
import EventAppletFocus from '#/network/game/client/model/EventAppletFocus.js';
import EventCameraPosition from '#/network/game/client/model/EventCameraPosition.js';
import EventMouseClick from '#/network/game/client/model/EventMouseClick.js';
import EventMouseMove from '#/network/game/client/model/EventMouseMove.js';
import ClientSocket from '#/server/ClientSocket.js';
import { toBase37 } from '#/util/JString.js';

await H.boot();

const R = { ok: 0, bad: 0 };
const check = (what: string, got: unknown, want: unknown) => {
    const pass = JSON.stringify(got) === JSON.stringify(want);
    if (pass) R.ok++;
    else R.bad++;
    console.log(`  ${pass ? 'ok  ' : 'FAIL'} ${what}: ${JSON.stringify(got)}${pass ? '' : `   (want ${JSON.stringify(want)})`}`);
};

class Sink extends ClientSocket {
    send(_src: Uint8Array): void {}
    read(): boolean {
        return false;
    }
    get bufferedBytes(): number {
        return 0;
    }
    close(): void {}
    terminate(): void {}
}

function join(name: string): NetworkPlayer {
    const socket = new Sink();
    socket.remoteAddress = '127.0.0.1';
    const p = new NetworkPlayer(name, toBase37(name), BigInt(Math.floor(Math.random() * 1e9)), socket);
    p.teleport(3222, 3222, 0);
    World.newPlayers.add(p);
    return p;
}

const p = join('inputcounts1');
World.cycle();

// ---- the capture is off by default, which is the whole reason the counts cannot live behind it
check('capture is off for a new session', p.input.active, false);

const before = { ...{ moves: p.input.mouseMoves, clicks: p.input.mouseClicks, camera: p.input.cameraMoves, focus: p.input.focusChanges } };
const captured = p.input.buf.pos;

// ---- what the client sends, through the same methods the handlers call
p.input.mouseMove(new EventMouseMove(new Uint8Array([1, 2, 3, 4])));
p.input.mouseMove(new EventMouseMove(new Uint8Array([5, 6])));
p.input.mouseClick(new EventMouseClick(12345));
p.input.cameraPosition(new EventCameraPosition(128, 1024));
p.input.appletFocus(new EventAppletFocus(1));

check('a mouse report is counted with capture off', p.input.mouseMoves - before.moves, 2);
check('...and a click', p.input.mouseClicks - before.clicks, 1);
check('...and a camera turn', p.input.cameraMoves - before.camera, 1);
check('...and the window losing focus', p.input.focusChanges - before.focus, 1);
check('the four add up to what the report tool reads', p.input.telemetry >= 5, true);
check('and NOTHING was captured, because capture is still off', p.input.buf.pos, captured);

// ---- with capture on, the counts keep counting AND the content starts being kept
p.input.active = true;
const onCounts = p.input.mouseMoves;
p.input.mouseMove(new EventMouseMove(new Uint8Array([7, 8, 9])));
check('with capture on the count still moves', p.input.mouseMoves - onCounts, 1);
check('...and now the bytes are kept too', p.input.buf.pos > captured, true);
p.input.active = false;

// ---- an empty mouse report is counted but not kept: the client sends them, and a count of
// "the client spoke" is the point rather than a count of bytes worth keeping
p.input.active = true;
const emptyAt = p.input.buf.pos;
const emptyCount = p.input.mouseMoves;
p.input.mouseMove(new EventMouseMove(new Uint8Array([])));
check('an empty report still counts as the client speaking', p.input.mouseMoves - emptyCount, 1);
check('...but adds no bytes to the capture', p.input.buf.pos, emptyAt);
p.input.active = false;

// ---- actions are counted beside them, because the counts mean nothing apart
check('a session starts with no actions', p.input.userActions, 0);
p.input.userAction();
p.input.userAction();
check('and counts what the world acted on', p.input.userActions, 2);

// ---- THE CALL SITE, read out of the source. Everything above would pass with userAction() never
// called from anywhere, and then every session would report zero actions and the report tool would
// rank nobody. It belongs to the branch that has already decided the event was a USER_EVENT and
// that the world accepted it.
const src = fs.readFileSync('src/engine/entity/NetworkPlayer.ts', 'utf8');
const branch = src.indexOf('if (success && message.category === ClientGameProtCategory.USER_EVENT) {');
const branchEnd = branch < 0 ? -1 : src.indexOf('}', branch);
const body = branch < 0 || branchEnd < 0 ? '' : src.substring(branch, branchEnd);
check('the action counter is called from the decode loop', body.indexOf('this.input.userAction()') >= 0, true);

// ---- and a session nobody played is not written at all
const quiet = join('inputcounts2');
World.cycle();
quiet.input.userActions = 0;
quiet.input.mouseMoves = 0;
quiet.input.mouseClicks = 0;
quiet.input.cameraMoves = 0;
quiet.input.focusChanges = 0;
let submitted = 0;
const realPost = (World as unknown as { loggerThread: { postMessage: (m: unknown) => void } }).loggerThread.postMessage;
(World as unknown as { loggerThread: { postMessage: (m: unknown) => void } }).loggerThread.postMessage = function (m: unknown) {
    if ((m as { type?: string }).type === 'input_counts') {
        submitted++;
    }
    return realPost.call(this, m);
};
World.submitInputCounts(quiet);
check('a connection that did nothing writes no row', submitted, 0);
quiet.input.userActions = 5;
World.submitInputCounts(quiet);
check('...and one that did something writes one', submitted, 1);

// ---- ::track, WITHOUT WHICH NONE OF THE CAPTURE IS REACHABLE. input.active was only ever set by
// a player being reported: the RELAY_TRACK opcode exists and the friend server relays it, and no
// caller was ever written. So a suspect the counts above flag could not be watched.
// SHORT NAMES, because base37 holds twelve characters and getPlayerByUsername looks up by
// username37: 'inputcounts_sus' is fifteen, so toBase37 mangled it and the lookup matched nothing.
// The test read as "an administrator cannot turn the capture on", which was a lie about the engine.
const staff = join('ic_mod');
const suspect = join('ic_sus');
World.cycle();
const cheat = new ClientCheatHandler();
const said: string[] = [];
(suspect as unknown as { messageGame: (m: string) => void }).messageGame = () => {};
(staff as unknown as { messageGame: (m: string) => void }).messageGame = (m: string) => {
    said.push(m);
};

staff.staffModLevel = 2;
cheat.handle(new ClientCheat(`track ${suspect.username}`), staff);
check('a moderator cannot turn the capture on', suspect.input.active, false);

staff.staffModLevel = 3;
cheat.handle(new ClientCheat(`track ${suspect.username}`), staff);
check('an administrator can', suspect.input.active, true);
check('...and is told who', /ic.sus/i.test(said[said.length - 1] ?? ''), true);

said.length = 0;
cheat.handle(new ClientCheat('track'), staff);
check('::track with no name lists who is being watched', /ic.sus/i.test(said[0] ?? ''), true);

cheat.handle(new ClientCheat(`untrack ${suspect.username}`), staff);
check('::untrack turns it off again', suspect.input.active, false);

said.length = 0;
cheat.handle(new ClientCheat('track'), staff);
check('...and then it lists nobody', /nobody/i.test(said[0] ?? ''), true);

said.length = 0;
cheat.handle(new ClientCheat('track someone_not_here'), staff);
check('a name nobody is using says so rather than failing silently', /not online/i.test(said[0] ?? ''), true);

console.log(`\n${R.ok} ok, ${R.bad} failed`);
process.exit(R.bad > 0 ? 1 : 0);
