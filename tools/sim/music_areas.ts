// MUSIC AREAS: every map square in musicregion.dbrow plays its song when you walk in, and the four
// area timers PlagueCityRS 349 starts on entry are started again (DeathPlateau-Content, music/
// scripts/move.rs2): desert heat, the Desert Mining Camp's guards, the Underground Pass traps and
// Mort Myre's swamp decay.
//   npx tsx tools/sim/music_areas.ts
import fs from 'fs';
import path from 'path';
import * as H from './harness.js';
import Component from '#/cache/config/Component.js';
import Player from '#/engine/entity/Player.js';

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

const hasTimer = (p: Player, name: string) => [...p.timers.values()].some(t => t.script.name === `[timer,${name}]`);
const SONG_NAME = Component.getId('music:com_177');

// [mapzone] triggers fire from NetworkPlayer's map-square check, which a sim player does not run, so
// each square is entered here by standing in it and firing its trigger.
const enter = (p: Player, x: number, z: number) => {
    p.teleport(x, z, 0);
    H.tick(1);
    p.triggerMapzone((x >> 6) << 6, (z >> 6) << 6);
    H.tick(2);
};

console.log('MUSIC AREAS  every region in musicregion.dbrow plays when you walk in');
{
    const file = path.join(process.env.BUILD_SRC_DIR ?? '../content', 'scripts', 'music', 'configs', 'musicregion.dbrow');
    const regions = [...fs.readFileSync(file, 'utf8').matchAll(/^\[musicregion_[^\]]*\]\n(?:[^[]*?\n)?data=mapsquare,0_(\d+)_(\d+)_\d+_\d+/gm)].map(m => ({ mx: +m[1], mz: +m[2] }));
    // level 0 only: music_playbyregion looks squares up on level 0, and the one upper-level row
    // (Throne of the Demon, 2_42_76) is played by music_playbyregionplane
    const rows = (fs.readFileSync(file, 'utf8').match(/^data=mapsquare,0_/gm) ?? []).length;
    check('the table has the 349 regions in it as well, and every row was read', [rows >= 428, regions.length], [true, rows]);
    const p = H.makePlayer('listener', 3222, 3222, 1);
    H.maxOut(p);
    H.tick(1);
    H.setVar(p, 'musicplay', 1);
    const silent: string[] = [];
    for (const r of regions) {
        H.setVar(p, 'musicstart', 0);
        const from = H.ifaces.length;
        enter(p, r.mx * 64 + 32, r.mz * 64 + 32);
        const shown = H.ifaces
            .slice(from)
            .filter(f => f.who === p.username && f.com === SONG_NAME)
            .map(f => f.text);
        if (H.getVar(p, 'musicstart') <= 0 || !shown.some(t => (t ?? '').length > 0)) silent.push(`${r.mx}_${r.mz}`);
    }
    console.log(`    ${regions.length} regions entered`);
    check('every one starts a song and names it on the music tab', silent, []);
}

console.log('MUSIC AREAS  the four timers');
{
    const p = H.makePlayer('wanderer', 3222, 3222, 2);
    H.maxOut(p);
    H.tick(1);
    // the Kharidian Desert, by any way in rather than only Shantay Pass
    enter(p, 3290, 3020);
    check('desert heat starts on a desert square', [H.getVar(p, 'desert'), hasTimer(p, 'desert_heat')], [1, true]);
    // the Desert Mining Camp's square starts the guards' check
    enter(p, 3290, 3030);
    check("the mining camp's guards start checking", hasTimer(p, 'mercenary_check'), true);
    // the Underground Pass
    enter(p, 2400, 9690);
    check('the Underground Pass traps start', hasTimer(p, 'upass_trap'), true);
    // Mort Myre, away from Filliman's camp
    enter(p, 3440, 3400);
    check("Mort Myre's swamp decay starts", [H.getVar(p, 'mortmyre'), hasTimer(p, 'swamp_decay')], [1, true]);
}

check('no script errors', errors, []);

console.log(`\n${R.ok} ok, ${R.bad} FAIL`);
process.exit(R.bad ? 1 : 0);
