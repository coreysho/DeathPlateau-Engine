// THE EIGHT ANCIENT TELEPORTS, and the one thing about them that was visibly wrong: the seq the
// PLAYER was given.
//
//   npx tsx tools/sim/ancienttele.ts
//
// The cache names the two halves of the effect almost identically. spotanim zaros_teleport (392)
// plays seq zaros_teleport (1988) on its OWN model; the player's half is seq zaros_vertical_casting
// (1979). ~player_teleport_ancient was handing the player 1988 - a set of frames built for the
// spotanim's skeleton - so a human model was posed with another model's bones and tore into
// floating slabs above the tile it stood on. That is what "wrong plane" and "contorts" were.
//
// So the assertions are about identity, not about "an animation played": that a teleport plays
// 1979 and never 1988 is the whole bug, and a check that only asked whether SOME seq played would
// have passed before the fix as happily as after it.
//
// The OTHER half of the same line - the height the spotanim is drawn at, which left the column
// hanging off the floor - is a rule about models rather than about ancients, and lives in
// tools/sim/spotground.ts.
import * as H from './harness.js';
import Player from '#/engine/entity/Player.js';
import SeqType from '#/cache/config/SeqType.js';
import SpotanimType from '#/cache/config/SpotanimType.js';
import DbRowType from '#/cache/config/DbRowType.js';
import { CoordGrid } from '#/engine/CoordGrid.js';

await H.boot();
H.loginOrder();

const R = { ok: 0, bad: 0 };
const check = (what: string, got: unknown, want: unknown) => {
    const pass = JSON.stringify(got) === JSON.stringify(want);
    if (pass) R.ok++;
    else R.bad++;
    console.log(`  ${pass ? 'ok  ' : 'FAIL'} ${what}: ${JSON.stringify(got)}${pass ? '' : `   (want ${JSON.stringify(want)})`}`);
};

const CASTING = SeqType.getId('zaros_vertical_casting');
const SPOT_SEQ = SeqType.getId('zaros_teleport');
const SPOT = SpotanimType.getId('zaros_teleport');

console.log('\n================ ANCIENT TELEPORTS');
console.log(`  seq zaros_vertical_casting = ${CASTING}, seq zaros_teleport = ${SPOT_SEQ}, spotanim zaros_teleport = ${SPOT}`);

// THE TWO SEQS ARE NOT THE SAME SEQ. If a cache import ever merged them this file's point goes
// with them, so say so here rather than discover it in a confusing failure below.
check('the player seq and the spotanim seq are different ids', CASTING !== SPOT_SEQ, true);
check('the spotanim is driven by the seq of the same name', SpotanimType.get(SPOT).anim, SPOT_SEQ);

// Which seqs does a spotanim drive? Those frames are built for spotanim models and must never be
// handed to a player - that is the class of bug, not just this one spell.
const spotSeqs = new Set<number>();
for (let id = 0; id < SpotanimType.count; id++) {
    const seq = SpotanimType.get(id)?.anim ?? -1;
    if (seq !== -1) spotSeqs.add(seq);
}
check('zaros_teleport is one of the spotanim-driven seqs', spotSeqs.has(SPOT_SEQ), true);
check('zaros_vertical_casting is not', spotSeqs.has(CASTING), false);

// The eight teleports, out of the same dbrows the spell code reads.
const SPELLS = ['paddewwa', 'senntisten', 'kharyrll', 'lassar', 'dareeyak', 'carrallanger', 'annakarl', 'ghorrock'];

let bucket = 1;
function caster(name: string): Player {
    const p = H.makePlayer(name, 3222, 3218, bucket++);
    H.tick(2);
    H.maxOut(p);
    H.setVar(p, 'spellbook', 1); // ^spellbook_ancient
    for (const rune of ['airrune', 'firerune', 'waterrune', 'earthrune', 'lawrune', 'bloodrune', 'deathrune', 'soulrune', 'chaosrune']) {
        H.give(p, rune, 1000);
    }
    H.tick(2);
    return p;
}

for (const spell of SPELLS) {
    const row = DbRowType.getId(`magic_spell_teleport_${spell}`);
    const p = caster(`anc_${spell}`);
    const from = CoordGrid.formatString(p.level, p.x, p.z);

    H.clearLogs();
    H.ifButton(p, `ancient_magic:${spell}_teleport`);
    H.tick(10);

    const played = H.anims.filter(a => a.who === p.username).map(a => a.seq);
    const moved = CoordGrid.formatString(p.level, p.x, p.z) !== from;

    console.log(`\n  ${spell} (dbrow ${row})`);
    check('    plays the ancient casting seq', played.includes(CASTING), true);
    check("    and never the spotanim's own seq", played.includes(SPOT_SEQ), false);
    check('    the player actually went somewhere', moved, true);

    H.despawn(p);
}

// AND THE NORMAL BOOK IS UNTOUCHED - the fix is keyed off the spell id range, so a regression that
// caught every teleport would show here.
{
    const p = H.makePlayer('anc_normal', 3222, 3218, bucket++);
    H.tick(2);
    H.maxOut(p);
    H.setVar(p, 'spellbook', 0);
    for (const rune of ['airrune', 'firerune', 'waterrune', 'earthrune', 'lawrune']) {
        H.give(p, rune, 1000);
    }
    H.tick(2);
    H.clearLogs();
    H.ifButton(p, 'magic:varrock_teleport');
    H.tick(10);
    const played = H.anims.filter(a => a.who === p.username).map(a => a.seq);
    console.log('\n  the normal book still casts its own teleport');
    check('    human_castteleport', played.includes(SeqType.getId('human_castteleport')), true);
    check('    not the ancient one', played.includes(CASTING), false);
    H.despawn(p);
}

console.log(`\n${R.ok} ok, ${R.bad} FAIL`);
process.exit(R.bad ? 1 : 0);
