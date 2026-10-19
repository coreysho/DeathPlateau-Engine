// The ectophial: pours with a pour animation, sounds like a liquid, and comes back full.
//   npx tsx tools/sim/ectophial.ts
import * as H from './harness.js';
import { check, R, player } from './a1lib.js';
import SeqType from '#/cache/config/SeqType.js';
import ObjType from '#/cache/config/ObjType.js';

await H.boot();

const seqName = (id: number) => SeqType.get(id)?.debugname ?? String(id);

{
    const p: any = player('phial', 3222, 3218, 0);
    H.give(p, 'ectophial');
    H.tick(1);
    const a0 = H.anims.length,
        s0 = H.sounds.length;
    H.opheld(p, 'ectophial', 1);
    H.tick(10);
    const played = H.anims
        .slice(a0)
        .filter(a => a.who === p.username)
        .map(a => seqName(a.seq));
    const heard = H.sounds
        .slice(s0)
        .filter(s => s.who === p.username)
        .map(s => `${s.synth}(${s.loops})`);
    console.log('  animations:', played);
    console.log('  sounds:', heard);
    check('it plays the pour, not a run-on-the-spot', played, ['ahoy_ectophial_pour']);
    check('  ...with the liquid sound, asking for one play', heard, ['liquid(1)']);
    check('it takes you to the foot of the Ectofuntus', [p.level, p.x, p.z], [0, 3658, 3517]);
    check('and it refills itself', H.invCount(p, 'ectophial'), 1);
    check('  ...leaving no empty behind', H.invCount(p, 'ectophial_empty'), 0);

    console.log('-- the held model it pours');
    // ObjType IS IMPORTED AT THE TOP, not with await import() here, which is what this section
    // used to do and why nothing below it ran. A "#/..." specifier is only ever resolved by tsx's
    // transform of a STATIC import: Node's own "imports" field forbids keys that start with "#/",
    // so the moment the specifier reaches the real resolver it is invalid by the spec. A dynamic
    // import does reach it - and the module graph it pulled in spawned the logger worker, where
    // the same specifier threw ERR_INVALID_MODULE_SPECIFIER out of a nextTick and killed the
    // process. Five checks had passed, three never ran, and the exit code was 1 with no failure
    // printed anywhere.
    const seq: any = SeqType.get(SeqType.getId('ahoy_ectophial_pour'));
    console.log(`  ${seq.frames?.length ?? '?'} frames, replaceheldright=${seq.replaceheldright}, replaceheldleft=${seq.replaceheldleft}`);
    // The packer stores a held-item override as obj id + 512, and 0 as "hide".
    check('the thing in the pouring hand is the ectophial itself', seq.replaceheldright - 512, ObjType.getId('ectophial'));
    check('  ...and the other hand is hidden', seq.replaceheldleft, 0);
    check('  ...over the 38 frames rd_pour_vial has', seq.frames?.length, 38);
}

console.log(`\n${R.ok} ok, ${R.bad} FAIL`);
process.exit(R.bad ? 1 : 0);
