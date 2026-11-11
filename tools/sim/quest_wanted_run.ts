// WANTED!, played through on foot - and hand-rolled rather than written as a questrun manifest,
// because the thing it tests is random.
//
// Quest 41 of the quest-by-quest pass. Sir Tiffy hands over a commorb; Solus Dellagar is in one of
// twelve places and the orb will not say which until it is scanned, so the chase cannot be written
// down as a fixed list of steps. Each time he is spoken to he teleports rather than fight, and the
// fifth time he has nothing left to teleport with.
//
//   npx tsx tools/sim/quest_wanted_run.ts
import * as H from './harness.js';
import { drive } from './a1lib.js';
import type { Manifest } from './questrun.js';

/**
 * THE QUEST AS A PLAYER DOES IT, for the helper's step table - and declared rather than driven.
 *
 * The run below is hand-rolled because the chase is random: the orb picks one of twelve places
 * and will not say which until it is scanned, so there is no fixed list of tiles to walk. That is
 * a reason this file cannot be a manifest; it is not a reason the quest should be MISSING from
 * the helper, which is what it was - a player tracking Wanted! saw an empty page.
 *
 * So the steps are written out here and read by the exporter, which takes any declaration typed
 * Manifest. What it does NOT claim is that these steps were walked: everything else in the table
 * comes from a run that proved it, and this is the quest's own shape taken from the wiki and from
 * the run below, which checks the same beats in the same order.
 *
 * The chase is five identical rounds on purpose. The orb says where he is; the player goes there
 * and speaks to him; he teleports out of the first four. Naming one of the twelve Solus npcs is
 * enough for the marker - they are one family, so the plugin highlights whichever of them is
 * actually in front of you.
 */
export const helper: Manifest = {
    quest: 'WANTED!',
    source: 'oldschool.runescape.wiki/w/Wanted!',
    stageVar: 'wanted_main',
    done: 50,
    start: [2998, 3373, 0],
    steps: [
        { note: 'wiki step 1: Sir Tiffy Cashien, on the bench in Falador Park' },
        { talk: 'rd_teleporter_guy', picks: ['Go on.'], why: 'he hands over a commorb' },
        { stage: 10 },

        { note: 'wiki step 2: contact Savant on the orb, and she briefs you' },
        { held: 'wanted_crystal_ball', op: 2, why: 'Contact' },
        { stage: 20 },
        { held: 'wanted_crystal_ball', op: 4, why: 'his file, if you want to read it' },

        // WRITTEN OUT, NOT GENERATED. A spread here would be read as a built manifest and the
        // exporter would RUN this file to see it - and running this file boots a world and plays
        // the whole quest. Four rounds is shorter than that machinery.
        { note: 'wiki steps 3-7: scan, go where it points, speak to him. Four times he teleports out' },
        { held: 'wanted_crystal_ball', op: 1, why: 'Scan - one of twelve places' },
        { talk: 'wanted_solus1', why: 'he is gone before you have finished' },
        { held: 'wanted_crystal_ball', op: 1, why: 'Scan again' },
        { talk: 'wanted_solus1', why: 'and again' },
        { held: 'wanted_crystal_ball', op: 1, why: 'Scan again' },
        { talk: 'wanted_solus1', why: 'and again' },
        { held: 'wanted_crystal_ball', op: 1, why: 'Scan again' },
        { talk: 'wanted_solus1', why: 'the fourth time' },

        { note: 'wiki step 8: the fifth time the teleport does not come' },
        { held: 'wanted_crystal_ball', op: 1, why: 'Scan' },
        { talk: 'wanted_solus1', why: 'and this time he is arrested' },
        { stage: 40 },

        { note: 'wiki step 9: back to Sir Tiffy with the hat' },
        { talk: 'rd_teleporter_guy', why: 'he takes it' },
        { stage: 50 }
    ]
};

await H.boot();

// the twelve places Solus can be, in the order ^wanted_solus_1..12 declares them
const PLACES: [number, number][] = [
    [2566, 3084],
    [2567, 3384],
    [2603, 3421],
    [2691, 3496],
    [2803, 3431],
    [2948, 3146],
    [3007, 3458],
    [2974, 3742],
    [3011, 3236],
    [3100, 3279],
    [3207, 3227],
    [3279, 3496]
];

let pass = 0;
let fail = 0;
function check(what: string, ok: boolean, detail = '') {
    if (ok) pass++;
    else fail++;
    console.log('  ' + (what.length > 60 ? what.slice(0, 59) + '~' : what.padEnd(60)) + (ok ? ' ok' : ' FAIL') + (detail ? '  ' + detail : ''));
}

const p: any = H.makePlayer('wantedrun', 2998, 3373);
H.tick(3);
p.applyDamage = function () {};
H.setVar(p, 'macro_event', 1);
H.maxOut(p);
H.setVarBit(p, 'rd_main', 2); // ^recruitmentdrive_complete - a varbit, and Tiffy will not deal with anyone who has not passed it
H.tick(1);

console.log('');
console.log('WANTED!');
console.log('  the chase is random, so this one is hand-rolled rather than a manifest');
console.log('');

// 1. Sir Tiffy, on his bench in the White Knights' park
const tiffy = H.npcNear('rd_teleporter_guy', 2998, 3373, 0)!;
check('Sir Tiffy is on his bench', !!tiffy, tiffy ? tiffy.x + ',' + tiffy.z : '');
H.opNpc(p, tiffy, 1);
H.tick(3);
drive(p, ['Go on.']);
check('he hands over a commorb', H.invCount(p, 'wanted_crystal_ball') > 0);
check('and the quest starts', H.getVarBit(p, 'wanted_main') === 10, 'wanted_main ' + H.getVarBit(p, 'wanted_main'));

// 2. contact Savant, which is the second option on the orb
const markBrief = H.ifaces.length;
H.opheld(p, 'wanted_crystal_ball', 2);
H.tick(4);
drive(p, []);
const briefing = H.ifaces
    .slice(markBrief)
    .filter(i => i.who === p.username && i.kind === 'text' && i.text)
    .map(i => i.text)
    .join(' ');
check('Savant briefs you over it', briefing.length > 0, briefing.slice(0, 44));
check('and the quest moves on', H.getVarBit(p, 'wanted_main') === 20, 'wanted_main ' + H.getVarBit(p, 'wanted_main'));

// the dossier, which is the fourth option and pure flavour - but it is an op that exists
const markFile = H.ifaces.length;
H.opheld(p, 'wanted_crystal_ball', 4);
H.tick(3);
drive(p, []);
const file = H.ifaces
    .slice(markFile)
    .filter(i => i.who === p.username && i.kind === 'text' && i.text)
    .map(i => i.text)
    .join(' ');
check('the playback has his file on it', file.includes('SOLUS DELLAGAR'), file.slice(0, 40));

// 3. the chase: scan, go, speak, repeat. Five sightings, the last of which is the arrest.
for (let round = 1; round <= 5; round++) {
    p.teleport(2998, 3373, 0);
    H.tick(1);
    H.opheld(p, 'wanted_crystal_ball', 1);
    H.tick(4);
    drive(p, []);
    const where = H.runProc(p, '[proc,wanted_current_location]')[0];
    check('scan ' + round + ': the orb picks a place', where >= 1 && where <= 12, 'place ' + where);
    if (!(where >= 1 && where <= 12)) break;

    const [x, z] = PLACES[where - 1];
    p.teleport(x + 1, z, 0);
    H.tick(2);
    const solus = H.npcNear('wanted_solus' + where, x, z, 0);
    check('  he is where the orb said: ' + x + ',' + z, !!solus, solus ? solus.x + ',' + solus.z : 'nothing there');
    if (!solus) break;
    const markTalk = H.mesgs.length;
    H.opNpc(p, solus, 1);
    H.tick(4);
    drive(p, []);
    const said = H.mesgs
        .slice(markTalk)
        .filter(x2 => x2.who === p.username)
        .map(x2 => x2.text)
        .join(' ');
    if (round < 5) {
        check('  he teleports out rather than answer', said.includes('gone before you have finished'), said.slice(0, 40));
    } else {
        check('  the fifth time the teleport does not come', said.includes('does not come'), said.slice(0, 44));
    }
}

check('Solus is in custody', H.getVarBit(p, 'wanted_main') === 40, 'wanted_main ' + H.getVarBit(p, 'wanted_main'));
check('and his hat is the proof', H.invCount(p, 'wanted_solus_trophy') > 0);

// 4. back to Tiffy with it
p.teleport(2998, 3373, 0);
H.tick(2);
const tiffy2 = H.npcNear('rd_teleporter_guy', 2998, 3373, 0)!;
H.opNpc(p, tiffy2, 1);
H.tick(3);
drive(p, []);
check('Sir Tiffy takes the hat', H.invCount(p, 'wanted_solus_trophy') === 0);
check('and the quest is complete', H.getVarBit(p, 'wanted_main') === 50, 'wanted_main ' + H.getVarBit(p, 'wanted_main'));

console.log('');
console.log('  ' + pass + ' of ' + (pass + fail) + ' checks passed');
process.exit(fail ? 1 : 0);
