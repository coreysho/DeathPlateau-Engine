// The music tab's LOOP button (music:com_251), ported from PlagueCityRS 349 in DeathPlateau-Content.
// Every song goes through ~music_play, which records the song, when it started and its length from
// the cache; while LOOP is on, a soft timer starts the song again once it has run out. The church
// organs go through ~music_play as well, so the timer knows what is actually playing.
// Usage: npx tsx tools/sim/music_loop.ts
import * as H from './harness.js';
import Player from '#/engine/entity/Player.js';
import World from '#/engine/World.js';

const errors: string[] = [];
const origErr = console.error;
console.error = (...a: unknown[]) => {
    const s = a.map(String).join(' ');
    if (/script error/i.test(s)) errors.push(s);
    origErr(...a);
};

await H.boot();
H.loginOrder();

const R = { ok: 0, bad: 0 };
const check = (what: string, got: unknown, want: unknown) => {
    const pass = JSON.stringify(got) === JSON.stringify(want);
    if (pass) R.ok++;
    else R.bad++;
    console.log(`${pass ? '  ok  ' : 'FAIL  '}${what}: ${JSON.stringify(got)}${pass ? '' : `   (want ${JSON.stringify(want)})`}`);
};

const said = (p: Player, from: number, re: RegExp) => H.mesgs.slice(from).some(m => m.who === p.username && re.test(m.text));

console.log('MUSIC  the LOOP button');
const p = H.makePlayer('looper', 3222, 3222, 1);
H.tick(1);
H.setVar(p, 'musicplay', 1);
// Lumbridge's own music trigger, as walking in would fire it
p.triggerMapzone(p.x, p.z);
H.tick(1);
const song = H.getVar(p, 'currentsong');
const len = H.getVar(p, 'musiclength');
check('a song playing records itself and its length from the cache', [song >= 0, len > 0], [true, true]);

let m0 = H.mesgs.length;
H.ifButton(p, 'music:com_251');
H.tick(1);
check('LOOP on', [H.getVar(p, 'musicloop'), said(p, m0, /looping now enabled/i)], [1, true]);

// a song still playing is left alone
const startedAt = H.getVar(p, 'musicstart');
H.tick(3);
check('a song that has not ended is not restarted', H.getVar(p, 'musicstart'), startedAt);

// make the song have ended: the timer starts it again
H.setVar(p, 'musicstart', 0);
H.setVar(p, 'musiclength', 1);
H.tick(3);
check('the song ending starts it again', [H.getVar(p, 'currentsong'), H.getVar(p, 'musicstart') > 1, H.getVar(p, 'musiclength')], [song, true, len]);

console.log('MUSIC  the church organ, with LOOP on');
{
    const organs = H.locsNear('churchorgan', 2691, 3460);
    check('there is a church organ to play', organs.length > 0, true);
    if (organs.length > 0) {
        const o = organs[0];
        const q = H.makePlayer('organist', o.x, o.z - 1, 2);
        H.tick(1);
        H.setVar(q, 'musicplay', 1);
        q.triggerMapzone(q.x, q.z);
        H.tick(1);
        const before = H.getVar(q, 'currentsong');
        H.ifButton(q, 'music:com_251');
        H.tick(1);
        H.opLoc(q, o.x, o.z, 'churchorgan', 1);
        H.tick(5);
        const organSong = H.getVar(q, 'currentsong');
        check('playing the organ makes its song the one LOOP knows about', [organSong >= 0, organSong !== before, H.getVar(q, 'musiclength') > 0, H.getVar(q, 'musicstart') > 0], [true, true, true, true]);
        // the area song's old start and length must not cut the organ off
        H.tick(3);
        check('...and the loop timer does not put the area song back over it', H.getVar(q, 'currentsong'), organSong);
    }
}

console.log('MUSIC  LOOP off');
m0 = H.mesgs.length;
H.ifButton(p, 'music:com_251');
H.tick(1);
check('LOOP off', [H.getVar(p, 'musicloop'), said(p, m0, /looping now disabled/i)], [0, true]);
H.setVar(p, 'musicstart', 0);
H.setVar(p, 'musiclength', 1);
H.tick(3);
check('an ended song stays ended', H.getVar(p, 'musicstart'), 0);

check('no script errors', errors, []);
void World;

console.log(`\n${R.ok} ok, ${R.bad} FAIL`);
process.exit(R.bad ? 1 : 0);
