// The twinflame staff (content skill_combat/scripts/player/elemental_weakness.rs2), autocasting:
//   at a monster weak to another element it casts that element's spell of the same tier
//   (Wind Wave at a moss giant goes off as Fire Wave), if the player can cast it;
//   at a monster with no weakness, or without the staff, the chosen spell;
//   and it casts every 6 ticks, not 5.
import * as H from './harness.ts';
import World from '#/engine/World.js';

await H.boot();
H.loginOrder();
let ok = 0, bad = 0;
const check = (what: string, got: unknown, want: unknown) => {
    const pass = JSON.stringify(got) === JSON.stringify(want);
    pass ? ok++ : bad++;
    console.log(`  ${pass ? 'ok  ' : 'FAIL'} ${what}: ${JSON.stringify(got)}${pass ? '' : `   (want ${JSON.stringify(want)})`}`);
};
const WIND_WAVE = 12, FIRE_WAVE = 15;
let n = 0;

// one autocast at a fresh npc: which wave went off (by its cast sound), and the ticks to the next
function cast(npcName: string, staff: string, magic = 99) {
    const p: any = H.makePlayer('twin' + n, [3090, 3122, 3138, 3154][n], 3300, 80 + n);
    n++;
    H.tick(2);
    H.maxOut(p);
    if (magic < 99) p.setLevel?.(6, magic);
    if (magic < 99) { p.baseLevels[6] = magic; p.levels[6] = magic; }
    H.clearInv(p);
    H.equip(p, { rhand: staff });
    H.give(p, 'airrune', 1000);
    H.give(p, 'deathrune', 1000);
    H.give(p, 'bloodrune', 1000);
    H.give(p, 'waterrune', 1000);
    H.give(p, 'earthrune', 1000);
    H.give(p, 'firerune', 1000);
    H.setVarBit(p, 'autocast_set', 1);
    H.setVarBit(p, 'autocast_spell', WIND_WAVE);
    const npc = H.addNpc(npcName, p.x + 3, p.z);
    H.tick(1);
    const s0 = H.sounds.length;
    H.attackNpc(p, npc);
    let first = -1;
    const casts: number[] = [];
    for (let t = 0; t < 30 && casts.length < 2; t++) {
        H.tick(1);
        // as the other sims' fight helper does: an attack the engine dropped (a wandering npc stepping
        // out of line) is made again, but never while a cast is under way
        if (!p.target && !p.delayed && casts.length === 0 && t % 2 === 1) H.attackNpc(p, npc);
        for (const s of H.sounds.slice(s0)) {
            if (s.who === p.username && s.synth.endsWith('_cast_and_fire') && !casts.includes(s.tick)) casts.push(s.tick);
        }
        if (first < 0 && casts.length) first = casts[0];
    }
    if (process.env.TF_DEBUG) console.log('   dbg', npcName, staff, p.x, p.z, npc.x, npc.z, JSON.stringify(H.mesgs.filter(m => m.who === p.username).slice(-3).map(m => m.text)));
    const kinds = [...new Set(H.sounds.slice(s0).filter(s => s.who === p.username && s.synth.endsWith('_cast_and_fire')).map(s => s.synth))];
    return { kinds, gap: casts.length > 1 ? casts[1] - casts[0] : -1 };
}

console.log('TWINFLAME AUTOCAST');
const a = cast('mossgiant', 'twinflame_staff');
check('Wind Wave autocast at a moss giant (weak to fire) goes off as Fire Wave', a.kinds, ['firewave_cast_and_fire']);
check('  every 6 ticks', a.gap, 6);
const b = cast('cow', 'twinflame_staff');
check('at a cow (no weakness) it stays Wind Wave', b.kinds, ['windwave_cast_and_fire']);
const c = cast('mossgiant', 'staff_of_air');
check('with a plain staff, Wind Wave at a moss giant stays Wind Wave', c.kinds, ['windwave_cast_and_fire']);
check('  every 5 ticks', c.gap, 5);
const d = cast('mossgiant', 'twinflame_staff', 70);
check('below Fire Wave\'s level (75) it casts the Wind Wave you chose', d.kinds, ['windwave_cast_and_fire']);
void FIRE_WAVE; void World;

console.log(`\n${ok} ok, ${bad} FAIL`);
process.exit(bad ? 1 : 0);
