// Run a populated world for a long stretch and count anything that throws.
import * as H from './harness.js';

let errors = 0;
const origErr = console.error;
console.error = (...a: any[]) => {
    errors++;
    origErr('  ERR:', String(a[0]).slice(0, 160));
};

await H.boot();
H.loginOrder();

// a handful of fights running at once, plus the 11780 static npcs the world already has
const ps: any[] = [];
for (let i = 0; i < 6; i++) {
    const p = H.makePlayer('soak' + i, 3210 + (i % 3), 3910 + Math.floor(i / 3), i + 1);
    ps.push(p);
}
H.tick(1);
for (const p of ps) {
    H.maxOut(p);
    H.equip(p, { rhand: 'abyssal_whip' });
    H.runProc(p, '[proc,player_combat_stat]');
    H.give(p, 'shark', 200);
    H.give(p, '4doseprayerrestore', 20);
}
for (let i = 0; i < ps.length; i += 2) {
    H.attack(ps[i], ps[i + 1]);
    H.attack(ps[i + 1], ps[i]);
}

const t0 = Date.now();
for (let t = 0; t < 400; t++) {
    H.tick(1);
    for (const p of ps) {
        if (p.levels[3] < 60 && p.levels[3] > 0) {
            try {
                H.opheld(p, 'shark', 1);
            } catch {
                /* none left */
            }
        }
        if (p.levels[3] === 0) p.setLevel(3, 99);
        if (t % 37 === 0) {
            try {
                H.opheld(p, '4doseprayerrestore', 1);
            } catch {
                /* none left */
            }
        }
    }
    for (let i = 0; i < ps.length; i += 2) {
        if (!(ps[i] as any).target) H.attack(ps[i], ps[i + 1]);
        if (!(ps[i + 1] as any).target) H.attack(ps[i + 1], ps[i]);
    }
}
console.log(`400 ticks with 6 fighting players and the full npc population in ${Date.now() - t0}ms`);
console.log('hitsplats:', H.hits.length, ' errors:', errors);
process.exit(errors ? 1 : 0);
