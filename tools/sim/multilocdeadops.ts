// A LOC CLICK IS DISPATCHED ON THE TYPE THE MAP PLACED, NOT ON THE FACE THE PLAYER IS LOOKING AT.
// Usage: NODE_MEMBERS=true npx tsx tools/sim/multilocdeadops.ts   (exit code is the verdict)
//
// OpLocHandler resolves a multiloc through its varp/varbit and uses the RESOLVED face to decide
// whether the option the client clicked exists. It then calls setInteraction with the Loc entity,
// and Player.getOpTrigger reads `LocType.get(this.target.type)` - the type the map placed. So the
// engine validates against the face and dispatches against the shell, and a handler written on the
// face can never fire.
//
// Three options in this build were written that way, and all three were dead:
//
//   enakh_furnace_multiloc  state 1  op2="Smelt"       the face carries category=smithing_furnace
//   burgh_furnace_multiloc  state 3  op2="Smelt"       the same, after a quest spent repairing it
//   fever_multi_cannon      state 0  op2="Empty-Out"   [oploc2,fever_cannon], on the face
//
// Each answered "Nothing interesting happens." after a `No trigger for [oploc2,<shell>]` in the
// journal. All three are fixed in the content by putting a trigger on the SHELL - safe without a
// state check, because the engine's own validation half means op2 cannot be clicked in a state
// whose face does not carry the label.
//
// WHAT IS NOT FIXED, and is the reason this file asserts a list rather than a zero: use-on has no
// label to validate, so a trigger on the shell would fire in every state - including the cracked
// furnace and the unlit one. Fixing those three needs either a state check plus a refactor of the
// shared [oplocu,_smithing_furnace] switch, or the engine resolving multiloc for the trigger
// lookup. The second would move 77 op pairs over 37,717 placed locs onto different scripts
// (poh_dynamic_window's 698 windows and the four millbases are most of it), so it is a decision
// rather than a patch: DeathPlateau-Bugs#106.
import * as H from './harness.js';
import { check, R, player, mark, mesSince } from './a1lib.js';
import LocType from '#/cache/config/LocType.js';
import { isVisibleOp } from '#/cache/config/OpVisibility.js';
import ScriptProvider from '#/engine/script/ScriptProvider.js';
import ServerTriggerType from '#/engine/script/ServerTriggerType.js';
import World from '#/engine/World.js';

await H.boot();

const claims = (trigger: number, type: number, category: number): boolean => !!ScriptProvider.getByTriggerSpecific(trigger, type, -1) || (category !== -1 && !!ScriptProvider.getByTriggerSpecific(trigger, -1, category));

/** Every loc type the map places, and how many of each. */
const placed = new Map<number, number>();
for (const zone of World.gameMap.existingZones()) {
    for (const loc of zone.getAllLocsUnsafe()) {
        placed.set(loc.type, (placed.get(loc.type) ?? 0) + 1);
    }
}

/**
 * Placed multiloc shells where a face claims a trigger the shell does not - the dead-click shape.
 *
 * ASKED OF THE WHOLE MAP rather than of the three known names, because the three are not the
 * point: the point is that writing a handler on a face is a mistake the engine does not report,
 * and the next one should fail here rather than in a player's hands.
 */
function faceOnly(use: boolean): string[] {
    const out: string[] = [];
    for (const [id, n] of placed) {
        const base = LocType.get(id);
        if (!base) continue;
        const faces = (base.multiloc ?? []).map((f, i) => [f, i] as [number, number]).filter(([f]) => f >= 0);
        if (!faces.length) continue;
        const ops = use ? [-1] : [0, 1, 2, 3, 4];
        for (const op of ops) {
            const trigger = use ? ServerTriggerType.OPLOCU : ServerTriggerType.OPLOC1 + op;
            const apTrigger = use ? ServerTriggerType.APLOCU : ServerTriggerType.APLOC1 + op;
            if (claims(trigger, id, base.category) || claims(apTrigger, id, base.category)) continue;
            for (const [f, i] of faces) {
                const face = LocType.get(f);
                // An op needs a label on the face to be clickable at all; a use-on does not.
                if (!use) {
                    const label = face.op?.[op];
                    if (!label || !isVisibleOp(label)) continue;
                }
                if (!claims(trigger, f, face.category) && !claims(apTrigger, f, face.category)) continue;
                out.push(use ? `${base.debugname} state ${i} use-on x${n}` : `${base.debugname} state ${i} op${op + 1}="${face.op?.[op]}" x${n}`);
            }
        }
    }
    return out.sort();
}

console.log('THE PROPERTY: NO PLACED LOC HAS AN OPTION ONLY ITS FACE ANSWERS');
{
    const dead = faceOnly(false);
    if (dead.length) {
        for (const row of dead) console.log('      ' + row);
    }
    check('  no clickable option is answered only on a face', dead, []);
}

console.log('\nTHE USE-ON HALF, STILL OPEN - DeathPlateau-Bugs#106');
{
    // Asserted as a LIST and not as a count, so that one more of these cannot arrive unnoticed and
    // so that fixing one makes this file say so.
    check('  exactly the three known ones', faceOnly(true), ['burgh_furnace_multiloc state 3 use-on x1', 'enakh_furnace_multiloc state 1 use-on x1', 'enakh_fountain_multiloc state 1 use-on x1'].sort());
}

/** Click an op on a loc from a tile that can reach it, with the multiloc put in the state asked. */
function clickLoc(who: string, name: string, x: number, z: number, level: number, varbit: string, state: number, op: number, dx = 3, dz = 0): string[] {
    const p = player(who, x + dx, z + dz, level);
    H.setVarBit(p, varbit, state);
    H.tick(1);
    const from = mark();
    H.opLoc(p, x, z, name, op);
    H.tick(20);
    const mesgs = mesSince(p, from);
    // The smelt window is a modal with no game message, so the caller gets both halves.
    return mesgs.concat((p as unknown as { containsModalInterface(): boolean }).containsModalInterface() ? ['<a modal opened>'] : []);
}

console.log('\nTHE TWO FURNACES, WHICH NOW SMELT');
{
    for (const [name, x, z, level, varbit, state, where] of [
        ['burgh_furnace_multiloc', 3527, 3209, 0, 'burgh_furnace_fix', 3, 'Burgh de Rott, repaired and fired'],
        ['enakh_furnace_multiloc', 3115, 9323, 1, 'enakh_smoke_room', 1, "Enakhra's temple, lit"]
    ] as [string, number, number, number, string, number, string][]) {
        const out = clickLoc('ml' + name.slice(0, 5), name, x, z, level, varbit, state, 2);
        console.log(`      (${where})`);
        check('  Smelt opens the smelting window', out.includes('<a modal opened>'), true);
        check(
            '  and says nothing interesting happens',
            out.some(m => m.includes('Nothing interesting happens.')),
            false
        );
        check(
            '  with no missing trigger in the journal',
            out.some(m => m.startsWith('No trigger for')),
            false
        );
    }
}

console.log('\nAND THE RUM DEAL CANNON, WHICH CAN BE STARTED OVER');
{
    // forceapproach=13 on a 1x2 loc: the east side is refused ("I can't reach that!"), the west
    // works. That is the loc's own data and not this sim's business, but it is why dx is negative.
    const out = clickLoc('mlcannon', 'fever_multi_cannon', 1816, 4833, 1, 'fever_cannon', 0, 2, -2);
    check(
        '  Empty-Out empties it',
        out.some(m => m.includes('You empty the cannon out and start again.')),
        true
    );
    check(
        '  and is not out of reach from the west',
        out.some(m => m.includes("I can't reach that!")),
        false
    );
}

console.log(`\n${R.ok} ok, ${R.bad} FAIL`);
process.exit(R.bad ? 1 : 0);
