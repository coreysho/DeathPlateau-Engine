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
import World from '#/engine/World.js';
import NpcType from '#/cache/config/NpcType.js';

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
        // TWO PICKS, because Tiffy now opens with a menu: this quest is one option on it and his
        // armoury is another (temple_knight/scripts/temple_knight.rs2). Before that, whichever of
        // the two had something to say claimed the whole conversation, and the quest always won -
        // so an initiate could not buy armour for as long as this quest was open.
        // THE ORB IS SOLD, NOT GIVEN: ten thousand coins, or a law rune, an enchanted gem and
        // molten glass. That is a real item requirement, so it is declared as one here.
        { give: 'coins', n: 10000, how: 'Sir Tiffy charges for the commorb' },
        // The options in full rather than as substrings: these are EXPORTED to the quest helper,
        // and a player told to pick "jobs" is being shown the sim's matcher, not their own menu.
        { talk: 'rd_teleporter_guy', picks: ['Do you have any jobs for me yet?', 'Go on.', "I'll pay the 10000 coins."], why: 'he sells you a commorb' },
        { stage: 10 },

        { note: 'wiki step 2: contact Savant on the orb, and she briefs you' },
        { held: 'wanted_crystal_ball', op: 2, why: 'Contact' },
        // HE BRIEFS YOU STRAIGHT INTO THE HUNT. Stage 20 is no longer a value anyone can be found at
        // (quest_wanted.rs2, the note above the write), so the leg starts at 30.
        { stage: 30 },
        { held: 'wanted_crystal_ball', op: 4, why: 'his file, if you want to read it' },

        // WRITTEN OUT, NOT GENERATED. A spread here would be read as a built manifest and the
        // exporter would RUN this file to see it - and running this file boots a world and plays
        // the whole quest.
        { note: 'wiki steps 3-9: seven stops. Scan, go where it points, speak to him; he teleports out of the first six' },
        { held: 'wanted_crystal_ball', op: 1, why: 'Scan - it says where he was seen' },
        { talk: 'wanted_solus1', why: 'he is gone before you have finished' },
        { held: 'wanted_crystal_ball', op: 1, why: 'Scan again' },
        { talk: 'wanted_solus1', why: 'and again' },
        { held: 'wanted_crystal_ball', op: 1, why: 'Scan again' },
        { talk: 'wanted_solus1', why: 'and again' },
        { held: 'wanted_crystal_ball', op: 1, why: 'Scan again' },
        { talk: 'wanted_solus1', why: 'the fourth time' },
        { held: 'wanted_crystal_ball', op: 1, why: 'Scan again' },
        { talk: 'wanted_solus1', why: 'the fifth' },
        { held: 'wanted_crystal_ball', op: 1, why: 'Scan again' },
        { talk: 'wanted_solus1', why: 'and the sixth, where a Black Knight is sent after you' },

        { note: 'wiki step 10: the seventh stop is a fight, and he loses it' },
        { held: 'wanted_crystal_ball', op: 1, why: 'Scan' },
        { talk: 'wanted_solus1', why: 'and this time he stays to fight' },
        { fight: 'wanted_solus_attackable', why: 'and takes his hat' },
        { stage: 40 },

        { note: 'wiki step 11: report to Sir Amik Varze in Falador castle, with the hat' },
        // SIR AMIK VARZE, NOT SIR TIFFY: the hat is handed in at wanted_amik.rs2, and this step used
        // to send the player back to the bench in the park, where nobody would take it.
        { talk: 'sir_amik_varze', picks: ['Solus Dellagar'], why: 'he takes it' },
        { stage: 50 }
    ]
};

await H.boot();

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
// AND THE REQUIREMENTS THE QUEST ITSELF NOW ENFORCES: 32 quest points, The Lost Tribe, Priest
// in Peril and Enter the Abyss. A maxed sim player has NO quest points, so without these Tiffy
// refuses at the first line and the run dies before it starts. The values are the ones
// tools/sim/wantedstart.ts drives the gate against.
H.setVar(p, 'qp', 32);
H.setVarBit(p, 'lost_tribe_quest', 11);
H.setVar(p, 'priestperil', 60);
H.setVar(p, 'abyssal_miniquest', 4);
H.give(p, 'coins', 10000); // and the orb's price - see the manifest step above
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
drive(p, ['jobs', 'Go on.', "I'll pay"]); // his menu, the quest's own, then the orb's price
check('he hands over a commorb', H.invCount(p, 'wanted_crystal_ball') > 0);
check('and the quest starts', H.getVarBit(p, 'wanted_main') === 10, 'wanted_main ' + H.getVarBit(p, 'wanted_main'));

// 2. contact Savant, which is the second option on the orb. HE BRIEFS YOU STRAIGHT INTO THE HUNT:
// there is no "briefed" stop to be found at any more (quest_wanted.rs2, the note above the write).
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
check('and the hunt begins: stage 30', H.getVarBit(p, 'wanted_main') === 30, 'wanted_main ' + H.getVarBit(p, 'wanted_main'));

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

// 3. the chase: seven stops, each at the place the hunt has lit. Old School's order is fixed for
// 1, 3, 5 and 7 and drawn from the pool for 2, 4 and 6 (tools/sim/wantedosrs.ts proves that part);
// what is walked here is the whole of it, in order, ending in the fight.
const lit = (): number => {
    for (let i = 1; i <= 18; i++) if (H.getVarBit(p, 'wanted_mission' + i) === 1) return i;
    return 0;
};
for (let stop = 1; stop <= 7; stop++) {
    const where = lit();
    check('stop ' + stop + ': the hunt has lit a place', where >= 1 && where <= 18, 'place ' + where);
    if (!where) break;
    const solus = World.npcs.find((n: any) => n && n.isActive && n.type === NpcType.getId('wanted_solus' + where));
    check('  he is standing there', !!solus, solus ? solus.x + ',' + solus.z : 'nothing there');
    if (!solus) break;
    if (!H.standBeside(p, solus)) p.teleport(solus.x + 1, solus.z, solus.level);
    H.tick(2);
    H.clearLogs();
    H.opNpc(p, solus, 1);
    for (let t = 0; t < 40 && !p.activeScript; t++) H.tick(1);
    drive(p, []);
    H.tick(12);
    if (stop < 7) {
        check('  the sighting counts, and he is gone', H.getVarBit(p, 'wanted_mission' + where + 'complete') === 1);
        p.levels[3] = p.baseLevels[3]; // the set pieces cost health; stop 4's is most of it
    }
}

// the seventh stop leaves him standing to be fought, and the kill is what pays the hat
const fighter: any = World.npcs.find((n: any) => n && n.isActive && n.type === NpcType.getId('wanted_solus_attackable'));
check('the seventh stop leaves him standing to be fought', !!fighter);
if (fighter) {
    H.attackNpc(p, fighter);
    for (let t = 0; t < 600 && fighter.isActive; t++) H.tick(1);
    H.tick(6);
    drive(p, []);
    H.tick(4);
}
check('Solus is in custody', H.getVarBit(p, 'wanted_main') === 40, 'wanted_main ' + H.getVarBit(p, 'wanted_main'));
check('and his hat is the proof', H.invCount(p, 'wanted_solus_trophy') > 0);

// 4. the hat goes to Sir Amik Varze, not to Tiffy
const amik: any = World.npcs.find((n: any) => n && n.isActive && n.type === NpcType.getId('sir_amik_varze'));
check('Sir Amik Varze is in Falador castle', !!amik, amik ? amik.x + ',' + amik.z : '');
if (amik) H.standBeside(p, amik);
H.tick(2);
H.opNpc(p, amik, 1);
H.tick(3);
drive(p, ['Solus Dellagar']); // he offers the topic rather than being taken over by it
check('Sir Amik takes the hat', H.invCount(p, 'wanted_solus_trophy') === 0);
check('and the quest is complete', H.getVarBit(p, 'wanted_main') === 50, 'wanted_main ' + H.getVarBit(p, 'wanted_main'));

console.log('');
console.log('  ' + pass + ' of ' + (pass + fail) + ' checks passed');
process.exit(fail ? 1 : 0);
