// THE THREE PEOPLE STANDING IN THE SWAN SONG COLONY, and which of them has anything to say.
// Usage: NODE_MEMBERS=true npx tsx tools/sim/swancolonists.ts   (exit code is the verdict)
//
// Devin Mendelberg's two lines have been written since the colony was and NOBODY could reach them.
// The content hung them on `swan_boat_colonist`, the multinpc shell whose face is always
// `swan_colonist_1` - and that shell is placed in no map square at all. The colonist a player meets
// is a plain `swan_colonist_1` in m36_57, and the engine dispatches a click on the type of the npc
// standing there: `No trigger for [opnpc1,swan_colonist_1]`, then "Devin Mendelberg is not
// interested in talking."
//
// THE COMMENT IN THE CONTENT HAD IT ONE ID OUT, which is why it stood for so long: it said the one
// swan_boat_colonist stood in the Gnome Stronghold, eight squares from the colony. The spawn there
// is npc 3829, swan_boat_boatwoman - 3828 is placed nowhere. So the handler was not in the wrong
// place, it was in no place.
//
// WHY IT TOOK A BOT TO FIND IT. tools/sim/opsweep.ts reads the whole cache for dead options in
// forty seconds and had this row excused, because the shell lists swan_colonist_1 in multinpc and
// claims the option - family-wide, with no regard for which of the two the map places, and here it
// places only the colonist. A fuzzing bot walked up to him and reported it instead. opsweep's rule
// is narrower now (a type the map places must claim its own option), which is what stops this
// happening again in general; this file is the specific half, because a ratchet says a row exists
// and not what a player hears.
//
// WHAT IS DELIBERATELY STILL BROKEN HERE: George Laxmeister and Ramara du Croissant, who stand
// beside him with the same Talk-to and nothing written for either. They are two rows of
// opsweep-baseline.txt and belong to DeathPlateau-Bugs#27, not to this fix - so the checks below
// assert that they still get the fallback. If somebody writes their dialogue this file fails and
// should be updated, which is the right way round: nobody should be able to delete Devin's handler
// and have it read as "the colonists were never written".
import * as H from './harness.js';
import { check, R, player, drive, mark, mesSince } from './a1lib.js';
import NpcType from '#/cache/config/NpcType.js';
import Npc from '#/engine/entity/Npc.js';
import ScriptProvider from '#/engine/script/ScriptProvider.js';
import ServerTriggerType from '#/engine/script/ServerTriggerType.js';
import World from '#/engine/World.js';

await H.boot();

const FALLBACK = 'is not interested in talking.';
const BEFORE = 'I came out here for the fishing';
const AFTER = 'The fishing is good again';

/**
 * The one npc of this type, checked to be standing near where this sim says it does.
 *
 * NOT AN EXACT TILE, because all three colonists carry a wanderrange and the first version of this
 * threw at the second run: Devin was on 2312,3684 when the spawn was read off the map and on
 * 2312,3681 three ticks later. The tile is a landmark, so the check is "within a few tiles of it",
 * which still fails loudly if the spawn is moved or removed.
 */
function at(name: string, x: number, z: number, level = 0, radius = 8): Npc {
    const type = NpcType.getId(name);
    const all: Npc[] = [];
    for (const npc of World.npcs) {
        if (npc && npc.isActive && npc.type === type) {
            all.push(npc);
        }
    }
    if (all.length !== 1) {
        throw new Error(`the map places ${all.length} ${name}, not 1 - this sim is about the single spawn`);
    }
    const npc = all[0];
    if (npc.level !== level || Math.abs(npc.x - x) > radius || Math.abs(npc.z - z) > radius) {
        throw new Error(`${name} is at ${npc.x},${npc.z},${npc.level}, not within ${radius} of ${x},${z},${level} - the spawn this sim is about has moved`);
    }
    return npc;
}

/** Click Talk-to from a tile beside them; hand back the chat pages and the game messages. */
function talk(who: string, npc: Npc, stage?: number): { pages: string[]; mesgs: string[] } {
    const p = player(who, npc.x + 1, npc.z, npc.level);
    if (!H.standBeside(p, npc)) {
        throw new Error(`nowhere to stand beside ${NpcType.get(npc.type).debugname} at ${npc.x},${npc.z}`);
    }
    if (stage !== undefined) {
        // `swansong` is a VARBIT, not a varp - H.setVar throws on it.
        H.setVarBit(p, 'swansong', stage);
    }
    const from = mark();
    // THE IFACE MARK IS TAKEN BEFORE THE CLICK, not inside drive(). drive() marks where it starts,
    // and the first chat page is already written by then - the first version of this read an empty
    // list and reported that Devin still had nothing to say, with the fix in place.
    const firstPage = H.ifaces.length;
    H.opNpc(p, npc, 1);
    drive(p);
    const pages = H.ifaces
        .slice(firstPage)
        .filter(i => i.who === p.username && i.kind === 'text' && i.text && i.text.length > 1)
        .map(i => i.text!);
    return { pages, mesgs: mesSince(p, from) };
}

console.log('THE TRIGGER THE CLICK ACTUALLY LOOKS FOR');
{
    // Named rather than swept, because this is the regression: the engine reads the trigger off the
    // type of the npc standing there, so the colony spawn needs one of its own however many
    // kinsmen claim the option.
    const colonist = NpcType.getId('swan_colonist_1');
    const shell = NpcType.getId('swan_boat_colonist');
    check('  swan_colonist_1 has an opnpc1 of its own', !!ScriptProvider.getByTriggerSpecific(ServerTriggerType.OPNPC1, colonist, NpcType.get(colonist).category), true);
    check('  and the shell still has its own', !!ScriptProvider.getByTriggerSpecific(ServerTriggerType.OPNPC1, shell, NpcType.get(shell).category), true);
    check('  the shell is still only a face for swan_colonist_1', [...new Set((NpcType.get(shell).multinpc ?? []).filter(i => i >= 0))], [colonist]);
}

console.log('\nDEVIN MENDELBERG, IN THE COLONY, DURING THE SIEGE');
{
    const devin = at('swan_colonist_1', 2312, 3684);
    check('  he is the one the colony places', NpcType.get(devin.type).name, 'Devin Mendelberg');
    const { pages, mesgs } = talk('swandevin_a', devin, 0);
    check(
        '  he talks about the sea trolls',
        pages.some(l => l.includes(BEFORE)),
        true
    );
    check(
        '  and is not told to be uninterested',
        mesgs.some(m => m.includes(FALLBACK)),
        false
    );
    check(
        '  nor does the engine report a missing trigger',
        mesgs.some(m => m.startsWith('No trigger for')),
        false
    );
}

console.log('\nAND AFTERWARDS, WHICH IS THE OTHER HALF OF WHAT WAS WRITTEN');
{
    const devin = at('swan_colonist_1', 2312, 3684);
    const { pages } = talk('swandevin_b', devin, 200); // ^swan_complete
    check(
        '  the fishing is good again',
        pages.some(l => l.includes(AFTER)),
        true
    );
    check(
        '  and he is not still complaining',
        pages.some(l => l.includes(BEFORE)),
        false
    );
}

console.log('\nTHE SHELL THE LINES USED TO HANG ON, WHICH THE MAP PLACES NOWHERE');
{
    // The reason this is a check and not a comment: if the shell were placed, a click on IT would
    // need the trigger it still has, and the fix would be half a fix. It is placed nowhere, so the
    // colony trigger is the only route to those two lines - and if a future map import adds one,
    // this check says so instead of letting the claim rot.
    const shell = NpcType.getId('swan_boat_colonist');
    let placed = 0;
    for (const npc of World.npcs) {
        if (npc && npc.isActive && npc.type === shell) {
            placed++;
        }
    }
    check('  swan_boat_colonist stands in no map square', placed, 0);
    check('  so its handler was reachable by nobody', !!ScriptProvider.getByTriggerSpecific(ServerTriggerType.OPNPC1, shell, NpcType.get(shell).category) && placed === 0, true);
    // And the spawn the content's comment mistook for it, one id along, which is a different npc
    // with no Talk-to of its own.
    const boatwoman = NpcType.getId('swan_boat_boatwoman');
    check('  the m37_54 spawn is swan_boat_boatwoman, the next id', boatwoman, shell + 1);
    check('  and it advertises no Talk-to to be dead', NpcType.get(boatwoman).op?.[0] ?? '', '');
}

console.log('\nTHE TWO BESIDE HIM, STILL UNWRITTEN - DeathPlateau-Bugs#27');
{
    for (const [name, x, z, who] of [
        ['swan_colonist_2', 2322, 3684, 'George Laxmeister'],
        ['swan_colonist_3', 2342, 3677, 'Ramara du Croissant']
    ] as [string, number, number, string][]) {
        const npc = at(name, x, z);
        check(`  ${name} is ${who}`, NpcType.get(npc.type).name, who);
        const { mesgs } = talk('swanunw' + name.slice(-1), npc, 0);
        check(
            '  and is still told he is not interested',
            mesgs.some(m => m.includes(`${who} is not interested in talking.`)),
            true
        );
    }
}

console.log(`\n${R.ok} ok, ${R.bad} FAIL`);
process.exit(R.bad ? 1 : 0);
