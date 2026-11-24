/**
 * THE HUNT CANNOT SEND YOU SOMEWHERE YOU HAVE ALREADY BEEN.
 *
 * On 2026-11-24 a player reported Wanted! stuck at "4 out of 7 jumps": every time he spoke to the
 * npc at the cave-goblin stop the quest sent him straight back to the same place. His save said
 * why - places done {2,3,5,14} with place 3 ALSO still lit, so one of his four sightings was the
 * place he was standing in.
 *
 * ~wanted_depart(3) then marks 3 done, which it already is, so ~wanted_sightings does not move;
 * the next place is asked for with the same stop number as last time, 5; and stop 5 is hard-wired
 * to place 3. Round and round, with nothing in the game saying so.
 *
 * This file holds the escape: a stop whose fixed place is already behind the player falls through
 * to the pool. It is written from his exact bits, because a made-up stuck state would not have
 * caught it - the arithmetic only closes on a fixed stop, and only when THAT place is the done one.
 */
import fs from 'fs';
import * as H from './harness.js';
import * as A from './a1lib.js';
import { check, R, player } from './a1lib.js';
import NpcType from '#/cache/config/NpcType.js';
import World from '#/engine/World.js';

await H.boot();

const doneOf = (p: any) => {
    const o: number[] = [];
    for (let i = 1; i <= 18; i++) if (H.getVarBit(p, `wanted_mission${i}complete`) === 1) o.push(i);
    return o;
};
const litOf = (p: any) => {
    const o: number[] = [];
    for (let i = 1; i <= 18; i++) if (H.getVarBit(p, `wanted_mission${i}`) === 1) o.push(i);
    return o;
};

/** Stand next to the shell for the lit place and talk it through. */
function talkHere(p: any): void {
    const lit = litOf(p)[0];
    if (lit === undefined) return;
    const id = NpcType.getId('wanted_solus' + lit);
    const npc = World.npcs.find((n: any) => n && n.isActive && n.type === id);
    if (!npc) return;
    p.teleport(npc.x + 1, npc.z, npc.level);
    H.tick(2);
    H.opNpc(p, npc, 1);
    for (let t = 0; t < 40 && !p.activeScript; t++) H.tick(1);
    A.drive(p);
    H.tick(14);
}

console.log('THE REPORTED STATE: four sightings, one of them the place he is standing in');
{
    const p = player('stuck_iron', 3313, 9629, 0);
    H.setVarBit(p, 'wanted_main', 30);
    H.setVarBit(p, 'wanted_contacted_savant', 1);
    for (const n of [2, 3, 5, 14]) H.setVarBit(p, `wanted_mission${n}complete`, 1);
    H.setVarBit(p, 'wanted_mission3', 1);
    H.tick(2);
    check('  he starts on four sightings', doneOf(p).length, 4);
    check('  with the cave-goblin place lit and also already done', [litOf(p).join(','), doneOf(p).includes(3)], ['3', true]);

    talkHere(p);
    // THE WHOLE POINT. Before the guard this stayed at 3 for ever, which is what "stays at 4 out of
    // 7 jumps" looked like from the player's chair.
    check('  talking moves him off that place', litOf(p).includes(3), false);
    check('  and onto one he has not been to', doneOf(p).includes(litOf(p)[0]), false);

    // AND IT NEVER GOES BACK, which is the property rather than "three more stops" - the hunt ends
    // at stop 7, so demanding a fixed number of further moves overruns the quest and fails on its
    // own success. What must hold is that no place it lights is one already behind the player.
    let revisits = 0;
    for (let i = 0; i < 3; i++) {
        const before = litOf(p)[0];
        if (before === undefined) break; // cornered: the hunt is over, which is a pass
        talkHere(p);
        const after = litOf(p)[0];
        if (after !== undefined && (after === before || doneOf(p).includes(after))) revisits++;
    }
    check('  and it never lights a place that is already behind him', revisits, 0);
}

console.log('\nAND A CLEAN RUN IS UNCHANGED, which is the half a guard usually breaks');
{
    // Stop 5 is Old School's cave-goblin stop and it has to STAY that, for a player whose four
    // sightings are four other places. The guard only fires when the fixed place is already done.
    // THREE banked, not four: ~wanted_depart asks for the next place with sightings+1 AFTER
    // marking this one, so the cave-goblin place - stop 5 - is handed out as the FOURTH sighting
    // lands. Starting on four asks for stop 6, which is a pool draw, and the first version of this
    // check failed on exactly that and told me the guard had broken something it had not.
    const p = player('stuck_clean', 3313, 9629, 0);
    H.setVarBit(p, 'wanted_main', 30);
    H.setVarBit(p, 'wanted_contacted_savant', 1);
    for (const n of [1, 2, 5]) H.setVarBit(p, `wanted_mission${n}complete`, 1);
    H.setVarBit(p, 'wanted_mission14', 1);
    H.tick(2);
    check('  three sightings, none of them the cave-goblin place', [doneOf(p).length, doneOf(p).includes(3)], [3, false]);
    talkHere(p);
    check('  banking the fourth still sends him to the cave-goblin place', litOf(p)[0], 3);
}

console.log('\nAND THE KNIGHT ARRIVES AFTER THE BOX, not during it');
{
    // THE BUG THIS CATCHES. wanted_piece_knight used to npc_add the Black Knight BEFORE its
    // mesbox. A mesbox waits for a click; the knight is aggressive and turns up while the player
    // is still reading; and a player being hit fights rather than clicks. So the script parked on
    // the box for ever and @wanted_depart - the line that records the sighting - never ran.
    // Talking again started a fresh script and summoned ANOTHER knight.
    //
    // Reported 2026-11-24 as "kills the knight, talks to solus, and it respawns the knight".
    // Every sim passed it, because drive() clicks in the same tick the box opens and the knight
    // never got the chance to interrupt. So this one deliberately does NOT drive straight away.
    const p = player('knight_order', 3305, 3209, 0);
    H.setVarBit(p, 'wanted_main', 30);
    H.setVarBit(p, 'wanted_contacted_savant', 1);
    for (const n of [1, 2, 3, 5, 14]) H.setVarBit(p, `wanted_mission${n}complete`, 1);
    H.setVarBit(p, 'wanted_mission13', 1);
    H.tick(2);
    check('  five sightings, standing at the Al Kharid stop', [doneOf(p).length, litOf(p).join(',')], [5, '13']);

    const knightId = NpcType.getId('wanted_summoned_black_knight');
    const knightsNear = () => {
        let n = 0;
        for (const npc of World.npcs) if (npc && npc.isActive && npc.type === knightId && Math.max(Math.abs(npc.x - p.x), Math.abs(npc.z - p.z)) <= 12) n++;
        return n;
    };

    // THE ORDER IS READ FROM THE SOURCE, because the harness cannot see it. A script parks on its
    // FIRST message, so by the time p.activeScript is set neither the npc_add nor the box has run
    // in either ordering - a check that waits for the park and then counts knights passes whatever
    // the file says. I wrote that check first and the mutation walked straight through it.
    //
    // Reading the proc is the same move bugtracker-check.ts makes for the ticket bot's buttons:
    // when the thing that matters is not observable from here, assert it where it is written and
    // say so, rather than assert something nearby that happens to be true.
    {
        const src = fs.readFileSync('../content/scripts/quests/quest_wanted/scripts/quest_wanted.rs2', 'utf8');
        const proc = /\[proc,wanted_piece_knight\]([\s\S]*?)\n\[/.exec(src)?.[1] ?? '';
        check('  the knight proc was found to read', proc.length > 0, true);
        const addAt = proc.indexOf('npc_add(');
        const boxAt = proc.indexOf('~mesbox(');
        check('  it summons the knight and shows a box', addAt >= 0 && boxAt >= 0, true);
        // The box has to come FIRST. A mesbox waits for a click, and a knight that arrives before
        // the click is a knight the player fights instead of clicking - which leaves the sighting
        // unrecorded for ever.
        check('  and the box is read before the knight arrives', boxAt < addAt, true);

        // AND THE SAME FOR THE LAST FIGHT, which had the identical shape. wanted_final npc_adds
        // Solus - aggressive, since the stats landed - and then opens a box. He arrives while the
        // player is still reading it, hits them, and their swing back is dropped: the engine drops
        // a queued op on a busy player without a word. The night's log has it on the knight, which
        // is the same bug one stop earlier:
        //
        //   corey op4 on npc wanted_summoned_black_knight - no longer valid
        //
        // The quest's bookkeeping is safe either way - wanted_final writes it before any of this -
        // so this is about the fight opening fairly, not about getting stuck.
        const fin = /\[label,wanted_final\]([\s\S]*?)\n\[/.exec(src)?.[1] ?? '';
        check('  the finale was found to read', fin.length > 0, true);
        const finAdd = fin.indexOf('npc_add(');
        const finBox = fin.lastIndexOf('~mesbox(');
        check('  it spawns Solus and shows a box', finAdd >= 0 && finBox >= 0, true);
        check('  and the box is read before Solus arrives', finBox < finAdd, true);
        // The sighting is recorded BEFORE either, which is what keeps this from ever stranding a
        // player the way the knight did.
        check('  with the sighting recorded before both', fin.indexOf('~wanted_mark_done(') < finBox, true);
    }

    const id = NpcType.getId('wanted_solus13');
    let solus: any = null;
    for (const n of World.npcs) if (n && n.isActive && n.type === id) solus = n;
    p.teleport(solus.x + 1, solus.z, solus.level);
    H.tick(2);
    H.opNpc(p, solus, 1);
    for (let t = 0; t < 40 && !p.activeScript; t++) H.tick(1);
    A.drive(p);
    H.tick(14);
    check('  once it is dismissed the knight is there', knightsNear() > 0, true);
    check('  and the sighting was recorded', doneOf(p).includes(13), true);
    check('  and the hunt moved on', litOf(p).includes(13), false);
}

console.log(R.bad ? `FAILED: ${R.bad} of ${R.ok + R.bad}` : `${R.ok} ok`);
process.exit(R.bad ? 1 : 0);
