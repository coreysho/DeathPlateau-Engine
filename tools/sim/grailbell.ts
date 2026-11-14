// THE GRAIL BELL PUTS YOU IN THE CASTLE, whatever the maidens happen to be doing.
//
//   npx tsx tools/sim/grailbell.ts
//
// Ringing the bell at the Fisher King's castle is the only way in, and the script that answers it
// (`[opheld1,grail_bell]` in quest_grail.rs2) only teleports the player when `npc_find` turns up a
// Grail maiden near them. The maidens WANDER - with nobody standing there, 120 of 300 sampled ticks
// have no maiden within 4 tiles of the bell and the nearest can be 8 away - so the radius in that
// call decides whether the quest's one entrance works or silently says "Nothing happens."
//
// WHY THE RINGS ARE FAR APART AND IN PLACE. Two things make this bug easy to write a check that
// misses:
//
//   The maidens start near their spawns, which are inside the radius, so a run that rings in its
//   first few hundred ticks always gets in.
//
//   AND TELEPORTING THE PLAYER PUTS THEM BACK. An earlier version of this check teleported onto the
//   bell tile before each ring, which is the obvious way to write it, and passed 30 of 30 against
//   the broken radius: the nearest maiden was 2 or 3 tiles away on every single ring, where leaving
//   the world alone for the same number of ticks gives 5 and 6. So the player is put on the tile
//   once and rings there, and the gap between rings is long enough for the roam to have moved.
//
// The bell is dropped at 2762,4694 by the fisherman (`obj_add(0_43_73_10_22, grail_bell, 1, 500)`),
// which is where a player stands to ring it, and the script teleports to 0_43_73_9_20 = 2761,4692.
import * as H from './harness.js';
import { play, Manifest } from './questrun.js';

await H.boot();

const BELL: [number, number] = [2762, 4694];
const INSIDE: [number, number] = [2761, 4692];
const RINGS = 12;
/** Ticks of roaming before each ring. A maiden's wander step is far slower than a tick. */
const DRIFT = 150;

const p: any = H.makePlayer('grailbell', BELL[0], BELL[1]);
H.tick(2);
p.applyDamage = function () {};
H.maxOut(p);
p.teleport(BELL[0], BELL[1], 0);
H.tick(2);

const ring = (): Manifest =>
    ({
        quest: 'grail bell',
        source: 'tracker issue 8',
        stageVar: 'grail',
        done: 99,
        start: [BELL[0], BELL[1], 0],
        // The ring opens a mesbox and, on success, a maiden's chat; questrun drives both, which a
        // bare opheld cannot - the message box stalls the script until something clicks it.
        steps: [{ held: 'grail_bell', why: 'ring it' }]
    }) as unknown as Manifest;

let inside = 0;
const failures: string[] = [];
for (let i = 0; i < RINGS; i++) {
    // Back to the bell after a ring that worked - and after anything else that moved the player,
    // which is why this is a check and not an assumption.
    if (p.x !== BELL[0] || p.z !== BELL[1] || p.level !== 0) {
        p.teleport(BELL[0], BELL[1], 0);
        H.tick(1);
    }
    H.tick(DRIFT);
    H.give(p, 'grail_bell', 1);
    play(ring(), p);
    if (p.level === 0 && p.x === INSIDE[0] && p.z === INSIDE[1]) inside++;
    else failures.push(`ring ${i}: still at ${p.x},${p.z} L${p.level}`);
}

console.log(`\n  ${inside === RINGS ? 'ok  ' : 'FAIL'} the bell let the player in on ${inside} of ${RINGS} rings`);
for (const f of failures.slice(0, 6)) console.log(`         ${f}`);
if (failures.length > 6) console.log(`         ... and ${failures.length - 6} more`);

console.log(inside === RINGS ? '\nALL PASS' : `\n${failures.length} rings did nothing`);
process.exit(inside === RINGS ? 0 : 1);
