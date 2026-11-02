// THE SPECIAL ATTACK STILL PLAYS WHEN YOU FIRE IT WALKING - seq opcode 13, end to end.
// Usage: npx tsx tools/sim/crossskeleton.ts   (exit code is the verdict)
//
// WHAT THIS IS FOR. The dragon warhammer's Smash looked right standing still and wrong on the
// move, which is a shape of bug no sim in here could see: the script fires the correct animation,
// the server sends the correct animation, and the CLIENT throws it away. Model.method368 only
// walk-merges two frames built on the same skeleton, and an OSRS-imported special is on the OSRS
// player rig (245 transform groups against this build's 117, 21 of which group their vertices
// differently), so it drops one of the two - and it dropped the special, because the rule it was
// given was written for human_eat, where keeping the movement frame is what stops the player
// sliding along the ground with a spoon at their mouth.
//
// crossskeleton moves that choice onto the sequence: 0 keeps the movement frame (the default, and
// still what every gesture wants), 1 keeps the animation itself. So this asserts three things:
//
//   * the eleven player specials that walk-merge carry the flag, NAMED rather than counted, so a
//     twelfth cannot arrive without this failing,
//   * the flag reaches the client's bytes, by decoding data/pack/client/config's own seq.dat
//     rather than trusting the server's copy of the same config, and
//   * nothing else carries it - above all not the gestures the old default exists for.
import * as H from './harness.js';
import { check, R } from './a1lib.js';
import SeqType from '#/cache/config/SeqType.js';
import Jagfile from '#/io/Jagfile.js';

await H.boot();

// Every player special in this build that walk-merges AND runs on the OSRS skeleton. The ones with
// no walkmerge list (osrs_bone_dagger_spec, the 2006 puncture/cleave/shatter set) never reach the
// branch this flag steers - method368 returns the primary frame before it looks at skeletons - so
// they are correct already and are not listed.
const SPECS = [
    'osrs_dwh_spec', // dragon warhammer AND granite hammer
    'osrs_bludgeon_spec', // abyssal bludgeon
    'osrs_dsword_spec', // dragon sword
    'osrs_ags_spec',
    'osrs_bgs_spec',
    'osrs_sgs_spec',
    'osrs_zgs_spec',
    'osrs_sara_sword_spec',
    'osrs_sotd_spec', // staff of the dead / toxic staff of the dead
    'osrs_sol_spec', // staff of light
    'osrs_anchor_spec' // barrelchest anchor - config only, no script fires it yet
];

// The animations the movement-frame default was written for. These must not change. Every name is
// asserted to exist first: a list that silently skips what it cannot find is a list that passes
// because it is spelt wrong, which is how the cape sweep came to report zero on 164 models.
const GESTURES = ['human_eat', 'human_pickuptable', 'human_pickupfloor', 'human_dig', 'human_openchest', 'human_closechest', 'human_fletching', 'human_harpoon', 'human_fishing_casting', 'human_shearing'];

console.log('== the specials carry crossskeleton=primary');
for (const nm of SPECS) {
    const id = SeqType.getId(nm);
    check(`${nm} is in the build`, id !== -1, true);
    if (id === -1) continue;
    const t = SeqType.get(id) as unknown as { crossskeleton: number; walkmerge: Int32Array | null; priority: number };
    check(`  ${nm} keeps its own animation`, t.crossskeleton, 1);
    // The flag only does anything on a sequence that walk-merges: with no list the client plays
    // the primary frame anyway, and the flag would be a comment.
    check(`  ${nm} walk-merges, so the flag has something to steer`, t.walkmerge !== null, true);
    check(`  ${nm} is a special`, t.priority, 6);
}

console.log('\n== and the gestures the old default exists for are untouched');
for (const nm of GESTURES) {
    const id = SeqType.getId(nm);
    check(`  ${nm} is in the build`, id !== -1, true);
    if (id === -1) continue;
    const t = SeqType.get(id) as unknown as { crossskeleton: number };
    check(`  ${nm} still keeps the movement frame`, t.crossskeleton, 0);
}

console.log('\n== nothing else in the build carries it');
{
    const carrying: string[] = [];
    for (let i = 0; i < SeqType.count; i++) {
        const t = SeqType.get(i) as unknown as { debugname?: string; crossskeleton: number } | null;
        if (t && t.crossskeleton === 1) carrying.push(t.debugname ?? `seq_${i}`);
    }
    console.log(`${carrying.length} of ${SeqType.count} sequences keep their own animation across skeletons`);
    check('the set is exactly the eleven specials', carrying.slice().sort(), SPECS.slice().sort());
}

// ---------------------------------------------------------------------------------------------
// THE CLIENT'S OWN BYTES, read by a transcription of the CLIENT'S OWN DECODER. SeqType.load reads
// the same seq.dat the client does, so this is not a second copy of the data - what it is is a
// second implementation of the format, lifted from jagex2/config/SeqType.method215 rather than
// from engine code. If the two disagree about how wide opcode 13's payload is, every sequence
// after the first one carrying it desyncs, and the `dat.pos` assertion below is what says so. That
// is the failure this exists for: the flag reading correctly in the engine proves the engine's
// decoder and the engine's packer agree with each other, which they would even if both were wrong.
console.log("\n== opcode 13 is in the client's seq.dat");
{
    const jag = Jagfile.load('data/pack/client/config');
    const dat = jag.read('seq.dat')!;
    const count = dat.g2();
    const flag = new Map<number, number>();
    for (let id = 0; id < count; id++) {
        for (;;) {
            const code = dat.g1();
            if (code === 0) break;
            if (code === 1) {
                const n = dat.g1();
                for (let i = 0; i < n; i++) {
                    dat.g2();
                    dat.g2();
                    dat.g2();
                }
            } else if (code === 2 || code === 6 || code === 7) {
                dat.g2();
            } else if (code === 3) {
                const n = dat.g1();
                for (let i = 0; i < n; i++) dat.g1();
            } else if (code === 4) {
                // no payload
            } else if (code === 5 || code === 8 || code === 9 || code === 10 || code === 11) {
                dat.g1();
            } else if (code === 12) {
                dat.g4();
            } else if (code === 13) {
                flag.set(id, dat.g1());
            } else {
                throw new Error(`unknown seq code ${code} at id ${id} - this decoder is out of step with the client's`);
            }
        }
    }
    check('seq.dat holds every sequence the server does', count, SeqType.count);
    check('the whole file was read', dat.pos, dat.data.length);
    const named = [...flag.entries()].filter(([, v]) => v === 1).map(([id]) => (SeqType.get(id) as unknown as { debugname?: string })?.debugname ?? `seq_${id}`);
    check('and the eleven ids the client will read it for', named.slice().sort(), SPECS.slice().sort());
}

console.log(`\n${R.ok} ok, ${R.bad} FAIL`);
process.exit(R.bad ? 1 : 0);
