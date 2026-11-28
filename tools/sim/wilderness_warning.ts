// The Wilderness WARNING !!! screen (inter_46), ported from PlagueCityRS 349 in DeathPlateau-Content
// (area_wilderness/scripts/wilderness_warning.rs2). Walking north into the four rows just south of the
// Wilderness opens it once per login; underground the same; north of the strip, or a second time, not.
// Usage: npx tsx tools/sim/wilderness_warning.ts
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

const WARNING = Component.getId('inter_46');
// [zone,...] triggers fire from NetworkPlayer's zone-change check, which a sim player does not run, so
// this does the same: whenever the player's 8x8 zone changes, fire the new zone's trigger.
const lastZone = new Map<Player, string>();
const zoneOf = (p: Player) => `${p.level}_${p.x >> 3}_${p.z >> 3}`;
const step = (p: Player) => {
    H.tick(1);
    const now = zoneOf(p);
    if (lastZone.get(p) !== now) {
        lastZone.set(p, now);
        p.triggerZone(p.level, (p.x >> 3) << 3, (p.z >> 3) << 3);
    }
};
const walk = (p: Player, x: number, z: number, ticks = 20) => {
    H.walkTo(p, x, z);
    for (let i = 0; i < ticks && (p.x !== x || p.z !== z) && p.modalMain === -1; i++) step(p);
    step(p);
    step(p);
};

console.log('WILDERNESS  the warning screen, above ground');
{
    const p = H.makePlayer('edgewalker', 3090, 3505, 1);
    H.tick(1);
    lastZone.set(p, zoneOf(p));
    check('no warning before the strip', p.modalMain, -1);
    walk(p, 3090, 3513);
    check('walking into the strip opens WARNING !!!', p.modalMain, WARNING);
    check('...and stops the walk at the edge', p.z < 3516, true);
    p.closeModal();
    walk(p, 3090, 3505);
    walk(p, 3090, 3513);
    check('not a second time in the same login', p.modalMain, -1);
}

console.log('WILDERNESS  already in the Wilderness');
{
    const p = H.makePlayer('wildling', 3090, 3530, 2);
    H.tick(2);
    lastZone.set(p, zoneOf(p));
    walk(p, 3090, 3514);
    check('coming south out of it, no warning', p.modalMain, -1);
}

console.log('WILDERNESS  underground');
{
    const p = H.makePlayer('digger', 3132, 9909, 3);
    H.tick(1);
    lastZone.set(p, zoneOf(p));
    walk(p, 3132, 9913);
    check('the same strip underground opens it', [p.z >= 9912, p.modalMain], [true, WARNING]);
}

check('no script errors', errors, []);

console.log(`\n${R.ok} ok, ${R.bad} FAIL`);
process.exit(R.bad ? 1 : 0);
