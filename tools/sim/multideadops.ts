// A CLICK IS DISPATCHED ON THE TYPE THE MAP PLACED, NOT ON THE FACE THE PLAYER IS LOOKING AT.
// Usage: NODE_MEMBERS=true npx tsx tools/sim/multideadops.ts   (exit code is the verdict)
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
// journal. The npcs work the same way - OpNpcHandler resolves multinpc to validate the option and
// Player.getOpTrigger reads the standing npc's own type - and this build had one of those too:
// alice_the_camel_multinpc, whose Talk-to appears when desert_alkharid_alis_visible is set and
// whose only handler was [opnpc1,alice_the_camel], on the face. All three are fixed in the content by putting a trigger on the SHELL - safe without a
// state check, because the engine's own validation half means op2 cannot be clicked in a state
// whose face does not carry the label.
//
// AND THE USE-ON HALF, WHICH COULD NOT BE FIXED THAT WAY, IS FIXED IN THE ENGINE (DeathPlateau-Bugs#106,
// owner's call: "C"). Use-on has no label to validate, so a trigger on the shell would fire in every
// state - including the cracked furnace and the unlit one. So Player.getOpTrigger and getApTrigger
// now fall back to the multiloc/multinpc FACE's handler when the placed type claims nothing of its
// own. A fallback and not a precedence change: resolving the face FIRST would have moved 77 loc pairs
// and 127 npc pairs onto different scripts, and Swan Song's opener and Azzanadra are deliberately
// written on the shell.
//
// SO THIS FILE NOW ASKS THREE THINGS, all of them by REAL DISPATCH - Player.getOpTrigger on a real
// placed shell in a real state, the thing a click actually runs - and not by reading where handlers
// are written, which is how it used to ask and is why it listed three cases as dead that the engine
// can now answer:
//   1. nothing that worked moved: wherever the shell claimed something, the answer is unchanged;
//   2. nothing clickable is left dead: no option whose face has a handler fails to reach it;
//   3. exactly what came alive is a known list, so a new one arriving - or one leaving - says so.
import * as H from './harness.js';
import { check, R, player, mark, mesSince } from './a1lib.js';
import LocType from '#/cache/config/LocType.js';
import NpcType from '#/cache/config/NpcType.js';
import { isVisibleOp } from '#/cache/config/OpVisibility.js';
import ScriptProvider from '#/engine/script/ScriptProvider.js';
import ServerTriggerType from '#/engine/script/ServerTriggerType.js';
import World from '#/engine/World.js';

await H.boot();

/**
 * ONE REAL PLAYER, THE THING A CLICK REALLY RUNS.
 *
 * The first version of this file read where handlers were WRITTEN and reported a click dead when a
 * face had one and the shell did not. That was the right question while the engine could not answer
 * it and is the wrong one now, because it would keep reporting cases the engine answers. So it asks
 * the engine: put a real player on a real placed shell, set the state, and call getOpTrigger /
 * getApTrigger - exactly what OpLocHandler and OpNpcHandler's interaction does next.
 */
const probe: any = player('mlprobe', 3222, 3218, 0);
H.tick(1);

type Found = { name: string; state: number; slot: string; clickable: boolean };
const scanLoc: { moved: string[]; dead: string[]; revived: Found[]; looked: number } = { moved: [], dead: [], revived: [], looked: 0 };
const scanNpc: { moved: string[]; dead: string[]; revived: Found[]; looked: number } = { moved: [], dead: [], revived: [], looked: 0 };

function scan(isLoc: boolean, entity: any, base: any, faces: number[], into: typeof scanLoc): void {
    const shell = isLoc ? LocType.get(entity.type) : NpcType.get(entity.type);
    const first = isLoc ? ServerTriggerType.APLOC1 : ServerTriggerType.APNPC1;
    const use = isLoc ? ServerTriggerType.APLOCU : ServerTriggerType.APNPCU;
    faces.forEach((f, state) => {
        if (f < 0) return;
        if (base.multivarp !== -1) probe.setVar(base.multivarp, state);
        else probe.setVarBit(base.multivarbit, state);
        const face = isLoc ? LocType.get(f) : NpcType.get(f);
        probe.target = entity;
        probe.targetSubject = { type: -1, com: -1 };
        [0, 1, 2, 3, 4, -1].forEach(i => {
            const apOp = i === -1 ? use : first + i;
            probe.targetOp = apOp;
            for (const kind of ['op', 'ap'] as const) {
                const trigger = kind === 'op' ? apOp + 7 : apOp;
                const old = ScriptProvider.getByTrigger(trigger, shell.id, shell.category) ?? null;
                const got = kind === 'op' ? probe.getOpTrigger() : probe.getApTrigger();
                into.looked++;
                const shellClaimed = !!(ScriptProvider.getByTriggerSpecific(trigger, shell.id) || (shell.category !== -1 && ScriptProvider.getByTriggerSpecific(trigger, -1, shell.category)));
                const label = i === -1 ? 'use-on' : `op${i + 1}`;
                const tag = `${shell.debugname} state ${state} ${label}`;
                // 1. NOTHING THAT WORKED MOVED.
                if (shellClaimed && got !== old) into.moved.push(`${tag} (${kind})`);
                // 2. THE FACE'S OWN HANDLER, if it has one, and whether this player could click it.
                const faceClaim = ScriptProvider.getByTriggerSpecific(trigger, f) ?? (face.category !== -1 ? ScriptProvider.getByTriggerSpecific(trigger, -1, face.category) : undefined);
                const opLabel = i === -1 ? null : face.op?.[i];
                // Use-on has no label to validate, so it is always reachable; an op needs a visible one, and
                // an npc's Attack is the engine's own with no content trigger anywhere.
                const clickable = i === -1 || (!!opLabel && isVisibleOp(opLabel) && !/^attack$/i.test(opLabel));
                if (!shellClaimed && faceClaim) {
                    if (got === faceClaim) {
                        // it came alive through the fallback
                        if (!into.revived.some(r => r.name === shell.debugname && r.state === state && r.slot === label)) {
                            into.revived.push({ name: shell.debugname ?? String(shell.id), state, slot: label, clickable });
                        }
                    } else if (clickable) {
                        // A CLICKABLE OPTION THE FACE ANSWERS AND THE ENGINE STILL DOES NOT REACH - the dead click.
                        into.dead.push(`${tag} (${kind})`);
                    }
                }
            }
        });
    });
}

{
    const seen = new Set<number>();
    for (const zone of World.gameMap.existingZones()) {
        for (const loc of zone.getAllLocsUnsafe()) {
            if (seen.has(loc.type)) continue;
            const base = LocType.get(loc.type);
            if (!base || (base.multivarp === -1 && base.multivarbit === -1) || !base.multiloc?.length) continue;
            seen.add(loc.type);
            scan(true, loc, base, base.multiloc, scanLoc);
        }
    }
    const seenNpc = new Set<number>();
    for (const npc of World.npcs) {
        if (!npc || seenNpc.has(npc.type)) continue;
        const base = NpcType.get(npc.type);
        if (!base || (base.multivarp === -1 && base.multivarbit === -1) || !base.multinpc?.length) continue;
        seenNpc.add(npc.type);
        scan(false, npc, base, base.multinpc, scanNpc);
    }
    // PUT THE PROBE DOWN. It was aimed at a target by assigning the field directly, not through
    // setInteraction, so left alone the engine finds a target nobody asked for on the next tick and
    // drops it with a "changed type" warning - which is noise at best and, at worst, a player who
    // starts walking towards the last npc scanned.
    probe.target = null;
    probe.targetOp = -1;
    probe.targetSubject = { type: -1, com: -1 };
    probe.clearInteraction();
    console.log(`      (${seen.size} loc shells and ${seenNpc.size} npc shells, every state, every option, op and ap: ${scanLoc.looked + scanNpc.looked} lookups)`);
}

console.log('NOTHING THAT WORKED MOVED');
{
    // THE WHOLE DECISION RESTS ON THIS. Option B - resolving the face first - would have moved 77 loc
    // pairs and 127 npc pairs, among them Swan Song's opener and Azzanadra, whose handlers are
    // deliberately on the shell. The fallback only runs when the shell claims nothing, so wherever
    // the shell DID claim something the engine must give exactly the answer it always did.
    check('  locs: no shell with its own handler dispatches anywhere new', scanLoc.moved, []);
    check('  npcs: the same', scanNpc.moved, []);
}

console.log('\nNO CLICKABLE OPTION IS LEFT DEAD');
{
    // THE PROPERTY THE FIRST VERSION OF THIS FILE ASKED, asked of the engine instead of the source:
    // an option a player can click, whose face has a handler, must reach it. The next author to write
    // a handler on a face now gets a working click - and a mistake in the fallback itself gets here.
    check('  locs: every clickable option reaches the handler its face has', scanLoc.dead, []);
    check('  npcs: the same', scanNpc.dead, []);
}

console.log('\nWHAT CAME ALIVE, AS A LIST');
{
    // A LIST AND NOT A COUNT, so that one more arriving - or one leaving - says so. Three of these
    // are the use-on cases this issue was left open for. The fourth is NOT a click anybody can make:
    // the catapult's state 0 face is a pile of crates with no options at all, so OpLocHandler rejects
    // the click before it dispatches. It is listed because the dispatch really does change - a crate
    // handler now answers where nothing did - and because a list that quietly omitted it would be a
    // list that could not be trusted to be complete.
    const row = (r: Found) => `${r.name} state ${r.state} ${r.slot}${r.clickable ? '' : ' (not clickable: the face has no such option)'}`;
    const alive = [...scanLoc.revived, ...scanNpc.revived].map(row).sort();
    for (const r of alive) console.log('      ' + r);
    check(
        '  exactly the three use-on cases, and the one nobody can click',
        alive,
        ['burgh_furnace_multiloc state 3 use-on', 'enakh_furnace_multiloc state 1 use-on', 'enakh_fountain_multiloc state 1 use-on', 'makinghistory_catapult_multiloc state 0 op1 (not clickable: the face has no such option)'].sort()
    );
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

console.log('\nALICE THE CAMEL, WHOSE HANDLER WAS WRITTEN FOR A DAY THAT WOULD NOT HAVE WORKED');
{
    // Her shell's state 1 shows "Talk-to" when desert_alkharid_alis_visible is set, and nothing in
    // this build sets it - Ali Morrisane's traders are not here - so this is not a bug a player can
    // reach today. It is the one the content's own comment promised would be right "the day the bit
    // is set", and it would not have been: the handler was on the face. Set the bit and click.
    const npc = H.npcNear('alice_the_camel_multinpc', 3285, 3201, 0);
    check('  the shell is still placed in Al Kharid', !!npc, true);
    if (npc) {
        const p = player('mlalice', npc.x + 1, npc.z, npc.level);
        H.setVarBit(p, 'desert_alkharid_alis_visible', 1);
        H.tick(1);
        check('  with the bit set she offers Talk-to', H.npcOpWord(p, npc, 1), 'Talk-to');
        H.standBeside(p, npc);
        const from = mark();
        H.opNpc(p, npc, 1);
        H.tick(4);
        const out = mesSince(p, from);
        check(
            '  and the click is answered',
            out.some(m => m.startsWith('No trigger for')),
            false
        );
        check(
            '  not with nothing interesting happening',
            out.some(m => m.includes('Nothing interesting happens.')),
            false
        );
    }
}

console.log('\nAND THE USE-ON CASES, CLICKED - THE PART A SHELL TRIGGER COULD NOT DO');
{
    // A trigger on the shell would have fired in every state, including the cracked furnace and the
    // unlit one. The fallback fires only in the state whose face carries the handler, so each of
    // these is asserted BOTH ways: it works in the state it should, and does nothing in the others.
    function useOn(who: string, item: string, name: string, x: number, z: number, level: number, varbit: string, state: number): string[] {
        const p = player(who, x + 3, z, level);
        H.give(p, item, 1);
        H.setVarBit(p, varbit, state);
        H.tick(1);
        const from = mark();
        H.useHeldOnLoc(p, item, x, z, name);
        H.tick(20);
        return mesSince(p, from);
    }

    for (const [name, x, z, level, varbit, good, bad, where] of [
        ['burgh_furnace_multiloc', 3527, 3209, 0, 'burgh_furnace_fix', 3, 1, 'Burgh de Rott'],
        ['enakh_furnace_multiloc', 3115, 9323, 1, 'enakh_smoke_room', 1, 0, "Enakhra's temple"]
    ] as [string, number, number, number, string, number, number, string][]) {
        const works = useOn('mu' + name.slice(0, 4) + 'a', 'iron_ore', name, x, z, level, varbit, good);
        console.log(`      (${where}, iron ore on the furnace in state ${good})`);
        check(
            '  smelts in the state whose face is a working furnace',
            works.some(m => m.includes('smelt the iron')),
            true
        );
        check(
            '  with no missing trigger in the journal',
            works.some(m => m.startsWith('No trigger for')),
            false
        );
        const dead = useOn('mu' + name.slice(0, 4) + 'b', 'iron_ore', name, x, z, level, varbit, bad);
        console.log(`      (...and in state ${bad}, where it is not one)`);
        check(
            '  and does nothing in the state that is not',
            dead.some(m => m.includes('smelt')),
            false
        );
    }

    const fill = useOn('mufountain', 'bucket_empty', 'enakh_fountain_multiloc', 3091, 9307, 1, 'enakh_ice_room', 1);
    console.log('      (a bucket at the fountain, state 1)');
    check(
        '  fills from the fountain',
        fill.some(m => m.toLowerCase().includes('fill the bucket')),
        true
    );
    // THE REASON THE SHELLS GOT NAMES. The face's handler asks the ACTIVE loc for its name, and the
    // active loc is the shell - bare C said "You fill the bucket from the null."
    check(
        '  and names it - not "the null"',
        fill.some(m => m.includes('null')),
        false
    );
    const frozen = useOn('mufrozen', 'bucket_empty', 'enakh_fountain_multiloc', 3091, 9307, 1, 'enakh_ice_room', 0);
    check(
        '  while the frozen one fills nothing',
        frozen.some(m => m.toLowerCase().includes('fill the bucket')),
        false
    );
}

console.log(`\n${R.ok} ok, ${R.bad} FAIL`);
process.exit(R.bad ? 1 : 0);
