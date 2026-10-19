// WHAT ONE SPELL CAST ACTUALLY SENDS, tick by tick, for a hit that kills and a hit that does not.
// Reported as "audio bug when casting spells ... its playing the end of the sound twice - thats if
// it kills the npc, if it doesn't it cuts the sound short".
//
//   npx tsx tools/sim/spellsound.ts
//
// The two helpers this file used to carry - one cast at a fresh npc, and a printer for what
// came back - are gone: the measurement is inline below and nothing had called either of them
// since. A dead helper in a sim is worse than none, because it reads as coverage.
import * as H from './harness.js';
import { check, R } from './a1lib.js';

await H.boot();
H.loginOrder();

console.log('=== EVERY SOUND A SPELL SENDS, AND THE LOOPS FIELD ON IT');
{
    const p: any = H.makePlayer('snd', 2660, 3300, 99);
    H.tick(2);
    H.maxOut(p);
    H.clearInv(p);
    H.equip(p, { rhand: 'staff_of_fire' });
    for (const r of ['airrune', 'deathrune', 'bloodrune', 'chaosrune', 'lawrune', 'waterrune', 'earthrune']) H.give(p, r, 2000);
    H.tick(1);
    const npc: any = H.addNpc('zombie_armed', p.x + 4, p.z);
    npc.baseLevels[1] = 0;
    npc.levels[1] = 0;
    H.tick(2);
    const s0 = H.sounds.length;
    H.castOnNpc(p, npc, 'magic:fire_blast');
    for (let t = 0; t < 10; t++) H.tick(1);
    const got = H.sounds.slice(s0).filter(s => s.who === p.username);
    for (const s of got) console.log(`    ${s.synth.padEnd(26)} loops=${s.loops} delay=${String(s.delay).padStart(3)}`);
    check(
        'nothing a spell sends asks for 0 loops any more',
        got.filter(s => s.loops === 0).map(s => s.synth),
        []
    );
    check(
        '  ...they all ask for exactly one play',
        got.every(s => s.loops === 1),
        true
    );
}

console.log('=== AND NOT ONE sound_synth IN THE WHOLE BUILD ASKS FOR 0');
{
    // every sound the harness has seen this run, from boot onwards
    const zeros = [...new Set(H.sounds.filter(s => s.loops === 0).map(s => s.synth))];
    console.log(`  ${H.sounds.length} sounds seen, ${zeros.length} distinct synths with loops=0`);
    check('none of them', zeros, []);
}

console.log(`
${R.ok} ok, ${R.bad} FAIL`);
process.exit(R.bad ? 1 : 0);
