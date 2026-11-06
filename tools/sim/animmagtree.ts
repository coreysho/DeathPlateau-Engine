// THE UNDEAD TREES, THE AXE THAT BOUNCES OFF THEM, AND TURAEL'S MISSING LINE.
// Usage: NODE_MEMBERS=true npx tsx tools/sim/animmagtree.ts   (exit code is the verdict)
//
// Reported from play: "cant chop undead tree for animal magnetism, wont give you the option to get
// the blessed axe", then "turael doesnt have a dialogue for axe; when trying to chop tree, just
// says nothing interesting happens". Three symptoms, two causes, and the third follows.
//
// USING THE AXE ON THE TREE WAS A DEAD CLICK. The trees are npcs with op1=Chop and there was an
// [opnpc1] for them, but no [opnpcu] - and a missing trigger is answered by the engine itself with
// "Nothing interesting happens." (Player.ts). Ava tells you to try your axe on the tree, so using
// the axe on the tree is exactly what a player does.
//
// AND THE AXE LADDER WAS THREE RUNGS SHORT. ~animmag_has_mithril_axe named mithril, adamant and
// rune, so a dragon, gilded or third-age axe - the three best in the build - read as no axe at all
// and the player got "You don't have an axe which could possibly affect this wood."
//
// WHICH IS WHY TURAEL HAD NOTHING TO SAY. His line is gated on ~animmag_turael_offer, which wants
// %animmag at ^animmag_turael_told (8). You reach 8 by bouncing an axe (7) and telling Ava. Neither
// of the two faults above lets you bounce one, so the quest cannot leave stage 6 and Turael's trade
// is unreachable. Nothing was wrong with Turael.
import * as H from './harness.js';
import * as A from './a1lib.js';
import { check, R, player } from './a1lib.js';
import World from '#/engine/World.js';
import NpcType from '#/cache/config/NpcType.js';
import ObjType from '#/cache/config/ObjType.js';
import ParamType from '#/cache/config/ParamType.js';
import CategoryType from '#/cache/config/CategoryType.js';
import VarPlayerType from '#/cache/config/VarPlayerType.js';
import { Interaction } from '#/engine/entity/Interaction.js';
import ServerTriggerType from '#/engine/script/ServerTriggerType.js';
import InvType from '#/cache/config/InvType.js';
import fs from 'fs';

await H.boot();
H.loginOrder();

const MAGNET_GIVEN = 6;
const AXE_BOUNCED = 7;
const TURAEL_TOLD = 8;
const HAS_BLESSED_AXE = 9;

const setStage = (p: any, v: number) => p.setVar(VarPlayerType.getByName('animmag')!.id, v);
const stage = (p: any) => p.getVar(VarPlayerType.getByName('animmag')!.id);

const trees = (() => {
    const id = NpcType.getId('animmag_undead_tree');
    const out: any[] = [];
    for (const npc of World.npcs) if (npc && npc.type === id) out.push(npc);
    return out;
})();

/** A player standing beside a tree, that far into the quest, carrying that axe. */
const atTree = (name: string, tree: any, axe: string | null, st = MAGNET_GIVEN) => {
    let spot: [number, number] | null = null;
    for (const [dx, dz] of [
        [0, -1],
        [1, 0],
        [-1, 0],
        [0, 1]
    ])
        if (A.walkable(0, tree.x + dx, tree.z + dz)) {
            spot = [tree.x + dx, tree.z + dz];
            break;
        }
    const p: any = player(name, spot![0], spot![1], 0);
    H.maxOut(p);
    H.clearInv(p);
    setStage(p, st);
    if (axe) H.give(p, axe, 1);
    H.tick(1);
    H.clearLogs();
    return p;
};

/** What "use this item on that npc" does: OpNpcUHandler, minus the client validation. */
const useOnNpc = (p: any, objName: string, npc: any) => {
    const obj = ObjType.getId(objName);
    const inv = p.getInventory(InvType.INV)!;
    let slot = -1;
    for (let i = 0; i < inv.capacity; i++)
        if (inv.get(i)?.id === obj) {
            slot = i;
            break;
        }
    if (slot === -1) throw new Error('not carrying ' + objName);
    p.clearPendingAction();
    p.lastUseItem = obj;
    p.lastUseSlot = slot;
    p.setInteraction(Interaction.ENGINE, npc, ServerTriggerType.APNPCU);
    p.opcalled = true;
};

console.log('== all four trees can be reached and answer a Chop');
{
    check('there are four of them', trees.length, 4);
    for (const t of trees) {
        const p = atTree('amt' + t.x, t, 'mithril_axe');
        H.opNpc(p, t, 1);
        for (let k = 0; k < 10; k++) H.tick(1);
        check(`  ${t.x},${t.z} bounces the axe`, A.said(p, 0, 'bounces off the undead wood'), true);
        H.despawn(p);
    }
}

console.log('\n== using the axe on the tree does the same, instead of nothing');
{
    const t = trees[0];
    const p = atTree('amtuse', t, 'mithril_axe');
    useOnNpc(p, 'mithril_axe', t);
    for (let k = 0; k < 10; k++) H.tick(1);
    const said = A.mesOf(p);
    // The engine's own words for a missing trigger. This is what the report said it saw.
    check(
        'not "Nothing interesting happens."',
        said.some(m => m.includes('Nothing interesting')),
        false
    );
    check(
        '  the axe bounces',
        said.some(m => m.includes('bounces off the undead wood')),
        true
    );
    check('  and the quest moves on', stage(p), AXE_BOUNCED);
    H.despawn(p);
}

console.log('\n== every axe from mithril up is an axe, the three best included');
{
    for (const axe of ['mithril_axe', 'adamant_axe', 'rune_axe', 'dragon_axe', 'gilded_axe', 'third_age_axe']) {
        const t = trees[1];
        const p = atTree('amx' + axe, t, axe);
        H.opNpc(p, t, 1);
        for (let k = 0; k < 10; k++) H.tick(1);
        check(`  ${axe}`, A.said(p, 0, 'bounces off the undead wood'), true);
        H.despawn(p);
    }
    // ...and below mithril it is still not an axe, which is the transcript's own line.
    for (const axe of ['bronze_axe', 'iron_axe', 'steel_axe', 'black_axe']) {
        const t = trees[1];
        const p = atTree('amn' + axe, t, axe);
        H.opNpc(p, t, 1);
        for (let k = 0; k < 10; k++) H.tick(1);
        check(`  ${axe} is too soft`, A.said(p, 0, 'could possibly affect this wood'), true);
        H.despawn(p);
    }
}

console.log('\n== and the list matches the woodcutting ladder, so a seventh axe cannot be missed');
{
    // The ladder in ~woodcutting_best_axe is the build's own ranking of axes. Everything it ranks
    // at mithril or above has to be in ~animmag_has_mithril_axe, or that axe reads as no axe here.
    const woodcut = fs.readFileSync('../content/scripts/skill_woodcutting/scripts/woodcut.rs2', 'utf8');
    const ladder = woodcut.slice(woodcut.indexOf('[proc,woodcutting_best_axe]'));
    const ranked = [...ladder.matchAll(/\$obj1 = (\w+_axe)/g)].map(m => m[1]);
    const mithrilAt = ranked.indexOf('mithril_axe');
    check('the ladder ranks mithril', mithrilAt >= 0, true);
    const wanted = ranked.slice(0, mithrilAt + 1).sort();
    const quest = fs.readFileSync('../content/scripts/quests/quest_animmag/scripts/animmag_trees.rs2', 'utf8');
    // Just that proc: Turael's conversation below it also counts mithril axes, for his trade.
    const from = quest.indexOf('[proc,animmag_has_mithril_axe]');
    const next = quest.indexOf('\n[', from + 1);
    const body = quest.slice(from, next === -1 ? undefined : next);
    const listed = [...body.matchAll(/inv_total\(inv, (\w+_axe)\)/g)].map(m => m[1]).sort();
    check('  and the quest accepts exactly those', listed, wanted);
    // The categories agree too: everything listed is a real woodcutting axe, not a battleaxe.
    const cat = CategoryType.getId('weapon_axe');
    const struct = ParamType.getId('woodcutting_struct');
    const notAxes = listed.filter(n => {
        const t = ObjType.get(ObjType.getId(n)) as unknown as { category: number; params?: Map<number, unknown> };
        return t.category !== cat || !t.params?.has(struct);
    });
    check('  all of them are woodcutting axes', notAxes, []);
}

console.log('\n== with the bounce reported, Turael offers the trade');
{
    const t = trees[2];
    const p = atTree('amtur', t, 'dragon_axe');
    H.opNpc(p, t, 1);
    for (let k = 0; k < 10; k++) H.tick(1);
    check('the axe bounced with a dragon axe', stage(p), AXE_BOUNCED);

    const ava: any = (() => {
        const id = NpcType.getId('animmag_ava');
        for (const npc of World.npcs) if (npc && npc.type === id) return npc;
    })();
    p.teleport(ava.x + 1, ava.z, ava.level);
    H.tick(1);
    H.clearLogs();
    H.opNpc(p, ava, 1);
    A.drive(p, [], 6);
    check('  Ava names Turael', stage(p), TURAEL_TOLD);

    const turael: any = (() => {
        const id = NpcType.getId('slayer_master_1');
        for (const npc of World.npcs) if (npc && npc.type === id) return npc;
    })();
    p.teleport(turael.x + 1, turael.z, turael.level);
    H.give(p, 'mithril_axe', 1);
    H.give(p, 'blessedstar', 1);
    H.tick(1);
    H.clearLogs();
    H.opNpc(p, turael, 1);
    const lines = A.drive(p, ["I'm here about those trees near Draynor Manor.", "I'd love one, thanks."], 8);
    check('  and Turael has the line', lines.join(' ').includes('may it serve you well'), true);
    check('    hands over his axe', H.invCount(p, 'animmag_blessed_axe'), 1);
    check('    takes the mithril axe and the symbol', [H.invCount(p, 'mithril_axe'), H.invCount(p, 'blessedstar')], [0, 0]);
    check('    and records it', stage(p), HAS_BLESSED_AXE);

    // Back to the tree, which now gives twigs rather than a bounce.
    let spot: [number, number] | null = null;
    for (const [dx, dz] of [
        [0, -1],
        [1, 0],
        [-1, 0],
        [0, 1]
    ])
        if (A.walkable(0, t.x + dx, t.z + dz)) {
            spot = [t.x + dx, t.z + dz];
            break;
        }
    p.teleport(spot![0], spot![1], 0);
    H.tick(1);
    H.clearLogs();
    for (let n = 0; n < 12 && H.invCount(p, 'animmag_undead_twigs') === 0; n++) {
        H.opNpc(p, t, 1);
        for (let k = 0; k < 6; k++) H.tick(1);
    }
    check('  the blessed axe cuts undead twigs', H.invCount(p, 'animmag_undead_twigs') > 0, true);

    // AND USING THE BLESSED AXE ON THE TREE works too, which is the way the report tried it last:
    // "even testing the blessed axe on tree, still says nothing interest happens".
    const had = H.invCount(p, 'animmag_undead_twigs');
    H.clearInv(p);
    H.give(p, 'animmag_blessed_axe', 1);
    H.clearLogs();
    for (let n = 0; n < 12 && H.invCount(p, 'animmag_undead_twigs') === 0; n++) {
        useOnNpc(p, 'animmag_blessed_axe', t);
        for (let k = 0; k < 6; k++) H.tick(1);
    }
    check('  and so does using it on the tree', H.invCount(p, 'animmag_undead_twigs') > 0, true);
    check(
        "    without the engine's no-trigger line",
        A.mesOf(p).some(m => m.includes('Nothing interesting')),
        false
    );
    void had;
    H.despawn(p);
}

console.log(`\n${R.ok} ok, ${R.bad} FAIL`);
process.exit(R.bad ? 1 : 0);
