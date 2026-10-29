// LOGGING OUT ON A RANDOM EVENT SET, AND LOGGING BACK IN.
//
//   npx tsx tools/sim/macrologout.ts
//
// Reported as "logging out at a random event keeps you there at next login - make it return you to
// your last location". It is the half of [queue,macro_event_login] that was never written: the
// events that come TO you spawn their npc again, and the nine that take you AWAY did nothing, so a
// player who logged out on a set came back standing on it.
//
// WHICH IS A ROOM WITH NO EXIT. These squares are not places you can walk out of - the Quiz
// Master's set is two podiums four tiles apart with blocked ground between them - and %macro_event
// is cleared on the way through the login queue, so the event could neither finish nor start again.
// This checks both halves: that a stranded player is sent home, and that nobody else is moved.
import * as H from './harness.js';
import * as A from './a1lib.js';
import { check, R } from './a1lib.js';
import { CoordGrid } from '#/engine/CoordGrid.js';
import NpcType from '#/cache/config/NpcType.js';
import ParamType from '#/cache/config/ParamType.js';
import EnumType from '#/cache/config/EnumType.js';

await H.boot();
H.loginOrder();

const NO_EVENT = 0; // ^no_macro_event
const HOME: [number, number] = [3222, 3218]; // a quiet spot in Varrock, where the event found them

/**
 * The nine rooms, written out, because this sim has to be able to RUN against code that has none of
 * them - a list read only out of the content's own table would make every behaviour check below
 * unreachable on the code the bug was reported against. The table is checked against this list
 * instead, in the first block, so a landing that moves in the content still shows up here.
 */
const ROOMS: { name: string; level: number; x: number; z: number }[] = [
    { name: 'quiz', level: 1, x: 1952, z: 4764 }, // ^macro_quiz_landing       1_30_74_32_28
    { name: 'mime', level: 1, x: 2010, z: 4761 }, // ^macro_mime_landing       1_31_74_26_25
    { name: 'prisonpete', level: 0, x: 2088, z: 4429 }, // ^macro_prisonpete_landing 0_32_69_40_13
    { name: 'frog', level: 0, x: 2079, z: 4826 }, // ^macro_frog_landing       0_32_75_31_26
    { name: 'evilbob', level: 0, x: 2521, z: 4778 }, // ^macro_evil_bob_landing   0_39_74_25_42
    { name: 'forester', level: 0, x: 2600, z: 4776 }, // ^macro_forester_landing   0_40_74_40_40
    { name: 'drilldemon', level: 0, x: 3165, z: 4816 }, // ^macro_drilldemon_landing 0_49_75_29_16
    { name: 'gravedigger', level: 0, x: 1929, z: 5003 }, // ^macro_digger_landing     0_30_78_9_11  (Pete's chapel too)
    { name: 'lostandfound', level: 0, x: 2338, z: 4747 } // ^macro_laf_landing        0_36_74_34_11
];
const square = (r: { x: number; z: number }) => `${(r.x / 64) | 0}_${(r.z / 64) | 0}`;
/** EnumType stores its values in a Map keyed by the input, so reading one is a Map lookup. */
const enumInt = (name: string, key: number): number | undefined => {
    const id = EnumType.getId(name);
    if (id < 0) return undefined;
    const v = (EnumType.get(id) as any).values.get(key);
    return typeof v === 'number' ? v : undefined;
};

/**
 * Log a player in, standing where `at` says, with the event varps already set - which is the state
 * a logout on a set leaves behind.
 *
 * makePlayer and the first tick are separate on purpose: the varps have to be in place BEFORE
 * World.processLogins runs the login script, because that is the moment the fix has to act on. A
 * player built with a1lib's player() is already logged in by the time it returns.
 */
function login(name: string, at: [number, number, number], event: number, home: [number, number, number] | null) {
    const p: any = H.makePlayer(name, at[0], at[1], 0x7f000001);
    p.teleport(at[0], at[1], at[2]);
    // A brand new Player has every level at 0, and ~p_telejump_safe refuses a player on 0
    // hitpoints (teleport.rs2: a dead player gets their animation cancelled and nothing else). A
    // real login restores saved levels, so they are set here before the login script runs.
    H.maxOut(p);
    H.setVar(p, 'macro_event', event);
    H.setVar(p, 'macro_event_target_coord', home ? CoordGrid.packCoord(home[2], home[0], home[1]) : -1);
    const m = A.mark();
    H.tick(4); // the login script runs here, and queue(macro_event_login, 0, 0) on the tick after
    H.tick(4);
    return { p, said: A.mesSince(p, m) };
}

console.log("THE CONTENT'S OWN TABLE OF ROOMS IS THESE NINE SQUARES");
{
    // macro_event_rooms is what ~macro_event_in_room walks, and it is written as each event's
    // landing constant - so a landing that moves takes its square with it, and this says so.
    const got: string[] = [];
    for (let i = 0; i < 16; i++) {
        const v = enumInt('macro_event_rooms', i);
        if (v === undefined) continue;
        const u = CoordGrid.unpackCoord(v);
        got.push(`${u.level}:${(u.x / 64) | 0}_${(u.z / 64) | 0}`);
    }
    check('  the table holds exactly the nine rooms below', got.sort(), ROOMS.map(r => `${r.level}:${square(r)}`).sort());
    // Every one of them is in the band the game keeps for rooms you can only be put in, which is
    // what makes "standing here" proof that an event put you here, and the pillory's cage in
    // Varrock rightly absent.
    check(
        '  and every one is above z=4400, where no player can walk',
        ROOMS.filter(r => r.z < 4400).map(r => r.name),
        []
    );
    console.log('    ' + ROOMS.map(r => `${r.name}@${r.level}:${square(r)}`).join(' '));
}

console.log('\nA PLAYER WHO LOGGED OUT ON A SET IS SENT BACK WHERE THE EVENT FOUND THEM');
{
    for (const room of ROOMS) {
        const r = login(`ml_${room.name}`, [room.x, room.z, room.level], 12, [HOME[0], HOME[1], 0]);
        check(`  ${room.name.padEnd(13)} -> ${HOME[0]},${HOME[1]}`, [r.p.x, r.p.z, r.p.level], [HOME[0], HOME[1], 0]);
        check('    and the event is let go of', H.getVar(r.p, 'macro_event'), NO_EVENT);
        // null, not zero: a cleared coord varp reads -1, and 0 is the coord 0,0 on level 0
        check('    and the return coord cleared', H.getVar(r.p, 'macro_event_target_coord'), -1);
        check(
            '    and they are told',
            r.said.some(s => s.includes('returned to where you were')),
            true
        );
        H.despawn(r.p);
    }
}

console.log('\nAND IT WORKS WITH NO EVENT RECORDED, which is the other way to get stuck');
{
    // The leave proc clears %macro_event before it teleports. A logout in between leaves a player
    // on the set with nothing to say why, and they are just as stuck.
    const room = ROOMS[0];
    const r = login('ml_noevent', [room.x, room.z, room.level], NO_EVENT, [HOME[0], HOME[1], 0]);
    check('  still sent home', [r.p.x, r.p.z], [HOME[0], HOME[1]]);
    H.despawn(r.p);

    // ...and with no coord saved either, somewhere is better than a room with no exit. Death's own
    // destination, which is ^macro_event_lost_fallback.
    const lost = login('ml_nocoord', [room.x, room.z, room.level], 12, null);
    check('  and with no coord saved, Lumbridge rather than the set', [lost.p.level, (lost.p.x / 64) | 0, (lost.p.z / 64) | 0], [0, 50, 50]);
    H.despawn(lost.p);
}

console.log('\nNOBODY ELSE IS MOVED, which is what the room test is for');
{
    // %macro_event_target_coord outlives some events - the pillory never clears it, because its
    // cage is in Varrock and there is nothing to clear - so a player carrying one must not be
    // teleported on every login for the rest of their life.
    const r = login('ml_pillory', [HOME[0], HOME[1], 0], NO_EVENT, [3000, 3000, 0]);
    check('  a player in the world with a stale return coord stays put', [r.p.x, r.p.z], [HOME[0], HOME[1]]);
    check(
        '    and is told nothing',
        r.said.some(s => s.includes('returned to where you were')),
        false
    );
    H.despawn(r.p);

    // The pillory's own square, named for what it is: 0_50_53 is Varrock, and it is deliberately
    // NOT in macro_event_rooms.
    const cage = login('ml_cage', [3228, 3413, 0], 12, [HOME[0], HOME[1], 0]);
    check('  and a player in the pillory cage in Varrock stays in it', [cage.p.x, cage.p.z], [3228, 3413]);
    H.despawn(cage.p);
}

console.log('\nAND THE EVENTS THAT COME TO YOU STILL DO, which is the half that already worked');
{
    // follow_player_on_logout is the param that tells the two kinds apart. An npc that follows is
    // spawned again beside wherever the player logged back in, and must not be sent anywhere.
    const FOLLOW = ParamType.getId('follow_player_on_logout');
    const follows: number[] = [];
    for (let i = 1; i <= 24; i++) {
        const npcId = enumInt('general_macro_events_members', i);
        if (npcId === undefined || npcId < 0) continue;
        if ((NpcType.get(npcId) as any).params?.get(FOLLOW) === 1) follows.push(i);
    }
    check('  there are events that follow you', follows.length > 0, true);

    const event = follows[0];
    const want = (NpcType.get(enumInt('general_macro_events_members', event)!) as any).debugname;
    const r = login('ml_follow', [HOME[0], HOME[1], 0], event, [3000, 3000, 0]);
    check('  the player is not moved', [r.p.x, r.p.z], [HOME[0], HOME[1]]);
    const near = A.World.npcs.filter(n => n && Math.abs(n.x - HOME[0]) <= 8 && Math.abs(n.z - HOME[1]) <= 8).map(n => NpcType.get(n!.type).debugname);
    check(`  and ${want} turns up beside them again`, near.includes(want), true);
    H.despawn(r.p);
}

console.log('\nTHE SETS REALLY HAVE NO WAY OUT, which is why being left on one is the whole bug');
{
    // Not an assertion about the fix - an assertion about why it was needed. If any of these squares
    // were walkable back to the mainland then logging out on it would be an inconvenience rather
    // than a dead end, and this would be the wrong fix.
    const reachable: string[] = [];
    for (const room of ROOMS) {
        if (A.connected(room.level, room.x, room.z, HOME[0], HOME[1], 400)) reachable.push(room.name);
    }
    check('  no set can be walked out of', reachable, []);
}

console.log(`\n${R.ok} ok, ${R.bad} FAIL`);
process.exit(R.bad ? 1 : 0);
