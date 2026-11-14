// EVERY TOOL A RANDOM EVENT CAN BREAK, AND WHETHER ANYBODY CAN PUT IT BACK.
//
//   npx tsx tools/sim/bobrepair.ts
//
// "broken dragon axe - talking to bob doesn't fix it, even though it tells you to take it to him;
// check the rest of things that bob is supposed to fix".
//
// The report was exact. macro_broken_dragon_hatchet carried neither to_be_fixed_by_bob nor fixed,
// so bob.rs2 fell through to "Sorry friend, but I can't do anything with that" on an item whose own
// description reads "Bob can fix this for me." An Ent could therefore destroy a 55,000gp dragon axe
// outright. Every piece of art for it was already in the cache - broken model, manwear, womanwear,
// the head, its own handle - only the two params were missing.
//
// Checking the rest found two more faults of the same shape:
//
//   * the gilded axe and gilded pickaxe named the RUNE broken forms and the RUNE heads, and those
//     repair into rune_axe / rune_pickaxe. An Ent or an exploding rock turned a clue-scroll reward
//     into an ordinary rune tool, permanently and without a word.
//   * macro_event_ent.rs2 and macro_event_gas.rs2 ran inv_del and then handed the result of
//     oc_param(tool, broken) to inv_setslot. That param is null for third age (and now for gilded),
//     and both inv_setslot and inv_add do nothing with a null obj - so the tool was simply deleted.
//     macro_event_lost_axe.rs2 and macro_event_lost_pickaxe.rs2 already guard their half of this.
//
// WHAT THIS ASSERTS. The round trip, not the presence of a param: a tool that breaks must come back
// as THE SAME TOOL. "repairs into something" would have passed on the gilded axe the whole time.
import * as H from './harness.js';
import * as A from './a1lib.js';
import ObjType from '#/cache/config/ObjType.js';
import ParamType from '#/cache/config/ParamType.js';
import Player from '#/engine/entity/Player.js';
import ScriptProvider from '#/engine/script/ScriptProvider.js';
import ScriptRunner from '#/engine/script/ScriptRunner.js';
import ScriptPointer from '#/engine/script/ScriptPointer.js';

await H.boot();
H.loginOrder();

const R = { ok: 0, bad: 0 };
const check = (what: string, got: unknown, want: unknown) => {
    const pass = JSON.stringify(got) === JSON.stringify(want);
    if (pass) R.ok++;
    else R.bad++;
    console.log(`  ${pass ? 'ok  ' : 'FAIL'} ${what}: ${JSON.stringify(got)}${pass ? '' : `   (want ${JSON.stringify(want)})`}`);
};

const param = (objName: string, paramName: string): string | null => {
    const type = ObjType.get(ObjType.getId(objName));
    const id = ParamType.getId(paramName);
    const raw = type.params?.get(id);
    if (raw === undefined) return null;
    return typeof raw === 'number' ? (ObjType.get(raw).debugname ?? String(raw)) : String(raw);
};
const flag = (objName: string, paramName: string): boolean => {
    const type = ObjType.get(ObjType.getId(objName));
    return type.params?.get(ParamType.getId(paramName)) !== undefined;
};

// Every tool the woodcutting and mining ladders can hand to a random event.
const AXES = ['bronze_axe', 'iron_axe', 'steel_axe', 'black_axe', 'mithril_axe', 'adamant_axe', 'rune_axe', 'dragon_axe', 'gilded_axe', 'third_age_axe'];
const PICKAXES = ['bronze_pickaxe', 'iron_pickaxe', 'steel_pickaxe', 'mithril_pickaxe', 'adamant_pickaxe', 'rune_pickaxe', 'dragon_pickaxe', 'gilded_pickaxe', 'third_age_pickaxe'];

console.log('\n================ WHAT BREAKS, AND WHAT COMES BACK');

function roundTrip(tools: string[], brokenParam: string, headParam: string, repairer: string) {
    for (const tool of tools) {
        const broken = param(tool, brokenParam);
        const head = param(tool, headParam);

        if (broken === null) {
            // Immune by design. The events must agree, which the behavioural half below checks.
            check(`${tool} has no broken form, so it has no severed head either`, head, null);
            continue;
        }

        // THE ROUND TRIP. Not "it repairs", but "it repairs into itself".
        check(`${tool} -> ${broken} -> back to itself`, param(broken, 'fixed'), tool);
        check(`  and ${repairer} will take it`, flag(broken, repairer), true);
        if (head !== null) {
            check('  its severed head rebuilds the same tool', param(head, 'fixed'), tool);
        }
    }
}

console.log('\n  axes (Bob, in Lumbridge)');
roundTrip(AXES, 'broken', 'axe_head', 'to_be_fixed_by_bob');
console.log('\n  pickaxes (Nurmof, under Falador)');
roundTrip(PICKAXES, 'broken', 'pickaxe_head', 'to_be_fixed_by_nurmof');

// A BROKEN AXE IS WIELDABLE, so it needs the combat block or a player holding one has no attack
// animation at all. The dragon one had wearpos=righthand and nothing else.
console.log('\n  a broken axe is held in the right hand, so it needs attack params');
for (const tool of AXES) {
    const broken = param(tool, 'broken');
    if (broken === null) continue;
    check(`  ${broken} has an attack rate`, flag(broken, 'attackrate'), true);
    check(`  ${broken} has a defend anim`, flag(broken, 'defend_anim'), true);
}

// ---- AND NOW BOB HIMSELF, because the params above are only a claim about what he will do. ----
console.log('\n================ BOB ACTUALLY REPAIRS IT');

const BOB = H.npcNear('bob', 3231, 3203);
check('Bob is on the map in Lumbridge', BOB !== null, true);

function customer(name: string, broken: string, coins: number): Player {
    const p = A.player(name, BOB!.x + 1, BOB!.z, 0);
    H.maxOut(p);
    H.clearInv(p);
    H.give(p, broken, 1);
    if (coins > 0) H.give(p, 'coins', coins);
    H.tick(1);
    return p;
}

for (const tool of AXES) {
    const broken = param(tool, 'broken');
    if (broken === null) continue;
    const cost = ObjType.get(ObjType.getId(broken)).cost;

    const p = customer(`bob_${tool}`, broken, cost);
    // "Yes, please." is option 1 of the ~p_choice2 Bob opens. a1lib THROWS when that menu never
    // appears - which is exactly what a Bob who has no branch for the item does - so the throw is
    // caught and turned into a failed check. A stack trace is a worse regression report than a
    // line naming the axe he would not look at.
    let said: string[] = [];
    let reached = true;
    try {
        said = A.useOnNpc(p, 'bob', broken, [1]);
    } catch (e) {
        reached = false;
        said = [(e as Error).message];
    }

    console.log(`\n  ${broken} (${cost}gp)`);
    check('    he opens the repair menu', reached, true);
    check('    and offers to repair it', A.saw(said, 'repair'), true);
    check(`    ${tool} back in the inventory`, H.invCount(p, tool), 1);
    check('    the broken one is gone', H.invCount(p, broken), 0);
    check(`    and it cost ${cost}gp`, H.invCount(p, 'coins'), 0);
    H.despawn(p);
}

// WITHOUT THE MONEY he says so and keeps his hands off it - a repair that silently ate the item
// would be worse than the bug it replaced.
{
    const broken = param('dragon_axe', 'broken')!;
    const p = customer('bob_broke', broken, 0);
    const said = A.useOnNpc(p, 'bob', broken, []);
    console.log('\n  with no coins at all');
    check('    he asks for the money', A.saw(said, "I'll need"), true);
    check('    the broken axe is still there', H.invCount(p, broken), 1);
    check('    and no axe appeared', H.invCount(p, 'dragon_axe'), 0);
    H.despawn(p);
}

// AND SOMETHING HE REALLY CANNOT FIX still gets the refusal, so the branch above is reached by
// having the params and not by Bob repairing whatever he is handed.
{
    const p = customer('bob_nope', 'bronze_axe', 1000);
    const said = A.useOnNpc(p, 'bob', 'bronze_axe', []);
    console.log('\n  handed something that is not broken at all');
    check('    he turns it down', A.saw(said, "can't do anything with that"), true);
    check('    and keeps his hands off it', H.invCount(p, 'bronze_axe'), 1);
    H.despawn(p);
}

// ---- AND THE EVENT ITSELF, because the params above only say what SHOULD happen. ------------
//
// macro_event_damage_axe is the half of the Ent that swaps the axe. Run directly against a live
// Ent npc: a label is addressable as "[label,name]", and it writes %macro_ent_counter, so it needs
// the protected-player pointer the engine would already be holding here.
console.log('\n================ WHAT THE ENT DOES TO EACH AXE');
{
    const ent = H.addNpc('macro_ent_tree1', 3200, 3230);
    const damage = ScriptProvider.getByName('[label,macro_event_damage_axe]');
    check('the Ent damage label is reachable', damage !== undefined, true);

    const swing = (axe: string) => {
        const p = A.player(`ent_${axe.slice(0, 7)}`, 3200, 3231, 0);
        H.maxOut(p);
        H.clearInv(p);
        H.give(p, axe, 1);
        H.setVar(p, 'macro_ent_counter', 6); // the sixth swing is the one that damages
        H.tick(1);
        const state = ScriptRunner.init(damage!, ent, p, [ObjType.getId(axe)]);
        state.pointerAdd(ScriptPointer.ProtectedActivePlayer);
        ScriptRunner.execute(state);
        const held = H.invCount(p, axe);
        const broken = param(axe, 'broken');
        const got = broken === null ? 0 : H.invCount(p, broken);
        H.despawn(p);
        return { held, got };
    };

    for (const axe of AXES) {
        const broken = param(axe, 'broken');
        const r = swing(axe);
        if (broken === null) {
            // THE WHOLE POINT OF THE GUARD. inv_del had already run before the null reached
            // inv_setslot, so this axe used to come back held: 0, broken: 0 - gone.
            console.log(`\n  ${axe} has no broken form`);
            check('    the Ent leaves it alone', r.held, 1);
        } else {
            console.log(`\n  ${axe} -> ${broken}`);
            check('    the axe is taken', r.held, 0);
            check('    and the broken one is handed back', r.got, 1);
        }
    }
}

console.log(`\n${R.ok} ok, ${R.bad} FAIL`);
process.exit(R.bad ? 1 : 0);
