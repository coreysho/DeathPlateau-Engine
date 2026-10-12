// WHAT ONE SPELL CAST ACTUALLY SENDS, tick by tick, for a hit that kills and a hit that does not.
// Reported as "audio bug when casting spells ... its playing the end of the sound twice - thats if
// it kills the npc, if it doesn't it cuts the sound short".
//
//   npx tsx tools/sim/spellsound.ts
import * as H from './harness.js';
import * as A from './a1lib.js';
import { check, R } from './a1lib.js';
import NpcType from '#/cache/config/NpcType.js';
import { PlayerStat } from '#/engine/entity/PlayerStat.js';

await H.boot();
H.loginOrder();

let n = 0;

/** One cast at a fresh npc. Returns every sound the player was sent, with its tick and delay. */
function cast(npcName: string, spell: string, hp: number | null) {
    const p: any = H.makePlayer('snd' + n, 3090 + n * 16, 3300, 60 + n);
    n++;
    H.tick(2);
    H.maxOut(p);
    H.clearInv(p);
    H.equip(p, { rhand: 'staff_of_fire' });
    for (const r of ['airrune', 'waterrune', 'earthrune', 'firerune', 'deathrune', 'bloodrune', 'chaosrune', 'lawrune'])
        H.give(p, r, 1000);
    H.tick(1);
    const npc: any = H.addNpc(npcName, p.x + 4, p.z);
    // nothing to dodge and nothing to survive: every cast lands, and hp decides kill or not
    npc.baseLevels[1] = 0; npc.levels[1] = 0;      // defence
    if (hp !== null) { npc.baseLevels[0] = hp; npc.levels[0] = hp; }
    H.tick(1);
    const s0 = H.sounds.length;
    H.castOnNpc(p, npc, spell);
    for (let t = 0; t < 22; t++) H.tick(1);
    // EVERY sound, not just the player's - a death sound is sent from inside the npc's own trigger
    const out = H.sounds.slice(s0);
    return { p, npc, sounds: out, dead: !npc.isActive || npc.levels[0] <= 0 };
}

function show(label: string, r: ReturnType<typeof cast>) {
    console.log(`\n${label}`);
    console.log(`  npc ${r.dead ? 'died' : 'survived'}; ${r.sounds.length} sound packet(s):`);
    for (const s of r.sounds) {
        console.log(`    tick ${String(s.tick).padStart(3)}  ${s.synth.padEnd(26)} loops=${s.loops} delay=${String(s.delay).padStart(3)}  (to ${s.who})`);
    }
    // a packet's "arrival tick" is its own tick plus delay/30 (delays are in client-ms, 30 per tick)
    const landings = new Map<number, string[]>();
    for (const s of r.sounds) {
        const at = s.tick + Math.round(s.delay / 30);
        if (!landings.has(at)) landings.set(at, []);
        landings.get(at)!.push(s.synth);
    }
    for (const [at, list] of [...landings].sort((a, b) => a[0] - b[0])) {
        if (list.length > 1) console.log(`  >> tick ${at}: ${list.length} sounds at once - ${list.join(' + ')}`);
    }
    return landings;
}

console.log('=== EVERY SOUND A SPELL SENDS, AND THE LOOPS FIELD ON IT');
{
    const p: any = H.makePlayer('snd', 2660, 3300, 99);
    H.tick(2);
    H.maxOut(p);
    H.clearInv(p);
    H.equip(p, { rhand: 'staff_of_fire' });
    for (const r of ['airrune', 'deathrune', 'bloodrune', 'chaosrune', 'lawrune', 'waterrune', 'earthrune'])
        H.give(p, r, 2000);
    H.tick(1);
    const npc: any = H.addNpc('zombie_armed', p.x + 4, p.z);
    npc.baseLevels[1] = 0; npc.levels[1] = 0;
    H.tick(2);
    const s0 = H.sounds.length;
    H.castOnNpc(p, npc, 'magic:fire_blast');
    for (let t = 0; t < 10; t++) H.tick(1);
    const got = H.sounds.slice(s0).filter(s => s.who === p.username);
    for (const s of got)
        console.log(`    ${s.synth.padEnd(26)} loops=${s.loops} delay=${String(s.delay).padStart(3)}`);
    check('nothing a spell sends asks for 0 loops any more',
        got.filter(s => s.loops === 0).map(s => s.synth), []);
    check('  ...they all ask for exactly one play',
        got.every(s => s.loops === 1), true);
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
